"""
Unions app tests — real assertions replacing placeholder stubs.
Tests every model for creation + __str__ representation.
"""

import uuid
from datetime import date
from decimal import Decimal

from auth_core.models import OrganizationMembers, Organizations
from django.db import connection
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


def _member(org, **overrides):
    defaults = dict(organization=org, user_id=f"user_{uuid.uuid4().hex[:8]}")
    defaults.update(overrides)
    return create_valid(OrganizationMembers, **defaults)


# ===== 1. AwardTemplates (__str__ = name) =====
class TestAwardTemplatesCreate(TestCase):
    def test_create(self):
        obj = create_valid(AwardTemplates, name="Gold Star")
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.name, "Gold Star")


class TestAwardTemplatesStr(TestCase):
    def test_str(self):
        obj = create_valid(AwardTemplates, name="Silver Medal")
        self.assertEqual(str(obj), "Silver Medal")


# ===== 2. AwardHistory (FK → AwardTemplates) =====
class TestAwardHistoryCreate(TestCase):
    def test_create(self):
        tmpl = create_valid(AwardTemplates, name="T")
        obj = create_valid(AwardHistory, template=tmpl)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.template, tmpl)


class TestAwardHistoryStr(TestCase):
    def test_str(self):
        tmpl = create_valid(AwardTemplates, name="T")
        obj = create_valid(AwardHistory, template=tmpl)
        self.assertIsInstance(str(obj), str)


# ===== 3. RewardWalletLedger =====
class TestRewardWalletLedgerCreate(TestCase):
    def test_create(self):
        obj = create_valid(RewardWalletLedger)
        self.assertIsNotNone(obj.id)


class TestRewardWalletLedgerStr(TestCase):
    def test_str(self):
        obj = create_valid(RewardWalletLedger)
        self.assertIsInstance(str(obj), str)


# ===== 4. BudgetPool (__str__ = name) =====
class TestBudgetPoolCreate(TestCase):
    def test_create(self):
        obj = create_valid(BudgetPool, name="Annual Awards")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "Annual Awards")


class TestBudgetPoolStr(TestCase):
    def test_str(self):
        obj = create_valid(BudgetPool, name="Q4 Budget")
        self.assertEqual(str(obj), "Q4 Budget")


# ===== 5. BudgetReservations (FK → BudgetPool) =====
class TestBudgetReservationsCreate(TestCase):
    def test_create(self):
        pool = create_valid(BudgetPool, name="P")
        obj = create_valid(BudgetReservations, pool=pool, reserved_amount=5000)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.reserved_amount, 5000)
        self.assertEqual(obj.pool, pool)


class TestBudgetReservationsStr(TestCase):
    def test_str(self):
        pool = create_valid(BudgetPool, name="P")
        obj = create_valid(BudgetReservations, pool=pool, reserved_amount=100)
        self.assertIsInstance(str(obj), str)


# ===== 6. Calendars =====
class TestCalendarsCreate(TestCase):
    def test_create(self):
        obj = create_valid(Calendars)
        self.assertIsNotNone(obj.id)


class TestCalendarsStr(TestCase):
    def test_str(self):
        obj = create_valid(Calendars)
        self.assertIsInstance(str(obj), str)


# ===== 7. CalendarEvents (FK → Calendars) =====
class TestCalendarEventsCreate(TestCase):
    def test_create(self):
        cal = create_valid(Calendars)
        obj = create_valid(CalendarEvents, calendar=cal)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.calendar, cal)


class TestCalendarEventsStr(TestCase):
    def test_str(self):
        cal = create_valid(Calendars)
        obj = create_valid(CalendarEvents, calendar=cal)
        self.assertIsInstance(str(obj), str)


# ===== 8. EventAttendees (FK → CalendarEvents) =====
class TestEventAttendeesCreate(TestCase):
    def test_create(self):
        cal = create_valid(Calendars)
        ev = create_valid(CalendarEvents, calendar=cal)
        obj = create_valid(EventAttendees, event=ev)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.event, ev)


class TestEventAttendeesStr(TestCase):
    def test_str(self):
        cal = create_valid(Calendars)
        ev = create_valid(CalendarEvents, calendar=cal)
        obj = create_valid(EventAttendees, event=ev)
        self.assertIsInstance(str(obj), str)


