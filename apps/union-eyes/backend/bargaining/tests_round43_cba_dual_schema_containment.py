"""
Round 43 CBA contacts/footnotes/version-history containment test.

cba_contacts, cba_footnotes, and cba_version_history have no Drizzle
declaration anywhere in this app's own db/schema/** — the only TypeScript
references are services/financial-service's own separate dual-schema
(a different deployable Node service/package). On the Django side, real
models exist in this app's own backend/bargaining app with a genuine
potential parent-owned chain (cba_contacts/cba_version_history ->
CollectiveAgreements -> organization; cba_footnotes -> CbaClauses ->
CollectiveAgreements -> organization), but the generated ViewSets had zero
legitimate frontend consumer and previously exposed
queryset=Model.objects.all() + IsAuthenticated-only with NO organization
filter of any kind — contained via DenyAllPermission.

Run with:

    python -m unittest bargaining.tests_round43_cba_dual_schema_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from bargaining import views  # noqa: E402


class Round43CbaDualSchemaContainmentTests(unittest.TestCase):
    def test_cba_contacts_viewset_uses_deny_all(self):
        self.assertEqual(
            views.CbaContactsViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_cba_footnotes_viewset_uses_deny_all(self):
        self.assertEqual(
            views.CbaFootnotesViewSet.permission_classes, [views.DenyAllPermission]
        )

    def test_cba_version_history_viewset_uses_deny_all(self):
        self.assertEqual(
            views.CbaVersionHistoryViewSet.permission_classes, [views.DenyAllPermission]
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
