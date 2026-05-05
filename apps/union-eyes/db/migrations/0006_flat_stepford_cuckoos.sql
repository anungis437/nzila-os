DO $$ BEGIN
	CREATE TYPE "public"."notification_bounce_type" AS ENUM('permanent', 'temporary', 'complaint', 'manual');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."notification_priority" AS ENUM('low', 'normal', 'high', 'urgent');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."notification_queue_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'retrying');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."notification_template_status" AS ENUM('active', 'inactive', 'draft', 'archived');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."notification_template_type" AS ENUM('payment', 'dues', 'strike', 'voting', 'certification', 'general', 'system');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."consent_status" AS ENUM('granted', 'denied', 'withdrawn', 'expired');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."consent_type" AS ENUM('essential', 'functional', 'analytics', 'marketing', 'personalization', 'third_party');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."gdpr_request_status" AS ENUM('pending', 'in_progress', 'completed', 'rejected', 'cancelled');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."gdpr_request_type" AS ENUM('access', 'rectification', 'erasure', 'restriction', 'portability', 'objection');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."processing_purpose" AS ENUM('service_delivery', 'legal_compliance', 'contract_performance', 'legitimate_interest', 'consent', 'vital_interest');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."authentication_method" AS ENUM('email', 'sms', 'phone_call', 'knowledge_based', 'id_verification', 'multi_factor', 'none');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."signature_document_status" AS ENUM('draft', 'sent', 'delivered', 'viewed', 'signed', 'completed', 'declined', 'voided', 'expired');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."signature_provider" AS ENUM('docusign', 'hellosign', 'adobe_sign', 'pandadoc', 'internal');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."signature_type" AS ENUM('electronic', 'digital', 'wet', 'clickwrap');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."signer_status" AS ENUM('pending', 'sent', 'delivered', 'viewed', 'signed', 'declined', 'authentication_failed', 'expired');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."ai_provider" AS ENUM('openai', 'anthropic', 'google', 'internal');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."chat_session_status" AS ENUM('active', 'archived', 'deleted');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."knowledge_document_type" AS ENUM('collective_agreement', 'union_policy', 'labor_law', 'precedent', 'faq', 'guide', 'other');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."message_role" AS ENUM('user', 'assistant', 'system', 'function');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."a11y_issue_severity" AS ENUM('critical', 'serious', 'moderate', 'minor');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."a11y_issue_status" AS ENUM('open', 'in_progress', 'resolved', 'wont_fix', 'duplicate');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."audit_status" AS ENUM('pending', 'in_progress', 'completed', 'failed');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."wcag_level" AS ENUM('A', 'AA', 'AAA');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."address_status" AS ENUM('active', 'inactive', 'unverified', 'invalid');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	CREATE TYPE "public"."address_type" AS ENUM('mailing', 'residential', 'business', 'billing', 'shipping', 'temporary');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "voting_audit_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"receipt_id" varchar(255) NOT NULL,
	"vote_hash" varchar(255) NOT NULL,
	"signature" text NOT NULL,
	"audit_hash" varchar(255) NOT NULL,
	"previous_audit_hash" varchar(255),
	"voted_at" timestamp with time zone NOT NULL,
	"verification_code" varchar(100),
	"is_anonymous" boolean DEFAULT true,
	"chain_valid" boolean DEFAULT true,
	"tampered_indicators" text[],
	"audit_metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "voting_audit_log_receipt_id_unique" UNIQUE("receipt_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_bounces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"email" text NOT NULL,
	"bounce_type" "notification_bounce_type" NOT NULL,
	"bounce_sub_type" text,
	"first_bounced_at" timestamp NOT NULL,
	"last_bounced_at" timestamp NOT NULL,
	"bounce_count" text DEFAULT '1' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"suppress_until" timestamp,
	"suppression_reason" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_delivery_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"notification_id" uuid NOT NULL,
	"event" text NOT NULL,
	"event_timestamp" timestamp NOT NULL,
	"provider_id" text,
	"external_event_id" text,
	"details" jsonb,
	"status_code" text,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_queue" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"status" "notification_queue_status" DEFAULT 'pending' NOT NULL,
	"priority" "notification_priority" DEFAULT 'normal' NOT NULL,
	"payload" jsonb NOT NULL,
	"attempt_count" text DEFAULT '0' NOT NULL,
	"max_attempts" text DEFAULT '3' NOT NULL,
	"next_retry_at" timestamp,
	"processed_at" timestamp,
	"completed_at" timestamp,
	"result_notification_id" uuid,
	"error_message" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "notification_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"template_key" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"type" "notification_template_type" NOT NULL,
	"subject" text,
	"title" text,
	"body_template" text NOT NULL,
	"html_body_template" text,
	"variables" jsonb,
	"default_variables" jsonb,
	"channels" "notification_channel"[],
	"status" "notification_template_status" DEFAULT 'active' NOT NULL,
	"is_system" boolean DEFAULT false NOT NULL,
	"max_retries" text DEFAULT '3',
	"retry_delay_seconds" text DEFAULT '300',
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" text,
	"updated_by" text,
	CONSTRAINT "notification_templates_template_key_unique" UNIQUE("template_key")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "automation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"trigger_type" varchar(50) NOT NULL,
	"conditions" jsonb,
	"award_type_id" uuid NOT NULL,
	"credit_amount" integer DEFAULT 0 NOT NULL,
	"schedule" varchar(255),
	"is_active" boolean DEFAULT true NOT NULL,
	"last_triggered_at" timestamp,
	"trigger_count" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "cookie_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text,
	"tenant_id" text NOT NULL,
	"essential" boolean DEFAULT true NOT NULL,
	"functional" boolean DEFAULT false NOT NULL,
	"analytics" boolean DEFAULT false NOT NULL,
	"marketing" boolean DEFAULT false NOT NULL,
	"consent_id" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"last_updated" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "cookie_consents_consent_id_unique" UNIQUE("consent_id")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_anonymization_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"operation_type" text NOT NULL,
	"reason" text NOT NULL,
	"request_id" uuid,
	"tables_affected" jsonb NOT NULL,
	"executed_at" timestamp DEFAULT now() NOT NULL,
	"executed_by" text NOT NULL,
	"verified_at" timestamp,
	"verified_by" text,
	"can_reverse" boolean DEFAULT false NOT NULL,
	"backup_location" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_processing_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"activity_name" text NOT NULL,
	"processing_purpose" "processing_purpose" NOT NULL,
	"legal_basis" text NOT NULL,
	"data_categories" jsonb NOT NULL,
	"data_subjects" jsonb NOT NULL,
	"recipients" jsonb,
	"retention_period" text NOT NULL,
	"deletion_procedure" text,
	"security_measures" jsonb,
	"dpo_contact" text,
	"last_reviewed" timestamp DEFAULT now() NOT NULL,
	"next_review_due" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "data_retention_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"policy_name" text NOT NULL,
	"data_type" text NOT NULL,
	"retention_period_days" text NOT NULL,
	"conditions" jsonb,
	"action_on_expiry" text NOT NULL,
	"archive_location" text,
	"legal_requirement" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_executed" timestamp,
	"next_execution" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "gdpr_data_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"request_type" "gdpr_request_type" NOT NULL,
	"status" "gdpr_request_status" DEFAULT 'pending' NOT NULL,
	"request_details" jsonb,
	"requested_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"completed_at" timestamp,
	"verification_method" text,
	"verified_at" timestamp,
	"verified_by" text,
	"response_data" jsonb,
	"deadline" timestamp NOT NULL,
	"rejection_reason" text,
	"processed_by" text,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "user_consents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"consent_type" "consent_type" NOT NULL,
	"status" "consent_status" DEFAULT 'granted' NOT NULL,
	"legal_basis" text NOT NULL,
	"processing_purpose" "processing_purpose" NOT NULL,
	"consent_version" text NOT NULL,
	"consent_text" text NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"granted_at" timestamp DEFAULT now() NOT NULL,
	"expires_at" timestamp,
	"withdrawn_at" timestamp,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "document_signers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"user_id" text,
	"email" text NOT NULL,
	"name" text NOT NULL,
	"role" text,
	"signing_order" integer DEFAULT 1 NOT NULL,
	"status" "signer_status" DEFAULT 'pending' NOT NULL,
	"sent_at" timestamp,
	"delivered_at" timestamp,
	"viewed_at" timestamp,
	"signed_at" timestamp,
	"signature_type" "signature_type",
	"signature_image_url" text,
	"authentication_method" "authentication_method",
	"authenticated_at" timestamp,
	"declined_at" timestamp,
	"decline_reason" text,
	"reassigned_to" text,
	"reassigned_at" timestamp,
	"ip_address" text,
	"user_agent" text,
	"geolocation" jsonb,
	"provider_signer_id" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signature_audit_trail" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"document_id" uuid NOT NULL,
	"signer_id" uuid,
	"event_type" text NOT NULL,
	"event_description" text NOT NULL,
	"actor_user_id" text,
	"actor_email" text,
	"actor_role" text,
	"ip_address" text,
	"user_agent" text,
	"timestamp" timestamp DEFAULT now() NOT NULL,
	"geolocation" jsonb,
	"metadata" jsonb,
	"hash_chain" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signature_documents" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"document_type" text NOT NULL,
	"file_url" text NOT NULL,
	"file_name" text NOT NULL,
	"file_size_bytes" integer NOT NULL,
	"file_hash" text NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"provider_document_id" text,
	"provider_envelope_id" text,
	"status" "signature_document_status" DEFAULT 'draft' NOT NULL,
	"sent_by" text NOT NULL,
	"sent_at" timestamp,
	"completed_at" timestamp,
	"voided_at" timestamp,
	"voided_by" text,
	"void_reason" text,
	"expires_at" timestamp,
	"reminder_schedule" jsonb,
	"require_authentication" boolean DEFAULT false NOT NULL,
	"authentication_method" "authentication_method",
	"access_code" text,
	"sequential_signing" boolean DEFAULT false NOT NULL,
	"allow_decline" boolean DEFAULT true NOT NULL,
	"allow_reassign" boolean DEFAULT false NOT NULL,
	"template_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signature_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text NOT NULL,
	"template_file_url" text NOT NULL,
	"template_file_name" text NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"provider_template_id" text,
	"signature_fields" jsonb NOT NULL,
	"default_settings" jsonb,
	"signer_roles" jsonb NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"usage_count" integer DEFAULT 0 NOT NULL,
	"last_used_at" timestamp,
	"created_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "signature_webhooks_log" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" "signature_provider" NOT NULL,
	"event_type" text NOT NULL,
	"document_id" uuid,
	"provider_document_id" text,
	"payload" jsonb NOT NULL,
	"headers" jsonb,
	"received_at" timestamp DEFAULT now() NOT NULL,
	"processed_at" timestamp,
	"processing_status" text DEFAULT 'pending' NOT NULL,
	"error_message" text,
	"signature" text,
	"signature_verified" boolean,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "ai_safety_filters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input" text NOT NULL,
	"output" text,
	"flagged" boolean DEFAULT false NOT NULL,
	"flagged_categories" jsonb,
	"confidence_scores" jsonb,
	"action" text NOT NULL,
	"reason" text,
	"session_id" uuid,
	"message_id" uuid,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_messages" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"session_id" uuid NOT NULL,
	"role" "message_role" NOT NULL,
	"content" text NOT NULL,
	"model_used" text,
	"tokens_used" integer,
	"response_time_ms" integer,
	"retrieved_documents" jsonb,
	"citations" jsonb,
	"function_calls" jsonb,
	"helpful" boolean,
	"feedback_reason" text,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chat_sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"tenant_id" text NOT NULL,
	"title" text NOT NULL,
	"status" "chat_session_status" DEFAULT 'active' NOT NULL,
	"ai_provider" "ai_provider" DEFAULT 'openai' NOT NULL,
	"model" text DEFAULT 'gpt-4' NOT NULL,
	"temperature" text DEFAULT '0.7',
	"context_tags" jsonb,
	"related_entity_type" text,
	"related_entity_id" text,
	"message_count" integer DEFAULT 0 NOT NULL,
	"last_message_at" timestamp,
	"helpful" boolean,
	"feedback_comment" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatbot_analytics" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"period_start" timestamp NOT NULL,
	"period_end" timestamp NOT NULL,
	"total_sessions" integer DEFAULT 0 NOT NULL,
	"total_messages" integer DEFAULT 0 NOT NULL,
	"unique_users" integer DEFAULT 0 NOT NULL,
	"avg_response_time_ms" integer,
	"avg_tokens_per_message" integer,
	"avg_messages_per_session" integer,
	"helpful_responses" integer DEFAULT 0 NOT NULL,
	"unhelpful_responses" integer DEFAULT 0 NOT NULL,
	"satisfaction_rate" text,
	"total_tokens_used" integer DEFAULT 0 NOT NULL,
	"estimated_cost_usd" text,
	"top_categories" jsonb,
	"top_questions" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "chatbot_suggestions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"category" text NOT NULL,
	"title" text NOT NULL,
	"prompt" text NOT NULL,
	"description" text,
	"icon" text,
	"display_order" integer DEFAULT 0 NOT NULL,
	"show_in_contexts" jsonb,
	"required_tags" jsonb,
	"use_count" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (SELECT 1 FROM pg_type WHERE typname = 'vector') THEN
		CREATE TABLE IF NOT EXISTS "knowledge_base" (
			"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
			"tenant_id" text NOT NULL,
			"title" text NOT NULL,
			"document_type" "knowledge_document_type" NOT NULL,
			"content" text NOT NULL,
			"summary" text,
			"source_type" text NOT NULL,
			"source_id" text,
			"source_url" text,
			"embedding" vector(1536),
			"embedding_model" text DEFAULT 'text-embedding-ada-002',
			"tags" jsonb,
			"keywords" jsonb,
			"language" text DEFAULT 'en' NOT NULL,
			"version" integer DEFAULT 1 NOT NULL,
			"previous_version_id" uuid,
			"is_public" boolean DEFAULT false NOT NULL,
			"allowed_tenants" jsonb,
			"view_count" integer DEFAULT 0 NOT NULL,
			"citation_count" integer DEFAULT 0 NOT NULL,
			"last_used_at" timestamp,
			"is_active" boolean DEFAULT true NOT NULL,
			"created_by" text NOT NULL,
			"created_at" timestamp DEFAULT now() NOT NULL,
			"updated_at" timestamp DEFAULT now() NOT NULL
		);
	END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accessibility_audits" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"audit_name" text NOT NULL,
	"audit_type" text NOT NULL,
	"target_url" text NOT NULL,
	"target_environment" text NOT NULL,
	"wcag_version" text DEFAULT '2.2' NOT NULL,
	"conformance_level" "wcag_level" DEFAULT 'AA' NOT NULL,
	"status" "audit_status" DEFAULT 'pending' NOT NULL,
	"tools_used" jsonb,
	"total_issues" integer DEFAULT 0 NOT NULL,
	"critical_issues" integer DEFAULT 0 NOT NULL,
	"serious_issues" integer DEFAULT 0 NOT NULL,
	"moderate_issues" integer DEFAULT 0 NOT NULL,
	"minor_issues" integer DEFAULT 0 NOT NULL,
	"accessibility_score" integer,
	"pages_scanned" integer DEFAULT 0 NOT NULL,
	"elements_scanned" integer DEFAULT 0 NOT NULL,
	"scan_duration_ms" integer,
	"report_url" text,
	"report_data" jsonb,
	"triggered_by" text,
	"scheduled_by" text,
	"started_at" timestamp,
	"completed_at" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accessibility_issues" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"audit_id" uuid NOT NULL,
	"tenant_id" text NOT NULL,
	"issue_title" text NOT NULL,
	"issue_description" text NOT NULL,
	"severity" "a11y_issue_severity" NOT NULL,
	"wcag_criteria" text NOT NULL,
	"wcag_level" "wcag_level" NOT NULL,
	"wcag_title" text NOT NULL,
	"wcag_url" text,
	"page_url" text NOT NULL,
	"element_selector" text,
	"element_html" text,
	"element_xpath" text,
	"context" jsonb,
	"fix_suggestion" text,
	"code_example" text,
	"impacted_users" text,
	"affects_screen_readers" boolean DEFAULT false NOT NULL,
	"affects_keyboard_nav" boolean DEFAULT false NOT NULL,
	"affects_color_blindness" boolean DEFAULT false NOT NULL,
	"status" "a11y_issue_status" DEFAULT 'open' NOT NULL,
	"assigned_to" text,
	"priority" integer DEFAULT 3 NOT NULL,
	"resolved_at" timestamp,
	"resolved_by" text,
	"resolution_notes" text,
	"verified_at" timestamp,
	"first_seen_at" timestamp DEFAULT now() NOT NULL,
	"last_seen_at" timestamp DEFAULT now() NOT NULL,
	"occurrence_count" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accessibility_test_suites" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text,
	"suite_name" text NOT NULL,
	"suite_description" text,
	"suite_type" text NOT NULL,
	"url_patterns" jsonb,
	"exclude_patterns" jsonb,
	"enabled_rules" jsonb,
	"disabled_rules" jsonb,
	"custom_rules" jsonb,
	"is_scheduled" boolean DEFAULT false NOT NULL,
	"schedule_expression" text,
	"notify_on_failure" boolean DEFAULT true NOT NULL,
	"notify_emails" jsonb,
	"notify_slack_channel" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"last_run_at" timestamp,
	"last_run_status" "audit_status",
	"created_by" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "accessibility_user_testing" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"session_name" text NOT NULL,
	"session_date" timestamp NOT NULL,
	"participant_name" text NOT NULL,
	"participant_email" text,
	"assistive_technology" text,
	"assistive_tech_version" text,
	"disability" text,
	"features_tested" jsonb,
	"task_list" jsonb,
	"overall_rating" integer,
	"issues_found" jsonb,
	"positive_findings" jsonb,
	"recording_url" text,
	"transcript_url" text,
	"notes" text,
	"follow_up_required" boolean DEFAULT false NOT NULL,
	"follow_up_notes" text,
	"conducted_by" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "wcag_success_criteria" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"criteria_number" text NOT NULL,
	"criteria_title" text NOT NULL,
	"criteria_description" text NOT NULL,
	"level" "wcag_level" NOT NULL,
	"wcag_version" text DEFAULT '2.2' NOT NULL,
	"principle" text NOT NULL,
	"guideline" text NOT NULL,
	"understanding_url" text,
	"how_to_meet_url" text,
	"testing_procedure" text,
	"common_failures" jsonb,
	"sufficient_techniques" jsonb,
	"keywords" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "wcag_success_criteria_criteria_number_unique" UNIQUE("criteria_number")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "address_change_history" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address_id" uuid NOT NULL,
	"change_type" text NOT NULL,
	"changed_by" text,
	"previous_value" jsonb,
	"new_value" jsonb,
	"change_reason" text,
	"change_source" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "address_validation_cache" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"input_hash" text NOT NULL,
	"country_code" text NOT NULL,
	"address_line_1" text NOT NULL,
	"locality" text NOT NULL,
	"administrative_area" text,
	"postal_code" text,
	"is_valid" boolean NOT NULL,
	"validated_by" text NOT NULL,
	"confidence" text,
	"corrected_address" jsonb,
	"latitude" text,
	"longitude" text,
	"metadata" jsonb,
	"expires_at" timestamp NOT NULL,
	"hit_count" integer DEFAULT 1 NOT NULL,
	"last_hit_at" timestamp DEFAULT now() NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "address_validation_cache_input_hash_unique" UNIQUE("input_hash")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "country_address_formats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"iso3_code" text,
	"locality_label" text DEFAULT 'City' NOT NULL,
	"administrative_area_label" text DEFAULT 'State',
	"postal_code_label" text DEFAULT 'Postal Code',
	"sub_administrative_area_label" text,
	"required_fields" jsonb,
	"optional_fields" jsonb,
	"address_format" text NOT NULL,
	"display_order" jsonb,
	"postal_code_required" boolean DEFAULT true NOT NULL,
	"postal_code_pattern" text,
	"postal_code_example" text,
	"postal_code_length" integer,
	"administrative_areas" jsonb,
	"has_subdivisions" boolean DEFAULT false NOT NULL,
	"validation_rules" jsonb,
	"geocoding_supported" boolean DEFAULT true NOT NULL,
	"preferred_geocoder" text,
	"standardization_provider" text,
	"standardization_available" boolean DEFAULT false NOT NULL,
	"example_addresses" jsonb,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "country_address_formats_country_code_unique" UNIQUE("country_code")
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "international_addresses" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"tenant_id" text NOT NULL,
	"user_id" text,
	"address_type" "address_type" DEFAULT 'mailing' NOT NULL,
	"status" "address_status" DEFAULT 'unverified' NOT NULL,
	"country_code" text NOT NULL,
	"country_name" text NOT NULL,
	"address_line_1" text NOT NULL,
	"address_line_2" text,
	"address_line_3" text,
	"locality" text NOT NULL,
	"locality_type" text,
	"administrative_area" text,
	"administrative_area_type" text,
	"postal_code" text,
	"postal_code_type" text,
	"sub_administrative_area" text,
	"dependent_locality" text,
	"sorting_code" text,
	"formatted_address" text,
	"local_format" text,
	"latitude" text,
	"longitude" text,
	"geocoded_at" timestamp,
	"geocode_provider" text,
	"geocode_accuracy" text,
	"is_validated" boolean DEFAULT false NOT NULL,
	"validated_by" text,
	"validated_at" timestamp,
	"validation_result" jsonb,
	"is_standardized" boolean DEFAULT false NOT NULL,
	"standardized_by" text,
	"standardized_at" timestamp,
	"standardized_data" jsonb,
	"deliverability" text,
	"delivery_point" text,
	"carrier_route" text,
	"metadata" jsonb,
	"is_primary" boolean DEFAULT false NOT NULL,
	"notes" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cba_version_history" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "collective_agreements" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "collective_agreements" ALTER COLUMN "last_modified_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "clause_comparisons" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "claim_updates" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DROP VIEW IF EXISTS v_critical_deadlines CASCADE;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "claims" ALTER COLUMN "member_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "claims" ALTER COLUMN "assigned_to" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "voting_sessions" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
