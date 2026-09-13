"""
Round 58 (production geometry remediation) six-root writer ratchet.

The Round58 prerequisite migration
(db/migrations/20260913_round58_production_geometry_prerequisites.sql) adds
mandatory (NOT NULL) authority columns to six root tables whose Django and
TypeScript lineages diverged:

    chat_sessions, board_packets, policy_rules, voting_sessions,
    congress_memberships, shared_clause_library

For each root, the corresponding generated Django ModelViewSet must be
EITHER:

  1. fail-closed / DenyAll (no legitimate Django consumer, so the model's
     incompleteness relative to the new required column(s) cannot be
     exploited through Django), OR
  2. explicitly proven compatible with every new NOT NULL authority column
     added by the Round58 prerequisite migration (i.e. the Django model
     and serializer actually populate the column on every write path).

This test is the ratchet: it fails loudly if any of the six roots regress
to a plain IsAuthenticated-only ModelViewSet without a corresponding
compatibility proof.

Run with:

    python -m unittest tests.test_round58_six_root_writer_ratchet -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from ai_core import views as ai_core_views  # noqa: E402
from bargaining import views as bargaining_views  # noqa: E402
from compliance import views as compliance_views  # noqa: E402
from content import views as content_views  # noqa: E402
from unions import views as unions_views  # noqa: E402

# (table, viewset, deny_all_permission_class_from_same_app)
SIX_ROOTS = [
    ("chat_sessions", ai_core_views.ChatSessionsViewSet, ai_core_views.DenyAllPermission),
    ("board_packets", content_views.BoardPacketsViewSet, content_views.DenyAllPermission),
    ("policy_rules", compliance_views.PolicyRulesViewSet, compliance_views.DenyAllPermission),
    ("voting_sessions", unions_views.VotingSessionsViewSet, unions_views.DenyAllPermission),
    ("congress_memberships", unions_views.CongressMembershipsViewSet, unions_views.DenyAllPermission),
    ("shared_clause_library", bargaining_views.SharedClauseLibraryViewSet, bargaining_views.DenyAllPermission),
]


class SixRootWriterRatchetTests(unittest.TestCase):
    def test_every_root_is_deny_all(self):
        """Every one of the six Round58 prerequisite roots must currently be
        DenyAll on the Django side -- no proven-compatible writer exists yet
        for any of them, so no exception is currently authorized."""
        failures = []
        for table, viewset, deny_all_cls in SIX_ROOTS:
            if viewset.permission_classes != [deny_all_cls]:
                failures.append(
                    f"{table} ({viewset.__module__}.{viewset.__name__}) is not "
                    f"DenyAll: permission_classes={viewset.permission_classes!r}"
                )
        self.assertEqual(
            failures,
            [],
            "One or more Round58 prerequisite roots regressed away from "
            "DenyAll without a proven NOT-NULL-column compatibility fix:\n"
            + "\n".join(failures),
        )

    def test_deny_all_classes_reject_every_request(self):
        for table, _viewset, deny_all_cls in SIX_ROOTS:
            deny = deny_all_cls()
            with self.subTest(table=table):
                self.assertFalse(deny.has_permission(request=None, view=None))
                self.assertFalse(
                    deny.has_object_permission(request=None, view=None, obj=None)
                )
