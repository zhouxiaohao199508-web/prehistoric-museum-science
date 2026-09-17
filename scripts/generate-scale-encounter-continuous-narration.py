#!/usr/bin/env python3
"""Generate Serena encounter narration as continuous masters, then slice it.

The checked-in MP3 names stay stable for the browser runtime. Lossless raw and
normalized masters live in an ignored handoff directory, while the candidate
manifest records the master hash and exact sample range behind every slice.
"""

from __future__ import annotations

import argparse
from collections.abc import Iterable, Sequence
from datetime import date
import hashlib
from itertools import combinations
import json
import math
from pathlib import Path
import re
import subprocess
import time

import numpy as np
import soundfile as sf
import torch
from qwen_tts import Qwen3TTSModel


PROJECT = Path(__file__).resolve().parents[1]
WORKSPACE = PROJECT.parents[4]
MODEL_PATH = (
    WORKSPACE
    / ".runtime/qwen3-tts/models/Qwen3-TTS-12Hz-0.6B-CustomVoice"
)
OUTPUT_DIRECTORY = PROJECT / "src/scale-encounter/audio"
NARRATION_MANIFEST_PATH = OUTPUT_DIRECTORY / "narration-candidates.json"
NARRATION_SCRIPTS_PATH = OUTPUT_DIRECTORY / "narration-scripts.json"
TRANSITION_DURATIONS_PATH = OUTPUT_DIRECTORY / "transition-durations.json"
DEFAULT_EVIDENCE_DIRECTORY = (
    PROJECT
    / ".handoff/scale-encounter-continuous-narration-all-animals-2026-08-23-serena-light-exploration-v3"
)
FFMPEG = Path("/opt/homebrew/bin/ffmpeg")
FFPROBE = Path("/opt/homebrew/bin/ffprobe")

MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
MODEL_REVISION = "85e237c12c027371202489a0ec509ded67b5e4b5"
SPEAKER = "Serena"
BASE_SEED = 20260823
SAMPLE_RATE = 48_000
PROSODY_PRESET = "serena-light-exploration-v3"
# Keep the exact Serena timbre used by the static museum. A small whole-master
# pace lift adds forward motion without pitch-shifting the voice or processing
# individual phases differently.
LIGHT_EXPLORATION_TEMPO_FACTOR = 1.04
KINDS = ("intro", "transition", "arrival")
VIEW_SWITCH_KINDS = ("toChildEyes", "toChildRear")
LOCALES = ("zh-CN", "en")
ANIMALS = (
    "stegosaurus",
    "pteranodon",
    "pachycephalosaurus",
    "ichthyosaur",
    "tyrannosaurus-rex",
    "rhamphorhynchus",
    "triceratops",
    "apatosaurus",
    "plesiosaurus",
    "gigantoraptor",
    "tupandactylus",
    "mammoth",
    "megalodon",
    "maiasaura",
    "sauropelta",
    "meganeura",
    "dilophosaurus",
    "mosasaurus",
    "spinosaurus",
    "lystrosaurus",
    "baryonyx",
    "archaeopteryx",
    "carnotaurus",
    "anomalocaris",
)
REVIEW_ANIMALS = (
    "spinosaurus",
    "lystrosaurus",
    "baryonyx",
    "archaeopteryx",
    "carnotaurus",
    "anomalocaris",
)
PRONUNCIATION_OVERRIDES = {
    ("baryonyx", "zh-CN"): {
        "text": "重爪龙",
        # Qwen's Chinese grapheme front end otherwise selects chóng in this
        # uncommon animal name. 仲 is an audio-only homophone that forces the
        # intended zhòng without changing any visible or recorded copy.
        "generationText": "仲爪龙",
        "reading": "zhòng zhǎo lóng",
        "context": "重爪龙，重读 zhòng（轻重的重）",
    },
}
VIEW_SWITCH_SCRIPTS = {
    "zh-CN": {
        "toChildEyes": "好，再回到你的眼睛这里。看看动物离你有多远，再顺着它的身体慢慢看一圈。",
        "toChildRear": "想看看自己刚才在什么位置吗？我们到你身后看一眼。你还可以向左或向右移动，换个方向再看看动物。",
    },
    "en": {
        "toChildEyes": "We’re moving to the child’s eyes now. Look up at the animal, notice how far away it is, and feel just how big it looks from this height.",
        "toChildRear": "Now we’re moving a little above and behind the child. Both the child and the animal stay fully in view, so you can see yourself while observing the animal ahead.",
    },
}
SILENCE_PATTERN = re.compile(
    r"silence_(start|end):\s*([0-9.]+)(?:\s*\|\s*silence_duration:\s*([0-9.]+))?"
)


