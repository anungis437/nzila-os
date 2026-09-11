"""
Round 54 final non-voting parent-owned authority convergence containment test.

Covers Django containment for the round-54 cohort:
  unions app: AwardTemplatesViewSet, AwardHistoryViewSet.
  auth_core app: AddressChangeHistoryViewSet.
  ai_core app: AiSafetyFiltersViewSet.
  notifications app: MobileSyncQueueViewSet, PushDeliveriesViewSet.
  compliance app: FirewallAccessRulesViewSet, FirewallViolationsViewSet.
  content app: SignersViewSet, SignatureVerificationViewSet.

Run with:

    python -m unittest unions.tests_round54_parent_owned_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views as unions_views  # noqa: E402
from auth_core import views as auth_core_views  # noqa: E402
from ai_core import views as ai_core_views  # noqa: E402
from notifications import views as notifications_views  # noqa: E402
from compliance import views as compliance_views  # noqa: E402
from content import views as content_views  # noqa: E402


class Round54UnionsContainmentTests(unittest.TestCase):
    def test_award_templates_viewset_uses_deny_all(self):
        self.assertEqual(
            unions_views.AwardTemplatesViewSet.permission_classes,
            [unions_views.DenyAllPermission],
        )

    def test_award_history_viewset_uses_deny_all(self):
        self.assertEqual(
            unions_views.AwardHistoryViewSet.permission_classes,
            [unions_views.DenyAllPermission],
        )


class Round54AuthCoreContainmentTests(unittest.TestCase):
    def test_address_change_history_viewset_uses_deny_all(self):
        self.assertEqual(
            auth_core_views.AddressChangeHistoryViewSet.permission_classes,
            [auth_core_views.DenyAllPermission],
        )


class Round54AiCoreContainmentTests(unittest.TestCase):
    def test_ai_safety_filters_viewset_uses_deny_all(self):
        self.assertEqual(
            ai_core_views.AiSafetyFiltersViewSet.permission_classes,
            [ai_core_views.DenyAllPermission],
        )


class Round54NotificationsContainmentTests(unittest.TestCase):
    def test_mobile_sync_queue_viewset_uses_deny_all(self):
        self.assertEqual(
            notifications_views.MobileSyncQueueViewSet.permission_classes,
            [notifications_views.DenyAllPermission],
        )

    def test_push_deliveries_viewset_uses_deny_all(self):
        self.assertEqual(
            notifications_views.PushDeliveriesViewSet.permission_classes,
            [notifications_views.DenyAllPermission],
        )


class Round54ComplianceContainmentTests(unittest.TestCase):
    def test_firewall_access_rules_viewset_uses_deny_all(self):
        self.assertEqual(
            compliance_views.FirewallAccessRulesViewSet.permission_classes,
            [compliance_views.DenyAllPermission],
        )

    def test_firewall_violations_viewset_uses_deny_all(self):
        self.assertEqual(
            compliance_views.FirewallViolationsViewSet.permission_classes,
            [compliance_views.DenyAllPermission],
        )


class Round54ContentContainmentTests(unittest.TestCase):
    def test_signers_viewset_uses_deny_all(self):
        self.assertEqual(
            content_views.SignersViewSet.permission_classes,
            [content_views.DenyAllPermission],
        )

    def test_signature_verification_viewset_uses_deny_all(self):
        self.assertEqual(
            content_views.SignatureVerificationViewSet.permission_classes,
            [content_views.DenyAllPermission],
        )

    def test_document_signers_viewset_still_contained(self):
        # Re-verified unchanged this round (round 45's Round40DenyAllPermission).
        self.assertEqual(
            content_views.DocumentSignersViewSet.permission_classes,
            [content_views.Round40DenyAllPermission],
        )


if __name__ == "__main__":
    unittest.main()
