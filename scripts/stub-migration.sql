-- Auto-generated migration to sync staging DB with Drizzle schemas
-- Generated: 2026-03-16T23:37:20.663Z

BEGIN;

-- ALTER: ab_test_assignments (+3 cols) — ab-testing-schema.ts
ALTER TABLE "ab_test_assignments" ADD COLUMN IF NOT EXISTS "variant_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "ab_test_assignments" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "ab_test_assignments" ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: ab_test_events (+5 cols) — ab-testing-schema.ts
ALTER TABLE "ab_test_events" ADD COLUMN IF NOT EXISTS "variant_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "ab_test_events" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "ab_test_events" ADD COLUMN IF NOT EXISTS "event_type" TEXT DEFAULT '';
ALTER TABLE "ab_test_events" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "ab_test_events" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: ab_test_variants (+6 cols) — ab-testing-schema.ts
ALTER TABLE "ab_test_variants" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "ab_test_variants" ADD COLUMN IF NOT EXISTS "content" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "ab_test_variants" ADD COLUMN IF NOT EXISTS "weight" NUMERIC DEFAULT 0;
ALTER TABLE "ab_test_variants" ADD COLUMN IF NOT EXISTS "impressions" INTEGER DEFAULT 0;
ALTER TABLE "ab_test_variants" ADD COLUMN IF NOT EXISTS "conversions" INTEGER DEFAULT 0;
ALTER TABLE "ab_test_variants" ADD COLUMN IF NOT EXISTS "is_control" BOOLEAN DEFAULT false;

-- ALTER: ab_tests (+8 cols) — ab-testing-schema.ts
ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "target_sample_size" INTEGER DEFAULT 0;
ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "current_sample_size" INTEGER DEFAULT 0;
ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "confidence" NUMERIC DEFAULT 0;
ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "winner_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "segment_criteria" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "ab_tests" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: accessibility_audits (+23 cols) — accessibility-schema.ts
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "audit_name" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "audit_type" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "target_url" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "target_environment" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "wcag_version" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "conformance_level" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "tools_used" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "total_issues" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "critical_issues" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "serious_issues" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "moderate_issues" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "minor_issues" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "accessibility_score" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "pages_scanned" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "elements_scanned" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "scan_duration_ms" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "report_url" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "report_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "triggered_by" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "scheduled_by" TEXT DEFAULT '';
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "accessibility_audits" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: accessibility_issues (+29 cols) — accessibility-schema.ts
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "issue_title" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "issue_description" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "severity" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "wcag_criteria" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "wcag_level" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "wcag_title" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "wcag_url" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "page_url" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "element_selector" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "element_html" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "element_xpath" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "context" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "fix_suggestion" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "code_example" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "impacted_users" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "affects_screen_readers" BOOLEAN DEFAULT false;
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "affects_keyboard_nav" BOOLEAN DEFAULT false;
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "affects_color_blindness" BOOLEAN DEFAULT false;
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "assigned_to" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "priority" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "resolved_by" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "resolution_notes" TEXT DEFAULT '';
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "first_seen_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "last_seen_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "accessibility_issues" ADD COLUMN IF NOT EXISTS "occurrence_count" INTEGER DEFAULT 0;

-- ALTER: accessibility_test_suites (+17 cols) — accessibility-schema.ts
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "suite_name" TEXT DEFAULT '';
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "suite_description" TEXT DEFAULT '';
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "suite_type" TEXT DEFAULT '';
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "url_patterns" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "exclude_patterns" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "enabled_rules" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "disabled_rules" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "custom_rules" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "is_scheduled" BOOLEAN DEFAULT false;
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "schedule_expression" TEXT DEFAULT '';
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "notify_on_failure" BOOLEAN DEFAULT false;
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "notify_emails" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "notify_slack_channel" TEXT DEFAULT '';
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "last_run_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "last_run_status" TEXT DEFAULT '';
ALTER TABLE "accessibility_test_suites" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: accessibility_user_testing (+18 cols) — accessibility-schema.ts
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "session_name" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "session_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "participant_name" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "participant_email" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "assistive_technology" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "assistive_tech_version" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "disability" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "features_tested" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "task_list" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "overall_rating" INTEGER DEFAULT 0;
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "issues_found" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "positive_findings" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "recording_url" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "transcript_url" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "follow_up_required" BOOLEAN DEFAULT false;
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "follow_up_notes" TEXT DEFAULT '';
ALTER TABLE "accessibility_user_testing" ADD COLUMN IF NOT EXISTS "conducted_by" TEXT DEFAULT '';

-- ALTER: account_mappings (+5 cols) — domains\financial\chart-of-accounts.ts
ALTER TABLE "account_mappings" ADD COLUMN IF NOT EXISTS "transaction_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "account_mappings" ADD COLUMN IF NOT EXISTS "transaction_category" VARCHAR(100) DEFAULT '';
ALTER TABLE "account_mappings" ADD COLUMN IF NOT EXISTS "debit_account_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "account_mappings" ADD COLUMN IF NOT EXISTS "credit_account_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "account_mappings" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';

-- CREATE: address_change_history (9 cols) — domains\infrastructure\addresses.ts
CREATE TABLE IF NOT EXISTS "address_change_history" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "address_id" UUID,
  "change_type" TEXT,
  "changed_by" TEXT,
  "previous_value" JSONB,
  "new_value" JSONB,
  "change_reason" TEXT,
  "change_source" TEXT,
  "created_at" TIMESTAMPTZ
);

-- CREATE: address_validation_cache (18 cols) — domains\infrastructure\addresses.ts
CREATE TABLE IF NOT EXISTS "address_validation_cache" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "input_hash" TEXT,
  "country_code" TEXT,
  "address_line_1" TEXT,
  "locality" TEXT,
  "administrative_area" TEXT,
  "postal_code" TEXT,
  "is_valid" BOOLEAN,
  "validated_by" TEXT,
  "confidence" TEXT,
  "corrected_address" JSONB,
  "latitude" TEXT,
  "longitude" TEXT,
  "metadata" JSONB,
  "expires_at" TIMESTAMPTZ,
  "hit_count" INTEGER,
  "last_hit_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ
);

-- ALTER: ai_budgets (+6 cols) — ai-chatbot-schema.ts
ALTER TABLE "ai_budgets" ADD COLUMN IF NOT EXISTS "monthly_limit_usd" NUMERIC DEFAULT 0;
ALTER TABLE "ai_budgets" ADD COLUMN IF NOT EXISTS "current_spend_usd" NUMERIC DEFAULT 0;
ALTER TABLE "ai_budgets" ADD COLUMN IF NOT EXISTS "alert_threshold" NUMERIC DEFAULT 0;
ALTER TABLE "ai_budgets" ADD COLUMN IF NOT EXISTS "hard_limit" BOOLEAN DEFAULT false;
ALTER TABLE "ai_budgets" ADD COLUMN IF NOT EXISTS "billing_period_start" DATE DEFAULT NOW();
ALTER TABLE "ai_budgets" ADD COLUMN IF NOT EXISTS "billing_period_end" DATE DEFAULT NOW();

-- CREATE: ai_clause_reasonings (24 cols) — domains\ml\ai-clause-reasoning.ts
CREATE TABLE IF NOT EXISTS "ai_clause_reasonings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "grievance_id" UUID,
  "cba_id" UUID,
  "clause_article" VARCHAR(100),
  "clause_section" VARCHAR(100),
  "clause_title" VARCHAR(500),
  "clause_snippet" TEXT,
  "relevance_score" NUMERIC,
  "reasoning" TEXT,
  "application_notes" TEXT,
  "precedent_refs" JSONB,
  "strength_assessment" VARCHAR(20),
  "confidence" NUMERIC,
  "explanation" TEXT,
  "factors_json" JSONB,
  "model_version" VARCHAR(50),
  "profile_key" VARCHAR(100),
  "audit_ref" VARCHAR(120),
  "status" TEXT,
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMPTZ,
  "human_approved" BOOLEAN,
  "created_at" TIMESTAMPTZ
);

-- CREATE: ai_copilot_sessions (23 cols) — domains\ml\ai-copilot-sessions.ts
CREATE TABLE IF NOT EXISTS "ai_copilot_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "user_id" UUID,
  "user_role" VARCHAR(50),
  "action_type" TEXT,
  "related_entity_type" VARCHAR(50),
  "related_entity_id" UUID,
  "query" TEXT,
  "response_text" TEXT,
  "structured_output" JSONB,
  "confidence" NUMERIC,
  "explanation" TEXT,
  "sources_used" JSONB,
  "model_version" VARCHAR(50),
  "profile_key" VARCHAR(100),
  "audit_ref" VARCHAR(120),
  "outcome" TEXT,
  "edited_response" TEXT,
  "feedback_rating" NUMERIC,
  "feedback_notes" TEXT,
  "human_approved" BOOLEAN,
  "created_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ
);

-- CREATE: ai_grievance_triages (21 cols) — domains\ml\ai-grievance-triage.ts
CREATE TABLE IF NOT EXISTS "ai_grievance_triages" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "grievance_id" UUID,
  "suggested_priority" VARCHAR(20),
  "suggested_category" VARCHAR(50),
  "complexity" TEXT,
  "estimated_days_to_resolve" NUMERIC,
  "suggested_step" VARCHAR(30),
  "confidence" NUMERIC,
  "explanation" TEXT,
  "factors_json" JSONB,
  "similar_grievance_ids" JSONB,
  "model_version" VARCHAR(50),
  "profile_key" VARCHAR(100),
  "audit_ref" VARCHAR(120),
  "status" TEXT,
  "reviewed_by" UUID,
  "reviewed_at" TIMESTAMPTZ,
  "review_notes" TEXT,
  "human_approved" BOOLEAN,
  "created_at" TIMESTAMPTZ
);

-- CREATE: ai_insight_reports (18 cols) — domains\ml\ai-insight-reports.ts
CREATE TABLE IF NOT EXISTS "ai_insight_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "report_type" TEXT,
  "timeframe" TEXT,
  "title" VARCHAR(500),
  "summary" TEXT,
  "insights_json" JSONB,
  "predictions_json" JSONB,
  "recommendations_json" JSONB,
  "confidence" NUMERIC,
  "explanation" TEXT,
  "data_sources_used" JSONB,
  "model_version" VARCHAR(50),
  "profile_key" VARCHAR(100),
  "audit_ref" VARCHAR(120),
  "generated_at" TIMESTAMPTZ,
  "valid_until" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ
);

-- ALTER: ai_rate_limits (+5 cols) — ai-chatbot-schema.ts
ALTER TABLE "ai_rate_limits" ADD COLUMN IF NOT EXISTS "limit_type" TEXT DEFAULT '';
ALTER TABLE "ai_rate_limits" ADD COLUMN IF NOT EXISTS "limit_value" INTEGER DEFAULT 0;
ALTER TABLE "ai_rate_limits" ADD COLUMN IF NOT EXISTS "current_value" INTEGER DEFAULT 0;
ALTER TABLE "ai_rate_limits" ADD COLUMN IF NOT EXISTS "window_start" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "ai_rate_limits" ADD COLUMN IF NOT EXISTS "window_duration" INTERVAL DEFAULT '0';

-- ALTER: ai_usage_metrics (+12 cols) — ai-chatbot-schema.ts
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT '';
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "model" TEXT DEFAULT '';
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "operation" TEXT DEFAULT '';
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "tokens_input" INTEGER DEFAULT 0;
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "tokens_output" INTEGER DEFAULT 0;
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "tokens_total" INTEGER DEFAULT 0;
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "estimated_cost" NUMERIC DEFAULT 0;
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "request_id" TEXT DEFAULT '';
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "session_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "latency_ms" INTEGER DEFAULT 0;
ALTER TABLE "ai_usage_metrics" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: alert_actions (+6 cols) — alerting-automation-schema.ts
ALTER TABLE "alert_actions" ADD COLUMN IF NOT EXISTS "action_type" TEXT DEFAULT '';
ALTER TABLE "alert_actions" ADD COLUMN IF NOT EXISTS "action_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "alert_actions" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 0;
ALTER TABLE "alert_actions" ADD COLUMN IF NOT EXISTS "execute_if_condition" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "alert_actions" ADD COLUMN IF NOT EXISTS "max_retries" INTEGER DEFAULT 0;
ALTER TABLE "alert_actions" ADD COLUMN IF NOT EXISTS "retry_delay_seconds" INTEGER DEFAULT 0;

-- ALTER: alert_conditions (+6 cols) — alerting-automation-schema.ts
ALTER TABLE "alert_conditions" ADD COLUMN IF NOT EXISTS "field_path" VARCHAR(255) DEFAULT '';
ALTER TABLE "alert_conditions" ADD COLUMN IF NOT EXISTS "operator" TEXT DEFAULT '';
ALTER TABLE "alert_conditions" ADD COLUMN IF NOT EXISTS "value" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "alert_conditions" ADD COLUMN IF NOT EXISTS "condition_group" INTEGER DEFAULT 0;
ALTER TABLE "alert_conditions" ADD COLUMN IF NOT EXISTS "is_or_condition" BOOLEAN DEFAULT false;
ALTER TABLE "alert_conditions" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 0;

-- ALTER: alert_escalations (+11 cols) — alerting-automation-schema.ts
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "alert_rule_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "escalation_levels" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "current_level" INTEGER DEFAULT 0;
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "next_escalation_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "resolved_by" TEXT DEFAULT '';
ALTER TABLE "alert_escalations" ADD COLUMN IF NOT EXISTS "resolution_notes" TEXT DEFAULT '';

-- ALTER: alert_executions (+11 cols) — alerting-automation-schema.ts
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "triggered_by" TEXT DEFAULT '';
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "trigger_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "conditions_met" BOOLEAN DEFAULT false;
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "conditions_evaluated" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "actions_executed" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "error_details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "alert_executions" ADD COLUMN IF NOT EXISTS "execution_time_ms" INTEGER DEFAULT 0;

-- ALTER: alert_recipients (+6 cols) — alerting-automation-schema.ts
ALTER TABLE "alert_recipients" ADD COLUMN IF NOT EXISTS "recipient_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "alert_recipients" ADD COLUMN IF NOT EXISTS "recipient_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "alert_recipients" ADD COLUMN IF NOT EXISTS "recipient_value" VARCHAR(255) DEFAULT '';
ALTER TABLE "alert_recipients" ADD COLUMN IF NOT EXISTS "delivery_methods" VARCHAR(50) DEFAULT '';
ALTER TABLE "alert_recipients" ADD COLUMN IF NOT EXISTS "quiet_hours_start" TIME DEFAULT '00:00:00';
ALTER TABLE "alert_recipients" ADD COLUMN IF NOT EXISTS "quiet_hours_end" TIME DEFAULT '00:00:00';

-- ALTER: alert_rules (+16 cols) — alerting-automation-schema.ts
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) DEFAULT '';
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "trigger_type" TEXT DEFAULT '';
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "trigger_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "severity" TEXT DEFAULT '';
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "frequency" TEXT DEFAULT '';
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "rate_limit_minutes" INTEGER DEFAULT 0;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "is_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT false;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "last_executed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "last_execution_status" TEXT DEFAULT '';
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "execution_count" INTEGER DEFAULT 0;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "success_count" INTEGER DEFAULT 0;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "failure_count" INTEGER DEFAULT 0;
ALTER TABLE "alert_rules" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: analytics_scheduled_reports (+19 cols) — analytics-reporting-schema.ts
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "report_name" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "report_type" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "report_description" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "report_parameters" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "schedule_type" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "cron_expression" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "next_run_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "last_run_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "recipients" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "delivery_format" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "include_attachments" BOOLEAN DEFAULT false;
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "email_subject" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "email_body" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "run_count" INTEGER DEFAULT 0;
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "last_run_status" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "last_run_error" TEXT DEFAULT '';
ALTER TABLE "analytics_scheduled_reports" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: api_access_tokens (+15 cols) — integration-schema.ts
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "token_hash" VARCHAR(255) DEFAULT '';
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "token_prefix" VARCHAR(10) DEFAULT '';
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "scopes" TEXT DEFAULT '';
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "allowed_ips" TEXT DEFAULT '';
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "rate_limit" INTEGER DEFAULT 0;
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN DEFAULT false;
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "usage_count" INTEGER DEFAULT 0;
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "revoked_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "api_access_tokens" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: api_integrations (+25 cols) — integration-schema.ts
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "integration_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(100) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "connection_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "api_endpoint" VARCHAR(500) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "api_version" VARCHAR(50) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "auth_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "credentials" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "sftp_host" VARCHAR(255) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "sftp_port" INTEGER DEFAULT 0;
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "sftp_path" VARCHAR(500) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "file_format" VARCHAR(50) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "field_mapping" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "sync_direction" VARCHAR(50) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "sync_frequency" VARCHAR(50) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "sync_schedule" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN DEFAULT false;
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "connection_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "last_sync_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "records_synced_total" INTEGER DEFAULT 0;
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "last_sync_record_count" INTEGER DEFAULT 0;
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "error_count" INTEGER DEFAULT 0;
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "api_integrations" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: arms_length_verification (+16 cols) — domains\governance\conflicts.ts
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "transaction_amount" NUMERIC DEFAULT 0;
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "from_party" UUID DEFAULT gen_random_uuid();
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "to_party" UUID DEFAULT gen_random_uuid();
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "relationship_exists" BOOLEAN DEFAULT false;
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "relationship_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "relationship_description" TEXT DEFAULT '';
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "arms_length_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "arms_length_justification" TEXT DEFAULT '';
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "verification_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "comparable_transactions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "reviewed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "review_decision" VARCHAR(20) DEFAULT '';
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "review_notes" TEXT DEFAULT '';
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "compliant" BOOLEAN DEFAULT false;
ALTER TABLE "arms_length_verification" ADD COLUMN IF NOT EXISTS "compliance_notes" TEXT DEFAULT '';

-- ALTER: audit_logs (+10 cols) — audit-security-schema.ts
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "old_values" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "new_values" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "session_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "severity" VARCHAR(20) DEFAULT '';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "outcome" VARCHAR(20) DEFAULT '';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN DEFAULT false;
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "audit_logs" ADD COLUMN IF NOT EXISTS "archived_path" TEXT DEFAULT '';

-- ALTER: automation_execution_log (+10 cols) — automation-rules-schema.ts
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "trigger_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "target_entity_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "target_entity_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "error_details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "actions_executed" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "automation_execution_log" ADD COLUMN IF NOT EXISTS "duration_ms" INTEGER DEFAULT 0;

-- ALTER: automation_rules (+17 cols) — automation-rules-schema.ts
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "priority" INTEGER DEFAULT 0;
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "target_entity" VARCHAR(50) DEFAULT '';
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "target_filter" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "trigger_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "trigger_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "conditions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "actions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "max_executions" INTEGER DEFAULT 0;
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "executions_count" INTEGER DEFAULT 0;
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "last_executed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "active_from" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "active_until" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT '';
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "organization_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "automation_rules" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: automation_schedules (+4 cols) — automation-rules-schema.ts
ALTER TABLE "automation_schedules" ADD COLUMN IF NOT EXISTS "schedule_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "automation_schedules" ADD COLUMN IF NOT EXISTS "next_run_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "automation_schedules" ADD COLUMN IF NOT EXISTS "last_run_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "automation_schedules" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';

-- ALTER: autopay_settings (+19 cols) — autopay-settings-schema.ts
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN DEFAULT false;
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "stripe_payment_method_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "payment_method_last4" VARCHAR(4) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "payment_method_brand" VARCHAR(50) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "payment_method_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "max_amount" NUMERIC DEFAULT 0;
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "frequency" VARCHAR(50) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "day_of_month" VARCHAR(2) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "last_payment_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "last_payment_amount" NUMERIC DEFAULT 0;
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "last_payment_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "next_payment_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "failure_count" VARCHAR(255) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "last_failure_reason" TEXT DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "notify_before_payment" BOOLEAN DEFAULT false;
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "notify_days_before" VARCHAR(255) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "autopay_settings" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: award_history (+15 cols) — award-templates-schema.ts
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "recipient_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "recipient_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "points_awarded" INTEGER DEFAULT 0;
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "monetary_value" INTEGER DEFAULT 0;
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "badge_awarded" BOOLEAN DEFAULT false;
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "giver_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "giver_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "reason" TEXT DEFAULT '';
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "visibility" VARCHAR(20) DEFAULT '';
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "redeemed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "redemption_notes" TEXT DEFAULT '';
ALTER TABLE "award_history" ADD COLUMN IF NOT EXISTS "awarded_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: award_templates (+23 cols) — award-templates-schema.ts
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "message" TEXT DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "type" VARCHAR(50) DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "points_value" INTEGER DEFAULT 0;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "monetary_value" INTEGER DEFAULT 0;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "badge_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "badge_icon" VARCHAR(500) DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "badge_color" VARCHAR(20) DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "use_count" INTEGER DEFAULT 0;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "max_uses" INTEGER DEFAULT 0;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "per_user_limit" INTEGER DEFAULT 0;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "valid_until" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "organization_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "requires_approval" BOOLEAN DEFAULT false;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "approver_roles" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "total_awarded" INTEGER DEFAULT 0;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "total_value_awarded" INTEGER DEFAULT 0;
ALTER TABLE "award_templates" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: band_council_consent (+13 cols) — domains\compliance\indigenous-data.ts
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "consent_given" BOOLEAN DEFAULT false;
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "bcr_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "bcr_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "bcr_document" TEXT DEFAULT '';
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "purpose_of_collection" TEXT DEFAULT '';
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "data_categories" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "intended_use" TEXT DEFAULT '';
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "restricted_to_members" BOOLEAN DEFAULT false;
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "anonymization_required" BOOLEAN DEFAULT false;
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "revocation_reason" TEXT DEFAULT '';
ALTER TABLE "band_council_consent" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';

-- ALTER: band_councils (+11 cols) — domains\compliance\indigenous-data.ts
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "province" VARCHAR(2) DEFAULT '';
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "region" VARCHAR(50) DEFAULT '';
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "chief_name" TEXT DEFAULT '';
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "admin_contact_name" TEXT DEFAULT '';
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "admin_contact_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "admin_contact_phone" VARCHAR(20) DEFAULT '';
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "on_reserve_storage_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "storage_location" TEXT DEFAULT '';
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "data_residency_required" BOOLEAN DEFAULT false;
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "third_party_access_allowed" BOOLEAN DEFAULT false;
ALTER TABLE "band_councils" ADD COLUMN IF NOT EXISTS "aggregation_allowed" BOOLEAN DEFAULT false;

-- ALTER: bank_of_canada_rates (+7 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "bank_of_canada_rates" ADD COLUMN IF NOT EXISTS "noon_rate" NUMERIC DEFAULT 0;
ALTER TABLE "bank_of_canada_rates" ADD COLUMN IF NOT EXISTS "buy_rate" NUMERIC DEFAULT 0;
ALTER TABLE "bank_of_canada_rates" ADD COLUMN IF NOT EXISTS "sell_rate" NUMERIC DEFAULT 0;
ALTER TABLE "bank_of_canada_rates" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50) DEFAULT '';
ALTER TABLE "bank_of_canada_rates" ADD COLUMN IF NOT EXISTS "data_quality" VARCHAR(20) DEFAULT '';
ALTER TABLE "bank_of_canada_rates" ADD COLUMN IF NOT EXISTS "imported_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "bank_of_canada_rates" ADD COLUMN IF NOT EXISTS "imported_by" VARCHAR(255) DEFAULT '';

-- ALTER: bank_reconciliation (+13 cols) — domains\finance\payments.ts
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "bank_statement_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "bank_deposit_id" VARCHAR DEFAULT '';
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "deposit_amount" NUMERIC DEFAULT 0;
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "deposit_currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "reconciled_amount" NUMERIC DEFAULT 0;
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "unmatched_amount" NUMERIC DEFAULT 0;
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "matched_payment_ids" UUID DEFAULT gen_random_uuid();
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "unmatched_payment_ids" UUID DEFAULT gen_random_uuid();
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "reconciliation_notes" TEXT DEFAULT '';
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "reconciled_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "bank_reconciliation" ADD COLUMN IF NOT EXISTS "reconciled_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: bargaining_team_members (+2 cols) — bargaining-negotiations-schema.ts
ALTER TABLE "bargaining_team_members" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "bargaining_team_members" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: bargaining_units (+23 cols) — union-structure-schema.ts
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "employer_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "worksite_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "unit_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "unit_type" TEXT DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "certification_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "certification_date" DATE DEFAULT NOW();
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "certification_body" VARCHAR(100) DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "certification_expiry_date" DATE DEFAULT NOW();
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "current_collective_agreement_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "contract_expiry_date" DATE DEFAULT NOW();
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "next_bargaining_date" DATE DEFAULT NOW();
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "member_count" INTEGER DEFAULT 0;
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "classifications" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "chief_steward_id" TEXT DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "bargaining_chair_id" TEXT DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';
ALTER TABLE "bargaining_units" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: benchmark_data (+18 cols) — analytics-reporting-schema.ts
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "union_type" TEXT DEFAULT '';
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "union_size_bracket" TEXT DEFAULT '';
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "region" TEXT DEFAULT '';
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "period_start" DATE DEFAULT NOW();
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "period_end" DATE DEFAULT NOW();
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "period_type" TEXT DEFAULT '';
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "metric_value" NUMERIC DEFAULT 0;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "sample_size" INTEGER DEFAULT 0;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "min_value" NUMERIC DEFAULT 0;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "max_value" NUMERIC DEFAULT 0;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "percentile_25" NUMERIC DEFAULT 0;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "percentile_50" NUMERIC DEFAULT 0;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "percentile_75" NUMERIC DEFAULT 0;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "standard_deviation" NUMERIC DEFAULT 0;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "data_quality_score" INTEGER DEFAULT 0;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "is_projected" BOOLEAN DEFAULT false;
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "confidence_level" TEXT DEFAULT '';
ALTER TABLE "benchmark_data" ADD COLUMN IF NOT EXISTS "data_source" TEXT DEFAULT '';

-- ALTER: blind_trust_registry (+19 cols) — domains\governance\conflicts.ts
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "full_name" TEXT DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "trust_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "trust_established_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "trustee_name" TEXT DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "trustee_contact" TEXT DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "trustee_relationship" VARCHAR(50) DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "trust_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "trust_document" TEXT DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "trust_account_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "assets_transferred" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "estimated_value" NUMERIC DEFAULT 0;
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "verification_notes" TEXT DEFAULT '';
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "last_review_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "next_review_due" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "compliant" BOOLEAN DEFAULT false;
ALTER TABLE "blind_trust_registry" ADD COLUMN IF NOT EXISTS "compliance_notes" TEXT DEFAULT '';

-- ALTER: board_packet_distributions (+13 cols) — board-packet-schema.ts
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "recipient_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "recipient_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "recipient_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "recipient_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "delivery_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "opened" BOOLEAN DEFAULT false;
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "opened_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "downloaded" BOOLEAN DEFAULT false;
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "downloaded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "acknowledged" BOOLEAN DEFAULT false;
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "acknowledged_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "board_packet_distributions" ADD COLUMN IF NOT EXISTS "acknowledgment_signature" TEXT DEFAULT '';

-- ALTER: board_packet_sections (+10 cols) — board-packet-schema.ts
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "section_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255) DEFAULT '';
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 0;
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "content" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "summary" TEXT DEFAULT '';
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "data_source" VARCHAR(100) DEFAULT '';
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "data_query" TEXT DEFAULT '';
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "is_confidential" BOOLEAN DEFAULT false;
ALTER TABLE "board_packet_sections" ADD COLUMN IF NOT EXISTS "required_role" VARCHAR(50) DEFAULT '';

-- ALTER: board_packet_templates (+9 cols) — board-packet-schema.ts
ALTER TABLE "board_packet_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "board_packet_templates" ADD COLUMN IF NOT EXISTS "packet_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "board_packet_templates" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "board_packet_templates" ADD COLUMN IF NOT EXISTS "sections" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packet_templates" ADD COLUMN IF NOT EXISTS "default_recipients" TEXT DEFAULT '';
ALTER TABLE "board_packet_templates" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "board_packet_templates" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
ALTER TABLE "board_packet_templates" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "board_packet_templates" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: board_packets (+27 cols) — board-packet-schema.ts
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "packet_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "period_start" DATE DEFAULT NOW();
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "period_end" DATE DEFAULT NOW();
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "fiscal_year" INTEGER DEFAULT 0;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "fiscal_quarter" INTEGER DEFAULT 0;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "generated_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "finalized_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "distributed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "financial_summary" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "membership_stats" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "case_summary" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "motions_and_votes" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "audit_exceptions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "compliance_status" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "action_items" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "recipient_roles" TEXT DEFAULT '';
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "distribution_list" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT DEFAULT '';
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "attachments" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "content_hash" VARCHAR(255) DEFAULT '';
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "signed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "board_packets" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: break_glass_activations (+18 cols) — domains\compliance\force-majeure.ts
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "signature_1_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "signature_1_timestamp" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "signature_1_ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "signature_2_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "signature_2_timestamp" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "signature_2_ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "signature_3_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "signature_3_timestamp" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "signature_3_ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "recovery_actions_log" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "swiss_cold_storage_accessed" BOOLEAN DEFAULT false;
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "cold_storage_accessed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "incident_report_url" TEXT DEFAULT '';
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "lessons_learned_url" TEXT DEFAULT '';
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "system_updates_required" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "audited_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "audited_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_activations" ADD COLUMN IF NOT EXISTS "audit_report" TEXT DEFAULT '';

-- ALTER: break_glass_system (+20 cols) — domains\compliance\force-majeure.ts
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "scenario_description" TEXT DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "recovery_plan_document" TEXT DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "estimated_recovery_time" VARCHAR(50) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "shamir_threshold" INTEGER DEFAULT 0;
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "shamir_total_shares" INTEGER DEFAULT 0;
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "key_holder_id_1" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "key_holder_id_2" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "key_holder_id_3" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "key_holder_id_4" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "key_holder_id_5" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "emergency_contact_1_name" TEXT DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "emergency_contact_1_phone" VARCHAR(20) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "emergency_contact_1_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "emergency_contact_2_name" TEXT DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "emergency_contact_2_phone" VARCHAR(20) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "emergency_contact_2_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "last_tested_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "testing_frequency" VARCHAR(50) DEFAULT '';
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "next_test_due" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "break_glass_system" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';

-- ALTER: budget_pool (+9 cols) — award-templates-schema.ts
ALTER TABLE "budget_pool" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "budget_pool" ADD COLUMN IF NOT EXISTS "organization_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "budget_pool" ADD COLUMN IF NOT EXISTS "total_budget" INTEGER DEFAULT 0;
ALTER TABLE "budget_pool" ADD COLUMN IF NOT EXISTS "allocated_budget" INTEGER DEFAULT 0;
ALTER TABLE "budget_pool" ADD COLUMN IF NOT EXISTS "spent_budget" INTEGER DEFAULT 0;
ALTER TABLE "budget_pool" ADD COLUMN IF NOT EXISTS "fiscal_year" INTEGER DEFAULT 0;
ALTER TABLE "budget_pool" ADD COLUMN IF NOT EXISTS "quarter" INTEGER DEFAULT 0;
ALTER TABLE "budget_pool" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "budget_pool" ADD COLUMN IF NOT EXISTS "manager_id" VARCHAR(255) DEFAULT '';

-- ALTER: budget_reservations (+3 cols) — award-templates-schema.ts
ALTER TABLE "budget_reservations" ADD COLUMN IF NOT EXISTS "reference_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "budget_reservations" ADD COLUMN IF NOT EXISTS "reference_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "budget_reservations" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: calendar_events (+37 cols) — calendar-schema.ts
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "location" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "location_url" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "start_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "end_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(100) DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "is_all_day" BOOLEAN DEFAULT false;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "is_recurring" BOOLEAN DEFAULT false;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "recurrence_rule" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "recurrence_exceptions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "parent_event_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "event_type" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "claim_id" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "case_number" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "member_id" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "meeting_room_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "meeting_url" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "meeting_password" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "agenda" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "organizer_id" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "reminders" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "external_event_id" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "external_provider" VARCHAR(50) DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "external_html_link" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "is_private" BOOLEAN DEFAULT false;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "visibility" VARCHAR(20) DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "attachments" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "cancelled_by" TEXT DEFAULT '';
ALTER TABLE "calendar_events" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT DEFAULT '';

-- ALTER: calendar_sharing (+13 cols) — calendar-schema.ts
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "shared_with_user_id" TEXT DEFAULT '';
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "shared_with_email" TEXT DEFAULT '';
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "shared_with_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "permission" TEXT DEFAULT '';
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "can_create_events" BOOLEAN DEFAULT false;
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "can_edit_events" BOOLEAN DEFAULT false;
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "can_delete_events" BOOLEAN DEFAULT false;
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "can_share" BOOLEAN DEFAULT false;
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "invited_by" TEXT DEFAULT '';
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "invited_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "calendar_sharing" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;

