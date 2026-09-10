-- =============================================================================
-- 20260910_rls_enforcement_expansion_round58.sql
--
-- Round 58 Phase 1+ — GENERATED, do not hand-edit. Regenerate via
-- `pnpm --filter @nzila/union-eyes rls:generate-enforcement` (which runs
-- scripts/rls-enforcement/generate-rls-enforcement-migration.ts) and commit
-- the result. `pnpm --filter @nzila/union-eyes rls:check-enforcement` fails
-- CI if a regeneration would produce different bytes than what is committed
-- (drift ratchet) — see scripts/rls-enforcement/check-enforcement-drift.ts.
--
-- Forward-only: this migration NEVER edits 0108 or any historical
-- migration. It is idempotent (every generated statement is itself
-- idempotent — DROP POLICY IF EXISTS / CREATE OR REPLACE FUNCTION /
-- REVOKE ALL then explicit GRANT).
--
-- COVERAGE (see reports/union-eyes-rls-enforcement-blockers.json for the
-- full list of tables this generation run could NOT confidently resolve):
--   Policies generated this run: 322
--   Tables blocked (geometry unresolved / ambiguous): 0
--   GRANT blocks generated (covers all 795 manifest entries): 795
--
-- Blanket grant removal gate satisfied at generation time: true
-- 0108's predecessor blanket GRANT is narrowed by PART E below (see reports/
-- union-eyes-authority-enforcement-round58.md for the full finding).
-- =============================================================================

-- =============================================================================
-- Round 58 Phase 1+ — generalized policy-helper functions for classification
-- shapes 0108 did not need. Each mirrors 0108's own ue_create_direct_org_rls_
-- policy / ue_create_parent_owned_rls_policy pattern: idempotent (DROP POLICY
-- IF EXISTS before CREATE), fail-closed (no policy => union_eyes_runtime sees
-- zero rows), and grants union_eyes_system unconditional access via a
-- separate, role-membership-gated policy (never inferred from session state).
-- =============================================================================

