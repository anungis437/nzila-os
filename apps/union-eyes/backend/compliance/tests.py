"""
Compliance app tests — real assertions replacing placeholder stubs.
Tests every model for creation + __str__ representation.
"""

import uuid
from datetime import date
from decimal import Decimal

from auth_core.models import Organizations
from django.test import TestCase
from django.utils import timezone

from .models import (
    AccessJustificationRequests,
    ArmsLengthVerification,
    BandCouncilConsent,
    BandCouncils,
    BlindTrustRegistry,
    BreakGlassActivations,
    BreakGlassSystem,
    CertificationAlerts,
    CertificationAuditLog,
    CertificationComplianceReports,
    CertificationTypes,
    ConflictAuditLog,
    ConflictDisclosures,
    ConflictOfInterestPolicy,
    ConflictReviewCommittee,
    ConflictTraining,
    ConsentRecords,
    ContinuingEducation,
    CookieConsents,
    CorrectiveActions,
    CouncilElections,
    DataAnonymizationLog,
    DataClassificationPolicy,
    DataClassificationRegistry,
    DataProcessingRecords,
    DataResidencyConfigs,
    DataRetentionPolicies,
    DataSubjectAccessRequests,
    DisasterRecoveryDrills,
    DsrActivityLog,
    DsrRequests,
    EmergencyDeclarations,
    EmployerAccessAttempts,
    FirewallAccessRules,
    FirewallComplianceAudit,
    FirewallViolations,
    ForeignWorkers,
    GdprDataRequests,
    GeofenceEvents,
    Geofences,
    GoldenShares,
    GovernanceEvents,
    GssApplications,
    HazardReports,
    IndigenousDataAccessLog,
    IndigenousDataSharingAgreements,
    IndigenousMemberData,
    InjuryLogs,
    KeyHolderRegistry,
    LegalHolds,
    LicenseRenewals,
    LmbpComplianceAlerts,
    LmbpComplianceReports,
    LmbpLetters,
    LocationDeletionLog,
    LocationTracking,
    LocationTrackingAudit,
    LocationTrackingConfig,
    LrbAgreements,
    LrbEmployers,
    LrbSyncLog,
    LrbUnions,
    Mentorships,
    MissionAudits,
    PciDssCardholderDataFlow,
    PciDssEncryptionKeys,
    PciDssQuarterlyScans,
    PciDssRequirements,
    PciDssSaqAssessments,
    PolicyEvaluations,
    PolicyExceptions,
    PolicyRules,
    PpeEquipment,
    PrivacyBreaches,
    ProvincialConsent,
    ProvincialDataHandling,
    ProvincialPrivacyConfig,
    RecoveryTimeObjectives,
    RecusalTracking,
    ReservedMatterVotes,
    RetentionPolicies,
    SafetyAudits,
    SafetyCertifications,
    SafetyCommitteeMeetings,
    SafetyInspections,
    SafetyPolicies,
    SafetyTrainingRecords,
    StaffCertifications,
    SwissColdStorage,
    TraditionalKnowledgeRegistry,
    UnionOnlyDataTags,
    UserConsents,
    WorkplaceIncidents,
)
from core.testing import create_valid


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _org(**overrides):
    defaults = dict(
        name="TestOrg",
        slug=f"org-{uuid.uuid4().hex[:8]}",
        organization_type="union",
    )
    defaults.update(overrides)
    return create_valid(Organizations, **defaults)


def _data_class_registry(**overrides):
    """Create a DataClassificationRegistry (used as FK parent)."""
    now = timezone.now()
    defaults = dict(
        data_type="membership_list",
        classification_level="confidential",
        created_at=now,
        updated_at=now,
    )
    defaults.update(overrides)
    return create_valid(DataClassificationRegistry, **defaults)


# ===== 1. CertificationTypes =====
class TestCertificationTypesCreate(TestCase):
    def test_create(self):
        obj = create_valid(CertificationTypes, certification_name="OSHA 10-Hour")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.certification_name, "OSHA 10-Hour")


class TestCertificationTypesStr(TestCase):
    def test_str(self):
        obj = create_valid(CertificationTypes, certification_name="CT")
        self.assertIsInstance(str(obj), str)


# ===== 2. StaffCertifications =====
class TestStaffCertificationsCreate(TestCase):
    def test_create(self):
        obj = create_valid(StaffCertifications)
        self.assertIsNotNone(obj.id)


class TestStaffCertificationsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(StaffCertifications)), str)


# ===== 3. ContinuingEducation =====
class TestContinuingEducationCreate(TestCase):
    def test_create(self):
        obj = create_valid(ContinuingEducation)
        self.assertIsNotNone(obj.id)


class TestContinuingEducationStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ContinuingEducation)), str)


