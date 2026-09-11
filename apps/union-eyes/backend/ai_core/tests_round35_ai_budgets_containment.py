"""
Round 35 wiring-lock tests: AiBudgets authority convergence.

Evidence chain (see db/rls-storage-authority/finance.ts "ai_budgets" entry
for the full reasoning): AiBudgetsViewSet was a full ModelViewSet with
queryset=AiBudgets.objects.all() and IsAuthenticated only — no tenant
queryset isolation, router-registered at api/ai_core/ai-budgets/ (REAL,
not theoretical reachability). The Django model only ever mapped
organization_id (nullable), never learning the real physical table's NOT
NULL monthly_limit_usd/billing_period_start/billing_period_end columns
(db/migrations/0079_ai_cost_tracking_phase1.sql) — so even if permission
were granted, create() would violate DB constraints. No real TS or Django
consumer of this endpoint was found anywhere in the app (the only TS
callers of the aiBudgets-reading methods are that service's own unit
tests). Contained with DenyAllPermission per the "no legitimate Django
consumer" branch of the round-35 decision tree (same disposition as
donation_receipts in round 33) — this is a regression lock, not a re-proof
of an isolation mixin (there is no mixin here; the mechanism is denial).

Run via: python -m unittest ai_core.tests_round35_ai_budgets_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from ai_core import views  # noqa: E402
from ai_core.models import AiBudgets  # noqa: E402
from rest_framework import viewsets  # noqa: E402


class AiBudgetsContainmentTests(unittest.TestCase):
    """AiBudgetsViewSet must be fail-closed: no operation is authorized."""

    def test_ai_budgets_viewset_uses_deny_all_permission(self):
        self.assertEqual(views.AiBudgetsViewSet.permission_classes, [views.DenyAllPermission])

    def test_ai_budgets_viewset_is_no_longer_plain_is_authenticated(self):
        # Regression tripwire: a future edit must not silently revert this
        # to permissions.IsAuthenticated (the round-31/round-34 exposure).
        from rest_framework import permissions

        self.assertNotIn(permissions.IsAuthenticated, views.AiBudgetsViewSet.permission_classes)

    def test_ai_budgets_viewset_remains_a_model_viewset(self):
        # Containment is via permission denial, not via narrowing the
        # viewset class — matches the donation_receipts precedent.
        self.assertTrue(issubclass(views.AiBudgetsViewSet, viewsets.ModelViewSet))

    def test_deny_all_permission_rejects_every_request(self):
        # Negative fixture, not just a class-attribute assertion: exercise
        # the actual has_permission/has_object_permission logic.
        permission = views.DenyAllPermission()
        self.assertFalse(permission.has_permission(request=None, view=None))
        self.assertFalse(permission.has_object_permission(request=None, view=None, obj=None))

    def test_deny_all_permission_rejects_regardless_of_request_shape(self):
        # No client-controlled bypass: denial does not depend on any
        # attribute of the request/view/obj, so it cannot be defeated by
        # supplying a crafted organization_id, role claim, or object.
        permission = views.DenyAllPermission()

        class FakeAuthenticatedRequest:
            user = object()
            organization_id = "11111111-1111-1111-1111-111111111111"

        class FakeBudgetRow:
            organization_id = "22222222-2222-2222-2222-222222222222"

        self.assertFalse(permission.has_permission(request=FakeAuthenticatedRequest(), view=None))
        self.assertFalse(
            permission.has_object_permission(
                request=FakeAuthenticatedRequest(), view=None, obj=FakeBudgetRow()
            )
        )


class AiBudgetsSchemaParityTests(unittest.TestCase):
    """Locks the proven schema drift between the Django model and the
    real physical table (db/migrations/0079_ai_cost_tracking_phase1.sql /
    db/schema/domains/ml/chatbot.ts). If this test starts failing because
    the model gained the missing columns, the containment reasoning above
    must be re-evaluated — a schema fix does not by itself prove a legitimate
    consumer or organization-ownership enforcement exists."""

    EXPECTED_STALE_FIELDS = {"id", "created_at", "updated_at", "organization_id"}

    REQUIRED_PHYSICAL_COLUMNS_MISSING_FROM_MODEL = {
        "monthly_limit_usd",
        "current_spend_usd",
        "alert_threshold",
        "hard_limit",
        "billing_period_start",
        "billing_period_end",
    }

    def test_model_field_set_matches_known_stale_snapshot(self):
        actual_fields = {f.name for f in AiBudgets._meta.get_fields()}
        self.assertEqual(actual_fields, self.EXPECTED_STALE_FIELDS)

    def test_model_is_missing_required_physical_columns(self):
        actual_fields = {f.name for f in AiBudgets._meta.get_fields()}
        missing = self.REQUIRED_PHYSICAL_COLUMNS_MISSING_FROM_MODEL - actual_fields
        self.assertEqual(missing, self.REQUIRED_PHYSICAL_COLUMNS_MISSING_FROM_MODEL)

    def test_organization_id_is_not_a_real_foreign_key_on_the_model(self):
        # Unlike sibling models in this app (e.g. MlPredictions.organization
        # is a real ForeignKey), AiBudgets.organization_id is a bare
        # UUIDField — the model was never taught the FK relationship either.
        field = AiBudgets._meta.get_field("organization_id")
        self.assertEqual(field.get_internal_type(), "UUIDField")
        self.assertTrue(field.null)


if __name__ == "__main__":
    unittest.main()
