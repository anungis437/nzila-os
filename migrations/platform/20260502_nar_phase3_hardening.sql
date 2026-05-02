-- Phase 3 hardening: immutable storage metadata + chain enforcement

ALTER TABLE audit_records
  ADD COLUMN IF NOT EXISTS storage_type varchar(32),
  ADD COLUMN IF NOT EXISTS storage_uri text,
  ADD COLUMN IF NOT EXISTS immutable boolean,
  ADD COLUMN IF NOT EXISTS retention_until timestamptz;

ALTER TABLE audit_records
  DROP CONSTRAINT IF EXISTS audit_records_storage_metadata_ck;

ALTER TABLE audit_records
  ADD CONSTRAINT audit_records_storage_metadata_ck CHECK (
    (storage_type IS NULL AND storage_uri IS NULL AND immutable IS NULL AND retention_until IS NULL)
    OR
    (storage_type = 'azure_blob' AND storage_uri IS NOT NULL AND immutable = true AND retention_until IS NOT NULL)
  );

CREATE OR REPLACE FUNCTION enforce_audit_record_insert_guards()
RETURNS trigger AS $$
DECLARE
  prior_count integer;
BEGIN
  SELECT COUNT(1)
  INTO prior_count
  FROM audit_records
  WHERE organization_id = NEW.organization_id;

  IF prior_count > 0 AND NEW.previous_hash IS NULL THEN
    RAISE EXCEPTION 'audit_records chain violation: previous_hash is required after genesis';
  END IF;

  IF NEW.storage_type IS NULL OR NEW.storage_uri IS NULL OR NEW.immutable IS DISTINCT FROM true OR NEW.retention_until IS NULL THEN
    RAISE EXCEPTION 'audit_records storage violation: immutable storage metadata is required';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_audit_records_insert_guards ON audit_records;
CREATE TRIGGER trg_audit_records_insert_guards
  BEFORE INSERT ON audit_records
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_record_insert_guards();
