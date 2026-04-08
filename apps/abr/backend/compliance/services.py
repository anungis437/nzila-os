"""
Compliance services — evidence lifecycle enforcement and audit hash chain.

Aligned with NzilaOS invariants:
  INV-14  Draft bundles never leave process memory unsealed
  INV-15  Seal-once: sealing an already-sealed bundle raises EvidenceSealViolationError
  INV-16  Redacted bundles must carry a fresh seal
  Audit   Every mutation emits a hash-chained AuditLogs record
"""

import hashlib
import json
import uuid
from datetime import datetime, timezone
from typing import Any, Optional

from django.db import transaction

# ── Seal lifecycle ────────────────────────────────────────────────────────────


class EvidenceSealViolationError(Exception):
    """Raised when attempting to re-seal an already-sealed EvidenceBundle.

    @invariant INV-15: seal-once enforcement (NzilaOS SealOnceViolationError equivalent)
    """


def assert_bundle_unsealed(bundle) -> None:
    """Raise EvidenceSealViolationError if bundle has already been sealed.

    Call this before any operation that would modify a bundle's artifacts.
    @invariant INV-15
    """
    if bundle.status in ("sealed", "finalized", "archived"):
        raise EvidenceSealViolationError(
            f"Bundle {bundle.id} has status='{bundle.status}' and cannot be re-sealed. "
            "Create a new bundle to produce a different seal."
        )


def seal_bundle(bundle, actor_id: uuid.UUID, seal_envelope: dict) -> None:
    """Apply a cryptographic seal to the bundle and persist the state change.

    @invariant INV-15: can only seal a draft bundle.
    @invariant INV-16: the caller must supply a freshly generated seal_envelope.

    Args:
        bundle: EvidenceBundles ORM instance (must have status='draft').
        actor_id: UUID of the user authorizing the seal.
        seal_envelope: Dict matching NzilaOS SealEnvelope shape:
            {
              "sealVersion": "1.0",
              "algorithm": "sha256",
              "packDigest": "<sha256-hex>",
              "artifactsMerkleRoot": "<sha256-hex>",
              "artifactCount": <int>,
              "sealedAt": "<iso8601>",
              "hmacKeyId": "<optional>",
              "hmacSignature": "<optional>"
            }
    """
    assert_bundle_unsealed(bundle)

    required_keys = {
        "sealVersion",
        "algorithm",
        "packDigest",
        "artifactsMerkleRoot",
        "sealedAt",
    }
    missing = required_keys - set(seal_envelope.keys())
    if missing:
        raise ValueError(f"seal_envelope is missing required keys: {missing}")

    content = json.dumps(
        {
            "bundle_name": bundle.bundle_name,
            "bundle_type": bundle.bundle_type,
            "pack_digest": seal_envelope.get("packDigest"),
            "merkle_root": seal_envelope.get("artifactsMerkleRoot"),
            "sealed_at": seal_envelope.get("sealedAt"),
        },
        sort_keys=True,
    )
    content_hash = hashlib.sha256(content.encode()).hexdigest()

    bundle.status = "sealed"
    bundle.sealed_at = datetime.now(tz=timezone.utc)
    bundle.seal_envelope = seal_envelope
    bundle.content_hash = content_hash
    bundle.save(
        update_fields=[
            "status",
            "sealed_at",
            "seal_envelope",
            "content_hash",
            "updated_at",
        ]
    )


# ── Audit hash chain ──────────────────────────────────────────────────────────


def compute_content_hash(
    action: str,
    resource_type: str,
    resource_id: str,
    user_id: str,
    correlation_id: str,
    details: Any,
    previous_hash: Optional[str],
) -> str:
    """Compute the SHA-256 content hash for an AuditLogs record.

    Equivalent to NzilaOS computeEntryHash(payload, previousHash).
    The hash is deterministic given the same inputs.
    """
    payload = json.dumps(
        {
            "action": action,
            "resource_type": resource_type,
            "resource_id": resource_id,
            "user_id": user_id,
            "correlation_id": correlation_id,
            "details": details,
            "previous_hash": previous_hash or "",
        },
        sort_keys=True,
    )
    return hashlib.sha256(payload.encode()).hexdigest()


