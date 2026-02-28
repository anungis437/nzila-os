"""
ABR Governance Bridge — Single Entry Point for Platform-Governed Operations

All ABR backend code that emits audit events, seals evidence bundles,
or dispatches outbound integrations MUST go through this module.

This bridge enforces:
  1. Org-scoping validation  — every operation requires a valid org_id
  2. Audit taxonomy mapping  — actions are validated against the ABR taxonomy
  3. Evidence sealing trigger — mutations that produce terminal events trigger seals
  4. Dispatcher routing       — outbound comms go through the central dispatcher

Direct writes to AuditLogs, EvidenceBundles, or outbound SDK calls from
views are flagged by contract test ABR_GOVERNANCE_BRIDGE_001.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Usage in views:
    from compliance.governance_bridge import governance

    governance.emit_audit(
        org_id=request.user.organization_id,
        actor_id=request.user.id,
        action="CASE_CREATED",
        resource_type="abr_case",
        resource_id=str(case.id),
        details={"summary": case.summary},
    )

    governance.seal_evidence(bundle, actor_id=request.user.id, seal_envelope={...})

    governance.dispatch_notification(
        org_id=request.user.organization_id,
        event_type="CASE_STATUS_NOTIFICATION",
        payload={...},
    )
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

@module compliance.governance_bridge
"""

from __future__ import annotations

import logging
import uuid
from typing import Any, Optional

from compliance.services import (
    EvidenceSealViolationError,
    create_audit_log,
    seal_bundle,
)

logger = logging.getLogger(__name__)

# ── ABR Audit Taxonomy ────────────────────────────────────────────────────────

#: Canonical ABR actions that map to the platform audit taxonomy.
#: Must stay in sync with @nzila/os-core/audit/abr.ts AbrAuditAction.
ABR_AUDIT_ACTIONS: frozenset[str] = frozenset(
    {
        "CASE_CREATED",
        "CASE_UPDATED",
        "CASE_CLOSED",
        "CASE_REOPENED",
        "CASE_ASSIGNED",
        "CASE_ESCALATED",
        "DECISION_ISSUED",
        "DECISION_AMENDED",
        "DECISION_APPEALED",
        "EVIDENCE_SUBMITTED",
        "EVIDENCE_SEALED",
        "EVIDENCE_EXPORTED",
        "INTEGRATION_DISPATCHED",
        "AI_RECOMMENDATION",
        "ML_PREDICTION",
        "AUTH_ACCESS_GRANTED",
        "AUTH_ACCESS_DENIED",
    }
)

#: Valid ABR entity types — matches AbrEntityType in os-core.
ABR_ENTITY_TYPES: frozenset[str] = frozenset(
    {
        "abr_case",
        "abr_decision",
        "abr_evidence_bundle",
        "abr_compliance_report",
        "abr_export",
        "abr_user",
    }
)


class GovernanceBridgeError(Exception):
    """Base error for governance bridge violations."""


class InvalidOrgIdError(GovernanceBridgeError):
    """Raised when org_id is missing or not a valid UUID."""


class InvalidAuditActionError(GovernanceBridgeError):
    """Raised when the audit action is not in the ABR taxonomy."""


class InvalidEntityTypeError(GovernanceBridgeError):
    """Raised when the resource type is not in the ABR entity types."""


# ── Validation Helpers ────────────────────────────────────────────────────────


def _validate_org_id(org_id: Any) -> uuid.UUID:
    """Ensure org_id is a non-nil UUID."""
    if org_id is None:
        raise InvalidOrgIdError("org_id is required for all governance operations.")
    if isinstance(org_id, str):
        try:
            org_id = uuid.UUID(org_id)
        except ValueError as exc:
            raise InvalidOrgIdError(f"org_id is not a valid UUID: {org_id}") from exc
    if not isinstance(org_id, uuid.UUID):
        raise InvalidOrgIdError(f"org_id must be a UUID, got {type(org_id).__name__}")
    if org_id == uuid.UUID(int=0):
        raise InvalidOrgIdError("org_id cannot be the nil UUID.")
    return org_id


def _validate_audit_action(action: str) -> str:
    """Ensure the action is in the ABR taxonomy."""
    if action not in ABR_AUDIT_ACTIONS:
        raise InvalidAuditActionError(
            f"Action '{action}' is not in the ABR audit taxonomy. "
            f"Valid actions: {sorted(ABR_AUDIT_ACTIONS)}"
        )
    return action


def _validate_entity_type(resource_type: str) -> str:
    """Ensure the entity type is in the ABR taxonomy."""
    if resource_type not in ABR_ENTITY_TYPES:
        raise InvalidEntityTypeError(
            f"Entity type '{resource_type}' is not in the ABR entity types. "
            f"Valid types: {sorted(ABR_ENTITY_TYPES)}"
        )
    return resource_type


# ── Governance Bridge ─────────────────────────────────────────────────────────


