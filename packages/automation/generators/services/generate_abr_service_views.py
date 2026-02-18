#!/usr/bin/env python3
"""
ABR Insights — Service View Generator
=======================================
Generates production-grade DRF ViewSets for all 38 ABR frontend services.
Creates the services/ Django app, all view files, and urls.py.

Usage:
    python generate_abr_service_views.py [--dry-run]

Outputs:
    - services/ Django app in ABR backend
    - One *_views.py per service
    - urls.py with all registrations
    - Updated config/urls.py and settings.py
    - Generation report JSON
"""

import os
import re
import json
import argparse
import textwrap
from datetime import datetime
from pathlib import Path
from typing import Dict, List

# ──────────────────────────────────────────────────────────────────
# CONFIG
# ──────────────────────────────────────────────────────────────────

ABR_BACKEND_DIR = r"D:\APPS\nzila-abr-insights\backend"
SERVICES_DIR = os.path.join(ABR_BACKEND_DIR, "services")
SERVICES_API_DIR = os.path.join(SERVICES_DIR, "api")

# ──────────────────────────────────────────────────────────────────
# SERVICE DEFINITIONS — 38 services mapped to Django models
# ──────────────────────────────────────────────────────────────────

SERVICE_SPECS: Dict[str, dict] = {
    # ── AI Services ──────────────────────────────────────────
    "ai-personalization": {
        "class_name": "AIPersonalizationViewSet",
        "app": "ai_core",
        "models": ["CaseEmbeddings", "CourseEmbeddings"],
        "extra_apps": {"content": ["Enrollments", "LessonProgress", "Courses"]},
        "actions": [
            {"name": "analyze_engagement", "method": "get", "desc": "Analyze user engagement patterns"},
            {"name": "skill_profile", "method": "get", "desc": "Analyze user skill profile"},
            {"name": "content_suggestions", "method": "get", "desc": "Generate adaptive content suggestions"},
            {"name": "learning_path_recommendations", "method": "get", "desc": "Generate learning path recommendations"},
            {"name": "smart_notifications", "method": "get", "desc": "Generate smart notifications"},
            {"name": "predict_completion", "method": "post", "desc": "Predict course completion time"},
        ],
    },
    "ai-quota": {
        "class_name": "AIQuotaViewSet",
        "app": "core",
        "models": ["AiQuota", "AiUsageDaily"],
        "actions": [
            {"name": "check_quota", "method": "get", "desc": "Check current AI quota for user/org", "model": "AiQuota"},
            {"name": "record_usage", "method": "post", "desc": "Record AI usage event", "model": "AiUsageDaily"},
            {"name": "get_usage", "method": "get", "desc": "Get AI usage stats", "model": "AiUsageDaily"},
            {"name": "quota_config", "method": "get", "desc": "Get AI quota configuration", "model": "AiQuota"},
        ],
    },
    "ai-quotas": {
        "class_name": "AIQuotasViewSet",
        "app": "core",
        "models": ["AiQuota", "AiUsageDaily"],
        "actions": [
            {"name": "check", "method": "get", "desc": "Check AI quota availability", "model": "AiQuota"},
            {"name": "org_usage", "method": "get", "desc": "Get organization AI usage stats", "model": "AiUsageDaily"},
            {"name": "user_usage", "method": "get", "desc": "Get user AI usage stats", "model": "AiUsageDaily"},
        ],
    },
    "ai-verification": {
        "class_name": "AIVerificationViewSet",
        "app": "core",
        "models": ["AiInteractionLogs"],
        "actions": [
            {"name": "interaction_logs", "method": "get", "desc": "Get AI interaction logs", "model": "AiInteractionLogs"},
            {"name": "usage_stats", "method": "get", "desc": "Get AI usage statistics", "model": "AiInteractionLogs"},
            {"name": "log_interaction", "method": "post", "desc": "Log AI interaction event", "model": "AiInteractionLogs"},
            {"name": "mark_reviewed", "method": "post", "desc": "Mark AI interaction as reviewed", "model": "AiInteractionLogs"},
            {"name": "validate_response", "method": "post", "desc": "Validate AI response for accuracy"},
            {"name": "verify_citations", "method": "post", "desc": "Verify AI citations against sources"},
        ],
    },

    # ── Audit & Compliance ───────────────────────────────────
    "audit-logger": {
        "class_name": "AuditLoggerViewSet",
        "app": "auth_core",
        "models": ["AuditLogs"],
        "actions": [
            {"name": "log_event", "method": "post", "desc": "Log an audit event", "model": "AuditLogs"},
            {"name": "search", "method": "get", "desc": "Search audit logs", "model": "AuditLogs"},
            {"name": "export", "method": "get", "desc": "Export audit logs"},
        ],
    },
    "compliance-reports": {
        "class_name": "ComplianceReportsViewSet",
        "app": "core",
        "models": ["ComplianceReports"],
        "extra_apps": {"core": ["AuditLogExports"]},
        "actions": [
            {"name": "generate", "method": "post", "desc": "Generate compliance report", "model": "ComplianceReports"},
            {"name": "get_report", "method": "get", "desc": "Get specific compliance report", "model": "ComplianceReports"},
            {"name": "list_reports", "method": "get", "desc": "List compliance reports", "model": "ComplianceReports"},
            {"name": "schedule", "method": "post", "desc": "Schedule recurring report", "model": "ComplianceReports"},
            {"name": "export_csv", "method": "get", "desc": "Export report as CSV"},
            {"name": "export_pdf", "method": "get", "desc": "Export report as PDF"},
            {"name": "export_xlsx", "method": "get", "desc": "Export report as XLSX"},
            {"name": "approve_export", "method": "post", "desc": "Approve report export", "model": "AuditLogExports"},
        ],
    },
    "evidence-bundles": {
        "class_name": "EvidenceBundlesViewSet",
        "app": "compliance",
        "models": ["EvidenceBundles", "EvidenceBundleComponents", "EvidenceBundlePolicyMappings", "EvidenceBundleTimeline"],
        "extra_apps": {"core": ["EvidenceBundlePdfs"]},
        "actions": [
            {"name": "create_bundle", "method": "post", "desc": "Create evidence bundle", "model": "EvidenceBundles"},
            {"name": "get_bundle", "method": "get", "desc": "Get evidence bundle", "model": "EvidenceBundles"},
            {"name": "list_bundles", "method": "get", "desc": "List evidence bundles", "model": "EvidenceBundles"},
            {"name": "add_component", "method": "post", "desc": "Add component to bundle", "model": "EvidenceBundleComponents"},
            {"name": "add_timeline_event", "method": "post", "desc": "Add timeline event", "model": "EvidenceBundleTimeline"},
            {"name": "build_timeline", "method": "get", "desc": "Build evidence timeline", "model": "EvidenceBundleTimeline"},
            {"name": "policy_mappings", "method": "get", "desc": "Get policy mappings for bundle", "model": "EvidenceBundlePolicyMappings"},
            {"name": "create_policy_mapping", "method": "post", "desc": "Create policy mapping", "model": "EvidenceBundlePolicyMappings"},
            {"name": "generate_mappings", "method": "post", "desc": "Auto-generate policy mappings"},
            {"name": "update_status", "method": "post", "desc": "Update bundle status", "model": "EvidenceBundles"},
            {"name": "export_bundle", "method": "get", "desc": "Export evidence bundle"},
            {"name": "upload_bundle", "method": "post", "desc": "Upload evidence bundle", "model": "EvidenceBundlePdfs"},
        ],
    },
    "risk-analytics": {
        "class_name": "RiskAnalyticsViewSet",
        "app": "compliance",
        "models": ["RiskScoreHistory", "OrganizationRiskHistory"],
        "actions": [
            {"name": "org_summary", "method": "get", "desc": "Get organization risk summary", "model": "OrganizationRiskHistory"},
            {"name": "department_scores", "method": "get", "desc": "Get department risk scores", "model": "RiskScoreHistory"},
            {"name": "department_details", "method": "get", "desc": "Get department user risk details", "model": "RiskScoreHistory"},
            {"name": "trends", "method": "get", "desc": "Get risk trends over time", "model": "RiskScoreHistory"},
            {"name": "capture_snapshot", "method": "post", "desc": "Capture risk score snapshot", "model": "RiskScoreHistory"},
        ],
    },
    "risk-report-export": {
        "class_name": "RiskReportExportViewSet",
        "app": "compliance",
        "models": ["RiskScoreHistory", "OrganizationRiskHistory"],
        "actions": [
            {"name": "executive_summary", "method": "get", "desc": "Generate executive risk summary"},
            {"name": "department_csv", "method": "get", "desc": "Generate department risk CSV"},
            {"name": "department_html", "method": "get", "desc": "Generate department risk HTML report"},
        ],
    },

    # ── CanLII Legal ─────────────────────────────────────────
    "canlii-ingestion": {
        "class_name": "CanLIIIngestionViewSet",
        "app": "core",
        "models": ["CanliiIngestionRuns", "CanliiApiRequests", "CanliiDailyQuotas", "TribunalCasesRaw", "IngestionJobs", "IngestionErrors"],
        "actions": [
            {"name": "start", "method": "post", "desc": "Start CanLII ingestion run", "model": "CanliiIngestionRuns"},
            {"name": "stats", "method": "get", "desc": "Get ingestion statistics", "model": "CanliiIngestionRuns"},
            {"name": "daily_quota", "method": "get", "desc": "Get daily API quota status", "model": "CanliiDailyQuotas"},
            {"name": "jobs", "method": "get", "desc": "List ingestion jobs", "model": "IngestionJobs"},
            {"name": "errors", "method": "get", "desc": "List ingestion errors", "model": "IngestionErrors"},
        ],
    },
    "case-alerts": {
        "class_name": "CaseAlertsViewSet",
        "app": "analytics",
        "models": ["SavedSearches", "CaseAlerts", "CaseDigests"],
        "extra_apps": {"notifications": ["AlertPreferences"]},
        "actions": [
            {"name": "alerts", "method": "get", "desc": "Get case alerts for user", "model": "CaseAlerts"},
            {"name": "mark_read", "method": "post", "desc": "Mark alert as read", "model": "CaseAlerts"},
            {"name": "mark_all_read", "method": "post", "desc": "Mark all alerts as read", "model": "CaseAlerts"},
            {"name": "saved_searches", "method": "get", "desc": "Get saved searches", "model": "SavedSearches"},
            {"name": "create_search", "method": "post", "desc": "Create saved search", "model": "SavedSearches"},
            {"name": "update_search", "method": "post", "desc": "Update saved search", "model": "SavedSearches"},
            {"name": "delete_search", "method": "post", "desc": "Delete saved search", "model": "SavedSearches"},
            {"name": "execute_search", "method": "get", "desc": "Execute saved search", "model": "SavedSearches"},
            {"name": "digest", "method": "get", "desc": "Generate case digest", "model": "CaseDigests"},
            {"name": "preferences", "method": "get", "desc": "Get alert preferences", "model": "AlertPreferences"},
            {"name": "update_preferences", "method": "post", "desc": "Update alert preferences", "model": "AlertPreferences"},
        ],
    },

    # ── Certificates & CE Credits ────────────────────────────
    "certificates": {
        "class_name": "CertificatesViewSet",
        "app": "core",
        "models": ["Certificates", "CertificateTemplates", "DigitalBadges"],
        "actions": [
            {"name": "create_certificate", "method": "post", "desc": "Create certificate", "model": "Certificates"},
            {"name": "create_from_quiz", "method": "post", "desc": "Create certificate from quiz completion", "model": "Certificates"},
            {"name": "get_certificate", "method": "get", "desc": "Get certificate by ID", "model": "Certificates"},
            {"name": "get_by_number", "method": "get", "desc": "Get certificate by number", "model": "Certificates"},
            {"name": "user_certificates", "method": "get", "desc": "Get user certificates", "model": "Certificates"},
            {"name": "user_stats", "method": "get", "desc": "Get user certificate stats", "model": "Certificates"},
            {"name": "course_certificates", "method": "get", "desc": "Get course certificates", "model": "Certificates"},
            {"name": "verify", "method": "get", "desc": "Verify certificate authenticity", "model": "Certificates"},
            {"name": "revoke", "method": "post", "desc": "Revoke certificate", "model": "Certificates"},
            {"name": "update_pdf", "method": "post", "desc": "Update certificate PDF", "model": "Certificates"},
            {"name": "templates", "method": "get", "desc": "List certificate templates", "model": "CertificateTemplates"},
            {"name": "default_template", "method": "get", "desc": "Get default template", "model": "CertificateTemplates"},
            {"name": "create_badge", "method": "post", "desc": "Create digital badge", "model": "DigitalBadges"},
            {"name": "user_badges", "method": "get", "desc": "Get user badges", "model": "DigitalBadges"},
            {"name": "badge_by_assertion", "method": "get", "desc": "Get badge by assertion", "model": "DigitalBadges"},
            {"name": "certificate_badges", "method": "get", "desc": "Get certificate badges", "model": "DigitalBadges"},
        ],
    },
    "ce-credits": {
        "class_name": "CECreditsViewSet",
        "app": "content",
        "models": ["Achievements", "UserAchievements"],
        "actions": [
            {"name": "active_credits", "method": "get", "desc": "Get active CE credits"},
            {"name": "credit_history", "method": "get", "desc": "Get CE credit history"},
            {"name": "summary_by_body", "method": "get", "desc": "Get CE credit summary by regulatory body"},
            {"name": "renewal_alerts", "method": "get", "desc": "Get CE renewal alerts"},
            {"name": "expiring_certs", "method": "get", "desc": "Get expiring certifications"},
            {"name": "user_dashboard", "method": "get", "desc": "Get user CE dashboard"},
            {"name": "regulatory_bodies", "method": "get", "desc": "Get user regulatory bodies"},
            {"name": "requirements", "method": "get", "desc": "Calculate CE requirements"},
        ],
    },

    # ── Courses & Learning ───────────────────────────────────
    "courses-enhanced": {
        "class_name": "CoursesEnhancedViewSet",
        "app": "core",
        "models": ["CourseModules", "CourseDiscussions"],
        "extra_apps": {"content": ["Courses", "Enrollments", "LessonProgress", "QuizAttempts", "Lessons"]},
        "actions": [
            {"name": "modules", "method": "get", "desc": "Get course modules", "model": "CourseModules"},
            {"name": "create_module", "method": "post", "desc": "Create course module", "model": "CourseModules"},
            {"name": "update_module", "method": "post", "desc": "Update course module", "model": "CourseModules"},
            {"name": "delete_module", "method": "post", "desc": "Delete course module", "model": "CourseModules"},
            {"name": "reorder_modules", "method": "post", "desc": "Reorder course modules", "model": "CourseModules"},
            {"name": "enroll", "method": "post", "desc": "Enroll in course", "model": "Enrollments"},
            {"name": "enrollment", "method": "get", "desc": "Get user enrollment", "model": "Enrollments"},
            {"name": "enrollments", "method": "get", "desc": "Get user enrollments", "model": "Enrollments"},
            {"name": "update_enrollment", "method": "post", "desc": "Update enrollment", "model": "Enrollments"},
            {"name": "update_progress", "method": "post", "desc": "Update enrollment progress", "model": "Enrollments"},
            {"name": "lesson_progress", "method": "get", "desc": "Get lesson progress", "model": "LessonProgress"},
            {"name": "track_lesson", "method": "post", "desc": "Track lesson progress", "model": "LessonProgress"},
            {"name": "complete_lesson", "method": "post", "desc": "Complete lesson", "model": "LessonProgress"},
            {"name": "calculate_completion", "method": "get", "desc": "Calculate course completion percentage"},
            {"name": "discussions", "method": "get", "desc": "Get course discussions", "model": "CourseDiscussions"},
            {"name": "create_discussion", "method": "post", "desc": "Create discussion", "model": "CourseDiscussions"},
            {"name": "discussion_replies", "method": "get", "desc": "Get discussion replies", "model": "CourseDiscussions"},
            {"name": "reply_discussion", "method": "post", "desc": "Reply to discussion", "model": "CourseDiscussions"},
            {"name": "mark_answered", "method": "post", "desc": "Mark discussion as answered", "model": "CourseDiscussions"},
            {"name": "quiz_attempts", "method": "get", "desc": "Get quiz attempts", "model": "QuizAttempts"},
            {"name": "submit_quiz", "method": "post", "desc": "Submit quiz attempt", "model": "QuizAttempts"},
            {"name": "learning_paths", "method": "get", "desc": "Get learning paths"},
            {"name": "learning_path", "method": "get", "desc": "Get specific learning path"},
            {"name": "enroll_path", "method": "post", "desc": "Enroll in learning path"},
            {"name": "path_progress", "method": "get", "desc": "Get learning path progress"},
        ],
    },
    "course-gamification": {
        "class_name": "CourseGamificationViewSet",
        "app": "core",
        "models": [
            "AchievementCategories", "AchievementProgress", "UserStreaks",
            "Leaderboards", "LeaderboardEntries",
        ],
        "extra_apps": {"content": ["Achievements", "UserAchievements", "UserPoints"]},
        "actions": [
            {"name": "achievement_categories", "method": "get", "desc": "Get achievement categories", "model": "AchievementCategories"},
            {"name": "achievements", "method": "get", "desc": "List achievements", "model": "Achievements"},
            {"name": "user_achievements", "method": "get", "desc": "Get user course achievements", "model": "UserAchievements"},
            {"name": "achievement_progress", "method": "get", "desc": "Get achievement progress", "model": "AchievementProgress"},
            {"name": "check_achievements", "method": "post", "desc": "Check and award achievements"},
            {"name": "feature_achievement", "method": "post", "desc": "Feature an achievement", "model": "UserAchievements"},
            {"name": "user_points", "method": "get", "desc": "Get user course points", "model": "UserPoints"},
            {"name": "award_points", "method": "post", "desc": "Award course points", "model": "UserPoints"},
            {"name": "points_transactions", "method": "get", "desc": "Get points transactions", "model": "PointsTransactions"},
            {"name": "streaks", "method": "get", "desc": "Get course streaks", "model": "UserStreaks"},
            {"name": "update_streak", "method": "post", "desc": "Update streak", "model": "UserStreaks"},
            {"name": "best_streak", "method": "get", "desc": "Get user best streak", "model": "UserStreaks"},
            {"name": "leaderboards", "method": "get", "desc": "Get leaderboards", "model": "Leaderboards"},
            {"name": "leaderboard_entries", "method": "get", "desc": "Get leaderboard entries", "model": "LeaderboardEntries"},
            {"name": "user_rank", "method": "get", "desc": "Get user leaderboard rank", "model": "LeaderboardEntries"},
            {"name": "calculate_leaderboard", "method": "post", "desc": "Calculate leaderboard rankings", "model": "Leaderboards"},
            {"name": "summary", "method": "get", "desc": "Get gamification summary"},
        ],
    },
    "course-workflow": {
        "class_name": "CourseWorkflowViewSet",
        "app": "core",
        "models": ["CourseWorkflowReviews", "CourseWorkflowHistory", "ContentQualityChecklists", "CourseVersions"],
        "extra_apps": {"content": ["Courses"]},
        "actions": [
            {"name": "submit_review", "method": "post", "desc": "Submit course for review", "model": "CourseWorkflowHistory"},
            {"name": "approve", "method": "post", "desc": "Approve course", "model": "CourseWorkflowHistory"},
            {"name": "reject", "method": "post", "desc": "Reject course", "model": "CourseWorkflowHistory"},
            {"name": "publish", "method": "post", "desc": "Publish course", "model": "CourseWorkflowHistory"},
            {"name": "workflow_history", "method": "get", "desc": "Get workflow history", "model": "CourseWorkflowHistory"},
            {"name": "create_version", "method": "post", "desc": "Create course version", "model": "CourseVersions"},
            {"name": "versions", "method": "get", "desc": "Get course versions", "model": "CourseVersions"},
            {"name": "version", "method": "get", "desc": "Get specific version", "model": "CourseVersions"},
            {"name": "create_review", "method": "post", "desc": "Create review", "model": "CourseWorkflowReviews"},
            {"name": "complete_review", "method": "post", "desc": "Complete review", "model": "CourseWorkflowReviews"},
            {"name": "reviews", "method": "get", "desc": "Get reviews", "model": "CourseWorkflowReviews"},
            {"name": "pending_reviews", "method": "get", "desc": "Get pending reviews", "model": "CourseWorkflowReviews"},
            {"name": "quality_checklist", "method": "get", "desc": "Get quality checklist", "model": "ContentQualityChecklists"},
            {"name": "update_checklist", "method": "post", "desc": "Update quality checklist", "model": "ContentQualityChecklists"},
            {"name": "pending_courses", "method": "get", "desc": "Get courses pending review"},
            {"name": "workflow_summary", "method": "get", "desc": "Get workflow summary statistics"},
            {"name": "courses_by_status", "method": "get", "desc": "Get courses by workflow status"},
        ],
    },

    # ── Embedding & Search ───────────────────────────────────
    "embedding-service": {
        "class_name": "EmbeddingServiceViewSet",
        "app": "ai_core",
        "models": ["CaseEmbeddings", "CourseEmbeddings", "LessonEmbeddings", "EmbeddingJobs"],
        "actions": [
            {"name": "generate_embedding", "method": "post", "desc": "Generate embedding for text"},
            {"name": "generate_batch", "method": "post", "desc": "Generate embeddings batch"},
            {"name": "generate_case", "method": "post", "desc": "Generate case embedding", "model": "CaseEmbeddings"},
            {"name": "generate_course", "method": "post", "desc": "Generate course embedding", "model": "CourseEmbeddings"},
            {"name": "generate_all_cases", "method": "post", "desc": "Generate all case embeddings", "model": "EmbeddingJobs"},
            {"name": "generate_all_courses", "method": "post", "desc": "Generate all course embeddings", "model": "EmbeddingJobs"},
            {"name": "search_cases", "method": "post", "desc": "Search similar cases by text", "model": "CaseEmbeddings"},
            {"name": "search_courses", "method": "post", "desc": "Search similar courses by text", "model": "CourseEmbeddings"},
            {"name": "job_status", "method": "get", "desc": "Get embedding job status", "model": "EmbeddingJobs"},
            {"name": "all_jobs", "method": "get", "desc": "Get all embedding jobs", "model": "EmbeddingJobs"},
        ],
    },

    # ── Gamification ─────────────────────────────────────────
    "gamification": {
        "class_name": "GamificationViewSet",
        "app": "core",
        "models": [
            "AchievementCategories", "AchievementProgress", "UserStreaks",
            "PointsSources", "PointsTransactions", "RewardsCatalog", "UserRewards",
            "Leaderboards", "LeaderboardEntries",
        ],
        "extra_apps": {"content": ["Achievements", "UserAchievements", "UserPoints"]},
        "actions": [
            {"name": "achievement_categories", "method": "get", "desc": "Get achievement categories", "model": "AchievementCategories"},
            {"name": "achievements", "method": "get", "desc": "List achievements", "model": "Achievements"},
            {"name": "user_achievements", "method": "get", "desc": "Get user achievements", "model": "UserAchievements"},
            {"name": "achievement_progress", "method": "get", "desc": "Get achievement progress", "model": "AchievementProgress"},
            {"name": "award_achievement", "method": "post", "desc": "Award achievement to user", "model": "UserAchievements"},
            {"name": "update_progress", "method": "post", "desc": "Update achievement progress", "model": "AchievementProgress"},
            {"name": "achievement_summary", "method": "get", "desc": "Get user achievement summary"},
            {"name": "toggle_featured", "method": "post", "desc": "Toggle featured achievement", "model": "UserAchievements"},
            {"name": "streaks", "method": "get", "desc": "Get user streaks", "model": "UserStreaks"},
            {"name": "update_streak", "method": "post", "desc": "Update user streak", "model": "UserStreaks"},
            {"name": "points_sources", "method": "get", "desc": "Get points sources", "model": "PointsSources"},
            {"name": "user_points", "method": "get", "desc": "Get user points", "model": "UserPoints"},
            {"name": "award_points", "method": "post", "desc": "Award points", "model": "UserPoints"},
            {"name": "spend_points", "method": "post", "desc": "Spend points", "model": "PointsTransactions"},
            {"name": "points_transactions", "method": "get", "desc": "Get transactions", "model": "PointsTransactions"},
            {"name": "points_summary", "method": "get", "desc": "Get points summary"},
            {"name": "rewards", "method": "get", "desc": "Get rewards catalog", "model": "RewardsCatalog"},
            {"name": "redeem_reward", "method": "post", "desc": "Redeem a reward", "model": "UserRewards"},
            {"name": "user_rewards", "method": "get", "desc": "Get user rewards", "model": "UserRewards"},
            {"name": "leaderboards", "method": "get", "desc": "Get leaderboards", "model": "Leaderboards"},
            {"name": "leaderboard_entries", "method": "get", "desc": "Get leaderboard entries", "model": "LeaderboardEntries"},
            {"name": "user_leaderboard", "method": "get", "desc": "Get user leaderboard entry", "model": "LeaderboardEntries"},
            {"name": "update_leaderboard", "method": "post", "desc": "Update leaderboard entry", "model": "LeaderboardEntries"},
            {"name": "user_level", "method": "get", "desc": "Get user level"},
            {"name": "add_xp", "method": "post", "desc": "Add XP to user"},
        ],
    },

    # ── Instructors ──────────────────────────────────────────
    "instructors": {
        "class_name": "InstructorsViewSet",
        "app": "core",
        "models": ["InstructorProfiles", "CourseInstructors", "InstructorAnalytics", "InstructorCommunications", "InstructorEarnings"],
        "actions": [
            {"name": "profile", "method": "get", "desc": "Get instructor profile", "model": "InstructorProfiles"},
            {"name": "create_profile", "method": "post", "desc": "Create instructor profile", "model": "InstructorProfiles"},
            {"name": "update_profile", "method": "post", "desc": "Update instructor profile", "model": "InstructorProfiles"},
            {"name": "approve", "method": "post", "desc": "Approve instructor", "model": "InstructorProfiles"},
            {"name": "active_instructors", "method": "get", "desc": "Get active instructors", "model": "InstructorProfiles"},
            {"name": "featured_instructors", "method": "get", "desc": "Get featured instructors", "model": "InstructorProfiles"},
            {"name": "assign_course", "method": "post", "desc": "Assign instructor to course", "model": "CourseInstructors"},
            {"name": "remove_course", "method": "post", "desc": "Remove instructor from course", "model": "CourseInstructors"},
            {"name": "course_instructors", "method": "get", "desc": "Get course instructors", "model": "CourseInstructors"},
            {"name": "instructor_courses", "method": "get", "desc": "Get instructor courses", "model": "CourseInstructors"},
            {"name": "dashboard", "method": "get", "desc": "Get instructor dashboard summary"},
            {"name": "analytics", "method": "get", "desc": "Get instructor analytics", "model": "InstructorAnalytics"},
            {"name": "analytics_timeseries", "method": "get", "desc": "Get analytics time series", "model": "InstructorAnalytics"},
            {"name": "effectiveness", "method": "get", "desc": "Get teaching effectiveness"},
            {"name": "send_message", "method": "post", "desc": "Send communication", "model": "InstructorCommunications"},
            {"name": "messages", "method": "get", "desc": "Get communications", "model": "InstructorCommunications"},
            {"name": "earnings_summary", "method": "get", "desc": "Get earnings summary", "model": "InstructorEarnings"},
            {"name": "earnings_by_course", "method": "get", "desc": "Get earnings by course", "model": "InstructorEarnings"},
        ],
    },

    # ── Quizzes ──────────────────────────────────────────────
    "quiz": {
        "class_name": "QuizViewSet",
        "app": "content",
        "models": ["Quizzes", "QuizAttempts"],
        "extra_apps": {"core": ["QuizQuestions", "QuizResponses"]},
        "actions": [
            {"name": "list_quizzes", "method": "get", "desc": "List quizzes", "model": "Quizzes"},
            {"name": "get_quiz", "method": "get", "desc": "Get quiz by ID", "model": "Quizzes"},
            {"name": "create_quiz", "method": "post", "desc": "Create quiz", "model": "Quizzes"},
            {"name": "update_quiz", "method": "post", "desc": "Update quiz", "model": "Quizzes"},
            {"name": "delete_quiz", "method": "post", "desc": "Delete quiz", "model": "Quizzes"},
            {"name": "add_question", "method": "post", "desc": "Add question to quiz", "model": "QuizQuestions"},
            {"name": "remove_question", "method": "post", "desc": "Remove question from quiz", "model": "QuizQuestions"},
            {"name": "quiz_for_attempt", "method": "get", "desc": "Get quiz formatted for attempt", "model": "Quizzes"},
            {"name": "start_attempt", "method": "post", "desc": "Start quiz attempt", "model": "QuizAttempts"},
            {"name": "submit_response", "method": "post", "desc": "Submit quiz response", "model": "QuizResponses"},
            {"name": "submit_attempt", "method": "post", "desc": "Submit completed quiz attempt", "model": "QuizAttempts"},
            {"name": "get_attempt", "method": "get", "desc": "Get quiz attempt", "model": "QuizAttempts"},
            {"name": "user_attempts", "method": "get", "desc": "Get user quiz attempts", "model": "QuizAttempts"},
        ],
    },
    "quiz-questions": {
        "class_name": "QuizQuestionsViewSet",
        "app": "core",
        "models": ["Questions", "QuestionOptions", "QuestionPools", "PoolQuestions"],
        "actions": [
            {"name": "list_questions", "method": "get", "desc": "List questions", "model": "Questions"},
            {"name": "get_question", "method": "get", "desc": "Get question by ID", "model": "Questions"},
            {"name": "create_question", "method": "post", "desc": "Create question", "model": "Questions"},
            {"name": "update_question", "method": "post", "desc": "Update question", "model": "Questions"},
            {"name": "delete_question", "method": "post", "desc": "Delete question", "model": "Questions"},
            {"name": "add_option", "method": "post", "desc": "Add question option", "model": "QuestionOptions"},
            {"name": "update_option", "method": "post", "desc": "Update question option", "model": "QuestionOptions"},
            {"name": "delete_option", "method": "post", "desc": "Delete question option", "model": "QuestionOptions"},
            {"name": "question_stats", "method": "get", "desc": "Get question statistics", "model": "Questions"},
            {"name": "create_pool", "method": "post", "desc": "Create question pool", "model": "QuestionPools"},
            {"name": "add_to_pool", "method": "post", "desc": "Add questions to pool", "model": "PoolQuestions"},
            {"name": "random_from_pool", "method": "get", "desc": "Get random questions from pool", "model": "PoolQuestions"},
        ],
    },

    # ── Skills ───────────────────────────────────────────────
    "skills": {
        "class_name": "SkillsViewSet",
        "app": "core",
        "models": ["Skills", "CourseSkills", "LessonSkills", "QuestionSkills", "UserSkills", "SkillValidations", "SkillPrerequisites"],
        "actions": [
            {"name": "list_skills", "method": "get", "desc": "List skills", "model": "Skills"},
            {"name": "get_skill", "method": "get", "desc": "Get skill by ID", "model": "Skills"},
            {"name": "categories", "method": "get", "desc": "Get skill categories", "model": "Skills"},
            {"name": "user_skills", "method": "get", "desc": "Get user skills", "model": "UserSkills"},
            {"name": "user_dashboard", "method": "get", "desc": "Get user skills dashboard"},
            {"name": "skill_progress", "method": "get", "desc": "Get skill progress", "model": "UserSkills"},
            {"name": "active_validated", "method": "get", "desc": "Get active validated skills", "model": "SkillValidations"},
            {"name": "expiring", "method": "get", "desc": "Get expiring skills", "model": "SkillValidations"},
            {"name": "validation_history", "method": "get", "desc": "Get skill validation history", "model": "SkillValidations"},
            {"name": "validate_from_quiz", "method": "post", "desc": "Validate skills from quiz", "model": "SkillValidations"},
            {"name": "recommended_courses", "method": "get", "desc": "Get recommended courses for skill gaps"},
        ],
    },

    # ── Social ───────────────────────────────────────────────
    "social": {
        "class_name": "SocialViewSet",
        "app": "core",
        "models": [
            "UserProfilesExtended", "UserFollows", "StudyBuddies",
            "UserActivityFeed", "UserGroups", "GroupMembers",
        ],
        "actions": [
            {"name": "profile", "method": "get", "desc": "Get user social profile", "model": "UserProfilesExtended"},
            {"name": "upsert_profile", "method": "post", "desc": "Create/update social profile", "model": "UserProfilesExtended"},
            {"name": "search_users", "method": "get", "desc": "Search users", "model": "UserProfilesExtended"},
            {"name": "follow", "method": "post", "desc": "Follow user", "model": "UserFollows"},
            {"name": "unfollow", "method": "post", "desc": "Unfollow user", "model": "UserFollows"},
            {"name": "followers", "method": "get", "desc": "Get followers", "model": "UserFollows"},
            {"name": "following", "method": "get", "desc": "Get following", "model": "UserFollows"},
            {"name": "is_following", "method": "get", "desc": "Check if following user", "model": "UserFollows"},
            {"name": "study_buddy_matches", "method": "get", "desc": "Find study buddy matches", "model": "StudyBuddies"},
            {"name": "send_buddy_request", "method": "post", "desc": "Send study buddy request", "model": "StudyBuddies"},
            {"name": "accept_buddy", "method": "post", "desc": "Accept study buddy request", "model": "StudyBuddies"},
            {"name": "decline_buddy", "method": "post", "desc": "Decline study buddy request", "model": "StudyBuddies"},
            {"name": "buddies", "method": "get", "desc": "Get study buddies", "model": "StudyBuddies"},
            {"name": "pending_buddy_requests", "method": "get", "desc": "Get pending requests", "model": "StudyBuddies"},
            {"name": "create_post", "method": "post", "desc": "Create activity post", "model": "UserActivityFeed"},
            {"name": "activity_feed", "method": "get", "desc": "Get activity feed", "model": "UserActivityFeed"},
            {"name": "user_activity", "method": "get", "desc": "Get user activity", "model": "UserActivityFeed"},
            {"name": "add_reaction", "method": "post", "desc": "Add reaction to post", "model": "UserActivityFeed"},
            {"name": "remove_reaction", "method": "post", "desc": "Remove reaction", "model": "UserActivityFeed"},
            {"name": "add_comment", "method": "post", "desc": "Add comment to activity"},
            {"name": "comments", "method": "get", "desc": "Get activity comments"},
            {"name": "social_summary", "method": "get", "desc": "Get user social summary"},
        ],
    },

    # ── SSO & Auth ───────────────────────────────────────────
    "sso": {
        "class_name": "SSOViewSet",
        "app": "core",
        "models": ["SsoProviders", "EnterpriseSessions", "IdentityProviderMapping", "SsoLoginAttempts"],
        "actions": [
            {"name": "providers", "method": "get", "desc": "Get org SSO providers", "model": "SsoProviders"},
            {"name": "get_provider", "method": "get", "desc": "Get SSO provider", "model": "SsoProviders"},
            {"name": "create_provider", "method": "post", "desc": "Create SSO provider", "model": "SsoProviders"},
            {"name": "update_provider", "method": "post", "desc": "Update SSO provider", "model": "SsoProviders"},
            {"name": "delete_provider", "method": "post", "desc": "Delete SSO provider", "model": "SsoProviders"},
            {"name": "update_status", "method": "post", "desc": "Update provider status", "model": "SsoProviders"},
            {"name": "set_default", "method": "post", "desc": "Set default SSO provider", "model": "SsoProviders"},
            {"name": "test_connection", "method": "post", "desc": "Test SSO connection", "model": "SsoProviders"},
            {"name": "active_sessions", "method": "get", "desc": "Get active sessions", "model": "EnterpriseSessions"},
            {"name": "revoke_session", "method": "post", "desc": "Revoke session", "model": "EnterpriseSessions"},
            {"name": "login_attempts", "method": "get", "desc": "Get SSO login attempts", "model": "SsoLoginAttempts"},
        ],
    },
    "rbac": {
        "class_name": "RBACViewSet",
        "app": "core",
        "models": ["ResourcePermissions", "PermissionOverrides", "RoleHierarchy", "PermissionCache"],
        "extra_apps": {"auth_core": ["Roles", "Permissions", "UserRoles", "RolePermissions"]},
        "actions": [
            {"name": "check_permission", "method": "post", "desc": "Check user permission"},
            {"name": "user_permissions", "method": "get", "desc": "Get user permissions"},
            {"name": "effective_permissions", "method": "get", "desc": "Get effective permissions"},
            {"name": "user_roles", "method": "get", "desc": "Get user roles with inheritance", "model": "UserRoles"},
            {"name": "assign_permission", "method": "post", "desc": "Assign permission", "model": "ResourcePermissions"},
            {"name": "revoke_permission", "method": "post", "desc": "Revoke permission", "model": "ResourcePermissions"},
            {"name": "create_override", "method": "post", "desc": "Create permission override", "model": "PermissionOverrides"},
            {"name": "approve_override", "method": "post", "desc": "Approve permission override", "model": "PermissionOverrides"},
            {"name": "clear_cache", "method": "post", "desc": "Clear permission cache", "model": "PermissionCache"},
            {"name": "clear_all_caches", "method": "post", "desc": "Clear all permission caches", "model": "PermissionCache"},
        ],
    },
    "entitlements": {
        "class_name": "EntitlementsViewSet",
        "app": "billing",
        "models": ["OrganizationSubscriptions"],
        "actions": [
            {"name": "user_entitlements", "method": "get", "desc": "Get user entitlements"},
            {"name": "org_entitlements", "method": "get", "desc": "Get organization entitlements"},
            {"name": "check_feature", "method": "post", "desc": "Check feature access"},
            {"name": "can_perform", "method": "post", "desc": "Check if user can perform action"},
        ],
    },

    # ── Billing & Seat Management ────────────────────────────
    "seat-management": {
        "class_name": "SeatManagementViewSet",
        "app": "billing",
        "models": ["OrganizationSubscriptions", "SeatAllocations", "SubscriptionInvoices"],
        "actions": [
            {"name": "subscription", "method": "get", "desc": "Get org subscription", "model": "OrganizationSubscriptions"},
            {"name": "create_subscription", "method": "post", "desc": "Create org subscription", "model": "OrganizationSubscriptions"},
            {"name": "update_subscription", "method": "post", "desc": "Update org subscription", "model": "OrganizationSubscriptions"},
            {"name": "by_stripe_id", "method": "get", "desc": "Get subscription by Stripe ID", "model": "OrganizationSubscriptions"},
            {"name": "can_add_users", "method": "get", "desc": "Check if org can add users"},
            {"name": "enforce_seats", "method": "post", "desc": "Enforce seat limits"},
            {"name": "allocations", "method": "get", "desc": "Get seat allocations", "model": "SeatAllocations"},
            {"name": "allocate", "method": "post", "desc": "Allocate seat", "model": "SeatAllocations"},
            {"name": "revoke", "method": "post", "desc": "Revoke seat allocation", "model": "SeatAllocations"},
            {"name": "user_status", "method": "get", "desc": "Get user seat status", "model": "SeatAllocations"},
            {"name": "invoices", "method": "get", "desc": "Get subscription invoices", "model": "SubscriptionInvoices"},
            {"name": "record_invoice", "method": "post", "desc": "Record invoice", "model": "SubscriptionInvoices"},
        ],
    },

    # ── Dashboard & Analytics ────────────────────────────────
    "dashboard-analytics": {
        "class_name": "DashboardAnalyticsViewSet",
        "app": "content",
        "models": ["Enrollments", "LessonProgress", "Achievements", "LearningStreaks"],
        "actions": [
            {"name": "stats", "method": "get", "desc": "Get dashboard statistics"},
            {"name": "recent_activity", "method": "get", "desc": "Get recent activity"},
            {"name": "learning_streak", "method": "get", "desc": "Get learning streak", "model": "LearningStreaks"},
            {"name": "ce_credits", "method": "get", "desc": "Get CE credits earned"},
            {"name": "skill_progress", "method": "get", "desc": "Get skill progress"},
        ],
    },
    "watch-history": {
        "class_name": "WatchHistoryViewSet",
        "app": "content",
        "models": ["LessonProgress"],
        "actions": [
            {"name": "start_session", "method": "post", "desc": "Start watch session"},
            {"name": "update_session", "method": "post", "desc": "Update watch session"},
            {"name": "end_session", "method": "post", "desc": "End watch session"},
            {"name": "last_position", "method": "get", "desc": "Get last watched position"},
            {"name": "lesson_history", "method": "get", "desc": "Get lesson watch history"},
            {"name": "recent_history", "method": "get", "desc": "Get recent watch history"},
            {"name": "total_time", "method": "get", "desc": "Get total watch time"},
            {"name": "time_range", "method": "get", "desc": "Get watch time by date range"},
            {"name": "statistics", "method": "get", "desc": "Get lesson watch statistics"},
        ],
    },
    "lesson-notes": {
        "class_name": "LessonNotesViewSet",
        "app": "content",
        "models": ["Bookmarks"],
        "actions": [
            {"name": "notes", "method": "get", "desc": "Get lesson notes", "model": "Bookmarks"},
            {"name": "create_note", "method": "post", "desc": "Create lesson note", "model": "Bookmarks"},
            {"name": "update_note", "method": "post", "desc": "Update lesson note", "model": "Bookmarks"},
            {"name": "delete_note", "method": "post", "desc": "Delete lesson note", "model": "Bookmarks"},
            {"name": "note_count", "method": "get", "desc": "Get note count", "model": "Bookmarks"},
            {"name": "export_text", "method": "get", "desc": "Export notes as text"},
        ],
    },

    # ── Live Sessions ────────────────────────────────────────
    "live-session": {
        "class_name": "LiveSessionViewSet",
        "app": "core",
        "models": ["DiscussionForums", "ForumPosts"],
        "actions": [
            {"name": "submit_question", "method": "post", "desc": "Submit question in live session"},
            {"name": "answer_question", "method": "post", "desc": "Answer question in live session"},
            {"name": "upvote_question", "method": "post", "desc": "Upvote a question"},
            {"name": "send_chat", "method": "post", "desc": "Send chat message"},
            {"name": "create_breakout_rooms", "method": "post", "desc": "Create breakout rooms"},
            {"name": "assign_breakout", "method": "post", "desc": "Assign to breakout room"},
            {"name": "close_breakout", "method": "post", "desc": "Close breakout rooms"},
        ],
    },

    # ── Data Export ──────────────────────────────────────────
    "data-export": {
        "class_name": "DataExportViewSet",
        "app": "core",
        "models": ["DataExportContents", "AuditLogExports"],
        "actions": [
            {"name": "generate", "method": "post", "desc": "Generate data export", "model": "DataExportContents"},
            {"name": "status", "method": "get", "desc": "Get export status", "model": "DataExportContents"},
            {"name": "download", "method": "get", "desc": "Download export file", "model": "DataExportContents"},
        ],
    },

    # ── Offboarding ──────────────────────────────────────────
    "org-offboarding": {
        "class_name": "OrgOffboardingViewSet",
        "app": "core",
        "models": ["OrgOffboardingRequests", "OffboardingAuditLog"],
        "actions": [
            {"name": "initiate", "method": "post", "desc": "Initiate org offboarding", "model": "OrgOffboardingRequests"},
            {"name": "status", "method": "get", "desc": "Get offboarding status", "model": "OrgOffboardingRequests"},
            {"name": "status_by_org", "method": "get", "desc": "Get status by organization", "model": "OrgOffboardingRequests"},
            {"name": "audit_log", "method": "get", "desc": "Get offboarding audit log", "model": "OffboardingAuditLog"},
        ],
    },
    "tenant-offboarding": {
        "class_name": "TenantOffboardingViewSet",
        "app": "core",
        "models": ["OrgOffboardingRequests", "OffboardingAuditLog"],
        "actions": [
            {"name": "initiate", "method": "post", "desc": "Initiate tenant offboarding", "model": "OrgOffboardingRequests"},
            {"name": "cancel", "method": "post", "desc": "Cancel offboarding", "model": "OrgOffboardingRequests"},
            {"name": "hard_delete", "method": "post", "desc": "Execute hard delete"},
            {"name": "pending_deletions", "method": "get", "desc": "Get pending deletions", "model": "OrgOffboardingRequests"},
        ],
    },

    # ── Outcome / Prediction ─────────────────────────────────
    "outcome-prediction": {
        "class_name": "OutcomePredictionViewSet",
        "app": "core",
        "models": ["CaseOutcomes", "OutcomePredictions", "PredictionModels"],
        "actions": [
            {"name": "predict", "method": "post", "desc": "Predict case outcome", "model": "OutcomePredictions"},
            {"name": "get_prediction", "method": "get", "desc": "Get prediction by ID", "model": "OutcomePredictions"},
            {"name": "evaluate_model", "method": "post", "desc": "Evaluate prediction model", "model": "PredictionModels"},
            {"name": "case_outcomes", "method": "get", "desc": "Get case outcomes", "model": "CaseOutcomes"},
        ],
    },

    # ── PDF Generator ────────────────────────────────────────
    "pdf-generator": {
        "class_name": "PDFGeneratorViewSet",
        "app": "core",
        "models": ["EvidenceBundlePdfs"],
        "actions": [
            {"name": "generate_evidence", "method": "post", "desc": "Generate evidence PDF", "model": "EvidenceBundlePdfs"},
            {"name": "status", "method": "get", "desc": "Get PDF generation status", "model": "EvidenceBundlePdfs"},
        ],
    },

    # ── Codespring ───────────────────────────────────────────
    "codespring": {
        "class_name": "CodespringViewSet",
        "app": "core",
        "models": [],
        "actions": [
            {"name": "verify_key", "method": "post", "desc": "Verify Codespring API key"},
            {"name": "status", "method": "get", "desc": "Get Codespring integration status"},
        ],
    },

    # ── Training (AI) ───────────────────────────────────────
    "ai-training": {
        "class_name": "AITrainingViewSet",
        "app": "ai_core",
        "models": ["TrainingJobs", "AutomatedTrainingConfig", "ClassificationFeedback"],
        "actions": [
            {"name": "start_job", "method": "post", "desc": "Start training job", "model": "TrainingJobs"},
            {"name": "job_status", "method": "get", "desc": "Get training job status", "model": "TrainingJobs"},
            {"name": "jobs", "method": "get", "desc": "List training jobs", "model": "TrainingJobs"},
            {"name": "config", "method": "get", "desc": "Get automated training config", "model": "AutomatedTrainingConfig"},
            {"name": "update_config", "method": "post", "desc": "Update training config", "model": "AutomatedTrainingConfig"},
            {"name": "submit_feedback", "method": "post", "desc": "Submit classification feedback", "model": "ClassificationFeedback"},
            {"name": "feedback", "method": "get", "desc": "Get classification feedback", "model": "ClassificationFeedback"},
        ],
    },
}