-- Removed user_management schema references - using organization terminology in public schema
--> statement-breakpoint
DROP VIEW IF EXISTS v_member_training_transcript CASCADE;--> statement-breakpoint
DROP VIEW IF EXISTS v_member_education_summary CASCADE;--> statement-breakpoint
DROP VIEW IF EXISTS v_member_certification_status CASCADE;--> statement-breakpoint
DROP VIEW IF EXISTS v_member_course_history CASCADE;--> statement-breakpoint
DROP VIEW IF EXISTS v_training_analytics CASCADE;--> statement-breakpoint
DROP VIEW IF EXISTS v_member_skills CASCADE;--> statement-breakpoint
DROP VIEW IF EXISTS v_certification_expiry_tracking CASCADE;--> statement-breakpoint
DROP VIEW IF EXISTS v_course_session_dashboard CASCADE;--> statement-breakpoint
DROP VIEW IF EXISTS v_training_program_progress CASCADE;--> statement-breakpoint
DO $$
DECLARE r RECORD;
BEGIN
	FOR r IN (
		SELECT schemaname, tablename, policyname
		FROM pg_policies
		WHERE tablename IN (
			'users',
			'oauth_providers',
			'tenant_users',
			'user_sessions',
			'audit_logs',
			'security_events'
		)
	) LOOP
		EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I', r.policyname, r.schemaname, r.tablename);
	END LOOP;
