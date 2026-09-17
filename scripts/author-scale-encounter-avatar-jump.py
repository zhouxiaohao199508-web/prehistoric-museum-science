"""Author the review avatar's grounded jump family in Blender.

The application owns the character's world-space jump parabola. This script
authors package-local standing, walking, and running entries. Each sequence
contains anticipation, take-off, airborne travel, descent, landing absorption,
and recovery. Joint rotations create the pose while a vertical-only Hips
channel lowers the centre of mass at planted contacts. The clips never
translate the character horizontally, so the scale-comparison rail remains
owned by the runtime. The exported GLB is an animation source: the companion
installer copies only the three jump animations into the untouched V4 review
package so Blender never recompresses the reviewed mesh or textures.

Usage (arguments after ``--`` are passed to this script):

    blender --background --python scripts/author-scale-encounter-avatar-jump.py \
      -- --input=/absolute/avatar.glb --output=/tmp/avatar-jump-source.glb
"""

from __future__ import annotations

import argparse
import math
import sys
from pathlib import Path

import bpy
from mathutils import Matrix, Vector


FPS = 60
PALM_FACE_LOCAL_X_SIGN = {
    # The mirrored hand meshes do not share the same palmar-side sign. On the
    # anatomical left hand, the visible palm normal is -local X; on the right
    # hand it is +local X. Treating both local X axes as the palm face inverted
    # the left palm and forced an almost 180-degree wrist twist.
    "LeftHand": -1.0,
    "RightHand": 1.0,
}
CLIP_SPECS = {
    "stand": {
        "name": "Jump_Land_Stand",
        "frame_end": 54,
        "takeoff_frame": 12,
        "apex_frame": 25,
        "landing_frame": 39,
        "preview_apex_centimetres": 15.0,
        "preview_frames": (0, 4, 9, 12, 17, 25, 34, 39, 43, 49, 54),
    },
    "walk": {
        "name": "Jump_Land_Walk",
        "frame_end": 46,
        "takeoff_frame": 8,
        "apex_frame": 21,
        "landing_frame": 34,
        "preview_apex_centimetres": 13.2,
        "preview_frames": (0, 4, 8, 13, 21, 30, 34, 39, 43, 46),
    },
    "run": {
        "name": "Jump_Land_Run",
        "frame_end": 42,
        "takeoff_frame": 6,
        "apex_frame": 19,
        "landing_frame": 32,
        "preview_apex_centimetres": 12.1,
        "preview_frames": (0, 3, 6, 10, 19, 27, 32, 36, 39, 42),
    },
}
FRAME_END = max(int(spec["frame_end"]) for spec in CLIP_SPECS.values())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    parser.add_argument("--preview-dir", type=Path)
    separator = sys.argv.index("--") if "--" in sys.argv else len(sys.argv)
    return parser.parse_args(sys.argv[separator + 1 :])


def reset_scene() -> None:
    bpy.ops.object.select_all(action="SELECT")
    bpy.ops.object.delete(use_global=False)
    for datablocks in (
        bpy.data.actions,
        bpy.data.armatures,
        bpy.data.cameras,
        bpy.data.curves,
        bpy.data.lights,
        bpy.data.meshes,
        bpy.data.materials,
    ):
        for datablock in list(datablocks):
            datablocks.remove(datablock)


def imported_armature() -> bpy.types.Object:
    armatures = [obj for obj in bpy.context.scene.objects if obj.type == "ARMATURE"]
    if len(armatures) != 1:
        raise RuntimeError(f"Expected one armature, found {len(armatures)}")
    rig = armatures[0]
    expected = {
        "Hips",
        "LeftUpLeg",
        "LeftLeg",
        "RightUpLeg",
        "RightLeg",
        "Spine",
        "LeftArm",
        "RightArm",
    }
    missing = sorted(expected.difference(rig.pose.bones.keys()))
    if missing:
        raise RuntimeError(f"Avatar rig is missing jump bones: {', '.join(missing)}")
    return rig


def clear_imported_animation(rig: bpy.types.Object) -> None:
    if rig.animation_data:
        rig.animation_data_clear()
    for action in list(bpy.data.actions):
        bpy.data.actions.remove(action)


def reset_pose(rig: bpy.types.Object) -> None:
    for bone in rig.pose.bones:
        bone.matrix_basis.identity()
        bone.rotation_mode = "QUATERNION"


