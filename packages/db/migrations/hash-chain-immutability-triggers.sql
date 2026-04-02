-- Hash Chain Immutability Triggers
-- Enforces that audit_events rows cannot be inserted without a valid hash
-- and cannot be updated or deleted after insertion (append-only).

-- Trigger function: prevent null/empty hash on INSERT
CREATE OR REPLACE FUNCTION enforce_audit_hash_not_null()
RETURNS trigger AS $$
BEGIN
  IF NEW.hash IS NULL OR NEW.hash = '' THEN
    RAISE EXCEPTION 'hash must not be null or empty — audit hash chain integrity violated';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_hash_not_null
  BEFORE INSERT ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION enforce_audit_hash_not_null();

-- Trigger function: prevent UPDATE on audit_events (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_event_update()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only — updates are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_no_update
  BEFORE UPDATE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_event_update();

-- Trigger function: prevent DELETE on audit_events (append-only)
CREATE OR REPLACE FUNCTION prevent_audit_event_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'audit_events is append-only — deletes are prohibited';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_audit_events_no_delete
  BEFORE DELETE ON audit_events
  FOR EACH ROW
  EXECUTE FUNCTION prevent_audit_event_delete();