-- ALTER: calendars (+21 cols) — calendar-schema.ts
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "color" VARCHAR(7) DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "icon" VARCHAR(50) DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "owner_id" TEXT DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "is_personal" BOOLEAN DEFAULT false;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "is_shared" BOOLEAN DEFAULT false;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN DEFAULT false;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "external_provider" VARCHAR(50) DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "external_calendar_id" TEXT DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "sync_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "sync_status" TEXT DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "sync_token" TEXT DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(100) DEFAULT '';
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "default_event_duration" INTEGER DEFAULT 0;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "reminder_default_minutes" INTEGER DEFAULT 0;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "allow_overlap" BOOLEAN DEFAULT false;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "require_approval" BOOLEAN DEFAULT false;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "calendars" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;

-- ALTER: campaigns (+23 cols) — domains\communications\campaigns.ts
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "channel" TEXT DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "segment_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "segment_query" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "audience_count" INTEGER DEFAULT 0;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "subject" VARCHAR(500) DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "body" TEXT DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "variables" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "send_immediately" BOOLEAN DEFAULT false;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "stats" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "settings" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "campaigns" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: card_signing_events (+20 cols) — domains\infrastructure\organizing.ts
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "contact_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "signed_date" DATE DEFAULT NOW();
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "signed_time" TIME DEFAULT '00:00:00';
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "signing_location" VARCHAR(255) DEFAULT '';
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "witnessed_by" TEXT DEFAULT '';
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "witness_signature_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "card_photo_url" TEXT DEFAULT '';
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "card_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "card_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "invalidation_reason" TEXT DEFAULT '';
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "voluntary_signature" BOOLEAN DEFAULT false;
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "signature_obtained_properly" BOOLEAN DEFAULT false;
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "date_accurate" BOOLEAN DEFAULT false;
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "meets_legal_requirements" BOOLEAN DEFAULT false;
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "submitted_to_nlrb_clrb" BOOLEAN DEFAULT false;
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "submission_date" DATE DEFAULT NOW();
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "submission_batch_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "card_signing_events" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: case_studies (+11 cols) — domains\marketing.ts
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "organization_type" TEXT DEFAULT '';
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "summary" TEXT DEFAULT '';
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "challenge" TEXT DEFAULT '';
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "solution" TEXT DEFAULT '';
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "outcome" TEXT DEFAULT '';
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "metrics" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "testimonial" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "visibility" TEXT DEFAULT '';
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN DEFAULT false;
ALTER TABLE "case_studies" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: certification_alerts (+11 cols) — certification-management-schema.ts
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "alert_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "alert_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "expiry_date" DATE DEFAULT NOW();
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "days_until_expiry" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "notification_sent" BOOLEAN DEFAULT false;
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "notification_sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "notification_method" VARCHAR(20) DEFAULT '';
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "resolved" BOOLEAN DEFAULT false;
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "resolved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "certification_alerts" ADD COLUMN IF NOT EXISTS "resolution_notes" TEXT DEFAULT '';

-- ALTER: certification_audit_log (+8 cols) — certification-management-schema.ts
ALTER TABLE "certification_audit_log" ADD COLUMN IF NOT EXISTS "action_description" TEXT DEFAULT '';
ALTER TABLE "certification_audit_log" ADD COLUMN IF NOT EXISTS "certification_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "certification_audit_log" ADD COLUMN IF NOT EXISTS "user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "certification_audit_log" ADD COLUMN IF NOT EXISTS "performed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "certification_audit_log" ADD COLUMN IF NOT EXISTS "performed_by_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "certification_audit_log" ADD COLUMN IF NOT EXISTS "compliance_impact" VARCHAR(20) DEFAULT '';
ALTER TABLE "certification_audit_log" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "certification_audit_log" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';

-- ALTER: certification_compliance_reports (+13 cols) — certification-management-schema.ts
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "total_staff" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "total_certifications_required" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "total_certifications_current" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "total_certifications_expired" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "total_certifications_pending_renewal" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "total_ce_hours_required" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "total_ce_hours_completed" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "compliance_rate" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "expired_certifications" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "upcoming_renewals" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "generated_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "report_format" VARCHAR(20) DEFAULT '';
ALTER TABLE "certification_compliance_reports" ADD COLUMN IF NOT EXISTS "report_url" TEXT DEFAULT '';

-- ALTER: certification_types (+9 cols) — certification-management-schema.ts
ALTER TABLE "certification_types" ADD COLUMN IF NOT EXISTS "issuing_authority" TEXT DEFAULT '';
ALTER TABLE "certification_types" ADD COLUMN IF NOT EXISTS "requires_renewal" BOOLEAN DEFAULT false;
ALTER TABLE "certification_types" ADD COLUMN IF NOT EXISTS "renewal_frequency_months" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_types" ADD COLUMN IF NOT EXISTS "continuing_education_required" BOOLEAN DEFAULT false;
ALTER TABLE "certification_types" ADD COLUMN IF NOT EXISTS "ce_hours_required" VARCHAR(10) DEFAULT '';
ALTER TABLE "certification_types" ADD COLUMN IF NOT EXISTS "required_for_roles" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "certification_types" ADD COLUMN IF NOT EXISTS "mandatory" BOOLEAN DEFAULT false;
ALTER TABLE "certification_types" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "certification_types" ADD COLUMN IF NOT EXISTS "application_url" TEXT DEFAULT '';

-- ALTER: chart_of_accounts (+20 cols) — domains\finance\accounting.ts
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT '';
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "sub_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "normal_balance" VARCHAR(10) DEFAULT '';
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "is_sub_account" BOOLEAN DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "allow_transactions" BOOLEAN DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "require_cost_center" BOOLEAN DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "require_department" BOOLEAN DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "require_approval" BOOLEAN DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "require_invoice" BOOLEAN DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "is_reconciled_daily" BOOLEAN DEFAULT false;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "last_reconciled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "last_reconciled_balance" NUMERIC DEFAULT 0;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "gl_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "sap_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "quickbooks_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "opening_balance" NUMERIC DEFAULT 0;
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "opening_balance_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "chart_of_accounts" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: chat_messages (+11 cols) — ai-chatbot-schema.ts
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT '';
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "model_used" TEXT DEFAULT '';
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "tokens_used" INTEGER DEFAULT 0;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "response_time_ms" INTEGER DEFAULT 0;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "retrieved_documents" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "citations" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "function_calls" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "helpful" BOOLEAN DEFAULT false;
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "feedback_reason" TEXT DEFAULT '';
ALTER TABLE "chat_messages" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: chat_sessions (+13 cols) — ai-chatbot-schema.ts
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "ai_provider" TEXT DEFAULT '';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "model" TEXT DEFAULT '';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "temperature" TEXT DEFAULT '';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "context_tags" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "related_entity_type" TEXT DEFAULT '';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "related_entity_id" TEXT DEFAULT '';
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "message_count" INTEGER DEFAULT 0;
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "last_message_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "helpful" BOOLEAN DEFAULT false;
ALTER TABLE "chat_sessions" ADD COLUMN IF NOT EXISTS "feedback_comment" TEXT DEFAULT '';

-- ALTER: chatbot_analytics (+15 cols) — ai-chatbot-schema.ts
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "period_end" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "total_sessions" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "total_messages" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "unique_users" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "avg_response_time_ms" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "avg_tokens_per_message" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "avg_messages_per_session" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "helpful_responses" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "unhelpful_responses" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "satisfaction_rate" TEXT DEFAULT '';
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "total_tokens_used" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "estimated_cost_usd" TEXT DEFAULT '';
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "top_categories" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "chatbot_analytics" ADD COLUMN IF NOT EXISTS "top_questions" JSONB DEFAULT '{}'::jsonb;

-- ALTER: chatbot_suggestions (+10 cols) — ai-chatbot-schema.ts
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "prompt" TEXT DEFAULT '';
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "icon" TEXT DEFAULT '';
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "display_order" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "show_in_contexts" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "required_tags" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "use_count" INTEGER DEFAULT 0;
ALTER TABLE "chatbot_suggestions" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;

-- ALTER: clc_api_config (+14 cols) — clc-sync-schema.ts
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "api_url" VARCHAR(500) DEFAULT '';
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "api_key_encrypted" VARCHAR DEFAULT '';
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "api_secret" VARCHAR DEFAULT '';
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "is_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "sync_frequency" VARCHAR(50) DEFAULT '';
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "last_sync_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "next_sync_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "webhook_url_local" VARCHAR(500) DEFAULT '';
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "webhook_secret_encrypted" VARCHAR DEFAULT '';
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "is_webhook_verified" BOOLEAN DEFAULT false;
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "sync_members_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "sync_remittances_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "sync_disputes_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "clc_api_config" ADD COLUMN IF NOT EXISTS "configured_by" VARCHAR(255) DEFAULT '';

-- ALTER: clc_bargaining_trends (+7 cols) — clc-partnership-schema.ts
ALTER TABLE "clc_bargaining_trends" ADD COLUMN IF NOT EXISTS "settled_agreements" INTEGER DEFAULT 0;
ALTER TABLE "clc_bargaining_trends" ADD COLUMN IF NOT EXISTS "unsettled_agreements" INTEGER DEFAULT 0;
ALTER TABLE "clc_bargaining_trends" ADD COLUMN IF NOT EXISTS "average_wage_increase" NUMERIC DEFAULT 0;
ALTER TABLE "clc_bargaining_trends" ADD COLUMN IF NOT EXISTS "range_low" NUMERIC DEFAULT 0;
ALTER TABLE "clc_bargaining_trends" ADD COLUMN IF NOT EXISTS "range_high" NUMERIC DEFAULT 0;
ALTER TABLE "clc_bargaining_trends" ADD COLUMN IF NOT EXISTS "sync_id" VARCHAR(100) DEFAULT '';
ALTER TABLE "clc_bargaining_trends" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50) DEFAULT '';

-- ALTER: clc_chart_of_accounts (+3 cols) — clc-per-capita-schema.ts
ALTER TABLE "clc_chart_of_accounts" ADD COLUMN IF NOT EXISTS "parent_account_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "clc_chart_of_accounts" ADD COLUMN IF NOT EXISTS "financial_statement_line" VARCHAR(100) DEFAULT '';
ALTER TABLE "clc_chart_of_accounts" ADD COLUMN IF NOT EXISTS "statistics_canada_code" VARCHAR(50) DEFAULT '';

-- ALTER: clc_oauth_tokens (+4 cols) — clc-partnership-schema.ts
ALTER TABLE "clc_oauth_tokens" ADD COLUMN IF NOT EXISTS "scopes" TEXT DEFAULT '';
ALTER TABLE "clc_oauth_tokens" ADD COLUMN IF NOT EXISTS "refresh_expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "clc_oauth_tokens" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "clc_oauth_tokens" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: clc_per_capita_benchmarks (+6 cols) — clc-partnership-schema.ts
ALTER TABLE "clc_per_capita_benchmarks" ADD COLUMN IF NOT EXISTS "total_members" INTEGER DEFAULT 0;
ALTER TABLE "clc_per_capita_benchmarks" ADD COLUMN IF NOT EXISTS "dues_paying_members" INTEGER DEFAULT 0;
ALTER TABLE "clc_per_capita_benchmarks" ADD COLUMN IF NOT EXISTS "active_members" INTEGER DEFAULT 0;
ALTER TABLE "clc_per_capita_benchmarks" ADD COLUMN IF NOT EXISTS "national_average_rate" NUMERIC DEFAULT 0;
ALTER TABLE "clc_per_capita_benchmarks" ADD COLUMN IF NOT EXISTS "provincial_average_rate" NUMERIC DEFAULT 0;
ALTER TABLE "clc_per_capita_benchmarks" ADD COLUMN IF NOT EXISTS "size_category_comparison" VARCHAR(50) DEFAULT '';

-- ALTER: clc_remittance_mapping (+9 cols) — clc-sync-schema.ts
ALTER TABLE "clc_remittance_mapping" ADD COLUMN IF NOT EXISTS "local_remittance_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "clc_remittance_mapping" ADD COLUMN IF NOT EXISTS "external_remittance_id" VARCHAR(100) DEFAULT '';
ALTER TABLE "clc_remittance_mapping" ADD COLUMN IF NOT EXISTS "local_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "clc_remittance_mapping" ADD COLUMN IF NOT EXISTS "external_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "clc_remittance_mapping" ADD COLUMN IF NOT EXISTS "reconciliation_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "clc_remittance_mapping" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN DEFAULT false;
ALTER TABLE "clc_remittance_mapping" ADD COLUMN IF NOT EXISTS "verification_notes" TEXT DEFAULT '';
ALTER TABLE "clc_remittance_mapping" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "clc_remittance_mapping" ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(255) DEFAULT '';

-- ALTER: clc_sync_log (+8 cols) — clc-sync-schema.ts
ALTER TABLE "clc_sync_log" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "clc_sync_log" ADD COLUMN IF NOT EXISTS "sync_start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "clc_sync_log" ADD COLUMN IF NOT EXISTS "sync_end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "clc_sync_log" ADD COLUMN IF NOT EXISTS "sync_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "clc_sync_log" ADD COLUMN IF NOT EXISTS "verification_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "clc_sync_log" ADD COLUMN IF NOT EXISTS "verification_notes" TEXT DEFAULT '';
ALTER TABLE "clc_sync_log" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN DEFAULT false;
ALTER TABLE "clc_sync_log" ADD COLUMN IF NOT EXISTS "initiated_by" VARCHAR(255) DEFAULT '';

-- ALTER: clc_union_density (+2 cols) — clc-partnership-schema.ts
ALTER TABLE "clc_union_density" ADD COLUMN IF NOT EXISTS "sync_id" VARCHAR(100) DEFAULT '';
ALTER TABLE "clc_union_density" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50) DEFAULT '';

-- ALTER: clc_webhook_log (+6 cols) — clc-sync-schema.ts
ALTER TABLE "clc_webhook_log" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "clc_webhook_log" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "clc_webhook_log" ADD COLUMN IF NOT EXISTS "processing_error" TEXT DEFAULT '';
ALTER TABLE "clc_webhook_log" ADD COLUMN IF NOT EXISTS "review_notes" TEXT DEFAULT '';
ALTER TABLE "clc_webhook_log" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "clc_webhook_log" ADD COLUMN IF NOT EXISTS "reviewed_by" VARCHAR(255) DEFAULT '';

-- ALTER: cms_blocks (+8 cols) — cms-website-schema.ts
ALTER TABLE "cms_blocks" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "cms_blocks" ADD COLUMN IF NOT EXISTS "block_type" TEXT DEFAULT '';
ALTER TABLE "cms_blocks" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "cms_blocks" ADD COLUMN IF NOT EXISTS "content" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "cms_blocks" ADD COLUMN IF NOT EXISTS "styles" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "cms_blocks" ADD COLUMN IF NOT EXISTS "is_reusable" BOOLEAN DEFAULT false;
ALTER TABLE "cms_blocks" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT DEFAULT '';
ALTER TABLE "cms_blocks" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: cms_media_library (+12 cols) — cms-website-schema.ts
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "file_name" TEXT DEFAULT '';
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "file_url" TEXT DEFAULT '';
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "file_type" TEXT DEFAULT '';
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "mime_type" TEXT DEFAULT '';
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "file_size" INTEGER DEFAULT 0;
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "width" INTEGER DEFAULT 0;
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "height" INTEGER DEFAULT 0;
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "alt_text" TEXT DEFAULT '';
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "caption" TEXT DEFAULT '';
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "folder" TEXT DEFAULT '';
ALTER TABLE "cms_media_library" ADD COLUMN IF NOT EXISTS "uploaded_by" TEXT DEFAULT '';

-- ALTER: cms_navigation_menus (+4 cols) — cms-website-schema.ts
ALTER TABLE "cms_navigation_menus" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "cms_navigation_menus" ADD COLUMN IF NOT EXISTS "location" TEXT DEFAULT '';
ALTER TABLE "cms_navigation_menus" ADD COLUMN IF NOT EXISTS "items" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "cms_navigation_menus" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;

-- ALTER: cms_pages (+11 cols) — cms-website-schema.ts
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "meta_keywords" TEXT DEFAULT '';
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "og_image" TEXT DEFAULT '';
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "parent_page_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "scheduled_for" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "is_homepage" BOOLEAN DEFAULT false;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "requires_auth" BOOLEAN DEFAULT false;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "allowed_roles" TEXT DEFAULT '';
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "seo_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "cms_pages" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- ALTER: cms_templates (+9 cols) — cms-website-schema.ts
ALTER TABLE "cms_templates" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "cms_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "cms_templates" ADD COLUMN IF NOT EXISTS "template_type" TEXT DEFAULT '';
ALTER TABLE "cms_templates" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "cms_templates" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT DEFAULT '';
ALTER TABLE "cms_templates" ADD COLUMN IF NOT EXISTS "layout_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "cms_templates" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN DEFAULT false;
ALTER TABLE "cms_templates" ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN DEFAULT false;
ALTER TABLE "cms_templates" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: committee_memberships (+15 cols) — union-structure-schema.ts
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "member_id" TEXT DEFAULT '';
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT '';
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "start_date" DATE DEFAULT NOW();
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "end_date" DATE DEFAULT NOW();
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "term_number" INTEGER DEFAULT 0;
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "appointment_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "appointed_by" TEXT DEFAULT '';
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "election_date" DATE DEFAULT NOW();
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "votes_received" INTEGER DEFAULT 0;
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "meetings_attended" INTEGER DEFAULT 0;
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "meetings_total" INTEGER DEFAULT 0;
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "committee_memberships" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- ALTER: committees (+25 cols) — union-structure-schema.ts
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "committee_type" TEXT DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "unit_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "worksite_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "is_organization_wide" BOOLEAN DEFAULT false;
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "mandate" TEXT DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "meeting_frequency" VARCHAR(100) DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "meeting_day" VARCHAR(50) DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "meeting_time" VARCHAR(50) DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "meeting_location" TEXT DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "max_members" INTEGER DEFAULT 0;
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "current_member_count" INTEGER DEFAULT 0;
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "requires_appointment" BOOLEAN DEFAULT false;
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "requires_election" BOOLEAN DEFAULT false;
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "term_length" INTEGER DEFAULT 0;
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "chair_id" TEXT DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "secretary_id" TEXT DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "contact_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';
ALTER TABLE "committees" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: communication_analytics (+15 cols) — communication-analytics-schema.ts
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "date" DATE DEFAULT NOW();
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "channel" TEXT DEFAULT '';
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "messages_sent" INTEGER DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "messages_delivered" INTEGER DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "messages_failed" INTEGER DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "messages_opened" INTEGER DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "messages_clicked" INTEGER DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "unique_recipients" INTEGER DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "opt_outs" INTEGER DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "bounces" INTEGER DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "complaints" INTEGER DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "engagement_rate" NUMERIC DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "delivery_rate" NUMERIC DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "open_rate" NUMERIC DEFAULT 0;
ALTER TABLE "communication_analytics" ADD COLUMN IF NOT EXISTS "click_rate" NUMERIC DEFAULT 0;

-- ALTER: communication_channels (+12 cols) — domains\communications\campaigns.ts
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT '';
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(50) DEFAULT '';
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN DEFAULT false;
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "daily_limit" INTEGER DEFAULT 0;
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "monthly_limit" INTEGER DEFAULT 0;
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "current_daily_count" INTEGER DEFAULT 0;
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "current_monthly_count" INTEGER DEFAULT 0;
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "last_health_check" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "health_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "communication_channels" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: communication_preferences (+14 cols) — communication-analytics-schema.ts
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "email_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "sms_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "push_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "newsletter_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "marketing_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "grievance_updates" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "training_reminders" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "deadline_alerts" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "strike_fund_updates" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "dues_reminders" BOOLEAN DEFAULT false;
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_start" TIME DEFAULT '00:00:00';
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_end" TIME DEFAULT '00:00:00';
ALTER TABLE "communication_preferences" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT '';

-- CREATE: communication_templates (12 cols) — domains\communications\employer-communications.ts
CREATE TABLE IF NOT EXISTS "communication_templates" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "name" VARCHAR(255),
  "category" TEXT,
  "subject" VARCHAR(500),
  "body" TEXT,
  "variables" JSONB,
  "is_default" BOOLEAN,
  "is_active" BOOLEAN,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ,
  "created_by" UUID
);

-- ALTER: comparative_analyses (+14 cols) — analytics.ts
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "analysis_name" TEXT DEFAULT '';
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "comparison_type" TEXT DEFAULT '';
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "organization_ids" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "metrics" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "time_range" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "results" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "benchmarks" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "organization_ranking" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "gaps" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "strengths" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "recommendations" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "visualization_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN DEFAULT false;
ALTER TABLE "comparative_analyses" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- CREATE: compliance_alerts (8 cols) — domains\compliance\employer-compliance.ts
CREATE TABLE IF NOT EXISTS "compliance_alerts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID,
  "employer_id" UUID,
  "alert_type" TEXT,
  "severity" TEXT,
  "message" TEXT,
  "resolved_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ
);

-- ALTER: conflict_audit_log (+9 cols) — domains\governance\conflicts.ts
ALTER TABLE "conflict_audit_log" ADD COLUMN IF NOT EXISTS "action_description" TEXT DEFAULT '';
ALTER TABLE "conflict_audit_log" ADD COLUMN IF NOT EXISTS "subject_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "conflict_audit_log" ADD COLUMN IF NOT EXISTS "related_disclosure_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "conflict_audit_log" ADD COLUMN IF NOT EXISTS "related_transaction_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "conflict_audit_log" ADD COLUMN IF NOT EXISTS "performed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "conflict_audit_log" ADD COLUMN IF NOT EXISTS "performed_by_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "conflict_audit_log" ADD COLUMN IF NOT EXISTS "compliance_impact" VARCHAR(20) DEFAULT '';
ALTER TABLE "conflict_audit_log" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "conflict_audit_log" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';

-- ALTER: conflict_disclosures (+20 cols) — domains\governance\conflicts.ts
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "full_name" TEXT DEFAULT '';
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) DEFAULT '';
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "disclosure_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "disclosure_year" VARCHAR(4) DEFAULT '';
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "conflict_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "conflict_description" TEXT DEFAULT '';
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "related_parties" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "related_transaction_ids" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "financial_interest_amount" NUMERIC DEFAULT 0;
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "ownership_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "mitigation_plan" TEXT DEFAULT '';
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "recusal_required" BOOLEAN DEFAULT false;
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "recusal_documented" BOOLEAN DEFAULT false;
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "review_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "review_notes" TEXT DEFAULT '';
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "reviewed_by" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "review_completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "disclosure_deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "conflict_disclosures" ADD COLUMN IF NOT EXISTS "overdue" BOOLEAN DEFAULT false;

-- ALTER: conflict_of_interest_policy (+6 cols) — domains\governance\conflicts.ts
ALTER TABLE "conflict_of_interest_policy" ADD COLUMN IF NOT EXISTS "significant_interest_threshold" NUMERIC DEFAULT 0;
ALTER TABLE "conflict_of_interest_policy" ADD COLUMN IF NOT EXISTS "arms_length_verification_required" BOOLEAN DEFAULT false;
ALTER TABLE "conflict_of_interest_policy" ADD COLUMN IF NOT EXISTS "covered_roles" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "conflict_of_interest_policy" ADD COLUMN IF NOT EXISTS "review_committee_required" BOOLEAN DEFAULT false;
ALTER TABLE "conflict_of_interest_policy" ADD COLUMN IF NOT EXISTS "minimum_reviewers" VARCHAR(2) DEFAULT '';
ALTER TABLE "conflict_of_interest_policy" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: conflict_review_committee (+8 cols) — domains\governance\conflicts.ts
ALTER TABLE "conflict_review_committee" ADD COLUMN IF NOT EXISTS "full_name" TEXT DEFAULT '';
ALTER TABLE "conflict_review_committee" ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) DEFAULT '';
ALTER TABLE "conflict_review_committee" ADD COLUMN IF NOT EXISTS "committee_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "conflict_review_committee" ADD COLUMN IF NOT EXISTS "appointed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "conflict_review_committee" ADD COLUMN IF NOT EXISTS "appointed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "conflict_review_committee" ADD COLUMN IF NOT EXISTS "term_start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "conflict_review_committee" ADD COLUMN IF NOT EXISTS "term_end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "conflict_review_committee" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';

-- ALTER: conflict_training (+9 cols) — domains\governance\conflicts.ts
ALTER TABLE "conflict_training" ADD COLUMN IF NOT EXISTS "full_name" TEXT DEFAULT '';
ALTER TABLE "conflict_training" ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) DEFAULT '';
ALTER TABLE "conflict_training" ADD COLUMN IF NOT EXISTS "training_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "conflict_training" ADD COLUMN IF NOT EXISTS "training_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "conflict_training" ADD COLUMN IF NOT EXISTS "training_provider" TEXT DEFAULT '';
ALTER TABLE "conflict_training" ADD COLUMN IF NOT EXISTS "completion_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "conflict_training" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "conflict_training" ADD COLUMN IF NOT EXISTS "certificate_url" TEXT DEFAULT '';
ALTER TABLE "conflict_training" ADD COLUMN IF NOT EXISTS "next_training_due" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: congress_memberships (+5 cols) — congress-memberships-schema.ts
ALTER TABLE "congress_memberships" ADD COLUMN IF NOT EXISTS "congress_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "congress_memberships" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "congress_memberships" ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "congress_memberships" ADD COLUMN IF NOT EXISTS "ended_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "congress_memberships" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: consent_records (+18 cols) — data-governance-schema.ts
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "subject_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "purpose_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "purpose_description" TEXT DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "legal_basis" VARCHAR(50) DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "consent_given" BOOLEAN DEFAULT false;
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "consent_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "consent_text" TEXT DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "consent_version" VARCHAR(50) DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "consent_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "expiry_date" DATE DEFAULT NOW();
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "withdrawn" BOOLEAN DEFAULT false;
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "withdrawn_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "withdrawal_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(50) DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "evidence_url" TEXT DEFAULT '';
ALTER TABLE "consent_records" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: continuing_education (+11 cols) — certification-management-schema.ts
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "certification_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "course_title" TEXT DEFAULT '';
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "course_provider" TEXT DEFAULT '';
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "course_date" DATE DEFAULT NOW();
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "ce_hours_earned" VARCHAR(10) DEFAULT '';
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "ce_category" VARCHAR(50) DEFAULT '';
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "certificate_of_completion" TEXT DEFAULT '';
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "applicable_period_start" DATE DEFAULT NOW();
ALTER TABLE "continuing_education" ADD COLUMN IF NOT EXISTS "applicable_period_end" DATE DEFAULT NOW();

-- ALTER: contribution_rates (+8 cols) — domains\data\benchmarks.ts
ALTER TABLE "contribution_rates" ADD COLUMN IF NOT EXISTS "rate_type_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "contribution_rates" ADD COLUMN IF NOT EXISTS "rate" NUMERIC DEFAULT 0;
ALTER TABLE "contribution_rates" ADD COLUMN IF NOT EXISTS "max_insurable_earnings" NUMERIC DEFAULT 0;
ALTER TABLE "contribution_rates" ADD COLUMN IF NOT EXISTS "exemption_limit" NUMERIC DEFAULT 0;
ALTER TABLE "contribution_rates" ADD COLUMN IF NOT EXISTS "maximum_contribution" NUMERIC DEFAULT 0;
ALTER TABLE "contribution_rates" ADD COLUMN IF NOT EXISTS "effective_date" VARCHAR(20) DEFAULT '';
ALTER TABLE "contribution_rates" ADD COLUMN IF NOT EXISTS "source" VARCHAR(100) DEFAULT '';
ALTER TABLE "contribution_rates" ADD COLUMN IF NOT EXISTS "sync_id" VARCHAR(100) DEFAULT '';

-- ALTER: cookie_consents (+10 cols) — domains\compliance\gdpr.ts
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "essential" BOOLEAN DEFAULT false;
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "functional" BOOLEAN DEFAULT false;
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "analytics" BOOLEAN DEFAULT false;
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "marketing" BOOLEAN DEFAULT false;
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "consent_id" TEXT DEFAULT '';
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "ip_address" TEXT DEFAULT '';
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "last_updated" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cookie_consents" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: cost_centers (+15 cols) — domains\finance\accounting.ts
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50) DEFAULT '';
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT '';
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "parent_cost_center_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "manager" VARCHAR(255) DEFAULT '';
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "budget_amount" NUMERIC DEFAULT 0;
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "budget_period" VARCHAR(50) DEFAULT '';
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "budget_start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "budget_end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "warning_threshold" INTEGER DEFAULT 0;
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "external_code" VARCHAR(100) DEFAULT '';
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "cost_centers" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: cost_of_living_data (+8 cols) — domains\data\benchmarks.ts
ALTER TABLE "cost_of_living_data" ADD COLUMN IF NOT EXISTS "geography_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "cost_of_living_data" ADD COLUMN IF NOT EXISTS "cpi_value" NUMERIC DEFAULT 0;
ALTER TABLE "cost_of_living_data" ADD COLUMN IF NOT EXISTS "cpi_vector" VARCHAR(50) DEFAULT '';
ALTER TABLE "cost_of_living_data" ADD COLUMN IF NOT EXISTS "inflation_rate" NUMERIC DEFAULT 0;
ALTER TABLE "cost_of_living_data" ADD COLUMN IF NOT EXISTS "year" INTEGER DEFAULT 0;
ALTER TABLE "cost_of_living_data" ADD COLUMN IF NOT EXISTS "ref_date" VARCHAR(20) DEFAULT '';
ALTER TABLE "cost_of_living_data" ADD COLUMN IF NOT EXISTS "source" VARCHAR(100) DEFAULT '';
ALTER TABLE "cost_of_living_data" ADD COLUMN IF NOT EXISTS "sync_id" VARCHAR(100) DEFAULT '';

-- CREATE: country_address_formats (27 cols) — domains\infrastructure\addresses.ts
CREATE TABLE IF NOT EXISTS "country_address_formats" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "country_code" TEXT,
  "country_name" TEXT,
  "iso3_code" TEXT,
  "locality_label" TEXT,
  "administrative_area_label" TEXT,
  "postal_code_label" TEXT,
  "sub_administrative_area_label" TEXT,
  "required_fields" JSONB,
  "optional_fields" JSONB,
  "address_format" TEXT,
  "display_order" JSONB,
  "postal_code_required" BOOLEAN,
  "postal_code_pattern" TEXT,
  "postal_code_example" TEXT,
  "postal_code_length" INTEGER,
  "administrative_areas" JSONB,
  "has_subdivisions" BOOLEAN,
  "validation_rules" JSONB,
  "geocoding_supported" BOOLEAN,
  "preferred_geocoder" TEXT,
  "standardization_provider" TEXT,
  "standardization_available" BOOLEAN,
  "example_addresses" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: course_registrations (+39 cols) — domains\scheduling\training.ts
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "course_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "session_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "registration_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "registration_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "requires_approval" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "approved_date" DATE DEFAULT NOW();
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "approval_notes" TEXT DEFAULT '';
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "attended" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "attendance_dates" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "attendance_hours" NUMERIC DEFAULT 0;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "completed" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "completion_date" DATE DEFAULT NOW();
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "completion_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "pre_test_score" NUMERIC DEFAULT 0;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "post_test_score" NUMERIC DEFAULT 0;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "final_grade" VARCHAR(10) DEFAULT '';
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "passed" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "certificate_issued" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "certificate_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "certificate_issue_date" DATE DEFAULT NOW();
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "certificate_url" TEXT DEFAULT '';
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "evaluation_completed" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "evaluation_rating" NUMERIC DEFAULT 0;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "evaluation_comments" TEXT DEFAULT '';
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "evaluation_submitted_date" DATE DEFAULT NOW();
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "travel_required" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "travel_subsidy_requested" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "travel_subsidy_approved" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "travel_subsidy_amount" NUMERIC DEFAULT 0;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "accommodation_required" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "course_fee" NUMERIC DEFAULT 0;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "fee_paid" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "fee_payment_date" DATE DEFAULT NOW();
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "fee_waived" BOOLEAN DEFAULT false;
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "fee_waiver_reason" TEXT DEFAULT '';
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "cancellation_date" DATE DEFAULT NOW();
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT DEFAULT '';
ALTER TABLE "course_registrations" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: course_sessions (+35 cols) — domains\scheduling\training.ts
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "session_name" VARCHAR(300) DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "start_date" DATE DEFAULT NOW();
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "end_date" DATE DEFAULT NOW();
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "session_times" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "delivery_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "venue_name" VARCHAR(200) DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "venue_address" TEXT DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "room_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "virtual_meeting_url" TEXT DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "virtual_meeting_access_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "lead_instructor_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "lead_instructor_name" VARCHAR(200) DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "co_instructors" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "registration_open_date" DATE DEFAULT NOW();
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "registration_close_date" DATE DEFAULT NOW();
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "registration_count" INTEGER DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "waitlist_count" INTEGER DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "max_enrollment" INTEGER DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "session_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "attendees_count" INTEGER DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "completions_count" INTEGER DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "completion_rate" NUMERIC DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "average_rating" NUMERIC DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "evaluation_responses_count" INTEGER DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "session_budget" NUMERIC DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "actual_cost" NUMERIC DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "travel_subsidy_offered" BOOLEAN DEFAULT false;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "accommodation_arranged" BOOLEAN DEFAULT false;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "accommodation_hotel" VARCHAR(200) DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "materials_prepared" BOOLEAN DEFAULT false;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "materials_distributed_count" INTEGER DEFAULT 0;
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "cancelled_date" DATE DEFAULT NOW();
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "course_sessions" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: cpi_adjusted_pricing (+10 cols) — domains\infrastructure\trust-fmv.ts
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "original_price_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "original_cpi" NUMERIC DEFAULT 0;
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "adjusted_price" NUMERIC DEFAULT 0;
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "adjustment_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "current_cpi" NUMERIC DEFAULT 0;
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "cpi_change_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "adjustment_amount" NUMERIC DEFAULT 0;
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "adjustment_approved" BOOLEAN DEFAULT false;
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "cpi_adjusted_pricing" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: cpi_data (+10 cols) — domains\infrastructure\trust-fmv.ts
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "period_month" VARCHAR(2) DEFAULT '';
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "period_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "cpi_value" NUMERIC DEFAULT 0;
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "cpi_change" NUMERIC DEFAULT 0;
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "cpi_year_over_year" NUMERIC DEFAULT 0;
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "base_year" VARCHAR(4) DEFAULT '';
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "source" VARCHAR(50) DEFAULT '';
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "data_quality" VARCHAR(20) DEFAULT '';
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "imported_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cpi_data" ADD COLUMN IF NOT EXISTS "imported_by" VARCHAR(255) DEFAULT '';

