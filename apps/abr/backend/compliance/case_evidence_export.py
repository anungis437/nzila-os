"""
ABR Insights — Case-Level Evidence Export

Exports a single case's evidence bundle as a sealed, tamper-evident
JSON pack. Integrates with the NzilaOS evidence lifecycle:
  collect → seal → verify

The export includes:
  - Case metadata (minimized per access level)
  - Linked evidence artefact hashes
  - Audit trail for the case
  - Dual-control approvals (if identity is unmasked)
  - Seal envelope (SHA-256 Merkle root + HMAC)
"""

from __future__ import annotations

import hashlib
import hmac
import json
import os
import uuid
from datetime import datetime, timezone
from typing import Any


def _sha256(data: str) -> str:
    return hashlib.sha256(data.encode("utf-8")).hexdigest()


def _hmac_sha256(key: str, data: str) -> str:
    return hmac.new(
        key.encode("utf-8"), data.encode("utf-8"), hashlib.sha256
    ).hexdigest()


def _merkle_root(hashes: list[str]) -> str:
    if not hashes:
        return _sha256("empty")
    if len(hashes) == 1:
        return hashes[0]
    pairs = []
    for i in range(0, len(hashes), 2):
        left = hashes[i]
        right = hashes[i + 1] if i + 1 < len(hashes) else left
        pairs.append(_sha256(left + right))
    return _merkle_root(pairs)


def _stable_json(obj: Any) -> str:
    """JSON with sorted keys for deterministic hashing."""
    return json.dumps(obj, sort_keys=True, default=str)


def build_case_evidence_pack(
    case_data: dict[str, Any],
    audit_entries: list[dict[str, Any]],
    evidence_artifacts: list[dict[str, Any]],
    dual_control_approvals: list[dict[str, Any]] | None = None,
    *,
    include_identity: bool = False,
) -> dict[str, Any]:
    """
    Build a draft evidence pack for a single case.

    Returns a dict with status='draft'. Call seal_case_evidence_pack()
    to seal it.
    """
    from compliance.metadata_minimization import minimize_for_export

    minimized = minimize_for_export(case_data, include_identity=include_identity)

    pack = {
        "packId": str(uuid.uuid4()),
        "version": "1.0.0",
        "app": "abr-insights",
        "status": "draft",
        "createdAt": datetime.now(timezone.utc).isoformat(),
        "caseId": str(case_data.get("id", "")),
        "organizationId": str(case_data.get("organization_id", "")),
        "caseData": minimized,
        "auditTrail": audit_entries,
        "evidenceArtifacts": [
            {
                "artifactId": str(a.get("id", "")),
                "filename": a.get("filename", ""),
                "sha256": a.get("content_hash", _sha256(_stable_json(a))),
                "type": a.get("artifact_type", "unknown"),
            }
            for a in evidence_artifacts
        ],
        "dualControlApprovals": dual_control_approvals or [],
        "includesIdentity": include_identity,
    }

    return pack


def seal_case_evidence_pack(pack: dict[str, Any]) -> dict[str, Any]:
    """
    Seal a draft case evidence pack.

    Computes a Merkle root over all artifact hashes + case data hash,
    then signs with EVIDENCE_SEAL_KEY.
    """
    if pack.get("status") != "draft":
        raise ValueError("Can only seal a draft pack")

    seal_key = os.environ.get("EVIDENCE_SEAL_KEY")
    if not seal_key:
        raise ValueError("EVIDENCE_SEAL_KEY environment variable is required")

    # Collect hashes: artifact hashes + case data hash + audit trail hash
    hashes = [a["sha256"] for a in pack.get("evidenceArtifacts", [])]
    hashes.append(_sha256(_stable_json(pack.get("caseData", {}))))
    hashes.append(_sha256(_stable_json(pack.get("auditTrail", []))))
    hashes.sort()

    root = _merkle_root(hashes)
    sealed_at = datetime.now(timezone.utc).isoformat()

    payload = _stable_json(
        {
            "merkleRoot": root,
            "sealedAt": sealed_at,
            "caseId": pack.get("caseId"),
            "artifactCount": len(hashes),
        }
    )

    seal = _hmac_sha256(seal_key, payload)

    pack["status"] = "sealed"
    pack["sealedAt"] = sealed_at
    pack["seal"] = {
        "seal": seal,
        "merkleRoot": root,
        "sealedAt": sealed_at,
        "artifactCount": len(hashes),
    }

    return pack


def verify_case_evidence_pack(pack: dict[str, Any]) -> dict[str, Any]:
    """
    Verify a sealed case evidence pack.
    Returns { valid: bool, errors: list[str] }.
    """
    errors: list[str] = []

    if pack.get("status") != "sealed":
        errors.append("Pack is not sealed")

    seal_info = pack.get("seal")
    if not seal_info:
        errors.append("Missing seal")
        return {"valid": False, "errors": errors}

    seal_key = os.environ.get("EVIDENCE_SEAL_KEY")
    if not seal_key:
        errors.append("EVIDENCE_SEAL_KEY not available for verification")
        return {"valid": False, "errors": errors}

    # Recompute hashes
    hashes = [a["sha256"] for a in pack.get("evidenceArtifacts", [])]
    hashes.append(_sha256(_stable_json(pack.get("caseData", {}))))
    hashes.append(_sha256(_stable_json(pack.get("auditTrail", []))))
    hashes.sort()

    root = _merkle_root(hashes)

    if root != seal_info.get("merkleRoot"):
        errors.append("Merkle root mismatch — pack has been tampered with")

    payload = _stable_json(
        {
            "merkleRoot": root,
            "sealedAt": seal_info.get("sealedAt"),
            "caseId": pack.get("caseId"),
            "artifactCount": len(hashes),
        }
    )

    expected_seal = _hmac_sha256(seal_key, payload)
    if expected_seal != seal_info.get("seal"):
        errors.append("HMAC seal mismatch — seal has been tampered with")

    return {"valid": len(errors) == 0, "errors": errors}
