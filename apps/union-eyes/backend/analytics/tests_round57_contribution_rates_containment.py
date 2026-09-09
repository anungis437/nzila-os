"""
Round 57 analytics containment test.

ContributionRates ViewSet was IsAuthenticated-only + queryset=
Model.objects.all() with no organization filter and zero legitimate frontend
consumer (wage-benchmark data is served by GraphQL resolvers and the
external-data enrichment service, not this Django REST surface). Contained
via the existing DenyAllPermission (analytics/views.py).

Run with:

    python -m unittest analytics.tests_round57_contribution_rates_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from analytics import views  # noqa: E402


class Round57ContributionRatesContainmentTests(unittest.TestCase):
    def test_contribution_rates_viewset_uses_deny_all(self):
        self.assertEqual(views.ContributionRatesViewSet.permission_classes, [views.DenyAllPermission])

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
