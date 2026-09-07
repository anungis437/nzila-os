"""
Round 45 ai_core app chatbot containment test.

chat_sessions is TENANT_RLS_REQUIRED (organization_id + user_id both NOT
NULL); chat_messages is PARENT_OWNED_RLS_REQUIRED via chat_sessions. Their
real Next.js consumer (lib/ai/chatbot-service.ts) required a security fix
this round after an IDOR was found allowing reads/writes across other
users'/organizations' chat sessions. The generated Django ViewSets exposed
queryset=Model.objects.all() + IsAuthenticated-only with NO
organization/user scoping of any kind — contained via DenyAllPermission.

Run with:

    python -m unittest ai_core.tests_round45_chatbot_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from ai_core import views  # noqa: E402


class Round45ChatbotContainmentTests(unittest.TestCase):
    def test_chat_sessions_viewset_uses_deny_all(self):
        self.assertEqual(
            views.ChatSessionsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_chat_messages_viewset_uses_deny_all(self):
        self.assertEqual(
            views.ChatMessagesViewSet.permission_classes, [views.DenyAllPermission]
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