# ──────────────────────────────────────────────────────────────────
# CODE GENERATION (reused from UE generator, adapted for ABR)
# ──────────────────────────────────────────────────────────────────

def generate_action_method(action: dict) -> str:
    """Generate a single @action method for a ViewSet."""
    name = action["name"]
    method = action["method"]
    desc = action["desc"]
    model_name = action.get("model")

    if method == "get":
        if model_name:
            body = textwrap.dedent(f"""\
                queryset = {model_name}.objects.filter(
                    organization_id=request.user.organization_id
                )
                for param in ['status', 'type', 'created_after', 'created_before']:
                    val = request.query_params.get(param)
                    if val:
                        if param == 'created_after':
                            queryset = queryset.filter(created_at__gte=val)
                        elif param == 'created_before':
                            queryset = queryset.filter(created_at__lte=val)
                        else:
                            queryset = queryset.filter(**{{param: val}})
                
                page = self.paginate_queryset(queryset.order_by('-created_at'))
                if page is not None:
                    data = list(page.values())
                    return self.get_paginated_response(data)
                
                return Response({{
                    'count': queryset.count(),
                    'results': list(queryset.order_by('-created_at').values()[:100]),
                }}, status=status.HTTP_200_OK)""")
        else:
            body = textwrap.dedent(f"""\
                org_id = request.user.organization_id
                return Response({{
                    'status': 'success',
                    'organizationId': str(org_id),
                    'data': {{}},
                }}, status=status.HTTP_200_OK)""")
    else:  # POST
        if model_name:
            body = textwrap.dedent(f"""\
                data = request.data
                with transaction.atomic():
                    obj = {model_name}.objects.create(
                        organization_id=request.user.organization_id,
                        **{{k: v for k, v in data.items() if k != 'organization_id'}}
                    )
                    AuditLogs.objects.create(
                        organization_id=request.user.organization_id,
                        action='{name}',
                        resource_type='{model_name}',
                        resource_id=str(obj.id),
                        user_id=str(request.user.id),
                        details=data,
                    )
                return Response({{
                    'id': str(obj.id),
                    'createdAt': obj.created_at.isoformat(),
                    'status': 'success',
                }}, status=status.HTTP_201_CREATED)""")
        else:
            body = textwrap.dedent(f"""\
                data = request.data
                org_id = request.user.organization_id
                # TODO: Implement business logic
                return Response({{
                    'status': 'success',
                    'message': '{desc}',
                }}, status=status.HTTP_200_OK)""")

    return textwrap.dedent(f"""\
    @action(detail=False, methods=['{method}'])
    def {name}(self, request):
        \"\"\"
        {desc}
        {method.upper()} /api/services/{{basename}}/{name}/
        \"\"\"
        try:
            {textwrap.indent(body, '            ').strip()}
        except Exception as e:
            logger.error(f'{name} failed: {{e}}', exc_info=True)
            return Response({{
                'error': str(e),
                'action': '{name}',
            }}, status=status.HTTP_400_BAD_REQUEST)
    """)


