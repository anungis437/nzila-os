"""Clerk JWT authentication for Django REST Framework."""

import json
import logging
from urllib.request import urlopen

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from rest_framework.authentication import BaseAuthentication
from rest_framework.exceptions import AuthenticationFailed

logger = logging.getLogger("agrimo.auth")
User = get_user_model()

_jwks_cache: dict | None = None


def _get_jwks():
    """Fetch and cache Clerk JWKS."""
    global _jwks_cache
    if _jwks_cache is not None:
        return _jwks_cache

    jwks_url = getattr(settings, "CLERK_JWKS_URL", "")
    if not jwks_url:
        raise AuthenticationFailed("CLERK_JWKS_URL not configured")

    try:
        with urlopen(jwks_url) as resp:
            _jwks_cache = json.loads(resp.read())
        return _jwks_cache
    except Exception as e:
        logger.error(f"Failed to fetch JWKS: {e}")
        raise AuthenticationFailed("Failed to fetch JWKS")


class OIDCAuthentication(BaseAuthentication):
    """Authenticate requests using OIDC JWTs."""

    def authenticate(self, request):
        auth_header = request.META.get("HTTP_AUTHORIZATION", "")
        if not auth_header.startswith("Bearer "):
            return None

        token = auth_header[7:]
        return self._verify_token(token)

    def _verify_token(self, token: str):
        try:
            jwks = _get_jwks()
            unverified_header = jwt.get_unverified_header(token)
            kid = unverified_header.get("kid")

            rsa_key = None
            for key in jwks.get("keys", []):
                if key.get("kid") == kid:
                    rsa_key = jwt.algorithms.RSAAlgorithm.from_jwk(json.dumps(key))
                    break

            if rsa_key is None:
                raise AuthenticationFailed("Unable to find matching JWK")

            issuer = getattr(settings, "CLERK_ISSUER", "")
            payload = jwt.decode(
                token,
                rsa_key,
                algorithms=["RS256"],
                issuer=issuer if issuer else None,
                options={"verify_iss": bool(issuer)},
            )

            clerk_user_id = payload.get("sub")
            if not clerk_user_id:
                raise AuthenticationFailed("Token missing sub claim")

            user, _ = User.objects.get_or_create(
                username=clerk_user_id,
                defaults={"is_active": True},
            )
            return (user, payload)

        except jwt.ExpiredSignatureError:
            raise AuthenticationFailed("Token has expired")
        except jwt.InvalidTokenError as e:
            raise AuthenticationFailed(f"Invalid token: {e}")
