"""Blender/Python fixture assertions for every supported motion template."""

from __future__ import annotations

import math
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "blender"))

from motion_profiles import (  # noqa: E402
    MotionSample,
    displacement,
    periodic_phase,
    samples_are_closed,
    smooth_tail_influence,
)

minimum = MotionSample(-2.0, -0.5, 0.0)
maximum = MotionSample(2.0, 0.5, 1.0)
points = [
    MotionSample(-2.0, 0.0, 0.5),
    MotionSample(0.0, 0.0, 0.8),
    MotionSample(2.0, 0.0, 0.5),
    MotionSample(0.0, 0.5, 0.4),
]
profiles = [
    "land-breathe-tail",
    "marine-tail",
    "flipper-swim",
    "flying-wing",
    "flying-insect",
    "static-breathe",
]
for profile in profiles:
    assert samples_are_closed(
        profile, points, minimum, maximum, -1, tail_base_x=-0.5
    ), profile
    values = [
        displacement(
            profile,
            point,
            phase=periodic_phase(49),
            bounds_min=minimum,
            bounds_max=maximum,
            tail_axis_sign=-1,
            tail_base_x=-0.5,
        )
        for point in points
    ]
    assert any(
        abs(sample.x) + abs(sample.y) + abs(sample.z) > 1e-7
        for sample in values
    ), profile
    assert all(
        math.isfinite(component)
        for sample in values
        for component in (sample.x, sample.y, sample.z)
    ), profile

marine_head = displacement(
    "marine-tail",
    MotionSample(2.0, 0.0, 0.5),
    phase=math.pi * 0.5,
    bounds_min=minimum,
    bounds_max=maximum,
    tail_axis_sign=-1,
    tail_base_x=-0.5,
)
marine_tail = displacement(
    "marine-tail",
    MotionSample(-2.0, 0.0, 0.5),
    phase=math.pi * 0.5,
    bounds_min=minimum,
    bounds_max=maximum,
    tail_axis_sign=-1,
    tail_base_x=-0.5,
)
assert abs(marine_tail.y) > abs(marine_head.y) * 8
land_tail = displacement(
    "land-breathe-tail",
    MotionSample(-2.0, 0.0, 0.5),
    phase=math.pi * 0.5,
    bounds_min=minimum,
    bounds_max=maximum,
    tail_axis_sign=-1,
    tail_base_x=-0.5,
)
assert abs(land_tail.y) / (maximum.x - minimum.x) >= 0.06
assert abs(marine_tail.y) / (maximum.x - minimum.x) >= 0.09
assert abs(land_tail.z) / (maximum.x - minimum.x) >= 0.02
assert abs(marine_tail.z) / (maximum.x - minimum.x) >= 0.025
flying_right = displacement(
    "flying-wing",
    MotionSample(0.0, 0.5, 0.5),
    phase=math.pi * 0.5,
    bounds_min=minimum,
    bounds_max=maximum,
    tail_axis_sign=-1,
)
flying_left = displacement(
    "flying-wing",
    MotionSample(0.0, -0.5, 0.5),
    phase=math.pi * 0.5,
    bounds_min=minimum,
    bounds_max=maximum,
    tail_axis_sign=-1,
)
flying_down = displacement(
    "flying-wing",
    MotionSample(0.0, 0.5, 0.5),
    phase=math.pi * 1.5,
    bounds_min=minimum,
    bounds_max=maximum,
    tail_axis_sign=-1,
)
assert flying_right.z > 0.2
assert flying_left.z > 0.2
assert flying_down.z < -0.2
assert abs(0.5 + flying_right.y) < 0.5
assert abs(-0.5 + flying_left.y) < 0.5
insect_right = displacement(
    "flying-insect",
    MotionSample(0.0, 0.5, 0.5),
    phase=math.pi * 0.5,
    bounds_min=minimum,
    bounds_max=maximum,
    tail_axis_sign=-1,
)
assert insect_right.z > flying_right.z
assert smooth_tail_influence(-0.5, -2.0, 2.0, -1, -0.5) == 0
assert smooth_tail_influence(-2.0, -2.0, 2.0, -1, -0.5) == 1
print(
    "motion profiles: 6 passed; all loops closed; "
    "landmark tail base drives tail-only influence"
)
