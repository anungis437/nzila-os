CREATE TYPE "public"."holder_subtype" AS ENUM('individual', 'founder', 'employee', 'corporation', 'trust', 'partnership');--> statement-breakpoint
CREATE TYPE "public"."close_approval_status" AS ENUM('pending', 'approved', 'rejected');--> statement-breakpoint
CREATE TYPE "public"."close_exception_severity" AS ENUM('low', 'medium', 'high', 'critical');--> statement-breakpoint
CREATE TYPE "public"."close_exception_status" AS ENUM('open', 'acknowledged', 'resolved', 'waived');--> statement-breakpoint
CREATE TYPE "public"."close_period_status" AS ENUM('open', 'in_progress', 'pending_approval', 'closed');--> statement-breakpoint
CREATE TYPE "public"."close_task_status" AS ENUM('not_started', 'in_progress', 'completed', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."qbo_report_type" AS ENUM('trial_balance', 'profit_and_loss', 'balance_sheet', 'cash_flow', 'aging_receivable', 'aging_payable', 'general_ledger');--> statement-breakpoint
CREATE TYPE "public"."qbo_sync_status" AS ENUM('pending', 'running', 'completed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."indirect_tax_filing_frequency" AS ENUM('monthly', 'quarterly', 'annual');--> statement-breakpoint
CREATE TYPE "public"."indirect_tax_period_status" AS ENUM('open', 'filed', 'paid', 'closed');--> statement-breakpoint
CREATE TYPE "public"."indirect_tax_type" AS ENUM('GST', 'HST', 'QST');--> statement-breakpoint
CREATE TYPE "public"."tax_filing_type" AS ENUM('T2', 'CO-17', 'Schedule50', 'T5', 'RL-3', 'Other');--> statement-breakpoint
CREATE TYPE "public"."tax_installment_status" AS ENUM('due', 'paid', 'late');--> statement-breakpoint
CREATE TYPE "public"."tax_notice_authority" AS ENUM('CRA', 'Revenu Quebec');--> statement-breakpoint
CREATE TYPE "public"."tax_notice_type" AS ENUM('NOA', 'Reassessment', 'InstallmentReminder');--> statement-breakpoint
CREATE TYPE "public"."tax_year_status" AS ENUM('open', 'filed', 'assessed', 'closed');--> statement-breakpoint
CREATE TYPE "public"."stripe_connection_status" AS ENUM('connected', 'error');--> statement-breakpoint
CREATE TYPE "public"."stripe_dispute_status" AS ENUM('warning_needs_response', 'warning_under_review', 'warning_closed', 'needs_response', 'under_review', 'charge_refunded', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."stripe_event_processing_status" AS ENUM('received', 'processed', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stripe_payment_object_type" AS ENUM('payment_intent', 'checkout_session', 'invoice');--> statement-breakpoint
CREATE TYPE "public"."stripe_payout_status" AS ENUM('paid', 'pending', 'in_transit', 'canceled', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stripe_refund_status" AS ENUM('pending_approval', 'approved', 'executed', 'denied', 'failed');--> statement-breakpoint
CREATE TYPE "public"."stripe_report_type" AS ENUM('revenue_summary', 'payout_recon', 'refunds_summary', 'disputes_summary');--> statement-breakpoint
CREATE TYPE "public"."api_env" AS ENUM('sandbox', 'production');--> statement-breakpoint
CREATE TYPE "public"."cert_track_status" AS ENUM('not_started', 'in_progress', 'completed');--> statement-breakpoint
CREATE TYPE "public"."commission_status" AS ENUM('pending', 'earned', 'paid', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."deal_stage" AS ENUM('registered', 'submitted', 'approved', 'won', 'lost');--> statement-breakpoint
CREATE TYPE "public"."gtm_request_status" AS ENUM('draft', 'submitted', 'assigned', 'in_progress', 'completed', 'cancelled');--> statement-breakpoint
CREATE TYPE "public"."partner_status" AS ENUM('pending', 'active', 'suspended', 'churned');--> statement-breakpoint
CREATE TYPE "public"."partner_tier" AS ENUM('registered', 'select', 'certified', 'professional', 'premier', 'advanced', 'enterprise', 'elite', 'strategic');--> statement-breakpoint
CREATE TYPE "public"."partner_type" AS ENUM('channel', 'isv', 'enterprise');--> statement-breakpoint
CREATE TYPE "public"."partner_user_role" AS ENUM('channel:admin', 'channel:sales', 'channel:executive', 'isv:admin', 'isv:technical', 'isv:business', 'enterprise:admin', 'enterprise:user');--> statement-breakpoint
CREATE TYPE "public"."ai_action_run_status" AS ENUM('started', 'success', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_action_status" AS ENUM('proposed', 'policy_checked', 'awaiting_approval', 'approved', 'executing', 'executed', 'failed', 'rejected', 'expired');--> statement-breakpoint
CREATE TYPE "public"."ai_app_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ai_budget_status" AS ENUM('ok', 'warning', 'blocked');--> statement-breakpoint
CREATE TYPE "public"."ai_environment" AS ENUM('dev', 'staging', 'prod');--> statement-breakpoint
CREATE TYPE "public"."ai_knowledge_ingestion_status" AS ENUM('queued', 'chunked', 'embedded', 'stored', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_knowledge_source_status" AS ENUM('active', 'disabled');--> statement-breakpoint
CREATE TYPE "public"."ai_knowledge_source_type" AS ENUM('blob_document', 'url', 'manual');--> statement-breakpoint
CREATE TYPE "public"."ai_prompt_status" AS ENUM('draft', 'staged', 'active', 'retired');--> statement-breakpoint
CREATE TYPE "public"."ai_redaction_mode" AS ENUM('strict', 'balanced', 'off');--> statement-breakpoint
CREATE TYPE "public"."ai_request_feature" AS ENUM('chat', 'generate', 'embed', 'rag_query', 'extract', 'actions_propose', 'summarize', 'classify');--> statement-breakpoint
CREATE TYPE "public"."ai_request_status" AS ENUM('success', 'refused', 'failed');--> statement-breakpoint
CREATE TYPE "public"."ai_risk_tier" AS ENUM('low', 'medium', 'high');--> statement-breakpoint
CREATE TYPE "public"."ai_deployment_feature" AS ENUM('chat', 'generate', 'embed', 'rag', 'extract');--> statement-breakpoint
CREATE TYPE "public"."ai_model_modality" AS ENUM('text', 'embeddings');--> statement-breakpoint
ALTER TYPE "public"."document_category" ADD VALUE 'attestation' BEFORE 'other';--> statement-breakpoint
ALTER TYPE "public"."document_category" ADD VALUE 'ingestion_report' BEFORE 'other';--> statement-breakpoint
CREATE TABLE "close_approvals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"approver_clerk_user_id" text NOT NULL,
	"approver_role" text NOT NULL,
	"status" "close_approval_status" DEFAULT 'pending' NOT NULL,
	"comments" text,
	"decided_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "close_exceptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"title" text NOT NULL,
	"description" text,
	"severity" "close_exception_severity" DEFAULT 'medium' NOT NULL,
	"status" "close_exception_status" DEFAULT 'open' NOT NULL,
	"raised_by" text NOT NULL,
	"resolved_by" text,
	"resolved_at" timestamp with time zone,
	"waiver_document_id" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "close_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"period_label" varchar(20) NOT NULL,
	"period_type" varchar(10) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"status" "close_period_status" DEFAULT 'open' NOT NULL,
	"opened_by" text NOT NULL,
	"closed_by" text,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "close_task_evidence" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"task_id" uuid NOT NULL,
	"document_id" uuid NOT NULL,
	"sha256" text NOT NULL,
	"uploaded_by" text NOT NULL,
	"uploaded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "close_tasks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"period_id" uuid NOT NULL,
	"task_name" text NOT NULL,
	"description" text,
	"assigned_to" text,
	"status" "close_task_status" DEFAULT 'not_started' NOT NULL,
	"due_date" date,
	"completed_at" timestamp with time zone,
	"completed_by" text,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "finance_governance_links" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"source_type" varchar(40) NOT NULL,
	"source_id" uuid NOT NULL,
	"governance_type" varchar(40) NOT NULL,
	"governance_id" uuid NOT NULL,
	"link_description" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"realm_id" text NOT NULL,
	"company_name" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"connected_by" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"disconnected_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"sync_run_id" uuid NOT NULL,
	"report_type" "qbo_report_type" NOT NULL,
	"period_start" date,
	"period_end" date,
	"document_id" uuid NOT NULL,
	"sha256" text NOT NULL,
	"fetched_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_sync_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"connection_id" uuid NOT NULL,
	"report_type" "qbo_report_type" NOT NULL,
	"period_start" date,
	"period_end" date,
	"status" "qbo_sync_status" DEFAULT 'pending' NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"error_message" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "qbo_tokens" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"connection_id" uuid NOT NULL,
	"access_token" text NOT NULL,
	"refresh_token" text NOT NULL,
	"access_token_expires_at" timestamp with time zone NOT NULL,
	"refresh_token_expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indirect_tax_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"tax_type" "indirect_tax_type" NOT NULL,
	"filing_frequency" "indirect_tax_filing_frequency" NOT NULL,
	"program_account_number" varchar(20),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indirect_tax_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"tax_type" "indirect_tax_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"filing_due" date NOT NULL,
	"payment_due" date NOT NULL,
	"status" "indirect_tax_period_status" DEFAULT 'open' NOT NULL,
	"document_id" uuid,
	"sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "indirect_tax_summary" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"period_id" uuid NOT NULL,
	"total_sales" numeric(14, 2),
	"tax_collected" numeric(14, 2),
	"itcs" numeric(14, 2),
	"net_payable" numeric(14, 2),
	"reconciled" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"filing_type" "tax_filing_type" NOT NULL,
	"filed_date" date,
	"prepared_by" text NOT NULL,
	"reviewed_by" text,
	"document_id" uuid,
	"sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"required_amount" numeric(14, 2) NOT NULL,
	"paid_amount" numeric(14, 2),
	"payment_document_id" uuid,
	"status" "tax_installment_status" DEFAULT 'due' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_notices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"authority" "tax_notice_authority" NOT NULL,
	"notice_type" "tax_notice_type" NOT NULL,
	"received_date" date NOT NULL,
	"document_id" uuid,
	"sha256" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"federal_bn" varchar(15),
	"province_of_registration" varchar(5),
	"fiscal_year_end" varchar(5),
	"accountant_name" text,
	"accountant_email" text,
	"cra_program_accounts" jsonb DEFAULT '{}'::jsonb,
	"rq_program_accounts" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tax_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"fiscal_year_label" varchar(10) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"federal_filing_deadline" date NOT NULL,
	"federal_payment_deadline" date NOT NULL,
	"provincial_filing_deadline" date,
	"provincial_payment_deadline" date,
	"status" "tax_year_status" DEFAULT 'open' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"account_id" text NOT NULL,
	"livemode" boolean DEFAULT false NOT NULL,
	"status" "stripe_connection_status" DEFAULT 'connected' NOT NULL,
	"connected_by" text NOT NULL,
	"connected_at" timestamp with time zone DEFAULT now() NOT NULL,
	"last_event_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_disputes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"dispute_id" text NOT NULL,
	"payment_id" uuid,
	"amount_cents" bigint NOT NULL,
	"status" text NOT NULL,
	"reason" text,
	"due_by" timestamp with time zone,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"stripe_object_id" text NOT NULL,
	"object_type" "stripe_payment_object_type" NOT NULL,
	"status" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"venture_id" text,
	"occurred_at" timestamp with time zone NOT NULL,
	"raw_event_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_payouts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"payout_id" text NOT NULL,
	"amount_cents" bigint NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "stripe_payout_status" NOT NULL,
	"arrival_date" date,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_refunds" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"refund_id" text,
	"payment_id" uuid,
	"amount_cents" bigint NOT NULL,
	"status" "stripe_refund_status" DEFAULT 'pending_approval' NOT NULL,
	"requested_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"occurred_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_reports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"period_id" text,
	"report_type" "stripe_report_type" NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"document_id" uuid,
	"sha256" text NOT NULL,
	"generated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "stripe_webhook_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"stripe_event_id" text NOT NULL,
	"type" text NOT NULL,
	"api_version" text,
	"livemode" boolean NOT NULL,
	"created" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"payload_json" jsonb NOT NULL,
	"signature_valid" boolean NOT NULL,
	"processing_status" "stripe_event_processing_status" DEFAULT 'received' NOT NULL,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "api_credentials" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"env" "api_env" NOT NULL,
	"key_prefix" varchar(12) NOT NULL,
	"key_hash" text NOT NULL,
	"label" varchar(100),
	"is_revoked" boolean DEFAULT false NOT NULL,
	"last_used_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "assets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" varchar(50) NOT NULL,
	"description" text,
	"blob_key" text NOT NULL,
	"version" integer DEFAULT 1 NOT NULL,
	"tags" jsonb,
	"uploaded_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "certifications" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"track_id" varchar(100) NOT NULL,
	"module_id" varchar(100),
	"status" "cert_track_status" DEFAULT 'not_started' NOT NULL,
	"completed_at" timestamp with time zone,
	"badge_blob_key" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "commissions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deal_id" uuid NOT NULL,
	"partner_id" uuid NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"tier_multiplier" numeric(4, 2) DEFAULT '1.00' NOT NULL,
	"status" "commission_status" DEFAULT 'pending' NOT NULL,
	"paid_at" timestamp with time zone,
	"stripe_payout_id" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "deals" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"account_name" text NOT NULL,
	"contact_name" text NOT NULL,
	"contact_email" varchar(320) NOT NULL,
	"vertical" varchar(100) NOT NULL,
	"estimated_arr" numeric(12, 2) NOT NULL,
	"stage" "deal_stage" DEFAULT 'registered' NOT NULL,
	"expected_close_date" date,
	"locked_until" timestamp with time zone,
	"notes" text,
	"nzila_reviewer_id" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gtm_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"type" varchar(50) NOT NULL,
	"subject" text NOT NULL,
	"payload" jsonb,
	"nzila_owner_id" varchar(255),
	"status" "gtm_request_status" DEFAULT 'draft' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partner_users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"partner_id" uuid NOT NULL,
	"clerk_user_id" varchar(255) NOT NULL,
	"role" "partner_user_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "partners" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"clerk_org_id" varchar(255) NOT NULL,
	"company_name" text NOT NULL,
	"type" "partner_type" NOT NULL,
	"tier" "partner_tier" DEFAULT 'registered' NOT NULL,
	"status" "partner_status" DEFAULT 'pending' NOT NULL,
	"nzila_owner_id" varchar(255),
	"website" text,
	"logo" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "partners_clerk_org_id_unique" UNIQUE("clerk_org_id")
);
--> statement-breakpoint
CREATE TABLE "ai_action_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"action_id" uuid NOT NULL,
	"entity_id" uuid NOT NULL,
	"status" "ai_action_run_status" DEFAULT 'started' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"finished_at" timestamp with time zone,
	"tool_calls_json" jsonb DEFAULT '[]'::jsonb,
	"output_artifacts_json" jsonb DEFAULT '{}'::jsonb,
	"attestation_document_id" uuid,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_actions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"profile_key" varchar(120) NOT NULL,
	"action_type" varchar(120) NOT NULL,
	"risk_tier" "ai_risk_tier" DEFAULT 'low' NOT NULL,
	"status" "ai_action_status" DEFAULT 'proposed' NOT NULL,
	"proposal_json" jsonb NOT NULL,
	"policy_decision_json" jsonb,
	"approvals_required_json" jsonb,
	"requested_by" text NOT NULL,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"related_domain_type" varchar(60),
	"related_domain_id" uuid,
	"ai_request_id" uuid,
	"evidence_pack_eligible" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_apps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"name" text NOT NULL,
	"status" "ai_app_status" DEFAULT 'active' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "ai_apps_app_key_unique" UNIQUE("app_key")
);
--> statement-breakpoint
CREATE TABLE "ai_capability_profiles" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"environment" "ai_environment" DEFAULT 'dev' NOT NULL,
	"profile_key" varchar(120) NOT NULL,
	"enabled" boolean DEFAULT true NOT NULL,
	"allowed_providers" jsonb DEFAULT '["azure_openai"]'::jsonb NOT NULL,
	"allowed_models" jsonb DEFAULT '[]'::jsonb NOT NULL,
	"modalities" jsonb DEFAULT '["text","embeddings"]'::jsonb NOT NULL,
	"features" jsonb DEFAULT '["chat","generate"]'::jsonb NOT NULL,
	"data_classes_allowed" jsonb DEFAULT '["public","internal"]'::jsonb NOT NULL,
	"streaming_allowed" boolean DEFAULT true NOT NULL,
	"determinism_required" boolean DEFAULT false NOT NULL,
	"retention_days" integer DEFAULT 90,
	"tool_permissions" jsonb DEFAULT '[]'::jsonb,
	"budgets" jsonb DEFAULT '{}'::jsonb,
	"redaction_mode" "ai_redaction_mode" DEFAULT 'strict' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_embeddings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"source_id" uuid NOT NULL,
	"chunk_id" varchar(255) NOT NULL,
	"chunk_text" text NOT NULL,
	"embedding" text,
	"metadata" jsonb DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_knowledge_ingestion_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"source_id" uuid NOT NULL,
	"status" "ai_knowledge_ingestion_status" DEFAULT 'queued' NOT NULL,
	"metrics_json" jsonb DEFAULT '{}'::jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_knowledge_sources" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"source_type" "ai_knowledge_source_type" NOT NULL,
	"title" text NOT NULL,
	"document_id" uuid,
	"url" text,
	"status" "ai_knowledge_source_status" DEFAULT 'active' NOT NULL,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompt_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"prompt_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"status" "ai_prompt_status" DEFAULT 'draft' NOT NULL,
	"template" text NOT NULL,
	"system_template" text,
	"output_schema" jsonb,
	"allowed_features" jsonb DEFAULT '[]'::jsonb,
	"default_params" jsonb DEFAULT '{}'::jsonb,
	"created_by" text NOT NULL,
	"activated_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_prompts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"prompt_key" varchar(120) NOT NULL,
	"description" text,
	"owner_role" text,
	"created_by" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_request_payloads" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"request_id" uuid NOT NULL,
	"request_json" jsonb,
	"response_json" jsonb,
	"encrypted" boolean DEFAULT false NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_requests" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"profile_key" varchar(120) NOT NULL,
	"feature" "ai_request_feature" NOT NULL,
	"prompt_version_id" uuid,
	"provider" varchar(60) NOT NULL,
	"model_or_deployment" varchar(120) NOT NULL,
	"request_hash" text NOT NULL,
	"response_hash" text NOT NULL,
	"input_redacted" boolean DEFAULT false NOT NULL,
	"tokens_in" integer,
	"tokens_out" integer,
	"cost_usd" numeric(12, 6),
	"latency_ms" integer,
	"status" "ai_request_status" NOT NULL,
	"error_code" varchar(60),
	"created_by" text,
	"occurred_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_usage_budgets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"profile_key" varchar(120) NOT NULL,
	"month" varchar(7) NOT NULL,
	"budget_usd" numeric(12, 2) NOT NULL,
	"spent_usd" numeric(12, 6) DEFAULT '0' NOT NULL,
	"status" "ai_budget_status" DEFAULT 'ok' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_deployment_routes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"entity_id" uuid NOT NULL,
	"app_key" varchar(60) NOT NULL,
	"profile_key" varchar(120) NOT NULL,
	"feature" "ai_deployment_feature" NOT NULL,
	"deployment_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"model_id" uuid NOT NULL,
	"deployment_name" varchar(200) NOT NULL,
	"environment" "ai_environment" DEFAULT 'dev' NOT NULL,
	"allowed_data_classes" jsonb DEFAULT '["public","internal"]'::jsonb NOT NULL,
	"max_tokens" integer DEFAULT 4096 NOT NULL,
	"default_temperature" numeric(3, 2) DEFAULT '0.70' NOT NULL,
	"cost_profile" jsonb DEFAULT '{}'::jsonb,
	"enabled" boolean DEFAULT true NOT NULL,
	"fallback_deployment_id" uuid,
	"approved_by" text,
	"approved_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "ai_models" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"provider" varchar(60) NOT NULL,
	"family" varchar(120) NOT NULL,
	"modality" "ai_model_modality" NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "shareholders" ADD COLUMN "holder_subtype" "holder_subtype";--> statement-breakpoint
ALTER TABLE "close_approvals" ADD CONSTRAINT "close_approvals_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_approvals" ADD CONSTRAINT "close_approvals_period_id_close_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."close_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_exceptions" ADD CONSTRAINT "close_exceptions_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_exceptions" ADD CONSTRAINT "close_exceptions_period_id_close_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."close_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_periods" ADD CONSTRAINT "close_periods_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_task_evidence" ADD CONSTRAINT "close_task_evidence_task_id_close_tasks_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."close_tasks"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_tasks" ADD CONSTRAINT "close_tasks_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "close_tasks" ADD CONSTRAINT "close_tasks_period_id_close_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."close_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "finance_governance_links" ADD CONSTRAINT "finance_governance_links_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_connections" ADD CONSTRAINT "qbo_connections_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_reports" ADD CONSTRAINT "qbo_reports_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_reports" ADD CONSTRAINT "qbo_reports_sync_run_id_qbo_sync_runs_id_fk" FOREIGN KEY ("sync_run_id") REFERENCES "public"."qbo_sync_runs"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_sync_runs" ADD CONSTRAINT "qbo_sync_runs_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_sync_runs" ADD CONSTRAINT "qbo_sync_runs_connection_id_qbo_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."qbo_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qbo_tokens" ADD CONSTRAINT "qbo_tokens_connection_id_qbo_connections_id_fk" FOREIGN KEY ("connection_id") REFERENCES "public"."qbo_connections"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indirect_tax_accounts" ADD CONSTRAINT "indirect_tax_accounts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indirect_tax_periods" ADD CONSTRAINT "indirect_tax_periods_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indirect_tax_periods" ADD CONSTRAINT "indirect_tax_periods_account_id_indirect_tax_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."indirect_tax_accounts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "indirect_tax_summary" ADD CONSTRAINT "indirect_tax_summary_period_id_indirect_tax_periods_id_fk" FOREIGN KEY ("period_id") REFERENCES "public"."indirect_tax_periods"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filings" ADD CONSTRAINT "tax_filings_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_filings" ADD CONSTRAINT "tax_filings_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_installments" ADD CONSTRAINT "tax_installments_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_installments" ADD CONSTRAINT "tax_installments_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_notices" ADD CONSTRAINT "tax_notices_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_notices" ADD CONSTRAINT "tax_notices_tax_year_id_tax_years_id_fk" FOREIGN KEY ("tax_year_id") REFERENCES "public"."tax_years"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_profiles" ADD CONSTRAINT "tax_profiles_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tax_years" ADD CONSTRAINT "tax_years_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_connections" ADD CONSTRAINT "stripe_connections_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_disputes" ADD CONSTRAINT "stripe_disputes_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_disputes" ADD CONSTRAINT "stripe_disputes_payment_id_stripe_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."stripe_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payments" ADD CONSTRAINT "stripe_payments_raw_event_id_stripe_webhook_events_id_fk" FOREIGN KEY ("raw_event_id") REFERENCES "public"."stripe_webhook_events"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_payouts" ADD CONSTRAINT "stripe_payouts_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_refunds" ADD CONSTRAINT "stripe_refunds_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_refunds" ADD CONSTRAINT "stripe_refunds_payment_id_stripe_payments_id_fk" FOREIGN KEY ("payment_id") REFERENCES "public"."stripe_payments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_reports" ADD CONSTRAINT "stripe_reports_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_reports" ADD CONSTRAINT "stripe_reports_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stripe_webhook_events" ADD CONSTRAINT "stripe_webhook_events_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "api_credentials" ADD CONSTRAINT "api_credentials_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "certifications" ADD CONSTRAINT "certifications_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_deal_id_deals_id_fk" FOREIGN KEY ("deal_id") REFERENCES "public"."deals"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commissions" ADD CONSTRAINT "commissions_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "deals" ADD CONSTRAINT "deals_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gtm_requests" ADD CONSTRAINT "gtm_requests_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "partner_users" ADD CONSTRAINT "partner_users_partner_id_partners_id_fk" FOREIGN KEY ("partner_id") REFERENCES "public"."partners"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_runs" ADD CONSTRAINT "ai_action_runs_action_id_ai_actions_id_fk" FOREIGN KEY ("action_id") REFERENCES "public"."ai_actions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_runs" ADD CONSTRAINT "ai_action_runs_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_action_runs" ADD CONSTRAINT "ai_action_runs_attestation_document_id_documents_id_fk" FOREIGN KEY ("attestation_document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_actions" ADD CONSTRAINT "ai_actions_ai_request_id_ai_requests_id_fk" FOREIGN KEY ("ai_request_id") REFERENCES "public"."ai_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_capability_profiles" ADD CONSTRAINT "ai_capability_profiles_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_embeddings" ADD CONSTRAINT "ai_embeddings_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_embeddings" ADD CONSTRAINT "ai_embeddings_source_id_ai_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."ai_knowledge_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_knowledge_ingestion_runs" ADD CONSTRAINT "ai_knowledge_ingestion_runs_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_knowledge_ingestion_runs" ADD CONSTRAINT "ai_knowledge_ingestion_runs_source_id_ai_knowledge_sources_id_fk" FOREIGN KEY ("source_id") REFERENCES "public"."ai_knowledge_sources"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_knowledge_sources" ADD CONSTRAINT "ai_knowledge_sources_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_knowledge_sources" ADD CONSTRAINT "ai_knowledge_sources_document_id_documents_id_fk" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_prompt_versions" ADD CONSTRAINT "ai_prompt_versions_prompt_id_ai_prompts_id_fk" FOREIGN KEY ("prompt_id") REFERENCES "public"."ai_prompts"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_request_payloads" ADD CONSTRAINT "ai_request_payloads_request_id_ai_requests_id_fk" FOREIGN KEY ("request_id") REFERENCES "public"."ai_requests"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_requests" ADD CONSTRAINT "ai_requests_prompt_version_id_ai_prompt_versions_id_fk" FOREIGN KEY ("prompt_version_id") REFERENCES "public"."ai_prompt_versions"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_usage_budgets" ADD CONSTRAINT "ai_usage_budgets_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_deployment_routes" ADD CONSTRAINT "ai_deployment_routes_entity_id_entities_id_fk" FOREIGN KEY ("entity_id") REFERENCES "public"."entities"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_deployment_routes" ADD CONSTRAINT "ai_deployment_routes_deployment_id_ai_deployments_id_fk" FOREIGN KEY ("deployment_id") REFERENCES "public"."ai_deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_deployments" ADD CONSTRAINT "ai_deployments_model_id_ai_models_id_fk" FOREIGN KEY ("model_id") REFERENCES "public"."ai_models"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_deployments" ADD CONSTRAINT "ai_deployments_fallback_deployment_id_ai_deployments_id_fk" FOREIGN KEY ("fallback_deployment_id") REFERENCES "public"."ai_deployments"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "stripe_webhook_events_stripe_event_id_idx" ON "stripe_webhook_events" USING btree ("stripe_event_id");--> statement-breakpoint
CREATE INDEX "idx_ai_action_runs_action" ON "ai_action_runs" USING btree ("action_id");--> statement-breakpoint
CREATE INDEX "idx_ai_action_runs_entity" ON "ai_action_runs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_ai_actions_entity_app" ON "ai_actions" USING btree ("entity_id","app_key");--> statement-breakpoint
CREATE INDEX "idx_ai_actions_status" ON "ai_actions" USING btree ("status");--> statement-breakpoint
CREATE INDEX "idx_ai_actions_type" ON "ai_actions" USING btree ("action_type");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_profile" ON "ai_capability_profiles" USING btree ("entity_id","app_key","environment","profile_key");--> statement-breakpoint
CREATE INDEX "idx_ai_embeddings_entity_app" ON "ai_embeddings" USING btree ("entity_id","app_key");--> statement-breakpoint
CREATE INDEX "idx_ai_embeddings_source" ON "ai_embeddings" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_ai_ingestion_runs_source" ON "ai_knowledge_ingestion_runs" USING btree ("source_id");--> statement-breakpoint
CREATE INDEX "idx_ai_ingestion_runs_entity" ON "ai_knowledge_ingestion_runs" USING btree ("entity_id");--> statement-breakpoint
CREATE INDEX "idx_ai_knowledge_entity_app" ON "ai_knowledge_sources" USING btree ("entity_id","app_key");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_prompt_version" ON "ai_prompt_versions" USING btree ("prompt_id","version");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_prompt_key" ON "ai_prompts" USING btree ("app_key","prompt_key");--> statement-breakpoint
CREATE INDEX "idx_ai_requests_entity_app" ON "ai_requests" USING btree ("entity_id","app_key");--> statement-breakpoint
CREATE INDEX "idx_ai_requests_occurred" ON "ai_requests" USING btree ("occurred_at");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_budget" ON "ai_usage_budgets" USING btree ("entity_id","app_key","profile_key","month");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_route" ON "ai_deployment_routes" USING btree ("entity_id","app_key","profile_key","feature");--> statement-breakpoint
CREATE INDEX "idx_ai_routes_entity_app" ON "ai_deployment_routes" USING btree ("entity_id","app_key");--> statement-breakpoint
CREATE INDEX "idx_ai_routes_deployment" ON "ai_deployment_routes" USING btree ("deployment_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_deployment_name_env" ON "ai_deployments" USING btree ("deployment_name","environment");--> statement-breakpoint
CREATE INDEX "idx_ai_deployments_model" ON "ai_deployments" USING btree ("model_id");--> statement-breakpoint
CREATE UNIQUE INDEX "uq_ai_model_provider_family" ON "ai_models" USING btree ("provider","family");