# ===== 9. MeetingRooms =====
class TestMeetingRoomsCreate(TestCase):
    def test_create(self):
        obj = create_valid(MeetingRooms)
        self.assertIsNotNone(obj.id)


class TestMeetingRoomsStr(TestCase):
    def test_str(self):
        obj = create_valid(MeetingRooms)
        self.assertIsInstance(str(obj), str)


# ===== 10. RoomBookings (FK → MeetingRooms) =====
class TestRoomBookingsCreate(TestCase):
    def test_create(self):
        room = create_valid(MeetingRooms)
        obj = create_valid(RoomBookings, room=room)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.room, room)


class TestRoomBookingsStr(TestCase):
    def test_str(self):
        room = create_valid(MeetingRooms)
        obj = create_valid(RoomBookings, room=room)
        self.assertIsInstance(str(obj), str)


# ===== 11. CalendarSharing (FK → Calendars) =====
class TestCalendarSharingCreate(TestCase):
    def test_create(self):
        cal = create_valid(Calendars)
        obj = create_valid(CalendarSharing, calendar=cal)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.calendar, cal)


class TestCalendarSharingStr(TestCase):
    def test_str(self):
        cal = create_valid(Calendars)
        obj = create_valid(CalendarSharing, calendar=cal)
        self.assertIsInstance(str(obj), str)


# ===== 12. ExternalCalendarConnections =====
class TestExternalCalendarConnectionsCreate(TestCase):
    def test_create(self):
        obj = create_valid(ExternalCalendarConnections, user_id="user_abc")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_abc")


class TestExternalCalendarConnectionsStr(TestCase):
    def test_str(self):
        obj = create_valid(ExternalCalendarConnections, user_id="u")
        self.assertIsInstance(str(obj), str)


# ===== 13. EventReminders (FK → CalendarEvents) =====
class TestEventRemindersCreate(TestCase):
    def test_create(self):
        cal = create_valid(Calendars)
        ev = create_valid(CalendarEvents, calendar=cal)
        obj = create_valid(EventReminders, event=ev)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.event, ev)


class TestEventRemindersStr(TestCase):
    def test_str(self):
        cal = create_valid(Calendars)
        ev = create_valid(CalendarEvents, calendar=cal)
        obj = create_valid(EventReminders, event=ev)
        self.assertIsInstance(str(obj), str)


# ===== 14. CongressMemberships =====
class TestCongressMembershipsCreate(TestCase):
    def test_create(self):
        obj = create_valid(CongressMemberships)
        self.assertIsNotNone(obj.id)


class TestCongressMembershipsStr(TestCase):
    def test_str(self):
        obj = create_valid(CongressMemberships)
        self.assertIsInstance(str(obj), str)


# ===== 15. Holidays (FK → Organizations, nullable) =====
class TestHolidaysCreate(TestCase):
    def test_create(self):
        org = _org(slug="holidays-org")
        obj = create_valid(Holidays, organization=org)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization, org)


class TestHolidaysStr(TestCase):
    def test_str(self):
        obj = create_valid(Holidays)
        self.assertIsInstance(str(obj), str)


# ===== 16–23. Simple UUID org models (no FK, no required) =====
class TestStewardAssignmentsCreate(TestCase):
    def test_create(self):
        obj = create_valid(StewardAssignments)
        self.assertIsNotNone(obj.id)


class TestStewardAssignmentsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(StewardAssignments)), str)


class TestOutreachSequencesCreate(TestCase):
    def test_create(self):
        obj = create_valid(OutreachSequences)
        self.assertIsNotNone(obj.id)


class TestOutreachSequencesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(OutreachSequences)), str)


class TestOutreachEnrollmentsCreate(TestCase):
    def test_create(self):
        obj = create_valid(OutreachEnrollments)
        self.assertIsNotNone(obj.id)


class TestOutreachEnrollmentsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(OutreachEnrollments)), str)


class TestOutreachStepsLogCreate(TestCase):
    def test_create(self):
        obj = create_valid(OutreachStepsLog)
        self.assertIsNotNone(obj.id)


class TestOutreachStepsLogStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(OutreachStepsLog)), str)


