"""
Round 53 analytics app reports containment test
(FINAL_SIMPLE_TENANT_EXCEPTION_CLOSURE, REPORTING family).

ReportsViewSet was generated with queryset=Reports.objects.all() +
IsAuthenticated-only and NO organization filter of any kind. The real,
live authority surface for reports is the Next.js crudRoutes-based
app/api/reports/route.ts and [id]/route.ts (org-scoped). No legitimate
consumer of the Django REST path was found. Contained via
DenyAllPermission.

Run with:

    python -m unittest analytics.tests_round53_reports_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from analytics import views  # noqa: E402


class Round53ReportsContainmentTests(unittest.TestCase):
    def test_reports_viewset_uses_deny_all(self):
        self.assertEqual(views.ReportsViewSet.permission_classes, [views.DenyAllPermission])

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
