"""Landmark sampling helpers and standalone Blender entry point."""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path
from typing import Any

import bpy
from mathutils import Vector


def mesh_bounds(obj: bpy.types.Object) -> tuple[Vector, Vector]:
    corners = [obj.matrix_world @ Vector(corner) for corner in obj.bound_box]
    return (
        Vector(tuple(min(point[axis] for point in corners) for axis in range(3))),
        Vector(tuple(max(point[axis] for point in corners) for axis in range(3))),
    )


def vector(value: Vector) -> list[float]:
    return [round(float(component), 6) for component in value]


def sample_landmarks(
    obj: bpy.types.Object,
    *,
    habitat: str,
    tail_axis_sign: int,
    motion_profile: str,
) -> dict[str, Any]:
    minimum, maximum = mesh_bounds(obj)
    size = maximum - minimum
    centre = (minimum + maximum) * 0.5
    tail_x = maximum.x if tail_axis_sign > 0 else minimum.x
    head_x = minimum.x if tail_axis_sign > 0 else maximum.x
    tail_base_x = centre.x + tail_axis_sign * size.x * 0.18
    head = Vector((head_x, centre.y, minimum.z + size.z * 0.63))
    tail_tip = Vector((tail_x, centre.y, minimum.z + size.z * 0.48))
    tail_base = Vector((tail_base_x, centre.y, minimum.z + size.z * 0.5))
    eye_x = head_x - tail_axis_sign * size.x * 0.045
    eye_z = minimum.z + size.z * 0.73
    eye_spacing = max(size.y * 0.28, size.x * 0.008)
    contacts: list[dict[str, Any]] = []
    if habitat == "land":
        vertices = [obj.matrix_world @ vertex.co for vertex in obj.data.vertices]
        cutoff = minimum.z + max(size.z * 0.025, 0.002)
        low = [point for point in vertices if point.z <= cutoff]
        for label, sign_x, sign_y in [
            ("front-left", 1, 1),
            ("front-right", 1, -1),
            ("rear-left", -1, 1),
            ("rear-right", -1, -1),
        ]:
            quadrant = [
                point
                for point in low
                if (point.x - centre.x) * sign_x >= 0
                and (point.y - centre.y) * sign_y >= 0
            ]
            if quadrant:
                point = min(quadrant, key=lambda value: value.z)
            else:
                point = Vector(
                    (
                        centre.x + sign_x * size.x * 0.18,
                        centre.y + sign_y * size.y * 0.22,
                        minimum.z,
                    )
                )
            contacts.append(
                {
                    "id": label,
                    "position": vector(point),
                    "method": "lowest-vertex-quadrant"
                    if quadrant
                    else "bbox-estimate",
                }
            )
    return {
        "schemaVersion": 1,
        "coordinateSpace": "normalized-world",
        "samplingMethod": "evaluated-mesh-bounds-and-low-vertex-quadrants",
        "primaryAxis": "x",
        "tailAxisSign": tail_axis_sign,
        "motionProfile": motion_profile,
        "bounds": {
            "min": vector(minimum),
            "max": vector(maximum),
            "size": vector(size),
            "center": vector(centre),
        },
        "head": {"position": vector(head), "method": "bbox-estimate"},
        "tailBase": {
            "position": vector(tail_base),
            "method": "axis-percentile-estimate",
        },
        "tailTip": {
            "position": vector(tail_tip),
            "method": "bbox-extreme-estimate",
        },
        "eyes": [
            {
                "id": "left",
                "position": vector(Vector((eye_x, centre.y + eye_spacing, eye_z))),
                "method": "bbox-estimate",
            },
            {
                "id": "right",
                "position": vector(Vector((eye_x, centre.y - eye_spacing, eye_z))),
                "method": "bbox-estimate",
            },
        ],
        "contacts": contacts,
        "flippers": []
        if habitat == "land"
        else [
            {
                "id": "left",
                "position": vector(
                    Vector((centre.x, maximum.y, centre.z - size.z * 0.08))
                ),
                "method": "bbox-estimate",
            },
            {
                "id": "right",
                "position": vector(
                    Vector((centre.x, minimum.y, centre.z - size.z * 0.08))
                ),
                "method": "bbox-estimate",
            },
        ],
        "quality": {
            "automatic": True,
            "estimatedFields": ["head", "tailBase", "tailTip", "eyes", "flippers"],
            "humanReviewRequired": True,
        },
    }


def write_landmarks(path: str, value: dict[str, Any]) -> None:
    destination = Path(path).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def arguments() -> argparse.Namespace:
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--blend", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--habitat", choices=["land", "water", "air"], required=True)
    parser.add_argument("--tail-axis-sign", type=int, choices=[-1, 1], required=True)
    parser.add_argument("--motion-profile", required=True)
    return parser.parse_args(values)


if __name__ == "__main__":
    args = arguments()
    bpy.ops.wm.open_mainfile(filepath=str(Path(args.blend).resolve()))
    animal = bpy.data.objects.get("Animal")
    if animal is None or animal.type != "MESH":
        raise RuntimeError("Normalized blend must contain mesh object 'Animal'")
    write_landmarks(
        args.output,
        sample_landmarks(
            animal,
            habitat=args.habitat,
            tail_axis_sign=args.tail_axis_sign,
            motion_profile=args.motion_profile,
        ),
    )
