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
from core.testing import create_valid


class AbTestsModelTest(TestCase):
    """Test AbTests model."""

    def test_create_ab_tests(self):
        org = create_valid(Organizations,
            name="Test Org", slug="test-ab-tests", organization_type="union"
        )
        obj = create_valid(AbTests,
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
        obj = create_valid(AbTests,
            name="My AB Test", description="desc", type="split"
        )
        self.assertEqual(str(obj), "My AB Test")


class AbTestVariantsModelTest(TestCase):
    """Test AbTestVariants model."""

    def test_create_ab_test_variants(self):
        test_id = uuid.uuid4()
        obj = create_valid(AbTestVariants, test_id=test_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.test_id, test_id)

    def test_ab_test_variants_str(self):
        obj = create_valid(AbTestVariants, test_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AbTestAssignmentsModelTest(TestCase):
    """Test AbTestAssignments model."""

    def test_create_ab_test_assignments(self):
        test_id = uuid.uuid4()
        obj = create_valid(AbTestAssignments, test_id=test_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.test_id, test_id)

    def test_ab_test_assignments_str(self):
        obj = create_valid(AbTestAssignments, test_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AbTestEventsModelTest(TestCase):
    """Test AbTestEvents model."""

    def test_create_ab_test_events(self):
        test_id = uuid.uuid4()
        obj = create_valid(AbTestEvents, test_id=test_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.test_id, test_id)

    def test_ab_test_events_str(self):
        obj = create_valid(AbTestEvents, test_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AccessibilityAuditsModelTest(TestCase):
    """Test AccessibilityAudits model."""

    def test_create_accessibility_audits(self):
        org_id = uuid.uuid4()
        obj = create_valid(AccessibilityAudits, organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.organization_id, org_id)

    def test_accessibility_audits_str(self):
        obj = create_valid(AccessibilityAudits, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AccessibilityIssuesModelTest(TestCase):
    """Test AccessibilityIssues model."""

    def test_create_accessibility_issues(self):
        audit_id = uuid.uuid4()
        obj = create_valid(AccessibilityIssues, audit_id=audit_id)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)
        self.assertEqual(obj.audit_id, audit_id)

    def test_accessibility_issues_str(self):
        obj = create_valid(AccessibilityIssues, audit_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class WcagSuccessCriteriaModelTest(TestCase):
    """Test WcagSuccessCriteria model."""

    def test_create_wcag_success_criteria(self):
        obj = create_valid(WcagSuccessCriteria,
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
        obj = create_valid(WcagSuccessCriteria,
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
        org = create_valid(Organizations,
            name="A11y Org", slug="test-a11y-suites", organization_type="union"
        )
        obj = create_valid(AccessibilityTestSuites, organization=org)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_accessibility_test_suites_str(self):
        org = create_valid(Organizations,
            name="A11y Org 2", slug="test-a11y-suites-str", organization_type="union"
        )
        obj = create_valid(AccessibilityTestSuites, organization=org)
        self.assertIsInstance(str(obj), str)


class AccessibilityUserTestingModelTest(TestCase):
    """Test AccessibilityUserTesting model."""

    def test_create_accessibility_user_testing(self):
        org_id = uuid.uuid4()
        obj = create_valid(AccessibilityUserTesting, organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_accessibility_user_testing_str(self):
        obj = create_valid(AccessibilityUserTesting, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ChatSessionsModelTest(TestCase):
    """Test ChatSessions model."""

    def test_create_chat_sessions(self):
        obj = create_valid(ChatSessions, user_id="user_123")
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.user_id, "user_123")

    def test_chat_sessions_str(self):
        obj = create_valid(ChatSessions, user_id="user_456")
        self.assertIsInstance(str(obj), str)


class ChatMessagesModelTest(TestCase):
    """Test ChatMessages model."""

    def test_create_chat_messages(self):
        session_id = uuid.uuid4()
        obj = create_valid(ChatMessages, session_id=session_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.session_id, session_id)

    def test_chat_messages_str(self):
        obj = create_valid(ChatMessages, session_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class KnowledgeBaseModelTest(TestCase):
    """Test KnowledgeBase model."""

    def test_create_knowledge_base(self):
        org_id = uuid.uuid4()
        obj = create_valid(KnowledgeBase, organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_knowledge_base_str(self):
        obj = create_valid(KnowledgeBase, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ChatbotSuggestionsModelTest(TestCase):
    """Test ChatbotSuggestions model."""

    def test_create_chatbot_suggestions(self):
        org_id = uuid.uuid4()
        obj = create_valid(ChatbotSuggestions, organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_chatbot_suggestions_str(self):
        obj = create_valid(ChatbotSuggestions, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class ChatbotAnalyticsModelTest(TestCase):
    """Test ChatbotAnalytics model."""

    def test_create_chatbot_analytics(self):
        org_id = uuid.uuid4()
        obj = create_valid(ChatbotAnalytics, organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_chatbot_analytics_str(self):
        obj = create_valid(ChatbotAnalytics, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AiSafetyFiltersModelTest(TestCase):
    """Test AiSafetyFilters model."""

    def test_create_ai_safety_filters(self):
        session = create_valid(ChatSessions, user_id="safety_user")
        msg = create_valid(ChatMessages, session_id=session.id)
        obj = create_valid(AiSafetyFilters,
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
        obj = create_valid(AiSafetyFilters,
            input="Hello",
            action="allow",
            created_at=timezone.now(),
        )
        self.assertIsInstance(str(obj), str)


class AiUsageMetricsModelTest(TestCase):
    """Test AiUsageMetrics model."""

    def test_create_ai_usage_metrics(self):
        org_id = uuid.uuid4()
        obj = create_valid(AiUsageMetrics, organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_ai_usage_metrics_str(self):
        obj = create_valid(AiUsageMetrics, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AiRateLimitsModelTest(TestCase):
    """Test AiRateLimits model."""

    def test_create_ai_rate_limits(self):
        org_id = uuid.uuid4()
        obj = create_valid(AiRateLimits, organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_ai_rate_limits_str(self):
        obj = create_valid(AiRateLimits, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class AiBudgetsModelTest(TestCase):
    """Test AiBudgets model."""

    def test_create_ai_budgets(self):
        org_id = uuid.uuid4()
        obj = create_valid(AiBudgets, organization_id=org_id)
        self.assertIsNotNone(obj.id)
        self.assertEqual(obj.organization_id, org_id)

    def test_ai_budgets_str(self):
        obj = create_valid(AiBudgets, organization_id=uuid.uuid4())
        self.assertIsInstance(str(obj), str)


class MlPredictionsModelTest(TestCase):
    """Test MlPredictions model."""

    def test_create_ml_predictions(self):
        org = create_valid(Organizations,
            name="ML Org", slug="test-ml-preds", organization_type="union"
        )
        obj = create_valid(MlPredictions, organization=org)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_ml_predictions_str(self):
        org = create_valid(Organizations,
            name="ML Org 2", slug="test-ml-preds-str", organization_type="union"
        )
        obj = create_valid(MlPredictions, organization=org)
        self.assertIsInstance(str(obj), str)


class ModelMetadataModelTest(TestCase):
    """Test ModelMetadata model."""

    def test_create_model_metadata(self):
        org = create_valid(Organizations,
            name="Meta Org", slug="test-model-meta", organization_type="union"
        )
        obj = create_valid(ModelMetadata, organization=org)
        self.assertIsNotNone(obj.id)
        self.assertIsNotNone(obj.created_at)

    def test_model_metadata_str(self):
        org = create_valid(Organizations,
            name="Meta Org 2", slug="test-model-meta-str", organization_type="union"
        )
        obj = create_valid(ModelMetadata, organization=org)
        self.assertIsInstance(str(obj), str)
