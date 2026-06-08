-- 0030_console_schema_bootstrap.sql
--
-- Purpose:
-- Backfill console-critical tables that may be absent in local/dev databases
-- where migration history predates Executive OS + finance/commercial surfaces.
--
-- Notes:
-- - This migration is intentionally additive and idempotent.
-- - It avoids destructive DDL and only creates missing tables/indexes.
-- - Column sets are aligned to current console read/write paths.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS "treasury_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"cash_on_hand" numeric(18,2) NOT NULL DEFAULT '0',
	"restricted_cash" numeric(18,2) NOT NULL DEFAULT '0',
	"receivables" numeric(18,2) NOT NULL DEFAULT '0',
	"liabilities_due_30d" numeric(18,2) NOT NULL DEFAULT '0',
	"notes" text,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "treasury_snapshots_org_date_idx" ON "treasury_snapshots" ("org_id", "date");

CREATE TABLE IF NOT EXISTS "runway_assumptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"mode" varchar(16) NOT NULL,
	"expected_monthly_revenue" numeric(18,2) NOT NULL DEFAULT '0',
	"planned_hires" integer NOT NULL DEFAULT 0,
	"discretionary_spend" numeric(18,2) NOT NULL DEFAULT '0',
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "runway_assumptions_org_mode_idx" ON "runway_assumptions" ("org_id", "mode");

CREATE TABLE IF NOT EXISTS "founder_time_logs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL,
	"venture_id" varchar(64) NOT NULL,
	"category" varchar(32) NOT NULL,
	"hours" real NOT NULL,
	"notes" text,
	"impact_score" integer,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "founder_time_logs_org_date_idx" ON "founder_time_logs" ("org_id", "date");
CREATE INDEX IF NOT EXISTS "founder_time_logs_venture_idx" ON "founder_time_logs" ("org_id", "venture_id", "date");
CREATE INDEX IF NOT EXISTS "founder_time_logs_category_idx" ON "founder_time_logs" ("org_id", "category", "date");

CREATE TABLE IF NOT EXISTS "weekly_focus_targets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"venture_id" varchar(64) NOT NULL,
	"week_start" timestamp with time zone NOT NULL,
	"target_hours" real NOT NULL,
	"rationale" text,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "weekly_focus_targets_org_venture_week_idx" ON "weekly_focus_targets" ("org_id", "venture_id", "week_start");
CREATE INDEX IF NOT EXISTS "weekly_focus_targets_org_week_idx" ON "weekly_focus_targets" ("org_id", "week_start");

CREATE TABLE IF NOT EXISTS "execution_initiatives" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"title" text NOT NULL,
	"venture" varchar(64),
	"zone" varchar(32),
	"owner" varchar(128),
	"due_date" date,
	"status" varchar(32) NOT NULL DEFAULT 'not-started',
	"urgent" boolean NOT NULL DEFAULT false,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "execution_initiatives_org_status_idx" ON "execution_initiatives" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "execution_initiatives_org_due_idx" ON "execution_initiatives" ("org_id", "due_date");
CREATE INDEX IF NOT EXISTS "execution_initiatives_org_zone_idx" ON "execution_initiatives" ("org_id", "zone");

CREATE TABLE IF NOT EXISTS "executive_decisions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"date" timestamp with time zone NOT NULL DEFAULT now(),
	"title" text NOT NULL,
	"rationale" text,
	"venture_id" varchar(64),
	"category" varchar(32) NOT NULL,
	"priority" varchar(16) NOT NULL DEFAULT 'p2',
	"owner" varchar(128),
	"due_date" date,
	"status" varchar(32) NOT NULL DEFAULT 'proposed',
	"linked_initiative_id" uuid,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "executive_decisions_org_status_idx" ON "executive_decisions" ("org_id", "status");
CREATE INDEX IF NOT EXISTS "executive_decisions_org_due_idx" ON "executive_decisions" ("org_id", "due_date");
CREATE INDEX IF NOT EXISTS "executive_decisions_org_venture_idx" ON "executive_decisions" ("org_id", "venture_id");
CREATE INDEX IF NOT EXISTS "executive_decisions_org_created_idx" ON "executive_decisions" ("org_id", "created_at");

CREATE TABLE IF NOT EXISTS "decision_scorebacks" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"decision_id" uuid NOT NULL,
	"expected_result" text NOT NULL,
	"expected_roi_pct" real,
	"expected_by_date" date,
	"actual_result" text,
	"actual_roi_pct" real,
	"outcome_status" varchar(32) NOT NULL DEFAULT 'pending',
	"accuracy_score" real,
	"confidence_at_decision" real,
	"evaluated_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "decision_scorebacks_org_status_idx" ON "decision_scorebacks" ("org_id", "outcome_status");