-- ALTER: cross_border_transactions (+12 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "cad_equivalent_cents" INTEGER DEFAULT 0;
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "from_country_code" VARCHAR(2) DEFAULT '';
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "to_country_code" VARCHAR(2) DEFAULT '';
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "from_party_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "to_party_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "cra_reporting_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "requires_t106" BOOLEAN DEFAULT false;
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "t106_filed" BOOLEAN DEFAULT false;
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "t106_filing_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "transaction_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "counterparty_name" TEXT DEFAULT '';
ALTER TABLE "cross_border_transactions" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';

-- ALTER: currency_enforcement_audit (+9 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "currency_enforcement_audit" ADD COLUMN IF NOT EXISTS "action_description" TEXT DEFAULT '';
ALTER TABLE "currency_enforcement_audit" ADD COLUMN IF NOT EXISTS "transaction_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "currency_enforcement_audit" ADD COLUMN IF NOT EXISTS "affected_currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "currency_enforcement_audit" ADD COLUMN IF NOT EXISTS "affected_amount" NUMERIC DEFAULT 0;
ALTER TABLE "currency_enforcement_audit" ADD COLUMN IF NOT EXISTS "performed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "currency_enforcement_audit" ADD COLUMN IF NOT EXISTS "performed_by_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "currency_enforcement_audit" ADD COLUMN IF NOT EXISTS "compliance_impact" VARCHAR(20) DEFAULT '';
ALTER TABLE "currency_enforcement_audit" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "currency_enforcement_audit" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';

-- ALTER: currency_enforcement_policy (+7 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "currency_enforcement_policy" ADD COLUMN IF NOT EXISTS "allow_foreign_currency" BOOLEAN DEFAULT false;
ALTER TABLE "currency_enforcement_policy" ADD COLUMN IF NOT EXISTS "foreign_currency_reason" TEXT DEFAULT '';
ALTER TABLE "currency_enforcement_policy" ADD COLUMN IF NOT EXISTS "fx_rate_source" VARCHAR(50) DEFAULT '';
ALTER TABLE "currency_enforcement_policy" ADD COLUMN IF NOT EXISTS "fx_rate_update_frequency" VARCHAR(20) DEFAULT '';
ALTER TABLE "currency_enforcement_policy" ADD COLUMN IF NOT EXISTS "t106_filing_required" BOOLEAN DEFAULT false;
ALTER TABLE "currency_enforcement_policy" ADD COLUMN IF NOT EXISTS "t106_threshold_cad" NUMERIC DEFAULT 0;
ALTER TABLE "currency_enforcement_policy" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: currency_enforcement_violations (+12 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "violation_description" TEXT DEFAULT '';
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "transaction_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "attempted_currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "attempted_amount" NUMERIC DEFAULT 0;
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "attempted_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "attempted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "resolution" TEXT DEFAULT '';
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "resolved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "currency_enforcement_violations" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';

-- ALTER: data_aggregation_consent (+4 cols) — domains\marketing.ts
ALTER TABLE "data_aggregation_consent" ADD COLUMN IF NOT EXISTS "consent_given" BOOLEAN DEFAULT false;
ALTER TABLE "data_aggregation_consent" ADD COLUMN IF NOT EXISTS "consent_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "data_aggregation_consent" ADD COLUMN IF NOT EXISTS "categories" TEXT DEFAULT '';
ALTER TABLE "data_aggregation_consent" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: data_anonymization_log (+10 cols) — domains\compliance\gdpr.ts
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "operation_type" TEXT DEFAULT '';
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "reason" TEXT DEFAULT '';
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "request_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "tables_affected" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "executed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "executed_by" TEXT DEFAULT '';
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "verified_by" TEXT DEFAULT '';
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "can_reverse" BOOLEAN DEFAULT false;
ALTER TABLE "data_anonymization_log" ADD COLUMN IF NOT EXISTS "backup_location" TEXT DEFAULT '';

-- ALTER: data_classification_policy (+1 cols) — domains\compliance\employer-interference.ts
ALTER TABLE "data_classification_policy" ADD COLUMN IF NOT EXISTS "allow_grievance_participation" BOOLEAN DEFAULT false;

-- ALTER: data_processing_records (+12 cols) — domains\compliance\gdpr.ts
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "activity_name" TEXT DEFAULT '';
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "processing_purpose" TEXT DEFAULT '';
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "legal_basis" TEXT DEFAULT '';
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "data_categories" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "data_subjects" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "recipients" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "retention_period" TEXT DEFAULT '';
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "deletion_procedure" TEXT DEFAULT '';
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "security_measures" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "dpo_contact" TEXT DEFAULT '';
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "last_reviewed" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "data_processing_records" ADD COLUMN IF NOT EXISTS "next_review_due" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: data_residency_configs (+13 cols) — data-governance-schema.ts
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "primary_region" VARCHAR(50) DEFAULT '';
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "allowed_regions" TEXT DEFAULT '';
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "prohibited_regions" TEXT DEFAULT '';
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "data_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "storage_locations" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "allow_cross_border_transfer" BOOLEAN DEFAULT false;
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "transfer_mechanisms" TEXT DEFAULT '';
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "legal_basis" TEXT DEFAULT '';
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "regulatory_reference" TEXT DEFAULT '';
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "effective_date" DATE DEFAULT NOW();
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "data_residency_configs" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: data_retention_policies (+10 cols) — domains\compliance\gdpr.ts
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "policy_name" TEXT DEFAULT '';
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "data_type" TEXT DEFAULT '';
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "retention_period_days" TEXT DEFAULT '';
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "conditions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "action_on_expiry" TEXT DEFAULT '';
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "archive_location" TEXT DEFAULT '';
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "legal_requirement" TEXT DEFAULT '';
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "last_executed" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "data_retention_policies" ADD COLUMN IF NOT EXISTS "next_execution" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: data_subject_access_requests (+16 cols) — domains\compliance\provincial-privacy.ts
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "request_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "province" VARCHAR(2) DEFAULT '';
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "request_description" TEXT DEFAULT '';
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "requested_data_types" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "identity_verified" BOOLEAN DEFAULT false;
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "verification_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "assigned_to" VARCHAR(255) DEFAULT '';
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "response_deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "responded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "deadline_met" BOOLEAN DEFAULT false;
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "denial_reason" TEXT DEFAULT '';
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "denial_legal_basis" TEXT DEFAULT '';
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "response_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "data_subject_access_requests" ADD COLUMN IF NOT EXISTS "response_delivered_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: defensibility_packs (+23 cols) — defensibility-packs-schema.ts
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "pack_version" VARCHAR(10) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "generated_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "export_format" VARCHAR(10) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "export_purpose" VARCHAR(50) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "requested_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "pack_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "integrity_hash" VARCHAR(64) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "timeline_hash" VARCHAR(64) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "audit_hash" VARCHAR(64) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "state_transition_hash" VARCHAR(64) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "verification_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "last_verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "verification_attempts" INTEGER DEFAULT 0;
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "download_count" INTEGER DEFAULT 0;
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "last_downloaded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "last_downloaded_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "file_size_bytes" INTEGER DEFAULT 0;
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "storage_location" TEXT DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "deleted_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "defensibility_packs" ADD COLUMN IF NOT EXISTS "deletion_reason" TEXT DEFAULT '';

-- ALTER: disaster_recovery_drills (+22 cols) — domains\compliance\force-majeure.ts
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "scenario_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "scheduled_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "actual_start_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "actual_end_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "duration" VARCHAR(50) DEFAULT '';
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "participants" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "participant_count" INTEGER DEFAULT 0;
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "objectives" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "objectives_met" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "overall_score" INTEGER DEFAULT 0;
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "target_recovery_time" VARCHAR(50) DEFAULT '';
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "actual_recovery_time" VARCHAR(50) DEFAULT '';
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "recovery_time_objective_met" BOOLEAN DEFAULT false;
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "issues_identified" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "remediation_actions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "remediation_deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "drill_report_url" TEXT DEFAULT '';
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "video_recording_url" TEXT DEFAULT '';
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "conducted_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "disaster_recovery_drills" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();

-- CREATE: dispatch_assignments (7 cols) — domains\dispatch\dispatch.ts
CREATE TABLE IF NOT EXISTS "dispatch_assignments" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "request_id" UUID,
  "member_id" UUID,
  "status" TEXT,
  "assigned_at" TIMESTAMPTZ,
  "responded_at" TIMESTAMPTZ,
  "completed_at" TIMESTAMPTZ
);

-- CREATE: dispatch_requests (10 cols) — domains\dispatch\dispatch.ts
CREATE TABLE IF NOT EXISTS "dispatch_requests" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID,
  "employer_id" UUID,
  "job_title" VARCHAR(255),
  "required_skills" JSONB,
  "requested_workers" INTEGER,
  "status" TEXT,
  "requested_date" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: dispatch_rules (7 cols) — domains\dispatch\dispatch.ts
CREATE TABLE IF NOT EXISTS "dispatch_rules" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID,
  "rule_type" TEXT,
  "rule_definition" JSONB,
  "priority" INTEGER,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: document_folders (+5 cols) — documents-schema.ts
ALTER TABLE "document_folders" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "document_folders" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "document_folders" ADD COLUMN IF NOT EXISTS "parent_folder_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "document_folders" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "document_folders" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: document_signers (+23 cols) — domains\documents\signatures.ts
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "email" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "signing_order" INTEGER DEFAULT 0;
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "viewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "signature_type" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "signature_image_url" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "authentication_method" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "authenticated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "declined_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "decline_reason" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "reassigned_to" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "reassigned_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "ip_address" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "geolocation" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "provider_signer_id" TEXT DEFAULT '';
ALTER TABLE "document_signers" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: documents (+14 cols) — documents-schema.ts
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "folder_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "file_url" TEXT DEFAULT '';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "file_size" INTEGER DEFAULT 0;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "file_type" TEXT DEFAULT '';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "mime_type" TEXT DEFAULT '';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "content_text" TEXT DEFAULT '';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "is_confidential" BOOLEAN DEFAULT false;
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "access_level" TEXT DEFAULT '';
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "documents" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: donation_campaigns (+22 cols) — cms-website-schema.ts
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "slug" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "campaign_type" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "goal_amount" NUMERIC DEFAULT 0;
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "current_amount" NUMERIC DEFAULT 0;
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "featured_image" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "video_url" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "start_date" DATE DEFAULT NOW();
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "end_date" DATE DEFAULT NOW();
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "allow_recurring" BOOLEAN DEFAULT false;
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "suggested_amounts" INTEGER DEFAULT 0;
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "thank_you_message" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "email_template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "page_content" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "seo_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "stripe_product_id" TEXT DEFAULT '';
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "stripe_price_ids" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "donation_campaigns" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: donation_receipts (+7 cols) — cms-website-schema.ts
ALTER TABLE "donation_receipts" ADD COLUMN IF NOT EXISTS "donation_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "donation_receipts" ADD COLUMN IF NOT EXISTS "receipt_number" TEXT DEFAULT '';
ALTER TABLE "donation_receipts" ADD COLUMN IF NOT EXISTS "receipt_type" TEXT DEFAULT '';
ALTER TABLE "donation_receipts" ADD COLUMN IF NOT EXISTS "amount" NUMERIC DEFAULT 0;
ALTER TABLE "donation_receipts" ADD COLUMN IF NOT EXISTS "issue_date" DATE DEFAULT NOW();
ALTER TABLE "donation_receipts" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT DEFAULT '';
ALTER TABLE "donation_receipts" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: donations (+20 cols) — cms-website-schema.ts
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "donor_name" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "donor_email" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "donor_phone" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "amount" NUMERIC DEFAULT 0;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "is_recurring" BOOLEAN DEFAULT false;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "recurring_interval" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "is_anonymous" BOOLEAN DEFAULT false;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "message" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "custom_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "stripe_customer_id" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "stripe_subscription_id" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "payment_status" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "payment_method" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "receipt_sent" BOOLEAN DEFAULT false;
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "receipt_url" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "tax_receipt_number" TEXT DEFAULT '';
ALTER TABLE "donations" ADD COLUMN IF NOT EXISTS "tax_receipt_issued_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: dsr_activity_log (+7 cols) — data-governance-schema.ts
ALTER TABLE "dsr_activity_log" ADD COLUMN IF NOT EXISTS "activity_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "dsr_activity_log" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "dsr_activity_log" ADD COLUMN IF NOT EXISTS "performed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "dsr_activity_log" ADD COLUMN IF NOT EXISTS "performed_by_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "dsr_activity_log" ADD COLUMN IF NOT EXISTS "previous_value" TEXT DEFAULT '';
ALTER TABLE "dsr_activity_log" ADD COLUMN IF NOT EXISTS "new_value" TEXT DEFAULT '';
ALTER TABLE "dsr_activity_log" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: dsr_requests (+28 cols) — data-governance-schema.ts
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "subject_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "subject_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "subject_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "subject_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "request_source" VARCHAR(50) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN DEFAULT false;
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "verification_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "due_date" DATE DEFAULT NOW();
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "assigned_to" VARCHAR(255) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "data_collected" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "actions_performed" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "response_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "response_notes" TEXT DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "response_delivery_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "legal_basis" VARCHAR(100) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "jurisdiction" VARCHAR(50) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "rejected_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "rejected_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "dsr_requests" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: dues_rates (+9 cols) — dues-finance-schema.ts
ALTER TABLE "dues_rates" ADD COLUMN IF NOT EXISTS "percentage" NUMERIC DEFAULT 0;
ALTER TABLE "dues_rates" ADD COLUMN IF NOT EXISTS "employment_type" TEXT DEFAULT '';
ALTER TABLE "dues_rates" ADD COLUMN IF NOT EXISTS "classification" TEXT DEFAULT '';
ALTER TABLE "dues_rates" ADD COLUMN IF NOT EXISTS "effective_from" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "dues_rates" ADD COLUMN IF NOT EXISTS "effective_to" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "dues_rates" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "dues_rates" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "dues_rates" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "dues_rates" ADD COLUMN IF NOT EXISTS "last_modified_by" TEXT DEFAULT '';

-- ALTER: dues_transactions (+3 cols) — domains\finance\dues.ts
ALTER TABLE "dues_transactions" ADD COLUMN IF NOT EXISTS "total_amount" NUMERIC DEFAULT 0;
ALTER TABLE "dues_transactions" ADD COLUMN IF NOT EXISTS "paid_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "dues_transactions" ADD COLUMN IF NOT EXISTS "receipt_url" TEXT DEFAULT '';

-- ALTER: emergency_declarations (+10 cols) — domains\compliance\force-majeure.ts
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "severity_level" VARCHAR(20) DEFAULT '';
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "declared_by_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "declared_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "affected_locations" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "affected_member_count" INTEGER DEFAULT 0;
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "notification_sent" BOOLEAN DEFAULT false;
ALTER TABLE "emergency_declarations" ADD COLUMN IF NOT EXISTS "break_glass_activated" BOOLEAN DEFAULT false;

-- CREATE: employer_communications (20 cols) — domains\communications\employer-communications.ts
CREATE TABLE IF NOT EXISTS "employer_communications" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "employer_id" UUID,
  "grievance_id" UUID,
  "type" TEXT,
  "status" TEXT,
  "subject" VARCHAR(500),
  "body" TEXT,
  "summary" TEXT,
  "sender_name" VARCHAR(255),
  "sender_user_id" UUID,
  "recipient_name" VARCHAR(255),
  "recipient_contact_id" UUID,
  "sent_at" TIMESTAMPTZ,
  "received_at" TIMESTAMPTZ,
  "attachments" JSONB,
  "template_id" UUID,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ,
  "created_by" UUID
);

-- CREATE: employer_contacts (15 cols) — domains\communications\employer-communications.ts
CREATE TABLE IF NOT EXISTS "employer_contacts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "employer_id" UUID,
  "name" VARCHAR(255),
  "role" TEXT,
  "title" VARCHAR(255),
  "email" VARCHAR(320),
  "phone" VARCHAR(30),
  "preferred_method" TEXT,
  "is_primary" BOOLEAN,
  "is_active" BOOLEAN,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ,
  "created_by" UUID
);

-- ALTER: employer_remittances (+20 cols) — dues-finance-schema.ts
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "member_count" INTEGER DEFAULT 0;
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "file_name" TEXT DEFAULT '';
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "file_url" TEXT DEFAULT '';
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "file_hash" TEXT DEFAULT '';
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "processing_status" TEXT DEFAULT '';
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "processed_by" TEXT DEFAULT '';
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "records_total" INTEGER DEFAULT 0;
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "records_processed" INTEGER DEFAULT 0;
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "records_matched" INTEGER DEFAULT 0;
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "records_exception" INTEGER DEFAULT 0;
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "expected_amount" NUMERIC DEFAULT 0;
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "variance" NUMERIC DEFAULT 0;
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "is_reconciled" BOOLEAN DEFAULT false;
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "reconciled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "reconciled_by" TEXT DEFAULT '';
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "employer_remittances" ADD COLUMN IF NOT EXISTS "last_modified_by" TEXT DEFAULT '';

-- CREATE: employer_reports (5 cols) — domains\compliance\employer-compliance.ts
CREATE TABLE IF NOT EXISTS "employer_reports" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "employer_id" UUID,
  "report_type" TEXT,
  "data_json" JSONB,
  "created_at" TIMESTAMPTZ
);

-- ALTER: employer_responses (+39 cols) — domains\infrastructure\organizing.ts
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "response_date" DATE DEFAULT NOW();
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "response_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "response_summary" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "response_severity" VARCHAR(20) DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "meeting_attendance_mandatory" BOOLEAN DEFAULT false;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "meeting_location" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "meeting_date_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "speakers" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "talking_points" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "materials_distributed" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "material_urls" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "material_content_summary" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "anti_union_consultant_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "consultant_firm" VARCHAR(255) DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "consultant_tactics" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "employee_disciplined" BOOLEAN DEFAULT false;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "employee_terminated" BOOLEAN DEFAULT false;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "affected_contact_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "alleged_reason" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "suspected_retaliation" BOOLEAN DEFAULT false;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "surveillance_reported" BOOLEAN DEFAULT false;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "surveillance_description" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "intimidation_tactics" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "potential_ulp" BOOLEAN DEFAULT false;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "ulp_filed" BOOLEAN DEFAULT false;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "ulp_case_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "nlrb_clrb_complaint_filed" BOOLEAN DEFAULT false;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "union_counter_strategy" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "union_action_taken" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "organizers_assigned_response" UUID DEFAULT gen_random_uuid();
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "impact_on_campaign" VARCHAR(20) DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "contacts_influenced" INTEGER DEFAULT 0;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "estimated_support_lost" NUMERIC DEFAULT 0;
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "evidence_documents" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "witness_statements" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "employer_responses" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- CREATE: employer_risk_scores (18 cols) — domains\ml\employer-risk-scores.ts
CREATE TABLE IF NOT EXISTS "employer_risk_scores" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "employer_id" UUID,
  "overall_score" NUMERIC,
  "risk_band" TEXT,
  "trend_direction" VARCHAR(15),
  "signals_json" JSONB,
  "grievance_count_30d" INTEGER,
  "compliance_alert_count_30d" INTEGER,
  "arbitration_count_12m" INTEGER,
  "confidence" NUMERIC,
  "explanation" TEXT,
  "model_version" VARCHAR(50),
  "profile_key" VARCHAR(100),
  "audit_ref" VARCHAR(120),
  "valid_from" TIMESTAMPTZ,
  "valid_until" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ
);

-- ALTER: employers (+29 cols) — union-structure-schema.ts
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "legal_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "dba_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "employer_type" TEXT DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "business_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "federal_corporation_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "provincial_corporation_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "industry_code" VARCHAR(20) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "website" VARCHAR(500) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "main_address" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "total_employees" INTEGER DEFAULT 0;
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "unionized_employees" INTEGER DEFAULT 0;
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "established_date" DATE DEFAULT NOW();
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "primary_contact_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "primary_contact_title" VARCHAR(255) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "primary_contact_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "primary_contact_phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "labour_relations_contact_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "labour_relations_contact_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "labour_relations_contact_phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "parent_company_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';
ALTER TABLE "employers" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: employment_history (+6 cols) — domains\member\member-employment.ts
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "effective_date" DATE DEFAULT NOW();
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "previous_values" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "new_values" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "reason" TEXT DEFAULT '';
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "employment_history" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: event_attendees (+12 cols) — calendar-schema.ts
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "email" TEXT DEFAULT '';
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "is_optional" BOOLEAN DEFAULT false;
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "is_organizer" BOOLEAN DEFAULT false;
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "responded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "response_comment" TEXT DEFAULT '';
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "notification_sent" BOOLEAN DEFAULT false;
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "last_notification_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "event_attendees" ADD COLUMN IF NOT EXISTS "external_attendee_id" TEXT DEFAULT '';

-- ALTER: event_check_ins (+6 cols) — cms-website-schema.ts
ALTER TABLE "event_check_ins" ADD COLUMN IF NOT EXISTS "event_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "event_check_ins" ADD COLUMN IF NOT EXISTS "registration_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "event_check_ins" ADD COLUMN IF NOT EXISTS "check_in_method" TEXT DEFAULT '';
ALTER TABLE "event_check_ins" ADD COLUMN IF NOT EXISTS "checked_in_by" TEXT DEFAULT '';
ALTER TABLE "event_check_ins" ADD COLUMN IF NOT EXISTS "check_in_location" TEXT DEFAULT '';
ALTER TABLE "event_check_ins" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: event_registrations (+24 cols) — cms-website-schema.ts
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "event_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "profile_id" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "first_name" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "last_name" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "email" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "phone" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "member_number" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "ticket_type" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "ticket_price" NUMERIC DEFAULT 0;
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "number_of_guests" INTEGER DEFAULT 0;
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "guest_names" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "custom_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "registration_status" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "payment_status" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "payment_method" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "confirmation_sent" BOOLEAN DEFAULT false;
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "reminder_sent" BOOLEAN DEFAULT false;
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "checked_in" BOOLEAN DEFAULT false;
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "checked_in_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "checked_in_by" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "qr_code" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "registration_source" TEXT DEFAULT '';
ALTER TABLE "event_registrations" ADD COLUMN IF NOT EXISTS "registered_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: event_reminders (+9 cols) — calendar-schema.ts
ALTER TABLE "event_reminders" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "event_reminders" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "event_reminders" ADD COLUMN IF NOT EXISTS "reminder_minutes" INTEGER DEFAULT 0;
ALTER TABLE "event_reminders" ADD COLUMN IF NOT EXISTS "reminder_type" VARCHAR(20) DEFAULT '';
ALTER TABLE "event_reminders" ADD COLUMN IF NOT EXISTS "scheduled_for" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "event_reminders" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "event_reminders" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "event_reminders" ADD COLUMN IF NOT EXISTS "error" TEXT DEFAULT '';
ALTER TABLE "event_reminders" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: exchange_rates (+7 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "to_currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "exchange_rate" VARCHAR(20) DEFAULT '';
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "rate_source" VARCHAR(50) DEFAULT '';
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "effective_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "rate_timestamp" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(100) DEFAULT '';
ALTER TABLE "exchange_rates" ADD COLUMN IF NOT EXISTS "data_quality" VARCHAR(20) DEFAULT '';

-- CREATE: external_calendar_connections (23 cols) — calendar-schema.ts
CREATE TABLE IF NOT EXISTS "external_calendar_connections" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" TEXT,
  "organization_id" UUID,
  "provider" VARCHAR(50),
  "provider_account_id" TEXT,
  "provider_email" TEXT,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "token_expires_at" TIMESTAMPTZ,
  "scope" TEXT,
  "sync_enabled" BOOLEAN,
  "sync_direction" VARCHAR(20),
  "last_sync_at" TIMESTAMPTZ,
  "next_sync_at" TIMESTAMPTZ,
  "sync_status" TEXT,
  "sync_error" TEXT,
  "sync_past_days" INTEGER,
  "sync_future_days" INTEGER,
  "sync_only_free_time" BOOLEAN,
  "calendar_mappings" JSONB,
  "is_active" BOOLEAN,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: external_data_sync_log (+12 cols) — domains\data\benchmarks.ts
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "source_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "sync_id" VARCHAR(100) DEFAULT '';
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "records_processed" INTEGER DEFAULT 0;
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "records_inserted" INTEGER DEFAULT 0;
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "records_updated" INTEGER DEFAULT 0;
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "records_failed" INTEGER DEFAULT 0;
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "error_details" TEXT DEFAULT '';
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "initiated_by" VARCHAR(100) DEFAULT '';
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "sync_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "external_data_sync_log" ADD COLUMN IF NOT EXISTS "parameters" TEXT DEFAULT '';

-- ALTER: external_employees (+8 cols) — domains\data\hris.ts
ALTER TABLE "external_employees" ADD COLUMN IF NOT EXISTS "employee_id" VARCHAR(100) DEFAULT '';
ALTER TABLE "external_employees" ADD COLUMN IF NOT EXISTS "position" VARCHAR(255) DEFAULT '';
ALTER TABLE "external_employees" ADD COLUMN IF NOT EXISTS "location" VARCHAR(255) DEFAULT '';
ALTER TABLE "external_employees" ADD COLUMN IF NOT EXISTS "hire_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "external_employees" ADD COLUMN IF NOT EXISTS "work_schedule" VARCHAR(100) DEFAULT '';
ALTER TABLE "external_employees" ADD COLUMN IF NOT EXISTS "supervisor_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "external_employees" ADD COLUMN IF NOT EXISTS "supervisor_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "external_employees" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;

-- ALTER: failed_login_attempts (+4 cols) — audit-security-schema.ts
ALTER TABLE "failed_login_attempts" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "failed_login_attempts" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "failed_login_attempts" ADD COLUMN IF NOT EXISTS "failure_reason" VARCHAR(100) DEFAULT '';
ALTER TABLE "failed_login_attempts" ADD COLUMN IF NOT EXISTS "attempted_at" TIMESTAMPTZ DEFAULT NOW();

-- CREATE: feature_flags (13 cols) — domains\infrastructure\features.ts
CREATE TABLE IF NOT EXISTS "feature_flags" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "name" TEXT,
  "type" TEXT,
  "enabled" BOOLEAN,
  "percentage" INTEGER,
  "allowed_organizations" JSON,
  "allowed_users" JSON,
  "description" TEXT,
  "tags" JSON,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ,
  "created_by" TEXT,
  "last_modified_by" TEXT
);

-- ALTER: federation_campaigns (+37 cols) — domains\federation\federation-schema.ts
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "campaign_type" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "start_date" DATE DEFAULT NOW();
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "end_date" DATE DEFAULT NOW();
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "target_completion_date" DATE DEFAULT NOW();
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "target_sector" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "target_employer" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "target_region" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "target_workers" INTEGER DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "goal_description" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "workers_reached" INTEGER DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "workers_organized" INTEGER DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "cards_signed_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "events_held" INTEGER DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "volunteers_involved" INTEGER DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "progress_percentage" INTEGER DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "lead_organizer_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "lead_organizer_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "coordinating_union_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "participating_union_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "budget" NUMERIC DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "actual_spend" NUMERIC DEFAULT 0;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN DEFAULT false;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "public_page_url" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "social_media_hashtags" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "success_level" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "outcome_description" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "lessons_learned" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "resources_url" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "report_url" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_campaigns" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: federation_communications (+34 cols) — domains\federation\federation-schema.ts
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "communication_type" TEXT DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "subject" VARCHAR(500) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "summary" TEXT DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "author_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "author_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "author_title" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "scheduled_for" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "send_to_all_members" BOOLEAN DEFAULT false;
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "target_audience" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "sent_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "delivered_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "opened_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "click_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "is_pinned" BOOLEAN DEFAULT false;
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN DEFAULT false;
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "featured_image" TEXT DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "related_campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "related_meeting_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "related_event_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "attachments" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "call_to_action" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "action_url" TEXT DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "action_button_text" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_communications" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: federation_executives (+28 cols) — domains\federation\federation-schema.ts
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "union_organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "position" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "position_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "portfolio_area" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "term_start" DATE DEFAULT NOW();
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "term_end" DATE DEFAULT NOW();
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "current_term" BOOLEAN DEFAULT false;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "term_number" INTEGER DEFAULT 0;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "elected_date" DATE DEFAULT NOW();
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "election_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "votes_received" INTEGER DEFAULT 0;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "executive_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "executive_phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "office_location" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "signing_authority" BOOLEAN DEFAULT false;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "budget_authority" BOOLEAN DEFAULT false;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "can_approve_remittances" BOOLEAN DEFAULT false;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "can_manage_campaigns" BOOLEAN DEFAULT false;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "compensation_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "compensation_amount" NUMERIC DEFAULT 0;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "biography" TEXT DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "photo" TEXT DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_executives" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: federation_meetings (+32 cols) — domains\federation\federation-schema.ts
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "meeting_type" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "location_type" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "venue_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "venue_address" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "virtual_meeting_url" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "virtual_meeting_platform" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "expected_attendees" INTEGER DEFAULT 0;
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "actual_attendees" INTEGER DEFAULT 0;
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "quorum_required" INTEGER DEFAULT 0;
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "quorum_met" BOOLEAN DEFAULT false;
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "minutes_url" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "recording_url" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "resolutions_passed" INTEGER DEFAULT 0;
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "decisions_url" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "registration_required" BOOLEAN DEFAULT false;
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "registration_deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "registration_url" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "max_capacity" INTEGER DEFAULT 0;
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "agenda_url" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "materials_url" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "organizer_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "organizer_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "organizer_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_meetings" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: federation_memberships (+27 cols) — domains\federation\federation-schema.ts
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "joined_date" DATE DEFAULT NOW();
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "effective_date" DATE DEFAULT NOW();
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "suspended_date" DATE DEFAULT NOW();
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "terminated_date" DATE DEFAULT NOW();
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "last_renewal_date" DATE DEFAULT NOW();
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "next_renewal_date" DATE DEFAULT NOW();
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "membership_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "voting_rights" BOOLEAN DEFAULT false;
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "executive_eligibility" BOOLEAN DEFAULT false;
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "per_capita_rate" NUMERIC DEFAULT 0;
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "monthly_dues" NUMERIC DEFAULT 0;
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "dues_in_arrears" BOOLEAN DEFAULT false;
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "arrears_amount" NUMERIC DEFAULT 0;
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "last_payment_date" DATE DEFAULT NOW();
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "delegate_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "executive_seats" INTEGER DEFAULT 0;
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "primary_contact_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "primary_contact_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "primary_contact_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "primary_contact_phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "suspension_reason" TEXT DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "termination_reason" TEXT DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_memberships" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: federation_remittances (+30 cols) — domains\federation\federation-schema.ts
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "total_amount" NUMERIC DEFAULT 0;
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "payment_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "amount_paid" NUMERIC DEFAULT 0;
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "amount_outstanding" NUMERIC DEFAULT 0;
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "paid_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "payment_reference" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "cheque_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "approval_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "submitted_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "submitted_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "approved_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "rejected_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "rejected_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "invoice_url" TEXT DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "receipt_url" TEXT DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "remittance_file_url" TEXT DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "gl_account" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "fiscal_period" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "late_fee_amount" NUMERIC DEFAULT 0;
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "adjustment_amount" NUMERIC DEFAULT 0;
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "adjustment_reason" TEXT DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_remittances" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: federation_resources (+44 cols) — domains\federation\federation-schema.ts
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "resource_type" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "sub_category" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "topics" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "target_audience" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "skill_level" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "file_url" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "file_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "file_size" INTEGER DEFAULT 0;
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "preview_url" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "additional_files" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "version" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "previous_version_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "is_current_version" BOOLEAN DEFAULT false;
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "author_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "author_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "author_organization" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "contributors" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN DEFAULT false;
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "access_level" VARCHAR(50) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "download_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "view_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "rating" NUMERIC DEFAULT 0;
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "rating_count" INTEGER DEFAULT 0;
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "language" VARCHAR(10) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "available_languages" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "license" VARCHAR(100) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "license_url" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "related_resource_ids" UUID DEFAULT gen_random_uuid();
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "related_campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "search_keywords" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "usage_instructions" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "credits" TEXT DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federation_resources" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: federations (+29 cols) — domains\federation\federation-schema.ts
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "short_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(255) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "federation_type" TEXT DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "province" VARCHAR(2) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "region" VARCHAR(100) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "jurisdiction" VARCHAR(100) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "website" TEXT DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "address" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "founded_date" DATE DEFAULT NOW();
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "affiliated_with_clc" BOOLEAN DEFAULT false;
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "clc_affiliate_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "total_member_unions" INTEGER DEFAULT 0;
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "total_represented_workers" INTEGER DEFAULT 0;
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "per_capita_rate" NUMERIC DEFAULT 0;
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "fiscal_year_end" VARCHAR(5) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "mission" TEXT DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "constitution" TEXT DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "bylaws" TEXT DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "strategic_plan" TEXT DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "settings" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "federations" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: field_notes (+17 cols) — domains\communications\organizer-workflows.ts
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "member_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "author_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "note_type" TEXT DEFAULT '';
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "subject" VARCHAR(255) DEFAULT '';
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "sentiment" TEXT DEFAULT '';
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "engagement_level" INTEGER DEFAULT 0;
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "follow_up_date" DATE DEFAULT NOW();
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "follow_up_completed" BOOLEAN DEFAULT false;
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "follow_up_completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "related_case_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "related_grievance_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "interaction_date" DATE DEFAULT NOW();
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "is_private" BOOLEAN DEFAULT false;
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "is_confidential" BOOLEAN DEFAULT false;
ALTER TABLE "field_notes" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: field_organizer_activities (+29 cols) — domains\infrastructure\organizing.ts
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "organizer_id" TEXT DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "contact_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "activity_date" DATE DEFAULT NOW();
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "activity_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "activity_duration_minutes" INTEGER DEFAULT 0;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "activity_location" TEXT DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "gps_latitude" NUMERIC DEFAULT 0;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "gps_longitude" NUMERIC DEFAULT 0;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "offline_mode_used" BOOLEAN DEFAULT false;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "contact_made" BOOLEAN DEFAULT false;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "commitment_level_before" VARCHAR(50) DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "commitment_level_after" VARCHAR(50) DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "card_signed" BOOLEAN DEFAULT false;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "follow_up_needed" BOOLEAN DEFAULT false;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "follow_up_date" DATE DEFAULT NOW();
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "issues_discussed" TEXT DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "concerns_raised" TEXT DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "questions_asked" TEXT DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "materials_distributed" TEXT DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "interaction_quality" VARCHAR(20) DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "likely_to_vote_yes" BOOLEAN DEFAULT false;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "willing_to_help_organize" BOOLEAN DEFAULT false;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "potential_leader" BOOLEAN DEFAULT false;
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "detailed_notes" TEXT DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "organizer_observations" TEXT DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "next_steps" TEXT DEFAULT '';
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "synced_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "field_organizer_activities" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: financial_periods (+3 cols) — dues-finance-schema.ts
ALTER TABLE "financial_periods" ADD COLUMN IF NOT EXISTS "total_arrears" NUMERIC DEFAULT 0;
ALTER TABLE "financial_periods" ADD COLUMN IF NOT EXISTS "member_count" INTEGER DEFAULT 0;
ALTER TABLE "financial_periods" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: fmv_audit_log (+9 cols) — domains\infrastructure\trust-fmv.ts
ALTER TABLE "fmv_audit_log" ADD COLUMN IF NOT EXISTS "action_description" TEXT DEFAULT '';
ALTER TABLE "fmv_audit_log" ADD COLUMN IF NOT EXISTS "procurement_request_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "fmv_audit_log" ADD COLUMN IF NOT EXISTS "bid_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "fmv_audit_log" ADD COLUMN IF NOT EXISTS "appraisal_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "fmv_audit_log" ADD COLUMN IF NOT EXISTS "performed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "fmv_audit_log" ADD COLUMN IF NOT EXISTS "performed_by_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "fmv_audit_log" ADD COLUMN IF NOT EXISTS "compliance_impact" VARCHAR(20) DEFAULT '';
ALTER TABLE "fmv_audit_log" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "fmv_audit_log" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';