def generate_view_file(service_key: str, spec: dict) -> str:
    """Generate a complete views.py file for a service."""
    class_name = spec["class_name"]
    app = spec["app"]
    models = spec["models"]
    actions = spec["actions"]
    extra_apps = spec.get("extra_apps", {})

    imports = [
        '"""',
        f'{class_name}',
        f'Service: {service_key}',
        f'Auto-generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}',
        '"""',
        '',
        'from rest_framework import viewsets, status',
        'from rest_framework.decorators import action',
        'from rest_framework.response import Response',
        'from rest_framework.permissions import IsAuthenticated',
        'from rest_framework.pagination import CursorPagination',
        'from django.db import transaction',
        'from django.utils import timezone',
        'import uuid',
        'import logging',
        '',
        'logger = logging.getLogger(__name__)',
    ]

    if models:
        model_list = ", ".join(models)
        imports.append(f'from {app}.models import {model_list}')

    for extra_app, extra_models in extra_apps.items():
        model_list = ", ".join(extra_models)
        imports.append(f'from {extra_app}.models import {model_list}')

    if any(a["method"] == "post" for a in actions):
        imports.append('from auth_core.models import AuditLogs')

    imports.append('')
    imports.append('')

    pagination_name = class_name.replace("ViewSet", "Pagination")
    pagination = textwrap.dedent(f"""\
    class {pagination_name}(CursorPagination):
        page_size = 50
        ordering = '-created_at'
        cursor_query_param = 'cursor'
    
    
    """)

    basname_url = service_key
    action_methods = []
    for a in actions:
        method_code = generate_action_method(a)
        method_code = method_code.replace("{basename}", basname_url)
        action_methods.append(method_code)

    endpoint_docs = "\n".join(
        f"    - {a['method'].upper()} /api/services/{basname_url}/{a['name']}/ — {a['desc']}"
        for a in actions
    )

    viewset = textwrap.dedent(f"""\
    class {class_name}(viewsets.ViewSet):
        \"\"\"
        ViewSet for {service_key} operations.
        
        Endpoints:
    {endpoint_docs}
        \"\"\"
        
        permission_classes = [IsAuthenticated]
        pagination_class = {pagination_name}
        
        def paginate_queryset(self, queryset):
            paginator = self.pagination_class()
            return paginator.paginate_queryset(queryset, self.request, view=self)
        
        def get_paginated_response(self, data):
            paginator = self.pagination_class()
            return Response({{
                'count': len(data),
                'results': data,
            }}, status=status.HTTP_200_OK)
        
    """)

    file_content = "\n".join(imports) + pagination + viewset
    for method_code in action_methods:
        indented = textwrap.indent(method_code, "    ")
        file_content += indented + "\n"

    return file_content