CREATE OR REPLACE FUNCTION ue_create_parent_owned_rls_policy_v2(
  p_table_name TEXT,
  p_fk_column TEXT,
  p_parent_table TEXT,
  p_parent_org_column TEXT DEFAULT 'organization_id',
  p_parent_org_is_text BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
  v_cast TEXT := CASE WHEN p_parent_org_is_text THEN '' ELSE '::text' END;
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_parent_org_isolation_v2 ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  EXECUTE format(
    'CREATE POLICY ue_parent_org_isolation_v2 ON %I FOR ALL TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I%s = current_setting(''app.current_org_id'', true))) ' ||
    'WITH CHECK (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I%s = current_setting(''app.current_org_id'', true)))',
    p_table_name, p_parent_table, p_table_name, p_fk_column, p_parent_org_column, v_cast,
    p_parent_table, p_table_name, p_fk_column, p_parent_org_column, v_cast
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_user_rls_policy(
  p_table_name TEXT,
  p_user_column TEXT DEFAULT 'user_id'
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Round 59 staging proof fix: ai_copilot_sessions.user_id is UUID (not
  -- every user_id column in this codebase is TEXT like the Clerk-to-Entra
  -- id columns), and Postgres has no uuid = text operator. Cast the column
  -- to text unconditionally (a no-op for columns already TEXT) — same
  -- defensive pattern every other policy-helper function in this file
  -- already uses for its org_id comparisons.
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true))',
    p_table_name, p_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_mixed_global_tenant_rls_policy(
  p_table_name TEXT,
  p_org_column TEXT DEFAULT 'organization_id'
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_mixed_global_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_mixed_global_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_mixed_global_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_mixed_global_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Reads: global (NULL) rows OR the caller's own org's rows.
  EXECUTE format(
    'CREATE POLICY ue_mixed_global_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I IS NULL OR %I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, p_org_column
  );
  -- Writes: a tenant may only author/mutate/delete ITS OWN rows — never a
  -- NULL/global row, and WITH CHECK re-verifies the same predicate so a
  -- tenant cannot reassign a row into (or out of) the global class.
  EXECUTE format(
    'CREATE POLICY ue_mixed_global_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_mixed_global_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_mixed_global_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_multi_party_rls_policy(
  p_table_name TEXT,
  p_org_column_a TEXT,
  p_org_column_b TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_multi_party_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Reads: either named party may see the row. NO tenant-facing INSERT/
  -- UPDATE/DELETE policy is created at all — per this classification's own
  -- doctrine (types.ts), writes require a genuinely separate system/
  -- platform authority, never assumed from ordinary tenant authentication.
  -- Falling through with no policy means union_eyes_runtime's writes are
  -- fail-closed-denied by RLS (FORCE RLS + no permissive write policy).
  EXECUTE format(
    'CREATE POLICY ue_multi_party_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true) ' ||
    '    OR %I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column_a, p_org_column_b
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

-- Round 58C additions ---------------------------------------------------

CREATE OR REPLACE FUNCTION ue_create_parent_owned_via_user_rls_policy_v2(
  p_table_name TEXT,
  p_fk_column TEXT,
  p_parent_table TEXT,
  p_parent_user_column TEXT DEFAULT 'user_id'
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_parent_user_isolation_v2 ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Same shape as ue_create_parent_owned_rls_policy_v2, but the parent's
  -- own authority column is a USER identity (app.current_user_id), not an
  -- organization (e.g. workbooks' claimed_by_user_id) — used for tables
  -- whose USER_RLS_REQUIRED authority is only reachable through a parent.
  -- Round 59 staging proof fix: cast the parent's user column to text
  -- unconditionally (no-op if already TEXT) — see ue_create_user_rls_policy.
  EXECUTE format(
    'CREATE POLICY ue_parent_user_isolation_v2 ON %I FOR ALL TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I::text = current_setting(''app.current_user_id'', true))) ' ||
    'WITH CHECK (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I::text = current_setting(''app.current_user_id'', true)))',
    p_table_name, p_parent_table, p_table_name, p_fk_column, p_parent_user_column,
    p_parent_table, p_table_name, p_fk_column, p_parent_user_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_shared_library_rls_policy(
  p_table_name TEXT,
  p_org_column TEXT,
  p_sharing_level_column TEXT,
  p_shared_with_column TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- Reads: owner org, OR explicitly shared-with org, OR sharing_level =
  -- 'public'. 'federation'/'congress' sharing levels are deliberately NOT
  -- given any additional visibility beyond owner/shared-with/public — no
  -- federation/congress-membership table exists in this schema to resolve
  -- them against (round 58c finding); this is a safe, under-permissive
  -- default, not a broadening of access.
  EXECUTE format(
    'CREATE POLICY ue_shared_library_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true) ' ||
    '    OR current_setting(''app.current_org_id'', true)::uuid = ANY(%I) ' ||
    '    OR %I = ''public'')',
    p_table_name, p_org_column, p_shared_with_column, p_sharing_level_column
  );
  -- Writes: owner org only — shared/public readability never confers
  -- source mutation authority.
  EXECUTE format(
    'CREATE POLICY ue_shared_library_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_shared_library_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_shared_library_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION ue_create_shared_library_child_rls_policy(
  p_table_name TEXT,
  p_fk_column TEXT
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_child_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_child_write ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  -- A child row (e.g. clause_library_tags) is visible/writable exactly
  -- when the parent shared_clause_library row it tags would itself be
  -- visible/writable under ue_create_shared_library_rls_policy's own
  -- predicate — hardcoded here because there is exactly one such parent
  -- table in this schema.
  EXECUTE format(
    'CREATE POLICY ue_shared_library_child_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM shared_clause_library parent WHERE parent.id = %I.%I ' ||
    '  AND (parent.source_organization_id::text = current_setting(''app.current_org_id'', true) ' ||
    '    OR current_setting(''app.current_org_id'', true)::uuid = ANY(parent.shared_with_org_ids) ' ||
    '    OR parent.sharing_level = ''public'')))',
    p_table_name, p_table_name, p_fk_column
  );
  EXECUTE format(
    'CREATE POLICY ue_shared_library_child_write ON %I FOR ALL TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM shared_clause_library parent WHERE parent.id = %I.%I ' ||
    '  AND parent.source_organization_id::text = current_setting(''app.current_org_id'', true))) ' ||
    'WITH CHECK (EXISTS (SELECT 1 FROM shared_clause_library parent WHERE parent.id = %I.%I ' ||
    '  AND parent.source_organization_id::text = current_setting(''app.current_org_id'', true)))',
    p_table_name, p_table_name, p_fk_column, p_table_name, p_fk_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART B — policy application (one call per resolved manifest entry)
-- =============================================================================

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_clause_reasonings') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('ai_clause_reasonings', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'ai_copilot_sessions') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('ai_copilot_sessions', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'ai_insight_reports') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('ai_insight_reports', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'ai_usage_metrics') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('ai_usage_metrics', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'analytics_metrics') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('analytics_metrics', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'customer_nps_surveys') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'customer_nps_surveys');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'customer_nps_surveys');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'customer_nps_surveys');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'customer_nps_surveys');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_risk_scores') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_risk_scores', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'icra_continuity_scores') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'icra_continuity_scores');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'icra_continuity_scores');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'icra_continuity_scores');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'icra_continuity_scores');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'icra_followup_recommendations') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'icra_followup_recommendations');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'icra_followup_recommendations');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'icra_followup_recommendations');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'icra_followup_recommendations');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'insight_recommendations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('insight_recommendations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'ml_predictions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('ml_predictions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'model_metadata') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('model_metadata', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_metrics') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pilot_metrics', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'social_analytics') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('social_analytics', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'claim_deadlines') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('claim_deadlines', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'deadline_reminders') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('deadline_reminders', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_case_access_assignments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('grievance_case_access_assignments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'ai_grievance_triages') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('ai_grievance_triages', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'arbitrations') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('arbitrations', 'grievance_id', 'grievances', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'bargaining_notes') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('bargaining_notes', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'bargaining_units') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('bargaining_units', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'case_documents') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('case_documents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'cba_clauses') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('cba_clauses', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'cba_rule_set_items') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('cba_rule_set_items', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'cba_rule_versions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('cba_rule_versions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'collective_agreements') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('collective_agreements', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_insurance_claims') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_insurance_claims', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_documents') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('grievance_documents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_settlements') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('grievance_settlements', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_timeline_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('grievance_timeline_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_transitions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('grievance_transitions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pension_benefit_claims') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pension_benefit_claims', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'settlements') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('settlements', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'wcb_claims') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('wcb_claims', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'arbitration_precedents') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('arbitration_precedents', 'source_organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'bargaining_proposals') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('bargaining_proposals', 'negotiation_id', 'negotiations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'claim_updates') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('claim_updates', 'claim_id', 'claims', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_events') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('grievance_events', 'grievance_id', 'grievances', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_timeline') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('grievance_timeline', 'grievance_id', 'grievances', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'campaigns') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('campaigns', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'chat_sessions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('chat_sessions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'communication_preferences') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('communication_preferences', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'consent_records') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('consent_records', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'cookie_consents') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('cookie_consents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'data_aggregation_consent') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('data_aggregation_consent', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'donation_campaigns') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('donation_campaigns', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_communications') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_communications', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_communication_channels') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_communication_channels', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_communication_messages') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_communication_messages', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_communication_users') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_communication_users', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'in_app_notifications') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('in_app_notifications', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'message_log') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('message_log', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_campaigns') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('newsletter_campaigns', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_distribution_lists') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('newsletter_distribution_lists', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'notification_delivery_log') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('notification_delivery_log', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'notification_queue') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('notification_queue', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'notification_tracking') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('notification_tracking', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'notifications') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('notifications', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'organizing_campaigns') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('organizing_campaigns', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'push_notifications') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('push_notifications', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'sms_campaigns') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('sms_campaigns', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'sms_conversations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('sms_conversations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'sms_messages') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('sms_messages', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'social_campaigns') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('social_campaigns', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'user_consents') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('user_consents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'user_notification_preferences') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('user_notification_preferences', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'chat_messages') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('chat_messages', 'session_id', 'chat_sessions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_list_subscribers') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('newsletter_list_subscribers', 'list_id', 'newsletter_distribution_lists', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_recipients') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('newsletter_recipients', 'campaign_id', 'newsletter_campaigns', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'provincial_consent') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('provincial_consent', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'cms_media_library') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('cms_media_library', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'document_access_grants') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('document_access_grants', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'document_folders') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('document_folders', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'document_links') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('document_links', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'document_versions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('document_versions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_evidence_links') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_execution_evidence_links', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_profiles') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_execution_profiles', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'exit_interview_documents') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('exit_interview_documents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_communication_files') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_communication_files', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'icra_maturity_profiles') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'icra_maturity_profiles');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'icra_maturity_profiles');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'icra_maturity_profiles');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'icra_maturity_profiles');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'message_templates') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('message_templates', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'notification_templates') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('notification_templates', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'signature_documents') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('signature_documents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'document_signers') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('document_signers', 'document_id', 'signature_documents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'profiles') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('profiles', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'account_mappings') IS NOT NULL THEN
    PERFORM ue_create_mixed_global_tenant_rls_policy('account_mappings', 'organization_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'bank_accounts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('bank_accounts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'bank_reconciliation') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('bank_reconciliation', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'bank_reconciliations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('bank_reconciliations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'billing_accounts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('billing_accounts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'billing_periods') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('billing_periods', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'billing_subscriptions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('billing_subscriptions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'budget_pool') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('budget_pool', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'chart_of_accounts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('chart_of_accounts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'clc_remittance_mapping') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('clc_remittance_mapping', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'cost_centers') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('cost_centers', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'dues_assignments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('dues_assignments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'dues_rates') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('dues_rates', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'dues_transactions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('dues_transactions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_payroll_run_items') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('employer_payroll_run_items', 'payroll_run_id', 'employer_payroll_runs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_payroll_runs') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_payroll_runs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_remittance_run_items') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('employer_remittance_run_items', 'remittance_run_id', 'employer_remittance_runs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_remittance_runs') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_remittance_runs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_remittances') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_remittances', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'entitlement_usage_log') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('entitlement_usage_log', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'erp_invoices') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('erp_invoices', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'financial_periods') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('financial_periods', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'gl_account_mappings') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('gl_account_mappings', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'gl_transaction_log') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('gl_transaction_log', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'gl_trial_balance') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('gl_trial_balance', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'payment_cycles') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('payment_cycles', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'payment_disputes') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('payment_disputes', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'payment_methods') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('payment_methods', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'payment_plans') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('payment_plans', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'payments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('payments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'payroll_deductions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('payroll_deductions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pension_contributions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pension_contributions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pension_plans') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pension_plans', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pension_t4a_records') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pension_t4a_records', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pension_trustee_meetings') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pension_trustee_meetings', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pension_trustees') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pension_trustees', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'per_capita_remittances') IS NOT NULL THEN
    PERFORM ue_create_multi_party_rls_policy('per_capita_remittances', 'from_organization_id', 'to_organization_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'platform_cost_ledger_entries') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('platform_cost_ledger_entries', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'platform_invoices') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('platform_invoices', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'platform_payments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('platform_payments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'reconciliation_exceptions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('reconciliation_exceptions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'reconciliation_runs') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('reconciliation_runs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'remittance_exceptions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('remittance_exceptions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'remittance_line_items') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('remittance_line_items', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'reward_budget_envelopes') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('reward_budget_envelopes', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'reward_wallet_ledger') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('reward_wallet_ledger', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'social_accounts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('social_accounts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'subscription_events_log') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('subscription_events_log', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'payment_allocations') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('payment_allocations', 'payment_id', 'platform_payments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'platform_invoice_line_items') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('platform_invoice_line_items', 'invoice_id', 'platform_invoices', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'reconciliation_matches') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('reconciliation_matches', 'run_id', 'reconciliation_runs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'remittance_approvals') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'remittance_approvals');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'remittance_approvals');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'remittance_approvals');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'remittance_approvals');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'strike_fund_disbursements') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('strike_fund_disbursements', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'board_packets') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('board_packets', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'committee_action_items') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('committee_action_items', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'committee_documents') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('committee_documents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'committee_intelligence_snapshots') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('committee_intelligence_snapshots', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'committee_meetings') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('committee_meetings', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'committees') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('committees', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'governance_policies') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('governance_policies', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'icra_governance_flags') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'icra_governance_flags');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'icra_governance_flags');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'icra_governance_flags');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'icra_governance_flags');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'joint_hs_committees') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('joint_hs_committees', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'board_packet_distributions') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('board_packet_distributions', 'packet_id', 'board_packets', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'committee_meeting_attendees') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('committee_meeting_attendees', 'meeting_id', 'committee_meetings', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'council_elections') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'council_elections');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'council_elections');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'council_elections');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'council_elections');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'golden_shares') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'golden_shares');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'golden_shares');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'golden_shares');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'golden_shares');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'governance_events') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'governance_events');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'governance_events');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'governance_events');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'governance_events');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'mission_audits') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'mission_audits');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'mission_audits');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'mission_audits');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'mission_audits');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'reserved_matter_votes') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'reserved_matter_votes');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'reserved_matter_votes');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'reserved_matter_votes');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'reserved_matter_votes');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_governance_lineage_entries') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_via_user_rls_policy_v2('workbook_governance_lineage_entries', 'workbook_id', 'workbooks', 'claimed_by_user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'deadline_audit_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('deadline_audit_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'ai_safety_filters') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('ai_safety_filters', 'session_id', 'chat_sessions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'correspondence_audit_trail') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('correspondence_audit_trail', 'correspondence_id', 'correspondence', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'location_tracking_audit') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('location_tracking_audit', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'signature_audit_trail') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('signature_audit_trail', 'document_id', 'signature_documents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'api_integrations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('api_integrations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'clc_sync_log') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('clc_sync_log', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_timesheet_batches') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_timesheet_batches', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_accounts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_accounts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_coverage') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_benefit_coverage', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_dependents') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_benefit_dependents', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_enrollments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_benefit_enrollments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_plans') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_benefit_plans', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_utilization') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_benefit_utilization', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_calendar_connections') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_calendar_connections', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_customers') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_customers', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_departments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_departments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_employees') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_employees', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_insurance_beneficiaries') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_insurance_beneficiaries', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_insurance_policies') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_insurance_policies', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_invoices') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_invoices', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_completions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_lms_completions', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_courses') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_lms_courses', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_enrollments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_lms_enrollments', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_learners') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_lms_learners', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_progress') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_lms_progress', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_payments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_payments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'external_positions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('external_positions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'ingestion_batches') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('ingestion_batches', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'integration_api_keys') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('integration_api_keys', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'integration_configs') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('integration_configs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'integration_partners') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('integration_partners', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'integration_sync_log') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('integration_sync_log', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'integration_webhooks') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('integration_webhooks', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'ingestion_records') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('ingestion_records', 'batch_id', 'ingestion_batches', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'webhook_receipts') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'webhook_receipts');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'webhook_receipts');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'webhook_receipts');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'webhook_receipts');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'clc_organization_sync_log') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'clc_organization_sync_log');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'clc_organization_sync_log');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'clc_organization_sync_log');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'clc_organization_sync_log');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'icra_organizations') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'icra_organizations');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'icra_organizations');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'icra_organizations');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'icra_organizations');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_arrears') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('member_arrears', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_breaks') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('member_breaks', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_certifications') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('member_certifications', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_dues_issues') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('member_dues_issues', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_dues_ledger') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('member_dues_ledger', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_employment') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('member_employment', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_history_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('member_history_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_jurisdiction_preferences') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('member_jurisdiction_preferences', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_segments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('member_segments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'org_entitlements') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('org_entitlements', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'org_subscriptions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('org_subscriptions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'organization_billing_config') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'organization_billing_config');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'organization_billing_config');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'organization_billing_config');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'organization_billing_config');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pension_members') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pension_members', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'duplicate_group_members') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('duplicate_group_members', 'group_id', 'duplicate_groups', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'member_location_consent') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('member_location_consent', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_applications') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pilot_applications', 'verified_organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'org_configurations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('org_configurations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'organization_relationships') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'organization_relationships');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'organization_relationships');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'organization_relationships');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'organization_relationships');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'alert_rules') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('alert_rules', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_rules') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('allocation_rules', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'anti_scab_violations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('anti_scab_violations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'automation_rules') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('automation_rules', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'break_policies') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('break_policies', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'calendar_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('calendar_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'calendars') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('calendars', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'chargeback_statements') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('chargeback_statements', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'clause_comparisons') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('clause_comparisons', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'cms_pages') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('cms_pages', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'cnesst_filings') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('cnesst_filings', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'compliance_alerts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('compliance_alerts', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'contract_covered_orgs') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('contract_covered_orgs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'correspondence') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('correspondence', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'course_registrations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('course_registrations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'course_sessions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('course_sessions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'customer_onboarding_milestones') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'customer_onboarding_milestones');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'customer_onboarding_milestones');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'customer_onboarding_milestones');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'customer_onboarding_milestones');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'data_quality_warnings') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('data_quality_warnings', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'defensibility_packs') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('defensibility_packs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'dispatch_requests') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('dispatch_requests', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'dispatch_rules') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('dispatch_rules', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'duplicate_groups') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('duplicate_groups', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_contacts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_contacts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_artifacts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_execution_artifacts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_compliance_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_execution_compliance_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_replays') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_execution_replays', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_timesheet_entries') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employer_timesheet_entries', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employers') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('employers', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'exit_interview_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('exit_interview_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'exit_interviews') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('exit_interviews', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'federations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('federations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'fee_adjustments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('fee_adjustments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'gdpr_data_requests') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('gdpr_data_requests', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'holidays') IS NOT NULL THEN
    PERFORM ue_create_mixed_global_tenant_rls_policy('holidays', 'organization_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'icra_assessments') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'icra_assessments');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'icra_assessments');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'icra_assessments');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'icra_assessments');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'icra_assessment_answers') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'icra_assessment_answers');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'icra_assessment_answers');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'icra_assessment_answers');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'icra_assessment_answers');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'knowledge_base') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('knowledge_base', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'kpi_configurations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('kpi_configurations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'meeting_rooms') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('meeting_rooms', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'mobile_devices') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('mobile_devices', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'negotiations') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('negotiations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'organizer_tasks') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('organizer_tasks', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pay_equity_exercises') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pay_equity_exercises', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_checklist_items') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pilot_checklist_items', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_demo_seeds') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pilot_demo_seeds', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_enrollments') IS NOT NULL THEN
    PERFORM ue_create_mixed_global_tenant_rls_policy('pilot_enrollments', 'organization_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pilot_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_feedback') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pilot_feedback', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_milestones') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('pilot_milestones', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'policy_rules') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('policy_rules', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'poll_votes') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('poll_votes', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'polls') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('polls', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'preventive_withdrawals') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('preventive_withdrawals', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'push_devices') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('push_devices', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'recognition_award_types') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('recognition_award_types', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'recognition_awards') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('recognition_awards', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'recognition_programs') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('recognition_programs', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'reports') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('reports', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'reward_redemptions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('reward_redemptions', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'right_of_refusal_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('right_of_refusal_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'satisfaction_surveys') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('satisfaction_surveys', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'security_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('security_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'security_posture_checks') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('security_posture_checks', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'social_posts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('social_posts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'sso_providers') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('sso_providers', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'steward_assignments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('steward_assignments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'stewards') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('stewards', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'strategic_goals') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('strategic_goals', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'support_tickets') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'support_tickets');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'support_tickets');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'support_tickets');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'support_tickets');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'survey_answers') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('survey_answers', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'survey_questions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('survey_questions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'survey_responses') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('survey_responses', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'surveys') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('surveys', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'training_courses') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('training_courses', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'training_programs') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('training_programs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'transaction_fee_events') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('transaction_fee_events', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'transaction_fee_rules') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('transaction_fee_rules', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'trend_analyses') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('trend_analyses', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'user_signatures') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('user_signatures', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'voting_sessions') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('voting_sessions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'wcb_employer_assessments') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('wcb_employer_assessments', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'worksites') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('worksites', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'alert_executions') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('alert_executions', 'alert_rule_id', 'alert_rules', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_runs') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('allocation_runs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_basis_snapshots') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('allocation_basis_snapshots', 'run_id', 'allocation_runs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_rule_versions') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('allocation_rule_versions', 'rule_id', 'allocation_rules', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_run_lines') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('allocation_run_lines', 'run_id', 'allocation_runs', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'clause_embeddings') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('clause_embeddings', 'clause_id', 'cba_clauses', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'clause_library_tags') IS NOT NULL THEN
    PERFORM ue_create_shared_library_child_rls_policy('clause_library_tags', 'clause_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'commercial_contracts') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('commercial_contracts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'contract_line_items') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('contract_line_items', 'contract_id', 'commercial_contracts', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'correspondence_recipients') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('correspondence_recipients', 'correspondence_id', 'correspondence', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'data_subject_access_requests') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('data_subject_access_requests', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'dispatch_assignments') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('dispatch_assignments', 'request_id', 'dispatch_requests', 'org_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'employer_reports') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('employer_reports', 'employer_id', 'employers', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'geofence_events') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('geofence_events', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'geofences') IS NOT NULL THEN
    PERFORM ue_create_direct_org_rls_policy('geofences', 'union_local_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'location_tracking') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('location_tracking', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'policy_evaluations') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('policy_evaluations', 'rule_id', 'policy_rules', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'policy_exceptions') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('policy_exceptions', 'rule_id', 'policy_rules', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'provincial_data_handling') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('provincial_data_handling', 'user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'shared_clause_library') IS NOT NULL THEN
    PERFORM ue_create_shared_library_rls_policy('shared_clause_library', 'source_organization_id', 'sharing_level', 'shared_with_org_ids');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'tentative_agreements') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('tentative_agreements', 'negotiation_id', 'negotiations', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'union_density') IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', 'union_density');
    EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', 'union_density');
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', 'union_density');
    EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', 'union_density');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'voter_eligibility') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('voter_eligibility', 'session_id', 'voting_sessions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'votes') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('votes', 'session_id', 'voting_sessions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'voting_options') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_rls_policy_v2('voting_options', 'session_id', 'voting_sessions', 'organization_id', FALSE);
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_memory_holders') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_via_user_rls_policy_v2('workbook_memory_holders', 'workbook_id', 'workbooks', 'claimed_by_user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_modules') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_via_user_rls_policy_v2('workbook_modules', 'workbook_id', 'workbooks', 'claimed_by_user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_purchases') IS NOT NULL THEN
    PERFORM ue_create_parent_owned_via_user_rls_policy_v2('workbook_purchases', 'workbook_id', 'workbooks', 'claimed_by_user_id');
  END IF;
END $$;
DO $$ BEGIN
  IF to_regclass('public.' || 'workbooks') IS NOT NULL THEN
    PERFORM ue_create_user_rls_policy('workbooks', 'claimed_by_user_id');
  END IF;
END $$;

-- =============================================================================
-- PART C — exact GRANT compiler (every manifest entry, all 700 tables)
-- =============================================================================

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_clause_reasonings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_clause_reasonings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_clause_reasonings');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'ai_clause_reasonings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_copilot_sessions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_copilot_sessions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_copilot_sessions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'ai_copilot_sessions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_insight_reports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_insight_reports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_insight_reports');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'ai_insight_reports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_rate_limits') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_rate_limits');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_rate_limits');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_usage_metrics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_usage_metrics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_usage_metrics');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'ai_usage_metrics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'analytics_metrics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'analytics_metrics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'analytics_metrics');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'analytics_metrics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'analytics_scheduled_reports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'analytics_scheduled_reports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'analytics_scheduled_reports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'customer_nps_surveys') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'customer_nps_surveys');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'customer_nps_surveys');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'customer_nps_surveys');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_risk_scores') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_risk_scores');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_risk_scores');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'employer_risk_scores');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_continuity_scores') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_continuity_scores');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_continuity_scores');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_followup_recommendations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_followup_recommendations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_followup_recommendations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_anonymized_metrics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_anonymized_metrics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_anonymized_metrics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'impact_metrics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'impact_metrics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'impact_metrics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'insight_recommendations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'insight_recommendations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'insight_recommendations');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'insight_recommendations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ml_predictions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ml_predictions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ml_predictions');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'ml_predictions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'mobile_analytics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'mobile_analytics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'mobile_analytics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'model_metadata') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'model_metadata');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'model_metadata');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'model_metadata');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'page_analytics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'page_analytics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'page_analytics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_metrics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pilot_metrics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pilot_metrics');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'pilot_metrics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'social_analytics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'social_analytics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'social_analytics');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'social_analytics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'usage_aggregates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'usage_aggregates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'usage_aggregates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'usage_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'usage_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'usage_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'usage_meters') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'usage_meters');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'usage_meters');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'user_engagement_scores') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'user_engagement_scores');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'user_engagement_scores');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organization_members') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organization_members');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organization_members');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'organization_members');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_system', 'organization_members');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organizations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organizations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organizations');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_runtime', 'organizations');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_system', 'organizations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievances') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievances');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievances');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'grievances');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'claims') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'claims');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'claims');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'claims');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_deadlines') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_deadlines');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_deadlines');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'grievance_deadlines');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'grievance_deadlines');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'documents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'documents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'documents');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'documents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_documents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_documents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_documents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workplace_incidents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workplace_incidents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workplace_incidents');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'workplace_incidents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'safety_inspections') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'safety_inspections');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'safety_inspections');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'safety_inspections');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'hazard_reports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'hazard_reports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'hazard_reports');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'hazard_reports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'safety_committee_meetings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'safety_committee_meetings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'safety_committee_meetings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'safety_training_records') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'safety_training_records');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'safety_training_records');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'safety_training_records');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ppe_equipment') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ppe_equipment');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ppe_equipment');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'ppe_equipment');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'safety_audits') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'safety_audits');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'safety_audits');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'injury_logs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'injury_logs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'injury_logs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'safety_policies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'safety_policies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'safety_policies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'corrective_actions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'corrective_actions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'corrective_actions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'safety_certifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'safety_certifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'safety_certifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'message_threads') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'message_threads');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'message_threads');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'message_threads');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'messages') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'messages');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'messages');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'messages');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'message_participants') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'message_participants');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'message_participants');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'message_read_receipts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'message_read_receipts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'message_read_receipts');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'message_read_receipts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'message_notifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'message_notifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'message_notifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cross_org_access_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cross_org_access_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cross_org_access_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'claim_deadlines') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'claim_deadlines');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'claim_deadlines');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'claim_deadlines');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'deadline_reminders') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'deadline_reminders');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'deadline_reminders');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'deadline_reminders');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'deadline_reminders');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_case_access_assignments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_case_access_assignments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_case_access_assignments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'grievance_case_access_assignments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_assignments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_assignments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_assignments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'deadline_reassignment_convergence') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'deadline_reassignment_convergence');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'deadline_reassignment_convergence');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'deadline_alerts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'deadline_alerts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'deadline_alerts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'deadline_extensions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'deadline_extensions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'deadline_extensions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'deadline_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'deadline_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'deadline_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_grievance_triages') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_grievance_triages');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_grievance_triages');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'ai_grievance_triages');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'arbitrations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'arbitrations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'arbitrations');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'arbitrations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'bargaining_notes') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'bargaining_notes');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'bargaining_notes');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'bargaining_notes');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'bargaining_units') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'bargaining_units');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'bargaining_units');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'bargaining_units');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'case_documents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'case_documents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'case_documents');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'case_documents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'case_studies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'case_studies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'case_studies');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'case_studies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_clauses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_clauses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_clauses');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'cba_clauses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_rule_set_items') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_rule_set_items');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_rule_set_items');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'cba_rule_set_items');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_rule_versions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_rule_versions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_rule_versions');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'cba_rule_versions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'collective_agreements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'collective_agreements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'collective_agreements');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'collective_agreements');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'collective_agreements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'claim_precedent_analysis') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'claim_precedent_analysis');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'claim_precedent_analysis');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_insurance_claims') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_insurance_claims');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_insurance_claims');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_insurance_claims');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'fee_settlement_lines') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'fee_settlement_lines');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'fee_settlement_lines');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_approvals') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_approvals');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_approvals');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_communications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_communications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_communications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_documents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_documents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_documents');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'grievance_documents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_settlements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_settlements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_settlements');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'grievance_settlements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_stages') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_stages');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_stages');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_timeline_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_timeline_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_timeline_events');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'grievance_timeline_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_transitions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_transitions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_transitions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'grievance_transitions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_workflows') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_workflows');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_workflows');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_benefit_claims') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_benefit_claims');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_benefit_claims');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'pension_benefit_claims');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'settlements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'settlements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'settlements');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'settlements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'signature_workflows') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'signature_workflows');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'signature_workflows');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'union_representation_votes') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'union_representation_votes');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'union_representation_votes');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'wcb_claims') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'wcb_claims');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'wcb_claims');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'wcb_claims');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workflow_definitions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workflow_definitions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workflow_definitions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workflow_executions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workflow_executions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workflow_executions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'arbitration_decisions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'arbitration_decisions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'arbitration_decisions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'arbitration_decisions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'arbitration_precedents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'arbitration_precedents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'arbitration_precedents');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'arbitration_precedents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'bargaining_proposals') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'bargaining_proposals');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'bargaining_proposals');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'bargaining_proposals');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'bargaining_team_members') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'bargaining_team_members');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'bargaining_team_members');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_contacts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_contacts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_contacts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_footnotes') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_footnotes');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_footnotes');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_agreements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_agreements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_agreements');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'cba_intel_agreements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_benchmark_snapshots') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_benchmark_snapshots');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_benchmark_snapshots');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'cba_intel_benchmark_snapshots');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_clauses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_clauses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_clauses');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'cba_intel_clauses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_documents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_documents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_documents');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'cba_intel_documents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_extraction_runs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_extraction_runs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_extraction_runs');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'cba_intel_extraction_runs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_findings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_findings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_findings');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'cba_intel_findings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_freshness_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_freshness_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_freshness_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_ingestion_jobs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_ingestion_jobs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_ingestion_jobs');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'cba_intel_ingestion_jobs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_review_decisions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_review_decisions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_review_decisions');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'cba_intel_review_decisions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_sources') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_sources');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_sources');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'cba_intel_sources');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_intel_wage_adjustments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_intel_wage_adjustments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_intel_wage_adjustments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'cba_intel_wage_adjustments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cba_version_history') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cba_version_history');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cba_version_history');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'claim_updates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'claim_updates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'claim_updates');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'claim_updates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_bargaining_trends') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_bargaining_trends');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_bargaining_trends');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'deadline_reminder_executions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'deadline_reminder_executions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'deadline_reminder_executions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'fee_settlement_batches') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'fee_settlement_batches');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'fee_settlement_batches');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_events');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'grievance_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_responses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_responses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_responses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'grievance_timeline') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'grievance_timeline');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'grievance_timeline');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'grievance_timeline');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'campaigns') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'campaigns');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'campaigns');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'campaigns');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_system', 'campaigns');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'chat_sessions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'chat_sessions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'chat_sessions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'chat_sessions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'chatbot_analytics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'chatbot_analytics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'chatbot_analytics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'chatbot_suggestions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'chatbot_suggestions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'chatbot_suggestions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'communication_analytics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'communication_analytics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'communication_analytics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'communication_channels') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'communication_channels');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'communication_channels');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'communication_preferences') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'communication_preferences');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'communication_preferences');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'communication_preferences');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'communication_preferences');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'communication_preferences_phase4') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'communication_preferences_phase4');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'communication_preferences_phase4');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'consent_records') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'consent_records');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'consent_records');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'consent_records');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_system', 'consent_records');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cookie_consents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cookie_consents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cookie_consents');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'cookie_consents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'data_aggregation_consent') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'data_aggregation_consent');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'data_aggregation_consent');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'data_aggregation_consent');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'donation_campaigns') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'donation_campaigns');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'donation_campaigns');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'donation_campaigns');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_communications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_communications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_communications');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'employer_communications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_communication_channels') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_communication_channels');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_communication_channels');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_communication_channels');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_communication_messages') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_communication_messages');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_communication_messages');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_communication_messages');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_communication_users') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_communication_users');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_communication_users');
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_communication_users');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'in_app_notifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'in_app_notifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'in_app_notifications');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'in_app_notifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'message_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'message_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'message_log');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'message_log');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_system', 'message_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'mobile_notifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'mobile_notifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'mobile_notifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_campaigns') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'newsletter_campaigns');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'newsletter_campaigns');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'newsletter_campaigns');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_distribution_lists') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'newsletter_distribution_lists');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'newsletter_distribution_lists');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'newsletter_distribution_lists');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'notification_bounces') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'notification_bounces');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'notification_bounces');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'notification_delivery_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'notification_delivery_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'notification_delivery_log');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'notification_delivery_log');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_system', 'notification_delivery_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'notification_history') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'notification_history');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'notification_history');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'notification_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'notification_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'notification_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'notification_queue') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'notification_queue');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'notification_queue');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'notification_queue');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'notification_queue');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'notification_tracking') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'notification_tracking');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'notification_tracking');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'notification_tracking');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'notifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'notifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'notifications');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'notifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organizing_campaign_milestones') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organizing_campaign_milestones');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organizing_campaign_milestones');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organizing_campaigns') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organizing_campaigns');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organizing_campaigns');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'organizing_campaigns');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'push_notifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'push_notifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'push_notifications');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'push_notifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sms_campaigns') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sms_campaigns');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sms_campaigns');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'sms_campaigns');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sms_conversations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sms_conversations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sms_conversations');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'sms_conversations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sms_messages') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sms_messages');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sms_messages');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'sms_messages');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sms_opt_outs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sms_opt_outs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sms_opt_outs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sms_rate_limits') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sms_rate_limits');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sms_rate_limits');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'social_campaigns') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'social_campaigns');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'social_campaigns');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'social_campaigns');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'user_consents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'user_consents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'user_consents');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_runtime', 'user_consents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'user_notification_preferences') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'user_notification_preferences');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'user_notification_preferences');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'user_notification_preferences');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_system', 'user_notification_preferences');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'band_council_consent') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'band_council_consent');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'band_council_consent');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'chat_messages') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'chat_messages');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'chat_messages');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'chat_messages');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'federation_campaigns') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'federation_campaigns');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'federation_campaigns');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'federation_communications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'federation_communications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'federation_communications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_engagement') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'newsletter_engagement');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'newsletter_engagement');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_list_subscribers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'newsletter_list_subscribers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'newsletter_list_subscribers');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_runtime', 'newsletter_list_subscribers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_recipients') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'newsletter_recipients');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'newsletter_recipients');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'newsletter_recipients');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'provincial_consent') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'provincial_consent');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'provincial_consent');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'provincial_consent');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'provincial_consent');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sms_campaign_recipients') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sms_campaign_recipients');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sms_campaign_recipients');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'voting_notifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'voting_notifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'voting_notifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'award_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'award_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'award_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cms_media_library') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cms_media_library');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cms_media_library');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'cms_media_library');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cms_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cms_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cms_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'communication_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'communication_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'communication_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'document_access_grants') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'document_access_grants');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'document_access_grants');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'document_access_grants');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'document_folders') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'document_folders');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'document_folders');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'document_folders');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'document_links') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'document_links');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'document_links');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'document_links');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'document_search_index') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'document_search_index');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'document_search_index');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'document_versions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'document_versions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'document_versions');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'document_versions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_evidence_links') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_execution_evidence_links');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_execution_evidence_links');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'employer_execution_evidence_links');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_profiles') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_execution_profiles');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_execution_profiles');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'employer_execution_profiles');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'exit_interview_documents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'exit_interview_documents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'exit_interview_documents');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'exit_interview_documents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_communication_files') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_communication_files');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_communication_files');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_communication_files');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_document_files') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_document_files');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_document_files');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_document_libraries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_document_libraries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_document_libraries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_document_permissions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_document_permissions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_document_permissions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_document_sites') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_document_sites');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_document_sites');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_maturity_profiles') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_maturity_profiles');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_maturity_profiles');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'message_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'message_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'message_templates');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'message_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'newsletter_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'newsletter_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'newsletter_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'notification_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'notification_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'notification_templates');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'notification_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'push_notification_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'push_notification_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'push_notification_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'report_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'report_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'report_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'signature_documents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'signature_documents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'signature_documents');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'signature_documents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'signature_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'signature_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'signature_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sms_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sms_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sms_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'arbitrator_profiles') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'arbitrator_profiles');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'arbitrator_profiles');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'document_signers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'document_signers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'document_signers');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'document_signers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pending_profiles') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pending_profiles');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pending_profiles');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'pending_profiles');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pricing_template_modules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pricing_template_modules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pricing_template_modules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pricing_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pricing_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pricing_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'profiles') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'profiles');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'profiles');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'profiles');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'swiss_cold_storage') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'swiss_cold_storage');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'swiss_cold_storage');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'transfer_pricing_documentation') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'transfer_pricing_documentation');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'transfer_pricing_documentation');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'account_mappings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'account_mappings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'account_mappings');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'account_mappings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_budgets') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_budgets');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_budgets');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'bank_accounts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'bank_accounts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'bank_accounts');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'bank_accounts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'bank_reconciliation') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'bank_reconciliation');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'bank_reconciliation');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'bank_reconciliation');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'bank_reconciliations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'bank_reconciliations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'bank_reconciliations');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'bank_reconciliations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'billing_accounts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'billing_accounts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'billing_accounts');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'billing_accounts');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'billing_accounts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'billing_adjustments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'billing_adjustments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'billing_adjustments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'billing_invoices') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'billing_invoices');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'billing_invoices');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'billing_payments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'billing_payments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'billing_payments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'billing_periods') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'billing_periods');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'billing_periods');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'billing_periods');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'billing_subscriptions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'billing_subscriptions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'billing_subscriptions');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'billing_subscriptions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'budget_pool') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'budget_pool');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'budget_pool');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'budget_pool');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'chart_of_accounts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'chart_of_accounts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'chart_of_accounts');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'chart_of_accounts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_remittance_mapping') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_remittance_mapping');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_remittance_mapping');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'clc_remittance_mapping');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cost_centers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cost_centers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cost_centers');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'cost_centers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'donation_receipts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'donation_receipts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'donation_receipts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'donations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'donations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'donations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dues_assignments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dues_assignments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dues_assignments');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'dues_assignments');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'dues_assignments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dues_policies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dues_policies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dues_policies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dues_rates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dues_rates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dues_rates');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'dues_rates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dues_transactions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dues_transactions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dues_transactions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'dues_transactions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_payroll_adjustments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_payroll_adjustments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_payroll_adjustments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_payroll_run_items') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_payroll_run_items');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_payroll_run_items');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'employer_payroll_run_items');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_payroll_runs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_payroll_runs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_payroll_runs');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'employer_payroll_runs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_remittance_run_items') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_remittance_run_items');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_remittance_run_items');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'employer_remittance_run_items');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_remittance_runs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_remittance_runs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_remittance_runs');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'employer_remittance_runs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_remittances') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_remittances');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_remittances');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'employer_remittances');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'entitlement_usage_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'entitlement_usage_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'entitlement_usage_log');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'entitlement_usage_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'erp_invoices') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'erp_invoices');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'erp_invoices');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'erp_invoices');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'financial_periods') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'financial_periods');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'financial_periods');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'financial_periods');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'gl_account_mappings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'gl_account_mappings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'gl_account_mappings');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'gl_account_mappings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'gl_transaction_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'gl_transaction_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'gl_transaction_log');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'gl_transaction_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'gl_trial_balance') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'gl_trial_balance');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'gl_trial_balance');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'gl_trial_balance');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'payment_cycles') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'payment_cycles');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'payment_cycles');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'payment_cycles');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'payment_disputes') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'payment_disputes');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'payment_disputes');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'payment_disputes');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'payment_methods') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'payment_methods');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'payment_methods');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'payment_methods');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'payment_plans') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'payment_plans');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'payment_plans');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'payment_plans');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'payments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'payments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'payments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'payments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'payments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'payroll_deductions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'payroll_deductions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'payroll_deductions');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'payroll_deductions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_contributions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_contributions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_contributions');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'pension_contributions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_plans') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_plans');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_plans');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'pension_plans');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_t4a_records') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_t4a_records');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_t4a_records');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'pension_t4a_records');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_trustee_meetings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_trustee_meetings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_trustee_meetings');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'pension_trustee_meetings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_trustees') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_trustees');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_trustees');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'pension_trustees');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'per_capita_remittances') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'per_capita_remittances');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'per_capita_remittances');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'per_capita_remittances');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'per_capita_remittances');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'platform_cost_ledger_entries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'platform_cost_ledger_entries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'platform_cost_ledger_entries');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'platform_cost_ledger_entries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'platform_invoices') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'platform_invoices');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'platform_invoices');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'platform_invoices');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'platform_payments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'platform_payments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'platform_payments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'platform_payments');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_system', 'platform_payments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'reconciliation_exceptions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'reconciliation_exceptions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'reconciliation_exceptions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'reconciliation_exceptions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'reconciliation_runs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'reconciliation_runs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'reconciliation_runs');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'reconciliation_runs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'remittance_exceptions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'remittance_exceptions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'remittance_exceptions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'remittance_exceptions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'remittance_line_items') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'remittance_line_items');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'remittance_line_items');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'remittance_line_items');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'reward_budget_envelopes') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'reward_budget_envelopes');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'reward_budget_envelopes');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'reward_budget_envelopes');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'reward_wallet_ledger') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'reward_wallet_ledger');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'reward_wallet_ledger');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'reward_wallet_ledger');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'social_accounts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'social_accounts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'social_accounts');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'social_accounts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'subscription_events_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'subscription_events_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'subscription_events_log');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'subscription_events_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'union_dues_receipts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'union_dues_receipts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'union_dues_receipts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'union_dues_year_end') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'union_dues_year_end');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'union_dues_year_end');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'account_balance_reconciliation') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'account_balance_reconciliation');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'account_balance_reconciliation');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'billing_terms') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'billing_terms');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'billing_terms');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'budget_reservations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'budget_reservations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'budget_reservations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_chart_of_accounts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_chart_of_accounts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_chart_of_accounts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'federation_remittances') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'federation_remittances');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'federation_remittances');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'payment_allocations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'payment_allocations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'payment_allocations');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'payment_allocations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'payment_classification_policy') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'payment_classification_policy');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'payment_classification_policy');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'payment_routing_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'payment_routing_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'payment_routing_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'platform_invoice_line_items') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'platform_invoice_line_items');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'platform_invoice_line_items');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'platform_invoice_line_items');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'reconciliation_matches') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'reconciliation_matches');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'reconciliation_matches');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'reconciliation_matches');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'remittance_approvals') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'remittance_approvals');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'remittance_approvals');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'remittance_approvals');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'rl1_tax_slips') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'rl1_tax_slips');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'rl1_tax_slips');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'separated_payment_transactions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'separated_payment_transactions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'separated_payment_transactions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'strike_fund_disbursements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'strike_fund_disbursements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'strike_fund_disbursements');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'strike_fund_disbursements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'stripe_connect_accounts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'stripe_connect_accounts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'stripe_connect_accounts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'subscription_plans') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'subscription_plans');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'subscription_plans');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'subscription_plans');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 't4a_tax_slips') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 't4a_tax_slips');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 't4a_tax_slips');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'tax_year_end_processing') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'tax_year_end_processing');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'tax_year_end_processing');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'accounts_payable') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'accounts_payable');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'accounts_payable');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_chunks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_chunks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_chunks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_documents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_documents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_documents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_feedback') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_feedback');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_feedback');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_feedback_summary') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_feedback_summary');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_feedback_summary');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_queries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_queries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_queries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_query_logs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_query_logs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_query_logs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_usage_by_tenant') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_usage_by_tenant');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_usage_by_tenant');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'arrears') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'arrears');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'arrears');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'arrears_cases') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'arrears_cases');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'arrears_cases');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'attestation_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'attestation_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'attestation_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'blockchain_audit_anchors') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'blockchain_audit_anchors');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'blockchain_audit_anchors');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'budget_line_items') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'budget_line_items');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'budget_line_items');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'budgets') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'budgets');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'budgets');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'case_summaries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'case_summaries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'case_summaries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'certification_applications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'certification_applications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'certification_applications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'compliance_validations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'compliance_validations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'compliance_validations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cope_contributions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cope_contributions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cope_contributions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cra_xml_batches') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cra_xml_batches');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cra_xml_batches');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'customer_acquisition') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'customer_acquisition');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'customer_acquisition');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'digital_signatures') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'digital_signatures');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'digital_signatures');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dues_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dues_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dues_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'elected_officials') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'elected_officials');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'elected_officials');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'encryption_keys') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'encryption_keys');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'encryption_keys');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'equity_snapshots') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'equity_snapshots');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'equity_snapshots');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'expense_approvals') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'expense_approvals');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'expense_approvals');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'expense_requests') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'expense_requests');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'expense_requests');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'fund_eligibility') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'fund_eligibility');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'fund_eligibility');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'hardship_applications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'hardship_applications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'hardship_applications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'hw_benefit_claims') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'hw_benefit_claims');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'hw_benefit_claims');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'hw_benefit_enrollments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'hw_benefit_enrollments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'hw_benefit_enrollments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'hw_benefit_plans') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'hw_benefit_plans');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'hw_benefit_plans');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'jurisdiction_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'jurisdiction_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'jurisdiction_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'jurisdiction_rules_summary') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'jurisdiction_rules_summary');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'jurisdiction_rules_summary');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'jurisdiction_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'jurisdiction_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'jurisdiction_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'legislation_tracking') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'legislation_tracking');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'legislation_tracking');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_demographics') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_demographics');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_demographics');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_dues_assignments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_dues_assignments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_dues_assignments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_political_participation') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_political_participation');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_political_participation');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'members') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'members');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'members');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'members_with_pii') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'members_with_pii');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'members_with_pii');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'mrr_snapshots') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'mrr_snapshots');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'mrr_snapshots');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organization_hierarchy_audit') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organization_hierarchy_audit');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organization_hierarchy_audit');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organization_tree') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organization_tree');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organization_tree');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organizing_activities') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organizing_activities');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organizing_activities');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organizing_volunteers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organizing_volunteers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organizing_volunteers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pay_equity_complaints') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pay_equity_complaints');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pay_equity_complaints');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_actuarial_valuations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_actuarial_valuations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_actuarial_valuations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_hours_banks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_hours_banks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_hours_banks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_trustee_boards') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_trustee_boards');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_trustee_boards');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'picket_attendance') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'picket_attendance');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'picket_attendance');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'picket_tracking') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'picket_tracking');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'picket_tracking');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pii_access_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pii_access_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pii_access_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'political_activities') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'political_activities');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'political_activities');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'political_campaigns') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'political_campaigns');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'political_campaigns');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'public_donations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'public_donations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'public_donations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'revenue_cohorts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'revenue_cohorts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'revenue_cohorts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'statcan_submissions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'statcan_submissions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'statcan_submissions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'statutory_holidays') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'statutory_holidays');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'statutory_holidays');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'stipend_disbursements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'stipend_disbursements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'stipend_disbursements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'strike_funds') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'strike_funds');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'strike_funds');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'subscription_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'subscription_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'subscription_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'tax_slips') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'tax_slips');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'tax_slips');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'tax_year_configurations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'tax_year_configurations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'tax_year_configurations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'tenant_management_view') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'tenant_management_view');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'tenant_management_view');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'tenants') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'tenants');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'tenants');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'transaction_clc_mappings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'transaction_clc_mappings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'transaction_clc_mappings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'trust_compliance_reports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'trust_compliance_reports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'trust_compliance_reports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'trusted_certificate_authorities') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'trusted_certificate_authorities');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'trusted_certificate_authorities');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_annual_remittance_summary') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_annual_remittance_summary');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_annual_remittance_summary');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_certification_expiry_tracking') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_certification_expiry_tracking');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_certification_expiry_tracking');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_cope_member_summary') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_cope_member_summary');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_cope_member_summary');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_course_session_dashboard') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_course_session_dashboard');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_course_session_dashboard');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_critical_deadlines') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_critical_deadlines');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_critical_deadlines');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_elected_official_engagement') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_elected_official_engagement');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_elected_official_engagement');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_equity_statistics_anonymized') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_equity_statistics_anonymized');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_equity_statistics_anonymized');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_hw_claims_aging') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_hw_claims_aging');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_hw_claims_aging');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_legislative_priorities') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_legislative_priorities');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_legislative_priorities');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_member_benefit_eligibility') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_member_benefit_eligibility');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_member_benefit_eligibility');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_member_training_transcript') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_member_training_transcript');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_member_training_transcript');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_organizing_campaign_dashboard') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_organizing_campaign_dashboard');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_organizing_campaign_dashboard');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_pay_equity_pipeline') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_pay_equity_pipeline');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_pay_equity_pipeline');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_pending_remittances') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_pending_remittances');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_pending_remittances');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_pension_funding_summary') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_pension_funding_summary');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_pension_funding_summary');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_political_campaign_dashboard') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_political_campaign_dashboard');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_political_campaign_dashboard');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_tax_slip_summary') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_tax_slip_summary');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_tax_slip_summary');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_training_program_progress') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_training_program_progress');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_training_program_progress');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'v_workplace_contact_map') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'v_workplace_contact_map');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'v_workplace_contact_map');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'vendor_invoices') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'vendor_invoices');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'vendor_invoices');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'vendors') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'vendors');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'vendors');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'vote_merkle_tree') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'vote_merkle_tree');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'vote_merkle_tree');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'voting_auditors') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'voting_auditors');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'voting_auditors');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'voting_key_access_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'voting_key_access_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'voting_key_access_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'voting_session_auditors') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'voting_session_auditors');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'voting_session_auditors');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'voting_session_keys') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'voting_session_keys');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'voting_session_keys');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'board_packet_templates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'board_packet_templates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'board_packet_templates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'board_packets') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'board_packets');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'board_packets');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'board_packets');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'committee_action_items') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'committee_action_items');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'committee_action_items');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'committee_action_items');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'committee_documents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'committee_documents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'committee_documents');
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON TABLE %I TO union_eyes_runtime', 'committee_documents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'committee_intelligence_snapshots') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'committee_intelligence_snapshots');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'committee_intelligence_snapshots');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'committee_intelligence_snapshots');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'committee_meetings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'committee_meetings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'committee_meetings');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'committee_meetings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'committees') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'committees');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'committees');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'committees');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'congress_memberships') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'congress_memberships');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'congress_memberships');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'governance_bylaws') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'governance_bylaws');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'governance_bylaws');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'governance_policies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'governance_policies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'governance_policies');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'governance_policies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'governance_signatories') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'governance_signatories');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'governance_signatories');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_governance_flags') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_governance_flags');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_governance_flags');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'joint_hs_committees') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'joint_hs_committees');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'joint_hs_committees');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'joint_hs_committees');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ue_governance_job_cancellation_audit_event') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ue_governance_job_cancellation_audit_event');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ue_governance_job_cancellation_audit_event');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ue_governance_job_cancellation_request') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ue_governance_job_cancellation_request');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ue_governance_job_cancellation_request');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ue_governance_job_execution_state') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ue_governance_job_execution_state');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ue_governance_job_execution_state');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ue_governance_job_reconciliation_pass') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ue_governance_job_reconciliation_pass');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ue_governance_job_reconciliation_pass');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'board_packet_distributions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'board_packet_distributions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'board_packet_distributions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'board_packet_distributions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'board_packet_sections') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'board_packet_sections');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'board_packet_sections');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'committee_meeting_attendees') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'committee_meeting_attendees');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'committee_meeting_attendees');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'committee_meeting_attendees');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'committee_memberships') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'committee_memberships');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'committee_memberships');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'conflict_review_committee') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'conflict_review_committee');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'conflict_review_committee');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'council_elections') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'council_elections');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'council_elections');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'council_elections');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'golden_shares') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'golden_shares');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'golden_shares');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_system', 'golden_shares');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'governance_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'governance_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'governance_events');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'governance_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'mission_audits') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'mission_audits');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'mission_audits');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_system', 'mission_audits');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'reserved_matter_votes') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'reserved_matter_votes');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'reserved_matter_votes');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'reserved_matter_votes');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_governance_lineage_entries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workbook_governance_lineage_entries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workbook_governance_lineage_entries');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'workbook_governance_lineage_entries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'accessibility_audits') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'accessibility_audits');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'accessibility_audits');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'deadline_audit_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'deadline_audit_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'deadline_audit_events');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'deadline_audit_events');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_system', 'deadline_audit_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'financial_audit_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'financial_audit_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'financial_audit_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ai_safety_filters') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ai_safety_filters');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ai_safety_filters');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'ai_safety_filters');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'certification_audit_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'certification_audit_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'certification_audit_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'conflict_audit_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'conflict_audit_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'conflict_audit_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'correspondence_audit_trail') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'correspondence_audit_trail');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'correspondence_audit_trail');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'correspondence_audit_trail');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'currency_enforcement_audit') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'currency_enforcement_audit');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'currency_enforcement_audit');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'firewall_compliance_audit') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'firewall_compliance_audit');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'firewall_compliance_audit');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'fmv_audit_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'fmv_audit_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'fmv_audit_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'fx_rate_audit_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'fx_rate_audit_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'fx_rate_audit_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'location_tracking_audit') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'location_tracking_audit');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'location_tracking_audit');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'location_tracking_audit');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'signature_audit_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'signature_audit_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'signature_audit_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'signature_audit_trail') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'signature_audit_trail');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'signature_audit_trail');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'signature_audit_trail');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'strike_fund_payment_audit') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'strike_fund_payment_audit');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'strike_fund_payment_audit');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'voting_audit_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'voting_audit_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'voting_audit_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'whiplash_prevention_audit') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'whiplash_prevention_audit');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'whiplash_prevention_audit');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'api_integrations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'api_integrations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'api_integrations');
    EXECUTE format('GRANT SELECT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'api_integrations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_sync_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_sync_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_sync_log');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'clc_sync_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_webhook_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_webhook_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_webhook_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_timesheet_batches') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_timesheet_batches');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_timesheet_batches');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'employer_timesheet_batches');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'erp_connectors') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'erp_connectors');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'erp_connectors');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_accounts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_accounts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_accounts');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_accounts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_coverage') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_benefit_coverage');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_benefit_coverage');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_benefit_coverage');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_dependents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_benefit_dependents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_benefit_dependents');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_benefit_dependents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_enrollments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_benefit_enrollments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_benefit_enrollments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_benefit_enrollments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_plans') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_benefit_plans');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_benefit_plans');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_benefit_plans');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_benefit_utilization') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_benefit_utilization');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_benefit_utilization');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_benefit_utilization');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_calendar_attendees') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_calendar_attendees');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_calendar_attendees');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_calendar_connections') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_calendar_connections');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_calendar_connections');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'external_calendar_connections');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_calendar_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_calendar_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_calendar_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_calendar_recurring_patterns') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_calendar_recurring_patterns');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_calendar_recurring_patterns');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_calendars') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_calendars');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_calendars');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_customers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_customers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_customers');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_customers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_departments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_departments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_departments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_departments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_employees') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_employees');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_employees');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_employees');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_insurance_beneficiaries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_insurance_beneficiaries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_insurance_beneficiaries');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_insurance_beneficiaries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_insurance_policies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_insurance_policies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_insurance_policies');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_insurance_policies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_invoices') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_invoices');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_invoices');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'external_invoices');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_completions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_lms_completions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_lms_completions');
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_lms_completions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_courses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_lms_courses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_lms_courses');
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_lms_courses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_enrollments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_lms_enrollments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_lms_enrollments');
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_lms_enrollments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_learners') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_lms_learners');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_lms_learners');
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_lms_learners');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_lms_progress') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_lms_progress');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_lms_progress');
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_lms_progress');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_payments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_payments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_payments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_payments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_pension_beneficiaries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_pension_beneficiaries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_pension_beneficiaries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_pension_contributions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_pension_contributions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_pension_contributions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_pension_estimates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_pension_estimates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_pension_estimates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_pension_plans') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_pension_plans');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_pension_plans');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_pension_service_credits') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_pension_service_credits');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_pension_service_credits');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_positions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_positions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_positions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_positions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'webhook_deliveries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'webhook_deliveries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'webhook_deliveries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ingestion_batches') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ingestion_batches');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ingestion_batches');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'ingestion_batches');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'integration_api_keys') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'integration_api_keys');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'integration_api_keys');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'integration_api_keys');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'integration_configs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'integration_configs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'integration_configs');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'integration_configs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'integration_partners') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'integration_partners');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'integration_partners');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'integration_partners');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'integration_partners');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'integration_sync_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'integration_sync_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'integration_sync_log');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'integration_sync_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'integration_sync_schedules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'integration_sync_schedules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'integration_sync_schedules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'integration_webhooks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'integration_webhooks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'integration_webhooks');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'integration_webhooks');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'integration_webhooks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'job_classifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'job_classifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'job_classifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'job_postings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'job_postings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'job_postings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'job_saved') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'job_saved');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'job_saved');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'mobile_sync_queue') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'mobile_sync_queue');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'mobile_sync_queue');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'stripe_webhook_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'stripe_webhook_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'stripe_webhook_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sync_jobs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sync_jobs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sync_jobs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'webhook_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'webhook_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'webhook_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'webhook_subscriptions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'webhook_subscriptions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'webhook_subscriptions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_data_sync_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_data_sync_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_data_sync_log');
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'external_data_sync_log');
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'external_data_sync_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'foreign_workers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'foreign_workers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'foreign_workers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ingestion_records') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ingestion_records');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ingestion_records');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'ingestion_records');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'integration_sync_logs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'integration_sync_logs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'integration_sync_logs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'lrb_sync_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'lrb_sync_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'lrb_sync_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'signature_webhooks_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'signature_webhooks_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'signature_webhooks_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'webhook_receipts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'webhook_receipts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'webhook_receipts');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_system', 'webhook_receipts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_organization_sync_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_organization_sync_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_organization_sync_log');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'clc_organization_sync_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'external_pension_members') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'external_pension_members');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'external_pension_members');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_organizations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_organizations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_organizations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'job_applications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'job_applications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'job_applications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_addresses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_addresses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_addresses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_arrears') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_arrears');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_arrears');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'member_arrears');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_breaks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_breaks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_breaks');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'member_breaks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_certifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_certifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_certifications');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'member_certifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_consents') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_consents');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_consents');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_contact_preferences') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_contact_preferences');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_contact_preferences');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_dues_issues') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_dues_issues');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_dues_issues');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'member_dues_issues');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_dues_ledger') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_dues_ledger');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_dues_ledger');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'member_dues_ledger');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_employment') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_employment');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_employment');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'member_employment');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_employment_details') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_employment_details');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_employment_details');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_history_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_history_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_history_events');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'member_history_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_jurisdiction_preferences') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_jurisdiction_preferences');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_jurisdiction_preferences');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'member_jurisdiction_preferences');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_leaves') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_leaves');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_leaves');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_relationship_scores') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_relationship_scores');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_relationship_scores');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_segments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_segments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_segments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'member_segments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'org_entitlements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'org_entitlements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'org_entitlements');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'org_entitlements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'org_subscriptions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'org_subscriptions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'org_subscriptions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'org_subscriptions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organization_benchmark_snapshots') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organization_benchmark_snapshots');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organization_benchmark_snapshots');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organization_billing_config') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organization_billing_config');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organization_billing_config');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'organization_billing_config');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organization_contacts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organization_contacts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organization_contacts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organization_sharing_settings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organization_sharing_settings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organization_sharing_settings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pension_members') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pension_members');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pension_members');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'pension_members');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'role_tenure_history') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'role_tenure_history');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'role_tenure_history');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'duplicate_group_members') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'duplicate_group_members');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'duplicate_group_members');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'duplicate_group_members');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'federation_memberships') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'federation_memberships');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'federation_memberships');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'gss_applications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'gss_applications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'gss_applications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'indigenous_member_data') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'indigenous_member_data');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'indigenous_member_data');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'member_location_consent') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'member_location_consent');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'member_location_consent');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'member_location_consent');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organization_sharing_grants') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organization_sharing_grants');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organization_sharing_grants');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_applications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pilot_applications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pilot_applications');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'pilot_applications');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_system', 'pilot_applications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'applications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'applications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'applications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'org_configurations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'org_configurations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'org_configurations');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'org_configurations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'org_usage') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'org_usage');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'org_usage');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organization_relationships') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organization_relationships');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organization_relationships');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'organization_relationships');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ab_tests') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ab_tests');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ab_tests');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'accessibility_issues') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'accessibility_issues');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'accessibility_issues');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'accessibility_test_suites') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'accessibility_test_suites');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'accessibility_test_suites');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'accessibility_user_testing') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'accessibility_user_testing');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'accessibility_user_testing');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'alert_escalations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'alert_escalations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'alert_escalations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'alert_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'alert_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'alert_rules');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'alert_rules');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_system', 'alert_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'allocation_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'allocation_rules');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'allocation_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'anti_scab_violations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'anti_scab_violations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'anti_scab_violations');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'anti_scab_violations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'api_access_tokens') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'api_access_tokens');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'api_access_tokens');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'automation_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'automation_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'automation_rules');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'automation_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'break_policies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'break_policies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'break_policies');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'break_policies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'calendar_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'calendar_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'calendar_events');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'calendar_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'calendar_sharing') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'calendar_sharing');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'calendar_sharing');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'calendars') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'calendars');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'calendars');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'calendars');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'calendars');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'card_signing_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'card_signing_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'card_signing_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'chargeback_statements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'chargeback_statements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'chargeback_statements');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'chargeback_statements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clause_comparisons') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clause_comparisons');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clause_comparisons');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'clause_comparisons');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clause_comparisons_history') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clause_comparisons_history');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clause_comparisons_history');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_api_config') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_api_config');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_api_config');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_per_capita_benchmarks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_per_capita_benchmarks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_per_capita_benchmarks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cms_blocks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cms_blocks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cms_blocks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cms_navigation_menus') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cms_navigation_menus');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cms_navigation_menus');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cms_pages') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cms_pages');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cms_pages');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'cms_pages');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cnesst_filings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cnesst_filings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cnesst_filings');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'cnesst_filings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'comparative_analyses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'comparative_analyses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'comparative_analyses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'compliance_alerts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'compliance_alerts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'compliance_alerts');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'compliance_alerts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'contract_covered_orgs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'contract_covered_orgs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'contract_covered_orgs');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'contract_covered_orgs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'correspondence') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'correspondence');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'correspondence');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'correspondence');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'course_registrations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'course_registrations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'course_registrations');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'course_registrations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'course_sessions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'course_sessions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'course_sessions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'course_sessions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'currency_exchange_rates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'currency_exchange_rates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'currency_exchange_rates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'customer_onboarding_milestones') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'customer_onboarding_milestones');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'customer_onboarding_milestones');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'customer_onboarding_milestones');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'data_anonymization_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'data_anonymization_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'data_anonymization_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'data_processing_records') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'data_processing_records');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'data_processing_records');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'data_quality_warnings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'data_quality_warnings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'data_quality_warnings');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'data_quality_warnings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'data_residency_configs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'data_residency_configs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'data_residency_configs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'data_retention_policies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'data_retention_policies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'data_retention_policies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'defensibility_packs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'defensibility_packs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'defensibility_packs');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'defensibility_packs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dispatch_requests') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dispatch_requests');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dispatch_requests');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'dispatch_requests');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dispatch_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dispatch_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dispatch_rules');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'dispatch_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dsr_requests') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dsr_requests');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dsr_requests');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dunning_cases') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dunning_cases');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dunning_cases');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'duplicate_groups') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'duplicate_groups');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'duplicate_groups');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'duplicate_groups');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_contacts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_contacts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_contacts');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'employer_contacts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_artifacts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_execution_artifacts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_execution_artifacts');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'employer_execution_artifacts');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_system', 'employer_execution_artifacts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_compliance_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_execution_compliance_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_execution_compliance_events');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'employer_execution_compliance_events');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_system', 'employer_execution_compliance_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_execution_replays') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_execution_replays');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_execution_replays');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'employer_execution_replays');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_system', 'employer_execution_replays');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_responses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_responses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_responses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_timesheet_entries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_timesheet_entries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_timesheet_entries');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'employer_timesheet_entries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employers');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'employers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employment_history') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employment_history');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employment_history');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'event_attendees') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'event_attendees');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'event_attendees');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'event_check_ins') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'event_check_ins');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'event_check_ins');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'event_registrations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'event_registrations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'event_registrations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'event_reminders') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'event_reminders');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'event_reminders');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'exit_interview_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'exit_interview_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'exit_interview_events');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'exit_interview_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'exit_interview_sessions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'exit_interview_sessions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'exit_interview_sessions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'exit_interviews') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'exit_interviews');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'exit_interviews');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'exit_interviews');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'federations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'federations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'federations');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'federations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'fee_adjustments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'fee_adjustments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'fee_adjustments');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'fee_adjustments');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_system', 'fee_adjustments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'field_notes') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'field_notes');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'field_notes');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'field_organizer_activities') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'field_organizer_activities');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'field_organizer_activities');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'gdpr_data_requests') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'gdpr_data_requests');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'gdpr_data_requests');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'gdpr_data_requests');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'user_sessions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'user_sessions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'user_sessions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'holidays') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'holidays');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'holidays');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'holidays');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'holidays');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_assessments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_assessments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_assessments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_assessment_answers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_assessment_answers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_assessment_answers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_operational_indicators') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_operational_indicators');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_operational_indicators');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'icra_benchmark_groups') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'icra_benchmark_groups');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'icra_benchmark_groups');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'international_addresses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'international_addresses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'international_addresses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'journal_entries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'journal_entries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'journal_entries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'knowledge_base') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'knowledge_base');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'knowledge_base');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'knowledge_base');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'kpi_configurations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'kpi_configurations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'kpi_configurations');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'kpi_configurations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'legal_holds') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'legal_holds');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'legal_holds');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'meeting_rooms') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'meeting_rooms');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'meeting_rooms');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'meeting_rooms');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'mfa_configurations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'mfa_configurations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'mfa_configurations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'mobile_app_config') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'mobile_app_config');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'mobile_app_config');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'mobile_devices') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'mobile_devices');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'mobile_devices');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'mobile_devices');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'negotiations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'negotiations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'negotiations');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'negotiations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'nlrb_clrb_filings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'nlrb_clrb_filings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'nlrb_clrb_filings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organizer_impacts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organizer_impacts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organizer_impacts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organizer_tasks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organizer_tasks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organizer_tasks');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'organizer_tasks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'organizing_contacts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'organizing_contacts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'organizing_contacts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'outreach_enrollments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'outreach_enrollments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'outreach_enrollments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'outreach_sequences') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'outreach_sequences');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'outreach_sequences');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'outreach_steps_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'outreach_steps_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'outreach_steps_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pack_download_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pack_download_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pack_download_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pay_equity_exercises') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pay_equity_exercises');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pay_equity_exercises');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'pay_equity_exercises');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pci_dss_cardholder_data_flow') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pci_dss_cardholder_data_flow');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pci_dss_cardholder_data_flow');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pci_dss_encryption_keys') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pci_dss_encryption_keys');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pci_dss_encryption_keys');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pci_dss_quarterly_scans') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pci_dss_quarterly_scans');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pci_dss_quarterly_scans');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pci_dss_requirements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pci_dss_requirements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pci_dss_requirements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pci_dss_saq_assessments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pci_dss_saq_assessments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pci_dss_saq_assessments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_checklist_items') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pilot_checklist_items');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pilot_checklist_items');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'pilot_checklist_items');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_demo_seeds') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pilot_demo_seeds');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pilot_demo_seeds');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'pilot_demo_seeds');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_enrollments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pilot_enrollments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pilot_enrollments');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'pilot_enrollments');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'pilot_enrollments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pilot_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pilot_events');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'pilot_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_feedback') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pilot_feedback');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pilot_feedback');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'pilot_feedback');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pilot_milestones') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pilot_milestones');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pilot_milestones');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'pilot_milestones');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'pilot_milestones');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'policy_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'policy_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'policy_rules');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'policy_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'poll_votes') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'poll_votes');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'poll_votes');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'poll_votes');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'polls') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'polls');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'polls');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'polls');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'preventive_withdrawals') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'preventive_withdrawals');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'preventive_withdrawals');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'preventive_withdrawals');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'program_enrollments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'program_enrollments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'program_enrollments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'public_content') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'public_content');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'public_content');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'public_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'public_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'public_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'push_devices') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'push_devices');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'push_devices');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'push_devices');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'recognition_award_types') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'recognition_award_types');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'recognition_award_types');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'recognition_award_types');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'recognition_award_types');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'recognition_awards') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'recognition_awards');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'recognition_awards');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'recognition_awards');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'recognition_awards');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'recognition_programs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'recognition_programs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'recognition_programs');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'recognition_programs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'report_delivery_history') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'report_delivery_history');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'report_delivery_history');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'report_executions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'report_executions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'report_executions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'report_shares') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'report_shares');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'report_shares');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'reports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'reports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'reports');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'reports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'retention_policies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'retention_policies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'retention_policies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'reward_redemptions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'reward_redemptions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'reward_redemptions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'reward_redemptions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'right_of_refusal_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'right_of_refusal_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'right_of_refusal_events');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'right_of_refusal_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'room_bookings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'room_bookings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'room_bookings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'satisfaction_surveys') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'satisfaction_surveys');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'satisfaction_surveys');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'satisfaction_surveys');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'scheduled_reports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'scheduled_reports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'scheduled_reports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'scim_configurations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'scim_configurations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'scim_configurations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'scim_events_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'scim_events_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'scim_events_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'security_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'security_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'security_events');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'security_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'security_posture_checks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'security_posture_checks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'security_posture_checks');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'security_posture_checks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'segment_exports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'segment_exports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'segment_exports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'shopify_config') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'shopify_config');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'shopify_config');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'social_engagement') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'social_engagement');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'social_engagement');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'social_feeds') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'social_feeds');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'social_feeds');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'social_posts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'social_posts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'social_posts');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'social_posts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sso_providers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sso_providers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sso_providers');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'sso_providers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sso_sessions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sso_sessions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sso_sessions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'steward_assignments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'steward_assignments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'steward_assignments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'steward_assignments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'stewards') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'stewards');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'stewards');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'stewards');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'stewards');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'strategic_goals') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'strategic_goals');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'strategic_goals');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'strategic_goals');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'support_tickets') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'support_tickets');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'support_tickets');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'support_tickets');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'survey_answers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'survey_answers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'survey_answers');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'survey_answers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'survey_questions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'survey_questions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'survey_questions');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'survey_questions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'survey_responses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'survey_responses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'survey_responses');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'survey_responses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'surveys') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'surveys');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'surveys');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'surveys');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'task_comments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'task_comments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'task_comments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'training_courses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'training_courses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'training_courses');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'training_courses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'training_programs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'training_programs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'training_programs');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'training_programs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'transaction_fee_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'transaction_fee_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'transaction_fee_events');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'transaction_fee_events');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'transaction_fee_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'transaction_fee_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'transaction_fee_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'transaction_fee_rules');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'transaction_fee_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'trend_analyses') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'trend_analyses');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'trend_analyses');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'trend_analyses');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ue_policy_bindings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ue_policy_bindings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ue_policy_bindings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'user_signatures') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'user_signatures');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'user_signatures');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'user_signatures');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'voting_sessions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'voting_sessions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'voting_sessions');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'voting_sessions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'wcb_employer_assessments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'wcb_employer_assessments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'wcb_employer_assessments');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'wcb_employer_assessments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'website_settings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'website_settings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'website_settings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'worksites') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'worksites');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'worksites');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'worksites');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ab_test_assignments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ab_test_assignments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ab_test_assignments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ab_test_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ab_test_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ab_test_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ab_test_variants') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ab_test_variants');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ab_test_variants');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'access_justification_requests') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'access_justification_requests');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'access_justification_requests');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'address_change_history') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'address_change_history');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'address_change_history');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'address_validation_cache') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'address_validation_cache');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'address_validation_cache');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'alert_actions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'alert_actions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'alert_actions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'alert_conditions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'alert_conditions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'alert_conditions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'alert_executions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'alert_executions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'alert_executions');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'alert_executions');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_system', 'alert_executions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'alert_recipients') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'alert_recipients');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'alert_recipients');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_runs') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'allocation_runs');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'allocation_runs');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'allocation_runs');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_basis_snapshots') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'allocation_basis_snapshots');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'allocation_basis_snapshots');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'allocation_basis_snapshots');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_rule_versions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'allocation_rule_versions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'allocation_rule_versions');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'allocation_rule_versions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'allocation_run_lines') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'allocation_run_lines');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'allocation_run_lines');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'allocation_run_lines');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'arms_length_verification') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'arms_length_verification');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'arms_length_verification');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'automation_execution_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'automation_execution_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'automation_execution_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'automation_schedules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'automation_schedules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'automation_schedules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'autopay_settings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'autopay_settings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'autopay_settings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'award_history') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'award_history');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'award_history');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'band_councils') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'band_councils');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'band_councils');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'bank_of_canada_rates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'bank_of_canada_rates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'bank_of_canada_rates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'bank_transactions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'bank_transactions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'bank_transactions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'benchmark_categories') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'benchmark_categories');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'benchmark_categories');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'benchmark_data') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'benchmark_data');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'benchmark_data');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'benefit_comparisons') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'benefit_comparisons');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'benefit_comparisons');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'blind_trust_registry') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'blind_trust_registry');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'blind_trust_registry');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'break_glass_activations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'break_glass_activations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'break_glass_activations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'break_glass_system') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'break_glass_system');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'break_glass_system');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'certification_alerts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'certification_alerts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'certification_alerts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'certification_compliance_reports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'certification_compliance_reports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'certification_compliance_reports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'certification_types') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'certification_types');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'certification_types');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clause_embeddings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clause_embeddings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clause_embeddings');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'clause_embeddings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clause_library_tags') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clause_library_tags');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clause_library_tags');
    EXECUTE format('GRANT SELECT, INSERT, DELETE ON TABLE %I TO union_eyes_runtime', 'clause_library_tags');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_oauth_tokens') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_oauth_tokens');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_oauth_tokens');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'clc_union_density') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'clc_union_density');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'clc_union_density');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'conflict_disclosures') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'conflict_disclosures');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'conflict_disclosures');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'conflict_of_interest_policy') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'conflict_of_interest_policy');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'conflict_of_interest_policy');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'conflict_training') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'conflict_training');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'conflict_training');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'continuing_education') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'continuing_education');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'continuing_education');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'contract_amendments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'contract_amendments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'contract_amendments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'commercial_contracts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'commercial_contracts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'commercial_contracts');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'commercial_contracts');
    EXECUTE format('GRANT INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'commercial_contracts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'contract_line_items') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'contract_line_items');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'contract_line_items');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'contract_line_items');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'contract_rate_cards') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'contract_rate_cards');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'contract_rate_cards');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'contribution_rates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'contribution_rates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'contribution_rates');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'contribution_rates');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'contribution_rates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'correspondence_recipients') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'correspondence_recipients');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'correspondence_recipients');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'correspondence_recipients');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cost_of_living_data') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cost_of_living_data');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cost_of_living_data');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'cost_of_living_data');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'country_address_formats') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'country_address_formats');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'country_address_formats');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cpi_adjusted_pricing') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cpi_adjusted_pricing');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cpi_adjusted_pricing');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cpi_data') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cpi_data');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cpi_data');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'cross_border_transactions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'cross_border_transactions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'cross_border_transactions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'currency_enforcement_policy') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'currency_enforcement_policy');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'currency_enforcement_policy');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'currency_enforcement_violations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'currency_enforcement_violations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'currency_enforcement_violations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'data_classification_policy') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'data_classification_policy');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'data_classification_policy');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'data_classification_policy');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'data_classification_registry') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'data_classification_registry');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'data_classification_registry');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'data_subject_access_requests') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'data_subject_access_requests');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'data_subject_access_requests');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'data_subject_access_requests');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_system', 'data_subject_access_requests');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'disaster_recovery_drills') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'disaster_recovery_drills');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'disaster_recovery_drills');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dispatch_assignments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dispatch_assignments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dispatch_assignments');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'dispatch_assignments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dsr_activity_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dsr_activity_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dsr_activity_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dunning_policies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dunning_policies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dunning_policies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'dunning_steps') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'dunning_steps');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'dunning_steps');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'emergency_declarations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'emergency_declarations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'emergency_declarations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_access_attempts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_access_attempts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_access_attempts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'employer_reports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'employer_reports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'employer_reports');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'employer_reports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'exchange_rates') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'exchange_rates');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'exchange_rates');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'feature_flags') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'feature_flags');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'feature_flags');
    EXECUTE format('GRANT SELECT, UPDATE ON TABLE %I TO union_eyes_runtime', 'feature_flags');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'federation_executives') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'federation_executives');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'federation_executives');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'federation_meetings') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'federation_meetings');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'federation_meetings');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'federation_resources') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'federation_resources');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'federation_resources');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'firewall_access_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'firewall_access_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'firewall_access_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'firewall_violations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'firewall_violations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'firewall_violations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'fmv_benchmarks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'fmv_benchmarks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'fmv_benchmarks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'fmv_policy') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'fmv_policy');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'fmv_policy');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'fmv_violations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'fmv_violations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'fmv_violations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'geofence_events') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'geofence_events');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'geofence_events');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'geofence_events');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'geofence_events');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'geofences') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'geofences');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'geofences');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'geofences');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'independent_appraisals') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'independent_appraisals');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'independent_appraisals');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'indigenous_data_access_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'indigenous_data_access_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'indigenous_data_access_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'indigenous_data_sharing_agreements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'indigenous_data_sharing_agreements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'indigenous_data_sharing_agreements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'journal_entry_lines') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'journal_entry_lines');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'journal_entry_lines');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'key_holder_registry') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'key_holder_registry');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'key_holder_registry');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'knowledge_base_articles') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'knowledge_base_articles');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'knowledge_base_articles');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'license_renewals') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'license_renewals');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'license_renewals');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'lmbp_compliance_alerts') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'lmbp_compliance_alerts');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'lmbp_compliance_alerts');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'lmbp_compliance_reports') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'lmbp_compliance_reports');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'lmbp_compliance_reports');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'lmbp_letters') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'lmbp_letters');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'lmbp_letters');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'location_deletion_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'location_deletion_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'location_deletion_log');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'location_deletion_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'location_tracking') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'location_tracking');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'location_tracking');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'location_tracking');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'location_tracking');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'location_tracking_config') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'location_tracking_config');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'location_tracking_config');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'location_tracking_config');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'lrb_agreements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'lrb_agreements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'lrb_agreements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'lrb_employers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'lrb_employers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'lrb_employers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'lrb_unions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'lrb_unions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'lrb_unions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'mentorships') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'mentorships');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'mentorships');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'movement_trends') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'movement_trends');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'movement_trends');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'movement_trends');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'negotiation_sessions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'negotiation_sessions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'negotiation_sessions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pack_verification_log') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pack_verification_log');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pack_verification_log');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'policy_evaluations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'policy_evaluations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'policy_evaluations');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'policy_evaluations');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'policy_evaluations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'policy_exceptions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'policy_exceptions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'policy_exceptions');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'policy_exceptions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'precedent_citations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'precedent_citations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'precedent_citations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'precedent_tags') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'precedent_tags');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'precedent_tags');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pricing_discount_rules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pricing_discount_rules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pricing_discount_rules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'pricing_regional_deployments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'pricing_regional_deployments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'pricing_regional_deployments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'privacy_breaches') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'privacy_breaches');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'privacy_breaches');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'procurement_bids') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'procurement_bids');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'procurement_bids');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'procurement_requests') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'procurement_requests');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'procurement_requests');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'provincial_data_handling') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'provincial_data_handling');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'provincial_data_handling');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'provincial_data_handling');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_system', 'provincial_data_handling');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'provincial_privacy_config') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'provincial_privacy_config');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'provincial_privacy_config');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'provincial_privacy_config');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'push_deliveries') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'push_deliveries');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'push_deliveries');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'recovery_time_objectives') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'recovery_time_objectives');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'recovery_time_objectives');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'recusal_tracking') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'recusal_tracking');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'recusal_tracking');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'segment_executions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'segment_executions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'segment_executions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'shared_clause_library') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'shared_clause_library');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'shared_clause_library');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'shared_clause_library');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'signature_verification') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'signature_verification');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'signature_verification');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'signers') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'signers');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'signers');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'sla_policies') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'sla_policies');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'sla_policies');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'staff_certifications') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'staff_certifications');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'staff_certifications');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 't106_filing_tracking') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 't106_filing_tracking');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 't106_filing_tracking');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'tentative_agreements') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'tentative_agreements');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'tentative_agreements');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'tentative_agreements');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'testimonials') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'testimonials');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'testimonials');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'testimonials');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ticket_comments') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ticket_comments');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ticket_comments');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'ticket_history') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'ticket_history');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'ticket_history');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'traditional_knowledge_registry') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'traditional_knowledge_registry');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'traditional_knowledge_registry');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'transaction_currency_conversions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'transaction_currency_conversions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'transaction_currency_conversions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'union_density') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'union_density');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'union_density');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'union_density');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'union_only_data_tags') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'union_only_data_tags');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'union_only_data_tags');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'user_uuid_mapping') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'user_uuid_mapping');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'user_uuid_mapping');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'voter_eligibility') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'voter_eligibility');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'voter_eligibility');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'voter_eligibility');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'votes') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'votes');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'votes');
    EXECUTE format('GRANT SELECT, INSERT ON TABLE %I TO union_eyes_runtime', 'votes');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'voting_options') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'voting_options');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'voting_options');
    EXECUTE format('GRANT SELECT ON TABLE %I TO union_eyes_runtime', 'voting_options');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'wage_benchmarks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'wage_benchmarks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'wage_benchmarks');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_system', 'wage_benchmarks');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'wage_progressions') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'wage_progressions');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'wage_progressions');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'wcag_success_criteria') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'wcag_success_criteria');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'wcag_success_criteria');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'weekly_threshold_tracking') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'weekly_threshold_tracking');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'weekly_threshold_tracking');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'whiplash_violations') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'whiplash_violations');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'whiplash_violations');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_continuity_breakpoints') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workbook_continuity_breakpoints');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workbook_continuity_breakpoints');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_memory_holders') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workbook_memory_holders');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workbook_memory_holders');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %I TO union_eyes_runtime', 'workbook_memory_holders');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_modernization_alignment') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workbook_modernization_alignment');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workbook_modernization_alignment');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_modules') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workbook_modules');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workbook_modules');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_runtime', 'workbook_modules');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_purchases') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workbook_purchases');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workbook_purchases');
    EXECUTE format('GRANT INSERT ON TABLE %I TO union_eyes_system', 'workbook_purchases');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_stewardship_signals') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workbook_stewardship_signals');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workbook_stewardship_signals');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workbook_transformation_roadmap') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workbook_transformation_roadmap');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workbook_transformation_roadmap');
  END IF;
