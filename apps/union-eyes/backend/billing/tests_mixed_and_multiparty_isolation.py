"""
Adversarial tests for GlobalPlusTenantIsolationMixin (account_mappings) and
MultiPartyIsolationMixin (per_capita_remittances).

PR #752 round 33. Same mocked-queryset/serializer approach as
billing/tests_isolation.py (no reachable Postgres in this sandbox) — see
that file's module docstring for why this still proves the isolation
mixin's filter/force/reject decisions. Run with:

    python -m unittest billing.tests_mixed_and_multiparty_isolation -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from django.db.models import Q  # noqa: E402
from rest_framework.exceptions import NotFound, PermissionDenied  # noqa: E402

from billing.isolation import (  # noqa: E402
    GlobalPlusTenantIsolationMixin,
    MultiPartyIsolationMixin,
)

ORG_A = "11111111-1111-1111-1111-111111111111"
ORG_B = "22222222-2222-2222-2222-222222222222"
ORG_C = "33333333-3333-3333-3333-333333333333"


def make_request(organization_id: str | None):
    request = MagicMock()
    if organization_id is None:
        del request.organization_id
    else:
        request.organization_id = organization_id
    return request


# ============================================================================
# account_mappings: GlobalPlusTenantIsolationMixin
# ============================================================================


def make_global_plus_tenant_view(organization_id, base_qs=None):
    class Base:
        def get_queryset(self):
            return base_qs if base_qs is not None else MagicMock()

    class View(GlobalPlusTenantIsolationMixin, Base):
        pass

    view = View()
    view.request = make_request(organization_id)
    return view


class GlobalPlusTenantIsolationMixinReadTests(unittest.TestCase):
    """Org A sees global rows UNION its own rows; never Org B's rows."""

    def test_read_queryset_is_global_rows_union_own_org_rows(self):
        base_qs = MagicMock()
        filtered_qs = MagicMock()
        base_qs.filter.return_value = filtered_qs
        view = make_global_plus_tenant_view(ORG_A, base_qs)

        result = view.get_queryset()

        expected = Q(organization_id__isnull=True) | Q(organization_id=ORG_A)
        base_qs.filter.assert_called_once_with(expected)
        self.assertIs(result, filtered_qs)

    def test_org_b_query_never_includes_org_a_condition(self):
        base_qs = MagicMock()
        view = make_global_plus_tenant_view(ORG_B, base_qs)

        view.get_queryset()

        called_with = base_qs.filter.call_args.args[0]
        unexpected = Q(organization_id__isnull=True) | Q(organization_id=ORG_A)
        self.assertNotEqual(called_with, unexpected)

    def test_missing_organization_context_fails_closed(self):
        base_qs = MagicMock()
        view = make_global_plus_tenant_view(None, base_qs)

        result = view.get_queryset()

        base_qs.filter.assert_not_called()
        base_qs.none.assert_called_once()
        self.assertIs(result, base_qs.none.return_value)


class GlobalPlusTenantIsolationMixinWriteTests(unittest.TestCase):
    """Tenant writes are always forced into the caller's own org; global
    rows are immutable for every ordinary tenant caller."""

    def test_org_a_create_forces_own_org_ignoring_client_payload(self):
        view = make_global_plus_tenant_view(ORG_A)
        serializer = MagicMock()
        serializer.validated_data = {"organization_id": None}  # attempted global creation

        view.perform_create(serializer)

        serializer.save.assert_called_once_with(organization_id=ORG_A)

    def test_create_without_organization_context_is_rejected(self):
        view = make_global_plus_tenant_view(None)
        serializer = MagicMock()

        with self.assertRaises(PermissionDenied):
            view.perform_create(serializer)
        serializer.save.assert_not_called()

    def test_org_a_cannot_mutate_global_row(self):
        view = make_global_plus_tenant_view(ORG_A)
        serializer = MagicMock()
        serializer.instance = MagicMock(organization_id=None)

        with self.assertRaises(PermissionDenied):
            view.perform_update(serializer)
        serializer.save.assert_not_called()

    def test_org_a_cannot_mutate_org_b_row(self):
        view = make_global_plus_tenant_view(ORG_A)
        serializer = MagicMock()
        serializer.instance = MagicMock(organization_id=ORG_B)

        with self.assertRaises(NotFound):
            view.perform_update(serializer)
        serializer.save.assert_not_called()

    def test_org_a_update_of_own_row_reasserts_own_org_discarding_payload(self):
        view = make_global_plus_tenant_view(ORG_A)
        serializer = MagicMock()
        serializer.instance = MagicMock(organization_id=ORG_A)
        serializer.validated_data = {"organization_id": ORG_B}  # forged reassignment attempt

        view.perform_update(serializer)

        serializer.save.assert_called_once_with(organization_id=ORG_A)

    def test_org_a_cannot_delete_global_row(self):
        view = make_global_plus_tenant_view(ORG_A)
        instance = MagicMock(organization_id=None)

        with self.assertRaises(PermissionDenied):
            view.perform_destroy(instance)
        instance.delete.assert_not_called()

    def test_org_a_cannot_delete_org_b_row(self):
        view = make_global_plus_tenant_view(ORG_A)
        instance = MagicMock(organization_id=ORG_B)

        with self.assertRaises(NotFound):
            view.perform_destroy(instance)
        instance.delete.assert_not_called()

    def test_org_a_can_delete_its_own_row(self):
        view = make_global_plus_tenant_view(ORG_A)
        instance = MagicMock(organization_id=ORG_A)

        view.perform_destroy(instance)

        instance.delete.assert_called_once()


