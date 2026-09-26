"""
Integration Retry Engine — Celery workers.

Provides resilient delivery with exponential backoff, max-retry thresholds,
and dead-letter queue semantics for failed integration dispatches.

Queues
------
- ``integration_queue``       — primary dispatch
- ``integration_retry_queue`` — retries with backoff
- ``integration_dead_letter_queue`` — permanently failed deliveries
"""

from __future__ import annotations

import hashlib
import json
import logging
import time
from dataclasses import dataclass
from datetime import timedelta
from typing import Any, Dict, Optional
from uuid import uuid4

import requests
from celery import shared_task
from django.db import IntegrityError, transaction
from django.utils import timezone

logger = logging.getLogger("integration_retry")

# ---------------------------------------------------------------------------
# Constants
# ---------------------------------------------------------------------------
MAX_RETRIES = 8
BASE_BACKOFF_SECONDS = 5  # first retry after 5 s → 10 → 20 → 40 → …
BACKOFF_MULTIPLIER = 2
REQUEST_TIMEOUT = 30  # seconds

# Idempotency lifecycle. Uniqueness on (request_hash, org_id) is the DB
# serializer; expiry is data lifecycle (reservation reclaim), NOT an index
# predicate. A reservation is leased only long enough to cover one outbound
# attempt plus local persistence margin; a completed result lives for the
# replay TTL before its (request_hash, org_id) becomes reclaimable again.
IDEMPOTENCY_RESERVATION_LEASE_SECONDS = REQUEST_TIMEOUT + 30
IDEMPOTENCY_RESULT_TTL_HOURS = 24


# ---------------------------------------------------------------------------
# Primary dispatch task
# ---------------------------------------------------------------------------


@shared_task(
    name="integration_control_plane.dispatch_integration",
    bind=True,
    queue="integration_queue",
    max_retries=0,  # we manage retries ourselves
    acks_late=True,
    reject_on_worker_lost=True,
)
def dispatch_integration(
    self,
    *,
    integration_id: str,
    org_id: str,
    payload: Dict[str, Any],
    idempotency_key: Optional[str] = None,
    attempt: int = 0,
) -> Dict[str, Any]:
    """
    Deliver *payload* to the integration identified by *integration_id*.

    On failure the task is re-enqueued on ``integration_retry_queue`` with
    exponential backoff.  After *MAX_RETRIES* the payload is routed to
    ``integration_dead_letter_queue``.
    """
    from services.integration_control_plane.models import (
        IntegrationIdempotencyKey,
        IntegrationRegistry,
    )

    # ---- resolve integration ----
    try:
        integration = IntegrationRegistry.objects.get(pk=integration_id, org_id=org_id)
    except IntegrationRegistry.DoesNotExist:
        logger.error("Integration %s not found for org %s", integration_id, org_id)
        return {"status": "error", "reason": "integration_not_found"}

    if integration.status in ("paused", "disabled"):
        logger.info(
            "Integration %s is %s — skipping", integration_id, integration.status
        )
        return {"status": "skipped", "reason": integration.status}

    # ---- idempotency admission (reserve BEFORE outbound delivery) ----
    request_hash = _hash_payload(payload)
    if idempotency_key is None:
        idempotency_key = request_hash

    reservation = _acquire_idempotency_reservation(
        IntegrationIdempotencyKey, request_hash, org_id, integration
    )
    if reservation.disposition == "duplicate":
        logger.info(
            "Duplicate request detected (hash=%s) — returning cached response",
            request_hash[:12],
        )
        return {
            "status": "duplicate",
            "original_status": reservation.row.response_status,
            "original_body": reservation.row.response_body,
        }
    if reservation.disposition == "in_progress":
        logger.info(
            "In-flight reservation exists (hash=%s) — not re-delivering",
            request_hash[:12],
        )
        return {"status": "in_progress", "reason": "reservation_active"}

    reservation_id = reservation.row.id

    # ---- deliver ----
    headers = {
        "Content-Type": "application/json",
        "X-Idempotency-Key": idempotency_key,
        "X-Integration-Id": str(integration.id),
        "X-Org-Id": str(org_id),
        "X-Attempt": str(attempt),
    }
    if integration.secret:
        import hmac as _hmac

        body_bytes = json.dumps(payload, sort_keys=True).encode()
        ts = str(int(time.time()))
        sig = _hmac.new(
            integration.secret.encode(),
            f"{ts}.{body_bytes.decode()}".encode(),
            hashlib.sha256,
        ).hexdigest()
        headers["X-Webhook-Signature"] = sig
        headers["X-Webhook-Timestamp"] = ts

    try:
        resp = requests.post(
            integration.endpoint_url,
            json=payload,
            headers=headers,
            timeout=REQUEST_TIMEOUT,
        )
        resp.raise_for_status()

        # success → promote this worker's reservation to a cached result (by id)
        integration.record_success()
        IntegrationIdempotencyKey.objects.filter(id=reservation_id).update(
            response_status=resp.status_code,
            response_body=_safe_json(resp),
            expires_at=timezone.now() + timedelta(hours=IDEMPOTENCY_RESULT_TTL_HOURS),
        )
        logger.info(
            "Integration dispatch OK — %s → %s (%s)",
            integration.name,
            integration.endpoint_url,
            resp.status_code,
        )
        return {"status": "delivered", "http_status": resp.status_code}

    except Exception as exc:
        # release ONLY this worker's reservation (by id) so a retry can re-acquire
        IntegrationIdempotencyKey.objects.filter(id=reservation_id).delete()
        integration.record_failure(reason=str(exc)[:500])
        logger.warning(
            "Integration dispatch FAILED (attempt %d/%d) — %s: %s",
            attempt + 1,
            MAX_RETRIES,
            integration.name,
            exc,
        )

        if attempt + 1 >= MAX_RETRIES:
            # Dead-letter
            send_to_dead_letter.delay(
                integration_id=integration_id,
                org_id=org_id,
                payload=payload,
                error=str(exc)[:1000],
                attempts=attempt + 1,
            )
            return {"status": "dead_lettered", "attempts": attempt + 1}

        # Schedule retry with exponential backoff
        backoff = BASE_BACKOFF_SECONDS * (BACKOFF_MULTIPLIER**attempt)
        retry_integration.apply_async(
            kwargs={
                "integration_id": integration_id,
                "org_id": org_id,
                "payload": payload,
                "idempotency_key": idempotency_key,
                "attempt": attempt + 1,
            },
            countdown=backoff,
        )
        return {"status": "retrying", "next_attempt": attempt + 1, "backoff_s": backoff}


