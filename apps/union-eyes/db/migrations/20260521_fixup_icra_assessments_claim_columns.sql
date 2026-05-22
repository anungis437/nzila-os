-- Fixup: add icra_assessments claim/payment columns that exist in Drizzle schema
-- but were missing from the DB, causing INSERT 42703 (undefined column) on
-- /api/icra/submit because Drizzle emits all schema columns in the statement.
-- See apps/union-eyes/db/schema/icra-schema.ts -> icraAssessments.

ALTER TABLE icra_assessments
  ADD COLUMN IF NOT EXISTS stripe_payment_ref     varchar(255),
  ADD COLUMN IF NOT EXISTS claim_email            varchar(320),
  ADD COLUMN IF NOT EXISTS claim_token            varchar(128),
  ADD COLUMN IF NOT EXISTS claim_token_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS claimed_by_user_id     varchar(128),
  ADD COLUMN IF NOT EXISTS claimed_org_id         uuid,
  ADD COLUMN IF NOT EXISTS claimed_at             timestamptz;

CREATE INDEX IF NOT EXISTS icra_assessments_claim_token_idx
  ON icra_assessments(claim_token);