def generate_urls_file(all_services: Dict[str, dict]) -> str:
    """Generate urls.py with all service registrations."""
    lines = [
        '"""',
        'ABR Insights — Services API URL Configuration',
        f'Auto-generated: {datetime.now().strftime("%Y-%m-%d %H:%M")}',
        '"""',
        '',
        'from django.urls import path, include',
        'from rest_framework.routers import DefaultRouter',
        '',
    ]

    for svc_key, spec in sorted(all_services.items()):
        module_name = svc_key.replace("-", "_") + "_views"
        lines.append(f"from .{module_name} import {spec['class_name']}")

    lines.append('')
    lines.append('router = DefaultRouter()')
    lines.append('')

    for svc_key, spec in sorted(all_services.items()):
        lines.append(f"router.register(r'{svc_key}', {spec['class_name']}, basename='{svc_key}')")

    lines.append('')
    lines.append('urlpatterns = [')
    lines.append("    path('', include(router.urls)),")
    lines.append(']')
    lines.append('')

    return "\n".join(lines)


# ──────────────────────────────────────────────────────────────────
# INFRASTRUCTURE: Create services/ Django app
# ──────────────────────────────────────────────────────────────────

def ensure_services_app(dry_run: bool = False):
    """Create the services/ Django app structure if it doesn't exist."""
    dirs = [SERVICES_DIR, SERVICES_API_DIR]
    files = {
        os.path.join(SERVICES_DIR, "__init__.py"): "",
        os.path.join(SERVICES_DIR, "apps.py"): textwrap.dedent("""\
            from django.apps import AppConfig

            class ServicesConfig(AppConfig):
                default_auto_field = 'django.db.models.BigAutoField'
                name = 'services'
                verbose_name = 'ABR Service APIs'
        """),
        os.path.join(SERVICES_API_DIR, "__init__.py"): "",
    }

    for d in dirs:
        if not os.path.isdir(d):
            if dry_run:
                print(f"  [DRY-RUN] Would create directory: {d}")
            else:
                os.makedirs(d, exist_ok=True)
                print(f"  Created directory: {d}")

    for fp, content in files.items():
        if not os.path.isfile(fp):
            if dry_run:
                print(f"  [DRY-RUN] Would create: {os.path.basename(fp)}")
            else:
                with open(fp, "w", encoding="utf-8") as f:
                    f.write(content)
                print(f"  Created: {os.path.basename(fp)}")