-- ALTER: fmv_benchmarks (+16 cols) — domains\infrastructure\trust-fmv.ts
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "item_description" TEXT DEFAULT '';
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "item_specifications" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "fmv_low" NUMERIC DEFAULT 0;
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "fmv_high" NUMERIC DEFAULT 0;
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "fmv_median" NUMERIC DEFAULT 0;
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "region" VARCHAR(50) DEFAULT '';
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "city" VARCHAR(100) DEFAULT '';
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "effective_from" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "effective_to" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "data_sources" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "comparable_transactions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "cpi_adjusted" BOOLEAN DEFAULT false;
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "original_fmv" NUMERIC DEFAULT 0;
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "cpi_adjustment_factor" NUMERIC DEFAULT 0;
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "reviewed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "fmv_benchmarks" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: fmv_policy (+7 cols) — domains\infrastructure\trust-fmv.ts
ALTER TABLE "fmv_policy" ADD COLUMN IF NOT EXISTS "minimum_bids_required" VARCHAR(2) DEFAULT '';
ALTER TABLE "fmv_policy" ADD COLUMN IF NOT EXISTS "cpi_escalator_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "fmv_policy" ADD COLUMN IF NOT EXISTS "cpi_update_frequency" VARCHAR(20) DEFAULT '';
ALTER TABLE "fmv_policy" ADD COLUMN IF NOT EXISTS "cpi_base_year" VARCHAR(4) DEFAULT '';
ALTER TABLE "fmv_policy" ADD COLUMN IF NOT EXISTS "appraisal_required" BOOLEAN DEFAULT false;
ALTER TABLE "fmv_policy" ADD COLUMN IF NOT EXISTS "appraisal_threshold" NUMERIC DEFAULT 0;
ALTER TABLE "fmv_policy" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: fmv_violations (+10 cols) — domains\infrastructure\trust-fmv.ts
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "violation_description" TEXT DEFAULT '';
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "procurement_request_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "transaction_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "severity" VARCHAR(20) DEFAULT '';
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "resolution" TEXT DEFAULT '';
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "resolved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "detected_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "fmv_violations" ADD COLUMN IF NOT EXISTS "detected_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: fx_rate_audit_log (+8 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "fx_rate_audit_log" ADD COLUMN IF NOT EXISTS "action_description" TEXT DEFAULT '';
ALTER TABLE "fx_rate_audit_log" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "fx_rate_audit_log" ADD COLUMN IF NOT EXISTS "rate_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "fx_rate_audit_log" ADD COLUMN IF NOT EXISTS "old_rate" NUMERIC DEFAULT 0;
ALTER TABLE "fx_rate_audit_log" ADD COLUMN IF NOT EXISTS "new_rate" NUMERIC DEFAULT 0;
ALTER TABLE "fx_rate_audit_log" ADD COLUMN IF NOT EXISTS "performed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "fx_rate_audit_log" ADD COLUMN IF NOT EXISTS "performed_by_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "fx_rate_audit_log" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: gdpr_data_requests (+15 cols) — domains\compliance\gdpr.ts
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "request_type" TEXT DEFAULT '';
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "request_details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "requested_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "verification_method" TEXT DEFAULT '';
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "verified_by" TEXT DEFAULT '';
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "response_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT DEFAULT '';
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "processed_by" TEXT DEFAULT '';
ALTER TABLE "gdpr_data_requests" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: geofence_events (+7 cols) — domains\compliance\geofence.ts
ALTER TABLE "geofence_events" ADD COLUMN IF NOT EXISTS "geofence_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "geofence_events" ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(20) DEFAULT '';
ALTER TABLE "geofence_events" ADD COLUMN IF NOT EXISTS "event_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "geofence_events" ADD COLUMN IF NOT EXISTS "latitude" NUMERIC DEFAULT 0;
ALTER TABLE "geofence_events" ADD COLUMN IF NOT EXISTS "longitude" NUMERIC DEFAULT 0;
ALTER TABLE "geofence_events" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "geofence_events" ADD COLUMN IF NOT EXISTS "purpose" TEXT DEFAULT '';

-- ALTER: geofences (+11 cols) — domains\compliance\geofence.ts
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "center_latitude" NUMERIC DEFAULT 0;
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "center_longitude" NUMERIC DEFAULT 0;
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "radius_meters" NUMERIC DEFAULT 0;
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "strike_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "union_local_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "active_from" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "active_to" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "notify_on_entry" BOOLEAN DEFAULT false;
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "notify_on_exit" BOOLEAN DEFAULT false;
ALTER TABLE "geofences" ADD COLUMN IF NOT EXISTS "requires_explicit_consent" BOOLEAN DEFAULT false;

-- ALTER: gl_account_mappings (+13 cols) — domains\finance\accounting.ts
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "chart_of_accounts_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "local_account_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "local_transaction_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "gl_account_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "gl_department" VARCHAR(50) DEFAULT '';
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "gl_cost_center" VARCHAR(50) DEFAULT '';
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "erp_system_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "erp_account_code" VARCHAR(100) DEFAULT '';
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "debit_account" VARCHAR(50) DEFAULT '';
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "credit_account" VARCHAR(50) DEFAULT '';
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gl_account_mappings" ADD COLUMN IF NOT EXISTS "valid_to" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: gl_transaction_log (+19 cols) — domains\finance\accounting.ts
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "chart_of_accounts_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "transaction_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "transaction_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "debit_amount" NUMERIC DEFAULT 0;
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "credit_amount" NUMERIC DEFAULT 0;
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "cost_center_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "invoice_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "receipt_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "purchase_order_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "source_system" VARCHAR(100) DEFAULT '';
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "source_record_id" VARCHAR(100) DEFAULT '';
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "is_posted" BOOLEAN DEFAULT false;
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "posted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "posted_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "is_reconciled" BOOLEAN DEFAULT false;
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "reconciled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "reconciled_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "gl_transaction_log" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: gl_trial_balance (+12 cols) — domains\finance\accounting.ts
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "chart_of_accounts_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "period_end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "opening_balance" NUMERIC DEFAULT 0;
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "debit_total" NUMERIC DEFAULT 0;
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "credit_total" NUMERIC DEFAULT 0;
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "closing_balance" NUMERIC DEFAULT 0;
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "is_finalized" BOOLEAN DEFAULT false;
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "finalized_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "finalized_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "is_balanced" BOOLEAN DEFAULT false;
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "balance" NUMERIC DEFAULT 0;
ALTER TABLE "gl_trial_balance" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- CREATE: governance_bylaws (10 cols) — domains\governance\bylaws.ts
CREATE TABLE IF NOT EXISTS "governance_bylaws" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" VARCHAR(255),
  "article" VARCHAR(100),
  "title" TEXT,
  "content" TEXT,
  "version" INTEGER,
  "status" VARCHAR(20),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: governance_policies (11 cols) — domains\governance\governance-policies.ts
CREATE TABLE IF NOT EXISTS "governance_policies" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" VARCHAR(255),
  "title" TEXT,
  "category" VARCHAR(50),
  "description" TEXT,
  "content" TEXT,
  "status" VARCHAR(20),
  "updated_by" VARCHAR(255),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: governance_signatories (13 cols) — domains\governance\signatories.ts
CREATE TABLE IF NOT EXISTS "governance_signatories" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" VARCHAR(255),
  "name" VARCHAR(255),
  "role" VARCHAR(100),
  "title" VARCHAR(255),
  "authority" VARCHAR(50),
  "active_from" TIMESTAMPTZ,
  "active_to" TIMESTAMPTZ,
  "status" VARCHAR(20),
  "documents" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: grievance_approvals (+7 cols) — domains\claims\workflows.ts
ALTER TABLE "grievance_approvals" ADD COLUMN IF NOT EXISTS "approver_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_approvals" ADD COLUMN IF NOT EXISTS "approver_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "grievance_approvals" ADD COLUMN IF NOT EXISTS "action" VARCHAR(20) DEFAULT '';
ALTER TABLE "grievance_approvals" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_approvals" ADD COLUMN IF NOT EXISTS "comment" TEXT DEFAULT '';
ALTER TABLE "grievance_approvals" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT DEFAULT '';
ALTER TABLE "grievance_approvals" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: grievance_assignments (+11 cols) — domains\claims\workflows.ts
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT '';
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "assigned_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "accepted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "estimated_hours" NUMERIC DEFAULT 0;
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "actual_hours" NUMERIC DEFAULT 0;
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "assignment_reason" TEXT DEFAULT '';
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "grievance_assignments" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: grievance_communications (+20 cols) — domains\claims\workflows.ts
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "direction" VARCHAR(20) DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "from_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "from_external" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "to_user_ids" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "to_external" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "subject" VARCHAR(500) DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "body" TEXT DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "summary" TEXT DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "communication_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "duration_minutes" INTEGER DEFAULT 0;
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "attachment_ids" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "email_message_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "sms_message_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "calendar_event_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "is_important" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "requires_followup" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "followup_date" DATE DEFAULT NOW();
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "followup_completed" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "recorded_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_communications" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: grievance_deadlines (+30 cols) — domains\claims\workflows.ts
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "claim_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "stage_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "deadline_date" DATE DEFAULT NOW();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "deadline_time" TIME DEFAULT '00:00:00';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "assigned_to" TEXT DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "completed_by" TEXT DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "calculated_from" VARCHAR(100) DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "contract_clause_reference" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "days_from_source" INTEGER DEFAULT 0;
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "is_met" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "met_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "is_extended" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "extension_reason" TEXT DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "extended_to" DATE DEFAULT NOW();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "reminder_days" INTEGER DEFAULT 0;
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "reminder_schedule" INTEGER DEFAULT 0;
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "escalate_on_miss" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "escalate_to" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "escalated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "grievance_deadlines" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: grievance_documents (+27 cols) — domains\claims\workflows.ts
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "document_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "file_path" TEXT DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "file_size" BIGINT DEFAULT 0;
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "mime_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 0;
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "parent_document_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "is_latest_version" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "version_status" TEXT DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "is_confidential" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "access_level" VARCHAR(50) DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "requires_signature" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "signature_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "signed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "signature_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "ocr_text" TEXT DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "indexed" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "uploaded_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "uploaded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "reviewed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "retention_period_days" INTEGER DEFAULT 0;
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_documents" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- CREATE: grievance_events (6 cols) — domains\claims\grievance-lifecycle.ts
CREATE TABLE IF NOT EXISTS "grievance_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "grievance_id" UUID,
  "event_type" TEXT,
  "actor_user_id" UUID,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ
);

-- ALTER: grievance_settlements (+32 cols) — domains\claims\workflows.ts
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "monetary_amount" NUMERIC DEFAULT 0;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "payment_schedule" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "terms_description" TEXT DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "terms_structured" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "proposed_by" VARCHAR(50) DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "proposed_by_user" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "proposed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "responded_by" VARCHAR(50) DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "responded_by_user" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "responded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "response_notes" TEXT DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "requires_member_approval" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "member_approved" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "member_approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "requires_union_approval" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "union_approved" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "union_approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "union_approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "requires_management_approval" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "management_approved" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "management_approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "management_approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "finalized_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "finalized_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "settlement_document_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "signed_agreement_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "set_precedent" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "precedent_description" TEXT DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "grievance_settlements" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: grievance_stages (+17 cols) — domains\claims\workflows.ts
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "workflow_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "stage_type" TEXT DEFAULT '';
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 0;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "is_required" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "sla_days" INTEGER DEFAULT 0;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "auto_transition" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "require_approval" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "next_stage_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "conditions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "entry_actions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "exit_actions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "notify_on_entry" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "notify_on_deadline" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "notification_template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_stages" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: grievance_timeline (+1 cols) — domains\claims\grievances.ts
ALTER TABLE "grievance_timeline" ADD COLUMN IF NOT EXISTS "created_by" UUID DEFAULT gen_random_uuid();

-- ALTER: grievance_workflows (+11 cols) — domains\claims\workflows.ts
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "grievance_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "contract_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "auto_assign" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "require_approval" BOOLEAN DEFAULT false;
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "sla_days" INTEGER DEFAULT 0;
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "stages" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "grievance_workflows" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: gss_applications (+1 cols) — domains\compliance\immigration.ts
ALTER TABLE "gss_applications" ADD COLUMN IF NOT EXISTS "met_2_week_target" BOOLEAN DEFAULT false;

-- ALTER: holidays (+6 cols) — deadlines-schema.ts
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "holiday_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "holiday_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "holiday_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "is_recurring" BOOLEAN DEFAULT false;
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "applies_to" VARCHAR(100) DEFAULT '';
ALTER TABLE "holidays" ADD COLUMN IF NOT EXISTS "is_observed" BOOLEAN DEFAULT false;

-- ALTER: impact_metrics (+7 cols) — domains\marketing.ts
ALTER TABLE "impact_metrics" ADD COLUMN IF NOT EXISTS "metric_type" TEXT DEFAULT '';
ALTER TABLE "impact_metrics" ADD COLUMN IF NOT EXISTS "value" NUMERIC DEFAULT 0;
ALTER TABLE "impact_metrics" ADD COLUMN IF NOT EXISTS "comparison_value" NUMERIC DEFAULT 0;
ALTER TABLE "impact_metrics" ADD COLUMN IF NOT EXISTS "unit" TEXT DEFAULT '';
ALTER TABLE "impact_metrics" ADD COLUMN IF NOT EXISTS "period" TEXT DEFAULT '';
ALTER TABLE "impact_metrics" ADD COLUMN IF NOT EXISTS "visibility" TEXT DEFAULT '';
ALTER TABLE "impact_metrics" ADD COLUMN IF NOT EXISTS "anonymized" BOOLEAN DEFAULT false;

-- ALTER: independent_appraisals (+16 cols) — domains\infrastructure\trust-fmv.ts
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "item_description" TEXT DEFAULT '';
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "item_specifications" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "procurement_request_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraiser_name" TEXT DEFAULT '';
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraiser_company" TEXT DEFAULT '';
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraiser_credentials" TEXT DEFAULT '';
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraiser_contact" TEXT DEFAULT '';
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraised_value" NUMERIC DEFAULT 0;
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraisal_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraisal_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraisal_valid_until" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraisal_report" TEXT DEFAULT '';
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "appraisal_notes" TEXT DEFAULT '';
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "reviewed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "independent_appraisals" ADD COLUMN IF NOT EXISTS "review_notes" TEXT DEFAULT '';

-- ALTER: indigenous_data_access_log (+9 cols) — domains\compliance\indigenous-data.ts
ALTER TABLE "indigenous_data_access_log" ADD COLUMN IF NOT EXISTS "accessed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "indigenous_data_access_log" ADD COLUMN IF NOT EXISTS "band_council_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "indigenous_data_access_log" ADD COLUMN IF NOT EXISTS "access_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "indigenous_data_access_log" ADD COLUMN IF NOT EXISTS "access_purpose" TEXT DEFAULT '';
ALTER TABLE "indigenous_data_access_log" ADD COLUMN IF NOT EXISTS "data_categories" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "indigenous_data_access_log" ADD COLUMN IF NOT EXISTS "authorized_by" VARCHAR(50) DEFAULT '';
ALTER TABLE "indigenous_data_access_log" ADD COLUMN IF NOT EXISTS "authorization_reference" TEXT DEFAULT '';
ALTER TABLE "indigenous_data_access_log" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "indigenous_data_access_log" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';

-- ALTER: indigenous_data_sharing_agreements (+15 cols) — domains\compliance\indigenous-data.ts
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "agreement_title" TEXT DEFAULT '';
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "agreement_description" TEXT DEFAULT '';
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "agreement_document" TEXT DEFAULT '';
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "signed_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "data_sharing_scope" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "purpose_limitation" TEXT DEFAULT '';
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "anonymization_required" BOOLEAN DEFAULT false;
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "valid_from" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "valid_until" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "auto_renewal" BOOLEAN DEFAULT false;
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "bcr_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "terminated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "indigenous_data_sharing_agreements" ADD COLUMN IF NOT EXISTS "termination_reason" TEXT DEFAULT '';

-- ALTER: indigenous_member_data (+11 cols) — domains\compliance\indigenous-data.ts
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "indigenous_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "band_council_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "treaty_number" VARCHAR(20) DEFAULT '';
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "cultural_data_sensitivity" VARCHAR(20) DEFAULT '';
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "traditional_knowledge_holder" BOOLEAN DEFAULT false;
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "elder_status" BOOLEAN DEFAULT false;
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "data_control_preference" VARCHAR(50) DEFAULT '';
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "allow_aggregation" BOOLEAN DEFAULT false;
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "allow_third_party_access" BOOLEAN DEFAULT false;
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "on_reserve_data_only" BOOLEAN DEFAULT false;
ALTER TABLE "indigenous_member_data" ADD COLUMN IF NOT EXISTS "preferred_storage_location" TEXT DEFAULT '';

-- ALTER: insight_recommendations (+23 cols) — analytics.ts
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "insight_type" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "data_source" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "metrics" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "trend" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "impact" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "recommendations" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "action_required" BOOLEAN DEFAULT false;
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "action_deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "estimated_benefit" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "confidence_score" NUMERIC DEFAULT 0;
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "related_entities" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "acknowledged_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "acknowledged_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "dismissed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "dismissed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "dismissal_reason" TEXT DEFAULT '';
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "insight_recommendations" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: integration_api_keys (+6 cols) — domains\infrastructure\integrations.ts
ALTER TABLE "integration_api_keys" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "integration_api_keys" ADD COLUMN IF NOT EXISTS "key_hash" VARCHAR(64) DEFAULT '';
ALTER TABLE "integration_api_keys" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "integration_api_keys" ADD COLUMN IF NOT EXISTS "usage_count" INTEGER DEFAULT 0;
ALTER TABLE "integration_api_keys" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "integration_api_keys" ADD COLUMN IF NOT EXISTS "revoked_by" VARCHAR(255) DEFAULT '';

-- ALTER: integration_sync_logs (+2 cols) — integration-schema.ts
ALTER TABLE "integration_sync_logs" ADD COLUMN IF NOT EXISTS "triggered_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "integration_sync_logs" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- CREATE: international_addresses (42 cols) — domains\infrastructure\addresses.ts
CREATE TABLE IF NOT EXISTS "international_addresses" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "user_id" TEXT,
  "address_type" TEXT,
  "status" TEXT,
  "country_code" TEXT,
  "country_name" TEXT,
  "address_line_1" TEXT,
  "address_line_2" TEXT,
  "address_line_3" TEXT,
  "locality" TEXT,
  "locality_type" TEXT,
  "administrative_area" TEXT,
  "administrative_area_type" TEXT,
  "postal_code" TEXT,
  "postal_code_type" TEXT,
  "sub_administrative_area" TEXT,
  "dependent_locality" TEXT,
  "sorting_code" TEXT,
  "formatted_address" TEXT,
  "local_format" TEXT,
  "latitude" TEXT,
  "longitude" TEXT,
  "geocoded_at" TIMESTAMPTZ,
  "geocode_provider" TEXT,
  "geocode_accuracy" TEXT,
  "is_validated" BOOLEAN,
  "validated_by" TEXT,
  "validated_at" TIMESTAMPTZ,
  "validation_result" JSONB,
  "is_standardized" BOOLEAN,
  "standardized_by" TEXT,
  "standardized_at" TIMESTAMPTZ,
  "standardized_data" JSONB,
  "deliverability" TEXT,
  "delivery_point" TEXT,
  "carrier_route" TEXT,
  "metadata" JSONB,
  "is_primary" BOOLEAN,
  "notes" TEXT,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: job_applications (+28 cols) — cms-website-schema.ts
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "job_posting_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "profile_id" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "first_name" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "last_name" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "email" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "phone" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "resume_url" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "cover_letter_url" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "cover_letter_text" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "linkedin_url" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "portfolio_url" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "years_experience" INTEGER DEFAULT 0;
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "current_employer" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "current_position" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "availability_date" DATE DEFAULT NOW();
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "salary_expectation" NUMERIC DEFAULT 0;
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "willing_to_relocate" BOOLEAN DEFAULT false;
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "is_union_member" BOOLEAN DEFAULT false;
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "union_local" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "custom_responses" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "application_status" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "status_notes" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "viewed_by" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "viewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "interview_scheduled_for" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT '';
ALTER TABLE "job_applications" ADD COLUMN IF NOT EXISTS "applied_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: job_classifications (+12 cols) — domains\member\member-employment.ts
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "job_title" VARCHAR(255) DEFAULT '';
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "job_family" VARCHAR(255) DEFAULT '';
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "job_level" INTEGER DEFAULT 0;
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "minimum_rate" NUMERIC DEFAULT 0;
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "maximum_rate" NUMERIC DEFAULT 0;
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "standard_rate" NUMERIC DEFAULT 0;
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "requirements" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "effective_date" DATE DEFAULT NOW();
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "expiry_date" DATE DEFAULT NOW();
ALTER TABLE "job_classifications" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: job_postings (+45 cols) — cms-website-schema.ts
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "slug" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "employer_name" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "employer_logo" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "employer_website" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "job_type" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "responsibilities" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "qualifications" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "benefits" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "salary_min" NUMERIC DEFAULT 0;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "salary_max" NUMERIC DEFAULT 0;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "salary_currency" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "salary_period" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "salary_display" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "location_type" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "city" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "province" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "country" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "remote_allowed" BOOLEAN DEFAULT false;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "experience_level" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "education_required" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "union_affiliation_required" BOOLEAN DEFAULT false;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "union_name" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "contact_name" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "contact_email" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "contact_phone" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "application_method" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "application_email" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "application_url" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "application_instructions" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "requires_resume" BOOLEAN DEFAULT false;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "requires_cover_letter" BOOLEAN DEFAULT false;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "custom_questions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN DEFAULT false;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "views_count" INTEGER DEFAULT 0;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "applications_count" INTEGER DEFAULT 0;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "posted_date" DATE DEFAULT NOW();
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "closing_date" DATE DEFAULT NOW();
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "filled_date" DATE DEFAULT NOW();
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "seo_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "job_postings" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: job_saved (+3 cols) — cms-website-schema.ts
ALTER TABLE "job_saved" ADD COLUMN IF NOT EXISTS "profile_id" TEXT DEFAULT '';
ALTER TABLE "job_saved" ADD COLUMN IF NOT EXISTS "job_posting_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "job_saved" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: key_holder_registry (+17 cols) — domains\compliance\force-majeure.ts
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) DEFAULT '';
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "key_holder_number" INTEGER DEFAULT 0;
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "shamir_share_encrypted" TEXT DEFAULT '';
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "shamir_share_fingerprint" VARCHAR(64) DEFAULT '';
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "key_issued_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "key_expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "key_rotation_due" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "break_glass_training_completed" BOOLEAN DEFAULT false;
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "training_completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "training_expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "emergency_phone" VARCHAR(20) DEFAULT '';
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "emergency_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "backup_contact_name" TEXT DEFAULT '';
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "backup_contact_phone" VARCHAR(20) DEFAULT '';
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "last_verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "key_holder_registry" ADD COLUMN IF NOT EXISTS "next_verification_due" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: knowledge_base (+21 cols) — ai-chatbot-schema.ts
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "document_type" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "summary" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "source_type" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "source_id" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "source_url" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "embedding" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "embedding_model" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "keywords" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "language" TEXT DEFAULT '';
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 0;
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "previous_version_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN DEFAULT false;
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "allowed_organizations" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "view_count" INTEGER DEFAULT 0;
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "citation_count" INTEGER DEFAULT 0;
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "knowledge_base" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: knowledge_base_articles (+20 cols) — domains\infrastructure\support.ts
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(500) DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "summary" TEXT DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "subcategory" VARCHAR(100) DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "visibility" VARCHAR(50) DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "view_count" INTEGER DEFAULT 0;
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "helpful_count" INTEGER DEFAULT 0;
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "not_helpful_count" INTEGER DEFAULT 0;
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "meta_description" TEXT DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "meta_keywords" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 0;
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "last_reviewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "author_user_id" TEXT DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "author_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "knowledge_base_articles" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- ALTER: kpi_configurations (+16 cols) — analytics.ts
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "metric_type" TEXT DEFAULT '';
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "data_source" TEXT DEFAULT '';
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "calculation" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "visualization_type" TEXT DEFAULT '';
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "target_value" NUMERIC DEFAULT 0;
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "warning_threshold" NUMERIC DEFAULT 0;
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "critical_threshold" NUMERIC DEFAULT 0;
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "alert_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "alert_recipients" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "refresh_interval" INTEGER DEFAULT 0;
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "display_order" INTEGER DEFAULT 0;
ALTER TABLE "kpi_configurations" ADD COLUMN IF NOT EXISTS "dashboard_layout" JSONB DEFAULT '{}'::jsonb;

-- ALTER: legal_holds (+19 cols) — policy-engine-schema.ts
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "case_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "data_types" TEXT DEFAULT '';
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "date_range_start" DATE DEFAULT NOW();
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "date_range_end" DATE DEFAULT NOW();
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "custodians" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "issued_date" DATE DEFAULT NOW();
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "released_date" DATE DEFAULT NOW();
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "expiration_date" DATE DEFAULT NOW();
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "legal_authority" TEXT DEFAULT '';
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "attorney" VARCHAR(255) DEFAULT '';
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "matter_description" TEXT DEFAULT '';
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "notifications_sent" BOOLEAN DEFAULT false;
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "notifications_sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "released_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "legal_holds" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: license_renewals (+11 cols) — certification-management-schema.ts
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "renewal_due_date" DATE DEFAULT NOW();
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "renewal_submitted_date" DATE DEFAULT NOW();
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "renewal_approved_date" DATE DEFAULT NOW();
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "renewal_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "ce_requirements_met" BOOLEAN DEFAULT false;
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "fee_paid" BOOLEAN DEFAULT false;
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "application_complete" BOOLEAN DEFAULT false;
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "renewal_application" TEXT DEFAULT '';
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "payment_receipt" TEXT DEFAULT '';
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "approval_letter" TEXT DEFAULT '';
ALTER TABLE "license_renewals" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: lmbp_compliance_alerts (+3 cols) — domains\compliance\immigration.ts
ALTER TABLE "lmbp_compliance_alerts" ADD COLUMN IF NOT EXISTS "email_sent" BOOLEAN DEFAULT false;
ALTER TABLE "lmbp_compliance_alerts" ADD COLUMN IF NOT EXISTS "email_sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "lmbp_compliance_alerts" ADD COLUMN IF NOT EXISTS "dashboard_notified" BOOLEAN DEFAULT false;

-- ALTER: lmbp_compliance_reports (+6 cols) — domains\compliance\immigration.ts
ALTER TABLE "lmbp_compliance_reports" ADD COLUMN IF NOT EXISTS "compliance_rating" TEXT DEFAULT '';
ALTER TABLE "lmbp_compliance_reports" ADD COLUMN IF NOT EXISTS "ircc_feedback" TEXT DEFAULT '';
ALTER TABLE "lmbp_compliance_reports" ADD COLUMN IF NOT EXISTS "corrective_actions_required" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "lmbp_compliance_reports" ADD COLUMN IF NOT EXISTS "report_pdf_url" TEXT DEFAULT '';
ALTER TABLE "lmbp_compliance_reports" ADD COLUMN IF NOT EXISTS "supporting_documents_urls" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "lmbp_compliance_reports" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: location_deletion_log (+7 cols) — domains\compliance\geofence.ts
ALTER TABLE "location_deletion_log" ADD COLUMN IF NOT EXISTS "deletion_reason" TEXT DEFAULT '';
ALTER TABLE "location_deletion_log" ADD COLUMN IF NOT EXISTS "record_count" VARCHAR(20) DEFAULT '';
ALTER TABLE "location_deletion_log" ADD COLUMN IF NOT EXISTS "oldest_record_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "location_deletion_log" ADD COLUMN IF NOT EXISTS "newest_record_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "location_deletion_log" ADD COLUMN IF NOT EXISTS "initiated_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "location_deletion_log" ADD COLUMN IF NOT EXISTS "initiator_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "location_deletion_log" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: location_tracking (+16 cols) — domains\compliance\geofence.ts
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "latitude" NUMERIC DEFAULT 0;
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "longitude" NUMERIC DEFAULT 0;
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "accuracy" NUMERIC DEFAULT 0;
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "altitude" NUMERIC DEFAULT 0;
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "recorded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "auto_delete_scheduled" BOOLEAN DEFAULT false;
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "tracking_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "purpose" TEXT DEFAULT '';
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "activity_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "strike_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "event_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "shared_with_union" BOOLEAN DEFAULT false;
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "aggregated_only" BOOLEAN DEFAULT false;
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "device_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "location_tracking" ADD COLUMN IF NOT EXISTS "app_version" VARCHAR(20) DEFAULT '';

