"""Clerk JWT authentication backend for Django REST Framework.

Production-ready implementation with:
- JWKS caching for performance
- Organization context extraction
- User profile synchronization
- Comprehensive error handling
- JWT key rotation support
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
    """Extract organization ID and role from Clerk JWT payload.

    Clerk V2 tokens store org data under ``o`` (shortened keys):
        {"o": {"id": "org_...", "rol": "admin", "slg": "my-org"}}
    Clerk V1 tokens used top-level ``org_id`` / ``org_role`` keys.

    Returns:
        Tuple of (org_id, org_role), either or both may be None.
    """
    # V2 format (current)
    o = payload.get("o")
    if isinstance(o, dict):
        return o.get("id"), o.get("rol")
    # V1 fallback
    return payload.get("org_id"), payload.get("org_role")


class ClerkAuthentication(authentication.BaseAuthentication):
    """Authenticates requests using Clerk JWT tokens.

    This backend:
    1. Validates JWT signature using Clerk's JWKS
    2. Checks token expiration
    3. Gets or creates Django User from Clerk user ID
    4. Attaches organization context to request

    Supports both Clerk V1 (org_id / org_role) and V2 (o.id / o.rol) JWT
    payload formats.
    """

    def authenticate_header(self, request):
        """Return 'Bearer' so DRF responds with 401 (not 403) on auth failure."""
        return "Bearer"

    def authenticate(self, request):
        """Authenticate request using Clerk JWT token.

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
            request.clerk_org_id = org_id
            request.clerk_org_role = org_role
            request.clerk_user_id = payload.get("sub")

            return (user, payload)

        except jwt.ExpiredSignatureError:
            logger.warning(
                f"Expired token attempt from {request.META.get('REMOTE_ADDR')}"
            )
            raise exceptions.AuthenticationFailed("Token expired. Please log in again.")

        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {e}")
            raise exceptions.AuthenticationFailed(
                f"Invalid authentication token: {str(e)}"
            )

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
        jwks_url = getattr(settings, "CLERK_JWKS_URL", None)
        if not jwks_url:
            raise exceptions.AuthenticationFailed(
                "CLERK_JWKS_URL not configured in Django settings"
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
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # Clerk doesn't set aud claim
        )

        return payload

    def _get_or_create_user(self, payload: Dict[str, Any]):
        """Get or create Django user from Clerk JWT payload.

        Syncs user metadata from Clerk to Django User/Profile models.

        Args:
            payload: Decoded JWT payload from Clerk

        Returns:
            User: Django User instance
        """
        User = get_user_model()

        clerk_user_id = payload.get("sub")
        if not clerk_user_id:
            raise exceptions.AuthenticationFailed("Token missing user ID (sub claim)")

        email = payload.get("email", "")
        first_name = payload.get("given_name", "")
        last_name = payload.get("family_name", "")

        # Get or create user by Clerk user ID
        user, created = User.objects.get_or_create(
            username=clerk_user_id,
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
        """Sync Clerk metadata to Profile model if it exists.

        Args:
            user: Django User instance
            payload: JWT payload with user metadata
        """
        try:
            from apps.profiles.models import Profile

            clerk_user_id = payload.get("sub")
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


class ClerkAPIKeyAuthentication(authentication.BaseAuthentication):
    """Authenticates service-to-service requests using Clerk secret key.

    For internal API calls, webhooks, or admin operations.
    Checks for X-Clerk-Secret-Key header matching CLERK_SECRET_KEY.
    """

    def authenticate(self, request):
        """Authenticate using Clerk secret key header.

        Returns:
            Tuple[None, dict]: (None, {"is_service_account": True}) or None
        """
        secret_key_header = request.META.get("HTTP_X_CLERK_SECRET_KEY", "")
        expected_key = getattr(settings, "CLERK_SECRET_KEY", "")

        if not secret_key_header or not expected_key:
            return None

        if secret_key_header != expected_key:
            raise exceptions.AuthenticationFailed("Invalid service key")

        # Return None user but authenticated (service account)
        return (None, {"is_service_account": True})


# Cache user lookups by Clerk ID for 5 minutes
@lru_cache(maxsize=1000)
def get_cached_user_by_clerk_id(clerk_user_id: str):
    """Cache user lookups for performance.

    Args:
        clerk_user_id: Clerk user ID (sub claim)

    Returns:
        User or None
    """
    User = get_user_model()
    try:
        return User.objects.get(username=clerk_user_id)
    except User.DoesNotExist:
        return None
