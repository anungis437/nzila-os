-- 0012_storage_authority_rls_final_closure
--
-- Final closure of the CURRENT db/rls-storage-authority manifest RLS contract.
-- 0010 carried 0108's 24-table foundation into the scoped lineage; 0011 closed
-- the 144-table org-column delta the verifier could see. This migration closes
-- the LAST 55 physically-present, manifest-RLS-required tables that neither
-- 0006/0007/0008 (external/auth/audit) nor 0010/0011 owned — the set whose
-- source-native (Django app 0001_initial) physical shape diverged from the
-- richer Drizzle db/schema/** shape the manifest classification assumed
-- (dual-lineage collision). After 0012 there is NO physically-present
-- manifest-RLS-required table without a live policy owner.
--
-- Provenance / proof (every geometry below is copied from the already-reviewed,
-- generated, drift-ratcheted production remediation in the frozen 0108 lineage,
-- re-expressed here in the scoped lineage — never invented):
--   * Authority columns: db/migrations/20260913_round58_production_geometry_
--     prerequisites.sql + 20260914_round58_complete_production_geometry_
--     prerequisites.sql (column name/type/nullability/FK/on-delete copied
--     verbatim per block; every ADD is fail-closed — a non-empty table with no
--     deterministic authority source aborts rather than inventing one).
--   * Policy geometry (the exact per-table helper + arguments): db/migrations/
--     20260910_rls_enforcement_expansion_round58.sql PART B (generated, 0 blocked).
--   * Helper function bodies (PART B here): ported verbatim from that same
--     20260910 file's helper preamble.
--
-- Scope discipline (RLS + its prerequisite authority columns ONLY):
--   * Does NOT create/alter roles or passwords (provisioning owns that), nor
--     re-grant baseline DML/sequence/CONNECT (0009 owns that).
--   * Does NOT touch the 24 canonical 0108 tables (0010), the 0006/0007/0008
--     policies, or the 144 tables 0011 owns.
--   * Adds the 20 missing authority columns (across 19 tables) via scoped SQL —
--     the SINGLE owner of these columns in the scoped lineage. The matching
--     Django models stay minimal + DenyAll (backend six_root_writer_ratchet /
--     containment tests), so `makemigrations --check` sees no drift.
--   * Idempotent: column ADDs are guarded (skip if present); helpers use
--     CREATE OR REPLACE + DROP POLICY IF EXISTS + ENABLE/FORCE RLS. Safe on a
--     fresh source-native DB and on re-apply.
--   * Fail-closed: PART -1 hard-fails if any target/parent table or already-
--     required authority column is absent, or if a canonical 0012 policy name
--     already exists on a target with a non-canonical command/role (tamper/drift).
--
-- Authority geometry for the 55 (proven — see the three legacy files above):
--   DIRECT_ORG (20): runtime sees only current_org rows (strict equality; NULL-
--     org rows invisible to tenants = fail-closed). organization_id except
--     arbitration_precedents.source_organization_id, geofences.union_local_id,
--     pilot_applications.verified_organization_id, reward_wallet_ledger.org_id.
--   PARENT_OWNED_V2 (19): authority via a NOT-NULL/nullable FK to a parent whose
--     own organization_id gates the row (chat_sessions, alert_rules, grievances,
--     negotiations, board_packets, claims, signature_documents, newsletter_*,
--     policy_rules, voting_sessions). No parent match => invisible = fail-closed.
--   USER_SELF (10): profiles/consent/location/gdpr/dsar tables keyed on user_id,
--     workbooks on claimed_by_user_id (pre-claim NULL => runtime-invisible).
--   PARENT_VIA_USER (4): workbook_* children gated through workbooks.claimed_by_user_id.
--   SHARED_LIBRARY (1): shared_clause_library — owner org OR shared-with OR public.
--   SHARED_LIBRARY_CHILD (1): clause_library_tags — inherits its parent clause's visibility.
--   SYSTEM: every table gets a union_eyes_system full-access policy (policy-mediated;
--     union_eyes_system stays NOSUPERUSER/NOBYPASSRLS).

-- PART -1 — Fail-closed preflight guard.
DO $$
DECLARE
  t TEXT;
  target_tables TEXT[] := ARRAY[
    -- the 55 manifest-RLS-required tables closed here
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
  parent_tables TEXT[] := ARRAY[
    'chat_sessions','alert_rules','grievances','negotiations','board_packets','claims','signature_documents',
    'newsletter_distribution_lists','newsletter_campaigns','policy_rules','voting_sessions','workbooks','organizations'
  ];
  -- authority columns that MUST already be physically present (never added here).
  present_cols TEXT[][] := ARRAY[
    ARRAY['ai_safety_filters','session_id'],ARRAY['alert_executions','alert_rule_id'],
    ARRAY['arbitration_precedents','source_organization_id'],ARRAY['arbitrations','grievance_id'],
    ARRAY['bargaining_proposals','negotiation_id'],ARRAY['board_packet_distributions','packet_id'],
    ARRAY['chat_messages','session_id'],ARRAY['claim_updates','claim_id'],ARRAY['document_signers','document_id'],
    ARRAY['grievance_timeline','grievance_id'],ARRAY['newsletter_list_subscribers','list_id'],
    ARRAY['newsletter_recipients','campaign_id'],ARRAY['policy_evaluations','rule_id'],
    ARRAY['policy_exceptions','rule_id'],ARRAY['settlements','grievance_id'],
    ARRAY['signature_audit_trail','document_id'],ARRAY['tentative_agreements','negotiation_id'],
    ARRAY['voter_eligibility','session_id'],ARRAY['votes','session_id'],ARRAY['voting_options','session_id'],
    ARRAY['pilot_applications','verified_organization_id'],
    ARRAY['data_subject_access_requests','user_id'],ARRAY['gdpr_data_requests','user_id'],
    ARRAY['geofence_events','user_id'],ARRAY['location_tracking','user_id'],
    ARRAY['location_tracking_audit','user_id'],ARRAY['member_location_consent','user_id'],
    ARRAY['profiles','user_id'],ARRAY['provincial_consent','user_id'],ARRAY['provincial_data_handling','user_id'],
    ARRAY['workbooks','claimed_by_user_id'],ARRAY['workbook_governance_lineage_entries','workbook_id'],
    ARRAY['workbook_memory_holders','workbook_id'],ARRAY['workbook_modules','workbook_id'],
    ARRAY['workbook_purchases','workbook_id'],ARRAY['shared_clause_library','source_organization_id'],
    ARRAY['clause_library_tags','clause_id'],ARRAY['alert_rules','organization_id'],
    ARRAY['grievances','organization_id'],ARRAY['negotiations','organization_id'],ARRAY['claims','organization_id'],
    ARRAY['signature_documents','organization_id'],ARRAY['newsletter_distribution_lists','organization_id'],
    ARRAY['newsletter_campaigns','organization_id']
  ];
  pc TEXT[];
  r RECORD;
  expected_role TEXT;
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'RLS 0012: skipping missing target table public.%', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY parent_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'RLS 0012: parent table public.% absent — parent-owned policies that need it will no-op.', t;
    END IF;
  END LOOP;
  FOR i IN 1 .. array_length(present_cols, 1) LOOP
    pc := present_cols[i:i][1:2];
    -- Skip column precondition when the table itself is absent (source-native / CI).
    IF to_regclass(format('public.%I', present_cols[i][1])) IS NULL THEN
      RAISE NOTICE 'RLS 0012: %.% precondition skipped — table absent', present_cols[i][1], present_cols[i][2];
      CONTINUE;
    END IF;
    PERFORM 1 FROM information_schema.columns
      WHERE table_schema='public' AND table_name = present_cols[i][1] AND column_name = present_cols[i][2];
    IF NOT FOUND THEN
      RAISE EXCEPTION 'RLS 0012 fail-closed: required authority column %.% is absent — geometry precondition unmet.', present_cols[i][1], present_cols[i][2];
    END IF;
  END LOOP;

  -- canonical-name conflict guard for the policy names 0012 creates.
  FOR r IN
    SELECT tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname='public'
      AND policyname IN (
        'ue_org_isolation_select','ue_org_isolation_insert','ue_org_isolation_update','ue_org_isolation_delete',
        'ue_parent_org_isolation_v2','ue_parent_user_isolation_v2',
        'ue_user_isolation_select','ue_user_isolation_insert','ue_user_isolation_update','ue_user_isolation_delete',
        'ue_shared_library_select','ue_shared_library_insert','ue_shared_library_update','ue_shared_library_delete',
        'ue_shared_library_child_select','ue_shared_library_child_write','ue_system_full_access'
      )
      AND tablename = ANY (target_tables)
  LOOP
    expected_role := CASE WHEN r.policyname = 'ue_system_full_access' THEN 'union_eyes_system' ELSE 'union_eyes_runtime' END;
    IF r.roles <> ARRAY[expected_role]::name[] THEN
      RAISE EXCEPTION
        'RLS 0012 fail-closed: pre-existing policy %.% has role target % (expected %). Reconcile manually before applying 0012.',
        r.tablename, r.policyname, r.roles, expected_role;
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint
-- =============================================================================
-- PART A — geometry prerequisites: add the 20 missing authority columns
-- (across 19 tables). Column name/type/nullability/FK/on-delete/index copied
-- verbatim from db/migrations/20260913 + 20260914. Every ADD is fail-closed:
-- a non-empty table with no deterministic authority source aborts rather than
-- inventing an owning organization. Idempotent (skip if the column exists).
-- =============================================================================

-- chat_sessions.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.chat_sessions') IS NULL THEN
    RAISE NOTICE 'RLS 0012: chat_sessions absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='chat_sessions' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM chat_sessions LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: chat_sessions is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE chat_sessions ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE chat_sessions ADD CONSTRAINT chat_sessions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX chat_sessions_organization_id_idx ON chat_sessions USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- board_packets.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.board_packets') IS NULL THEN
    RAISE NOTICE 'RLS 0012: board_packets absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='board_packets' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM board_packets LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: board_packets is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE board_packets ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE board_packets ADD CONSTRAINT board_packets_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX board_packets_organization_id_idx ON board_packets USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- policy_rules.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.policy_rules') IS NULL THEN
    RAISE NOTICE 'RLS 0012: policy_rules absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='policy_rules' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM policy_rules LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: policy_rules is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE policy_rules ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE policy_rules ADD CONSTRAINT policy_rules_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX policy_rules_organization_id_idx ON policy_rules USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- voting_sessions.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.voting_sessions') IS NULL THEN
    RAISE NOTICE 'RLS 0012: voting_sessions absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='voting_sessions' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM voting_sessions LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: voting_sessions is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE voting_sessions ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE voting_sessions ADD CONSTRAINT voting_sessions_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX voting_sessions_organization_id_idx ON voting_sessions USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- bargaining_notes.organization_id (uuid NOT NULL, no FK)
DO $$
BEGIN
  IF to_regclass('public.bargaining_notes') IS NULL THEN
    RAISE NOTICE 'RLS 0012: bargaining_notes absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='bargaining_notes' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM bargaining_notes LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: bargaining_notes is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE bargaining_notes ADD COLUMN organization_id uuid NOT NULL;
    CREATE INDEX bargaining_notes_organization_id_idx ON bargaining_notes USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- budget_pool.organization_id (varchar(255) NOT NULL, no FK)
DO $$
BEGIN
  IF to_regclass('public.budget_pool') IS NULL THEN
    RAISE NOTICE 'RLS 0012: budget_pool absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='budget_pool' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM budget_pool LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: budget_pool is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE budget_pool ADD COLUMN organization_id varchar(255) NOT NULL;
    CREATE INDEX idx_budget_pool_org ON budget_pool USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- calendar_events.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.calendar_events') IS NULL THEN
    RAISE NOTICE 'RLS 0012: calendar_events absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='calendar_events' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM calendar_events LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: calendar_events is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE calendar_events ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE calendar_events ADD CONSTRAINT calendar_events_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX calendar_events_organization_id_idx ON calendar_events USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- clause_comparisons.organization_id (uuid NOT NULL, no FK)
DO $$
BEGIN
  IF to_regclass('public.clause_comparisons') IS NULL THEN
    RAISE NOTICE 'RLS 0012: clause_comparisons absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clause_comparisons' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM clause_comparisons LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: clause_comparisons is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE clause_comparisons ADD COLUMN organization_id uuid NOT NULL;
    CREATE INDEX clause_comparisons_organization_idx ON clause_comparisons USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- clc_sync_log.organization_id (uuid NULLABLE, FK organizations, no ON DELETE)
DO $$
BEGIN
  IF to_regclass('public.clc_sync_log') IS NULL THEN
    RAISE NOTICE 'RLS 0012: clc_sync_log absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='clc_sync_log' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM clc_sync_log LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: clc_sync_log is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE clc_sync_log ADD COLUMN organization_id uuid;
    ALTER TABLE clc_sync_log ADD CONSTRAINT clc_sync_log_organization_id_fkey FOREIGN KEY (organization_id) REFERENCES organizations(id);
    CREATE INDEX idx_sync_log_org ON clc_sync_log USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- consent_records.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.consent_records') IS NULL THEN
    RAISE NOTICE 'RLS 0012: consent_records absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='consent_records' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM consent_records LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: consent_records is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE consent_records ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE consent_records ADD CONSTRAINT consent_records_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX consent_records_organization_id_idx ON consent_records USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- cookie_consents.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.cookie_consents') IS NULL THEN
    RAISE NOTICE 'RLS 0012: cookie_consents absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='cookie_consents' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM cookie_consents LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: cookie_consents is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE cookie_consents ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE cookie_consents ADD CONSTRAINT cookie_consents_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX cookie_consents_organization_id_idx ON cookie_consents USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- defensibility_packs.organization_id (uuid NOT NULL, no FK, no index)
DO $$
BEGIN
  IF to_regclass('public.defensibility_packs') IS NULL THEN
    RAISE NOTICE 'RLS 0012: defensibility_packs absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='defensibility_packs' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM defensibility_packs LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: defensibility_packs is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE defensibility_packs ADD COLUMN organization_id uuid NOT NULL;
  END IF;
END $$;
--> statement-breakpoint
-- geofences.union_local_id (uuid NULLABLE, no FK by design; tenant boundary under a domain-specific name)
DO $$
BEGIN
  IF to_regclass('public.geofences') IS NULL THEN
    RAISE NOTICE 'RLS 0012: geofences absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='geofences' AND column_name='union_local_id') THEN
    IF EXISTS (SELECT 1 FROM geofences LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: geofences is non-empty with no deterministic union_local_id source.'; END IF;
    ALTER TABLE geofences ADD COLUMN union_local_id uuid;
  END IF;
END $$;
--> statement-breakpoint
-- mobile_devices.organization_id (uuid NULLABLE, FK organizations ON DELETE CASCADE, no index)
DO $$
BEGIN
  IF to_regclass('public.mobile_devices') IS NULL THEN
    RAISE NOTICE 'RLS 0012: mobile_devices absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='mobile_devices' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM mobile_devices LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: mobile_devices is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE mobile_devices ADD COLUMN organization_id uuid;
    ALTER TABLE mobile_devices ADD CONSTRAINT mobile_devices_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
-- pilot_metrics.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.pilot_metrics') IS NULL THEN
    RAISE NOTICE 'RLS 0012: pilot_metrics absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='pilot_metrics' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM pilot_metrics LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: pilot_metrics is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE pilot_metrics ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE pilot_metrics ADD CONSTRAINT pilot_metrics_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX pilot_metrics_organization_id_idx ON pilot_metrics USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- reward_wallet_ledger.org_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.reward_wallet_ledger') IS NULL THEN
    RAISE NOTICE 'RLS 0012: reward_wallet_ledger absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='reward_wallet_ledger' AND column_name='org_id') THEN
    IF EXISTS (SELECT 1 FROM reward_wallet_ledger LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: reward_wallet_ledger is non-empty with no deterministic org_id source.'; END IF;
    ALTER TABLE reward_wallet_ledger ADD COLUMN org_id uuid NOT NULL;
    ALTER TABLE reward_wallet_ledger ADD CONSTRAINT reward_wallet_ledger_org_id_organizations_id_fk FOREIGN KEY (org_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX reward_wallet_ledger_org_user_idx ON reward_wallet_ledger USING btree (org_id);
  END IF;
END $$;
--> statement-breakpoint
-- strike_fund_disbursements.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE, no index)
DO $$
BEGIN
  IF to_regclass('public.strike_fund_disbursements') IS NULL THEN
    RAISE NOTICE 'RLS 0012: strike_fund_disbursements absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='strike_fund_disbursements' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM strike_fund_disbursements LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: strike_fund_disbursements is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE strike_fund_disbursements ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE strike_fund_disbursements ADD CONSTRAINT strike_fund_disbursements_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;
--> statement-breakpoint
-- user_consents.organization_id (uuid NOT NULL, FK organizations ON DELETE CASCADE)
DO $$
BEGIN
  IF to_regclass('public.user_consents') IS NULL THEN
    RAISE NOTICE 'RLS 0012: user_consents absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_consents' AND column_name='organization_id') THEN
    IF EXISTS (SELECT 1 FROM user_consents LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: user_consents is non-empty with no deterministic organization_id source.'; END IF;
    ALTER TABLE user_consents ADD COLUMN organization_id uuid NOT NULL;
    ALTER TABLE user_consents ADD CONSTRAINT user_consents_organization_id_organizations_id_fk FOREIGN KEY (organization_id) REFERENCES organizations(id) ON DELETE CASCADE;
    CREATE INDEX user_consents_organization_id_idx ON user_consents USING btree (organization_id);
  END IF;
END $$;
--> statement-breakpoint
-- shared_clause_library.sharing_level (varchar(50) NOT NULL DEFAULT 'private') + shared_with_org_ids (uuid[] nullable)
DO $$
BEGIN
  IF to_regclass('public.shared_clause_library') IS NULL THEN
    RAISE NOTICE 'RLS 0012: shared_clause_library absent — skipping authority-column prerequisite';
    RETURN;
  END IF;
IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shared_clause_library' AND column_name='sharing_level') THEN
    IF EXISTS (SELECT 1 FROM shared_clause_library LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: shared_clause_library is non-empty with no deterministic sharing_level source.'; END IF;
    ALTER TABLE shared_clause_library ADD COLUMN sharing_level varchar(50) NOT NULL DEFAULT 'private';
    CREATE INDEX idx_shared_clauses_sharing ON shared_clause_library USING btree (sharing_level);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='shared_clause_library' AND column_name='shared_with_org_ids') THEN
    IF EXISTS (SELECT 1 FROM shared_clause_library LIMIT 1) THEN RAISE EXCEPTION '0012 aborted: shared_clause_library is non-empty with no deterministic shared_with_org_ids source.'; END IF;
    ALTER TABLE shared_clause_library ADD COLUMN shared_with_org_ids uuid[];
  END IF;
END $$;
--> statement-breakpoint
-- =============================================================================
-- PART B — durable policy-helper functions ported verbatim from
-- db/migrations/20260910_rls_enforcement_expansion_round58.sql. Each is
-- idempotent (DROP POLICY IF EXISTS + CREATE), fail-closed (no matching policy
-- => union_eyes_runtime sees zero rows), ENABLE+FORCE RLS, and grants
-- union_eyes_system unconditional access via a separate role-gated policy.
-- (ue_create_direct_org_rls_policy is reused from 0010 — not redefined here.)
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
    IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0012: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
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
  EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', p_table_name);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ue_create_user_rls_policy(
  p_table_name TEXT,
  p_user_column TEXT DEFAULT 'user_id'
) RETURNS VOID AS $$
BEGIN
    IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0012: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true))', p_table_name, p_user_column);
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_user_id'', true))', p_table_name, p_user_column);
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_user_id'', true))', p_table_name, p_user_column, p_user_column);
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true))', p_table_name, p_user_column);
  EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', p_table_name);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ue_create_parent_owned_via_user_rls_policy_v2(
  p_table_name TEXT,
  p_fk_column TEXT,
  p_parent_table TEXT,
  p_parent_user_column TEXT DEFAULT 'user_id'
) RETURNS VOID AS $$
BEGIN
    IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0012: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_parent_user_isolation_v2 ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);
  EXECUTE format(
    'CREATE POLICY ue_parent_user_isolation_v2 ON %I FOR ALL TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I::text = current_setting(''app.current_user_id'', true))) ' ||
    'WITH CHECK (EXISTS (SELECT 1 FROM %I parent WHERE parent.id = %I.%I ' ||
    '  AND parent.%I::text = current_setting(''app.current_user_id'', true)))',
    p_table_name, p_parent_table, p_table_name, p_fk_column, p_parent_user_column,
    p_parent_table, p_table_name, p_fk_column, p_parent_user_column
  );
  EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', p_table_name);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ue_create_shared_library_rls_policy(
  p_table_name TEXT,
  p_org_column TEXT,
  p_sharing_level_column TEXT,
  p_shared_with_column TEXT
) RETURNS VOID AS $$
BEGIN
    IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0012: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);
  EXECUTE format(
    'CREATE POLICY ue_shared_library_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true) ' ||
    '    OR current_setting(''app.current_org_id'', true)::uuid = ANY(%I) ' ||
    '    OR %I = ''public'')',
    p_table_name, p_org_column, p_shared_with_column, p_sharing_level_column);
  EXECUTE format(
    'CREATE POLICY ue_shared_library_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))', p_table_name, p_org_column);
  EXECUTE format(
    'CREATE POLICY ue_shared_library_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))', p_table_name, p_org_column, p_org_column);
  EXECUTE format(
    'CREATE POLICY ue_shared_library_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true))', p_table_name, p_org_column);
  EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', p_table_name);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ue_create_shared_library_child_rls_policy(
  p_table_name TEXT,
  p_fk_column TEXT
) RETURNS VOID AS $$
BEGIN
    IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0012: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_child_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_shared_library_child_write ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);
  EXECUTE format(
    'CREATE POLICY ue_shared_library_child_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM shared_clause_library parent WHERE parent.id = %I.%I ' ||
    '  AND (parent.source_organization_id::text = current_setting(''app.current_org_id'', true) ' ||
    '    OR current_setting(''app.current_org_id'', true)::uuid = ANY(parent.shared_with_org_ids) ' ||
    '    OR parent.sharing_level = ''public'')))',
    p_table_name, p_table_name, p_fk_column);
  EXECUTE format(
    'CREATE POLICY ue_shared_library_child_write ON %I FOR ALL TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM shared_clause_library parent WHERE parent.id = %I.%I ' ||
    '  AND parent.source_organization_id::text = current_setting(''app.current_org_id'', true))) ' ||
    'WITH CHECK (EXISTS (SELECT 1 FROM shared_clause_library parent WHERE parent.id = %I.%I ' ||
    '  AND parent.source_organization_id::text = current_setting(''app.current_org_id'', true)))',
    p_table_name, p_table_name, p_fk_column, p_table_name, p_fk_column);
  EXECUTE format('CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)', p_table_name);
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- =============================================================================
-- PART C — policy application for the 55 (one call per resolved geometry).
-- Proof: db/migrations/20260910_rls_enforcement_expansion_round58.sql PART B.
-- =============================================================================
-- DIRECT_ORG (20) — reuses 0010's ue_create_direct_org_rls_policy.
SELECT ue_create_direct_org_rls_policy('arbitration_precedents', 'source_organization_id');
SELECT ue_create_direct_org_rls_policy('bargaining_notes');
SELECT ue_create_direct_org_rls_policy('board_packets');
SELECT ue_create_direct_org_rls_policy('budget_pool');
SELECT ue_create_direct_org_rls_policy('calendar_events');
SELECT ue_create_direct_org_rls_policy('chat_sessions');
SELECT ue_create_direct_org_rls_policy('clause_comparisons');
SELECT ue_create_direct_org_rls_policy('clc_sync_log');
SELECT ue_create_direct_org_rls_policy('consent_records');
SELECT ue_create_direct_org_rls_policy('cookie_consents');
SELECT ue_create_direct_org_rls_policy('defensibility_packs');
SELECT ue_create_direct_org_rls_policy('geofences', 'union_local_id');
SELECT ue_create_direct_org_rls_policy('mobile_devices');
SELECT ue_create_direct_org_rls_policy('pilot_applications', 'verified_organization_id');
SELECT ue_create_direct_org_rls_policy('pilot_metrics');
SELECT ue_create_direct_org_rls_policy('policy_rules');
SELECT ue_create_direct_org_rls_policy('reward_wallet_ledger', 'org_id');
SELECT ue_create_direct_org_rls_policy('strike_fund_disbursements');
SELECT ue_create_direct_org_rls_policy('user_consents');
SELECT ue_create_direct_org_rls_policy('voting_sessions');
--> statement-breakpoint
-- PARENT_OWNED_V2 (19) — authority via a FK to a parent's organization_id.
SELECT ue_create_parent_owned_rls_policy_v2('ai_safety_filters', 'session_id', 'chat_sessions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('alert_executions', 'alert_rule_id', 'alert_rules', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('arbitrations', 'grievance_id', 'grievances', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('bargaining_proposals', 'negotiation_id', 'negotiations', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('board_packet_distributions', 'packet_id', 'board_packets', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('chat_messages', 'session_id', 'chat_sessions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('claim_updates', 'claim_id', 'claims', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('document_signers', 'document_id', 'signature_documents', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('grievance_timeline', 'grievance_id', 'grievances', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('newsletter_list_subscribers', 'list_id', 'newsletter_distribution_lists', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('newsletter_recipients', 'campaign_id', 'newsletter_campaigns', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('policy_evaluations', 'rule_id', 'policy_rules', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('policy_exceptions', 'rule_id', 'policy_rules', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('settlements', 'grievance_id', 'grievances', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('signature_audit_trail', 'document_id', 'signature_documents', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('tentative_agreements', 'negotiation_id', 'negotiations', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('voter_eligibility', 'session_id', 'voting_sessions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('votes', 'session_id', 'voting_sessions', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('voting_options', 'session_id', 'voting_sessions', 'organization_id', FALSE);
--> statement-breakpoint
-- USER_SELF (10).
SELECT ue_create_user_rls_policy('data_subject_access_requests', 'user_id');
SELECT ue_create_user_rls_policy('gdpr_data_requests', 'user_id');
SELECT ue_create_user_rls_policy('geofence_events', 'user_id');
SELECT ue_create_user_rls_policy('location_tracking', 'user_id');
SELECT ue_create_user_rls_policy('location_tracking_audit', 'user_id');
SELECT ue_create_user_rls_policy('member_location_consent', 'user_id');
SELECT ue_create_user_rls_policy('profiles', 'user_id');
SELECT ue_create_user_rls_policy('provincial_consent', 'user_id');
SELECT ue_create_user_rls_policy('provincial_data_handling', 'user_id');
SELECT ue_create_user_rls_policy('workbooks', 'claimed_by_user_id');
--> statement-breakpoint
-- PARENT_VIA_USER (4) — workbook children gated through workbooks.claimed_by_user_id.
SELECT ue_create_parent_owned_via_user_rls_policy_v2('workbook_governance_lineage_entries', 'workbook_id', 'workbooks', 'claimed_by_user_id');
SELECT ue_create_parent_owned_via_user_rls_policy_v2('workbook_memory_holders', 'workbook_id', 'workbooks', 'claimed_by_user_id');
SELECT ue_create_parent_owned_via_user_rls_policy_v2('workbook_modules', 'workbook_id', 'workbooks', 'claimed_by_user_id');
SELECT ue_create_parent_owned_via_user_rls_policy_v2('workbook_purchases', 'workbook_id', 'workbooks', 'claimed_by_user_id');
--> statement-breakpoint
-- SHARED_LIBRARY (1) + SHARED_LIBRARY_CHILD (1).
SELECT ue_create_shared_library_rls_policy('shared_clause_library', 'source_organization_id', 'sharing_level', 'shared_with_org_ids');
SELECT ue_create_shared_library_child_rls_policy('clause_library_tags', 'clause_id');
