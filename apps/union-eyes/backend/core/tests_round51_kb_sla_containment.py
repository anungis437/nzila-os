"""
Round 51 core app knowledge-base/SLA containment test
(GLOBAL_REFERENCE_AND_SHARED_CONFIGURATION_SCOPE_AUTHORITY).

knowledge_base_articles and sla_policies's sole TypeScript consumer,
lib/services/support-service.ts (searchKnowledgeBase/getKBArticleBySlug/
getSLAMetrics), has zero production callers anywhere (git-grep confirmed) —
dead TS code, consistent with round 44's finding that this same file's
ticket-comment/ticket-history functions are also dead. The generated Django
ViewSets exposed queryset=Model.objects.all() + IsAuthenticated-only with
NO organization filter of any kind — contained via DenyAllPermission.

Run with:

    python -m unittest core.tests_round51_kb_sla_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from core import views  # noqa: E402


class Round51CoreKbSlaContainmentTests(unittest.TestCase):
    def test_knowledge_base_articles_viewset_uses_deny_all(self):
        self.assertEqual(
            views.KnowledgeBaseArticlesViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_sla_policies_viewset_uses_deny_all(self):
        self.assertEqual(
            views.SlaPoliciesViewSet.permission_classes, [views.DenyAllPermission]
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
