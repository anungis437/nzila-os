-- NzilaOS PR-UE-02: Enable RLS org-scoping for org-scoped tables
-- 
-- This migration adds RLS policies that enforce org isolation at the
-- database level. Every org-scoped table gets a policy that restricts
-- SELECT/INSERT/UPDATE/DELETE to the current org context.
--
-- The app.current_org_id session variable is set by withRLSContext()
-- in apps/union-eyes/lib/db/with-rls-context.ts
--
-- Run: psql $DATABASE_URL < this-file.sql
-- Rollback: See bottom of file for DROP POLICY statements

-- Helper: Create org isolation policy on a table
-- Usage: SELECT create_org_rls_policy('table_name', 'org_id_column');
CREATE OR REPLACE FUNCTION create_org_rls_policy(
  p_table_name TEXT,
  p_org_column TEXT DEFAULT 'org_id'
) RETURNS VOID AS $$
BEGIN
  -- Enable RLS on the table
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  
  -- Force RLS even for table owners (prevents bypassing in superuser context)
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);
  
  -- Create org isolation policy for SELECT
  EXECUTE format(
    'CREATE POLICY org_isolation_select ON %I FOR SELECT USING (%I = current_setting(''app.current_org_id'', true)::text)',
    p_table_name, p_org_column
  );
  
  -- Create org isolation policy for INSERT
  EXECUTE format(
    'CREATE POLICY org_isolation_insert ON %I FOR INSERT WITH CHECK (%I = current_setting(''app.current_org_id'', true)::text)',
    p_table_name, p_org_column
  );
  
  -- Create org isolation policy for UPDATE
  EXECUTE format(
    'CREATE POLICY org_isolation_update ON %I FOR UPDATE USING (%I = current_setting(''app.current_org_id'', true)::text)',
    p_table_name, p_org_column
  );
  
  -- Create org isolation policy for DELETE
  EXECUTE format(
    'CREATE POLICY org_isolation_delete ON %I FOR DELETE USING (%I = current_setting(''app.current_org_id'', true)::text)',
    p_table_name, p_org_column
  );
  
  -- System bypass policy (for withSystemContext — empty org_id)
  EXECUTE format(
    'CREATE POLICY system_bypass ON %I USING (current_setting(''app.current_org_id'', true) = '''' OR current_setting(''app.current_org_id'', true) IS NULL)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

-- ═══════════════════════════════════════════════════════════════════════
-- Apply org RLS to key UE org-scoped tables
-- These are the tables with org_id columns used in the rewards/leaderboard
-- and analytics pages identified in the alignment audit.
-- ═══════════════════════════════════════════════════════════════════════

SELECT create_org_rls_policy('recognition_awards', 'org_id');
SELECT create_org_rls_policy('reward_wallet_ledger', 'org_id');
SELECT create_org_rls_policy('reward_budget_envelopes', 'org_id');
SELECT create_org_rls_policy('reward_redemptions', 'org_id');
SELECT create_org_rls_policy('recognition_programs', 'org_id');

-- Additional org-scoped tables (extend as needed during onboarding)
-- SELECT create_org_rls_policy('organization_members', 'organization_id');
-- SELECT create_org_rls_policy('claims', 'organization_id');
-- SELECT create_org_rls_policy('grievances', 'organization_id');

-- ═══════════════════════════════════════════════════════════════════════
-- ROLLBACK (uncomment to remove all org RLS policies)
-- ═══════════════════════════════════════════════════════════════════════
-- DROP POLICY IF EXISTS org_isolation_select ON recognition_awards;
-- DROP POLICY IF EXISTS org_isolation_insert ON recognition_awards;
-- DROP POLICY IF EXISTS org_isolation_update ON recognition_awards;
-- DROP POLICY IF EXISTS org_isolation_delete ON recognition_awards;
-- DROP POLICY IF EXISTS system_bypass ON recognition_awards;
-- ALTER TABLE recognition_awards DISABLE ROW LEVEL SECURITY;
-- (repeat for each table)

-- Clean up helper function
-- DROP FUNCTION IF EXISTS create_org_rls_policy(TEXT, TEXT);