-- ALTER: location_tracking_audit (+7 cols) — domains\compliance\geofence.ts
ALTER TABLE "location_tracking_audit" ADD COLUMN IF NOT EXISTS "action_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "location_tracking_audit" ADD COLUMN IF NOT EXISTS "action_description" TEXT DEFAULT '';
ALTER TABLE "location_tracking_audit" ADD COLUMN IF NOT EXISTS "performed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "location_tracking_audit" ADD COLUMN IF NOT EXISTS "performed_by_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "location_tracking_audit" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "location_tracking_audit" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "location_tracking_audit" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: location_tracking_config (+10 cols) — domains\compliance\geofence.ts
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "background_tracking_allowed" BOOLEAN DEFAULT false;
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "background_tracking_reason" TEXT DEFAULT '';
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "explicit_opt_in_required" BOOLEAN DEFAULT false;
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "consent_renewal_months" VARCHAR(10) DEFAULT '';
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "auto_deletion_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "auto_deletion_schedule" VARCHAR(50) DEFAULT '';
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "compliance_review_required" BOOLEAN DEFAULT false;
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "last_compliance_review" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "next_compliance_review_due" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "location_tracking_config" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: lrb_agreements (+8 cols) — domains\data\lrb.ts
ALTER TABLE "lrb_agreements" ADD COLUMN IF NOT EXISTS "agreement_date" VARCHAR(20) DEFAULT '';
ALTER TABLE "lrb_agreements" ADD COLUMN IF NOT EXISTS "ratification_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "lrb_agreements" ADD COLUMN IF NOT EXISTS "hourly_wage_range" VARCHAR(100) DEFAULT '';
ALTER TABLE "lrb_agreements" ADD COLUMN IF NOT EXISTS "annual_salary_range" VARCHAR(100) DEFAULT '';
ALTER TABLE "lrb_agreements" ADD COLUMN IF NOT EXISTS "pdf_url" VARCHAR(1000) DEFAULT '';
ALTER TABLE "lrb_agreements" ADD COLUMN IF NOT EXISTS "html_url" VARCHAR(1000) DEFAULT '';
ALTER TABLE "lrb_agreements" ADD COLUMN IF NOT EXISTS "json_url" VARCHAR(1000) DEFAULT '';
ALTER TABLE "lrb_agreements" ADD COLUMN IF NOT EXISTS "embedding_vector" TEXT DEFAULT '';

-- ALTER: lrb_employers (+1 cols) — domains\data\lrb.ts
ALTER TABLE "lrb_employers" ADD COLUMN IF NOT EXISTS "employer_name_alt" VARCHAR(500) DEFAULT '';

-- ALTER: lrb_sync_log (+3 cols) — domains\data\lrb.ts
ALTER TABLE "lrb_sync_log" ADD COLUMN IF NOT EXISTS "sync_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "lrb_sync_log" ADD COLUMN IF NOT EXISTS "parameters" TEXT DEFAULT '';
ALTER TABLE "lrb_sync_log" ADD COLUMN IF NOT EXISTS "initiated_by" VARCHAR(100) DEFAULT '';

-- ALTER: meeting_rooms (+25 cols) — calendar-schema.ts
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "display_name" TEXT DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "building_name" VARCHAR(200) DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "floor" VARCHAR(50) DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "room_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "address" TEXT DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "capacity" INTEGER DEFAULT 0;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "features" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "equipment" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "requires_approval" BOOLEAN DEFAULT false;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "min_booking_duration" INTEGER DEFAULT 0;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "max_booking_duration" INTEGER DEFAULT 0;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "advance_booking_days" INTEGER DEFAULT 0;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "operating_hours" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "allowed_user_roles" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "blocked_dates" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "contact_person_id" TEXT DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "contact_email" TEXT DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "contact_phone" VARCHAR(20) DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "image_url" TEXT DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "floor_plan_url" TEXT DEFAULT '';
ALTER TABLE "meeting_rooms" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: member_addresses (+9 cols) — domains\member\addresses.ts
ALTER TABLE "member_addresses" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_addresses" ADD COLUMN IF NOT EXISTS "address_type" VARCHAR(20) DEFAULT '';
ALTER TABLE "member_addresses" ADD COLUMN IF NOT EXISTS "street_address" TEXT DEFAULT '';
ALTER TABLE "member_addresses" ADD COLUMN IF NOT EXISTS "city" VARCHAR(100) DEFAULT '';
ALTER TABLE "member_addresses" ADD COLUMN IF NOT EXISTS "province" VARCHAR(2) DEFAULT '';
ALTER TABLE "member_addresses" ADD COLUMN IF NOT EXISTS "postal_code" VARCHAR(10) DEFAULT '';
ALTER TABLE "member_addresses" ADD COLUMN IF NOT EXISTS "country" VARCHAR(2) DEFAULT '';
ALTER TABLE "member_addresses" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN DEFAULT false;
ALTER TABLE "member_addresses" ADD COLUMN IF NOT EXISTS "effective_date" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: member_arrears (+14 cols) — dues-finance-schema.ts
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "over_30_days" NUMERIC DEFAULT 0;
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "over_60_days" NUMERIC DEFAULT 0;
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "over_90_days" NUMERIC DEFAULT 0;
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "in_grace_period" BOOLEAN DEFAULT false;
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "grace_period_ends" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "arrears_status" TEXT DEFAULT '';
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "first_arrears_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "last_payment_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "suspension_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "reinstatement_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "has_payment_plan" BOOLEAN DEFAULT false;
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "payment_plan_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "member_arrears" ADD COLUMN IF NOT EXISTS "last_calculated_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: member_certifications (+26 cols) — domains\scheduling\training.ts
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "certification_name" VARCHAR(200) DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "certification_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "issued_by_organization" VARCHAR(200) DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "certification_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "issue_date" DATE DEFAULT NOW();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "expiry_date" DATE DEFAULT NOW();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "valid_years" INTEGER DEFAULT 0;
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "certification_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "course_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "session_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "registration_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "renewal_required" BOOLEAN DEFAULT false;
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "renewal_date" DATE DEFAULT NOW();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "renewal_course_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN DEFAULT false;
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "verification_date" DATE DEFAULT NOW();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "certificate_url" TEXT DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "digital_badge_url" TEXT DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "clc_registered" BOOLEAN DEFAULT false;
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "clc_registration_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "clc_registration_date" DATE DEFAULT NOW();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "revoked" BOOLEAN DEFAULT false;
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "revocation_date" DATE DEFAULT NOW();
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "revocation_reason" TEXT DEFAULT '';
ALTER TABLE "member_certifications" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- CREATE: member_consents (19 cols) — member-profile-v2-schema.ts
CREATE TABLE IF NOT EXISTS "member_consents" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "organization_id" UUID,
  "consent_type" TEXT,
  "consent_category" TEXT,
  "granted" BOOLEAN,
  "granted_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "consent_version" TEXT,
  "consent_text" TEXT,
  "consent_method" TEXT,
  "ip_address" TEXT,
  "user_agent" TEXT,
  "witnessed_by" TEXT,
  "expires_at" TIMESTAMPTZ,
  "requires_renewal" BOOLEAN,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "created_by" TEXT
);

-- CREATE: member_contact_preferences (23 cols) — member-profile-v2-schema.ts
CREATE TABLE IF NOT EXISTS "member_contact_preferences" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "organization_id" UUID,
  "preferred_contact_method" TEXT,
  "preferred_language" TEXT,
  "email_opt_in" BOOLEAN,
  "sms_opt_in" BOOLEAN,
  "phone_opt_in" BOOLEAN,
  "mail_opt_in" BOOLEAN,
  "notification_preferences" JSONB,
  "best_contact_times" JSONB,
  "alternative_email" TEXT,
  "alternative_phone" TEXT,
  "emergency_contact_name" TEXT,
  "emergency_contact_phone" TEXT,
  "emergency_contact_relation" TEXT,
  "accessibility_needs" TEXT,
  "interpreter_required" BOOLEAN,
  "interpreter_language" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ,
  "last_modified_by" TEXT
);

-- ALTER: member_documents (+17 cols) — member-profile-v2-schema.ts
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "document_type" TEXT DEFAULT '';
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "document_name" TEXT DEFAULT '';
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "document_number" TEXT DEFAULT '';
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "mime_type" TEXT DEFAULT '';
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "file_hash" TEXT DEFAULT '';
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "issue_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "expiry_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "is_expired" BOOLEAN DEFAULT false;
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "verified" BOOLEAN DEFAULT false;
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "verified_by" TEXT DEFAULT '';
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "verification_notes" TEXT DEFAULT '';
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "confidentiality_level" TEXT DEFAULT '';
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "member_documents" ADD COLUMN IF NOT EXISTS "uploaded_by" TEXT DEFAULT '';

-- ALTER: member_dues_ledger (+20 cols) — dues-finance-schema.ts
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "balance_before" NUMERIC DEFAULT 0;
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "balance_after" NUMERIC DEFAULT 0;
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "period_end" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "fiscal_year" INTEGER DEFAULT 0;
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "fiscal_month" INTEGER DEFAULT 0;
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "reference_type" TEXT DEFAULT '';
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "reference_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "invoice_number" TEXT DEFAULT '';
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "receipt_number" TEXT DEFAULT '';
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "payment_method" TEXT DEFAULT '';
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "payment_reference" TEXT DEFAULT '';
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "is_reversed" BOOLEAN DEFAULT false;
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "reversal_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "reversed_transaction_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "member_dues_ledger" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: member_employment (+30 cols) — domains\member\member-employment.ts
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "adjusted_seniority_date" DATE DEFAULT NOW();
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "seniority_adjustment_reason" TEXT DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "job_title" VARCHAR(255) DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "job_code" VARCHAR(100) DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "job_classification" VARCHAR(255) DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "job_level" INTEGER DEFAULT 0;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "department" VARCHAR(255) DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "division" VARCHAR(255) DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "pay_frequency" TEXT DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "hourly_rate" NUMERIC DEFAULT 0;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "base_salary" NUMERIC DEFAULT 0;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "gross_wages" NUMERIC DEFAULT 0;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "regular_hours_per_week" NUMERIC DEFAULT 0;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "regular_hours_per_period" NUMERIC DEFAULT 0;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "shift_type" TEXT DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "shift_start_time" VARCHAR(10) DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "shift_end_time" VARCHAR(10) DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "operates_weekends" BOOLEAN DEFAULT false;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "operates_24_hours" BOOLEAN DEFAULT false;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "supervisor_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "supervisor_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "is_probationary" BOOLEAN DEFAULT false;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "probation_end_date" DATE DEFAULT NOW();
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "checkoff_authorized" BOOLEAN DEFAULT false;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "checkoff_date" DATE DEFAULT NOW();
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "rand_exempt" BOOLEAN DEFAULT false;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "member_employment" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- CREATE: member_employment_details (38 cols) — member-profile-v2-schema.ts
CREATE TABLE IF NOT EXISTS "member_employment_details" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "organization_id" UUID,
  "classification" TEXT,
  "job_title" TEXT,
  "job_code" TEXT,
  "pay_grade" TEXT,
  "work_location_id" UUID,
  "department" TEXT,
  "division" TEXT,
  "cost_center" TEXT,
  "seniority_date" TIMESTAMPTZ,
  "seniority_years" INTEGER,
  "seniority_points" INTEGER,
  "shift_type" TEXT,
  "shift_start" TEXT,
  "shift_end" TEXT,
  "work_days" JSONB,
  "hours_per_week" INTEGER,
  "supervisor_name" TEXT,
  "supervisor_id" UUID,
  "supervisor_contact" TEXT,
  "employment_status" TEXT,
  "status_effective_date" TIMESTAMPTZ,
  "status_reason" TEXT,
  "expected_return_date" TIMESTAMPTZ,
  "benefits_eligible" BOOLEAN,
  "benefits_enrollment_date" TIMESTAMPTZ,
  "pension_plan_enrolled" BOOLEAN,
  "probation_end_date" TIMESTAMPTZ,
  "is_probationary" BOOLEAN,
  "steward" BOOLEAN,
  "officer" BOOLEAN,
  "committee_member" BOOLEAN,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ,
  "last_modified_by" TEXT
);

-- CREATE: member_history_events (16 cols) — member-profile-v2-schema.ts
CREATE TABLE IF NOT EXISTS "member_history_events" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "organization_id" UUID,
  "event_type" TEXT,
  "event_category" TEXT,
  "event_date" TIMESTAMPTZ,
  "event_title" TEXT,
  "event_description" TEXT,
  "event_data" JSONB,
  "actor_id" TEXT,
  "actor_name" TEXT,
  "is_public" BOOLEAN,
  "visible_to_member" BOOLEAN,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "created_by" TEXT
);

-- ALTER: member_leaves (+9 cols) — domains\member\member-employment.ts
ALTER TABLE "member_leaves" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_leaves" ADD COLUMN IF NOT EXISTS "affects_seniority" BOOLEAN DEFAULT false;
ALTER TABLE "member_leaves" ADD COLUMN IF NOT EXISTS "seniority_adjustment_days" INTEGER DEFAULT 0;
ALTER TABLE "member_leaves" ADD COLUMN IF NOT EXISTS "affects_dues" BOOLEAN DEFAULT false;
ALTER TABLE "member_leaves" ADD COLUMN IF NOT EXISTS "dues_waiver_approved" BOOLEAN DEFAULT false;
ALTER TABLE "member_leaves" ADD COLUMN IF NOT EXISTS "reason" TEXT DEFAULT '';
ALTER TABLE "member_leaves" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "member_leaves" ADD COLUMN IF NOT EXISTS "documents" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "member_leaves" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: member_location_consent (+18 cols) — domains\compliance\geofence.ts
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "consent_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "opted_in_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "opted_out_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "consent_purpose" TEXT DEFAULT '';
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "purpose_description" TEXT DEFAULT '';
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "foreground_only" BOOLEAN DEFAULT false;
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "allowed_during_strike" BOOLEAN DEFAULT false;
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "allowed_during_events" BOOLEAN DEFAULT false;
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "can_revoke_anytime" BOOLEAN DEFAULT false;
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "data_retention_hours" VARCHAR(10) DEFAULT '';
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "auto_delete_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "renewal_required" BOOLEAN DEFAULT false;
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "last_renewal_reminder" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "consent_text" TEXT DEFAULT '';
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "consent_version" VARCHAR(10) DEFAULT '';
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "member_location_consent" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';

-- ALTER: member_relationship_scores (+16 cols) — domains\communications\organizer-workflows.ts
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "member_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "overall_score" INTEGER DEFAULT 0;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "engagement_score" INTEGER DEFAULT 0;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "relationship_score" INTEGER DEFAULT 0;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "activity_score" INTEGER DEFAULT 0;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "last_contact_date" DATE DEFAULT NOW();
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "total_interactions" INTEGER DEFAULT 0;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "interactions_last_30_days" INTEGER DEFAULT 0;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "field_notes_count" INTEGER DEFAULT 0;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "positive_notes_count" INTEGER DEFAULT 0;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "negative_notes_count" INTEGER DEFAULT 0;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "average_sentiment" VARCHAR(50) DEFAULT '';
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "current_sentiment" TEXT DEFAULT '';
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "is_at_risk" BOOLEAN DEFAULT false;
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "at_risk_reason" TEXT DEFAULT '';
ALTER TABLE "member_relationship_scores" ADD COLUMN IF NOT EXISTS "calculated_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: message_log (+20 cols) — domains\communications\campaigns.ts
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "recipient_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "recipient_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "recipient_phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "recipient_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "channel_type" TEXT DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "provider" VARCHAR(50) DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "provider_message_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "subject" VARCHAR(500) DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "body_snippet" TEXT DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "error_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0;
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "opened_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "clicked_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "bounced_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "message_log" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: message_notifications (+4 cols) — domains\communications\messages.ts
ALTER TABLE "message_notifications" ADD COLUMN IF NOT EXISTS "thread_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "message_notifications" ADD COLUMN IF NOT EXISTS "is_read" BOOLEAN DEFAULT false;
ALTER TABLE "message_notifications" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "message_notifications" ADD COLUMN IF NOT EXISTS "notified_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: message_participants (+6 cols) — domains\communications\messages.ts
ALTER TABLE "message_participants" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "message_participants" ADD COLUMN IF NOT EXISTS "role" TEXT DEFAULT '';
ALTER TABLE "message_participants" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "message_participants" ADD COLUMN IF NOT EXISTS "last_read_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "message_participants" ADD COLUMN IF NOT EXISTS "joined_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "message_participants" ADD COLUMN IF NOT EXISTS "left_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: message_read_receipts (+2 cols) — domains\communications\messages.ts
ALTER TABLE "message_read_receipts" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "message_read_receipts" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: message_templates (+16 cols) — domains\communications\campaigns.ts
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "subject" VARCHAR(500) DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "body" TEXT DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "preheader" TEXT DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "variables" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "html_content" TEXT DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "plain_text_content" TEXT DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "message_templates" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: messages (+13 cols) — domains\communications\messages.ts
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "thread_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender_id" TEXT DEFAULT '';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "sender_role" TEXT DEFAULT '';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "message_type" TEXT DEFAULT '';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "file_url" TEXT DEFAULT '';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "file_name" TEXT DEFAULT '';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "file_size" TEXT DEFAULT '';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "is_edited" BOOLEAN DEFAULT false;
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "edited_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "messages" ADD COLUMN IF NOT EXISTS "metadata" TEXT DEFAULT '';

-- CREATE: mfa_configurations (19 cols) — sso-scim-schema.ts
CREATE TABLE IF NOT EXISTS "mfa_configurations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" UUID,
  "organization_id" UUID,
  "method_type" VARCHAR(50),
  "totp_secret" TEXT,
  "totp_backup_codes" TEXT,
  "webauthn_credential_id" TEXT,
  "webauthn_public_key" TEXT,
  "webauthn_counter" INTEGER,
  "phone_number" VARCHAR(50),
  "email_address" VARCHAR(255),
  "enabled" BOOLEAN,
  "verified" BOOLEAN,
  "verified_at" TIMESTAMPTZ,
  "device_name" VARCHAR(255),
  "device_type" VARCHAR(50),
  "created_at" TIMESTAMPTZ,
  "last_used_at" TIMESTAMPTZ,
  "metadata" JSONB
);

-- ALTER: ml_predictions (+12 cols) — analytics.ts
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "prediction_type" TEXT DEFAULT '';
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "model_name" TEXT DEFAULT '';
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "model_version" TEXT DEFAULT '';
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "target_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "predicted_value" NUMERIC DEFAULT 0;
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "confidence_interval" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "confidence_score" NUMERIC DEFAULT 0;
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "features" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "actual_value" NUMERIC DEFAULT 0;
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "accuracy" NUMERIC DEFAULT 0;
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "ml_predictions" ADD COLUMN IF NOT EXISTS "validated_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: mobile_analytics (+9 cols) — mobile-devices-schema.ts
ALTER TABLE "mobile_analytics" ADD COLUMN IF NOT EXISTS "device_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "mobile_analytics" ADD COLUMN IF NOT EXISTS "user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "mobile_analytics" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "mobile_analytics" ADD COLUMN IF NOT EXISTS "event_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "mobile_analytics" ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "mobile_analytics" ADD COLUMN IF NOT EXISTS "properties" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "mobile_analytics" ADD COLUMN IF NOT EXISTS "location" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "mobile_analytics" ADD COLUMN IF NOT EXISTS "device_context" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "mobile_analytics" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: mobile_app_config (+13 cols) — mobile-devices-schema.ts
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "app_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "app_icon" VARCHAR(500) DEFAULT '';
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "push_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "notification_types" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "offline_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "offline_data_retention" INTEGER DEFAULT 0;
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "sync_on_wifi_only" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "biometric_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "session_timeout" INTEGER DEFAULT 0;
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "require_pin_on_launch" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "min_app_version" VARCHAR(20) DEFAULT '';
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "force_update_version" VARCHAR(20) DEFAULT '';
ALTER TABLE "mobile_app_config" ADD COLUMN IF NOT EXISTS "force_update_message" TEXT DEFAULT '';

-- ALTER: mobile_devices (+25 cols) — mobile-devices-schema.ts
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "device_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "platform" VARCHAR(20) DEFAULT '';
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "device_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "device_model" VARCHAR(100) DEFAULT '';
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "os_version" VARCHAR(50) DEFAULT '';
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "app_version" VARCHAR(20) DEFAULT '';
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "push_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "notification_sound" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "notification_vibration" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT '';
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "locale" VARCHAR(10) DEFAULT '';
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "capabilities" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "is_compliant" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "compliance_issues" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "last_compliance_check" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "is_jailbroken" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "last_secure_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "is_archived" BOOLEAN DEFAULT false;
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "registered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "mobile_devices" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: mobile_notifications (+14 cols) — mobile-devices-schema.ts
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255) DEFAULT '';
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "body" TEXT DEFAULT '';
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) DEFAULT '';
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "badge" INTEGER DEFAULT 0;
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "sound" VARCHAR(100) DEFAULT '';
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "provider_response" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "mobile_notifications" ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: mobile_sync_queue (+12 cols) — mobile-devices-schema.ts
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "entity_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "org_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "operation" VARCHAR(20) DEFAULT '';
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "payload" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "client_timestamp" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "conflict_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "resolution" VARCHAR(20) DEFAULT '';
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0;
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "max_retries" INTEGER DEFAULT 0;
ALTER TABLE "mobile_sync_queue" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: model_metadata (+5 cols) — domains\ml\predictions.ts
ALTER TABLE "model_metadata" ADD COLUMN IF NOT EXISTS "model_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "model_metadata" ADD COLUMN IF NOT EXISTS "version" VARCHAR(20) DEFAULT '';
ALTER TABLE "model_metadata" ADD COLUMN IF NOT EXISTS "accuracy" NUMERIC DEFAULT 0;
ALTER TABLE "model_metadata" ADD COLUMN IF NOT EXISTS "trained_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "model_metadata" ADD COLUMN IF NOT EXISTS "parameters" JSONB DEFAULT '{}'::jsonb;

-- ALTER: newsletter_campaigns (+25 cols) — domains\communications\newsletters.ts
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "subject" VARCHAR(500) DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "preview_text" VARCHAR(500) DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "from_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "from_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "reply_to_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "html_content" TEXT DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "json_structure" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(100) DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "distribution_list_ids" UUID DEFAULT gen_random_uuid();
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "recipient_count" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "total_sent" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "total_delivered" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "total_bounced" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "total_opened" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "total_clicked" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "total_unsubscribed" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "total_spam_reports" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "tags" VARCHAR(100) DEFAULT '';
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "newsletter_campaigns" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: newsletter_distribution_lists (+7 cols) — domains\communications\newsletters.ts
ALTER TABLE "newsletter_distribution_lists" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "newsletter_distribution_lists" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "newsletter_distribution_lists" ADD COLUMN IF NOT EXISTS "list_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "newsletter_distribution_lists" ADD COLUMN IF NOT EXISTS "filter_criteria" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "newsletter_distribution_lists" ADD COLUMN IF NOT EXISTS "subscriber_count" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_distribution_lists" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "newsletter_distribution_lists" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: newsletter_engagement (+7 cols) — domains\communications\newsletters.ts
ALTER TABLE "newsletter_engagement" ADD COLUMN IF NOT EXISTS "recipient_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "newsletter_engagement" ADD COLUMN IF NOT EXISTS "profile_id" TEXT DEFAULT '';
ALTER TABLE "newsletter_engagement" ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "newsletter_engagement" ADD COLUMN IF NOT EXISTS "event_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "newsletter_engagement" ADD COLUMN IF NOT EXISTS "ip_address" TEXT DEFAULT '';
ALTER TABLE "newsletter_engagement" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "newsletter_engagement" ADD COLUMN IF NOT EXISTS "occurred_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: newsletter_list_subscribers (+6 cols) — domains\communications\newsletters.ts
ALTER TABLE "newsletter_list_subscribers" ADD COLUMN IF NOT EXISTS "profile_id" TEXT DEFAULT '';
ALTER TABLE "newsletter_list_subscribers" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255) DEFAULT '';
ALTER TABLE "newsletter_list_subscribers" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "newsletter_list_subscribers" ADD COLUMN IF NOT EXISTS "subscribed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "newsletter_list_subscribers" ADD COLUMN IF NOT EXISTS "unsubscribed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "newsletter_list_subscribers" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: newsletter_recipients (+10 cols) — domains\communications\newsletters.ts
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "profile_id" TEXT DEFAULT '';
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255) DEFAULT '';
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "bounced_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "bounce_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "bounce_reason" TEXT DEFAULT '';
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "newsletter_recipients" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: newsletter_templates (+11 cols) — domains\communications\newsletters.ts
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) DEFAULT '';
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "thumbnail_url" TEXT DEFAULT '';
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "html_content" TEXT DEFAULT '';
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "json_structure" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "variables" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN DEFAULT false;
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "usage_count" INTEGER DEFAULT 0;
ALTER TABLE "newsletter_templates" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: nlrb_clrb_filings (+39 cols) — domains\infrastructure\organizing.ts
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "filing_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "filing_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "jurisdiction" VARCHAR(50) DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "filed_date" DATE DEFAULT NOW();
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "filed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "employer_notified_date" DATE DEFAULT NOW();
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "bargaining_unit_description" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "unit_size_claimed" INTEGER DEFAULT 0;
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "unit_job_classifications" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "excluded_positions" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "showing_of_interest_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "cards_submitted_count" INTEGER DEFAULT 0;
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "card_submission_batch_ids" UUID DEFAULT gen_random_uuid();
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "hearing_date" DATE DEFAULT NOW();
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "hearing_location" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "hearing_outcome" VARCHAR(50) DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "election_scheduled_date" DATE DEFAULT NOW();
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "election_location" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "election_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "election_conducted" BOOLEAN DEFAULT false;
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "petition_document_url" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "showing_of_interest_document_url" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "hearing_transcripts_url" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "decision_document_url" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "employer_contested" BOOLEAN DEFAULT false;
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "employer_objections" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "employer_counter_arguments" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "employer_representation" VARCHAR(255) DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "decision_date" DATE DEFAULT NOW();
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "decision_summary" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "unit_approved" BOOLEAN DEFAULT false;
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "approved_unit_size" INTEGER DEFAULT 0;
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "approved_job_classifications" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "appeal_filed" BOOLEAN DEFAULT false;
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "appeal_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "nlrb_clrb_filings" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- ALTER: notification_bounces (+9 cols) — domains\communications\notifications.ts
ALTER TABLE "notification_bounces" ADD COLUMN IF NOT EXISTS "email" TEXT DEFAULT '';
ALTER TABLE "notification_bounces" ADD COLUMN IF NOT EXISTS "bounce_type" TEXT DEFAULT '';
ALTER TABLE "notification_bounces" ADD COLUMN IF NOT EXISTS "bounce_sub_type" TEXT DEFAULT '';
ALTER TABLE "notification_bounces" ADD COLUMN IF NOT EXISTS "first_bounced_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_bounces" ADD COLUMN IF NOT EXISTS "last_bounced_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_bounces" ADD COLUMN IF NOT EXISTS "bounce_count" TEXT DEFAULT '';
ALTER TABLE "notification_bounces" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "notification_bounces" ADD COLUMN IF NOT EXISTS "suppress_until" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_bounces" ADD COLUMN IF NOT EXISTS "suppression_reason" TEXT DEFAULT '';

-- ALTER: notification_delivery_log (+9 cols) — domains\communications\notifications.ts
ALTER TABLE "notification_delivery_log" ADD COLUMN IF NOT EXISTS "notification_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "notification_delivery_log" ADD COLUMN IF NOT EXISTS "event" TEXT DEFAULT '';
ALTER TABLE "notification_delivery_log" ADD COLUMN IF NOT EXISTS "event_timestamp" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_delivery_log" ADD COLUMN IF NOT EXISTS "provider_id" TEXT DEFAULT '';
ALTER TABLE "notification_delivery_log" ADD COLUMN IF NOT EXISTS "external_event_id" TEXT DEFAULT '';
ALTER TABLE "notification_delivery_log" ADD COLUMN IF NOT EXISTS "details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "notification_delivery_log" ADD COLUMN IF NOT EXISTS "status_code" TEXT DEFAULT '';
ALTER TABLE "notification_delivery_log" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "notification_delivery_log" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: notification_history (+11 cols) — domains\communications\notifications.ts
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "recipient" TEXT DEFAULT '';
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "channel" TEXT DEFAULT '';
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "subject" TEXT DEFAULT '';
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "template" TEXT DEFAULT '';
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "error" TEXT DEFAULT '';
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "opened_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "clicked_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_history" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: notification_log (+8 cols) — clc-per-capita-schema.ts
ALTER TABLE "notification_log" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) DEFAULT '';
ALTER TABLE "notification_log" ADD COLUMN IF NOT EXISTS "channel" VARCHAR(255) DEFAULT '';
ALTER TABLE "notification_log" ADD COLUMN IF NOT EXISTS "recipients" TEXT DEFAULT '';
ALTER TABLE "notification_log" ADD COLUMN IF NOT EXISTS "success_count" INTEGER DEFAULT 0;
ALTER TABLE "notification_log" ADD COLUMN IF NOT EXISTS "failure_count" INTEGER DEFAULT 0;
ALTER TABLE "notification_log" ADD COLUMN IF NOT EXISTS "message_ids" TEXT DEFAULT '';
ALTER TABLE "notification_log" ADD COLUMN IF NOT EXISTS "errors" TEXT DEFAULT '';
ALTER TABLE "notification_log" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: notification_queue (+10 cols) — domains\communications\notifications.ts
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT '';
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "payload" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "attempt_count" TEXT DEFAULT '';
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "max_attempts" TEXT DEFAULT '';
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "next_retry_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "result_notification_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "notification_queue" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';

-- ALTER: notification_templates (+17 cols) — domains\communications\notifications.ts
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "template_key" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "subject" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "body_template" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "html_body_template" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "variables" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "default_variables" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "channels" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN DEFAULT false;
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "max_retries" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "retry_delay_seconds" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "notification_templates" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- ALTER: notifications (+10 cols) — domains\communications\notifications.ts
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT '';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "message" TEXT DEFAULT '';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT '';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "related_entity_type" TEXT DEFAULT '';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "related_entity_id" TEXT DEFAULT '';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "scheduled_for" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "notifications" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();

-- CREATE: oauth_providers (10 cols) — domains\member\user-management.ts
CREATE TABLE IF NOT EXISTS "oauth_providers" (
  "provider_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" VARCHAR(255),
  "provider_name" VARCHAR(50),
  "provider_user_id" VARCHAR(255),
  "provider_data" JSONB,
  "access_token" TEXT,
  "refresh_token" TEXT,
  "token_expires_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: organization_benchmark_snapshots (+17 cols) — analytics-reporting-schema.ts
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "benchmark_category_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "period_start" DATE DEFAULT NOW();
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "period_end" DATE DEFAULT NOW();
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "period_type" TEXT DEFAULT '';
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "metric_value" NUMERIC DEFAULT 0;
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "benchmark_value" NUMERIC DEFAULT 0;
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "variance_from_benchmark" NUMERIC DEFAULT 0;
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "variance_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "percentile_rank" INTEGER DEFAULT 0;
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "performance_indicator" TEXT DEFAULT '';
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "previous_period_value" NUMERIC DEFAULT 0;
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "period_over_period_change" NUMERIC DEFAULT 0;
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "period_over_period_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "trend_direction" TEXT DEFAULT '';
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "data_completeness_percentage" INTEGER DEFAULT 0;
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "calculation_notes" TEXT DEFAULT '';
ALTER TABLE "organization_benchmark_snapshots" ADD COLUMN IF NOT EXISTS "calculated_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: organization_billing_config (+5 cols) — domains\finance\billing-config.ts
ALTER TABLE "organization_billing_config" ADD COLUMN IF NOT EXISTS "billing_frequency" VARCHAR(20) DEFAULT '';
ALTER TABLE "organization_billing_config" ADD COLUMN IF NOT EXISTS "billing_day_of_month" INTEGER DEFAULT 0;
ALTER TABLE "organization_billing_config" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(50) DEFAULT '';
ALTER TABLE "organization_billing_config" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN DEFAULT false;
ALTER TABLE "organization_billing_config" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: organization_contacts (+8 cols) — clc-per-capita-schema.ts
ALTER TABLE "organization_contacts" ADD COLUMN IF NOT EXISTS "role" VARCHAR(100) DEFAULT '';
ALTER TABLE "organization_contacts" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "organization_contacts" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255) DEFAULT '';
ALTER TABLE "organization_contacts" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "organization_contacts" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN DEFAULT false;
ALTER TABLE "organization_contacts" ADD COLUMN IF NOT EXISTS "receive_reminders" BOOLEAN DEFAULT false;
ALTER TABLE "organization_contacts" ADD COLUMN IF NOT EXISTS "receive_reports" BOOLEAN DEFAULT false;
ALTER TABLE "organization_contacts" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;

-- ALTER: organization_members (+6 cols) — organization-members-schema.ts
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "member_category" TEXT DEFAULT '';
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "exempt_from_per_capita" BOOLEAN DEFAULT false;
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "exemption_reason" TEXT DEFAULT '';
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "exemption_approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "exemption_approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "organization_members" ADD COLUMN IF NOT EXISTS "search_vector" TEXT DEFAULT '';

-- CREATE: organization_sharing_grants (14 cols) — domains\infrastructure\sharing.ts
CREATE TABLE IF NOT EXISTS "organization_sharing_grants" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "grantor_org_id" UUID,
  "grantee_org_id" UUID,
  "resource_type" VARCHAR(50),
  "all_resources" BOOLEAN,
  "specific_resource_ids" UUID,
  "grant_reason" TEXT,
  "expires_at" TIMESTAMPTZ,
  "revoked_at" TIMESTAMPTZ,
  "revoked_by" VARCHAR(255),
  "revoke_reason" TEXT,
  "granted_by" VARCHAR(255),
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: organization_sharing_settings (+2 cols) — domains\infrastructure\sharing.ts
ALTER TABLE "organization_sharing_settings" ADD COLUMN IF NOT EXISTS "max_shared_clauses" INTEGER DEFAULT 0;
ALTER TABLE "organization_sharing_settings" ADD COLUMN IF NOT EXISTS "max_shared_precedents" INTEGER DEFAULT 0;