END $$;

DO $$ BEGIN
  IF to_regclass('public.' || 'workbooks') IS NOT NULL THEN
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_runtime', 'workbooks');
    EXECUTE format('REVOKE ALL ON TABLE %I FROM union_eyes_system', 'workbooks');
    EXECUTE format('GRANT SELECT, INSERT, UPDATE ON TABLE %I TO union_eyes_runtime', 'workbooks');
    EXECUTE format('GRANT UPDATE ON TABLE %I TO union_eyes_system', 'workbooks');
  END IF;
END $$;

-- =============================================================================
-- PART D — targeted cleanup (ai_budgets stale auth.user_id() policy)
-- =============================================================================

DO $$
DECLARE
  pol RECORD;
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'ai_budgets') THEN
    FOR pol IN
      SELECT polname FROM pg_policy p
      JOIN pg_class c ON c.oid = p.polrelid
      WHERE c.relname = 'ai_budgets' AND pg_get_expr(p.polqual, p.polrelid) ILIKE '%auth.user_id%'
    LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON ai_budgets', pol.polname);
    END LOOP;
    ALTER TABLE ai_budgets ENABLE ROW LEVEL SECURITY;
    ALTER TABLE ai_budgets FORCE ROW LEVEL SECURITY;
  END IF;
END $$;

-- =============================================================================
-- PART E — blanket grant removal (gated, see header)
-- =============================================================================

-- Every gating condition was true at generation time (0 geometry blockers,
-- 0 TBD privilege entries). 0108's blanket table/sequence grants are narrowed
-- to the exact per-table GRANTs already issued above in PART C. Schema USAGE
-- and database CONNECT are retained (baseline connection-level access, not
-- per-table data access). No PostgreSQL sequences exist in this schema (every
-- table uses a UUID default, not serial/bigserial), so the sequence grant is
-- removed with no replacement.
REVOKE SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system;
REVOKE USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public FROM union_eyes_runtime, union_eyes_system;
