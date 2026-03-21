-- Zonga Subscription Infrastructure Migration
-- Adds plan/subscription columns to zonga_listeners and zonga_creators tables
-- Run against: nzila_automation database

BEGIN;

-- ── New Enum Types ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE zonga_listener_plan AS ENUM ('free', 'premium');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE zonga_subscription_status AS ENUM ('active', 'past_due', 'canceled', 'trialing', 'incomplete');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE zonga_creator_plan AS ENUM ('artist', 'label', 'enterprise');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Listener Subscription Columns ──────────────────────────────────────────

ALTER TABLE zonga_listeners
  ADD COLUMN IF NOT EXISTS plan zonga_listener_plan NOT NULL DEFAULT 'free',
  ADD COLUMN IF NOT EXISTS subscription_status zonga_subscription_status,
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS current_period_end TIMESTAMPTZ;

-- ── Creator Subscription Columns ───────────────────────────────────────────

ALTER TABLE zonga_creators
  ADD COLUMN IF NOT EXISTS plan zonga_creator_plan NOT NULL DEFAULT 'artist',
  ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT,
  ADD COLUMN IF NOT EXISTS stripe_subscription_id TEXT,
  ADD COLUMN IF NOT EXISTS subscription_status zonga_subscription_status;

-- ── Indexes for Stripe lookups ─────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_zonga_listeners_stripe_sub
  ON zonga_listeners (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_zonga_creators_stripe_sub
  ON zonga_creators (stripe_subscription_id)
  WHERE stripe_subscription_id IS NOT NULL;

COMMIT;
