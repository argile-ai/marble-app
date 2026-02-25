"""Modal app serving SpatialLM for structured indoor layout extraction.

Deploy:  modal deploy backend/spatiallm_app.py
Dev:     modal serve backend/spatiallm_app.py
"""

from __future__ import annotations

import modal

from svg import generate_floorplan_svg

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
MODEL_ID = "manycore-research/SpatialLM1.1-Qwen-0.5B"
REPO_DIR = "/root/SpatialLM"
WEIGHTS_DIR = "/root/weights"

# ---------------------------------------------------------------------------
# Image — weights are downloaded at build time so cold starts only load, never download.
# ---------------------------------------------------------------------------
spatiallm_image = (
    modal.Image.from_registry("nvidia/cuda:12.4.0-devel-ubuntu22.04", add_python="3.11")
    .apt_install("git", "libgl1-mesa-glx", "libglib2.0-0", "libgomp1")
    .pip_install(
        "torch==2.4.1",
        "torchvision==0.19.1",
        extra_index_url="https://download.pytorch.org/whl/cu124",
    )
    .pip_install(
        "transformers==4.46.1",
        "open3d",
        "shapely",
        "scipy",
        "numpy",
        "einops",
        "safetensors",
        "bbox",
        "addict",
        "timm",
        "fastapi",
        "uvicorn",
        "huggingface_hub",
    )
    .pip_install("psutil", "packaging", "ninja", "setuptools", "wheel")
    .run_commands("pip install flash-attn --no-build-isolation")
    .run_commands("pip install torch-scatter -f https://data.pyg.org/whl/torch-2.4.0+cu124.html")
    .pip_install("spconv-cu120")
    .run_commands(f"git clone https://github.com/manycore-research/SpatialLM.git {REPO_DIR}")
    # Pre-download weights at build time (file download only — no model loading, no OOM).
    .run_commands(
        'python -c "'
        "from huggingface_hub import snapshot_download; "
        f"snapshot_download(repo_id='{MODEL_ID}', local_dir='{WEIGHTS_DIR}')"
        '"'
    )
)

app = modal.App("spatiallm", image=spatiallm_image)


# ---------------------------------------------------------------------------
# Layout → dicts
# ---------------------------------------------------------------------------
def _layout_to_dicts(layout) -> tuple[list[dict], list[dict], list[dict], list[dict]]:
    """Convert a SpatialLM Layout object to JSON-serializable dicts."""
    walls = [
        {
            "ax": float(w.ax),
            "ay": float(w.ay),
            "bx": float(w.bx),
            "by": float(w.by),
            "height": float(w.height),
            "thickness": float(w.thickness),
        }
        for w in layout.walls
    ]

    wall_id_map = {w.id: i for i, w in enumerate(layout.walls)}

    doors = [
        {
            "wall_id": wall_id_map.get(d.wall_id, d.wall_id),
            "x": float(d.position_x),
            "y": float(d.position_y),
            "width": float(d.width),
        }
        for d in layout.doors
    ]

    windows = [
        {
            "wall_id": wall_id_map.get(w.wall_id, w.wall_id),
            "x": float(w.position_x),
            "y": float(w.position_y),
            "width": float(w.width),
        }
        for w in layout.windows
    ]

    objects = [
        {
            "class_name": str(b.class_name),
            "x": float(b.position_x),
            "y": float(b.position_y),
            "angle": float(b.angle_z),
            "width": float(b.scale_x),
            "depth": float(b.scale_y),
        }
        for b in layout.bboxes
    ]

    return walls, doors, windows, objects