def rotate_bone_in_armature_space(
    rig: bpy.types.Object,
    bone_name: str,
    axis: tuple[float, float, float],
    degrees: float,
) -> None:
    """Rotate around a visible character axis instead of a Meshy bone axis.

    The four Meshy packages share joint names but not consistent local bone
    rolls. Euler-X therefore bent one knee forward and the other sideways in
    the first jump candidate. Applying the delta in armature space makes both
    hip and knee hinges use the character's left/right axis consistently.
    """

    if abs(degrees) <= 1e-9:
        return
    bone = rig.pose.bones[bone_name]
    pivot = bone.head.copy()
    transform = (
        Matrix.Translation(pivot)
        @ Matrix.Rotation(math.radians(degrees), 4, Vector(axis).normalized())
        @ Matrix.Translation(-pivot)
    )
    bone.matrix = transform @ bone.matrix
    bpy.context.view_layer.update()


def aim_bone_in_armature_space(
    rig: bpy.types.Object,
    bone_name: str,
    child_name: str,
    target_direction: tuple[float, float, float],
) -> None:
    """Aim a limb segment at a symmetric character-space direction."""

    bone = rig.pose.bones[bone_name]
    child = rig.pose.bones[child_name]
    current_direction = child.head - bone.head
    if current_direction.length_squared <= 1e-12:
        return
    delta = current_direction.normalized().rotation_difference(
        Vector(target_direction).normalized()
    )
    pivot = bone.head.copy()
    transform = (
        Matrix.Translation(pivot)
        @ delta.to_matrix().to_4x4()
        @ Matrix.Translation(-pivot)
    )
    bone.matrix = transform @ bone.matrix
    bpy.context.view_layer.update()


def orient_terminal_hand_in_armature_space(
    rig: bpy.types.Object,
    bone_name: str,
    target_direction: tuple[float, float, float],
    side: int,
) -> None:
    """Keep the wrist neutral and the open palm in a vertical plane.

    These 24-joint Meshy rigs expose LeftHand and RightHand but no finger or
    thumb joints, so they cannot form a genuine fist. The hand bone's local Y
    axis follows the wrist-to-fingers direction and local X is the hand's
    thickness axis. Because the mirrored meshes use opposite local-X signs for
    their visible palm faces, we solve the anatomical palm normal first and
    then convert it back to the correct local-X sign. This keeps both palms
    vertical and inward without forcing a destructive half-turn at the wrist.
    """

    bone = rig.pose.bones[bone_name]
    target_y = Vector(target_direction).normalized()
    target_palm_normal = Vector((target_y.y, -target_y.x, 0.0))
    if target_palm_normal.length_squared <= 1e-12:
        return
    target_palm_normal.normalize()
    inward_x = -float(side)
    if target_palm_normal.x * inward_x < 0:
        target_palm_normal.negate()
    target_x = (
        target_palm_normal * PALM_FACE_LOCAL_X_SIGN[bone_name]
    )
    target_z = target_x.cross(target_y).normalized()

    current_basis = Matrix(
        (
            tuple(bone.x_axis),
            tuple(bone.y_axis),
            tuple(bone.z_axis),
        )
    ).transposed()
    target_basis = Matrix(
        (
            tuple(target_x),
            tuple(target_y),
            tuple(target_z),
        )
    ).transposed()
    delta = target_basis @ current_basis.inverted()
    correction_degrees = math.degrees(delta.to_quaternion().angle)
    if correction_degrees > 120:
        raise RuntimeError(
            f"{bone_name} requires a {correction_degrees:.1f}-degree wrist "
            "correction; refusing a skin-collapsing twist"
        )
    pivot = bone.head.copy()
    transform = (
        Matrix.Translation(pivot)
        @ delta.to_4x4()
        @ Matrix.Translation(-pivot)
    )
    bone.matrix = transform @ bone.matrix
    bpy.context.view_layer.update()


