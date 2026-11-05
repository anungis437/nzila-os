-- Local acceptance sandbox ONLY.
--
-- The platform audit_records table refuses any row that is not backed by immutable (WORM) blob storage: a CHECK constraint
-- and the insert-guard trigger both require storage_type = 'azure_blob' and immutable = true. A developer or acceptance
-- machine has no WORM store, so the NAR proof cannot be stored and every route that needs one fails.
--
-- This script lets a SANDBOX database also accept the honest local reference written by packages/nar/src/storage/local-sandbox.ts
-- (storage_type = 'local_sandbox', immutable = false). The hash chain guard stays in force. It refuses to run anywhere but a
-- database whose name ends in _sandbox, so it can never be applied to a real platform database by accident.

DO $$
BEGIN
  IF current_database() !~ '_sandbox$' THEN
    RAISE EXCEPTION 'sandbox relaxation refused: database % is not a *_sandbox database', current_database();
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE audit_records DROP CONSTRAINT IF EXISTS audit_records_storage_metadata_ck;
--> statement-breakpoint
ALTER TABLE audit_records ADD CONSTRAINT audit_records_storage_metadata_ck CHECK (
  (storage_type IS NULL AND storage_uri IS NULL AND immutable IS NULL AND retention_until IS NULL)
  OR (storage_type = 'azure_blob' AND storage_uri IS NOT NULL AND immutable = true AND retention_until IS NOT NULL)
  OR (storage_type = 'local_sandbox' AND storage_uri IS NOT NULL AND immutable = false AND retention_until IS NOT NULL)
);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION enforce_audit_record_insert_guards() RETURNS trigger LANGUAGE plpgsql AS $fn$
DECLARE
  prior_count integer;
BEGIN
  SELECT COUNT(1) INTO prior_count FROM audit_records WHERE organization_id = NEW.organization_id;

  IF prior_count > 0 AND NEW.previous_hash IS NULL THEN
    RAISE EXCEPTION 'audit_records chain violation: previous_hash is required after genesis';
  END IF;

  IF NEW.storage_type IS NULL OR NEW.storage_uri IS NULL OR NEW.retention_until IS NULL
     OR NOT (
       (NEW.storage_type = 'azure_blob' AND NEW.immutable IS NOT DISTINCT FROM true)
       OR (NEW.storage_type = 'local_sandbox' AND NEW.immutable IS NOT DISTINCT FROM false)
     ) THEN
    RAISE EXCEPTION 'audit_records storage violation: storage metadata is required';
  END IF;

  RETURN NEW;
END;
$fn$;
