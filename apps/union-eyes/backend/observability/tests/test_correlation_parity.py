"""
Tests for ObservabilityMiddleware — governance correlation parity.

Guards the TS-frontend ↔ Django backend correlation chain:
    - `X-Governance-Correlation` / `X-Governance-Trace` headers sent from
      the Next.js app land in the Django request context and are echoed
      back on the response, so downstream services keep the chain intact.
"""

from __future__ import annotations

from unittest.mock import MagicMock

from django.http import HttpResponse
from django.test import RequestFactory, TestCase

from observability.logging import (
    clear_request_context,
    get_request_context,
)
from observability.middleware import ObservabilityMiddleware


class CorrelationHeaderParityTests(TestCase):
    """The middleware must honour and echo TS-side governance headers."""

    def setUp(self) -> None:
        self.factory = RequestFactory()
        clear_request_context()

    def _build(self, **headers):
        captured = {}

        def get_response(request):
            # Snapshot context so we can assert what reached the logger.
            captured["ctx"] = get_request_context()
            return HttpResponse(status=200)

        middleware = ObservabilityMiddleware(get_response)
        request = self.factory.get("/api/cases/", **headers)
        response = middleware(request)
        return response, captured

    def test_governance_correlation_id_is_captured_and_echoed(self) -> None:
        response, captured = self._build(
            HTTP_X_GOVERNANCE_CORRELATION="gcid_abc123",
            HTTP_X_GOVERNANCE_TRACE="gtid_xyz789",
        )

        # Captured into the logging context for structured logs.
        self.assertEqual(
            captured["ctx"]["governance_correlation_id"], "gcid_abc123"
        )
        self.assertEqual(captured["ctx"]["governance_trace_id"], "gtid_xyz789")

        # Echoed back on the response.
        self.assertEqual(response["X-Governance-Correlation"], "gcid_abc123")
        self.assertEqual(response["X-Governance-Trace"], "gtid_xyz789")

    def test_falls_back_to_governance_correlation_when_no_request_id(
        self,
    ) -> None:
        """If only governance headers arrive, they double as request_id."""
        _response, captured = self._build(
            HTTP_X_GOVERNANCE_CORRELATION="gcid_fallback"
        )
        self.assertEqual(captured["ctx"]["request_id"], "gcid_fallback")

    def test_request_id_wins_over_governance_correlation(self) -> None:
        """An explicit X-Request-Id takes priority for the request_id field
        while governance fields remain populated on their own."""
        _response, captured = self._build(
            HTTP_X_REQUEST_ID="req-001",
            HTTP_X_GOVERNANCE_CORRELATION="gcid_alt",
        )
        self.assertEqual(captured["ctx"]["request_id"], "req-001")
        self.assertEqual(
            captured["ctx"]["governance_correlation_id"], "gcid_alt"
        )

    def test_response_omits_governance_headers_when_none_sent(self) -> None:
        """No empty headers when the caller didn't send governance IDs."""
        response, _captured = self._build()
        self.assertNotIn("X-Governance-Correlation", response)
        self.assertNotIn("X-Governance-Trace", response)
        # request_id is always set (generated uuid4) so X-Request-Id is present.
        self.assertIn("X-Request-Id", response)

    def test_context_is_cleared_after_request(self) -> None:
        self._build(HTTP_X_GOVERNANCE_CORRELATION="gcid_clean")
        # After middleware returns, context should be empty.
        ctx = get_request_context()
        self.assertEqual(ctx["governance_correlation_id"], "")
        self.assertEqual(ctx["request_id"], "")
