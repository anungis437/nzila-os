"""OIDC JWT authentication backend for Django REST Framework.

Production-ready implementation with:
- JWKS caching for performance
- Organization context extraction
- User profile synchronization
- Comprehensive error handling
- JWT key rotation support

Works with Microsoft Entra External ID or any OIDC provider.
"""

import logging
from functools import lru_cache
from typing import Any, Dict, Optional, Tuple

import jwt
import requests
from django.conf import settings
from django.contrib.auth import get_user_model
from django.core.cache import cache
from rest_framework import authentication, exceptions

logger = logging.getLogger(__name__)


def _extract_org(payload: Dict[str, Any]) -> Tuple[Optional[str], Optional[str]]:
    """Extract the *claimed* organization ID and role from an OIDC JWT payload.

    Only an explicit ``org_id`` claim is honoured. The identity-provider tenant
    (``tid``) is deliberately NOT used as an organization: a provider tenant is
    not a Union Eyes institution, and one person may belong to several locals,
    councils or federations. Whatever this returns is a *claim* only — it grants
    nothing until ``resolve_organization_context`` binds it to an active internal
    membership.

    Returns:
        Tuple of (org_id, org_role), either or both may be None.
    """
    org_id = payload.get("org_id")
    if org_id:
        return org_id, payload.get("org_role")

    return None, None


ORG_CACHE_TTL = 300  # 5 minutes


def resolve_organization_context(org_id: Optional[str], user_id: Optional[str] = None):
    """Resolve a *claimed* provider org ID to an internal Organizations row and
    verify the caller actually belongs to it.

    A token's organization claim is not authority. The active organization is
    accepted only if (1) it maps to a known Organizations row and (2) the
    authenticated principal (``user_id`` = the token ``sub``) holds an ACTIVE,
    non-deleted internal membership in that organization. The membership check
    is never cached, so suspension and removal take effect on the next request.
    Anything else fails closed.

    PR #752 round-32 correction: this logic used to live in
    auth_core.middleware.OrganizationIsolationMiddleware.process_request(),
    which is Django middleware and therefore runs BEFORE DRF authentication
    classes (OIDCAuthentication.authenticate(), below) ever execute — DRF
    authentication happens inside the view's dispatch(), after the entire
    Django middleware chain has already completed. Since that middleware
    only ever read request.org_id (an attribute this same authentication
    class is the ONLY thing that sets), request.organization_id was NEVER
    populated for a real bearer-token request: the middleware always saw
    org_id as absent and returned early. Every DirectTenantIsolationMixin/
    ParentOwnedIsolationMixin-protected ViewSet was therefore fail-closed
    for ALL real traffic (queryset.none() on every read, rejected on every
    write) — safe, but not a working tenant-scoped endpoint. This function
    is now called directly from OIDCAuthentication.authenticate() (see
    below), which is the only point in the request lifecycle guaranteed to
    run after the org claim is verified and before any view/queryset code.

    Returns:
        Tuple[Organization | None, str | None]: (organization, organization_id).
        Both None if org_id itself is None (anonymous/service-account call —
        not an error). Raises AuthenticationFailed if org_id is present but
        does not resolve to a known organization (fail closed).
    """
    if not org_id:
        return None, None

    if not user_id:
        raise exceptions.AuthenticationFailed(
            "Authenticated principal required to establish organization context."
        )

    cache_key = f"org:ctx:{org_id}"
    organization = cache.get(cache_key)
    if organization is None:
        try:
            from auth_core.models import Organizations  # noqa: PLC0415
        except ImportError as exc:
            # Union Eyes is a mandatory multi-tenant app — the Organizations model
            # must always be importable. Missing it is a deployment/config defect,
            # not a "single-org app" case, so fail closed instead of promoting the
            # unverified external org id into the canonical internal organization_id.
            logger.exception("Organizations model unavailable during tenant resolution")
            raise exceptions.AuthenticationFailed(
                "Organization context unavailable."
            ) from exc

        organization = Organizations.objects.filter(auth_provider_org_id=org_id).first()
        if not organization:
            logger.warning("Unknown organization %s — no local record yet.", org_id)
            raise exceptions.AuthenticationFailed(
                "Organization not found. Contact support."
            )
        cache.set(cache_key, organization, ORG_CACHE_TTL)

    from auth_core.models import OrganizationMembers  # noqa: PLC0415

    is_member = OrganizationMembers.objects.filter(
        organization_id=organization.id,
        user_id=user_id,
        status="active",
        deleted_at__isnull=True,
    ).exists()
    if not is_member:
        logger.warning(
            "Principal has no active membership in claimed organization %s.", org_id
        )
        raise exceptions.AuthenticationFailed(
            "Active organization membership required."
        )

    return organization, str(organization.id)


