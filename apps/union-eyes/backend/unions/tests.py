"""
Unions app tests — real assertions replacing placeholder stubs.
Tests every model for creation + __str__ representation.
"""

import uuid
from datetime import date
from decimal import Decimal

from auth_core.models import OrganizationMembers, Organizations
from django.test import TestCase
from django.utils import timezone

from .models import (
    AwardHistory,
    AwardTemplates,
    BargainingUnits,
    BudgetPool,
    BudgetReservations,
    CalendarEvents,
    Calendars,
    CalendarSharing,
    CardSigningEvents,
    CommitteeMemberships,
    Committees,
    CongressMemberships,
    CourseRegistrations,
    CourseSessions,
    EmployerResponses,
    Employers,
    EmploymentHistory,
    EventAttendees,
    EventReminders,
    ExternalCalendarConnections,
    FederationCampaigns,
    FederationCommunications,
    FederationExecutives,
    FederationMeetings,
    FederationMemberships,
    FederationRemittances,
    FederationResources,
    Federations,
    FieldNotes,
    FieldOrganizerActivities,
    Holidays,
    JobClassifications,
    MeetingRooms,
    MemberAddresses,
    MemberCertifications,
    MemberEmployment,
    MemberLeaves,
    MemberLocationConsent,
    MemberRelationshipScores,
    MemberSegments,
    NlrbClrbFilings,
    OrganizerTasks,
    OrganizingCampaignMilestones,
    OrganizingCampaigns,
    OrganizingContacts,
    OutreachEnrollments,
    OutreachSequences,
    OutreachStepsLog,
    Polls,
    PollVotes,
    ProgramEnrollments,
    RecognitionAwards,
    RecognitionAwardTypes,
    RecognitionPrograms,
    RewardBudgetEnvelopes,
    RewardRedemptions,
    RewardWalletLedger,
    RoleTenureHistory,
    RoomBookings,
    SegmentExecutions,
    SegmentExports,
    StewardAssignments,
    SurveyAnswers,
    SurveyQuestions,
    SurveyResponses,
    Surveys,
    TaskComments,
    TrainingCourses,
    TrainingPrograms,
    UnionRepresentationVotes,
    VoterEligibility,
    Votes,
    VotingAuditLog,
    VotingNotifications,
    VotingOptions,
    VotingSessions,
    Worksites,
)


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
    return Organizations.objects.create(**defaults)


def _member(org, **overrides):
    defaults = dict(organization=org, user_id=f"user_{uuid.uuid4().hex[:8]}")
    defaults.update(overrides)
    return OrganizationMembers.objects.create(**defaults)


# ===== 1. AwardTemplates (__str__ = name) =====
class TestAwardTemplatesCreate(TestCase):
    def test_create(self):
        obj = AwardTemplates.objects.create(name="Gold Star")
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.name, "Gold Star")


class TestAwardTemplatesStr(TestCase):
    def test_str(self):
        obj = AwardTemplates.objects.create(name="Silver Medal")
        self.assertEqual(str(obj), "Silver Medal")


# ===== 2. AwardHistory (FK → AwardTemplates) =====
class TestAwardHistoryCreate(TestCase):
    def test_create(self):
        tmpl = AwardTemplates.objects.create(name="T")
        obj = AwardHistory.objects.create(template=tmpl)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.template, tmpl)


class TestAwardHistoryStr(TestCase):
    def test_str(self):
        tmpl = AwardTemplates.objects.create(name="T")
        obj = AwardHistory.objects.create(template=tmpl)
        self.assertIsInstance(str(obj), str)


# ===== 3. RewardWalletLedger =====
class TestRewardWalletLedgerCreate(TestCase):
    def test_create(self):
        obj = RewardWalletLedger.objects.create()
        self.assertIsNotNone(obj.id)


class TestRewardWalletLedgerStr(TestCase):
    def test_str(self):
        obj = RewardWalletLedger.objects.create()
        self.assertIsInstance(str(obj), str)


# ===== 4. BudgetPool (__str__ = name) =====
class TestBudgetPoolCreate(TestCase):
    def test_create(self):
        obj = BudgetPool.objects.create(name="Annual Awards")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "Annual Awards")


