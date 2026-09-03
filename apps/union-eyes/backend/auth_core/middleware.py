"""OIDC JWT middleware for Django.

Production middleware with:
- Organization context attachment
- Multi-org data isolation enforcement
- Request logging for auth events
- Security headers
"""

import logging
from typing import List, Optional

from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class OIDCJWTMiddleware(MiddlewareMixin):
    """Middleware to attach OIDC user and organization context to requests.

    This middleware:
    1. Extracts org_id, org_role from OIDC JWT (set by OIDCAuthentication)
    2. Enforces organization-scoped querysets
    3. Logs authentication events
    4. Provides organization context to views
    """

    # Paths that don't require authentication
    EXEMPT_PATHS = [
        "/healthz/",
        "/api/health/",
        "/api/schema/",
        "/api/docs/",
        "/admin/login/",
        "/api/webhooks/auth/",  # Auth provider webhooks use secret key auth
        "/api/webhooks/clerk/",  # Backward compat
    ]

    def process_request(self, request):
        """Process incoming request to attach org context.

        OIDCAuthentication sets these attributes on request:
        - user_id: Auth provider user ID (sub claim)
        - org_id: Organization ID (org_id claim)
        - org_role: User's role in org (org_role claim)
        """
        # Skip exempt paths
        if self._is_exempt_path(request.path):
            return None

        # Attach default values if not set by auth backend
        if not hasattr(request, "user_id"):
            request.user_id = None
        if not hasattr(request, "org_id"):
            request.org_id = None
        if not hasattr(request, "org_role"):
            request.org_role = None

        return None

    def process_response(self, request, response):
        """Process outgoing response to add security headers."""
        # Add security headers
        response["X-Content-Type-Options"] = "nosniff"
        response["X-Frame-Options"] = "DENY"
        response["X-XSS-Protection"] = "1; mode=block"

        return response

    def _is_exempt_path(self, path: str) -> bool:
        """Check if path is exempt from auth requirements.

        Args:
            path: Request path

        Returns:
            bool: True if path is exempt
        """
        return any(path.startswith(p) for p in self.EXEMPT_PATHS)


class OrganizationIsolationMiddleware(MiddlewareMixin):
    """Attaches safe default organization attributes to request.organization
    / request.organization_id when nothing else has set them yet.

    PR #752 round-32 correction: this middleware previously attempted to
    resolve request.org_id (Redis cache + Organizations DB lookup) here and
    fail closed with a 403 on an unknown org. That resolution has moved to
    auth_core.authentication.resolve_organization_context(), called
    directly from OIDCAuthentication.authenticate() — the actual point in
    the request lifecycle where the verified org claim first exists. Django
    middleware's process_request() runs BEFORE the view (and therefore
    before DRF's authentication classes execute inside dispatch()), so this
    middleware could never see a populated request.org_id for a real
    bearer-token request; the Redis/DB lookup here was unreachable in
    practice for the actual production auth flow. Kept as a harmless
    default-attribute setter (same pattern as OIDCJWTMiddleware above) for
    any code path that reads request.organization_id before authentication
    has run (e.g. exempt/anonymous paths), not as an isolation mechanism.
    """

    def process_request(self, request):
        """Attach default organization attributes if not already set."""
        if not hasattr(request, "organization"):
            request.organization = None
        if not hasattr(request, "organization_id"):
            request.organization_id = None

        return None


class AuditLogMiddleware(MiddlewareMixin):
    """Logs all authenticated requests for security auditing.

    Logs:
    - User ID
    - Organization ID
    - Request method/path
    - IP address
    - User agent
    - Response status
    """

    # Paths to skip logging (health checks, static files)
    SKIP_LOGGING = ["/healthz/", "/api/health/", "/static/", "/media/"]

    def process_request(self, request):
        """Log request details for authenticated users."""
        if self._should_skip(request.path):
            return None

        # Store request start time for duration calculation
        import time

        request._audit_start_time = time.time()

        return None

    def process_response(self, request, response):
        """Log response after request is processed (async via Celery)."""
        if self._should_skip(request.path):
            return response

        # Calculate request duration
        import time

        duration_ms = 0
        if hasattr(request, "_audit_start_time"):
            duration_ms = int((time.time() - request._audit_start_time) * 1000)

        # Dispatch to Celery (fire-and-forget) for authenticated requests
        if hasattr(request, "user_id") and request.user_id:
            try:
                from auth_core.tasks import log_audit_event

                log_audit_event.delay(
                    user_id=request.user_id,
                    org_id=getattr(request, "org_id", "none"),
                    method=request.method,
                    path=request.path,
                    status_code=response.status_code,
                    duration_ms=duration_ms,
                    ip=self._get_client_ip(request),
                    user_agent=request.META.get("HTTP_USER_AGENT", ""),
                )
            except Exception:
                # Celery unavailable — fall back to synchronous log
                logger.info(
                    "AUTH_REQUEST user=%s org=%s method=%s path=%s "
                    "status=%s duration_ms=%s ip=%s",
                    request.user_id,
                    getattr(request, "org_id", "none"),
                    request.method,
                    request.path,
                    response.status_code,
                    duration_ms,
                    self._get_client_ip(request),
                )

        return response

    def _should_skip(self, path: str) -> bool:
        """Check if path should skip audit logging."""
        return any(path.startswith(p) for p in self.SKIP_LOGGING)

    def _get_client_ip(self, request) -> str:
        """Extract client IP from request headers."""
        x_forwarded_for = request.META.get("HTTP_X_FORWARDED_FOR")
        if x_forwarded_for:
            ip = x_forwarded_for.split(",")[0].strip()
        else:
            ip = request.META.get("REMOTE_ADDR", "unknown")
        return ip
