"""
Tests for ai_core models.
"""

import uuid

from auth_core.models import Organizations
from django.test import TestCase
from django.utils import timezone

from .models import (
    AbTestAssignments,
    AbTestEvents,
    AbTests,
    AbTestVariants,
    AccessibilityAudits,
    AccessibilityIssues,
    AccessibilityTestSuites,
    AccessibilityUserTesting,
    AiBudgets,
    AiRateLimits,
    AiSafetyFilters,
    AiUsageMetrics,
    ChatbotAnalytics,
    ChatbotSuggestions,
    ChatMessages,
    ChatSessions,
    KnowledgeBase,
    MlPredictions,
    ModelMetadata,
    WcagSuccessCriteria,
)


class AbTestsModelTest(TestCase):
    """Test AbTests model."""

    def test_create_ab_tests(self):
        org = Organizations.objects.create(
            name="Test Org", slug="test-ab-tests", organization_type="union"
        )
        obj = AbTests.objects.create(
            name="Homepage CTA",
            description="Test different CTA button colors",
            type="split",
            status="active",
            organization=org,
        )
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.name, "Homepage CTA")
        self.assertEqual(obj.status, "active")

    def test_ab_tests_str(self):
        obj = AbTests.objects.create(
            name="My AB Test", description="desc", type="split"
        )
        self.assertEqual(str(obj), "My AB Test")


