#!/usr/bin/env python3
"""
CourtLens Phase 0 review-ledger generator.

Reads ``docs/courtlens/legacy-inventory.csv`` and emits
``docs/courtlens/legacy-inventory-review.json`` — a per-row human-review
ledger. Every row from the CSV appears as one ledger entry.

The ledger also carries an explicit ``phase1Metrics`` block so that
consumers never conflate the *inventory total* (all rows) with the
*Phase 1 candidate set* (rows whose proposed disposition is ``port``
AND proposed phase is ``PHASE_1_LABEL``).

Metrics reported (per the CourtLens directive):

* ``rowCount``               — total inventory rows.
* ``reviewedCount``          — entries with ``reviewed: true``.
* ``unreviewedCount``        — entries with ``reviewed: false``.
* ``dispositionCounts``      — counts by proposed disposition.
* ``phase1Metrics``:
    * ``phase1PortCandidates`` — proposed port at Phase 1 (the ONLY
      valid definition of a Phase 1 candidate).
    * ``phase1Reviewed``       — Phase 1 candidates that are ``reviewed``.
    * ``phase1Approved``       — Phase 1 candidates approved as port at
      Phase 1 (both approvedDisposition and approvedPhase match).
    * ``phase1Unresolved``     — Phase 1 candidates still unreviewed.

Usage::

    python scripts/courtlens/build_review_ledger.py \\
        --csv docs/courtlens/legacy-inventory.csv \\
        --manifest docs/courtlens/legacy-inventory.manifest.json \\
        --existing docs/courtlens/legacy-inventory-review.json \\
        --out docs/courtlens/legacy-inventory-review.json
"""

from __future__ import annotations

import argparse
import csv
import json
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Any

# Kept in sync with build_legacy_inventory.py. This is the ONLY valid
# encoding of Phase 1 in the ``phase`` column.
PHASE_1_LABEL = "1"

SCHEMA_VERSION = 1

# Fields on each ledger entry.
ENTRY_FIELDS: tuple[str, ...] = (
    "legacyPath",
    "proposedDisposition",
    "proposedPhase",
    "proposedTargetPath",
    "reviewed",
    "approvedDisposition",
    "approvedPhase",
    "approvedTargetPath",
    "reviewer",
    "reviewedAt",
    "notes",
)


@dataclass(frozen=True)
class CsvRow:
    legacyPath: str
    disposition: str
    phase: str
    targetPath: str


def read_csv_rows(csv_path: Path) -> list[CsvRow]:
    with csv_path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        rows = [
            CsvRow(
                legacyPath=r["legacyPath"],
                disposition=r["disposition"],
                phase=r["phase"],
                targetPath=r["targetPath"],
            )
            for r in reader
        ]
    return sorted(rows, key=lambda r: r.legacyPath)


def load_existing(path: Path) -> dict[str, dict[str, Any]]:
    """Read prior ledger entries keyed by legacyPath for review-state carry."""

    if not path.exists():
        return {}
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}
    entries = data.get("entries") or []
    return {entry["legacyPath"]: entry for entry in entries if "legacyPath" in entry}


def _blank_review_fields() -> dict[str, Any]:
    return {
        "reviewed": False,
        "approvedDisposition": None,
        "approvedPhase": None,
        "approvedTargetPath": None,
        "reviewer": None,
        "reviewedAt": None,
        "notes": "",
    }


def _carry_review_fields(prior: dict[str, Any]) -> dict[str, Any]:
    """Preserve only the human review-state fields; proposed* is refreshed."""

    return {
        "reviewed": bool(prior.get("reviewed", False)),
        "approvedDisposition": prior.get("approvedDisposition"),
        "approvedPhase": prior.get("approvedPhase"),
        "approvedTargetPath": prior.get("approvedTargetPath"),
        "reviewer": prior.get("reviewer"),
        "reviewedAt": prior.get("reviewedAt"),
        "notes": prior.get("notes", "") or "",
    }


def build_entries(
    csv_rows: list[CsvRow],
    prior_entries: dict[str, dict[str, Any]],
) -> list[dict[str, Any]]:
    entries: list[dict[str, Any]] = []
    for row in csv_rows:
        prior = prior_entries.get(row.legacyPath)
        review_state = _carry_review_fields(prior) if prior else _blank_review_fields()
        entry: dict[str, Any] = {
            "legacyPath": row.legacyPath,
            "proposedDisposition": row.disposition,
            "proposedPhase": row.phase,
            "proposedTargetPath": row.targetPath,
        }
        entry.update(review_state)
        # Enforce field order for deterministic output.
        entries.append({k: entry[k] for k in ENTRY_FIELDS})
    return entries


