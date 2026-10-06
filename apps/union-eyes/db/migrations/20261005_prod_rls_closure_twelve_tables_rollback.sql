-- =============================================================================
-- 20261005_prod_rls_closure_twelve_tables_rollback.sql
--
-- Change record: CHG-2026-0110. Reverts 20261005_prod_rls_closure_twelve_tables.sql
-- on exactly those 12 tables: drops the policies it created, then NO FORCE and
-- DISABLE ROW LEVEL SECURITY, returning them to their pre-change state
-- (RLS off, FORCE off, no policies). Safe because union_eyes_runtime holds no
-- privileges on these tables and they held 0 rows when this change was made.
-- Re-running is a no-op.
-- =============================================================================

SET LOCAL search_path = public;

DO $$
DECLARE
  v_tbl TEXT;
  v_pol TEXT;
BEGIN
  FOREACH v_tbl IN ARRAY ARRAY[
    'workbooks', 'workbook_modules', 'workbook_purchases', 'workbook_memory_holders',
    'workbook_governance_lineage_entries', 'audit_logs', 'organization_users',
    'compliance_snapshots', 'domain_events', 'evidence_packs',
    'integration_idempotency_keys', 'integration_registry'
  ] LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN
      CONTINUE;
    END IF;
    FOREACH v_pol IN ARRAY ARRAY[
      'ue_org_isolation_select', 'ue_org_isolation_insert', 'ue_org_isolation_update', 'ue_org_isolation_delete',
      'ue_user_isolation_select', 'ue_user_isolation_insert', 'ue_user_isolation_update', 'ue_user_isolation_delete',
      'ue_parent_user_isolation_v2', 'ue_system_full_access'
    ] LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', v_pol, v_tbl);
    END LOOP;
    EXECUTE format('ALTER TABLE public.%I NO FORCE ROW LEVEL SECURITY', v_tbl);
    EXECUTE format('ALTER TABLE public.%I DISABLE ROW LEVEL SECURITY', v_tbl);
  END LOOP;
END $$;
