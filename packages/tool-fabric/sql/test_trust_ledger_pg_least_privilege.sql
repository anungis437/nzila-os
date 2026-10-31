-- P0 #1037: prove the minimum database writer permissions on ephemeral
-- PostgreSQL 16. This is a contract test, NOT a production GRANT, role
-- provisioning receipt, external witness, or broker runtime certification.
-- The entire test, including the temporary role and sample append, rolls back.
\set ON_ERROR_STOP on
BEGIN;
CREATE ROLE tool_fabric_contract_writer NOLOGIN;
GRANT USAGE ON SCHEMA public TO tool_fabric_contract_writer;
GRANT SELECT ON tool_fabric_trust_stream, tool_fabric_trust_entry
  TO tool_fabric_contract_writer;
GRANT INSERT (stream_id, seq, audit_id, entry_hash, entry)
  ON tool_fabric_trust_entry TO tool_fabric_contract_writer;
GRANT UPDATE (revision, head_hash, updated_at)
  ON tool_fabric_trust_stream TO tool_fabric_contract_writer;

SET LOCAL ROLE tool_fabric_contract_writer;

DO $$
BEGIN
  IF current_user <> 'tool_fabric_contract_writer'
     OR has_table_privilege(current_user, 'tool_fabric_trust_entry', 'UPDATE')
     OR has_table_privilege(current_user, 'tool_fabric_trust_entry', 'DELETE')
     OR has_table_privilege(current_user, 'tool_fabric_trust_entry', 'TRUNCATE')
     OR has_table_privilege(current_user, 'tool_fabric_trust_stream', 'DELETE')
     OR has_table_privilege(current_user, 'tool_fabric_trust_stream', 'TRUNCATE')
     OR has_schema_privilege(current_user, 'public', 'CREATE') THEN
    RAISE EXCEPTION 'SECURITY FAILURE: trust writer has excess privileges';
  END IF;
  IF NOT has_table_privilege(current_user, 'tool_fabric_trust_entry', 'INSERT')
     OR NOT has_table_privilege(current_user, 'tool_fabric_trust_entry', 'SELECT')
     OR NOT has_column_privilege(current_user, 'tool_fabric_trust_stream', 'revision', 'UPDATE') THEN
    RAISE EXCEPTION 'Trust writer cannot perform the required least-privileged CAS';
  END IF;

  BEGIN
    UPDATE tool_fabric_trust_entry SET entry = '{"forged":true}'::jsonb
      WHERE seq = 2;
    RAISE EXCEPTION 'SECURITY FAILURE: writer changed immutable receipt';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM tool_fabric_trust_entry WHERE seq = 2;
    RAISE EXCEPTION 'SECURITY FAILURE: writer deleted immutable receipt';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE tool_fabric_trust_entry;
    RAISE EXCEPTION 'SECURITY FAILURE: writer truncated immutable receipts';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM tool_fabric_trust_stream
      WHERE stream_id = 'platform:tool-fabric:trust';
    RAISE EXCEPTION 'SECURITY FAILURE: writer deleted canonical stream';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE tool_fabric_trust_stream CASCADE;
    RAISE EXCEPTION 'SECURITY FAILURE: writer truncated canonical stream';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE tool_fabric_trust_stream SET stream_id = 'attacker'
      WHERE stream_id = 'platform:tool-fabric:trust';
    RAISE EXCEPTION 'SECURITY FAILURE: writer changed stream identity';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    EXECUTE 'ALTER TABLE tool_fabric_trust_entry ADD COLUMN injected TEXT';
    RAISE EXCEPTION 'SECURITY FAILURE: writer modified trust schema';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

-- The same restricted role must still be able to atomically append the next
-- receipt and advance the head; proving denial alone is not sufficient.
INSERT INTO tool_fabric_trust_entry (stream_id, seq, audit_id, entry_hash, entry)
VALUES ('platform:tool-fabric:trust', 3, '00000000-0000-4000-8000-000000000003',
        repeat('3',64), '{"seq":3}'::jsonb);
UPDATE tool_fabric_trust_stream
SET revision = 3, head_hash = repeat('3',64), updated_at = now()
WHERE stream_id = 'platform:tool-fabric:trust'
  AND revision = 2 AND head_hash = repeat('2',64);
-- Force the deferred receipt/head trigger to execute before rolling back.
SET CONSTRAINTS tool_fabric_receipt_requires_head IMMEDIATE;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tool_fabric_trust_stream
    WHERE stream_id = 'platform:tool-fabric:trust'
      AND revision = 3 AND head_hash = repeat('3',64)
  ) OR NOT EXISTS (
    SELECT 1 FROM tool_fabric_trust_entry
    WHERE stream_id = 'platform:tool-fabric:trust'
      AND seq = 3 AND entry_hash = repeat('3',64)
  ) THEN
    RAISE EXCEPTION 'Restricted trust writer could not atomically advance head';
  END IF;
END;
$$;
ROLLBACK;
