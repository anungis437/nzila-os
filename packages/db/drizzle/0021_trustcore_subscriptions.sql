-- Migration 0021: TrustCore subscriptions table
-- Adds billing / plan / feature-gating records per org.

-- Enums
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tc_subscription_plan') THEN
    CREATE TYPE "tc_subscription_plan" AS ENUM ('free', 'pro', 'premium');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'tc_subscription_status') THEN
    CREATE TYPE "tc_subscription_status" AS ENUM ('active', 'trialing', 'past_due', 'canceled');
  END IF;
END$$;

-- Table
CREATE TABLE IF NOT EXISTS "trustcore_subscriptions" (
  "id"                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "org_id"                 UUID NOT NULL REFERENCES "orgs"("id"),
  "plan"                   "tc_subscription_plan" NOT NULL DEFAULT 'free',
  "status"                 "tc_subscription_status" NOT NULL DEFAULT 'active',
  "current_period_start"   TIMESTAMPTZ,
  "current_period_end"     TIMESTAMPTZ,
  "stripe_customer_id"     TEXT,
  "stripe_subscription_id" TEXT,
  "created_at"             TIMESTAMPTZ NOT NULL DEFAULT now(),
  "updated_at"             TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS "tc_subscriptions_org_idx"    ON "trustcore_subscriptions" ("org_id");
CREATE INDEX IF NOT EXISTS "tc_subscriptions_status_idx" ON "trustcore_subscriptions" ("status");
