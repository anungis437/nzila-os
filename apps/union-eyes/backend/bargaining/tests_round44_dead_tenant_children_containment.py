"""
Round 44 bargaining app containment test.

bargaining_team_members, negotiation_sessions, precedent_tags,
wage_progressions, and benefit_comparisons all have a genuinely trusted
tenant-owned parent chain (negotiations / arbitration_precedents /
collective_agreements + cba_clauses, all closed TENANT_RLS_REQUIRED), but
each child itself has zero real TypeScript consumer (either the whole
lib/services/negotiations-service.ts module is dead, lib/services/
clause-service.ts's wage-progression functions have zero callers,
benefitComparisons is only ever imported for its TS type, or the table
is declared only in services/financial-service's separate dual-schema).
The generated Django ViewSets had zero legitimate consumer and previously
exposed queryset=Model.objects.all() + IsAuthenticated-only with NO
organization filter of any kind — contained via DenyAllPermission.

Run with:

    python -m unittest bargaining.tests_round44_dead_tenant_children_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from bargaining import views  # noqa: E402


class Round44DeadTenantChildrenContainmentTests(unittest.TestCase):
    def test_bargaining_team_members_viewset_uses_deny_all(self):
        self.assertEqual(
            views.BargainingTeamMembersViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_negotiation_sessions_viewset_uses_deny_all(self):
        self.assertEqual(
            views.NegotiationSessionsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_precedent_tags_viewset_uses_deny_all(self):
        self.assertEqual(
            views.PrecedentTagsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_wage_progressions_viewset_uses_deny_all(self):
        self.assertEqual(
            views.WageProgressionsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_benefit_comparisons_viewset_uses_deny_all(self):
        self.assertEqual(
            views.BenefitComparisonsViewSet.permission_classes, [views.DenyAllPermission]
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