class TestFieldNotesCreate(TestCase):
    def test_create(self):
        obj = create_valid(FieldNotes)
        self.assertIsNotNone(obj.id)


class TestFieldNotesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(FieldNotes)), str)


class TestOrganizerTasksCreate(TestCase):
    def test_create(self):
        obj = create_valid(OrganizerTasks)
        self.assertIsNotNone(obj.id)


class TestOrganizerTasksStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(OrganizerTasks)), str)


class TestTaskCommentsCreate(TestCase):
    def test_create(self):
        obj = create_valid(TaskComments)
        self.assertIsNotNone(obj.id)


class TestTaskCommentsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(TaskComments)), str)


class TestMemberRelationshipScoresCreate(TestCase):
    def test_create(self):
        obj = create_valid(MemberRelationshipScores)
        self.assertIsNotNone(obj.id)


class TestMemberRelationshipScoresStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(MemberRelationshipScores)), str)


# ===== 24–29. Survey/Poll models =====
def create_valid_survey_response():
    """Create a response bound to the immutable questionnaire version its database key requires."""
    survey = create_valid(Surveys)
    questionnaire_version_id = uuid.uuid4()
    with connection.cursor() as cursor:
        cursor.execute(
            """
            INSERT INTO survey_questionnaire_versions
                (id, organization_id, survey_id, version, content_digest, questions)
            VALUES (%s, %s, %s, %s, %s, %s)
            """,
            [questionnaire_version_id, survey.organization_id, survey.id, 1, "0" * 64, "[]"],
        )
    return create_valid(
        SurveyResponses,
        organization_id=survey.organization_id,
        survey_id=survey.id,
        questionnaire_version_id=questionnaire_version_id,
    )


class TestSurveysCreate(TestCase):
    def test_create(self):
        obj = create_valid(Surveys)
        self.assertIsNotNone(obj.id)


class TestSurveysStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(Surveys)), str)


class TestSurveyQuestionsCreate(TestCase):
    def test_create(self):
        obj = create_valid(SurveyQuestions)
        self.assertIsNotNone(obj.id)


class TestSurveyQuestionsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(SurveyQuestions)), str)


class TestSurveyResponsesCreate(TestCase):
    def test_create(self):
        obj = create_valid_survey_response()
        self.assertIsNotNone(obj.id)


class TestSurveyResponsesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid_survey_response()), str)


class TestSurveyAnswersCreate(TestCase):
    def test_create(self):
        response = create_valid_survey_response()
        obj = create_valid(SurveyAnswers, response_id=response.id)
        self.assertIsNotNone(obj.id)


class TestSurveyAnswersStr(TestCase):
    def test_str(self):
        response = create_valid_survey_response()
        self.assertIsInstance(str(create_valid(SurveyAnswers, response_id=response.id)), str)


class TestPollsCreate(TestCase):
    def test_create(self):
        obj = create_valid(Polls)
        self.assertIsNotNone(obj.id)


class TestPollsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(Polls)), str)


class TestPollVotesCreate(TestCase):
    def test_create(self):
        obj = create_valid(PollVotes)
        self.assertIsNotNone(obj.id)


class TestPollVotesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(PollVotes)), str)


# ===== 30. MemberLocationConsent =====
class TestMemberLocationConsentCreate(TestCase):
    def test_create(self):
        obj = create_valid(MemberLocationConsent)
        self.assertIsNotNone(obj.id)


class TestMemberLocationConsentStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(MemberLocationConsent)), str)


# ===== 31. Federations (__str__ = name) =====
class TestFederationsCreate(TestCase):
    def test_create(self):
        obj = create_valid(Federations,
            organization_id=uuid.uuid4(), name="National Federation"
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "National Federation")


class TestFederationsStr(TestCase):
    def test_str(self):
        obj = create_valid(Federations, organization_id=uuid.uuid4(), name="NF")
        self.assertEqual(str(obj), "NF")


# ===== 32. FederationMemberships =====
class TestFederationMembershipsCreate(TestCase):
    def test_create(self):
        obj = create_valid(FederationMemberships,
            federation_id=uuid.uuid4(),
            union_organization_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.status, "active")


