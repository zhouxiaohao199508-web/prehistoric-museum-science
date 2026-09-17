"""Headless candidate normalization, motion authoring, evidence and GLB export."""

from __future__ import annotations

import argparse
from collections import deque
import hashlib
import json
import math
import sys
from pathlib import Path
from typing import Any

import bpy
from mathutils import Matrix, Vector

SCRIPT_DIRECTORY = Path(__file__).resolve().parent
if str(SCRIPT_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIRECTORY))

from export_runtime import export_runtime, write_log  # noqa: E402
from motion_profiles import (  # noqa: E402
    MotionSample,
    displacement,
)
from sample_landmarks import mesh_bounds, sample_landmarks, write_landmarks  # noqa: E402


def arguments() -> argparse.Namespace:
    values = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--profile", required=True)
    parser.add_argument("--render-dir")
    return parser.parse_args(values)


def digest(path: Path) -> dict[str, Any]:
    value = path.read_bytes()
    return {"bytes": len(value), "sha256": hashlib.sha256(value).hexdigest()}


PROCESSING_STRATEGIES = {
    "replace-with-project-morph",
    "preserve-source-rig-retime",
    "custom-rebuild",
}


def processing_strategy(model: dict[str, Any]) -> dict[str, Any]:
    normalization = model.get("normalizationStrategy")
    animation = model.get("animationStrategy")
    if isinstance(normalization, str) and normalization.startswith("BLOCKED_"):
        raise RuntimeError(
            "normalizationStrategy is unresolved; explicitly select a source-processing strategy"
        )
    if normalization not in PROCESSING_STRATEGIES:
        raise RuntimeError(
            "normalizationStrategy must be replace-with-project-morph, "
            "preserve-source-rig-retime, or custom-rebuild"
        )
    if not isinstance(animation, dict):
        raise RuntimeError("animationStrategy must be explicitly declared")
    mode = animation.get("mode")
    if isinstance(mode, str) and mode.startswith("BLOCKED_"):
        raise RuntimeError(
            "animationStrategy.mode is unresolved; inspect the source rig and animation first"
        )
    if mode not in PROCESSING_STRATEGIES:
        raise RuntimeError(
            "animationStrategy.mode must be replace-with-project-morph, "
            "preserve-source-rig-retime, or custom-rebuild"
        )
    if (
        normalization != "replace-with-project-morph"
        or mode != "replace-with-project-morph"
    ):
        raise RuntimeError(
            f"normalize_animal.py cannot execute normalization={normalization} "
            f"and animation={mode}; preserve-source-rig-retime and custom-rebuild "
            "require a dedicated L3 operation"
        )
    for key in ("sourceArmature", "sourceAnimation"):
        if animation.get(key) not in {"present", "absent"}:
            raise RuntimeError(
                f"animationStrategy.{key} must explicitly be present or absent"
            )
    if not isinstance(animation.get("destructiveReplacementAccepted"), bool):
        raise RuntimeError(
            "animationStrategy.destructiveReplacementAccepted must be a boolean"
        )
    reason = animation.get("reason")
    if not isinstance(reason, str) or not reason.strip():
        raise RuntimeError("animationStrategy.reason must explain the decision")
    return animation


def imported_animation_inventory() -> dict[str, Any]:
    armatures = sorted(
        obj.name for obj in bpy.context.scene.objects if obj.type == "ARMATURE"
    )
    actions = sorted(action.name for action in bpy.data.actions)
    animated_objects = sorted(
        obj.name
        for obj in bpy.context.scene.objects
        if obj.animation_data is not None
        and (
            obj.animation_data.action is not None
            or len(obj.animation_data.nla_tracks) > 0
        )
    )
    animated_shape_keys = sorted(
        obj.name
        for obj in bpy.context.scene.objects
        if obj.type == "MESH"
        and obj.data.shape_keys is not None
        and obj.data.shape_keys.animation_data is not None
        and (
            obj.data.shape_keys.animation_data.action is not None
            or len(obj.data.shape_keys.animation_data.nla_tracks) > 0
        )
    )
    return {
        "armatures": armatures,
        "actions": actions,
        "animatedObjects": animated_objects,
        "animatedShapeKeys": animated_shape_keys,
        "armaturePresent": bool(armatures),
        "animationPresent": bool(actions or animated_objects or animated_shape_keys),
    }


def verify_imported_strategy(
    declared: dict[str, Any], detected: dict[str, Any]
) -> None:
    expected_armature = declared["sourceArmature"] == "present"
    expected_animation = declared["sourceAnimation"] == "present"
    if expected_armature != detected["armaturePresent"]:
        raise RuntimeError(
            "animationStrategy.sourceArmature does not match the imported source"
        )
    if expected_animation != detected["animationPresent"]:
        raise RuntimeError(
            "animationStrategy.sourceAnimation does not match the imported source"
        )
    if (
        (detected["armaturePresent"] or detected["animationPresent"])
        and not declared["destructiveReplacementAccepted"]
    ):
        raise RuntimeError(
            "replace-with-project-morph will destructively discard the source rig or "
            "animation; set destructiveReplacementAccepted only after explicit review"
        )


def clear_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for collection in (
        bpy.data.meshes,
        bpy.data.curves,
        bpy.data.armatures,
        bpy.data.cameras,
        bpy.data.lights,
    ):
        for block in list(collection):
            if block.users == 0:
                collection.remove(block)


def import_model(path: Path) -> None:
    suffix = path.suffix.lower()
    if suffix in {".glb", ".gltf"}:
        bpy.ops.import_scene.gltf(filepath=str(path))
    elif suffix == ".fbx":
        bpy.ops.import_scene.fbx(filepath=str(path))
    else:
        raise RuntimeError(f"Unsupported source model: {path}")


