"""SVG floor plan generation from structured layout entities."""

from __future__ import annotations

import math
import xml.etree.ElementTree as ET

_SVG_STYLES = (
    ".wall { stroke: #1a1a1a; stroke-linecap: round; fill: none; }"
    ".door-arc { stroke: #2563eb; stroke-width: 0.04; fill: none; }"
    ".door-line { stroke: #2563eb; stroke-width: 0.03; fill: none; }"
    ".window-line { stroke: #06b6d4; stroke-width: 0.05; fill: none; }"
    ".furniture { fill: #f3f4f6; stroke: #6b7280; stroke-width: 0.02; }"
    ".label { font-family: 'Helvetica Neue', Arial, sans-serif; "
    "font-size: 0.15px; fill: #374151; text-anchor: middle; "
    "dominant-baseline: central; }"
    ".scale-text { font-family: 'Helvetica Neue', Arial, sans-serif; "
    "font-size: 0.12px; fill: #6b7280; text-anchor: middle; }"
)


def _f(v: float) -> str:
    return f"{v:.4f}"


def _empty_svg() -> str:
    svg = ET.Element("svg", xmlns="http://www.w3.org/2000/svg", width="400", height="300")
    text = ET.SubElement(svg, "text", x="200", y="150")
    text.set("text-anchor", "middle")
    text.set("font-family", "sans-serif")
    text.set("font-size", "14")
    text.text = "No layout elements detected"
    return ET.tostring(svg, encoding="unicode", xml_declaration=True)


def _bbox(
    walls: list[dict],
    doors: list[dict],
    windows: list[dict],
    objects: list[dict],
) -> tuple[list[float], list[float]]:
    xs: list[float] = []
    ys: list[float] = []
    for w in walls:
        xs.extend([w["ax"], w["bx"]])
        ys.extend([w["ay"], w["by"]])
    for obj in objects:
        diag = math.sqrt((obj["width"] / 2) ** 2 + (obj["depth"] / 2) ** 2)
        xs.extend([obj["x"] - diag, obj["x"] + diag])
        ys.extend([obj["y"] - diag, obj["y"] + diag])
    for d in doors:
        xs.append(d["x"])
        ys.append(d["y"])
    for w in windows:
        xs.append(w["x"])
        ys.append(w["y"])
    return xs, ys


def _draw_walls(parent: ET.Element, walls: list[dict]) -> None:
    g = ET.SubElement(parent, "g", id="walls")
    for w in walls:
        thickness = max(w["thickness"], 0.06)
        line = ET.SubElement(g, "line")
        line.set("class", "wall")
        line.set("x1", _f(w["ax"]))
        line.set("y1", _f(w["ay"]))
        line.set("x2", _f(w["bx"]))
        line.set("y2", _f(w["by"]))
        line.set("stroke-width", _f(thickness))


def _draw_doors(parent: ET.Element, doors: list[dict], wall_lookup: dict[int, dict]) -> None:
    g = ET.SubElement(parent, "g", id="doors")
    for d in doors:
        cx, cy = d["x"], d["y"]
        r = d["width"] / 2
        if r < 0.01:
            continue

        wall = wall_lookup.get(d["wall_id"])
        wall_angle = math.atan2(wall["by"] - wall["ay"], wall["bx"] - wall["ax"]) if wall else 0.0

        sx = cx + r * math.cos(wall_angle)
        sy = cy + r * math.sin(wall_angle)
        ex = cx + r * math.cos(wall_angle + math.pi / 2)
        ey = cy + r * math.sin(wall_angle + math.pi / 2)

        arc = ET.SubElement(g, "path")
        arc.set("class", "door-arc")
        arc.set("d", f"M {_f(sx)} {_f(sy)} A {_f(r)} {_f(r)} 0 0 1 {_f(ex)} {_f(ey)}")

        for px, py in [(sx, sy), (ex, ey)]:
            line = ET.SubElement(g, "line")
            line.set("class", "door-line")
            line.set("x1", _f(cx))
            line.set("y1", _f(cy))
            line.set("x2", _f(px))
            line.set("y2", _f(py))


def _draw_windows(parent: ET.Element, windows: list[dict], wall_lookup: dict[int, dict]) -> None:
    g = ET.SubElement(parent, "g", id="windows")
    for win in windows:
        cx, cy = win["x"], win["y"]
        half_w = win["width"] / 2
        if half_w < 0.01:
            continue

        wall = wall_lookup.get(win["wall_id"])
        if wall:
            dx, dy = wall["bx"] - wall["ax"], wall["by"] - wall["ay"]
            length = math.sqrt(dx * dx + dy * dy)
            ux, uy = (dx / length, dy / length) if length > 0 else (1.0, 0.0)
        else:
            ux, uy = 1.0, 0.0

        nx, ny = -uy, ux
        gap = 0.05

        for sign in [-1, 1]:
            off = sign * gap
            line = ET.SubElement(g, "line")
            line.set("class", "window-line")
            line.set("x1", _f(cx - half_w * ux + off * nx))
            line.set("y1", _f(cy - half_w * uy + off * ny))
            line.set("x2", _f(cx + half_w * ux + off * nx))
            line.set("y2", _f(cy + half_w * uy + off * ny))


