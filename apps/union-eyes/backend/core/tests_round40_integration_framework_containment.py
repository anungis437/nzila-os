"""
Round 40 integration framework containment tests.

The new production surface is TypeScript-only under app/api/integrations/framework.
Generated Django mirrors for integration library tables remain router-visible but
unconditionally denied; they are not an alternate CRUD surface.

Run with:

    python -m unittest core.tests_round40_integration_framework_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from core import views  # noqa: E402


class Round40IntegrationFrameworkContainmentTests(unittest.TestCase):
    def test_generated_integration_viewsets_use_core_deny_all(self):
        viewsets = [
            views.ExternalCommunicationChannelsViewSet,
            views.ExternalCommunicationUsersViewSet,
            views.ExternalDocumentLibrariesViewSet,
            views.ExternalDocumentSitesViewSet,
            views.ExternalInsuranceClaimsViewSet,
            views.IntegrationConfigsViewSet,
            views.SupportTicketsViewSet,
            views.WebhookEventsViewSet,
        ]

        for viewset in viewsets:
            with self.subTest(viewset=viewset.__name__):
                self.assertEqual(viewset.permission_classes, [views.DenyAllPermission])

    def test_core_deny_all_still_denies_authenticated_and_anonymous_requests(self):
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
