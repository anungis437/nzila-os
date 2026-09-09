"""
Round 57 integration/system execution containment test.

AutomationRules and IntegrationSyncSchedules ViewSets were IsAuthenticated-only
+ queryset=Model.objects.all() with no organization filter and zero
legitimate frontend consumer. Contained via the existing DenyAllPermission
(core/isolation.py, imported into core/views.py).

Run with:

    python -m unittest core.tests_round57_integration_execution_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from core import views  # noqa: E402

CONTAINED_VIEWSETS = [
    views.AutomationRulesViewSet,
    views.IntegrationSyncSchedulesViewSet,
]


class Round57IntegrationExecutionContainmentTests(unittest.TestCase):
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