class OIDCAuthentication(authentication.BaseAuthentication):
    """OIDC JWT authentication for DRF.

    Works with Microsoft Entra External ID or any OIDC provider.

    This backend:
    1. Validates JWT signature using the provider's JWKS
    2. Checks token expiration
    3. Gets or creates Django User from the ``sub`` claim
    4. Attaches organization context to request
    """

    def authenticate_header(self, request):
        """Return 'Bearer' so DRF responds with 401 (not 403) on auth failure."""
        return "Bearer"

    def authenticate(self, request):
        """Authenticate request using OIDC JWT token.

        Returns:
            Tuple[User, dict]: (Django User, JWT payload) or None if no token

        Raises:
            AuthenticationFailed: If token is invalid or expired
        """
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]

        try:
            payload = self._verify_token(token)
            user = self._get_or_create_user(payload)

            # Attach organization context to request for middleware
            org_id, org_role = _extract_org(payload)
            request.org_id = org_id
            request.org_role = org_role
            request.user_id = payload.get("sub")

            # Resolve the canonical internal organization_id HERE, not in
            # OrganizationIsolationMiddleware — see resolve_organization_context's
            # docstring for why that middleware could never actually do this
            # for a real bearer-authenticated request. Raises
            # AuthenticationFailed (fail closed) if org_id is present but
            # unresolvable.
            request.organization, request.organization_id = (
                resolve_organization_context(org_id, payload.get("sub"))
            )

            return (user, payload)

        except jwt.ExpiredSignatureError:
            logger.warning(
                f"Expired token attempt from {request.META.get('REMOTE_ADDR')}"
            )
            raise exceptions.AuthenticationFailed("Token expired. Please log in again.")

        except jwt.InvalidTokenError as e:
            # The verifier's message (algorithm, claim or key detail) is logged, never returned to the caller.
            logger.error(f"Invalid token: {e}")
            raise exceptions.AuthenticationFailed("Invalid authentication token.")

        except exceptions.AuthenticationFailed:
            # Re-raise as-is (e.g. resolve_organization_context's "Organization
            # not found") instead of letting the catch-all below replace it
            # with a generic message.
            raise

        except Exception as e:
            logger.exception(f"Unexpected auth error: {e}")
            raise exceptions.AuthenticationFailed(
                "Authentication failed. Please try again."
            )

    def _verify_token(self, token: str) -> Dict[str, Any]:
        """Verify JWT token signature and decode payload.

        Uses cached JWKS client for performance.

        Args:
            token: Raw JWT string

        Returns:
            dict: Decoded JWT payload

        Raises:
            jwt.InvalidTokenError: If token is invalid
        """
        jwks_url = getattr(settings, "AUTH_JWKS_URL", None)
        if not jwks_url:
            raise exceptions.AuthenticationFailed(
                "AUTH_JWKS_URL not configured in Django settings"
            )

        # Cache JWKS client for performance (auto-refreshes on key rotation)
        jwks_client = jwt.PyJWKClient(
            jwks_url,
            cache_keys=True,
            max_cached_keys=16,
            cache_jwk_set=True,
            lifespan=3600,  # Refresh JWKS every hour
        )

        signing_key = jwks_client.get_signing_key_from_jwt(token)

        # Decode and verify token
        canonical = getattr(settings, "UE_CANONICAL_BOOTSTRAP_V2", False)
        if canonical and (not settings.AUTH_ISSUER or not settings.AUTH_AUDIENCE):
            raise exceptions.AuthenticationFailed(
                "Canonical OIDC issuer and audience required"
            )
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={
                "verify_aud": canonical,
                **({"require": ["exp", "iss", "aud", "sub"]} if canonical else {}),
            },
            **(
                {"issuer": settings.AUTH_ISSUER, "audience": settings.AUTH_AUDIENCE}
                if canonical
                else {}
            ),
        )

        return payload

    def _get_or_create_user(self, payload: Dict[str, Any]):
        """Get or create Django user from OIDC JWT payload.

        Syncs user metadata from the auth provider to Django User/Profile models.

        Args:
            payload: Decoded JWT payload

        Returns:
            User: Django User instance
        """
        User = get_user_model()

        auth_user_id = payload.get("sub")
        if not auth_user_id:
            raise exceptions.AuthenticationFailed("Token missing user ID (sub claim)")

        email = payload.get("email", "")
        first_name = payload.get("given_name", "")
        last_name = payload.get("family_name", "")

        # Get or create user by auth provider user ID
        user, created = User.objects.get_or_create(
            username=auth_user_id,
            defaults={
                "email": email,
                "first_name": first_name,
                "last_name": last_name,
                "is_active": True,
            },
        )

        # Update user if metadata changed
        if not created:
            updated = False
            if user.email != email:
                user.email = email
                updated = True
            if user.first_name != first_name:
                user.first_name = first_name
                updated = True
            if user.last_name != last_name:
                user.last_name = last_name
                updated = True

            if updated:
                user.save(update_fields=["email", "first_name", "last_name"])

        # Sync to Profile model if it exists
        self._sync_user_profile(user, payload)

        return user

    def _sync_user_profile(self, user, payload: Dict[str, Any]):
        """Sync auth provider metadata to Profile model if it exists.

        Args:
            user: Django User instance
            payload: JWT payload with user metadata
        """
        try:
            from apps.profiles.models import Profile

            auth_user_id = payload.get("sub")
            org_id, _ = _extract_org(payload)

            # Update or create profile
            Profile.objects.update_or_create(
                id=user.id,
                defaults={
                    "email": user.email,
                    "organization_id": org_id,
                    "metadata": payload.get("public_metadata", {}),
                },
            )
        except ImportError:
            # Profile model doesn't exist in this app
            pass
        except Exception as e:
            logger.error(f"Failed to sync user profile: {e}")


