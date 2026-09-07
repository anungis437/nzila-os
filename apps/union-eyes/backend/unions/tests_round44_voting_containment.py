"""
Round 44 unions app voting containment test.

voting_notifications and voting_audit_log have zero real TypeScript
consumer (dead service modules / financial-service dual-schema only).
voter_eligibility, voting_options, and votes DO have real or partially
real TypeScript reachability (voter_eligibility's checkVoterEligibility
is called from castVote; votes/voting_options remain round-42 dual-schema
exceptions), but all five generated Django ViewSets exposed
queryset=Model.objects.all() + IsAuthenticated-only with NO organization
filter of any kind (votes/voting_options exposed full CRUD on individual
ballots across every organization) and have zero legitimate Django
consumer — contained via DenyAllPermission independent of each table's
TypeScript-side classification.

Run with:

    python -m unittest unions.tests_round44_voting_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402


class Round44VotingContainmentTests(unittest.TestCase):
    def test_voting_notifications_viewset_uses_deny_all(self):
        self.assertEqual(
            views.VotingNotificationsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_voting_audit_log_viewset_uses_deny_all(self):
        self.assertEqual(
            views.VotingAuditLogViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_voter_eligibility_viewset_uses_deny_all(self):
        self.assertEqual(
            views.VoterEligibilityViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_voting_options_viewset_uses_deny_all(self):
        self.assertEqual(
            views.VotingOptionsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_votes_viewset_uses_deny_all(self):
        self.assertEqual(
            views.VotesViewSet.permission_classes, [views.DenyAllPermission]
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
