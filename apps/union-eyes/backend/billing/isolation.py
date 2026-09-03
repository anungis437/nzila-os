"""
Structural, fail-closed Django isolation primitives for the billing app.

PR #752 round 32: Round 1/30/31 found billing/views.py's auto-generated
ModelViewSets are `queryset = Model.objects.all()` + `permission_classes =
[permissions.IsAuthenticated]` with NO org filtering anywhere — any
authenticated platform user (not just members of the owning organization)
can read/write every organization's finance rows. This module is the
shared primitive that replaces that pattern for the tables in scope this
round; see finance.ts's per-table `reason` fields for the exact
before/after evidence.

DO NOT reuse auth_core.mixins.OrgScopedMixin — it is a DIFFERENT,
pre-existing (and currently unused, zero real callers as of this round)
mixin that resolves org identity from the raw `X-Organization-Id` HTTP
request header via `request.META`, not from the JWT-verified
`request.organization_id` that OrganizationIsolationMiddleware attaches.
That header is fully client-controlled on any request that reaches
Django directly (not proxied through Next.js), so applying it would let
an authenticated user impersonate any organization by setting the header
to a victim org's ID — worse than no scoping, since it *looks* scoped.
It also fails OPEN (returns the unfiltered queryset) when the header is
absent unless `require_org_scope=True` is set on the viewset. Flagged for
a future round; not modified here to keep this round's blast radius
scoped to billing/finance.

Ground truth this module relies on (independently verified, PR #752
round 32 Phase 1/2):
  - Django's DATABASES connection uses the PGUSER/PGPASSWORD credential
    derived from the SAME `union-eyes-runtime-database-url` Key Vault
    secret Next.js uses for its tenant-scoped `union_eyes_runtime` role
    (.github/workflows/deploy-union-eyes.yml's backend deploy step derives
    PGHOST/PGUSER/PGDATABASE/PGPORT from the frontend container's
    DATABASE_URL secret). Django is never given SYSTEM_DATABASE_URL /
    `union_eyes_system` credentials.
  - `union_eyes_runtime` is provisioned NOSUPERUSER, NOBYPASSRLS
    (scripts/provision-runtime-db-roles.ts) — it cannot bypass Postgres
    RLS. However NO finance-domain table currently has RLS enabled (the
    0108 baseline covers 24 non-finance tables only; see
    db/rls-storage-authority/baseline-0108.ts), so BYPASSRLS status is
    currently moot for finance — isolation must be enforced at the
    Django application layer, which is what this module does.
  - `request.organization_id` (attached by
    auth_core.middleware.OrganizationIsolationMiddleware) is derived from
    the verified organization claim on the caller's token, resolved by
    auth_core.authentication's JWT-verifying authentication backend —
    NOT from any client-supplied header, body field, or query parameter.
    This is the only value this module trusts as tenant authority.
  - No Django code anywhere sets a `SET`/`SET LOCAL`/`set_config` session
    variable on the database connection; tenant context is an
    application-layer concept only for this backend today.
"""

from __future__ import annotations

from rest_framework import permissions
from rest_framework.exceptions import NotFound, PermissionDenied


def _request_organization_id(request) -> str | None:
    """The JWT-verified caller organization id, or None if absent.

    Deliberately reads `request.organization_id`, set only by
    OrganizationIsolationMiddleware from the verified organization claim on
    the caller's token — never a header/body/query value a client can set
    directly.
    """
    return getattr(request, "organization_id", None)


class DenyAllPermission(permissions.BasePermission):
    """Fail-closed containment for models with NO tenant/organization key
    at all (or a system/platform-only surface exposed through an ordinary
    IsAuthenticated ModelViewSet): unconditionally denies every request.

    There is no safe partial filter to bolt onto a queryset with no tenant
    column, and no legitimate ordinary-tenant use case for a
    platform/system-only table — so every operation (list, retrieve,
    create, update, delete) returns 403 until a real ownership model
    exists (a tenant column + migration/backfill) or a dedicated,
    separately-authorized system/platform execution path is built.
    """

    def has_permission(self, request, view):
        return False

    def has_object_permission(self, request, view, obj):
        return False


