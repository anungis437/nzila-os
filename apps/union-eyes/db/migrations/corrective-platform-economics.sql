-- Corrective migration: Platform Economics tables
-- Generated from Drizzle schema audit on 2026-03-25
-- Creates 13 enums and 16 tables missing from the database

CREATE TYPE "public"."allocation_method" AS ENUM('per_member_count', 'per_active_user', 'per_case_volume', 'per_local_flat', 'weighted_hybrid', 'manual_override', 'subsidized');

--> statement-breakpoint
CREATE TYPE "public"."allocation_run_status" AS ENUM('draft', 'simulated', 'pending_approval', 'approved', 'posted', 'reversed', 'failed');

--> statement-breakpoint
CREATE TYPE "public"."allocation_status" AS ENUM('unallocated', 'pending', 'allocated', 'partially_allocated', 'reversed');

--> statement-breakpoint
CREATE TYPE "public"."billing_account_status" AS ENUM('active', 'suspended', 'closed', 'pending');

--> statement-breakpoint
CREATE TYPE "public"."billing_adjustment_type" AS ENUM('credit', 'debit', 'write_off', 'subsidy', 'discount', 'refund');

--> statement-breakpoint
CREATE TYPE "public"."ledger_event_type" AS ENUM('invoice_generated', 'payment_received', 'allocation_run', 'adjustment_posted', 'credit_applied', 'subsidy_applied', 'writeoff_posted', 'period_closed', 'reversal');

--> statement-breakpoint
CREATE TYPE "public"."ledger_source_type" AS ENUM('subscription', 'invoice', 'payment', 'adjustment', 'allocation', 'manual', 'system');

--> statement-breakpoint
CREATE TYPE "public"."platform_cost_type" AS ENUM('base_subscription', 'local_fee', 'seat_fee', 'module_fee', 'usage_fee', 'onboarding_fee', 'support_fee', 'adjustment', 'credit', 'subsidy', 'writeoff');

--> statement-breakpoint
CREATE TYPE "public"."platform_invoice_status" AS ENUM('draft', 'issued', 'paid', 'partially_paid', 'overdue', 'void', 'written_off');

--> statement-breakpoint
CREATE TYPE "public"."platform_payment_status" AS ENUM('pending', 'processing', 'completed', 'failed', 'refunded');

--> statement-breakpoint
CREATE TYPE "public"."pricing_model" AS ENUM('flat', 'per_local', 'per_seat', 'per_module', 'tiered', 'hybrid');

--> statement-breakpoint
CREATE TYPE "public"."subscription_status" AS ENUM('active', 'trialing', 'past_due', 'cancelled', 'paused');

--> statement-breakpoint
CREATE TYPE "public"."chargeback_status" AS ENUM('draft', 'issued', 'acknowledged', 'disputed', 'resolved');

--> statement-breakpoint


CREATE TABLE "billing_accounts" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"billing_email" varchar(320) NOT NULL,
	"billing_contact_name" varchar(255),
	"billing_phone" varchar(30),
	"billing_address" jsonb,
	"tax_id" varchar(50),
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "billing_account_status" DEFAULT 'active' NOT NULL,
	"net_terms_days" integer DEFAULT 30 NOT NULL,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "billing_accounts_organization_id_unique" UNIQUE("organization_id")
);

--> statement-breakpoint
CREATE TABLE "platform_invoices" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"billing_period_id" uuid,
	"invoice_number" varchar(50) NOT NULL,
	"issue_date" timestamp with time zone NOT NULL,
	"due_date" timestamp with time zone NOT NULL,
	"subtotal" numeric(14, 2) NOT NULL,
	"tax_amount" numeric(14, 2) DEFAULT '0' NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"amount_paid" numeric(14, 2) DEFAULT '0' NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "platform_invoice_status" DEFAULT 'draft' NOT NULL,
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	CONSTRAINT "platform_invoices_invoice_number_unique" UNIQUE("invoice_number")
);

--> statement-breakpoint
CREATE TABLE "platform_invoice_line_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"cost_type" varchar(50) NOT NULL,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"ledger_entry_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "platform_payments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" "platform_payment_status" DEFAULT 'pending' NOT NULL,
	"method" varchar(50) NOT NULL,
	"external_reference" varchar(255),
	"paid_at" timestamp with time zone,
	"failure_reason" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);

--> statement-breakpoint
CREATE TABLE "payment_allocations" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"payment_id" uuid NOT NULL,
	"invoice_id" uuid NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);

--> statement-breakpoint
CREATE TABLE "org_subscriptions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"plan_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"status" "subscription_status" DEFAULT 'active' NOT NULL,
	"start_date" timestamp with time zone NOT NULL,
	"end_date" timestamp with time zone,
	"trial_end_date" timestamp with time zone,
	"local_count" integer DEFAULT 0,
	"seat_count" integer DEFAULT 0,
	"module_list" jsonb DEFAULT '[]'::jsonb,
	"discount_percent" numeric(5, 2) DEFAULT '0',
	"subsidy_amount" numeric(12, 2) DEFAULT '0',
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);

