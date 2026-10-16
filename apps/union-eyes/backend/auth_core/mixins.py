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

from rest_framework.exceptions import NotFound, PermissionDenied
from django.conf import settings

logger = logging.getLogger(__name__)


class CanonicalTenantMetadataMixin:
    """Opt-in current metadata CRUD; legacy view behavior remains unchanged."""

    def _canonical_organization(self):
        actor = getattr(self.request, "_ue_canonical_actor", None)
        if actor is None or actor.organization_id is None:
            raise PermissionDenied("Active canonical organization membership required.")
        return actor.organization_id

    def get_queryset(self):
        queryset = super().get_queryset()
        if not settings.UE_CANONICAL_BOOTSTRAP_V2:
            return queryset
        return queryset.filter(organization_id=self._canonical_organization())

    def _canonical_write_organization(self, serializer):
        organization_id = self._canonical_organization()
        organization = serializer.validated_data.get("organization")
        if organization is not None and str(organization.pk) != organization_id:
            raise PermissionDenied("Foreign organization assignment denied.")
        if (
            serializer.instance is not None
            and str(serializer.instance.organization_id) != organization_id
        ):
            raise NotFound()
        return organization_id

    def perform_create(self, serializer):
        if not settings.UE_CANONICAL_BOOTSTRAP_V2:
            return super().perform_create(serializer)
        serializer.save(organization_id=self._canonical_write_organization(serializer))

    def perform_update(self, serializer):
        if not settings.UE_CANONICAL_BOOTSTRAP_V2:
            return super().perform_update(serializer)
        serializer.save(organization_id=self._canonical_write_organization(serializer))

    def perform_destroy(self, instance):
        if not settings.UE_CANONICAL_BOOTSTRAP_V2:
            return super().perform_destroy(instance)
        if str(instance.organization_id) != self._canonical_organization():
            raise NotFound()
        instance.delete()


def _resolve_local_org_id(auth_org_id: str | None) -> str | None:
    """Map an auth-provider org ID to the local UUID.

    Cached per-process via a simple dict (no Redis required for dev).
    In production, replace with a Redis-backed cache.

    Returns the local `organizations.id` (UUID string) or None.
    """
    if not auth_org_id:
        return None

    # Lazy import to avoid circular imports at module load time.
    from auth_core.models import Organizations  # noqa: PLC0415

    try:
        org = Organizations.objects.only("id").get(auth_provider_org_id=auth_org_id)
        return str(org.id)
    except Organizations.DoesNotExist:
        logger.warning(
            "OrgScopedMixin: org %s has no local record yet. "
            "Trigger organization.created webhook or create the org manually.",
            auth_org_id,
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

        auth_org_id: str | None = self.request.META.get(  # type: ignore[attr-defined]
            "HTTP_X_ORGANIZATION_ID"
        )

        if not auth_org_id:
            if self.require_org_scope:
                raise PermissionDenied(
                    "X-Organization-Id header is required for this endpoint."
                )
            return qs

        local_org_id = (
            self.request.organization_id
            if getattr(settings, "UE_CANONICAL_BOOTSTRAP_V2", False)
            else _resolve_local_org_id(auth_org_id)
        )
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
        auth_org_id: str | None = self.request.META.get(  # type: ignore[attr-defined]
            "HTTP_X_ORGANIZATION_ID"
        )
        local_org_id = (
            self.request.organization_id
            if getattr(settings, "UE_CANONICAL_BOOTSTRAP_V2", False)
            else _resolve_local_org_id(auth_org_id)
        )

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
    Filter the queryset to records belonging to the current authenticated user.

    Checks for a `user_id` field on the model and filters by the auth
    provider user ID taken from the authenticated `request.user.username`.
    """

    def get_queryset(self):
        qs = super().get_queryset()  # type: ignore[misc]

        user = self.request.user  # type: ignore[attr-defined]
        if not user or not user.is_authenticated:
            return qs.none()

        auth_user_id: str = (
            self.request.user_id
            if getattr(settings, "UE_CANONICAL_BOOTSTRAP_V2", False)
            else user.username
        )

        model = qs.model
        field_names = {f.name for f in model._meta.get_fields()}

        if "user_id" in field_names:
            return qs.filter(user_id=auth_user_id)

        return qs
