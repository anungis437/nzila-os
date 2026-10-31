-- P0 #1037: ephemeral PostgreSQL 16 rollback/retry contract after the
-- concurrent CAS test commits revision 3. Synthetic SQL fixture only: this
-- does NOT certify authentic audit hashes, production recovery, host identity,
-- external rollback witness, or Tool Fabric broker/installer readiness.
\set ON_ERROR_STOP on

-- Model the adapter's insert-before-head-CAS ordering. The stale head UPDATE
-- returns zero rows, so the transaction MUST abort without retaining seq 4.
BEGIN;
DO $$
DECLARE
  changed_rows integer;
  expected_stale boolean := false;
BEGIN
  BEGIN
    INSERT INTO public.tool_fabric_trust_entry
      (stream_id, seq, audit_id, entry_hash, entry)
    VALUES ('platform:tool-fabric:trust', 4,
      '00000000-0000-4000-8000-000000000041',
      repeat('4',64), '{"seq":4}'::jsonb);

    UPDATE public.tool_fabric_trust_stream
    SET revision = 4, head_hash = repeat('4',64), updated_at = now()
    WHERE stream_id = 'platform:tool-fabric:trust'
      AND revision = 2 AND head_hash = repeat('2',64);
    GET DIAGNOSTICS changed_rows = ROW_COUNT;
    IF changed_rows <> 0 THEN
      RAISE EXCEPTION 'SECURITY FAILURE: stale CAS unexpectedly advanced head';
    END IF;

    expected_stale := true;
    RAISE EXCEPTION 'expected stale CAS abort' USING ERRCODE = '40001';
  EXCEPTION WHEN serialization_failure THEN
    IF NOT expected_stale THEN
      RAISE EXCEPTION 'SECURITY FAILURE: unrelated serialization failure was mistaken for stale CAS';
    END IF;
    -- PL/pgSQL exception handling rolls back the inner subtransaction.
    IF EXISTS (
      SELECT 1 FROM public.tool_fabric_trust_entry
      WHERE audit_id = '00000000-0000-4000-8000-000000000041'
    ) THEN
      RAISE EXCEPTION 'SECURITY FAILURE: failed CAS left a receipt in transaction';
    END IF;
  END;
END;
$$;
COMMIT;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tool_fabric_trust_stream
    WHERE stream_id = 'platform:tool-fabric:trust'
      AND revision = 3 AND head_hash = repeat('3',64)
  ) OR EXISTS (
    SELECT 1 FROM public.tool_fabric_trust_entry
    WHERE stream_id = 'platform:tool-fabric:trust' AND seq = 4
  ) THEN
    RAISE EXCEPTION 'SECURITY FAILURE: aborted CAS changed committed trust state';
  END IF;
END;
$$;

-- A new, correctly based transaction must be able to retry the SAME receipt
-- ID without an orphan or false duplicate left by the failed attempt.
BEGIN;
INSERT INTO public.tool_fabric_trust_entry
  (stream_id, seq, audit_id, entry_hash, entry)
VALUES ('platform:tool-fabric:trust', 4,
  '00000000-0000-4000-8000-000000000041',
  repeat('4',64), '{"seq":4}'::jsonb);
UPDATE public.tool_fabric_trust_stream
SET revision = 4, head_hash = repeat('4',64), updated_at = now()
WHERE stream_id = 'platform:tool-fabric:trust'
  AND revision = 3 AND head_hash = repeat('3',64);
SET CONSTRAINTS tool_fabric_receipt_requires_head IMMEDIATE;
COMMIT;
