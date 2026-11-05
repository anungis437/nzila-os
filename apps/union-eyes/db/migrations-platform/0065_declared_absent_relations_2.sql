-- Platform migration declared-absent-relations-2
--
-- Creates 14 relations that their Drizzle declarations name and the storage-authority manifest already classifies, but that
-- neither Django nor an earlier platform migration creates: usage_aggregates, usage_events, usage_meters, dunning_cases, dunning_policies, dunning_steps, fee_settlement_lines, pricing_discount_rules, pricing_regional_deployments, pricing_template_modules, pricing_templates, audit_security.failed_login_attempts, audit_security.rate_limit_events, user_management.oauth_providers.
-- Generated, not hand-written: scripts/generate-relation-create.ts --tables=usage_aggregates,usage_events,usage_meters,dunning_cases,dunning_policies,dunning_steps,fee_settlement_lines,pricing_discount_rules,pricing_regional_deployments,pricing_template_modules,pricing_templates,audit_security.failed_login_attempts,audit_security.rate_limit_events,user_management.oauth_providers --label=declared-absent-relations-2
-- from the declarations in db/schema, with the DDL produced by drizzle-kit.


DO $ue_create$
DECLARE
  present text[];
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: public.organizations does not exist (a foreign key target).';
  END IF;
  IF to_regnamespace('audit_security') IS NULL OR to_regnamespace('user_management') IS NULL THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: a schema these relations belong to does not exist.';
  END IF;
  SELECT array_agg(t ORDER BY t) INTO present FROM unnest(ARRAY['usage_aggregates', 'usage_events', 'usage_meters', 'dunning_cases', 'dunning_policies', 'dunning_steps', 'fee_settlement_lines', 'pricing_discount_rules', 'pricing_regional_deployments', 'pricing_template_modules', 'pricing_templates', 'audit_security.failed_login_attempts', 'audit_security.rate_limit_events', 'user_management.oauth_providers']) AS t
   WHERE to_regclass(CASE WHEN position('.' IN t) > 0 THEN t ELSE 'public.' || t END) IS NOT NULL;
  IF present IS NOT NULL THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: relations already exist and are not replaced: %', present;
  END IF;
END $ue_create$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.billing_cadence') IS NULL THEN
    CREATE TYPE public.billing_cadence AS ENUM ('monthly', 'quarterly', 'annual');
    COMMENT ON TYPE public.billing_cadence IS 'platform-migration:declared-absent-relations-2';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.billing_cadence')) IS DISTINCT FROM ARRAY['monthly', 'quarterly', 'annual']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: enum type billing_cadence exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.discount_type') IS NULL THEN
    CREATE TYPE public.discount_type AS ENUM ('volume', 'contract_term', 'early_adopter', 'partner_referral', 'custom');
    COMMENT ON TYPE public.discount_type IS 'platform-migration:declared-absent-relations-2';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.discount_type')) IS DISTINCT FROM ARRAY['volume', 'contract_term', 'early_adopter', 'partner_referral', 'custom']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: enum type discount_type exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.dunning_case_status') IS NULL THEN
    CREATE TYPE public.dunning_case_status AS ENUM ('open', 'retrying', 'escalated', 'resolved', 'cancelled', 'terminal');
    COMMENT ON TYPE public.dunning_case_status IS 'platform-migration:declared-absent-relations-2';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.dunning_case_status')) IS DISTINCT FROM ARRAY['open', 'retrying', 'escalated', 'resolved', 'cancelled', 'terminal']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: enum type dunning_case_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.dunning_step_action') IS NULL THEN
    CREATE TYPE public.dunning_step_action AS ENUM ('retry_payment', 'send_email', 'send_sms', 'downgrade_plan', 'pause_subscription', 'cancel_subscription', 'notify_admin', 'custom_webhook');
    COMMENT ON TYPE public.dunning_step_action IS 'platform-migration:declared-absent-relations-2';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.dunning_step_action')) IS DISTINCT FROM ARRAY['retry_payment', 'send_email', 'send_sms', 'downgrade_plan', 'pause_subscription', 'cancel_subscription', 'notify_admin', 'custom_webhook']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: enum type dunning_step_action exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.gtm_tier') IS NULL THEN
    CREATE TYPE public.gtm_tier AS ENUM ('starter', 'professional', 'premium', 'enterprise');
    COMMENT ON TYPE public.gtm_tier IS 'platform-migration:declared-absent-relations-2';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.gtm_tier')) IS DISTINCT FROM ARRAY['starter', 'professional', 'premium', 'enterprise']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: enum type gtm_tier exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.pricing_template_status') IS NULL THEN
    CREATE TYPE public.pricing_template_status AS ENUM ('active', 'inactive', 'archived');
    COMMENT ON TYPE public.pricing_template_status IS 'platform-migration:declared-absent-relations-2';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.pricing_template_status')) IS DISTINCT FROM ARRAY['active', 'inactive', 'archived']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: enum type pricing_template_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.template_tier') IS NULL THEN
    CREATE TYPE public.template_tier AS ENUM ('pilot', 'shared_rollout', 'full_deployment', 'mid_sized_union', 'membership_association', 'custom');
    COMMENT ON TYPE public.template_tier IS 'platform-migration:declared-absent-relations-2';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.template_tier')) IS DISTINCT FROM ARRAY['pilot', 'shared_rollout', 'full_deployment', 'mid_sized_union', 'membership_association', 'custom']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: enum type template_tier exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.usage_aggregate_status') IS NULL THEN
    CREATE TYPE public.usage_aggregate_status AS ENUM ('open', 'closed', 'invoiced');
    COMMENT ON TYPE public.usage_aggregate_status IS 'platform-migration:declared-absent-relations-2';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.usage_aggregate_status')) IS DISTINCT FROM ARRAY['open', 'closed', 'invoiced']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: enum type usage_aggregate_status exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
