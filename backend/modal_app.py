"""
Modal app serving StreamVGGT for real-time streaming 3D reconstruction via WebSocket.

Deploy with:
    modal deploy backend/modal_app.py

Run locally (dev mode):
    modal serve backend/modal_app.py
"""

import modal

# ---------------------------------------------------------------------------
# Modal Image: install all dependencies, clone StreamVGGT, download weights
# ---------------------------------------------------------------------------
streamvggt_image = (
    modal.Image.debian_slim(python_version="3.11")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0")
    .pip_install(
        "torch==2.3.1",
        "torchvision==0.18.1",
        "numpy==1.26.1",
        "Pillow==10.3.0",
        "huggingface_hub",
        "safetensors",
        "roma",
        "einops",
        "opencv-python-headless",
        "scipy",
        "trimesh",
        "fastapi",
        "uvicorn",
        "websockets",
        "transformers",
    )
    # Clone the StreamVGGT repository into /root/StreamVGGT
    .run_commands("git clone https://github.com/wzzheng/StreamVGGT.git /root/StreamVGGT")
    # Download the checkpoint from HuggingFace
    .run_commands(
        "python -c \""
        "from huggingface_hub import hf_hub_download; "
        "hf_hub_download("
        "    repo_id='lch01/StreamVGGT',"
        "    filename='checkpoints.pth',"
        "    local_dir='/root/StreamVGGT/ckpt',"
        "    local_dir_use_symlinks=False,"
        ")\""
    )
)

app = modal.App("streamvggt", image=streamvggt_image)

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_FRAMES = 30  # Sliding window: keep at most this many frames
TARGET_POINTS = 5000  # Subsample to this many points for network transfer
IMAGE_LONG_SIDE = 518  # StreamVGGT expected input size
PATCH_SIZE = 14  # Dimensions must be divisible by this


