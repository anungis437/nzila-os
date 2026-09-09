"""
Round 56 budget_pool containment test.

BudgetPoolViewSet was IsAuthenticated + queryset=Model.objects.all() with
no organization filter (filterset_fields only exposes 'name') — a
cross-tenant financial data leak (any authenticated user could read/write
any organization's budget pool via Django). Zero legitimate consumer
exists: the real app reads budget_pool via tenant-scoped raw SQL in
app/api/finance/summary/route.ts and lib/ai/financial-insights.ts, never
this Django REST path. The sibling BudgetReservationsViewSet already got
DenyAllPermission in round 42 (see tests_round42_budget_reservations_containment.py)
— this closes the missed counterpart.

Run with:

    python -m unittest unions.tests_round56_budget_pool_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402


class Round56BudgetPoolContainmentTests(unittest.TestCase):
    def test_budget_pool_viewset_uses_deny_all(self):
        self.assertEqual(views.BudgetPoolViewSet.permission_classes, [views.DenyAllPermission])

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
