"""
Auth webhook handler and views for Zonga backend.

Webhook events handled:
  - user.created / user.updated / user.deleted
  - organization.created / organization.updated
  - organizationMembership.created / organizationMembership.updated / organizationMembership.deleted
"""

import base64
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

from .models import OrganizationMembers, Organizations, OrgMembers

logger = logging.getLogger("zonga.auth-webhook")
User = get_user_model()


# =============================================================================
# Auth provider → DB role mapping
# =============================================================================

AUTH_ROLE_MAP = {
    "org:admin": "org_admin",
    "org:secretary": "org_secretary",
}


def _map_auth_role(auth_role: str) -> str:
    """Map auth provider organization role to platform DB role.

    Auth providers send roles like 'org:admin', 'org:secretary', 'org:member'.
    Platform DB uses 'org_admin', 'org_secretary', 'org_viewer'.
    """
    return AUTH_ROLE_MAP.get(auth_role, "org_viewer")


# =============================================================================
# Webhook signature verification
# =============================================================================


def _verify_auth_webhook(request) -> bool:
    """Verify auth webhook signature using Svix HMAC-SHA256."""
    webhook_secret = getattr(settings, "AUTH_WEBHOOK_SECRET", "")
    if not webhook_secret:
        # Legacy fallback
        webhook_secret = getattr(settings, "CLERK_WEBHOOK_SECRET", "")
        logger.error("AUTH_WEBHOOK_SECRET not configured")
        return False

    svix_id = request.META.get("HTTP_SVIX_ID", "")
    svix_timestamp = request.META.get("HTTP_SVIX_TIMESTAMP", "")
    svix_signature = request.META.get("HTTP_SVIX_SIGNATURE", "")

    if not all([svix_id, svix_timestamp, svix_signature]):
        return False

    signed_content = f"{svix_id}.{svix_timestamp}.{request.body.decode('utf-8')}"

    if webhook_secret.startswith("whsec_"):
        secret_bytes = base64.b64decode(webhook_secret[len("whsec_") :])
    else:
        secret_bytes = webhook_secret.encode("utf-8")

    expected_signature = hmac.new(
        secret_bytes,
        signed_content.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return any(
        hmac.compare_digest(f"v1,{expected_signature}", sig.strip())
        for sig in svix_signature.split(" ")
        if sig.strip()
    )


# =============================================================================
# Webhook POST handler
# =============================================================================


@csrf_exempt
@require_POST
def auth_webhook(request):
    """Handle auth provider webhook events (Entra ID) for user/org/membership synchronization."""
    try:
        if not _verify_auth_webhook(request):
            logger.warning("Invalid auth webhook signature")
            return JsonResponse({"error": "Invalid signature"}, status=401)

        payload = json.loads(request.body)
        event_type = payload.get("type")
        data = payload.get("data", {})

        logger.info(f"Received auth webhook: {event_type}")

        if event_type == "user.created":
            _handle_user_created(data)
        elif event_type == "user.updated":
            _handle_user_updated(data)
        elif event_type == "user.deleted":
            _handle_user_deleted(data)
        elif event_type == "organization.created":
            _handle_organization_created(data)
        elif event_type == "organization.updated":
            _handle_organization_updated(data)
        elif event_type == "organizationMembership.created":
            _handle_membership_created(data)
        elif event_type == "organizationMembership.updated":
            _handle_membership_created(data)
        elif event_type == "organizationMembership.deleted":
            _handle_membership_deleted(data)
        else:
            logger.info(f"Unhandled webhook event: {event_type}")

        return JsonResponse({"status": "success"}, status=200)

    except Exception as e:
        logger.exception(f"Auth webhook error: {e}")
        return JsonResponse({"error": "Internal server error"}, status=500)


# Backward compat alias (deprecated)
clerk_webhook = auth_webhook


# =============================================================================
# Event handlers
# =============================================================================


def _handle_user_created(data: Dict[str, Any]):
    """Create Django User when new user signs up via auth provider."""
    auth_user_id = data.get("id")
    email = data.get("email_addresses", [{}])[0].get("email_address", "")
    first_name = data.get("first_name", "")
    last_name = data.get("last_name", "")

    user, created = User.objects.get_or_create(
        username=auth_user_id,
        defaults={
            "email": email,
            "first_name": first_name,
            "last_name": last_name,
            "is_active": True,
        },
    )
    action = "Created" if created else "Already exists"
    logger.info(f"{action}: user {auth_user_id}")


def _handle_user_updated(data: Dict[str, Any]):
    """Sync user metadata changes from auth provider."""
    auth_user_id = data.get("id")
    try:
        user = User.objects.get(username=auth_user_id)
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
            logger.info(f"Updated user {auth_user_id}")
    except User.DoesNotExist:
        logger.warning(f"User {auth_user_id} not found for update")


def _handle_user_deleted(data: Dict[str, Any]):
    """Soft-delete user (set is_active=False)."""
    auth_user_id = data.get("id")
    try:
        user = User.objects.get(username=auth_user_id)
        user.is_active = False
        user.save(update_fields=["is_active"])
        logger.info(f"Deactivated user {auth_user_id}")
    except User.DoesNotExist:
        logger.warning(f"User {auth_user_id} not found for deletion")


def _handle_organization_created(data: Dict[str, Any]):
    """Create or update local org from auth provider organization.created event.

    Note: The authoritative Organizations record lives in the platform
    org table (Drizzle-owned). This handler also creates a local
    OrganizationMembers-compatible reference via the managed=False model.
    """
    auth_org_id = data.get("id")
    org_name = data.get("name", "")

    if not auth_org_id:
        logger.warning("organization.created event missing id")
        return

    # The orgs table is Drizzle-owned (managed=False) — we can still
    # read from it but should not write. The Next.js webhook handler
    # owns writes to this table. Log for visibility.
    logger.info(f"Organization created: {auth_org_id} — {org_name}")


def _handle_organization_updated(data: Dict[str, Any]):
    """Handle organization.updated — log only (Drizzle owns writes)."""
    auth_org_id = data.get("id")
    org_name = data.get("name", "")
    logger.info(f"Organization updated: {auth_org_id} — {org_name}")


def _handle_membership_created(data: Dict[str, Any]):
    """Handle organizationMembership.created / updated.

    Creates or updates the Zonga-local OrganizationMembers record.
    Uses mapped role (org:admin → org_admin, org:secretary → org_secretary).
    """
    auth_user_id = data.get("public_user_data", {}).get("user_id")
    auth_org_id = data.get("organization", {}).get("id")
    role = _map_auth_role(data.get("role", "member"))

    if not auth_user_id or not auth_org_id:
        logger.warning("organizationMembership event missing user or org id")
        return

    try:
        org = Organizations.objects.get(clerk_org_id=auth_org_id)
    except Organizations.DoesNotExist:
        logger.warning(
            f"Cannot create membership — org {auth_org_id} not found locally. "
            f"Ensure organization.created webhook fires first."
        )
        return

    membership, created = OrganizationMembers.objects.update_or_create(
        user_id=auth_user_id,
        organization=org,
        defaults={
            "role": role,
            "status": "active",
            "is_primary": True,
        },
    )
    action = "Created" if created else "Updated"
    logger.info(
        f"{action} membership: user {auth_user_id} in org {auth_org_id} as {role}"
    )


def _handle_membership_deleted(data: Dict[str, Any]):
    """Soft-delete membership (set status='inactive')."""
    auth_user_id = data.get("public_user_data", {}).get("user_id")
    auth_org_id = data.get("organization", {}).get("id")

    if not auth_user_id or not auth_org_id:
        return

    try:
        org = Organizations.objects.get(clerk_org_id=auth_org_id)
        updated = OrganizationMembers.objects.filter(
            user_id=auth_user_id, organization=org
        ).update(status="inactive")
        logger.info(
            f"Deactivated {updated} membership(s) for user {auth_user_id} in org {auth_org_id}"
        )
    except Organizations.DoesNotExist:
        logger.warning(f"Org {auth_org_id} not found for membership deletion")


# =============================================================================
# Auth API views
# =============================================================================


@api_view(["GET"])
@permission_classes([IsAuthenticated])
def me(request):
    """Return current authenticated user profile."""
    user = request.user
    auth_user_id = user.username

    # Look up org membership
    membership = (
        OrganizationMembers.objects.filter(user_id=auth_user_id, status="active")
        .select_related("organization")
        .first()
    )

    org_data = None
    if membership:
        org_data = {
            "id": str(membership.organization.id),
            "name": membership.organization.legal_name,
            "role": membership.role,
        }

    return Response(
        {
            "id": auth_user_id,
            "email": user.email,
            "first_name": user.first_name,
            "last_name": user.last_name,
            "organization": org_data,
        }
    )


@api_view(["GET"])
def health_check(request):
    """Backend health check."""
    return Response({"status": "ok", "service": "zonga-backend"})
