"""
Round 58 (production geometry remediation) containment tests:
VotingSessionsViewSet and CongressMembershipsViewSet.

Both writer authorities were found to be incompatible with the Round58
prerequisite migration:

- VotingSessions: the Round58 migration makes voting_sessions.
  organization_id NOT NULL, but the generated Django model only maps
  `title`. The real voting-session surface is the canonical TypeScript
  API, which already supplies organizationId on create.
- CongressMemberships: the Round58 migration makes
  congress_memberships.congress_id NOT NULL, but the generated Django
  model maps only organization_id (no congress_id at all). This table's
  reviewed runtime authority is its multi-party RLS read path -- an
  unscoped generic Django full-CRUD endpoint is not an acceptable
  substitute.

No legitimate Django consumer of either endpoint exists anywhere in the
app (repo-wide non-test search found none). Both are contained via
DenyAllPermission -- same disposition as the round-44 voting cohort in
this same app.

Run with:

    python -m unittest unions.tests_round58_voting_congress_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402


class VotingSessionsContainmentTests(unittest.TestCase):
    """VotingSessionsViewSet must be fail-closed: no operation is authorized."""

    def test_viewset_uses_deny_all(self):
        self.assertEqual(
            views.VotingSessionsViewSet.permission_classes,
            [views.DenyAllPermission],
        )


class CongressMembershipsContainmentTests(unittest.TestCase):
    """CongressMembershipsViewSet must be fail-closed: no operation is authorized."""

    def test_viewset_uses_deny_all(self):
        self.assertEqual(
            views.CongressMembershipsViewSet.permission_classes,
            [views.DenyAllPermission],
        )


class Round58DenyAllBehaviorTests(unittest.TestCase):
    def test_deny_all_rejects_every_request(self):
        deny = views.DenyAllPermission()
        self.assertFalse(deny.has_permission(request=None, view=None))
        self.assertFalse(deny.has_object_permission(request=None, view=None, obj=None))