def patch_settings(dry_run: bool = False):
    """Add 'services' to INSTALLED_APPS if not present."""
    settings_path = os.path.join(ABR_BACKEND_DIR, "config", "settings.py")
    with open(settings_path, "r", encoding="utf-8") as f:
        content = f.read()

    if '"services"' in content or "'services'" in content:
        print("  Settings: 'services' already in INSTALLED_APPS")
        return

    # Insert after notifications
    old = '    "notifications",\n]'
    new = '    "notifications",\n    "services",\n]'
    if old in content:
        if dry_run:
            print("  [DRY-RUN] Would add 'services' to INSTALLED_APPS")
        else:
            content = content.replace(old, new)
            with open(settings_path, "w", encoding="utf-8") as f:
                f.write(content)
            print("  Settings: Added 'services' to INSTALLED_APPS")
    else:
        print("  WARNING: Could not find INSTALLED_APPS insertion point")


def patch_urls(dry_run: bool = False):
    """Add services URL include to config/urls.py if not present."""
    urls_path = os.path.join(ABR_BACKEND_DIR, "config", "urls.py")
    with open(urls_path, "r", encoding="utf-8") as f:
        content = f.read()

    if "services.api.urls" in content:
        print("  URLs: services already included")
        return

    # Add after the last path line
    new_line = '    path("api/services/", include("services.api.urls")),\n'
    insert_point = '    path("api/notifications/", include("notifications.urls")),'
    if insert_point in content:
        if dry_run:
            print('  [DRY-RUN] Would add services URL include')
        else:
            content = content.replace(
                insert_point,
                insert_point + "\n" + new_line.rstrip(",\n") + ","
            )
            with open(urls_path, "w", encoding="utf-8") as f:
                f.write(content)
            print("  URLs: Added services API route")
    else:
        print("  WARNING: Could not find URL insertion point")


