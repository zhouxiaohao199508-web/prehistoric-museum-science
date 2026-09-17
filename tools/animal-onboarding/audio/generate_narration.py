#!/usr/bin/env python3
"""Generate locale-bound Qwen3-TTS CustomVoice narration from profiles.

There is deliberately no system-TTS fallback. A missing Qwen environment or
checkpoint is a hard failure because a technically valid MP3 is not equivalent
to a museum narration candidate tied to its declared locale and voice.
"""

from __future__ import annotations

import argparse
from datetime import date
import hashlib
import json
from pathlib import Path
import time

from qwen_serena_runtime import (
    MODEL_ID,
    MODEL_REVISION,
    SEED,
    artifact_metrics,
    file_sha256,
    normalize,
)


SCRIPT_PATH = Path(__file__).resolve()
PROJECT_DIRECTORY = SCRIPT_PATH.parents[3]


def shared_runtime_directory() -> Path:
    for parent in PROJECT_DIRECTORY.parents:
        candidate = parent / ".runtime" / "qwen3-tts"
        if candidate.is_dir():
            return candidate
    return PROJECT_DIRECTORY.parent / ".runtime" / "qwen3-tts"


DEFAULT_MODEL_PATH = (
    shared_runtime_directory()
    / "models"
    / "Qwen3-TTS-12Hz-0.6B-CustomVoice"
)


def arguments() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description=(
            "Generate two deterministic Qwen3-TTS raw runs and one normalized "
            "local-review MP3 for each configured onboarding locale."
        )
    )
    parser.add_argument("profiles", nargs="+")
    parser.add_argument(
        "--locale",
        action="append",
        choices=("zh-CN", "en"),
        help="Generate only this locale; repeat to select both. Defaults to all configured locales.",
    )
    parser.add_argument(
        "--model-path",
        type=Path,
        default=DEFAULT_MODEL_PATH,
        help="Local Qwen3-TTS 0.6B CustomVoice checkpoint.",
    )
    return parser.parse_args()


def automatic_checks(mp3: dict[str, object]) -> dict[str, object]:
    checks = {
        "codecIsMp3": mp3["codec"] == "mp3",
        "sampleRateIs48kHz": mp3["sampleRateHz"] == 48_000,
        "channelLayoutIsMono": mp3["channels"] == 1,
        "bitRateIs64To96Kbps": 64_000 <= int(mp3["bitRateBps"]) <= 96_000,
        "durationIsEightToEighteenSeconds": (
            8 <= float(mp3["durationSeconds"]) <= 18
        ),
        "integratedLoudnessIsApproximatelyMinus18Lufs": (
            -20 <= float(mp3["integratedLufs"]) <= -16
        ),
        "truePeakIsNoHigherThanMinus1Dbtp": (
            float(mp3["truePeakDbtp"]) <= -1
        ),
        "leadingSilenceIsApproximatelyPoint1Seconds": (
            0.05 <= float(mp3["leadingSilenceSeconds"]) <= 0.15
        ),
        "trailingSilenceIsApproximatelyPoint25Seconds": (
            0.15 <= float(mp3["trailingSilenceSeconds"]) <= 0.30
        ),
        "bytesAreWithin300KiBHardCeiling": (
            int(mp3["bytes"]) <= 300 * 1024
        ),
        "decodedSuccessfully": mp3["decodedSuccessfully"] is True,
    }
    return {"checks": checks, "allPassed": all(checks.values())}


