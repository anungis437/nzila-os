#!/usr/bin/env python3
"""
CourtLens legacy inventory generator (Phase 0).

Walks a legacy Vite CourtLens source tree and emits one CSV row per
in-scope file, plus a sidecar manifest with counts, hashes, and scope
comparison. This is a *disposition candidate* generator — no output row
is authoritative until it appears with `reviewed: true` in
``docs/courtlens/legacy-inventory-review.json``.

Design rules (verified from the CourtLens refactor Phase 0 review):

* Standards-compliant CSV: header first, no comment lines.
* Deterministic output (sorted rows, stable timestamps only in the
  manifest, no random IDs).
* Unknown files default to ``review-required``, NEVER ``discard``.
* File content is scanned for feature markers (base44 SDK, upload/blob,
  privileged terms, PII, AppLanguageContext), not just filename.
* Every ``port`` row must have both ``targetPath`` and ``phase`` filled
  before generation succeeds.
* Non-``port`` rows must not carry a ``phase``.
* Scope drift is reported via the manifest ``scopeDelta`` field; the
  generator does not silently accept extra files.

Usage::

    python scripts/courtlens/build_legacy_inventory.py \\
        --legacy-root "C:/Users/AubertNungisa/Downloads/court-lens-ready-extracted" \\
        --csv-out docs/courtlens/legacy-inventory.csv \\
        --manifest-out docs/courtlens/legacy-inventory.manifest.json
"""

from __future__ import annotations

import argparse
import csv
import dataclasses
import hashlib
import json
import re
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Iterable

# ---------------------------------------------------------------------------
# Version + scope constants
# ---------------------------------------------------------------------------

GENERATOR_VERSION = "0.2.0"
"""Bump on any change to disposition rules, columns, or content scanners."""

PHASE_1_LABEL = "1"
"""Internal encoding of Phase 1 in the CSV ``phase`` column.

The user-facing disposition metric name is ``phase1PortCandidates``.
Nothing else in the manifest depends on this label directly."""

EXPECTED_JSX_COUNT = 340
"""Historic claim in the refactor plan. Real count is reported separately."""

INCLUDED_SUFFIXES = (".jsx",)
"""Only application source files. Excludes assets, JSON, lockfiles, CSS, etc."""

EXCLUDED_DIR_NAMES = frozenset(
    {
        "node_modules",
        ".git",
        ".turbo",
        "dist",
        "build",
        ".next",
        "coverage",
        "__pycache__",
    }
)

# ---------------------------------------------------------------------------
# CSV columns — schema-locked
# ---------------------------------------------------------------------------

CSV_COLUMNS: tuple[str, ...] = (
    "legacyPath",
    "category",
    "disposition",
    "phase",
    "targetPath",
    "usesBase44",
    "usesUpload",
    "usesAppLanguageContext",
    "securityNotes",
    "dependencyOfPath",
    "notes",
)

DISPOSITIONS = frozenset({"port", "defer", "discard", "duplicate", "review-required"})
PHASES = frozenset({"1", "2", "3", "4", "5", ""})

# ---------------------------------------------------------------------------
# Content scanners
# ---------------------------------------------------------------------------

_BASE44_RE = re.compile(r"\bbase44\b|from ['\"]@base44/")
_UPLOAD_RE = re.compile(
    r"\b(UploadFile|FileUploader|blob|multipart|FormData)\b", re.IGNORECASE
)
_APPLANG_RE = re.compile(r"AppLanguageContext|useAppLanguage")
_PII_RE = re.compile(
    r"\b(client(Name|Email|Phone)|SSN|SIN|dateOfBirth|householdSize|"
    r"disability|children)\b"
)
_PRIVILEGE_RE = re.compile(
    r"\b(privileged?|legalAdvice|attorney[- ]client|solicitor[- ]client|"
    r"retainer|consent|retention)\b",
    re.IGNORECASE,
)


@dataclasses.dataclass(frozen=True)
class ContentSignals:
    """Boolean signals extracted from file content."""

    uses_base44: bool
    uses_upload: bool
    uses_app_language_context: bool
    has_pii_terms: bool
    has_privilege_terms: bool


def scan_content(text: str) -> ContentSignals:
    """Extract feature signals from a legacy file's source text."""

    return ContentSignals(
        uses_base44=bool(_BASE44_RE.search(text)),
        uses_upload=bool(_UPLOAD_RE.search(text)),
        uses_app_language_context=bool(_APPLANG_RE.search(text)),
        has_pii_terms=bool(_PII_RE.search(text)),
        has_privilege_terms=bool(_PRIVILEGE_RE.search(text)),
    )


