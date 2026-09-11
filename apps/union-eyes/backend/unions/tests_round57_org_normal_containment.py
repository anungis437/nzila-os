"""
Round 57 unions org-normal containment test.

EventAttendees and RewardRedemptions ViewSets were IsAuthenticated-only +
queryset=Model.objects.all() with no organization filter and zero legitimate
frontend consumer (calendar/reward flows are served by the scoped Next.js API
routes). Contained via the existing DenyAllPermission (unions/views.py).

Run with:

    python -m unittest unions.tests_round57_org_normal_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402

CONTAINED_VIEWSETS = [
    views.EventAttendeesViewSet,
    views.RewardRedemptionsViewSet,
]


class Round57OrgNormalContainmentTests(unittest.TestCase):
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