-- ALTER: organizer_impacts (+9 cols) — domains\marketing.ts
ALTER TABLE "organizer_impacts" ADD COLUMN IF NOT EXISTS "cases_handled" INTEGER DEFAULT 0;
ALTER TABLE "organizer_impacts" ADD COLUMN IF NOT EXISTS "cases_won" INTEGER DEFAULT 0;
ALTER TABLE "organizer_impacts" ADD COLUMN IF NOT EXISTS "avg_resolution_time" NUMERIC DEFAULT 0;
ALTER TABLE "organizer_impacts" ADD COLUMN IF NOT EXISTS "member_satisfaction_avg" NUMERIC DEFAULT 0;
ALTER TABLE "organizer_impacts" ADD COLUMN IF NOT EXISTS "escalations_avoided" INTEGER DEFAULT 0;
ALTER TABLE "organizer_impacts" ADD COLUMN IF NOT EXISTS "democratic_participation_rate" NUMERIC DEFAULT 0;
ALTER TABLE "organizer_impacts" ADD COLUMN IF NOT EXISTS "recognition_events" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "organizer_impacts" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "organizer_impacts" ADD COLUMN IF NOT EXISTS "period_end" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: organizer_tasks (+19 cols) — domains\communications\organizer-workflows.ts
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "assigned_to" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "assigned_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "member_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "related_case_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "related_grievance_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "due_date" DATE DEFAULT NOW();
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "estimated_minutes" INTEGER DEFAULT 0;
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "actual_minutes" INTEGER DEFAULT 0;
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "completion_notes" TEXT DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "blocked_reason" TEXT DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizer_tasks" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: organizing_campaign_milestones (+16 cols) — domains\infrastructure\organizing.ts
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "milestone_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "milestone_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "target_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "completed" BOOLEAN DEFAULT false;
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "completed_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "target_metric" VARCHAR(50) DEFAULT '';
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "target_value" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "current_value" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "progress_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "days_until_deadline" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "reminder_sent" BOOLEAN DEFAULT false;
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "reminder_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "organizing_campaign_milestones" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: organizing_campaigns (+36 cols) — domains\infrastructure\organizing.ts
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "campaign_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "campaign_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "target_employer" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "workplace_location" TEXT DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "industry" VARCHAR(100) DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "campaign_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "estimated_unit_size" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "target_card_count" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "cards_signed" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "card_signing_progress" NUMERIC DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "lead_organizer_id" TEXT DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "organizing_team" UUID DEFAULT gen_random_uuid();
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "campaign_start_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "target_card_deadline" DATE DEFAULT NOW();
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "filing_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "election_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "certification_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "campaign_end_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "organizing_strategy" TEXT DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "key_issues" TEXT DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "employer_vulnerabilities" TEXT DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "union_advantages" TEXT DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "contacts_identified" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "contacts_committed" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "house_visits_completed" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "workplace_meetings_held" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "election_eligible_voters" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "votes_for_union" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "votes_against_union" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "challenged_ballots" INTEGER DEFAULT 0;
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "election_result" VARCHAR(50) DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';
ALTER TABLE "organizing_campaigns" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: organizing_contacts (+33 cols) — domains\infrastructure\organizing.ts
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "first_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "last_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "phone" VARCHAR(20) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "preferred_contact_method" VARCHAR(20) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "job_title" VARCHAR(100) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "department" VARCHAR(100) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "shift" VARCHAR(50) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "hire_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "seniority_years" NUMERIC DEFAULT 0;
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "work_location" VARCHAR(255) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "supervisor" VARCHAR(100) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "immediate_coworkers" TEXT DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "influence_level" VARCHAR(20) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "commitment_level" VARCHAR(50) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "union_sentiment" VARCHAR(20) DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "card_signed" BOOLEAN DEFAULT false;
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "card_signed_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "willing_to_organize" BOOLEAN DEFAULT false;
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "issues_concerned_about" TEXT DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "first_contact_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "last_contact_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "total_contacts" INTEGER DEFAULT 0;
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "house_visit_completed" BOOLEAN DEFAULT false;
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "house_visit_date" DATE DEFAULT NOW();
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "likely_to_vote_yes" BOOLEAN DEFAULT false;
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "employer_loyalist" BOOLEAN DEFAULT false;
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "potential_risks" TEXT DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "organizing_contacts" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- ALTER: outreach_enrollments (+12 cols) — domains\communications\organizer-workflows.ts
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "sequence_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "member_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "enrolled_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "current_step" INTEGER DEFAULT 0;
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "total_steps" INTEGER DEFAULT 0;
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "completed_steps" INTEGER DEFAULT 0;
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "enrolled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "next_step_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "outreach_enrollments" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: outreach_sequences (+12 cols) — domains\communications\organizer-workflows.ts
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "trigger_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "trigger_conditions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "steps" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "stats" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "outreach_sequences" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: outreach_steps_log (+11 cols) — domains\communications\organizer-workflows.ts
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "enrollment_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "step_number" INTEGER DEFAULT 0;
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "action_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "executed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "message_log_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "task_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0;
ALTER TABLE "outreach_steps_log" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: pack_download_log (+12 cols) — defensibility-packs-schema.ts
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "downloaded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "downloaded_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "downloaded_by_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "download_purpose" VARCHAR(100) DEFAULT '';
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "export_format" VARCHAR(10) DEFAULT '';
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "file_size_bytes" INTEGER DEFAULT 0;
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "integrity_verified" BOOLEAN DEFAULT false;
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "download_success" BOOLEAN DEFAULT false;
ALTER TABLE "pack_download_log" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';

-- ALTER: pack_verification_log (+8 cols) — defensibility-packs-schema.ts
ALTER TABLE "pack_verification_log" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pack_verification_log" ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "pack_verification_log" ADD COLUMN IF NOT EXISTS "verification_passed" BOOLEAN DEFAULT false;
ALTER TABLE "pack_verification_log" ADD COLUMN IF NOT EXISTS "expected_hash" VARCHAR(64) DEFAULT '';
ALTER TABLE "pack_verification_log" ADD COLUMN IF NOT EXISTS "actual_hash" VARCHAR(64) DEFAULT '';
ALTER TABLE "pack_verification_log" ADD COLUMN IF NOT EXISTS "failure_reason" TEXT DEFAULT '';
ALTER TABLE "pack_verification_log" ADD COLUMN IF NOT EXISTS "tampered_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "pack_verification_log" ADD COLUMN IF NOT EXISTS "verification_trigger" VARCHAR(50) DEFAULT '';

-- ALTER: page_analytics (+12 cols) — cms-website-schema.ts
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "page_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "event_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "job_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "metric_date" DATE DEFAULT NOW();
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "page_views" INTEGER DEFAULT 0;
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "unique_visitors" INTEGER DEFAULT 0;
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "avg_time_on_page" INTEGER DEFAULT 0;
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "bounce_rate" NUMERIC DEFAULT 0;
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "traffic_sources" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "device_breakdown" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "page_analytics" ADD COLUMN IF NOT EXISTS "conversion_count" INTEGER DEFAULT 0;

-- ALTER: payment_cycles (+9 cols) — domains\finance\payments.ts
ALTER TABLE "payment_cycles" ADD COLUMN IF NOT EXISTS "name" VARCHAR(100) DEFAULT '';
ALTER TABLE "payment_cycles" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "payment_cycles" ADD COLUMN IF NOT EXISTS "cycle_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "payment_cycles" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payment_cycles" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payment_cycles" ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payment_cycles" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "payment_cycles" ADD COLUMN IF NOT EXISTS "is_closed" BOOLEAN DEFAULT false;
ALTER TABLE "payment_cycles" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: payment_disputes (+9 cols) — domains\finance\payments.ts
ALTER TABLE "payment_disputes" ADD COLUMN IF NOT EXISTS "payment_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "payment_disputes" ADD COLUMN IF NOT EXISTS "reason" TEXT DEFAULT '';
ALTER TABLE "payment_disputes" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "payment_disputes" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "payment_disputes" ADD COLUMN IF NOT EXISTS "resolved_amount" NUMERIC DEFAULT 0;
ALTER TABLE "payment_disputes" ADD COLUMN IF NOT EXISTS "resolution_notes" TEXT DEFAULT '';
ALTER TABLE "payment_disputes" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payment_disputes" ADD COLUMN IF NOT EXISTS "filed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "payment_disputes" ADD COLUMN IF NOT EXISTS "resolved_by" VARCHAR(255) DEFAULT '';

-- ALTER: payment_methods (+11 cols) — domains\finance\payments.ts
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "member_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT '';
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "stripe_payment_method_id" VARCHAR DEFAULT '';
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "stripe_billing_details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "processor_type" TEXT DEFAULT '';
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "processor_method_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "bank_account_token" VARCHAR DEFAULT '';
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "bank_account_last_4" VARCHAR(4) DEFAULT '';
ALTER TABLE "payment_methods" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: payment_plans (+17 cols) — dues-finance-schema.ts
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "installment_amount" NUMERIC DEFAULT 0;
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "installment_count" INTEGER DEFAULT 0;
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "frequency" TEXT DEFAULT '';
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "installments_paid" INTEGER DEFAULT 0;
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "total_paid" NUMERIC DEFAULT 0;
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "remaining_balance" NUMERIC DEFAULT 0;
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "last_payment_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "next_payment_due" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "agreement_accepted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "agreement_accepted_by" TEXT DEFAULT '';
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "terms_url" TEXT DEFAULT '';
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "payment_plans" ADD COLUMN IF NOT EXISTS "last_modified_by" TEXT DEFAULT '';

-- ALTER: payment_routing_rules (+2 cols) — domains\compliance\whiplash.ts
ALTER TABLE "payment_routing_rules" ADD COLUMN IF NOT EXISTS "destination_account_id" TEXT DEFAULT '';
ALTER TABLE "payment_routing_rules" ADD COLUMN IF NOT EXISTS "fallback_account_id" TEXT DEFAULT '';

-- ALTER: payments (+23 cols) — domains\finance\payments.ts
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "member_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "amount" NUMERIC DEFAULT 0;
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "type" TEXT DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "method" TEXT DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" VARCHAR DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "stripe_price_id" VARCHAR DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "stripe_invoice_id" VARCHAR DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "bank_deposit_id" VARCHAR DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "check_number" VARCHAR DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reference_number" VARCHAR DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "processor_type" TEXT DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "processor_customer_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "payment_cycle_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "due_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "paid_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reconciliation_status" TEXT DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "reconciliation_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "failure_reason" TEXT DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "payments" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';

-- ALTER: pci_dss_cardholder_data_flow (+5 cols) — domains\compliance\pci-dss.ts
ALTER TABLE "pci_dss_cardholder_data_flow" ADD COLUMN IF NOT EXISTS "system_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "pci_dss_cardholder_data_flow" ADD COLUMN IF NOT EXISTS "data_flow_description" TEXT DEFAULT '';
ALTER TABLE "pci_dss_cardholder_data_flow" ADD COLUMN IF NOT EXISTS "storage_location" TEXT DEFAULT '';
ALTER TABLE "pci_dss_cardholder_data_flow" ADD COLUMN IF NOT EXISTS "encryption_method" VARCHAR(100) DEFAULT '';
ALTER TABLE "pci_dss_cardholder_data_flow" ADD COLUMN IF NOT EXISTS "last_reviewed_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: pci_dss_encryption_keys (+6 cols) — domains\compliance\pci-dss.ts
ALTER TABLE "pci_dss_encryption_keys" ADD COLUMN IF NOT EXISTS "key_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "pci_dss_encryption_keys" ADD COLUMN IF NOT EXISTS "key_identifier" VARCHAR(255) DEFAULT '';
ALTER TABLE "pci_dss_encryption_keys" ADD COLUMN IF NOT EXISTS "rotated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pci_dss_encryption_keys" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pci_dss_encryption_keys" ADD COLUMN IF NOT EXISTS "rotation_reason" VARCHAR(100) DEFAULT '';
ALTER TABLE "pci_dss_encryption_keys" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: pci_dss_quarterly_scans (+7 cols) — domains\compliance\pci-dss.ts
ALTER TABLE "pci_dss_quarterly_scans" ADD COLUMN IF NOT EXISTS "scan_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pci_dss_quarterly_scans" ADD COLUMN IF NOT EXISTS "vendor_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "pci_dss_quarterly_scans" ADD COLUMN IF NOT EXISTS "scan_status" TEXT DEFAULT '';
ALTER TABLE "pci_dss_quarterly_scans" ADD COLUMN IF NOT EXISTS "vulnerabilities_found" INTEGER DEFAULT 0;
ALTER TABLE "pci_dss_quarterly_scans" ADD COLUMN IF NOT EXISTS "critical_issues" INTEGER DEFAULT 0;
ALTER TABLE "pci_dss_quarterly_scans" ADD COLUMN IF NOT EXISTS "report_url" TEXT DEFAULT '';
ALTER TABLE "pci_dss_quarterly_scans" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: pci_dss_requirements (+6 cols) — domains\compliance\pci-dss.ts
ALTER TABLE "pci_dss_requirements" ADD COLUMN IF NOT EXISTS "requirement_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "pci_dss_requirements" ADD COLUMN IF NOT EXISTS "requirement_description" TEXT DEFAULT '';
ALTER TABLE "pci_dss_requirements" ADD COLUMN IF NOT EXISTS "compliance_status" TEXT DEFAULT '';
ALTER TABLE "pci_dss_requirements" ADD COLUMN IF NOT EXISTS "evidence" TEXT DEFAULT '';
ALTER TABLE "pci_dss_requirements" ADD COLUMN IF NOT EXISTS "remediation_notes" TEXT DEFAULT '';
ALTER TABLE "pci_dss_requirements" ADD COLUMN IF NOT EXISTS "last_reviewed_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: pci_dss_saq_assessments (+6 cols) — domains\compliance\pci-dss.ts
ALTER TABLE "pci_dss_saq_assessments" ADD COLUMN IF NOT EXISTS "assessment_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pci_dss_saq_assessments" ADD COLUMN IF NOT EXISTS "sqa_level" VARCHAR(20) DEFAULT '';
ALTER TABLE "pci_dss_saq_assessments" ADD COLUMN IF NOT EXISTS "overall_status" TEXT DEFAULT '';
ALTER TABLE "pci_dss_saq_assessments" ADD COLUMN IF NOT EXISTS "attestation_of_compliance" TEXT DEFAULT '';
ALTER TABLE "pci_dss_saq_assessments" ADD COLUMN IF NOT EXISTS "attestation_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pci_dss_saq_assessments" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- CREATE: pending_profiles (18 cols) — domains\member\pending-profiles.ts
CREATE TABLE IF NOT EXISTS "pending_profiles" (
  "id" TEXT PRIMARY KEY DEFAULT '',
  "email" TEXT,
  "token" TEXT,
  "membership" TEXT,
  "payment_provider" TEXT,
  "whop_user_id" TEXT,
  "whop_membership_id" TEXT,
  "plan_duration" TEXT,
  "billing_cycle_start" TIMESTAMPTZ,
  "billing_cycle_end" TIMESTAMPTZ,
  "next_credit_renewal" TIMESTAMPTZ,
  "usage_credits" INTEGER,
  "used_credits" INTEGER,
  "claimed" BOOLEAN,
  "claimed_by_user_id" TEXT,
  "claimed_at" TIMESTAMPTZ,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: pension_benefit_claims (13 cols) — domains\finance\pension.ts
CREATE TABLE IF NOT EXISTS "pension_benefit_claims" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "member_id" UUID,
  "member_name" VARCHAR(255),
  "claim_type" VARCHAR(100),
  "status" VARCHAR(50),
  "amount" NUMERIC,
  "submitted_date" TIMESTAMPTZ,
  "processed_date" TIMESTAMPTZ,
  "notes" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: pension_contributions (11 cols) — domains\finance\pension.ts
CREATE TABLE IF NOT EXISTS "pension_contributions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "member_id" UUID,
  "member_name" VARCHAR(255),
  "period" VARCHAR(20),
  "amount" NUMERIC,
  "payment_status" VARCHAR(50),
  "payment_date" TIMESTAMPTZ,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: pension_members (13 cols) — domains\finance\pension.ts
CREATE TABLE IF NOT EXISTS "pension_members" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "plan_id" UUID,
  "user_id" UUID,
  "name" VARCHAR(255),
  "plan_name" VARCHAR(255),
  "enrollment_date" TIMESTAMPTZ,
  "membership_status" VARCHAR(50),
  "years_of_service" NUMERIC,
  "vesting_status" VARCHAR(50),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: pension_plans (12 cols) — domains\finance\pension.ts
CREATE TABLE IF NOT EXISTS "pension_plans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "plan_name" VARCHAR(255),
  "plan_type" VARCHAR(50),
  "status" VARCHAR(50),
  "active_members" INTEGER,
  "total_assets" NUMERIC,
  "funding_status" NUMERIC,
  "description" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: pension_t4a_records (11 cols) — domains\finance\pension.ts
CREATE TABLE IF NOT EXISTS "pension_t4a_records" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "member_id" UUID,
  "member_name" VARCHAR(255),
  "tax_year" INTEGER,
  "pension_income" NUMERIC,
  "status" VARCHAR(50),
  "generated_date" TIMESTAMPTZ,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: pension_trustee_meetings (12 cols) — domains\finance\pension.ts
CREATE TABLE IF NOT EXISTS "pension_trustee_meetings" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "title" VARCHAR(255),
  "scheduled_date" TIMESTAMPTZ,
  "location" VARCHAR(255),
  "agenda" TEXT,
  "minutes" TEXT,
  "status" VARCHAR(50),
  "attendees" JSONB,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: pension_trustees (11 cols) — domains\finance\pension.ts
CREATE TABLE IF NOT EXISTS "pension_trustees" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "user_id" UUID,
  "name" VARCHAR(255),
  "role" VARCHAR(100),
  "appointed_date" TIMESTAMPTZ,
  "term_end_date" TIMESTAMPTZ,
  "status" VARCHAR(50),
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: per_capita_remittances (+8 cols) — clc-per-capita-schema.ts
ALTER TABLE "per_capita_remittances" ADD COLUMN IF NOT EXISTS "submitted_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "per_capita_remittances" ADD COLUMN IF NOT EXISTS "approved_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "per_capita_remittances" ADD COLUMN IF NOT EXISTS "rejected_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "per_capita_remittances" ADD COLUMN IF NOT EXISTS "rejected_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "per_capita_remittances" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT DEFAULT '';
ALTER TABLE "per_capita_remittances" ADD COLUMN IF NOT EXISTS "paid_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "per_capita_remittances" ADD COLUMN IF NOT EXISTS "remittance_file_url" TEXT DEFAULT '';
ALTER TABLE "per_capita_remittances" ADD COLUMN IF NOT EXISTS "receipt_file_url" TEXT DEFAULT '';

-- ALTER: pilot_applications (+6 cols) — domains\marketing.ts
ALTER TABLE "pilot_applications" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "pilot_applications" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pilot_applications" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pilot_applications" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pilot_applications" ADD COLUMN IF NOT EXISTS "responses" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "pilot_applications" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: pilot_metrics (+10 cols) — domains\marketing.ts
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "enrollment_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "days_active" INTEGER DEFAULT 0;
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "organizer_adoption_rate" NUMERIC DEFAULT 0;
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "member_engagement_rate" NUMERIC DEFAULT 0;
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "cases_managed" INTEGER DEFAULT 0;
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "avg_time_to_resolution" NUMERIC DEFAULT 0;
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "health_score" NUMERIC DEFAULT 0;
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "milestones" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "pilot_metrics" ADD COLUMN IF NOT EXISTS "last_calculated" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: policy_evaluations (+8 cols) — policy-engine-schema.ts
ALTER TABLE "policy_evaluations" ADD COLUMN IF NOT EXISTS "subject_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "policy_evaluations" ADD COLUMN IF NOT EXISTS "subject_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "policy_evaluations" ADD COLUMN IF NOT EXISTS "evaluated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "policy_evaluations" ADD COLUMN IF NOT EXISTS "input_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "policy_evaluations" ADD COLUMN IF NOT EXISTS "passed" BOOLEAN DEFAULT false;
ALTER TABLE "policy_evaluations" ADD COLUMN IF NOT EXISTS "failure_reason" TEXT DEFAULT '';
ALTER TABLE "policy_evaluations" ADD COLUMN IF NOT EXISTS "action_taken" TEXT DEFAULT '';
ALTER TABLE "policy_evaluations" ADD COLUMN IF NOT EXISTS "context" JSONB DEFAULT '{}'::jsonb;

-- ALTER: policy_exceptions (+10 cols) — policy-engine-schema.ts
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "subject_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "subject_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "reason" TEXT DEFAULT '';
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "effective_date" DATE DEFAULT NOW();
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "expiration_date" DATE DEFAULT NOW();
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "policy_exceptions" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: policy_rules (+21 cols) — policy-engine-schema.ts
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "rule_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "category" VARCHAR(50) DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "conditions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "actions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "exceptions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "enforced" BOOLEAN DEFAULT false;
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "severity" VARCHAR(20) DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "effective_date" DATE DEFAULT NOW();
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "expiration_date" DATE DEFAULT NOW();
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "source_document" VARCHAR(255) DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "legal_reference" TEXT DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 0;
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "previous_version_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "policy_rules" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: poll_votes (+7 cols) — domains\communications\surveys.ts
ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "poll_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "voter_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "option_id" VARCHAR(50) DEFAULT '';
ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "ip_address" TEXT DEFAULT '';
ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "poll_votes" ADD COLUMN IF NOT EXISTS "voted_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: polls (+12 cols) — domains\communications\surveys.ts
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "question" TEXT DEFAULT '';
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "options" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "allow_multiple_votes" BOOLEAN DEFAULT false;
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "require_authentication" BOOLEAN DEFAULT false;
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "show_results_before_vote" BOOLEAN DEFAULT false;
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "closes_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "total_votes" INTEGER DEFAULT 0;
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "unique_voters" INTEGER DEFAULT 0;
ALTER TABLE "polls" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: precedent_citations (+7 cols) — arbitration-precedents-schema.ts
ALTER TABLE "precedent_citations" ADD COLUMN IF NOT EXISTS "citing_claim_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "precedent_citations" ADD COLUMN IF NOT EXISTS "citing_precedent_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "precedent_citations" ADD COLUMN IF NOT EXISTS "citing_organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "precedent_citations" ADD COLUMN IF NOT EXISTS "citation_context" TEXT DEFAULT '';
ALTER TABLE "precedent_citations" ADD COLUMN IF NOT EXISTS "citation_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "precedent_citations" ADD COLUMN IF NOT EXISTS "cited_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "precedent_citations" ADD COLUMN IF NOT EXISTS "cited_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: precedent_tags (+1 cols) — arbitration-precedents-schema.ts
ALTER TABLE "precedent_tags" ADD COLUMN IF NOT EXISTS "tag_name" VARCHAR(100) DEFAULT '';

-- ALTER: privacy_breaches (+17 cols) — domains\compliance\provincial-privacy.ts
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "severity" VARCHAR(20) DEFAULT '';
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "affected_province" VARCHAR(2) DEFAULT '';
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "affected_user_count" VARCHAR(20) DEFAULT '';
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "data_types" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "breach_description" TEXT DEFAULT '';
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "discovered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "contained_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "user_notification_required" BOOLEAN DEFAULT false;
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "regulator_notification_required" BOOLEAN DEFAULT false;
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "users_notified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "regulator_notified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "notification_deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "deadline_met" BOOLEAN DEFAULT false;
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "mitigation_steps" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "mitigation_completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "incident_report" TEXT DEFAULT '';
ALTER TABLE "privacy_breaches" ADD COLUMN IF NOT EXISTS "reported_by" VARCHAR(255) DEFAULT '';

-- ALTER: procurement_bids (+14 cols) — domains\infrastructure\trust-fmv.ts
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "bidder_phone" VARCHAR(20) DEFAULT '';
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "bid_amount" NUMERIC DEFAULT 0;
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "bid_documents" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "bid_notes" TEXT DEFAULT '';
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "bid_valid_until" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "fmv_benchmark_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "within_fmv_range" BOOLEAN DEFAULT false;
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "fmv_variance_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "evaluation_score" NUMERIC DEFAULT 0;
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "evaluation_notes" TEXT DEFAULT '';
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "evaluated_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "evaluated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "bid_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "procurement_bids" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: procurement_requests (+19 cols) — domains\infrastructure\trust-fmv.ts
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "request_title" TEXT DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "request_description" TEXT DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "requested_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "requested_by_department" VARCHAR(100) DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "requested_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "estimated_value" NUMERIC DEFAULT 0;
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "budget_approved" BOOLEAN DEFAULT false;
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "procurement_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "procurement_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "minimum_bids_required" VARCHAR(2) DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "bids_received" VARCHAR(2) DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "bidding_deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "awarded_to" VARCHAR(255) DEFAULT '';
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "awarded_amount" NUMERIC DEFAULT 0;
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "awarded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "procurement_requests" ADD COLUMN IF NOT EXISTS "award_justification" TEXT DEFAULT '';

-- ALTER: program_enrollments (+11 cols) — domains\scheduling\training.ts
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "program_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "enrollment_date" DATE DEFAULT NOW();
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "enrollment_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "courses_completed" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "courses_completed_count" INTEGER DEFAULT 0;
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "electives_completed_count" INTEGER DEFAULT 0;
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "progress_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "completed" BOOLEAN DEFAULT false;
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "completion_date" DATE DEFAULT NOW();
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "certification_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "program_enrollments" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: provincial_consent (+10 cols) — domains\compliance\provincial-privacy.ts
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "province" VARCHAR(2) DEFAULT '';
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "consent_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "consent_given" BOOLEAN DEFAULT false;
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "consent_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "consent_text" TEXT DEFAULT '';
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "consent_language" VARCHAR(2) DEFAULT '';
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "provincial_consent" ADD COLUMN IF NOT EXISTS "revoked_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: provincial_data_handling (+9 cols) — domains\compliance\provincial-privacy.ts
ALTER TABLE "provincial_data_handling" ADD COLUMN IF NOT EXISTS "province" VARCHAR(2) DEFAULT '';
ALTER TABLE "provincial_data_handling" ADD COLUMN IF NOT EXISTS "action_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "provincial_data_handling" ADD COLUMN IF NOT EXISTS "data_category" VARCHAR(50) DEFAULT '';
ALTER TABLE "provincial_data_handling" ADD COLUMN IF NOT EXISTS "purpose" TEXT DEFAULT '';
ALTER TABLE "provincial_data_handling" ADD COLUMN IF NOT EXISTS "legal_basis" VARCHAR(50) DEFAULT '';
ALTER TABLE "provincial_data_handling" ADD COLUMN IF NOT EXISTS "shared_with" TEXT DEFAULT '';
ALTER TABLE "provincial_data_handling" ADD COLUMN IF NOT EXISTS "sharing_agreement_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "provincial_data_handling" ADD COLUMN IF NOT EXISTS "performed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "provincial_data_handling" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR(45) DEFAULT '';

-- ALTER: provincial_privacy_config (+10 cols) — domains\compliance\provincial-privacy.ts
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "law_name" TEXT DEFAULT '';
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "consent_required" BOOLEAN DEFAULT false;
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "explicit_opt_in" BOOLEAN DEFAULT false;
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "data_retention_days" VARCHAR(10) DEFAULT '';
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "breach_notification_hours" VARCHAR(10) DEFAULT '';
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "right_to_erasure" BOOLEAN DEFAULT false;
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "right_to_portability" BOOLEAN DEFAULT false;
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "dpo_required" BOOLEAN DEFAULT false;
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "pia_required" BOOLEAN DEFAULT false;
ALTER TABLE "provincial_privacy_config" ADD COLUMN IF NOT EXISTS "custom_rules" JSONB DEFAULT '{}'::jsonb;

-- ALTER: public_content (+8 cols) — domains\communications\public-content.ts
ALTER TABLE "public_content" ADD COLUMN IF NOT EXISTS "slug" VARCHAR(200) DEFAULT '';
ALTER TABLE "public_content" ADD COLUMN IF NOT EXISTS "title" VARCHAR(500) DEFAULT '';
ALTER TABLE "public_content" ADD COLUMN IF NOT EXISTS "excerpt" TEXT DEFAULT '';
ALTER TABLE "public_content" ADD COLUMN IF NOT EXISTS "body" TEXT DEFAULT '';
ALTER TABLE "public_content" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "public_content" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "public_content" ADD COLUMN IF NOT EXISTS "is_published" BOOLEAN DEFAULT false;
ALTER TABLE "public_content" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: public_events (+39 cols) — cms-website-schema.ts
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "slug" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "event_type" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "location_type" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "venue_name" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "venue_address" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "venue_city" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "venue_state" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "venue_postal_code" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "venue_country" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "virtual_link" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "virtual_platform" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "featured_image" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "capacity" INTEGER DEFAULT 0;
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "registered_count" INTEGER DEFAULT 0;
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "waitlist_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "registration_opens" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "registration_closes" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "registration_status" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "is_free" BOOLEAN DEFAULT false;
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "ticket_price" NUMERIC DEFAULT 0;
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "member_price" NUMERIC DEFAULT 0;
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "currency" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "confirmation_email_template" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "reminder_email_template" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "page_content" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "seo_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "tags" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "organizer_name" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "organizer_email" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "organizer_phone" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "stripe_product_id" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "stripe_price_id" TEXT DEFAULT '';
ALTER TABLE "public_events" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: push_deliveries (+11 cols) — domains\communications\push-notifications.ts
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "device_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "fcm_message_id" TEXT DEFAULT '';
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "clicked_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "dismissed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "error_code" TEXT DEFAULT '';
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0;
ALTER TABLE "push_deliveries" ADD COLUMN IF NOT EXISTS "event_data" JSONB DEFAULT '{}'::jsonb;

-- ALTER: push_devices (+12 cols) — domains\communications\push-notifications.ts
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "profile_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "device_token" TEXT DEFAULT '';
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "platform" TEXT DEFAULT '';
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "device_name" TEXT DEFAULT '';
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "device_model" TEXT DEFAULT '';
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "os_version" TEXT DEFAULT '';
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "app_version" TEXT DEFAULT '';
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN DEFAULT false;
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "quiet_hours_start" TIME DEFAULT '00:00:00';
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "quiet_hours_end" TIME DEFAULT '00:00:00';
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT '';
ALTER TABLE "push_devices" ADD COLUMN IF NOT EXISTS "last_active_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: push_notification_templates (+16 cols) — domains\communications\push-notifications.ts
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "body" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "icon_url" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "image_url" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "badge_count" INTEGER DEFAULT 0;
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "sound" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "click_action" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "action_buttons" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "variables" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT '';
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "ttl" INTEGER DEFAULT 0;
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN DEFAULT false;
ALTER TABLE "push_notification_templates" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: push_notifications (+27 cols) — domains\communications\push-notifications.ts
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "body" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "icon_url" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "image_url" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "badge_count" INTEGER DEFAULT 0;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "sound" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "click_action" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "action_buttons" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "target_type" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "target_criteria" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "device_ids" UUID DEFAULT gen_random_uuid();
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "topics" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "scheduled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "timezone" TEXT DEFAULT '';
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "ttl" INTEGER DEFAULT 0;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "total_targeted" INTEGER DEFAULT 0;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "total_sent" INTEGER DEFAULT 0;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "total_delivered" INTEGER DEFAULT 0;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "total_failed" INTEGER DEFAULT 0;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "total_clicked" INTEGER DEFAULT 0;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "total_dismissed" INTEGER DEFAULT 0;
ALTER TABLE "push_notifications" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: rate_limit_events (+6 cols) — audit-security-schema.ts
ALTER TABLE "rate_limit_events" ADD COLUMN IF NOT EXISTS "identifier_type" VARCHAR(20) DEFAULT '';
ALTER TABLE "rate_limit_events" ADD COLUMN IF NOT EXISTS "endpoint" VARCHAR(255) DEFAULT '';
ALTER TABLE "rate_limit_events" ADD COLUMN IF NOT EXISTS "request_count" INTEGER DEFAULT 0;
ALTER TABLE "rate_limit_events" ADD COLUMN IF NOT EXISTS "limit_exceeded" BOOLEAN DEFAULT false;
ALTER TABLE "rate_limit_events" ADD COLUMN IF NOT EXISTS "window_start" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "rate_limit_events" ADD COLUMN IF NOT EXISTS "window_end" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: recovery_time_objectives (+8 cols) — domains\compliance\force-majeure.ts
ALTER TABLE "recovery_time_objectives" ADD COLUMN IF NOT EXISTS "component_description" TEXT DEFAULT '';
ALTER TABLE "recovery_time_objectives" ADD COLUMN IF NOT EXISTS "rto_hours" INTEGER DEFAULT 0;
ALTER TABLE "recovery_time_objectives" ADD COLUMN IF NOT EXISTS "rpo_hours" INTEGER DEFAULT 0;
ALTER TABLE "recovery_time_objectives" ADD COLUMN IF NOT EXISTS "depends_on" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "recovery_time_objectives" ADD COLUMN IF NOT EXISTS "criticality_level" VARCHAR(20) DEFAULT '';
ALTER TABLE "recovery_time_objectives" ADD COLUMN IF NOT EXISTS "last_tested_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "recovery_time_objectives" ADD COLUMN IF NOT EXISTS "last_test_result" VARCHAR(20) DEFAULT '';
ALTER TABLE "recovery_time_objectives" ADD COLUMN IF NOT EXISTS "actual_recovery_time" INTEGER DEFAULT 0;

-- ALTER: recusal_tracking (+16 cols) — domains\governance\conflicts.ts
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "full_name" TEXT DEFAULT '';
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "role" VARCHAR(50) DEFAULT '';
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "recusal_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "recusal_reason" TEXT DEFAULT '';
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "related_matter" TEXT DEFAULT '';
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "related_meeting_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "related_vote_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "related_transaction_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "recusal_documented" BOOLEAN DEFAULT false;
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "documentation_url" TEXT DEFAULT '';
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "documented_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "documented_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "recusal_start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "recusal_end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "recusal_tracking" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: remittance_approvals (+9 cols) — clc-per-capita-schema.ts
ALTER TABLE "remittance_approvals" ADD COLUMN IF NOT EXISTS "approver_role" VARCHAR(50) DEFAULT '';
ALTER TABLE "remittance_approvals" ADD COLUMN IF NOT EXISTS "approval_level" VARCHAR(20) DEFAULT '';
ALTER TABLE "remittance_approvals" ADD COLUMN IF NOT EXISTS "action" VARCHAR(20) DEFAULT '';
ALTER TABLE "remittance_approvals" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "remittance_approvals" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "remittance_approvals" ADD COLUMN IF NOT EXISTS "comment" TEXT DEFAULT '';
ALTER TABLE "remittance_approvals" ADD COLUMN IF NOT EXISTS "rejection_reason" TEXT DEFAULT '';
ALTER TABLE "remittance_approvals" ADD COLUMN IF NOT EXISTS "flagged_issues" TEXT DEFAULT '';
ALTER TABLE "remittance_approvals" ADD COLUMN IF NOT EXISTS "requested_changes" TEXT DEFAULT '';

-- ALTER: remittance_exceptions (+11 cols) — dues-finance-schema.ts
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "expected_amount" NUMERIC DEFAULT 0;
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "assigned_to" TEXT DEFAULT '';
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "priority" INTEGER DEFAULT 0;
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "resolved_by" TEXT DEFAULT '';
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "resolution_action" TEXT DEFAULT '';
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "resolution_notes" TEXT DEFAULT '';
ALTER TABLE "remittance_exceptions" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: remittance_line_items (+9 cols) — dues-finance-schema.ts
ALTER TABLE "remittance_line_items" ADD COLUMN IF NOT EXISTS "period_start" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "remittance_line_items" ADD COLUMN IF NOT EXISTS "period_end" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "remittance_line_items" ADD COLUMN IF NOT EXISTS "line_status" TEXT DEFAULT '';
ALTER TABLE "remittance_line_items" ADD COLUMN IF NOT EXISTS "exception_reason" TEXT DEFAULT '';
ALTER TABLE "remittance_line_items" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "remittance_line_items" ADD COLUMN IF NOT EXISTS "resolved_by" TEXT DEFAULT '';
ALTER TABLE "remittance_line_items" ADD COLUMN IF NOT EXISTS "resolution_notes" TEXT DEFAULT '';
ALTER TABLE "remittance_line_items" ADD COLUMN IF NOT EXISTS "ledger_transaction_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "remittance_line_items" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: report_delivery_history (+23 cols) — analytics-reporting-schema.ts
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "scheduled_report_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "report_name" TEXT DEFAULT '';
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "report_type" TEXT DEFAULT '';
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "delivery_method" TEXT DEFAULT '';
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "recipients" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "delivery_format" TEXT DEFAULT '';
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "file_url" TEXT DEFAULT '';
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "file_size_bytes" BIGINT DEFAULT 0;
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "file_hash" TEXT DEFAULT '';
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0;
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "email_subject" TEXT DEFAULT '';
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "email_opened" BOOLEAN DEFAULT false;
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "email_opened_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "email_clicked" BOOLEAN DEFAULT false;
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "email_clicked_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "generation_time_ms" INTEGER DEFAULT 0;
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "delivery_time_ms" INTEGER DEFAULT 0;
ALTER TABLE "report_delivery_history" ADD COLUMN IF NOT EXISTS "triggered_by" VARCHAR(255) DEFAULT '';

-- ALTER: report_executions (+10 cols) — domains\analytics\reports.ts
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "executed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "executed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "format" TEXT DEFAULT '';
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "parameters" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "result_count" VARCHAR(50) DEFAULT '';
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "execution_time_ms" VARCHAR(50) DEFAULT '';
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "file_url" VARCHAR(500) DEFAULT '';
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "file_size" VARCHAR(50) DEFAULT '';
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "report_executions" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';

-- ALTER: report_shares (+5 cols) — domains\analytics\reports.ts
ALTER TABLE "report_shares" ADD COLUMN IF NOT EXISTS "shared_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "report_shares" ADD COLUMN IF NOT EXISTS "shared_with" VARCHAR(255) DEFAULT '';
ALTER TABLE "report_shares" ADD COLUMN IF NOT EXISTS "can_edit" BOOLEAN DEFAULT false;
ALTER TABLE "report_shares" ADD COLUMN IF NOT EXISTS "can_execute" BOOLEAN DEFAULT false;
ALTER TABLE "report_shares" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: report_templates (+9 cols) — domains\analytics\reports.ts
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "is_system" BOOLEAN DEFAULT false;
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "thumbnail" VARCHAR(500) DEFAULT '';
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "report_templates" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: reports (+12 cols) — domains\analytics\reports.ts
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "report_type" TEXT DEFAULT '';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "is_public" BOOLEAN DEFAULT false;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "is_template" BOOLEAN DEFAULT false;
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "updated_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "last_run_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "reports" ADD COLUMN IF NOT EXISTS "run_count" INTEGER DEFAULT 0;

-- ALTER: reserved_matter_votes (+8 cols) — domains\governance\governance.ts
ALTER TABLE "reserved_matter_votes" ADD COLUMN IF NOT EXISTS "proposed_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "reserved_matter_votes" ADD COLUMN IF NOT EXISTS "class_a_percent_for" INTEGER DEFAULT 0;
ALTER TABLE "reserved_matter_votes" ADD COLUMN IF NOT EXISTS "class_b_vote_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "reserved_matter_votes" ADD COLUMN IF NOT EXISTS "final_decision" TEXT DEFAULT '';
ALTER TABLE "reserved_matter_votes" ADD COLUMN IF NOT EXISTS "decision_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "reserved_matter_votes" ADD COLUMN IF NOT EXISTS "implemented" BOOLEAN DEFAULT false;
ALTER TABLE "reserved_matter_votes" ADD COLUMN IF NOT EXISTS "implementation_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "reserved_matter_votes" ADD COLUMN IF NOT EXISTS "implementation_notes" TEXT DEFAULT '';

-- ALTER: retention_policies (+15 cols) — policy-engine-schema.ts
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "data_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "data_category" VARCHAR(50) DEFAULT '';
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "retention_period_years" INTEGER DEFAULT 0;
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "retention_trigger" VARCHAR(50) DEFAULT '';
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "action_on_expiry" VARCHAR(50) DEFAULT '';
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "can_be_held" BOOLEAN DEFAULT false;
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "minimum_retention" INTEGER DEFAULT 0;
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "legal_basis" TEXT DEFAULT '';
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "regulatory_reference" TEXT DEFAULT '';
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "effective_date" DATE DEFAULT NOW();
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "retention_policies" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: reward_wallet_ledger (+7 cols) — award-templates-schema.ts
ALTER TABLE "reward_wallet_ledger" ADD COLUMN IF NOT EXISTS "transaction_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "reward_wallet_ledger" ADD COLUMN IF NOT EXISTS "points_change" INTEGER DEFAULT 0;
ALTER TABLE "reward_wallet_ledger" ADD COLUMN IF NOT EXISTS "award_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "reward_wallet_ledger" ADD COLUMN IF NOT EXISTS "reference_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "reward_wallet_ledger" ADD COLUMN IF NOT EXISTS "reference_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "reward_wallet_ledger" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "reward_wallet_ledger" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';

-- ALTER: rl1_tax_slips (+26 cols) — domains\finance\taxes.ts
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "tax_year" VARCHAR(4) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "payer_name" TEXT DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "payer_quebec_enterprise_number" VARCHAR(10) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "payer_address" TEXT DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "payer_city" VARCHAR(100) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "payer_postal_code" VARCHAR(10) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_name" TEXT DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_sin" VARCHAR(11) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_address" TEXT DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_city" VARCHAR(100) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_postal_code" VARCHAR(10) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "box_o_other_income" NUMERIC DEFAULT 0;
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "box_e_quebec_income_tax_deducted" NUMERIC DEFAULT 0;
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "generated_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "filed_with_revenu_quebec" BOOLEAN DEFAULT false;
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "revenu_quebec_filing_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "revenu_quebec_confirmation_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "delivered_to_member" BOOLEAN DEFAULT false;
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "delivery_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "xml_url" TEXT DEFAULT '';
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "is_amendment" BOOLEAN DEFAULT false;
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "original_slip_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "rl1_tax_slips" ADD COLUMN IF NOT EXISTS "amendment_reason" TEXT DEFAULT '';

-- ALTER: role_tenure_history (+21 cols) — union-structure-schema.ts
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "member_id" TEXT DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "role_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "role_title" VARCHAR(255) DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "role_level" VARCHAR(50) DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "related_entity_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "related_entity_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "start_date" DATE DEFAULT NOW();
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "end_date" DATE DEFAULT NOW();
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "is_current_role" BOOLEAN DEFAULT false;
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "appointment_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "election_date" DATE DEFAULT NOW();
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "votes_received" INTEGER DEFAULT 0;
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "vote_total" INTEGER DEFAULT 0;
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "term_length" INTEGER DEFAULT 0;
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "term_number" INTEGER DEFAULT 0;
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "end_reason" VARCHAR(100) DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "ended_by" TEXT DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "achievements" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "role_tenure_history" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- ALTER: room_bookings (+26 cols) — calendar-schema.ts
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "event_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "booked_by" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "booked_for" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "purpose" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "start_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "end_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "setup_required" BOOLEAN DEFAULT false;
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "setup_time" INTEGER DEFAULT 0;
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "catering_required" BOOLEAN DEFAULT false;
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "catering_notes" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "special_requests" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "requires_approval" BOOLEAN DEFAULT false;
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "approved_by" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "approval_notes" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "checked_in_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "checked_in_by" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "checked_out_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "actual_end_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "cancelled_by" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "cancellation_reason" TEXT DEFAULT '';
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "attendee_count" INTEGER DEFAULT 0;
ALTER TABLE "room_bookings" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: safety_training_records (+1 cols) — domains\health-safety\health-safety-schema.ts
ALTER TABLE "safety_training_records" ADD COLUMN IF NOT EXISTS "passed" BOOLEAN DEFAULT false;

-- CREATE: scim_configurations (22 cols) — sso-scim-schema.ts
CREATE TABLE IF NOT EXISTS "scim_configurations" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "base_url" VARCHAR(500),
  "bearer_token" TEXT,
  "token_hash" VARCHAR(255),
  "token_created_at" TIMESTAMPTZ,
  "token_expires_at" TIMESTAMPTZ,
  "enabled" BOOLEAN,
  "sync_users" BOOLEAN,
  "sync_groups" BOOLEAN,
  "deprovision_action" VARCHAR(50),
  "user_filter" JSONB,
  "group_filter" JSONB,
  "user_attribute_mapping" JSONB,
  "group_attribute_mapping" JSONB,
  "last_sync_at" TIMESTAMPTZ,
  "users_synced" INTEGER,
  "groups_synced" INTEGER,
  "created_at" TIMESTAMPTZ,
  "created_by" VARCHAR(255),
  "updated_at" TIMESTAMPTZ,
  "metadata" JSONB
);

