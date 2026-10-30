-- P0 #1037: EPHEMERAL PostgreSQL contract only. This file intentionally
-- commits fixtures so the workflow can verify them using a new SQL session.
-- Never run against a real trust ledger. Does NOT prove server restart/PITR.
\set ON_ERROR_STOP on
BEGIN;
INSERT INTO tool_fabric_trust_entry (stream_id, seq, audit_id, entry_hash, entry)
VALUES ('platform:tool-fabric:trust', 1, '00000000-0000-4000-8000-000000000011',
        repeat('1',64), '{"seq":1}'::jsonb);
UPDATE tool_fabric_trust_stream
SET revision=1, head_hash=repeat('1',64), updated_at=now()
WHERE stream_id='platform:tool-fabric:trust' AND revision=0;
COMMIT;

BEGIN;
DO $$
BEGIN
  BEGIN
    -- An orphan receipt must not be permitted to commit, even when a client
    -- attempts INSERT without advancing the canonical stream head.
    INSERT INTO tool_fabric_trust_entry (stream_id, seq, audit_id, entry_hash, entry)
    VALUES ('platform:tool-fabric:trust', 2, '00000000-0000-4000-8000-000000000012',
            repeat('f',64), '{"orphan":true}'::jsonb);
    SET CONSTRAINTS tool_fabric_receipt_requires_head IMMEDIATE;
    RAISE EXCEPTION 'SECURITY FAILURE: orphan receipt constraint did not reject';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM tool_fabric_trust_entry WHERE seq=2) THEN
    RAISE EXCEPTION 'SECURITY FAILURE: orphan insert survived subtransaction';
  END IF;
END;
$$;

INSERT INTO tool_fabric_trust_entry (stream_id, seq, audit_id, entry_hash, entry)
VALUES ('platform:tool-fabric:trust', 2, '00000000-0000-4000-8000-000000000013',
        repeat('2',64), '{"seq":2}'::jsonb);
UPDATE tool_fabric_trust_stream
SET revision=2, head_hash=repeat('2',64), updated_at=now()
WHERE stream_id='platform:tool-fabric:trust' AND revision=1;
COMMIT;