# ---------------------------------------------------------------------------
# Retry task (separate queue for visibility / throttling)
# ---------------------------------------------------------------------------


@shared_task(
    name="integration_control_plane.retry_integration",
    bind=True,
    queue="integration_retry_queue",
    acks_late=True,
)
def retry_integration(
    self,
    *,
    integration_id: str,
    org_id: str,
    payload: Dict[str, Any],
    idempotency_key: Optional[str] = None,
    attempt: int = 1,
) -> Dict[str, Any]:
    """
    Re-dispatch an integration delivery.  Delegates back to
    ``dispatch_integration`` to share the same logic.
    """
    return dispatch_integration(
        integration_id=integration_id,
        org_id=org_id,
        payload=payload,
        idempotency_key=idempotency_key,
        attempt=attempt,
    )


# ---------------------------------------------------------------------------
# Dead-letter task
# ---------------------------------------------------------------------------


@shared_task(
    name="integration_control_plane.send_to_dead_letter",
    queue="integration_dead_letter_queue",
    acks_late=True,
)
def send_to_dead_letter(
    *,
    integration_id: str,
    org_id: str,
    payload: Dict[str, Any],
    error: str,
    attempts: int,
) -> Dict[str, Any]:
    """
    Persist a permanently failed delivery for manual review.
    Also creates an audit event so governance dashboards pick it up.
    """
    from services.events.dispatcher import emit_event

    logger.error(
        "Integration dead-lettered after %d attempts — integration=%s org=%s error=%s",
        attempts,
        integration_id,
        org_id,
        error[:200],
    )

    emit_event(
        event_type="integration_dead_lettered",
        org_id=org_id,
        actor_id="system",
        payload={
            "integration_id": integration_id,
            "original_payload": payload,
            "error": error,
            "attempts": attempts,
        },
    )

    return {
        "status": "dead_lettered",
        "integration_id": integration_id,
        "org_id": org_id,
        "attempts": attempts,
    }


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


@dataclass
class _ReservationOutcome:
    """Result of an idempotency admission attempt.

    disposition:
      - "reserved"     → this worker owns delivery (``row`` is the reservation)
      - "duplicate"    → a completed, unexpired result exists (return cached)
      - "in_progress" → an active reservation exists (do NOT re-deliver)
    """

    disposition: str
    row: Any


def _acquire_idempotency_reservation(model, request_hash, org_id, integration):
    """Reserve (request_hash, org_id) BEFORE any outbound delivery.

    The deterministic UNIQUE(request_hash, org_id) invariant is the DB
    serializer: exactly one concurrent INSERT wins and owns delivery; losers
    classify the persisted row. TTL is data lifecycle — an expired row is
    reclaimed (deleted by exact id, still-expired guard) and the reservation is
    retried once. No transaction is held across network I/O.
    """
    # At most one reclaim retry: first pass may reclaim an expired row, the
    # second pass then reserves cleanly (or re-loses to a concurrent winner).
    for _pass in range(2):
        existing = model.objects.filter(
            request_hash=request_hash, org_id=org_id
        ).first()
        if existing is not None:
            if existing.expires_at > timezone.now():
                if existing.response_status is not None:
                    return _ReservationOutcome("duplicate", existing)
                return _ReservationOutcome("in_progress", existing)
            # expired → reclaim by exact id (guarded on still-expired), retry
            model.objects.filter(id=existing.id, expires_at__lt=timezone.now()).delete()
            continue

        try:
            with transaction.atomic():
                row = model.objects.create(
                    request_hash=request_hash,
                    integration=integration,
                    org_id=org_id,
                    response_status=None,
                    response_body=None,
                    expires_at=timezone.now()
                    + timedelta(seconds=IDEMPOTENCY_RESERVATION_LEASE_SECONDS),
                )
            return _ReservationOutcome("reserved", row)
        except IntegrityError:
            # a concurrent worker inserted first — loop to classify their row
            continue

    # Both passes lost to concurrent activity. Re-read and classify defensively;
    # never emit a duplicate outbound request under contention.
    existing = model.objects.filter(request_hash=request_hash, org_id=org_id).first()
    if existing is not None and existing.expires_at > timezone.now():
        if existing.response_status is not None:
            return _ReservationOutcome("duplicate", existing)
    return _ReservationOutcome("in_progress", existing)


def _hash_payload(payload: Dict[str, Any]) -> str:
    canonical = json.dumps(payload, sort_keys=True, default=str)
    return hashlib.sha256(canonical.encode()).hexdigest()


def _safe_json(response: requests.Response) -> Optional[dict]:
    try:
        return response.json()
    except Exception:
        return None
