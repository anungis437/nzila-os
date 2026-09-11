"""
Round 47 notifications app communications/SMS/newsletter containment test.

communication_preferences_phase4 (no canonical TS declaration),
sms_campaigns / sms_conversations (real TS routes exist but Django has no
legitimate consumer), sms_campaign_recipients / sms_opt_outs (fully dead TS
code), newsletter_engagement (dead TS code), and newsletter_list_subscribers
(unresolved TS route-shape exception, but Django containment is
independent) all had generated Django ViewSets that were IsAuthenticated-only
with no organization/subject scoping — contained via DenyAllPermission.

Run with:

    python -m unittest notifications.tests_round47_communications_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from notifications import views  # noqa: E402


class Round47CommunicationsContainmentTests(unittest.TestCase):
    def test_communication_preferences_phase4_viewset_uses_deny_all(self):
        self.assertEqual(
            views.CommunicationPreferencesPhase4ViewSet.permission_classes,
            [views.DenyAllPermission],
        )

    def test_sms_campaigns_viewset_uses_deny_all(self):
        self.assertEqual(
            views.SmsCampaignsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_sms_conversations_viewset_uses_deny_all(self):
        self.assertEqual(
            views.SmsConversationsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_sms_campaign_recipients_viewset_uses_deny_all(self):
        self.assertEqual(
            views.SmsCampaignRecipientsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_sms_opt_outs_viewset_uses_deny_all(self):
        self.assertEqual(
            views.SmsOptOutsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_newsletter_engagement_viewset_uses_deny_all(self):
        self.assertEqual(
            views.NewsletterEngagementViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_newsletter_list_subscribers_viewset_uses_deny_all(self):
        self.assertEqual(
            views.NewsletterListSubscribersViewSet.permission_classes,
            [views.DenyAllPermission],
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