def run(command: Sequence[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(command, check=True, capture_output=True, text=True)


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def text_sha256(text: str) -> str:
    return hashlib.sha256(text.encode("utf-8")).hexdigest()


def pronunciation_generation_script(
    animal: str, locale: str, authored_script: str
) -> tuple[str, dict[str, str] | None]:
    override = PRONUNCIATION_OVERRIDES.get((animal, locale))
    if override is None:
        return authored_script, None
    text = override["text"]
    if text not in authored_script:
        raise RuntimeError(
            f"Pronunciation override text {text!r} is absent from {animal}.{locale}"
        )
    return authored_script.replace(text, override["generationText"]), override


def ffprobe(path: Path) -> dict[str, object]:
    result = run(
        [
            str(FFPROBE),
            "-v",
            "error",
            "-show_entries",
            "format=duration,size,bit_rate:stream=codec_name,sample_rate,channels",
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(result.stdout)


def last_json_object(output: str) -> dict[str, object]:
    start = output.rfind("{")
    if start < 0:
        raise RuntimeError("FFmpeg did not report loudness JSON")
    result, _ = json.JSONDecoder().raw_decode(output[start:])
    if not isinstance(result, dict):
        raise RuntimeError("FFmpeg reported invalid loudness JSON")
    return result


def silence_intervals(path: Path) -> list[dict[str, float]]:
    result = run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-af",
            "silencedetect=noise=-50dB:d=0.02",
            "-f",
            "null",
            "-",
        ]
    )
    intervals: list[dict[str, float]] = []
    active_start: float | None = None
    for kind, value, duration in SILENCE_PATTERN.findall(result.stderr):
        if kind == "start":
            active_start = float(value)
        elif active_start is not None:
            end = float(value)
            intervals.append(
                {
                    "start": active_start,
                    "end": end,
                    "duration": float(duration) if duration else end - active_start,
                }
            )
            active_start = None
    return intervals


def boundary_trim(path: Path, duration: float) -> tuple[float, float]:
    intervals = silence_intervals(path)
    leading_end = 0.0
    trailing_start = duration
    if intervals and intervals[0]["start"] <= 0.001:
        leading_end = intervals[0]["end"]
    if intervals and intervals[-1]["end"] >= duration - 0.03:
        trailing_start = intervals[-1]["start"]
    start = max(0.0, leading_end - 0.10)
    end = min(duration, trailing_start + 0.22)
    if end <= start:
        raise RuntimeError(f"Invalid trim interval for {path.name}")
    return start, end


def master_tempo_factor(
    _locale: str, _continuous_script: str, _trimmed_duration: float
) -> float:
    return LIGHT_EXPLORATION_TEMPO_FACTOR


def normalize_master(
    raw_path: Path,
    master_path: Path,
    preview_path: Path,
    locale: str,
    continuous_script: str,
) -> float:
    raw_duration = float(ffprobe(raw_path)["format"]["duration"])  # type: ignore[index]
    trim_start, trim_end = boundary_trim(raw_path, raw_duration)
    tempo_factor = master_tempo_factor(
        locale, continuous_script, trim_end - trim_start
    )
    trim = (
        f"atrim=start={trim_start:.6f}:end={trim_end:.6f},"
        f"asetpts=PTS-STARTPTS,atempo={tempo_factor:.8f},aresample=48000"
    )
    first = run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-nostats",
            "-i",
            str(raw_path),
            "-af",
            f"{trim},loudnorm=I=-18:TP=-1:LRA=7:print_format=json",
            "-f",
            "null",
            "-",
        ]
    )
    measured = last_json_object(first.stderr)
    second = (
        f"{trim},loudnorm=I=-18:TP=-1:LRA=7:"
        f"measured_I={measured['input_i']}:"
        f"measured_LRA={measured['input_lra']}:"
        f"measured_TP={measured['input_tp']}:"
        f"measured_thresh={measured['input_thresh']}:"
        f"offset={measured['target_offset']}:linear=true"
    )
    run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-y",
            "-i",
            str(raw_path),
            "-af",
            second,
            "-map_metadata",
            "-1",
            "-ar",
            str(SAMPLE_RATE),
            "-ac",
            "1",
            "-c:a",
            "pcm_s24le",
            str(master_path),
        ]
    )
    run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-y",
            "-i",
            str(master_path),
            "-map_metadata",
            "-1",
            "-ar",
            str(SAMPLE_RATE),
            "-ac",
            "1",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "80k",
            str(preview_path),
        ]
    )
    return tempo_factor


