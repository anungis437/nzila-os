"""
Round 52 compliance app location/geofence Django containment test
(NON_FINANCE_SCOPE_EXCEPTION_REMEDIATION).

geofences, location_tracking_config, and location_deletion_log all have
zero legitimate Django consumer (the Next.js frontend never calls this
Django backend). geofences is tenant-scoped by unionLocalId on the
TypeScript side; location_tracking_config is a platform-wide singleton
config; location_deletion_log is write-only compliance evidence with no
organization/user column at all. All three generated ViewSets were
IsAuthenticated-only with no scoping — contained via DenyAllPermission.

Run with:

    python -m unittest compliance.tests_round52_location_geofence_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from compliance import views  # noqa: E402

CONTAINED_VIEWSETS = [
    "GeofencesViewSet",
    "LocationTrackingConfigViewSet",
    "LocationDeletionLogViewSet",
]


class Round52LocationGeofenceContainmentTests(unittest.TestCase):
    def test_all_targeted_viewsets_use_deny_all(self):
        for name in CONTAINED_VIEWSETS:
            viewset = getattr(views, name)
            with self.subTest(viewset=name):
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