class APIKeyAuthentication(authentication.BaseAuthentication):
    """Authenticates service-to-service requests using API secret key.

    For internal API calls, webhooks, or admin operations.
    Checks for the X-Auth-Secret header matching AUTH_SECRET.
    """

    def authenticate(self, request):
        """Authenticate using auth secret header.

        Returns:
            Tuple[None, dict]: (None, {"is_service_account": True}) or None
        """
        secret_key_header = request.META.get("HTTP_X_AUTH_SECRET", "")
        if not secret_key_header and request.META.get("HTTP_X_CLERK_SECRET_KEY"):
            # Detection only: the legacy header is NOT honoured. This identifies a
            # caller that still needs migrating to X-Auth-Secret.
            logger.warning(
                "Legacy 'X-Clerk-Secret-Key' header presented and ignored; "
                "send 'X-Auth-Secret' instead."
            )
        expected_key = getattr(settings, "AUTH_SECRET", "")

        if not secret_key_header or not expected_key:
            return None

        if secret_key_header != expected_key:
            raise exceptions.AuthenticationFailed("Invalid service key")

        # Return None user but authenticated (service account)
        return (None, {"is_service_account": True})


# Cache user lookups by auth user ID for 5 minutes
@lru_cache(maxsize=1000)
def get_cached_user_by_auth_id(auth_user_id: str):
    """Cache user lookups for performance.

    Args:
        auth_user_id: Auth provider user ID (sub claim)

    Returns:
        User or None
    """
    User = get_user_model()
    try:
        return User.objects.get(username=auth_user_id)
    except User.DoesNotExist:
        return None
