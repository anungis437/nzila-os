-- P0 #1037: executable PostgreSQL 16 schema contract, not a production
-- migration receipt. This test transaction rolls back its sample records.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tool_fabric_trust_stream
    WHERE stream_id = 'platform:tool-fabric:trust'
      AND revision = 0 AND head_hash = repeat('0', 64)
  ) THEN
    RAISE EXCEPTION 'Canonical genesis was not initialized';
  END IF;
END;
$$;

INSERT INTO tool_fabric_trust_entry (stream_id, seq, audit_id, entry_hash, entry)
VALUES ('platform:tool-fabric:trust', 1, '00000000-0000-4000-8000-000000000001',
        repeat('1', 64), '{"seq":1}'::jsonb);
UPDATE tool_fabric_trust_stream
SET revision = 1, head_hash = repeat('1', 64), updated_at = now()
WHERE stream_id = 'platform:tool-fabric:trust' AND revision = 0;

DO $$
BEGIN
  BEGIN
    UPDATE tool_fabric_trust_entry SET entry = '{"tampered":true}'::jsonb WHERE seq = 1;
    RAISE EXCEPTION 'SECURITY FAILURE: receipt UPDATE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM tool_fabric_trust_entry WHERE seq = 1;
    RAISE EXCEPTION 'SECURITY FAILURE: receipt DELETE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE tool_fabric_trust_entry;
    RAISE EXCEPTION 'SECURITY FAILURE: receipt TRUNCATE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE tool_fabric_trust_stream SET revision = 0, head_hash = repeat('0',64)
      WHERE stream_id = 'platform:tool-fabric:trust';
    RAISE EXCEPTION 'SECURITY FAILURE: stream rollback succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE tool_fabric_trust_stream SET revision = 2, head_hash = repeat('f',64)
      WHERE stream_id = 'platform:tool-fabric:trust';
    RAISE EXCEPTION 'SECURITY FAILURE: head advanced without receipt';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    DELETE FROM tool_fabric_trust_stream WHERE stream_id = 'platform:tool-fabric:trust';
    RAISE EXCEPTION 'SECURITY FAILURE: stream DELETE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    TRUNCATE tool_fabric_trust_stream CASCADE;
    RAISE EXCEPTION 'SECURITY FAILURE: stream TRUNCATE succeeded';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END;
$$;

INSERT INTO tool_fabric_trust_entry (stream_id, seq, audit_id, entry_hash, entry)
VALUES ('platform:tool-fabric:trust', 2, '00000000-0000-4000-8000-000000000002',
        repeat('2', 64), '{"seq":2}'::jsonb);
UPDATE tool_fabric_trust_stream
SET revision = 2, head_hash = repeat('2', 64), updated_at = now()
WHERE stream_id = 'platform:tool-fabric:trust' AND revision = 1;

-- A failed head CAS must roll back the preceding receipt INSERT in the
-- same PostgreSQL transaction. The nested PL/pgSQL block is a subtransaction:
-- catching 42501 must not leave an orphaned seq=3 receipt behind.
DO $
BEGIN
  BEGIN
    INSERT INTO tool_fabric_trust_entry (stream_id, seq, audit_id, entry_hash, entry)
    VALUES ('platform:tool-fabric:trust', 3, '00000000-0000-4000-8000-000000000003',
            repeat('3',64), '{"seq":3}'::jsonb);
    UPDATE tool_fabric_trust_stream
      SET revision = 3, head_hash = repeat('f',64), updated_at = now()
      WHERE stream_id = 'platform:tool-fabric:trust' AND revision = 2;
    RAISE EXCEPTION 'SECURITY FAILURE: mismatched receipt/head CAS succeeded';
  EXCEPTION WHEN insufficient_privilege THEN
    NULL;
  END;
  IF EXISTS (SELECT 1 FROM tool_fabric_trust_entry WHERE seq = 3)
     OR (SELECT revision FROM tool_fabric_trust_stream
         WHERE stream_id = 'platform:tool-fabric:trust') <> 2 THEN
    RAISE EXCEPTION 'SECURITY FAILURE: failed CAS left a partial durable write';
  END IF;
END;
$;

DO $
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM tool_fabric_trust_stream
    WHERE stream_id = 'platform:tool-fabric:trust'
      AND revision = 2 AND head_hash = repeat('2',64)
  ) OR (SELECT count(*) FROM tool_fabric_trust_entry) <> 2 THEN
    RAISE EXCEPTION 'Valid append/head CAS did not commit in the test transaction';
  END IF;
END;
$$;
ROLLBACK;
