-- =============================================================================
-- 20261005_prod_rls_closure_twelve_tables.sql
--
-- Change record: CHG-2026-0110. Scope: production RLS enforcement for exactly
-- the 12 tables that failed `rls-verify.ts --mode=preflight` on production on
-- 2026-10-05 (1155/1167). No other table, grant, role or function is touched.
--
-- All 12 are public-schema tables. Production state before this migration:
-- relrowsecurity=false, relforcerowsecurity=false, 0 policies, 0 rows, and
-- union_eyes_runtime holds NO privileges on any of them. This migration does
-- NOT grant privileges (grants are out of scope; see CHG-2026-0110); it only
-- makes the manifest-required RLS enforcement true so that any later grant is
-- tenant-isolated by default.
--
-- Reuses the policy helpers already installed in production by 0108/round58
-- (idempotent: DROP POLICY IF EXISTS before CREATE). Geometry per
-- db/rls-storage-authority:
--   workbooks                            USER_RLS_REQUIRED       claimed_by_user_id
--   workbook_modules / _purchases /
--     _memory_holders / _lineage_entries PARENT_OWNED_RLS_REQUIRED via workbooks
--   audit_logs, organization_users        TENANT_RLS_REQUIRED     organization_id
--     (non-canonical public copies; the live tables are audit_security.audit_logs
--      and user_management.organization_users and are already enforced)
--   compliance_snapshots, domain_events, evidence_packs,
--     integration_idempotency_keys, integration_registry
--                                         TENANT_RLS_REQUIRED     org_id
--
-- Fail-closed: geometry is asserted before each call and the final block
-- asserts RLS + FORCE + a runtime policy (and the system policy) on all 12, or
-- the whole transaction rolls back. Rollback: 20261005_prod_rls_closure_twelve_tables_rollback.sql
-- =============================================================================

SET LOCAL search_path = public;

DO $$
DECLARE
  v_direct RECORD;
  v_child TEXT;
BEGIN
  -- workbooks: user-owned
  IF to_regclass('public.workbooks') IS NULL THEN
    RAISE EXCEPTION 'RLS closure: public.workbooks does not exist';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'workbooks' AND column_name = 'claimed_by_user_id') THEN
    RAISE EXCEPTION 'RLS closure: public.workbooks.claimed_by_user_id missing';
  END IF;
  PERFORM ue_create_user_rls_policy('workbooks', 'claimed_by_user_id');

  -- workbook children: parent-owned via workbooks.claimed_by_user_id
  FOREACH v_child IN ARRAY ARRAY['workbook_modules', 'workbook_purchases', 'workbook_memory_holders', 'workbook_governance_lineage_entries'] LOOP
    IF to_regclass('public.' || v_child) IS NULL THEN
      RAISE EXCEPTION 'RLS closure: public.% does not exist', v_child;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = v_child AND column_name = 'workbook_id') THEN
      RAISE EXCEPTION 'RLS closure: public.%.workbook_id missing', v_child;
    END IF;
    PERFORM ue_create_parent_owned_via_user_rls_policy_v2(v_child, 'workbook_id', 'workbooks', 'claimed_by_user_id');
  END LOOP;

  -- direct tenant tables (uuid org column; helper casts to text)
  FOR v_direct IN
    SELECT * FROM (VALUES
      ('audit_logs', 'organization_id'),
      ('organization_users', 'organization_id'),
      ('compliance_snapshots', 'org_id'),
      ('domain_events', 'org_id'),
      ('evidence_packs', 'org_id'),
      ('integration_idempotency_keys', 'org_id'),
      ('integration_registry', 'org_id')
    ) AS t(tbl, org_col)
  LOOP
    IF to_regclass('public.' || v_direct.tbl) IS NULL THEN
      RAISE EXCEPTION 'RLS closure: public.% does not exist', v_direct.tbl;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_direct.tbl AND column_name = v_direct.org_col AND data_type = 'uuid'
    ) THEN
      RAISE EXCEPTION 'RLS closure: public.%.% (uuid) missing', v_direct.tbl, v_direct.org_col;
    END IF;
    PERFORM ue_create_direct_org_rls_policy(v_direct.tbl, v_direct.org_col, FALSE);
  END LOOP;
END $$;

-- Post-condition: all 12 enforced, or roll back everything.
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(t.tbl, ', ') INTO v_bad
  FROM (VALUES
    ('workbooks'), ('workbook_modules'), ('workbook_purchases'), ('workbook_memory_holders'),
    ('workbook_governance_lineage_entries'), ('audit_logs'), ('organization_users'),
    ('compliance_snapshots'), ('domain_events'), ('evidence_packs'),
    ('integration_idempotency_keys'), ('integration_registry')
  ) AS t(tbl)
  JOIN pg_class c ON c.relname = t.tbl AND c.relnamespace = 'public'::regnamespace
  WHERE NOT c.relrowsecurity
     OR NOT c.relforcerowsecurity
     OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_runtime'::regrole = ANY (p.polroles))
     OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_system'::regrole = ANY (p.polroles));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'RLS closure post-condition failed for: %', v_bad;
  END IF;
END $$;