# ============================================================================
# per_capita_remittances: MultiPartyIsolationMixin
# ============================================================================


def make_multiparty_view(organization_id, base_qs=None):
    class Base:
        def get_queryset(self):
            return base_qs if base_qs is not None else MagicMock()

    class View(MultiPartyIsolationMixin, Base):
        from_field = "from_organization_id"
        to_field = "to_organization_id"

    view = View()
    view.request = make_request(organization_id)
    return view


class MultiPartyIsolationMixinReadTests(unittest.TestCase):
    """Remitter (from) and receiver (to) can both read; unrelated orgs cannot."""

    def test_read_queryset_is_from_org_or_to_org(self):
        base_qs = MagicMock()
        filtered_qs = MagicMock()
        base_qs.filter.return_value = filtered_qs
        view = make_multiparty_view(ORG_A, base_qs)

        result = view.get_queryset()

        expected = Q(from_organization_id=ORG_A) | Q(to_organization_id=ORG_A)
        base_qs.filter.assert_called_once_with(expected)
        self.assertIs(result, filtered_qs)

    def test_receiving_org_query_differs_from_remitting_org_query(self):
        base_qs_remitter = MagicMock()
        base_qs_receiver = MagicMock()
        remitter_view = make_multiparty_view(ORG_A, base_qs_remitter)
        receiver_view = make_multiparty_view(ORG_B, base_qs_receiver)

        remitter_view.get_queryset()
        receiver_view.get_queryset()

        remitter_call = base_qs_remitter.filter.call_args.args[0]
        receiver_call = base_qs_receiver.filter.call_args.args[0]
        self.assertNotEqual(remitter_call, receiver_call)

    def test_unrelated_org_c_condition_is_not_satisfied_by_org_a_or_b_query(self):
        base_qs = MagicMock()
        view = make_multiparty_view(ORG_A, base_qs)

        view.get_queryset()

        called_with = base_qs.filter.call_args.args[0]
        unrelated = Q(from_organization_id=ORG_C) | Q(to_organization_id=ORG_C)
        self.assertNotEqual(called_with, unrelated)

    def test_missing_organization_context_fails_closed(self):
        base_qs = MagicMock()
        view = make_multiparty_view(None, base_qs)

        result = view.get_queryset()

        base_qs.filter.assert_not_called()
        base_qs.none.assert_called_once()
        self.assertIs(result, base_qs.none.return_value)


class MultiPartyIsolationMixinWriteTests(unittest.TestCase):
    """No ordinary-tenant write path exists for this table (system-cron
    only, entirely outside Django) — every mutation is denied regardless
    of the caller's relationship to the row."""

    def test_remitting_org_cannot_create(self):
        view = make_multiparty_view(ORG_A)
        serializer = MagicMock()

        with self.assertRaises(PermissionDenied):
            view.perform_create(serializer)
        serializer.save.assert_not_called()

    def test_receiving_org_cannot_update(self):
        view = make_multiparty_view(ORG_B)
        serializer = MagicMock()
        serializer.instance = MagicMock(from_organization_id=ORG_A, to_organization_id=ORG_B)

        with self.assertRaises(PermissionDenied):
            view.perform_update(serializer)
        serializer.save.assert_not_called()

    def test_remitting_org_cannot_delete(self):
        view = make_multiparty_view(ORG_A)
        instance = MagicMock(from_organization_id=ORG_A, to_organization_id=ORG_B)

        with self.assertRaises(PermissionDenied):
            view.perform_destroy(instance)
        instance.delete.assert_not_called()

    def test_missing_organization_context_still_denied_on_write_not_merely_empty_read(self):
        # Even though get_queryset() would already exclude an unauthenticated
        # caller's access, perform_create/update/destroy independently deny
        # every write regardless of organization context.
        view = make_multiparty_view(None)
        serializer = MagicMock()

        with self.assertRaises(PermissionDenied):
            view.perform_create(serializer)


if __name__ == "__main__":
    unittest.main()