class TestFederationMembershipsStr(TestCase):
    def test_str(self):
        obj = create_valid(FederationMemberships,
            federation_id=uuid.uuid4(),
            union_organization_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


# ===== 33. FederationExecutives =====
class TestFederationExecutivesCreate(TestCase):
    def test_create(self):
        obj = create_valid(FederationExecutives, federation_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestFederationExecutivesStr(TestCase):
    def test_str(self):
        obj = create_valid(FederationExecutives, federation_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 34. FederationMeetings (__str__ = title) =====
class TestFederationMeetingsCreate(TestCase):
    def test_create(self):
        obj = create_valid(FederationMeetings,
            federation_id=uuid.uuid4(), title="Annual General Meeting"
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.title, "Annual General Meeting")


class TestFederationMeetingsStr(TestCase):
    def test_str(self):
        obj = create_valid(FederationMeetings,
            federation_id=uuid.uuid4(), title="AGM 2025"
        )
        self.assertEqual(str(obj), "AGM 2025")


# ===== 35. FederationRemittances =====
class TestFederationRemittancesCreate(TestCase):
    def test_create(self):
        obj = create_valid(FederationRemittances,
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
        obj = create_valid(FederationRemittances,
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
        obj = create_valid(FederationCampaigns,
            federation_id=uuid.uuid4(), name="Solidarity Drive"
        )
        self.assertIsNotNone(obj.id)


class TestFederationCampaignsStr(TestCase):
    def test_str(self):
        obj = create_valid(FederationCampaigns,
            federation_id=uuid.uuid4(), name="Drive 2025"
        )
        self.assertEqual(str(obj), "Drive 2025")


# ===== 37. FederationCommunications (__str__ = title) =====
class TestFederationCommunicationsCreate(TestCase):
    def test_create(self):
        obj = create_valid(FederationCommunications,
            federation_id=uuid.uuid4(), title="Bulletin #12"
        )
        self.assertIsNotNone(obj.id)


class TestFederationCommunicationsStr(TestCase):
    def test_str(self):
        obj = create_valid(FederationCommunications,
            federation_id=uuid.uuid4(), title="Bulletin"
        )
        self.assertEqual(str(obj), "Bulletin")


# ===== 38. FederationResources (__str__ = title) =====
class TestFederationResourcesCreate(TestCase):
    def test_create(self):
        obj = create_valid(FederationResources,
            federation_id=uuid.uuid4(), title="Training Guide"
        )
        self.assertIsNotNone(obj.id)


class TestFederationResourcesStr(TestCase):
    def test_str(self):
        obj = create_valid(FederationResources,
            federation_id=uuid.uuid4(), title="Guide"
        )
        self.assertEqual(str(obj), "Guide")


# ===== 39. VotingSessions (__str__ = title) =====
class TestVotingSessionsCreate(TestCase):
    def test_create(self):
        obj = create_valid(VotingSessions, title="Board Election 2025")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.title, "Board Election 2025")


class TestVotingSessionsStr(TestCase):
    def test_str(self):
        obj = create_valid(VotingSessions, title="Election")
        self.assertEqual(str(obj), "Election")


# ===== 40. VotingOptions (FK → VotingSessions) =====
class TestVotingOptionsCreate(TestCase):
    def test_create(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(VotingOptions, session=session)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.session, session)


class TestVotingOptionsStr(TestCase):
    def test_str(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(VotingOptions, session=session)
        self.assertIsInstance(str(obj), str)


# ===== 41. VoterEligibility (FK → VotingSessions) =====
class TestVoterEligibilityCreate(TestCase):
    def test_create(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(VoterEligibility, session=session)
        self.assertIsNotNone(obj.id)


class TestVoterEligibilityStr(TestCase):
    def test_str(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(VoterEligibility, session=session)
        self.assertIsInstance(str(obj), str)


# ===== 42. Votes (FK → VotingSessions) =====
class TestVotesCreate(TestCase):
    def test_create(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(Votes, session=session)
        self.assertIsNotNone(obj.id)


class TestVotesStr(TestCase):
    def test_str(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(Votes, session=session)
        self.assertIsInstance(str(obj), str)


# ===== 43. VotingNotifications (FK → VotingSessions) =====
class TestVotingNotificationsCreate(TestCase):
    def test_create(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(VotingNotifications, session=session)
        self.assertIsNotNone(obj.id)


class TestVotingNotificationsStr(TestCase):
    def test_str(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(VotingNotifications, session=session)
        self.assertIsInstance(str(obj), str)


# ===== 44. VotingAuditLog (FK → VotingSessions) =====
class TestVotingAuditLogCreate(TestCase):
    def test_create(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(VotingAuditLog, session=session)
        self.assertIsNotNone(obj.id)


class TestVotingAuditLogStr(TestCase):
    def test_str(self):
        session = create_valid(VotingSessions, title="S")
        obj = create_valid(VotingAuditLog, session=session)
        self.assertIsInstance(str(obj), str)


# ===== 45–52. Organizing models (FK → Organizations) =====
class TestOrganizingCampaignsCreate(TestCase):
    def test_create(self):
        org = _org(slug="orgcamp")
        obj = create_valid(OrganizingCampaigns, organization=org)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization, org)


class TestOrganizingCampaignsStr(TestCase):
    def test_str(self):
        org = _org(slug="orgcamp-s")
        obj = create_valid(OrganizingCampaigns, organization=org)
        self.assertIsInstance(str(obj), str)


class TestOrganizingContactsCreate(TestCase):
    def test_create(self):
        org = _org(slug="orgcon")
        obj = create_valid(OrganizingContacts, organization=org)
        self.assertIsNotNone(obj.id)


class TestOrganizingContactsStr(TestCase):
    def test_str(self):
        org = _org(slug="orgcon-s")
        obj = create_valid(OrganizingContacts, organization=org)
        self.assertIsInstance(str(obj), str)


class TestCardSigningEventsCreate(TestCase):
    def test_create(self):
        org = _org(slug="cardsign")
        obj = create_valid(CardSigningEvents, organization=org)
        self.assertIsNotNone(obj.id)


class TestCardSigningEventsStr(TestCase):
    def test_str(self):
        org = _org(slug="cardsign-s")
        obj = create_valid(CardSigningEvents, organization=org)
        self.assertIsInstance(str(obj), str)


class TestNlrbClrbFilingsCreate(TestCase):
    def test_create(self):
        org = _org(slug="nlrb")
        obj = create_valid(NlrbClrbFilings, organization=org)
        self.assertIsNotNone(obj.id)


class TestNlrbClrbFilingsStr(TestCase):
    def test_str(self):
        org = _org(slug="nlrb-s")
        obj = create_valid(NlrbClrbFilings, organization=org)
        self.assertIsInstance(str(obj), str)


class TestUnionRepresentationVotesCreate(TestCase):
    def test_create(self):
        org = _org(slug="urv")
        obj = create_valid(UnionRepresentationVotes, organization=org)
        self.assertIsNotNone(obj.id)


class TestUnionRepresentationVotesStr(TestCase):
    def test_str(self):
        org = _org(slug="urv-s")
        obj = create_valid(UnionRepresentationVotes, organization=org)
        self.assertIsInstance(str(obj), str)


class TestFieldOrganizerActivitiesCreate(TestCase):
    def test_create(self):
        org = _org(slug="foa")
        obj = create_valid(FieldOrganizerActivities, organization=org)
        self.assertIsNotNone(obj.id)


class TestFieldOrganizerActivitiesStr(TestCase):
    def test_str(self):
        org = _org(slug="foa-s")
        obj = create_valid(FieldOrganizerActivities, organization=org)
        self.assertIsInstance(str(obj), str)


class TestEmployerResponsesCreate(TestCase):
    def test_create(self):
        org = _org(slug="empresp")
        obj = create_valid(EmployerResponses, organization=org)
        self.assertIsNotNone(obj.id)


class TestEmployerResponsesStr(TestCase):
    def test_str(self):
        org = _org(slug="empresp-s")
        obj = create_valid(EmployerResponses, organization=org)
        self.assertIsInstance(str(obj), str)


class TestOrganizingCampaignMilestonesCreate(TestCase):
    def test_create(self):
        org = _org(slug="ocm")
        obj = create_valid(OrganizingCampaignMilestones, organization=org)
        self.assertIsNotNone(obj.id)


class TestOrganizingCampaignMilestonesStr(TestCase):
    def test_str(self):
        org = _org(slug="ocm-s")
        obj = create_valid(OrganizingCampaignMilestones, organization=org)
        self.assertIsInstance(str(obj), str)


# ===== 53–57. Recognition/Rewards models (UUID org) =====
class TestRecognitionProgramsCreate(TestCase):
    def test_create(self):
        obj = create_valid(RecognitionPrograms)
        self.assertIsNotNone(obj.id)


class TestRecognitionProgramsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(RecognitionPrograms)), str)


class TestRecognitionAwardTypesCreate(TestCase):
    def test_create(self):
        obj = create_valid(RecognitionAwardTypes)
        self.assertIsNotNone(obj.id)


class TestRecognitionAwardTypesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(RecognitionAwardTypes)), str)


class TestRecognitionAwardsCreate(TestCase):
    def test_create(self):
        obj = create_valid(RecognitionAwards)
        self.assertIsNotNone(obj.id)


class TestRecognitionAwardsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(RecognitionAwards)), str)


class TestRewardBudgetEnvelopesCreate(TestCase):
    def test_create(self):
        obj = create_valid(RewardBudgetEnvelopes)
        self.assertIsNotNone(obj.id)


class TestRewardBudgetEnvelopesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(RewardBudgetEnvelopes)), str)


class TestRewardRedemptionsCreate(TestCase):
    def test_create(self):
        obj = create_valid(RewardRedemptions)
        self.assertIsNotNone(obj.id)


class TestRewardRedemptionsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(RewardRedemptions)), str)


# ===== 58. MemberAddresses =====
class TestMemberAddressesCreate(TestCase):
    def test_create(self):
        obj = create_valid(MemberAddresses)
        self.assertIsNotNone(obj.id)


class TestMemberAddressesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(MemberAddresses)), str)