def visible_source_meshes() -> tuple[
    list[bpy.types.Object], list[dict[str, Any]]
]:
    scene = bpy.context.scene
    all_meshes = [
        obj for obj in list(scene.objects) if obj.type == "MESH" and not obj.hide_render
    ]
    source_meshes = [
        obj
        for obj in all_meshes
        if len(obj.data.polygons) >= 100
        and any(material is not None for material in obj.data.materials)
    ]
    if not source_meshes and all_meshes:
        source_meshes = [max(all_meshes, key=lambda obj: len(obj.data.polygons))]
    source_meshes = sorted(source_meshes, key=lambda obj: obj.name)
    excluded = [
        {
            "name": obj.name,
            "polygons": len(obj.data.polygons),
            "materials": len(obj.data.materials),
            "reason": "helper/control mesh below visual-mesh threshold",
        }
        for obj in all_meshes
        if obj not in source_meshes
    ]
    return source_meshes, excluded


def bake_meshes(
    source_meshes: list[bpy.types.Object], prefix: str
) -> list[bpy.types.Object]:
    scene = bpy.context.scene
    scene.frame_set(scene.frame_start)
    depsgraph = bpy.context.evaluated_depsgraph_get()
    baked: list[bpy.types.Object] = []
    for index, source in enumerate(source_meshes):
        evaluated = source.evaluated_get(depsgraph)
        mesh = bpy.data.meshes.new_from_object(
            evaluated,
            preserve_all_data_layers=True,
            depsgraph=depsgraph,
        )
        baked_object = bpy.data.objects.new(f"{prefix}-{index:02d}", mesh)
        scene.collection.objects.link(baked_object)
        baked_object.matrix_world = source.matrix_world.copy()
        baked.append(baked_object)
    if not baked:
        raise RuntimeError("Source did not contain a visible mesh")
    return baked


def delete_scene_objects_except(kept: list[bpy.types.Object]) -> None:
    keep = set(kept)
    for obj in list(bpy.context.scene.objects):
        if obj not in keep:
            bpy.data.objects.remove(obj, do_unlink=True)


def bake_visible_meshes() -> tuple[list[bpy.types.Object], list[dict[str, Any]]]:
    source_meshes, excluded = visible_source_meshes()
    baked = bake_meshes(source_meshes, "Baked")
    delete_scene_objects_except(baked)
    return baked, excluded


def weighted_vertex_count(meshes: list[bpy.types.Object], bone_name: str) -> int:
    count = 0
    for obj in meshes:
        group = obj.vertex_groups.get(bone_name)
        if group is None:
            continue
        group_index = group.index
        for vertex in obj.data.vertices:
            if any(
                assignment.group == group_index and assignment.weight > 1e-4
                for assignment in vertex.groups
            ):
                count += 1
    return count