class TestBudgetPoolStr(TestCase):
    def test_str(self):
        obj = BudgetPool.objects.create(name="Q4 Budget")
        self.assertEqual(str(obj), "Q4 Budget")


# ===== 5. BudgetReservations (FK → BudgetPool) =====
class TestBudgetReservationsCreate(TestCase):
    def test_create(self):
        pool = BudgetPool.objects.create(name="P")
        obj = BudgetReservations.objects.create(pool=pool, reserved_amount=5000)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.reserved_amount, 5000)
        self.assertEqual(obj.pool, pool)


class TestBudgetReservationsStr(TestCase):
    def test_str(self):
        pool = BudgetPool.objects.create(name="P")
        obj = BudgetReservations.objects.create(pool=pool, reserved_amount=100)
        self.assertIsInstance(str(obj), str)


# ===== 6. Calendars =====
class TestCalendarsCreate(TestCase):
    def test_create(self):
        obj = Calendars.objects.create()
        self.assertIsNotNone(obj.id)


class TestCalendarsStr(TestCase):
    def test_str(self):
        obj = Calendars.objects.create()
        self.assertIsInstance(str(obj), str)


# ===== 7. CalendarEvents (FK → Calendars) =====
class TestCalendarEventsCreate(TestCase):
    def test_create(self):
        cal = Calendars.objects.create()
        obj = CalendarEvents.objects.create(calendar=cal)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.calendar, cal)


class TestCalendarEventsStr(TestCase):
    def test_str(self):
        cal = Calendars.objects.create()
        obj = CalendarEvents.objects.create(calendar=cal)
        self.assertIsInstance(str(obj), str)


# ===== 8. EventAttendees (FK → CalendarEvents) =====
class TestEventAttendeesCreate(TestCase):
    def test_create(self):
        cal = Calendars.objects.create()
        ev = CalendarEvents.objects.create(calendar=cal)
        obj = EventAttendees.objects.create(event=ev)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.event, ev)


class TestEventAttendeesStr(TestCase):
    def test_str(self):
        cal = Calendars.objects.create()
        ev = CalendarEvents.objects.create(calendar=cal)
        obj = EventAttendees.objects.create(event=ev)
        self.assertIsInstance(str(obj), str)


# ===== 9. MeetingRooms =====
class TestMeetingRoomsCreate(TestCase):
    def test_create(self):
        obj = MeetingRooms.objects.create()
        self.assertIsNotNone(obj.id)


class TestMeetingRoomsStr(TestCase):
    def test_str(self):
        obj = MeetingRooms.objects.create()
        self.assertIsInstance(str(obj), str)


# ===== 10. RoomBookings (FK → MeetingRooms) =====
class TestRoomBookingsCreate(TestCase):
    def test_create(self):
        room = MeetingRooms.objects.create()
        obj = RoomBookings.objects.create(room=room)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.room, room)


class TestRoomBookingsStr(TestCase):
    def test_str(self):
        room = MeetingRooms.objects.create()
        obj = RoomBookings.objects.create(room=room)
        self.assertIsInstance(str(obj), str)


# ===== 11. CalendarSharing (FK → Calendars) =====
class TestCalendarSharingCreate(TestCase):
    def test_create(self):
        cal = Calendars.objects.create()
        obj = CalendarSharing.objects.create(calendar=cal)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.calendar, cal)


class TestCalendarSharingStr(TestCase):
    def test_str(self):
        cal = Calendars.objects.create()
        obj = CalendarSharing.objects.create(calendar=cal)
        self.assertIsInstance(str(obj), str)


# ===== 12. ExternalCalendarConnections =====
class TestExternalCalendarConnectionsCreate(TestCase):
    def test_create(self):
        obj = ExternalCalendarConnections.objects.create(user_id="user_abc")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_abc")


class TestExternalCalendarConnectionsStr(TestCase):
    def test_str(self):
        obj = ExternalCalendarConnections.objects.create(user_id="u")
        self.assertIsInstance(str(obj), str)