class _GovernanceBridge:
    """
    Single, centralized entry point for all ABR governance operations.

    Principle: ABR views and services MUST NOT directly call
    AuditLogs.objects.create(), EvidenceBundles.objects.create(),
    or outbound SDK functions. They go through this bridge.
    """

    # ── Audit ─────────────────────────────────────────────────────────────

    def emit_audit(
        self,
        *,
        org_id: Any,
        actor_id: Any,
        action: str,
        resource_type: str,
        resource_id: str,
        details: Any = None,
        changes: Any = None,
        correlation_id: Optional[uuid.UUID] = None,
        ip_address: Optional[str] = None,
        user_agent: Optional[str] = None,
    ):
        """
        Emit a hash-chained, org-scoped audit event through the platform
        audit service.

        Validates:
          - org_id is a valid, non-nil UUID
          - action is in ABR_AUDIT_ACTIONS
          - resource_type is in ABR_ENTITY_TYPES

        Delegates to compliance.services.create_audit_log which handles
        hash-chain locking (select_for_update + transaction.atomic).
        """
        validated_org = _validate_org_id(org_id)
        _validate_audit_action(action)
        _validate_entity_type(resource_type)

        actor = (
            uuid.UUID(str(actor_id))
            if not isinstance(actor_id, uuid.UUID)
            else actor_id
        )

        log = create_audit_log(
            organization_id=validated_org,
            actor_id=actor,
            action=action,
            resource_type=resource_type,
            resource_id=resource_id,
            details=details,
            changes=changes,
            correlation_id=correlation_id,
            ip_address=ip_address,
            user_agent=user_agent,
        )

        logger.info(
            "governance.audit org=%s action=%s resource=%s/%s actor=%s",
            validated_org,
            action,
            resource_type,
            resource_id,
            actor,
        )
        return log

    # ── Evidence Sealing ──────────────────────────────────────────────────

    def seal_evidence(
        self,
        bundle,
        *,
        actor_id: Any,
        seal_envelope: dict,
        org_id: Any = None,
    ):
        """
        Seal an evidence bundle through the platform seal lifecycle.

        Validates org_id (from bundle or explicit param), then delegates to
        compliance.services.seal_bundle with INV-15 enforcement.
        """
        effective_org = org_id or getattr(bundle, "organization_id", None)
        _validate_org_id(effective_org)

        actor = (
            uuid.UUID(str(actor_id))
            if not isinstance(actor_id, uuid.UUID)
            else actor_id
        )

        seal_bundle(bundle, actor, seal_envelope)

        logger.info(
            "governance.seal org=%s bundle=%s actor=%s",
            effective_org,
            getattr(bundle, "id", "?"),
            actor,
        )

    # ── Integration Dispatch ──────────────────────────────────────────────

    def dispatch_notification(
        self,
        *,
        org_id: Any,
        event_type: str,
        payload: dict,
        correlation_id: Optional[uuid.UUID] = None,
    ) -> dict:
        """
        Route an outbound notification through the platform dispatcher.

        ABR MUST NOT import outbound SDKs directly.
        This method wraps the integrations-runtime send queue.

        In the current architecture, the Django backend pushes a message
        to the platform dispatch queue (Redis/outbox) which is consumed
        by the TypeScript integrations-runtime dispatcher. When no queue
        is available (dev), it logs the intent and returns a stub receipt.
        """
        validated_org = _validate_org_id(org_id)

        # Build the dispatch envelope
        envelope = {
            "orgId": str(validated_org),
            "appId": "abr",
            "eventType": event_type,
            "payload": payload,
            "correlationId": str(correlation_id) if correlation_id else None,
            "dispatchedAt": _utcnow_iso(),
        }

        # Attempt to push to dispatch queue
        dispatched = _try_dispatch(envelope)

        logger.info(
            "governance.dispatch org=%s event=%s dispatched=%s",
            validated_org,
            event_type,
            dispatched,
        )

        return {
            "dispatched": dispatched,
            "envelope": envelope,
        }


def _utcnow_iso() -> str:
    from datetime import datetime, timezone

    return datetime.now(timezone.utc).isoformat()


def _try_dispatch(envelope: dict) -> bool:
    """
    Attempt to push an integration envelope to the platform dispatch queue.

    Implementation priority:
      1. Redis outbox (if DISPATCH_REDIS_URL is set)
      2. Database outbox table (if available)
      3. Log-only fallback (development)

    Returns True if the message was accepted by a real transport.
    """
    import os

    redis_url = os.environ.get("DISPATCH_REDIS_URL")
    if redis_url:
        try:
            import redis

            r = redis.from_url(redis_url)
            import json

            r.lpush("nzila:dispatch:outbox", json.dumps(envelope))
            return True
        except Exception:
            logger.warning("governance.dispatch redis push failed", exc_info=True)

    # Fallback: log the dispatch intent for development
    logger.info("governance.dispatch fallback (no transport): %s", envelope)
    return False


# ── Singleton ─────────────────────────────────────────────────────────────────

#: The singleton governance bridge instance.
#: Import as: ``from compliance.governance_bridge import governance``
governance = _GovernanceBridge()