def bake_source_rig_mouth_target(
    mouth_profile: dict[str, Any],
) -> tuple[
    list[bpy.types.Object],
    list[bpy.types.Object],
    list[dict[str, Any]],
    dict[str, Any],
]:
    source_meshes, excluded = visible_source_meshes()
    armatures = sorted(
        (obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"),
        key=lambda obj: obj.name,
    )
    jaw_name = str(mouth_profile["jawBone"])
    candidates = [
        armature
        for armature in armatures
        if armature.pose.bones.get(jaw_name) is not None
    ]
    if len(candidates) != 1:
        raise RuntimeError(
            f"Expected exactly one armature with jaw bone {jaw_name}; found {len(candidates)}"
        )
    armature = candidates[0]
    tongue_bones = [str(name) for name in mouth_profile.get("tongueBones", [])]
    missing_bones = [
        name
        for name in [jaw_name, *tongue_bones]
        if armature.pose.bones.get(name) is None
    ]
    if missing_bones:
        raise RuntimeError(f"Mouth rig bones are missing: {', '.join(missing_bones)}")
    jaw_weighted_vertices = weighted_vertex_count(source_meshes, jaw_name)
    tongue_weighted_vertices = {
        name: weighted_vertex_count(source_meshes, name) for name in tongue_bones
    }
    if jaw_weighted_vertices < int(mouth_profile["minimumJawWeightedVertices"]):
        raise RuntimeError(
            f"Jaw bone {jaw_name} has only {jaw_weighted_vertices} weighted vertices"
        )
    minimum_tongue_vertices = int(mouth_profile["minimumTongueWeightedVertices"])
    if tongue_bones and any(
        count < minimum_tongue_vertices
        for count in tongue_weighted_vertices.values()
    ):
        raise RuntimeError(
            "One or more tongue bones do not meet the required weighted-vertex count"
        )

    armature_name = armature.name
    base = bake_meshes(source_meshes, "Baked")
    jaw = armature.pose.bones[jaw_name]
    original_rotation_mode = jaw.rotation_mode
    original_quaternion = jaw.rotation_quaternion.copy()
    original_euler = jaw.rotation_euler.copy()
    jaw.rotation_mode = "XYZ"
    axis = str(mouth_profile["rotationAxis"]).upper()
    axis_index = {"X": 0, "Y": 1, "Z": 2}[axis]
    jaw.rotation_euler[axis_index] += math.radians(
        float(mouth_profile["closeDegrees"])
    )
    bpy.context.view_layer.update()
    target = bake_meshes(source_meshes, "MouthTarget")
    jaw.rotation_mode = original_rotation_mode
    if original_rotation_mode == "QUATERNION":
        jaw.rotation_quaternion = original_quaternion
    else:
        jaw.rotation_euler = original_euler
    bpy.context.view_layer.update()
    delete_scene_objects_except([*base, *target])
    return base, target, excluded, {
        "armature": armature_name,
        "jawBone": jaw_name,
        "jawWeightedVertices": jaw_weighted_vertices,
        "tongueBones": tongue_bones,
        "tongueWeightedVertices": tongue_weighted_vertices,
        "rotationAxis": axis,
        "closeDegrees": float(mouth_profile["closeDegrees"]),
    }


def join_meshes(
    meshes: list[bpy.types.Object], name: str = "Animal"
) -> bpy.types.Object:
    bpy.ops.object.select_all(action="DESELECT")
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.join()
    animal = bpy.context.view_layer.objects.active
    if animal is None:
        raise RuntimeError("Unable to join baked meshes")
    animal.name = name
    animal.data.name = f"{name}Mesh"
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    return animal


def normalize_geometry(
    animal: bpy.types.Object,
    habitat: str,
    target_length: float,
    source_body_axis: str | None = None,
) -> dict[str, Any]:
    minimum, maximum = mesh_bounds(animal)
    size = maximum - minimum
    axis_indices = {"x": 0, "y": 1, "z": 2}
    if source_body_axis is not None and source_body_axis not in axis_indices:
        raise RuntimeError(
            f"Unsupported source body axis {source_body_axis}; expected x, y or z"
        )
    primary = (
        axis_indices[source_body_axis]
        if source_body_axis is not None
        else max(range(3), key=lambda axis: size[axis])
    )
    if primary == 1:
        animal.rotation_euler.z = -math.pi * 0.5
        bpy.context.view_layer.objects.active = animal
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    elif primary == 2:
        # A very tall source usually encodes its body axis as Z. Rotate it into
        # the canonical X length axis, then re-ground below.
        animal.rotation_euler.y = math.pi * 0.5
        bpy.context.view_layer.objects.active = animal
        bpy.ops.object.transform_apply(location=False, rotation=True, scale=False)
    minimum, maximum = mesh_bounds(animal)
    size = maximum - minimum
    longest = max(size)
    if longest <= 1e-8:
        raise RuntimeError("Source bounds are degenerate")
    scale = target_length / longest
    animal.scale = (scale, scale, scale)
    bpy.context.view_layer.objects.active = animal
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    minimum, maximum = mesh_bounds(animal)
    centre = (minimum + maximum) * 0.5
    target_z = -minimum.z if habitat == "land" else -centre.z
    animal.location += Vector((-centre.x, -centre.y, target_z))
    bpy.ops.object.transform_apply(location=True, rotation=False, scale=False)
    minimum, maximum = mesh_bounds(animal)
    return {
        "sourcePrimaryAxis": ["x", "y", "z"][primary],
        "sourceAxisSelection": (
            "profile-body-axis" if source_body_axis is not None else "longest-bounds-axis"
        ),
        "targetPrimaryAxis": "x",
        "uniformScale": scale,
        "boundsMin": [round(value, 6) for value in minimum],
        "boundsMax": [round(value, 6) for value in maximum],
        "grounded": habitat == "land",
    }


def attach_source_rig_mouth_shapes(
    base_meshes: list[bpy.types.Object],
    target_meshes: list[bpy.types.Object],
) -> None:
    """Attach the rig-baked target before joining source mesh objects.

    Blender's join operator does not promise that independently joined object
    sets will receive identical vertex-block ordering.  Joining the open and
    posed copies separately can therefore pair an eye vertex with a jaw vertex
    even though every individual evaluated mesh preserves its source indices.
    Shape-keying each source-object pair first lets Blender carry the matching
    Basis/MouthClose blocks through the one final join.
    """

    if len(base_meshes) != len(target_meshes):
        raise RuntimeError(
            "Open and source-rig mouth target object counts do not match"
        )
    for base, target in zip(base_meshes, target_meshes, strict=True):
        if len(base.data.vertices) != len(target.data.vertices):
            raise RuntimeError(
                "Open and source-rig mouth target meshes have different vertex counts"
            )
        basis = base.shape_key_add(name="Basis", from_mix=False)
        close = base.shape_key_add(name="MouthClose", from_mix=False)
        for index, vertex in enumerate(target.data.vertices):
            close.data[index].co = vertex.co
        close.value = 0.0
        if len(basis.data) != len(close.data):
            raise RuntimeError("Unable to author source-rig mouth shape key")
        bpy.data.objects.remove(target, do_unlink=True)


def mesh_components(animal: bpy.types.Object) -> list[list[int]]:
    adjacency: list[list[int]] = [[] for _ in animal.data.vertices]
    for edge in animal.data.edges:
        left, right = edge.vertices
        adjacency[left].append(right)
        adjacency[right].append(left)
    visited: set[int] = set()
    components: list[list[int]] = []
    for start in range(len(animal.data.vertices)):
        if start in visited:
            continue
        queue: deque[int] = deque([start])
        visited.add(start)
        indices: list[int] = []
        while queue:
            index = queue.popleft()
            indices.append(index)
            for neighbour in adjacency[index]:
                if neighbour not in visited:
                    visited.add(neighbour)
                    queue.append(neighbour)
        components.append(indices)
    return components


def author_curated_mouth_shape(
    animal: bpy.types.Object,
    mouth_profile: dict[str, Any],
) -> dict[str, Any]:
    shape_keys = animal.data.shape_keys
    if shape_keys is None or shape_keys.key_blocks.get("Basis") is None:
        raise RuntimeError("Curated mouth motion requires a Basis shape key")
    basis = shape_keys.key_blocks["Basis"]
    close = animal.shape_key_add(name="MouthClose", from_mix=False)
    selector = mouth_profile["componentSelector"]
    centroid_x_minimum = selector.get("centroidXMinimum")
    centroid_x_maximum = selector.get("centroidXMaximum")
    centroid_z_maximum = float(selector["centroidZMaximum"])
    maximum_vertices = int(selector["maximumComponentVertices"])
    soft_tissue_counts = {
        int(value) for value in selector.get("softTissueVertexCounts", [])
    }
    soft_tissue_scale = float(selector.get("softTissueAngleScale", 1.0))
    selected: dict[int, float] = {}
    signatures: list[dict[str, Any]] = []
    components = mesh_components(animal)
    for indices in components:
        points = [basis.data[index].co for index in indices]
        centroid = Vector(
            (
                sum(point.x for point in points) / len(points),
                sum(point.y for point in points) / len(points),
                sum(point.z for point in points) / len(points),
            )
        )
        x_matches = (
            centroid_x_minimum is None
            or centroid.x >= float(centroid_x_minimum)
        ) and (
            centroid_x_maximum is None
            or centroid.x <= float(centroid_x_maximum)
        )
        if (
            x_matches
            and centroid.z <= centroid_z_maximum
            and len(indices) <= maximum_vertices
        ):
            factor = soft_tissue_scale if len(indices) in soft_tissue_counts else 1.0
            for index in indices:
                selected[index] = factor
            signatures.append(
                {
                    "vertices": len(indices),
                    "centroid": [round(value, 6) for value in centroid],
                    "angleScale": factor,
                }
            )
    region_details: dict[str, Any] | None = None
    if selector.get("largestComponentRegion") is not None:
        region = selector["largestComponentRegion"]
        component_vertex_counts = {
            int(value) for value in region.get("componentVertexCounts", [])
        }
        region_components = (
            [
                component
                for component in components
                if len(component) in component_vertex_counts
            ]
            if component_vertex_counts
            else [max(components, key=len)]
        )
        if component_vertex_counts and {
            len(component) for component in region_components
        } != component_vertex_counts:
            raise RuntimeError(
                "Curated lower-jaw region component signatures no longer match"
            )
        x_start = float(region["xRampStart"])
        x_end = float(region["xRampEnd"])
        full_weight_z = float(region["fullWeightZ"])
        zero_weight_z = float(region["zeroWeightZ"])

        def smoothstep(value: float) -> float:
            clamped = max(0.0, min(1.0, value))
            return clamped * clamped * (3.0 - 2.0 * clamped)

        region_vertex_count = 0
        for component in region_components:
            for index in component:
                point = basis.data[index].co
                x_factor = smoothstep((point.x - x_start) / (x_end - x_start))
                z_factor = 1.0 - smoothstep(
                    (point.z - full_weight_z) / (zero_weight_z - full_weight_z)
                )
                factor = x_factor * z_factor
                if factor > 0.001:
                    selected[index] = factor
                    region_vertex_count += 1
        expected_region_vertices = int(region["expectedVertexCount"])
        if region_vertex_count != expected_region_vertices:
            raise RuntimeError(
                f"Curated lower-jaw region matched {region_vertex_count} vertices; expected {expected_region_vertices}"
            )
        region_details = {
            "componentVertexCounts": sorted(
                (len(component) for component in region_components), reverse=True
            ),
            "selectedVertices": region_vertex_count,
            "xRamp": [x_start, x_end],
            "zRamp": [full_weight_z, zero_weight_z],
        }
    expected_components = int(selector["expectedComponentCount"])
    expected_vertices = int(selector["expectedVertexCount"])
    tolerance = int(selector.get("expectedVertexTolerance", 0))
    if len(signatures) != expected_components:
        raise RuntimeError(
            f"Curated mouth selector matched {len(signatures)} components; expected {expected_components}"
        )
    if abs(len(selected) - expected_vertices) > tolerance:
        raise RuntimeError(
            f"Curated mouth selector matched {len(selected)} vertices; expected {expected_vertices}±{tolerance}"
        )
    pivot = Vector(tuple(float(value) for value in mouth_profile["hingePivot"]))
    axis = str(mouth_profile["rotationAxis"]).upper()
    close_degrees = float(mouth_profile["closeDegrees"])
    rotations = {
        factor: Matrix.Rotation(math.radians(close_degrees * factor), 4, axis)
        for factor in set(selected.values())
    }
    for index, factor in selected.items():
        close.data[index].co = pivot + rotations[factor] @ (
            basis.data[index].co - pivot
        )
    close.value = 0.0
    return {
        "componentCount": len(signatures),
        "selectedVertices": len(selected),
        "componentSignatures": sorted(
            signatures,
            key=lambda value: (
                -int(value["vertices"]),
                value["centroid"][0],
                value["centroid"][2],
            ),
        ),
        "hingePivot": [round(value, 6) for value in pivot],
        "rotationAxis": axis,
        "closeDegrees": close_degrees,
        "softTissueAngleScale": soft_tissue_scale,
        "largestComponentRegion": region_details,
    }


def mouth_shape_metrics(
    animal: bpy.types.Object,
    mouth_profile: dict[str, Any],
    details: dict[str, Any],
) -> dict[str, Any]:
    shape_keys = animal.data.shape_keys
    if shape_keys is None:
        raise RuntimeError("Mouth motion shape keys are missing")
    basis = shape_keys.key_blocks.get("Basis")
    close = shape_keys.key_blocks.get("MouthClose")
    if basis is None or close is None:
        raise RuntimeError("Mouth motion requires Basis and MouthClose shape keys")
    affected: list[int] = []
    maximum_displacement = 0.0
    for index, vertex in enumerate(basis.data):
        distance = (close.data[index].co - vertex.co).length
        if distance > 1e-6:
            affected.append(index)
            maximum_displacement = max(maximum_displacement, distance)
    if not affected:
        raise RuntimeError("MouthClose does not affect any vertices")
    points = [basis.data[index].co for index in affected]
    minimum = Vector(
        tuple(min(point[axis] for point in points) for axis in range(3))
    )
    maximum = Vector(
        tuple(max(point[axis] for point in points) for axis in range(3))
    )
    model_minimum, model_maximum = mesh_bounds(animal)
    length = max(model_maximum.x - model_minimum.x, 1e-9)
    affected_fraction = len(affected) / max(len(basis.data), 1)
    maximum_fraction = float(mouth_profile["maximumAffectedVertexFraction"])
    if affected_fraction > maximum_fraction:
        raise RuntimeError(
            f"Mouth motion affects {affected_fraction:.4f} of vertices; maximum is {maximum_fraction:.4f}"
        )
    return {
        "mode": mouth_profile["mode"],
        "sourcePose": mouth_profile["sourcePose"],
        "closeDegrees": float(mouth_profile["closeDegrees"]),
        "selectedVertices": len(affected),
        "affectedVertexFraction": round(affected_fraction, 6),
        "maximumVertexDisplacement": round(maximum_displacement, 6),
        "maximumVertexDisplacementFraction": round(
            maximum_displacement / length, 6
        ),
        "affectedBounds": {
            "min": [round(value, 6) for value in minimum],
            "max": [round(value, 6) for value in maximum],
        },
        "maximumCloseFrame": 96,
        "firstFrameMatchesLast": True,
        "humanReviewStatus": mouth_profile["humanReviewStatus"],
        **details,
    }


def remove_existing_animation() -> list[str]:
    removed = sorted(action.name for action in bpy.data.actions)
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)
    for key in bpy.data.shape_keys:
        if key.animation_data is not None:
            key.animation_data_clear()
    return removed