# ===== 13. EventReminders (FK → CalendarEvents) =====
class TestEventRemindersCreate(TestCase):
    def test_create(self):
        cal = Calendars.objects.create()
        ev = CalendarEvents.objects.create(calendar=cal)
        obj = EventReminders.objects.create(event=ev)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.event, ev)


class TestEventRemindersStr(TestCase):
    def test_str(self):
        cal = Calendars.objects.create()
        ev = CalendarEvents.objects.create(calendar=cal)
        obj = EventReminders.objects.create(event=ev)
        self.assertIsInstance(str(obj), str)


# ===== 14. CongressMemberships =====
class TestCongressMembershipsCreate(TestCase):
    def test_create(self):
        obj = CongressMemberships.objects.create()
        self.assertIsNotNone(obj.id)


class TestCongressMembershipsStr(TestCase):
    def test_str(self):
        obj = CongressMemberships.objects.create()
        self.assertIsInstance(str(obj), str)


# ===== 15. Holidays (FK → Organizations, nullable) =====
class TestHolidaysCreate(TestCase):
    def test_create(self):
        org = _org(slug="holidays-org")
        obj = Holidays.objects.create(organization=org)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization, org)


class TestHolidaysStr(TestCase):
    def test_str(self):
        obj = Holidays.objects.create()
        self.assertIsInstance(str(obj), str)


# ===== 16–23. Simple UUID org models (no FK, no required) =====
class TestStewardAssignmentsCreate(TestCase):
    def test_create(self):
        obj = StewardAssignments.objects.create()
        self.assertIsNotNone(obj.id)


class TestStewardAssignmentsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(StewardAssignments.objects.create()), str)


class TestOutreachSequencesCreate(TestCase):
    def test_create(self):
        obj = OutreachSequences.objects.create()
        self.assertIsNotNone(obj.id)


class TestOutreachSequencesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(OutreachSequences.objects.create()), str)


class TestOutreachEnrollmentsCreate(TestCase):
    def test_create(self):
        obj = OutreachEnrollments.objects.create()
        self.assertIsNotNone(obj.id)


class TestOutreachEnrollmentsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(OutreachEnrollments.objects.create()), str)


class TestOutreachStepsLogCreate(TestCase):
    def test_create(self):
        obj = OutreachStepsLog.objects.create()
        self.assertIsNotNone(obj.id)


class TestOutreachStepsLogStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(OutreachStepsLog.objects.create()), str)


class TestFieldNotesCreate(TestCase):
    def test_create(self):
        obj = FieldNotes.objects.create()
        self.assertIsNotNone(obj.id)


class TestFieldNotesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(FieldNotes.objects.create()), str)


class TestOrganizerTasksCreate(TestCase):
    def test_create(self):
        obj = OrganizerTasks.objects.create()
        self.assertIsNotNone(obj.id)


class TestOrganizerTasksStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(OrganizerTasks.objects.create()), str)


class TestTaskCommentsCreate(TestCase):
    def test_create(self):
        obj = TaskComments.objects.create()
        self.assertIsNotNone(obj.id)


class TestTaskCommentsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(TaskComments.objects.create()), str)


class TestMemberRelationshipScoresCreate(TestCase):
    def test_create(self):
        obj = MemberRelationshipScores.objects.create()
        self.assertIsNotNone(obj.id)


class TestMemberRelationshipScoresStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(MemberRelationshipScores.objects.create()), str)


# ===== 24–29. Survey/Poll models =====
class TestSurveysCreate(TestCase):
    def test_create(self):
        obj = Surveys.objects.create()
        self.assertIsNotNone(obj.id)


class TestSurveysStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(Surveys.objects.create()), str)


class TestSurveyQuestionsCreate(TestCase):
    def test_create(self):
        obj = SurveyQuestions.objects.create()
        self.assertIsNotNone(obj.id)


class TestSurveyQuestionsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(SurveyQuestions.objects.create()), str)


class TestSurveyResponsesCreate(TestCase):
    def test_create(self):
        obj = SurveyResponses.objects.create()
        self.assertIsNotNone(obj.id)


class TestSurveyResponsesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(SurveyResponses.objects.create()), str)


class TestSurveyAnswersCreate(TestCase):
    def test_create(self):
        obj = SurveyAnswers.objects.create()
        self.assertIsNotNone(obj.id)


class TestSurveyAnswersStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(SurveyAnswers.objects.create()), str)


class TestPollsCreate(TestCase):
    def test_create(self):
        obj = Polls.objects.create()
        self.assertIsNotNone(obj.id)


class TestPollsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(Polls.objects.create()), str)


class TestPollVotesCreate(TestCase):
    def test_create(self):
        obj = PollVotes.objects.create()
        self.assertIsNotNone(obj.id)


class TestPollVotesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(PollVotes.objects.create()), str)


# ===== 30. MemberLocationConsent =====
class TestMemberLocationConsentCreate(TestCase):
    def test_create(self):
        obj = MemberLocationConsent.objects.create()
        self.assertIsNotNone(obj.id)


class TestMemberLocationConsentStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(MemberLocationConsent.objects.create()), str)


# ===== 31. Federations (__str__ = name) =====
class TestFederationsCreate(TestCase):
    def test_create(self):
        obj = Federations.objects.create(
            organization_id=uuid.uuid4(), name="National Federation"
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "National Federation")


class TestFederationsStr(TestCase):
    def test_str(self):
        obj = Federations.objects.create(organization_id=uuid.uuid4(), name="NF")
        self.assertEqual(str(obj), "NF")


# ===== 32. FederationMemberships =====
class TestFederationMembershipsCreate(TestCase):
    def test_create(self):
        obj = FederationMemberships.objects.create(
            federation_id=uuid.uuid4(),
            union_organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.status, "active")


