"""
Round 41 organizer_tasks containment test.

organizer_tasks is closed TENANT_RLS_REQUIRED via the org-scoped
crud-factory TypeScript route app/api/organizer/impact/route.ts. The
generated Django OrganizerTasks ViewSet had zero legitimate consumer and
previously exposed queryset=Model.objects.all() + IsAuthenticated-only with
NO organization filter at all — contained via DenyAllPermission.

Run with:

    python -m unittest unions.tests_round41_organizer_tasks_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from unions import views  # noqa: E402


class Round41OrganizerTasksContainmentTests(unittest.TestCase):
    def test_organizer_tasks_viewset_uses_deny_all(self):
        self.assertEqual(
            views.OrganizerTasksViewSet.permission_classes, [views.DenyAllPermission]
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
