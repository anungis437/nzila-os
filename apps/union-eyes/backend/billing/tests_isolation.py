"""
Adversarial Org A / Org B isolation tests for billing/isolation.py.

PR #752 round 32 Phase 5. These test the isolation MIXIN LOGIC directly
(get_queryset/perform_create/perform_update/perform_destroy) against
mocked querysets/serializers rather than a live database — this sandbox
has no reachable Postgres server (see round-30/31 evidence: `manage.py
test` fails with "connection to server ... failed: Connection refused").
Mocking the queryset/serializer boundary still gives a real, meaningful
proof: it exercises the exact filter/force/reject decisions the mixin
makes for every operation, which is where the isolation bug lives (the
bug was never "Django can't reach Postgres", it was "the ORM query never
had a WHERE organization_id = ... clause at all"). Run with:

    python -m unittest billing.tests_isolation -v

(not `manage.py test`, which unconditionally tries to create a test
database first).
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from billing.isolation import (  # noqa: E402
    DenyAllPermission,
    DirectTenantIsolationMixin,
    ParentOwnedIsolationMixin,
)

ORG_A = "11111111-1111-1111-1111-111111111111"
ORG_B = "22222222-2222-2222-2222-222222222222"


def make_request(organization_id: str | None):
    request = MagicMock()
    if organization_id is None:
        # Mirror the real middleware: no attribute at all when there is no
        # org context (see auth_core.middleware.OrganizationIsolationMiddleware
        # — it never assigns request.organization_id in that branch).
        del request.organization_id
    else:
        request.organization_id = organization_id
    return request


class DirectTenantIsolationMixinTests(unittest.TestCase):
    """A view using DirectTenantIsolationMixin, DuesTransactions-shaped."""

    def _mixin_with_super(self, organization_id, base_qs):
        # Use a real subclass so super() resolution works without a live model.
        class Base:
            def get_queryset(self):
                return base_qs

        class View(DirectTenantIsolationMixin, Base):
            pass

        view = View()
        view.request = make_request(organization_id)
        return view

    def test_org_a_cannot_list_org_b_rows(self):
        base_qs = MagicMock()
        filtered_qs = MagicMock()
        base_qs.filter.return_value = filtered_qs
        view = self._mixin_with_super(ORG_A, base_qs)

        result = view.get_queryset()

        base_qs.filter.assert_called_once_with(organization_id=ORG_A)
        self.assertIs(result, filtered_qs)

    def test_missing_organization_context_returns_empty_queryset_not_unfiltered(self):
        base_qs = MagicMock()
        view = self._mixin_with_super(None, base_qs)

        result = view.get_queryset()

        base_qs.filter.assert_not_called()
        base_qs.none.assert_called_once()
        self.assertIs(result, base_qs.none.return_value)

    def test_org_a_create_forces_own_org_ignoring_client_payload(self):
        class Base:
            def get_queryset(self):
                return MagicMock()

        class View(DirectTenantIsolationMixin, Base):
            pass

        view = View()
        view.request = make_request(ORG_A)
        serializer = MagicMock()
        # Simulate a forged payload trying to create a row owned by Org B —
        # perform_create must not read this value at all.
        serializer.validated_data = {"organization_id": ORG_B}

        view.perform_create(serializer)

        serializer.save.assert_called_once_with(organization_id=ORG_A)

    def test_create_without_organization_context_is_rejected(self):
        class Base:
            def get_queryset(self):
                return MagicMock()

        class View(DirectTenantIsolationMixin, Base):
            pass

        view = View()
        view.request = make_request(None)
        serializer = MagicMock()

        with self.assertRaises(Exception):
            view.perform_create(serializer)
        serializer.save.assert_not_called()

    def test_org_a_cannot_patch_ownership_to_org_b(self):
        class Base:
            def get_queryset(self):
                return MagicMock()

        class View(DirectTenantIsolationMixin, Base):
            pass

        view = View()
        view.request = make_request(ORG_A)
        serializer = MagicMock()
        serializer.instance = MagicMock(organization_id=ORG_A)

        view.perform_update(serializer)

        # Forced back to ORG_A regardless of any organization_id the client
        # tried to submit in the PATCH body — save() never receives a
        # client-controlled value for the tenant field.
        serializer.save.assert_called_once_with(organization_id=ORG_A)

    def test_org_a_cannot_update_org_b_owned_row(self):
        class Base:
            def get_queryset(self):
                return MagicMock()

        class View(DirectTenantIsolationMixin, Base):
            pass

        view = View()
        view.request = make_request(ORG_A)
        serializer = MagicMock()
        serializer.instance = MagicMock(organization_id=ORG_B)

        with self.assertRaises(Exception):
            view.perform_update(serializer)
        serializer.save.assert_not_called()

    def test_org_a_cannot_delete_org_b_owned_row(self):
        class Base:
            def get_queryset(self):
                return MagicMock()

        class View(DirectTenantIsolationMixin, Base):
            pass

        view = View()
        view.request = make_request(ORG_A)
        instance = MagicMock(organization_id=ORG_B)

        with self.assertRaises(Exception):
            view.perform_destroy(instance)
        instance.delete.assert_not_called()

    def test_org_a_can_delete_its_own_row(self):
        class Base:
            def get_queryset(self):
                return MagicMock()

        class View(DirectTenantIsolationMixin, Base):
            pass

        view = View()
        view.request = make_request(ORG_A)
        instance = MagicMock(organization_id=ORG_A)

        view.perform_destroy(instance)

        instance.delete.assert_called_once()

    def test_unauthenticated_delete_is_rejected(self):
        class Base:
            def get_queryset(self):
                return MagicMock()

        class View(DirectTenantIsolationMixin, Base):
            pass

        view = View()
        view.request = make_request(None)
        instance = MagicMock(organization_id=ORG_A)

        with self.assertRaises(Exception):
            view.perform_destroy(instance)
        instance.delete.assert_not_called()


class ParentOwnedIsolationMixinTests(unittest.TestCase):
    """A view using ParentOwnedIsolationMixin, remittance-line-item-shaped."""

    def _view(self, organization_id, base_qs):
        class Base:
            def get_queryset(self):
                return base_qs

        class View(ParentOwnedIsolationMixin, Base):
            parent_field = "remittance"
            parent_tenant_field = "organization_id"

        view = View()
        view.request = make_request(organization_id)
        return view

    def test_org_a_cannot_list_org_b_child_rows(self):
        base_qs = MagicMock()
        filtered_qs = MagicMock()
        base_qs.filter.return_value = filtered_qs
        view = self._view(ORG_A, base_qs)

        result = view.get_queryset()

        base_qs.filter.assert_called_once_with(remittance__organization_id=ORG_A)
        self.assertIs(result, filtered_qs)

    def test_missing_organization_context_returns_empty_queryset(self):
        base_qs = MagicMock()
        view = self._view(None, base_qs)

        result = view.get_queryset()

        base_qs.filter.assert_not_called()
        self.assertIs(result, base_qs.none.return_value)

    def test_org_a_cannot_create_child_of_org_b_parent(self):
        view = self._view(ORG_A, MagicMock())
        serializer = MagicMock()
        forged_parent = MagicMock(organization_id=ORG_B)
        serializer.validated_data = {"remittance": forged_parent}

        with self.assertRaises(Exception):
            view.perform_create(serializer)
        serializer.save.assert_not_called()

    def test_org_a_can_create_child_of_its_own_parent(self):
        view = self._view(ORG_A, MagicMock())
        serializer = MagicMock()
        own_parent = MagicMock(organization_id=ORG_A)
        serializer.validated_data = {"remittance": own_parent}

        view.perform_create(serializer)

        serializer.save.assert_called_once()

    def test_org_a_cannot_reassign_child_to_org_b_parent_on_update(self):
        view = self._view(ORG_A, MagicMock())
        serializer = MagicMock()
        own_parent = MagicMock(organization_id=ORG_A)
        forged_parent = MagicMock(organization_id=ORG_B)
        serializer.instance = MagicMock(**{"remittance": own_parent})
        serializer.validated_data = {"remittance": forged_parent}

        with self.assertRaises(Exception):
            view.perform_update(serializer)
        serializer.save.assert_not_called()

    def test_org_a_cannot_update_row_already_owned_by_org_b_parent(self):
        view = self._view(ORG_A, MagicMock())
        serializer = MagicMock()
        other_parent = MagicMock(organization_id=ORG_B)
        serializer.instance = MagicMock(**{"remittance": other_parent})
        serializer.validated_data = {}

        with self.assertRaises(Exception):
            view.perform_update(serializer)
        serializer.save.assert_not_called()


class DenyAllPermissionTests(unittest.TestCase):
    def test_denies_every_request_regardless_of_authentication(self):
        permission = DenyAllPermission()
        authenticated_request = MagicMock(user=MagicMock(is_authenticated=True))

        self.assertFalse(permission.has_permission(authenticated_request, MagicMock()))
        self.assertFalse(
            permission.has_object_permission(authenticated_request, MagicMock(), MagicMock())
        )


if __name__ == "__main__":
    unittest.main()