# ---------------------------------------------------------------------------
# Service
# ---------------------------------------------------------------------------
@app.cls(gpu="A10G", timeout=600, scaledown_window=300)
class SpatialLMService:
    """Structured indoor layout extraction from 3D point clouds."""

    @modal.enter()
    def load_model(self) -> None:
        import sys

        import torch

        sys.path.insert(0, REPO_DIR)

        # Import triggers AutoConfig/AutoModel registration for spatiallm_qwen.
        from transformers import AutoModelForCausalLM, AutoTokenizer

        import spatiallm  # noqa: F401

        print(f"Loading SpatialLM from {WEIGHTS_DIR}…")
        self.tokenizer = AutoTokenizer.from_pretrained(WEIGHTS_DIR, trust_remote_code=True)
        self.model = AutoModelForCausalLM.from_pretrained(
            WEIGHTS_DIR, trust_remote_code=True, torch_dtype=torch.bfloat16
        )
        self.model.set_point_backbone_dtype(torch.float32)
        self.model = self.model.to("cuda").eval()
        self.num_bins: int = self.model.config.point_config["num_bins"]

        with open(f"{REPO_DIR}/code_template.txt") as f:
            self.code_template = f.read()

        print(f"SpatialLM ready on {torch.cuda.get_device_name()} (bins={self.num_bins})")

    # ------------------------------------------------------------------
    # Inference
    # ------------------------------------------------------------------
    def _run_inference(self, points_np, colors_np):
        import sys

        import numpy as np
        import open3d as o3d
        import torch

        sys.path.insert(0, REPO_DIR)
        from spatiallm import Layout
        from spatiallm.pcd import Compose, cleanup_pcd, get_points_and_colors

        pcd = o3d.geometry.PointCloud()
        pcd.points = o3d.utility.Vector3dVector(points_np.astype(np.float64))
        pcd.colors = o3d.utility.Vector3dVector(colors_np.astype(np.float64))

        grid_size = Layout.get_grid_size(self.num_bins)
        pcd = cleanup_pcd(pcd, voxel_size=grid_size)
        points, colors = get_points_and_colors(pcd)
        min_extent = np.min(points, axis=0)

        transform = Compose(
            [
                {"type": "PositiveShift"},
                {"type": "NormalizeColor"},
                {
                    "type": "GridSample",
                    "grid_size": grid_size,
                    "hash_type": "fnv",
                    "mode": "test",
                    "keys": ("coord", "color"),
                    "return_grid_coord": True,
                    "max_grid_coord": self.num_bins,
                },
            ]
        )
        data = transform({"name": "pcd", "coord": points.copy(), "color": colors.copy()})
        pcd_tensor = np.concatenate([data["grid_coord"], data["coord"], data["color"]], axis=1)
        input_pcd = torch.as_tensor(np.stack([pcd_tensor], axis=0))

        prompt = (
            "<|point_start|><|point_pad|><|point_end|>"
            "Detect walls, doors, windows, boxes. "
            f"The reference code is as followed: {self.code_template}"
        )
        messages = [
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": prompt},
        ]
        input_ids = self.tokenizer.apply_chat_template(
            messages, add_generation_prompt=True, return_tensors="pt"
        ).to(self.model.device)

        with torch.no_grad():
            output_ids = self.model.generate(
                input_ids=input_ids,
                point_clouds=input_pcd,
                max_new_tokens=4096,
                do_sample=True,
                use_cache=True,
                temperature=0.6,
                top_p=0.95,
                top_k=10,
                num_beams=1,
            )

        generated = output_ids[0][input_ids.shape[1] :]
        layout_str = self.tokenizer.decode(generated, skip_special_tokens=True)
        print(f"Generated layout ({len(layout_str)} chars)")

        layout = Layout(layout_str)
        layout.undiscretize_and_unnormalize(num_bins=self.num_bins)
        layout.translate(min_extent)
        return layout

    # ------------------------------------------------------------------
    # Shared input parsing
    # ------------------------------------------------------------------
    @staticmethod
    def _parse_points(request: dict):
        import numpy as np

        points_flat = request.get("points")
        if not points_flat:
            return None, None, "Missing 'points' in request body"

        points = np.array(points_flat, dtype=np.float64).reshape(-1, 3)
        n = points.shape[0]

        colors_flat = request.get("colors")
        if colors_flat:
            colors = np.array(colors_flat, dtype=np.float64).reshape(-1, 3)
            if colors.shape[0] != n:
                return None, None, f"Color count ({colors.shape[0]}) != point count ({n})"
        else:
            colors = np.full((n, 3), 0.5, dtype=np.float64)

        return points, colors, None

    # ------------------------------------------------------------------
    # Endpoints
    # ------------------------------------------------------------------
    @modal.fastapi_endpoint(method="GET", docs=True)
    def health(self):
        return {"status": "ok", "model": MODEL_ID}

    @modal.fastapi_endpoint(method="POST", docs=True)
    def analyze(self, request: dict):
        """Analyze a point cloud → structured layout JSON + SVG floor plan."""
        import time

        t0 = time.time()

        points, colors, err = self._parse_points(request)
        if err:
            return {"error": err}

        print(f"Analyzing {points.shape[0]:,} points")
        layout = self._run_inference(points, colors)
        walls, doors, windows, objects = _layout_to_dicts(layout)
        svg = generate_floorplan_svg(walls, doors, windows, objects)
        elapsed_ms = round((time.time() - t0) * 1000, 1)

        return {
            "walls": walls,
            "doors": doors,
            "windows": windows,
            "objects": objects,
            "svg": svg,
            "num_walls": len(walls),
            "num_doors": len(doors),
            "num_windows": len(windows),
            "num_objects": len(objects),
            "inference_time_ms": elapsed_ms,
        }

    @modal.fastapi_endpoint(method="POST", docs=True)
    def floorplan_svg(self, request: dict):
        """Analyze a point cloud → SVG floor plan (image/svg+xml)."""
        from fastapi.responses import Response

        points, colors, err = self._parse_points(request)
        if err:
            return Response(
                content=f"<svg xmlns='http://www.w3.org/2000/svg'>"
                f"<text x='10' y='20'>{err}</text></svg>",
                media_type="image/svg+xml",
                status_code=400,
            )

        layout = self._run_inference(points, colors)
        walls, doors, windows, objects = _layout_to_dicts(layout)
        svg = generate_floorplan_svg(walls, doors, windows, objects)
        return Response(content=svg, media_type="image/svg+xml")