# ===== 4. LicenseRenewals =====
class TestLicenseRenewalsCreate(TestCase):
    def test_create(self):
        obj = create_valid(LicenseRenewals, certification_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestLicenseRenewalsStr(TestCase):
    def test_str(self):
        obj = create_valid(LicenseRenewals, certification_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 5. CertificationAlerts =====
class TestCertificationAlertsCreate(TestCase):
    def test_create(self):
        obj = create_valid(CertificationAlerts, certification_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestCertificationAlertsStr(TestCase):
    def test_str(self):
        obj = create_valid(CertificationAlerts, certification_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 6. CertificationComplianceReports =====
class TestCertificationComplianceReportsCreate(TestCase):
    def test_create(self):
        obj = create_valid(CertificationComplianceReports,
            report_date=date(2025, 6, 30),
        )
        self.assertIsNotNone(obj.id)


class TestCertificationComplianceReportsStr(TestCase):
    def test_str(self):
        obj = create_valid(CertificationComplianceReports,
            report_date=date(2025, 1, 1),
        )
        self.assertIsInstance(str(obj), str)


# ===== 7. CertificationAuditLog =====
class TestCertificationAuditLogCreate(TestCase):
    def test_create(self):
        obj = create_valid(CertificationAuditLog)
        self.assertIsNotNone(obj.id)


class TestCertificationAuditLogStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(CertificationAuditLog)), str)


# ===== 8. DsrRequests =====
class TestDsrRequestsCreate(TestCase):
    def test_create(self):
        obj = create_valid(DsrRequests)
        self.assertIsNotNone(obj.id)


class TestDsrRequestsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(DsrRequests)), str)


# ===== 9. DsrActivityLog (FK → DsrRequests) =====
class TestDsrActivityLogCreate(TestCase):
    def test_create(self):
        req = create_valid(DsrRequests)
        obj = create_valid(DsrActivityLog, request=req)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.request, req)


class TestDsrActivityLogStr(TestCase):
    def test_str(self):
        req = create_valid(DsrRequests)
        obj = create_valid(DsrActivityLog, request=req)
        self.assertIsInstance(str(obj), str)


# ===== 10. DataResidencyConfigs (FK → Organizations) =====
class TestDataResidencyConfigsCreate(TestCase):
    def test_create(self):
        org = _org(slug="dr-org")
        obj = create_valid(DataResidencyConfigs, organization=org)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization, org)


class TestDataResidencyConfigsStr(TestCase):
    def test_str(self):
        org = _org(slug="dr-org-s")
        obj = create_valid(DataResidencyConfigs, organization=org)
        self.assertIsInstance(str(obj), str)


# ===== 11. ConsentRecords =====
class TestConsentRecordsCreate(TestCase):
    def test_create(self):
        obj = create_valid(ConsentRecords)
        self.assertIsNotNone(obj.id)


class TestConsentRecordsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ConsentRecords)), str)


# ===== 12. DataClassificationPolicy =====
class TestDataClassificationPolicyCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(DataClassificationPolicy,
            policy_name="Default Classification Policy",
            effective_date=now,
            approved_by="admin",
            created_at=now,
            updated_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.policy_name, "Default Classification Policy")
        self.assertTrue(obj.enforce_strict_separation)


class TestDataClassificationPolicyStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(DataClassificationPolicy,
            policy_name="P",
            effective_date=now,
            approved_by="a",
            created_at=now,
            updated_at=now,
        )
        self.assertIsInstance(str(obj), str)


# ===== 13. DataClassificationRegistry =====
class TestDataClassificationRegistryCreate(TestCase):
    def test_create(self):
        obj = _data_class_registry()
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.data_type, "membership_list")
        self.assertFalse(obj.accessible_by_employer)


class TestDataClassificationRegistryStr(TestCase):
    def test_str(self):
        obj = _data_class_registry()
        self.assertIsInstance(str(obj), str)


# ===== 14. FirewallAccessRules (FK → DataClassificationRegistry) =====
class TestFirewallAccessRulesCreate(TestCase):
    def test_create(self):
        dcr = _data_class_registry()
        now = timezone.now()
        obj = create_valid(FirewallAccessRules,
            rule_name="Block employer from membership lists",
            data_type=dcr,
            user_role="employer_admin",
            created_at=now,
            updated_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.data_type, dcr)
        self.assertFalse(obj.access_permitted)


class TestFirewallAccessRulesStr(TestCase):
    def test_str(self):
        dcr = _data_class_registry()
        now = timezone.now()
        obj = create_valid(FirewallAccessRules,
            rule_name="R",
            data_type=dcr,
            user_role="r",
            created_at=now,
            updated_at=now,
        )
        self.assertIsInstance(str(obj), str)


# ===== 15. EmployerAccessAttempts =====
class TestEmployerAccessAttemptsCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(EmployerAccessAttempts,
            attempt_timestamp=now,
            user_id="user_123",
            user_email="employer@co.com",
            user_role="employer_admin",
            data_type_requested="membership_list",
        )
        self.assertIsNotNone(obj.id)
        self.assertFalse(obj.access_granted)


class TestEmployerAccessAttemptsStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(EmployerAccessAttempts,
            attempt_timestamp=now,
            user_id="u",
            user_email="e@e.com",
            user_role="r",
            data_type_requested="d",
        )
        self.assertIsInstance(str(obj), str)


# ===== 16. AccessJustificationRequests =====
class TestAccessJustificationRequestsCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(AccessJustificationRequests,
            request_date=now,
            requested_by="user_456",
            requested_by_email="requester@co.com",
            requested_by_role="employer_admin",
            data_type_requested="grievance_data",
            justification="Legal proceeding requires access",
            created_at=now,
            updated_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.request_status, "pending")


class TestAccessJustificationRequestsStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(AccessJustificationRequests,
            request_date=now,
            requested_by="u",
            requested_by_email="e@e.com",
            requested_by_role="r",
            data_type_requested="d",
            justification="j",
            created_at=now,
            updated_at=now,
        )
        self.assertIsInstance(str(obj), str)


# ===== 17. UnionOnlyDataTags =====
class TestUnionOnlyDataTagsCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(UnionOnlyDataTags,
            resource_type="document",
            resource_id="doc_123",
            tagged_by="admin",
            tagged_at=now,
            created_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertTrue(obj.union_only_flag)


class TestUnionOnlyDataTagsStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(UnionOnlyDataTags,
            resource_type="r",
            resource_id="1",
            tagged_by="a",
            tagged_at=now,
            created_at=now,
        )
        self.assertIsInstance(str(obj), str)


# ===== 18. FirewallViolations =====
class TestFirewallViolationsCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(FirewallViolations,
            violation_date=now,
            violation_type="unauthorized_access",
            severity="critical",
            user_id="user_789",
            user_email="violator@co.com",
            user_role="employer_admin",
            violation_description="Accessed strike plans",
            created_at=now,
            updated_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.incident_status, "open")


class TestFirewallViolationsStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(FirewallViolations,
            violation_date=now,
            violation_type="v",
            severity="low",
            user_id="u",
            user_email="e@e.com",
            user_role="r",
            violation_description="d",
            created_at=now,
            updated_at=now,
        )
        self.assertIsInstance(str(obj), str)


# ===== 19. FirewallComplianceAudit =====
class TestFirewallComplianceAuditCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(FirewallComplianceAudit,
            audit_date=now,
            audit_period="2025-Q2",
            total_access_attempts="1000",
            total_employer_attempts="200",
            total_denied_access="50",
            total_violations="5",
            critical_violations="1",
            compliance_rate="95.0",
            audited_by="auditor@example.com",
            created_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.audit_period, "2025-Q2")


class TestFirewallComplianceAuditStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(FirewallComplianceAudit,
            audit_date=now,
            audit_period="Q1",
            total_access_attempts="1",
            total_employer_attempts="1",
            total_denied_access="0",
            total_violations="0",
            critical_violations="0",
            compliance_rate="100",
            audited_by="a",
            created_at=now,
        )
        self.assertIsInstance(str(obj), str)


# ===== 20. SwissColdStorage =====
class TestSwissColdStorageCreate(TestCase):
    def test_create(self):
        obj = create_valid(SwissColdStorage)
        self.assertIsNotNone(obj.id)


class TestSwissColdStorageStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(SwissColdStorage)), str)


# ===== 21. BreakGlassSystem =====
class TestBreakGlassSystemCreate(TestCase):
    def test_create(self):
        obj = create_valid(BreakGlassSystem)
        self.assertIsNotNone(obj.id)


class TestBreakGlassSystemStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(BreakGlassSystem)), str)


# ===== 22. DisasterRecoveryDrills =====
class TestDisasterRecoveryDrillsCreate(TestCase):
    def test_create(self):
        obj = create_valid(DisasterRecoveryDrills, drill_name="Annual DR Drill")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.drill_name, "Annual DR Drill")


class TestDisasterRecoveryDrillsStr(TestCase):
    def test_str(self):
        obj = create_valid(DisasterRecoveryDrills, drill_name="Drill")
        self.assertIsInstance(str(obj), str)


# ===== 23. KeyHolderRegistry =====
class TestKeyHolderRegistryCreate(TestCase):
    def test_create(self):
        obj = create_valid(KeyHolderRegistry)
        self.assertIsNotNone(obj.id)


class TestKeyHolderRegistryStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(KeyHolderRegistry)), str)


# ===== 24. RecoveryTimeObjectives =====
class TestRecoveryTimeObjectivesCreate(TestCase):
    def test_create(self):
        obj = create_valid(RecoveryTimeObjectives)
        self.assertIsNotNone(obj.id)


class TestRecoveryTimeObjectivesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(RecoveryTimeObjectives)), str)


# ===== 25. EmergencyDeclarations =====
class TestEmergencyDeclarationsCreate(TestCase):
    def test_create(self):
        obj = create_valid(EmergencyDeclarations)
        self.assertIsNotNone(obj.id)


class TestEmergencyDeclarationsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(EmergencyDeclarations)), str)


# ===== 26. BreakGlassActivations (FK → EmergencyDeclarations) =====
class TestBreakGlassActivationsCreate(TestCase):
    def test_create(self):
        emergency = create_valid(EmergencyDeclarations)
        obj = create_valid(BreakGlassActivations,
            emergency=emergency,
            activation_initiated_at=timezone.now(),
            activation_reason="Critical system failure",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.emergency, emergency)
        self.assertEqual(obj.required_signatures, 3)
        self.assertEqual(obj.signatures_received, 0)