DO $ue_enum$
BEGIN
  IF to_regtype('public.usage_meter_type') IS NULL THEN
    CREATE TYPE public.usage_meter_type AS ENUM ('counter', 'gauge', 'cumulative');
    COMMENT ON TYPE public.usage_meter_type IS 'platform-migration:declared-absent-relations-2';
  ELSIF (SELECT array_agg(enumlabel::text ORDER BY enumsortorder) FROM pg_enum WHERE enumtypid = to_regtype('public.usage_meter_type')) IS DISTINCT FROM ARRAY['counter', 'gauge', 'cumulative']::text[] THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 fail-closed: enum type usage_meter_type exists with members other than the declared ones.';
  END IF;
END $ue_enum$;
--> statement-breakpoint
CREATE TABLE public."usage_aggregates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"total_quantity" numeric(14, 4) DEFAULT '0' NOT NULL,
	"included_quantity" integer DEFAULT 0 NOT NULL,
	"billable_quantity" numeric(14, 4) DEFAULT '0' NOT NULL,
	"unit_price" numeric(12, 6) NOT NULL,
	"total_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "usage_aggregate_status" DEFAULT 'open' NOT NULL,
	"invoice_line_item_id" uuid,
	"closed_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."usage_aggregates" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."usage_aggregates" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."usage_aggregates" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."usage_aggregates" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."usage_events" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"meter_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"user_id" varchar(255),
	"quantity" numeric(14, 4) NOT NULL,
	"event_time" timestamp with time zone DEFAULT now() NOT NULL,
	"idempotency_key" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."usage_events" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."usage_events" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."usage_events" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."usage_events" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."usage_meters" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"meter_type" "usage_meter_type" NOT NULL,
	"unit" varchar(30) NOT NULL,
	"price_per_unit" numeric(12, 6),
	"included_quantity" integer DEFAULT 0,
	"is_active" boolean DEFAULT true NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "usage_meters_code_unique" UNIQUE("code")
);
--> statement-breakpoint
COMMENT ON TABLE public."usage_meters" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."usage_meters" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."usage_meters" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."usage_meters" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."dunning_cases" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"subscription_id" uuid NOT NULL,
	"policy_id" uuid NOT NULL,
	"status" "dunning_case_status" DEFAULT 'open' NOT NULL,
	"current_step_order" integer DEFAULT 0 NOT NULL,
	"retry_count" integer DEFAULT 0 NOT NULL,
	"last_retry_at" timestamp with time zone,
	"next_retry_at" timestamp with time zone,
	"resolved_at" timestamp with time zone,
	"resolved_by" varchar(255),
	"resolve_reason" text,
	"external_payment_id" varchar(255),
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."dunning_cases" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."dunning_cases" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."dunning_cases" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."dunning_cases" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."dunning_policies" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_default" boolean DEFAULT false NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"max_retries" integer DEFAULT 4 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."dunning_policies" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."dunning_policies" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."dunning_policies" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."dunning_policies" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."dunning_steps" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"policy_id" uuid NOT NULL,
	"step_order" integer NOT NULL,
	"delay_days" integer NOT NULL,
	"action" "dunning_step_action" NOT NULL,
	"action_config" jsonb,
	"description" varchar(500),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."dunning_steps" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."dunning_steps" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."dunning_steps" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."dunning_steps" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."fee_settlement_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"batch_id" uuid NOT NULL,
	"fee_event_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"gross_amount_cad" numeric(14, 2) NOT NULL,
	"fee_amount_cad" numeric(14, 2) NOT NULL,
	"net_amount_cad" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."fee_settlement_lines" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."fee_settlement_lines" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."fee_settlement_lines" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."fee_settlement_lines" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."pricing_discount_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"discount_type" "discount_type" NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"rate_percent" numeric(5, 2) NOT NULL,
	"applies_to" varchar(50) DEFAULT 'per_member' NOT NULL,
	"member_threshold" integer,
	"contract_term_min_months" integer,
	"priority" integer DEFAULT 0 NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone,
	"effective_to" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."pricing_discount_rules" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."pricing_discount_rules" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."pricing_discount_rules" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."pricing_discount_rules" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."pricing_regional_deployments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"region_code" varchar(10) NOT NULL,
	"region_name" varchar(255) NOT NULL,
	"estimated_locals" integer DEFAULT 0,
	"implementation_fee_cad" numeric(14, 2) NOT NULL,
	"annual_support_fee_cad" numeric(14, 2) NOT NULL,
	"annual_hosting_add_on_cad" numeric(14, 2) DEFAULT '0.00',
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "pricing_regional_deployments_unique" UNIQUE("template_id","region_code")
);
--> statement-breakpoint
COMMENT ON TABLE public."pricing_regional_deployments" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."pricing_regional_deployments" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."pricing_regional_deployments" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."pricing_regional_deployments" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."pricing_template_modules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"template_id" uuid NOT NULL,
	"module_key" varchar(100) NOT NULL,
	"module_name" varchar(255) NOT NULL,
	"included" boolean DEFAULT false NOT NULL,
	"additional_fee_cad" numeric(14, 2) DEFAULT '0.00',
	"usage_limit" integer,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
