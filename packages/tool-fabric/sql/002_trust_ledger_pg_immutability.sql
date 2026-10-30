-- P0 #1037, migration 002: irreversible append-only trust receipts and
-- monotonic CAS stream heads. Apply ONLY after 001 via approved DBA change.
-- A database superuser can disable triggers: the independent rollback witness
-- and external audit domain remain mandatory. Never auto-migrate on startup.
BEGIN;

CREATE FUNCTION tool_fabric_reject_trust_mutation() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Tool Fabric trust receipts are append-only'
    USING ERRCODE = '42501';
END;
$$;

CREATE TRIGGER tool_fabric_entry_immutable
BEFORE UPDATE OR DELETE ON tool_fabric_trust_entry
FOR EACH ROW EXECUTE FUNCTION tool_fabric_reject_trust_mutation();

CREATE TRIGGER tool_fabric_entry_no_truncate
BEFORE TRUNCATE ON tool_fabric_trust_entry
FOR EACH STATEMENT EXECUTE FUNCTION tool_fabric_reject_trust_mutation();

CREATE FUNCTION tool_fabric_guard_trust_head_cas() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  committed_hash CHAR(64);
BEGIN
  -- Only an atomic append of the immediately next receipt may advance the
  -- head. The caller must insert the entry and update the head in one tx.
  IF NEW.stream_id IS DISTINCT FROM OLD.stream_id
     OR NEW.revision IS DISTINCT FROM OLD.revision + 1
     OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Tool Fabric trust head update is not monotonic CAS'
      USING ERRCODE = '42501';
  END IF;
  SELECT entry_hash INTO committed_hash
  FROM tool_fabric_trust_entry
  WHERE stream_id = OLD.stream_id AND seq = NEW.revision;
  IF committed_hash IS NULL OR NEW.head_hash IS DISTINCT FROM committed_hash THEN
    RAISE EXCEPTION 'Tool Fabric trust head has no matching durable receipt'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER tool_fabric_stream_monotonic_cas
BEFORE UPDATE ON tool_fabric_trust_stream
FOR EACH ROW EXECUTE FUNCTION tool_fabric_guard_trust_head_cas();

CREATE TRIGGER tool_fabric_stream_no_delete
BEFORE DELETE ON tool_fabric_trust_stream
FOR EACH ROW EXECUTE FUNCTION tool_fabric_reject_trust_mutation();

CREATE TRIGGER tool_fabric_stream_no_truncate
BEFORE TRUNCATE ON tool_fabric_trust_stream
FOR EACH STATEMENT EXECUTE FUNCTION tool_fabric_reject_trust_mutation();

COMMIT;
