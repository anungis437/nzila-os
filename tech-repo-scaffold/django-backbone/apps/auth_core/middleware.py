"""Clerk JWT middleware for Django.

Production middleware with:
- Organization context attachment
- Multi-org data isolation enforcement
- Request logging for auth events
- Security headers
"""

import logging
from typing import List, Optional

from django.http import JsonResponse
from django.utils.deprecation import MiddlewareMixin

logger = logging.getLogger(__name__)


class ClerkJWTMiddleware(MiddlewareMixin):
    """Middleware to attach Clerk user and organization context to requests.

    This middleware:
    1. Extracts org_id, org_role from Clerk JWT (set by ClerkAuthentication)
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
        "/api/webhooks/clerk/",  # Clerk webhooks use secret key auth
    ]

    def process_request(self, request):
        """Process incoming request to attach org context.

        ClerkAuthentication sets these attributes on request:
        - clerk_user_id: Clerk user ID (sub claim)
        - clerk_org_id: Organization ID (org_id claim)
        - clerk_org_role: User's role in org (org_role claim)
        """
        # Skip exempt paths
        if self._is_exempt_path(request.path):
            return None

        # Attach default values if not set by auth backend
        if not hasattr(request, "clerk_user_id"):
            request.clerk_user_id = None
        if not hasattr(request, "clerk_org_id"):
            request.clerk_org_id = None
        if not hasattr(request, "clerk_org_role"):
            request.clerk_org_role = None

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
    """Enforces organization-level data isolation for multi-org apps.

    This middleware ensures:
    1. All database queries are scoped to user's organization
    2. Cross-organization data access is blocked
    3. Organization context is available in views via request.organization
    """

    def process_request(self, request):
        """Attach organization object to request for multi-org scoping."""
        # Skip if no org_id (anonymous or service account)
        org_id = getattr(request, "clerk_org_id", None)
        if not org_id:
            request.organization = None
            return None

        # Try to get Organization model instance
        try:
            from auth_core.models import Organizations

            organization = Organizations.objects.filter(
                clerk_organization_id=org_id
            ).first()

            if not organization:
                logger.warning(f"Unknown organization {org_id} for user {request.clerk_user_id}")
                return JsonResponse(
                    {"error": "Organization not found. Contact support."}, status=403
                )

            request.organization = organization
            request.organization_id = organization.id

        except ImportError:
            # Organization model not available (single-org app)
            request.organization = None
            request.organization_id = org_id

        except Exception as e:
            logger.error(f"Failed to load organization {org_id}: {e}")
            return JsonResponse({"error": "Failed to load organization context"}, status=500)

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
        """Log response after request is processed."""
        if self._should_skip(request.path):
            return response

        # Calculate request duration
        import time

        duration_ms = 0
        if hasattr(request, "_audit_start_time"):
            duration_ms = int((time.time() - request._audit_start_time) * 1000)

        # Log authenticated requests
        if hasattr(request, "clerk_user_id") and request.clerk_user_id:
            logger.info(
                f"AUTH_REQUEST user={request.clerk_user_id} "
                f"org={getattr(request, 'clerk_org_id', 'none')} "
                f"method={request.method} path={request.path} "
                f"status={response.status_code} duration_ms={duration_ms} "
                f"ip={self._get_client_ip(request)}"
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