END $$;--> statement-breakpoint
-- Removed user_management, tenant_management, and audit_security schema references - using organization terminology in public schema
--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bargaining_notes" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bargaining_notes" ALTER COLUMN "last_modified_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cba_footnotes" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "deadline_alerts" ALTER COLUMN "recipient_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "deadline_extensions" ALTER COLUMN "requested_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "deadline_extensions" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "claim_deadlines" ALTER COLUMN "completed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "claim_deadlines" ALTER COLUMN "escalated_to" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_executions" ALTER COLUMN "executed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_shares" ALTER COLUMN "shared_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_shares" ALTER COLUMN "shared_with" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "report_templates" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "reports" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "reports" ALTER COLUMN "updated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "scheduled_reports" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "clause_comparisons_history" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "clause_library_tags" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "shared_clause_library" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "arbitration_precedents" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'precedent_citations'
			AND column_name = 'cited_by'
	) THEN
		ALTER TABLE "precedent_citations" ALTER COLUMN "cited_by" SET DATA TYPE varchar(255);
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cross_org_access_log" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "organization_sharing_grants" ALTER COLUMN "revoked_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "organization_sharing_grants" ALTER COLUMN "granted_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "organization_contacts" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'per_capita_remittances'
			AND column_name = 'approved_by'
	) THEN
		ALTER TABLE "per_capita_remittances" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'per_capita_remittances'
			AND column_name = 'rejected_by'
	) THEN
		ALTER TABLE "per_capita_remittances" ALTER COLUMN "rejected_by" SET DATA TYPE varchar(255);
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'per_capita_remittances'
			AND column_name = 'created_by'
	) THEN
		ALTER TABLE "per_capita_remittances" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "remittance_approvals" ALTER COLUMN "approver_user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "communication_preferences" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_engagement_scores" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_assignments" ALTER COLUMN "assigned_to" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_assignments" ALTER COLUMN "assigned_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_communications" ALTER COLUMN "from_user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_communications" ALTER COLUMN "to_user_ids" SET DATA TYPE varchar(255)[];
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_communications" ALTER COLUMN "recorded_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_documents" ALTER COLUMN "signed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_documents" ALTER COLUMN "uploaded_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_documents" ALTER COLUMN "reviewed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_settlements" ALTER COLUMN "proposed_by_user" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_settlements" ALTER COLUMN "responded_by_user" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_settlements" ALTER COLUMN "union_approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_settlements" ALTER COLUMN "management_approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_settlements" ALTER COLUMN "finalized_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_transitions" ALTER COLUMN "transitioned_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_transitions" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "grievance_workflows" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_registrations" ALTER COLUMN "member_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_registrations" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_sessions" ALTER COLUMN "lead_instructor_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "course_sessions" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_certifications" ALTER COLUMN "member_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_certifications" ALTER COLUMN "verified_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "program_enrollments" ALTER COLUMN "member_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "training_courses" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "training_programs" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "comparative_analyses" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "insight_recommendations" ALTER COLUMN "acknowledged_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "insight_recommendations" ALTER COLUMN "dismissed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "kpi_configurations" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "foreign_workers" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "gss_applications" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lmbp_compliance_alerts" ALTER COLUMN "resolved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lmbp_compliance_reports" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "lmbp_letters" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "governance_events" ALTER COLUMN "created_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "reserved_matter_votes" ALTER COLUMN "proposed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_subject_access_requests" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_subject_access_requests" ALTER COLUMN "assigned_to" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "privacy_breaches" ALTER COLUMN "reported_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "provincial_consent" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'provincial_data_handling'
			AND column_name = 'user_id'
	) THEN
		ALTER TABLE "provincial_data_handling" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.columns
		WHERE table_schema = 'public'
			AND table_name = 'provincial_data_handling'
			AND column_name = 'performed_by'
	) THEN
		ALTER TABLE "provincial_data_handling" ALTER COLUMN "performed_by" SET DATA TYPE varchar(255);
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "band_council_consent" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "indigenous_data_access_log" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "indigenous_data_access_log" ALTER COLUMN "accessed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "indigenous_data_sharing_agreements" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "indigenous_member_data" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "traditional_knowledge_registry" ALTER COLUMN "primary_keeper_user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "rl1_tax_slips" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "rl1_tax_slips" ALTER COLUMN "generated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "strike_fund_disbursements" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "t4a_tax_slips" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "t4a_tax_slips" ALTER COLUMN "generated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "tax_year_end_processing" ALTER COLUMN "processed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "weekly_threshold_tracking" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "break_glass_activations" ALTER COLUMN "signature_1_user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "break_glass_activations" ALTER COLUMN "signature_2_user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "break_glass_activations" ALTER COLUMN "signature_3_user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "break_glass_activations" ALTER COLUMN "audited_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "break_glass_system" ALTER COLUMN "key_holder_id_1" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "break_glass_system" ALTER COLUMN "key_holder_id_2" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "break_glass_system" ALTER COLUMN "key_holder_id_3" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "break_glass_system" ALTER COLUMN "key_holder_id_4" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "break_glass_system" ALTER COLUMN "key_holder_id_5" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "disaster_recovery_drills" ALTER COLUMN "conducted_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "disaster_recovery_drills" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "emergency_declarations" ALTER COLUMN "declared_by_user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "key_holder_registry" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "swiss_cold_storage" ALTER COLUMN "encrypted_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "swiss_cold_storage" ALTER COLUMN "last_accessed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "geofence_events" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_deletion_log" ALTER COLUMN "initiated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_tracking" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_tracking_audit" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_tracking_audit" ALTER COLUMN "performed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "location_tracking_config" ALTER COLUMN "updated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "member_location_consent" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "bank_of_canada_rates" ALTER COLUMN "imported_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "currency_enforcement_audit" ALTER COLUMN "performed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "currency_enforcement_policy" ALTER COLUMN "updated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "currency_enforcement_violations" ALTER COLUMN "attempted_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "currency_enforcement_violations" ALTER COLUMN "resolved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fx_rate_audit_log" ALTER COLUMN "performed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "t106_filing_tracking" ALTER COLUMN "prepared_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "t106_filing_tracking" ALTER COLUMN "reviewed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "t106_filing_tracking" ALTER COLUMN "filed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transaction_currency_conversions" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transfer_pricing_documentation" ALTER COLUMN "documented_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "transfer_pricing_documentation" ALTER COLUMN "reviewed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "arms_length_verification" ALTER COLUMN "reviewed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "blind_trust_registry" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "blind_trust_registry" ALTER COLUMN "verified_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conflict_audit_log" ALTER COLUMN "subject_user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conflict_audit_log" ALTER COLUMN "performed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conflict_disclosures" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conflict_of_interest_policy" ALTER COLUMN "updated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conflict_review_committee" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conflict_review_committee" ALTER COLUMN "appointed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "conflict_training" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "recusal_tracking" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "recusal_tracking" ALTER COLUMN "documented_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "recusal_tracking" ALTER COLUMN "verified_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cpi_adjusted_pricing" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cpi_data" ALTER COLUMN "imported_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fmv_audit_log" ALTER COLUMN "performed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fmv_benchmarks" ALTER COLUMN "reviewed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fmv_policy" ALTER COLUMN "updated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fmv_violations" ALTER COLUMN "resolved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "fmv_violations" ALTER COLUMN "detected_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "independent_appraisals" ALTER COLUMN "reviewed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "procurement_bids" ALTER COLUMN "evaluated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "procurement_requests" ALTER COLUMN "requested_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "procurement_requests" ALTER COLUMN "approved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "procurement_requests" ALTER COLUMN "awarded_to" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_alerts" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_alerts" ALTER COLUMN "resolved_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_audit_log" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_audit_log" ALTER COLUMN "performed_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "certification_compliance_reports" ALTER COLUMN "generated_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "continuing_education" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "continuing_education" ALTER COLUMN "verified_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "staff_certifications" ALTER COLUMN "user_id" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "staff_certifications" ALTER COLUMN "verified_by" SET DATA TYPE varchar(255);
EXCEPTION
  WHEN undefined_column THEN NULL;
  WHEN undefined_table THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
   AND table_name = 'collective_agreements'
 ) THEN
  ALTER TABLE "collective_agreements" ADD COLUMN IF NOT EXISTS "sector" varchar(200);
  ALTER TABLE "collective_agreements" ADD COLUMN IF NOT EXISTS "ai_processed" boolean DEFAULT false;
 END IF;
