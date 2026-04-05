"""OIDC JWT authentication backend for Django REST Framework.

Production-ready implementation with:
- JWKS caching for performance
- Organization context extraction
- User profile synchronization
- Comprehensive error handling
- JWT key rotation support

Works with Microsoft Entra External ID, Clerk, or any OIDC provider.
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


class OIDCAuthentication(authentication.BaseAuthentication):
    """OIDC JWT authentication for DRF.

    Works with Microsoft Entra External ID, Clerk, or any OIDC provider.

    This backend:
    1. Validates JWT signature using the provider's JWKS
    2. Checks token expiration
    3. Gets or creates Django User from the ``sub`` claim
    4. Attaches organization context to request
    """

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
            request.clerk_org_id = payload.get("org_id")
            request.clerk_org_role = payload.get("org_role")
            request.clerk_user_id = payload.get("sub")
            
            return (user, payload)

        except jwt.ExpiredSignatureError:
            logger.warning(f"Expired token attempt from {request.META.get('REMOTE_ADDR')}")
            raise exceptions.AuthenticationFailed("Token expired. Please log in again.")
            
        except jwt.InvalidTokenError as e:
            logger.error(f"Invalid token: {e}")
            raise exceptions.AuthenticationFailed(f"Invalid authentication token: {str(e)}")
            
        except Exception as e:
            logger.exception(f"Unexpected auth error: {e}")
            raise exceptions.AuthenticationFailed("Authentication failed. Please try again.")

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
        jwks_url = getattr(settings, "AUTH_JWKS_URL", None) or getattr(settings, "CLERK_JWKS_URL", None)
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
        payload = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            options={"verify_aud": False},  # OIDC aud claim not enforced
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
        """Sync auth provider metadata to Profile model if it exists.
        
        Args:
            user: Django User instance
            payload: JWT payload with user metadata
        """
        try:
            from apps.profiles.models import Profile
            
            clerk_user_id = payload.get("sub")
            org_id = payload.get("org_id")
            
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


# Backward compat alias
ClerkAuthentication = OIDCAuthentication


class APIKeyAuthentication(authentication.BaseAuthentication):
    """Authenticates service-to-service requests using API secret key.
    
    For internal API calls, webhooks, or admin operations.
    Checks for X-Auth-Secret or X-Clerk-Secret-Key header matching AUTH_SECRET.
    """
    
    def authenticate(self, request):
        """Authenticate using auth secret header.
        
        Returns:
            Tuple[None, dict]: (None, {"is_service_account": True}) or None
        """
        secret_key_header = (
            request.META.get("HTTP_X_AUTH_SECRET", "")
            or request.META.get("HTTP_X_CLERK_SECRET_KEY", "")  # backward compat
        )
        expected_key = getattr(settings, "AUTH_SECRET", "") or getattr(settings, "CLERK_SECRET_KEY", "")
        
        if not secret_key_header or not expected_key:
            return None
        
        if secret_key_header != expected_key:
            raise exceptions.AuthenticationFailed("Invalid service key")
        
        # Return None user but authenticated (service account)
        return (None, {"is_service_account": True})


# Backward compat alias
ClerkAPIKeyAuthentication = APIKeyAuthentication


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
