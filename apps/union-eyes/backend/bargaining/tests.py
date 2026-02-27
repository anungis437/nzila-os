"""
Tests for bargaining models.
"""

import uuid

from django.test import TestCase

from .models import (
    ArbitrationDecisions,
    ArbitrationPrecedents,
    ArbitratorProfiles,
    BargainingNotes,
    BargainingProposals,
    BargainingTeamMembers,
    BenefitComparisons,
    CbaClauses,
    CbaContacts,
    CbaFootnotes,
    CbaVersionHistory,
    ClauseComparisons,
    ClauseComparisonsHistory,
    ClauseLibraryTags,
    CollectiveAgreements,
    Negotiations,
    NegotiationSessions,
    PrecedentCitations,
    PrecedentTags,
    SharedClauseLibrary,
    TentativeAgreements,
    WageProgressions,
)


class CollectiveAgreementsModelTest(TestCase):
    """Test CollectiveAgreements — central bargaining model."""

    def test_create(self):
        obj = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-2025-001",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.cba_number, "CBA-2025-001")

    def test_str(self):
        obj = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-2025-002",
        )
        self.assertEqual(str(obj), "CBA-2025-002")


class ArbitrationPrecedentsModelTest(TestCase):
    def test_create(self):
        obj = ArbitrationPrecedents.objects.create(source_organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_str(self):
        obj = ArbitrationPrecedents.objects.create(source_organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class PrecedentTagsModelTest(TestCase):
    def test_create(self):
        pid = uuid.uuid4()
        obj = PrecedentTags.objects.create(precedent_id=pid)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.precedent_id, pid)

    def test_str(self):
        obj = PrecedentTags.objects.create(precedent_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class PrecedentCitationsModelTest(TestCase):
    def test_create(self):
        pid = uuid.uuid4()
        obj = PrecedentCitations.objects.create(precedent_id=pid)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.precedent_id, pid)

    def test_str(self):
        obj = PrecedentCitations.objects.create(precedent_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class NegotiationsModelTest(TestCase):
    def test_create(self):
        obj = Negotiations.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_create_with_cba(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-NEG-001",
        )
        obj = Negotiations.objects.create(
            organization_id=uuid.uuid4(),
            expiring_cba=cba,
        )
        self.assertEqual(obj.expiring_cba, cba)

    def test_str(self):
        obj = Negotiations.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class BargainingProposalsModelTest(TestCase):
    def test_create(self):
        neg = Negotiations.objects.create(organization_id=uuid.uuid4())
        obj = BargainingProposals.objects.create(negotiation=neg)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        neg = Negotiations.objects.create(organization_id=uuid.uuid4())
        obj = BargainingProposals.objects.create(negotiation=neg)
        self.assertIsInstance(str(obj), str)


class TentativeAgreementsModelTest(TestCase):
    def test_create(self):
        neg = Negotiations.objects.create(organization_id=uuid.uuid4())
        obj = TentativeAgreements.objects.create(negotiation=neg)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        neg = Negotiations.objects.create(organization_id=uuid.uuid4())
        obj = TentativeAgreements.objects.create(negotiation=neg)
        self.assertIsInstance(str(obj), str)


class NegotiationSessionsModelTest(TestCase):
    def test_create(self):
        neg = Negotiations.objects.create(organization_id=uuid.uuid4())
        obj = NegotiationSessions.objects.create(negotiation=neg)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        neg = Negotiations.objects.create(organization_id=uuid.uuid4())
        obj = NegotiationSessions.objects.create(negotiation=neg)
        self.assertIsInstance(str(obj), str)


class BargainingTeamMembersModelTest(TestCase):
    def test_create(self):
        neg = Negotiations.objects.create(organization_id=uuid.uuid4())
        obj = BargainingTeamMembers.objects.create(negotiation=neg)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        neg = Negotiations.objects.create(organization_id=uuid.uuid4())
        obj = BargainingTeamMembers.objects.create(negotiation=neg)
        self.assertIsInstance(str(obj), str)


class CbaClausesModelTest(TestCase):
    def test_create(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-CL-001",
        )
        obj = CbaClauses.objects.create(organization_id=uuid.uuid4(), cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-CL-002",
        )
        obj = CbaClauses.objects.create(organization_id=uuid.uuid4(), cba=cba)
        self.assertIsInstance(str(obj), str)


class ClauseComparisonsModelTest(TestCase):
    def test_create(self):
        obj = ClauseComparisons.objects.create(comparison_name="Wage vs Benefits")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.comparison_name, "Wage vs Benefits")

    def test_str(self):
        obj = ClauseComparisons.objects.create(comparison_name="Test Comparison")
        self.assertIsInstance(str(obj), str)


class WageProgressionsModelTest(TestCase):
    def test_create(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-WP-001",
        )
        obj = WageProgressions.objects.create(cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-WP-002",
        )
        obj = WageProgressions.objects.create(cba=cba)
        self.assertIsInstance(str(obj), str)


class BenefitComparisonsModelTest(TestCase):
    def test_create(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-BC-001",
        )
        obj = BenefitComparisons.objects.create(cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-BC-002",
        )
        obj = BenefitComparisons.objects.create(cba=cba)
        self.assertIsInstance(str(obj), str)


class ArbitrationDecisionsModelTest(TestCase):
    def test_create(self):
        obj = ArbitrationDecisions.objects.create(case_number="ARB-2025-001")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.case_number, "ARB-2025-001")

    def test_str(self):
        obj = ArbitrationDecisions.objects.create(case_number="ARB-2025-002")
        self.assertIsInstance(str(obj), str)


