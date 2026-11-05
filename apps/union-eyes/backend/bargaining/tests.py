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
from core.testing import create_valid


class CollectiveAgreementsModelTest(TestCase):
    """Test CollectiveAgreements — central bargaining model."""

    def test_create(self):
        obj = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-2025-001",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.cba_number, "CBA-2025-001")

    def test_str(self):
        obj = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-2025-002",
        )
        self.assertEqual(str(obj), "CBA-2025-002")


class ArbitrationPrecedentsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ArbitrationPrecedents, source_organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_str(self):
        obj = create_valid(ArbitrationPrecedents, source_organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class PrecedentTagsModelTest(TestCase):
    def test_create(self):
        pid = uuid.uuid4()
        obj = create_valid(PrecedentTags, precedent_id=pid)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.precedent_id, pid)

    def test_str(self):
        obj = create_valid(PrecedentTags, precedent_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class PrecedentCitationsModelTest(TestCase):
    def test_create(self):
        pid = uuid.uuid4()
        obj = create_valid(PrecedentCitations, precedent_id=pid)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.precedent_id, pid)

    def test_str(self):
        obj = create_valid(PrecedentCitations, precedent_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class NegotiationsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(Negotiations, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_create_with_cba(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-NEG-001",
        )
        obj = create_valid(Negotiations,
            organization_id=uuid.uuid4(),
            expiring_cba=cba,
        )
        self.assertEqual(obj.expiring_cba, cba)

    def test_str(self):
        obj = create_valid(Negotiations, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class BargainingProposalsModelTest(TestCase):
    def test_create(self):
        neg = create_valid(Negotiations, organization_id=uuid.uuid4())
        obj = create_valid(BargainingProposals, negotiation=neg)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        neg = create_valid(Negotiations, organization_id=uuid.uuid4())
        obj = create_valid(BargainingProposals, negotiation=neg)
        self.assertIsInstance(str(obj), str)


class TentativeAgreementsModelTest(TestCase):
    def test_create(self):
        neg = create_valid(Negotiations, organization_id=uuid.uuid4())
        obj = create_valid(TentativeAgreements, negotiation=neg)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        neg = create_valid(Negotiations, organization_id=uuid.uuid4())
        obj = create_valid(TentativeAgreements, negotiation=neg)
        self.assertIsInstance(str(obj), str)


class NegotiationSessionsModelTest(TestCase):
    def test_create(self):
        neg = create_valid(Negotiations, organization_id=uuid.uuid4())
        obj = create_valid(NegotiationSessions, negotiation=neg)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        neg = create_valid(Negotiations, organization_id=uuid.uuid4())
        obj = create_valid(NegotiationSessions, negotiation=neg)
        self.assertIsInstance(str(obj), str)


class BargainingTeamMembersModelTest(TestCase):
    def test_create(self):
        neg = create_valid(Negotiations, organization_id=uuid.uuid4())
        obj = create_valid(BargainingTeamMembers, negotiation=neg)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        neg = create_valid(Negotiations, organization_id=uuid.uuid4())
        obj = create_valid(BargainingTeamMembers, negotiation=neg)
        self.assertIsInstance(str(obj), str)


class CbaClausesModelTest(TestCase):
    def test_create(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-CL-001",
        )
        obj = create_valid(CbaClauses, organization_id=uuid.uuid4(), cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-CL-002",
        )
        obj = create_valid(CbaClauses, organization_id=uuid.uuid4(), cba=cba)
        self.assertIsInstance(str(obj), str)


class ClauseComparisonsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ClauseComparisons, comparison_name="Wage vs Benefits")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.comparison_name, "Wage vs Benefits")

    def test_str(self):
        obj = create_valid(ClauseComparisons, comparison_name="Test Comparison")
        self.assertIsInstance(str(obj), str)


class WageProgressionsModelTest(TestCase):
    def test_create(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-WP-001",
        )
        obj = create_valid(WageProgressions, cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-WP-002",
        )
        obj = create_valid(WageProgressions, cba=cba)
        self.assertIsInstance(str(obj), str)


class BenefitComparisonsModelTest(TestCase):
    def test_create(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-BC-001",
        )
        obj = create_valid(BenefitComparisons, cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-BC-002",
        )
        obj = create_valid(BenefitComparisons, cba=cba)
        self.assertIsInstance(str(obj), str)


class ArbitrationDecisionsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ArbitrationDecisions, case_number="ARB-2025-001")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.case_number, "ARB-2025-001")

    def test_str(self):
        obj = create_valid(ArbitrationDecisions, case_number="ARB-2025-002")
        self.assertIsInstance(str(obj), str)


class ArbitratorProfilesModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ArbitratorProfiles, name="Justice Smith")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "Justice Smith")

    def test_str(self):
        obj = create_valid(ArbitratorProfiles, name="Justice Jones")
        self.assertEqual(str(obj), "Justice Jones")


class BargainingNotesModelTest(TestCase):
    def test_create(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-BN-001",
        )
        obj = create_valid(BargainingNotes, cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(BargainingNotes)
        self.assertIsInstance(str(obj), str)


class CbaFootnotesModelTest(TestCase):
    def test_create(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-FN-001",
        )
        clause = create_valid(CbaClauses, organization_id=uuid.uuid4(), cba=cba)
        obj = create_valid(CbaFootnotes, source_clause=clause)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-FN-002",
        )
        clause = create_valid(CbaClauses, organization_id=uuid.uuid4(), cba=cba)
        obj = create_valid(CbaFootnotes, source_clause=clause)
        self.assertIsInstance(str(obj), str)


class CbaVersionHistoryModelTest(TestCase):
    def test_create(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-VH-001",
        )
        obj = create_valid(CbaVersionHistory, cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-VH-002",
        )
        obj = create_valid(CbaVersionHistory, cba=cba)
        self.assertIsInstance(str(obj), str)


class CbaContactsModelTest(TestCase):
    def test_create(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-CC-001",
        )
        obj = create_valid(CbaContacts, cba=cba)
        self.assertIsNotNone(obj.id)

    def test_str(self):
        cba = create_valid(CollectiveAgreements,
            organization_id=uuid.uuid4(),
            cba_number="CBA-CC-002",
        )
        obj = create_valid(CbaContacts, cba=cba)
        self.assertIsInstance(str(obj), str)


class SharedClauseLibraryModelTest(TestCase):
    def test_create(self):
        obj = create_valid(SharedClauseLibrary, source_organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(SharedClauseLibrary, source_organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ClauseLibraryTagsModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ClauseLibraryTags, clause_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)

    def test_str(self):
        obj = create_valid(ClauseLibraryTags, clause_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ClauseComparisonsHistoryModelTest(TestCase):
    def test_create(self):
        obj = create_valid(ClauseComparisonsHistory, user_id="user_600")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_600")

    def test_str(self):
        obj = create_valid(ClauseComparisonsHistory, user_id="user_601")
        self.assertIsInstance(str(obj), str)
