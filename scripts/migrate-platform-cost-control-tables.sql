-- Idempotent migration for missing platform cost/control tables.
-- Source of truth: packages/db/src/schema/platform.ts

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS idempotency_cache (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cache_key varchar(768) NOT NULL,
  payload_hash varchar(128) NOT NULL,
  status integer NOT NULL,
  body text NOT NULL,
  headers jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idempotency_cache_key_idx
  ON idempotency_cache (cache_key);

CREATE INDEX IF NOT EXISTS idempotency_cache_expires_idx
  ON idempotency_cache (expires_at);

CREATE TABLE IF NOT EXISTS platform_cost_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  app_id varchar(128) NOT NULL,
  category varchar(64) NOT NULL,
  units real NOT NULL,
  est_cost_usd real NOT NULL,
  correlation_id uuid,
  route varchar(512),
  metadata jsonb DEFAULT '{}'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cost_events_org_idx
  ON platform_cost_events (org_id);

CREATE INDEX IF NOT EXISTS cost_events_org_date_idx
  ON platform_cost_events (org_id, recorded_at);

CREATE INDEX IF NOT EXISTS cost_events_category_idx
  ON platform_cost_events (org_id, category);

CREATE TABLE IF NOT EXISTS platform_cost_rollups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  app_id varchar(128) NOT NULL,
  category varchar(64) NOT NULL,
  day varchar(10) NOT NULL,
  total_units real NOT NULL,
  total_est_cost_usd real NOT NULL,
  event_count integer NOT NULL,
  rolled_up_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS cost_rollup_org_app_cat_day_idx
  ON platform_cost_rollups (org_id, app_id, category, day);

CREATE INDEX IF NOT EXISTS cost_rollup_org_day_idx
  ON platform_cost_rollups (org_id, day);

CREATE TABLE IF NOT EXISTS platform_cost_budget_breaches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  state varchar(32) NOT NULL,
  daily_spend_usd real NOT NULL,
  monthly_spend_usd real NOT NULL,
  category_breaches jsonb NOT NULL DEFAULT '[]'::jsonb,
  recorded_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS cost_breach_org_idx
  ON platform_cost_budget_breaches (org_id);

CREATE INDEX IF NOT EXISTS cost_breach_org_date_idx
  ON platform_cost_budget_breaches (org_id, recorded_at);

CREATE TABLE IF NOT EXISTS platform_rate_limit_throttles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id uuid NOT NULL REFERENCES orgs(id),
  route_group varchar(128) NOT NULL,
  request_count integer NOT NULL,
  limit_max integer NOT NULL,
  window_ms integer NOT NULL,
  throttled_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS rate_throttle_org_idx
  ON platform_rate_limit_throttles (org_id);

CREATE INDEX IF NOT EXISTS rate_throttle_org_date_idx
  ON platform_rate_limit_throttles (org_id, throttled_at);

CREATE TABLE IF NOT EXISTS platform_deployment_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile varchar(32) NOT NULL,
  environment varchar(32) NOT NULL,
  validations jsonb NOT NULL DEFAULT '{}'::jsonb,
  egress_allowlist jsonb NOT NULL DEFAULT '[]'::jsonb,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb,
  validated_at timestamptz NOT NULL DEFAULT now()
);