class AbTestVariantsModelTest(TestCase):
    """Test AbTestVariants model."""

    def test_create_ab_test_variants(self):
        test_id = uuid.uuid4()
        obj = AbTestVariants.objects.create(test_id=test_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.test_id, test_id)

    def test_ab_test_variants_str(self):
        obj = AbTestVariants.objects.create(test_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AbTestAssignmentsModelTest(TestCase):
    """Test AbTestAssignments model."""

    def test_create_ab_test_assignments(self):
        test_id = uuid.uuid4()
        obj = AbTestAssignments.objects.create(test_id=test_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.test_id, test_id)

    def test_ab_test_assignments_str(self):
        obj = AbTestAssignments.objects.create(test_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AbTestEventsModelTest(TestCase):
    """Test AbTestEvents model."""

    def test_create_ab_test_events(self):
        test_id = uuid.uuid4()
        obj = AbTestEvents.objects.create(test_id=test_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.test_id, test_id)

    def test_ab_test_events_str(self):
        obj = AbTestEvents.objects.create(test_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AccessibilityAuditsModelTest(TestCase):
    """Test AccessibilityAudits model."""

    def test_create_accessibility_audits(self):
        org_id = uuid.uuid4()
        obj = AccessibilityAudits.objects.create(organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.organization_id, org_id)

    def test_accessibility_audits_str(self):
        obj = AccessibilityAudits.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AccessibilityIssuesModelTest(TestCase):
    """Test AccessibilityIssues model."""

    def test_create_accessibility_issues(self):
        audit_id = uuid.uuid4()
        obj = AccessibilityIssues.objects.create(audit_id=audit_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.audit_id, audit_id)

    def test_accessibility_issues_str(self):
        obj = AccessibilityIssues.objects.create(audit_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class WcagSuccessCriteriaModelTest(TestCase):
    """Test WcagSuccessCriteria model."""

    def test_create_wcag_success_criteria(self):
        obj = WcagSuccessCriteria.objects.create(
            criteria_number="1.1.1",
            criteria_title="Non-text Content",
            criteria_description="All non-text content has a text alternative.",
            level="A",
            principle="Perceivable",
            guideline="Text Alternatives",
        )
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.criteria_number, "1.1.1")
        self.assertEqual(obj.level, "A")
        self.assertEqual(obj.wcag_version, "2.2")

    def test_wcag_success_criteria_str(self):
        obj = WcagSuccessCriteria.objects.create(
            criteria_number="2.1.1",
            criteria_title="Keyboard",
            criteria_description="All functionality is operable through a keyboard.",
            level="A",
            principle="Operable",
            guideline="Keyboard Accessible",
        )
        self.assertIsInstance(str(obj), str)


class AccessibilityTestSuitesModelTest(TestCase):
    """Test AccessibilityTestSuites model."""

    def test_create_accessibility_test_suites(self):
        org = Organizations.objects.create(
            name="A11y Org", slug="test-a11y-suites", organization_type="union"
        )
        obj = AccessibilityTestSuites.objects.create(organization=org)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_accessibility_test_suites_str(self):
        org = Organizations.objects.create(
            name="A11y Org 2", slug="test-a11y-suites-str", organization_type="union"
        )
        obj = AccessibilityTestSuites.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class AccessibilityUserTestingModelTest(TestCase):
    """Test AccessibilityUserTesting model."""

    def test_create_accessibility_user_testing(self):
        org_id = uuid.uuid4()
        obj = AccessibilityUserTesting.objects.create(organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_accessibility_user_testing_str(self):
        obj = AccessibilityUserTesting.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ChatSessionsModelTest(TestCase):
    """Test ChatSessions model."""

    def test_create_chat_sessions(self):
        obj = ChatSessions.objects.create(user_id="clerk_user_123")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "clerk_user_123")

    def test_chat_sessions_str(self):
        obj = ChatSessions.objects.create(user_id="clerk_user_456")
        self.assertIsInstance(str(obj), str)


class ChatMessagesModelTest(TestCase):
    """Test ChatMessages model."""

    def test_create_chat_messages(self):
        session_id = uuid.uuid4()
        obj = ChatMessages.objects.create(session_id=session_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.session_id, session_id)

    def test_chat_messages_str(self):
        obj = ChatMessages.objects.create(session_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class KnowledgeBaseModelTest(TestCase):
    """Test KnowledgeBase model."""

    def test_create_knowledge_base(self):
        org_id = uuid.uuid4()
        obj = KnowledgeBase.objects.create(organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_knowledge_base_str(self):
        obj = KnowledgeBase.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ChatbotSuggestionsModelTest(TestCase):
    """Test ChatbotSuggestions model."""

    def test_create_chatbot_suggestions(self):
        org_id = uuid.uuid4()
        obj = ChatbotSuggestions.objects.create(organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_chatbot_suggestions_str(self):
        obj = ChatbotSuggestions.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ChatbotAnalyticsModelTest(TestCase):
    """Test ChatbotAnalytics model."""

    def test_create_chatbot_analytics(self):
        org_id = uuid.uuid4()
        obj = ChatbotAnalytics.objects.create(organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_chatbot_analytics_str(self):
        obj = ChatbotAnalytics.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AiSafetyFiltersModelTest(TestCase):
    """Test AiSafetyFilters model."""

    def test_create_ai_safety_filters(self):
        session = ChatSessions.objects.create(user_id="safety_user")
        msg = ChatMessages.objects.create(session_id=session.id)
        obj = AiSafetyFilters.objects.create(
            input="Tell me how to hack a system",
            output="I cannot assist with that.",
            flagged=True,
            flagged_categories={"harmful": True},
            confidence_scores={"harmful": 0.95},
            action="block",
            reason="Harmful content detected",
            session=session,
            message=msg,
            created_at=timezone.now(),
        )
        self.assertIsNotNone(obj.id)
        self.assertTrue(obj.flagged)
        self.assertEqual(obj.action, "block")

    def test_ai_safety_filters_str(self):
        obj = AiSafetyFilters.objects.create(
            input="Hello",
            action="allow",
            created_at=timezone.now(),
        )
        self.assertIsInstance(str(obj), str)


class AiUsageMetricsModelTest(TestCase):
    """Test AiUsageMetrics model."""

    def test_create_ai_usage_metrics(self):
        org_id = uuid.uuid4()
        obj = AiUsageMetrics.objects.create(organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_ai_usage_metrics_str(self):
        obj = AiUsageMetrics.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AiRateLimitsModelTest(TestCase):
    """Test AiRateLimits model."""

    def test_create_ai_rate_limits(self):
        org_id = uuid.uuid4()
        obj = AiRateLimits.objects.create(organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_ai_rate_limits_str(self):
        obj = AiRateLimits.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AiBudgetsModelTest(TestCase):
    """Test AiBudgets model."""

    def test_create_ai_budgets(self):
        org_id = uuid.uuid4()
        obj = AiBudgets.objects.create(organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_ai_budgets_str(self):
        obj = AiBudgets.objects.create(organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class MlPredictionsModelTest(TestCase):
    """Test MlPredictions model."""

    def test_create_ml_predictions(self):
        org = Organizations.objects.create(
            name="ML Org", slug="test-ml-preds", organization_type="union"
        )
        obj = MlPredictions.objects.create(organization=org)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_ml_predictions_str(self):
        org = Organizations.objects.create(
            name="ML Org 2", slug="test-ml-preds-str", organization_type="union"
        )
        obj = MlPredictions.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)


class ModelMetadataModelTest(TestCase):
    """Test ModelMetadata model."""

    def test_create_model_metadata(self):
        org = Organizations.objects.create(
            name="Meta Org", slug="test-model-meta", organization_type="union"
        )
        obj = ModelMetadata.objects.create(organization=org)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_model_metadata_str(self):
        org = Organizations.objects.create(
            name="Meta Org 2", slug="test-model-meta-str", organization_type="union"
        )
        obj = ModelMetadata.objects.create(organization=org)
        self.assertIsInstance(str(obj), str)
