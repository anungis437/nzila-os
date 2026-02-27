"""
Tests for grievances models.
"""

import uuid

from django.test import TestCase

from .models import (
    Arbitrations,
    ClaimDeadlines,
    ClaimPrecedentAnalysis,
    Claims,
    ClaimUpdates,
    DeadlineAlerts,
    DeadlineExtensions,
    DeadlineRules,
    DefensibilityPacks,
    GrievanceApprovals,
    GrievanceAssignments,
    GrievanceCommunications,
    GrievanceDeadlines,
    GrievanceDocuments,
    GrievanceResponses,
    Grievances,
    GrievanceSettlements,
    GrievanceStages,
    GrievanceTimeline,
    GrievanceTransitions,
    GrievanceWorkflows,
    PackDownloadLog,
    PackVerificationLog,
    Settlements,
)

# ---------------------------------------------------------------------------
# Claims & related
# ---------------------------------------------------------------------------


class ClaimsModelTest(TestCase):
    """Central claims model — has __str__ = claim_number."""

    def test_create(self):
        obj = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-2025-001",
            status="submitted",
            priority="medium",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.claim_number, "CLM-2025-001")
        self.assertEqual(obj.status, "submitted")

    def test_str(self):
        obj = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-2025-002",
        )
        self.assertEqual(str(obj), "CLM-2025-002")

    def test_defaults(self):
        obj = Claims.objects.create(organization_id=uuid.uuid4())
        self.assertEqual(obj.status, "submitted")
        self.assertEqual(obj.priority, "medium")
        self.assertTrue(obj.is_anonymous)
        self.assertEqual(obj.progress, 0)


