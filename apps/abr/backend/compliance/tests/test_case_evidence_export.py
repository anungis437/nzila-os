"""
ABR Phase 2 — Case Evidence Export Tests

Covers:
  - build_case_evidence_pack produces a draft pack with required fields
  - Pack never contains PII fields
  - seal_case_evidence_pack changes status to 'sealed' and adds seal
  - verify_case_evidence_pack passes on a freshly-sealed pack
  - verify_case_evidence_pack fails when pack is tampered with
  - verify_case_evidence_pack fails when seal is invalid
  - Export ordering is deterministic (same input → same Merkle root)
  - view endpoint: non-compliance-officer rejected (403)
  - view endpoint: missing justification rejected (400)
  - view endpoint: export creates access log entry

Run with:
  pytest backend/compliance/tests/test_case_evidence_export.py -v
"""

import os
import uuid
from copy import deepcopy
from typing import Any

import pytest
from compliance.case_evidence_export import (
    build_case_evidence_pack,
    seal_case_evidence_pack,
    verify_case_evidence_pack,
)

# ── Shared test data ──────────────────────────────────────────────────────────

SEAL_KEY = "test-seal-key-abr-insights-2026"

SAMPLE_CASE = {
    "id": str(uuid.uuid4()),
    "organization_id": str(uuid.uuid4()),
    "case_number": "ABR-2026-001",
    "title": "Financial Misconduct Report",
    "status": "open",
    "severity": "high",
    "category": "financial-misconduct",
    # PII fields that MUST be stripped
    "reporter_name": "Jane Doe",
    "reporter_email": "jane@example.com",
    "vault_entry_id": str(uuid.uuid4()),
}

SAMPLE_AUDIT = [
    {"event": "case-created", "actor": "system", "ts": "2026-01-01T00:00:00Z"},
    {"event": "case-assigned", "actor": "user-001", "ts": "2026-01-02T00:00:00Z"},
]

SAMPLE_ARTIFACTS = [
    {
        "id": str(uuid.uuid4()),
        "filename": "report.pdf",
        "content_hash": "a" * 64,
        "artifact_type": "document",
    },
    {
        "id": str(uuid.uuid4()),
        "filename": "screenshot.png",
        "content_hash": "b" * 64,
        "artifact_type": "image",
    },
]

SAMPLE_APPROVALS = [
    {
        "request_id": str(uuid.uuid4()),
        "action": "case-close",
        "requested_by": "user-001",
        "approver_id": "user-002",
        "decision": "approved",
        "decided_at": "2026-01-03T00:00:00Z",
    }
]


# ── build_case_evidence_pack ──────────────────────────────────────────────────


class TestBuildCaseEvidencePack:
    """Test that the pack builder produces correct structure."""

    def _build(self, **kwargs) -> dict[str, Any]:
        defaults = {
            "case_data": SAMPLE_CASE,
            "audit_entries": SAMPLE_AUDIT,
            "evidence_artifacts": SAMPLE_ARTIFACTS,
            "dual_control_approvals": SAMPLE_APPROVALS,
        }
        defaults.update(kwargs)
        return build_case_evidence_pack(**defaults)

    def test_pack_has_required_fields(self):
        pack = self._build()
        for field in ("packId", "version", "app", "status", "createdAt", "caseId"):
            assert field in pack, f"pack missing field: {field}"

    def test_pack_status_is_draft(self):
        pack = self._build()
        assert pack["status"] == "draft"

    def test_pack_includes_artifact_hashes(self):
        pack = self._build()
        artifacts = pack.get("evidenceArtifacts", [])
        assert len(artifacts) == len(SAMPLE_ARTIFACTS)
        for a in artifacts:
            assert "sha256" in a
            assert len(a["sha256"]) == 64

    def test_pii_fields_stripped_from_case_data(self):
        """PII must never appear in the exported caseData block."""
        pack = self._build()
        case_data = pack.get("caseData", {})
        pii_fields = {"reporter_name", "reporter_email", "vault_entry_id"}
        for field in pii_fields:
            assert (
                field not in case_data
            ), f"PII field '{field}' exposed in evidence pack caseData"

    def test_include_identity_false_by_default(self):
        pack = self._build()
        assert pack.get("includesIdentity") is False

    def test_approvals_included(self):
        pack = self._build()
        assert len(pack.get("dualControlApprovals", [])) == len(SAMPLE_APPROVALS)