def author_motion(
    animal: bpy.types.Object,
    *,
    profile_name: str,
    tail_axis_sign: int,
    landmarks: dict[str, Any],
    mouth_profile: dict[str, Any],
    source_rig_details: dict[str, Any] | None = None,
) -> dict[str, Any]:
    mouth_mode = str(mouth_profile["mode"])
    if mouth_mode != "source-rig" and animal.data.shape_keys is not None:
        while animal.data.shape_keys.key_blocks:
            animal.shape_key_remove(animal.data.shape_keys.key_blocks[-1])
    if mouth_mode == "source-rig":
        shape_keys = animal.data.shape_keys
        if shape_keys is None or shape_keys.key_blocks.get("Basis") is None:
            raise RuntimeError("Source-rig mouth target was not prepared")
        basis = shape_keys.key_blocks["Basis"]
        mouth_details = mouth_shape_metrics(
            animal, mouth_profile, source_rig_details or {}
        )
    else:
        basis = animal.shape_key_add(name="Basis", from_mix=False)
        if mouth_mode == "curated-components":
            curated_details = author_curated_mouth_shape(animal, mouth_profile)
            mouth_details = mouth_shape_metrics(
                animal, mouth_profile, curated_details
            )
        elif mouth_mode == "disabled":
            mouth_details = {
                "mode": "disabled",
                "reason": mouth_profile["reason"],
            }
        else:
            raise RuntimeError(f"Unsupported mouth motion mode: {mouth_mode}")
    positive = animal.shape_key_add(name="MotionPositive", from_mix=False)
    negative = animal.shape_key_add(name="MotionNegative", from_mix=False)
    minimum, maximum = mesh_bounds(animal)
    bounds_min = MotionSample(minimum.x, minimum.y, minimum.z)
    bounds_max = MotionSample(maximum.x, maximum.y, maximum.z)
    tail_base_position = landmarks["tailBase"]["position"]
    tail_tip_position = landmarks["tailTip"]["position"]
    tail_base_x = float(tail_base_position[0])
    maximum_displacement = 0.0
    visibly_displaced_vertices = 0
    relevant_span = (
        maximum.x - minimum.x
        if profile_name in {"land-breathe-tail", "marine-tail"}
        else maximum.z - minimum.z
    )
    visible_vertex_threshold = max(relevant_span * 0.01, 1e-6)
    for index, vertex in enumerate(basis.data):
        point = MotionSample(vertex.co.x, vertex.co.y, vertex.co.z)
        plus = displacement(
            profile_name,
            point,
            phase=math.pi * 0.5,
            bounds_min=bounds_min,
            bounds_max=bounds_max,
            tail_axis_sign=tail_axis_sign,
            tail_base_x=tail_base_x,
        )
        minus = displacement(
            profile_name,
            point,
            phase=math.pi * 1.5,
            bounds_min=bounds_min,
            bounds_max=bounds_max,
            tail_axis_sign=tail_axis_sign,
            tail_base_x=tail_base_x,
        )
        positive.data[index].co = vertex.co + Vector((plus.x, plus.y, plus.z))
        negative.data[index].co = vertex.co + Vector((minus.x, minus.y, minus.z))
        plus_distance = math.sqrt(plus.x**2 + plus.y**2 + plus.z**2)
        minus_distance = math.sqrt(minus.x**2 + minus.y**2 + minus.z**2)
        vertex_displacement = max(plus_distance, minus_distance)
        maximum_displacement = max(maximum_displacement, vertex_displacement)
        if vertex_displacement >= visible_vertex_threshold:
            visibly_displaced_vertices += 1
    for key in (positive, negative):
        key.value = 0.0
    if profile_name == "flying-insect":
        motion_keyframes: list[tuple[float, float, float]] = []
        cycle = 10.0
        frame = 0.0
        while frame <= 190.0:
            motion_keyframes.extend(
                [
                    (frame, 0.0, 0.0),
                    (frame + cycle * 0.25, 1.0, 0.0),
                    (frame + cycle * 0.50, 0.0, 0.0),
                    (frame + cycle * 0.75, 0.0, 1.0),
                ]
            )
            frame += cycle
        motion_keyframes.append((192.0, 0.0, 0.0))
    else:
        motion_keyframes = [
            (0.0, 0.0, 0.0),
            (48.0, 1.0, 0.0),
            (96.0, 0.0, 0.0),
            (144.0, 0.0, 1.0),
            (192.0, 0.0, 0.0),
        ]
    for frame, positive_value, negative_value in motion_keyframes:
        positive.value = positive_value
        negative.value = negative_value
        positive.keyframe_insert(data_path="value", frame=frame)
        negative.keyframe_insert(data_path="value", frame=frame)
    if mouth_mode != "disabled":
        shape_keys = animal.data.shape_keys
        if shape_keys is None:
            raise RuntimeError("Mouth shape-key data is missing")
        mouth_close = shape_keys.key_blocks.get("MouthClose")
        if mouth_close is None:
            raise RuntimeError("MouthClose shape key is missing")
        for frame, value in [
            (0, 0.0),
            (48, 0.5),
            (96, 1.0),
            (144, 0.5),
            (192, 0.0),
        ]:
            mouth_close.value = value
            mouth_close.keyframe_insert(data_path="value", frame=frame)
    shape_keys = animal.data.shape_keys
    if shape_keys is None or shape_keys.animation_data is None:
        raise RuntimeError("Shape-key action was not created")
    action = shape_keys.animation_data.action
    if action is None:
        raise RuntimeError("Shape-key action is missing")
    action.name = "Idle"
    # Blender 5.x stores action curves in layered channel bags rather than the
    # legacy Action.fcurves collection. Default Bezier interpolation is smooth,
    # deterministic and the explicit matching endpoints close the loop.
    bpy.context.scene.frame_start = 0
    bpy.context.scene.frame_end = 192
    bpy.context.scene.render.fps = 24
    bpy.context.scene.frame_set(0)
    return {
        "profile": profile_name,
        "implementation": "single-mesh-morph-target",
        "clip": "Idle",
        "durationSeconds": 8,
        "fps": 24,
        "rootTranslation": 0,
        "tailAxisSign": tail_axis_sign,
        "landmarkInputs": {
            "tailBaseX": round(tail_base_x, 6),
            "tailTipX": round(float(tail_tip_position[0]), 6),
        },
        "maximumVertexDisplacement": round(maximum_displacement, 6),
        "maximumVertexDisplacementFraction": round(
            maximum_displacement / max(relevant_span, 1e-9),
            6,
        ),
        "visiblyDisplacedVertices": visibly_displaced_vertices,
        "visibleVertexFraction": round(
            visibly_displaced_vertices / max(len(basis.data), 1),
            6,
        ),
        "firstFrameMatchesLast": True,
        "wingBeatCount": 19 if profile_name == "flying-insect" else 1,
        "mouthMotion": mouth_details,
    }