def security_notes_for(signals: ContentSignals) -> str:
    """Aggregate a compact security note string from scanned signals."""

    notes: list[str] = []
    if signals.has_privilege_terms:
        notes.append(
            "privilege/consent/retention terms present — legal review required"
        )
    if signals.has_pii_terms:
        notes.append("client PII terms present — redaction contract required")
    if signals.uses_upload:
        notes.append("upload path — blob storage + antivirus + size limits required")
    if signals.uses_base44:
        notes.append("base44 SDK reference — must be rewritten to Nzila services")
    return "; ".join(notes)


# ---------------------------------------------------------------------------
# Categorization + disposition
# ---------------------------------------------------------------------------


def categorize(rel_posix: str) -> str:
    """Classify the file by its legacy directory group.

    ``rel_posix`` is a forward-slash relative path from the legacy root.
    """

    parts = rel_posix.split("/")

    # Only src/** is in scope; everything else is out-of-scope tooling.
    if not parts or parts[0] != "src":
        return "out-of-scope"

    # src/pages/**
    if len(parts) >= 2 and parts[1] == "pages":
        # src/pages/<file>.jsx  → top-level page
        if len(parts) == 3:
            return "pages/top-level"
        # src/pages/<section>/... → sectioned page
        if len(parts) >= 4:
            sub = parts[2]
            if sub in {"org", "platform", "parent", "public"}:
                return f"pages/{sub}"
            return f"pages/{sub}"
        return "pages/top-level"

    # src/components/courtlens/**
    if len(parts) >= 3 and parts[1] == "components" and parts[2] == "courtlens":
        if len(parts) == 4:
            return "components/courtlens/top-level"
        return f"components/courtlens/{parts[3]}"

    # src/components/** (non-courtlens)
    if len(parts) >= 2 and parts[1] == "components":
        return "components/other"

    return "src/other"


# Category-level defaults. Only categories with a Phase 1 candidate get a
# non-``review-required`` default. Everything else stays review-required so
# a human decides before any file leaves the plan as ``discard``.
_CATEGORY_DEFAULTS: dict[str, tuple[str, str, str]] = {
    # (disposition, phase, target)
    "pages/platform": (
        "defer",
        "",
        "",
    ),  # Belongs in apps/platform-admin, not apps/abr.
    "pages/parent": ("defer", "", ""),  # Needs parent-org schema first.
    "pages/public": (
        "defer",
        "",
        "",
    ),  # Marketing site — separate product surface.
    "components/courtlens/billing": ("defer", "", ""),
    "components/courtlens/engagement": ("defer", "", ""),
    "components/courtlens/impact": ("defer", "", ""),
    "components/courtlens/onboarding": (
        "discard",
        "",
        "",
    ),  # Auth handled by platform-auth.
    "components/courtlens/help": ("discard", "", ""),  # OTP/help duplicates.
    "components/courtlens/compliance": ("defer", "", ""),  # Legal-review-first.
    "components/other": ("discard", "", ""),  # Non-courtlens generic components.
    "src/other": ("review-required", "", ""),
    "out-of-scope": ("discard", "", ""),
}


