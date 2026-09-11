"""
Round 56 integration credential containment tests.

IntegrationApiKeysViewSet and IntegrationWebhooksViewSet were generic
Django ModelViewSets (queryset=Model.objects.all(), permission_classes=
[IsAuthenticated], serializer fields='__all__') with zero legitimate
consumer — the real production surface reads/writes integration_api_keys
via the TypeScript crud-factory route (app/api/integrations/api-keys) and
integration_webhooks via a tenant-scoped raw SQL query (the integrations
dashboard page), neither of which ever calls this Django REST path.
IntegrationWebhooksViewSet in particular leaked the raw webhook signing
secret cross-tenant to any authenticated platform user. Both are now
unconditionally denied.

Run with:

    python -m unittest core.tests_round56_integration_credentials_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from core import views  # noqa: E402


class Round56IntegrationCredentialsContainmentTests(unittest.TestCase):
    def test_integration_credential_viewsets_use_core_deny_all(self):
        viewsets = [
            views.IntegrationApiKeysViewSet,
            views.IntegrationWebhooksViewSet,
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