class ClaimPrecedentAnalysisModelTest(TestCase):
    def test_create(self):
        obj = ClaimPrecedentAnalysis.objects.create(claim_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_str(self):
        obj = ClaimPrecedentAnalysis.objects.create(claim_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ClaimUpdatesModelTest(TestCase):
    def test_create(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-CU-001",
        )
        obj = ClaimUpdates.objects.create(claim=claim)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.claim, claim)

    def test_str(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-CU-002",
        )
        obj = ClaimUpdates.objects.create(claim=claim)
        self.assertIsInstance(str(obj), str)


class DeadlineRulesModelTest(TestCase):
    def test_create(self):
        obj = DeadlineRules.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = DeadlineRules.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ClaimDeadlinesModelTest(TestCase):
    def test_create(self):
        obj = ClaimDeadlines.objects.create(
            claim_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ClaimDeadlines.objects.create(
            claim_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class DeadlineExtensionsModelTest(TestCase):
    def test_create(self):
        obj = DeadlineExtensions.objects.create(
            deadline_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = DeadlineExtensions.objects.create(
            deadline_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class DeadlineAlertsModelTest(TestCase):
    def test_create(self):
        obj = DeadlineAlerts.objects.create(
            deadline_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = DeadlineAlerts.objects.create(
            deadline_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class DefensibilityPacksModelTest(TestCase):
    def test_create(self):
        obj = DefensibilityPacks.objects.create(
            case_id=uuid.uuid4(),
            case_number="DEF-001",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.case_number, "DEF-001")

    def test_str(self):
        obj = DefensibilityPacks.objects.create(case_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class PackDownloadLogModelTest(TestCase):
    def test_create(self):
        obj = PackDownloadLog.objects.create(
            pack_id=uuid.uuid4(),
            case_number="PDL-001",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.case_number, "PDL-001")

    def test_str(self):
        obj = PackDownloadLog.objects.create(pack_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class PackVerificationLogModelTest(TestCase):
    def test_create(self):
        obj = PackVerificationLog.objects.create(
            pack_id=uuid.uuid4(),
            case_number="PVL-001",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = PackVerificationLog.objects.create(pack_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Grievances & related
# ---------------------------------------------------------------------------


class GrievancesModelTest(TestCase):
    """Grievances — has __str__ = grievance_number."""

    def test_create(self):
        obj = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-2025-001",
            type="individual",
            status="draft",
            priority="medium",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.grievance_number, "GRV-2025-001")
        self.assertEqual(obj.type, "individual")

    def test_str(self):
        obj = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-2025-002",
        )
        self.assertEqual(str(obj), "GRV-2025-002")

    def test_defaults(self):
        obj = Grievances.objects.create(organization_id=uuid.uuid4())
        self.assertEqual(obj.status, "draft")
        self.assertEqual(obj.priority, "medium")
        self.assertFalse(obj.is_group_grievance)
        self.assertFalse(obj.is_confidential)


class GrievanceResponsesModelTest(TestCase):
    def test_create(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-GR-001",
        )
        obj = GrievanceResponses.objects.create(
            grievance=grv,
            response_number=1,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.response_number, 1)

    def test_str(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-GR-002",
        )
        obj = GrievanceResponses.objects.create(grievance=grv, response_number=1)
        self.assertIsInstance(str(obj), str)


class ArbitrationsModelTest(TestCase):
    def test_create(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-ARB-001",
        )
        obj = Arbitrations.objects.create(
            grievance=grv,
            arbitration_number="ARB-001",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.arbitration_number, "ARB-001")

    def test_str(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-ARB-002",
        )
        obj = Arbitrations.objects.create(grievance=grv)
        self.assertIsInstance(str(obj), str)


class SettlementsModelTest(TestCase):
    def test_create(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-SET-001",
        )
        obj = Settlements.objects.create(
            grievance=grv,
            settlement_type="monetary",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.settlement_type, "monetary")

    def test_create_with_arbitration(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-SET-003",
        )
        arb = Arbitrations.objects.create(
            grievance=grv, arbitration_number="ARB-SET-001"
        )
        obj = Settlements.objects.create(
            grievance=grv,
            arbitration=arb,
            settlement_type="non_monetary",
        )
        self.assertEqual(obj.arbitration, arb)

    def test_str(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-SET-002",
        )
        obj = Settlements.objects.create(grievance=grv, settlement_type="other")
        self.assertIsInstance(str(obj), str)


class GrievanceTimelineModelTest(TestCase):
    def test_create(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-TL-001",
        )
        obj = GrievanceTimeline.objects.create(
            grievance=grv,
            event_type="filed",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-TL-002",
        )
        obj = GrievanceTimeline.objects.create(grievance=grv)
        self.assertIsInstance(str(obj), str)


class GrievanceDeadlinesModelTest(TestCase):
    def test_create(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-DL-001",
        )
        obj = GrievanceDeadlines.objects.create(
            grievance=grv,
            deadline_type="response",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        grv = Grievances.objects.create(
            organization_id=uuid.uuid4(),
            grievance_number="GRV-DL-002",
        )
        obj = GrievanceDeadlines.objects.create(grievance=grv)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------


class GrievanceWorkflowsModelTest(TestCase):
    """Has __str__ = name."""

    def test_create(self):
        obj = GrievanceWorkflows.objects.create(
            organization_id=uuid.uuid4(),
            name="Standard Workflow",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = GrievanceWorkflows.objects.create(
            organization_id=uuid.uuid4(),
            name="Standard Workflow",
        )
        self.assertEqual(str(obj), "Standard Workflow")


class GrievanceStagesModelTest(TestCase):
    def test_create(self):
        wf = GrievanceWorkflows.objects.create(
            organization_id=uuid.uuid4(),
            name="WF-GS",
        )
        obj = GrievanceStages.objects.create(
            organization_id=uuid.uuid4(),
            workflow=wf,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.workflow, wf)

    def test_str(self):
        obj = GrievanceStages.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class GrievanceTransitionsModelTest(TestCase):
    def test_create(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GT-001",
        )
        wf = GrievanceWorkflows.objects.create(
            organization_id=uuid.uuid4(),
            name="WF-GT",
        )
        to_stage = GrievanceStages.objects.create(
            organization_id=uuid.uuid4(),
            workflow=wf,
        )
        obj = GrievanceTransitions.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
            to_stage=to_stage,
            trigger_type="manual",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.trigger_type, "manual")

    def test_str(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GT-002",
        )
        to_stage = GrievanceStages.objects.create(organization_id=uuid.uuid4())
        obj = GrievanceTransitions.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
            to_stage=to_stage,
            trigger_type="auto",
        )
        self.assertIsInstance(str(obj), str)


class GrievanceAssignmentsModelTest(TestCase):
    def test_create(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GA-001",
        )
        obj = GrievanceAssignments.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
            assigned_to="user_100",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.assigned_to, "user_100")

    def test_str(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GA-002",
        )
        obj = GrievanceAssignments.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
        )
        self.assertIsInstance(str(obj), str)


class GrievanceDocumentsModelTest(TestCase):
    def test_create(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GD-001",
        )
        obj = GrievanceDocuments.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
            document_name="evidence.pdf",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.document_name, "evidence.pdf")

    def test_str(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GD-002",
        )
        obj = GrievanceDocuments.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
        )
        self.assertIsInstance(str(obj), str)


class GrievanceSettlementsModelTest(TestCase):
    def test_create(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GST-001",
        )
        obj = GrievanceSettlements.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
            settlement_type="monetary",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GST-002",
        )
        obj = GrievanceSettlements.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
        )
        self.assertIsInstance(str(obj), str)


class GrievanceCommunicationsModelTest(TestCase):
    def test_create(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GC-001",
        )
        obj = GrievanceCommunications.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
            communication_type="email",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GC-002",
        )
        obj = GrievanceCommunications.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
        )
        self.assertIsInstance(str(obj), str)


class GrievanceApprovalsModelTest(TestCase):
    def test_create(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GAP-001",
        )
        to_stage = GrievanceStages.objects.create(organization_id=uuid.uuid4())
        transition = GrievanceTransitions.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
            to_stage=to_stage,
            trigger_type="approval",
        )
        obj = GrievanceApprovals.objects.create(
            organization_id=uuid.uuid4(),
            transition=transition,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.transition, transition)

    def test_str(self):
        claim = Claims.objects.create(
            organization_id=uuid.uuid4(),
            claim_number="CLM-GAP-002",
        )
        to_stage = GrievanceStages.objects.create(organization_id=uuid.uuid4())
        transition = GrievanceTransitions.objects.create(
            organization_id=uuid.uuid4(),
            claim=claim,
            to_stage=to_stage,
            trigger_type="approval",
        )
        obj = GrievanceApprovals.objects.create(
            organization_id=uuid.uuid4(),
            transition=transition,
        )
        self.assertIsInstance(str(obj), str)
