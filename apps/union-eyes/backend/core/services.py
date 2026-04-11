"""
Core services — audit hash chain for UnionEyes.

Aligned with NzilaOS audit invariants:
  Every mutation emits a SHA-256 hash-chained AuditLogs record.
  A broken chain indicates tampering.
"""

import hashlib
import json
import uuid
from typing import Any, Optional

from django.db import transaction


def compute_content_hash(
    action: str,
    resource_type: str,
    resource_id: str,
    user_id: str,
    correlation_id: str,
    details: Any,
    previous_hash: Optional[str],
) -> str:
    """Compute SHA-256 content hash for an AuditLogs record.

    Equivalent to NzilaOS computeEntryHash(payload, previousHash).
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
    actor_id: str,
    action: str,
    resource_type: str,
    resource_id: str,
    details: Any = None,
    changes: Any = None,
    correlation_id: Optional[uuid.UUID] = None,
    ip_address: Optional[str] = None,
    user_agent: Optional[str] = None,
):
    """Create a hash-chained AuditLogs record inside a transaction.

    Fetches the latest record for this org to get previous_hash, then
    computes and stores content_hash before inserting.
    Caller must be inside transaction.atomic() to prevent race conditions.

    Returns the saved AuditLogs instance.
    """
    from core.models import AuditLogs  # local import avoids circular deps

    with transaction.atomic():
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
            user_id=str(actor_id),
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
    from core.models import AuditLogs

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
