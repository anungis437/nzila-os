"""
Round 52 bargaining app directory-profile containment test
(NON_FINANCE_SCOPE_EXCEPTION_REMEDIATION, DIRECTORY_PROFILE family).

arbitrator_profiles's sole TypeScript consumer, lib/services/
precedent-service.ts's getArbitratorProfile/updateArbitratorStats/
getTopArbitrators, has zero production callers anywhere (git-grep
confirmed) -- dead TS code. The generated Django ViewSet exposed
queryset=Model.objects.all() + IsAuthenticated-only with NO organization
filter of any kind -- contained via DenyAllPermission.

Run with:

    python -m unittest bargaining.tests_round52_arbitrator_profiles_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from bargaining import views  # noqa: E402


class Round52ArbitratorProfilesContainmentTests(unittest.TestCase):
    def test_arbitrator_profiles_viewset_uses_deny_all(self):
        self.assertEqual(
            views.ArbitratorProfilesViewSet.permission_classes, [views.DenyAllPermission]
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
