"""Tests for the CourtLens review-ledger generator (Phase 0).

Verifies that Phase 1 candidate accounting is a strict subset of the
full inventory — the total row count is NOT the Phase 1 count.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from scripts.courtlens.build_review_ledger import (
    ENTRY_FIELDS,
    PHASE_1_LABEL,
    SCHEMA_VERSION,
    build_entries,
    build_ledger,
    compute_metrics,
    read_csv_rows,
)

# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------


CSV_HEADER = (
    "legacyPath,category,disposition,phase,targetPath,"
    "usesBase44,usesUpload,usesAppLanguageContext,"
    "securityNotes,dependencyOfPath,notes"
)


def _make_row(
    legacy_path: str,
    disposition: str,
    phase: str = "",
    target: str = "",
) -> str:
    return f"{legacy_path},cat,{disposition},{phase},{target}," "false,false,false,,,"


@pytest.fixture()
def synthetic_csv(tmp_path: Path) -> Path:
    """CSV with a KNOWN small inventory:
    - 5 total rows
    - 2 port at Phase 1  (Phase 1 candidates)
    - 1 port at Phase 2  (NOT a Phase 1 candidate)
    - 1 defer            (NOT a Phase 1 candidate)
    - 1 review-required  (NOT a Phase 1 candidate)
    """

    csv_path = tmp_path / "inventory.csv"
    lines = [
        CSV_HEADER,
        _make_row("src/a.jsx", "port", "1", "apps/abr/a.tsx"),
        _make_row("src/b.jsx", "port", "1", "apps/abr/b.tsx"),
        _make_row("src/c.jsx", "port", "2", "apps/abr/c.tsx"),
        _make_row("src/d.jsx", "defer", "", ""),
        _make_row("src/e.jsx", "review-required", "", ""),
    ]
    csv_path.write_text("\n".join(lines) + "\n", encoding="utf-8")
    return csv_path


# ---------------------------------------------------------------------------
# Metric semantics: Phase 1 candidate count != row count
# ---------------------------------------------------------------------------


def test_phase1_candidates_not_equal_to_total(synthetic_csv: Path) -> None:
    rows = read_csv_rows(synthetic_csv)
    entries = build_entries(rows, {})
    metrics = compute_metrics(entries)

    # Total inventory is 5, but only 2 rows are Phase 1 candidates.
    # This is the exact regression guard the CourtLens directive requires:
    # "Do not classify all rows as Phase 1 candidates."
    assert metrics["rowCount"] == 5
    assert metrics["phase1Metrics"]["phase1PortCandidates"] == 2
    assert metrics["phase1Metrics"]["phase1PortCandidates"] < metrics["rowCount"]


def test_phase1_candidate_definition_is_strict(synthetic_csv: Path) -> None:
    """port@phase2 and defer@phase1(illegal) must never count as Phase 1."""

    rows = read_csv_rows(synthetic_csv)
    entries = build_entries(rows, {})
    metrics = compute_metrics(entries)

    # port@2 exists in the fixture but must be excluded.
    port_rows = [e for e in entries if e["proposedDisposition"] == "port"]
    assert len(port_rows) == 3  # all port rows
    phase1_rows = [e for e in port_rows if e["proposedPhase"] == PHASE_1_LABEL]
    assert len(phase1_rows) == 2
    assert metrics["phase1Metrics"]["phase1PortCandidates"] == len(phase1_rows)


def test_disposition_counts_sum_to_row_count(synthetic_csv: Path) -> None:
    rows = read_csv_rows(synthetic_csv)
    entries = build_entries(rows, {})
    metrics = compute_metrics(entries)
    assert sum(metrics["dispositionCounts"].values()) == metrics["rowCount"]


def test_reviewed_and_unreviewed_sum_to_row_count(synthetic_csv: Path) -> None:
    rows = read_csv_rows(synthetic_csv)
    entries = build_entries(rows, {})
    metrics = compute_metrics(entries)
    assert metrics["reviewedCount"] + metrics["unreviewedCount"] == metrics["rowCount"]


# ---------------------------------------------------------------------------
# Phase 1 reviewed / approved / unresolved semantics
# ---------------------------------------------------------------------------


def test_phase1_reviewed_and_approved_track_independently(
    synthetic_csv: Path,
) -> None:
    rows = read_csv_rows(synthetic_csv)
    # Prior ledger: src/a.jsx reviewed+approved-as-port@1; src/b.jsx
    # reviewed but downgraded to defer (so approved but NOT phase1-approved).
    prior = {
        "src/a.jsx": {
            "legacyPath": "src/a.jsx",
            "reviewed": True,
            "approvedDisposition": "port",
            "approvedPhase": "1",
            "approvedTargetPath": "apps/abr/a.tsx",
            "reviewer": "@octocat",
            "reviewedAt": "2026-07-19T00:00:00Z",
            "notes": "approved",
        },
        "src/b.jsx": {
            "legacyPath": "src/b.jsx",
            "reviewed": True,
            "approvedDisposition": "defer",
            "approvedPhase": None,
            "approvedTargetPath": None,
            "reviewer": "@octocat",
            "reviewedAt": "2026-07-19T00:00:00Z",
            "notes": "downgraded from port to defer",
        },
    }
    entries = build_entries(rows, prior)
    metrics = compute_metrics(entries)

    p1 = metrics["phase1Metrics"]
    assert p1["phase1PortCandidates"] == 2  # a and b are both proposed port@1
    assert p1["phase1Reviewed"] == 2  # both reviewed
    assert p1["phase1Approved"] == 1  # only a stayed port@1
    assert p1["phase1Unresolved"] == 0  # both reviewed


def test_phase1_unresolved_counts_only_unreviewed_candidates(
    synthetic_csv: Path,
) -> None:
    rows = read_csv_rows(synthetic_csv)
    # Only 'a' reviewed & approved. 'b' still unreviewed.
    prior = {
        "src/a.jsx": {
            "legacyPath": "src/a.jsx",
            "reviewed": True,
            "approvedDisposition": "port",
            "approvedPhase": "1",
            "approvedTargetPath": "apps/abr/a.tsx",
            "reviewer": "@octocat",
            "reviewedAt": "2026-07-19T00:00:00Z",
            "notes": "approved",
        },
    }
    entries = build_entries(rows, prior)
    metrics = compute_metrics(entries)

    p1 = metrics["phase1Metrics"]
    assert p1["phase1PortCandidates"] == 2
    assert p1["phase1Reviewed"] == 1
    assert p1["phase1Approved"] == 1
    assert p1["phase1Unresolved"] == 1


# ---------------------------------------------------------------------------
# Ledger shape
# ---------------------------------------------------------------------------


def test_ledger_entry_fields_are_stable(synthetic_csv: Path) -> None:
    rows = read_csv_rows(synthetic_csv)
    ledger = build_ledger(rows, manifest=None, prior_entries={})
    assert ledger["schemaVersion"] == SCHEMA_VERSION
    for entry in ledger["entries"]:
        assert tuple(entry.keys()) == ENTRY_FIELDS


def test_ledger_carries_manifest_csv_body_sha(synthetic_csv: Path) -> None:
    rows = read_csv_rows(synthetic_csv)
    ledger = build_ledger(
        rows,
        manifest={
            "generatorVersion": "9.9.9",
            "csvBodySha256": "deadbeef",
        },
        prior_entries={},
    )
    assert ledger["csvBodySha256"] == "deadbeef"
    assert ledger["generatorVersion"] == "9.9.9"


def test_ledger_is_deterministic(synthetic_csv: Path) -> None:
    rows = read_csv_rows(synthetic_csv)
    a = build_ledger(rows, manifest=None, prior_entries={})
    b = build_ledger(rows, manifest=None, prior_entries={})
    assert json.dumps(a, sort_keys=False) == json.dumps(b, sort_keys=False)


# ---------------------------------------------------------------------------
# Guard: Phase 1 count never == row count when defer/discard rows exist
# ---------------------------------------------------------------------------


def test_phase1_count_smaller_than_total_when_non_port_rows_present(
    tmp_path: Path,
) -> None:
    csv_path = tmp_path / "invalid.csv"
    csv_path.write_text(
        "\n".join(
            [
                CSV_HEADER,
                _make_row("src/p.jsx", "port", "1", "apps/abr/p.tsx"),
                _make_row("src/q.jsx", "defer", "", ""),
                _make_row("src/r.jsx", "discard", "", ""),
            ]
        )
        + "\n",
        encoding="utf-8",
    )
    rows = read_csv_rows(csv_path)
    metrics = compute_metrics(build_entries(rows, {}))
    assert metrics["rowCount"] == 3
    assert metrics["phase1Metrics"]["phase1PortCandidates"] == 1
    assert (
        metrics["phase1Metrics"]["phase1PortCandidates"] < metrics["rowCount"]
    ), "Phase 1 candidate count must never equal the total inventory rows."
