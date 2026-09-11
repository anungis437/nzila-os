"""
Round 41 api_integrations containment test.

api_integrations is closed TENANT_RLS_REQUIRED via the org-scoped TypeScript
route app/api/extensions/[id]/route.ts. The generated Django ApiIntegrations
ViewSet has zero legitimate consumer and previously exposed
queryset=Model.objects.all() + IsAuthenticated-only (with a client-controlled,
unenforced organization_id filterset field) — contained via DenyAllPermission.

Run with:

    python -m unittest core.tests_round41_api_integrations_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from core import views  # noqa: E402


class Round41ApiIntegrationsContainmentTests(unittest.TestCase):
    def test_api_integrations_viewset_uses_deny_all(self):
        self.assertEqual(
            views.ApiIntegrationsViewSet.permission_classes, [views.DenyAllPermission]
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