def key_pose(
    rig: bpy.types.Object,
    frame: int,
    hips_drop_centimetres: float,
    rotations: tuple[tuple[str, tuple[float, float, float], float], ...],
    arm_directions: tuple[
        tuple[float, float, float],
        tuple[float, float, float],
        tuple[float, float, float],
        tuple[float, float, float],
    ]
    | None,
) -> None:
    reset_pose(rig)
    bpy.context.view_layer.update()
    hips = rig.pose.bones["Hips"]
    hips.matrix = (
        Matrix.Translation((0.0, 0.0, -hips_drop_centimetres)) @ hips.matrix
    )
    bpy.context.view_layer.update()
    for bone_name, axis, degrees in rotations:
        rotate_bone_in_armature_space(rig, bone_name, axis, degrees)
    if arm_directions:
        left_upper, left_lower, right_upper, right_lower = arm_directions
        aim_bone_in_armature_space(
            rig, "LeftArm", "LeftForeArm", left_upper
        )
        aim_bone_in_armature_space(
            rig, "LeftForeArm", "LeftHand", left_lower
        )
        aim_bone_in_armature_space(
            rig, "RightArm", "RightForeArm", right_upper
        )
        aim_bone_in_armature_space(
            rig, "RightForeArm", "RightHand", right_lower
        )
    for forearm_name, hand_name, side in (
        ("LeftForeArm", "LeftHand", 1),
        ("RightForeArm", "RightHand", -1),
    ):
        hand_direction = (
            rig.pose.bones[hand_name].head
            - rig.pose.bones[forearm_name].head
        )
        orient_terminal_hand_in_armature_space(
            rig,
            hand_name,
            tuple(hand_direction),
            side,
        )
    for bone in rig.pose.bones:
        bone.keyframe_insert(
            data_path="rotation_quaternion",
            frame=frame,
            group=bone.name,
        )
    rig.pose.bones["Hips"].keyframe_insert(
        data_path="location",
        frame=frame,
        group="Hips",
    )


