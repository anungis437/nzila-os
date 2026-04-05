"""
OIDC JWT authentication for Django REST Framework.
Works with Microsoft Entra External ID, Clerk, or any OIDC provider.
"""

import json
import logging
import urllib.request

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger("zonga.auth")
User = get_user_model()

_jwks_cache = None


def _get_jwks():
    """Fetch and cache OIDC JWKS for token verification."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = getattr(settings, "AUTH_JWKS_URL", "") or getattr(settings, "CLERK_JWKS_URL", "")
    if not jwks_url:
        raise AuthenticationFailed("AUTH_JWKS_URL not configured")

    try:
        with urllib.request.urlopen(jwks_url, timeout=5) as resp:
            jwks_data = json.loads(resp.read())
        _jwks_cache = jwks_data
        return jwks_data
    except Exception as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        raise AuthenticationFailed("Unable to verify token")


class OIDCAuthentication(BaseAuthentication):
    """OIDC JWT authentication for DRF. Works with Microsoft Entra ID, Clerk, or any OIDC provider."""

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]
        try:
            jwks = _get_jwks()
            public_keys = {}
            for key_data in jwks.get("keys", []):
                kid = key_data.get("kid")
                if kid:
                    public_keys[kid] = jwt.algorithms.RSAAlgorithm.from_jwk(
                        json.dumps(key_data)
                    )

            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")
            if kid not in public_keys:
                raise AuthenticationFailed("Unknown signing key")

            payload = jwt.decode(
                token,
                key=public_keys[kid],
                algorithms=["RS256"],
                options={"verify_aud": False},
            )

            clerk_user_id = payload.get("sub")
            if not clerk_user_id:
                raise AuthenticationFailed("Token missing subject")

            user, _ = User.objects.get_or_create(
                username=clerk_user_id,
                defaults={"is_active": True},
            )

            return (user, payload)

        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token expired")
        except jwt.InvalidTokenError as e:
            raise AuthenticationFailed(f"Invalid token: {e}")


# Backward compat alias
ClerkAuthentication = OIDCAuthentication