class TestFederationMembershipsStr(TestCase):
    def test_str(self):
        obj = FederationMemberships.objects.create(
            federation_id=uuid.uuid4(),
            union_organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


# ===== 33. FederationExecutives =====
class TestFederationExecutivesCreate(TestCase):
    def test_create(self):
        obj = FederationExecutives.objects.create(federation_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestFederationExecutivesStr(TestCase):
    def test_str(self):
        obj = FederationExecutives.objects.create(federation_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 34. FederationMeetings (__str__ = title) =====
class TestFederationMeetingsCreate(TestCase):
    def test_create(self):
        obj = FederationMeetings.objects.create(
            federation_id=uuid.uuid4(), title="Annual General Meeting"
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.title, "Annual General Meeting")


class TestFederationMeetingsStr(TestCase):
    def test_str(self):
        obj = FederationMeetings.objects.create(
            federation_id=uuid.uuid4(), title="AGM 2025"
        )
        self.assertEqual(str(obj), "AGM 2025")


# ===== 35. FederationRemittances =====
class TestFederationRemittancesCreate(TestCase):
    def test_create(self):
        obj = FederationRemittances.objects.create(
            federation_id=uuid.uuid4(),
            from_organization_id=uuid.uuid4(),
            to_organization_id=uuid.uuid4(),
            remittance_month=6,
            remittance_year=2025,
            due_date=date(2025, 7, 1),
            total_members=500,
            remittable_members=450,
            per_capita_rate=Decimal("10.00"),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.total_members, 500)
        self.assertEqual(obj.per_capita_rate, Decimal("10.00"))


class TestFederationRemittancesStr(TestCase):
    def test_str(self):
        obj = FederationRemittances.objects.create(
            federation_id=uuid.uuid4(),
            from_organization_id=uuid.uuid4(),
            to_organization_id=uuid.uuid4(),
            remittance_month=1,
            remittance_year=2025,
            due_date=date(2025, 2, 1),
            total_members=10,
            remittable_members=8,
        )
        self.assertIsInstance(str(obj), str)


# ===== 36. FederationCampaigns (__str__ = name) =====
class TestFederationCampaignsCreate(TestCase):
    def test_create(self):
        obj = FederationCampaigns.objects.create(
            federation_id=uuid.uuid4(), name="Solidarity Drive"
        )
        self.assertIsNotNone(obj.id)


class TestFederationCampaignsStr(TestCase):
    def test_str(self):
        obj = FederationCampaigns.objects.create(
            federation_id=uuid.uuid4(), name="Drive 2025"
        )
        self.assertEqual(str(obj), "Drive 2025")


# ===== 37. FederationCommunications (__str__ = title) =====
class TestFederationCommunicationsCreate(TestCase):
    def test_create(self):
        obj = FederationCommunications.objects.create(
            federation_id=uuid.uuid4(), title="Bulletin #12"
        )
        self.assertIsNotNone(obj.id)


class TestFederationCommunicationsStr(TestCase):
    def test_str(self):
        obj = FederationCommunications.objects.create(
            federation_id=uuid.uuid4(), title="Bulletin"
        )
        self.assertEqual(str(obj), "Bulletin")


# ===== 38. FederationResources (__str__ = title) =====
class TestFederationResourcesCreate(TestCase):
    def test_create(self):
        obj = FederationResources.objects.create(
            federation_id=uuid.uuid4(), title="Training Guide"
        )
        self.assertIsNotNone(obj.id)


class TestFederationResourcesStr(TestCase):
    def test_str(self):
        obj = FederationResources.objects.create(
            federation_id=uuid.uuid4(), title="Guide"
        )
        self.assertEqual(str(obj), "Guide")


# ===== 39. VotingSessions (__str__ = title) =====
class TestVotingSessionsCreate(TestCase):
    def test_create(self):
        obj = VotingSessions.objects.create(title="Board Election 2025")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.title, "Board Election 2025")


class TestVotingSessionsStr(TestCase):
    def test_str(self):
        obj = VotingSessions.objects.create(title="Election")
        self.assertEqual(str(obj), "Election")


# ===== 40. VotingOptions (FK → VotingSessions) =====
class TestVotingOptionsCreate(TestCase):
    def test_create(self):
        session = VotingSessions.objects.create(title="S")
        obj = VotingOptions.objects.create(session=session)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.session, session)


class TestVotingOptionsStr(TestCase):
    def test_str(self):
        session = VotingSessions.objects.create(title="S")
        obj = VotingOptions.objects.create(session=session)
        self.assertIsInstance(str(obj), str)


# ===== 41. VoterEligibility (FK → VotingSessions) =====
class TestVoterEligibilityCreate(TestCase):
    def test_create(self):
        session = VotingSessions.objects.create(title="S")
        obj = VoterEligibility.objects.create(session=session)
        self.assertIsNotNone(obj.id)


class TestVoterEligibilityStr(TestCase):
    def test_str(self):
        session = VotingSessions.objects.create(title="S")
        obj = VoterEligibility.objects.create(session=session)
        self.assertIsInstance(str(obj), str)


# ===== 42. Votes (FK → VotingSessions) =====
class TestVotesCreate(TestCase):
    def test_create(self):
        session = VotingSessions.objects.create(title="S")
        obj = Votes.objects.create(session=session)
        self.assertIsNotNone(obj.id)


class TestVotesStr(TestCase):
    def test_str(self):
        session = VotingSessions.objects.create(title="S")
        obj = Votes.objects.create(session=session)
        self.assertIsInstance(str(obj), str)


# ===== 43. VotingNotifications (FK → VotingSessions) =====
class TestVotingNotificationsCreate(TestCase):
    def test_create(self):
        session = VotingSessions.objects.create(title="S")
        obj = VotingNotifications.objects.create(session=session)
        self.assertIsNotNone(obj.id)


class TestVotingNotificationsStr(TestCase):
    def test_str(self):
        session = VotingSessions.objects.create(title="S")
        obj = VotingNotifications.objects.create(session=session)
        self.assertIsInstance(str(obj), str)


# ===== 44. VotingAuditLog (FK → VotingSessions) =====
class TestVotingAuditLogCreate(TestCase):
    def test_create(self):
        session = VotingSessions.objects.create(title="S")
        obj = VotingAuditLog.objects.create(session=session)
        self.assertIsNotNone(obj.id)


class TestVotingAuditLogStr(TestCase):
    def test_str(self):
        session = VotingSessions.objects.create(title="S")
        obj = VotingAuditLog.objects.create(session=session)
        self.assertIsInstance(str(obj), str)


# ===== 45–52. Organizing models (FK → Organizations) =====
class TestOrganizingCampaignsCreate(TestCase):
    def test_create(self):
        org = _org(slug="orgcamp")
        obj = OrganizingCampaigns.objects.create(organization=org)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization, org)