CREATE INDEX IF NOT EXISTS "decision_scorebacks_org_evaluated_idx" ON "decision_scorebacks" ("org_id", "evaluated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "decision_scorebacks_org_decision_idx" ON "decision_scorebacks" ("org_id", "decision_id");

CREATE TABLE IF NOT EXISTS "executive_agent_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"agent_key" varchar(64) NOT NULL,
	"agent_version" varchar(16) NOT NULL DEFAULT 'v1',
	"triggered_by" varchar(32) NOT NULL DEFAULT 'schedule',
	"actor_id" varchar(128),
	"correlation_id" varchar(64),
	"status" varchar(16) NOT NULL DEFAULT 'succeeded',
	"duration_ms" integer NOT NULL DEFAULT 0,
	"input_digest" jsonb,
	"summary" text,
	"error_message" text,
	"started_at" timestamp with time zone NOT NULL DEFAULT now(),
	"completed_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "executive_agent_runs_org_agent_idx" ON "executive_agent_runs" ("org_id", "agent_key", "started_at");
CREATE INDEX IF NOT EXISTS "executive_agent_runs_org_status_idx" ON "executive_agent_runs" ("org_id", "status", "started_at");
CREATE INDEX IF NOT EXISTS "executive_agent_runs_org_correlation_idx" ON "executive_agent_runs" ("org_id", "correlation_id");

CREATE TABLE IF NOT EXISTS "executive_agent_insights" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"run_id" uuid NOT NULL,
	"agent_key" varchar(64) NOT NULL,
	"domain" varchar(32) NOT NULL,
	"title" text NOT NULL,
	"body" text NOT NULL,
	"severity" varchar(16) NOT NULL DEFAULT 'info',
	"confidence" real NOT NULL DEFAULT 0.5,
	"evidence" jsonb,
	"consequence_if_ignored" text,
	"recommended_next_step" text,
	"dismissed_at" timestamp with time zone,
	"dismissed_by" varchar(128),
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "executive_agent_insights_org_agent_idx" ON "executive_agent_insights" ("org_id", "agent_key", "created_at");
CREATE INDEX IF NOT EXISTS "executive_agent_insights_org_severity_idx" ON "executive_agent_insights" ("org_id", "severity", "created_at");
CREATE INDEX IF NOT EXISTS "executive_agent_insights_org_domain_idx" ON "executive_agent_insights" ("org_id", "domain", "created_at");
CREATE INDEX IF NOT EXISTS "executive_agent_insights_run_idx" ON "executive_agent_insights" ("run_id");

CREATE TABLE IF NOT EXISTS "platform_integration_connections" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"provider" varchar(64) NOT NULL,
	"status" varchar(32) NOT NULL DEFAULT 'disconnected',
	"secrets_encrypted" text NOT NULL DEFAULT '{}',
	"secrets_fingerprint" varchar(128) NOT NULL DEFAULT 'bootstrap',
	"last_validated_at" timestamp with time zone,
	"last_validation_ok" boolean NOT NULL DEFAULT false,
	"last_validation_error" text,
	"metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"created_by" text NOT NULL DEFAULT 'bootstrap',
	"updated_by" text NOT NULL DEFAULT 'bootstrap',
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "platform_integration_connections_org_provider_uq" ON "platform_integration_connections" ("org_id", "provider");

CREATE TABLE IF NOT EXISTS "platform_cost_rollups" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"app_id" varchar(128) NOT NULL,
	"category" varchar(64) NOT NULL,
	"day" varchar(10) NOT NULL,
	"total_units" real NOT NULL DEFAULT 0,
	"total_est_cost_usd" real NOT NULL DEFAULT 0,
	"event_count" integer NOT NULL DEFAULT 0,
	"rolled_up_at" timestamp with time zone NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "cost_rollup_org_app_cat_day_idx" ON "platform_cost_rollups" ("org_id", "app_id", "category", "day");
CREATE INDEX IF NOT EXISTS "cost_rollup_org_day_idx" ON "platform_cost_rollups" ("org_id", "day");

CREATE TABLE IF NOT EXISTS "commerce_quotes" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"ref" varchar(30) NOT NULL,
	"status" varchar(32) NOT NULL DEFAULT 'draft',
	"total" numeric(18,2) NOT NULL DEFAULT '0',
	"metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "commerce_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"ref" varchar(30) NOT NULL,
	"status" varchar(32) NOT NULL DEFAULT 'draft',
	"total" numeric(18,2) NOT NULL DEFAULT '0',
	"amount_due" numeric(18,2) NOT NULL DEFAULT '0',
	"due_date" timestamp with time zone,
	"metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
	"created_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "zonga_revenue_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"amount" numeric(18,6) NOT NULL,
	"occurred_at" timestamp with time zone NOT NULL DEFAULT now(),
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"metadata" jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE TABLE IF NOT EXISTS "tax_years" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"fiscal_year_label" varchar(10) NOT NULL,
	"start_date" date NOT NULL,
	"end_date" date NOT NULL,
	"federal_filing_deadline" date NOT NULL,
	"federal_payment_deadline" date NOT NULL,
	"provincial_filing_deadline" date,
	"provincial_payment_deadline" date,
	"status" varchar(16) NOT NULL DEFAULT 'open',
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tax_filings" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"filing_type" varchar(16) NOT NULL,
	"filed_date" date,
	"prepared_by" text NOT NULL DEFAULT 'bootstrap',
	"reviewed_by" text,
	"document_id" uuid,
	"sha256" text,
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "tax_installments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"org_id" uuid NOT NULL,
	"tax_year_id" uuid NOT NULL,
	"due_date" date NOT NULL,
	"required_amount" numeric(14,2) NOT NULL,
	"paid_amount" numeric(14,2),
	"payment_document_id" uuid,
	"status" varchar(16) NOT NULL DEFAULT 'due',
	"created_at" timestamp with time zone NOT NULL DEFAULT now(),
	"updated_at" timestamp with time zone NOT NULL DEFAULT now()
);