def author_jumps(rig: bpy.types.Object) -> dict[str, bpy.types.Action]:
    scene = bpy.context.scene
    scene.render.fps = FPS
    scene.render.fps_base = 1
    scene.frame_start = 0
    scene.frame_end = FRAME_END
    rig.animation_data_create()

    # Blender uses X left/right, Y front/back, Z up for these imported rigs.
    # Front is -Y. The standing jump uses a bilateral countermovement; the walk
    # and run entries use a right-leg take-off, left-knee drive, and a later
    # left-foot landing. Every arm direction keeps its own signed X component,
    # which preserves roughly shoulder-width hand separation. Standing arms
    # swing only forward-up below the head. Moving entries begin from an
    # opposing gait pose, lift both arms once with the left arm modestly higher,
    # then lower both together. They never exchange high/low sides in flight.
    lateral_axis = (1.0, 0.0, 0.0)
    vertical_axis = (0.0, 0.0, 1.0)

    def body_pose(
        left_thigh: float,
        left_knee: float,
        left_foot: float,
        right_thigh: float,
        right_knee: float,
        right_foot: float,
        torso_forward: float,
        torso_twist: float = 0.0,
    ) -> tuple[tuple[str, tuple[float, float, float], float], ...]:
        return (
            ("LeftUpLeg", lateral_axis, left_thigh),
            ("LeftLeg", lateral_axis, left_knee),
            ("LeftFoot", lateral_axis, left_foot),
            ("RightUpLeg", lateral_axis, right_thigh),
            ("RightLeg", lateral_axis, right_knee),
            ("RightFoot", lateral_axis, right_foot),
            ("Spine", lateral_axis, torso_forward * 0.55),
            ("Spine01", lateral_axis, torso_forward * 0.30),
            ("Spine02", lateral_axis, torso_forward * 0.15),
            ("neck", lateral_axis, -torso_forward * 0.25),
            ("Spine", vertical_axis, torso_twist),
            ("Spine01", vertical_axis, torso_twist * 0.45),
        )

    def arm_segment_direction(
        side: float,
        sagittal_degrees: float,
        lateral: float,
    ) -> tuple[float, float, float]:
        """Return a shoulder-lane direction in the character sagittal plane.

        Zero degrees points forward (-Y), positive angles rise, and negative
        angles lower. Using a 70-degree difference between the upper-arm and
        forearm directions produces an anatomical elbow angle near 110 degrees
        after the small lateral shoulder-lane components are included.
        """

        radians = math.radians(sagittal_degrees)
        sagittal = math.sqrt(1 - lateral * lateral)
        return (
            side * lateral,
            -math.cos(radians) * sagittal,
            math.sin(radians) * sagittal,
        )

    def bent_arm_pose(
        left_upper_degrees: float,
        left_forearm_degrees: float,
        right_upper_degrees: float,
        right_forearm_degrees: float,
    ) -> tuple[
        tuple[float, float, float],
        tuple[float, float, float],
        tuple[float, float, float],
        tuple[float, float, float],
    ]:
        return (
            arm_segment_direction(1, left_upper_degrees, 0.25),
            arm_segment_direction(1, left_forearm_degrees, 0.12),
            arm_segment_direction(-1, right_upper_degrees, 0.25),
            arm_segment_direction(-1, right_forearm_degrees, 0.12),
        )

    # Every authored jump pose below keeps about 70 degrees between the upper
    # arm and forearm segment directions: roughly a 110-degree anatomical elbow
    # angle. Arms therefore swing from the shoulders while the elbows stay
    # flexed; no phase straightens or reverses an elbow to lower the hands.
    standing_load = bent_arm_pose(-140, -70, -140, -70)
    standing_deep_load = bent_arm_pose(-152, -82, -152, -82)
    standing_drive = bent_arm_pose(-14, 56, -14, 56)
    standing_apex = bent_arm_pose(-4, 66, -4, 66)
    standing_descent = bent_arm_pose(-26, 44, -26, 44)
    standing_contact = bent_arm_pose(-40, 30, -40, 30)
    standing_absorb = bent_arm_pose(-58, 12, -58, 12)
    standing_recover = bent_arm_pose(-72, -2, -72, -2)

    walking_entry = bent_arm_pose(-142, -72, -34, 36)
    walking_takeoff = bent_arm_pose(-12, 58, -20, 50)
    walking_flight = bent_arm_pose(0, 70, -8, 62)
    walking_descent = bent_arm_pose(-30, 40, -38, 32)
    walking_absorb = bent_arm_pose(-55, 15, -62, 8)
    walking_recover = bent_arm_pose(-70, 0, -76, -6)

    running_entry = bent_arm_pose(-145, -75, -35, 35)
    running_takeoff = bent_arm_pose(-10, 60, -18, 52)
    running_flight = bent_arm_pose(2, 72, -6, 64)
    running_descent = bent_arm_pose(-28, 42, -36, 34)
    running_absorb = bent_arm_pose(-54, 16, -61, 9)
    running_recover = bent_arm_pose(-68, 2, -74, -4)

    standing_poses = (
        (0, 0.0, body_pose(0, 0, 0, 0, 0, 0, 0), None),
        (
            4,
            2.3,
            body_pose(-10, 22, -12, -10, 22, -12, 4),
            standing_load,
        ),
        (
            9,
            7.4,
            body_pose(-31, 66, -35, -31, 66, -35, 10),
            standing_deep_load,
        ),
        (
            12,
            0.0,
            body_pose(-2, 5, -3, -2, 5, -3, -2),
            standing_drive,
        ),
        (
            17,
            0.0,
            body_pose(-11, 29, -18, -11, 29, -18, -2),
            standing_drive,
        ),
        (
            25,
            0.0,
            body_pose(-21, 50, -29, -21, 50, -29, 0),
            standing_apex,
        ),
        (
            34,
            0.0,
            body_pose(-15, 35, -20, -15, 35, -20, 3),
            standing_descent,
        ),
        (
            39,
            0.0,
            body_pose(-10, 22, -11, -10, 22, -11, 7),
            standing_contact,
        ),
        (
            43,
            6.6,
            body_pose(-30, 65, -35, -30, 65, -35, 10),
            standing_absorb,
        ),
        (
            49,
            2.4,
            body_pose(-11, 26, -15, -11, 26, -15, 4),
            standing_recover,
        ),
        (54, 0.0, body_pose(0, 0, 0, 0, 0, 0, 0), None),
    )

    walking_poses = (
        (
            0,
            0.0,
            body_pose(-18, 25, -9, 12, 16, -6, 5, -3),
            walking_entry,
        ),
        (
            4,
            3.8,
            body_pose(-25, 42, -18, 8, 36, -21, 8, -4),
            walking_entry,
        ),
        (
            8,
            0.0,
            body_pose(-33, 54, -22, 7, 5, -7, 4, -3),
            walking_takeoff,
        ),
        (
            13,
            0.0,
            body_pose(-40, 65, -28, 12, 22, -14, 4, -2),
            walking_takeoff,
        ),
        (
            21,
            0.0,
            body_pose(-37, 61, -27, 5, 34, -21, 4, 1),
            walking_flight,
        ),
        (
            30,
            0.0,
            body_pose(-21, 30, -11, 15, 28, -17, 6, 3),
            walking_descent,
        ),
        (
            34,
            0.0,
            body_pose(-12, 20, -7, 18, 31, -18, 8, 4),
            walking_descent,
        ),
        (
            39,
            4.8,
            body_pose(-27, 58, -33, 7, 39, -24, 11, 4),
            walking_absorb,
        ),
        (
            43,
            1.9,
            body_pose(-12, 30, -17, -5, 25, -14, 6, 1),
            walking_recover,
        ),
        (
            46,
            0.0,
            body_pose(10, 17, -6, -18, 25, -9, 5, 3),
            walking_recover,
        ),
    )

    running_poses = (
        (
            0,
            0.0,
            body_pose(-32, 52, -20, 18, 18, -8, 9, -5),
            running_entry,
        ),
        (
            3,
            3.4,
            body_pose(-38, 65, -29, 12, 38, -22, 12, -5),
            running_entry,
        ),
        (
            6,
            0.0,
            body_pose(-43, 67, -27, 10, 5, -8, 8, -4),
            running_takeoff,
        ),
        (
            10,
            0.0,
            body_pose(-48, 72, -30, 15, 22, -14, 7, -3),
            running_takeoff,
        ),
        (
            19,
            0.0,
            body_pose(-43, 68, -28, 7, 38, -23, 6, 0),
            running_flight,
        ),
        (
            27,
            0.0,
            body_pose(-25, 34, -12, 18, 30, -17, 8, 4),
            running_descent,
        ),
        (
            32,
            0.0,
            body_pose(-14, 21, -7, 21, 34, -20, 11, 5),
            running_descent,
        ),
        (
            36,
            4.3,
            body_pose(-31, 64, -35, 7, 43, -26, 13, 4),
            running_absorb,
        ),
        (
            39,
            1.7,
            body_pose(-13, 32, -18, -8, 29, -16, 8, 1),
            running_recover,
        ),
        (
            42,
            0.0,
            body_pose(16, 20, -8, -34, 54, -21, 9, 5),
            running_recover,
        ),
    )

    all_poses = {
        "stand": standing_poses,
        "walk": walking_poses,
        "run": running_poses,
    }
    actions: dict[str, bpy.types.Action] = {}
    for entry, poses in all_poses.items():
        spec = CLIP_SPECS[entry]
        action = bpy.data.actions.new(str(spec["name"]))
        action.use_fake_user = True
        rig.animation_data.action = action
        for frame, hips_drop_centimetres, rotations, arm_directions in poses:
            key_pose(
                rig,
                frame,
                hips_drop_centimetres,
                rotations,
                arm_directions,
            )

        # Smooth between authored poses without overshooting knees or elbows.
        if hasattr(action, "fcurves"):
            for curve in action.fcurves:
                for point in curve.keyframe_points:
                    point.interpolation = "BEZIER"
                    point.handle_left_type = "AUTO_CLAMPED"
                    point.handle_right_type = "AUTO_CLAMPED"
        actions[entry] = action

    rig.animation_data.action = actions["stand"]
    scene.frame_set(0)
    return actions


