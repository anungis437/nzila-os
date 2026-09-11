"""
Round 52 content app derived-movement-insight containment test
(NON_FINANCE_SCOPE_EXCEPTION_REMEDIATION, DERIVED_MOVEMENT_INSIGHT family).

movement_trends is a genuine cross-organization aggregate (no
organizationId column by design). Its legitimate path is exclusively the
two read-only, officer-role-gated Next.js pages
(app/[locale]/dashboard/movement-insights/{page,export/page}.tsx); no
application code anywhere ever writes this table. The generated Django
ViewSet exposed queryset=Model.objects.all() + IsAuthenticated-only with
no officer-role gate and full CRUD -- contained via DenyAllPermission.

Run with:

    python -m unittest content.tests_round52_movement_trends_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from content import views  # noqa: E402


class Round52MovementTrendsContainmentTests(unittest.TestCase):
    def test_movement_trends_viewset_uses_deny_all(self):
        self.assertEqual(
            views.MovementTrendsViewSet.permission_classes, [views.DenyAllPermission]
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