def save_blend(path: Path) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.wm.save_as_mainfile(filepath=str(path))


def setup_render(animal: bpy.types.Object, habitat: str) -> tuple[bpy.types.Object, Vector]:
    minimum, maximum = mesh_bounds(animal)
    centre = (minimum + maximum) * 0.5
    size = maximum - minimum
    camera_data = bpy.data.cameras.new("EvidenceCamera")
    camera = bpy.data.objects.new("EvidenceCamera", camera_data)
    bpy.context.scene.collection.objects.link(camera)
    bpy.context.scene.camera = camera
    camera_data.lens = 56
    key_data = bpy.data.lights.new("EvidenceKey", type="AREA")
    key_data.energy = 900
    key_data.shape = "DISK"
    key_data.size = 4
    key = bpy.data.objects.new("EvidenceKey", key_data)
    bpy.context.scene.collection.objects.link(key)
    key.location = (3.5, -4.5, 5)
    fill_data = bpy.data.lights.new("EvidenceFill", type="AREA")
    fill_data.energy = 480
    fill_data.size = 5
    fill = bpy.data.objects.new("EvidenceFill", fill_data)
    bpy.context.scene.collection.objects.link(fill)
    fill.location = (-4, 3, 3.5)
    world = bpy.data.worlds.new("EvidenceWorld")
    world.color = (0.055, 0.065, 0.06)
    bpy.context.scene.world = world
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 800
    scene.render.resolution_y = 600
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.view_settings.look = "AgX - Medium High Contrast"
    return camera, centre


