"""
ABR Insights — Services API URL Configuration
Auto-generated: 2026-02-18 09:26

NOTE: Generated service endpoints are quarantined behind the
ABR_ENABLE_GENERATED_SERVICES feature flag (default: false).
Only enable in dev for local testing. Pilot/prod keeps these disabled
until business logic is implemented and governance-bridge wired.
"""

import os

from django.urls import include, path
from rest_framework.routers import DefaultRouter

# Feature flag — generated services are disabled by default in pilot/prod.
_GENERATED_SERVICES_ENABLED = (
    os.environ.get("ABR_ENABLE_GENERATED_SERVICES", "false").lower() == "true"
)

from .ai_personalization_views import AIPersonalizationViewSet
from .ai_quota_views import AIQuotaViewSet
from .ai_quotas_views import AIQuotasViewSet
from .ai_training_views import AITrainingViewSet
from .ai_verification_views import AIVerificationViewSet
from .audit_logger_views import AuditLoggerViewSet
from .canlii_ingestion_views import CanLIIIngestionViewSet
from .canlii_rate_limiter_views import CanLIIRateLimiterViewSet
from .case_alerts_views import CaseAlertsViewSet
from .ce_credits_views import CECreditsViewSet
from .certificates_views import CertificatesViewSet
from .codespring_views import CodespringViewSet
from .compliance_reports_views import ComplianceReportsViewSet
from .course_gamification_views import CourseGamificationViewSet
from .course_workflow_views import CourseWorkflowViewSet
from .courses_enhanced_views import CoursesEnhancedViewSet
from .dashboard_analytics_views import DashboardAnalyticsViewSet
from .data_export_views import DataExportViewSet
from .embedding_service_views import EmbeddingServiceViewSet
from .entitlements_views import EntitlementsViewSet
from .evidence_bundles_views import EvidenceBundlesViewSet
from .gamification_views import GamificationViewSet
from .instructors_views import InstructorsViewSet
from .lesson_notes_views import LessonNotesViewSet
from .live_session_views import LiveSessionViewSet
from .org_offboarding_views import OrgOffboardingViewSet
from .rbac_views import RBACViewSet
from .risk_analytics_views import RiskAnalyticsViewSet
from .risk_report_export_views import RiskReportExportViewSet
from .seat_management_views import SeatManagementViewSet
from .skills_views import SkillsViewSet
from .social_views import SocialViewSet
from .sso_views import SSOViewSet
from .watch_history_views import WatchHistoryViewSet

router = DefaultRouter()

# ── Generated service endpoints — quarantined behind feature flag ────────
# These auto-generated views contain stub business logic (TODO(NZ-302)).
# They are disabled by default in pilot/prod to prevent exposing
# unimplemented endpoints. Set ABR_ENABLE_GENERATED_SERVICES=true to enable.
if _GENERATED_SERVICES_ENABLED:
    router.register(
        r"ai-personalization", AIPersonalizationViewSet, basename="ai-personalization"
    )
    router.register(r"ai-quota", AIQuotaViewSet, basename="ai-quota")
    router.register(r"ai-quotas", AIQuotasViewSet, basename="ai-quotas")
    router.register(r"ai-training", AITrainingViewSet, basename="ai-training")
    router.register(
        r"ai-verification", AIVerificationViewSet, basename="ai-verification"
    )
    router.register(r"audit-logger", AuditLoggerViewSet, basename="audit-logger")
    router.register(
        r"canlii-ingestion", CanLIIIngestionViewSet, basename="canlii-ingestion"
    )
    router.register(r"case-alerts", CaseAlertsViewSet, basename="case-alerts")
    router.register(r"ce-credits", CECreditsViewSet, basename="ce-credits")
    router.register(r"certificates", CertificatesViewSet, basename="certificates")
    router.register(r"codespring", CodespringViewSet, basename="codespring")
    router.register(
        r"compliance-reports", ComplianceReportsViewSet, basename="compliance-reports"
    )
    router.register(
        r"course-gamification",
        CourseGamificationViewSet,
        basename="course-gamification",
    )
    router.register(
        r"course-workflow", CourseWorkflowViewSet, basename="course-workflow"
    )
    router.register(
        r"courses-enhanced", CoursesEnhancedViewSet, basename="courses-enhanced"
    )
    router.register(
        r"dashboard-analytics",
        DashboardAnalyticsViewSet,
        basename="dashboard-analytics",
    )
    router.register(r"data-export", DataExportViewSet, basename="data-export")
    router.register(
        r"embedding-service", EmbeddingServiceViewSet, basename="embedding-service"
    )
    router.register(r"entitlements", EntitlementsViewSet, basename="entitlements")
    router.register(
        r"evidence-bundles", EvidenceBundlesViewSet, basename="evidence-bundles"
    )
    router.register(r"gamification", GamificationViewSet, basename="gamification")
    router.register(r"instructors", InstructorsViewSet, basename="instructors")
    router.register(r"lesson-notes", LessonNotesViewSet, basename="lesson-notes")
    router.register(r"live-session", LiveSessionViewSet, basename="live-session")
    router.register(
        r"org-offboarding", OrgOffboardingViewSet, basename="org-offboarding"
    )
    router.register(
        r"outcome-prediction", OutcomePredictionViewSet, basename="outcome-prediction"
    )
    router.register(r"pdf-generator", PDFGeneratorViewSet, basename="pdf-generator")
    router.register(r"quiz", QuizViewSet, basename="quiz")
    router.register(r"quiz-questions", QuizQuestionsViewSet, basename="quiz-questions")
    router.register(r"rbac", RBACViewSet, basename="rbac")
    router.register(r"risk-analytics", RiskAnalyticsViewSet, basename="risk-analytics")
    router.register(
        r"risk-report-export", RiskReportExportViewSet, basename="risk-report-export"
    )
    router.register(
        r"seat-management", SeatManagementViewSet, basename="seat-management"
    )
    router.register(r"skills", SkillsViewSet, basename="skills")
    router.register(r"social", SocialViewSet, basename="social")
    router.register(r"sso", SSOViewSet, basename="sso")
    router.register(r"watch-history", WatchHistoryViewSet, basename="watch-history")
    router.register(
        r"canlii-rate-limiter", CanLIIRateLimiterViewSet, basename="canlii-rate-limiter"
    )

urlpatterns = [
    path("", include(router.urls)),
]
