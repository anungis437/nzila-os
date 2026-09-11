"""
Round 49 immutable security and audit evidence containment test.

Covers Django containment for the round-49 cohort:
  compliance app: CertificationAuditLog, EmployerAccessAttempts,
    AccessJustificationRequests, FirewallComplianceAudit,
    BreakGlassActivations, LocationTrackingAudit, ConflictAuditLog.
  content app: SignatureAuditTrail, SignatureAuditLog.
  core app: SecurityEvents.
  services/api standalone ViewSets with no legitimate consumer at all:
    EmployerNonInterferenceServiceViewSet, FounderConflictServiceViewSet,
    BreakGlassServiceViewSet, CertificationManagementServiceViewSet.

Run with:

    python -m unittest compliance.tests_round49_evidence_containment -v
"""

from __future__ import annotations

import os
import unittest

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

import django  # noqa: E402

django.setup()

from compliance import views as compliance_views  # noqa: E402
from content import views as content_views  # noqa: E402
from core import views as core_views  # noqa: E402
from services.api import (  # noqa: E402
    employer_non_interference_service_views as eni_views,
)
from services.api import founder_conflict_service_views as fc_views  # noqa: E402
from services.api import break_glass_service_views as bg_views  # noqa: E402
from services.api import (  # noqa: E402
    certification_management_service_views as cms_views,
)


class Round49ComplianceContainmentTests(unittest.TestCase):
    def test_certification_audit_log_viewset_uses_deny_all(self):
        self.assertEqual(
            compliance_views.CertificationAuditLogViewSet.permission_classes,
            [compliance_views.DenyAllPermission],
        )

    def test_employer_access_attempts_viewset_uses_deny_all(self):
        self.assertEqual(
            compliance_views.EmployerAccessAttemptsViewSet.permission_classes,
            [compliance_views.DenyAllPermission],
        )

    def test_access_justification_requests_viewset_uses_deny_all(self):
        self.assertEqual(
            compliance_views.AccessJustificationRequestsViewSet.permission_classes,
            [compliance_views.DenyAllPermission],
        )

    def test_firewall_compliance_audit_viewset_uses_deny_all(self):
        self.assertEqual(
            compliance_views.FirewallComplianceAuditViewSet.permission_classes,
            [compliance_views.DenyAllPermission],
        )

    def test_break_glass_activations_viewset_uses_deny_all(self):
        self.assertEqual(
            compliance_views.BreakGlassActivationsViewSet.permission_classes,
            [compliance_views.DenyAllPermission],
        )

    def test_location_tracking_audit_viewset_uses_deny_all(self):
        self.assertEqual(
            compliance_views.LocationTrackingAuditViewSet.permission_classes,
            [compliance_views.DenyAllPermission],
        )

    def test_conflict_audit_log_viewset_uses_deny_all(self):
        self.assertEqual(
            compliance_views.ConflictAuditLogViewSet.permission_classes,
            [compliance_views.DenyAllPermission],
        )


class Round49ContentContainmentTests(unittest.TestCase):
    def test_signature_audit_trail_viewset_uses_deny_all(self):
        self.assertEqual(
            content_views.SignatureAuditTrailViewSet.permission_classes,
            [content_views.DenyAllPermission],
        )

    def test_signature_audit_log_viewset_uses_deny_all(self):
        self.assertEqual(
            content_views.SignatureAuditLogViewSet.permission_classes,
            [content_views.DenyAllPermission],
        )


class Round49CoreContainmentTests(unittest.TestCase):
    def test_security_events_viewset_uses_deny_all(self):
        self.assertEqual(
            core_views.SecurityEventsViewSet.permission_classes,
            [core_views.DenyAllPermission],
        )


class Round49ServiceApiContainmentTests(unittest.TestCase):
    def test_employer_non_interference_service_viewset_uses_deny_all(self):
        self.assertEqual(
            eni_views.EmployerNonInterferenceServiceViewSet.permission_classes,
            [eni_views.DenyAllPermission],
        )

    def test_founder_conflict_service_viewset_uses_deny_all(self):
        self.assertEqual(
            fc_views.FounderConflictServiceViewSet.permission_classes,
            [fc_views.DenyAllPermission],
        )

    def test_break_glass_service_viewset_uses_deny_all(self):
        self.assertEqual(
            bg_views.BreakGlassServiceViewSet.permission_classes,
            [bg_views.DenyAllPermission],
        )

    def test_certification_management_service_viewset_uses_deny_all(self):
        self.assertEqual(
            cms_views.CertificationManagementServiceViewSet.permission_classes,
            [cms_views.DenyAllPermission],
        )


if __name__ == "__main__":
    unittest.main()
