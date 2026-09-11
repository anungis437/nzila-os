"""
Round 36 wiring-lock tests: reward_wallet_ledger / reward_budget_envelopes
Django containment.

Evidence chain (see db/rls-storage-authority/finance.ts for the full
reasoning): both RewardWalletLedgerViewSet and RewardBudgetEnvelopesViewSet
were full ModelViewSets with queryset=Model.objects.all() and
IsAuthenticated only — no tenant queryset isolation, both router-registered
at api/unions/reward-wallet-ledger/ and api/unions/reward-budget-envelopes/
(REAL, not theoretical reachability). Neither Django model even maps
org_id correctly (RewardWalletLedger has no org_id field at all;
RewardBudgetEnvelopes has only a nullable org_id, missing program_id and
every financial field). No real TS or Django consumer of either REST
endpoint was found anywhere in the app. Contained with DenyAllPermission
per the "no legitimate Django consumer" branch — same disposition as
ai_budgets (round 35) and donation_receipts (round 33).

Run via: python -m unittest unions.tests_round36_reward_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402
from unions.models import RewardBudgetEnvelopes, RewardWalletLedger  # noqa: E402
from rest_framework import viewsets  # noqa: E402


class RewardContainmentTests(unittest.TestCase):
    """Both reward ViewSets must be fail-closed: no operation is authorized."""

    def test_reward_wallet_ledger_viewset_uses_deny_all_permission(self):
        self.assertEqual(views.RewardWalletLedgerViewSet.permission_classes, [views.DenyAllPermission])

    def test_reward_budget_envelopes_viewset_uses_deny_all_permission(self):
        self.assertEqual(views.RewardBudgetEnvelopesViewSet.permission_classes, [views.DenyAllPermission])

    def test_neither_viewset_is_plain_is_authenticated(self):
        # Regression tripwire: a future edit must not silently revert either
        # ViewSet to permissions.IsAuthenticated (the round-31/round-35
        # exposure pattern).
        from rest_framework import permissions

        self.assertNotIn(permissions.IsAuthenticated, views.RewardWalletLedgerViewSet.permission_classes)
        self.assertNotIn(permissions.IsAuthenticated, views.RewardBudgetEnvelopesViewSet.permission_classes)

    def test_both_viewsets_remain_model_viewsets(self):
        # Containment is via permission denial, not via narrowing the
        # viewset class — matches the ai_budgets/donation_receipts precedent.
        self.assertTrue(issubclass(views.RewardWalletLedgerViewSet, viewsets.ModelViewSet))
        self.assertTrue(issubclass(views.RewardBudgetEnvelopesViewSet, viewsets.ModelViewSet))

    def test_deny_all_permission_rejects_every_request(self):
        permission = views.DenyAllPermission()
        self.assertFalse(permission.has_permission(request=None, view=None))
        self.assertFalse(permission.has_object_permission(request=None, view=None, obj=None))

    def test_deny_all_permission_rejects_regardless_of_request_shape(self):
        # negative test 11/12: Django endpoints fail closed regardless of
        # any client-supplied context — no org_id/user_id claim can bypass it.
        permission = views.DenyAllPermission()

        class FakeAuthenticatedRequest:
            user = object()
            organization_id = "11111111-1111-1111-1111-111111111111"

        class FakeRewardRow:
            org_id = "22222222-2222-2222-2222-222222222222"
            user_id = "some-other-user"

        self.assertFalse(permission.has_permission(request=FakeAuthenticatedRequest(), view=None))
        self.assertFalse(
            permission.has_object_permission(
                request=FakeAuthenticatedRequest(), view=None, obj=FakeRewardRow()
            )
        )


class RewardSchemaParityTests(unittest.TestCase):
    """Locks the proven schema drift between each Django model and its real
    physical table (db/schema/domains/infrastructure/rewards.ts;
    db/migrations/0097_nzilaos_rls_org_isolation.sql for RLS). If either
    test starts failing because a model gained the missing columns, the
    containment reasoning above must be re-evaluated (item 13 of the
    round-36 brief: mechanically lock stale schema so a future model
    regeneration triggers authority re-review) \u2014 a schema fix does not by
    itself prove a legitimate consumer or organization-ownership
    enforcement exists.
    """

    WALLET_LEDGER_STALE_FIELDS = {"id", "created_at", "updated_at", "user_id"}
    WALLET_LEDGER_MISSING_FROM_MODEL = {
        "org_id",
        "event_type",
        "amount_credits",
        "balance_after",
        "source_type",
        "source_id",
        "memo",
    }

    BUDGET_ENVELOPE_STALE_FIELDS = {"id", "created_at", "updated_at", "org_id"}
    BUDGET_ENVELOPE_MISSING_FROM_MODEL = {
        "program_id",
        "name",
        "scope_type",
        "scope_ref_id",
        "period",
        "amount_limit",
        "amount_used",
        "starts_at",
        "ends_at",
    }

    def test_reward_wallet_ledger_model_field_set_matches_known_stale_snapshot(self):
        actual_fields = {f.name for f in RewardWalletLedger._meta.get_fields()}
        self.assertEqual(actual_fields, self.WALLET_LEDGER_STALE_FIELDS)

    def test_reward_wallet_ledger_model_is_missing_required_physical_columns(self):
        actual_fields = {f.name for f in RewardWalletLedger._meta.get_fields()}
        missing = self.WALLET_LEDGER_MISSING_FROM_MODEL - actual_fields
        self.assertEqual(missing, self.WALLET_LEDGER_MISSING_FROM_MODEL)

    def test_reward_wallet_ledger_has_no_org_id_field_at_all(self):
        field_names = {f.name for f in RewardWalletLedger._meta.get_fields()}
        self.assertNotIn("org_id", field_names)

    def test_reward_budget_envelopes_model_field_set_matches_known_stale_snapshot(self):
        actual_fields = {f.name for f in RewardBudgetEnvelopes._meta.get_fields()}
        self.assertEqual(actual_fields, self.BUDGET_ENVELOPE_STALE_FIELDS)

    def test_reward_budget_envelopes_model_is_missing_required_physical_columns(self):
        actual_fields = {f.name for f in RewardBudgetEnvelopes._meta.get_fields()}
        missing = self.BUDGET_ENVELOPE_MISSING_FROM_MODEL - actual_fields
        self.assertEqual(missing, self.BUDGET_ENVELOPE_MISSING_FROM_MODEL)

    def test_reward_budget_envelopes_org_id_is_nullable_bare_uuid_not_fk(self):
        field = RewardBudgetEnvelopes._meta.get_field("org_id")
        self.assertEqual(field.get_internal_type(), "UUIDField")
        self.assertTrue(field.null)


if __name__ == "__main__":
    unittest.main()