class DirectTenantIsolationMixin:
    """Fail-closed isolation for tables with a direct, NOT NULL-in-practice
    `organization_id` column (the manifest's TENANT_RLS_REQUIRED shape).

    Required behaviour, all enforced here:
      - LIST/RETRIEVE: queryset is always constrained to the caller's own
        organization_id. No request.organization_id -> empty queryset
        (never falls through to unfiltered).
      - CREATE: `organization_id` is always forced to the caller's own
        organization_id, overriding (never trusting) any client-supplied
        value in the request body.
      - UPDATE/PATCH: the target row's existing organization_id is
        re-verified against the caller's organization_id before allowing
        the mutation (defense in depth even though get_queryset() already
        scopes get_object()); any client-supplied `organization_id` in the
        payload is discarded rather than applied, so a caller cannot
        reassign a row to a different organization.
      - DELETE: scoped the same way as UPDATE, via get_queryset().

    Apply to a `queryset = Model.objects.all()` ModelViewSet unchanged —
    this mixin's get_queryset() wraps and further restricts it; no need to
    remove the class-level `queryset` attribute.
    """

    #: Name of the model field that stores organization ownership. Almost
    #: always "organization_id"; override only if a table genuinely uses a
    #: different column name for the same concept.
    tenant_field: str = "organization_id"

    def get_queryset(self):
        qs = super().get_queryset()  # type: ignore[misc]
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            return qs.none()
        return qs.filter(**{self.tenant_field: org_id})

    def perform_create(self, serializer):
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            raise PermissionDenied("Organization context required to create this resource.")
        serializer.save(**{self.tenant_field: org_id})

    def perform_update(self, serializer):
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            raise PermissionDenied("Organization context required to update this resource.")
        instance = serializer.instance
        if getattr(instance, self.tenant_field) != org_id:
            # Unreachable in practice (get_object() already scopes via
            # get_queryset()), but this is the explicit write-side proof
            # the round-32 evidence chain requires — never trust
            # get_queryset() alone to have been called on every path.
            raise NotFound()
        # Force the tenant field back to the caller's own org on every
        # update, discarding any client-supplied value in the payload —
        # a caller can never reassign a row to a different organization.
        serializer.save(**{self.tenant_field: org_id})

    def perform_destroy(self, instance):
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id or getattr(instance, self.tenant_field) != org_id:
            raise NotFound()
        instance.delete()


class ParentOwnedIsolationMixin:
    """Fail-closed isolation for tables that have NO direct tenant column
    but are owned via a parent FK whose own model IS direct-tenant-owned
    (the manifest's PARENT_OWNED_RLS_REQUIRED shape).

    Subclasses must set `parent_field` (the FK attribute name on this
    model, e.g. "invoice") and `parent_tenant_field` (the tenant column
    name on the PARENT model, almost always "organization_id").
    """

    parent_field: str = ""
    parent_tenant_field: str = "organization_id"

    def get_queryset(self):
        qs = super().get_queryset()  # type: ignore[misc]
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            return qs.none()
        return qs.filter(**{f"{self.parent_field}__{self.parent_tenant_field}": org_id})

    def _parent_belongs_to_caller(self, parent_obj, org_id: str) -> bool:
        return parent_obj is not None and getattr(parent_obj, self.parent_tenant_field) == org_id

    def perform_create(self, serializer):
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            raise PermissionDenied("Organization context required to create this resource.")
        parent_obj = serializer.validated_data.get(self.parent_field)
        if not self._parent_belongs_to_caller(parent_obj, org_id):
            raise PermissionDenied("Parent resource does not belong to your organization.")
        serializer.save()

    def perform_update(self, serializer):
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            raise PermissionDenied("Organization context required to update this resource.")
        current_parent = getattr(serializer.instance, self.parent_field, None)
        if not self._parent_belongs_to_caller(current_parent, org_id):
            raise NotFound()
        new_parent = serializer.validated_data.get(self.parent_field, current_parent)
        if not self._parent_belongs_to_caller(new_parent, org_id):
            raise PermissionDenied("Cannot reassign this resource to a parent outside your organization.")
        serializer.save()

    def perform_destroy(self, instance):
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        parent_obj = getattr(instance, self.parent_field, None)
        if not org_id or not self._parent_belongs_to_caller(parent_obj, org_id):
            raise NotFound()
        instance.delete()
