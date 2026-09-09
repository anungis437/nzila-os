"""
Round 56 payments containment test.

PaymentsViewSet was IsAuthenticated + queryset=Model.objects.all() with no
organization filter (not even in filterset_fields) — a cross-tenant
financial data leak (any authenticated user could list every
organization's payments via Django). Zero legitimate consumer found (no
frontend caller of /api/billing/payments/). The sibling
StrikeFundDisbursements/Rl1TaxSlips/T4aTaxSlips ViewSets already got
DenyAllPermission in rounds 30/32 — this closes the missed counterpart.

Run with:

    python -m unittest billing.tests_round56_payments_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from billing import views  # noqa: E402


class Round56PaymentsContainmentTests(unittest.TestCase):
    def test_payments_viewset_uses_deny_all(self):
        self.assertEqual(views.PaymentsViewSet.permission_classes, [views.DenyAllPermission])

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