EXCEPTION
 WHEN duplicate_object OR undefined_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
   AND table_name = 'cba_clauses'
 ) THEN
  ALTER TABLE "cba_clauses" ADD COLUMN IF NOT EXISTS "organization_id" uuid NOT NULL;
 END IF;
EXCEPTION
 WHEN duplicate_object OR undefined_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
 IF EXISTS (
  SELECT 1
  FROM information_schema.tables
  WHERE table_schema = 'public'
   AND table_name = 'arbitration_decisions'
 ) THEN
  ALTER TABLE "arbitration_decisions" ADD COLUMN IF NOT EXISTS "precedent_summary" text;
  ALTER TABLE "arbitration_decisions" ADD COLUMN IF NOT EXISTS "reasoning" text;
  ALTER TABLE "arbitration_decisions" ADD COLUMN IF NOT EXISTS "key_facts" text;
 END IF;
EXCEPTION
 WHEN duplicate_object OR undefined_table THEN null;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "voting_audit_log" ADD CONSTRAINT "voting_audit_log_session_id_voting_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."voting_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_org_id_organizations_id_fk" FOREIGN KEY ("org_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
-- Commented out FK to non-existent table recognition_award_types
-- ALTER TABLE "automation_rules" ADD CONSTRAINT "automation_rules_award_type_id_recognition_award_types_id_fk" FOREIGN KEY ("award_type_id") REFERENCES "public"."recognition_award_types"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "cookie_consents" ADD CONSTRAINT "cookie_consents_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "data_anonymization_log" ADD CONSTRAINT "data_anonymization_log_request_id_gdpr_data_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."gdpr_data_requests"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "gdpr_data_requests" ADD CONSTRAINT "gdpr_data_requests_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "user_consents" ADD CONSTRAINT "user_consents_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "document_signers" ADD CONSTRAINT "document_signers_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "document_signers" ADD CONSTRAINT "document_signers_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "signature_audit_trail" ADD CONSTRAINT "signature_audit_trail_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "signature_audit_trail" ADD CONSTRAINT "signature_audit_trail_signer_id_document_signers_id_fk" FOREIGN KEY ("signer_id") REFERENCES "public"."document_signers"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "signature_documents" ADD CONSTRAINT "signature_documents_sent_by_profiles_user_id_fk" FOREIGN KEY ("sent_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "signature_documents" ADD CONSTRAINT "signature_documents_template_id_signature_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."signature_templates"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "signature_templates" ADD CONSTRAINT "signature_templates_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "signature_webhooks_log" ADD CONSTRAINT "signature_webhooks_log_document_id_signature_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."signature_documents"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_safety_filters" ADD CONSTRAINT "ai_safety_filters_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "ai_safety_filters" ADD CONSTRAINT "ai_safety_filters_message_id_chat_messages_id_fk" FOREIGN KEY ("message_id") REFERENCES "public"."chat_messages"("id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat_messages" ADD CONSTRAINT "chat_messages_session_id_chat_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."chat_sessions"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "chat_sessions" ADD CONSTRAINT "chat_sessions_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'knowledge_base'
	) THEN
		ALTER TABLE "knowledge_base" ADD CONSTRAINT "knowledge_base_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accessibility_audits" ADD CONSTRAINT "accessibility_audits_scheduled_by_profiles_user_id_fk" FOREIGN KEY ("scheduled_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accessibility_issues" ADD CONSTRAINT "accessibility_issues_audit_id_accessibility_audits_id_fk" FOREIGN KEY ("audit_id") REFERENCES "public"."accessibility_audits"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accessibility_issues" ADD CONSTRAINT "accessibility_issues_assigned_to_profiles_user_id_fk" FOREIGN KEY ("assigned_to") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accessibility_issues" ADD CONSTRAINT "accessibility_issues_resolved_by_profiles_user_id_fk" FOREIGN KEY ("resolved_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accessibility_test_suites" ADD CONSTRAINT "accessibility_test_suites_created_by_profiles_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "accessibility_user_testing" ADD CONSTRAINT "accessibility_user_testing_conducted_by_profiles_user_id_fk" FOREIGN KEY ("conducted_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "address_change_history" ADD CONSTRAINT "address_change_history_address_id_international_addresses_id_fk" FOREIGN KEY ("address_id") REFERENCES "public"."international_addresses"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "address_change_history" ADD CONSTRAINT "address_change_history_changed_by_profiles_user_id_fk" FOREIGN KEY ("changed_by") REFERENCES "public"."profiles"("user_id") ON DELETE no action ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "international_addresses" ADD CONSTRAINT "international_addresses_user_id_profiles_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."profiles"("user_id") ON DELETE set null ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
CREATE INDEX "automation_rules_org_idx" ON "automation_rules" USING btree ("org_id");--> statement-breakpoint
CREATE INDEX "automation_rules_trigger_idx" ON "automation_rules" USING btree ("trigger_type");--> statement-breakpoint
CREATE INDEX "automation_rules_active_idx" ON "automation_rules" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "automation_rules_award_type_idx" ON "automation_rules" USING btree ("award_type_id");--> statement-breakpoint
CREATE INDEX "cookie_consents_user_id_idx" ON "cookie_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "cookie_consents_consent_id_idx" ON "cookie_consents" USING btree ("consent_id");--> statement-breakpoint
CREATE INDEX "cookie_consents_tenant_id_idx" ON "cookie_consents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "anonymization_log_user_id_idx" ON "data_anonymization_log" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "anonymization_log_tenant_id_idx" ON "data_anonymization_log" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "anonymization_log_request_id_idx" ON "data_anonymization_log" USING btree ("request_id");--> statement-breakpoint
CREATE INDEX "data_processing_tenant_id_idx" ON "data_processing_records" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "data_processing_next_review_idx" ON "data_processing_records" USING btree ("next_review_due");--> statement-breakpoint
CREATE INDEX "retention_policies_tenant_id_idx" ON "data_retention_policies" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "retention_policies_next_execution_idx" ON "data_retention_policies" USING btree ("next_execution");--> statement-breakpoint
CREATE INDEX "gdpr_requests_user_id_idx" ON "gdpr_data_requests" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "gdpr_requests_status_idx" ON "gdpr_data_requests" USING btree ("status");--> statement-breakpoint
CREATE INDEX "gdpr_requests_type_idx" ON "gdpr_data_requests" USING btree ("request_type");--> statement-breakpoint
CREATE INDEX "gdpr_requests_deadline_idx" ON "gdpr_data_requests" USING btree ("deadline");--> statement-breakpoint
CREATE INDEX "gdpr_requests_tenant_id_idx" ON "gdpr_data_requests" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_consents_user_id_idx" ON "user_consents" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "user_consents_tenant_id_idx" ON "user_consents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "user_consents_status_idx" ON "user_consents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "user_consents_type_idx" ON "user_consents" USING btree ("consent_type");--> statement-breakpoint
CREATE INDEX "document_signers_document_id_idx" ON "document_signers" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "document_signers_user_id_idx" ON "document_signers" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "document_signers_email_idx" ON "document_signers" USING btree ("email");--> statement-breakpoint
CREATE INDEX "document_signers_status_idx" ON "document_signers" USING btree ("status");--> statement-breakpoint
CREATE INDEX "document_signers_signing_order_idx" ON "document_signers" USING btree ("signing_order");--> statement-breakpoint
CREATE INDEX "signature_audit_document_id_idx" ON "signature_audit_trail" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signature_audit_signer_id_idx" ON "signature_audit_trail" USING btree ("signer_id");--> statement-breakpoint
CREATE INDEX "signature_audit_timestamp_idx" ON "signature_audit_trail" USING btree ("timestamp");--> statement-breakpoint
CREATE INDEX "signature_audit_event_type_idx" ON "signature_audit_trail" USING btree ("event_type");--> statement-breakpoint
CREATE INDEX "signature_documents_tenant_id_idx" ON "signature_documents" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "signature_documents_status_idx" ON "signature_documents" USING btree ("status");--> statement-breakpoint
CREATE INDEX "signature_documents_sent_by_idx" ON "signature_documents" USING btree ("sent_by");--> statement-breakpoint
CREATE INDEX "signature_documents_provider_doc_id_idx" ON "signature_documents" USING btree ("provider_document_id");--> statement-breakpoint
CREATE INDEX "signature_templates_tenant_id_idx" ON "signature_templates" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "signature_templates_category_idx" ON "signature_templates" USING btree ("category");--> statement-breakpoint
CREATE INDEX "signature_templates_is_active_idx" ON "signature_templates" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "signature_webhooks_provider_idx" ON "signature_webhooks_log" USING btree ("provider");--> statement-breakpoint
CREATE INDEX "signature_webhooks_document_id_idx" ON "signature_webhooks_log" USING btree ("document_id");--> statement-breakpoint
CREATE INDEX "signature_webhooks_processing_status_idx" ON "signature_webhooks_log" USING btree ("processing_status");--> statement-breakpoint
CREATE INDEX "ai_safety_filters_flagged_idx" ON "ai_safety_filters" USING btree ("flagged");--> statement-breakpoint
CREATE INDEX "ai_safety_filters_action_idx" ON "ai_safety_filters" USING btree ("action");--> statement-breakpoint
CREATE INDEX "chat_messages_session_id_idx" ON "chat_messages" USING btree ("session_id");--> statement-breakpoint
CREATE INDEX "chat_messages_role_idx" ON "chat_messages" USING btree ("role");--> statement-breakpoint
CREATE INDEX "chat_messages_created_at_idx" ON "chat_messages" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chat_sessions_user_id_idx" ON "chat_sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_tenant_id_idx" ON "chat_sessions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "chat_sessions_status_idx" ON "chat_sessions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "chat_sessions_created_at_idx" ON "chat_sessions" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "chatbot_analytics_tenant_id_idx" ON "chatbot_analytics" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "chatbot_analytics_period_idx" ON "chatbot_analytics" USING btree ("period_start","period_end");--> statement-breakpoint
CREATE INDEX "chatbot_suggestions_tenant_id_idx" ON "chatbot_suggestions" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "chatbot_suggestions_category_idx" ON "chatbot_suggestions" USING btree ("category");--> statement-breakpoint
CREATE INDEX "chatbot_suggestions_is_active_idx" ON "chatbot_suggestions" USING btree ("is_active");--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'knowledge_base'
	) THEN
		CREATE INDEX IF NOT EXISTS "knowledge_base_tenant_id_idx" ON "knowledge_base" USING btree ("tenant_id");
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'knowledge_base'
	) THEN
		CREATE INDEX IF NOT EXISTS "knowledge_base_document_type_idx" ON "knowledge_base" USING btree ("document_type");
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'knowledge_base'
	) AND EXISTS (
		SELECT 1 FROM pg_type WHERE typname = 'vector'
	) THEN
		CREATE INDEX IF NOT EXISTS "knowledge_base_embedding_idx" ON "knowledge_base" USING hnsw ("embedding" vector_cosine_ops);
	END IF;
