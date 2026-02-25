"""Send a pre-reconstructed point cloud to SpatialLM and save the SVG floor plan.

Usage:
    uv run backend/test_floorplan.py [path/to/merged_ds.npz]
"""

from __future__ import annotations

import json
import sys
import time
import urllib.request

import numpy as np

SPATIALLM_URL = "https://argile--spatiallm-spatiallmservice-analyze.modal.run"
DEFAULT_NPZ = "/Users/guhur/src/VGGT-SLAM/clery_results/clery4_modal/merged_ds.npz"
OUTPUT_SVG = "backend/clery4_floorplan.svg"
TARGET_POINTS = 50_000


def main() -> None:
    npz_path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT_NPZ
    print(f"Loading {npz_path}…")
    data = np.load(npz_path)
    points = data["points"]
    colors = data["colors"].astype(np.float64) / 255.0

    print(f"  {len(points):,} points")

    if len(points) > TARGET_POINTS:
        idx = np.random.choice(len(points), TARGET_POINTS, replace=False)
        points, colors = points[idx], colors[idx]
        print(f"  Downsampled → {TARGET_POINTS:,}")

    payload = json.dumps(
        {
            "points": points.flatten().tolist(),
            "colors": colors.flatten().tolist(),
        }
    ).encode()
    print(f"  Payload: {len(payload) / 1024 / 1024:.1f} MB")
    print(f"Sending to {SPATIALLM_URL}…")

    t0 = time.time()
    req = urllib.request.Request(
        SPATIALLM_URL,
        data=payload,
        headers={"Content-Type": "application/json"},
        method="POST",
    )
    with urllib.request.urlopen(req, timeout=600) as resp:
        result = json.loads(resp.read())
    elapsed = time.time() - t0

    if "error" in result:
        print(f"ERROR: {result['error']}")
        return

    print(f"\nDone in {elapsed:.1f}s:")
    print(
        f"  {result.get('num_walls', 0)} walls, {result.get('num_doors', 0)} doors, "
        f"{result.get('num_windows', 0)} windows, {result.get('num_objects', 0)} objects"
    )

    svg = result.get("svg", "")
    if svg:
        with open(OUTPUT_SVG, "w") as f:
            f.write(svg)
        print(f"  Saved → {OUTPUT_SVG}")


if __name__ == "__main__":
    main()
