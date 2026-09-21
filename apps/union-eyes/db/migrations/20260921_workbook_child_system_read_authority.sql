-- ─────────────────────────────────────────────────────────────────────────────
-- Workbook child-table system read/write authority (pre-claim bearer path)
--
-- Round 58 (20260910_rls_enforcement_expansion_round58.sql) revoked ALL
-- privileges from union_eyes_system on the workbook child tables and granted
-- only union_eyes_runtime:
--   workbook_memory_holders             → runtime SELECT, INSERT, UPDATE, DELETE
--   workbook_governance_lineage_entries → runtime SELECT
-- The ue_system_full_access RLS policy (USING(true) WITH CHECK(true) TO
-- union_eyes_system) created by ue_create_parent_owned_via_user_rls_policy_v2
-- permits system rows, but PostgreSQL evaluates table GRANTs BEFORE RLS, so
-- union_eyes_system was denied at the grant layer.
--
-- The claimed-workbook authority chain (lib/workbook/access-control.ts,
-- withClaimedWorkbookAccess) runs three principals:
--   - claimant  → tenant runtime, user context = claimant  (existing grants OK)
--   - same_org  → tenant runtime, user context = claimant  (existing grants OK)
--   - preclaim  → bounded system context                   (NEEDS these grants)
--
-- Pre-claim workbooks have claimed_by_user_id IS NULL and therefore cannot be
-- scoped by tenant user RLS (there is no claimant identity to bind to). Their
-- authoring (memory holders) and PDF export (lineage read) child access is
-- mediated by a bounded system context scoped to a single workbook_id. This
-- migration provisions the LEAST privilege that path requires, and nothing
-- more. Cross-workbook boundedness is enforced by the callback's
-- WHERE workbook_id = <this workbook> clause, not by widening RLS.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$ BEGIN
  IF to_regclass('workbook_memory_holders') IS NOT NULL THEN
    -- Pre-claim authoring: GET (SELECT), POST (INSERT), PATCH (UPDATE),
    -- DELETE (DELETE) run under the bounded system context.
    EXECUTE format(
      'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_system',
      'workbook_memory_holders'
    );
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('workbook_governance_lineage_entries') IS NOT NULL THEN
    -- Pre-claim PDF export reads governance lineage for the workbook narrative.
    -- These routes never write lineage, so SELECT is sufficient.
    EXECUTE format(
      'GRANT SELECT ON TABLE %I TO union_eyes_system',
      'workbook_governance_lineage_entries'
    );
  END IF;
END $$;
