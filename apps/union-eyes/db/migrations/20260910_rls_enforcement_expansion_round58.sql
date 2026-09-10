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

SELECT ue_create_direct_org_rls_policy('ai_clause_reasonings', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('ai_copilot_sessions', 'user_id');
SELECT ue_create_direct_org_rls_policy('ai_insight_reports', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('ai_usage_metrics', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('analytics_metrics', 'organization_id', FALSE);
ALTER TABLE "customer_nps_surveys" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_nps_surveys" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "customer_nps_surveys";
CREATE POLICY ue_system_full_access ON "customer_nps_surveys" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('employer_risk_scores', 'organization_id', FALSE);
ALTER TABLE "icra_continuity_scores" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "icra_continuity_scores" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "icra_continuity_scores";
CREATE POLICY ue_system_full_access ON "icra_continuity_scores" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
ALTER TABLE "icra_followup_recommendations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "icra_followup_recommendations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "icra_followup_recommendations";
CREATE POLICY ue_system_full_access ON "icra_followup_recommendations" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('insight_recommendations', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('ml_predictions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('model_metadata', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pilot_metrics', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('social_analytics', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('claim_deadlines', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('deadline_reminders', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('grievance_case_access_assignments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('ai_grievance_triages', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('arbitrations', 'grievance_id', 'grievances', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('bargaining_notes', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('bargaining_units', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('case_documents', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('cba_clauses', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('cba_rule_set_items', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('cba_rule_versions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('collective_agreements', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_insurance_claims', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('grievance_documents', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('grievance_settlements', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('grievance_timeline_events', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('grievance_transitions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pension_benefit_claims', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('settlements', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('wcb_claims', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('arbitration_precedents', 'source_organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('bargaining_proposals', 'negotiation_id', 'negotiations', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('claim_updates', 'claim_id', 'claims', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('grievance_events', 'grievance_id', 'grievances', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('grievance_timeline', 'grievance_id', 'grievances', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('campaigns', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('chat_sessions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('communication_preferences', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('consent_records', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('cookie_consents', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('data_aggregation_consent', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('donation_campaigns', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_communications', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_communication_channels', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_communication_messages', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_communication_users', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('in_app_notifications', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('message_log', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('newsletter_campaigns', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('newsletter_distribution_lists', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('notification_delivery_log', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('notification_queue', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('notification_tracking', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('notifications', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('organizing_campaigns', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('push_notifications', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('sms_campaigns', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('sms_conversations', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('sms_messages', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('social_campaigns', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('user_consents', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('user_notification_preferences', 'user_id');
SELECT ue_create_parent_owned_rls_policy_v2('chat_messages', 'session_id', 'chat_sessions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('newsletter_list_subscribers', 'list_id', 'newsletter_distribution_lists', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('newsletter_recipients', 'campaign_id', 'newsletter_campaigns', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('provincial_consent', 'user_id');
SELECT ue_create_direct_org_rls_policy('cms_media_library', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('document_access_grants', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('document_folders', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('document_links', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('document_versions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_execution_evidence_links', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_execution_profiles', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('exit_interview_documents', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_communication_files', 'org_id', FALSE);
ALTER TABLE "icra_maturity_profiles" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "icra_maturity_profiles" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "icra_maturity_profiles";
CREATE POLICY ue_system_full_access ON "icra_maturity_profiles" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('message_templates', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('notification_templates', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('signature_documents', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('document_signers', 'document_id', 'signature_documents', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('profiles', 'user_id');
SELECT ue_create_mixed_global_tenant_rls_policy('account_mappings', 'organization_id');
SELECT ue_create_direct_org_rls_policy('bank_accounts', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('bank_reconciliation', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('bank_reconciliations', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('billing_accounts', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('billing_periods', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('billing_subscriptions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('budget_pool', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('chart_of_accounts', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('clc_remittance_mapping', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('cost_centers', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('dues_assignments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('dues_rates', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('dues_transactions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('employer_payroll_run_items', 'payroll_run_id', 'employer_payroll_runs', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_payroll_runs', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('employer_remittance_run_items', 'remittance_run_id', 'employer_remittance_runs', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_remittance_runs', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_remittances', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('entitlement_usage_log', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('erp_invoices', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('financial_periods', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('gl_account_mappings', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('gl_transaction_log', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('gl_trial_balance', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('payment_cycles', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('payment_disputes', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('payment_methods', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('payment_plans', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('payments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('payroll_deductions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pension_contributions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pension_plans', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pension_t4a_records', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pension_trustee_meetings', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pension_trustees', 'organization_id', FALSE);
SELECT ue_create_multi_party_rls_policy('per_capita_remittances', 'from_organization_id', 'to_organization_id');
SELECT ue_create_direct_org_rls_policy('platform_cost_ledger_entries', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('platform_invoices', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('platform_payments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('reconciliation_exceptions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('reconciliation_runs', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('remittance_exceptions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('remittance_line_items', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('reward_budget_envelopes', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('reward_wallet_ledger', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('social_accounts', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('subscription_events_log', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('payment_allocations', 'payment_id', 'platform_payments', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('platform_invoice_line_items', 'invoice_id', 'platform_invoices', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('reconciliation_matches', 'run_id', 'reconciliation_runs', 'organization_id', FALSE);
ALTER TABLE "remittance_approvals" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "remittance_approvals" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "remittance_approvals";
CREATE POLICY ue_system_full_access ON "remittance_approvals" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('strike_fund_disbursements', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('board_packets', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('committee_action_items', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('committee_documents', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('committee_intelligence_snapshots', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('committee_meetings', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('committees', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('governance_policies', 'organization_id', FALSE);
ALTER TABLE "icra_governance_flags" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "icra_governance_flags" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "icra_governance_flags";
CREATE POLICY ue_system_full_access ON "icra_governance_flags" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('joint_hs_committees', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('board_packet_distributions', 'packet_id', 'board_packets', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('committee_meeting_attendees', 'meeting_id', 'committee_meetings', 'organization_id', FALSE);
ALTER TABLE "council_elections" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "council_elections" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "council_elections";
CREATE POLICY ue_system_full_access ON "council_elections" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
ALTER TABLE "golden_shares" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "golden_shares" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "golden_shares";
CREATE POLICY ue_system_full_access ON "golden_shares" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
ALTER TABLE "governance_events" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "governance_events" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "governance_events";
CREATE POLICY ue_system_full_access ON "governance_events" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
ALTER TABLE "mission_audits" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "mission_audits" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "mission_audits";
CREATE POLICY ue_system_full_access ON "mission_audits" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
ALTER TABLE "reserved_matter_votes" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "reserved_matter_votes" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "reserved_matter_votes";
CREATE POLICY ue_system_full_access ON "reserved_matter_votes" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_parent_owned_via_user_rls_policy_v2('workbook_governance_lineage_entries', 'workbook_id', 'workbooks', 'claimed_by_user_id');
SELECT ue_create_direct_org_rls_policy('deadline_audit_events', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('ai_safety_filters', 'session_id', 'chat_sessions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('correspondence_audit_trail', 'correspondence_id', 'correspondence', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('location_tracking_audit', 'user_id');
SELECT ue_create_parent_owned_rls_policy_v2('signature_audit_trail', 'document_id', 'signature_documents', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('api_integrations', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('clc_sync_log', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_timesheet_batches', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_accounts', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_benefit_coverage', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_benefit_dependents', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_benefit_enrollments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_benefit_plans', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_benefit_utilization', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_calendar_connections', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_customers', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_departments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_employees', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_insurance_beneficiaries', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_insurance_policies', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_invoices', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_lms_completions', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_lms_courses', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_lms_enrollments', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_lms_learners', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_lms_progress', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_payments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('external_positions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('ingestion_batches', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('integration_api_keys', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('integration_configs', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('integration_partners', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('integration_sync_log', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('integration_webhooks', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('ingestion_records', 'batch_id', 'ingestion_batches', 'organization_id', FALSE);
ALTER TABLE "webhook_receipts" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "webhook_receipts" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "webhook_receipts";
CREATE POLICY ue_system_full_access ON "webhook_receipts" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
ALTER TABLE "clc_organization_sync_log" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "clc_organization_sync_log" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "clc_organization_sync_log";
CREATE POLICY ue_system_full_access ON "clc_organization_sync_log" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
ALTER TABLE "icra_organizations" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "icra_organizations" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "icra_organizations";
CREATE POLICY ue_system_full_access ON "icra_organizations" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('member_arrears', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('member_breaks', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('member_certifications', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('member_dues_issues', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('member_dues_ledger', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('member_employment', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('member_history_events', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('member_jurisdiction_preferences', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('member_segments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('org_entitlements', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('org_subscriptions', 'organization_id', FALSE);
ALTER TABLE "organization_billing_config" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_billing_config" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "organization_billing_config";
CREATE POLICY ue_system_full_access ON "organization_billing_config" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('pension_members', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('duplicate_group_members', 'group_id', 'duplicate_groups', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('member_location_consent', 'user_id');
SELECT ue_create_direct_org_rls_policy('pilot_applications', 'verified_organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('org_configurations', 'organization_id', FALSE);
ALTER TABLE "organization_relationships" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "organization_relationships" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "organization_relationships";
CREATE POLICY ue_system_full_access ON "organization_relationships" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('alert_rules', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('allocation_rules', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('anti_scab_violations', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('automation_rules', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('break_policies', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('calendar_events', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('calendars', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('chargeback_statements', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('clause_comparisons', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('cms_pages', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('cnesst_filings', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('compliance_alerts', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('contract_covered_orgs', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('correspondence', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('course_registrations', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('course_sessions', 'organization_id', FALSE);
ALTER TABLE "customer_onboarding_milestones" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "customer_onboarding_milestones" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "customer_onboarding_milestones";
CREATE POLICY ue_system_full_access ON "customer_onboarding_milestones" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('data_quality_warnings', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('defensibility_packs', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('dispatch_requests', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('dispatch_rules', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('duplicate_groups', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_contacts', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_execution_artifacts', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_execution_compliance_events', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_execution_replays', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employer_timesheet_entries', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('employers', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('exit_interview_events', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('exit_interviews', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('federations', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('fee_adjustments', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('gdpr_data_requests', 'user_id');
SELECT ue_create_mixed_global_tenant_rls_policy('holidays', 'organization_id');
ALTER TABLE "icra_assessments" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "icra_assessments" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "icra_assessments";
CREATE POLICY ue_system_full_access ON "icra_assessments" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
ALTER TABLE "icra_assessment_answers" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "icra_assessment_answers" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "icra_assessment_answers";
CREATE POLICY ue_system_full_access ON "icra_assessment_answers" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('knowledge_base', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('kpi_configurations', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('meeting_rooms', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('mobile_devices', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('negotiations', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('organizer_tasks', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pay_equity_exercises', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pilot_checklist_items', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pilot_demo_seeds', 'organization_id', FALSE);
SELECT ue_create_mixed_global_tenant_rls_policy('pilot_enrollments', 'organization_id');
SELECT ue_create_direct_org_rls_policy('pilot_events', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pilot_feedback', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('pilot_milestones', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('policy_rules', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('poll_votes', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('polls', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('preventive_withdrawals', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('push_devices', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('recognition_award_types', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('recognition_awards', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('recognition_programs', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('reports', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('reward_redemptions', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('right_of_refusal_events', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('satisfaction_surveys', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('security_events', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('security_posture_checks', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('social_posts', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('sso_providers', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('steward_assignments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('stewards', 'org_id', FALSE);
SELECT ue_create_direct_org_rls_policy('strategic_goals', 'organization_id', FALSE);
ALTER TABLE "support_tickets" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "support_tickets" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "support_tickets";
CREATE POLICY ue_system_full_access ON "support_tickets" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_direct_org_rls_policy('survey_answers', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('survey_questions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('survey_responses', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('surveys', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('training_courses', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('training_programs', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('transaction_fee_events', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('transaction_fee_rules', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('trend_analyses', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('user_signatures', 'user_id');
SELECT ue_create_direct_org_rls_policy('voting_sessions', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('wcb_employer_assessments', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('worksites', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('alert_executions', 'alert_rule_id', 'alert_rules', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('allocation_runs', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('allocation_basis_snapshots', 'run_id', 'allocation_runs', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('allocation_rule_versions', 'rule_id', 'allocation_rules', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('allocation_run_lines', 'run_id', 'allocation_runs', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('clause_embeddings', 'clause_id', 'cba_clauses', 'organization_id', FALSE);
SELECT ue_create_shared_library_child_rls_policy('clause_library_tags', 'clause_id');
SELECT ue_create_direct_org_rls_policy('commercial_contracts', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('contract_line_items', 'contract_id', 'commercial_contracts', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('correspondence_recipients', 'correspondence_id', 'correspondence', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('data_subject_access_requests', 'user_id');
SELECT ue_create_parent_owned_rls_policy_v2('dispatch_assignments', 'request_id', 'dispatch_requests', 'org_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('employer_reports', 'employer_id', 'employers', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('geofence_events', 'user_id');
SELECT ue_create_direct_org_rls_policy('geofences', 'union_local_id', FALSE);
SELECT ue_create_user_rls_policy('location_tracking', 'user_id');
SELECT ue_create_parent_owned_rls_policy_v2('policy_evaluations', 'rule_id', 'policy_rules', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('policy_exceptions', 'rule_id', 'policy_rules', 'organization_id', FALSE);
SELECT ue_create_user_rls_policy('provincial_data_handling', 'user_id');
SELECT ue_create_shared_library_rls_policy('shared_clause_library', 'source_organization_id', 'sharing_level', 'shared_with_org_ids');
SELECT ue_create_parent_owned_rls_policy_v2('tentative_agreements', 'negotiation_id', 'negotiations', 'organization_id', FALSE);
ALTER TABLE "union_density" ENABLE ROW LEVEL SECURITY;
ALTER TABLE "union_density" FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON "union_density";
CREATE POLICY ue_system_full_access ON "union_density" FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
SELECT ue_create_parent_owned_rls_policy_v2('voter_eligibility', 'session_id', 'voting_sessions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('votes', 'session_id', 'voting_sessions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('voting_options', 'session_id', 'voting_sessions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_via_user_rls_policy_v2('workbook_memory_holders', 'workbook_id', 'workbooks', 'claimed_by_user_id');
SELECT ue_create_parent_owned_via_user_rls_policy_v2('workbook_modules', 'workbook_id', 'workbooks', 'claimed_by_user_id');
SELECT ue_create_parent_owned_via_user_rls_policy_v2('workbook_purchases', 'workbook_id', 'workbooks', 'claimed_by_user_id');
SELECT ue_create_user_rls_policy('workbooks', 'claimed_by_user_id');

-- =============================================================================
-- PART C — exact GRANT compiler (every manifest entry, all 700 tables)
-- =============================================================================

REVOKE ALL ON TABLE "ai_clause_reasonings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_clause_reasonings" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "ai_clause_reasonings" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ai_copilot_sessions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_copilot_sessions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "ai_copilot_sessions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ai_insight_reports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_insight_reports" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "ai_insight_reports" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ai_rate_limits" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_rate_limits" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_usage_metrics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_usage_metrics" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "ai_usage_metrics" TO union_eyes_runtime;

REVOKE ALL ON TABLE "analytics_metrics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "analytics_metrics" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "analytics_metrics" TO union_eyes_runtime;

REVOKE ALL ON TABLE "analytics_scheduled_reports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "analytics_scheduled_reports" FROM union_eyes_system;

REVOKE ALL ON TABLE "customer_nps_surveys" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "customer_nps_surveys" FROM union_eyes_system;
GRANT SELECT ON TABLE "customer_nps_surveys" TO union_eyes_system;

REVOKE ALL ON TABLE "employer_risk_scores" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_risk_scores" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "employer_risk_scores" TO union_eyes_runtime;

REVOKE ALL ON TABLE "icra_continuity_scores" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_continuity_scores" FROM union_eyes_system;

REVOKE ALL ON TABLE "icra_followup_recommendations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_followup_recommendations" FROM union_eyes_system;

REVOKE ALL ON TABLE "icra_anonymized_metrics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_anonymized_metrics" FROM union_eyes_system;

REVOKE ALL ON TABLE "impact_metrics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "impact_metrics" FROM union_eyes_system;

REVOKE ALL ON TABLE "insight_recommendations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "insight_recommendations" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "insight_recommendations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ml_predictions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ml_predictions" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "ml_predictions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "mobile_analytics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "mobile_analytics" FROM union_eyes_system;

REVOKE ALL ON TABLE "model_metadata" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "model_metadata" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "model_metadata" TO union_eyes_runtime;

REVOKE ALL ON TABLE "page_analytics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "page_analytics" FROM union_eyes_system;

REVOKE ALL ON TABLE "pilot_metrics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pilot_metrics" FROM union_eyes_system;
GRANT SELECT ON TABLE "pilot_metrics" TO union_eyes_runtime;

REVOKE ALL ON TABLE "social_analytics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "social_analytics" FROM union_eyes_system;
GRANT SELECT ON TABLE "social_analytics" TO union_eyes_runtime;

REVOKE ALL ON TABLE "usage_aggregates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "usage_aggregates" FROM union_eyes_system;

REVOKE ALL ON TABLE "usage_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "usage_events" FROM union_eyes_system;

REVOKE ALL ON TABLE "usage_meters" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "usage_meters" FROM union_eyes_system;

REVOKE ALL ON TABLE "user_engagement_scores" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "user_engagement_scores" FROM union_eyes_system;

REVOKE ALL ON TABLE "organization_members" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organization_members" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organization_members" TO union_eyes_runtime;
GRANT SELECT, UPDATE ON TABLE "organization_members" TO union_eyes_system;

REVOKE ALL ON TABLE "organizations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organizations" FROM union_eyes_system;
GRANT SELECT, UPDATE ON TABLE "organizations" TO union_eyes_runtime;
GRANT SELECT, INSERT ON TABLE "organizations" TO union_eyes_system;

REVOKE ALL ON TABLE "grievances" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievances" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "grievances" TO union_eyes_runtime;

REVOKE ALL ON TABLE "claims" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "claims" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "claims" TO union_eyes_runtime;

REVOKE ALL ON TABLE "grievance_deadlines" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_deadlines" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "grievance_deadlines" TO union_eyes_runtime;
GRANT SELECT ON TABLE "grievance_deadlines" TO union_eyes_system;

REVOKE ALL ON TABLE "documents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "documents" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "documents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "member_documents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_documents" FROM union_eyes_system;

REVOKE ALL ON TABLE "workplace_incidents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workplace_incidents" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "workplace_incidents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "safety_inspections" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "safety_inspections" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "safety_inspections" TO union_eyes_runtime;

REVOKE ALL ON TABLE "hazard_reports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "hazard_reports" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "hazard_reports" TO union_eyes_runtime;

REVOKE ALL ON TABLE "safety_committee_meetings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "safety_committee_meetings" FROM union_eyes_system;

REVOKE ALL ON TABLE "safety_training_records" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "safety_training_records" FROM union_eyes_system;
GRANT SELECT ON TABLE "safety_training_records" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ppe_equipment" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ppe_equipment" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "ppe_equipment" TO union_eyes_runtime;

REVOKE ALL ON TABLE "safety_audits" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "safety_audits" FROM union_eyes_system;

REVOKE ALL ON TABLE "injury_logs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "injury_logs" FROM union_eyes_system;

REVOKE ALL ON TABLE "safety_policies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "safety_policies" FROM union_eyes_system;

REVOKE ALL ON TABLE "corrective_actions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "corrective_actions" FROM union_eyes_system;

REVOKE ALL ON TABLE "safety_certifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "safety_certifications" FROM union_eyes_system;

REVOKE ALL ON TABLE "message_threads" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "message_threads" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "message_threads" TO union_eyes_runtime;

REVOKE ALL ON TABLE "messages" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "messages" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "messages" TO union_eyes_runtime;

REVOKE ALL ON TABLE "message_participants" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "message_participants" FROM union_eyes_system;

REVOKE ALL ON TABLE "message_read_receipts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "message_read_receipts" FROM union_eyes_system;
GRANT SELECT ON TABLE "message_read_receipts" TO union_eyes_runtime;

REVOKE ALL ON TABLE "message_notifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "message_notifications" FROM union_eyes_system;

REVOKE ALL ON TABLE "cross_org_access_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cross_org_access_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "claim_deadlines" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "claim_deadlines" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "claim_deadlines" TO union_eyes_runtime;

REVOKE ALL ON TABLE "deadline_reminders" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "deadline_reminders" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "deadline_reminders" TO union_eyes_runtime;
GRANT SELECT ON TABLE "deadline_reminders" TO union_eyes_system;

REVOKE ALL ON TABLE "grievance_case_access_assignments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_case_access_assignments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "grievance_case_access_assignments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "grievance_assignments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_assignments" FROM union_eyes_system;

REVOKE ALL ON TABLE "deadline_reassignment_convergence" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "deadline_reassignment_convergence" FROM union_eyes_system;

REVOKE ALL ON TABLE "deadline_alerts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "deadline_alerts" FROM union_eyes_system;

REVOKE ALL ON TABLE "deadline_extensions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "deadline_extensions" FROM union_eyes_system;

REVOKE ALL ON TABLE "deadline_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "deadline_rules" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_grievance_triages" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_grievance_triages" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "ai_grievance_triages" TO union_eyes_runtime;

REVOKE ALL ON TABLE "arbitrations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "arbitrations" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "arbitrations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "bargaining_notes" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "bargaining_notes" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "bargaining_notes" TO union_eyes_runtime;

REVOKE ALL ON TABLE "bargaining_units" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "bargaining_units" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "bargaining_units" TO union_eyes_runtime;

REVOKE ALL ON TABLE "case_documents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "case_documents" FROM union_eyes_system;
GRANT SELECT ON TABLE "case_documents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "case_studies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "case_studies" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "case_studies" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_clauses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_clauses" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cba_clauses" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_rule_set_items" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_rule_set_items" FROM union_eyes_system;
GRANT SELECT ON TABLE "cba_rule_set_items" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_rule_versions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_rule_versions" FROM union_eyes_system;
GRANT SELECT ON TABLE "cba_rule_versions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "collective_agreements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "collective_agreements" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "collective_agreements" TO union_eyes_runtime;
GRANT SELECT ON TABLE "collective_agreements" TO union_eyes_system;

REVOKE ALL ON TABLE "claim_precedent_analysis" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "claim_precedent_analysis" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_insurance_claims" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_insurance_claims" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_insurance_claims" TO union_eyes_runtime;

REVOKE ALL ON TABLE "fee_settlement_lines" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "fee_settlement_lines" FROM union_eyes_system;

REVOKE ALL ON TABLE "grievance_approvals" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_approvals" FROM union_eyes_system;

REVOKE ALL ON TABLE "grievance_communications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_communications" FROM union_eyes_system;

REVOKE ALL ON TABLE "grievance_documents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_documents" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "grievance_documents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "grievance_settlements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_settlements" FROM union_eyes_system;
GRANT SELECT ON TABLE "grievance_settlements" TO union_eyes_runtime;

REVOKE ALL ON TABLE "grievance_stages" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_stages" FROM union_eyes_system;

REVOKE ALL ON TABLE "grievance_timeline_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_timeline_events" FROM union_eyes_system;
GRANT INSERT ON TABLE "grievance_timeline_events" TO union_eyes_runtime;

REVOKE ALL ON TABLE "grievance_transitions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_transitions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "grievance_transitions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "grievance_workflows" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_workflows" FROM union_eyes_system;

REVOKE ALL ON TABLE "pension_benefit_claims" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_benefit_claims" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "pension_benefit_claims" TO union_eyes_runtime;

REVOKE ALL ON TABLE "settlements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "settlements" FROM union_eyes_system;
GRANT SELECT ON TABLE "settlements" TO union_eyes_runtime;

REVOKE ALL ON TABLE "signature_workflows" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "signature_workflows" FROM union_eyes_system;

REVOKE ALL ON TABLE "union_representation_votes" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "union_representation_votes" FROM union_eyes_system;

REVOKE ALL ON TABLE "wcb_claims" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "wcb_claims" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wcb_claims" TO union_eyes_runtime;

REVOKE ALL ON TABLE "workflow_definitions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workflow_definitions" FROM union_eyes_system;

REVOKE ALL ON TABLE "workflow_executions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workflow_executions" FROM union_eyes_system;

REVOKE ALL ON TABLE "arbitration_decisions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "arbitration_decisions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "arbitration_decisions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "arbitration_precedents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "arbitration_precedents" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "arbitration_precedents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "bargaining_proposals" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "bargaining_proposals" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "bargaining_proposals" TO union_eyes_runtime;

REVOKE ALL ON TABLE "bargaining_team_members" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "bargaining_team_members" FROM union_eyes_system;

REVOKE ALL ON TABLE "cba_contacts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_contacts" FROM union_eyes_system;

REVOKE ALL ON TABLE "cba_footnotes" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_footnotes" FROM union_eyes_system;

REVOKE ALL ON TABLE "cba_intel_agreements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_agreements" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cba_intel_agreements" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_intel_benchmark_snapshots" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_benchmark_snapshots" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "cba_intel_benchmark_snapshots" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_intel_clauses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_clauses" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cba_intel_clauses" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_intel_documents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_documents" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cba_intel_documents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_intel_extraction_runs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_extraction_runs" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cba_intel_extraction_runs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_intel_findings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_findings" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cba_intel_findings" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_intel_freshness_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_freshness_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "cba_intel_ingestion_jobs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_ingestion_jobs" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cba_intel_ingestion_jobs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_intel_review_decisions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_review_decisions" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "cba_intel_review_decisions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_intel_sources" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_sources" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cba_intel_sources" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_intel_wage_adjustments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_intel_wage_adjustments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cba_intel_wage_adjustments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cba_version_history" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cba_version_history" FROM union_eyes_system;

REVOKE ALL ON TABLE "claim_updates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "claim_updates" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "claim_updates" TO union_eyes_runtime;

REVOKE ALL ON TABLE "clc_bargaining_trends" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_bargaining_trends" FROM union_eyes_system;

REVOKE ALL ON TABLE "deadline_reminder_executions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "deadline_reminder_executions" FROM union_eyes_system;

REVOKE ALL ON TABLE "fee_settlement_batches" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "fee_settlement_batches" FROM union_eyes_system;

REVOKE ALL ON TABLE "grievance_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_events" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "grievance_events" TO union_eyes_runtime;

REVOKE ALL ON TABLE "grievance_responses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_responses" FROM union_eyes_system;

REVOKE ALL ON TABLE "grievance_timeline" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "grievance_timeline" FROM union_eyes_system;
GRANT SELECT ON TABLE "grievance_timeline" TO union_eyes_runtime;

REVOKE ALL ON TABLE "campaigns" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "campaigns" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "campaigns" TO union_eyes_runtime;
GRANT SELECT, UPDATE ON TABLE "campaigns" TO union_eyes_system;

REVOKE ALL ON TABLE "chat_sessions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "chat_sessions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "chat_sessions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "chatbot_analytics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "chatbot_analytics" FROM union_eyes_system;

REVOKE ALL ON TABLE "chatbot_suggestions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "chatbot_suggestions" FROM union_eyes_system;

REVOKE ALL ON TABLE "communication_analytics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "communication_analytics" FROM union_eyes_system;

REVOKE ALL ON TABLE "communication_channels" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "communication_channels" FROM union_eyes_system;

REVOKE ALL ON TABLE "communication_preferences" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "communication_preferences" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "communication_preferences" TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE "communication_preferences" TO union_eyes_system;

REVOKE ALL ON TABLE "communication_preferences_phase4" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "communication_preferences_phase4" FROM union_eyes_system;

REVOKE ALL ON TABLE "consent_records" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "consent_records" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "consent_records" TO union_eyes_runtime;
GRANT INSERT ON TABLE "consent_records" TO union_eyes_system;

REVOKE ALL ON TABLE "cookie_consents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cookie_consents" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cookie_consents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "data_aggregation_consent" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "data_aggregation_consent" FROM union_eyes_system;
GRANT SELECT ON TABLE "data_aggregation_consent" TO union_eyes_runtime;

REVOKE ALL ON TABLE "donation_campaigns" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "donation_campaigns" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "donation_campaigns" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_communications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_communications" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "employer_communications" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_communication_channels" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_communication_channels" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_communication_channels" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_communication_messages" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_communication_messages" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_communication_messages" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_communication_users" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_communication_users" FROM union_eyes_system;
GRANT INSERT, UPDATE ON TABLE "external_communication_users" TO union_eyes_runtime;

REVOKE ALL ON TABLE "in_app_notifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "in_app_notifications" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "in_app_notifications" TO union_eyes_runtime;

REVOKE ALL ON TABLE "message_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "message_log" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "message_log" TO union_eyes_runtime;
GRANT SELECT, UPDATE ON TABLE "message_log" TO union_eyes_system;

REVOKE ALL ON TABLE "mobile_notifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "mobile_notifications" FROM union_eyes_system;

REVOKE ALL ON TABLE "newsletter_campaigns" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "newsletter_campaigns" FROM union_eyes_system;
GRANT SELECT ON TABLE "newsletter_campaigns" TO union_eyes_runtime;

REVOKE ALL ON TABLE "newsletter_distribution_lists" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "newsletter_distribution_lists" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "newsletter_distribution_lists" TO union_eyes_runtime;

REVOKE ALL ON TABLE "notification_bounces" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "notification_bounces" FROM union_eyes_system;

REVOKE ALL ON TABLE "notification_delivery_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "notification_delivery_log" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "notification_delivery_log" TO union_eyes_runtime;
GRANT INSERT ON TABLE "notification_delivery_log" TO union_eyes_system;

REVOKE ALL ON TABLE "notification_history" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "notification_history" FROM union_eyes_system;

REVOKE ALL ON TABLE "notification_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "notification_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "notification_queue" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "notification_queue" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notification_queue" TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE "notification_queue" TO union_eyes_system;

REVOKE ALL ON TABLE "notification_tracking" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "notification_tracking" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "notification_tracking" TO union_eyes_runtime;

REVOKE ALL ON TABLE "notifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "notifications" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "notifications" TO union_eyes_runtime;

REVOKE ALL ON TABLE "organizing_campaign_milestones" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organizing_campaign_milestones" FROM union_eyes_system;

REVOKE ALL ON TABLE "organizing_campaigns" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organizing_campaigns" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "organizing_campaigns" TO union_eyes_runtime;

REVOKE ALL ON TABLE "push_notifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "push_notifications" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "push_notifications" TO union_eyes_runtime;

REVOKE ALL ON TABLE "sms_campaigns" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sms_campaigns" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "sms_campaigns" TO union_eyes_runtime;

REVOKE ALL ON TABLE "sms_conversations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sms_conversations" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "sms_conversations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "sms_messages" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sms_messages" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "sms_messages" TO union_eyes_runtime;

REVOKE ALL ON TABLE "sms_opt_outs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sms_opt_outs" FROM union_eyes_system;

REVOKE ALL ON TABLE "sms_rate_limits" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sms_rate_limits" FROM union_eyes_system;

REVOKE ALL ON TABLE "social_campaigns" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "social_campaigns" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "social_campaigns" TO union_eyes_runtime;

REVOKE ALL ON TABLE "user_consents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "user_consents" FROM union_eyes_system;
GRANT SELECT, UPDATE ON TABLE "user_consents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "user_notification_preferences" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "user_notification_preferences" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "user_notification_preferences" TO union_eyes_runtime;
GRANT SELECT, UPDATE ON TABLE "user_notification_preferences" TO union_eyes_system;

REVOKE ALL ON TABLE "band_council_consent" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "band_council_consent" FROM union_eyes_system;

REVOKE ALL ON TABLE "chat_messages" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "chat_messages" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "chat_messages" TO union_eyes_runtime;

REVOKE ALL ON TABLE "federation_campaigns" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "federation_campaigns" FROM union_eyes_system;

REVOKE ALL ON TABLE "federation_communications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "federation_communications" FROM union_eyes_system;

REVOKE ALL ON TABLE "newsletter_engagement" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "newsletter_engagement" FROM union_eyes_system;

REVOKE ALL ON TABLE "newsletter_list_subscribers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "newsletter_list_subscribers" FROM union_eyes_system;
GRANT SELECT, UPDATE ON TABLE "newsletter_list_subscribers" TO union_eyes_runtime;

REVOKE ALL ON TABLE "newsletter_recipients" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "newsletter_recipients" FROM union_eyes_system;
GRANT SELECT ON TABLE "newsletter_recipients" TO union_eyes_runtime;

REVOKE ALL ON TABLE "provincial_consent" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "provincial_consent" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "provincial_consent" TO union_eyes_runtime;
GRANT SELECT ON TABLE "provincial_consent" TO union_eyes_system;

REVOKE ALL ON TABLE "sms_campaign_recipients" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sms_campaign_recipients" FROM union_eyes_system;

REVOKE ALL ON TABLE "voting_notifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "voting_notifications" FROM union_eyes_system;

REVOKE ALL ON TABLE "award_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "award_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "cms_media_library" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cms_media_library" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cms_media_library" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cms_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cms_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "communication_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "communication_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "document_access_grants" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "document_access_grants" FROM union_eyes_system;
GRANT SELECT ON TABLE "document_access_grants" TO union_eyes_runtime;

REVOKE ALL ON TABLE "document_folders" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "document_folders" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "document_folders" TO union_eyes_runtime;

REVOKE ALL ON TABLE "document_links" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "document_links" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "document_links" TO union_eyes_runtime;

REVOKE ALL ON TABLE "document_search_index" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "document_search_index" FROM union_eyes_system;

REVOKE ALL ON TABLE "document_versions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "document_versions" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "document_versions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_execution_evidence_links" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_execution_evidence_links" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "employer_execution_evidence_links" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_execution_profiles" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_execution_profiles" FROM union_eyes_system;
GRANT SELECT ON TABLE "employer_execution_profiles" TO union_eyes_runtime;

REVOKE ALL ON TABLE "exit_interview_documents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "exit_interview_documents" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "exit_interview_documents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_communication_files" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_communication_files" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_communication_files" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_document_files" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_document_files" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_document_libraries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_document_libraries" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_document_permissions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_document_permissions" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_document_sites" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_document_sites" FROM union_eyes_system;

REVOKE ALL ON TABLE "icra_maturity_profiles" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_maturity_profiles" FROM union_eyes_system;

REVOKE ALL ON TABLE "message_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "message_templates" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "message_templates" TO union_eyes_runtime;

REVOKE ALL ON TABLE "newsletter_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "newsletter_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "notification_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "notification_templates" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "notification_templates" TO union_eyes_runtime;

REVOKE ALL ON TABLE "push_notification_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "push_notification_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "report_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "report_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "signature_documents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "signature_documents" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "signature_documents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "signature_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "signature_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "sms_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sms_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "arbitrator_profiles" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "arbitrator_profiles" FROM union_eyes_system;

REVOKE ALL ON TABLE "document_signers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "document_signers" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "document_signers" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pending_profiles" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pending_profiles" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "pending_profiles" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pricing_template_modules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pricing_template_modules" FROM union_eyes_system;

REVOKE ALL ON TABLE "pricing_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pricing_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "profiles" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "profiles" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "profiles" TO union_eyes_runtime;

REVOKE ALL ON TABLE "swiss_cold_storage" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "swiss_cold_storage" FROM union_eyes_system;

REVOKE ALL ON TABLE "transfer_pricing_documentation" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "transfer_pricing_documentation" FROM union_eyes_system;

REVOKE ALL ON TABLE "account_mappings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "account_mappings" FROM union_eyes_system;
GRANT SELECT ON TABLE "account_mappings" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ai_budgets" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_budgets" FROM union_eyes_system;

REVOKE ALL ON TABLE "bank_accounts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "bank_accounts" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "bank_accounts" TO union_eyes_runtime;

REVOKE ALL ON TABLE "bank_reconciliation" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "bank_reconciliation" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "bank_reconciliation" TO union_eyes_runtime;

REVOKE ALL ON TABLE "bank_reconciliations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "bank_reconciliations" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "bank_reconciliations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "billing_accounts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "billing_accounts" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "billing_accounts" TO union_eyes_runtime;
GRANT SELECT ON TABLE "billing_accounts" TO union_eyes_system;

REVOKE ALL ON TABLE "billing_adjustments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "billing_adjustments" FROM union_eyes_system;

REVOKE ALL ON TABLE "billing_invoices" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "billing_invoices" FROM union_eyes_system;

REVOKE ALL ON TABLE "billing_payments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "billing_payments" FROM union_eyes_system;

REVOKE ALL ON TABLE "billing_periods" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "billing_periods" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "billing_periods" TO union_eyes_runtime;

REVOKE ALL ON TABLE "billing_subscriptions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "billing_subscriptions" FROM union_eyes_system;
GRANT SELECT ON TABLE "billing_subscriptions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "budget_pool" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "budget_pool" FROM union_eyes_system;
GRANT SELECT ON TABLE "budget_pool" TO union_eyes_runtime;

REVOKE ALL ON TABLE "chart_of_accounts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "chart_of_accounts" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "chart_of_accounts" TO union_eyes_runtime;

REVOKE ALL ON TABLE "clc_remittance_mapping" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_remittance_mapping" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "clc_remittance_mapping" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cost_centers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cost_centers" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cost_centers" TO union_eyes_runtime;

REVOKE ALL ON TABLE "donation_receipts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "donation_receipts" FROM union_eyes_system;

REVOKE ALL ON TABLE "donations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "donations" FROM union_eyes_system;

REVOKE ALL ON TABLE "dues_assignments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dues_assignments" FROM union_eyes_system;
GRANT SELECT ON TABLE "dues_assignments" TO union_eyes_runtime;
GRANT SELECT ON TABLE "dues_assignments" TO union_eyes_system;

REVOKE ALL ON TABLE "dues_policies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dues_policies" FROM union_eyes_system;

REVOKE ALL ON TABLE "dues_rates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dues_rates" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "dues_rates" TO union_eyes_runtime;

REVOKE ALL ON TABLE "dues_transactions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dues_transactions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "dues_transactions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_payroll_adjustments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_payroll_adjustments" FROM union_eyes_system;

REVOKE ALL ON TABLE "employer_payroll_run_items" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_payroll_run_items" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "employer_payroll_run_items" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_payroll_runs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_payroll_runs" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "employer_payroll_runs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_remittance_run_items" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_remittance_run_items" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "employer_remittance_run_items" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_remittance_runs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_remittance_runs" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "employer_remittance_runs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_remittances" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_remittances" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "employer_remittances" TO union_eyes_runtime;

REVOKE ALL ON TABLE "entitlement_usage_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "entitlement_usage_log" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "entitlement_usage_log" TO union_eyes_runtime;

REVOKE ALL ON TABLE "erp_invoices" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "erp_invoices" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "erp_invoices" TO union_eyes_runtime;

REVOKE ALL ON TABLE "financial_periods" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "financial_periods" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "financial_periods" TO union_eyes_runtime;

REVOKE ALL ON TABLE "gl_account_mappings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "gl_account_mappings" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "gl_account_mappings" TO union_eyes_runtime;

REVOKE ALL ON TABLE "gl_transaction_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "gl_transaction_log" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "gl_transaction_log" TO union_eyes_runtime;

REVOKE ALL ON TABLE "gl_trial_balance" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "gl_trial_balance" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "gl_trial_balance" TO union_eyes_runtime;

REVOKE ALL ON TABLE "payment_cycles" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "payment_cycles" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payment_cycles" TO union_eyes_runtime;

REVOKE ALL ON TABLE "payment_disputes" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "payment_disputes" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payment_disputes" TO union_eyes_runtime;

REVOKE ALL ON TABLE "payment_methods" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "payment_methods" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payment_methods" TO union_eyes_runtime;

REVOKE ALL ON TABLE "payment_plans" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "payment_plans" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "payment_plans" TO union_eyes_runtime;

REVOKE ALL ON TABLE "payments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "payments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "payments" TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE "payments" TO union_eyes_system;

REVOKE ALL ON TABLE "payroll_deductions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "payroll_deductions" FROM union_eyes_system;
GRANT SELECT ON TABLE "payroll_deductions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pension_contributions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_contributions" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "pension_contributions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pension_plans" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_plans" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "pension_plans" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pension_t4a_records" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_t4a_records" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "pension_t4a_records" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pension_trustee_meetings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_trustee_meetings" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "pension_trustee_meetings" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pension_trustees" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_trustees" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "pension_trustees" TO union_eyes_runtime;

REVOKE ALL ON TABLE "per_capita_remittances" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "per_capita_remittances" FROM union_eyes_system;
GRANT SELECT ON TABLE "per_capita_remittances" TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE "per_capita_remittances" TO union_eyes_system;

REVOKE ALL ON TABLE "platform_cost_ledger_entries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "platform_cost_ledger_entries" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "platform_cost_ledger_entries" TO union_eyes_runtime;

REVOKE ALL ON TABLE "platform_invoices" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "platform_invoices" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "platform_invoices" TO union_eyes_runtime;

REVOKE ALL ON TABLE "platform_payments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "platform_payments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "platform_payments" TO union_eyes_runtime;
GRANT SELECT, INSERT ON TABLE "platform_payments" TO union_eyes_system;

REVOKE ALL ON TABLE "reconciliation_exceptions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "reconciliation_exceptions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "reconciliation_exceptions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "reconciliation_runs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "reconciliation_runs" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "reconciliation_runs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "remittance_exceptions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "remittance_exceptions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "remittance_exceptions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "remittance_line_items" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "remittance_line_items" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "remittance_line_items" TO union_eyes_runtime;

REVOKE ALL ON TABLE "reward_budget_envelopes" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "reward_budget_envelopes" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "reward_budget_envelopes" TO union_eyes_runtime;

REVOKE ALL ON TABLE "reward_wallet_ledger" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "reward_wallet_ledger" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "reward_wallet_ledger" TO union_eyes_runtime;

REVOKE ALL ON TABLE "social_accounts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "social_accounts" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "social_accounts" TO union_eyes_runtime;

REVOKE ALL ON TABLE "subscription_events_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "subscription_events_log" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "subscription_events_log" TO union_eyes_runtime;

REVOKE ALL ON TABLE "union_dues_receipts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "union_dues_receipts" FROM union_eyes_system;

REVOKE ALL ON TABLE "union_dues_year_end" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "union_dues_year_end" FROM union_eyes_system;

REVOKE ALL ON TABLE "account_balance_reconciliation" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "account_balance_reconciliation" FROM union_eyes_system;

REVOKE ALL ON TABLE "billing_terms" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "billing_terms" FROM union_eyes_system;

REVOKE ALL ON TABLE "budget_reservations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "budget_reservations" FROM union_eyes_system;

REVOKE ALL ON TABLE "clc_chart_of_accounts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_chart_of_accounts" FROM union_eyes_system;

REVOKE ALL ON TABLE "federation_remittances" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "federation_remittances" FROM union_eyes_system;

REVOKE ALL ON TABLE "payment_allocations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "payment_allocations" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "payment_allocations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "payment_classification_policy" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "payment_classification_policy" FROM union_eyes_system;

REVOKE ALL ON TABLE "payment_routing_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "payment_routing_rules" FROM union_eyes_system;

REVOKE ALL ON TABLE "platform_invoice_line_items" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "platform_invoice_line_items" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "platform_invoice_line_items" TO union_eyes_runtime;

REVOKE ALL ON TABLE "reconciliation_matches" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "reconciliation_matches" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "reconciliation_matches" TO union_eyes_runtime;

REVOKE ALL ON TABLE "remittance_approvals" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "remittance_approvals" FROM union_eyes_system;
GRANT SELECT ON TABLE "remittance_approvals" TO union_eyes_system;

REVOKE ALL ON TABLE "rl1_tax_slips" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "rl1_tax_slips" FROM union_eyes_system;

REVOKE ALL ON TABLE "separated_payment_transactions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "separated_payment_transactions" FROM union_eyes_system;

REVOKE ALL ON TABLE "strike_fund_disbursements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "strike_fund_disbursements" FROM union_eyes_system;
GRANT SELECT ON TABLE "strike_fund_disbursements" TO union_eyes_runtime;

REVOKE ALL ON TABLE "stripe_connect_accounts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "stripe_connect_accounts" FROM union_eyes_system;

REVOKE ALL ON TABLE "subscription_plans" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "subscription_plans" FROM union_eyes_system;
GRANT SELECT ON TABLE "subscription_plans" TO union_eyes_runtime;

REVOKE ALL ON TABLE "t4a_tax_slips" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "t4a_tax_slips" FROM union_eyes_system;

REVOKE ALL ON TABLE "tax_year_end_processing" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "tax_year_end_processing" FROM union_eyes_system;

REVOKE ALL ON TABLE "accounts_payable" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "accounts_payable" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_chunks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_chunks" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_documents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_documents" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_feedback" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_feedback" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_feedback_summary" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_feedback_summary" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_queries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_queries" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_query_logs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_query_logs" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_usage_by_tenant" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_usage_by_tenant" FROM union_eyes_system;

REVOKE ALL ON TABLE "arrears" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "arrears" FROM union_eyes_system;

REVOKE ALL ON TABLE "arrears_cases" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "arrears_cases" FROM union_eyes_system;

REVOKE ALL ON TABLE "attestation_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "attestation_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "blockchain_audit_anchors" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "blockchain_audit_anchors" FROM union_eyes_system;

REVOKE ALL ON TABLE "budget_line_items" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "budget_line_items" FROM union_eyes_system;

REVOKE ALL ON TABLE "budgets" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "budgets" FROM union_eyes_system;

REVOKE ALL ON TABLE "case_summaries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "case_summaries" FROM union_eyes_system;

REVOKE ALL ON TABLE "certification_applications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "certification_applications" FROM union_eyes_system;

REVOKE ALL ON TABLE "compliance_validations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "compliance_validations" FROM union_eyes_system;

REVOKE ALL ON TABLE "cope_contributions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cope_contributions" FROM union_eyes_system;

REVOKE ALL ON TABLE "cra_xml_batches" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cra_xml_batches" FROM union_eyes_system;

REVOKE ALL ON TABLE "customer_acquisition" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "customer_acquisition" FROM union_eyes_system;

REVOKE ALL ON TABLE "digital_signatures" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "digital_signatures" FROM union_eyes_system;

REVOKE ALL ON TABLE "dues_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dues_rules" FROM union_eyes_system;

REVOKE ALL ON TABLE "elected_officials" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "elected_officials" FROM union_eyes_system;

REVOKE ALL ON TABLE "encryption_keys" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "encryption_keys" FROM union_eyes_system;

REVOKE ALL ON TABLE "equity_snapshots" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "equity_snapshots" FROM union_eyes_system;

REVOKE ALL ON TABLE "expense_approvals" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "expense_approvals" FROM union_eyes_system;

REVOKE ALL ON TABLE "expense_requests" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "expense_requests" FROM union_eyes_system;

REVOKE ALL ON TABLE "fund_eligibility" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "fund_eligibility" FROM union_eyes_system;

REVOKE ALL ON TABLE "hardship_applications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "hardship_applications" FROM union_eyes_system;

REVOKE ALL ON TABLE "hw_benefit_claims" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "hw_benefit_claims" FROM union_eyes_system;

REVOKE ALL ON TABLE "hw_benefit_enrollments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "hw_benefit_enrollments" FROM union_eyes_system;

REVOKE ALL ON TABLE "hw_benefit_plans" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "hw_benefit_plans" FROM union_eyes_system;

REVOKE ALL ON TABLE "jurisdiction_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "jurisdiction_rules" FROM union_eyes_system;

REVOKE ALL ON TABLE "jurisdiction_rules_summary" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "jurisdiction_rules_summary" FROM union_eyes_system;

REVOKE ALL ON TABLE "jurisdiction_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "jurisdiction_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "legislation_tracking" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "legislation_tracking" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_demographics" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_demographics" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_dues_assignments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_dues_assignments" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_political_participation" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_political_participation" FROM union_eyes_system;

REVOKE ALL ON TABLE "members" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "members" FROM union_eyes_system;

REVOKE ALL ON TABLE "members_with_pii" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "members_with_pii" FROM union_eyes_system;

REVOKE ALL ON TABLE "mrr_snapshots" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "mrr_snapshots" FROM union_eyes_system;

REVOKE ALL ON TABLE "organization_hierarchy_audit" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organization_hierarchy_audit" FROM union_eyes_system;

REVOKE ALL ON TABLE "organization_tree" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organization_tree" FROM union_eyes_system;

REVOKE ALL ON TABLE "organizing_activities" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organizing_activities" FROM union_eyes_system;

REVOKE ALL ON TABLE "organizing_volunteers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organizing_volunteers" FROM union_eyes_system;

REVOKE ALL ON TABLE "pay_equity_complaints" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pay_equity_complaints" FROM union_eyes_system;

REVOKE ALL ON TABLE "pension_actuarial_valuations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_actuarial_valuations" FROM union_eyes_system;

REVOKE ALL ON TABLE "pension_hours_banks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_hours_banks" FROM union_eyes_system;

REVOKE ALL ON TABLE "pension_trustee_boards" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_trustee_boards" FROM union_eyes_system;

REVOKE ALL ON TABLE "picket_attendance" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "picket_attendance" FROM union_eyes_system;

REVOKE ALL ON TABLE "picket_tracking" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "picket_tracking" FROM union_eyes_system;

REVOKE ALL ON TABLE "pii_access_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pii_access_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "political_activities" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "political_activities" FROM union_eyes_system;

REVOKE ALL ON TABLE "political_campaigns" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "political_campaigns" FROM union_eyes_system;

REVOKE ALL ON TABLE "public_donations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "public_donations" FROM union_eyes_system;

REVOKE ALL ON TABLE "revenue_cohorts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "revenue_cohorts" FROM union_eyes_system;

REVOKE ALL ON TABLE "statcan_submissions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "statcan_submissions" FROM union_eyes_system;

REVOKE ALL ON TABLE "statutory_holidays" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "statutory_holidays" FROM union_eyes_system;

REVOKE ALL ON TABLE "stipend_disbursements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "stipend_disbursements" FROM union_eyes_system;

REVOKE ALL ON TABLE "strike_funds" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "strike_funds" FROM union_eyes_system;

REVOKE ALL ON TABLE "subscription_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "subscription_events" FROM union_eyes_system;

REVOKE ALL ON TABLE "tax_slips" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "tax_slips" FROM union_eyes_system;

REVOKE ALL ON TABLE "tax_year_configurations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "tax_year_configurations" FROM union_eyes_system;

REVOKE ALL ON TABLE "tenant_management_view" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "tenant_management_view" FROM union_eyes_system;

REVOKE ALL ON TABLE "tenants" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "tenants" FROM union_eyes_system;

REVOKE ALL ON TABLE "transaction_clc_mappings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "transaction_clc_mappings" FROM union_eyes_system;

REVOKE ALL ON TABLE "trust_compliance_reports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "trust_compliance_reports" FROM union_eyes_system;

REVOKE ALL ON TABLE "trusted_certificate_authorities" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "trusted_certificate_authorities" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_annual_remittance_summary" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_annual_remittance_summary" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_certification_expiry_tracking" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_certification_expiry_tracking" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_cope_member_summary" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_cope_member_summary" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_course_session_dashboard" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_course_session_dashboard" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_critical_deadlines" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_critical_deadlines" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_elected_official_engagement" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_elected_official_engagement" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_equity_statistics_anonymized" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_equity_statistics_anonymized" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_hw_claims_aging" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_hw_claims_aging" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_legislative_priorities" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_legislative_priorities" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_member_benefit_eligibility" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_member_benefit_eligibility" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_member_training_transcript" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_member_training_transcript" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_organizing_campaign_dashboard" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_organizing_campaign_dashboard" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_pay_equity_pipeline" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_pay_equity_pipeline" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_pending_remittances" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_pending_remittances" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_pension_funding_summary" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_pension_funding_summary" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_political_campaign_dashboard" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_political_campaign_dashboard" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_tax_slip_summary" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_tax_slip_summary" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_training_program_progress" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_training_program_progress" FROM union_eyes_system;

REVOKE ALL ON TABLE "v_workplace_contact_map" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "v_workplace_contact_map" FROM union_eyes_system;

REVOKE ALL ON TABLE "vendor_invoices" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "vendor_invoices" FROM union_eyes_system;

REVOKE ALL ON TABLE "vendors" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "vendors" FROM union_eyes_system;

REVOKE ALL ON TABLE "vote_merkle_tree" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "vote_merkle_tree" FROM union_eyes_system;

REVOKE ALL ON TABLE "voting_auditors" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "voting_auditors" FROM union_eyes_system;

REVOKE ALL ON TABLE "voting_key_access_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "voting_key_access_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "voting_session_auditors" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "voting_session_auditors" FROM union_eyes_system;

REVOKE ALL ON TABLE "voting_session_keys" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "voting_session_keys" FROM union_eyes_system;

REVOKE ALL ON TABLE "board_packet_templates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "board_packet_templates" FROM union_eyes_system;

REVOKE ALL ON TABLE "board_packets" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "board_packets" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "board_packets" TO union_eyes_runtime;

REVOKE ALL ON TABLE "committee_action_items" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "committee_action_items" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "committee_action_items" TO union_eyes_runtime;

REVOKE ALL ON TABLE "committee_documents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "committee_documents" FROM union_eyes_system;
GRANT SELECT, INSERT, DELETE ON TABLE "committee_documents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "committee_intelligence_snapshots" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "committee_intelligence_snapshots" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "committee_intelligence_snapshots" TO union_eyes_runtime;

REVOKE ALL ON TABLE "committee_meetings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "committee_meetings" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "committee_meetings" TO union_eyes_runtime;

REVOKE ALL ON TABLE "committees" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "committees" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "committees" TO union_eyes_runtime;

REVOKE ALL ON TABLE "congress_memberships" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "congress_memberships" FROM union_eyes_system;

REVOKE ALL ON TABLE "governance_bylaws" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "governance_bylaws" FROM union_eyes_system;

REVOKE ALL ON TABLE "governance_policies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "governance_policies" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "governance_policies" TO union_eyes_runtime;

REVOKE ALL ON TABLE "governance_signatories" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "governance_signatories" FROM union_eyes_system;

REVOKE ALL ON TABLE "icra_governance_flags" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_governance_flags" FROM union_eyes_system;

REVOKE ALL ON TABLE "joint_hs_committees" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "joint_hs_committees" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "joint_hs_committees" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ue_governance_job_cancellation_audit_event" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ue_governance_job_cancellation_audit_event" FROM union_eyes_system;

REVOKE ALL ON TABLE "ue_governance_job_cancellation_request" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ue_governance_job_cancellation_request" FROM union_eyes_system;

REVOKE ALL ON TABLE "ue_governance_job_execution_state" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ue_governance_job_execution_state" FROM union_eyes_system;

REVOKE ALL ON TABLE "ue_governance_job_reconciliation_pass" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ue_governance_job_reconciliation_pass" FROM union_eyes_system;

REVOKE ALL ON TABLE "board_packet_distributions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "board_packet_distributions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "board_packet_distributions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "board_packet_sections" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "board_packet_sections" FROM union_eyes_system;

REVOKE ALL ON TABLE "committee_meeting_attendees" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "committee_meeting_attendees" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "committee_meeting_attendees" TO union_eyes_runtime;

REVOKE ALL ON TABLE "committee_memberships" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "committee_memberships" FROM union_eyes_system;

REVOKE ALL ON TABLE "conflict_review_committee" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "conflict_review_committee" FROM union_eyes_system;

REVOKE ALL ON TABLE "council_elections" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "council_elections" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "council_elections" TO union_eyes_system;

REVOKE ALL ON TABLE "golden_shares" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "golden_shares" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "golden_shares" TO union_eyes_system;

REVOKE ALL ON TABLE "governance_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "governance_events" FROM union_eyes_system;
GRANT SELECT ON TABLE "governance_events" TO union_eyes_system;

REVOKE ALL ON TABLE "mission_audits" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "mission_audits" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "mission_audits" TO union_eyes_system;

REVOKE ALL ON TABLE "reserved_matter_votes" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "reserved_matter_votes" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "reserved_matter_votes" TO union_eyes_system;

REVOKE ALL ON TABLE "workbook_governance_lineage_entries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workbook_governance_lineage_entries" FROM union_eyes_system;
GRANT SELECT ON TABLE "workbook_governance_lineage_entries" TO union_eyes_runtime;

REVOKE ALL ON TABLE "accessibility_audits" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "accessibility_audits" FROM union_eyes_system;

REVOKE ALL ON TABLE "deadline_audit_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "deadline_audit_events" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "deadline_audit_events" TO union_eyes_runtime;
GRANT INSERT ON TABLE "deadline_audit_events" TO union_eyes_system;

REVOKE ALL ON TABLE "financial_audit_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "financial_audit_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "ai_safety_filters" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ai_safety_filters" FROM union_eyes_system;
GRANT INSERT ON TABLE "ai_safety_filters" TO union_eyes_runtime;

REVOKE ALL ON TABLE "certification_audit_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "certification_audit_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "conflict_audit_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "conflict_audit_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "correspondence_audit_trail" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "correspondence_audit_trail" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "correspondence_audit_trail" TO union_eyes_runtime;

REVOKE ALL ON TABLE "currency_enforcement_audit" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "currency_enforcement_audit" FROM union_eyes_system;

REVOKE ALL ON TABLE "firewall_compliance_audit" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "firewall_compliance_audit" FROM union_eyes_system;

REVOKE ALL ON TABLE "fmv_audit_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "fmv_audit_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "fx_rate_audit_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "fx_rate_audit_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "location_tracking_audit" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "location_tracking_audit" FROM union_eyes_system;
GRANT INSERT ON TABLE "location_tracking_audit" TO union_eyes_runtime;

REVOKE ALL ON TABLE "signature_audit_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "signature_audit_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "signature_audit_trail" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "signature_audit_trail" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "signature_audit_trail" TO union_eyes_runtime;

REVOKE ALL ON TABLE "strike_fund_payment_audit" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "strike_fund_payment_audit" FROM union_eyes_system;

REVOKE ALL ON TABLE "voting_audit_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "voting_audit_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "whiplash_prevention_audit" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "whiplash_prevention_audit" FROM union_eyes_system;

REVOKE ALL ON TABLE "api_integrations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "api_integrations" FROM union_eyes_system;
GRANT SELECT, UPDATE, DELETE ON TABLE "api_integrations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "clc_sync_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_sync_log" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "clc_sync_log" TO union_eyes_runtime;

REVOKE ALL ON TABLE "clc_webhook_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_webhook_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "employer_timesheet_batches" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_timesheet_batches" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "employer_timesheet_batches" TO union_eyes_runtime;

REVOKE ALL ON TABLE "erp_connectors" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "erp_connectors" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_accounts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_accounts" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_accounts" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_benefit_coverage" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_benefit_coverage" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_benefit_coverage" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_benefit_dependents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_benefit_dependents" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_benefit_dependents" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_benefit_enrollments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_benefit_enrollments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_benefit_enrollments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_benefit_plans" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_benefit_plans" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_benefit_plans" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_benefit_utilization" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_benefit_utilization" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_benefit_utilization" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_calendar_attendees" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_calendar_attendees" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_calendar_connections" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_calendar_connections" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "external_calendar_connections" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_calendar_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_calendar_events" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_calendar_recurring_patterns" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_calendar_recurring_patterns" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_calendars" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_calendars" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_customers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_customers" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_customers" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_departments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_departments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_departments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_employees" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_employees" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_employees" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_insurance_beneficiaries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_insurance_beneficiaries" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_insurance_beneficiaries" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_insurance_policies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_insurance_policies" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_insurance_policies" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_invoices" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_invoices" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "external_invoices" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_lms_completions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_lms_completions" FROM union_eyes_system;
GRANT INSERT, UPDATE ON TABLE "external_lms_completions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_lms_courses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_lms_courses" FROM union_eyes_system;
GRANT INSERT, UPDATE ON TABLE "external_lms_courses" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_lms_enrollments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_lms_enrollments" FROM union_eyes_system;
GRANT INSERT, UPDATE ON TABLE "external_lms_enrollments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_lms_learners" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_lms_learners" FROM union_eyes_system;
GRANT INSERT, UPDATE ON TABLE "external_lms_learners" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_lms_progress" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_lms_progress" FROM union_eyes_system;
GRANT INSERT, UPDATE ON TABLE "external_lms_progress" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_payments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_payments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_payments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "external_pension_beneficiaries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_pension_beneficiaries" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_pension_contributions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_pension_contributions" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_pension_estimates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_pension_estimates" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_pension_plans" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_pension_plans" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_pension_service_credits" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_pension_service_credits" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_positions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_positions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "external_positions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "webhook_deliveries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "webhook_deliveries" FROM union_eyes_system;

REVOKE ALL ON TABLE "ingestion_batches" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ingestion_batches" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "ingestion_batches" TO union_eyes_runtime;

REVOKE ALL ON TABLE "integration_api_keys" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "integration_api_keys" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "integration_api_keys" TO union_eyes_runtime;

REVOKE ALL ON TABLE "integration_configs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "integration_configs" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "integration_configs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "integration_partners" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "integration_partners" FROM union_eyes_system;
GRANT SELECT ON TABLE "integration_partners" TO union_eyes_runtime;
GRANT SELECT ON TABLE "integration_partners" TO union_eyes_system;

REVOKE ALL ON TABLE "integration_sync_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "integration_sync_log" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "integration_sync_log" TO union_eyes_runtime;

REVOKE ALL ON TABLE "integration_sync_schedules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "integration_sync_schedules" FROM union_eyes_system;

REVOKE ALL ON TABLE "integration_webhooks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "integration_webhooks" FROM union_eyes_system;
GRANT SELECT ON TABLE "integration_webhooks" TO union_eyes_runtime;
GRANT SELECT ON TABLE "integration_webhooks" TO union_eyes_system;

REVOKE ALL ON TABLE "job_classifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "job_classifications" FROM union_eyes_system;

REVOKE ALL ON TABLE "job_postings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "job_postings" FROM union_eyes_system;

REVOKE ALL ON TABLE "job_saved" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "job_saved" FROM union_eyes_system;

REVOKE ALL ON TABLE "mobile_sync_queue" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "mobile_sync_queue" FROM union_eyes_system;

REVOKE ALL ON TABLE "stripe_webhook_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "stripe_webhook_events" FROM union_eyes_system;

REVOKE ALL ON TABLE "sync_jobs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sync_jobs" FROM union_eyes_system;

REVOKE ALL ON TABLE "webhook_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "webhook_events" FROM union_eyes_system;

REVOKE ALL ON TABLE "webhook_subscriptions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "webhook_subscriptions" FROM union_eyes_system;

REVOKE ALL ON TABLE "external_data_sync_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_data_sync_log" FROM union_eyes_system;
GRANT INSERT, UPDATE ON TABLE "external_data_sync_log" TO union_eyes_runtime;
GRANT INSERT, UPDATE ON TABLE "external_data_sync_log" TO union_eyes_system;

REVOKE ALL ON TABLE "foreign_workers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "foreign_workers" FROM union_eyes_system;

REVOKE ALL ON TABLE "ingestion_records" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ingestion_records" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "ingestion_records" TO union_eyes_runtime;

REVOKE ALL ON TABLE "integration_sync_logs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "integration_sync_logs" FROM union_eyes_system;

REVOKE ALL ON TABLE "lrb_sync_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "lrb_sync_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "signature_webhooks_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "signature_webhooks_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "webhook_receipts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "webhook_receipts" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "webhook_receipts" TO union_eyes_system;

REVOKE ALL ON TABLE "clc_organization_sync_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_organization_sync_log" FROM union_eyes_system;
GRANT SELECT ON TABLE "clc_organization_sync_log" TO union_eyes_system;

REVOKE ALL ON TABLE "external_pension_members" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "external_pension_members" FROM union_eyes_system;

REVOKE ALL ON TABLE "icra_organizations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_organizations" FROM union_eyes_system;

REVOKE ALL ON TABLE "job_applications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "job_applications" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_addresses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_addresses" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_arrears" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_arrears" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "member_arrears" TO union_eyes_runtime;

REVOKE ALL ON TABLE "member_breaks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_breaks" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "member_breaks" TO union_eyes_runtime;

REVOKE ALL ON TABLE "member_certifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_certifications" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "member_certifications" TO union_eyes_runtime;

REVOKE ALL ON TABLE "member_consents" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_consents" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_contact_preferences" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_contact_preferences" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_dues_issues" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_dues_issues" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "member_dues_issues" TO union_eyes_runtime;

REVOKE ALL ON TABLE "member_dues_ledger" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_dues_ledger" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "member_dues_ledger" TO union_eyes_runtime;

REVOKE ALL ON TABLE "member_employment" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_employment" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "member_employment" TO union_eyes_runtime;

REVOKE ALL ON TABLE "member_employment_details" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_employment_details" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_history_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_history_events" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "member_history_events" TO union_eyes_runtime;

REVOKE ALL ON TABLE "member_jurisdiction_preferences" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_jurisdiction_preferences" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "member_jurisdiction_preferences" TO union_eyes_runtime;

REVOKE ALL ON TABLE "member_leaves" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_leaves" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_relationship_scores" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_relationship_scores" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_segments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_segments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "member_segments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "org_entitlements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "org_entitlements" FROM union_eyes_system;
GRANT SELECT ON TABLE "org_entitlements" TO union_eyes_runtime;

REVOKE ALL ON TABLE "org_subscriptions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "org_subscriptions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "org_subscriptions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "organization_benchmark_snapshots" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organization_benchmark_snapshots" FROM union_eyes_system;

REVOKE ALL ON TABLE "organization_billing_config" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organization_billing_config" FROM union_eyes_system;
GRANT SELECT ON TABLE "organization_billing_config" TO union_eyes_system;

REVOKE ALL ON TABLE "organization_contacts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organization_contacts" FROM union_eyes_system;

REVOKE ALL ON TABLE "organization_sharing_settings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organization_sharing_settings" FROM union_eyes_system;

REVOKE ALL ON TABLE "pension_members" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pension_members" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "pension_members" TO union_eyes_runtime;

REVOKE ALL ON TABLE "role_tenure_history" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "role_tenure_history" FROM union_eyes_system;

REVOKE ALL ON TABLE "duplicate_group_members" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "duplicate_group_members" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "duplicate_group_members" TO union_eyes_runtime;

REVOKE ALL ON TABLE "federation_memberships" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "federation_memberships" FROM union_eyes_system;

REVOKE ALL ON TABLE "gss_applications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "gss_applications" FROM union_eyes_system;

REVOKE ALL ON TABLE "indigenous_member_data" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "indigenous_member_data" FROM union_eyes_system;

REVOKE ALL ON TABLE "member_location_consent" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "member_location_consent" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "member_location_consent" TO union_eyes_runtime;

REVOKE ALL ON TABLE "organization_sharing_grants" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organization_sharing_grants" FROM union_eyes_system;

REVOKE ALL ON TABLE "pilot_applications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pilot_applications" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "pilot_applications" TO union_eyes_runtime;
GRANT SELECT, UPDATE ON TABLE "pilot_applications" TO union_eyes_system;

REVOKE ALL ON TABLE "applications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "applications" FROM union_eyes_system;

REVOKE ALL ON TABLE "org_configurations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "org_configurations" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "org_configurations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "org_usage" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "org_usage" FROM union_eyes_system;

REVOKE ALL ON TABLE "organization_relationships" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organization_relationships" FROM union_eyes_system;
GRANT SELECT ON TABLE "organization_relationships" TO union_eyes_system;

REVOKE ALL ON TABLE "ab_tests" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ab_tests" FROM union_eyes_system;

REVOKE ALL ON TABLE "accessibility_issues" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "accessibility_issues" FROM union_eyes_system;

REVOKE ALL ON TABLE "accessibility_test_suites" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "accessibility_test_suites" FROM union_eyes_system;

REVOKE ALL ON TABLE "accessibility_user_testing" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "accessibility_user_testing" FROM union_eyes_system;

REVOKE ALL ON TABLE "alert_escalations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "alert_escalations" FROM union_eyes_system;

REVOKE ALL ON TABLE "alert_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "alert_rules" FROM union_eyes_system;
GRANT SELECT ON TABLE "alert_rules" TO union_eyes_runtime;
GRANT SELECT, INSERT ON TABLE "alert_rules" TO union_eyes_system;

REVOKE ALL ON TABLE "allocation_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "allocation_rules" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "allocation_rules" TO union_eyes_runtime;

REVOKE ALL ON TABLE "anti_scab_violations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "anti_scab_violations" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "anti_scab_violations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "api_access_tokens" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "api_access_tokens" FROM union_eyes_system;

REVOKE ALL ON TABLE "automation_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "automation_rules" FROM union_eyes_system;
GRANT SELECT ON TABLE "automation_rules" TO union_eyes_system;

REVOKE ALL ON TABLE "break_policies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "break_policies" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "break_policies" TO union_eyes_runtime;

REVOKE ALL ON TABLE "calendar_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "calendar_events" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "calendar_events" TO union_eyes_runtime;

REVOKE ALL ON TABLE "calendar_sharing" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "calendar_sharing" FROM union_eyes_system;

REVOKE ALL ON TABLE "calendars" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "calendars" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "calendars" TO union_eyes_runtime;
GRANT SELECT ON TABLE "calendars" TO union_eyes_system;

REVOKE ALL ON TABLE "card_signing_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "card_signing_events" FROM union_eyes_system;

REVOKE ALL ON TABLE "chargeback_statements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "chargeback_statements" FROM union_eyes_system;
GRANT SELECT ON TABLE "chargeback_statements" TO union_eyes_runtime;

REVOKE ALL ON TABLE "clause_comparisons" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clause_comparisons" FROM union_eyes_system;
GRANT INSERT ON TABLE "clause_comparisons" TO union_eyes_runtime;

REVOKE ALL ON TABLE "clause_comparisons_history" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clause_comparisons_history" FROM union_eyes_system;

REVOKE ALL ON TABLE "clc_api_config" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_api_config" FROM union_eyes_system;

REVOKE ALL ON TABLE "clc_per_capita_benchmarks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_per_capita_benchmarks" FROM union_eyes_system;

REVOKE ALL ON TABLE "cms_blocks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cms_blocks" FROM union_eyes_system;

REVOKE ALL ON TABLE "cms_navigation_menus" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cms_navigation_menus" FROM union_eyes_system;

REVOKE ALL ON TABLE "cms_pages" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cms_pages" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cms_pages" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cnesst_filings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cnesst_filings" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "cnesst_filings" TO union_eyes_runtime;

REVOKE ALL ON TABLE "comparative_analyses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "comparative_analyses" FROM union_eyes_system;

REVOKE ALL ON TABLE "compliance_alerts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "compliance_alerts" FROM union_eyes_system;
GRANT SELECT ON TABLE "compliance_alerts" TO union_eyes_runtime;

REVOKE ALL ON TABLE "contract_covered_orgs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "contract_covered_orgs" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "contract_covered_orgs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "correspondence" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "correspondence" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "correspondence" TO union_eyes_runtime;

REVOKE ALL ON TABLE "course_registrations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "course_registrations" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "course_registrations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "course_sessions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "course_sessions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "course_sessions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "currency_exchange_rates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "currency_exchange_rates" FROM union_eyes_system;

REVOKE ALL ON TABLE "customer_onboarding_milestones" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "customer_onboarding_milestones" FROM union_eyes_system;
GRANT SELECT ON TABLE "customer_onboarding_milestones" TO union_eyes_system;

REVOKE ALL ON TABLE "data_anonymization_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "data_anonymization_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "data_processing_records" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "data_processing_records" FROM union_eyes_system;

REVOKE ALL ON TABLE "data_quality_warnings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "data_quality_warnings" FROM union_eyes_system;
GRANT SELECT ON TABLE "data_quality_warnings" TO union_eyes_runtime;

REVOKE ALL ON TABLE "data_residency_configs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "data_residency_configs" FROM union_eyes_system;

REVOKE ALL ON TABLE "data_retention_policies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "data_retention_policies" FROM union_eyes_system;

REVOKE ALL ON TABLE "defensibility_packs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "defensibility_packs" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "defensibility_packs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "dispatch_requests" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dispatch_requests" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "dispatch_requests" TO union_eyes_runtime;

REVOKE ALL ON TABLE "dispatch_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dispatch_rules" FROM union_eyes_system;
GRANT SELECT ON TABLE "dispatch_rules" TO union_eyes_runtime;

REVOKE ALL ON TABLE "dsr_requests" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dsr_requests" FROM union_eyes_system;

REVOKE ALL ON TABLE "dunning_cases" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dunning_cases" FROM union_eyes_system;

REVOKE ALL ON TABLE "duplicate_groups" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "duplicate_groups" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "duplicate_groups" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_contacts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_contacts" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "employer_contacts" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employer_execution_artifacts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_execution_artifacts" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "employer_execution_artifacts" TO union_eyes_runtime;
GRANT SELECT, INSERT ON TABLE "employer_execution_artifacts" TO union_eyes_system;

REVOKE ALL ON TABLE "employer_execution_compliance_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_execution_compliance_events" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "employer_execution_compliance_events" TO union_eyes_runtime;
GRANT SELECT, INSERT ON TABLE "employer_execution_compliance_events" TO union_eyes_system;

REVOKE ALL ON TABLE "employer_execution_replays" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_execution_replays" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "employer_execution_replays" TO union_eyes_runtime;
GRANT SELECT, INSERT ON TABLE "employer_execution_replays" TO union_eyes_system;

REVOKE ALL ON TABLE "employer_responses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_responses" FROM union_eyes_system;

REVOKE ALL ON TABLE "employer_timesheet_entries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_timesheet_entries" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "employer_timesheet_entries" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employers" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "employers" TO union_eyes_runtime;

REVOKE ALL ON TABLE "employment_history" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employment_history" FROM union_eyes_system;

REVOKE ALL ON TABLE "event_attendees" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "event_attendees" FROM union_eyes_system;

REVOKE ALL ON TABLE "event_check_ins" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "event_check_ins" FROM union_eyes_system;

REVOKE ALL ON TABLE "event_registrations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "event_registrations" FROM union_eyes_system;

REVOKE ALL ON TABLE "event_reminders" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "event_reminders" FROM union_eyes_system;

REVOKE ALL ON TABLE "exit_interview_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "exit_interview_events" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "exit_interview_events" TO union_eyes_runtime;

REVOKE ALL ON TABLE "exit_interview_sessions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "exit_interview_sessions" FROM union_eyes_system;

REVOKE ALL ON TABLE "exit_interviews" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "exit_interviews" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "exit_interviews" TO union_eyes_runtime;

REVOKE ALL ON TABLE "federations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "federations" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "federations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "fee_adjustments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "fee_adjustments" FROM union_eyes_system;
GRANT INSERT ON TABLE "fee_adjustments" TO union_eyes_runtime;
GRANT INSERT ON TABLE "fee_adjustments" TO union_eyes_system;

REVOKE ALL ON TABLE "field_notes" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "field_notes" FROM union_eyes_system;

REVOKE ALL ON TABLE "field_organizer_activities" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "field_organizer_activities" FROM union_eyes_system;

REVOKE ALL ON TABLE "gdpr_data_requests" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "gdpr_data_requests" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "gdpr_data_requests" TO union_eyes_runtime;

REVOKE ALL ON TABLE "user_sessions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "user_sessions" FROM union_eyes_system;

REVOKE ALL ON TABLE "holidays" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "holidays" FROM union_eyes_system;
GRANT SELECT ON TABLE "holidays" TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE "holidays" TO union_eyes_system;

REVOKE ALL ON TABLE "icra_assessments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_assessments" FROM union_eyes_system;

REVOKE ALL ON TABLE "icra_assessment_answers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_assessment_answers" FROM union_eyes_system;

REVOKE ALL ON TABLE "icra_operational_indicators" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_operational_indicators" FROM union_eyes_system;

REVOKE ALL ON TABLE "icra_benchmark_groups" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "icra_benchmark_groups" FROM union_eyes_system;

REVOKE ALL ON TABLE "international_addresses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "international_addresses" FROM union_eyes_system;

REVOKE ALL ON TABLE "journal_entries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "journal_entries" FROM union_eyes_system;

REVOKE ALL ON TABLE "knowledge_base" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "knowledge_base" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "knowledge_base" TO union_eyes_runtime;

REVOKE ALL ON TABLE "kpi_configurations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "kpi_configurations" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "kpi_configurations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "legal_holds" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "legal_holds" FROM union_eyes_system;

REVOKE ALL ON TABLE "meeting_rooms" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "meeting_rooms" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "meeting_rooms" TO union_eyes_runtime;

REVOKE ALL ON TABLE "mfa_configurations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "mfa_configurations" FROM union_eyes_system;

REVOKE ALL ON TABLE "mobile_app_config" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "mobile_app_config" FROM union_eyes_system;

REVOKE ALL ON TABLE "mobile_devices" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "mobile_devices" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "mobile_devices" TO union_eyes_runtime;

REVOKE ALL ON TABLE "negotiations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "negotiations" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "negotiations" TO union_eyes_runtime;

REVOKE ALL ON TABLE "nlrb_clrb_filings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "nlrb_clrb_filings" FROM union_eyes_system;

REVOKE ALL ON TABLE "organizer_impacts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organizer_impacts" FROM union_eyes_system;

REVOKE ALL ON TABLE "organizer_tasks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organizer_tasks" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "organizer_tasks" TO union_eyes_runtime;

REVOKE ALL ON TABLE "organizing_contacts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "organizing_contacts" FROM union_eyes_system;

REVOKE ALL ON TABLE "outreach_enrollments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "outreach_enrollments" FROM union_eyes_system;

REVOKE ALL ON TABLE "outreach_sequences" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "outreach_sequences" FROM union_eyes_system;

REVOKE ALL ON TABLE "outreach_steps_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "outreach_steps_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "pack_download_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pack_download_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "pay_equity_exercises" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pay_equity_exercises" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "pay_equity_exercises" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pci_dss_cardholder_data_flow" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pci_dss_cardholder_data_flow" FROM union_eyes_system;

REVOKE ALL ON TABLE "pci_dss_encryption_keys" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pci_dss_encryption_keys" FROM union_eyes_system;

REVOKE ALL ON TABLE "pci_dss_quarterly_scans" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pci_dss_quarterly_scans" FROM union_eyes_system;

REVOKE ALL ON TABLE "pci_dss_requirements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pci_dss_requirements" FROM union_eyes_system;

REVOKE ALL ON TABLE "pci_dss_saq_assessments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pci_dss_saq_assessments" FROM union_eyes_system;

REVOKE ALL ON TABLE "pilot_checklist_items" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pilot_checklist_items" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "pilot_checklist_items" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pilot_demo_seeds" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pilot_demo_seeds" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "pilot_demo_seeds" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pilot_enrollments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pilot_enrollments" FROM union_eyes_system;
GRANT SELECT ON TABLE "pilot_enrollments" TO union_eyes_runtime;
GRANT SELECT ON TABLE "pilot_enrollments" TO union_eyes_system;

REVOKE ALL ON TABLE "pilot_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pilot_events" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "pilot_events" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pilot_feedback" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pilot_feedback" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "pilot_feedback" TO union_eyes_runtime;

REVOKE ALL ON TABLE "pilot_milestones" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pilot_milestones" FROM union_eyes_system;
GRANT SELECT ON TABLE "pilot_milestones" TO union_eyes_runtime;
GRANT SELECT ON TABLE "pilot_milestones" TO union_eyes_system;

REVOKE ALL ON TABLE "policy_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "policy_rules" FROM union_eyes_system;
GRANT SELECT ON TABLE "policy_rules" TO union_eyes_runtime;

REVOKE ALL ON TABLE "poll_votes" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "poll_votes" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "poll_votes" TO union_eyes_runtime;

REVOKE ALL ON TABLE "polls" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "polls" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "polls" TO union_eyes_runtime;

REVOKE ALL ON TABLE "preventive_withdrawals" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "preventive_withdrawals" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "preventive_withdrawals" TO union_eyes_runtime;

REVOKE ALL ON TABLE "program_enrollments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "program_enrollments" FROM union_eyes_system;

REVOKE ALL ON TABLE "public_content" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "public_content" FROM union_eyes_system;

REVOKE ALL ON TABLE "public_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "public_events" FROM union_eyes_system;

REVOKE ALL ON TABLE "push_devices" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "push_devices" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "push_devices" TO union_eyes_runtime;

REVOKE ALL ON TABLE "recognition_award_types" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "recognition_award_types" FROM union_eyes_system;
GRANT SELECT ON TABLE "recognition_award_types" TO union_eyes_runtime;
GRANT SELECT ON TABLE "recognition_award_types" TO union_eyes_system;

REVOKE ALL ON TABLE "recognition_awards" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "recognition_awards" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "recognition_awards" TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE "recognition_awards" TO union_eyes_system;

REVOKE ALL ON TABLE "recognition_programs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "recognition_programs" FROM union_eyes_system;
GRANT SELECT ON TABLE "recognition_programs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "report_delivery_history" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "report_delivery_history" FROM union_eyes_system;

REVOKE ALL ON TABLE "report_executions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "report_executions" FROM union_eyes_system;

REVOKE ALL ON TABLE "report_shares" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "report_shares" FROM union_eyes_system;

REVOKE ALL ON TABLE "reports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "reports" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "reports" TO union_eyes_runtime;

REVOKE ALL ON TABLE "retention_policies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "retention_policies" FROM union_eyes_system;

REVOKE ALL ON TABLE "reward_redemptions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "reward_redemptions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "reward_redemptions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "right_of_refusal_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "right_of_refusal_events" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "right_of_refusal_events" TO union_eyes_runtime;

REVOKE ALL ON TABLE "room_bookings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "room_bookings" FROM union_eyes_system;

REVOKE ALL ON TABLE "satisfaction_surveys" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "satisfaction_surveys" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "satisfaction_surveys" TO union_eyes_runtime;

REVOKE ALL ON TABLE "scheduled_reports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "scheduled_reports" FROM union_eyes_system;

REVOKE ALL ON TABLE "scim_configurations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "scim_configurations" FROM union_eyes_system;

REVOKE ALL ON TABLE "scim_events_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "scim_events_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "security_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "security_events" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "security_events" TO union_eyes_runtime;

REVOKE ALL ON TABLE "security_posture_checks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "security_posture_checks" FROM union_eyes_system;
GRANT SELECT ON TABLE "security_posture_checks" TO union_eyes_runtime;

REVOKE ALL ON TABLE "segment_exports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "segment_exports" FROM union_eyes_system;

REVOKE ALL ON TABLE "shopify_config" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "shopify_config" FROM union_eyes_system;

REVOKE ALL ON TABLE "social_engagement" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "social_engagement" FROM union_eyes_system;

REVOKE ALL ON TABLE "social_feeds" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "social_feeds" FROM union_eyes_system;

REVOKE ALL ON TABLE "social_posts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "social_posts" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "social_posts" TO union_eyes_runtime;

REVOKE ALL ON TABLE "sso_providers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sso_providers" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "sso_providers" TO union_eyes_runtime;

REVOKE ALL ON TABLE "sso_sessions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sso_sessions" FROM union_eyes_system;

REVOKE ALL ON TABLE "steward_assignments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "steward_assignments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "steward_assignments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "stewards" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "stewards" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "stewards" TO union_eyes_runtime;
GRANT SELECT ON TABLE "stewards" TO union_eyes_system;

REVOKE ALL ON TABLE "strategic_goals" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "strategic_goals" FROM union_eyes_system;
GRANT SELECT ON TABLE "strategic_goals" TO union_eyes_runtime;

REVOKE ALL ON TABLE "support_tickets" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "support_tickets" FROM union_eyes_system;
GRANT SELECT ON TABLE "support_tickets" TO union_eyes_system;

REVOKE ALL ON TABLE "survey_answers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "survey_answers" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "survey_answers" TO union_eyes_runtime;

REVOKE ALL ON TABLE "survey_questions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "survey_questions" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "survey_questions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "survey_responses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "survey_responses" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "survey_responses" TO union_eyes_runtime;

REVOKE ALL ON TABLE "surveys" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "surveys" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "surveys" TO union_eyes_runtime;

REVOKE ALL ON TABLE "task_comments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "task_comments" FROM union_eyes_system;

REVOKE ALL ON TABLE "training_courses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "training_courses" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "training_courses" TO union_eyes_runtime;

REVOKE ALL ON TABLE "training_programs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "training_programs" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "training_programs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "transaction_fee_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "transaction_fee_events" FROM union_eyes_system;
GRANT SELECT ON TABLE "transaction_fee_events" TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE "transaction_fee_events" TO union_eyes_system;

REVOKE ALL ON TABLE "transaction_fee_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "transaction_fee_rules" FROM union_eyes_system;
GRANT SELECT ON TABLE "transaction_fee_rules" TO union_eyes_system;

REVOKE ALL ON TABLE "trend_analyses" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "trend_analyses" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "trend_analyses" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ue_policy_bindings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ue_policy_bindings" FROM union_eyes_system;

REVOKE ALL ON TABLE "user_signatures" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "user_signatures" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "user_signatures" TO union_eyes_runtime;

REVOKE ALL ON TABLE "voting_sessions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "voting_sessions" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "voting_sessions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "wcb_employer_assessments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "wcb_employer_assessments" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "wcb_employer_assessments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "website_settings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "website_settings" FROM union_eyes_system;

REVOKE ALL ON TABLE "worksites" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "worksites" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "worksites" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ab_test_assignments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ab_test_assignments" FROM union_eyes_system;

REVOKE ALL ON TABLE "ab_test_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ab_test_events" FROM union_eyes_system;

REVOKE ALL ON TABLE "ab_test_variants" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ab_test_variants" FROM union_eyes_system;

REVOKE ALL ON TABLE "access_justification_requests" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "access_justification_requests" FROM union_eyes_system;

REVOKE ALL ON TABLE "address_change_history" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "address_change_history" FROM union_eyes_system;

REVOKE ALL ON TABLE "address_validation_cache" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "address_validation_cache" FROM union_eyes_system;

REVOKE ALL ON TABLE "alert_actions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "alert_actions" FROM union_eyes_system;

REVOKE ALL ON TABLE "alert_conditions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "alert_conditions" FROM union_eyes_system;

REVOKE ALL ON TABLE "alert_executions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "alert_executions" FROM union_eyes_system;
GRANT SELECT ON TABLE "alert_executions" TO union_eyes_runtime;
GRANT INSERT ON TABLE "alert_executions" TO union_eyes_system;

REVOKE ALL ON TABLE "alert_recipients" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "alert_recipients" FROM union_eyes_system;

REVOKE ALL ON TABLE "allocation_runs" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "allocation_runs" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "allocation_runs" TO union_eyes_runtime;

REVOKE ALL ON TABLE "allocation_basis_snapshots" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "allocation_basis_snapshots" FROM union_eyes_system;
GRANT INSERT ON TABLE "allocation_basis_snapshots" TO union_eyes_runtime;

REVOKE ALL ON TABLE "allocation_rule_versions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "allocation_rule_versions" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "allocation_rule_versions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "allocation_run_lines" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "allocation_run_lines" FROM union_eyes_system;
GRANT INSERT ON TABLE "allocation_run_lines" TO union_eyes_runtime;

REVOKE ALL ON TABLE "arms_length_verification" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "arms_length_verification" FROM union_eyes_system;

REVOKE ALL ON TABLE "automation_execution_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "automation_execution_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "automation_schedules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "automation_schedules" FROM union_eyes_system;

REVOKE ALL ON TABLE "autopay_settings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "autopay_settings" FROM union_eyes_system;

REVOKE ALL ON TABLE "award_history" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "award_history" FROM union_eyes_system;

REVOKE ALL ON TABLE "band_councils" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "band_councils" FROM union_eyes_system;

REVOKE ALL ON TABLE "bank_of_canada_rates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "bank_of_canada_rates" FROM union_eyes_system;

REVOKE ALL ON TABLE "bank_transactions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "bank_transactions" FROM union_eyes_system;

REVOKE ALL ON TABLE "benchmark_categories" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "benchmark_categories" FROM union_eyes_system;

REVOKE ALL ON TABLE "benchmark_data" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "benchmark_data" FROM union_eyes_system;

REVOKE ALL ON TABLE "benefit_comparisons" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "benefit_comparisons" FROM union_eyes_system;

REVOKE ALL ON TABLE "blind_trust_registry" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "blind_trust_registry" FROM union_eyes_system;

REVOKE ALL ON TABLE "break_glass_activations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "break_glass_activations" FROM union_eyes_system;

REVOKE ALL ON TABLE "break_glass_system" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "break_glass_system" FROM union_eyes_system;

REVOKE ALL ON TABLE "certification_alerts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "certification_alerts" FROM union_eyes_system;

REVOKE ALL ON TABLE "certification_compliance_reports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "certification_compliance_reports" FROM union_eyes_system;

REVOKE ALL ON TABLE "certification_types" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "certification_types" FROM union_eyes_system;

REVOKE ALL ON TABLE "clause_embeddings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clause_embeddings" FROM union_eyes_system;
GRANT SELECT ON TABLE "clause_embeddings" TO union_eyes_runtime;

REVOKE ALL ON TABLE "clause_library_tags" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clause_library_tags" FROM union_eyes_system;
GRANT SELECT, INSERT, DELETE ON TABLE "clause_library_tags" TO union_eyes_runtime;

REVOKE ALL ON TABLE "clc_oauth_tokens" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_oauth_tokens" FROM union_eyes_system;

REVOKE ALL ON TABLE "clc_union_density" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "clc_union_density" FROM union_eyes_system;

REVOKE ALL ON TABLE "conflict_disclosures" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "conflict_disclosures" FROM union_eyes_system;

REVOKE ALL ON TABLE "conflict_of_interest_policy" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "conflict_of_interest_policy" FROM union_eyes_system;

REVOKE ALL ON TABLE "conflict_training" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "conflict_training" FROM union_eyes_system;

REVOKE ALL ON TABLE "continuing_education" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "continuing_education" FROM union_eyes_system;

REVOKE ALL ON TABLE "contract_amendments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "contract_amendments" FROM union_eyes_system;

REVOKE ALL ON TABLE "commercial_contracts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "commercial_contracts" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "commercial_contracts" TO union_eyes_runtime;
GRANT INSERT, UPDATE ON TABLE "commercial_contracts" TO union_eyes_system;

REVOKE ALL ON TABLE "contract_line_items" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "contract_line_items" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "contract_line_items" TO union_eyes_runtime;

REVOKE ALL ON TABLE "contract_rate_cards" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "contract_rate_cards" FROM union_eyes_system;

REVOKE ALL ON TABLE "contribution_rates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "contribution_rates" FROM union_eyes_system;
GRANT SELECT ON TABLE "contribution_rates" TO union_eyes_runtime;
GRANT SELECT, INSERT, UPDATE ON TABLE "contribution_rates" TO union_eyes_system;

REVOKE ALL ON TABLE "correspondence_recipients" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "correspondence_recipients" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "correspondence_recipients" TO union_eyes_runtime;

REVOKE ALL ON TABLE "cost_of_living_data" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cost_of_living_data" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "cost_of_living_data" TO union_eyes_system;

REVOKE ALL ON TABLE "country_address_formats" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "country_address_formats" FROM union_eyes_system;

REVOKE ALL ON TABLE "cpi_adjusted_pricing" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cpi_adjusted_pricing" FROM union_eyes_system;

REVOKE ALL ON TABLE "cpi_data" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cpi_data" FROM union_eyes_system;

REVOKE ALL ON TABLE "cross_border_transactions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "cross_border_transactions" FROM union_eyes_system;

REVOKE ALL ON TABLE "currency_enforcement_policy" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "currency_enforcement_policy" FROM union_eyes_system;

REVOKE ALL ON TABLE "currency_enforcement_violations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "currency_enforcement_violations" FROM union_eyes_system;

REVOKE ALL ON TABLE "data_classification_policy" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "data_classification_policy" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "data_classification_policy" TO union_eyes_runtime;

REVOKE ALL ON TABLE "data_classification_registry" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "data_classification_registry" FROM union_eyes_system;

REVOKE ALL ON TABLE "data_subject_access_requests" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "data_subject_access_requests" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "data_subject_access_requests" TO union_eyes_runtime;
GRANT SELECT, UPDATE ON TABLE "data_subject_access_requests" TO union_eyes_system;

REVOKE ALL ON TABLE "disaster_recovery_drills" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "disaster_recovery_drills" FROM union_eyes_system;

REVOKE ALL ON TABLE "dispatch_assignments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dispatch_assignments" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "dispatch_assignments" TO union_eyes_runtime;

REVOKE ALL ON TABLE "dsr_activity_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dsr_activity_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "dunning_policies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dunning_policies" FROM union_eyes_system;

REVOKE ALL ON TABLE "dunning_steps" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "dunning_steps" FROM union_eyes_system;

REVOKE ALL ON TABLE "emergency_declarations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "emergency_declarations" FROM union_eyes_system;

REVOKE ALL ON TABLE "employer_access_attempts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_access_attempts" FROM union_eyes_system;

REVOKE ALL ON TABLE "employer_reports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "employer_reports" FROM union_eyes_system;
GRANT SELECT ON TABLE "employer_reports" TO union_eyes_runtime;

REVOKE ALL ON TABLE "exchange_rates" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "exchange_rates" FROM union_eyes_system;

REVOKE ALL ON TABLE "feature_flags" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "feature_flags" FROM union_eyes_system;
GRANT SELECT, UPDATE ON TABLE "feature_flags" TO union_eyes_runtime;

REVOKE ALL ON TABLE "federation_executives" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "federation_executives" FROM union_eyes_system;

REVOKE ALL ON TABLE "federation_meetings" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "federation_meetings" FROM union_eyes_system;

REVOKE ALL ON TABLE "federation_resources" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "federation_resources" FROM union_eyes_system;

REVOKE ALL ON TABLE "firewall_access_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "firewall_access_rules" FROM union_eyes_system;

REVOKE ALL ON TABLE "firewall_violations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "firewall_violations" FROM union_eyes_system;

REVOKE ALL ON TABLE "fmv_benchmarks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "fmv_benchmarks" FROM union_eyes_system;

REVOKE ALL ON TABLE "fmv_policy" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "fmv_policy" FROM union_eyes_system;

REVOKE ALL ON TABLE "fmv_violations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "fmv_violations" FROM union_eyes_system;

REVOKE ALL ON TABLE "geofence_events" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "geofence_events" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "geofence_events" TO union_eyes_runtime;
GRANT SELECT ON TABLE "geofence_events" TO union_eyes_system;

REVOKE ALL ON TABLE "geofences" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "geofences" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "geofences" TO union_eyes_runtime;

REVOKE ALL ON TABLE "independent_appraisals" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "independent_appraisals" FROM union_eyes_system;

REVOKE ALL ON TABLE "indigenous_data_access_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "indigenous_data_access_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "indigenous_data_sharing_agreements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "indigenous_data_sharing_agreements" FROM union_eyes_system;

REVOKE ALL ON TABLE "journal_entry_lines" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "journal_entry_lines" FROM union_eyes_system;

REVOKE ALL ON TABLE "key_holder_registry" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "key_holder_registry" FROM union_eyes_system;

REVOKE ALL ON TABLE "knowledge_base_articles" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "knowledge_base_articles" FROM union_eyes_system;

REVOKE ALL ON TABLE "license_renewals" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "license_renewals" FROM union_eyes_system;

REVOKE ALL ON TABLE "lmbp_compliance_alerts" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "lmbp_compliance_alerts" FROM union_eyes_system;

REVOKE ALL ON TABLE "lmbp_compliance_reports" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "lmbp_compliance_reports" FROM union_eyes_system;

REVOKE ALL ON TABLE "lmbp_letters" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "lmbp_letters" FROM union_eyes_system;

REVOKE ALL ON TABLE "location_deletion_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "location_deletion_log" FROM union_eyes_system;
GRANT INSERT ON TABLE "location_deletion_log" TO union_eyes_runtime;

REVOKE ALL ON TABLE "location_tracking" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "location_tracking" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "location_tracking" TO union_eyes_runtime;
GRANT SELECT ON TABLE "location_tracking" TO union_eyes_system;

REVOKE ALL ON TABLE "location_tracking_config" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "location_tracking_config" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "location_tracking_config" TO union_eyes_runtime;

REVOKE ALL ON TABLE "lrb_agreements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "lrb_agreements" FROM union_eyes_system;

REVOKE ALL ON TABLE "lrb_employers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "lrb_employers" FROM union_eyes_system;

REVOKE ALL ON TABLE "lrb_unions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "lrb_unions" FROM union_eyes_system;

REVOKE ALL ON TABLE "mentorships" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "mentorships" FROM union_eyes_system;

REVOKE ALL ON TABLE "movement_trends" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "movement_trends" FROM union_eyes_system;
GRANT SELECT ON TABLE "movement_trends" TO union_eyes_runtime;

REVOKE ALL ON TABLE "negotiation_sessions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "negotiation_sessions" FROM union_eyes_system;

REVOKE ALL ON TABLE "pack_verification_log" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pack_verification_log" FROM union_eyes_system;

REVOKE ALL ON TABLE "policy_evaluations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "policy_evaluations" FROM union_eyes_system;
GRANT INSERT ON TABLE "policy_evaluations" TO union_eyes_runtime;
GRANT SELECT ON TABLE "policy_evaluations" TO union_eyes_system;

REVOKE ALL ON TABLE "policy_exceptions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "policy_exceptions" FROM union_eyes_system;
GRANT SELECT ON TABLE "policy_exceptions" TO union_eyes_runtime;

REVOKE ALL ON TABLE "precedent_citations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "precedent_citations" FROM union_eyes_system;

REVOKE ALL ON TABLE "precedent_tags" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "precedent_tags" FROM union_eyes_system;

REVOKE ALL ON TABLE "pricing_discount_rules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pricing_discount_rules" FROM union_eyes_system;

REVOKE ALL ON TABLE "pricing_regional_deployments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "pricing_regional_deployments" FROM union_eyes_system;

REVOKE ALL ON TABLE "privacy_breaches" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "privacy_breaches" FROM union_eyes_system;

REVOKE ALL ON TABLE "procurement_bids" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "procurement_bids" FROM union_eyes_system;

REVOKE ALL ON TABLE "procurement_requests" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "procurement_requests" FROM union_eyes_system;

REVOKE ALL ON TABLE "provincial_data_handling" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "provincial_data_handling" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "provincial_data_handling" TO union_eyes_runtime;
GRANT SELECT ON TABLE "provincial_data_handling" TO union_eyes_system;

REVOKE ALL ON TABLE "provincial_privacy_config" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "provincial_privacy_config" FROM union_eyes_system;
GRANT SELECT ON TABLE "provincial_privacy_config" TO union_eyes_runtime;

REVOKE ALL ON TABLE "push_deliveries" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "push_deliveries" FROM union_eyes_system;

REVOKE ALL ON TABLE "recovery_time_objectives" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "recovery_time_objectives" FROM union_eyes_system;

REVOKE ALL ON TABLE "recusal_tracking" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "recusal_tracking" FROM union_eyes_system;

REVOKE ALL ON TABLE "segment_executions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "segment_executions" FROM union_eyes_system;

REVOKE ALL ON TABLE "shared_clause_library" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "shared_clause_library" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "shared_clause_library" TO union_eyes_runtime;

REVOKE ALL ON TABLE "signature_verification" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "signature_verification" FROM union_eyes_system;

REVOKE ALL ON TABLE "signers" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "signers" FROM union_eyes_system;

REVOKE ALL ON TABLE "sla_policies" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "sla_policies" FROM union_eyes_system;

REVOKE ALL ON TABLE "staff_certifications" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "staff_certifications" FROM union_eyes_system;

REVOKE ALL ON TABLE "t106_filing_tracking" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "t106_filing_tracking" FROM union_eyes_system;

REVOKE ALL ON TABLE "tentative_agreements" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "tentative_agreements" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "tentative_agreements" TO union_eyes_runtime;

REVOKE ALL ON TABLE "testimonials" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "testimonials" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "testimonials" TO union_eyes_runtime;

REVOKE ALL ON TABLE "ticket_comments" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ticket_comments" FROM union_eyes_system;

REVOKE ALL ON TABLE "ticket_history" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "ticket_history" FROM union_eyes_system;

REVOKE ALL ON TABLE "traditional_knowledge_registry" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "traditional_knowledge_registry" FROM union_eyes_system;

REVOKE ALL ON TABLE "transaction_currency_conversions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "transaction_currency_conversions" FROM union_eyes_system;

REVOKE ALL ON TABLE "union_density" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "union_density" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "union_density" TO union_eyes_system;

REVOKE ALL ON TABLE "union_only_data_tags" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "union_only_data_tags" FROM union_eyes_system;

REVOKE ALL ON TABLE "user_uuid_mapping" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "user_uuid_mapping" FROM union_eyes_system;

REVOKE ALL ON TABLE "voter_eligibility" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "voter_eligibility" FROM union_eyes_system;
GRANT SELECT ON TABLE "voter_eligibility" TO union_eyes_runtime;

REVOKE ALL ON TABLE "votes" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "votes" FROM union_eyes_system;
GRANT SELECT, INSERT ON TABLE "votes" TO union_eyes_runtime;

REVOKE ALL ON TABLE "voting_options" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "voting_options" FROM union_eyes_system;
GRANT SELECT ON TABLE "voting_options" TO union_eyes_runtime;

REVOKE ALL ON TABLE "wage_benchmarks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "wage_benchmarks" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "wage_benchmarks" TO union_eyes_system;

REVOKE ALL ON TABLE "wage_progressions" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "wage_progressions" FROM union_eyes_system;

REVOKE ALL ON TABLE "wcag_success_criteria" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "wcag_success_criteria" FROM union_eyes_system;

REVOKE ALL ON TABLE "weekly_threshold_tracking" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "weekly_threshold_tracking" FROM union_eyes_system;

REVOKE ALL ON TABLE "whiplash_violations" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "whiplash_violations" FROM union_eyes_system;

REVOKE ALL ON TABLE "workbook_continuity_breakpoints" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workbook_continuity_breakpoints" FROM union_eyes_system;

REVOKE ALL ON TABLE "workbook_memory_holders" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workbook_memory_holders" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE "workbook_memory_holders" TO union_eyes_runtime;

REVOKE ALL ON TABLE "workbook_modernization_alignment" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workbook_modernization_alignment" FROM union_eyes_system;

REVOKE ALL ON TABLE "workbook_modules" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workbook_modules" FROM union_eyes_system;
GRANT INSERT ON TABLE "workbook_modules" TO union_eyes_runtime;

REVOKE ALL ON TABLE "workbook_purchases" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workbook_purchases" FROM union_eyes_system;
GRANT INSERT ON TABLE "workbook_purchases" TO union_eyes_system;

REVOKE ALL ON TABLE "workbook_stewardship_signals" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workbook_stewardship_signals" FROM union_eyes_system;

REVOKE ALL ON TABLE "workbook_transformation_roadmap" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workbook_transformation_roadmap" FROM union_eyes_system;

REVOKE ALL ON TABLE "workbooks" FROM union_eyes_runtime;
REVOKE ALL ON TABLE "workbooks" FROM union_eyes_system;
GRANT SELECT, INSERT, UPDATE ON TABLE "workbooks" TO union_eyes_runtime;
GRANT UPDATE ON TABLE "workbooks" TO union_eyes_system;

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
