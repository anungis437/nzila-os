"""Reservation-first idempotency admission tests.

Proves the SELECT->HTTP->INSERT race is closed by reserving the deterministic
UNIQUE(request_hash, org_id) key BEFORE any outbound delivery, and that TTL is
enforced as a data lifecycle (reclaim) rather than a time-relative index.
"""

import uuid
from datetime import timedelta
from unittest import mock

from django.test import TestCase
from django.utils import timezone
from services.integration_control_plane import tasks
from services.integration_control_plane.models import (
    IntegrationIdempotencyKey,
    IntegrationRegistry,
)


def _make_integration(**over):
    defaults = dict(
        org_id=uuid.uuid4(),
        integration_type="webhook_outbound",
        name="Test Webhook",
        endpoint_url="https://example.test/hook",
        status="active",
        secret="",
    )
    defaults.update(over)
    return IntegrationRegistry.objects.create(**defaults)


class _Resp:
    def __init__(self, status=200, body=None):
        self.status_code = status
        self._body = {"ok": True} if body is None else body

    def raise_for_status(self):
        if self.status_code >= 400:
            raise RuntimeError(f"HTTP {self.status_code}")

    def json(self):
        return self._body


class ReservationFirstIdempotencyTests(TestCase):
    def test_first_dispatch_reserves_delivers_and_caches(self):
        integ = _make_integration()
        payload = {"a": 1}
        with mock.patch.object(
            tasks.requests, "post", return_value=_Resp(200, {"r": 1})
        ) as post:
            result = tasks.dispatch_integration(
                integration_id=str(integ.id),
                org_id=str(integ.org_id),
                payload=payload,
            )
        self.assertEqual(result["status"], "delivered")
        self.assertEqual(post.call_count, 1)

        rows = IntegrationIdempotencyKey.objects.filter(org_id=integ.org_id)
        self.assertEqual(rows.count(), 1)
        row = rows.first()
        self.assertEqual(row.response_status, 200)
        self.assertEqual(row.response_body, {"r": 1})
        # Completed result carries the 24h replay TTL (data lifecycle).
        self.assertGreater(row.expires_at, timezone.now() + timedelta(hours=23))
        # Idempotency key is stable and equal to the request hash.
        headers = post.call_args.kwargs["headers"]
        self.assertEqual(headers["X-Idempotency-Key"], row.request_hash)

    def test_completed_duplicate_returns_cached_without_second_http(self):
        integ = _make_integration()
        payload = {"a": 2}
        with mock.patch.object(
            tasks.requests, "post", return_value=_Resp(201, {"x": 9})
        ) as post:
            first = tasks.dispatch_integration(
                integration_id=str(integ.id),
                org_id=str(integ.org_id),
                payload=payload,
            )
            second = tasks.dispatch_integration(
                integration_id=str(integ.id),
                org_id=str(integ.org_id),
                payload=payload,
            )
        self.assertEqual(first["status"], "delivered")
        self.assertEqual(second["status"], "duplicate")
        self.assertEqual(second["original_status"], 201)
        self.assertEqual(second["original_body"], {"x": 9})
        # The second request must NOT hit the network.
        self.assertEqual(post.call_count, 1)
        self.assertEqual(
            IntegrationIdempotencyKey.objects.filter(org_id=integ.org_id).count(), 1
        )

    def test_active_reservation_blocks_duplicate_delivery(self):
        integ = _make_integration()
        payload = {"a": 3}
        request_hash = tasks._hash_payload(payload)
        # Simulate an in-flight reservation held by a concurrent worker.
        IntegrationIdempotencyKey.objects.create(
            request_hash=request_hash,
            integration=integ,
            org_id=integ.org_id,
            response_status=None,
            response_body=None,
            expires_at=timezone.now()
            + timedelta(seconds=tasks.IDEMPOTENCY_RESERVATION_LEASE_SECONDS),
        )
        with mock.patch.object(tasks.requests, "post", return_value=_Resp(200)) as post:
            result = tasks.dispatch_integration(
                integration_id=str(integ.id),
                org_id=str(integ.org_id),
                payload=payload,
            )
        self.assertEqual(result["status"], "in_progress")
        # No second outbound request while a reservation is active.
        self.assertEqual(post.call_count, 0)

    def test_expired_row_is_reclaimed_and_redelivered(self):
        integ = _make_integration()
        payload = {"a": 4}
        request_hash = tasks._hash_payload(payload)
        # An expired completed result must be reclaimable.
        IntegrationIdempotencyKey.objects.create(
            request_hash=request_hash,
            integration=integ,
            org_id=integ.org_id,
            response_status=200,
            response_body={"old": True},
            expires_at=timezone.now() - timedelta(seconds=5),
        )
        with mock.patch.object(
            tasks.requests, "post", return_value=_Resp(200, {"new": True})
        ) as post:
            result = tasks.dispatch_integration(
                integration_id=str(integ.id),
                org_id=str(integ.org_id),
                payload=payload,
            )
        self.assertEqual(result["status"], "delivered")
        self.assertEqual(post.call_count, 1)
        rows = IntegrationIdempotencyKey.objects.filter(
            org_id=integ.org_id, request_hash=request_hash
        )
        self.assertEqual(rows.count(), 1)
        self.assertEqual(rows.first().response_body, {"new": True})

    def test_delivery_failure_releases_reservation_by_id(self):
        integ = _make_integration()
        payload = {"a": 5}
        with mock.patch.object(
            tasks.requests, "post", side_effect=RuntimeError("boom")
        ), mock.patch.object(tasks.retry_integration, "apply_async") as retry:
            result = tasks.dispatch_integration(
                integration_id=str(integ.id),
                org_id=str(integ.org_id),
                payload=payload,
            )
        self.assertEqual(result["status"], "retrying")
        # Reservation released so a retry can re-acquire the key.
        self.assertEqual(
            IntegrationIdempotencyKey.objects.filter(org_id=integ.org_id).count(), 0
        )
        self.assertEqual(retry.call_count, 1)

    def test_concurrent_reservation_serialized_by_unique_key(self):
        integ = _make_integration()
        payload = {"a": 6}
        request_hash = tasks._hash_payload(payload)

        first = tasks._acquire_idempotency_reservation(
            IntegrationIdempotencyKey, request_hash, integ.org_id, integ
        )
        self.assertEqual(first.disposition, "reserved")

        # A second concurrent admission sees the active reservation and must not
        # be allowed to deliver a duplicate.
        second = tasks._acquire_idempotency_reservation(
            IntegrationIdempotencyKey, request_hash, integ.org_id, integ
        )
        self.assertEqual(second.disposition, "in_progress")

        self.assertEqual(
            IntegrationIdempotencyKey.objects.filter(
                org_id=integ.org_id, request_hash=request_hash
            ).count(),
            1,
        )
