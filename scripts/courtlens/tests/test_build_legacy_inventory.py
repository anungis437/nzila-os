"""Tests for the CourtLens legacy inventory generator (Phase 0).

Runs against a temp synthetic legacy tree — never touches the real
Downloads copy.
"""

from __future__ import annotations

import csv
import json
from pathlib import Path

import pytest

from scripts.courtlens.build_legacy_inventory import (
    CSV_COLUMNS,
    ContentSignals,
    Row,
    ValidationError,
    build_row,
    categorize,
    default_for,
    generate,
    scan_content,
    security_notes_for,
    validate_rows,
)

# ---------------------------------------------------------------------------
# Synthetic tree
# ---------------------------------------------------------------------------


def _write(path: Path, text: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(text, encoding="utf-8")


@pytest.fixture()
def synthetic_legacy(tmp_path: Path) -> Path:
    """Minimal synthetic legacy tree with one file per interesting rule."""

    root = tmp_path / "court-lens-ready-extracted"

    # Phase 1 candidates covered by _FILE_OVERRIDES.
    _write(
        root / "src/components/courtlens/matter/CaseOverview.jsx",
        "export default function CaseOverview() { return null; }",
    )
    _write(
        root / "src/components/courtlens/matter/RiskPanel.jsx",
        "export default function RiskPanel() { return null; }",
    )
    _write(
        root / "src/components/courtlens/matter/MatterAuditTrail.jsx",
        "export default function MatterAuditTrail() { return null; }",
    )
    _write(
        root / "src/components/courtlens/Badges.jsx",
        "export function UrgencyBadge() { return null; }",
    )

    # Content signal fixtures.
    _write(
        root / "src/components/courtlens/matter/EvidencePanel.jsx",
        "import { UploadFile } from 'base44';\n"
        "// privileged material — retention: 7 years\n"
        "export default function EvidencePanel() { return null; }",
    )
    _write(
        root / "src/components/courtlens/intake/IntakeWizard.jsx",
        "import { useAppLanguage } from '@/lib/AppLanguageContext';\n"
        "// clientName, householdSize, dateOfBirth are collected here\n"
        "export default function IntakeWizard() { return null; }",
    )

    # Deferred category (no override).
    _write(
        root / "src/components/courtlens/billing/BillingCard.jsx",
        "export default function BillingCard() { return null; }",
    )

    # Discarded category.
    _write(
        root / "src/components/courtlens/onboarding/StepOne.jsx",
        "export default function StepOne() { return null; }",
    )

    # Unknown category → review-required.
    _write(
        root / "src/components/courtlens/experimental/PlaygroundThing.jsx",
        "export default function PlaygroundThing() { return null; }",
    )

    # Out-of-scope (outside src/).
    _write(root / "public/logo.svg", "<svg />")
    _write(root / "package.json", "{}")

    # Should be ignored via suffix filter (non-jsx).
    _write(root / "src/pages/index.ts", "export {};")

    # Should be ignored via excluded dir.
    _write(root / "node_modules/pkg/index.jsx", "export default 1;")

    return root


# ---------------------------------------------------------------------------
# Scanner rules
# ---------------------------------------------------------------------------


def test_scan_content_detects_base44() -> None:
    signals = scan_content("import { UploadFile } from 'base44';")
    assert signals.uses_base44 is True


def test_scan_content_detects_upload() -> None:
    signals = scan_content("const f = <FileUploader />;")
    assert signals.uses_upload is True


def test_scan_content_detects_applanguage() -> None:
    signals = scan_content("import { useAppLanguage } from '@/lib/AppLanguageContext';")
    assert signals.uses_app_language_context is True


def test_scan_content_detects_privilege_terms() -> None:
    signals = scan_content("// privileged material with retainer terms")
    assert signals.has_privilege_terms is True


def test_scan_content_detects_pii_terms() -> None:
    signals = scan_content("clientName, dateOfBirth, householdSize")
    assert signals.has_pii_terms is True


def test_security_notes_aggregate_multiple() -> None:
    signals = ContentSignals(
        uses_base44=True,
        uses_upload=True,
        uses_app_language_context=False,
        has_pii_terms=True,
        has_privilege_terms=True,
    )
    notes = security_notes_for(signals)
    assert "privilege" in notes
    assert "PII" in notes
    assert "upload" in notes
    assert "base44" in notes


def test_security_notes_empty_when_no_signals() -> None:
    assert security_notes_for(ContentSignals(False, False, False, False, False)) == ""


# ---------------------------------------------------------------------------
# Categorization rules
# ---------------------------------------------------------------------------


@pytest.mark.parametrize(
    ("rel", "expected"),
    [
        ("src/pages/Home.jsx", "pages/top-level"),
        ("src/pages/org/MatterList.jsx", "pages/org"),
        ("src/pages/platform/Admin.jsx", "pages/platform"),
        ("src/pages/parent/Overview.jsx", "pages/parent"),
        ("src/pages/public/Landing.jsx", "pages/public"),
        (
            "src/components/courtlens/matter/CaseOverview.jsx",
            "components/courtlens/matter",
        ),
        (
            "src/components/courtlens/Badges.jsx",
            "components/courtlens/top-level",
        ),
        ("src/components/ui/button.jsx", "components/other"),
        ("public/logo.svg", "out-of-scope"),
    ],
)
def test_categorize(rel: str, expected: str) -> None:
    assert categorize(rel) == expected


def test_default_for_unknown_category_is_review_required() -> None:
    assert default_for("components/courtlens/experimental")[0] == "review-required"


def test_default_for_platform_pages_is_defer() -> None:
    assert default_for("pages/platform")[0] == "defer"


def test_default_for_onboarding_is_discard() -> None:
    assert default_for("components/courtlens/onboarding")[0] == "discard"


# ---------------------------------------------------------------------------
# Row builder
# ---------------------------------------------------------------------------


def test_build_row_applies_file_override(synthetic_legacy: Path) -> None:
    path = synthetic_legacy / "src/components/courtlens/matter/RiskPanel.jsx"
    row = build_row(synthetic_legacy, path)
    assert row.disposition == "port"
    assert row.phase == "1"
    assert row.targetPath.endswith("/RiskPanel.tsx")


def test_build_row_defaults_unknown_to_review_required(
    synthetic_legacy: Path,
) -> None:
    path = (
        synthetic_legacy / "src/components/courtlens/experimental/PlaygroundThing.jsx"
    )
    row = build_row(synthetic_legacy, path)
    assert row.disposition == "review-required"
    assert row.phase == ""
    assert row.targetPath == ""


def test_build_row_populates_security_notes_from_content(
    synthetic_legacy: Path,
) -> None:
    path = synthetic_legacy / "src/components/courtlens/matter/EvidencePanel.jsx"
    row = build_row(synthetic_legacy, path)
    assert row.usesBase44 is True
    assert row.usesUpload is True
    assert "privilege" in row.securityNotes
    assert "base44" in row.securityNotes


# ---------------------------------------------------------------------------
# Validation
# ---------------------------------------------------------------------------


def _mk(**overrides: object) -> Row:
    base = dict(
        legacyPath="src/components/courtlens/matter/RiskPanel.jsx",
        category="components/courtlens/matter",
        disposition="port",
        phase="1",
        targetPath="apps/abr/x/RiskPanel.tsx",
        usesBase44=False,
        usesUpload=False,
        usesAppLanguageContext=False,
        securityNotes="",
        dependencyOfPath="",
        notes="",
    )
    base.update(overrides)
    return Row(**base)  # type: ignore[arg-type]


def test_validate_rejects_duplicate_paths() -> None:
    with pytest.raises(ValidationError, match="Duplicate"):
        validate_rows([_mk(), _mk()])


def test_validate_rejects_port_without_target() -> None:
    with pytest.raises(ValidationError, match="missing targetPath"):
        validate_rows([_mk(targetPath="")])


def test_validate_rejects_port_without_phase() -> None:
    with pytest.raises(ValidationError, match="missing phase"):
        validate_rows([_mk(phase="")])


def test_validate_rejects_non_port_with_phase() -> None:
    with pytest.raises(ValidationError, match="Non-port row must not have phase"):
        validate_rows([_mk(disposition="defer", phase="2", targetPath="")])


def test_validate_rejects_non_port_with_target() -> None:
    with pytest.raises(ValidationError, match="Non-port row must not have targetPath"):
        validate_rows([_mk(disposition="defer", phase="", targetPath="apps/abr/x.tsx")])


def test_validate_rejects_illegal_disposition() -> None:
    with pytest.raises(ValidationError, match="Invalid disposition"):
        validate_rows([_mk(disposition="ship", phase="", targetPath="")])


# ---------------------------------------------------------------------------
# End-to-end generation
# ---------------------------------------------------------------------------


def _read_csv(path: Path) -> list[dict[str, str]]:
    """Read CSV with a plain DictReader — proves no comment lines exist."""

    with path.open("r", encoding="utf-8", newline="") as fh:
        reader = csv.DictReader(fh)
        return list(reader)


def test_generate_produces_standards_compliant_csv(
    synthetic_legacy: Path, tmp_path: Path
) -> None:
    csv_path = tmp_path / "inventory.csv"
    manifest_path = tmp_path / "manifest.json"
    generate(
        synthetic_legacy, csv_path, manifest_path, generated_at="2026-07-18T00:00:00Z"
    )

    header_line = csv_path.read_text(encoding="utf-8").splitlines()[0]
    assert header_line == ",".join(CSV_COLUMNS), "Header must be the first line"

    # Plain DictReader must find every row (proves there are no
    # comment/preamble lines that would break `csv.DictReader`).
    rows = _read_csv(csv_path)
    legacy_paths = {r["legacyPath"] for r in rows}

    # Only .jsx files under any in-scope directory are included.
    assert "src/components/courtlens/matter/RiskPanel.jsx" in legacy_paths
    assert "src/components/courtlens/onboarding/StepOne.jsx" in legacy_paths

    # Non-.jsx and node_modules must be excluded by the walker.
    assert "package.json" not in legacy_paths
    assert "public/logo.svg" not in legacy_paths
    assert "src/pages/index.ts" not in legacy_paths
    assert not any("node_modules" in p for p in legacy_paths)


def test_generate_manifest_reports_scope_delta(
    synthetic_legacy: Path, tmp_path: Path
) -> None:
    csv_path = tmp_path / "inventory.csv"
    manifest_path = tmp_path / "manifest.json"
    manifest = generate(
        synthetic_legacy, csv_path, manifest_path, generated_at="2026-07-18T00:00:00Z"
    )

    assert manifest["generatorVersion"] == "0.2.0"
    assert manifest["scope"]["actualRowCount"] == len(_read_csv(csv_path))
    assert (
        manifest["scope"]["scopeDelta"]
        == manifest["scope"]["actualRowCount"] - manifest["scope"]["expectedJsxCount"]
    )
    assert "byCategory" in manifest["counts"]
    assert "byDisposition" in manifest["counts"]
    assert manifest["unreviewedCount"] == manifest["counts"]["byDisposition"].get(
        "review-required", 0
    )


def test_generate_manifest_reports_disposition_matrix(
    synthetic_legacy: Path, tmp_path: Path
) -> None:
    """The manifest must expose an explicit disposition matrix including
    ``phase1PortCandidates`` — the ONLY correct Phase 1 count. Regression
    guard for the CourtLens directive that Phase 1 candidates are strictly
    ``disposition == 'port' AND phase == '1'`` and never the row total."""

    csv_path = tmp_path / "inventory.csv"
    manifest_path = tmp_path / "manifest.json"
    manifest = generate(
        synthetic_legacy, csv_path, manifest_path, generated_at="2026-07-18T00:00:00Z"
    )

    matrix = manifest["dispositionMatrix"]
    assert set(matrix.keys()) == {
        "total",
        "port",
        "defer",
        "discard",
        "duplicate",
        "reviewRequired",
        "phase1PortCandidates",
    }
    # Field-level identities (structural, independent of fixture size).
    assert matrix["total"] == manifest["scope"]["actualRowCount"]
    assert (
        matrix["port"]
        + matrix["defer"]
        + matrix["discard"]
        + matrix["duplicate"]
        + matrix["reviewRequired"]
        == matrix["total"]
    )
    # Phase 1 candidates are a strict subset of total port rows.
    assert matrix["phase1PortCandidates"] <= matrix["port"]
    # And, if there are any non-port rows, must be strictly less than total.
    if matrix["total"] > matrix["port"]:
        assert matrix["phase1PortCandidates"] < matrix["total"]


def test_generate_is_deterministic(synthetic_legacy: Path, tmp_path: Path) -> None:
    # Same filenames under different parent dirs so the manifest's
    # `csvPath` (which is basename-only, not absolute) is byte-identical
    # across runs.
    dir_a = tmp_path / "run-a"
    dir_b = tmp_path / "run-b"
    dir_a.mkdir()
    dir_b.mkdir()
    csv_a = dir_a / "inventory.csv"
    csv_b = dir_b / "inventory.csv"
    manifest_a = dir_a / "manifest.json"
    manifest_b = dir_b / "manifest.json"

    generate(synthetic_legacy, csv_a, manifest_a, generated_at="2026-07-18T00:00:00Z")
    generate(synthetic_legacy, csv_b, manifest_b, generated_at="2026-07-18T00:00:00Z")

    assert csv_a.read_bytes() == csv_b.read_bytes(), "CSV must be byte-identical"
    assert json.loads(manifest_a.read_text(encoding="utf-8")) == json.loads(
        manifest_b.read_text(encoding="utf-8")
    )


def test_generate_raises_on_missing_legacy_root(tmp_path: Path) -> None:
    with pytest.raises(FileNotFoundError):
        generate(
            tmp_path / "does-not-exist",
            tmp_path / "c.csv",
            tmp_path / "m.json",
            generated_at="2026-07-18T00:00:00Z",
        )