--> statement-breakpoint
CREATE TABLE "billing_periods" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"period_start" timestamp with time zone NOT NULL,
	"period_end" timestamp with time zone NOT NULL,
	"label" varchar(50) NOT NULL,
	"is_closed" boolean DEFAULT false NOT NULL,
	"closed_at" timestamp with time zone,
	"closed_by" varchar(255),
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "billing_adjustments" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"billing_account_id" uuid NOT NULL,
	"organization_id" uuid NOT NULL,
	"invoice_id" uuid,
	"type" "billing_adjustment_type" NOT NULL,
	"amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"reason" text NOT NULL,
	"effective_date" timestamp with time zone NOT NULL,
	"approved_by" varchar(255),
	"ledger_entry_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);

--> statement-breakpoint
CREATE TABLE "subscription_plans" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" varchar(50) NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"pricing_model" "pricing_model" NOT NULL,
	"base_fee" numeric(12, 2) DEFAULT '0' NOT NULL,
	"per_local_fee" numeric(10, 2) DEFAULT '0',
	"per_seat_fee" numeric(10, 2) DEFAULT '0',
	"per_module_fee" numeric(10, 2) DEFAULT '0',
	"onboarding_fee" numeric(10, 2) DEFAULT '0',
	"support_fee" numeric(10, 2) DEFAULT '0',
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"billing_interval" varchar(20) DEFAULT 'monthly' NOT NULL,
	"is_active" boolean DEFAULT true NOT NULL,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "subscription_plans_code_unique" UNIQUE("code")
);

--> statement-breakpoint
CREATE TABLE "allocation_rules" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"name" varchar(255) NOT NULL,
	"description" text,
	"is_active" boolean DEFAULT true NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);

--> statement-breakpoint
CREATE TABLE "allocation_rule_versions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"rule_id" uuid NOT NULL,
	"version" integer NOT NULL,
	"method" "allocation_method" NOT NULL,
	"weights" jsonb,
	"effective_from" timestamp with time zone NOT NULL,
	"effective_to" timestamp with time zone,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);

--> statement-breakpoint
CREATE TABLE "allocation_runs" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"rule_version_id" uuid NOT NULL,
	"status" "allocation_run_status" DEFAULT 'draft' NOT NULL,
	"is_simulation" boolean DEFAULT false NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"line_count" integer DEFAULT 0 NOT NULL,
	"started_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"approved_by" varchar(255),
	"approved_at" timestamp with time zone,
	"error_message" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);

--> statement-breakpoint
CREATE TABLE "allocation_run_lines" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"local_name" varchar(255),
	"method" "allocation_method" NOT NULL,
	"basis_value" numeric(14, 4) NOT NULL,
	"weight" numeric(5, 2) NOT NULL,
	"allocated_amount" numeric(14, 2) NOT NULL,
	"cost_type" varchar(50) NOT NULL,
	"ledger_entry_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "allocation_basis_snapshots" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"run_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"member_count" integer DEFAULT 0 NOT NULL,
	"active_user_count" integer DEFAULT 0 NOT NULL,
	"case_volume" integer DEFAULT 0 NOT NULL,
	"remittance_summary" numeric(14, 2) DEFAULT '0',
	"metadata" jsonb,
	"snapshot_at" timestamp with time zone DEFAULT now() NOT NULL
);

--> statement-breakpoint
CREATE TABLE "chargeback_statements" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"local_id" uuid NOT NULL,
	"billing_period_id" uuid NOT NULL,
	"allocation_run_id" uuid NOT NULL,
	"total_amount" numeric(14, 2) NOT NULL,
	"currency" varchar(3) DEFAULT 'CAD' NOT NULL,
	"status" chargeback_status DEFAULT 'draft' NOT NULL,
	"issued_at" timestamp with time zone,
	"acknowledged_at" timestamp with time zone,
	"acknowledged_by" varchar(255),
	"notes" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255)
);

--> statement-breakpoint
CREATE TABLE "platform_cost_ledger_entries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"organization_id" uuid NOT NULL,
	"parent_organization_id" uuid,
	"local_id" uuid,
	"employer_id" uuid,
	"region_id" uuid,
	"bargaining_unit_id" uuid,
	"billing_period_id" uuid,
	"cost_type" "platform_cost_type" NOT NULL,
	"event_type" "ledger_event_type" NOT NULL,
	"source_type" "ledger_source_type" NOT NULL,
	"source_id" uuid,
	"quantity" numeric(12, 4) DEFAULT '1' NOT NULL,
	"unit_price_cad" numeric(12, 2) NOT NULL,
	"amount_cad" numeric(14, 2) NOT NULL,
	"cost_center_id" uuid,
	"allocation_status" "allocation_status" DEFAULT 'unallocated' NOT NULL,
	"allocation_run_id" uuid,
	"description" text,
	"metadata" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_by" varchar(255),
	"audit_reference" varchar(255)
);

--> statement-breakpoint

