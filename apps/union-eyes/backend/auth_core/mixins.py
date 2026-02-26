"""
Organisation-scoping mixins for DRF viewsets.

These mixins automatically filter querysets to the organisation that the
authenticated Clerk user is currently acting in, preventing data leakage
between organisations.

Usage
-----
Apply `OrgScopedMixin` to any ModelViewSet that has an `organization` FK
(or `organization_id` field):

    class MembersViewSet(OrgScopedMixin, viewsets.ModelViewSet):
        queryset = OrganizationMembers.objects.all()
        serializer_class = OrganizationMembersSerializer

The mixin reads the Clerk organisation ID from the `X-Organization-Id`
request header (forwarded by the Next.js djangoProxy utility) and resolves
it to the local `organizations.id` UUID.

If the header is absent (unauthenticated or single-org call) the mixin
falls through to the default queryset with no org filter applied.
"""

from __future__ import annotations

import logging

from rest_framework.exceptions import PermissionDenied

logger = logging.getLogger(__name__)


def _resolve_local_org_id(clerk_org_id: str | None) -> str | None:
    """Map a Clerk org ID to the local UUID.

    Cached per-process via a simple dict (no Redis required for dev).
    In production, replace with a Redis-backed cache.

    Returns the local `organizations.id` (UUID string) or None.
    """
    if not clerk_org_id:
        return None

    # Lazy import to avoid circular imports at module load time.
    from auth_core.models import Organizations  # noqa: PLC0415

    try:
        org = Organizations.objects.only("id").get(clerk_organization_id=clerk_org_id)
        return str(org.id)
    except Organizations.DoesNotExist:
        logger.warning(
            "OrgScopedMixin: clerk org %s has no local record yet. "
            "Trigger organization.created webhook or create the org manually.",
            clerk_org_id,
        )
        return None


class OrgScopedMixin:
    """
    Filter the queryset to the organisation specified in X-Organization-Id.

    The viewset **must** expose an `organization` FK or `organization_id`
    field on its model for the filter to apply.

    Fields checked (first match wins):
      1. organisation  (FK)
      2. organization_id  (UUID field)
    """

    #: Set to False on viewsets that should work cross-org (e.g. admin views).
    require_org_scope: bool = False

    def get_queryset(self):
        qs = super().get_queryset()  # type: ignore[misc]

        clerk_org_id: str | None = self.request.META.get(  # type: ignore[attr-defined]
            "HTTP_X_ORGANIZATION_ID"
        )

        if not clerk_org_id:
            if self.require_org_scope:
                raise PermissionDenied(
                    "X-Organization-Id header is required for this endpoint."
                )
            return qs

        local_org_id = _resolve_local_org_id(clerk_org_id)
        if not local_org_id:
            # Org hasn't been created locally yet (no webhook fired).
            # Fail closed — return empty queryset rather than leaking data.
            return qs.none()

        model = qs.model
        field_names = {f.name for f in model._meta.get_fields()}

        if "organization" in field_names:
            return qs.filter(organization_id=local_org_id)

        if "organization_id" in field_names:
            return qs.filter(organization_id=local_org_id)

        # Model has no org FK — return unfiltered.
        return qs

    def perform_create(self, serializer):
        """Auto-populate `organization_id` on POST."""
        clerk_org_id: str | None = self.request.META.get(  # type: ignore[attr-defined]
            "HTTP_X_ORGANIZATION_ID"
        )
        local_org_id = _resolve_local_org_id(clerk_org_id)

        model = serializer.Meta.model
        field_names = {f.name for f in model._meta.get_fields()}

        if local_org_id and "organization" in field_names:
            serializer.save(organization_id=local_org_id)
        elif local_org_id and "organization_id" in field_names:
            serializer.save(organization_id=local_org_id)
        else:
            serializer.save()


class UserScopedMixin:
    """
    Filter the queryset to records belonging to the current Clerk user.

    Checks for a `user_id` field on the model and filters by the Clerk
    user ID taken from the authenticated `request.user.username`.
    """

    def get_queryset(self):
        qs = super().get_queryset()  # type: ignore[misc]

        user = self.request.user  # type: ignore[attr-defined]
        if not user or not user.is_authenticated:
            return qs.none()

        clerk_user_id: str = (
            user.username
        )  # ClerkAuthentication sets username = Clerk user ID

        model = qs.model
        field_names = {f.name for f in model._meta.get_fields()}

        if "user_id" in field_names:
            return qs.filter(user_id=clerk_user_id)

        return qs