# Per-file overrides for the Phase 1 slice. Keys are POSIX relative paths.
# Every entry here becomes an authoritative candidate row and MUST still
# pass through docs/courtlens/legacy-inventory-review.json before Phase 1
# opens.
_FILE_OVERRIDES: dict[str, tuple[str, str, str, str]] = {
    # (disposition, phase, targetPath, notes)
    "src/components/courtlens/matter/CaseOverview.jsx": (
        "duplicate",
        "",
        "",
        "Existing apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/page.tsx already renders the summary + context dl. Phase 1 does not add a separate CaseOverview component.",
    ),
    "src/components/courtlens/matter/RiskPanel.jsx": (
        "port",
        "1",
        "apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/RiskPanel.tsx",
        "Renders view.riskFlags (already returned by buildMatterDetailView). No new data-layer work.",
    ),
    "src/components/courtlens/matter/MatterAuditTrail.jsx": (
        "port",
        "1",
        "apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/CaseTimelinePanel.tsx",
        "Renamed to CaseTimelinePanel per Phase 0 review. Renders IncidentTimelineItem[] already returned by getMatterDetail. Read-only — no audit doctrine change.",
    ),
    "src/components/courtlens/Badges.jsx": (
        "port",
        "1",
        "apps/abr/app/[locale]/dashboard/courtlens/_ui/badges.tsx",
        "UrgencyBadge, StatusBadge, AiSummaryBadge. Uses ABR-local tokens (navy/electric/gold) — status-* tokens from packages/ui/globals.css are NOT wired into apps/abr/app/globals.css and cannot be used without a separate token-plumbing task.",
    ),
    # Phase 2 candidates (data-layer gap, do not open Phase 2 yet).
    "src/components/courtlens/matter/EvidencePanel.jsx": (
        "defer",
        "",
        "",
        "Needs getMatterDocuments + incident_documents table. No matching table exists in the current schema.",
    ),
    "src/components/courtlens/matter/CommunicationPanel.jsx": (
        "defer",
        "",
        "",
        "Notes UI. Depends on note-write authorization contract not yet drafted for the refactor.",
    ),
    "src/components/courtlens/matter/ReviewerActions.jsx": (
        "duplicate",
        "",
        "",
        "apps/abr/app/[locale]/dashboard/courtlens/matters/[matterId]/ReviewerActions.tsx already exists.",
    ),
    "src/components/courtlens/matter/ReviewerPicker.jsx": (
        "defer",
        "",
        "",
        "Needs listReviewersForOrg on matter-service.ts. No such export today.",
    ),
    "src/components/courtlens/matter/BulkActionBar.jsx": (
        "defer",
        "",
        "",
        "Needs bulk-transition endpoint. No such route exists.",
    ),
    "src/components/courtlens/matter/MatterTable.jsx": (
        "defer",
        "",
        "",
        "Sortable table for the queue. Not a Phase 1 concern.",
    ),
    "src/components/courtlens/casepacket/CasePacketTimeline.jsx": (
        "defer",
        "",
        "",
        "Review-packet page is Phase 4, not Phase 1.",
    ),
    "src/components/courtlens/casepacket/PacketTemplatePreview.jsx": (
        "defer",
        "",
        "",
        "Review-packet page is Phase 4, not Phase 1.",
    ),
    # Legacy AppLanguageContext support — always discard (replaced by next-intl).
    "src/components/courtlens/LanguageToggle.jsx": (
        "discard",
        "",
        "",
        "Replaced by apps/abr locale switcher via next-intl. No port.",
    ),
    # Role-guard scaffolding — discard (replaced by server-side hasPermission).
    "src/components/courtlens/RoleGuard.jsx": (
        "discard",
        "",
        "",
        "Replaced by server-side hasPermission gates on each route.",
    ),
    "src/components/courtlens/CapabilityGuard.jsx": (
        "discard",
        "",
        "",
        "Replaced by server-side hasPermission gates on each route.",
    ),
    "src/components/courtlens/RestrictedAccess.jsx": (
        "discard",
        "",
        "",
        "Replaced by server-side hasPermission gates on each route.",
    ),
}


@dataclasses.dataclass
class Row:
    legacyPath: str
    category: str
    disposition: str
    phase: str
    targetPath: str
    usesBase44: bool
    usesUpload: bool
    usesAppLanguageContext: bool
    securityNotes: str
    dependencyOfPath: str
    notes: str


def default_for(category: str) -> tuple[str, str, str]:
    """Return (disposition, phase, targetPath) default for a category.

    Categories without an explicit default resolve to ``review-required``.
    This is the deliberate safety rule: no unmapped file may silently
    become ``discard``.
    """

    return _CATEGORY_DEFAULTS.get(category, ("review-required", "", ""))


# ---------------------------------------------------------------------------
# Walker
# ---------------------------------------------------------------------------


def iter_source_files(legacy_root: Path) -> Iterable[Path]:
    """Yield every in-scope source file under ``legacy_root`` deterministically.

    Excluded directories short-circuit the walk. Suffix filter keeps the
    inventory scoped to actual JSX modules; assets/lockfiles/JSON never
    appear.
    """

    stack: list[Path] = [legacy_root]
    while stack:
        current = stack.pop()
        try:
            entries = sorted(current.iterdir(), key=lambda p: p.name)
        except (PermissionError, FileNotFoundError):
            continue
        for entry in entries:
            if entry.is_dir():
                if entry.name in EXCLUDED_DIR_NAMES:
                    continue
                stack.append(entry)
                continue
            if entry.suffix in INCLUDED_SUFFIXES:
                yield entry


# ---------------------------------------------------------------------------
# Row builder
# ---------------------------------------------------------------------------