# ===== 59. MemberEmployment (FK → Org + OrganizationMembers + Employers + Worksites + BargainingUnits) =====
class TestMemberEmploymentCreate(TestCase):
    def test_create(self):
        org = _org(slug="me-org")
        member = _member(org)
        obj = create_valid(MemberEmployment,
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
        obj = create_valid(MemberEmployment,
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
        obj = create_valid(EmploymentHistory, organization=org, member=member)
        self.assertIsNotNone(obj.id)


class TestEmploymentHistoryStr(TestCase):
    def test_str(self):
        org = _org(slug="eh-org-s")
        member = _member(org)
        obj = create_valid(EmploymentHistory, organization=org, member=member)
        self.assertIsInstance(str(obj), str)


# ===== 61. MemberLeaves (FK → Org + OrganizationMembers) =====
class TestMemberLeavesCreate(TestCase):
    def test_create(self):
        org = _org(slug="ml-org")
        member = _member(org)
        obj = create_valid(MemberLeaves,
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
        obj = create_valid(MemberLeaves,
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
        obj = create_valid(JobClassifications, organization=org)
        self.assertIsNotNone(obj.id)


class TestJobClassificationsStr(TestCase):
    def test_str(self):
        org = _org(slug="jc-org-s")
        obj = create_valid(JobClassifications, organization=org)
        self.assertIsInstance(str(obj), str)


# ===== 63. MemberSegments (__str__ = name) =====
class TestMemberSegmentsCreate(TestCase):
    def test_create(self):
        obj = create_valid(MemberSegments,
            organization_id=uuid.uuid4(),
            name="Active Full-Time",
            created_by="admin",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.name, "Active Full-Time")
        self.assertTrue(obj.is_active)
        self.assertEqual(obj.execution_count, 0)


class TestMemberSegmentsStr(TestCase):
    def test_str(self):
        obj = create_valid(MemberSegments,
            organization_id=uuid.uuid4(),
            name="Seg1",
            created_by="a",
        )
        self.assertEqual(str(obj), "Seg1")


# ===== 64. SegmentExecutions (FK → MemberSegments) =====
class TestSegmentExecutionsCreate(TestCase):
    def test_create(self):
        seg = create_valid(MemberSegments,
            organization_id=uuid.uuid4(),
            name="S",
            created_by="a",
        )
        obj = create_valid(SegmentExecutions, segment=seg)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.segment, seg)


class TestSegmentExecutionsStr(TestCase):
    def test_str(self):
        seg = create_valid(MemberSegments,
            organization_id=uuid.uuid4(),
            name="S",
            created_by="a",
        )
        obj = create_valid(SegmentExecutions, segment=seg)
        self.assertIsInstance(str(obj), str)


# ===== 65. SegmentExports (FK → MemberSegments nullable) =====
class TestSegmentExportsCreate(TestCase):
    def test_create(self):
        obj = create_valid(SegmentExports, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestSegmentExportsStr(TestCase):
    def test_str(self):
        obj = create_valid(SegmentExports, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 66–68. Training models (UUID org) =====
class TestTrainingCoursesCreate(TestCase):
    def test_create(self):
        obj = create_valid(TrainingCourses, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestTrainingCoursesStr(TestCase):
    def test_str(self):
        obj = create_valid(TrainingCourses, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestCourseSessionsCreate(TestCase):
    def test_create(self):
        obj = create_valid(CourseSessions,
            organization_id=uuid.uuid4(),
            course_id=uuid.uuid4(),
        )
        self.assertIsNotNone(obj.id)


class TestCourseSessionsStr(TestCase):
    def test_str(self):
        obj = create_valid(CourseSessions,
            organization_id=uuid.uuid4(),
            course_id=uuid.uuid4(),
        )
        self.assertIsInstance(str(obj), str)


class TestCourseRegistrationsCreate(TestCase):
    def test_create(self):
        obj = create_valid(CourseRegistrations, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestCourseRegistrationsStr(TestCase):
    def test_str(self):
        obj = create_valid(CourseRegistrations, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestMemberCertificationsCreate(TestCase):
    def test_create(self):
        obj = create_valid(MemberCertifications, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestMemberCertificationsStr(TestCase):
    def test_str(self):
        obj = create_valid(MemberCertifications, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestTrainingProgramsCreate(TestCase):
    def test_create(self):
        obj = create_valid(TrainingPrograms, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestTrainingProgramsStr(TestCase):
    def test_str(self):
        obj = create_valid(TrainingPrograms, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class TestProgramEnrollmentsCreate(TestCase):
    def test_create(self):
        obj = create_valid(ProgramEnrollments, organization_id=uuid.uuid4())
        self.assertIsNotNone(obj.id)


class TestProgramEnrollmentsStr(TestCase):
    def test_str(self):
        obj = create_valid(ProgramEnrollments, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


# ===== 69–73. Union structure models =====
class TestEmployersCreate(TestCase):
    def test_create(self):
        obj = create_valid(Employers, organization_id=_org().id)
        self.assertIsNotNone(obj.id)


class TestEmployersStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(Employers, organization_id=_org().id)), str)


class TestWorksitesCreate(TestCase):
    def test_create(self):
        obj = create_valid(Worksites, organization_id=_org().id)
        self.assertIsNotNone(obj.id)


class TestWorksitesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(Worksites, organization_id=_org().id)), str)


class TestBargainingUnitsCreate(TestCase):
    def test_create(self):
        obj = create_valid(BargainingUnits, organization_id=_org().id)
        self.assertIsNotNone(obj.id)


class TestBargainingUnitsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(BargainingUnits, organization_id=_org().id)), str)


class TestCommitteesCreate(TestCase):
    def test_create(self):
        obj = create_valid(Committees, organization_id=_org().id)
        self.assertIsNotNone(obj.id)


class TestCommitteesStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(Committees, organization_id=_org().id)), str)


class TestCommitteeMembershipsCreate(TestCase):
    def test_create(self):
        obj = create_valid(CommitteeMemberships)
        self.assertIsNotNone(obj.id)


class TestCommitteeMembershipsStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(CommitteeMemberships)), str)


class TestRoleTenureHistoryCreate(TestCase):
    def test_create(self):
        obj = create_valid(RoleTenureHistory)
        self.assertIsNotNone(obj.id)


class TestRoleTenureHistoryStr(TestCase):
    def test_str(self):
        self.assertIsInstance(str(create_valid(RoleTenureHistory)), str)
