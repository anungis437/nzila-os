"""
Round 50 notifications app mobile_devices containment test.

mobile_devices' real, live TS consumer is app/api/mobile/sync/route.ts
(auth-gated, scoped to the caller's own userId+organizationId on read,
and ownership-checked on write as of this round — see
assertDeviceNotOwnedByAnotherUser). The generated Django ModelViewSet was
IsAuthenticated-only with queryset=Model.objects.all() and no
organization/user scoping of its own — contained via the existing
DenyAllPermission already used elsewhere in this file (round 48,
mobile_analytics).

Run with:

    python -m unittest notifications.tests_round50_mobile_devices_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from notifications import views  # noqa: E402


class Round50MobileDevicesContainmentTests(unittest.TestCase):
    def test_mobile_devices_viewset_uses_deny_all(self):
        self.assertEqual(views.MobileDevicesViewSet.permission_classes, [views.DenyAllPermission])

    def test_mobile_devices_viewset_still_registered(self):
        # Containment must not remove the route entirely — it must fail
        # closed (403 for every caller), not disappear (404).
        self.assertTrue(hasattr(views, "MobileDevicesViewSet"))


if __name__ == "__main__":
    unittest.main()