def profile_inputs(
    profile_path: Path,
    selected_locales: set[str] | None,
) -> list[dict[str, object]]:
    profile = json.loads(profile_path.read_text(encoding="utf-8"))
    assets = profile["assets"]
    run_directory = Path(profile["runDirectory"]).resolve()
    model_lock_path = run_directory / "model-lock.json"
    if not model_lock_path.is_file():
        raise ValueError(
            f"{profile['id']}: model-lock.json is required before narration generation"
        )
    model_lock = json.loads(model_lock_path.read_text(encoding="utf-8"))
    current_model_path = Path(str(profile["model"]["outputPath"])).resolve()
    if (
        model_lock.get("decision") != "accepted-for-finishing"
        or not current_model_path.is_file()
        or model_lock.get("modelSha256") != file_sha256(current_model_path)
    ):
        raise ValueError(
            f"{profile['id']}: model lock is missing, invalid, or stale"
        )
    configured = assets.get("narration")
    if configured is None:
        # Backward-readable Chinese draft input. It remains intentionally
        # single-language and cannot pass the bilingual promotion contract.
        legacy_path = assets.get("narrationPath")
        legacy_script = assets.get("narrationScriptPath")
        configured = (
            {
                "zh-CN": {
                    "path": legacy_path,
                    "scriptPath": legacy_script,
                    "speaker": "Serena",
                    "language": "Chinese",
                }
            }
            if legacy_path and legacy_script
            else {}
        )
    if not isinstance(configured, dict):
        raise ValueError(f"{profile['id']}: assets.narration must be an object")

    result: list[dict[str, object]] = []
    for locale in ("zh-CN", "en"):
        if selected_locales is not None and locale not in selected_locales:
            continue
        narration = configured.get(locale)
        if narration is None:
            continue
        if not isinstance(narration, dict):
            raise ValueError(f"{profile['id']}: invalid narration entry for {locale}")
        expected_language = "Chinese" if locale == "zh-CN" else "English"
        language = str(narration.get("language", ""))
        if language != expected_language:
            raise ValueError(
                f"{profile['id']}: {locale} narration language must be {expected_language}"
            )
        speaker = str(narration.get("speaker", "")).strip()
        if not speaker:
            raise ValueError(f"{profile['id']}: {locale} narration speaker is required")
        script_path = Path(str(narration["scriptPath"])).resolve()
        output_path = Path(str(narration["path"])).resolve()
        metrics_path = Path(
            str(
                narration.get(
                    "metricsPath",
                    run_directory / f"narration.{locale}.metrics.json",
                )
            )
        ).resolve()
        script = script_path.read_text(encoding="utf-8").strip()
        if not script:
            raise ValueError(f"Empty narration script: {script_path}")
        if output_path.parent != run_directory or metrics_path.parent != run_directory:
            raise ValueError(
                f"{profile['id']}: narration artifacts must remain inside its run directory"
            )
        result.append(
            {
                "profile": profile,
                "locale": locale,
                "script": script,
                "script_path": script_path,
                "output_path": output_path,
                "metrics_path": metrics_path,
                "speaker": speaker,
                "language": language,
            }
        )
    return result