class TestBreakGlassActivationsStr(TestCase):
    def test_str(self):
        emergency = create_valid(EmergencyDeclarations)
        obj = create_valid(BreakGlassActivations,
            emergency=emergency,
            activation_initiated_at=timezone.now(),
            activation_reason="r",
        )
        self.assertIsInstance(str(obj), str)


# ===== 27. UserConsents =====
class TestUserConsentsCreate(TestCase):
    def test_create(self):
        obj = create_valid(UserConsents)
        self.assertIsNotNone(obj.id)


class TestUserConsentsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(UserConsents)), str)


# ===== 28. CookieConsents (FK → Profiles, nullable) =====
class TestCookieConsentsCreate(TestCase):
    def test_create(self):
        obj = create_valid(CookieConsents)
        self.assertIsNotNone(obj.id)


class TestCookieConsentsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(CookieConsents)), str)


# ===== 29. GdprDataRequests =====
class TestGdprDataRequestsCreate(TestCase):
    def test_create(self):
        obj = create_valid(GdprDataRequests)
        self.assertIsNotNone(obj.id)


class TestGdprDataRequestsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(GdprDataRequests)), str)


# ===== 30. DataProcessingRecords =====
class TestDataProcessingRecordsCreate(TestCase):
    def test_create(self):
        obj = create_valid(DataProcessingRecords)
        self.assertIsNotNone(obj.id)


class TestDataProcessingRecordsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(DataProcessingRecords)), str)


# ===== 31. DataRetentionPolicies =====
class TestDataRetentionPoliciesCreate(TestCase):
    def test_create(self):
        obj = create_valid(DataRetentionPolicies)
        self.assertIsNotNone(obj.id)


class TestDataRetentionPoliciesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(DataRetentionPolicies)), str)


# ===== 32. DataAnonymizationLog =====
class TestDataAnonymizationLogCreate(TestCase):
    def test_create(self):
        obj = create_valid(DataAnonymizationLog, user_id="user_anon_1")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_anon_1")


class TestDataAnonymizationLogStr(TestCase):
    def test_str(self):
        obj = create_valid(DataAnonymizationLog, user_id="u")
        self.assertIsInstance(str(obj), str)


# ===== 33. LocationTracking =====
class TestLocationTrackingCreate(TestCase):
    def test_create(self):
        obj = create_valid(LocationTracking)
        self.assertIsNotNone(obj.id)


class TestLocationTrackingStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(LocationTracking)), str)


# ===== 34. Geofences (__str__ = name) =====
class TestGeofencesCreate(TestCase):
    def test_create(self):
        obj = create_valid(Geofences, name="Plant Perimeter")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "Plant Perimeter")


class TestGeofencesStr(TestCase):
    def test_str(self):
        obj = create_valid(Geofences, name="Zone A")
        self.assertEqual(str(obj), "Zone A")


# ===== 35. GeofenceEvents =====
class TestGeofenceEventsCreate(TestCase):
    def test_create(self):
        obj = create_valid(GeofenceEvents)
        self.assertIsNotNone(obj.id)


class TestGeofenceEventsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(GeofenceEvents)), str)


# ===== 36. LocationTrackingAudit =====
class TestLocationTrackingAuditCreate(TestCase):
    def test_create(self):
        obj = create_valid(LocationTrackingAudit)
        self.assertIsNotNone(obj.id)


class TestLocationTrackingAuditStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(LocationTrackingAudit)), str)


# ===== 37. LocationDeletionLog =====
class TestLocationDeletionLogCreate(TestCase):
    def test_create(self):
        obj = create_valid(LocationDeletionLog)
        self.assertIsNotNone(obj.id)


class TestLocationDeletionLogStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(LocationDeletionLog)), str)


# ===== 38. LocationTrackingConfig =====
class TestLocationTrackingConfigCreate(TestCase):
    def test_create(self):
        obj = create_valid(LocationTrackingConfig)
        self.assertIsNotNone(obj.id)
        self.assertFalse(obj.location_tracking_enabled)


class TestLocationTrackingConfigStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(LocationTrackingConfig)), str)


# ===== 39. ForeignWorkers (__str__ = email) =====
class TestForeignWorkersCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(ForeignWorkers,
            first_name="Jean",
            last_name="Dupont",
            email=f"jean{uuid.uuid4().hex[:6]}@example.com",
            work_permit_number=f"WP-{uuid.uuid4().hex[:8]}",
            work_permit_expiry=now,
            country_of_origin="France",
            employer_id=uuid.uuid4(),
            position_title="Welder",
            noc_code="7237",
            start_date=now,
            immigration_pathway="TFWP",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.first_name, "Jean")
        self.assertEqual(obj.compliance_status, "pending")


class TestForeignWorkersStr(TestCase):
    def test_str(self):
        now = timezone.now()
        email = f"fw{uuid.uuid4().hex[:6]}@example.com"
        obj = create_valid(ForeignWorkers,
            first_name="A",
            last_name="B",
            email=email,
            work_permit_number=f"WP-{uuid.uuid4().hex[:8]}",
            work_permit_expiry=now,
            country_of_origin="C",
            employer_id=uuid.uuid4(),
            position_title="P",
            noc_code="0000",
            start_date=now,
            immigration_pathway="IP",
        )
        self.assertEqual(str(obj), email)