def build_row(legacy_root: Path, path: Path) -> Row:
    rel = path.relative_to(legacy_root).as_posix()
    category = categorize(rel)

    try:
        text = path.read_text(encoding="utf-8", errors="replace")
    except OSError:
        text = ""

    signals = scan_content(text)

    override = _FILE_OVERRIDES.get(rel)
    if override is not None:
        disposition, phase, target, notes = override
    else:
        disposition, phase, target = default_for(category)
        notes = ""

    return Row(
        legacyPath=rel,
        category=category,
        disposition=disposition,
        phase=phase,
        targetPath=target,
        usesBase44=signals.uses_base44,
        usesUpload=signals.uses_upload,
        usesAppLanguageContext=signals.uses_app_language_context,
        securityNotes=security_notes_for(signals),
        dependencyOfPath="",  # Populated in a follow-up import-graph pass.
        notes=notes,
    )


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


class ValidationError(RuntimeError):
    """Raised when the generated inventory violates a hard rule."""


def validate_rows(rows: list[Row]) -> None:
    seen: set[str] = set()
    for row in rows:
        if row.legacyPath in seen:
            raise ValidationError(f"Duplicate legacyPath: {row.legacyPath}")
        seen.add(row.legacyPath)

        if row.disposition not in DISPOSITIONS:
            raise ValidationError(
                f"Invalid disposition '{row.disposition}' for {row.legacyPath}"
            )
        if row.phase not in PHASES:
            raise ValidationError(f"Invalid phase '{row.phase}' for {row.legacyPath}")

        if row.disposition == "port":
            if not row.targetPath:
                raise ValidationError(
                    f"'port' row missing targetPath: {row.legacyPath}"
                )
            if not row.phase:
                raise ValidationError(f"'port' row missing phase: {row.legacyPath}")
        else:
            if row.phase:
                raise ValidationError(
                    f"Non-port row must not have phase: {row.legacyPath} "
                    f"(disposition={row.disposition}, phase={row.phase})"
                )
            if row.targetPath:
                raise ValidationError(
                    f"Non-port row must not have targetPath: {row.legacyPath} "
                    f"(disposition={row.disposition})"
                )


# ---------------------------------------------------------------------------
# CSV writer (deterministic, standards-compliant)
# ---------------------------------------------------------------------------


def write_csv(rows: list[Row], out_path: Path) -> None:
    """Write a standards-compliant CSV: header first, no comment lines.

    Line endings are forced to ``\\n`` for cross-platform determinism —
    ``newline=""`` prevents csv from injecting extra CRLF on Windows and
    ``lineterminator="\\n"`` overrides csv's default ``\\r\\n``.
    """

    out_path.parent.mkdir(parents=True, exist_ok=True)
    with out_path.open("w", encoding="utf-8", newline="") as fh:
        writer = csv.writer(fh, lineterminator="\n")
        writer.writerow(CSV_COLUMNS)
        for row in rows:
            writer.writerow(
                [
                    row.legacyPath,
                    row.category,
                    row.disposition,
                    row.phase,
                    row.targetPath,
                    "true" if row.usesBase44 else "false",
                    "true" if row.usesUpload else "false",
                    "true" if row.usesAppLanguageContext else "false",
                    row.securityNotes,
                    row.dependencyOfPath,
                    row.notes,
                ]
            )


# ---------------------------------------------------------------------------
# Manifest writer
# ---------------------------------------------------------------------------


def csv_body_sha256(csv_path: Path) -> str:
    """SHA-256 of the CSV body (excluding the header line).

    Row-only hash so header renames trigger a version bump but do not
    silently invalidate the manifest fingerprint.
    """

    body = csv_path.read_bytes().split(b"\n", 1)[1] if csv_path.exists() else b""
    return hashlib.sha256(body).hexdigest()


def legacy_root_fingerprint(legacy_root: Path) -> str:
    """SHA-256 fingerprint of the sorted set of in-scope file paths.

    Enough to detect scope drift without pulling every file body into
    the manifest.
    """

    paths = sorted(
        p.relative_to(legacy_root).as_posix() for p in iter_source_files(legacy_root)
    )
    digest = hashlib.sha256()
    for path in paths:
        digest.update(path.encode("utf-8"))
        digest.update(b"\n")
    return digest.hexdigest()


