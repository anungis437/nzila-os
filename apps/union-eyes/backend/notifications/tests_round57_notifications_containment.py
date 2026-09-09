"""
Round 57 notifications containment test.

SmsTemplates and UserNotificationPreferences ViewSets were IsAuthenticated-only
+ queryset=Model.objects.all() with no organization/user filter and zero
legitimate frontend consumer (the real preference/SMS flows are served by the
scoped Next.js API routes and workers). Contained via the existing
DenyAllPermission (notifications/views.py).

Run with:

    python -m unittest notifications.tests_round57_notifications_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from notifications import views  # noqa: E402

CONTAINED_VIEWSETS = [
    views.SmsTemplatesViewSet,
    views.UserNotificationPreferencesViewSet,
]


class Round57NotificationsContainmentTests(unittest.TestCase):
    def test_all_targeted_viewsets_use_deny_all(self):
        for viewset in CONTAINED_VIEWSETS:
            with self.subTest(viewset=viewset.__name__):
                self.assertEqual(viewset.permission_classes, [views.DenyAllPermission])

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