def aim(camera: bpy.types.Object, target: Vector) -> None:
    camera.rotation_euler = (target - camera.location).to_track_quat("-Z", "Y").to_euler()


def render_evidence(
    animal: bpy.types.Object, habitat: str, render_directory: Path
) -> list[str]:
    render_directory.mkdir(parents=True, exist_ok=True)
    camera, centre = setup_render(animal, habitat)
    minimum, maximum = mesh_bounds(animal)
    radius = max(maximum - minimum) * 1.95
    height = centre.z + max(maximum.z - minimum.z, 0.5) * 0.16
    results: list[str] = []
    for name, degrees in [
        ("01-left", -90),
        ("02-front-three-quarter", -35),
        ("03-front", 0),
        ("04-rear-three-quarter", 145),
        ("05-right", 90),
    ]:
        radians = math.radians(degrees)
        camera.location = (
            centre.x + math.sin(radians) * radius,
            centre.y - math.cos(radians) * radius,
            height,
        )
        aim(camera, centre)
        destination = render_directory / f"{name}.png"
        bpy.context.scene.render.filepath = str(destination)
        bpy.ops.render.render(write_still=True)
        results.append(str(destination))
    return results


def load_pixels(path: Path) -> tuple[list[float], int, int]:
    image = bpy.data.images.load(str(path), check_existing=False)
    try:
        return list(image.pixels), image.size[0], image.size[1]
    finally:
        bpy.data.images.remove(image)