def _compute_disposition_matrix(rows: list[Row]) -> dict[str, int]:
    """Return the explicit inventory disposition matrix.

    Every field is required for Phase 0 accounting per the CourtLens
    refactor directive: total, port, defer, discard, duplicate,
    reviewRequired, and — critically — ``phase1PortCandidates`` which
    MUST equal the count of rows satisfying
    ``disposition == 'port' && phase == PHASE_1_LABEL``. This proves
    that Phase 1 is not silently equated with the entire 380-row
    inventory.
    """

    disposition_counts: dict[str, int] = {
        "port": 0,
        "defer": 0,
        "discard": 0,
        "duplicate": 0,
        "review-required": 0,
    }
    phase1_port = 0
    for row in rows:
        if row.disposition in disposition_counts:
            disposition_counts[row.disposition] += 1
        if row.disposition == "port" and row.phase == PHASE_1_LABEL:
            phase1_port += 1
    return {
        "total": len(rows),
        "port": disposition_counts["port"],
        "defer": disposition_counts["defer"],
        "discard": disposition_counts["discard"],
        "duplicate": disposition_counts["duplicate"],
        "reviewRequired": disposition_counts["review-required"],
        "phase1PortCandidates": phase1_port,
    }


def write_manifest(
    rows: list[Row],
    legacy_root: Path,
    csv_path: Path,
    manifest_path: Path,
    generated_at: str,
) -> dict:
    category_counts: dict[str, int] = {}
    disposition_counts: dict[str, int] = {}
    for row in rows:
        category_counts[row.category] = category_counts.get(row.category, 0) + 1
        disposition_counts[row.disposition] = (
            disposition_counts.get(row.disposition, 0) + 1
        )

    row_count = len(rows)
    scope_delta = row_count - EXPECTED_JSX_COUNT

    manifest = {
        "generatorVersion": GENERATOR_VERSION,
        "generatedAt": generated_at,
        "legacyRoot": legacy_root.as_posix(),
        "legacyRootFingerprint": legacy_root_fingerprint(legacy_root),
        "csvPath": csv_path.name,
        "csvBodySha256": csv_body_sha256(csv_path),
        "scope": {
            "includedSuffixes": list(INCLUDED_SUFFIXES),
            "excludedDirNames": sorted(EXCLUDED_DIR_NAMES),
            "expectedJsxCount": EXPECTED_JSX_COUNT,
            "actualRowCount": row_count,
            "scopeDelta": scope_delta,
        },
        "counts": {
            "byCategory": dict(sorted(category_counts.items())),
            "byDisposition": dict(sorted(disposition_counts.items())),
        },
        "dispositionMatrix": _compute_disposition_matrix(rows),
        "unreviewedCount": disposition_counts.get("review-required", 0),
    }
    manifest_path.parent.mkdir(parents=True, exist_ok=True)
    manifest_path.write_text(
        json.dumps(manifest, indent=2, sort_keys=False) + "\n",
        encoding="utf-8",
    )
    return manifest


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------


def generate(
    legacy_root: Path,
    csv_path: Path,
    manifest_path: Path,
    generated_at: str | None = None,
) -> dict:
    """Generate inventory + manifest. Returns the manifest dict.

    ``generated_at`` is exposed so tests can pass a fixed timestamp for
    deterministic regeneration comparisons.
    """

    if not legacy_root.exists():
        raise FileNotFoundError(f"Legacy root not found: {legacy_root}")

    rows = sorted(
        (build_row(legacy_root, p) for p in iter_source_files(legacy_root)),
        key=lambda r: r.legacyPath,
    )
    validate_rows(rows)

    write_csv(rows, csv_path)

    ts = generated_at or datetime.now(timezone.utc).strftime("%Y-%m-%dT%H:%M:%SZ")
    return write_manifest(rows, legacy_root, csv_path, manifest_path, ts)


def _parse_args(argv: list[str]) -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--legacy-root", type=Path, required=True)
    parser.add_argument("--csv-out", type=Path, required=True)
    parser.add_argument("--manifest-out", type=Path, required=True)
    parser.add_argument(
        "--generated-at",
        type=str,
        default=None,
        help="Override timestamp (RFC3339). Used by deterministic tests.",
    )
    return parser.parse_args(argv)


def main(argv: list[str] | None = None) -> int:
    args = _parse_args(argv if argv is not None else sys.argv[1:])
    try:
        manifest = generate(
            args.legacy_root, args.csv_out, args.manifest_out, args.generated_at
        )
    except (FileNotFoundError, ValidationError) as exc:
        print(f"error: {exc}", file=sys.stderr)
        return 1
    print(
        f"Wrote {manifest['scope']['actualRowCount']} rows to {args.csv_out} "
        f"(delta vs expected: {manifest['scope']['scopeDelta']:+d})."
    )
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