DO $$ BEGIN
	CREATE TYPE "platform_integration_provider" AS ENUM (
		'resend',
		'sendgrid',
		'mailgun',
		'twilio',
		'firebase',
		'slack',
		'teams',
		'hubspot',
		'm365',
		'google-workspace',
		'webhooks'
	);
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	CREATE TYPE "platform_integration_connection_status" AS ENUM ('connected', 'degraded', 'error', 'disconnected');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	CREATE TYPE "commerce_quote_status" AS ENUM (
		'draft',
		'pricing',
		'ready',
		'sent',
		'reviewing',
		'accepted',
		'declined',
		'revised',
		'expired',
		'cancelled'
	);
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	CREATE TYPE "commerce_invoice_status" AS ENUM (
		'draft',
		'issued',
		'sent',
		'partial_paid',
		'paid',
		'overdue',
		'disputed',
		'resolved',
		'refunded',
		'credit_note',
		'cancelled'
	);
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	CREATE TYPE "tax_year_status" AS ENUM ('open', 'filed', 'assessed', 'closed');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	CREATE TYPE "tax_filing_type" AS ENUM (
		'T2',
		'CO-17',
		'Schedule50',
		'T5',
		'RL-3',
		'Other',
		'T1',
		'T3',
		'T4',
		'T4A',
		'T5013',
		'PayrollRemittance'
	);
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	CREATE TYPE "tax_installment_status" AS ENUM ('due', 'paid', 'late');
EXCEPTION
	WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "platform_integration_connections"
		ALTER COLUMN "provider" DROP DEFAULT,
		ALTER COLUMN "status" DROP DEFAULT,
		ALTER COLUMN "provider" TYPE "platform_integration_provider" USING "provider"::"platform_integration_provider",
		ALTER COLUMN "status" TYPE "platform_integration_connection_status" USING "status"::"platform_integration_connection_status",
		ALTER COLUMN "provider" SET DEFAULT 'webhooks'::"platform_integration_provider",
		ALTER COLUMN "status" SET DEFAULT 'disconnected'::"platform_integration_connection_status";
EXCEPTION
	WHEN undefined_column OR undefined_table OR datatype_mismatch OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "commerce_quotes"
		ALTER COLUMN "status" DROP DEFAULT,
		ALTER COLUMN "status" TYPE "commerce_quote_status" USING "status"::"commerce_quote_status",
		ALTER COLUMN "status" SET DEFAULT 'draft'::"commerce_quote_status";
EXCEPTION
	WHEN undefined_column OR undefined_table OR datatype_mismatch OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "commerce_invoices"
		ALTER COLUMN "status" DROP DEFAULT,
		ALTER COLUMN "status" TYPE "commerce_invoice_status" USING "status"::"commerce_invoice_status",
		ALTER COLUMN "status" SET DEFAULT 'draft'::"commerce_invoice_status";
EXCEPTION
	WHEN undefined_column OR undefined_table OR datatype_mismatch OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "tax_years"
		ALTER COLUMN "status" DROP DEFAULT,
		ALTER COLUMN "status" TYPE "tax_year_status" USING "status"::"tax_year_status",
		ALTER COLUMN "status" SET DEFAULT 'open'::"tax_year_status";
