"""
Round 50 ai_core app AB-testing containment test.

ab_tests, ab_test_variants, ab_test_assignments, ab_test_events are all
CONTAINED_NO_AUTHORITY: lib/ab-testing/ab-test-engine.ts (the TS side) has
zero real callers anywhere under app/, actions/, lib/, services/. The
generated Django ModelViewSets were IsAuthenticated-only with
queryset=Model.objects.all() and no organization scoping at all —
contained via the existing DenyAllPermission already used elsewhere in
this file (round 35, AiBudgets).

Run with:

    python -m unittest ai_core.tests_round50_ab_testing_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from ai_core import views  # noqa: E402


class Round50AbTestingContainmentTests(unittest.TestCase):
    def test_ab_tests_viewset_uses_deny_all(self):
        self.assertEqual(views.AbTestsViewSet.permission_classes, [views.DenyAllPermission])

    def test_ab_test_variants_viewset_uses_deny_all(self):
        self.assertEqual(views.AbTestVariantsViewSet.permission_classes, [views.DenyAllPermission])

    def test_ab_test_assignments_viewset_uses_deny_all(self):
        self.assertEqual(views.AbTestAssignmentsViewSet.permission_classes, [views.DenyAllPermission])

    def test_ab_test_events_viewset_uses_deny_all(self):
        self.assertEqual(views.AbTestEventsViewSet.permission_classes, [views.DenyAllPermission])

    def test_deny_all_denies_authenticated_and_anonymous_requests(self):
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
