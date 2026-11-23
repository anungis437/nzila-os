-- Migration 0046: SAGE institutional mandate authority and commitment ledger
--
-- Adds the server-controlled institutional instrument repository required to
-- enforce consequential actions. Browser clients may select a mandate ID; they
-- never supply verificationStatus, monetary totals, issuer facts, or dates.
--
-- Tables:
--   * sage_institutional_mandate — versioned, attested, holder-accepted authority
--   * sage_resource_commitment   — ledger of committed resources under a mandate
--   * sage_institutional_action  — append-only record of admitted consequential acts
--
-- RLS isolates every table on app.tenant_id. Mandates are append/update for
-- lifecycle fields only; institutional_action rows are insert-only.

-- ── Enums ────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE sage_mandate_status AS ENUM ('active', 'suspended', 'revoked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_mandate_verification AS ENUM ('verified', 'unverified', 'rejected');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE sage_institutional_action_kind AS ENUM (
    'question.adopt',
    'decision.ratify',
    'intervention.authorize',
    'resource.commit',
    'records.transfer',
    'export.release',
    'succession.delegate'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ── Mandates ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sage_institutional_mandate (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 text NOT NULL,
  workspace_id           uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  principal_actor_id     text NOT NULL,
  position_id            text NOT NULL,
  resource_id            text NOT NULL,
  permitted_actions      jsonb NOT NULL,
  instrument_ref         text NOT NULL,
  instrument_version     text NOT NULL,
  issuer_actor_id        text NOT NULL,
  monetary_limit_minor   bigint,
  currency               text,
  verification_status    sage_mandate_verification NOT NULL DEFAULT 'unverified',
  attested_at            timestamptz NOT NULL,
  accepted_at            timestamptz,
  effective_at           timestamptz NOT NULL,
  expires_at             timestamptz NOT NULL,
  revoked_at             timestamptz,
  status                 sage_mandate_status NOT NULL DEFAULT 'active',
  created_by             text NOT NULL,
  created_at             timestamptz NOT NULL DEFAULT now(),
  updated_at             timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_institutional_mandate_dates_chk
    CHECK (expires_at > effective_at),
  CONSTRAINT sage_institutional_mandate_actions_array_chk
    CHECK (jsonb_typeof(permitted_actions) = 'array'),
  CONSTRAINT sage_institutional_mandate_money_pair_chk
    CHECK (
      (monetary_limit_minor IS NULL AND currency IS NULL)
      OR (monetary_limit_minor IS NOT NULL AND currency IS NOT NULL AND monetary_limit_minor >= 0)
    )
);

CREATE INDEX IF NOT EXISTS sage_institutional_mandate_org_principal_idx
  ON sage_institutional_mandate (org_id, principal_actor_id, status);
CREATE INDEX IF NOT EXISTS sage_institutional_mandate_workspace_resource_idx
  ON sage_institutional_mandate (workspace_id, resource_id);
CREATE INDEX IF NOT EXISTS sage_institutional_mandate_expiry_idx
  ON sage_institutional_mandate (expires_at);

-- ── Resource commitment ledger ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sage_resource_commitment (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 text NOT NULL,
  workspace_id           uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  resource_id            text NOT NULL,
  mandate_id             uuid NOT NULL REFERENCES sage_institutional_mandate (id),
  currency               text NOT NULL,
  amount_minor           bigint NOT NULL CHECK (amount_minor > 0),
  idempotency_key        text NOT NULL,
  committed_by_actor_id  text NOT NULL,
  committed_at           timestamptz NOT NULL DEFAULT now(),
  instrument_ref         text NOT NULL,
  instrument_version     text NOT NULL,
  CONSTRAINT sage_resource_commitment_idempotency_uq
    UNIQUE (org_id, resource_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS sage_resource_commitment_ledger_idx
  ON sage_resource_commitment (org_id, resource_id, currency);

-- ── Admitted institutional actions (append-only audit binding) ───────────────

CREATE TABLE IF NOT EXISTS sage_institutional_action (
  id                     uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                 text NOT NULL,
  workspace_id           uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  mandate_id             uuid NOT NULL REFERENCES sage_institutional_mandate (id),
  action                 sage_institutional_action_kind NOT NULL,
  resource_id            text NOT NULL,
  actor_id               text NOT NULL,
  position_id            text NOT NULL,
  instrument_ref         text NOT NULL,
  instrument_version     text NOT NULL,
  idempotency_key        text NOT NULL,
  decision_reason        text NOT NULL,
  commitment_id          uuid REFERENCES sage_resource_commitment (id),
  safe_payload_json      jsonb NOT NULL DEFAULT '{}'::jsonb,
  occurred_at            timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_institutional_action_idempotency_uq
    UNIQUE (org_id, resource_id, action, idempotency_key)
);

CREATE INDEX IF NOT EXISTS sage_institutional_action_mandate_idx
  ON sage_institutional_action (mandate_id, occurred_at);

-- ── Append-only guard for institutional actions ──────────────────────────────

CREATE OR REPLACE FUNCTION sage_forbid_institutional_action_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'sage_institutional_action is append-only';
END;
$$;

DROP TRIGGER IF EXISTS sage_institutional_action_no_update ON sage_institutional_action;
CREATE TRIGGER sage_institutional_action_no_update
  BEFORE UPDATE OR DELETE ON sage_institutional_action
  FOR EACH ROW EXECUTE FUNCTION sage_forbid_institutional_action_mutation();

-- ── Row-level security ───────────────────────────────────────────────────────

ALTER TABLE sage_institutional_mandate ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_resource_commitment   ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_institutional_action  ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY sage_institutional_mandate_rls ON sage_institutional_mandate
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY sage_resource_commitment_rls ON sage_resource_commitment
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY sage_institutional_action_rls ON sage_institutional_action
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