-- CREATE: scim_events_log (18 cols) — sso-scim-schema.ts
CREATE TABLE IF NOT EXISTS "scim_events_log" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "config_id" UUID,
  "organization_id" UUID,
  "event_type" VARCHAR(50),
  "resource_type" VARCHAR(50),
  "resource_id" VARCHAR(255),
  "operation" VARCHAR(50),
  "request_path" VARCHAR(500),
  "request_body" JSONB,
  "response_body" JSONB,
  "status" VARCHAR(50),
  "status_code" INTEGER,
  "error_message" TEXT,
  "processing_time_ms" INTEGER,
  "ip_address" VARCHAR(50),
  "authenticated_as" VARCHAR(255),
  "created_at" TIMESTAMPTZ,
  "metadata" JSONB
);

-- ALTER: security_events (+12 cols) — audit-security-schema.ts
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "event_category" VARCHAR(30) DEFAULT '';
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "severity" VARCHAR(20) DEFAULT '';
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "source_ip" VARCHAR(45) DEFAULT '';
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "additional_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "risk_score" INTEGER DEFAULT 0;
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "is_resolved" BOOLEAN DEFAULT false;
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "resolved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "resolved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "security_events" ADD COLUMN IF NOT EXISTS "resolution_notes" TEXT DEFAULT '';

-- ALTER: segment_executions (+5 cols) — domains\member\member-segments.ts
ALTER TABLE "segment_executions" ADD COLUMN IF NOT EXISTS "executed_by" TEXT DEFAULT '';
ALTER TABLE "segment_executions" ADD COLUMN IF NOT EXISTS "executed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "segment_executions" ADD COLUMN IF NOT EXISTS "result_count" INTEGER DEFAULT 0;
ALTER TABLE "segment_executions" ADD COLUMN IF NOT EXISTS "execution_time_ms" INTEGER DEFAULT 0;
ALTER TABLE "segment_executions" ADD COLUMN IF NOT EXISTS "filters_snapshot" JSONB DEFAULT '{}'::jsonb;

-- ALTER: segment_exports (+14 cols) — domains\member\member-segments.ts
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "exported_by" TEXT DEFAULT '';
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "exported_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "format" TEXT DEFAULT '';
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "include_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "member_count" INTEGER DEFAULT 0;
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "filters_used" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "watermark" TEXT DEFAULT '';
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "export_hash" TEXT DEFAULT '';
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "purpose" TEXT DEFAULT '';
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "approved_by" TEXT DEFAULT '';
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "file_url" TEXT DEFAULT '';
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "file_size" INTEGER DEFAULT 0;
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "data_retention_days" INTEGER DEFAULT 0;
ALTER TABLE "segment_exports" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: shopify_config (+5 cols) — domains\infrastructure\rewards.ts
ALTER TABLE "shopify_config" ADD COLUMN IF NOT EXISTS "shop_domain" VARCHAR(255) DEFAULT '';
ALTER TABLE "shopify_config" ADD COLUMN IF NOT EXISTS "storefront_token_secret_ref" VARCHAR DEFAULT '';
ALTER TABLE "shopify_config" ADD COLUMN IF NOT EXISTS "admin_token_secret_ref" VARCHAR(255) DEFAULT '';
ALTER TABLE "shopify_config" ADD COLUMN IF NOT EXISTS "allowed_collections" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "shopify_config" ADD COLUMN IF NOT EXISTS "webhook_secret_ref" VARCHAR(255) DEFAULT '';

-- ALTER: signature_audit_log (+11 cols) — domains\documents\workflows.ts
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "signer_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "event_description" TEXT DEFAULT '';
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR DEFAULT '';
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "location" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "external_event_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "provider_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "signature_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "signature_audit_log" ADD COLUMN IF NOT EXISTS "certificate_info" JSONB DEFAULT '{}'::jsonb;

-- ALTER: signature_audit_trail (+12 cols) — domains\documents\signatures.ts
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "signer_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "event_type" TEXT DEFAULT '';
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "event_description" TEXT DEFAULT '';
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "actor_user_id" TEXT DEFAULT '';
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "actor_email" TEXT DEFAULT '';
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "actor_role" TEXT DEFAULT '';
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "ip_address" TEXT DEFAULT '';
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "timestamp" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "geolocation" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_audit_trail" ADD COLUMN IF NOT EXISTS "hash_chain" TEXT DEFAULT '';

-- ALTER: signature_documents (+27 cols) — domains\documents\signatures.ts
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "title" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "document_type" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "file_url" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "file_name" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "file_size_bytes" INTEGER DEFAULT 0;
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "file_hash" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "provider_document_id" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "provider_envelope_id" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "sent_by" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "voided_by" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "void_reason" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "reminder_schedule" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "require_authentication" BOOLEAN DEFAULT false;
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "authentication_method" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "access_code" TEXT DEFAULT '';
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "sequential_signing" BOOLEAN DEFAULT false;
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "allow_decline" BOOLEAN DEFAULT false;
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "allow_reassign" BOOLEAN DEFAULT false;
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "signature_documents" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: signature_templates (+14 cols) — domains\documents\signatures.ts
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "template_file_url" TEXT DEFAULT '';
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "template_file_name" TEXT DEFAULT '';
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT '';
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "provider_template_id" TEXT DEFAULT '';
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "signature_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "default_settings" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "signer_roles" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "usage_count" INTEGER DEFAULT 0;
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "last_used_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_templates" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: signature_verification (+15 cols) — domains\documents\workflows.ts
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "signer_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "signature_hash" VARCHAR(255) DEFAULT '';
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "certificate_hash" VARCHAR(255) DEFAULT '';
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN DEFAULT false;
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "verification_method" VARCHAR(100) DEFAULT '';
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "verification_result" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "certificate_chain" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "certificate_valid_from" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "certificate_valid_to" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "certificate_issuer" TEXT DEFAULT '';
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "tamper_detected" BOOLEAN DEFAULT false;
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "tamper_details" TEXT DEFAULT '';
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "signature_file" VARCHAR(500) DEFAULT '';
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_verification" ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(255) DEFAULT '';

-- ALTER: signature_webhooks_log (+9 cols) — domains\documents\signatures.ts
ALTER TABLE "signature_webhooks_log" ADD COLUMN IF NOT EXISTS "provider_document_id" TEXT DEFAULT '';
ALTER TABLE "signature_webhooks_log" ADD COLUMN IF NOT EXISTS "payload" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_webhooks_log" ADD COLUMN IF NOT EXISTS "headers" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_webhooks_log" ADD COLUMN IF NOT EXISTS "received_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_webhooks_log" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_webhooks_log" ADD COLUMN IF NOT EXISTS "processing_status" TEXT DEFAULT '';
ALTER TABLE "signature_webhooks_log" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "signature_webhooks_log" ADD COLUMN IF NOT EXISTS "signature" TEXT DEFAULT '';
ALTER TABLE "signature_webhooks_log" ADD COLUMN IF NOT EXISTS "signature_verified" BOOLEAN DEFAULT false;

-- ALTER: signature_workflows (+20 cols) — domains\documents\workflows.ts
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "document_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "provider" TEXT DEFAULT '';
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "external_envelope_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "external_workflow_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "total_signers" INTEGER DEFAULT 0;
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "completed_signatures" INTEGER DEFAULT 0;
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "reminder_frequency_days" INTEGER DEFAULT 0;
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "auto_reminders_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "workflow_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "voided_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "voided_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "signature_workflows" ADD COLUMN IF NOT EXISTS "void_reason" TEXT DEFAULT '';

-- ALTER: signers (+15 cols) — domains\documents\workflows.ts
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "member_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "email" VARCHAR(255) DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "signer_order" INTEGER DEFAULT 0;
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "signed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "declined_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "decline_reason" TEXT DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "external_signer_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "signing_url" VARCHAR(500) DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "signature_image" TEXT DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "ip_address" VARCHAR DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "last_reminder_sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "signers" ADD COLUMN IF NOT EXISTS "reminder_count" INTEGER DEFAULT 0;

-- ALTER: sla_policies (+14 cols) — domains\infrastructure\support.ts
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "priority" TEXT DEFAULT '';
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "organization_tier" VARCHAR(50) DEFAULT '';
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "response_time_minutes" INTEGER DEFAULT 0;
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "resolution_time_minutes" INTEGER DEFAULT 0;
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "business_hours_only" BOOLEAN DEFAULT false;
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(100) DEFAULT '';
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "escalation_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "escalation_threshold_minutes" INTEGER DEFAULT 0;
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "escalation_to_user_id" TEXT DEFAULT '';
ALTER TABLE "sla_policies" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: sms_campaign_recipients (+7 cols) — domains\communications\sms.ts
ALTER TABLE "sms_campaign_recipients" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "sms_campaign_recipients" ADD COLUMN IF NOT EXISTS "phone_number" TEXT DEFAULT '';
ALTER TABLE "sms_campaign_recipients" ADD COLUMN IF NOT EXISTS "message_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "sms_campaign_recipients" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "sms_campaign_recipients" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "sms_campaign_recipients" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_campaign_recipients" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: sms_campaigns (+16 cols) — domains\communications\sms.ts
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "message" TEXT DEFAULT '';
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "recipient_filter" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "recipient_count" INTEGER DEFAULT 0;
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "sent_count" INTEGER DEFAULT 0;
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "delivered_count" INTEGER DEFAULT 0;
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "failed_count" INTEGER DEFAULT 0;
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "total_cost" NUMERIC DEFAULT 0;
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "scheduled_for" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_campaigns" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: sms_conversations (+8 cols) — domains\communications\sms.ts
ALTER TABLE "sms_conversations" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "sms_conversations" ADD COLUMN IF NOT EXISTS "phone_number" TEXT DEFAULT '';
ALTER TABLE "sms_conversations" ADD COLUMN IF NOT EXISTS "direction" TEXT DEFAULT '';
ALTER TABLE "sms_conversations" ADD COLUMN IF NOT EXISTS "message" TEXT DEFAULT '';
ALTER TABLE "sms_conversations" ADD COLUMN IF NOT EXISTS "twilio_sid" TEXT DEFAULT '';
ALTER TABLE "sms_conversations" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "sms_conversations" ADD COLUMN IF NOT EXISTS "replied_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_conversations" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: sms_messages (+16 cols) — domains\communications\sms.ts
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "phone_number" TEXT DEFAULT '';
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "message" TEXT DEFAULT '';
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "template_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "twilio_sid" TEXT DEFAULT '';
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "error_code" TEXT DEFAULT '';
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "segments" INTEGER DEFAULT 0;
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "price_amount" NUMERIC DEFAULT 0;
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "price_currency" TEXT DEFAULT '';
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "direction" TEXT DEFAULT '';
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_messages" ADD COLUMN IF NOT EXISTS "failed_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: sms_opt_outs (+5 cols) — domains\communications\sms.ts
ALTER TABLE "sms_opt_outs" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "sms_opt_outs" ADD COLUMN IF NOT EXISTS "phone_number" TEXT DEFAULT '';
ALTER TABLE "sms_opt_outs" ADD COLUMN IF NOT EXISTS "opted_out_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_opt_outs" ADD COLUMN IF NOT EXISTS "opted_out_via" TEXT DEFAULT '';
ALTER TABLE "sms_opt_outs" ADD COLUMN IF NOT EXISTS "reason" TEXT DEFAULT '';

-- ALTER: sms_rate_limits (+3 cols) — domains\communications\sms.ts
ALTER TABLE "sms_rate_limits" ADD COLUMN IF NOT EXISTS "messages_sent" INTEGER DEFAULT 0;
ALTER TABLE "sms_rate_limits" ADD COLUMN IF NOT EXISTS "window_start" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "sms_rate_limits" ADD COLUMN IF NOT EXISTS "window_end" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: sms_templates (+7 cols) — domains\communications\sms.ts
ALTER TABLE "sms_templates" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "sms_templates" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "sms_templates" ADD COLUMN IF NOT EXISTS "message_template" TEXT DEFAULT '';
ALTER TABLE "sms_templates" ADD COLUMN IF NOT EXISTS "variables" TEXT DEFAULT '';
ALTER TABLE "sms_templates" ADD COLUMN IF NOT EXISTS "category" TEXT DEFAULT '';
ALTER TABLE "sms_templates" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "sms_templates" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: social_accounts (+22 cols) — domains\infrastructure\social-media.ts
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "platform" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "platform_user_id" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "username" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "display_name" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "profile_image_url" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "access_token" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "refresh_token" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "token_expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "scopes" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "is_primary" BOOLEAN DEFAULT false;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "is_verified" BOOLEAN DEFAULT false;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "rate_limit_remaining" INTEGER DEFAULT 0;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "rate_limit_reset_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "follower_count" INTEGER DEFAULT 0;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "following_count" INTEGER DEFAULT 0;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "post_count" INTEGER DEFAULT 0;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "engagement_rate" NUMERIC DEFAULT 0;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "account_metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "connected_by" TEXT DEFAULT '';
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "connected_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_accounts" ADD COLUMN IF NOT EXISTS "last_synced_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: social_analytics (+16 cols) — domains\infrastructure\social-media.ts
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "account_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "analytics_date" DATE DEFAULT NOW();
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "follower_count" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "follower_change" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "following_count" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "posts_published" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "total_impressions" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "total_reach" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "total_likes" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "total_comments" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "total_shares" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "total_engagements" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "engagement_rate" NUMERIC DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "profile_visits" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "link_clicks" INTEGER DEFAULT 0;
ALTER TABLE "social_analytics" ADD COLUMN IF NOT EXISTS "analytics_metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: social_campaigns (+14 cols) — domains\infrastructure\social-media.ts
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "name" TEXT DEFAULT '';
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "campaign_code" TEXT DEFAULT '';
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "platforms" TEXT DEFAULT '';
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "target_audience" TEXT DEFAULT '';
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "campaign_hashtags" TEXT DEFAULT '';
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "start_date" DATE DEFAULT NOW();
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "end_date" DATE DEFAULT NOW();
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "goal_impressions" INTEGER DEFAULT 0;
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "goal_engagement_rate" NUMERIC DEFAULT 0;
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "goal_conversions" INTEGER DEFAULT 0;
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "campaign_metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "social_campaigns" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: social_engagement (+13 cols) — domains\infrastructure\social-media.ts
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "post_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "engagement_type" TEXT DEFAULT '';
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "platform_engagement_id" TEXT DEFAULT '';
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "platform_user_id" TEXT DEFAULT '';
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "username" TEXT DEFAULT '';
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "display_name" TEXT DEFAULT '';
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "profile_image_url" TEXT DEFAULT '';
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "sentiment" TEXT DEFAULT '';
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "sentiment_score" NUMERIC DEFAULT 0;
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "engaged_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "fetched_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_engagement" ADD COLUMN IF NOT EXISTS "engagement_metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: social_feeds (+15 cols) — domains\infrastructure\social-media.ts
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "account_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "platform_item_id" TEXT DEFAULT '';
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "item_type" TEXT DEFAULT '';
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "media_urls" TEXT DEFAULT '';
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "author_id" TEXT DEFAULT '';
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "author_name" TEXT DEFAULT '';
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "author_username" TEXT DEFAULT '';
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "author_image_url" TEXT DEFAULT '';
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "likes_count" INTEGER DEFAULT 0;
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "comments_count" INTEGER DEFAULT 0;
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "shares_count" INTEGER DEFAULT 0;
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "fetched_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_feeds" ADD COLUMN IF NOT EXISTS "feed_metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: social_posts (+26 cols) — domains\infrastructure\social-media.ts
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "account_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "post_type" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "media_urls" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "link_url" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "link_preview_image" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "hashtags" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "mentions" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "scheduled_for" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "platform_post_id" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "platform_url" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "likes_count" INTEGER DEFAULT 0;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "comments_count" INTEGER DEFAULT 0;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "shares_count" INTEGER DEFAULT 0;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "impressions_count" INTEGER DEFAULT 0;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "reach_count" INTEGER DEFAULT 0;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "engagement_rate" NUMERIC DEFAULT 0;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "retry_count" INTEGER DEFAULT 0;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "last_retry_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "post_metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "social_posts" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMPTZ DEFAULT NOW();

-- CREATE: sso_providers (29 cols) — sso-scim-schema.ts
CREATE TABLE IF NOT EXISTS "sso_providers" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "name" VARCHAR(255),
  "provider_type" VARCHAR(50),
  "saml_entity_id" VARCHAR(500),
  "saml_sso_url" VARCHAR(500),
  "saml_slo_url" VARCHAR(500),
  "saml_certificate" TEXT,
  "saml_signing_algorithm" VARCHAR(50),
  "saml_name_id_format" VARCHAR(200),
  "oidc_issuer" VARCHAR(500),
  "oidc_client_id" VARCHAR(255),
  "oidc_client_secret" TEXT,
  "oidc_authorization_endpoint" VARCHAR(500),
  "oidc_token_endpoint" VARCHAR(500),
  "oidc_userinfo_endpoint" VARCHAR(500),
  "oidc_jwks_uri" VARCHAR(500),
  "oidc_scopes" TEXT,
  "attribute_mapping" JSONB,
  "role_mapping" JSONB,
  "auto_provision" BOOLEAN,
  "just_in_time_provisioning" BOOLEAN,
  "require_groups" TEXT,
  "enabled" BOOLEAN,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "created_by" VARCHAR(255),
  "updated_at" TIMESTAMPTZ,
  "updated_by" VARCHAR(255)
);

-- CREATE: sso_sessions (20 cols) — sso-scim-schema.ts
CREATE TABLE IF NOT EXISTS "sso_sessions" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "provider_id" UUID,
  "user_id" UUID,
  "organization_id" UUID,
  "session_id" VARCHAR(255),
  "name_id" VARCHAR(255),
  "session_index" VARCHAR(255),
  "idp_session_id" VARCHAR(255),
  "auth_method" VARCHAR(50),
  "auth_level" VARCHAR(50),
  "ip_address" VARCHAR(50),
  "user_agent" TEXT,
  "device_fingerprint" VARCHAR(255),
  "authenticated_at" TIMESTAMPTZ,
  "last_access_at" TIMESTAMPTZ,
  "expires_at" TIMESTAMPTZ,
  "terminated_at" TIMESTAMPTZ,
  "status" VARCHAR(50),
  "created_at" TIMESTAMPTZ,
  "metadata" JSONB
);

-- ALTER: staff_certifications (+16 cols) — certification-management-schema.ts
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "full_name" TEXT DEFAULT '';
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "role" VARCHAR(100) DEFAULT '';
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "certification_type_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "certification_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "issued_date" DATE DEFAULT NOW();
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "expiry_date" DATE DEFAULT NOW();
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "last_renewal_date" DATE DEFAULT NOW();
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "next_renewal_due" DATE DEFAULT NOW();
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "status" VARCHAR(20) DEFAULT '';
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "certificate_document" TEXT DEFAULT '';
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "verification_document" TEXT DEFAULT '';
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "verified_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "verified_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "verification_notes" TEXT DEFAULT '';
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "compliant" BOOLEAN DEFAULT false;
ALTER TABLE "staff_certifications" ADD COLUMN IF NOT EXISTS "compliance_notes" TEXT DEFAULT '';

-- ALTER: steward_assignments (+29 cols) — union-structure-schema.ts
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "steward_id" TEXT DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "steward_type" TEXT DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "unit_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "worksite_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "department" VARCHAR(255) DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "shift" VARCHAR(100) DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "floor" VARCHAR(100) DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "area" VARCHAR(255) DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "start_date" DATE DEFAULT NOW();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "end_date" DATE DEFAULT NOW();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "is_interim" BOOLEAN DEFAULT false;
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "appointed_by" TEXT DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "elected_date" DATE DEFAULT NOW();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "certification_date" DATE DEFAULT NOW();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "responsibility_areas" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "members_covered" INTEGER DEFAULT 0;
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "training_completed" BOOLEAN DEFAULT false;
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "training_completion_date" DATE DEFAULT NOW();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "certification_expiry" DATE DEFAULT NOW();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "work_phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "personal_phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "preferred_contact_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "availability_notes" TEXT DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "grievance_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "steward_assignments" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- CREATE: stewards (10 cols) — domains\member\stewards.ts
CREATE TABLE IF NOT EXISTS "stewards" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id" UUID,
  "user_id" UUID,
  "region" VARCHAR(255),
  "specialization" VARCHAR(255),
  "active" BOOLEAN,
  "max_caseload" INTEGER,
  "current_caseload" INTEGER,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: strategic_goals (12 cols) — domains\governance\strategic-goals.ts
CREATE TABLE IF NOT EXISTS "strategic_goals" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" VARCHAR(255),
  "title" TEXT,
  "description" TEXT,
  "category" TEXT,
  "progress" INTEGER,
  "due_date" TIMESTAMPTZ,
  "owner" VARCHAR(255),
  "status" TEXT,
  "metadata" JSONB,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: strike_fund_disbursements (+20 cols) — domains\finance\taxes.ts
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "strike_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "strike_name" TEXT DEFAULT '';
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "strike_start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "strike_end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "payment_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "payment_amount" NUMERIC DEFAULT 0;
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "payment_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "payment_reference" VARCHAR(100) DEFAULT '';
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "tax_year" VARCHAR(4) DEFAULT '';
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "tax_month" VARCHAR(2) DEFAULT '';
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "week_number" VARCHAR(10) DEFAULT '';
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "weekly_total" NUMERIC DEFAULT 0;
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "exceeds_threshold" BOOLEAN DEFAULT false;
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "requires_tax_slip" BOOLEAN DEFAULT false;
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "t4a_generated" BOOLEAN DEFAULT false;
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "t4a_generated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "rl1_generated" BOOLEAN DEFAULT false;
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "rl1_generated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "province" VARCHAR(2) DEFAULT '';
ALTER TABLE "strike_fund_disbursements" ADD COLUMN IF NOT EXISTS "is_quebec_resident" BOOLEAN DEFAULT false;