def find_phase_tracks(
    manifest: dict[str, object], animal: str, locale: str
) -> list[dict[str, object]]:
    tracks = manifest["tracks"]
    if not isinstance(tracks, list):
        raise RuntimeError("Narration manifest tracks must be a list")
    result: list[dict[str, object]] = []
    for kind in KINDS:
        prefix = f"{animal}-{kind}"
        suffix = f".{locale}.mp3"
        matches = [
            track
            for track in tracks
            if isinstance(track, dict)
            and str(track.get("file", "")).startswith(prefix)
            and str(track.get("file", "")).endswith(suffix)
        ]
        if len(matches) != 1:
            raise RuntimeError(
                f"Expected one {animal} {locale} {kind} track, found {len(matches)}"
            )
        result.append(matches[0])
    return result


def ensure_review_phase_tracks(
    manifest: dict[str, object], animal: str, locale: str
) -> None:
    if animal not in REVIEW_ANIMALS:
        return
    tracks = manifest["tracks"]
    if not isinstance(tracks, list):
        raise RuntimeError("Narration manifest tracks must be a list")
    for kind in KINDS:
        file_name = f"{animal}-{kind}.{locale}.mp3"
        if any(
            isinstance(track, dict) and track.get("file") == file_name
            for track in tracks
        ):
            continue
        tracks.append(
            {
                "file": file_name,
                "locale": locale,
                "script": "",
                "sha256": "pending-generation",
                "durationSeconds": 0,
            }
        )


def find_view_switch_tracks(
    manifest: dict[str, object], locale: str
) -> list[dict[str, object]]:
    tracks = manifest["tracks"]
    if not isinstance(tracks, list):
        raise RuntimeError("Narration manifest tracks must be a list")
    result: list[dict[str, object]] = []
    for stem in ("eyes", "rear"):
        suffix = f".{locale}.mp3"
        matches = [
            track
            for track in tracks
            if isinstance(track, dict)
            and str(track.get("file", "")).startswith(f"view-switch-to-{stem}")
            and str(track.get("file", "")).endswith(suffix)
        ]
        if len(matches) != 1:
            raise RuntimeError(
                f"Expected one {locale} view-switch {stem} track, found {len(matches)}"
            )
        result.append(matches[0])
    return result


def expected_boundary_seconds(
    phase_tracks: Sequence[dict[str, object]], master_duration: float
) -> tuple[float, ...]:
    def spoken_units(track: dict[str, object]) -> float:
        script = str(track["script"])
        if track.get("locale") == "zh-CN":
            units = len(re.findall(r"[\u3400-\u9fffA-Za-z0-9]", script))
        else:
            units = 0
            for word in re.findall(r"[A-Za-z]+", script.lower()):
                groups = re.findall(r"[aeiouy]+", word)
                syllables = max(1, len(groups))
                if word.endswith("e") and not word.endswith(("le", "ye")) and syllables > 1:
                    syllables -= 1
                units += syllables
        # Sentence-final pauses belong to the phase and make a better timing
        # estimate than the durations of superseded, independently generated
        # candidate lines.
        pauses = len(re.findall(r"[。！？.!?]", script))
        return float(units) + pauses * 1.5

    weights = [spoken_units(track) for track in phase_tracks]
    total = sum(weights)
    cumulative = 0.0
    boundaries: list[float] = []
    for weight in weights[:-1]:
        cumulative += weight
        boundaries.append(master_duration * cumulative / total)
    return tuple(boundaries)


