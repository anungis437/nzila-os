"""
Round 44 core app ticket containment test.

ticket_comments and ticket_history have zero real TypeScript consumer of
their own (support-service.ts's addComment/getTicketComments/ticketHistory
inserts have zero real callers) — independent of support_tickets, whose
own classification was corrected this round to SYSTEM_ONLY after a real
platform-admin dashboard consumer was found. The generated Django
ViewSets exposed queryset=Model.objects.all() + IsAuthenticated-only with
NO organization filter of any kind — contained via DenyAllPermission.

Run with:

    python -m unittest core.tests_round44_ticket_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from core import views  # noqa: E402


class Round44TicketContainmentTests(unittest.TestCase):
    def test_ticket_comments_viewset_uses_deny_all(self):
        self.assertEqual(
            views.TicketCommentsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_ticket_history_viewset_uses_deny_all(self):
        self.assertEqual(
            views.TicketHistoryViewSet.permission_classes, [views.DenyAllPermission]
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
