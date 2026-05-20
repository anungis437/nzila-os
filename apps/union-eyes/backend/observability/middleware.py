"""
Observability — Django middleware that injects request context for structured
logging and records per-request metrics.

Add to ``settings.MIDDLEWARE``::

    'observability.middleware.ObservabilityMiddleware'
"""

from __future__ import annotations

import time
from uuid import uuid4

from django.http import HttpRequest, HttpResponse
from observability.logging import clear_request_context, set_request_context
from observability.metrics import record_api_latency


class ObservabilityMiddleware:
    """Unified middleware that sets up logging context and records metrics."""

    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request: HttpRequest) -> HttpResponse:
        # Determine request context. We honour, in order:
        #   1. X-Request-Id  (standard)
        #   2. traceparent   (W3C trace context, truncated)
        #   3. X-Governance-Correlation  (Nzila TS frontend chain)
        #   4. fresh uuid4
        governance_correlation_id = request.META.get(
            "HTTP_X_GOVERNANCE_CORRELATION", ""
        )
        governance_trace_id = request.META.get("HTTP_X_GOVERNANCE_TRACE", "")
        request_id = (
            request.META.get("HTTP_X_REQUEST_ID")
            or request.META.get("HTTP_TRACEPARENT", "")[:32]
            or governance_correlation_id
            or str(uuid4())
        )
        org_id = str(getattr(request, "organization_id", "") or "")
        user_id = str(getattr(request, "clerk_user_id", "") or "")

        set_request_context(
            request_id=request_id,
            org_id=org_id,
            user_id=user_id,
            service="union-eyes-backend",
            governance_correlation_id=governance_correlation_id,
            governance_trace_id=governance_trace_id,
        )

        start = time.monotonic()
        response = self.get_response(request)
        elapsed_ms = (time.monotonic() - start) * 1000

        # Record metrics.
        record_api_latency(
            method=request.method or "UNKNOWN",
            path=request.path,
            status=response.status_code,
            latency_ms=elapsed_ms,
        )

        # Propagate correlation headers so the chain remains intact on the
        # response side and clients can echo them to downstream services.
        response["X-Request-Id"] = request_id
        if governance_correlation_id:
            response["X-Governance-Correlation"] = governance_correlation_id
        if governance_trace_id:
            response["X-Governance-Trace"] = governance_trace_id

        clear_request_context()
        return response