class TestOrganizingCampaignsStr(TestCase):
    def test_str(self):
        org = _org(slug="orgcamp-s")
        obj = OrganizingCampaigns.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class TestOrganizingContactsCreate(TestCase):
    def test_create(self):
        org = _org(slug="orgcon")
        obj = OrganizingContacts.objects.create(organization=org)
        self.assertIsNotNone(obj.id)


class TestOrganizingContactsStr(TestCase):
    def test_str(self):
        org = _org(slug="orgcon-s")
        obj = OrganizingContacts.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class TestCardSigningEventsCreate(TestCase):
    def test_create(self):
        org = _org(slug="cardsign")
        obj = CardSigningEvents.objects.create(organization=org)
        self.assertIsNotNone(obj.id)


class TestCardSigningEventsStr(TestCase):
    def test_str(self):
        org = _org(slug="cardsign-s")
        obj = CardSigningEvents.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class TestNlrbClrbFilingsCreate(TestCase):
    def test_create(self):
        org = _org(slug="nlrb")
        obj = NlrbClrbFilings.objects.create(organization=org)
        self.assertIsNotNone(obj.id)


class TestNlrbClrbFilingsStr(TestCase):
    def test_str(self):
        org = _org(slug="nlrb-s")
        obj = NlrbClrbFilings.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class TestUnionRepresentationVotesCreate(TestCase):
    def test_create(self):
        org = _org(slug="urv")
        obj = UnionRepresentationVotes.objects.create(organization=org)
        self.assertIsNotNone(obj.id)


class TestUnionRepresentationVotesStr(TestCase):
    def test_str(self):
        org = _org(slug="urv-s")
        obj = UnionRepresentationVotes.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class TestFieldOrganizerActivitiesCreate(TestCase):
    def test_create(self):
        org = _org(slug="foa")
        obj = FieldOrganizerActivities.objects.create(organization=org)
        self.assertIsNotNone(obj.id)


class TestFieldOrganizerActivitiesStr(TestCase):
    def test_str(self):
        org = _org(slug="foa-s")
        obj = FieldOrganizerActivities.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class TestEmployerResponsesCreate(TestCase):
    def test_create(self):
        org = _org(slug="empresp")
        obj = EmployerResponses.objects.create(organization=org)
        self.assertIsNotNone(obj.id)


class TestEmployerResponsesStr(TestCase):
    def test_str(self):
        org = _org(slug="empresp-s")
        obj = EmployerResponses.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class TestOrganizingCampaignMilestonesCreate(TestCase):
    def test_create(self):
        org = _org(slug="ocm")
        obj = OrganizingCampaignMilestones.objects.create(organization=org)
        self.assertIsNotNone(obj.id)


class TestOrganizingCampaignMilestonesStr(TestCase):
    def test_str(self):
        org = _org(slug="ocm-s")
        obj = OrganizingCampaignMilestones.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


# ===== 53–57. Recognition/Rewards models (UUID org) =====
class TestRecognitionProgramsCreate(TestCase):
    def test_create(self):
        obj = RecognitionPrograms.objects.create()
        self.assertIsNotNone(obj.id)


class TestRecognitionProgramsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(RecognitionPrograms.objects.create()), str)


class TestRecognitionAwardTypesCreate(TestCase):
    def test_create(self):
        obj = RecognitionAwardTypes.objects.create()
        self.assertIsNotNone(obj.id)


class TestRecognitionAwardTypesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(RecognitionAwardTypes.objects.create()), str)


class TestRecognitionAwardsCreate(TestCase):
    def test_create(self):
        obj = RecognitionAwards.objects.create()
        self.assertIsNotNone(obj.id)


class TestRecognitionAwardsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(RecognitionAwards.objects.create()), str)


class TestRewardBudgetEnvelopesCreate(TestCase):
    def test_create(self):
        obj = RewardBudgetEnvelopes.objects.create()
        self.assertIsNotNone(obj.id)


class TestRewardBudgetEnvelopesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(RewardBudgetEnvelopes.objects.create()), str)


class TestRewardRedemptionsCreate(TestCase):
    def test_create(self):
        obj = RewardRedemptions.objects.create()
        self.assertIsNotNone(obj.id)


class TestRewardRedemptionsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(RewardRedemptions.objects.create()), str)


# ===== 58. MemberAddresses =====
class TestMemberAddressesCreate(TestCase):
    def test_create(self):
        obj = MemberAddresses.objects.create()
        self.assertIsNotNone(obj.id)


class TestMemberAddressesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(MemberAddresses.objects.create()), str)


# ===== 59. MemberEmployment (FK → Org + OrganizationMembers + Employers + Worksites + BargainingUnits) =====
class TestMemberEmploymentCreate(TestCase):
    def test_create(self):
        org = _org(slug="me-org")
        member = _member(org)
        obj = MemberEmployment.objects.create(
            organization=org,
            member=member,
            hire_date=date(2020, 1, 15),
            seniority_date=date(2020, 1, 15),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization, org)
        self.assertEqual(obj.member, member)
        self.assertEqual(obj.employment_status, "active")
        self.assertEqual(obj.employment_type, "full_time")


class TestMemberEmploymentStr(TestCase):
    def test_str(self):
        org = _org(slug="me-org-s")
        member = _member(org)
        obj = MemberEmployment.objects.create(
            organization=org,
            member=member,
            hire_date=date(2020, 1, 1),
            seniority_date=date(2020, 1, 1),
        )
        self.assertIsInstance(str(obj), str)


# ===== 60. EmploymentHistory (FK → Org + OrganizationMembers + MemberEmployment nullable) =====
class TestEmploymentHistoryCreate(TestCase):
    def test_create(self):
        org = _org(slug="eh-org")
        member = _member(org)
        obj = EmploymentHistory.objects.create(organization=org, member=member)
        self.assertIsNotNone(obj.id)


class TestEmploymentHistoryStr(TestCase):
    def test_str(self):
        org = _org(slug="eh-org-s")
        member = _member(org)
        obj = EmploymentHistory.objects.create(organization=org, member=member)
        self.assertIsInstance(str(obj), str)


# ===== 61. MemberLeaves (FK → Org + OrganizationMembers) =====
class TestMemberLeavesCreate(TestCase):
    def test_create(self):
        org = _org(slug="ml-org")
        member = _member(org)
        obj = MemberLeaves.objects.create(
            organization=org,
            member=member,
            leave_type="vacation",
            start_date=date(2025, 7, 1),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.leave_type, "vacation")
        self.assertFalse(obj.is_approved)


class TestMemberLeavesStr(TestCase):
    def test_str(self):
        org = _org(slug="ml-org-s")
        member = _member(org)
        obj = MemberLeaves.objects.create(
            organization=org,
            member=member,
            leave_type="sick",
            start_date=date(2025, 1, 1),
        )
        self.assertIsInstance(str(obj), str)


# ===== 62. JobClassifications (FK → Org) =====
class TestJobClassificationsCreate(TestCase):
    def test_create(self):
        org = _org(slug="jc-org")
        obj = JobClassifications.objects.create(organization=org)
        self.assertIsNotNone(obj.id)


class TestJobClassificationsStr(TestCase):
    def test_str(self):
        org = _org(slug="jc-org-s")
        obj = JobClassifications.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


# ===== 63. MemberSegments (__str__ = name) =====
class TestMemberSegmentsCreate(TestCase):
    def test_create(self):
        obj = MemberSegments.objects.create(
            organization_id=uuid.uuid4(),
            name="Active Full-Time",
            created_by="admin",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "Active Full-Time")
        self.assertFalse(obj.is_active)
        self.assertEqual(obj.execution_count, 0)


