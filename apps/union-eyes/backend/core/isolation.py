"""
Structural, fail-closed Django isolation primitives for the core app.

PR #752 round 39: the SIMPLE_TENANT:org external-integration adapter cohort
(18 tables — accounting/HRIS/insurance/LMS external-data mirrors) found
core/views.py's auto-generated ModelViewSets for these tables are
`queryset = Model.objects.all()` + `permission_classes =
[permissions.IsAuthenticated]` with NO org filtering, exactly like the
billing app's round-32 finding (see billing/isolation.py). Independent
verification this round proved these 18 Django REST paths have ZERO real
frontend consumer (no fetch/route reference to any of their
`external-*` router slugs anywhere in the TS app) — so, per the same
precedent used for `social_accounts` (round 37) and `donation_receipts` /
`payment_classification_policy` (round 38), the correct fix is full
containment rather than building and testing 18 org-scoping mixins for
endpoints nothing calls: `DenyAllPermission` on every one of these
ViewSets, regardless of whether the table's underlying TS/adapter path
(if any) is itself reachable — a legitimate TypeScript path (e.g.
`external_invoices` via `app/api/billing/invoices/route.ts`) does not by
itself justify leaving an unrelated, unscoped Django CRUD endpoint open
for the same table.

Unlike billing/isolation.py's `DirectTenantIsolationMixin`, this module
does not attempt to build a scoped-read/write mixin for these 18
ViewSets: none of them have a proven legitimate consumer to preserve
access for, so there is nothing to scope — only to close. Reopen only if
a real, legitimate Django consumer is later built with its own reviewed
authorization design.
"""

from __future__ import annotations

from rest_framework import permissions


class DenyAllPermission(permissions.BasePermission):
    """Fail-closed containment: unconditionally denies every request.

    Applied to ModelViewSets that have zero legitimate consumer (neither a
    real TypeScript caller of the equivalent adapter/route, nor any real
    frontend caller of the Django REST path itself), where the generated
    `ModelViewSet(queryset=Model.objects.all(), permission_classes=
    [IsAuthenticated])` pattern would otherwise expose every organization's
    rows to any authenticated platform user. Remove only once a reviewed,
    org-scoped consumer is actually built for the affected ViewSet.
    """

    def has_permission(self, request, view):
        return False

    def has_object_permission(self, request, view, obj):
        return False
