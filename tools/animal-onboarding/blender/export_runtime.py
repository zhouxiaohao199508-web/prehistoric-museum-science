"""Shared deterministic glTF export helper for animal onboarding."""

from __future__ import annotations

import json
from pathlib import Path
from typing import Any

import bpy


def export_runtime(output_path: str, log: dict[str, Any]) -> dict[str, Any]:
    destination = Path(output_path).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = 192
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_set(1)
    has_normal_texture = any(
        material is not None
        and material.use_nodes
        and any(
            node.type == "NORMAL_MAP" and node.inputs["Color"].is_linked
            for node in material.node_tree.nodes
        )
        for material in bpy.data.materials
    )
    bpy.ops.export_scene.gltf(
        filepath=str(destination),
        export_format="GLB",
        export_animations=True,
        export_frame_range=True,
        export_force_sampling=True,
        export_morph=True,
        export_morph_animation=True,
        export_nla_strips=False,
        export_materials="EXPORT",
        export_image_format="AUTO",
        export_tangents=has_normal_texture,
        export_yup=True,
    )
    log["output"] = {
        "path": str(destination),
        "bytes": destination.stat().st_size,
        "frameStart": 0,
        "frameEnd": 192,
        "fps": 24,
        "durationSeconds": 8,
        "clip": "Idle",
        "tangentsExported": has_normal_texture,
    }
    return log


def write_log(path: str, value: dict[str, Any]) -> None:
    destination = Path(path).resolve()
    destination.parent.mkdir(parents=True, exist_ok=True)
    destination.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