# ===== 40. LmbpLetters =====
class TestLmbpLettersCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(LmbpLetters,
            employer_id=uuid.uuid4(),
            employer_name="Acme Corp",
            letter_number=f"LMBP-{uuid.uuid4().hex[:8]}",
            generated_date=now,
            valid_from=now,
            valid_until=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.employer_name, "Acme Corp")


class TestLmbpLettersStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(LmbpLetters,
            employer_id=uuid.uuid4(),
            employer_name="E",
            letter_number=f"L-{uuid.uuid4().hex[:8]}",
            generated_date=now,
            valid_from=now,
            valid_until=now,
        )
        self.assertIsInstance(str(obj), str)


# ===== 41. GssApplications =====
class TestGssApplicationsCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(GssApplications,
            foreign_worker_id=uuid.uuid4(),
            application_number=f"GSS-{uuid.uuid4().hex[:8]}",
            submission_date=now,
            gss_category="Category A",
            expected_decision_date=now,
            employer_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.status, "submitted")


class TestGssApplicationsStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(GssApplications,
            foreign_worker_id=uuid.uuid4(),
            application_number=f"G-{uuid.uuid4().hex[:8]}",
            submission_date=now,
            gss_category="C",
            expected_decision_date=now,
            employer_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


# ===== 42. Mentorships =====
class TestMentorshipsCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(Mentorships,
            mentee_id=uuid.uuid4(),
            mentee_name="Alice",
            mentor_id=uuid.uuid4(),
            mentor_name="Bob",
            start_date=now,
            employer_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.mentee_name, "Alice")
        self.assertEqual(obj.status, "active")
        self.assertFalse(obj.canadian_worker_trained)


class TestMentorshipsStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(Mentorships,
            mentee_id=uuid.uuid4(),
            mentee_name="M",
            mentor_id=uuid.uuid4(),
            mentor_name="N",
            start_date=now,
            employer_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


# ===== 43. LmbpComplianceAlerts (__str__ = title) =====
class TestLmbpComplianceAlertsCreate(TestCase):
    def test_create(self):
        obj = create_valid(LmbpComplianceAlerts,
            alert_type="permit_expiry",
            severity="high",
            title="Work Permit Expiring Soon",
            description="Permit expires in 30 days",
            triggered_at=timezone.now(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.status, "open")


class TestLmbpComplianceAlertsStr(TestCase):
    def test_str(self):
        obj = create_valid(LmbpComplianceAlerts,
            alert_type="a",
            severity="low",
            title="Alert Title",
            description="d",
            triggered_at=timezone.now(),
        )
        self.assertEqual(str(obj), "Alert Title")


# ===== 44. LmbpComplianceReports =====
class TestLmbpComplianceReportsCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(LmbpComplianceReports,
            lmbp_letter_id=uuid.uuid4(),
            employer_id=uuid.uuid4(),
            reporting_period_start=now,
            reporting_period_end=now,
            total_foreign_workers=10,
            total_mentorships=5,
            mentorships_completed=3,
            canadian_workers_hired=2,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.total_foreign_workers, 10)
        self.assertFalse(obj.submitted_to_ircc)


class TestLmbpComplianceReportsStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(LmbpComplianceReports,
            lmbp_letter_id=uuid.uuid4(),
            employer_id=uuid.uuid4(),
            reporting_period_start=now,
            reporting_period_end=now,
            total_foreign_workers=1,
            total_mentorships=0,
            mentorships_completed=0,
            canadian_workers_hired=0,
        )
        self.assertIsInstance(str(obj), str)


# ===== 45. BandCouncils =====
class TestBandCouncilsCreate(TestCase):
    def test_create(self):
        obj = create_valid(BandCouncils, band_name="Squamish Nation")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.band_name, "Squamish Nation")


class TestBandCouncilsStr(TestCase):
    def test_str(self):
        obj = create_valid(BandCouncils, band_name="BC")
        self.assertIsInstance(str(obj), str)


# ===== 46. BandCouncilConsent =====
class TestBandCouncilConsentCreate(TestCase):
    def test_create(self):
        obj = create_valid(BandCouncilConsent, band_council_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestBandCouncilConsentStr(TestCase):
    def test_str(self):
        obj = create_valid(BandCouncilConsent, band_council_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 47. IndigenousMemberData =====
class TestIndigenousMemberDataCreate(TestCase):
    def test_create(self):
        obj = create_valid(IndigenousMemberData)
        self.assertIsNotNone(obj.id)


class TestIndigenousMemberDataStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(IndigenousMemberData)), str)


# ===== 48. IndigenousDataAccessLog =====
class TestIndigenousDataAccessLogCreate(TestCase):
    def test_create(self):
        obj = create_valid(IndigenousDataAccessLog)
        self.assertIsNotNone(obj.id)


class TestIndigenousDataAccessLogStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(IndigenousDataAccessLog)), str)


# ===== 49. IndigenousDataSharingAgreements =====
class TestIndigenousDataSharingAgreementsCreate(TestCase):
    def test_create(self):
        obj = create_valid(IndigenousDataSharingAgreements,
            band_council_id=uuid.uuid4(),
            partner_name="University of BC",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.partner_name, "University of BC")


