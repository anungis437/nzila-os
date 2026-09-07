"""
Round 41 sso_providers containment test.

sso_providers stores raw credential material (oidcClientSecret,
samlCertificate) and was previously echoed back verbatim via GET in
app/api/enterprise/sso/providers/route.ts (fixed this round to return only a
boolean presence flag). Ejected from the round-41 DIRECT_ORG_RUNTIME_BATCH
cohort pending a dedicated credential-handling review — this test only locks
the Django-side containment fix: the generated SsoProviders ViewSet had zero
legitimate consumer and previously exposed queryset=Model.objects.all() +
IsAuthenticated-only with a client-controlled, unenforced organization_id
filterset field — contained via DenyAllPermission.

Run with:

    python -m unittest auth_core.tests_round41_sso_providers_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from auth_core import views  # noqa: E402


class Round41SsoProvidersContainmentTests(unittest.TestCase):
    def test_sso_providers_viewset_uses_deny_all(self):
        self.assertEqual(
            views.SsoProvidersViewSet.permission_classes, [views.DenyAllPermission]
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
