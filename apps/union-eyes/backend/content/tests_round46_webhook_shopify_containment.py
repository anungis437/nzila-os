"""
Round 46 content app webhook_receipts / shopify_config containment test.

webhook_receipts has no organization_id column at all — genuinely global,
webhook-invoked replay-protection infrastructure. shopify_config stores
per-organization secret REFERENCES (not raw secrets). Both generated Django
ViewSets were IsAuthenticated-only with no scoping — contained via the
existing Round40DenyAllPermission already used elsewhere in this file.

Run with:

    python -m unittest content.tests_round46_webhook_shopify_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from content import views  # noqa: E402


class Round46WebhookShopifyContainmentTests(unittest.TestCase):
    def test_webhook_receipts_viewset_uses_deny_all(self):
        self.assertEqual(
            views.WebhookReceiptsViewSet.permission_classes,
            [views.Round40DenyAllPermission],
        )

    def test_shopify_config_viewset_uses_deny_all(self):
        self.assertEqual(
            views.ShopifyConfigViewSet.permission_classes,
            [views.Round40DenyAllPermission],
        )

    def test_deny_all_still_denies_authenticated_and_anonymous_requests(self):
        permission = views.Round40DenyAllPermission()
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