class TestIndigenousDataSharingAgreementsStr(TestCase):
    def test_str(self):
        obj = create_valid(IndigenousDataSharingAgreements,
            band_council_id=uuid.uuid4(),
            partner_name="P",
        )
        self.assertIsInstance(str(obj), str)


# ===== 50. TraditionalKnowledgeRegistry =====
class TestTraditionalKnowledgeRegistryCreate(TestCase):
    def test_create(self):
        obj = create_valid(TraditionalKnowledgeRegistry,
            band_council_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)


class TestTraditionalKnowledgeRegistryStr(TestCase):
    def test_str(self):
        obj = create_valid(TraditionalKnowledgeRegistry,
            band_council_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


# ===== 51–55. PCI DSS models =====
class TestPciDssSaqAssessmentsCreate(TestCase):
    def test_create(self):
        obj = create_valid(PciDssSaqAssessments)
        self.assertIsNotNone(obj.id)


class TestPciDssSaqAssessmentsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(PciDssSaqAssessments)), str)


class TestPciDssRequirementsCreate(TestCase):
    def test_create(self):
        obj = create_valid(PciDssRequirements, assessment_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestPciDssRequirementsStr(TestCase):
    def test_str(self):
        obj = create_valid(PciDssRequirements, assessment_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestPciDssQuarterlyScansCreate(TestCase):
    def test_create(self):
        obj = create_valid(PciDssQuarterlyScans)
        self.assertIsNotNone(obj.id)


class TestPciDssQuarterlyScansStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(PciDssQuarterlyScans)), str)


class TestPciDssCardholderDataFlowCreate(TestCase):
    def test_create(self):
        obj = create_valid(PciDssCardholderDataFlow)
        self.assertIsNotNone(obj.id)


class TestPciDssCardholderDataFlowStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(PciDssCardholderDataFlow)), str)


class TestPciDssEncryptionKeysCreate(TestCase):
    def test_create(self):
        obj = create_valid(PciDssEncryptionKeys)
        self.assertIsNotNone(obj.id)


class TestPciDssEncryptionKeysStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(PciDssEncryptionKeys)), str)


# ===== 56–60. Provincial privacy models =====
class TestProvincialPrivacyConfigCreate(TestCase):
    def test_create(self):
        obj = create_valid(ProvincialPrivacyConfig)
        self.assertIsNotNone(obj.id)


class TestProvincialPrivacyConfigStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ProvincialPrivacyConfig)), str)


class TestProvincialConsentCreate(TestCase):
    def test_create(self):
        obj = create_valid(ProvincialConsent)
        self.assertIsNotNone(obj.id)


class TestProvincialConsentStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ProvincialConsent)), str)


class TestPrivacyBreachesCreate(TestCase):
    def test_create(self):
        obj = create_valid(PrivacyBreaches)
        self.assertIsNotNone(obj.id)


class TestPrivacyBreachesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(PrivacyBreaches)), str)


class TestProvincialDataHandlingCreate(TestCase):
    def test_create(self):
        obj = create_valid(ProvincialDataHandling)
        self.assertIsNotNone(obj.id)


class TestProvincialDataHandlingStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ProvincialDataHandling)), str)


class TestDataSubjectAccessRequestsCreate(TestCase):
    def test_create(self):
        obj = create_valid(DataSubjectAccessRequests)
        self.assertIsNotNone(obj.id)


class TestDataSubjectAccessRequestsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(DataSubjectAccessRequests)), str)


# ===== 61–64. LRB models =====
class TestLrbAgreementsCreate(TestCase):
    def test_create(self):
        obj = create_valid(LrbAgreements)
        self.assertIsNotNone(obj.id)


class TestLrbAgreementsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(LrbAgreements)), str)


class TestLrbEmployersCreate(TestCase):
    def test_create(self):
        obj = create_valid(LrbEmployers)
        self.assertIsNotNone(obj.id)


class TestLrbEmployersStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(LrbEmployers)), str)


class TestLrbUnionsCreate(TestCase):
    def test_create(self):
        obj = create_valid(LrbUnions)
        self.assertIsNotNone(obj.id)


class TestLrbUnionsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(LrbUnions)), str)


class TestLrbSyncLogCreate(TestCase):
    def test_create(self):
        obj = create_valid(LrbSyncLog)
        self.assertIsNotNone(obj.id)


class TestLrbSyncLogStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(LrbSyncLog)), str)


# ===== 65–72. Conflict of interest models =====
class TestConflictOfInterestPolicyCreate(TestCase):
    def test_create(self):
        obj = create_valid(ConflictOfInterestPolicy)
        self.assertIsNotNone(obj.id)
        self.assertTrue(obj.policy_enabled)


class TestConflictOfInterestPolicyStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ConflictOfInterestPolicy)), str)


class TestBlindTrustRegistryCreate(TestCase):
    def test_create(self):
        obj = create_valid(BlindTrustRegistry)
        self.assertIsNotNone(obj.id)


class TestBlindTrustRegistryStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(BlindTrustRegistry)), str)