class ArbitratorProfilesModelTest(TestCase):
    def test_create(self):
        obj = ArbitratorProfiles.objects.create(name="Justice Smith")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "Justice Smith")

    def test_str(self):
        obj = ArbitratorProfiles.objects.create(name="Justice Jones")
        self.assertEqual(str(obj), "Justice Jones")


class BargainingNotesModelTest(TestCase):
    def test_create(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-BN-001",
        )
        obj = BargainingNotes.objects.create(cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = BargainingNotes.objects.create()
        self.assertIsInstance(str(obj), str)


class CbaFootnotesModelTest(TestCase):
    def test_create(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-FN-001",
        )
        clause = CbaClauses.objects.create(organization_id=uuid.uuid4(), cba=cba)
        obj = CbaFootnotes.objects.create(source_clause=clause)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-FN-002",
        )
        clause = CbaClauses.objects.create(organization_id=uuid.uuid4(), cba=cba)
        obj = CbaFootnotes.objects.create(source_clause=clause)
        self.assertIsInstance(str(obj), str)


class CbaVersionHistoryModelTest(TestCase):
    def test_create(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-VH-001",
        )
        obj = CbaVersionHistory.objects.create(cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-VH-002",
        )
        obj = CbaVersionHistory.objects.create(cba=cba)
        self.assertIsInstance(str(obj), str)


class CbaContactsModelTest(TestCase):
    def test_create(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-CC-001",
        )
        obj = CbaContacts.objects.create(cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = CollectiveAgreements.objects.create(
            organization_id=uuid.uuid4(),
            cba_number="CBA-CC-002",
        )
        obj = CbaContacts.objects.create(cba=cba)
        self.assertIsInstance(str(obj), str)


class SharedClauseLibraryModelTest(TestCase):
    def test_create(self):
        obj = SharedClauseLibrary.objects.create(source_organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = SharedClauseLibrary.objects.create(source_organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ClauseLibraryTagsModelTest(TestCase):
    def test_create(self):
        obj = ClauseLibraryTags.objects.create(clause_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = ClauseLibraryTags.objects.create(clause_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ClauseComparisonsHistoryModelTest(TestCase):
    def test_create(self):
        obj = ClauseComparisonsHistory.objects.create(user_id="clerk_user_600")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "clerk_user_600")

    def test_str(self):
        obj = ClauseComparisonsHistory.objects.create(user_id="clerk_user_601")
        self.assertIsInstance(str(obj), str)
