-- P0 #1037: schema-location contract after 001-004 were deliberately
-- applied with search_path=pg_temp. Canonical functions and triggers must
-- never be installed into a caller-controlled schema.
\set ON_ERROR_STOP on
DO $$
DECLARE
  function_count integer;
  trigger_count integer;
BEGIN
  SELECT count(*) INTO function_count
  FROM pg_catalog.pg_proc p
  JOIN pg_catalog.pg_namespace n ON n.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND p.proname IN (
      'tool_fabric_reject_trust_mutation',
      'tool_fabric_guard_trust_head_cas',
      'tool_fabric_require_receipt_head_at_commit'
    );
  SELECT count(*) INTO trigger_count
  FROM pg_catalog.pg_trigger t
  JOIN pg_catalog.pg_class c ON c.oid = t.tgrelid
  JOIN pg_catalog.pg_namespace n ON n.oid = c.relnamespace
  JOIN pg_catalog.pg_proc p ON p.oid = t.tgfoid
  JOIN pg_catalog.pg_namespace fn ON fn.oid = p.pronamespace
  WHERE n.nspname = 'public'
    AND fn.nspname = 'public'
    AND c.relname IN ('tool_fabric_trust_stream', 'tool_fabric_trust_entry')
    AND t.tgname IN (
      'tool_fabric_entry_immutable', 'tool_fabric_entry_no_truncate',
      'tool_fabric_stream_monotonic_cas', 'tool_fabric_stream_no_delete',
      'tool_fabric_stream_no_truncate', 'tool_fabric_receipt_requires_head'
    )
    AND NOT t.tgisinternal;
  IF function_count <> 3 OR trigger_count <> 6 THEN
    RAISE EXCEPTION 'Trust ledger migrations installed protections outside canonical public schema (functions %, triggers %)',
      function_count, trigger_count USING ERRCODE = '23514';
  END IF;
END;
$$;
