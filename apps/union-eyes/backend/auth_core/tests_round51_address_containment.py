"""
Round 51 auth_core app address containment test
(GLOBAL_REFERENCE_AND_SHARED_CONFIGURATION_SCOPE_AUTHORITY).

country_address_formats and address_validation_cache's sole TypeScript
consumer, lib/address/address-service.ts, has zero production importers
anywhere in app/, actions/, lib/, services/ outside its own test file
(git-grep confirmed) — dead TS code. The generated Django ViewSets exposed
queryset=Model.objects.all() + IsAuthenticated-only with NO organization
filter of any kind — contained via DenyAllPermission.

Run with:

    python -m unittest auth_core.tests_round51_address_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from auth_core import views  # noqa: E402


class Round51AuthCoreAddressContainmentTests(unittest.TestCase):
    def test_country_address_formats_viewset_uses_deny_all(self):
        self.assertEqual(
            views.CountryAddressFormatsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_address_validation_cache_viewset_uses_deny_all(self):
        self.assertEqual(
            views.AddressValidationCacheViewSet.permission_classes, [views.DenyAllPermission]
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
