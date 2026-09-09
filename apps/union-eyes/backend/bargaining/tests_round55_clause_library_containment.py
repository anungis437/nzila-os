"""
Round 55 bargaining app clause-library containment test
(FINAL_NON_VOTING_PARENT_ARCHITECTURE_EXCEPTIONS).

SharedClauseLibraryViewSet and ClauseLibraryTagsViewSet were generated
ModelViewSets exposing queryset=Model.objects.all() + IsAuthenticated-only
with no organization/sharing-level scoping whatsoever -- any authenticated
user of ANY organization could read, mutate, or delete any other
organization's CBA clauses via the Django REST endpoint, completely
bypassing the real owner+sharingLevel authority model that now lives in
lib/clause-library/sharing-authority.ts (TypeScript-only; reproducing
cross-union sharing authorization in Django is out of scope). No
legitimate Django consumer found (only a feature-name string literal in
lib/utils/smart-onboarding.ts references the URL slug, not an actual
caller) -- contained via DenyAllPermission.

Run with:

    python -m unittest bargaining.tests_round55_clause_library_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from bargaining import views  # noqa: E402


class Round55ClauseLibraryContainmentTests(unittest.TestCase):
    def test_shared_clause_library_viewset_uses_deny_all(self):
        self.assertEqual(
            views.SharedClauseLibraryViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_clause_library_tags_viewset_uses_deny_all(self):
        self.assertEqual(
            views.ClauseLibraryTagsViewSet.permission_classes, [views.DenyAllPermission]
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
