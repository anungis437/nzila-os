"""
Round 52 compliance app privacy/jurisdiction containment test
(NON_FINANCE_SCOPE_EXCEPTION_REMEDIATION, PRIVACY_AND_JURISDICTION family).

privacy_breaches: services/provincial-privacy-service.ts's reportBreach/
markBreachNotificationSent/getBreachesApproachingDeadline (the only TS code
touching this table) have zero production callers anywhere (git-grep
confirmed) -- dead TS code.

data_classification_policy: the legitimate path is app/api/privacy/
{breach,dsar,provincial}/route.ts's crudRoutes (writeRole now
'compliance_manager', a genuine platform-elevated role).

provincial_privacy_config: the legitimate path is
services/provincial-privacy-service.ts's read-only getProvinceConfig; no
production code ever writes this table.

All three generated Django ViewSets exposed queryset=Model.objects.all() +
IsAuthenticated-only with NO organization filter of any kind, and none has
a legitimate consumer of its own -- contained via DenyAllPermission.

Run with:

    python -m unittest compliance.tests_round52_privacy_jurisdiction_containment -v
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from compliance import views  # noqa: E402

CONTAINED_VIEWSETS = [
    "PrivacyBreachesViewSet",
    "DataClassificationPolicyViewSet",
    "ProvincialPrivacyConfigViewSet",
]


class Round52PrivacyJurisdictionContainmentTests(unittest.TestCase):
    def test_all_targeted_viewsets_use_deny_all(self):
        for name in CONTAINED_VIEWSETS:
            viewset = getattr(views, name)
            with self.subTest(viewset=name):
                self.assertEqual(viewset.permission_classes, [views.DenyAllPermission])

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
