"""
Round 47 compliance app consent containment test.

user_consents is TENANT_RLS_REQUIRED with per-subject (user_id) scoping now
enforced at the Next.js route level; cookie_consents is TENANT_RLS_REQUIRED
with a legitimate anonymous/pre-login access model. Both generated Django
ViewSets were IsAuthenticated-only with no scoping — contained via the
existing DenyAllPermission.

Run with:

    python -m unittest compliance.tests_round47_consent_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from compliance import views  # noqa: E402


class Round47ConsentContainmentTests(unittest.TestCase):
    def test_user_consents_viewset_uses_deny_all(self):
        self.assertEqual(
            views.UserConsentsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_cookie_consents_viewset_uses_deny_all(self):
        self.assertEqual(
            views.CookieConsentsViewSet.permission_classes, [views.DenyAllPermission]
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
