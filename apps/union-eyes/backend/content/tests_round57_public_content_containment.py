"""
Round 57 content containment test.

PublicContent ViewSet was IsAuthenticated-only + queryset=Model.objects.all()
with no organization filter and zero legitimate frontend consumer. Even
though the row shape mixes tenant-owned and platform-global content, the
Django REST surface itself has no scoping logic at all, so it is contained
via the existing DenyAllPermission (content/views.py) pending a real
tenant/global-aware get_queryset().

Run with:

    python -m unittest content.tests_round57_public_content_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from content import views  # noqa: E402


class Round57PublicContentContainmentTests(unittest.TestCase):
    def test_public_content_viewset_uses_deny_all(self):
        self.assertEqual(views.PublicContentViewSet.permission_classes, [views.DenyAllPermission])

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
