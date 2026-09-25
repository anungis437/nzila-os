-- ============================================================================
-- Post-freeze PLATFORM_SQL SCHEMA_CREATION
-- Root: apps/union-eyes/db/migrations-platform/
-- File: 0001_billing_subscriptions.sql
-- Owner: PLATFORM_SQL_OWNED
-- Companion to frozen DAPL ledger apps/union-eyes/db/migrations/20260325_dapl_platform_ledger.sql
-- Source projection: apps/union-eyes/db/schema/domains/finance/platform-billing.ts
-- Forward-only. Does not modify frozen lineage files.
-- ============================================================================

CREATE TABLE IF NOT EXISTS "billing_subscriptions" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "organization_id" uuid NOT NULL,
  "plan_name" text NOT NULL,
  "plan_tier" text DEFAULT 'standard' NOT NULL,
  "status" text DEFAULT 'active' NOT NULL,
  "amount_cents" bigint DEFAULT 0 NOT NULL,
  "currency" varchar(3) DEFAULT 'CAD' NOT NULL,
  "billing_interval" text DEFAULT 'monthly' NOT NULL,
  "current_period_start" timestamptz,
  "current_period_end" timestamptz,
  "canceled_at" timestamptz,
  "created_at" timestamptz DEFAULT now() NOT NULL,
  "updated_at" timestamptz DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_subscriptions_organization_id_idx" ON "billing_subscriptions" ("organization_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "billing_subscriptions_status_idx" ON "billing_subscriptions" ("status");