# ---------------------------------------------------------------------------
# StreamVGGT Service
# ---------------------------------------------------------------------------
@app.cls(
    gpu="A10G",
    timeout=600,
    scaledown_window=300,
)
class StreamVGGTService:
    """
    Serves StreamVGGT for real-time streaming 3D reconstruction.

    The model accumulates frames in a sliding window and processes them
    all on each call (building KV cache internally). Only the latest
    frame's reconstruction is returned.
    """

    @modal.enter()
    def load_model(self):
        import sys
        import torch

        # Add StreamVGGT source to path
        sys.path.insert(0, "/root/StreamVGGT/src")

        from streamvggt.models.streamvggt import StreamVGGT

        print("Loading StreamVGGT model...")
        self.model = StreamVGGT()
        ckpt_path = "/root/StreamVGGT/ckpt/checkpoints.pth"
        ckpt = torch.load(ckpt_path, map_location="cpu")
        self.model.load_state_dict(ckpt, strict=True)
        self.model.eval().to("cuda")
        del ckpt
        torch.cuda.empty_cache()

        # Determine dtype based on GPU capability
        capability = torch.cuda.get_device_capability()
        self.dtype = torch.bfloat16 if capability[0] >= 8 else torch.float16

        # Per-session state (reset via WebSocket lifecycle)
        self.frames = []
        self.raw_images = []  # Store original RGB images for color extraction

        print(f"StreamVGGT loaded on {torch.cuda.get_device_name()} with dtype={self.dtype}")

    # ------------------------------------------------------------------
    # Image preprocessing (mirrors StreamVGGT's load_and_preprocess_images)
    # ------------------------------------------------------------------
    def _preprocess_image(self, pil_image):
        """
        Preprocess a PIL image to match StreamVGGT's expected input format.
        Returns a tensor of shape (1, 3, H, W) in [0, 1] range, and the
        resized RGB numpy array for color extraction.
        """
        import numpy as np
        import torch
        from PIL import Image

        img = pil_image.convert("RGB")

        # Resize so that width = IMAGE_LONG_SIDE, preserve aspect ratio
        w, h = img.size
        new_w = IMAGE_LONG_SIDE
        new_h = int(h * new_w / w)

        # Make dimensions divisible by PATCH_SIZE
        new_h = (new_h // PATCH_SIZE) * PATCH_SIZE
        new_w = (new_w // PATCH_SIZE) * PATCH_SIZE

        # If height exceeds IMAGE_LONG_SIDE, center crop
        if new_h > IMAGE_LONG_SIDE:
            img = img.resize((new_w, new_h), Image.BICUBIC)
            crop_top = (new_h - IMAGE_LONG_SIDE) // 2
            # Ensure cropped height is divisible by PATCH_SIZE
            crop_h = (IMAGE_LONG_SIDE // PATCH_SIZE) * PATCH_SIZE
            img = img.crop((0, crop_top, new_w, crop_top + crop_h))
            new_h = crop_h
        else:
            img = img.resize((new_w, new_h), Image.BICUBIC)

        # Convert to numpy [0, 1] range
        img_np = np.array(img).astype(np.float32) / 255.0  # (H, W, 3)

        # Convert to tensor (1, 3, H, W)
        img_tensor = torch.from_numpy(img_np).permute(2, 0, 1).unsqueeze(0)

        return img_tensor, img_np

    # ------------------------------------------------------------------
    # Core inference
    # ------------------------------------------------------------------
    def _run_inference(self):
        """
        Run StreamVGGT inference on all accumulated frames.
        Returns results for the latest frame only.
        """
        import sys
        import torch
        import numpy as np

        sys.path.insert(0, "/root/StreamVGGT/src")
        from streamvggt.utils.pose_enc import pose_encoding_to_extri_intri

        if not self.frames:
            return None

        with torch.no_grad():
            with torch.cuda.amp.autocast(dtype=self.dtype):
                output = self.model.inference(self.frames)

        # Extract only the LAST frame's results
        last_res = output.ress[-1]

        pts3d = last_res["pts3d_in_other_view"].squeeze(0)  # (H, W, 3)
        conf = last_res["conf"].squeeze(0)  # (H, W)
        camera_pose = last_res["camera_pose"].squeeze(0)  # (9,)

        # Get image dimensions from the last frame
        last_img = self.frames[-1]["img"]  # (1, 3, H, W)
        _, _, img_h, img_w = last_img.shape

        # Convert pose encoding to extrinsic/intrinsic
        pose_enc_batched = camera_pose.unsqueeze(0).unsqueeze(0)  # (1, 1, 9)
        extrinsic, intrinsic = pose_encoding_to_extri_intri(
            pose_enc_batched, image_size_hw=(img_h, img_w)
        )
        extrinsic = extrinsic.squeeze(0).squeeze(0)  # (3, 4)
        intrinsic = intrinsic.squeeze(0).squeeze(0)  # (3, 3)

        # Flatten point cloud: (H, W, 3) -> (H*W, 3)
        pts_flat = pts3d.reshape(-1, 3)
        conf_flat = conf.reshape(-1)

        # Get colors from the raw image
        raw_img = self.raw_images[-1]  # (H, W, 3) in [0, 1]
        colors_flat = torch.from_numpy(
            raw_img.reshape(-1, 3)
        ).to(pts_flat.device)

        # Subsample to TARGET_POINTS by picking highest-confidence points
        num_points = pts_flat.shape[0]
        if num_points > TARGET_POINTS:
            # Pick top-k by confidence
            _, top_indices = torch.topk(conf_flat, TARGET_POINTS)
            top_indices = top_indices.sort().values  # Sort for deterministic order
            pts_flat = pts_flat[top_indices]
            conf_flat = conf_flat[top_indices]
            colors_flat = colors_flat[top_indices]

        result = {
            "points": pts_flat.cpu().float().numpy().flatten().tolist(),
            "colors": colors_flat.cpu().float().numpy().flatten().tolist(),
            "confidence": conf_flat.cpu().float().numpy().tolist(),
            "camera_pose": camera_pose.cpu().float().numpy().tolist(),
            "extrinsic": extrinsic.cpu().float().numpy().flatten().tolist(),
            "intrinsic": intrinsic.cpu().float().numpy().flatten().tolist(),
            "num_points": min(num_points, TARGET_POINTS),
            "frame_index": len(self.frames) - 1,
            "total_frames": len(self.frames),
            "image_height": img_h,
            "image_width": img_w,
        }

        return result

    # ------------------------------------------------------------------
    # WebSocket endpoint for streaming
    # ------------------------------------------------------------------
    @modal.fastapi_endpoint(method="GET", docs=True)
    def health(self):
        """Health check endpoint."""
        return {
            "status": "ok",
            "model": "StreamVGGT",
            "max_frames": MAX_FRAMES,
            "target_points": TARGET_POINTS,
        }

    @modal.fastapi_endpoint(method="POST", docs=True)
    def process_frame(self, request: dict):
        """
        Process a single frame via POST request.

        Expects JSON body:
        {
            "image": "<base64-encoded JPEG>",
            "reset": false  // optional: clear accumulated frames
        }

        Returns JSON with point cloud, colors, confidence, camera pose,
        extrinsic and intrinsic matrices.
        """
        import base64
        import io
        import time

        from PIL import Image

        t_start = time.time()

        # Handle reset
        if request.get("reset", False):
            self.frames = []
            self.raw_images = []
            return {"status": "reset", "message": "Frame buffer cleared"}

        # Decode the base64 image
        image_b64 = request.get("image")
        if not image_b64:
            return {"error": "No 'image' field in request body"}

        try:
            image_bytes = base64.b64decode(image_b64)
            pil_image = Image.open(io.BytesIO(image_bytes))
        except Exception as e:
            return {"error": f"Failed to decode image: {str(e)}"}

        # Preprocess
        img_tensor, img_np = self._preprocess_image(pil_image)
        img_tensor = img_tensor.to("cuda")

        # Append to sliding window
        self.frames.append({"img": img_tensor})
        self.raw_images.append(img_np)

        # Enforce sliding window limit
        if len(self.frames) > MAX_FRAMES:
            # Remove oldest frames
            excess = len(self.frames) - MAX_FRAMES
            self.frames = self.frames[excess:]
            self.raw_images = self.raw_images[excess:]

        # Run inference on all accumulated frames
        result = self._run_inference()

        t_elapsed = time.time() - t_start
        if result:
            result["inference_time_ms"] = round(t_elapsed * 1000, 1)
        else:
            result = {"error": "Inference returned no results"}

        return result

    @modal.asgi_app()
    def websocket_app(self):
        """
        FastAPI ASGI app with a WebSocket endpoint for streaming frames.

        Client sends JSON messages:
        {
            "image": "<base64-encoded JPEG>",
            "reset": false  // optional
        }

        Server responds with JSON containing point cloud + pose data.
        """
        import base64
        import io
        import json
        import time
        import traceback

        from fastapi import FastAPI, WebSocket, WebSocketDisconnect
        from PIL import Image

        ws_app = FastAPI(title="StreamVGGT WebSocket")

        @ws_app.websocket("/ws")
        async def websocket_endpoint(websocket: WebSocket):
            await websocket.accept()

            # Reset per-session state on new connection
            self.frames = []
            self.raw_images = []

            try:
                while True:
                    # Receive message
                    raw_message = await websocket.receive_text()
                    msg = json.loads(raw_message)

                    t_start = time.time()

                    # Handle reset command
                    if msg.get("reset", False):
                        self.frames = []
                        self.raw_images = []
                        await websocket.send_json({
                            "status": "reset",
                            "message": "Frame buffer cleared",
                        })
                        continue

                    # Decode image
                    image_b64 = msg.get("image")
                    if not image_b64:
                        await websocket.send_json({"error": "No 'image' field"})
                        continue

                    try:
                        image_bytes = base64.b64decode(image_b64)
                        pil_image = Image.open(io.BytesIO(image_bytes))
                    except Exception as e:
                        await websocket.send_json({
                            "error": f"Failed to decode image: {str(e)}"
                        })
                        continue

                    # Preprocess and accumulate
                    img_tensor, img_np = self._preprocess_image(pil_image)
                    img_tensor = img_tensor.to("cuda")

                    self.frames.append({"img": img_tensor})
                    self.raw_images.append(img_np)

                    # Enforce sliding window
                    if len(self.frames) > MAX_FRAMES:
                        excess = len(self.frames) - MAX_FRAMES
                        self.frames = self.frames[excess:]
                        self.raw_images = self.raw_images[excess:]

                    # Run inference
                    result = self._run_inference()

                    t_elapsed = time.time() - t_start
                    if result:
                        result["inference_time_ms"] = round(t_elapsed * 1000, 1)
                    else:
                        result = {"error": "Inference returned no results"}

                    await websocket.send_json(result)

            except WebSocketDisconnect:
                print("WebSocket client disconnected, clearing frame buffer")
                self.frames = []
                self.raw_images = []
            except Exception as e:
                traceback.print_exc()
                try:
                    await websocket.send_json({
                        "error": f"Server error: {str(e)}"
                    })
                except Exception:
                    pass
                self.frames = []
                self.raw_images = []

        @ws_app.get("/")
        async def root():
            return {
                "service": "StreamVGGT Streaming 3D Reconstruction",
                "endpoints": {
                    "/ws": "WebSocket endpoint for streaming frames",
                    "/health": "Health check (use the Modal web endpoint)",
                },
                "usage": {
                    "connect": "ws://<host>/ws",
                    "send": {
                        "image": "<base64-encoded JPEG>",
                        "reset": "optional boolean to clear frame buffer",
                    },
                    "receive": {
                        "points": "flat array of [x,y,z,...] world-space 3D points",
                        "colors": "flat array of [r,g,b,...] RGB colors in [0,1]",
                        "confidence": "array of confidence values per point",
                        "camera_pose": "9-dim pose encoding (T + quat + FoV)",
                        "extrinsic": "3x4 matrix as flat 12-element array",
                        "intrinsic": "3x3 matrix as flat 9-element array",
                        "num_points": "number of points returned",
                        "frame_index": "index of this frame in the sliding window",
                        "total_frames": "total frames in the sliding window",
                        "inference_time_ms": "server-side inference time in ms",
                    },
                },
                "config": {
                    "max_frames": MAX_FRAMES,
                    "target_points": TARGET_POINTS,
                    "image_size": IMAGE_LONG_SIDE,
                },
            }

        return ws_app