def main() -> None:
    args = arguments()
    selected_locales = set(args.locale) if args.locale else None
    selected = [
        item
        for path in args.profiles
        for item in profile_inputs(Path(path).resolve(), selected_locales)
    ]
    if not selected:
        raise ValueError("No configured narration matched the requested locales")
    model_path = args.model_path.resolve()
    if not model_path.is_dir():
        raise FileNotFoundError(
            f"Qwen checkpoint is missing: {model_path}"
        )

    import numpy as np
    import soundfile as sf
    import torch
    from qwen_tts import Qwen3TTSModel

    model_started = time.perf_counter()
    model = Qwen3TTSModel.from_pretrained(
        str(model_path),
        device_map="cpu",
        dtype=torch.float32,
        attn_implementation="sdpa",
    )
    model_load_seconds = time.perf_counter() - model_started

    failures: list[str] = []
    for item in selected:
        profile = item["profile"]
        script = str(item["script"])
        script_path = Path(item["script_path"])
        output_path = Path(item["output_path"])
        metrics_path = Path(item["metrics_path"])
        locale = str(item["locale"])
        speaker = str(item["speaker"])
        language = str(item["language"])
        animal_id = str(profile["id"])
        run_directory = Path(str(profile["runDirectory"])).resolve()
        raw_directory = run_directory / "audio-evidence" / locale / "raw"
        master_directory = run_directory / "audio-evidence" / locale / "master"
        raw_directory.mkdir(parents=True, exist_ok=True)
        master_directory.mkdir(parents=True, exist_ok=True)
        output_path.parent.mkdir(parents=True, exist_ok=True)

        raw_runs: list[dict[str, object]] = []
        for run_number in (1, 2):
            np.random.seed(SEED)
            torch.manual_seed(SEED)
            generation_started = time.perf_counter()
            wavs, sample_rate = model.generate_custom_voice(
                text=script,
                language=language,
                speaker=speaker,
            )
            generation_seconds = time.perf_counter() - generation_started
            wav = wavs[0]
            raw_path = raw_directory / f"{animal_id}-{locale}-run{run_number}.wav"
            sf.write(raw_path, wav, sample_rate, subtype="PCM_24")
            raw_runs.append(
                {
                    "run": run_number,
                    "path": str(raw_path),
                    "sha256": file_sha256(raw_path),
                    "bytes": raw_path.stat().st_size,
                    "generationSeconds": round(generation_seconds, 3),
                    "audioSeconds": round(len(wav) / sample_rate, 6),
                    "sampleRateHz": sample_rate,
                    "channels": 1,
                    "subtype": "PCM_24",
                }
            )

        runs_identical = raw_runs[0]["sha256"] == raw_runs[1]["sha256"]
        if not runs_identical:
            raise RuntimeError(
                f"Seeded Qwen raw runs differ for {animal_id}/{locale}"
            )

        selected_raw = raw_directory / f"{animal_id}-{locale}-run2.wav"
        master_path = master_directory / f"{animal_id}-{locale}.wav"
        processing = normalize(selected_raw, master_path, output_path)
        mp3 = artifact_metrics(output_path)
        master = artifact_metrics(master_path)
        acceptance = automatic_checks(mp3)
        if not acceptance["allPassed"]:
            failures.append(f"{animal_id}/{locale}")

        script_sha256 = hashlib.sha256(script.encode("utf-8")).hexdigest()
        metrics = {
            "schemaVersion": 2,
            "status": "local-review-candidate",
            "generatedOn": date.today().isoformat(),
            "animalId": animal_id,
            "locale": locale,
            "script": script,
            "scriptPath": str(script_path),
            "scriptUtf8Sha256": script_sha256,
            "engine": {
                "package": "qwen-tts",
                "packageVersion": "0.1.1",
                "model": MODEL_ID,
                "modelRevision": MODEL_REVISION,
                "modelPath": str(model_path),
                "speaker": speaker,
                "language": language,
                "device": "cpu",
                "dtype": "float32",
                "attentionImplementation": "sdpa",
                "seed": SEED,
            },
            "generation": {
                "modelLoadSeconds": round(model_load_seconds, 3),
                "rawRuns": raw_runs,
                "runsByteIdentical": runs_identical,
            },
            "processing": processing,
            "masterArtifact": master,
            "artifact": mp3,
            "automaticAcceptance": acceptance,
            "requiredHumanChecks": [
                "Exact script fidelity",
                "Animal name and uncommon-word pronunciation",
                "Pacing and sentence separation",
                "Missing syllables or audible artifacts",
                "Suitability for a parent-and-preschool-child museum",
                "Public redistribution decision",
            ],
            "humanListeningReview": "pending",
            "publicDistributionDecision": "pending",
        }
        metrics_path.write_text(
            json.dumps(metrics, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        print(
            json.dumps(
                {
                    "animalId": animal_id,
                    "locale": locale,
                    "engine": metrics["engine"],
                    "runsByteIdentical": runs_identical,
                    "artifact": mp3,
                    "automaticAcceptance": acceptance,
                    "metricsPath": str(metrics_path),
                },
                ensure_ascii=False,
                indent=2,
            )
        )

    if failures:
        raise RuntimeError(
            "Automatic Qwen narration acceptance failed for: "
            + ", ".join(failures)
        )


if __name__ == "__main__":
    main()
