"""
Round 52 auth_core app pre-auth-identity containment test
(NON_FINANCE_SCOPE_EXCEPTION_REMEDIATION, PRE_AUTH_IDENTITY family).

pending_profiles's legitimate path is app/api/{onboarding,continuity/
inheritance}/route.ts's crudRoutes (readRole now 'support_agent', fixed
this round from 'member'). The generated Django ViewSet exposed
queryset=Model.objects.all() + IsAuthenticated-only with NO organization
filter of any kind and no legitimate consumer of its own -- contained via
DenyAllPermission.

Run with:

    python -m unittest auth_core.tests_round52_pending_profiles_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from auth_core import views  # noqa: E402


class Round52PendingProfilesContainmentTests(unittest.TestCase):
    def test_pending_profiles_viewset_uses_deny_all(self):
        self.assertEqual(
            views.PendingProfilesViewSet.permission_classes, [views.DenyAllPermission]
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