COMMENT ON TABLE public."pricing_template_modules" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."pricing_template_modules" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."pricing_template_modules" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."pricing_template_modules" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE public."pricing_templates" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"tier" "template_tier" NOT NULL,
	"status" "pricing_template_status" DEFAULT 'active' NOT NULL,
	"gtm_tier" "gtm_tier",
	"per_member_fee_cad" numeric(14, 4) DEFAULT '0.0000',
	"member_band_min" integer,
	"member_band_max" integer,
	"annual_escalator_percent" numeric(5, 2) DEFAULT '0.00',
	"implementation_fee_per_region_cad" numeric(14, 2) DEFAULT '0.00',
	"variable_cost_per_member_cad" numeric(14, 4) DEFAULT '0.0000',
	"base_platform_fee_cad" numeric(14, 2) NOT NULL,
	"per_local_fee_cad" numeric(14, 2) DEFAULT '0.00',
	"per_division_fee_cad" numeric(14, 2) DEFAULT '0.00',
	"per_admin_seat_fee_cad" numeric(14, 2) DEFAULT '0.00',
	"per_module_fee_cad" numeric(14, 2) DEFAULT '0.00',
	"transaction_fee_rate" numeric(8, 6) DEFAULT '0.000000',
	"transaction_flat_fee_cad" numeric(14, 2) DEFAULT '0.00',
	"onboarding_fee_cad" numeric(14, 2) DEFAULT '0.00',
	"support_fee_cad" numeric(14, 2) DEFAULT '0.00',
	"discount_percent" numeric(5, 2) DEFAULT '0.00',
	"subsidy_cad" numeric(14, 2) DEFAULT '0.00',
	"billing_cadence" "billing_cadence" DEFAULT 'monthly' NOT NULL,
	"max_covered_locals" integer,
	"max_covered_divisions" integer,
	"included_modules" integer DEFAULT 0,
	"trial_days" integer DEFAULT 0,
	"contract_term_months" integer DEFAULT 12,
	"fee_waiver_active" boolean DEFAULT false NOT NULL,
	"allocation_enabled" boolean DEFAULT false NOT NULL,
	"pilot_mode" boolean DEFAULT false NOT NULL,
	"features_included" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "pricing_templates_code_unique" UNIQUE("code")
);
--> statement-breakpoint
COMMENT ON TABLE public."pricing_templates" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE public."pricing_templates" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE public."pricing_templates" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE public."pricing_templates" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE "audit_security"."failed_login_attempts" (
	"attempt_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"email" varchar(255) NOT NULL,
	"ip_address" varchar(45) NOT NULL,
	"user_agent" text,
	"failure_reason" varchar(100) NOT NULL,
	"attempted_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE audit_security."failed_login_attempts" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE audit_security."failed_login_attempts" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE audit_security."failed_login_attempts" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE audit_security."failed_login_attempts" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE "audit_security"."rate_limit_events" (
	"event_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"identifier" varchar(255) NOT NULL,
	"identifier_type" varchar(20) NOT NULL,
	"endpoint" varchar(255) NOT NULL,
	"request_count" integer NOT NULL,
	"limit_exceeded" boolean DEFAULT false,
	"window_start" timestamp with time zone NOT NULL,
	"window_end" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now(),
	CONSTRAINT "valid_identifier_type" CHECK ("audit_security"."rate_limit_events"."identifier_type" IN ('ip', 'user', 'api_key'))
);
--> statement-breakpoint
COMMENT ON TABLE audit_security."rate_limit_events" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE audit_security."rate_limit_events" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE audit_security."rate_limit_events" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE audit_security."rate_limit_events" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
CREATE TABLE "user_management"."oauth_providers" (
	"provider_id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" varchar(255) NOT NULL,
	"provider_name" varchar(50) NOT NULL,
	"provider_user_id" varchar(255) NOT NULL,
	"provider_data" jsonb DEFAULT '{}'::jsonb,
	"access_token" text,
	"refresh_token" text,
	"token_expires_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now(),
	"updated_at" timestamp with time zone DEFAULT now()
);
--> statement-breakpoint
COMMENT ON TABLE user_management."oauth_providers" IS 'platform-migration:declared-absent-relations-2';
--> statement-breakpoint
REVOKE ALL ON TABLE user_management."oauth_providers" FROM PUBLIC;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_runtime') IS NOT NULL THEN REVOKE ALL ON TABLE user_management."oauth_providers" FROM union_eyes_runtime; END IF; END $$;
--> statement-breakpoint
DO $$ BEGIN IF to_regrole('union_eyes_system') IS NOT NULL THEN REVOKE ALL ON TABLE user_management."oauth_providers" FROM union_eyes_system; END IF; END $$;
--> statement-breakpoint
ALTER TABLE public."usage_aggregates" ADD CONSTRAINT "usage_aggregates_meter_id_usage_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."usage_meters"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."usage_aggregates" ADD CONSTRAINT "usage_aggregates_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."usage_aggregates" ADD CONSTRAINT "usage_aggregates_billing_period_id_billing_periods_id_fk" FOREIGN KEY ("billing_period_id") REFERENCES "public"."billing_periods"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."usage_events" ADD CONSTRAINT "usage_events_meter_id_usage_meters_id_fk" FOREIGN KEY ("meter_id") REFERENCES "public"."usage_meters"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."usage_events" ADD CONSTRAINT "usage_events_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."dunning_cases" ADD CONSTRAINT "dunning_cases_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."dunning_cases" ADD CONSTRAINT "dunning_cases_subscription_id_org_subscriptions_id_fk" FOREIGN KEY ("subscription_id") REFERENCES "public"."org_subscriptions"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."dunning_cases" ADD CONSTRAINT "dunning_cases_policy_id_dunning_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."dunning_policies"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."dunning_steps" ADD CONSTRAINT "dunning_steps_policy_id_dunning_policies_id_fk" FOREIGN KEY ("policy_id") REFERENCES "public"."dunning_policies"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."fee_settlement_lines" ADD CONSTRAINT "fee_settlement_lines_batch_id_fee_settlement_batches_id_fk" FOREIGN KEY ("batch_id") REFERENCES "public"."fee_settlement_batches"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."fee_settlement_lines" ADD CONSTRAINT "fee_settlement_lines_fee_event_id_transaction_fee_events_id_fk" FOREIGN KEY ("fee_event_id") REFERENCES "public"."transaction_fee_events"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."fee_settlement_lines" ADD CONSTRAINT "fee_settlement_lines_organization_id_organizations_id_fk" FOREIGN KEY ("organization_id") REFERENCES "public"."organizations"("id") ON DELETE restrict ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."pricing_discount_rules" ADD CONSTRAINT "pricing_discount_rules_template_id_pricing_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."pricing_templates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."pricing_regional_deployments" ADD CONSTRAINT "pricing_regional_deployments_template_id_pricing_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."pricing_templates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE public."pricing_template_modules" ADD CONSTRAINT "pricing_template_modules_template_id_pricing_templates_id_fk" FOREIGN KEY ("template_id") REFERENCES "public"."pricing_templates"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "user_management"."oauth_providers" ADD CONSTRAINT "oauth_providers_user_id_users_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "user_management"."users"("user_id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX "usage_aggregates_meter_org_period_idx" ON public."usage_aggregates" USING btree ("meter_id","organization_id","billing_period_id");
--> statement-breakpoint
CREATE INDEX "usage_aggregates_status_idx" ON public."usage_aggregates" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "usage_events_meter_org_idx" ON public."usage_events" USING btree ("meter_id","organization_id");
--> statement-breakpoint
CREATE INDEX "usage_events_event_time_idx" ON public."usage_events" USING btree ("event_time");
--> statement-breakpoint
CREATE UNIQUE INDEX "usage_events_idempotency_idx" ON public."usage_events" USING btree ("idempotency_key");
--> statement-breakpoint
CREATE INDEX "dunning_cases_org_idx" ON public."dunning_cases" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "dunning_cases_sub_idx" ON public."dunning_cases" USING btree ("subscription_id");
--> statement-breakpoint
CREATE INDEX "dunning_cases_status_idx" ON public."dunning_cases" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "dunning_cases_next_retry_idx" ON public."dunning_cases" USING btree ("next_retry_at");
--> statement-breakpoint
CREATE UNIQUE INDEX "dunning_steps_policy_order_idx" ON public."dunning_steps" USING btree ("policy_id","step_order");
--> statement-breakpoint
CREATE INDEX "fee_settlement_lines_batch_idx" ON public."fee_settlement_lines" USING btree ("batch_id");
--> statement-breakpoint
CREATE INDEX "fee_settlement_lines_event_idx" ON public."fee_settlement_lines" USING btree ("fee_event_id");
--> statement-breakpoint
CREATE INDEX "fee_settlement_lines_org_idx" ON public."fee_settlement_lines" USING btree ("organization_id");
--> statement-breakpoint
CREATE INDEX "pricing_discount_rules_template_idx" ON public."pricing_discount_rules" USING btree ("template_id");
--> statement-breakpoint
CREATE INDEX "pricing_discount_rules_type_idx" ON public."pricing_discount_rules" USING btree ("discount_type");
--> statement-breakpoint
CREATE INDEX "pricing_regional_deployments_template_idx" ON public."pricing_regional_deployments" USING btree ("template_id");
--> statement-breakpoint
CREATE INDEX "pricing_regional_deployments_region_idx" ON public."pricing_regional_deployments" USING btree ("region_code");
--> statement-breakpoint
CREATE INDEX "pricing_template_modules_template_idx" ON public."pricing_template_modules" USING btree ("template_id");
--> statement-breakpoint
CREATE INDEX "pricing_template_modules_module_idx" ON public."pricing_template_modules" USING btree ("module_key");
--> statement-breakpoint
CREATE INDEX "pricing_templates_tier_idx" ON public."pricing_templates" USING btree ("tier");
--> statement-breakpoint
CREATE INDEX "pricing_templates_status_idx" ON public."pricing_templates" USING btree ("status");
--> statement-breakpoint
CREATE INDEX "pricing_templates_gtm_tier_idx" ON public."pricing_templates" USING btree ("gtm_tier");
--> statement-breakpoint
DO $ue_post$
DECLARE
  wrong text[];
BEGIN
  SELECT array_agg(e.s || '.' || e.t ORDER BY e.s, e.t) INTO wrong
  FROM (VALUES ('public', 'usage_aggregates', 16), ('public', 'usage_events', 9), ('public', 'usage_meters', 12), ('public', 'dunning_cases', 16), ('public', 'dunning_policies', 9), ('public', 'dunning_steps', 8), ('public', 'fee_settlement_lines', 8), ('public', 'pricing_discount_rules', 15), ('public', 'pricing_regional_deployments', 10), ('public', 'pricing_template_modules', 9), ('public', 'pricing_templates', 38), ('audit_security', 'failed_login_attempts', 6), ('audit_security', 'rate_limit_events', 9), ('user_management', 'oauth_providers', 10)) AS e(s, t, n)
  WHERE (SELECT count(*) FROM information_schema.columns c WHERE c.table_schema = e.s AND c.table_name = e.t) <> e.n
     OR obj_description(to_regclass(quote_ident(e.s) || '.' || quote_ident(e.t)), 'pg_class') IS DISTINCT FROM 'platform-migration:declared-absent-relations-2';
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 postflight: relations without the declared column count or tag: %', wrong;
  END IF;
  SELECT array_agg(e.s || '.' || e.t ORDER BY e.s, e.t) INTO wrong
  FROM (VALUES ('public', 'usage_aggregates', 16), ('public', 'usage_events', 9), ('public', 'usage_meters', 12), ('public', 'dunning_cases', 16), ('public', 'dunning_policies', 9), ('public', 'dunning_steps', 8), ('public', 'fee_settlement_lines', 8), ('public', 'pricing_discount_rules', 15), ('public', 'pricing_regional_deployments', 10), ('public', 'pricing_template_modules', 9), ('public', 'pricing_templates', 38), ('audit_security', 'failed_login_attempts', 6), ('audit_security', 'rate_limit_events', 9), ('user_management', 'oauth_providers', 10)) AS e(s, t, n)
  WHERE (to_regrole('union_eyes_runtime') IS NOT NULL AND (has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'SELECT') OR has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'INSERT')
        OR has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'UPDATE') OR has_table_privilege('union_eyes_runtime', quote_ident(e.s) || '.' || quote_ident(e.t), 'DELETE')))
     OR (to_regrole('union_eyes_system') IS NOT NULL AND (has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'SELECT') OR has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'INSERT')
        OR has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'UPDATE') OR has_table_privilege('union_eyes_system', quote_ident(e.s) || '.' || quote_ident(e.t), 'DELETE')));
  IF wrong IS NOT NULL THEN
    RAISE EXCEPTION 'platform declared-absent-relations-2 postflight: relations already carry runtime or system privileges before the manifest grants them: %', wrong;
  END IF;
END $ue_post$;