def _is_phase1_candidate(entry: dict[str, Any]) -> bool:
    """The ONLY valid definition of a Phase 1 candidate."""

    return (
        entry["proposedDisposition"] == "port"
        and entry["proposedPhase"] == PHASE_1_LABEL
    )


def compute_metrics(entries: list[dict[str, Any]]) -> dict[str, Any]:
    disposition_counts: dict[str, int] = {}
    reviewed_count = 0
    phase1_port = 0
    phase1_reviewed = 0
    phase1_approved = 0
    phase1_unresolved = 0

    for entry in entries:
        disp = entry["proposedDisposition"]
        disposition_counts[disp] = disposition_counts.get(disp, 0) + 1
        if entry["reviewed"]:
            reviewed_count += 1

        if _is_phase1_candidate(entry):
            phase1_port += 1
            if entry["reviewed"]:
                phase1_reviewed += 1
                if (
                    entry["approvedDisposition"] == "port"
                    and entry["approvedPhase"] == PHASE_1_LABEL
                ):
                    phase1_approved += 1
            else:
                phase1_unresolved += 1

    return {
        "rowCount": len(entries),
        "reviewedCount": reviewed_count,
        "unreviewedCount": len(entries) - reviewed_count,
        "dispositionCounts": dict(sorted(disposition_counts.items())),
        "phase1Metrics": {
            "phase1PortCandidates": phase1_port,
            "phase1Reviewed": phase1_reviewed,
            "phase1Approved": phase1_approved,
            "phase1Unresolved": phase1_unresolved,
        },
    }


def build_ledger(
    csv_rows: list[CsvRow],
    manifest: dict[str, Any] | None,
    prior_entries: dict[str, dict[str, Any]],
) -> dict[str, Any]:
    entries = build_entries(csv_rows, prior_entries)
    metrics = compute_metrics(entries)
    ledger: dict[str, Any] = {
        "schemaVersion": SCHEMA_VERSION,
        "generatedFrom": "docs/courtlens/legacy-inventory.csv",
        "generatorVersion": (manifest or {}).get("generatorVersion", "0.2.0"),
        "csvBodySha256": (manifest or {}).get("csvBodySha256", ""),
        "rowCount": metrics["rowCount"],
        "reviewedCount": metrics["reviewedCount"],
        "unreviewedCount": metrics["unreviewedCount"],
        "dispositionCounts": metrics["dispositionCounts"],
        "phase1Metrics": metrics["phase1Metrics"],
        "entries": entries,
    }
    return ledger


def write_ledger(ledger: dict[str, Any], out_path: Path) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text(
        json.dumps(ledger, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", type=Path, required=True)
    parser.add_argument("--manifest", type=Path, default=None)
    parser.add_argument(
        "--existing",
        type=Path,
        default=None,
        help="Existing ledger to carry reviewed-state from.",
    )
    parser.add_argument("--out", type=Path, required=True)
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    if not args.csv.exists():
        print(f"error: CSV not found: {args.csv}", file=sys.stderr)
        return 1
    manifest: dict[str, Any] | None = None
    if args.manifest and args.manifest.exists():
        try:
            manifest = json.loads(args.manifest.read_text(encoding="utf-8"))
        except json.JSONDecodeError as exc:
            print(f"error: manifest is not valid JSON: {exc}", file=sys.stderr)
            return 1

    prior_entries = load_existing(args.existing) if args.existing else {}
    csv_rows = read_csv_rows(args.csv)
    ledger = build_ledger(csv_rows, manifest, prior_entries)
    write_ledger(ledger, args.out)

    p1 = ledger["phase1Metrics"]
    print(
        f"Wrote {ledger['rowCount']} ledger entries to {args.out}. "
        f"Phase 1 candidates: port={p1['phase1PortCandidates']}, "
        f"reviewed={p1['phase1Reviewed']}, approved={p1['phase1Approved']}, "
        f"unresolved={p1['phase1Unresolved']}."
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
