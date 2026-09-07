"""
Round 45 notifications app newsletter containment test.

newsletter_distribution_lists and newsletter_campaigns each carry their own
NOT NULL organization_id and are properly org-scoped by their real Next.js
consumers (crudRoutes({orgScoped: true}) for distribution lists; a
read-only org-verified route for campaigns). The generated Django
ViewSets exposed queryset=Model.objects.all() + IsAuthenticated-only with
NO organization scoping of any kind — contained via DenyAllPermission.

Run with:

    python -m unittest notifications.tests_round45_newsletter_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from notifications import views  # noqa: E402


class Round45NewsletterContainmentTests(unittest.TestCase):
    def test_newsletter_distribution_lists_viewset_uses_deny_all(self):
        self.assertEqual(
            views.NewsletterDistributionListsViewSet.permission_classes,
            [views.DenyAllPermission],
        )

    def test_newsletter_campaigns_viewset_uses_deny_all(self):
        self.assertEqual(
            views.NewsletterCampaignsViewSet.permission_classes, [views.DenyAllPermission]
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
