"""Tracked deterministic audio helpers for onboarding narration.

This module intentionally contains no scripts or animal-specific content and
does not import the heavy Qwen runtime. It removes the old dependency on an
ignored collection-review script so linked worktrees execute the same code.
"""

from __future__ import annotations

import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess


MODEL_ID = "Qwen/Qwen3-TTS-12Hz-0.6B-CustomVoice"
MODEL_REVISION = "85e237c12c027371202489a0ec509ded67b5e4b5"
SEED = 20260726


def executable(name: str, known_path: str) -> Path:
    found = shutil.which(name)
    if found:
        return Path(found)
    candidate = Path(known_path)
    if candidate.is_file():
        return candidate
    raise FileNotFoundError(f"Required executable is missing: {name}")


FFMPEG = executable("ffmpeg", "/opt/homebrew/bin/ffmpeg")
FFPROBE = executable("ffprobe", "/opt/homebrew/bin/ffprobe")
SILENCE_PATTERN = re.compile(
    r"silence_(start|end):\s*([0-9.]+)(?:\s*\|\s*silence_duration:\s*([0-9.]+))?"
)


def file_sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        while chunk := source.read(1024 * 1024):
            digest.update(chunk)
    return digest.hexdigest()


def run(command: list[str]) -> subprocess.CompletedProcess[str]:
    return subprocess.run(
        command,
        check=True,
        capture_output=True,
        text=True,
    )


def last_json_object(output: str, description: str) -> dict[str, object]:
    json_start = output.rfind("{")
    if json_start < 0:
        raise RuntimeError(f"FFmpeg did not report JSON for {description}")
    parsed, _ = json.JSONDecoder().raw_decode(output[json_start:])
    if not isinstance(parsed, dict):
        raise RuntimeError(f"FFmpeg reported non-object JSON for {description}")
    return parsed


def ffprobe(path: Path) -> dict[str, object]:
    result = run(
        [
            str(FFPROBE),
            "-v",
            "error",
            "-show_entries",
            (
                "format=duration,size,bit_rate:"
                "stream=codec_name,codec_type,sample_rate,channels,"
                "channel_layout,bits_per_sample"
            ),
            "-of",
            "json",
            str(path),
        ]
    )
    return json.loads(result.stdout)


def loudness(path: Path) -> dict[str, float]:
    result = run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-nostats",
            "-i",
            str(path),
            "-af",
            "loudnorm=I=-18:TP=-1:LRA=7:print_format=json",
            "-f",
            "null",
            "-",
        ]
    )
    measured = last_json_object(result.stderr, f"loudness analysis of {path}")
    return {
        key: float(measured[key])
        for key in (
            "input_i",
            "input_tp",
            "input_lra",
            "input_thresh",
            "target_offset",
        )
    }


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


def boundary_trim(path: Path, duration: float) -> dict[str, float]:
    intervals = silence_intervals(path)
    leading_end = 0.0
    trailing_start = duration
    if intervals and intervals[0]["start"] <= 0.001:
        leading_end = intervals[0]["end"]
    if intervals and intervals[-1]["end"] >= duration - 0.03:
        trailing_start = intervals[-1]["start"]
    trim_start = max(0.0, leading_end - 0.10)
    trim_end = min(duration, trailing_start + 0.22)
    if trim_end <= trim_start:
        raise RuntimeError(f"Invalid trim interval for {path}: {trim_start}–{trim_end}")
    return {
        "trimStartSeconds": round(trim_start, 6),
        "trimEndSeconds": round(trim_end, 6),
        "retainedLeadingSilenceSeconds": round(leading_end - trim_start, 6),
        "retainedTrailingSilenceSeconds": round(trim_end - trailing_start, 6),
    }


def normalize(raw_path: Path, master_path: Path, mp3_path: Path) -> dict[str, object]:
    raw_probe = ffprobe(raw_path)
    raw_duration = float(raw_probe["format"]["duration"])  # type: ignore[index]
    trim = boundary_trim(raw_path, raw_duration)
    trim_filter = (
        f"atrim=start={trim['trimStartSeconds']}:end={trim['trimEndSeconds']},"
        "asetpts=PTS-STARTPTS,aresample=48000"
    )
    first_pass_result = run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-nostats",
            "-i",
            str(raw_path),
            "-af",
            f"{trim_filter},loudnorm=I=-18:TP=-1:LRA=7:print_format=json",
            "-f",
            "null",
            "-",
        ]
    )
    first_pass = last_json_object(
        first_pass_result.stderr,
        f"first-pass normalization of {raw_path}",
    )
    second_pass_filter = (
        f"{trim_filter},"
        "loudnorm=I=-18:TP=-1:LRA=7:"
        f"measured_I={first_pass['input_i']}:"
        f"measured_LRA={first_pass['input_lra']}:"
        f"measured_TP={first_pass['input_tp']}:"
        f"measured_thresh={first_pass['input_thresh']}:"
        f"offset={first_pass['target_offset']}:"
        "linear=true:print_format=summary"
    )
    run(
        [
            str(FFMPEG),
            "-hide_banner",
            "-y",
            "-i",
            str(raw_path),
            "-af",
            second_pass_filter,
            "-map_metadata",
            "-1",
            "-ar",
            "48000",
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
            "48000",
            "-ac",
            "1",
            "-c:a",
            "libmp3lame",
            "-b:a",
            "80k",
            str(mp3_path),
        ]
    )
    run(
        [
            str(FFMPEG),
            "-v",
            "error",
            "-i",
            str(mp3_path),
            "-f",
            "null",
            "-",
        ]
    )
    return {
        "boundaryTreatment": trim,
        "loudnormTarget": {
            "integratedLufs": -18,
            "truePeakDbtp": -1,
            "loudnessRangeLu": 7,
        },
        "loudnormFirstPass": {
            "inputIntegratedLufs": float(first_pass["input_i"]),
            "inputTruePeakDbtp": float(first_pass["input_tp"]),
            "inputLoudnessRangeLu": float(first_pass["input_lra"]),
            "inputThresholdLufs": float(first_pass["input_thresh"]),
            "targetOffsetLu": float(first_pass["target_offset"]),
        },
        "secondPassFilter": second_pass_filter,
    }


def artifact_metrics(path: Path) -> dict[str, object]:
    probe = ffprobe(path)
    stream = probe["streams"][0]  # type: ignore[index]
    format_metrics = probe["format"]  # type: ignore[index]
    level = loudness(path)
    intervals = silence_intervals(path)
    duration = float(format_metrics["duration"])
    leading = (
        intervals[0]["duration"]
        if intervals and intervals[0]["start"] <= 0.001
        else 0.0
    )
    trailing = (
        intervals[-1]["duration"]
        if intervals and intervals[-1]["end"] >= duration - 0.03
        else 0.0
    )
    return {
        "path": path.name,
        "sha256": file_sha256(path),
        "bytes": path.stat().st_size,
        "durationSeconds": duration,
        "codec": stream["codec_name"],
        "sampleRateHz": int(stream["sample_rate"]),
        "channels": int(stream["channels"]),
        "channelLayout": stream.get("channel_layout"),
        "bitsPerSample": int(stream.get("bits_per_sample", 0)),
        "bitRateBps": int(format_metrics.get("bit_rate", 0)),
        "integratedLufs": level["input_i"],
        "truePeakDbtp": level["input_tp"],
        "loudnessRangeLu": level["input_lra"],
        "leadingSilenceSeconds": round(leading, 6),
        "trailingSilenceSeconds": round(trailing, 6),
        "decodedSuccessfully": True,
    }
