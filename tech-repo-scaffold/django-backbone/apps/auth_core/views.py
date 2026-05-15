"""Views for auth_core backbone app.

Webhook handlers for auth provider user synchronization.
"""

import hashlib
import hmac
import json
import logging
from typing import Any, Dict

from django.conf import settings
from django.contrib.auth import get_user_model
from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_POST
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

logger = logging.getLogger(__name__)
User = get_user_model()


@csrf_exempt
@require_POST
def clerk_webhook(request):
    """Handle auth provider webhook events for user synchronization.

    The auth provider sends webhooks for:
    - user.created
    - user.updated
    - user.deleted
    - organization.created
    - organization.updated
    - organizationMembership.created
    - organizationMembership.updated
    - organizationMembership.deleted

    Webhook verification uses SVIX signature validation.
    """
    try:
        # Verify webhook signature
        if not _verify_webhook(request):
            logger.warning("Invalid auth webhook signature")
            return JsonResponse({"error": "Invalid signature"}, status=401)

        # Parse webhook payload
        payload = json.loads(request.body)
        event_type = payload.get("type")
        data = payload.get("data", {})

        logger.info(f"Received auth webhook: {event_type}")

        # Route to appropriate handler
        if event_type == "user.created":
            _handle_user_created(data)
        elif event_type == "user.updated":
            _handle_user_updated(data)
        elif event_type == "user.deleted":
            _handle_user_deleted(data)
        elif event_type == "organization.created":
            _handle_organization_created(data)
        elif event_type == "organizationMembership.created":
            _handle_membership_created(data)
        elif event_type == "organizationMembership.deleted":
            _handle_membership_deleted(data)
        else:
            logger.info(f"Unhandled webhook event: {event_type}")

        return JsonResponse({"status": "success"}, status=200)

    except Exception as e:
        logger.exception(f"Auth webhook error: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)


def _verify_webhook(request) -> bool:
    """Verify auth provider webhook signature using webhook secret.

    Args:
        request: Django HttpRequest

    Returns:
        bool: True if signature is valid
    """
    webhook_secret = getattr(settings, "AUTH_WEBHOOK_SECRET", "") or getattr(
        settings, "CLERK_WEBHOOK_SECRET", ""
    )
    if not webhook_secret:
        logger.error("AUTH_WEBHOOK_SECRET not configured")
        return False

    # Get signature from headers
    svix_id = request.META.get("HTTP_SVIX_ID", "")
    svix_timestamp = request.META.get("HTTP_SVIX_TIMESTAMP", "")
    svix_signature = request.META.get("HTTP_SVIX_SIGNATURE", "")

    if not all([svix_id, svix_timestamp, svix_signature]):
        return False

    # Construct signed payload
    signed_content = f"{svix_id}.{svix_timestamp}.{request.body.decode('utf-8')}"

    # Compute expected signature
    expected_signature = hmac.new(
        webhook_secret.encode("utf-8"),
        signed_content.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    # Compare signatures (constant-time comparison)
    return hmac.compare_digest(f"v1,{expected_signature}", svix_signature)


def _handle_user_created(data: Dict[str, Any]):
    """Handle user.created webhook event.

    Creates Django User when new user signs up via auth provider.
    """
    clerk_user_id = data.get("id")
    email = data.get("email_addresses", [{}])[0].get("email_address", "")
    first_name = data.get("first_name", "")
    last_name = data.get("last_name", "")

    user, created = User.objects.get_or_create(
        username=clerk_user_id,
        defaults={
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "is_active": True,
        },
    )

    if created:
        logger.info(f"Created user {clerk_user_id} from Clerk webhook")
    else:
        logger.info(f"User {clerk_user_id} already exists")


def _handle_user_updated(data: Dict[str, Any]):
    """Handle user.updated webhook event.

    Syncs user metadata changes from auth provider to Django.
    """
    clerk_user_id = data.get("id")

    try:
        user = User.objects.get(username=clerk_user_id)

        email = data.get("email_addresses", [{}])[0].get("email_address", "")
        first_name = data.get("first_name", "")
        last_name = data.get("last_name", "")

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
            logger.info(f"Updated user {clerk_user_id}")

    except User.DoesNotExist:
        logger.warning(f"User {clerk_user_id} not found for update")


def _handle_user_deleted(data: Dict[str, Any]):
    """Handle user.deleted webhook event.

    Soft-deletes user in Django (sets is_active=False).
    """
    clerk_user_id = data.get("id")

    try:
        user = User.objects.get(username=clerk_user_id)
        user.is_active = False
        user.save(update_fields=["is_active"])
        logger.info(f"Deactivated user {clerk_user_id}")

    except User.DoesNotExist:
        logger.warning(f"User {clerk_user_id} not found for deletion")


def _handle_organization_created(data: Dict[str, Any]):
    """Handle organization.created webhook event.

    Creates Organization record in Django.
    """
    try:
        from apps.organizations.models import Organization

        clerk_org_id = data.get("id")
        org_name = data.get("name", "")

        org, created = Organization.objects.get_or_create(
            external_id=clerk_org_id,
            defaults={"name": org_name},
        )

        if created:
            logger.info(f"Created organization {clerk_org_id}")

    except ImportError:
        logger.debug("Organization model not available")


def _handle_membership_created(data: Dict[str, Any]):
    """Handle organizationMembership.created webhook event.

    Updates user's organization association.
    """
    try:
        from apps.organizations.models import Organization

        clerk_user_id = data.get("public_user_data", {}).get("user_id")
        clerk_org_id = data.get("organization", {}).get("id")
        role = data.get("role")

        user = User.objects.get(username=clerk_user_id)
        org = Organization.objects.get(external_id=clerk_org_id)

        # Update user's profile with org membership
        # (Implementation depends on your Profile model structure)
        logger.info(f"User {clerk_user_id} joined org {clerk_org_id} as {role}")

    except (ImportError, User.DoesNotExist, Organization.DoesNotExist) as e:
        logger.warning(f"Membership creation failed: {e}")


def _handle_membership_deleted(data: Dict[str, Any]):
    """Handle organizationMembership.deleted webhook event.

    Removes user's organization association.
    """
    clerk_user_id = data.get("public_user_data", {}).get("user_id")
    clerk_org_id = data.get("organization", {}).get("id")

    logger.info(f"User {clerk_user_id} removed from org {clerk_org_id}")
    # Implement membership cleanup logic


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Get current authenticated user's profile.

    Returns:
        {
            "id": "user_id",
            "email": "user@example.com",
            "first_name": "John",
            "last_name": "Doe",
            "clerk_user_id": "user_2...",
            "organization": {"id": "org_id", "name": "Org Name"}
        }
    """
    user = request.user

    return Response(
        {
            "id": str(user.id) if hasattr(user, "id") else None,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "auth_user_id": user.username,  # Username is auth provider user ID
            "organization": {
                "id": getattr(request, "auth_org_id", None),
                "role": getattr(request, "auth_org_role", None),
            },
        }
    )


@api_view(["GET"])
def health_check(request):
    """Health check endpoint for load balancers."""
    return Response({"status": "healthy"})