END $$;--> statement-breakpoint
DO $$ BEGIN
	IF EXISTS (
		SELECT 1
		FROM information_schema.tables
		WHERE table_schema = 'public'
			AND table_name = 'knowledge_base'
	) THEN
		CREATE INDEX IF NOT EXISTS "knowledge_base_is_active_idx" ON "knowledge_base" USING btree ("is_active");
	END IF;
END $$;--> statement-breakpoint
CREATE INDEX "accessibility_audits_tenant_id_idx" ON "accessibility_audits" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "accessibility_audits_status_idx" ON "accessibility_audits" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accessibility_audits_created_at_idx" ON "accessibility_audits" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "accessibility_issues_audit_id_idx" ON "accessibility_issues" USING btree ("audit_id");--> statement-breakpoint
CREATE INDEX "accessibility_issues_tenant_id_idx" ON "accessibility_issues" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "accessibility_issues_status_idx" ON "accessibility_issues" USING btree ("status");--> statement-breakpoint
CREATE INDEX "accessibility_issues_severity_idx" ON "accessibility_issues" USING btree ("severity");--> statement-breakpoint
CREATE INDEX "accessibility_issues_wcag_criteria_idx" ON "accessibility_issues" USING btree ("wcag_criteria");--> statement-breakpoint
CREATE INDEX "accessibility_test_suites_tenant_id_idx" ON "accessibility_test_suites" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "accessibility_test_suites_is_active_idx" ON "accessibility_test_suites" USING btree ("is_active");--> statement-breakpoint
CREATE INDEX "accessibility_user_testing_tenant_id_idx" ON "accessibility_user_testing" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "accessibility_user_testing_session_date_idx" ON "accessibility_user_testing" USING btree ("session_date");--> statement-breakpoint
CREATE INDEX "wcag_criteria_number_idx" ON "wcag_success_criteria" USING btree ("criteria_number");--> statement-breakpoint
CREATE INDEX "wcag_criteria_level_idx" ON "wcag_success_criteria" USING btree ("level");--> statement-breakpoint
CREATE INDEX "wcag_criteria_principle_idx" ON "wcag_success_criteria" USING btree ("principle");--> statement-breakpoint
CREATE INDEX "address_change_history_address_id_idx" ON "address_change_history" USING btree ("address_id");--> statement-breakpoint
CREATE INDEX "address_change_history_created_at_idx" ON "address_change_history" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX "address_validation_cache_input_hash_idx" ON "address_validation_cache" USING btree ("input_hash");--> statement-breakpoint
CREATE INDEX "address_validation_cache_expires_at_idx" ON "address_validation_cache" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "country_address_formats_country_code_idx" ON "country_address_formats" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "international_addresses_tenant_id_idx" ON "international_addresses" USING btree ("tenant_id");--> statement-breakpoint
CREATE INDEX "international_addresses_user_id_idx" ON "international_addresses" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "international_addresses_country_code_idx" ON "international_addresses" USING btree ("country_code");--> statement-breakpoint
CREATE INDEX "international_addresses_status_idx" ON "international_addresses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "international_addresses_is_primary_idx" ON "international_addresses" USING btree ("is_primary");--> statement-breakpoint
CREATE INDEX "international_addresses_postal_code_idx" ON "international_addresses" USING btree ("postal_code");--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "voter_eligibility" ADD CONSTRAINT "voter_eligibility_member_id_organization_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."organization_members"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint
DO $$ BEGIN
  ALTER TABLE "voting_sessions" ADD CONSTRAINT "voting_sessions_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION
  WHEN duplicate_object THEN NULL;
  WHEN undefined_table THEN NULL;
  WHEN undefined_column THEN NULL;
  WHEN undefined_object THEN NULL;
END $$;--> statement-breakpoint

