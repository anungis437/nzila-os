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

from django.db.models import Q
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


class GlobalPlusTenantIsolationMixin:
    """Fail-closed isolation for tables with a NULLABLE `organization_id`
    column representing two row classes: shared/global reference rows
    (`organization_id IS NULL`) and tenant-owned override rows (non-NULL).

    PR #752 round 33 (`account_mappings`): independently re-verified
    against the Drizzle schema (db/schema/domains/financial/
    chart-of-accounts.ts), the Django model/serializer, and every TS
    consumer (services/clc/chart-of-accounts.ts is the ONLY reader, and
    has ZERO real production callers anywhere in the app — confirmed via
    grep for its exported functions/class; it is only imported by its own
    test file). No INSERT/UPDATE/DELETE call site exists anywhere in the
    TS app, and no migration ever seeds a row into this table. The prior
    round-32 assumption that this table has active "mixed global/tenant"
    runtime behaviour is NOT proven by the code — today it is inert.
    However the schema's nullable organization_id + org/type index make a
    future per-tenant override a foreseeable, intentional feature, and the
    Django ViewSet (AccountMappingsViewSet) is a REAL, router-registered,
    unscoped `queryset=Model.objects.all()` + IsAuthenticated ModelViewSet
    today — so this mixin closes that live gap with the least-privilege
    policy the schema supports, without inventing tenant behaviour that
    doesn't exist:

      - READ (list/retrieve): a verified tenant sees global rows
        (`organization_id IS NULL`) UNION its own organization's rows.
        No verified organization context -> empty queryset (consistent
        with DirectTenantIsolationMixin; shared reference data is still
        only served to an authenticated, org-verified caller).
      - CREATE: always forced to the caller's own organization_id. A
        tenant caller can never create a global (NULL) row — payload
        values can never choose organization_id or elevate to global.
      - UPDATE/DELETE: only the caller's own tenant-owned rows may be
        mutated. Global rows are immutable via this mixin for every
        ordinary tenant caller (PermissionDenied) — there is currently no
        legitimate platform/system execution primitive in this Django app
        to safely author global rows (see round-32's auth_core.middleware
        docstring: no `SET`/session-scoped platform-authority concept
        exists here), so global-row writes stay fail-closed rather than
        inferring platform authority from ordinary authentication.
      - Ownership class is immutable: a tenant row's organization_id is
        always forced back to the caller's own org on update, discarding
        any client-supplied value — blocking tenant->global, global-
        >tenant, and Org A->Org B reassignment in one place.
    """

    #: Name of the nullable model field distinguishing global (NULL) rows
    #: from tenant-owned (non-NULL) rows.
    tenant_field: str = "organization_id"

    def get_queryset(self):
        qs = super().get_queryset()  # type: ignore[misc]
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            return qs.none()
        return qs.filter(
            Q(**{f"{self.tenant_field}__isnull": True}) | Q(**{self.tenant_field: org_id})
        )

    def perform_create(self, serializer):
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            raise PermissionDenied("Organization context required to create this resource.")
        # Never trust a client-supplied organization_id (including a null/
        # omitted one that would otherwise create a global row): every
        # tenant-authored row is forced into the caller's own organization.
        serializer.save(**{self.tenant_field: org_id})

    def perform_update(self, serializer):
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            raise PermissionDenied("Organization context required to update this resource.")
        instance = serializer.instance
        current_owner = getattr(instance, self.tenant_field)
        if current_owner is None:
            raise PermissionDenied("Global reference rows cannot be modified by ordinary tenant users.")
        if current_owner != org_id:
            # Unreachable in practice (get_queryset() already excludes
            # other orgs' rows from get_object()) — explicit write-side
            # proof, same convention as DirectTenantIsolationMixin.
            raise NotFound()
        # Ownership class is immutable: force organization_id back to the
        # caller's own org on every update, discarding any client-supplied
        # value in the payload.
        serializer.save(**{self.tenant_field: org_id})

    def perform_destroy(self, instance):
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        current_owner = getattr(instance, self.tenant_field)
        if current_owner is None:
            raise PermissionDenied("Global reference rows cannot be deleted by ordinary tenant users.")
        if not org_id or current_owner != org_id:
            raise NotFound()
        instance.delete()


class MultiPartyIsolationMixin:
    """Fail-closed isolation for tables jointly owned by TWO organizations
    via two independent FK columns (e.g. a remitting org and a receiving
    org), where no ordinary-tenant write path is currently proven safe.

    PR #752 round 33 (`per_capita_remittances`): independently traced the
    full ownership graph. `from_organization_id`/`to_organization_id` are
    both NOT NULL (db/schema/domains/infrastructure/clc-per-capita.ts);
    `to_organization_id` is always the remitting org's DIRECT parent at
    creation time (services/clc/per-capita-calculator.ts's
    `calculatePerCapita()`: `toOrganizationId: org.parentId`) — a genuine
    two-party remitter/receiver relationship, not a deeper federation
    graph. The ONLY real write path in the whole app is
    `processMonthlyPerCapita()`, invoked exclusively by
    app/api/cron/monthly-per-capita/route.ts's `auth: { cron: true }`
    system-triggered handler — never an ordinary tenant HTTP request. The
    approval workflow in services/clc/remittance-audit.ts
    (submitForApproval/approveRemittance/rejectRemittance) has ZERO real
    wired callers: its only UI consumer (components/admin/clc-approval-
    workflow.tsx) posts to app/api/admin/clc/remittances/[id]/approve and
    .../reject, which DO NOT EXIST as routes, and the one route that does
    exist at that path (.../[id]/submit/route.ts) is an unwired stub
    ("submit action endpoint for organizationMembers" — copy-paste
    leftover, returns a hardcoded `{action: 'submit', status: 'accepted'}`
    without touching the database). So there is currently NO legitimate
    ordinary-tenant mutation path for this table anywhere in the app —
    only the system cron path (TypeScript, not Django) writes it.

    Policy this mixin enforces, matching that evidence exactly (no
    invented authority):
      - READ (list/retrieve): a verified tenant sees rows where it is
        EITHER the remitting org OR the receiving org. Unrelated
        organizations see nothing; no verified organization context ->
        empty queryset.
      - WRITE (create/update/delete): unconditionally denied via this
        Django endpoint for every caller, regardless of relationship to
        the row. There is no legitimate platform/system execution
        primitive in this Django app to safely distinguish the real
        system-cron write path from an ordinary authenticated request, so
        mutation stays fail-closed here rather than inferring system
        authority from ordinary authentication (the actual system write
        path is the TypeScript cron handler, which never goes through
        this Django endpoint at all).
    """

    #: Model field name holding the remitting/sending organization's id.
    from_field: str = ""
    #: Model field name holding the receiving organization's id.
    to_field: str = ""

    def get_queryset(self):
        qs = super().get_queryset()  # type: ignore[misc]
        org_id = _request_organization_id(self.request)  # type: ignore[attr-defined]
        if not org_id:
            return qs.none()
        return qs.filter(Q(**{self.from_field: org_id}) | Q(**{self.to_field: org_id}))

    def perform_create(self, serializer):
        raise PermissionDenied(
            "Creating this resource requires system/platform authority; "
            "no ordinary-tenant write path exists for this endpoint."
        )

    def perform_update(self, serializer):
        raise PermissionDenied(
            "Modifying this resource requires system/platform authority; "
            "no ordinary-tenant write path exists for this endpoint."
        )

    def perform_destroy(self, instance):
        raise PermissionDenied(
            "Deleting this resource requires system/platform authority; "
            "no ordinary-tenant write path exists for this endpoint."
        )
