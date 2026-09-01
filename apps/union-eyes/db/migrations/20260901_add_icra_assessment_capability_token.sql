-- Adds the bounded ICRA assessment-access capability (PR #752 follow-up):
-- possession of the assessmentId UUID alone must no longer be sufficient to
-- read or mutate an existing assessment. Only a hash of the capability
-- token is ever persisted; the raw token is returned once at issuance
-- (assessment creation) and never stored server-side.
-- See apps/union-eyes/lib/icra/assessment-capability.ts.

ALTER TABLE icra_assessments
  ADD COLUMN IF NOT EXISTS capability_token_hash       varchar(128),
  ADD COLUMN IF NOT EXISTS capability_token_expires_at timestamptz;

CREATE INDEX IF NOT EXISTS icra_assessments_capability_token_hash_idx
  ON icra_assessments(capability_token_hash);
