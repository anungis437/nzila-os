"""
Round 51 unions app federation_remittances containment test
(GLOBAL_REFERENCE_AND_SHARED_CONFIGURATION_SCOPE_AUTHORITY).

federation_remittances has ZERO TypeScript consumer anywhere — no Drizzle
export references this table at all. The generated Django ViewSet exposed
queryset=Model.objects.all() + IsAuthenticated-only with NO organization
filter of any kind — contained via DenyAllPermission.

Run with:

    python -m unittest unions.tests_round51_federation_remittances_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402


class Round51FederationRemittancesContainmentTests(unittest.TestCase):
    def test_federation_remittances_viewset_uses_deny_all(self):
        self.assertEqual(
            views.FederationRemittancesViewSet.permission_classes, [views.DenyAllPermission]
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
