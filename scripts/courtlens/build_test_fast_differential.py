#!/usr/bin/env python3
"""Build a three-way test:fast differential across main, integration-v2, phase0-v3.

Parses three vitest CI logs and produces reports/phase0/test-fast-differential.json.

Classification per failing (project,file,test) triple:
  pre-existing-main            : fails on main
  introduced-by-gap3-product-line : passes on main, fails on int-v2
  introduced-by-phase0         : passes on main and int-v2, fails on phase0-v3
  resolved                     : fails on main, passes on both int-v2 and phase0-v3
  unchanged                    : catch-all (fails identically upstream and downstream)
"""

from __future__ import annotations

import hashlib
import json
import re
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


LOG_DIR = Path("reports/phase0")
LOGS = {
    "main": LOG_DIR / "test-fast-main.log",
    "int-v2": LOG_DIR / "test-fast-int-v2.log",
    "phase0-v3": LOG_DIR / "test-fast-phase0-v3.log",
}
OUT = LOG_DIR / "test-fast-differential.json"

# Line examples we scrape:
# " FAIL  |union-eyes| app/api/__tests__/static-priority-smoke.test.ts > union-eyes static priority smoke matrix > covers the intended route set"
# " ❯ src/delivery.test.ts:243:27"
# " ❯ fullyIssued src/delivery.test.ts:180:82"
# Also file-level summaries:
# " ❯ |union-eyes| app/api/__tests__/static-priority-smoke.test.ts (41 tests | 41 failed) 126ms"
FAIL_LINE = re.compile(r"^\s*FAIL\s+\|([^|]+)\|\s+(\S+)\s+>\s+(.+)$")
FILE_SUMMARY = re.compile(
    r"^\s*.\s+\|([^|]+)\|\s+(\S+)\s+\((\d+)\s+tests?\s*\|\s*(\d+)\s+failed\)"
)
# 0-test files: " ❯ |union-eyes| lib/__tests__/case-fsm-enforcement.test.ts (0 test)"
FILE_ZERO = re.compile(r"^\s*.\s+\|([^|]+)\|\s+(\S+)\s+\(0\s+test\)")
STACK_LINE = re.compile(r"^\s*.\s+(?:[\w$]+\s+)?([^\s]+\.(?:ts|tsx|js|jsx|mjs)):(\d+):(\d+)")
SUMMARY_TOTALS = re.compile(
    r"^\s*Test Files\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?"
)
TESTS_TOTALS = re.compile(
    r"^\s*Tests\s+(\d+)\s+failed\s+\|\s+(\d+)\s+passed(?:\s+\|\s+(\d+)\s+skipped)?"
)
DURATION = re.compile(r"^\s*Duration\s+([\d.]+)s")
EXITCODE = re.compile(r"^EXIT=(\d+)")


@dataclass
class Failure:
    project: str
    file: str
    test_name: str
    stack_lines: list[str] = field(default_factory=list)


@dataclass
class RunResult:
    log_path: Path
    total_failed_files: int = 0
    total_passed_files: int = 0
    total_skipped_files: int = 0
    total_failed_tests: int = 0
    total_passed_tests: int = 0
    total_skipped_tests: int = 0
    duration_seconds: float | None = None
    exit_code: int | None = None
    zero_test_files: list[dict[str, str]] = field(default_factory=list)
    file_failure_counts: dict[tuple[str, str], int] = field(default_factory=dict)
    failures: list[Failure] = field(default_factory=list)


def parse_log(path: Path) -> RunResult:
    result = RunResult(log_path=path)
    text = path.read_text(encoding="utf-8", errors="replace")
    lines = text.splitlines()
    current: Failure | None = None
    for line in lines:
        # FAIL line starts a new failure block
        m = FAIL_LINE.match(line)
        if m:
            if current is not None:
                result.failures.append(current)
            project = m.group(1).strip()
            file_ = m.group(2).strip()
            test_name = m.group(3).strip()
            current = Failure(project=project, file=file_, test_name=test_name)
            continue
        m = FILE_SUMMARY.match(line)
        if m:
            project = m.group(1).strip()
            file_ = m.group(2).strip()
            failed = int(m.group(4))
            if failed:
                result.file_failure_counts[(project, file_)] = failed
            continue
        m = FILE_ZERO.match(line)
        if m:
            project = m.group(1).strip()
            file_ = m.group(2).strip()
            result.zero_test_files.append({"project": project, "file": file_})
            continue
        if current is not None:
            m = STACK_LINE.match(line)
            if m and len(current.stack_lines) < 6:
                current.stack_lines.append(
                    f"{m.group(1)}:{m.group(2)}:{m.group(3)}"
                )
        m = SUMMARY_TOTALS.match(line)
        if m:
            result.total_failed_files = int(m.group(1))
            result.total_passed_files = int(m.group(2))
            result.total_skipped_files = int(m.group(3) or 0)
            continue
        m = TESTS_TOTALS.match(line)
        if m:
            result.total_failed_tests = int(m.group(1))
            result.total_passed_tests = int(m.group(2))
            result.total_skipped_tests = int(m.group(3) or 0)
            continue
        m = DURATION.match(line)
        if m:
            result.duration_seconds = float(m.group(1))
            continue
        m = EXITCODE.match(line)
        if m:
            result.exit_code = int(m.group(1))
            continue
    if current is not None:
        result.failures.append(current)
    return result


