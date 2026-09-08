"""
Round 51 compliance app dead-service containment test
(GLOBAL_REFERENCE_AND_SHARED_CONFIGURATION_SCOPE_AUTHORITY).

Each ViewSet below corresponds to a table whose sole TypeScript consumer
(services/break-glass-service.ts, services/founder-conflict-service.ts,
services/employer-non-interference-service.ts,
services/certification-management-service.ts,
services/lmbp-immigration-service.ts, services/indigenous-data-service.ts, or
lib/services/external-data/lrb-unified-service.ts) has zero production
importers anywhere in app/, actions/, lib/, services/ outside its own test
file (git-grep confirmed) — dead TS code. The generated Django ViewSets
exposed queryset=Model.objects.all() + IsAuthenticated-only with NO
organization filter of any kind — contained via DenyAllPermission.

Run with:

    python -m unittest compliance.tests_round51_dead_service_containment -v
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
    "SwissColdStorageViewSet",
    "BreakGlassSystemViewSet",
    "DisasterRecoveryDrillsViewSet",
    "RecoveryTimeObjectivesViewSet",
    "EmergencyDeclarationsViewSet",
    "ArmsLengthVerificationViewSet",
    "ConflictOfInterestPolicyViewSet",
    "DataClassificationRegistryViewSet",
    "UnionOnlyDataTagsViewSet",
    "CertificationComplianceReportsViewSet",
    "CertificationTypesViewSet",
    "LicenseRenewalsViewSet",
    "ForeignWorkersViewSet",
    "LmbpComplianceAlertsViewSet",
    "LmbpComplianceReportsViewSet",
    "LmbpLettersViewSet",
    "MentorshipsViewSet",
    "BandCouncilConsentViewSet",
    "BandCouncilsViewSet",
    "IndigenousDataSharingAgreementsViewSet",
    "TraditionalKnowledgeRegistryViewSet",
    "LrbAgreementsViewSet",
    "LrbSyncLogViewSet",
]


class Round51ComplianceDeadServiceContainmentTests(unittest.TestCase):
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
