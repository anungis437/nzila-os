-- P0 #1037: migration 003, DBA-governed. Enforce the missing half of
-- atomic receipt/head CAS: a receipt cannot COMMIT without its matching head.
-- This is database integrity, NOT a substitute for an independent rollback
-- witness, authenticated host authority, least-privilege grants or PITR.
-- Apply after 001 and 002 only, through the approved migration process.
BEGIN;
LOCK TABLE tool_fabric_trust_stream IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE tool_fabric_trust_entry IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tool_fabric_trust_stream s
    WHERE s.stream_id = 'platform:tool-fabric:trust'
      AND s.revision = (
        SELECT count(*) FROM tool_fabric_trust_entry e
        WHERE e.stream_id = s.stream_id
      )
      AND s.head_hash = COALESCE((
        SELECT e.entry_hash FROM tool_fabric_trust_entry e
        WHERE e.stream_id = s.stream_id ORDER BY e.seq DESC LIMIT 1
      ), repeat('0',64))
      AND s.revision = COALESCE((
        SELECT max(e.seq) FROM tool_fabric_trust_entry e
        WHERE e.stream_id = s.stream_id
      ), 0)
  ) THEN
    RAISE EXCEPTION 'Existing trust ledger is inconsistent; refuse migration 003'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE FUNCTION tool_fabric_require_receipt_head_at_commit() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  -- Deferred constraint is checked at transaction COMMIT. It prevents a
  -- malicious or buggy client from committing an orphan INSERT without the
  -- corresponding monotonic head CAS (which migration 002 validates).
  IF NOT EXISTS (
    SELECT 1 FROM tool_fabric_trust_stream s
    WHERE s.stream_id = NEW.stream_id
      AND s.revision = NEW.seq
      AND s.head_hash = NEW.entry_hash
  ) THEN
    RAISE EXCEPTION 'Tool Fabric trust receipt cannot commit without matching head'
      USING ERRCODE = '23514';
  END IF;
  RETURN NULL;
END;
$$;

CREATE CONSTRAINT TRIGGER tool_fabric_receipt_requires_head
AFTER INSERT ON tool_fabric_trust_entry
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION tool_fabric_require_receipt_head_at_commit();

COMMIT;
