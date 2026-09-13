"""
Round 58 (production geometry remediation) containment test:
BoardPacketsViewSet.

Board packet writer authority was found to be incompatible with the
Round58 prerequisite migration, which makes board_packets.organization_id
NOT NULL on the physical table. The generated Django model only maps
`title` -- it has no organization_id field at all, so any Django CREATE
via this ModelViewSet would omit the new required column and fail (or,
if the model is ever updated to add the column without a matching queryset
scope, would allow cross-org reassignment). No legitimate Django consumer
of this endpoint exists anywhere in the app (repo-wide non-test search
found none); the canonical writer is the TypeScript surface
(app/api/governance/board-packets/route.ts and
lib/services/board-packet-generator.ts), which already derives and writes
organizationId on every insert. Contained via DenyAllPermission -- same
disposition as SocialAccountsViewSet (round 37).

Run with:

    python -m unittest content.tests_round58_board_packets_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from content import views  # noqa: E402


class BoardPacketsContainmentTests(unittest.TestCase):
    """BoardPacketsViewSet must be fail-closed: no operation is authorized."""

    def test_viewset_uses_deny_all(self):
        self.assertEqual(
            views.BoardPacketsViewSet.permission_classes,
            [views.DenyAllPermission],
        )

    def test_deny_all_rejects_every_request(self):
        deny = views.DenyAllPermission()
        self.assertFalse(deny.has_permission(request=None, view=None))
        self.assertFalse(deny.has_object_permission(request=None, view=None, obj=None))
