"""
Round 57 finance-reference/execution containment test.

Eleven billing ViewSets (autopay settings, Bank of Canada rates, currency
enforcement policy/violations/audit, T106 filing tracking, transfer pricing
documentation, FX rate audit log, transaction currency conversions, sync
jobs, and weekly threshold tracking) were IsAuthenticated-only + queryset=
Model.objects.all() with no organization filter and zero legitimate
frontend consumer (the real Next.js API routes for these tables never call
the Django REST surface). Contained via the existing SharedDenyAllPermission
(billing/isolation.py) — no other sibling in this file already covered
these.

Run with:

    python -m unittest billing.tests_round57_finance_reference_containment -v
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
    views.AutopaySettingsViewSet,
    views.BankOfCanadaRatesViewSet,
    views.CurrencyEnforcementPolicyViewSet,
    views.CurrencyEnforcementViolationsViewSet,
    views.T106FilingTrackingViewSet,
    views.TransferPricingDocumentationViewSet,
    views.FxRateAuditLogViewSet,
    views.TransactionCurrencyConversionsViewSet,
    views.CurrencyEnforcementAuditViewSet,
    views.SyncJobsViewSet,
    views.WeeklyThresholdTrackingViewSet,
]


class Round57FinanceReferenceContainmentTests(unittest.TestCase):
    def test_all_targeted_viewsets_use_shared_deny_all(self):
        for viewset in CONTAINED_VIEWSETS:
            with self.subTest(viewset=viewset.__name__):
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