-- ALTER: stripe_webhook_events (+9 cols) — domains\finance\payments.ts
ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "stripe_payment_intent_id" VARCHAR DEFAULT '';
ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "stripe_customer_id" VARCHAR DEFAULT '';
ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "event_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "processed" BOOLEAN DEFAULT false;
ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "processing_error" TEXT DEFAULT '';
ALTER TABLE "stripe_webhook_events" ADD COLUMN IF NOT EXISTS "updated_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: support_tickets (+22 cols) — domains\infrastructure\support.ts
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "organization_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "requestor_user_id" TEXT DEFAULT '';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "requestor_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "requestor_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "source" TEXT DEFAULT '';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "assigned_to_user_id" TEXT DEFAULT '';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "assigned_to_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "assigned_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "sla_response_by" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "sla_resolve_by" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "closed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "response_sla_breach" BOOLEAN DEFAULT false;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "resolution_sla_breach" BOOLEAN DEFAULT false;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "response_time_minutes" INTEGER DEFAULT 0;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "resolution_time_minutes" INTEGER DEFAULT 0;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "tags" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "attachments" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "satisfaction_comment" TEXT DEFAULT '';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "satisfaction_responded_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "support_tickets" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';

-- ALTER: survey_answers (+7 cols) — domains\communications\surveys.ts
ALTER TABLE "survey_answers" ADD COLUMN IF NOT EXISTS "response_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "survey_answers" ADD COLUMN IF NOT EXISTS "question_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "survey_answers" ADD COLUMN IF NOT EXISTS "answer_text" TEXT DEFAULT '';
ALTER TABLE "survey_answers" ADD COLUMN IF NOT EXISTS "answer_number" NUMERIC DEFAULT 0;
ALTER TABLE "survey_answers" ADD COLUMN IF NOT EXISTS "answer_choices" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "survey_answers" ADD COLUMN IF NOT EXISTS "answer_other" TEXT DEFAULT '';
ALTER TABLE "survey_answers" ADD COLUMN IF NOT EXISTS "answered_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: survey_questions (+19 cols) — domains\communications\surveys.ts
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "survey_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "question_text" TEXT DEFAULT '';
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "question_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 0;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "section" VARCHAR(255) DEFAULT '';
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "required" BOOLEAN DEFAULT false;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "choices" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "allow_other" BOOLEAN DEFAULT false;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "min_choices" INTEGER DEFAULT 0;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "max_choices" INTEGER DEFAULT 0;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "rating_min" INTEGER DEFAULT 0;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "rating_max" INTEGER DEFAULT 0;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "rating_min_label" VARCHAR(100) DEFAULT '';
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "rating_max_label" VARCHAR(100) DEFAULT '';
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "min_length" INTEGER DEFAULT 0;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "max_length" INTEGER DEFAULT 0;
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "placeholder" TEXT DEFAULT '';
ALTER TABLE "survey_questions" ADD COLUMN IF NOT EXISTS "show_if" JSONB DEFAULT '{}'::jsonb;

-- ALTER: survey_responses (+10 cols) — domains\communications\surveys.ts
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "survey_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "user_id" TEXT DEFAULT '';
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "respondent_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "respondent_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "time_spent_seconds" INTEGER DEFAULT 0;
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "ip_address" TEXT DEFAULT '';
ALTER TABLE "survey_responses" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';

-- ALTER: surveys (+17 cols) — domains\communications\surveys.ts
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "title" VARCHAR(255) DEFAULT '';
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "survey_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "published_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "closes_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "allow_anonymous" BOOLEAN DEFAULT false;
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "allow_multiple_responses" BOOLEAN DEFAULT false;
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "require_authentication" BOOLEAN DEFAULT false;
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "shuffle_questions" BOOLEAN DEFAULT false;
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "show_results" BOOLEAN DEFAULT false;
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "welcome_message" TEXT DEFAULT '';
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "thank_you_message" TEXT DEFAULT '';
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "response_count" INTEGER DEFAULT 0;
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "view_count" INTEGER DEFAULT 0;
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "completion_rate" NUMERIC DEFAULT 0;
ALTER TABLE "surveys" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: swiss_cold_storage (+12 cols) — domains\compliance\force-majeure.ts
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "vault_location" TEXT DEFAULT '';
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "vault_account_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "storage_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "data_category" VARCHAR(50) DEFAULT '';
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "last_updated" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "encryption_algorithm" VARCHAR(50) DEFAULT '';
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "encrypted_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "access_requires_multi_sig" BOOLEAN DEFAULT false;
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "minimum_signatures" INTEGER DEFAULT 0;
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "total_key_holders" INTEGER DEFAULT 0;
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "last_accessed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "swiss_cold_storage" ADD COLUMN IF NOT EXISTS "last_accessed_by" VARCHAR(255) DEFAULT '';

-- ALTER: t106_filing_tracking (+13 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "total_foreign_transactions" NUMERIC DEFAULT 0;
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "total_cad_equivalent" NUMERIC DEFAULT 0;
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "t106_threshold_exceeded" BOOLEAN DEFAULT false;
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "t106_filing_required" BOOLEAN DEFAULT false;
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "reportable_transaction_count" VARCHAR(10) DEFAULT '';
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "reportable_transaction_ids" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "filing_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "filing_due_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "filed_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "confirmation_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "prepared_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "reviewed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "t106_filing_tracking" ADD COLUMN IF NOT EXISTS "filed_by" VARCHAR(255) DEFAULT '';

-- ALTER: t4a_tax_slips (+28 cols) — domains\finance\taxes.ts
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "tax_year" VARCHAR(4) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "payer_name" TEXT DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "payer_business_number" VARCHAR(15) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "payer_address" TEXT DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "payer_city" VARCHAR(100) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "payer_province" VARCHAR(2) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "payer_postal_code" VARCHAR(10) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_name" TEXT DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_sin" VARCHAR(11) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_address" TEXT DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_city" VARCHAR(100) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_province" VARCHAR(2) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "recipient_postal_code" VARCHAR(10) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "box_028_other_income" NUMERIC DEFAULT 0;
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "box_022_income_tax_deducted" NUMERIC DEFAULT 0;
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "generated_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "generated_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "filed_with_cra" BOOLEAN DEFAULT false;
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "cra_filing_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "cra_confirmation_number" VARCHAR(50) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "delivered_to_member" BOOLEAN DEFAULT false;
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "delivery_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "delivered_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "pdf_url" TEXT DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "xml_url" TEXT DEFAULT '';
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "is_amendment" BOOLEAN DEFAULT false;
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "original_slip_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "t4a_tax_slips" ADD COLUMN IF NOT EXISTS "amendment_reason" TEXT DEFAULT '';

-- ALTER: task_comments (+4 cols) — domains\communications\organizer-workflows.ts
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "task_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "author_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "content" TEXT DEFAULT '';
ALTER TABLE "task_comments" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: tax_year_end_processing (+19 cols) — domains\finance\taxes.ts
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "processing_started_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "processing_completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "t4a_slips_generated" VARCHAR(10) DEFAULT '';
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "t4a_total_amount" NUMERIC DEFAULT 0;
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "t4a_filing_deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "t4a_filed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "t4a_filing_confirmed" BOOLEAN DEFAULT false;
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "rl1_slips_generated" VARCHAR(10) DEFAULT '';
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "rl1_total_amount" NUMERIC DEFAULT 0;
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "rl1_filing_deadline" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "rl1_filed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "rl1_filing_confirmed" BOOLEAN DEFAULT false;
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "member_delivery_started_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "member_delivery_completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "slips_delivered_to_members" VARCHAR(10) DEFAULT '';
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "compliance_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "deadline_missed" BOOLEAN DEFAULT false;
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "processed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "tax_year_end_processing" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';

-- ALTER: ticket_comments (+7 cols) — domains\infrastructure\support.ts
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "comment" TEXT DEFAULT '';
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "is_internal" BOOLEAN DEFAULT false;
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "is_automated" BOOLEAN DEFAULT false;
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "author_user_id" TEXT DEFAULT '';
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "author_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "author_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "ticket_comments" ADD COLUMN IF NOT EXISTS "attachments" JSONB DEFAULT '{}'::jsonb;

-- ALTER: ticket_history (+7 cols) — domains\infrastructure\support.ts
ALTER TABLE "ticket_history" ADD COLUMN IF NOT EXISTS "action" VARCHAR(100) DEFAULT '';
ALTER TABLE "ticket_history" ADD COLUMN IF NOT EXISTS "field" VARCHAR(100) DEFAULT '';
ALTER TABLE "ticket_history" ADD COLUMN IF NOT EXISTS "old_value" TEXT DEFAULT '';
ALTER TABLE "ticket_history" ADD COLUMN IF NOT EXISTS "new_value" TEXT DEFAULT '';
ALTER TABLE "ticket_history" ADD COLUMN IF NOT EXISTS "changed_by_user_id" TEXT DEFAULT '';
ALTER TABLE "ticket_history" ADD COLUMN IF NOT EXISTS "changed_by_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "ticket_history" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: traditional_knowledge_registry (+13 cols) — domains\compliance\indigenous-data.ts
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "knowledge_title" TEXT DEFAULT '';
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "knowledge_description" TEXT DEFAULT '';
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "sensitivity_level" VARCHAR(20) DEFAULT '';
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "gender_restricted" BOOLEAN DEFAULT false;
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "age_restricted" BOOLEAN DEFAULT false;
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "primary_keeper_user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "secondary_keepers" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "public_access" BOOLEAN DEFAULT false;
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "member_only_access" BOOLEAN DEFAULT false;
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "elder_approval_required" BOOLEAN DEFAULT false;
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "documentation_url" TEXT DEFAULT '';
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "video_url" TEXT DEFAULT '';
ALTER TABLE "traditional_knowledge_registry" ADD COLUMN IF NOT EXISTS "audio_url" TEXT DEFAULT '';

-- ALTER: training_courses (+28 cols) — domains\scheduling\training.ts
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "course_difficulty" VARCHAR(20) DEFAULT '';
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "duration_hours" NUMERIC DEFAULT 0;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "duration_days" INTEGER DEFAULT 0;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "has_prerequisites" BOOLEAN DEFAULT false;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "prerequisite_courses" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "prerequisite_certifications" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "learning_objectives" TEXT DEFAULT '';
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "course_outline" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "course_materials_url" TEXT DEFAULT '';
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "presentation_slides_url" TEXT DEFAULT '';
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "workbook_url" TEXT DEFAULT '';
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "additional_resources" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "primary_instructor_name" VARCHAR(200) DEFAULT '';
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "instructor_ids" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "min_enrollment" INTEGER DEFAULT 0;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "max_enrollment" INTEGER DEFAULT 0;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "provides_certification" BOOLEAN DEFAULT false;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "certification_name" VARCHAR(200) DEFAULT '';
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "certification_valid_years" INTEGER DEFAULT 0;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "clc_approved" BOOLEAN DEFAULT false;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "clc_approval_date" DATE DEFAULT NOW();
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "clc_course_code" VARCHAR(50) DEFAULT '';
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "course_fee" NUMERIC DEFAULT 0;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "materials_fee" NUMERIC DEFAULT 0;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "travel_subsidy_available" BOOLEAN DEFAULT false;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "mandatory_for_roles" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "training_courses" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: training_programs (+13 cols) — domains\scheduling\training.ts
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "program_description" TEXT DEFAULT '';
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "program_duration" VARCHAR(100) DEFAULT '';
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "required_courses" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "elective_courses" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "minimum_required_courses" INTEGER DEFAULT 0;
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "minimum_elective_courses" INTEGER DEFAULT 0;
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "provides_certification" BOOLEAN DEFAULT false;
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "certification_name" VARCHAR(200) DEFAULT '';
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "clc_approved" BOOLEAN DEFAULT false;
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "clc_approval_date" DATE DEFAULT NOW();
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "is_active" BOOLEAN DEFAULT false;
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "training_programs" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';

-- ALTER: transaction_currency_conversions (+11 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "original_currency" VARCHAR(3) DEFAULT '';
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "original_amount" NUMERIC DEFAULT 0;
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "cad_amount" NUMERIC DEFAULT 0;
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "fx_rate_used" NUMERIC DEFAULT 0;
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "fx_rate_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "fx_rate_source" VARCHAR(50) DEFAULT '';
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "exception_approved" BOOLEAN DEFAULT false;
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "exception_reason" TEXT DEFAULT '';
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "approved_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "transaction_currency_conversions" ADD COLUMN IF NOT EXISTS "conversion_method" VARCHAR(50) DEFAULT '';

-- ALTER: transfer_pricing_documentation (+15 cols) — domains\finance\transfer-pricing.ts
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "from_party" UUID DEFAULT gen_random_uuid();
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "to_party" UUID DEFAULT gen_random_uuid();
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "arms_length_required" BOOLEAN DEFAULT false;
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "arms_length_confirmed" BOOLEAN DEFAULT false;
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "arms_length_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "cad_amount" NUMERIC DEFAULT 0;
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "pricing_justification" TEXT DEFAULT '';
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "comparable_transactions" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "supporting_documents" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "documented_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "documented_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "review_required" BOOLEAN DEFAULT false;
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "reviewed_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "transfer_pricing_documentation" ADD COLUMN IF NOT EXISTS "review_notes" TEXT DEFAULT '';

-- ALTER: trend_analyses (+14 cols) — analytics.ts
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "analysis_type" TEXT DEFAULT '';
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "data_source" TEXT DEFAULT '';
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "time_range" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "detected_trend" TEXT DEFAULT '';
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "trend_strength" NUMERIC DEFAULT 0;
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "anomalies_detected" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "anomaly_count" INTEGER DEFAULT 0;
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "seasonal_pattern" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "correlations" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "insights" TEXT DEFAULT '';
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "recommendations" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "statistical_tests" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "visualization_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "trend_analyses" ADD COLUMN IF NOT EXISTS "confidence" NUMERIC DEFAULT 0;

-- ALTER: union_density (+17 cols) — domains\data\benchmarks.ts
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "geography_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "naics_code" VARCHAR(10) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "naics_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "noc_code" VARCHAR(10) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "noc_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "sex" VARCHAR(1) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "age_group" VARCHAR(50) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "age_group_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "citizenship" VARCHAR(50) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "citizenship_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "union_status" VARCHAR(50) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "union_status_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "density_value" NUMERIC DEFAULT 0;
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "ref_date" VARCHAR(20) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "survey_year" INTEGER DEFAULT 0;
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "source" VARCHAR(100) DEFAULT '';
ALTER TABLE "union_density" ADD COLUMN IF NOT EXISTS "sync_id" VARCHAR(100) DEFAULT '';

-- CREATE: union_dues_receipts (42 cols) — domains\finance\taxes.ts
CREATE TABLE IF NOT EXISTS "union_dues_receipts" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" VARCHAR(255),
  "organization_id" UUID,
  "tax_year" VARCHAR(4),
  "member_name" TEXT,
  "member_sin" VARCHAR(11),
  "member_address" TEXT,
  "member_city" VARCHAR(100),
  "member_province" VARCHAR(2),
  "member_postal_code" VARCHAR(10),
  "union_name" TEXT,
  "union_business_number" VARCHAR(15),
  "union_address" TEXT,
  "union_city" VARCHAR(100),
  "union_province" VARCHAR(2),
  "union_postal_code" VARCHAR(10),
  "total_union_dues" NUMERIC,
  "regular_dues" NUMERIC,
  "special_assessments" NUMERIC,
  "initiation_fees" NUMERIC,
  "non_deductible_amount" NUMERIC,
  "non_deductible_description" TEXT,
  "cope_contributions" NUMERIC,
  "collection_method" VARCHAR(30),
  "employer_deducted" BOOLEAN,
  "employer_name" TEXT,
  "employer_business_number" VARCHAR(15),
  "is_quebec_resident" BOOLEAN,
  "rl1_box_f_amount" NUMERIC,
  "receipt_number" VARCHAR(50),
  "generated_at" TIMESTAMPTZ,
  "generated_by" VARCHAR(255),
  "delivered_to_member" BOOLEAN,
  "delivery_method" VARCHAR(50),
  "delivered_at" TIMESTAMPTZ,
  "pdf_url" TEXT,
  "is_amendment" BOOLEAN,
  "original_receipt_id" UUID,
  "amendment_reason" TEXT,
  "status" VARCHAR(20),
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: union_dues_year_end (17 cols) — domains\finance\taxes.ts
CREATE TABLE IF NOT EXISTS "union_dues_year_end" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "organization_id" UUID,
  "tax_year" VARCHAR(4),
  "total_members" VARCHAR(10),
  "receipts_generated" VARCHAR(10),
  "receipts_delivered" VARCHAR(10),
  "total_dues_collected" NUMERIC,
  "total_deductible_amount" NUMERIC,
  "total_non_deductible_amount" NUMERIC,
  "processing_started_at" TIMESTAMPTZ,
  "processing_completed_at" TIMESTAMPTZ,
  "delivery_deadline" TIMESTAMPTZ,
  "status" VARCHAR(20),
  "processed_by" VARCHAR(255),
  "notes" TEXT,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: union_representation_votes (+31 cols) — domains\infrastructure\organizing.ts
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "campaign_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "filing_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "vote_date" DATE DEFAULT NOW();
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "vote_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "voting_method" VARCHAR(50) DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "eligible_voters" INTEGER DEFAULT 0;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "ballots_cast" INTEGER DEFAULT 0;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "voter_turnout_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "votes_for_union" INTEGER DEFAULT 0;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "votes_against_union" INTEGER DEFAULT 0;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "challenged_ballots" INTEGER DEFAULT 0;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "void_ballots" INTEGER DEFAULT 0;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "union_vote_percentage" NUMERIC DEFAULT 0;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "result" VARCHAR(50) DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "certification_issued" BOOLEAN DEFAULT false;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "certification_date" DATE DEFAULT NOW();
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "vote_breakdown_by_department" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "vote_breakdown_by_shift" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "union_filed_objections" BOOLEAN DEFAULT false;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "employer_filed_objections" BOOLEAN DEFAULT false;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "objections_summary" TEXT DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "objections_resolved" BOOLEAN DEFAULT false;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "objections_resolution" TEXT DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "recount_requested" BOOLEAN DEFAULT false;
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "recount_date" DATE DEFAULT NOW();
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "recount_result" VARCHAR(50) DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "certification_number" VARCHAR(100) DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "bargaining_unit_certified" TEXT DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "union_representative_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "union_representation_votes" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: user_consents (+13 cols) — domains\compliance\gdpr.ts
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "consent_type" TEXT DEFAULT '';
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "legal_basis" TEXT DEFAULT '';
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "processing_purpose" TEXT DEFAULT '';
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "consent_version" TEXT DEFAULT '';
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "consent_text" TEXT DEFAULT '';
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "ip_address" TEXT DEFAULT '';
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "user_agent" TEXT DEFAULT '';
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "granted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "expires_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "withdrawn_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "user_consents" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: user_engagement_scores (+15 cols) — communication-analytics-schema.ts
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "user_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "overall_score" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "email_score" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "sms_score" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "push_score" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "last_email_open" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "last_sms_reply" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "last_push_open" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "total_emails_received" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "total_emails_opened" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "total_sms_received" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "total_sms_replied" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "total_push_received" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "total_push_opened" INTEGER DEFAULT 0;
ALTER TABLE "user_engagement_scores" ADD COLUMN IF NOT EXISTS "calculated_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: user_notification_preferences (+14 cols) — domains\communications\notifications.ts
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "email" TEXT DEFAULT '';
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "phone" TEXT DEFAULT '';
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "email_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "sms_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "push_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "in_app_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "digest_frequency" TEXT DEFAULT '';
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_start" TEXT DEFAULT '';
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "quiet_hours_end" TEXT DEFAULT '';
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "claim_updates" BOOLEAN DEFAULT false;
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "document_updates" BOOLEAN DEFAULT false;
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "deadline_alerts" BOOLEAN DEFAULT false;
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "system_announcements" BOOLEAN DEFAULT false;
ALTER TABLE "user_notification_preferences" ADD COLUMN IF NOT EXISTS "security_alerts" BOOLEAN DEFAULT false;

-- CREATE: user_sessions (12 cols) — domains\member\user-management.ts
CREATE TABLE IF NOT EXISTS "user_sessions" (
  "session_id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "user_id" VARCHAR(255),
  "organization_id" UUID,
  "session_token" TEXT,
  "refresh_token" TEXT,
  "device_info" JSONB,
  "ip_address" VARCHAR(45),
  "user_agent" TEXT,
  "expires_at" TIMESTAMPTZ,
  "is_active" BOOLEAN,
  "created_at" TIMESTAMPTZ,
  "last_used_at" TIMESTAMPTZ
);

-- CREATE: user_uuid_mapping (4 cols) — domains\infrastructure\uuid-mapping.ts
CREATE TABLE IF NOT EXISTS "user_uuid_mapping" (
  "user_uuid" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "clerk_user_id" TEXT,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- CREATE: users (29 cols) — domains\member\user-management.ts
CREATE TABLE IF NOT EXISTS "users" (
  "user_id" VARCHAR(255) PRIMARY KEY DEFAULT '',
  "email" VARCHAR(255),
  "email_verified" BOOLEAN,
  "email_verified_at" TIMESTAMPTZ,
  "password_hash" TEXT,
  "first_name" VARCHAR(100),
  "last_name" VARCHAR(100),
  "display_name" VARCHAR(200),
  "avatar_url" TEXT,
  "phone" VARCHAR(20),
  "phone_verified" BOOLEAN,
  "phone_verified_at" TIMESTAMPTZ,
  "timezone" VARCHAR(50),
  "locale" VARCHAR(10),
  "is_active" BOOLEAN,
  "is_system_admin" BOOLEAN,
  "last_login_at" TIMESTAMPTZ,
  "last_login_ip" VARCHAR(45),
  "password_changed_at" TIMESTAMPTZ,
  "failed_login_attempts" INTEGER,
  "account_locked_until" TIMESTAMPTZ,
  "two_factor_enabled" BOOLEAN,
  "two_factor_secret" TEXT,
  "two_factor_backup_codes" TEXT,
  "encrypted_sin" TEXT,
  "encrypted_ssn" TEXT,
  "encrypted_bank_account" TEXT,
  "created_at" TIMESTAMPTZ,
  "updated_at" TIMESTAMPTZ
);

-- ALTER: voter_eligibility (+9 cols) — domains\governance\voting.ts
ALTER TABLE "voter_eligibility" ADD COLUMN IF NOT EXISTS "member_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "voter_eligibility" ADD COLUMN IF NOT EXISTS "is_eligible" BOOLEAN DEFAULT false;
ALTER TABLE "voter_eligibility" ADD COLUMN IF NOT EXISTS "eligibility_reason" TEXT DEFAULT '';
ALTER TABLE "voter_eligibility" ADD COLUMN IF NOT EXISTS "voting_weight" NUMERIC DEFAULT 0;
ALTER TABLE "voter_eligibility" ADD COLUMN IF NOT EXISTS "can_delegate" BOOLEAN DEFAULT false;
ALTER TABLE "voter_eligibility" ADD COLUMN IF NOT EXISTS "delegated_to" UUID DEFAULT gen_random_uuid();
ALTER TABLE "voter_eligibility" ADD COLUMN IF NOT EXISTS "restrictions" TEXT DEFAULT '';
ALTER TABLE "voter_eligibility" ADD COLUMN IF NOT EXISTS "verification_status" VARCHAR(20) DEFAULT '';
ALTER TABLE "voter_eligibility" ADD COLUMN IF NOT EXISTS "voter_metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: votes (+11 cols) — domains\governance\voting.ts
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "session_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "option_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "voter_id" VARCHAR(100) DEFAULT '';
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "voter_hash" VARCHAR(100) DEFAULT '';
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "signature" TEXT DEFAULT '';
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "receipt_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "verification_code" VARCHAR(100) DEFAULT '';
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "audit_hash" VARCHAR(255) DEFAULT '';
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "is_anonymous" BOOLEAN DEFAULT false;
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "voter_type" VARCHAR(20) DEFAULT '';
ALTER TABLE "votes" ADD COLUMN IF NOT EXISTS "voter_metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: voting_audit_log (+11 cols) — domains\governance\voting.ts
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "receipt_id" VARCHAR(255) DEFAULT '';
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "vote_hash" VARCHAR(255) DEFAULT '';
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "signature" TEXT DEFAULT '';
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "audit_hash" VARCHAR(255) DEFAULT '';
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "previous_audit_hash" VARCHAR(255) DEFAULT '';
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "voted_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "verification_code" VARCHAR(100) DEFAULT '';
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "is_anonymous" BOOLEAN DEFAULT false;
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "chain_valid" BOOLEAN DEFAULT false;
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "tampered_indicators" TEXT DEFAULT '';
ALTER TABLE "voting_audit_log" ADD COLUMN IF NOT EXISTS "audit_metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: voting_notifications (+10 cols) — domains\governance\voting.ts
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "type" VARCHAR(50) DEFAULT '';
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "title" VARCHAR(200) DEFAULT '';
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "message" TEXT DEFAULT '';
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "recipient_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "priority" VARCHAR(20) DEFAULT '';
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "delivery_method" TEXT DEFAULT '';
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "is_read" BOOLEAN DEFAULT false;
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "read_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "voting_notifications" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: voting_options (+5 cols) — domains\governance\voting.ts
ALTER TABLE "voting_options" ADD COLUMN IF NOT EXISTS "text" VARCHAR(500) DEFAULT '';
ALTER TABLE "voting_options" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "voting_options" ADD COLUMN IF NOT EXISTS "order_index" INTEGER DEFAULT 0;
ALTER TABLE "voting_options" ADD COLUMN IF NOT EXISTS "is_default" BOOLEAN DEFAULT false;
ALTER TABLE "voting_options" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: voting_sessions (+15 cols) — domains\governance\voting.ts
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "type" VARCHAR(50) DEFAULT '';
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "meeting_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "start_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "end_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "scheduled_end_time" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "allow_anonymous" BOOLEAN DEFAULT false;
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "requires_quorum" BOOLEAN DEFAULT false;
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "quorum_threshold" INTEGER DEFAULT 0;
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "total_eligible_voters" INTEGER DEFAULT 0;
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "settings" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "voting_sessions" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: wage_benchmarks (+23 cols) — domains\data\benchmarks.ts
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "noc_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "noc_category" VARCHAR(100) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "geography_code" VARCHAR(10) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "geography_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "geography_type" VARCHAR(20) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "naics_code" VARCHAR(10) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "naics_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "wage_value" NUMERIC DEFAULT 0;
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "wage_unit" VARCHAR(20) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "wage_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "sex" VARCHAR(1) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "age_group" VARCHAR(50) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "age_group_name" VARCHAR(100) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "education_level" VARCHAR(50) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "statistics_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "data_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "ref_date" VARCHAR(20) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "survey_year" INTEGER DEFAULT 0;
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "source" VARCHAR(100) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "data_quality_symbol" VARCHAR(10) DEFAULT '';
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "is_terminated" BOOLEAN DEFAULT false;
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "decimals" INTEGER DEFAULT 0;
ALTER TABLE "wage_benchmarks" ADD COLUMN IF NOT EXISTS "sync_id" VARCHAR(100) DEFAULT '';

-- ALTER: webhook_deliveries (+14 cols) — integration-schema.ts
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "subscription_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "event_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "request_url" VARCHAR(500) DEFAULT '';
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "request_method" VARCHAR(10) DEFAULT '';
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "request_headers" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "request_body" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "response_status" INTEGER DEFAULT 0;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "response_headers" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "sent_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "response_time_ms" INTEGER DEFAULT 0;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "is_retry" BOOLEAN DEFAULT false;
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "status" VARCHAR(50) DEFAULT '';
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "webhook_deliveries" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: webhook_receipts (+3 cols) — domains\infrastructure\rewards.ts
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "event_type" VARCHAR(100) DEFAULT '';
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "payload_json" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "webhook_receipts" ADD COLUMN IF NOT EXISTS "processed_at" TIMESTAMPTZ DEFAULT NOW();

-- ALTER: webhook_subscriptions (+19 cols) — integration-schema.ts
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "url" VARCHAR(500) DEFAULT '';
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "events" TEXT DEFAULT '';
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "auth_type" VARCHAR(50) DEFAULT '';
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "auth_secret" TEXT DEFAULT '';
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "custom_headers" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "filters" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "retry_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "max_retries" INTEGER DEFAULT 0;
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "retry_backoff" VARCHAR(50) DEFAULT '';
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "enabled" BOOLEAN DEFAULT false;
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "delivery_success_count" INTEGER DEFAULT 0;
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "delivery_failure_count" INTEGER DEFAULT 0;
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "last_delivery_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "last_failure_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "last_failure_reason" TEXT DEFAULT '';
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "created_by" VARCHAR(255) DEFAULT '';
ALTER TABLE "webhook_subscriptions" ADD COLUMN IF NOT EXISTS "metadata" JSONB DEFAULT '{}'::jsonb;

-- ALTER: website_settings (+20 cols) — cms-website-schema.ts
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "site_name" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "site_tagline" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "site_description" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "logo_url" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "favicon_url" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "primary_color" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "secondary_color" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "font_family" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "footer_text" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "footer_links" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "social_links" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "contact_email" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "contact_phone" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "contact_address" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "google_analytics_id" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "facebook_pixel_id" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "custom_css" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "custom_js" TEXT DEFAULT '';
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "maintenance_mode" BOOLEAN DEFAULT false;
ALTER TABLE "website_settings" ADD COLUMN IF NOT EXISTS "maintenance_message" TEXT DEFAULT '';

-- ALTER: weekly_threshold_tracking (+10 cols) — domains\finance\taxes.ts
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "tax_year" VARCHAR(4) DEFAULT '';
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "week_number" VARCHAR(10) DEFAULT '';
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "week_start_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "week_end_date" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "payment_count" VARCHAR(10) DEFAULT '';
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "weekly_total" NUMERIC DEFAULT 0;
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "exceeds_threshold" BOOLEAN DEFAULT false;
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "threshold_amount" NUMERIC DEFAULT 0;
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "requires_t4a" BOOLEAN DEFAULT false;
ALTER TABLE "weekly_threshold_tracking" ADD COLUMN IF NOT EXISTS "requires_rl1" BOOLEAN DEFAULT false;

-- ALTER: workflow_definitions (+14 cols) — alerting-automation-schema.ts
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "category" VARCHAR(100) DEFAULT '';
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "trigger_type" TEXT DEFAULT '';
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "trigger_config" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "workflow_steps" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "is_enabled" BOOLEAN DEFAULT false;
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "is_deleted" BOOLEAN DEFAULT false;
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "version" INTEGER DEFAULT 0;
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "last_executed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "execution_count" INTEGER DEFAULT 0;
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "success_count" INTEGER DEFAULT 0;
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "failure_count" INTEGER DEFAULT 0;
ALTER TABLE "workflow_definitions" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';

-- ALTER: workflow_executions (+15 cols) — alerting-automation-schema.ts
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "organization_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "triggered_by" TEXT DEFAULT '';
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "trigger_data" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "current_step" INTEGER DEFAULT 0;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "started_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "completed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "paused_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "resumed_at" TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "step_results" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "variables" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "error_message" TEXT DEFAULT '';
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "error_details" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "failed_step" INTEGER DEFAULT 0;
ALTER TABLE "workflow_executions" ADD COLUMN IF NOT EXISTS "total_execution_time_ms" INTEGER DEFAULT 0;

-- ALTER: workplace_incidents (+1 cols) — domains\health-safety\health-safety-schema.ts
ALTER TABLE "workplace_incidents" ADD COLUMN IF NOT EXISTS "root_cause_analysis" TEXT DEFAULT '';

-- ALTER: worksites (+18 cols) — union-structure-schema.ts
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "employer_id" UUID DEFAULT gen_random_uuid();
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "name" VARCHAR(255) DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "code" VARCHAR(50) DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "status" TEXT DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "address" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "employee_count" INTEGER DEFAULT 0;
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "shift_count" INTEGER DEFAULT 0;
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "operates_weekends" BOOLEAN DEFAULT false;
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "operates_24_hours" BOOLEAN DEFAULT false;
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "site_manager_name" VARCHAR(255) DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "site_manager_email" VARCHAR(255) DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "site_manager_phone" VARCHAR(50) DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "description" TEXT DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "notes" TEXT DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "custom_fields" JSONB DEFAULT '{}'::jsonb;
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "created_by" TEXT DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "updated_by" TEXT DEFAULT '';
ALTER TABLE "worksites" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMPTZ DEFAULT NOW();

COMMIT;

-- Summary: 366 tables altered, 49 tables created, 4962 columns added