def _draw_objects(parent: ET.Element, objects: list[dict]) -> None:
    g = ET.SubElement(parent, "g", id="objects")
    for obj in objects:
        cx, cy = obj["x"], obj["y"]
        w, d = obj["width"], obj["depth"]
        angle_deg = math.degrees(obj["angle"])

        rect = ET.SubElement(g, "rect")
        rect.set("class", "furniture")
        rect.set("x", _f(-w / 2))
        rect.set("y", _f(-d / 2))
        rect.set("width", _f(w))
        rect.set("height", _f(d))
        rect.set("transform", f"translate({_f(cx)},{_f(cy)}) rotate({angle_deg:.2f})")

        label_text = obj.get("class_name", "")
        if label_text:
            display = label_text.replace("_", " ")[:16]
            label = ET.SubElement(g, "text")
            label.set("class", "label")
            label.set("x", _f(cx))
            label.set("y", _f(cy))
            label.text = display


def _draw_scale_bar(parent: ET.Element, vb_x: float, vb_y: float, vb_h: float, pad: float) -> None:
    g = ET.SubElement(parent, "g", id="scale-bar")
    bx = vb_x + pad * 0.5
    by = vb_y + vb_h - pad * 0.4

    line = ET.SubElement(g, "line")
    line.set("x1", _f(bx))
    line.set("y1", _f(by))
    line.set("x2", _f(bx + 1.0))
    line.set("y2", _f(by))
    line.set("stroke", "#6b7280")
    line.set("stroke-width", "0.03")

    for x in [bx, bx + 1.0]:
        cap = ET.SubElement(g, "line")
        cap.set("x1", _f(x))
        cap.set("y1", _f(by - 0.06))
        cap.set("x2", _f(x))
        cap.set("y2", _f(by + 0.06))
        cap.set("stroke", "#6b7280")
        cap.set("stroke-width", "0.02")

    label = ET.SubElement(g, "text")
    label.set("class", "scale-text")
    label.set("x", _f(bx + 0.5))
    label.set("y", _f(by + 0.18))
    label.text = "1 m"


def _draw_north_arrow(
    parent: ET.Element, vb_x: float, vb_y: float, vb_w: float, pad: float
) -> None:
    g = ET.SubElement(parent, "g", id="north-arrow")
    cx = vb_x + vb_w - pad * 0.5
    cy = vb_y + pad * 0.6
    length = 0.3

    line = ET.SubElement(g, "line")
    line.set("x1", _f(cx))
    line.set("y1", _f(cy + length))
    line.set("x2", _f(cx))
    line.set("y2", _f(cy - length))
    line.set("stroke", "#374151")
    line.set("stroke-width", "0.03")

    tip_y = cy - length
    head = ET.SubElement(g, "polygon")
    head.set(
        "points",
        f"{_f(cx)},{_f(tip_y)} {_f(cx - 0.08)},{_f(tip_y + 0.12)} {_f(cx + 0.08)},{_f(tip_y + 0.12)}",
    )
    head.set("fill", "#374151")

    label = ET.SubElement(g, "text")
    label.set("class", "scale-text")
    label.set("x", _f(cx))
    label.set("y", _f(tip_y - 0.1))
    label.set("text-anchor", "middle")
    label.text = "N"


# ---------------------------------------------------------------------------
# Public API
# ---------------------------------------------------------------------------
def generate_floorplan_svg(
    walls: list[dict],
    doors: list[dict],
    windows: list[dict],
    objects: list[dict],
) -> str:
    """Generate a clean architectural SVG floor plan from parsed layout entities."""
    xs, ys = _bbox(walls, doors, windows, objects)
    if not xs or not ys:
        return _empty_svg()

    min_x, max_x = min(xs), max(xs)
    min_y, max_y = min(ys), max(ys)
    ext_x, ext_y = max_x - min_x, max_y - min_y
    pad_x = max(ext_x * 0.10, 0.5)
    pad_y = max(ext_y * 0.10, 0.5)

    vb_x = min_x - pad_x
    vb_y = min_y - pad_y
    vb_w = ext_x + 2 * pad_x
    vb_h = ext_y + 2 * pad_y

    ppm = 800 / max(vb_w, 0.01)
    svg_w, svg_h = int(vb_w * ppm), int(vb_h * ppm)

    svg = ET.Element("svg")
    svg.set("xmlns", "http://www.w3.org/2000/svg")
    svg.set("width", str(svg_w))
    svg.set("height", str(svg_h))
    svg.set("viewBox", f"{vb_x} {vb_y} {vb_w} {vb_h}")

    bg = ET.SubElement(svg, "rect")
    bg.set("x", str(vb_x))
    bg.set("y", str(vb_y))
    bg.set("width", str(vb_w))
    bg.set("height", str(vb_h))
    bg.set("fill", "white")

    defs = ET.SubElement(svg, "defs")
    style = ET.SubElement(defs, "style")
    style.text = _SVG_STYLES

    wall_lookup = dict(enumerate(walls))

    _draw_walls(svg, walls)
    _draw_doors(svg, doors, wall_lookup)
    _draw_windows(svg, windows, wall_lookup)
    _draw_objects(svg, objects)
    _draw_scale_bar(svg, vb_x, vb_y, vb_h, pad_y)
    _draw_north_arrow(svg, vb_x, vb_y, vb_w, pad_x)

    return ET.tostring(svg, encoding="unicode", xml_declaration=True)
