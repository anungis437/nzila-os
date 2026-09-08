"""
Round 52 analytics app external-reference-and-sync containment test
(NON_FINANCE_SCOPE_EXCEPTION_REMEDIATION, EXTERNAL_REFERENCE_AND_SYNC family).

wage_benchmarks, cost_of_living_data, external_data_sync_log: the
legitimate path for all three is lib/services/external-data/
wage-enrichment-service.ts's sync* methods, invoked only via the real
CRON_SECRET-gated app/api/cron/external-data-sync/route.ts. Their generated
Django ViewSets exposed queryset=Model.objects.all() + IsAuthenticated-only
with NO organization filter of any kind, and none has a legitimate
consumer of its own -- contained via DenyAllPermission.

NOTE: contribution_rates (ContributionRatesViewSet) is an explicitly frozen
Round-51/52 FINANCE_REFERENCE exception and is deliberately NOT covered by
this test -- see round-52 spec section 5/65.

Run with:

    python -m unittest analytics.tests_round52_external_reference_sync_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from analytics import views  # noqa: E402

CONTAINED_VIEWSETS = [
    "WageBenchmarksViewSet",
    "CostOfLivingDataViewSet",
    "ExternalDataSyncLogViewSet",
]


class Round52ExternalReferenceSyncContainmentTests(unittest.TestCase):
    def test_all_targeted_viewsets_use_deny_all(self):
        for name in CONTAINED_VIEWSETS:
            viewset = getattr(views, name)
            with self.subTest(viewset=name):
                self.assertEqual(viewset.permission_classes, [views.DenyAllPermission])

    def test_contribution_rates_viewset_untouched_finance_freeze(self):
        # FINANCE FREEZE ratchet: contribution_rates must remain exactly as
        # it was before round 52 -- still IsAuthenticated, not touched.
        self.assertEqual(
            views.ContributionRatesViewSet.permission_classes, [views.permissions.IsAuthenticated]
        )

    def test_deny_all_still_denies_authenticated_and_anonymous_requests(self):
        permission = views.DenyAllPermission()
        authenticated_request = MagicMock(user=MagicMock(is_authenticated=True))
        anonymous_request = MagicMock(user=MagicMock(is_authenticated=False))

        self.assertFalse(permission.has_permission(authenticated_request, MagicMock()))
        self.assertFalse(
            permission.has_object_permission(authenticated_request, MagicMock(), MagicMock())
        )
        self.assertFalse(permission.has_permission(anonymous_request, MagicMock()))
        self.assertFalse(
            permission.has_object_permission(anonymous_request, MagicMock(), MagicMock())
        )


if __name__ == "__main__":
    unittest.main()