def export_animation_source(output: Path) -> None:
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.export_scene.gltf(
        filepath=str(output),
        export_format="GLB",
        export_animations=True,
        export_animation_mode="ACTIONS",
        export_force_sampling=True,
        export_frame_range=True,
        export_frame_step=1,
        export_skins=True,
        export_morph=False,
    )


def validate_hand_clearance(
    rig: bpy.types.Object,
    actions: dict[str, bpy.types.Action],
) -> None:
    """Reject unsafe hands, flat palms, or invalid elbow mechanics."""

    scene = bpy.context.scene
    for entry, action in actions.items():
        rig.animation_data.action = action
        minimum_hand_separation = math.inf
        minimum_shoulder_span = math.inf
        maximum_hand_above_head = -math.inf
        hand_heights_by_frame: dict[int, tuple[float, float]] = {}
        elbow_angles_by_frame: dict[int, tuple[float, float]] = {}
        elbow_bends_by_frame: dict[int, tuple[float, float]] = {}
        palm_normals_by_frame: dict[
            int,
            tuple[tuple[float, float], tuple[float, float]],
        ] = {}
        for frame in range(int(CLIP_SPECS[entry]["frame_end"]) + 1):
            scene.frame_set(frame)
            bpy.context.view_layer.update()
            left_hand = rig.pose.bones["LeftHand"].head
            right_hand = rig.pose.bones["RightHand"].head
            left_shoulder = rig.pose.bones["LeftArm"].head
            right_shoulder = rig.pose.bones["RightArm"].head
            head_base = rig.pose.bones["Head"].head
            left_upper_direction = (
                rig.pose.bones["LeftForeArm"].head
                - rig.pose.bones["LeftArm"].head
            ).normalized()
            left_forearm_direction = (
                rig.pose.bones["LeftHand"].head
                - rig.pose.bones["LeftForeArm"].head
            ).normalized()
            right_upper_direction = (
                rig.pose.bones["RightForeArm"].head
                - rig.pose.bones["RightArm"].head
            ).normalized()
            right_forearm_direction = (
                rig.pose.bones["RightHand"].head
                - rig.pose.bones["RightForeArm"].head
            ).normalized()
            minimum_hand_separation = min(
                minimum_hand_separation,
                abs(left_hand.x - right_hand.x),
            )
            minimum_shoulder_span = min(
                minimum_shoulder_span,
                abs(left_shoulder.x - right_shoulder.x),
            )
            maximum_hand_above_head = max(
                maximum_hand_above_head,
                left_hand.z - head_base.z,
                right_hand.z - head_base.z,
            )
            hand_heights_by_frame[frame] = (left_hand.z, right_hand.z)
            elbow_angles_by_frame[frame] = (
                180
                - math.degrees(
                    left_upper_direction.angle(left_forearm_direction)
                ),
                180
                - math.degrees(
                    right_upper_direction.angle(right_forearm_direction)
                ),
            )
            elbow_bends_by_frame[frame] = (
                left_upper_direction.cross(left_forearm_direction).x,
                right_upper_direction.cross(right_forearm_direction).x,
            )
            palm_normals_by_frame[frame] = (
                (
                    rig.pose.bones["LeftHand"].x_axis.x
                    * PALM_FACE_LOCAL_X_SIGN["LeftHand"],
                    rig.pose.bones["LeftHand"].x_axis.z
                    * PALM_FACE_LOCAL_X_SIGN["LeftHand"],
                ),
                (
                    rig.pose.bones["RightHand"].x_axis.x
                    * PALM_FACE_LOCAL_X_SIGN["RightHand"],
                    rig.pose.bones["RightHand"].x_axis.z
                    * PALM_FACE_LOCAL_X_SIGN["RightHand"],
                ),
            )
        minimum_ratio = minimum_hand_separation / max(
            minimum_shoulder_span,
            1e-6,
        )
        print(
            f"{action.name} hand clearance: minimum separation "
            f"{minimum_hand_separation:.2f} cm ({minimum_ratio:.2f}x shoulder "
            f"span), maximum wrist above head base "
            f"{maximum_hand_above_head:.2f} cm"
        )
        if minimum_ratio < 0.72:
            raise RuntimeError(
                f"{action.name} brings the hands inside natural shoulder lanes"
            )
        if maximum_hand_above_head > 12:
            raise RuntimeError(f"{action.name} raises a wrist over the head")
        elbow_start_frame = 4 if entry == "stand" else 0
        elbow_end_frame = (
            49 if entry == "stand" else int(CLIP_SPECS[entry]["frame_end"])
        )
        sampled_elbows = [
            (frame, side, elbow_angles_by_frame[frame][side])
            for frame in range(elbow_start_frame, elbow_end_frame + 1)
            for side in (0, 1)
        ]
        minimum_elbow_angle = min(sample[2] for sample in sampled_elbows)
        maximum_elbow_angle = max(sample[2] for sample in sampled_elbows)
        maximum_bend_x = max(
            elbow_bends_by_frame[frame][side]
            for frame in range(elbow_start_frame, elbow_end_frame + 1)
            for side in (0, 1)
        )
        print(
            f"{action.name} elbow contract: anatomical angle "
            f"{minimum_elbow_angle:.2f}-{maximum_elbow_angle:.2f} degrees; "
            f"maximum sagittal bend sign {maximum_bend_x:.3f}"
        )
        invalid_elbow = next(
            (
                sample
                for sample in sampled_elbows
                if sample[2] < 88 or sample[2] > 122
            ),
            None,
        )
        if invalid_elbow:
            frame, side, angle = invalid_elbow
            side_name = "left" if side == 0 else "right"
            raise RuntimeError(
                f"{action.name} {side_name} elbow is {angle:.2f} degrees "
                f"at frame {frame}; expected 88-122 degrees"
            )
        if maximum_bend_x > -0.15:
            raise RuntimeError(
                f"{action.name} straightens or reverses an elbow bend"
            )
        sampled_palms = [
            (frame, side, palm_normals_by_frame[frame][side])
            for frame in range(int(CLIP_SPECS[entry]["frame_end"]) + 1)
            for side in (0, 1)
        ]
        maximum_palm_normal_z = max(
            abs(sample[2][1]) for sample in sampled_palms
        )
        minimum_inward_palm_x = min(
            -sample[2][0] if sample[1] == 0 else sample[2][0]
            for sample in sampled_palms
        )
        print(
            f"{action.name} palm contract: maximum vertical normal "
            f"{maximum_palm_normal_z:.3f}; minimum inward normal "
            f"{minimum_inward_palm_x:.3f}"
        )
        invalid_palm = next(
            (
                sample
                for sample in sampled_palms
                if abs(sample[2][1]) > 0.2
            ),
            None,
        )
        if invalid_palm:
            frame, side, normal = invalid_palm
            side_name = "left" if side == 0 else "right"
            raise RuntimeError(
                f"{action.name} {side_name} palm faces vertically at frame "
                f"{frame}: normal X/Z=({normal[0]:.3f}, {normal[1]:.3f})"
            )
        if minimum_inward_palm_x < 0.3:
            raise RuntimeError(
                f"{action.name} turns a palm away from its inward vertical lane"
            )
        if entry in {"walk", "run"}:
            takeoff_frame = int(CLIP_SPECS[entry]["takeoff_frame"])
            apex_frame = int(CLIP_SPECS[entry]["apex_frame"])
            landing_frame = int(CLIP_SPECS[entry]["landing_frame"])
            entry_heights = hand_heights_by_frame[0]
            apex_heights = hand_heights_by_frame[apex_frame]
            landing_heights = hand_heights_by_frame[landing_frame]
            minimum_left_over_right = min(
                hand_heights_by_frame[frame][0]
                - hand_heights_by_frame[frame][1]
                for frame in range(takeoff_frame, landing_frame + 1)
            )
            maximum_post_apex_relift = max(
                max(
                    hand_heights_by_frame[frame][side]
                    - hand_heights_by_frame[frame - 1][side]
                    for side in (0, 1)
                )
                for frame in range(apex_frame + 1, landing_frame + 1)
            )
            print(
                f"{action.name} single arm lift: apex rises "
                f"L={apex_heights[0] - entry_heights[0]:.2f} cm, "
                f"R={apex_heights[1] - entry_heights[1]:.2f} cm; "
                f"apex-to-landing drop "
                f"L={apex_heights[0] - landing_heights[0]:.2f} cm, "
                f"R={apex_heights[1] - landing_heights[1]:.2f} cm; "
                f"minimum left-over-right airborne difference "
                f"{minimum_left_over_right:.2f} cm; maximum post-apex "
                f"re-lift {maximum_post_apex_relift:.2f} cm/frame"
            )
            if min(
                apex_heights[0] - entry_heights[0],
                apex_heights[1] - entry_heights[1],
            ) < 6:
                raise RuntimeError(
                    f"{action.name} does not raise both hands for take-off"
                )
            if min(
                apex_heights[0] - landing_heights[0],
                apex_heights[1] - landing_heights[1],
            ) < 10:
                raise RuntimeError(
                    f"{action.name} does not lower both arms for landing"
                )
            if minimum_left_over_right < -1:
                raise RuntimeError(
                    f"{action.name} swaps the airborne arm-height ordering"
                )
            if maximum_post_apex_relift > 1:
                raise RuntimeError(
                    f"{action.name} contains a second post-apex arm lift"
                )
    rig.animation_data.action = actions["stand"]
    scene.frame_set(0)