def render_motion_evidence(
    animal: bpy.types.Object,
    habitat: str,
    render_directory: Path,
) -> dict[str, Any]:
    render_directory.mkdir(parents=True, exist_ok=True)
    camera, centre = setup_render(animal, habitat)
    minimum, maximum = mesh_bounds(animal)
    radius = max(maximum - minimum) * 1.95
    height = centre.z + max(maximum.z - minimum.z, 0.5) * 0.16
    camera.location = (centre.x, centre.y - radius, height)
    aim(camera, centre)
    bpy.context.scene.render.film_transparent = True
    paths: list[Path] = []
    for name, frame in [
        ("00-loop-start", 0),
        ("02-positive-extreme", 48),
        ("06-negative-extreme", 144),
    ]:
        bpy.context.scene.frame_set(frame)
        destination = render_directory / f"{name}.png"
        bpy.context.scene.render.filepath = str(destination)
        bpy.ops.render.render(write_still=True)
        paths.append(destination)

    base_pixels, width, height_pixels = load_pixels(paths[0])
    model_pixel_count = sum(
        1
        for index in range(3, len(base_pixels), 4)
        if base_pixels[index] > 0.02
    )
    maximum_changed_pixels = 0
    for path in paths[1:]:
        candidate_pixels, candidate_width, candidate_height = load_pixels(path)
        if candidate_width != width or candidate_height != height_pixels:
            raise RuntimeError("Motion evidence renders have inconsistent dimensions")
        changed_pixels = 0
        for index in range(0, len(base_pixels), 4):
            if max(
                abs(base_pixels[index] - candidate_pixels[index]),
                abs(base_pixels[index + 1] - candidate_pixels[index + 1]),
                abs(base_pixels[index + 2] - candidate_pixels[index + 2]),
                abs(base_pixels[index + 3] - candidate_pixels[index + 3]),
            ) >= 0.03:
                changed_pixels += 1
        maximum_changed_pixels = max(maximum_changed_pixels, changed_pixels)

    return {
        "method": (
            "fixed-camera transparent Blender renders at loop start and both "
            "authored motion extremes"
        ),
        "paths": [str(path) for path in paths],
        "width": width,
        "height": height_pixels,
        "modelPixelCount": model_pixel_count,
        "maximumChangedPixels": maximum_changed_pixels,
        "changedPixelFractionOfModel": round(
            maximum_changed_pixels / max(model_pixel_count, 1),
            6,
        ),
    }


def render_mouth_evidence(
    animal: bpy.types.Object,
    habitat: str,
    render_directory: Path,
    mouth_motion: dict[str, Any],
) -> dict[str, Any]:
    render_directory.mkdir(parents=True, exist_ok=True)
    camera, _ = setup_render(animal, habitat)
    affected = mouth_motion["affectedBounds"]
    affected_minimum = Vector(tuple(float(value) for value in affected["min"]))
    affected_maximum = Vector(tuple(float(value) for value in affected["max"]))
    target = (affected_minimum + affected_maximum) * 0.5
    affected_size = affected_maximum - affected_minimum
    model_minimum, model_maximum = mesh_bounds(animal)
    model_length = max(model_maximum.x - model_minimum.x, 1.0)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = max(
        affected_size.x * 2.6,
        affected_size.z * 2.8,
        model_length * 0.16,
    )
    camera.location = (target.x, target.y - model_length * 1.4, target.z)
    aim(camera, target)
    bpy.context.scene.render.film_transparent = True
    paths: list[Path] = []
    for name, frame in [
        ("00-mouth-open", 0),
        ("04-mouth-close", 96),
        ("08-mouth-loop", 192),
    ]:
        bpy.context.scene.frame_set(frame)
        destination = render_directory / f"{name}.png"
        bpy.context.scene.render.filepath = str(destination)
        bpy.ops.render.render(write_still=True)
        paths.append(destination)

    open_pixels, width, height = load_pixels(paths[0])
    close_pixels, close_width, close_height = load_pixels(paths[1])
    loop_pixels, loop_width, loop_height = load_pixels(paths[2])
    if (close_width, close_height) != (width, height) or (
        loop_width,
        loop_height,
    ) != (width, height):
        raise RuntimeError("Mouth evidence renders have inconsistent dimensions")
    model_pixel_count = sum(
        1 for index in range(3, len(open_pixels), 4) if open_pixels[index] > 0.02
    )
    changed_pixels = 0
    loop_changed_pixels = 0
    for index in range(0, len(open_pixels), 4):
        close_difference = max(
            abs(open_pixels[index] - close_pixels[index]),
            abs(open_pixels[index + 1] - close_pixels[index + 1]),
            abs(open_pixels[index + 2] - close_pixels[index + 2]),
            abs(open_pixels[index + 3] - close_pixels[index + 3]),
        )
        loop_difference = max(
            abs(open_pixels[index] - loop_pixels[index]),
            abs(open_pixels[index + 1] - loop_pixels[index + 1]),
            abs(open_pixels[index + 2] - loop_pixels[index + 2]),
            abs(open_pixels[index + 3] - loop_pixels[index + 3]),
        )
        if close_difference >= 0.03:
            changed_pixels += 1
        # Use the same perceptual threshold as the open/close comparison.  Eevee
        # can vary a subpixel edge sample even when frame 0 and frame 192 have
        # byte-identical morph weights; geometry closure is verified separately.
        if loop_difference >= 0.03:
            loop_changed_pixels += 1
    return {
        "method": (
            "fixed orthographic mouth close-up at the open source pose, maximum "
            "partial close, and loop endpoint"
        ),
        "paths": [str(path) for path in paths],
        "width": width,
        "height": height,
        "modelPixelCount": model_pixel_count,
        "changedPixels": changed_pixels,
        "changedPixelFractionOfModel": round(
            changed_pixels / max(model_pixel_count, 1), 6
        ),
        "loopChangedPixels": loop_changed_pixels,
        "openFrame": 0,
        "maximumCloseFrame": 96,
        "loopFrame": 192,
    }