EXCEPTION
	WHEN undefined_column OR undefined_table OR datatype_mismatch OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "tax_filings"
		ALTER COLUMN "filing_type" TYPE "tax_filing_type" USING "filing_type"::"tax_filing_type";
EXCEPTION
	WHEN undefined_column OR undefined_table OR datatype_mismatch OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
	ALTER TABLE "tax_installments"
		ALTER COLUMN "status" DROP DEFAULT,
		ALTER COLUMN "status" TYPE "tax_installment_status" USING "status"::"tax_installment_status",
		ALTER COLUMN "status" SET DEFAULT 'due'::"tax_installment_status";
EXCEPTION
	WHEN undefined_column OR undefined_table OR datatype_mismatch OR invalid_text_representation THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'treasury_snapshots_org_fk') THEN
		ALTER TABLE "treasury_snapshots" ADD CONSTRAINT "treasury_snapshots_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'runway_assumptions_org_fk') THEN
		ALTER TABLE "runway_assumptions" ADD CONSTRAINT "runway_assumptions_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'founder_time_logs_org_fk') THEN
		ALTER TABLE "founder_time_logs" ADD CONSTRAINT "founder_time_logs_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'weekly_focus_targets_org_fk') THEN
		ALTER TABLE "weekly_focus_targets" ADD CONSTRAINT "weekly_focus_targets_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'execution_initiatives_org_fk') THEN
		ALTER TABLE "execution_initiatives" ADD CONSTRAINT "execution_initiatives_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'executive_decisions_org_fk') THEN
		ALTER TABLE "executive_decisions" ADD CONSTRAINT "executive_decisions_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.execution_initiatives') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'executive_decisions_initiative_fk') THEN
		ALTER TABLE "executive_decisions" ADD CONSTRAINT "executive_decisions_initiative_fk" FOREIGN KEY ("linked_initiative_id") REFERENCES "execution_initiatives"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decision_scorebacks_org_fk') THEN
		ALTER TABLE "decision_scorebacks" ADD CONSTRAINT "decision_scorebacks_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.executive_decisions') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'decision_scorebacks_decision_fk') THEN
		ALTER TABLE "decision_scorebacks" ADD CONSTRAINT "decision_scorebacks_decision_fk" FOREIGN KEY ("decision_id") REFERENCES "executive_decisions"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'executive_agent_runs_org_fk') THEN
		ALTER TABLE "executive_agent_runs" ADD CONSTRAINT "executive_agent_runs_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'executive_agent_insights_org_fk') THEN
		ALTER TABLE "executive_agent_insights" ADD CONSTRAINT "executive_agent_insights_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.executive_agent_runs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'executive_agent_insights_run_fk') THEN
		ALTER TABLE "executive_agent_insights" ADD CONSTRAINT "executive_agent_insights_run_fk" FOREIGN KEY ("run_id") REFERENCES "executive_agent_runs"("id") ON DELETE CASCADE NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_integrations_org_fk') THEN
		ALTER TABLE "platform_integration_connections" ADD CONSTRAINT "platform_integrations_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'platform_cost_rollups_org_fk') THEN
		ALTER TABLE "platform_cost_rollups" ADD CONSTRAINT "platform_cost_rollups_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commerce_quotes_org_fk') THEN
		ALTER TABLE "commerce_quotes" ADD CONSTRAINT "commerce_quotes_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'commerce_invoices_org_fk') THEN
		ALTER TABLE "commerce_invoices" ADD CONSTRAINT "commerce_invoices_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'zonga_revenue_events_org_fk') THEN
		ALTER TABLE "zonga_revenue_events" ADD CONSTRAINT "zonga_revenue_events_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_years_org_fk') THEN
		ALTER TABLE "tax_years" ADD CONSTRAINT "tax_years_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_filings_org_fk') THEN
		ALTER TABLE "tax_filings" ADD CONSTRAINT "tax_filings_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.tax_years') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_filings_tax_year_fk') THEN
		ALTER TABLE "tax_filings" ADD CONSTRAINT "tax_filings_tax_year_fk" FOREIGN KEY ("tax_year_id") REFERENCES "tax_years"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.orgs') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_installments_org_fk') THEN
		ALTER TABLE "tax_installments" ADD CONSTRAINT "tax_installments_org_fk" FOREIGN KEY ("org_id") REFERENCES "orgs"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

DO $$ BEGIN
	IF to_regclass('public.tax_years') IS NOT NULL AND NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'tax_installments_tax_year_fk') THEN
		ALTER TABLE "tax_installments" ADD CONSTRAINT "tax_installments_tax_year_fk" FOREIGN KEY ("tax_year_id") REFERENCES "tax_years"("id") NOT VALID;
	END IF;
EXCEPTION
	WHEN undefined_table THEN NULL;
END $$;