def choose_boundaries(
    master_path: Path,
    phase_tracks: Sequence[dict[str, object]],
    overrides: Sequence[int] | None,
) -> tuple[tuple[int, ...], list[dict[str, float]], tuple[float, ...]]:
    total_samples = sf.info(master_path).frames
    master_duration = total_samples / SAMPLE_RATE
    expected = expected_boundary_seconds(phase_tracks, master_duration)
    intervals = [
        interval
        for interval in silence_intervals(master_path)
        if interval["start"] > 0.25
        and interval["end"] < master_duration - 0.25
        and interval["duration"] >= 0.035
    ]
    if overrides is not None:
        if len(overrides) != len(expected):
            raise RuntimeError(
                f"A cut override must contain exactly {len(expected)} sample indices"
            )
        boundaries = tuple(int(value) for value in overrides)
        if not all(
            0 < boundary < total_samples for boundary in boundaries
        ) or list(boundaries) != sorted(boundaries):
            raise RuntimeError(f"Invalid cut override for {master_path.name}")
        return boundaries, intervals, expected

    candidates = [
        ((interval["start"] + interval["end"]) / 2, interval)
        for interval in intervals
    ]
    best: tuple[float, tuple[float, ...]] | None = None
    for selection in combinations(candidates, len(expected)):
        centers = tuple(candidate[0] for candidate in selection)
        if any(
            centers[index + 1] <= centers[index] + 1.0
            for index in range(len(centers) - 1)
        ):
            continue
        distance = sum(
            abs(center - expected_boundary)
            for center, expected_boundary in zip(centers, expected, strict=True)
        )
        silence_reward = 0.12 * math.log1p(
            sum(candidate[1]["duration"] for candidate in selection)
        )
        score = distance - silence_reward
        if best is None or score < best[0]:
            best = (score, centers)
    if best is None:
        raise RuntimeError(
            f"No {len(expected)} natural pause candidates found in {master_path.name}"
        )
    _, centers = best
    deviations = tuple(
        abs(center - expected_boundary)
        for center, expected_boundary in zip(centers, expected, strict=True)
    )
    if max(deviations) > 2.75:
        raise RuntimeError(
            f"Automatic cuts for {master_path.name} are too far from expected "
            f"boundaries: {deviations}. Add a cut override after listening."
        )
    return tuple(round(center * SAMPLE_RATE) for center in centers), intervals, expected


def encode_slice(
    master_path: Path, output_path: Path, start_sample: int, end_sample: int
) -> None:
    run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-y",
            "-i",
            str(master_path),
            "-af",
            (
                f"atrim=start_sample={start_sample}:end_sample={end_sample},"
                "asetpts=PTS-STARTPTS"
            ),
            "-map_metadata",
            "-1",
            "-ar",
            str(SAMPLE_RATE),
            "-ac",
            "1",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "80k",
            str(output_path),
        ]
    )
    run(
        [
            str(FFMPEG),
            "-v",
            "error",
            "-i",
            str(output_path),
            "-f",
            "null",
            "-",
        ]
    )


def batches(items: Sequence[dict[str, object]], size: int) -> Iterable[list[dict[str, object]]]:
    for start in range(0, len(items), size):
        yield list(items[start : start + size])


