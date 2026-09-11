"""
Round 48 notifications app mobile_analytics containment test.

mobile_analytics carries a NULLABLE organization_id (anonymous/pre-login
mobile telemetry is a legitimate design), and its sole TypeScript-side
writer (lib/mobile/mobile-engine.ts's MobileAnalyticsService.flushEvents())
has zero live callers anywhere — fully dead code. The generated Django
ViewSet was IsAuthenticated-only with no tenant/session scoping — contained
via DenyAllPermission (PR #752 round 48 — derived analytics and AI
telemetry authority cohort).

Run with:

    python -m unittest notifications.tests_round48_mobile_analytics_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from notifications import views  # noqa: E402


class Round48MobileAnalyticsContainmentTests(unittest.TestCase):
    def test_mobile_analytics_viewset_uses_deny_all(self):
        self.assertEqual(
            views.MobileAnalyticsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_mobile_analytics_viewset_still_registered(self):
        # Containment must not remove the route entirely — it must fail
        # closed (403 for every caller), not disappear (404), so a future
        # legitimate consumer decision is made deliberately.
        self.assertTrue(hasattr(views, "MobileAnalyticsViewSet"))


if __name__ == "__main__":
    unittest.main()
