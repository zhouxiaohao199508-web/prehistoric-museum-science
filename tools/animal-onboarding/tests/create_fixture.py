"""Create a tiny textured-looking GLB fixture inside Blender."""

from __future__ import annotations

import sys
from pathlib import Path

import bpy

values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
if len(values) != 1:
    raise RuntimeError("Usage: blender --background --python create_fixture.py -- out.glb")
destination = Path(values[0]).resolve()
destination.parent.mkdir(parents=True, exist_ok=True)
bpy.ops.object.select_all(action="SELECT")
bpy.ops.object.delete(use_global=False)
bpy.ops.mesh.primitive_uv_sphere_add(segments=16, ring_count=8)
body = bpy.context.object
body.name = "FixtureBody"
body.scale = (2.0, 0.55, 0.65)
bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
material = bpy.data.materials.new("FixtureMaterial")
material.diffuse_color = (0.25, 0.42, 0.2, 1.0)
body.data.materials.append(material)
bpy.ops.export_scene.gltf(
    filepath=str(destination),
    export_format="GLB",
    export_animations=False,
    export_materials="EXPORT",
    export_yup=True,
)
print(f"fixture written: {destination}")