def update_transition_durations(manifest: dict[str, object]) -> None:
    durations: dict[str, dict[str, int]] = {locale: {} for locale in LOCALES}
    for animal in ANIMALS:
        for locale in LOCALES:
            transition = find_phase_tracks(manifest, animal, locale)[1]
            durations[locale][animal] = math.ceil(
                float(transition["durationSeconds"]) * 1000
            )
    TRANSITION_DURATIONS_PATH.write_text(
        json.dumps(durations, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    selection = parser.add_mutually_exclusive_group()
    selection.add_argument("--animals", nargs="+", choices=ANIMALS)
    selection.add_argument("--view-switch-only", action="store_true")
    parser.add_argument("--include-view-switch", action="store_true")
    parser.add_argument("--locales", nargs="+", choices=LOCALES)
    parser.add_argument("--batch-size", type=int, default=2)
    parser.add_argument("--runs", type=int, choices=(1, 2), default=2)
    parser.add_argument("--process-existing", action="store_true")
    parser.add_argument("--source-evidence-manifest", type=Path)
    parser.add_argument(
        "--evidence-directory", type=Path, default=DEFAULT_EVIDENCE_DIRECTORY
    )
    arguments = parser.parse_args()

    selected_animals = (
        []
        if arguments.view_switch_only
        else arguments.animals or list(ANIMALS)
    )
    include_view_switch = (
        arguments.animals is None or arguments.include_view_switch
    )
    selected_locales = arguments.locales or list(LOCALES)
    evidence_directory = arguments.evidence_directory.resolve()
    raw_directory = evidence_directory / "raw"
    master_directory = evidence_directory / "master"
    raw_directory.mkdir(parents=True, exist_ok=True)
    master_directory.mkdir(parents=True, exist_ok=True)
    OUTPUT_DIRECTORY.mkdir(parents=True, exist_ok=True)

    if not MODEL_PATH.is_dir():
        raise FileNotFoundError(MODEL_PATH)
    if not FFMPEG.is_file() or not FFPROBE.is_file():
        raise FileNotFoundError("ffmpeg and ffprobe are required")

    narration_manifest = json.loads(
        NARRATION_MANIFEST_PATH.read_text(encoding="utf-8")
    )
    authored_scripts = json.loads(
        NARRATION_SCRIPTS_PATH.read_text(encoding="utf-8")
    )
    cut_overrides_path = evidence_directory / "cut-overrides.json"
    cut_overrides = (
        json.loads(cut_overrides_path.read_text(encoding="utf-8"))
        if cut_overrides_path.is_file()
        else {}
    )
    evidence_manifest_path = evidence_directory / "manifest.json"
    previous_evidence = (
        json.loads(evidence_manifest_path.read_text(encoding="utf-8"))
        if evidence_manifest_path.is_file()
        else {}
    )
    previous_masters = {
        f"{master['animalId']}.{master['locale']}": master
        for master in previous_evidence.get("masters", [])
    }
    source_evidence_path = (
        arguments.source_evidence_manifest.resolve()
        if arguments.source_evidence_manifest
        else None
    )
    source_evidence = (
        json.loads(source_evidence_path.read_text(encoding="utf-8"))
        if source_evidence_path
        else {}
    )
    source_masters = {
        f"{master['animalId']}.{master['locale']}": master
        for master in source_evidence.get("masters", [])
    }
    jobs: list[dict[str, object]] = []
    for animal in selected_animals:
        for locale in selected_locales:
            ensure_review_phase_tracks(narration_manifest, animal, locale)
            phase_tracks = find_phase_tracks(narration_manifest, animal, locale)
            scripts = [str(authored_scripts[locale][animal][kind]) for kind in KINDS]
            for track, script in zip(phase_tracks, scripts, strict=True):
                track["script"] = script
            continuous_script = "\n".join(scripts)
            generation_script, pronunciation_override = (
                pronunciation_generation_script(
                    animal,
                    locale,
                    continuous_script,
                )
            )
            if pronunciation_override is not None:
                for track in phase_tracks:
                    track["pronunciationContext"] = pronunciation_override[
                        "context"
                    ]
            jobs.append(
                {
                    "animal": animal,
                    "kinds": KINDS,
                    "locale": locale,
                    "language": "Chinese" if locale == "zh-CN" else "English",
                    "phaseTracks": phase_tracks,
                    "scripts": scripts,
                    # Newlines strengthen the two edit points without breaking
                    # the single-input, single-master generation contract.
                    "continuousScript": continuous_script,
                    "generationScript": generation_script,
                    "pronunciationOverride": pronunciation_override,
                }
            )
    if include_view_switch:
        for locale in selected_locales:
            phase_tracks = find_view_switch_tracks(narration_manifest, locale)
            scripts = [VIEW_SWITCH_SCRIPTS[locale][kind] for kind in VIEW_SWITCH_KINDS]
            for track, script in zip(phase_tracks, scripts, strict=True):
                track["script"] = script
            jobs.append(
                {
                    "animal": "view-switch",
                    "kinds": VIEW_SWITCH_KINDS,
                    "locale": locale,
                    "language": "Chinese" if locale == "zh-CN" else "English",
                    "phaseTracks": phase_tracks,
                    "scripts": scripts,
                    "continuousScript": "\n".join(scripts),
                    "generationScript": "\n".join(scripts),
                    "pronunciationOverride": None,
                }
            )

    model = None
    model_load_seconds = 0.0
    if not arguments.process_existing:
        load_started = time.perf_counter()
        model = Qwen3TTSModel.from_pretrained(
            str(MODEL_PATH),
            device_map="cpu",
            dtype=torch.float32,
            attn_implementation="sdpa",
        )
        model_load_seconds = time.perf_counter() - load_started

    generation_records: dict[str, dict[str, object]] = {}
    for batch_index, batch in enumerate(batches(jobs, arguments.batch_size)):
        seed = BASE_SEED + batch_index
        run_records: dict[str, list[dict[str, object]]] = {
            f"{job['animal']}.{job['locale']}": [] for job in batch
        }
        for run_number in range(1, arguments.runs + 1):
            if arguments.process_existing:
                wavs_and_rates = []
                for job in batch:
                    key = f"{job['animal']}.{job['locale']}"
                    raw_path = raw_directory / f"{key}.run{run_number}.wav"
                    if not raw_path.is_file():
                        raise FileNotFoundError(raw_path)
                    wavs_and_rates.append((None, sf.info(raw_path).samplerate))
            else:
                if model is None:
                    raise RuntimeError("TTS model was not loaded")
                np.random.seed(seed)
                torch.manual_seed(seed)
                started = time.perf_counter()
                wavs, sample_rate = model.generate_custom_voice(
                    text=[str(job["generationScript"]) for job in batch],
                    language=[str(job["language"]) for job in batch],
                    speaker=[SPEAKER] * len(batch),
                )
                if len(wavs) != len(batch):
                    raise RuntimeError("Qwen returned an unexpected batch size")
                wavs_and_rates = [(wav, sample_rate) for wav in wavs]
                generation_seconds = time.perf_counter() - started

            for job, (wav, sample_rate) in zip(batch, wavs_and_rates, strict=True):
                key = f"{job['animal']}.{job['locale']}"
                raw_path = raw_directory / f"{key}.run{run_number}.wav"
                if wav is not None:
                    sf.write(raw_path, wav, sample_rate, subtype="PCM_24")
                    duration = len(wav) / sample_rate
                else:
                    duration = sf.info(raw_path).duration
                run_records[key].append(
                    {
                        "run": run_number,
                        "sha256": sha256(raw_path),
                        "durationSeconds": round(duration, 6),
                        "batchGenerationSeconds": (
                            round(generation_seconds, 3)
                            if not arguments.process_existing
                            else 0.0
                        ),
                    }
                )
        for job in batch:
            key = f"{job['animal']}.{job['locale']}"
            records = run_records[key]
            if len(records) == 2 and records[0]["sha256"] != records[1]["sha256"]:
                raise RuntimeError(f"Seeded continuous runs differ for {key}")
            if arguments.process_existing and key in source_masters:
                source_generation = source_masters[key]["generation"]
                source_runs = {
                    int(record["run"]): record
                    for record in source_generation.get("runs", [])
                }
                for record in records:
                    source_record = source_runs.get(int(record["run"]))
                    if (
                        source_record is None
                        or source_record.get("sha256") != record["sha256"]
                    ):
                        raise RuntimeError(
                            f"Reused raw hash does not match source evidence for {key}"
                        )
                generation_records[key] = {
                    **source_generation,
                    "reusedFromEvidence": str(
                        source_evidence_path.relative_to(PROJECT)
                    ),
                }
            elif arguments.process_existing and key in previous_masters:
                generation_records[key] = previous_masters[key]["generation"]
            else:
                generation_records[key] = {
                    "seed": seed,
                    "batchJobs": [
                        f"{candidate['animal']}.{candidate['locale']}"
                        for candidate in batch
                    ],
                    "runs": records,
                    "seededRunsByteIdentical": len(records) == 2,
                }
        print(
            json.dumps(
                {
                    "completedBatch": batch_index + 1,
                    "jobs": [f"{job['animal']}.{job['locale']}" for job in batch],
                },
                ensure_ascii=False,
            ),
            flush=True,
        )

    master_results: list[dict[str, object]] = []
    updated_track_files: set[str] = set()
    for job in jobs:
        animal = str(job["animal"])
        locale = str(job["locale"])
        key = f"{animal}.{locale}"
        source_run = arguments.runs
        raw_path = raw_directory / f"{key}.run{source_run}.wav"
        master_path = master_directory / f"{key}.wav"
        master_preview_path = master_directory / f"{key}.mp3"
        continuous_script = str(job["continuousScript"])
        generation_script = str(job["generationScript"])
        tempo_factor = normalize_master(
            raw_path,
            master_path,
            master_preview_path,
            locale,
            continuous_script,
        )
        master_hash = sha256(master_path)
        total_samples = sf.info(master_path).frames
        phase_tracks = job["phaseTracks"]
        if not isinstance(phase_tracks, list):
            raise RuntimeError("Invalid phase track plan")
        boundaries, detected_silences, expected = choose_boundaries(
            master_path,
            phase_tracks,
            cut_overrides.get(key),
        )
        cut_points = (0, *boundaries, total_samples)
        intervals = tuple(zip(cut_points[:-1], cut_points[1:], strict=True))
        segment_results: list[dict[str, object]] = []
        for kind, track, (start_sample, end_sample) in zip(
            job["kinds"], phase_tracks, intervals, strict=True
        ):
            output_path = OUTPUT_DIRECTORY / str(track["file"])
            encode_slice(master_path, output_path, start_sample, end_sample)
            probe = ffprobe(output_path)
            track.pop("openingEndSample", None)
            track.pop("openingTempoFactor", None)
            track.update(
                {
                    "sha256": sha256(output_path),
                    "durationSeconds": float(probe["format"]["duration"]),  # type: ignore[index]
                    "continuousMasterSha256": master_hash,
                    "continuousMasterScriptSha256": text_sha256(
                        str(job["continuousScript"])
                    ),
                    "continuousMasterEvidence": str(
                        master_path.relative_to(PROJECT)
                    ),
                    "startSample": start_sample,
                    "endSample": end_sample,
                }
            )
            updated_track_files.add(str(track["file"]))
            segment_results.append(
                {
                    "kind": kind,
                    "file": track["file"],
                    "script": track["script"],
                    "startSample": start_sample,
                    "endSample": end_sample,
                    "sha256": track["sha256"],
                    "durationSeconds": track["durationSeconds"],
                }
            )
        master_results.append(
            {
                "animalId": animal,
                "locale": locale,
                "file": str(master_path.relative_to(evidence_directory)),
                "previewFile": str(
                    master_preview_path.relative_to(evidence_directory)
                ),
                "script": job["continuousScript"],
                "scriptSha256": text_sha256(str(job["continuousScript"])),
                "generationScriptSha256": text_sha256(generation_script),
                "pronunciationOverride": job["pronunciationOverride"],
                "sha256": master_hash,
                "durationSeconds": total_samples / SAMPLE_RATE,
                "tempoFactor": tempo_factor,
                "sampleRateHz": SAMPLE_RATE,
                "totalSamples": total_samples,
                "cutBoundariesSamples": list(boundaries),
                "expectedBoundarySeconds": list(expected),
                "detectedSilences": detected_silences,
                "generation": generation_records[key],
                "segments": segment_results,
            }
        )
        print(
            json.dumps(
                {
                    "sliced": key,
                    "durationSeconds": total_samples / SAMPLE_RATE,
                    "cutBoundariesSamples": list(boundaries),
                },
                ensure_ascii=False,
            ),
            flush=True,
        )

    listening_reviews = narration_manifest.get("humanListeningReview")
    if not isinstance(listening_reviews, dict):
        raise RuntimeError("Narration manifest is missing humanListeningReview")
    for animal in selected_animals:
        listening_reviews[animal] = {
            "status": "pending",
            "scriptReview": "pending",
            "evidence": (
                "Selected intro, transition and arrival slices were rebuilt "
                "from one uninterrupted Serena master per locale, using the "
                "same built-in voice as the static museum and a subtle 1.04x "
                "whole-master pace lift. Script, "
                "pronunciation, pacing, cut points and in-context timing require "
                "Leon's review."
            ),
        }
    if include_view_switch:
        listening_reviews["view-switch"] = {
            "status": "pending",
            "scriptReview": "pending",
            "evidence": (
                "Both shared viewpoint lines were regenerated as one continuous "
                "Serena master per locale with the same 1.04x whole-master pace "
                "lift, then cut at the natural pause. Listening review is pending."
            ),
        }
    narration_manifest["schemaVersion"] = 2
    narration_manifest["generatedOn"] = date.today().isoformat()
    narration_manifest["engine"] = {
        "model": MODEL_ID,
        "modelRevision": MODEL_REVISION,
        "speaker": SPEAKER,
        "seed": BASE_SEED,
        "device": "cpu",
        "dtype": "float32",
        "attentionImplementation": "sdpa",
        "postProcessing": "Whole-master tempo 1.04x; no pitch shift.",
    }
    previous_latest_generation = narration_manifest.get("latestGeneration")
    previous_updated_jobs = (
        previous_latest_generation.get("updatedJobs", [])
        if isinstance(previous_latest_generation, dict)
        and previous_latest_generation.get("prosodyPreset") == PROSODY_PRESET
        else []
    )
    current_job_keys = {
        f"{animal}.{locale}"
        for animal in selected_animals
        for locale in selected_locales
    }
    if include_view_switch:
        current_job_keys.update(
            f"view-switch.{locale}" for locale in selected_locales
        )
    updated_jobs = sorted(
        {
            *(str(job) for job in previous_updated_jobs),
            *current_job_keys,
        }
    )
    narration_manifest["latestGeneration"] = {
        "model": MODEL_ID,
        "modelRevision": MODEL_REVISION,
        "speaker": SPEAKER,
        "baseSeed": BASE_SEED,
        "prosodyPreset": PROSODY_PRESET,
        "tempoPolicy": {
            "wholeMasterFactor": LIGHT_EXPLORATION_TEMPO_FACTOR,
            "pitchShiftSemitones": 0,
        },
        "updatedJobs": updated_jobs,
        "instructionSupport": (
            "CustomVoice Serena preserves the static-museum timbre; the light "
            "exploration feel comes from a subtle whole-master pace lift."
        ),
    }
    animal_phase_track_count = len(ANIMALS) * len(LOCALES) * len(KINDS)
    view_switch_track_count = len(LOCALES) * len(VIEW_SWITCH_KINDS)
    narration_manifest["continuousNarrationPolicy"] = {
        "guidedTrackCount": animal_phase_track_count + view_switch_track_count,
        "animalPhaseTrackCount": animal_phase_track_count,
        "animalLocaleMasterCount": len(ANIMALS) * len(LOCALES),
        "viewSwitchLocaleMasterCount": 2,
        "sampleRateHz": SAMPLE_RATE,
        "policy": (
            "Generate each animal and locale as one uninterrupted intro, "
            "transition and arrival master; normalize once; then encode three "
            "sample-aligned slices at natural pauses. Generate the two shared "
            "viewpoint lines as one additional master per locale and cut once."
        ),
        "evidenceDirectory": str(evidence_directory.relative_to(PROJECT)),
    }
    narration_manifest["note"] = (
        "The original production narration remains approved. Spinosaurus, "
        "Lystrosaurus, Baryonyx, Archaeopteryx, Carnotaurus and Anomalocaris "
        "are local bilingual review candidates, "
        "each cut from one continuous Serena master per locale. Their scripts, "
        "pronunciation, pacing and public distribution still require Leon's "
        "listening review."
    )
    if any(animal in REVIEW_ANIMALS for animal in selected_animals):
        narration_manifest["status"] = "production-approved-with-review-candidates"
        narration_manifest["publicDistributionDecision"] = (
            "approved-existing-production-only"
        )
    NARRATION_MANIFEST_PATH.write_text(
        json.dumps(narration_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    update_transition_durations(narration_manifest)

    merged_masters = {
        **previous_masters,
        **{
            f"{master['animalId']}.{master['locale']}": master
            for master in master_results
        },
    }
    merged_track_files = set(previous_evidence.get("updatedTrackFiles", []))
    merged_track_files.update(updated_track_files)
    evidence_manifest = {
        "status": "local-review-candidates",
        "generatedOn": date.today().isoformat(),
        "engine": {
            "model": MODEL_ID,
            "modelRevision": MODEL_REVISION,
            "speaker": SPEAKER,
            "device": "cpu",
            "dtype": "float32",
            "attentionImplementation": "sdpa",
            "baseSeed": BASE_SEED,
            "prosodyPreset": PROSODY_PRESET,
            "modelLoadSeconds": round(model_load_seconds, 3),
            "instructionSupport": (
                "CustomVoice Serena receives one complete text input per master; "
                "light exploration pacing is applied after generation."
            ),
        },
        "processing": {
            "sampleRateHz": SAMPLE_RATE,
            "channels": 1,
            "targetIntegratedLufs": -18,
            "maximumTruePeakDbtp": -1,
            "tempoPolicy": {
                "wholeMasterFactor": LIGHT_EXPLORATION_TEMPO_FACTOR,
                "pitchShiftSemitones": 0,
            },
            "boundaryMethod": (
                "Natural-pause detection near duration-weighted phase estimates, "
                "with exact sample indices and optional listened overrides."
            ),
            "normalizationPolicy": (
                "Normalize the uninterrupted master once, then encode every "
                "slice from that normalized PCM master."
            ),
        },
        "masters": [merged_masters[key] for key in sorted(merged_masters)],
        "updatedTrackFiles": sorted(merged_track_files),
    }
    evidence_manifest_path.write_text(
        json.dumps(evidence_manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


if __name__ == "__main__":
    main()