class TestConflictDisclosuresCreate(TestCase):
    def test_create(self):
        obj = create_valid(ConflictDisclosures)
        self.assertIsNotNone(obj.id)


class TestConflictDisclosuresStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ConflictDisclosures)), str)


class TestArmsLengthVerificationCreate(TestCase):
    def test_create(self):
        obj = create_valid(ArmsLengthVerification, transaction_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestArmsLengthVerificationStr(TestCase):
    def test_str(self):
        obj = create_valid(ArmsLengthVerification, transaction_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestRecusalTrackingCreate(TestCase):
    def test_create(self):
        obj = create_valid(RecusalTracking)
        self.assertIsNotNone(obj.id)


class TestRecusalTrackingStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(RecusalTracking)), str)


class TestConflictReviewCommitteeCreate(TestCase):
    def test_create(self):
        obj = create_valid(ConflictReviewCommittee)
        self.assertIsNotNone(obj.id)


class TestConflictReviewCommitteeStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ConflictReviewCommittee)), str)


class TestConflictTrainingCreate(TestCase):
    def test_create(self):
        obj = create_valid(ConflictTraining)
        self.assertIsNotNone(obj.id)


class TestConflictTrainingStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ConflictTraining)), str)


class TestConflictAuditLogCreate(TestCase):
    def test_create(self):
        obj = create_valid(ConflictAuditLog)
        self.assertIsNotNone(obj.id)


class TestConflictAuditLogStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(ConflictAuditLog)), str)


# ===== 73. GoldenShares =====
class TestGoldenSharesCreate(TestCase):
    def test_create(self):
        obj = create_valid(GoldenShares,
            certificate_number=f"CERT-{uuid.uuid4().hex[:8]}",
            issue_date=date(2025, 1, 1),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.share_class, "B")
        self.assertEqual(obj.holder_type, "council")
        self.assertEqual(obj.voting_power_reserved_matters, 51)
        self.assertEqual(obj.status, "active")


class TestGoldenSharesStr(TestCase):
    def test_str(self):
        obj = create_valid(GoldenShares,
            certificate_number=f"C-{uuid.uuid4().hex[:8]}",
            issue_date=date(2025, 1, 1),
        )
        self.assertIsInstance(str(obj), str)


# ===== 74. ReservedMatterVotes (__str__ = title) =====
class TestReservedMatterVotesCreate(TestCase):
    def test_create(self):
        obj = create_valid(ReservedMatterVotes,
            matter_type="charter_amendment",
            title="Amend Article 5",
            description="Proposed amendment to governance article",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.matter_type, "charter_amendment")


class TestReservedMatterVotesStr(TestCase):
    def test_str(self):
        obj = create_valid(ReservedMatterVotes,
            matter_type="m",
            title="Vote Title",
            description="d",
        )
        self.assertEqual(str(obj), "Vote Title")


# ===== 75. MissionAudits =====
class TestMissionAuditsCreate(TestCase):
    def test_create(self):
        obj = create_valid(MissionAudits,
            audit_year=2025,
            audit_period_start=date(2025, 1, 1),
            audit_period_end=date(2025, 6, 30),
            auditor_firm="KPMG",
            auditor_name="Jane Smith",
            audit_date=date(2025, 7, 15),
            union_revenue_percent=95,
            member_satisfaction_percent=88,
            auditor_opinion="Compliant",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.audit_year, 2025)
        self.assertFalse(obj.overall_pass)


class TestMissionAuditsStr(TestCase):
    def test_str(self):
        obj = create_valid(MissionAudits,
            audit_year=2025,
            audit_period_start=date(2025, 1, 1),
            audit_period_end=date(2025, 6, 30),
            auditor_firm="F",
            auditor_name="N",
            audit_date=date(2025, 7, 1),
            union_revenue_percent=90,
            member_satisfaction_percent=80,
            auditor_opinion="O",
        )
        self.assertIsInstance(str(obj), str)


# ===== 76. GovernanceEvents (__str__ = title) =====
class TestGovernanceEventsCreate(TestCase):
    def test_create(self):
        now = timezone.now()
        obj = create_valid(GovernanceEvents,
            event_type="golden_share_issued",
            event_date=now,
            title="Golden Share Issuance",
            description="New golden share issued to council",
            created_at=now,
        )
        self.assertIsNotNone(obj.id)
        self.assertFalse(obj.notifications_sent)


class TestGovernanceEventsStr(TestCase):
    def test_str(self):
        now = timezone.now()
        obj = create_valid(GovernanceEvents,
            event_type="e",
            event_date=now,
            title="Event Title",
            description="d",
            created_at=now,
        )
        self.assertEqual(str(obj), "Event Title")


# ===== 77. CouncilElections =====
class TestCouncilElectionsCreate(TestCase):
    def test_create(self):
        obj = create_valid(CouncilElections,
            election_year=2025,
            election_date=date(2025, 11, 15),
            positions_available=5,
            total_votes=1200,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.election_year, 2025)
        self.assertFalse(obj.contested_results)


class TestCouncilElectionsStr(TestCase):
    def test_str(self):
        obj = create_valid(CouncilElections,
            election_year=2025,
            election_date=date(2025, 1, 1),
            positions_available=1,
            total_votes=10,
        )
        self.assertIsInstance(str(obj), str)


