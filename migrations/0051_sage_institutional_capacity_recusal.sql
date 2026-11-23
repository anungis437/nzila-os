-- Migration 0051: SAGE institutional office holdings and conflict/recusal facts
--
-- Server-controlled capacity/recusal repository. Browser clients never supply
-- authoritative office or "I am not conflicted" labels. Admission fails closed
-- when no verified holding or conflict attestation exists for the act.
--
-- Tables:
--   * sage_institutional_office_holding — active office/position for an actor
--   * sage_institutional_conflict_attestation — verified conflict/recusal (or clear)
--
-- Absence of a conflict attestation means UNAVAILABLE (fail closed), not clear.

-- ── Office holdings ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sage_institutional_office_holding (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             text NOT NULL,
  workspace_id       uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  actor_id           text NOT NULL,
  position_id        text NOT NULL,
  instrument_ref     text NOT NULL,
  instrument_version text NOT NULL,
  status             text NOT NULL DEFAULT 'active'
                       CHECK (status IN ('active', 'suspended', 'revoked', 'expired')),
  effective_at       timestamptz NOT NULL,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  created_by         text NOT NULL,
  created_at         timestamptz NOT NULL DEFAULT now(),
  updated_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_institutional_office_holding_dates_chk
    CHECK (expires_at > effective_at)
);

CREATE INDEX IF NOT EXISTS sage_institutional_office_holding_actor_idx
  ON sage_institutional_office_holding (org_id, workspace_id, actor_id, status);

CREATE INDEX IF NOT EXISTS sage_institutional_office_holding_position_idx
  ON sage_institutional_office_holding (org_id, workspace_id, position_id, status);

-- At most one active holding per actor+workspace+position (lifecycle rows may coexist when revoked).
CREATE UNIQUE INDEX IF NOT EXISTS sage_institutional_office_holding_active_uq
  ON sage_institutional_office_holding (org_id, workspace_id, actor_id, position_id)
  WHERE status = 'active' AND revoked_at IS NULL;

-- ── Conflict / recusal attestations ──────────────────────────────────────────
-- conflicted = true  → actor is conflicted/recused for the scope (deny)
-- conflicted = false → institutionally attested clear for the scope (admit path)
-- no matching row   → UNAVAILABLE (deny)

CREATE TABLE IF NOT EXISTS sage_institutional_conflict_attestation (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id             text NOT NULL,
  workspace_id       uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  actor_id           text NOT NULL,
  resource_id        text NOT NULL,
  -- Exact institutional action kind, or '*' for all actions on the resource.
  action_scope       text NOT NULL,
  conflicted         boolean NOT NULL,
  instrument_ref     text NOT NULL,
  instrument_version text NOT NULL,
  attested_by        text NOT NULL,
  attested_at        timestamptz NOT NULL,
  effective_at       timestamptz NOT NULL,
  expires_at         timestamptz NOT NULL,
  revoked_at         timestamptz,
  created_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_institutional_conflict_attestation_dates_chk
    CHECK (expires_at > effective_at)
);

CREATE INDEX IF NOT EXISTS sage_institutional_conflict_attestation_lookup_idx
  ON sage_institutional_conflict_attestation (
    org_id, workspace_id, actor_id, resource_id, action_scope
  );

CREATE UNIQUE INDEX IF NOT EXISTS sage_institutional_conflict_attestation_active_uq
  ON sage_institutional_conflict_attestation (
    org_id, workspace_id, actor_id, resource_id, action_scope
  )
  WHERE revoked_at IS NULL;

-- ── Row-level security ───────────────────────────────────────────────────────

ALTER TABLE sage_institutional_office_holding ENABLE ROW LEVEL SECURITY;
ALTER TABLE sage_institutional_conflict_attestation ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY sage_institutional_office_holding_rls ON sage_institutional_office_holding
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY sage_institutional_conflict_attestation_rls ON sage_institutional_conflict_attestation
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
