-- P0 #1037: adversarial PostgreSQL 16 regression for temp-schema
-- relation shadowing. Test role has only the canonical writer privileges
-- plus default TEMP privilege. No production authority is granted.
-- Requires committed rev=2 fixture; everything here rolls back.
\set ON_ERROR_STOP on
BEGIN;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tool_fabric_trust_stream
    WHERE stream_id='platform:tool-fabric:trust'
      AND revision=2 AND head_hash=repeat('2',64)
  ) THEN
    RAISE EXCEPTION 'Expected committed revision-2 trust fixture';
  END IF;
END;
$$;
CREATE ROLE tool_fabric_shadow_writer NOLOGIN;
GRANT USAGE ON SCHEMA public TO tool_fabric_shadow_writer;
GRANT SELECT ON public.tool_fabric_trust_stream, public.tool_fabric_trust_entry
  TO tool_fabric_shadow_writer;
GRANT INSERT (stream_id, seq, audit_id, entry_hash, entry)
  ON public.tool_fabric_trust_entry TO tool_fabric_shadow_writer;
GRANT UPDATE (revision, head_hash, updated_at)
  ON public.tool_fabric_trust_stream TO tool_fabric_shadow_writer;
SET LOCAL ROLE tool_fabric_shadow_writer;

-- pg_temp takes precedence for unqualified table names. These attacker-
-- controlled objects must not satisfy either canonical trigger's lookup.
CREATE TEMP TABLE tool_fabric_trust_entry (
  stream_id TEXT, seq BIGINT, entry_hash CHAR(64)
) ON COMMIT DROP;
INSERT INTO pg_temp.tool_fabric_trust_entry VALUES
  ('platform:tool-fabric:trust', 3, repeat('f',64));
CREATE TEMP TABLE tool_fabric_trust_stream (
  stream_id TEXT, revision BIGINT, head_hash CHAR(64)
) ON COMMIT DROP;
INSERT INTO pg_temp.tool_fabric_trust_stream VALUES
  ('platform:tool-fabric:trust', 3, repeat('f',64));

DO $$
BEGIN
  IF to_regclass('tool_fabric_trust_entry') IS DISTINCT FROM
       to_regclass('pg_temp.tool_fabric_trust_entry')
     OR to_regclass('tool_fabric_trust_stream') IS DISTINCT FROM
       to_regclass('pg_temp.tool_fabric_trust_stream') THEN
    RAISE EXCEPTION 'Shadow tables did not take precedence: test invalid';
  END IF;
  BEGIN
    -- The old unqualified head trigger could accept the forged temp receipt.
    UPDATE public.tool_fabric_trust_stream
      SET revision=3, head_hash=repeat('f',64), updated_at=now()
      WHERE stream_id='platform:tool-fabric:trust'
        AND revision=2 AND head_hash=repeat('2',64);
    RAISE EXCEPTION 'SECURITY FAILURE: temp receipt spoof advanced real head';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    -- The old deferred trigger could accept a forged temp stream head.
    INSERT INTO public.tool_fabric_trust_entry
      (stream_id, seq, audit_id, entry_hash, entry)
    VALUES ('platform:tool-fabric:trust', 3,
      '00000000-0000-4000-8000-000000000043',
      repeat('f',64), '{"seq":3}'::jsonb);
    EXECUTE 'SET CONSTRAINTS tool_fabric_receipt_requires_head IMMEDIATE';
    RAISE EXCEPTION 'SECURITY FAILURE: temp stream spoof committed orphan receipt';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  IF EXISTS (SELECT 1 FROM public.tool_fabric_trust_entry
             WHERE stream_id='platform:tool-fabric:trust' AND seq=3)
     OR NOT EXISTS (
       SELECT 1 FROM public.tool_fabric_trust_stream
       WHERE stream_id='platform:tool-fabric:trust'
         AND revision=2 AND head_hash=repeat('2',64)
     ) THEN
    RAISE EXCEPTION 'SECURITY FAILURE: temp shadow attack changed durable ledger';
  END IF;
END;
$$;
ROLLBACK;