# ===== 78–88. Health & Safety models (UUID org required) =====
class TestWorkplaceIncidentsCreate(TestCase):
    def test_create(self):
        obj = create_valid(WorkplaceIncidents, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestWorkplaceIncidentsStr(TestCase):
    def test_str(self):
        obj = create_valid(WorkplaceIncidents, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestSafetyInspectionsCreate(TestCase):
    def test_create(self):
        obj = create_valid(SafetyInspections, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestSafetyInspectionsStr(TestCase):
    def test_str(self):
        obj = create_valid(SafetyInspections, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestHazardReportsCreate(TestCase):
    def test_create(self):
        obj = create_valid(HazardReports, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestHazardReportsStr(TestCase):
    def test_str(self):
        obj = create_valid(HazardReports, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestSafetyCommitteeMeetingsCreate(TestCase):
    def test_create(self):
        obj = create_valid(SafetyCommitteeMeetings, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestSafetyCommitteeMeetingsStr(TestCase):
    def test_str(self):
        obj = create_valid(SafetyCommitteeMeetings, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestSafetyTrainingRecordsCreate(TestCase):
    def test_create(self):
        obj = create_valid(SafetyTrainingRecords, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestSafetyTrainingRecordsStr(TestCase):
    def test_str(self):
        obj = create_valid(SafetyTrainingRecords, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestPpeEquipmentCreate(TestCase):
    def test_create(self):
        obj = create_valid(PpeEquipment, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestPpeEquipmentStr(TestCase):
    def test_str(self):
        obj = create_valid(PpeEquipment, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestSafetyAuditsCreate(TestCase):
    def test_create(self):
        obj = create_valid(SafetyAudits, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestSafetyAuditsStr(TestCase):
    def test_str(self):
        obj = create_valid(SafetyAudits, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestInjuryLogsCreate(TestCase):
    def test_create(self):
        obj = create_valid(InjuryLogs, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestInjuryLogsStr(TestCase):
    def test_str(self):
        obj = create_valid(InjuryLogs, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestSafetyPoliciesCreate(TestCase):
    def test_create(self):
        obj = create_valid(SafetyPolicies, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestSafetyPoliciesStr(TestCase):
    def test_str(self):
        obj = create_valid(SafetyPolicies, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestCorrectiveActionsCreate(TestCase):
    def test_create(self):
        obj = create_valid(CorrectiveActions, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestCorrectiveActionsStr(TestCase):
    def test_str(self):
        obj = create_valid(CorrectiveActions, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestSafetyCertificationsCreate(TestCase):
    def test_create(self):
        obj = create_valid(SafetyCertifications, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestSafetyCertificationsStr(TestCase):
    def test_str(self):
        obj = create_valid(SafetyCertifications, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 89. PolicyRules (__str__ = name) =====
class TestPolicyRulesCreate(TestCase):
    def test_create(self):
        obj = create_valid(PolicyRules, name="Data Retention 7yr")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "Data Retention 7yr")


class TestPolicyRulesStr(TestCase):
    def test_str(self):
        obj = create_valid(PolicyRules, name="Rule X")
        self.assertEqual(str(obj), "Rule X")


# ===== 90. PolicyEvaluations (FK → PolicyRules) =====
class TestPolicyEvaluationsCreate(TestCase):
    def test_create(self):
        rule = create_valid(PolicyRules, name="R")
        obj = create_valid(PolicyEvaluations, rule=rule)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.rule, rule)


class TestPolicyEvaluationsStr(TestCase):
    def test_str(self):
        rule = create_valid(PolicyRules, name="R")
        obj = create_valid(PolicyEvaluations, rule=rule)
        self.assertIsInstance(str(obj), str)


# ===== 91. RetentionPolicies (__str__ = name) =====
class TestRetentionPoliciesCreate(TestCase):
    def test_create(self):
        obj = create_valid(RetentionPolicies, name="7-Year Financial")
        self.assertIsNotNone(obj.id)


class TestRetentionPoliciesStr(TestCase):
    def test_str(self):
        obj = create_valid(RetentionPolicies, name="RP1")
        self.assertEqual(str(obj), "RP1")


# ===== 92. LegalHolds (__str__ = name) =====
class TestLegalHoldsCreate(TestCase):
    def test_create(self):
        obj = create_valid(LegalHolds, name="Litigation Hold 2025")
        self.assertIsNotNone(obj.id)


class TestLegalHoldsStr(TestCase):
    def test_str(self):
        obj = create_valid(LegalHolds, name="LH1")
        self.assertEqual(str(obj), "LH1")


# ===== 93. PolicyExceptions (FK → PolicyRules) =====
class TestPolicyExceptionsCreate(TestCase):
    def test_create(self):
        rule = create_valid(PolicyRules, name="R")
        obj = create_valid(PolicyExceptions, rule=rule)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.rule, rule)


class TestPolicyExceptionsStr(TestCase):
    def test_str(self):
        rule = create_valid(PolicyRules, name="R")
        obj = create_valid(PolicyExceptions, rule=rule)
        self.assertIsInstance(str(obj), str)
