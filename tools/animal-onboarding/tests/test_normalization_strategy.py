"""Regression tests for the generic normalizer's destructive strategy boundary."""

from __future__ import annotations

import sys
import unittest
from pathlib import Path


BLENDER_DIRECTORY = Path(__file__).resolve().parents[1] / "blender"
if str(BLENDER_DIRECTORY) not in sys.path:
    sys.path.insert(0, str(BLENDER_DIRECTORY))

from normalize_animal import processing_strategy, verify_imported_strategy  # noqa: E402


def strategy(
    mode: str = "replace-with-project-morph",
    *,
    armature: str = "absent",
    animation: str = "absent",
    accepted: bool = False,
) -> dict[str, object]:
    return {
        "normalizationStrategy": mode,
        "animationStrategy": {
            "mode": mode,
            "sourceArmature": armature,
            "sourceAnimation": animation,
            "destructiveReplacementAccepted": accepted,
            "reason": "Explicit regression-test decision.",
        },
    }


class NormalizationStrategyTests(unittest.TestCase):
    def test_allows_only_explicit_project_morph_replacement(self) -> None:
        declared = processing_strategy(strategy())
        self.assertEqual(declared["mode"], "replace-with-project-morph")

    def test_routes_preserve_and_custom_work_to_dedicated_l3_operations(self) -> None:
        for mode in ("preserve-source-rig-retime", "custom-rebuild"):
            with self.subTest(mode=mode):
                with self.assertRaisesRegex(RuntimeError, "dedicated L3 operation"):
                    processing_strategy(strategy(mode))

    def test_rejects_unselected_strategy_placeholders(self) -> None:
        with self.assertRaisesRegex(RuntimeError, "unresolved"):
            processing_strategy(
                {
                    "normalizationStrategy": "BLOCKED_UNSELECTED_NORMALIZATION_STRATEGY",
                    "animationStrategy": {
                        "mode": "BLOCKED_UNSELECTED_ANIMATION_STRATEGY"
                    },
                }
            )

    def test_requires_acknowledgement_before_discarding_source_animation(self) -> None:
        declared = processing_strategy(
            strategy(armature="present", animation="present", accepted=False)
        )
        detected = {
            "armaturePresent": True,
            "animationPresent": True,
        }
        with self.assertRaisesRegex(RuntimeError, "destructively discard"):
            verify_imported_strategy(declared, detected)

        accepted = processing_strategy(
            strategy(armature="present", animation="present", accepted=True)
        )
        verify_imported_strategy(accepted, detected)

    def test_rejects_a_declared_source_inventory_that_does_not_match_import(self) -> None:
        declared = processing_strategy(strategy())
        with self.assertRaisesRegex(RuntimeError, "sourceArmature does not match"):
            verify_imported_strategy(
                declared,
                {"armaturePresent": True, "animationPresent": False},
            )


if __name__ == "__main__":
    unittest.main(argv=[__file__])
