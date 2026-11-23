-- Migration 0052: SAGE CLEAR accountability adoption ledger
--
-- Persists explicit human adoption / decline / defer / challenge of an
-- executive accountability draft. A draft never silently becomes an
-- institutional conclusion. Rows are append-only; RLS isolates by tenant.

CREATE TABLE IF NOT EXISTS sage_accountability_adoption (
  id                         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  org_id                     text NOT NULL,
  workspace_id               uuid NOT NULL REFERENCES sage_workspace (id) ON DELETE CASCADE,
  resource_id                text NOT NULL,
  status                     text NOT NULL
                               CHECK (status IN ('ADOPTED', 'DECLINED', 'DEFERRED', 'CHALLENGED')),
  choice                     text NOT NULL
                               CHECK (choice IN ('adopt', 'decline', 'defer', 'challenge')),
  draft_status_preserved     text NOT NULL
                               CHECK (draft_status_preserved = 'DRAFT_REQUIRES_HUMAN_ADOPTION'),
  adopting_actor_id          text NOT NULL,
  adopting_position_id       text NOT NULL,
  rationale                  text NOT NULL,
  mandate_id                 uuid NOT NULL REFERENCES sage_institutional_mandate (id),
  instrument_ref             text NOT NULL,
  instrument_version         text NOT NULL,
  institutional_action_id    uuid NOT NULL REFERENCES sage_institutional_action (id),
  next_decision_owner_actor_id text,
  preserves_draft_facts      boolean NOT NULL DEFAULT true
                               CHECK (preserves_draft_facts = true),
  draft_snapshot_json        jsonb NOT NULL,
  adopted_at                 timestamptz NOT NULL,
  created_at                 timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sage_accountability_adoption_idempotency_uq
    UNIQUE (org_id, resource_id, mandate_id, adopting_actor_id, adopted_at)
);

CREATE INDEX IF NOT EXISTS sage_accountability_adoption_resource_idx
  ON sage_accountability_adoption (org_id, workspace_id, resource_id, adopted_at desc);

CREATE OR REPLACE FUNCTION sage_forbid_accountability_adoption_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'sage_accountability_adoption is append-only';
END;
$$;

DROP TRIGGER IF EXISTS sage_accountability_adoption_no_update ON sage_accountability_adoption;
CREATE TRIGGER sage_accountability_adoption_no_update
  BEFORE UPDATE OR DELETE ON sage_accountability_adoption
  FOR EACH ROW EXECUTE FUNCTION sage_forbid_accountability_adoption_mutation();

ALTER TABLE sage_accountability_adoption ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY sage_accountability_adoption_rls ON sage_accountability_adoption
    USING (org_id = current_setting('app.tenant_id'))
    WITH CHECK (org_id = current_setting('app.tenant_id'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
