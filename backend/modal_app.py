"""Modal app serving StreamVGGT for real-time streaming 3D reconstruction.

Deploy:  modal deploy backend/modal_app.py
Dev:     modal serve backend/modal_app.py
"""

from __future__ import annotations

import modal

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
STREAMVGGT_REPO = "https://github.com/wzzheng/StreamVGGT.git"
STREAMVGGT_DIR = "/root/StreamVGGT"
CKPT_REPO_ID = "lch01/StreamVGGT"
CKPT_FILENAME = "checkpoints.pth"
CKPT_DIR = f"{STREAMVGGT_DIR}/ckpt"

MAX_FRAMES = 30
TARGET_POINTS = 5000
IMAGE_LONG_SIDE = 518
PATCH_SIZE = 14

# ---------------------------------------------------------------------------
# Image
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
    .run_commands(f"git clone {STREAMVGGT_REPO} {STREAMVGGT_DIR}")
    .run_commands(
        'python -c "'
        "from huggingface_hub import hf_hub_download; "
        f"hf_hub_download(repo_id='{CKPT_REPO_ID}', "
        f"filename='{CKPT_FILENAME}', "
        f"local_dir='{CKPT_DIR}', "
        'local_dir_use_symlinks=False)"'
    )
)

app = modal.App("streamvggt", image=streamvggt_image)


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
@app.cls(gpu="A10G", timeout=600, scaledown_window=300)
class StreamVGGTService:
    """Real-time streaming 3D reconstruction via StreamVGGT."""

    @modal.enter()
    def load_model(self) -> None:
        import sys

        import torch

        sys.path.insert(0, f"{STREAMVGGT_DIR}/src")
        from streamvggt.models.streamvggt import StreamVGGT

        print("Loading StreamVGGT model…")
        self.model = StreamVGGT()
        ckpt = torch.load(f"{CKPT_DIR}/{CKPT_FILENAME}", map_location="cpu")
        self.model.load_state_dict(ckpt, strict=True)
        self.model.eval().to("cuda")
        del ckpt
        torch.cuda.empty_cache()

        capability = torch.cuda.get_device_capability()
        self.dtype = torch.bfloat16 if capability[0] >= 8 else torch.float16

        self.frames: list[dict] = []
        self.raw_images: list = []

        print(f"StreamVGGT ready on {torch.cuda.get_device_name()} (dtype={self.dtype})")

    # ------------------------------------------------------------------
    # Image preprocessing
    # ------------------------------------------------------------------
    def _preprocess_image(self, pil_image):
        import numpy as np
        import torch
        from PIL import Image

        img = pil_image.convert("RGB")
        w, h = img.size
        new_w = IMAGE_LONG_SIDE
        new_h = int(h * new_w / w)
        new_h = (new_h // PATCH_SIZE) * PATCH_SIZE
        new_w = (new_w // PATCH_SIZE) * PATCH_SIZE

        if new_h > IMAGE_LONG_SIDE:
            img = img.resize((new_w, new_h), Image.BICUBIC)
            crop_top = (new_h - IMAGE_LONG_SIDE) // 2
            crop_h = (IMAGE_LONG_SIDE // PATCH_SIZE) * PATCH_SIZE
            img = img.crop((0, crop_top, new_w, crop_top + crop_h))
        else:
            img = img.resize((new_w, new_h), Image.BICUBIC)

        img_np = np.array(img).astype(np.float32) / 255.0
        img_tensor = torch.from_numpy(img_np).permute(2, 0, 1).unsqueeze(0)
        return img_tensor, img_np

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------
    def _run_inference(self):
        import sys

        import torch

        sys.path.insert(0, f"{STREAMVGGT_DIR}/src")
        from streamvggt.utils.pose_enc import pose_encoding_to_extri_intri

        if not self.frames:
            return None

        with torch.no_grad(), torch.cuda.amp.autocast(dtype=self.dtype):
            output = self.model.inference(self.frames)

        last_res = output.ress[-1]
        pts3d = last_res["pts3d_in_other_view"].squeeze(0)
        conf = last_res["conf"].squeeze(0)
        camera_pose = last_res["camera_pose"].squeeze(0)

        _, _, img_h, img_w = self.frames[-1]["img"].shape

        pose_enc = camera_pose.unsqueeze(0).unsqueeze(0)
        extrinsic, intrinsic = pose_encoding_to_extri_intri(pose_enc, image_size_hw=(img_h, img_w))
        extrinsic = extrinsic.squeeze(0).squeeze(0)
        intrinsic = intrinsic.squeeze(0).squeeze(0)

        pts_flat = pts3d.reshape(-1, 3)
        conf_flat = conf.reshape(-1)
        colors_flat = torch.from_numpy(self.raw_images[-1].reshape(-1, 3)).to(pts_flat.device)

        n = pts_flat.shape[0]
        if n > TARGET_POINTS:
            _, top_idx = torch.topk(conf_flat, TARGET_POINTS)
            top_idx = top_idx.sort().values
            pts_flat = pts_flat[top_idx]
            conf_flat = conf_flat[top_idx]
            colors_flat = colors_flat[top_idx]

        return {
            "points": pts_flat.cpu().float().numpy().flatten().tolist(),
            "colors": colors_flat.cpu().float().numpy().flatten().tolist(),
            "confidence": conf_flat.cpu().float().numpy().tolist(),
            "camera_pose": camera_pose.cpu().float().numpy().tolist(),
            "extrinsic": extrinsic.cpu().float().numpy().flatten().tolist(),
            "intrinsic": intrinsic.cpu().float().numpy().flatten().tolist(),
            "num_points": min(n, TARGET_POINTS),
            "frame_index": len(self.frames) - 1,
            "total_frames": len(self.frames),
            "image_height": img_h,
            "image_width": img_w,
        }

    # ------------------------------------------------------------------
    # _ingest: shared frame handling for POST + WebSocket
    # ------------------------------------------------------------------
    def _ingest(self, image_b64: str) -> dict | None:
        import base64
        import io

        from PIL import Image

        image_bytes = base64.b64decode(image_b64)
        pil_image = Image.open(io.BytesIO(image_bytes))

        img_tensor, img_np = self._preprocess_image(pil_image)
        img_tensor = img_tensor.to("cuda")

        self.frames.append({"img": img_tensor})
        self.raw_images.append(img_np)

        if len(self.frames) > MAX_FRAMES:
            excess = len(self.frames) - MAX_FRAMES
            self.frames = self.frames[excess:]
            self.raw_images = self.raw_images[excess:]

        return self._run_inference()

    def _reset(self) -> None:
        self.frames = []
        self.raw_images = []

    # ------------------------------------------------------------------
    # Endpoints
    # ------------------------------------------------------------------
    @modal.fastapi_endpoint(method="GET", docs=True)
    def health(self):
        return {
            "status": "ok",
            "model": "StreamVGGT",
            "max_frames": MAX_FRAMES,
            "target_points": TARGET_POINTS,
        }

    @modal.fastapi_endpoint(method="POST", docs=True)
    def process_frame(self, request: dict):
        import time

        t0 = time.time()

        if request.get("reset", False):
            self._reset()
            return {"status": "reset"}

        image_b64 = request.get("image")
        if not image_b64:
            return {"error": "Missing 'image' field"}

        try:
            result = self._ingest(image_b64)
        except Exception as e:
            return {"error": f"Inference failed: {e}"}

        if result:
            result["inference_time_ms"] = round((time.time() - t0) * 1000, 1)
            return result
        return {"error": "Inference returned no results"}

    @modal.asgi_app()
    def websocket_app(self):
        import contextlib
        import json
        import time
        import traceback

        from fastapi import FastAPI, WebSocket, WebSocketDisconnect

        ws_app = FastAPI(title="StreamVGGT WebSocket")

        @ws_app.websocket("/ws")
        async def ws_endpoint(websocket: WebSocket):
            await websocket.accept()
            self._reset()

            try:
                while True:
                    msg = json.loads(await websocket.receive_text())
                    t0 = time.time()

                    if msg.get("reset", False):
                        self._reset()
                        await websocket.send_json({"status": "reset"})
                        continue

                    image_b64 = msg.get("image")
                    if not image_b64:
                        await websocket.send_json({"error": "Missing 'image' field"})
                        continue

                    result = self._ingest(image_b64)
                    if result:
                        result["inference_time_ms"] = round((time.time() - t0) * 1000, 1)
                    else:
                        result = {"error": "Inference returned no results"}
                    await websocket.send_json(result)

            except WebSocketDisconnect:
                print("Client disconnected")
            except Exception as e:
                traceback.print_exc()
                with contextlib.suppress(Exception):
                    await websocket.send_json({"error": str(e)})
            finally:
                self._reset()

        @ws_app.get("/")
        async def root():
            return {"service": "StreamVGGT", "ws": "/ws"}

        return ws_app
