"""
Round 57 bargaining containment test.

PrecedentCitations ViewSet was IsAuthenticated-only + queryset=
Model.objects.all() with no organization filter and zero legitimate frontend
consumer. Citation visibility must not exceed the source precedent's
visibility, and this Django surface had no join-based authorization at all.
Contained via the existing DenyAllPermission (bargaining/views.py).

Run with:

    python -m unittest bargaining.tests_round57_precedent_citations_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from bargaining import views  # noqa: E402


class Round57PrecedentCitationsContainmentTests(unittest.TestCase):
    def test_precedent_citations_viewset_uses_deny_all(self):
        self.assertEqual(
            views.PrecedentCitationsViewSet.permission_classes, [views.DenyAllPermission]
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