class TestMemberSegmentsStr(TestCase):
    def test_str(self):
        obj = MemberSegments.objects.create(
            organization_id=uuid.uuid4(),
            name="Seg1",
            created_by="a",
        )
        self.assertEqual(str(obj), "Seg1")


# ===== 64. SegmentExecutions (FK → MemberSegments) =====
class TestSegmentExecutionsCreate(TestCase):
    def test_create(self):
        seg = MemberSegments.objects.create(
            organization_id=uuid.uuid4(),
            name="S",
            created_by="a",
        )
        obj = SegmentExecutions.objects.create(segment=seg)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.segment, seg)


class TestSegmentExecutionsStr(TestCase):
    def test_str(self):
        seg = MemberSegments.objects.create(
            organization_id=uuid.uuid4(),
            name="S",
            created_by="a",
        )
        obj = SegmentExecutions.objects.create(segment=seg)
        self.assertIsInstance(str(obj), str)


# ===== 65. SegmentExports (FK → MemberSegments nullable) =====
class TestSegmentExportsCreate(TestCase):
    def test_create(self):
        obj = SegmentExports.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestSegmentExportsStr(TestCase):
    def test_str(self):
        obj = SegmentExports.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 66–68. Training models (UUID org) =====
class TestTrainingCoursesCreate(TestCase):
    def test_create(self):
        obj = TrainingCourses.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestTrainingCoursesStr(TestCase):
    def test_str(self):
        obj = TrainingCourses.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestCourseSessionsCreate(TestCase):
    def test_create(self):
        obj = CourseSessions.objects.create(
            organization_id=uuid.uuid4(),
            course_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)


class TestCourseSessionsStr(TestCase):
    def test_str(self):
        obj = CourseSessions.objects.create(
            organization_id=uuid.uuid4(),
            course_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class TestCourseRegistrationsCreate(TestCase):
    def test_create(self):
        obj = CourseRegistrations.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestCourseRegistrationsStr(TestCase):
    def test_str(self):
        obj = CourseRegistrations.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestMemberCertificationsCreate(TestCase):
    def test_create(self):
        obj = MemberCertifications.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestMemberCertificationsStr(TestCase):
    def test_str(self):
        obj = MemberCertifications.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestTrainingProgramsCreate(TestCase):
    def test_create(self):
        obj = TrainingPrograms.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestTrainingProgramsStr(TestCase):
    def test_str(self):
        obj = TrainingPrograms.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestProgramEnrollmentsCreate(TestCase):
    def test_create(self):
        obj = ProgramEnrollments.objects.create(organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestProgramEnrollmentsStr(TestCase):
    def test_str(self):
        obj = ProgramEnrollments.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 69–73. Union structure models =====
class TestEmployersCreate(TestCase):
    def test_create(self):
        obj = Employers.objects.create()
        self.assertIsNotNone(obj.id)


class TestEmployersStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(Employers.objects.create()), str)


class TestWorksitesCreate(TestCase):
    def test_create(self):
        obj = Worksites.objects.create()
        self.assertIsNotNone(obj.id)


class TestWorksitesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(Worksites.objects.create()), str)


class TestBargainingUnitsCreate(TestCase):
    def test_create(self):
        obj = BargainingUnits.objects.create()
        self.assertIsNotNone(obj.id)


class TestBargainingUnitsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(BargainingUnits.objects.create()), str)


class TestCommitteesCreate(TestCase):
    def test_create(self):
        obj = Committees.objects.create()
        self.assertIsNotNone(obj.id)


class TestCommitteesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(Committees.objects.create()), str)


class TestCommitteeMembershipsCreate(TestCase):
    def test_create(self):
        obj = CommitteeMemberships.objects.create()
        self.assertIsNotNone(obj.id)


class TestCommitteeMembershipsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(CommitteeMemberships.objects.create()), str)


class TestRoleTenureHistoryCreate(TestCase):
    def test_create(self):
        obj = RoleTenureHistory.objects.create()
        self.assertIsNotNone(obj.id)


class TestRoleTenureHistoryStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(RoleTenureHistory.objects.create()), str)