# ── seal_case_evidence_pack ───────────────────────────────────────────────────


class TestSealCaseEvidencePack:
    def _build_and_seal(self, **kwargs) -> dict[str, Any]:
        pack = build_case_evidence_pack(
            case_data=SAMPLE_CASE,
            audit_entries=SAMPLE_AUDIT,
            evidence_artifacts=SAMPLE_ARTIFACTS,
        )
        os.environ["EVIDENCE_SEAL_KEY"] = SEAL_KEY
        try:
            return seal_case_evidence_pack(pack)
        finally:
            del os.environ["EVIDENCE_SEAL_KEY"]

    def test_seal_changes_status_to_sealed(self):
        pack = self._build_and_seal()
        assert pack["status"] == "sealed"

    def test_seal_adds_seal_block(self):
        pack = self._build_and_seal()
        assert "seal" in pack
        seal = pack["seal"]
        for key in ("seal", "merkleRoot", "sealedAt", "artifactCount"):
            assert key in seal, f"seal block missing: {key}"

    def test_seal_raises_without_key(self):
        pack = build_case_evidence_pack(
            case_data=SAMPLE_CASE,
            audit_entries=[],
            evidence_artifacts=[],
        )
        os.environ.pop("EVIDENCE_SEAL_KEY", None)
        with pytest.raises(ValueError, match="EVIDENCE_SEAL_KEY"):
            seal_case_evidence_pack(pack)

    def test_seal_raises_on_non_draft_pack(self):
        pack = build_case_evidence_pack(
            case_data=SAMPLE_CASE,
            audit_entries=[],
            evidence_artifacts=[],
        )
        pack["status"] = "sealed"
        with pytest.raises(ValueError, match="draft"):
            seal_case_evidence_pack(pack)


# ── verify_case_evidence_pack ─────────────────────────────────────────────────


class TestVerifyCaseEvidencePack:
    def _sealed_pack(self) -> dict[str, Any]:
        pack = build_case_evidence_pack(
            case_data=SAMPLE_CASE,
            audit_entries=SAMPLE_AUDIT,
            evidence_artifacts=SAMPLE_ARTIFACTS,
        )
        os.environ["EVIDENCE_SEAL_KEY"] = SEAL_KEY
        pack = seal_case_evidence_pack(pack)
        return pack

    def setup_method(self):
        os.environ["EVIDENCE_SEAL_KEY"] = SEAL_KEY

    def teardown_method(self):
        os.environ.pop("EVIDENCE_SEAL_KEY", None)

    def test_verify_passes_on_freshly_sealed_pack(self):
        pack = self._sealed_pack()
        result = verify_case_evidence_pack(pack)
        assert result["valid"] is True
        assert result["errors"] == []

    def test_verify_fails_if_pack_not_sealed(self):
        pack = build_case_evidence_pack(
            case_data=SAMPLE_CASE,
            audit_entries=[],
            evidence_artifacts=[],
        )
        result = verify_case_evidence_pack(pack)
        assert result["valid"] is False
        assert any("sealed" in e for e in result["errors"])

    def test_verify_fails_if_artifact_tampered(self):
        pack = self._sealed_pack()
        # Tamper: change an artifact hash after sealing
        if pack.get("evidenceArtifacts"):
            pack["evidenceArtifacts"][0]["sha256"] = "f" * 64
        result = verify_case_evidence_pack(pack)
        assert result["valid"] is False
        assert any("Merkle" in e or "merkle" in e.lower() for e in result["errors"])

    def test_verify_fails_if_seal_tampered(self):
        pack = self._sealed_pack()
        pack["seal"]["seal"] = "0" * 64
        result = verify_case_evidence_pack(pack)
        assert result["valid"] is False
        assert any("HMAC" in e or "tampere" in e.lower() for e in result["errors"])


# ── Deterministic ordering invariant ─────────────────────────────────────────