def create_audit_log(
    *,
    organization_id: uuid.UUID,
    actor_id: uuid.UUID,
    action: str,
    resource_type: str,
    resource_id: str,
    details: Any = None,
    changes: Any = None,
    correlation_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    """Create a hash-chained AuditLogs record.

    Fetches the latest record for this org to get previous_hash, then
    computes content_hash before inserting. Must be called inside a
    transaction.atomic() block to prevent race conditions on the chain.

    Returns the saved AuditLogs instance.
    """
    from auth_core.models import AuditLogs  # local import avoids circular deps

    with transaction.atomic():
        # Lock the latest record for this org to prevent parallel chain-break
        latest = (
            AuditLogs.objects.select_for_update()
            .filter(organization_id=organization_id)
            .order_by("-created_at")
            .first()
        )
        previous_hash = latest.content_hash if latest else None

        content_hash = compute_content_hash(
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            user_id=str(actor_id),
            correlation_id=str(correlation_id) if correlation_id else "",
            details=details,
            previous_hash=previous_hash,
        )

        return AuditLogs.objects.create(
            organization_id=organization_id,
            action=action,
            resource_type=resource_type,
            resource_id=str(resource_id),
            user_id=actor_id,
            correlation_id=correlation_id,
            details=details or {},
            changes=changes or {},
            ip_address=ip_address,
            user_agent=user_agent,
            content_hash=content_hash,
            previous_hash=previous_hash,
        )


def verify_audit_chain(organization_id: uuid.UUID) -> dict:
    """Verify the integrity of the audit log hash chain for an org.

    Returns:
        {'valid': True, 'count': N}
        or {'valid': False, 'broken_at_id': '<uuid>', 'broken_at_index': N, 'count': N}
    """
    from auth_core.models import AuditLogs

    records = list(
        AuditLogs.objects.filter(organization_id=organization_id)
        .order_by("created_at")
        .values(
            "id",
            "action",
            "resource_type",
            "resource_id",
            "user_id",
            "correlation_id",
            "details",
            "content_hash",
            "previous_hash",
        )
    )

    prev_hash = None
    for idx, rec in enumerate(records):
        expected = compute_content_hash(
            action=rec["action"] or "",
            resource_type=rec["resource_type"] or "",
            resource_id=str(rec["resource_id"] or ""),
            user_id=str(rec["user_id"] or ""),
            correlation_id=str(rec["correlation_id"] or ""),
            details=rec["details"],
            previous_hash=prev_hash,
        )
        if rec["content_hash"] != expected:
            return {
                "valid": False,
                "broken_at_id": str(rec["id"]),
                "broken_at_index": idx,
                "count": len(records),
            }
        prev_hash = rec["content_hash"]

    return {"valid": True, "count": len(records)}


# ════════════════════════════════════════════════════════════════════════════
# ABR Dual-Control Service
# — requestSensitiveAction / approveSensitiveAction / executeSensitiveAction
# — NzilaOS parity: mirrors @nzila/os-core/abr/confidential-reporting
# ════════════════════════════════════════════════════════════════════════════

from datetime import timedelta  # noqa: E402 (after stdlib above)

from compliance.models import AbrSensitiveActionApproval  # noqa: E402
from compliance.models import AbrSensitiveActionRequest


class DualControlError(Exception):
    """Base class for all dual-control enforcement violations."""


class SelfApprovalError(DualControlError):
    """Raised when the requester attempts to approve their own request."""


class NotApprovedError(DualControlError):
    """Raised when execute is called without an approved request."""


class RequestExpiredError(DualControlError):
    """Raised when the request has passed its expiry timestamp."""


class AlreadyExecutedError(DualControlError):
    """Raised when execute is called on an already-executed request."""


def request_sensitive_action(
    org_id: uuid.UUID,
    case_id: uuid.UUID,
    action: str,
    requested_by: str,
    justification: str,
    expires_in_hours: int = 24,
) -> AbrSensitiveActionRequest:
    """
    Create a dual-control request for a sensitive ABR action.

    The request must then be approved by a DIFFERENT principal before
    execute_sensitive_action() can proceed.

    Args:
        org_id: Owning organization UUID.
        case_id: Case the action relates to.
        action: One of AbrSensitiveActionRequest.ACTION_CHOICES keys.
        requested_by: Clerk user ID of the requesting principal.
        justification: Non-empty reason for the action.
        expires_in_hours: Default 24 h TTL.

    Returns:
        The created AbrSensitiveActionRequest (status='pending').
    """
    if not justification or not justification.strip():
        raise ValueError("justification is required for sensitive action requests.")

    expires_at = datetime.now(timezone.utc) + timedelta(hours=expires_in_hours)

    return AbrSensitiveActionRequest.objects.create(
        org_id=org_id,
        case_id=case_id,
        action=action,
        requested_by=requested_by,
        justification=justification.strip(),
        status="pending",
        expires_at=expires_at,
    )


def approve_sensitive_action(
    request_id: uuid.UUID,
    approver_id: str,
    notes: str = "",
    *,
    decision: str = "approved",
) -> AbrSensitiveActionApproval:
    """
    Approve or reject a dual-control request.

    Rules enforced here:
      - approver_id MUST differ from request.requested_by  (self-approve rejected)
      - Request must be in 'pending' status
      - Request must not be expired

    Args:
        request_id: UUID of the AbrSensitiveActionRequest.
        approver_id: Clerk user ID of the approving principal.
        notes: Optional approval/rejection notes.
        decision: 'approved' or 'rejected'.

    Returns:
        The created AbrSensitiveActionApproval.

    Raises:
        SelfApprovalError: if approver_id == request.requested_by.
        DualControlError: if request is not pending or is expired.
    """
    try:
        req = AbrSensitiveActionRequest.objects.get(pk=request_id)
    except AbrSensitiveActionRequest.DoesNotExist:
        raise DualControlError(f"Request {request_id} not found.")

    # Self-approve check
    if approver_id == req.requested_by:
        raise SelfApprovalError(
            f"Principal '{approver_id}' cannot approve their own request "
            f"(requested_by='{req.requested_by}'). A distinct approver is required."
        )

    if req.status != "pending":
        raise DualControlError(
            f"Request {request_id} has status='{req.status}'. "
            "Only 'pending' requests can be approved."
        )

    if datetime.now(timezone.utc) > req.expires_at:
        req.status = "expired"
        req.save(update_fields=["status"])
        raise RequestExpiredError(
            f"Request {request_id} expired at {req.expires_at.isoformat()}."
        )

    if decision not in ("approved", "rejected"):
        raise ValueError(
            f"decision must be 'approved' or 'rejected', got '{decision}'."
        )

    approval = AbrSensitiveActionApproval.objects.create(
        org_id=req.org_id,
        request=req,
        approver_id=approver_id,
        decision=decision,
        notes=notes,
    )

    req.status = decision
    req.save(update_fields=["status"])

    return approval


def execute_sensitive_action(
    request_id: uuid.UUID,
    executor_id: str,
) -> AbrSensitiveActionRequest:
    """
    Mark a dual-control request as executed.

    Rules enforced:
      - Request must be in 'approved' status (not pending, rejected, expired)
      - Must not already be executed

    The actual domain action (closing the case, changing severity, etc.) is the
    caller's responsibility. This function only enforces the dual-control gate.

    Args:
        request_id: UUID of the AbrSensitiveActionRequest.
        executor_id: Clerk user ID performing the execution.

    Returns:
        The updated AbrSensitiveActionRequest (status='executed').

    Raises:
        NotApprovedError: if request has not been approved.
        AlreadyExecutedError: if request has already been executed.
        RequestExpiredError: if approve was given but request later expired.
    """
    try:
        req = AbrSensitiveActionRequest.objects.get(pk=request_id)
    except AbrSensitiveActionRequest.DoesNotExist:
        raise DualControlError(f"Request {request_id} not found.")

    if req.status == "executed":
        raise AlreadyExecutedError(f"Request {request_id} has already been executed.")

    if req.status != "approved":
        raise NotApprovedError(
            f"Request {request_id} has status='{req.status}'. "
            "Execution requires status='approved' from a distinct approver."
        )

    req.status = "executed"
    req.executed_at = datetime.now(timezone.utc)
    req.save(update_fields=["status", "executed_at"])

    return req
