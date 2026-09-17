"""Deterministic motion-template math shared by Blender scripts and tests."""

from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Iterable, Literal

MotionProfile = Literal[
    "land-breathe-tail",
    "marine-tail",
    "flipper-swim",
    "flying-wing",
    "flying-insect",
    "static-breathe",
]


@dataclass(frozen=True)
class MotionSample:
    x: float
    y: float
    z: float


PROFILE_AMPLITUDES: dict[MotionProfile, dict[str, float]] = {
    "land-breathe-tail": {
        "tail_lateral": 0.075,
        "tail_vertical": 0.028,
        "head_lateral": 0.018,
        "head_vertical": 0.025,
        "body_vertical": 0.012,
        "root": 0.0,
    },
    "marine-tail": {
        "tail_lateral": 0.16,
        "tail_vertical": 0.045,
        "body_vertical": 0.008,
        "root": 0.0,
    },
    "flipper-swim": {
        "appendage_vertical": 0.065,
        "body_vertical": 0.006,
        "root": 0.0,
    },
    "flying-wing": {
        # A visibly readable gallery-flight stroke.  The previous implementation
        # translated tips by a fraction of body height, which barely moved wide,
        # flat-winged animals.  Rotate each side around the canonical body axis
        # instead so the same profile works for pterosaurs and griffinflies.
        "appendage_angle_degrees": 28.0,
        "body_vertical": 0.035,
        "root": 0.0,
    },
    "flying-insect": {
        # Insects need a faster, slightly larger stroke than the slow pterosaur
        # gallery loop.  The geometric deformation remains the same body-axis
        # rotation, while normalize_animal.py authors nineteen readable beats
        # across the required eight-second Idle.
        "appendage_angle_degrees": 34.0,
        "body_vertical": 0.016,
        "root": 0.0,
    },
    "static-breathe": {
        "tail_lateral": 0.0,
        "body_vertical": 0.018,
        "root": 0.0,
    },
}


def periodic_phase(frame: float, fps: float = 24.0, seconds: float = 8.0) -> float:
    """Return a phase whose values at frame 1 and the loop end are identical."""
    duration_frames = fps * seconds
    return ((frame - 1.0) % duration_frames) / duration_frames * math.tau


def smooth_tail_influence(
    x: float,
    minimum: float,
    maximum: float,
    tail_axis_sign: int,
    tail_base_x: float | None = None,
) -> float:
    """0 near the head/torso and 1 at the declared tail extreme."""
    span = max(maximum - minimum, 1e-9)
    if tail_base_x is None:
        normalized = (x - minimum) / span
        toward_tail = normalized if tail_axis_sign > 0 else 1.0 - normalized
        ramp = max(0.0, min(1.0, (toward_tail - 0.38) / 0.62))
    elif tail_axis_sign > 0:
        ramp = (x - tail_base_x) / max(maximum - tail_base_x, 1e-9)
    else:
        ramp = (tail_base_x - x) / max(tail_base_x - minimum, 1e-9)
    ramp = max(0.0, min(1.0, ramp))
    return ramp * ramp * (3.0 - 2.0 * ramp)