def look_at(obj: bpy.types.Object, target: Vector) -> None:
    obj.rotation_euler = (target - obj.location).to_track_quat("-Z", "Y").to_euler()


def deformed_mesh_minimum_z(scene: bpy.types.Scene) -> float:
    depsgraph = bpy.context.evaluated_depsgraph_get()
    minimum_z = math.inf
    for obj in scene.objects:
        if obj.type != "MESH" or obj.hide_render:
            continue
        evaluated = obj.evaluated_get(depsgraph)
        mesh = evaluated.to_mesh()
        try:
            if mesh.vertices:
                minimum_z = min(
                    minimum_z,
                    min(
                        (evaluated.matrix_world @ vertex.co).z
                        for vertex in mesh.vertices
                    ),
                )
        finally:
            evaluated.to_mesh_clear()
    if not math.isfinite(minimum_z):
        raise RuntimeError("Jump preview has no evaluated mesh vertices")
    return minimum_z


def render_previews(
    rig: bpy.types.Object,
    actions: dict[str, bpy.types.Action],
    preview_dir: Path,
) -> None:
    preview_dir.mkdir(parents=True, exist_ok=True)
    scene = bpy.context.scene
    scene.render.engine = "BLENDER_EEVEE"
    scene.render.resolution_x = 480
    scene.render.resolution_y = 640
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.film_transparent = False
    scene.world.color = (0.055, 0.07, 0.08)

    scene.frame_set(0)
    bpy.context.view_layer.update()
    mesh_corners = [
        obj.matrix_world @ Vector(corner)
        for obj in scene.objects
        if obj.type == "MESH" and not obj.hide_render
        for corner in obj.bound_box
    ]
    if not mesh_corners:
        raise RuntimeError("Jump preview has no renderable mesh bounds")
    minimum = Vector(
        tuple(min(point[index] for point in mesh_corners) for index in range(3))
    )
    maximum = Vector(
        tuple(max(point[index] for point in mesh_corners) for index in range(3))
    )
    center = (minimum + maximum) / 2
    height = max(maximum.z - minimum.z, 0.01)
    print(f"Preview bounds: min={tuple(minimum)}, max={tuple(maximum)}")

    camera_data = bpy.data.cameras.new("JumpPreviewCamera")
    camera = bpy.data.objects.new("JumpPreviewCamera", camera_data)
    bpy.context.collection.objects.link(camera)
    scene.camera = camera
    camera_data.type = "ORTHO"
    camera_data.ortho_scale = height * 1.25
    camera.location = center + Vector((height * 1.5, -height * 2.2, height * 0.45))
    look_at(camera, center)

    key = bpy.data.lights.new("JumpPreviewKey", "AREA")
    key.energy = 650
    key.shape = "DISK"
    key.size = 3.0
    key_object = bpy.data.objects.new("JumpPreviewKey", key)
    bpy.context.collection.objects.link(key_object)
    key_object.location = center + Vector((-height * 1.6, -height * 1.7, height * 2.0))
    look_at(key_object, center)

    fill = bpy.data.lights.new("JumpPreviewFill", "AREA")
    fill.energy = 380
    fill.size = 2.5
    fill_object = bpy.data.objects.new("JumpPreviewFill", fill)
    bpy.context.collection.objects.link(fill_object)
    fill_object.location = center + Vector((height * 1.7, height, height * 1.2))
    look_at(fill_object, center)

    preview_roots = [
        obj
        for obj in scene.objects
        if obj.parent is None and obj.type in {"ARMATURE", "EMPTY", "MESH"}
    ]
    preview_root_z = {obj.name: obj.location.z for obj in preview_roots}

    for entry, action in actions.items():
        spec = CLIP_SPECS[entry]
        variant_dir = preview_dir / entry
        variant_dir.mkdir(parents=True, exist_ok=True)
        rig.animation_data.action = action
        for frame in spec["preview_frames"]:
            takeoff_frame = int(spec["takeoff_frame"])
            landing_frame = int(spec["landing_frame"])
            if takeoff_frame < int(frame) < landing_frame:
                progress = (int(frame) - takeoff_frame) / (
                    landing_frame - takeoff_frame
                )
                jump_offset = (
                    4
                    * float(spec["preview_apex_centimetres"])
                    * progress
                    * (1 - progress)
                )
            else:
                jump_offset = 0.0
            for obj in preview_roots:
                obj.location.z = preview_root_z[obj.name] + jump_offset
            scene.frame_set(int(frame))
            bpy.context.view_layer.update()
            print(
                f"{action.name} frame {frame:02d} deformed minimum Z: "
                f"{deformed_mesh_minimum_z(scene):.4f} cm"
            )
            scene.render.filepath = str(
                variant_dir / f"jump-{int(frame):02d}.png"
            )
            bpy.ops.render.render(write_still=True)
    for obj in preview_roots:
        obj.location.z = preview_root_z[obj.name]
    rig.animation_data.action = actions["stand"]
    scene.frame_set(0)
    bpy.context.view_layer.objects.active = rig


def main() -> None:
    args = parse_args()
    input_path = args.input.expanduser().resolve()
    output_path = args.output.expanduser().resolve()
    if not input_path.is_file():
        raise FileNotFoundError(input_path)

    reset_scene()
    bpy.ops.import_scene.gltf(filepath=str(input_path))
    rig = imported_armature()
    clear_imported_animation(rig)
    actions = author_jumps(rig)
    validate_hand_clearance(rig, actions)
    export_animation_source(output_path)
    if args.preview_dir:
        render_previews(
            rig,
            actions,
            args.preview_dir.expanduser().resolve(),
        )
    print(
        "Authored "
        + ", ".join(
            f"{action.name}={CLIP_SPECS[entry]['frame_end'] / FPS:.3f}s"
            for entry, action in actions.items()
        )
        + f": {len(rig.pose.bones)} bones, {output_path}"
    )


if __name__ == "__main__":
    main()