class TestDeterministicOrdering:
    """Same input data must always produce the same Merkle root."""

    def setup_method(self):
        os.environ["EVIDENCE_SEAL_KEY"] = SEAL_KEY

    def teardown_method(self):
        os.environ.pop("EVIDENCE_SEAL_KEY", None)

    def test_same_input_produces_same_merkle_root(self):
        def build_sealed():
            pack = build_case_evidence_pack(
                case_data=SAMPLE_CASE,
                audit_entries=SAMPLE_AUDIT,
                evidence_artifacts=SAMPLE_ARTIFACTS,
            )
            return seal_case_evidence_pack(pack)["seal"]["merkleRoot"]

        root1 = build_sealed()
        root2 = build_sealed()
        assert (
            root1 == root2
        ), "Evidence export is NOT deterministic — Merkle roots differ for identical input"

    def test_different_artifacts_produce_different_root(self):
        def build_sealed_with(artifacts):
            pack = build_case_evidence_pack(
                case_data=SAMPLE_CASE,
                audit_entries=[],
                evidence_artifacts=artifacts,
            )
            return seal_case_evidence_pack(pack)["seal"]["merkleRoot"]

        root_a = build_sealed_with(SAMPLE_ARTIFACTS)
        root_b = build_sealed_with([])
        assert root_a != root_b


# ── View endpoint tests (DB-backed) ──────────────────────────────────────────


class _FakeUser:
    """Minimal user stub satisfying DRF SessionAuthentication (needs is_active)."""

    is_authenticated = True
    is_active = True
    is_superuser = False

    def __init__(self, roles=None, superuser=False):
        import uuid as _uuid

        self.pk = str(_uuid.uuid4())
        self.abr_roles = list(roles or [])
        self.is_superuser = superuser


@pytest.mark.django_db
class TestAbrCaseEvidenceExportView:
    """Verify the POST /api/abr/cases/<id>/export-evidence/ endpoint."""

    def setup_method(self):
        self.org_id = uuid.uuid4()
        import uuid as _uuid

        from compliance.models import AbrCase

        self.case = AbrCase.objects.create(
            org_id=self.org_id,
            case_number=f"ABR-{_uuid.uuid4().hex[:8]}",
            title="Evidence Export Test",
            status="open",
            severity="high",
        )

    def _make_request(self, roles=None, justification=None, superuser=False):
        from rest_framework.test import APIRequestFactory, force_authenticate

        factory = APIRequestFactory()
        headers = {}
        if justification is not None:
            headers["HTTP_X_JUSTIFICATION"] = justification

        request = factory.post(
            f"/api/compliance/abr/cases/{self.case.pk}/export-evidence/",
            data={},
            format="json",
            **headers,
        )
        user = _FakeUser(roles=roles, superuser=superuser)
        force_authenticate(request, user=user)
        return request

    def test_non_compliance_officer_returns_403(self):
        from compliance.abr_views import AbrCaseEvidenceExportView

        view = AbrCaseEvidenceExportView.as_view()
        request = self._make_request(roles=["investigator"], justification="Audit")
        response = view(request, case_id=str(self.case.pk))
        assert response.status_code == 403

    def test_missing_justification_returns_400(self):
        from compliance.abr_views import AbrCaseEvidenceExportView

        view = AbrCaseEvidenceExportView.as_view()
        request = self._make_request(roles=["compliance-officer"])
        response = view(request, case_id=str(self.case.pk))
        assert response.status_code == 400

    def test_export_creates_access_log(self):
        from compliance.abr_views import AbrCaseEvidenceExportView
        from compliance.models import AbrIdentityAccessLog

        os.environ["EVIDENCE_SEAL_KEY"] = SEAL_KEY
        try:
            view = AbrCaseEvidenceExportView.as_view()
            request = self._make_request(
                roles=["compliance-officer"],
                justification="Annual compliance audit",
            )
            initial_count = AbrIdentityAccessLog.objects.count()
            response = view(request, case_id=str(self.case.pk))
            assert response.status_code == 200, (
                f"Expected 200, got {response.status_code}: "
                f"{getattr(response, 'data', '')}"
            )
            assert AbrIdentityAccessLog.objects.count() == initial_count + 1

            log = AbrIdentityAccessLog.objects.filter(case_id=self.case.pk).latest(
                "accessed_at"
            )
            assert log.access_type == "export"
        finally:
            os.environ.pop("EVIDENCE_SEAL_KEY", None)
