-- P0 #1037 migration 004: remove unqualified trigger lookups that can
-- resolve an attacker's pg_temp tables ahead of the canonical ledger.
-- Applied only by the approved DBA migration authority, never at runtime.
-- Replacing existing trigger functions preserves their OIDs and trigger
-- bindings. The independent rollback witness and host identity remain HOLD.
BEGIN;
LOCK TABLE public.tool_fabric_trust_stream IN SHARE ROW EXCLUSIVE MODE;
LOCK TABLE public.tool_fabric_trust_entry IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
  IF to_regprocedure('public.tool_fabric_guard_trust_head_cas()') IS NULL
     OR to_regprocedure('public.tool_fabric_require_receipt_head_at_commit()') IS NULL
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_trigger
       WHERE tgrelid = 'public.tool_fabric_trust_stream'::regclass
         AND tgname = 'tool_fabric_stream_monotonic_cas'
         AND tgfoid = 'public.tool_fabric_guard_trust_head_cas()'::regprocedure
         AND NOT tgisinternal
     )
     OR NOT EXISTS (
       SELECT 1 FROM pg_catalog.pg_trigger
       WHERE tgrelid = 'public.tool_fabric_trust_entry'::regclass
         AND tgname = 'tool_fabric_receipt_requires_head'
         AND tgfoid = 'public.tool_fabric_require_receipt_head_at_commit()'::regprocedure
         AND NOT tgisinternal
     ) THEN
    RAISE EXCEPTION 'Canonical trust triggers missing or rebound; refuse migration 004'
      USING ERRCODE = '23514';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.tool_fabric_guard_trust_head_cas()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $$
DECLARE
  committed_hash CHAR(64);
BEGIN
  IF NEW.stream_id IS DISTINCT FROM OLD.stream_id
     OR NEW.revision IS DISTINCT FROM OLD.revision + 1
     OR NEW.updated_at < OLD.updated_at THEN
    RAISE EXCEPTION 'Tool Fabric trust head update is not monotonic CAS'
      USING ERRCODE = '42501';
  END IF;
  -- Schema qualification is essential: pg_temp shadows unqualified relation
  -- names even when the caller has no CREATE permission on schema public.
  SELECT entry_hash INTO committed_hash
  FROM public.tool_fabric_trust_entry
  WHERE stream_id = OLD.stream_id AND seq = NEW.revision;
  IF committed_hash IS NULL OR NEW.head_hash IS DISTINCT FROM committed_hash THEN
    RAISE EXCEPTION 'Tool Fabric trust head has no matching durable receipt'
      USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.tool_fabric_require_receipt_head_at_commit()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER
SET search_path = pg_catalog, public, pg_temp AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.tool_fabric_trust_stream s
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
COMMIT;
