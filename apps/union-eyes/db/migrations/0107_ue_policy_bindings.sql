-- =============================================================================
-- 0107_ue_policy_bindings.sql
--
-- Union Eyes — Policy Lifecycle Extension
--
-- Creates the ue_policy_bindings table that links organization-scoped
-- workflow overrides to platform-level governed_policies records.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ue_policy_bindings (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                    UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  governed_policy_id        UUID NOT NULL,
  governed_policy_version   TEXT NOT NULL,
  local_workflow_id         TEXT NOT NULL,
  local_domain_scope        TEXT NOT NULL,
  custom_evaluator_fn_name  TEXT,
  effective_from            TIMESTAMPTZ,
  effective_until           TIMESTAMPTZ,
  active                    BOOLEAN NOT NULL DEFAULT TRUE,
  created_by                TEXT NOT NULL,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS ue_policy_bindings_org_idx
  ON ue_policy_bindings(org_id);

CREATE INDEX IF NOT EXISTS ue_policy_bindings_governed_idx
  ON ue_policy_bindings(governed_policy_id);

CREATE INDEX IF NOT EXISTS ue_policy_bindings_workflow_idx
  ON ue_policy_bindings(local_workflow_id, org_id);

CREATE INDEX IF NOT EXISTS ue_policy_bindings_active_idx
  ON ue_policy_bindings(active, org_id);
