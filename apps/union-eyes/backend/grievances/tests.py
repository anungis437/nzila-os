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
from core.testing import create_valid

# ---------------------------------------------------------------------------
# Claims & related
# ---------------------------------------------------------------------------


class ClaimsModelTest(TestCase):
    """Central claims model — has __str__ = claim_number."""

    def test_create(self):
        obj = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-2025-001",
            status="submitted",
            priority="medium",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.claim_number, "CLM-2025-001")
        self.assertEqual(obj.status, "submitted")

    def test_str(self):
        obj = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-2025-002",
        )
        self.assertEqual(str(obj), "CLM-2025-002")

    def test_defaults(self):
        obj = create_valid(Claims, organization_id=uuid.uuid4())
        self.assertEqual(obj.status, "submitted")
        self.assertEqual(obj.priority, "medium")
        self.assertTrue(obj.is_anonymous)
        self.assertEqual(obj.progress, 0)


class ClaimPrecedentAnalysisModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ClaimPrecedentAnalysis, claim_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_str(self):
        obj = create_valid(ClaimPrecedentAnalysis, claim_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ClaimUpdatesModelTest(TestCase):
    def test_create(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-CU-001",
        )
        obj = create_valid(ClaimUpdates, claim=claim)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.claim, claim)

    def test_str(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-CU-002",
        )
        obj = create_valid(ClaimUpdates, claim=claim)
        self.assertIsInstance(str(obj), str)


class DeadlineRulesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(DeadlineRules, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(DeadlineRules, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ClaimDeadlinesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ClaimDeadlines,
            claim_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ClaimDeadlines,
            claim_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class DeadlineExtensionsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(DeadlineExtensions,
            deadline_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(DeadlineExtensions,
            deadline_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class DeadlineAlertsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(DeadlineAlerts,
            deadline_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(DeadlineAlerts,
            deadline_id=uuid.uuid4(),
            organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class DefensibilityPacksModelTest(TestCase):
    def test_create(self):
        obj = create_valid(DefensibilityPacks,
            case_id=uuid.uuid4(),
            case_number="DEF-001",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.case_number, "DEF-001")

    def test_str(self):
        obj = create_valid(DefensibilityPacks, case_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class PackDownloadLogModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PackDownloadLog,
            pack_id=uuid.uuid4(),
            case_number="PDL-001",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.case_number, "PDL-001")

    def test_str(self):
        obj = create_valid(PackDownloadLog, pack_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class PackVerificationLogModelTest(TestCase):
    def test_create(self):
        obj = create_valid(PackVerificationLog,
            pack_id=uuid.uuid4(),
            case_number="PVL-001",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(PackVerificationLog, pack_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Grievances & related
# ---------------------------------------------------------------------------


class GrievancesModelTest(TestCase):
    """Grievances — has __str__ = grievance_number."""

    def test_create(self):
        obj = create_valid(Grievances,
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
        obj = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-2025-002",
        )
        self.assertEqual(str(obj), "GRV-2025-002")

    def test_defaults(self):
        obj = create_valid(Grievances, organization_id=uuid.uuid4())
        self.assertEqual(obj.status, "draft")
        self.assertEqual(obj.priority, "medium")
        self.assertFalse(obj.is_group_grievance)
        self.assertFalse(obj.is_confidential)


class GrievanceResponsesModelTest(TestCase):
    def test_create(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-GR-001",
        )
        obj = create_valid(GrievanceResponses,
            grievance=grv,
            response_number=1,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.response_number, 1)

    def test_str(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-GR-002",
        )
        obj = create_valid(GrievanceResponses, grievance=grv, response_number=1)
        self.assertIsInstance(str(obj), str)


class ArbitrationsModelTest(TestCase):
    def test_create(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-ARB-001",
        )
        obj = create_valid(Arbitrations,
            grievance=grv,
            arbitration_number="ARB-001",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.arbitration_number, "ARB-001")

    def test_str(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-ARB-002",
        )
        obj = create_valid(Arbitrations, grievance=grv)
        self.assertIsInstance(str(obj), str)


class SettlementsModelTest(TestCase):
    def test_create(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-SET-001",
        )
        obj = create_valid(Settlements,
            grievance=grv,
            settlement_type="monetary",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.settlement_type, "monetary")

    def test_create_with_arbitration(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-SET-003",
        )
        arb = create_valid(Arbitrations,
            grievance=grv, arbitration_number="ARB-SET-001"
        )
        obj = create_valid(Settlements,
            grievance=grv,
            arbitration=arb,
            settlement_type="non_monetary",
        )
        self.assertEqual(obj.arbitration, arb)

    def test_str(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-SET-002",
        )
        obj = create_valid(Settlements, grievance=grv, settlement_type="other")
        self.assertIsInstance(str(obj), str)


class GrievanceTimelineModelTest(TestCase):
    def test_create(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-TL-001",
        )
        obj = create_valid(GrievanceTimeline,
            grievance=grv,
            event_type="filed",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-TL-002",
        )
        obj = create_valid(GrievanceTimeline, grievance=grv)
        self.assertIsInstance(str(obj), str)


class GrievanceDeadlinesModelTest(TestCase):
    def test_create(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-DL-001",
        )
        obj = create_valid(GrievanceDeadlines,
            grievance=grv,
            deadline_type="response",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        grv = create_valid(Grievances,
            organization_id=uuid.uuid4(),
            grievance_number="GRV-DL-002",
        )
        obj = create_valid(GrievanceDeadlines, grievance=grv)
        self.assertIsInstance(str(obj), str)


# ---------------------------------------------------------------------------
# Workflows
# ---------------------------------------------------------------------------


class GrievanceWorkflowsModelTest(TestCase):
    """Has __str__ = name."""

    def test_create(self):
        obj = create_valid(GrievanceWorkflows,
            organization_id=uuid.uuid4(),
            name="Standard Workflow",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(GrievanceWorkflows,
            organization_id=uuid.uuid4(),
            name="Standard Workflow",
        )
        self.assertEqual(str(obj), "Standard Workflow")


class GrievanceStagesModelTest(TestCase):
    def test_create(self):
        wf = create_valid(GrievanceWorkflows,
            organization_id=uuid.uuid4(),
            name="WF-GS",
        )
        obj = create_valid(GrievanceStages,
            organization_id=uuid.uuid4(),
            workflow=wf,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.workflow, wf)

    def test_str(self):
        obj = create_valid(GrievanceStages, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class GrievanceTransitionsModelTest(TestCase):
    def test_create(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GT-001",
        )
        wf = create_valid(GrievanceWorkflows,
            organization_id=uuid.uuid4(),
            name="WF-GT",
        )
        to_stage = create_valid(GrievanceStages,
            organization_id=uuid.uuid4(),
            workflow=wf,
        )
        obj = create_valid(GrievanceTransitions,
            organization_id=uuid.uuid4(),
            claim=claim,
            to_stage=to_stage,
            trigger_type="manual",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.trigger_type, "manual")

    def test_str(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GT-002",
        )
        to_stage = create_valid(GrievanceStages, organization_id=uuid.uuid4())
        obj = create_valid(GrievanceTransitions,
            organization_id=uuid.uuid4(),
            claim=claim,
            to_stage=to_stage,
            trigger_type="auto",
        )
        self.assertIsInstance(str(obj), str)


class GrievanceAssignmentsModelTest(TestCase):
    def test_create(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GA-001",
        )
        obj = create_valid(GrievanceAssignments,
            organization_id=uuid.uuid4(),
            claim=claim,
            assigned_to="user_100",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.assigned_to, "user_100")

    def test_str(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GA-002",
        )
        obj = create_valid(GrievanceAssignments,
            organization_id=uuid.uuid4(),
            claim=claim,
        )
        self.assertIsInstance(str(obj), str)


class GrievanceDocumentsModelTest(TestCase):
    def test_create(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GD-001",
        )
        obj = create_valid(GrievanceDocuments,
            organization_id=uuid.uuid4(),
            claim=claim,
            document_name="evidence.pdf",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.document_name, "evidence.pdf")

    def test_str(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GD-002",
        )
        obj = create_valid(GrievanceDocuments,
            organization_id=uuid.uuid4(),
            claim=claim,
        )
        self.assertIsInstance(str(obj), str)


class GrievanceSettlementsModelTest(TestCase):
    def test_create(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GST-001",
        )
        obj = create_valid(GrievanceSettlements,
            organization_id=uuid.uuid4(),
            claim=claim,
            settlement_type="monetary",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GST-002",
        )
        obj = create_valid(GrievanceSettlements,
            organization_id=uuid.uuid4(),
            claim=claim,
        )
        self.assertIsInstance(str(obj), str)


class GrievanceCommunicationsModelTest(TestCase):
    def test_create(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GC-001",
        )
        obj = create_valid(GrievanceCommunications,
            organization_id=uuid.uuid4(),
            claim=claim,
            communication_type="email",
        )
        self.assertIsNotNone(obj.id)

    def test_str(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GC-002",
        )
        obj = create_valid(GrievanceCommunications,
            organization_id=uuid.uuid4(),
            claim=claim,
        )
        self.assertIsInstance(str(obj), str)


class GrievanceApprovalsModelTest(TestCase):
    def test_create(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GAP-001",
        )
        to_stage = create_valid(GrievanceStages, organization_id=uuid.uuid4())
        transition = create_valid(GrievanceTransitions,
            organization_id=uuid.uuid4(),
            claim=claim,
            to_stage=to_stage,
            trigger_type="approval",
        )
        obj = create_valid(GrievanceApprovals,
            organization_id=uuid.uuid4(),
            transition=transition,
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.transition, transition)

    def test_str(self):
        claim = create_valid(Claims,
            organization_id=uuid.uuid4(),
            claim_number="CLM-GAP-002",
        )
        to_stage = create_valid(GrievanceStages, organization_id=uuid.uuid4())
        transition = create_valid(GrievanceTransitions,
            organization_id=uuid.uuid4(),
            claim=claim,
            to_stage=to_stage,
            trigger_type="approval",
        )
        obj = create_valid(GrievanceApprovals,
            organization_id=uuid.uuid4(),
            transition=transition,
        )
        self.assertIsInstance(str(obj), str)
