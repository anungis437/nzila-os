"""
Round 46 analytics app union_density containment test.

union_density has no organization_id column at all — genuinely global
reference data synced only by the real app/api/cron/external-data-sync
cron job. The generated Django ViewSet defaulted to full CRUD for any
authenticated user (IsAuthenticated-only) — contained via DenyAllPermission.

Run with:

    python -m unittest analytics.tests_round46_union_density_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from analytics import views  # noqa: E402


class Round46UnionDensityContainmentTests(unittest.TestCase):
    def test_union_density_viewset_uses_deny_all(self):
        self.assertEqual(
            views.UnionDensityViewSet.permission_classes, [views.DenyAllPermission]
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
