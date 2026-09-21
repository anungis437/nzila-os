-- 0012_storage_authority_rls_final_closure.rollback
--
-- TEST/DEV rollback ONLY (never run against staging/production). Reverses
-- 0012: drops the 55 tables' 0012 policies, DISABLEs RLS on them, drops the 5
-- helper functions 0012 introduced, and drops the 20 authority columns 0012
-- added (across 19 tables) with their FK constraints and indexes.
--
-- Does NOT touch: 0010's ue_create_direct_org_rls_policy helper, the 24
-- 0108 tables, the 144 tables 0011 owns, the 0006/0007/0008 policies, 0009's
-- grants, or any role. Destructive (drops NOT NULL columns) — safe only on an
-- empty TEST/DEV database.

DO $$
DECLARE
  t TEXT;
  tabs TEXT[] := ARRAY[
    'ai_safety_filters','alert_executions','arbitration_precedents','arbitrations','bargaining_notes',
    'bargaining_proposals','board_packet_distributions','board_packets','budget_pool','calendar_events',
    'chat_messages','chat_sessions','claim_updates','clause_comparisons','clause_library_tags','clc_sync_log',
    'consent_records','cookie_consents','data_subject_access_requests','defensibility_packs','document_signers',
    'gdpr_data_requests','geofence_events','geofences','grievance_timeline','location_tracking',
    'location_tracking_audit','member_location_consent','mobile_devices','newsletter_list_subscribers',
    'newsletter_recipients','pilot_applications','pilot_metrics','policy_evaluations','policy_exceptions',
    'policy_rules','profiles','provincial_consent','provincial_data_handling','reward_wallet_ledger',
    'settlements','shared_clause_library','signature_audit_trail','strike_fund_disbursements',
    'tentative_agreements','user_consents','voter_eligibility','votes','voting_options','voting_sessions',
    'workbook_governance_lineage_entries','workbook_memory_holders','workbook_modules','workbook_purchases','workbooks'
  ];
BEGIN
  FOREACH t IN ARRAY tabs LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NOT NULL THEN
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_parent_org_isolation_v2 ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_parent_user_isolation_v2 ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_select ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_insert ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_update ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_delete ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_select ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_insert ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_update ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_delete ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_child_select ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_child_write ON %I', t);
      EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', t);
      EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
      EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint
-- Drop the 20 authority columns 0012 added (FK constraints + indexes cascade).
ALTER TABLE IF EXISTS chat_sessions DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS board_packets DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS policy_rules DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS voting_sessions DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS bargaining_notes DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS budget_pool DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS calendar_events DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS clause_comparisons DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS clc_sync_log DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS consent_records DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS cookie_consents DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS defensibility_packs DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS geofences DROP COLUMN IF EXISTS union_local_id;
ALTER TABLE IF EXISTS mobile_devices DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS pilot_metrics DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS reward_wallet_ledger DROP COLUMN IF EXISTS org_id;
ALTER TABLE IF EXISTS strike_fund_disbursements DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS user_consents DROP COLUMN IF EXISTS organization_id;
ALTER TABLE IF EXISTS shared_clause_library DROP COLUMN IF EXISTS sharing_level;
ALTER TABLE IF EXISTS shared_clause_library DROP COLUMN IF EXISTS shared_with_org_ids;
--> statement-breakpoint
DROP FUNCTION IF EXISTS ue_create_parent_owned_rls_policy_v2(TEXT, TEXT, TEXT, TEXT, BOOLEAN);
DROP FUNCTION IF EXISTS ue_create_user_rls_policy(TEXT, TEXT);
DROP FUNCTION IF EXISTS ue_create_parent_owned_via_user_rls_policy_v2(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS ue_create_shared_library_rls_policy(TEXT, TEXT, TEXT, TEXT);
DROP FUNCTION IF EXISTS ue_create_shared_library_child_rls_policy(TEXT, TEXT);
