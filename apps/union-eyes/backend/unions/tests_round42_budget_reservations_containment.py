"""
Round 42 budget_reservations containment test.

budget_reservations has no organization_id column (scopes only through
pool_id -> budgetPool). lib/services/rewards/budget-service.ts's
reservation-specific exports (reserveBudget, confirmBudgetReservation,
releaseReservedBudget, releaseReservationsByReference,
cleanupExpiredReservations, checkBudgetWithReservations,
getActiveReservations) have zero real callers anywhere in app/, actions/,
lib/, services/ outside their own test file — dead code. The generated
Django BudgetReservations ViewSet had zero legitimate consumer and
previously exposed queryset=Model.objects.all() + IsAuthenticated-only with
NO organization filter of any kind (the model has no tenant key) —
contained via DenyAllPermission.

Run with:

    python -m unittest unions.tests_round42_budget_reservations_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402


class Round42BudgetReservationsContainmentTests(unittest.TestCase):
    def test_budget_reservations_viewset_uses_deny_all(self):
        self.assertEqual(
            views.BudgetReservationsViewSet.permission_classes, [views.DenyAllPermission]
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