def main() -> None:
    args = arguments()
    profile_path = Path(args.profile).resolve()
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    model = profile["model"]
    animation_strategy = processing_strategy(model)
    input_path = Path(model["inputPath"]).resolve()
    output_path = Path(model["outputPath"]).resolve()
    blend_path = Path(model["normalizedBlendPath"]).resolve()
    log_path = Path(model["normalizationLogPath"]).resolve()
    landmarks_path = Path(model["landmarksPath"]).resolve()
    log: dict[str, Any] = {
        "schemaVersion": 1,
        "animalId": profile["id"],
        "input": {"path": str(input_path), **digest(input_path)},
        "modifications": [],
    }
    clear_scene()
    import_model(input_path)
    source_animation = imported_animation_inventory()
    verify_imported_strategy(animation_strategy, source_animation)
    log["processingStrategy"] = {
        "normalization": model["normalizationStrategy"],
        "animation": animation_strategy["mode"],
        "declaredSourceArmature": animation_strategy["sourceArmature"],
        "declaredSourceAnimation": animation_strategy["sourceAnimation"],
        "destructiveReplacementAccepted": animation_strategy[
            "destructiveReplacementAccepted"
        ],
        "reason": animation_strategy["reason"],
        "detectedSource": source_animation,
        "destructiveEffect": (
            "Bake evaluated visible meshes at the reviewed source pose, discard the "
            "source armature/actions, and replace animation with one project morph Idle."
        ),
    }
    imported_objects = len(bpy.context.scene.objects)
    mouth_profile = model.get(
        "mouthMotion",
        {"mode": "disabled", "reason": "legacy profile without mouth-motion declaration"},
    )
    source_rig_details: dict[str, Any] | None = None
    if mouth_profile["mode"] == "source-rig":
        baked, mouth_target_meshes, excluded_meshes, source_rig_details = (
            bake_source_rig_mouth_target(mouth_profile)
        )
        attach_source_rig_mouth_shapes(baked, mouth_target_meshes)
        animal = join_meshes(baked)
    else:
        baked, excluded_meshes = bake_visible_meshes()
        animal = join_meshes(baked)
    log["modifications"].append(
        {
            "operation": "bake-and-join",
            "importedObjects": imported_objects,
            "resultMeshes": 1,
            "excludedHelperMeshes": excluded_meshes,
            "reason": (
                "Execute the explicitly accepted replace-with-project-morph strategy: "
                "freeze the reviewed source pose and, when eligible, a source-rig "
                "partial mouth-close target before discarding source rig animation."
            ),
        }
    )
    geometry = normalize_geometry(
        animal,
        model["habitat"],
        float(model.get("targetLength", 3.2)),
        model.get("sourceBodyAxis"),
    )
    log["normalization"] = geometry
    log["modifications"].append(
        {
            "operation": "canonical-transform",
            "details": geometry,
            "reason": "Align length to X, center the visible bounds, and apply habitat grounding.",
        }
    )
    landmarks = sample_landmarks(
        animal,
        habitat=model["habitat"],
        tail_axis_sign=int(model["tailAxisSign"]),
        motion_profile=model["motionProfile"],
    )
    write_landmarks(str(landmarks_path), landmarks)
    removed_actions = remove_existing_animation()
    motion = author_motion(
        animal,
        profile_name=model["motionProfile"],
        tail_axis_sign=int(model["tailAxisSign"]),
        landmarks=landmarks,
        mouth_profile=mouth_profile,
        source_rig_details=source_rig_details,
    )
    log["motion"] = motion
    log["modifications"].append(
        {
            "operation": "replace-runtime-animation",
            "removedActions": removed_actions,
            "details": motion,
            "reason": "Export one traceable, closed-loop, in-place project Idle.",
            "destructiveReplacementAccepted": animation_strategy[
                "destructiveReplacementAccepted"
            ],
        }
    )
    log["landmarks"] = str(landmarks_path)
    render_directory = (
        Path(args.render_dir).resolve()
        if args.render_dir
        else Path(profile["runDirectory"]).resolve() / "neutral-renders"
    )
    log["neutralRenders"] = render_evidence(animal, model["habitat"], render_directory)
    motion_render_directory = (
        Path(profile["runDirectory"]).resolve() / "motion-renders"
    )
    log["motionEvidence"] = render_motion_evidence(
        animal,
        model["habitat"],
        motion_render_directory,
    )
    if mouth_profile["mode"] != "disabled":
        mouth_render_directory = (
            Path(profile["runDirectory"]).resolve() / "mouth-renders"
        )
        log["mouthEvidence"] = render_mouth_evidence(
            animal,
            model["habitat"],
            mouth_render_directory,
            motion["mouthMotion"],
        )
    # Evidence cameras and lights are never runtime assets.
    for obj in list(bpy.context.scene.objects):
        if obj != animal:
            bpy.data.objects.remove(obj, do_unlink=True)
    save_blend(blend_path)
    export_runtime(str(output_path), log)
    log["blend"] = {"path": str(blend_path), **digest(blend_path)}
    log["output"].update(digest(output_path))
    write_log(str(log_path), log)


if __name__ == "__main__":
    main()
