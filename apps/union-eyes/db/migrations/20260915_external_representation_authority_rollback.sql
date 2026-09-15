-- Rollback for 20260915_external_representation_authority.sql.
-- Do not run against shared/live databases without an approved rollback window.

DROP INDEX IF EXISTS idx_grievance_deadlines_confirmation_status;
ALTER TABLE grievance_deadlines
  DROP CONSTRAINT IF EXISTS grievance_deadlines_confirmation_status_ck,
  DROP COLUMN IF EXISTS superseded_by,
  DROP COLUMN IF EXISTS superseded_at,
  DROP COLUMN IF EXISTS override_by,
  DROP COLUMN IF EXISTS override_at,
  DROP COLUMN IF EXISTS override_reason,
  DROP COLUMN IF EXISTS override_due_date,
  DROP COLUMN IF EXISTS confirmed_by,
  DROP COLUMN IF EXISTS confirmed_at,
  DROP COLUMN IF EXISTS calculation_provenance,
  DROP COLUMN IF EXISTS calculated_due_date,
  DROP COLUMN IF EXISTS confirmation_status;

DROP TABLE IF EXISTS external_document_access_grants;
DROP TABLE IF EXISTS external_matter_access_grants;
DROP TABLE IF EXISTS representation_authorities;

DROP TYPE IF EXISTS external_document_grant_status;
DROP TYPE IF EXISTS external_matter_grant_status;
DROP TYPE IF EXISTS representation_authority_scope;
DROP TYPE IF EXISTS representation_authority_status;
