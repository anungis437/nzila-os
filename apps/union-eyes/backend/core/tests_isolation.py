"""
Adversarial test for core/isolation.py's DenyAllPermission.

PR #752 round 39. Mirrors billing/tests_isolation.py's
DenyAllPermissionTests pattern. Run with:

    python -m unittest core.tests_isolation -v

(not `manage.py test`, which unconditionally tries to create a test
database first — see billing/tests_isolation.py's docstring for why).
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from core.isolation import DenyAllPermission  # noqa: E402


class DenyAllPermissionTests(unittest.TestCase):
    def test_denies_every_request_regardless_of_authentication(self):
        permission = DenyAllPermission()
        authenticated_request = MagicMock(user=MagicMock(is_authenticated=True))

        self.assertFalse(permission.has_permission(authenticated_request, MagicMock()))
        self.assertFalse(
            permission.has_object_permission(authenticated_request, MagicMock(), MagicMock())
        )

    def test_denies_unauthenticated_requests_too(self):
        permission = DenyAllPermission()
        anonymous_request = MagicMock(user=MagicMock(is_authenticated=False))

        self.assertFalse(permission.has_permission(anonymous_request, MagicMock()))
        self.assertFalse(
            permission.has_object_permission(anonymous_request, MagicMock(), MagicMock())
        )


if __name__ == "__main__":
    unittest.main()
