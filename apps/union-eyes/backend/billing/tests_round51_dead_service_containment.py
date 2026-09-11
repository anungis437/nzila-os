"""
Round 51 billing app dead-service containment test
(GLOBAL_REFERENCE_AND_SHARED_CONFIGURATION_SCOPE_AUTHORITY).

Each ViewSet below corresponds to a table whose sole TypeScript consumer
(services/joint-trust-fmv-service.ts, services/whiplash-prevention-service.ts,
lib/services/currency-service.ts, services/currency-enforcement-service.ts, or
lib/services/external-data/clc-partnership-service.ts) has zero production
importers anywhere in app/, actions/, lib/, services/ outside its own test
file (git-grep confirmed) — dead TS code. The generated Django ViewSets
exposed queryset=Model.objects.all() + IsAuthenticated-only with NO
organization filter of any kind — contained via SharedDenyAllPermission
(this app's established containment mixin, see backend/billing/isolation.py).

Run with:

    python -m unittest billing.tests_round51_dead_service_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from billing import views  # noqa: E402

CONTAINED_VIEWSETS = [
    "ClcUnionDensityViewSet",
    "ClcBargainingTrendsViewSet",
    "ClcOauthTokensViewSet",
    "StrikeFundPaymentAuditViewSet",
    "ExchangeRatesViewSet",
    "CrossBorderTransactionsViewSet",
    "FmvPolicyViewSet",
    "CpiDataViewSet",
    "FmvBenchmarksViewSet",
    "ProcurementRequestsViewSet",
    "ProcurementBidsViewSet",
    "IndependentAppraisalsViewSet",
    "CpiAdjustedPricingViewSet",
    "FmvViolationsViewSet",
    "FmvAuditLogViewSet",
]


class Round51BillingDeadServiceContainmentTests(unittest.TestCase):
    def test_all_targeted_viewsets_use_shared_deny_all(self):
        for name in CONTAINED_VIEWSETS:
            viewset = getattr(views, name)
            with self.subTest(viewset=name):
                self.assertEqual(viewset.permission_classes, [views.SharedDenyAllPermission])

    def test_deny_all_still_denies_authenticated_and_anonymous_requests(self):
        permission = views.SharedDenyAllPermission()
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