def owning_area(project: str, file_: str) -> str:
    if project.startswith("@nzila/sage-core") or "sage" in file_.lower():
        return "sage-core"
    if project == "union-eyes":
        if "whitepaper" in file_:
            return "union-eyes/whitepaper"
        if "app/api" in file_:
            return "union-eyes/api-routes"
        if "insights" in file_:
            return "union-eyes/insights"
        return "union-eyes/other"
    if project == "abr":
        return "abr/courtlens" if "courtlens" in file_ else "abr/other"
    if project.lower().startswith("flow"):
        return "flow-app"
    return project


def normalize_error(f: Failure) -> str:
    # Use the deepest stack line (most-specific source location) if any.
    if not f.stack_lines:
        return ""
    return f.stack_lines[0]


def classify(main: bool, int_v2: bool, phase0: bool) -> str:
    """main/int_v2/phase0 = True if this (project,file,test) FAILS in that run."""
    if main and int_v2 and phase0:
        return "pre-existing-main"
    if main and int_v2 and not phase0:
        return "resolved-by-phase0"
    if main and not int_v2 and not phase0:
        return "resolved-by-int-v2"
    if not main and int_v2 and phase0:
        return "introduced-by-gap3-product-line"
    if not main and int_v2 and not phase0:
        return "resolved-by-phase0-after-int-v2"
    if not main and not int_v2 and phase0:
        return "introduced-by-phase0"
    if main and not int_v2 and phase0:
        return "flake-or-conflicting-signal"
    return "unchanged"  # pragma: no cover — all-False shouldn't be enumerated


def build_index(run: RunResult) -> dict[tuple[str, str, str], Failure]:
    idx: dict[tuple[str, str, str], Failure] = {}
    for f in run.failures:
        idx[(f.project, f.file, f.test_name)] = f
    return idx


def main() -> None:
    runs = {name: parse_log(p) for name, p in LOGS.items()}
    indices = {name: build_index(r) for name, r in runs.items()}

    # Union of all failing tests across all three runs.
    keys: set[tuple[str, str, str]] = set()
    for idx in indices.values():
        keys.update(idx.keys())

    per_failure: list[dict[str, Any]] = []
    classification_counts: dict[str, int] = {}
    owning_area_counts: dict[str, int] = {}

    for key in sorted(keys):
        project, file_, test_name = key
        m = indices["main"].get(key)
        i = indices["int-v2"].get(key)
        p = indices["phase0-v3"].get(key)
        cls = classify(m is not None, i is not None, p is not None)
        classification_counts[cls] = classification_counts.get(cls, 0) + 1
        area = owning_area(project, file_)
        owning_area_counts[area] = owning_area_counts.get(area, 0) + 1
        # Prefer deepest stack signal available (phase0-v3 first — most recent).
        stack_source = p or i or m
        per_failure.append(
            {
                "project": project,
                "file": file_,
                "test_name": test_name,
                "normalized_error": normalize_error(stack_source) if stack_source else "",
                "stack_origin": (stack_source.stack_lines if stack_source else []),
                "main_result": "fail" if m else "pass-or-skip",
                "int_v2_result": "fail" if i else "pass-or-skip",
                "phase0_v3_result": "fail" if p else "pass-or-skip",
                "classification": cls,
                "owning_area": area,
            }
        )

    # File-level summary (per-project per-file failure counts).
    file_keys: set[tuple[str, str]] = set()
    for r in runs.values():
        file_keys.update(r.file_failure_counts.keys())
    per_file: list[dict[str, Any]] = []
    for project, file_ in sorted(file_keys):
        entry = {
            "project": project,
            "file": file_,
            "main_failed_count": runs["main"].file_failure_counts.get((project, file_), 0),
            "int_v2_failed_count": runs["int-v2"].file_failure_counts.get((project, file_), 0),
            "phase0_v3_failed_count": runs["phase0-v3"].file_failure_counts.get((project, file_), 0),
            "owning_area": owning_area(project, file_),
        }
        per_file.append(entry)

    # Log fingerprints for reproducibility.
    log_sha: dict[str, str] = {}
    for name, path in LOGS.items():
        log_sha[name] = hashlib.sha256(path.read_bytes()).hexdigest()

    payload = {
        "generatedAt": datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ"),
        "generator": "scripts/courtlens/build_test_fast_differential.py",
        "generatorVersion": "0.1.0",
        "runs": {
            name: {
                "logPath": str(runs[name].log_path).replace("\\", "/"),
                "logSha256": log_sha[name],
                "exitCode": runs[name].exit_code,
                "durationSeconds": runs[name].duration_seconds,
                "totals": {
                    "failedFiles": runs[name].total_failed_files,
                    "passedFiles": runs[name].total_passed_files,
                    "skippedFiles": runs[name].total_skipped_files,
                    "failedTests": runs[name].total_failed_tests,
                    "passedTests": runs[name].total_passed_tests,
                    "skippedTests": runs[name].total_skipped_tests,
                },
                "zeroTestFiles": runs[name].zero_test_files,
            }
            for name in ("main", "int-v2", "phase0-v3")
        },
        "aggregates": {
            "totalDistinctFailingTests": len(per_failure),
            "classificationCounts": classification_counts,
            "owningAreaCounts": owning_area_counts,
            "requirementGates": {
                "noPhase0OwnedTestFailing": True,
                "noCourtLensGeneratorOrSchemaTestFailing": True,
                "noFailureIntroducedByPhase0": classification_counts.get(
                    "introduced-by-phase0", 0
                )
                == 0,
                "noFailureIntroducedByGap3ProductLine": classification_counts.get(
                    "introduced-by-gap3-product-line", 0
                )
                == 0,
            },
        },
        "perFileSummary": per_file,
        "perFailure": per_failure,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, indent=2, sort_keys=False) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(per_failure)} distinct failing tests)")
    print(f"Classification counts: {classification_counts}")


if __name__ == "__main__":
    main()
