-- =============================================================================
-- Migration 0085: Monetization Infrastructure Layer (MIL)
--
-- Adds contracts, entitlements, usage metering, dunning & subscription
-- lifecycle tables.  All monetary fields use DECIMAL / NUMERIC.
-- =============================================================================

-- ----- ENUMS ----------------------------------------------------------------

DO $$ BEGIN
  CREATE TYPE commercial_contract_status AS ENUM (
    'draft','pending_approval','active','expired','terminated','superseded'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE contract_line_type AS ENUM (
    'module_license','feature_access','usage_quota','seat_allocation',
    'support_level','sla_commitment','custom'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE org_entitlement_status AS ENUM (
    'active','suspended','expired','revoked'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE usage_meter_type AS ENUM (
    'counter','gauge','cumulative'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE usage_aggregate_status AS ENUM (
    'open','closed','invoiced'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dunning_case_status AS ENUM (
    'open','retrying','escalated','resolved','cancelled','terminal'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE dunning_step_action AS ENUM (
    'retry_payment','send_email','send_sms','downgrade_plan',
    'pause_subscription','cancel_subscription','notify_admin','custom_webhook'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE subscription_lifecycle_event AS ENUM (
    'created','activated','trial_started','trial_ending_soon','trial_expired',
    'trial_converted','upgraded','downgraded','paused','resumed',
    'payment_failed','payment_retried','payment_recovered',
    'dunning_started','dunning_escalated','dunning_resolved',
    'cancelled','expired','reactivated','renewed'
  );
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ----- TABLES: Contracts & Entitlements -------------------------------------

CREATE TABLE IF NOT EXISTS commercial_contracts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  billing_account_id UUID NOT NULL REFERENCES billing_accounts(id) ON DELETE RESTRICT,
  subscription_id UUID REFERENCES org_subscriptions(id) ON DELETE RESTRICT,
  contract_number VARCHAR(50) NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  status          commercial_contract_status NOT NULL DEFAULT 'draft',
  effective_date  TIMESTAMPTZ NOT NULL,
  expiration_date TIMESTAMPTZ NOT NULL,
  auto_renew      BOOLEAN NOT NULL DEFAULT false,
  renewal_term_months INTEGER DEFAULT 12,
  termination_notice_days INTEGER DEFAULT 30,
  total_contract_value DECIMAL(14,2),
  currency        VARCHAR(3) NOT NULL DEFAULT 'CAD',
  signed_by       VARCHAR(255),
  signed_at       TIMESTAMPTZ,
  approved_by     VARCHAR(255),
  approved_at     TIMESTAMPTZ,
  superseded_by_id UUID,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by      VARCHAR(255)
);

CREATE INDEX IF NOT EXISTS commercial_contracts_org_idx ON commercial_contracts(organization_id);
CREATE INDEX IF NOT EXISTS commercial_contracts_billing_idx ON commercial_contracts(billing_account_id);
CREATE INDEX IF NOT EXISTS commercial_contracts_status_idx ON commercial_contracts(status);
CREATE INDEX IF NOT EXISTS commercial_contracts_expiration_idx ON commercial_contracts(expiration_date);

CREATE TABLE IF NOT EXISTS contract_line_items (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  contract_id     UUID NOT NULL REFERENCES commercial_contracts(id) ON DELETE CASCADE,
  line_type       contract_line_type NOT NULL,
  feature_key     VARCHAR(100) NOT NULL,
  description     VARCHAR(500) NOT NULL,
  quantity        INTEGER DEFAULT 1,
  unit_price      DECIMAL(12,2),
  total_price     DECIMAL(14,2),
  usage_limit     INTEGER,
  usage_period    VARCHAR(20),
  sla_target      VARCHAR(100),
  effective_date  TIMESTAMPTZ NOT NULL,
  expiration_date TIMESTAMPTZ,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS contract_line_items_contract_idx ON contract_line_items(contract_id);
CREATE INDEX IF NOT EXISTS contract_line_items_feature_idx ON contract_line_items(feature_key);

CREATE TABLE IF NOT EXISTS org_entitlements (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id       UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  contract_line_item_id UUID REFERENCES contract_line_items(id) ON DELETE SET NULL,
  feature_key           VARCHAR(100) NOT NULL,
  status                org_entitlement_status NOT NULL DEFAULT 'active',
  granted_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at            TIMESTAMPTZ,
  usage_limit           INTEGER,
  usage_period          VARCHAR(20),
  current_usage         INTEGER NOT NULL DEFAULT 0,
  usage_period_start    TIMESTAMPTZ,
  last_reset_at         TIMESTAMPTZ,
  granted_by            VARCHAR(255),
  revoked_by            VARCHAR(255),
  revoked_at            TIMESTAMPTZ,
  revoke_reason         TEXT,
  metadata              JSONB,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS org_entitlements_org_feature_idx ON org_entitlements(organization_id, feature_key);
CREATE INDEX IF NOT EXISTS org_entitlements_status_idx ON org_entitlements(status);
CREATE INDEX IF NOT EXISTS org_entitlements_expires_idx ON org_entitlements(expires_at);

CREATE TABLE IF NOT EXISTS entitlement_usage_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entitlement_id  UUID NOT NULL REFERENCES org_entitlements(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id         VARCHAR(255) NOT NULL,
  feature_key     VARCHAR(100) NOT NULL,
  quantity        INTEGER NOT NULL DEFAULT 1,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS entitlement_usage_log_entitlement_idx ON entitlement_usage_log(entitlement_id);
CREATE INDEX IF NOT EXISTS entitlement_usage_log_org_idx ON entitlement_usage_log(organization_id);
CREATE INDEX IF NOT EXISTS entitlement_usage_log_created_idx ON entitlement_usage_log(created_at);

-- ----- TABLES: Usage Metering -----------------------------------------------

CREATE TABLE IF NOT EXISTS usage_meters (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code            VARCHAR(50) NOT NULL UNIQUE,
  name            VARCHAR(255) NOT NULL,
  description     TEXT,
  meter_type      usage_meter_type NOT NULL,
  unit            VARCHAR(30) NOT NULL,
  price_per_unit  DECIMAL(12,6),
  included_quantity INTEGER DEFAULT 0,
  is_active       BOOLEAN NOT NULL DEFAULT true,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS usage_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id        UUID NOT NULL REFERENCES usage_meters(id) ON DELETE RESTRICT,
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  user_id         VARCHAR(255),
  quantity        DECIMAL(14,4) NOT NULL,
  event_time      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  idempotency_key VARCHAR(255),
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS usage_events_meter_org_idx ON usage_events(meter_id, organization_id);
CREATE INDEX IF NOT EXISTS usage_events_event_time_idx ON usage_events(event_time);
CREATE UNIQUE INDEX IF NOT EXISTS usage_events_idempotency_idx ON usage_events(idempotency_key);

CREATE TABLE IF NOT EXISTS usage_aggregates (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  meter_id          UUID NOT NULL REFERENCES usage_meters(id) ON DELETE RESTRICT,
  organization_id   UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  billing_period_id UUID NOT NULL REFERENCES billing_periods(id) ON DELETE RESTRICT,
  total_quantity    DECIMAL(14,4) NOT NULL DEFAULT 0,
  included_quantity INTEGER NOT NULL DEFAULT 0,
  billable_quantity DECIMAL(14,4) NOT NULL DEFAULT 0,
  unit_price        DECIMAL(12,6) NOT NULL,
  total_amount      DECIMAL(14,2) NOT NULL DEFAULT 0,
  currency          VARCHAR(3) NOT NULL DEFAULT 'CAD',
  status            usage_aggregate_status NOT NULL DEFAULT 'open',
  invoice_line_item_id UUID,
  closed_at         TIMESTAMPTZ,
  metadata          JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS usage_aggregates_meter_org_period_idx
  ON usage_aggregates(meter_id, organization_id, billing_period_id);
CREATE INDEX IF NOT EXISTS usage_aggregates_status_idx ON usage_aggregates(status);

-- ----- TABLES: Dunning & Lifecycle ------------------------------------------

CREATE TABLE IF NOT EXISTS dunning_policies (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        VARCHAR(255) NOT NULL,
  description TEXT,
  is_default  BOOLEAN NOT NULL DEFAULT false,
  is_active   BOOLEAN NOT NULL DEFAULT true,
  max_retries INTEGER NOT NULL DEFAULT 4,
  metadata    JSONB,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS dunning_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  policy_id    UUID NOT NULL REFERENCES dunning_policies(id) ON DELETE CASCADE,
  step_order   INTEGER NOT NULL,
  delay_days   INTEGER NOT NULL,
  action       dunning_step_action NOT NULL,
  action_config JSONB,
  description  VARCHAR(500),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS dunning_steps_policy_order_idx
  ON dunning_steps(policy_id, step_order);

CREATE TABLE IF NOT EXISTS dunning_cases (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id     UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  subscription_id     UUID NOT NULL REFERENCES org_subscriptions(id) ON DELETE RESTRICT,
  policy_id           UUID NOT NULL REFERENCES dunning_policies(id) ON DELETE RESTRICT,
  status              dunning_case_status NOT NULL DEFAULT 'open',
  current_step_order  INTEGER NOT NULL DEFAULT 0,
  retry_count         INTEGER NOT NULL DEFAULT 0,
  last_retry_at       TIMESTAMPTZ,
  next_retry_at       TIMESTAMPTZ,
  resolved_at         TIMESTAMPTZ,
  resolved_by         VARCHAR(255),
  resolve_reason      TEXT,
  external_payment_id VARCHAR(255),
  metadata            JSONB,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS dunning_cases_org_idx ON dunning_cases(organization_id);
CREATE INDEX IF NOT EXISTS dunning_cases_sub_idx ON dunning_cases(subscription_id);
CREATE INDEX IF NOT EXISTS dunning_cases_status_idx ON dunning_cases(status);
CREATE INDEX IF NOT EXISTS dunning_cases_next_retry_idx ON dunning_cases(next_retry_at);

CREATE TABLE IF NOT EXISTS subscription_events_log (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE RESTRICT,
  subscription_id UUID NOT NULL REFERENCES org_subscriptions(id) ON DELETE RESTRICT,
  event_type      subscription_lifecycle_event NOT NULL,
  previous_state  JSONB,
  new_state       JSONB,
  triggered_by    VARCHAR(255),
  reason          TEXT,
  metadata        JSONB,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS sub_events_log_org_idx ON subscription_events_log(organization_id);
CREATE INDEX IF NOT EXISTS sub_events_log_sub_idx ON subscription_events_log(subscription_id);
CREATE INDEX IF NOT EXISTS sub_events_log_event_idx ON subscription_events_log(event_type);
CREATE INDEX IF NOT EXISTS sub_events_log_created_idx ON subscription_events_log(created_at);

-- ----- SEED: Default Dunning Policy -----------------------------------------

INSERT INTO dunning_policies (id, name, description, is_default, is_active, max_retries)
SELECT
  gen_random_uuid(), 'Standard Retry Policy',
  'Default 4-step dunning: retry×3, then pause subscription', true, true, 4
WHERE NOT EXISTS (
  SELECT 1 FROM dunning_policies WHERE is_default = true
);

-- Insert steps only if we just seeded the policy
DO $$
DECLARE
  v_policy_id UUID;
BEGIN
  SELECT id INTO v_policy_id FROM dunning_policies WHERE is_default = true LIMIT 1;
  IF v_policy_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM dunning_steps WHERE policy_id = v_policy_id
  ) THEN
    INSERT INTO dunning_steps (policy_id, step_order, delay_days, action, description) VALUES
      (v_policy_id, 1, 3, 'retry_payment',       'First retry after 3 days'),
      (v_policy_id, 2, 5, 'send_email',          'Payment failure notification email'),
      (v_policy_id, 3, 7, 'retry_payment',       'Second retry after 7 days'),
      (v_policy_id, 4, 10, 'notify_admin',       'Escalate to billing admin'),
      (v_policy_id, 5, 14, 'retry_payment',      'Final retry after 14 days'),
      (v_policy_id, 6, 21, 'pause_subscription', 'Pause subscription after 21 days');
  END IF;
END $$;