# ──────────────────────────────────────────────────────────────────
# MAIN
# ──────────────────────────────────────────────────────────────────

def main():
    parser = argparse.ArgumentParser(description="Generate ABR Insights Django service views")
    parser.add_argument("--dry-run", action="store_true", help="Preview without writing files")
    args = parser.parse_args()

    print(f"{'='*60}")
    print(f"ABR Insights — Service View Generator")
    print(f"{'='*60}")
    print(f"Target: {SERVICES_API_DIR}")
    print(f"Dry run: {args.dry_run}")
    print(f"Services: {len(SERVICE_SPECS)}")
    print()

    # Step 1: Create services Django app
    print("1. Setting up services/ Django app...")
    ensure_services_app(args.dry_run)
    print()

    # Step 2: Patch settings & URLs
    print("2. Patching settings & URLs...")
    patch_settings(args.dry_run)
    patch_urls(args.dry_run)
    print()

    # Step 3: Generate view files
    print("3. Generating service view files...")
    report = {
        "generated_at": datetime.now().isoformat(),
        "project": "ABR Insights",
        "target_dir": SERVICES_API_DIR,
        "dry_run": args.dry_run,
        "services": [],
        "totals": {"files": 0, "viewsets": 0, "endpoints": 0, "lines": 0},
    }

    for svc_key, spec in sorted(SERVICE_SPECS.items()):
        module_name = svc_key.replace("-", "_") + "_views"
        filename = f"{module_name}.py"
        filepath = os.path.join(SERVICES_API_DIR, filename)

        content = generate_view_file(svc_key, spec)
        line_count = content.count("\n") + 1
        endpoint_count = len(spec["actions"])

        svc_report = {
            "service": svc_key,
            "file": filename,
            "class": spec["class_name"],
            "app": spec["app"],
            "models": spec["models"],
            "endpoints": endpoint_count,
            "lines": line_count,
        }

        if args.dry_run:
            print(f"  [DRY-RUN] {filename} ({line_count} lines, {endpoint_count} endpoints)")
        else:
            with open(filepath, "w", encoding="utf-8") as f:
                f.write(content)
            print(f"  Created: {filename} ({line_count} lines, {endpoint_count} endpoints)")

        report["services"].append(svc_report)
        report["totals"]["files"] += 1
        report["totals"]["viewsets"] += 1
        report["totals"]["endpoints"] += endpoint_count
        report["totals"]["lines"] += line_count

    # Step 4: Generate urls.py
    urls_content = generate_urls_file(SERVICE_SPECS)
    urls_path = os.path.join(SERVICES_API_DIR, "urls.py")
    urls_lines = urls_content.count("\n") + 1

    if args.dry_run:
        print(f"\n  [DRY-RUN] urls.py ({urls_lines} lines)")
    else:
        with open(urls_path, "w", encoding="utf-8") as f:
            f.write(urls_content)
        print(f"\n  Created: urls.py ({urls_lines} lines)")

    # Step 5: Write report
    report_path = os.path.join(
        os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
        "data", "abr_service_view_generation_report.json"
    )
    os.makedirs(os.path.dirname(report_path), exist_ok=True)
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, indent=2)

    print(f"\n{'='*60}")
    print(f"SUMMARY")
    print(f"{'='*60}")
    print(f"  Files:     {report['totals']['files']}")
    print(f"  ViewSets:  {report['totals']['viewsets']}")
    print(f"  Endpoints: {report['totals']['endpoints']}")
    print(f"  Lines:     {report['totals']['lines']}")
    print(f"  Report:    {report_path}")
    print()

    return report


if __name__ == "__main__":
    main()
