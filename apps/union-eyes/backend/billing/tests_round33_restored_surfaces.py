"""
Round 33 wiring-lock tests: confirm each ViewSet touched this round uses the
EXACT isolation mechanism its manifest disposition claims, and that the
ViewSets deliberately left contained (Category C/D in the round-33 DenyAll
inventory, PLUS donation_receipts — re-contained by the round-33
correction after independent review found no proven tenant CRUD authority)
still are. This is a regression lock, not a re-proof of mixin logic (that's
covered by tests_isolation.py and tests_mixed_and_multiparty_isolation.py)
— it fails loudly if a future edit silently swaps a ViewSet's
permission_classes/mixin without updating the evidence in finance.ts.

Run via: python -m unittest billing.tests_round33_restored_surfaces -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from billing import views  # noqa: E402
from billing.isolation import (  # noqa: E402
    DenyAllPermission,
    GlobalPlusTenantIsolationMixin,
    MultiPartyIsolationMixin,
)
from rest_framework import permissions, viewsets  # noqa: E402


class RestoredSurfaceWiringTests(unittest.TestCase):
    """Surfaces restored/remediated this round: correct mixin + permission."""

    def test_account_mappings_uses_global_plus_tenant_mixin_read_only(self):
        self.assertTrue(issubclass(views.AccountMappingsViewSet, GlobalPlusTenantIsolationMixin))
        self.assertTrue(issubclass(views.AccountMappingsViewSet, viewsets.ReadOnlyModelViewSet))
        self.assertFalse(issubclass(views.AccountMappingsViewSet, viewsets.ModelViewSet))
        self.assertEqual(views.AccountMappingsViewSet.permission_classes, [permissions.IsAuthenticated])
        self.assertEqual(views.AccountMappingsViewSet.tenant_field, "organization_id")

    def test_per_capita_remittances_uses_multi_party_mixin_with_correct_fields(self):
        self.assertTrue(issubclass(views.PerCapitaRemittancesViewSet, MultiPartyIsolationMixin))
        self.assertEqual(views.PerCapitaRemittancesViewSet.permission_classes, [permissions.IsAuthenticated])
        self.assertEqual(views.PerCapitaRemittancesViewSet.from_field, "from_organization_id")
        self.assertEqual(views.PerCapitaRemittancesViewSet.to_field, "to_organization_id")


class RemainingContainedSurfacesStillDenyAllTests(unittest.TestCase):
    """Category C/D surfaces from the round-33 DenyAll inventory (no
    reliable per-tenant ownership key, or ambiguous platform-vs-tenant
    scope) must remain fail-closed — this is a regression lock, not a new
    finding: none of these were re-evaluated for remediation this round.
    donation_receipts is included here too: it WAS restored earlier in
    round 33, then re-contained by the same round's correction pass after
    independent review found a clean FK proves scoping is possible but does
    not prove tenants are supposed to have CRUD authority — no production
    consumer or business authority model was ever traced for it."""

    STILL_CONTAINED = [
        "RemittanceApprovalsViewSet",
        "DonationReceiptsViewSet",
        "StripeConnectAccountsViewSet",
        "PaymentClassificationPolicyViewSet",
        "PaymentRoutingRulesViewSet",
        "SeparatedPaymentTransactionsViewSet",
        "AccountBalanceReconciliationViewSet",
        "T4aTaxSlipsViewSet",
        "Rl1TaxSlipsViewSet",
        "TaxYearEndProcessingViewSet",
        "StrikeFundDisbursementsViewSet",
    ]

    def test_all_still_contained_viewsets_use_deny_all_permission(self):
        # NOTE: views.py has TWO functionally-identical DenyAllPermission
        # classes: isolation.DenyAllPermission (round 32+, imported as
        # views.SharedDenyAllPermission) and a local views.DenyAllPermission
        # left over from round 30 (predates isolation.py). Both
        # unconditionally deny every request; StrikeFundDisbursementsViewSet
        # still uses the local one. Not consolidated this round (out of
        # scope) — this test accepts either, since the security property
        # (unconditional denial) is identical either way.
        for name in self.STILL_CONTAINED:
            viewset = getattr(views, name)
            with self.subTest(viewset=name):
                self.assertEqual(len(viewset.permission_classes), 1)
                self.assertIn(
                    viewset.permission_classes[0],
                    (views.SharedDenyAllPermission, views.DenyAllPermission),
                )
                self.assertIs(views.SharedDenyAllPermission, DenyAllPermission)


if __name__ == "__main__":
    unittest.main()