def displacement(
    profile: MotionProfile,
    point: MotionSample,
    *,
    phase: float,
    bounds_min: MotionSample,
    bounds_max: MotionSample,
    tail_axis_sign: int,
    tail_base_x: float | None = None,
) -> MotionSample:
    """Return an in-place deformation offset in normalized model space."""
    length = max(bounds_max.x - bounds_min.x, 1e-9)
    height = max(bounds_max.z - bounds_min.z, 1e-9)
    centre_x = (bounds_min.x + bounds_max.x) * 0.5
    centre_z = (bounds_min.z + bounds_max.z) * 0.5
    tail = smooth_tail_influence(
        point.x,
        bounds_min.x,
        bounds_max.x,
        tail_axis_sign,
        tail_base_x,
    )
    normalized_x = (point.x - bounds_min.x) / length
    toward_head = (
        1.0 - normalized_x if tail_axis_sign > 0 else normalized_x
    )
    head = max(0.0, min(1.0, (toward_head - 0.55) / 0.45))
    head = head * head * (3.0 - 2.0 * head)
    torso = max(0.0, 1.0 - abs(point.x - centre_x) / (length * 0.5))
    vertical_level = max(0.0, (point.z - bounds_min.z) / height)
    sine = math.sin(phase)

    if profile == "land-breathe-tail":
        return MotionSample(
            0.0,
            sine
            * length
            * (
                PROFILE_AMPLITUDES[profile]["tail_lateral"] * tail
                - PROFILE_AMPLITUDES[profile]["head_lateral"] * head
            ),
            sine
            * height
            * PROFILE_AMPLITUDES[profile]["body_vertical"]
            * torso
            * vertical_level
            + sine
            * length
            * PROFILE_AMPLITUDES[profile]["tail_vertical"]
            * tail
            + sine
            * height
            * PROFILE_AMPLITUDES[profile]["head_vertical"]
            * head,
        )
    if profile == "marine-tail":
        # A travelling tail wave. The head receives less than one tenth of the
        # tail-tip displacement, avoiding the "moving head drives the fish" bug.
        travelling = math.sin(phase + tail * math.pi * 0.72)
        return MotionSample(
            0.0,
            travelling
            * length
            * PROFILE_AMPLITUDES[profile]["tail_lateral"]
            * (0.06 + 0.94 * tail),
            sine
            * height
            * PROFILE_AMPLITUDES[profile]["body_vertical"]
            * torso
            + travelling
            * length
            * PROFILE_AMPLITUDES[profile]["tail_vertical"]
            * tail,
        )
    if profile == "flipper-swim":
        lateral = abs(point.y) / max(
            abs(bounds_min.y), abs(bounds_max.y), 1e-9
        )
        side_phase = 1.0 if point.y >= 0.0 else -1.0
        return MotionSample(
            0.0,
            0.0,
            sine
            * side_phase
            * height
            * PROFILE_AMPLITUDES[profile]["appendage_vertical"]
            * lateral,
        )
    if profile in {"flying-wing", "flying-insect"}:
        lateral = abs(point.y) / max(
            abs(bounds_min.y), abs(bounds_max.y), 1e-9
        )
        wing = max(0.0, min(1.0, (lateral - 0.06) / 0.94))
        wing = wing * wing * (3.0 - 2.0 * wing)
        side = 1.0 if point.y >= 0.0 else -1.0
        angle = (
            sine
            * side
            * math.radians(PROFILE_AMPLITUDES[profile]["appendage_angle_degrees"])
        )
        relative_z = point.z - centre_z
        rotated_y = point.y * math.cos(angle) - relative_z * math.sin(angle)
        rotated_z = (
            centre_z
            + point.y * math.sin(angle)
            + relative_z * math.cos(angle)
        )
        body_bob = (
            sine
            * height
            * PROFILE_AMPLITUDES[profile]["body_vertical"]
            * torso
            * (1.0 - wing)
        )
        return MotionSample(
            0.0,
            (rotated_y - point.y) * wing,
            (rotated_z - point.z) * wing + body_bob,
        )
    if profile == "static-breathe":
        return MotionSample(
            0.0,
            0.0,
            sine
            * height
            * PROFILE_AMPLITUDES[profile]["body_vertical"]
            * torso
            * vertical_level,
        )
    raise ValueError(f"Unknown motion profile: {profile}")


def samples_are_closed(
    profile: MotionProfile,
    points: Iterable[MotionSample],
    bounds_min: MotionSample,
    bounds_max: MotionSample,
    tail_axis_sign: int,
    tail_base_x: float | None = None,
) -> bool:
    for point in points:
        first = displacement(
            profile,
            point,
            phase=periodic_phase(1),
            bounds_min=bounds_min,
            bounds_max=bounds_max,
            tail_axis_sign=tail_axis_sign,
            tail_base_x=tail_base_x,
        )
        last = displacement(
            profile,
            point,
            phase=periodic_phase(193),
            bounds_min=bounds_min,
            bounds_max=bounds_max,
            tail_axis_sign=tail_axis_sign,
            tail_base_x=tail_base_x,
        )
        if any(
            abs(left - right) > 1e-9
            for left, right in zip(
                (first.x, first.y, first.z), (last.x, last.y, last.z)
            )
        ):
            return False
    return True
