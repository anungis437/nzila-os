"""
Round 46 notifications app push_devices containment test.

push_devices is TENANT_RLS_REQUIRED (organization_id + profile_id both NOT
NULL); its real Next.js consumer (app/api/mobile/devices/route.ts) was fixed
this round to scope both reads (ownerColumn) and writes (beforeCreate) to the
caller's own profileId, not just organization_id. The generated Django
ViewSet had neither scoping (IsAuthenticated-only) — contained via
DenyAllPermission.

Run with:

    python -m unittest notifications.tests_round46_push_devices_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from notifications import views  # noqa: E402


class Round46PushDevicesContainmentTests(unittest.TestCase):
    def test_push_devices_viewset_uses_deny_all(self):
        self.assertEqual(
            views.PushDevicesViewSet.permission_classes, [views.DenyAllPermission]
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
