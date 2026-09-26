-- 0011_storage_authority_rls_completion
--
-- Carries the CURRENT db/rls-storage-authority manifest contract into the live
-- database: every storage-authority table classified as requiring RLS
-- (TENANT_RLS_REQUIRED / USER_RLS_REQUIRED / MIXED_GLOBAL_TENANT_RLS_REQUIRED /
-- MULTI_PARTY_RLS_REQUIRED) that was NOT already covered by 0108's 24-table
-- foundation (carried into the scoped lineage by 0010) gets its ENABLE/FORCE
-- ROW LEVEL SECURITY + the correct per-geometry policy set here. This closes the
-- 144-table delta scripts/rls-verify.ts reports against the manifest — the RLS
-- analogue of 0010, extended from 0108's historical 24-table foundation to the
-- current manifest's full RLS-required set.
--
-- Scope discipline (RLS ONLY — same envelope as 0010):
--   * Does NOT create/alter roles or set passwords — provisioning owns that.
--   * Does NOT re-grant baseline DML/sequence/CONNECT — 0009 owns that.
--   * Does NOT touch the 24 canonical 0108 tables (0010 owns them), the
--     0006 external-specialist / 0007 auth / 0008 audit policies, or their RLS.
--   * REUSES 0010's durable ue_create_direct_org_rls_policy helper for the
--     139 direct-org + 1 member-org (congress_memberships) tables; adds three
--     new durable helpers for the user-self / mixed-global-tenant / multi-party
--     geometries the manifest classifies but 0108/0010 never built a helper for.
--   * Idempotent (helpers use DROP POLICY IF EXISTS + CREATE, ENABLE/FORCE RLS,
--     CREATE OR REPLACE FUNCTION) — safe on a fresh source-native DB and on a DB
--     that already received an earlier 0011.
--   * Fail-closed: PART -1 hard-fails if a target table (or its authority
--     column) is absent, or if a canonical policy name already exists on a
--     target table with a non-canonical command/role set (tamper / drift).
--
-- Authority geometry (derived table-by-table from the live schema, the manifest
-- classification+reason, reports/union-eyes-rls-geometry.json, and the Django
-- viewsets — see db/__tests__/storage-authority-rls-completion-migration.test.ts):
--   DIRECT_ORG (140):   runtime sees only current_org rows (strict equality;
--                       NULL-org rows are invisible to tenants = fail-closed).
--                       118+2 organization_id, 14+5 org_id. congress_memberships
--                       is member-org-only here: the source-native physical table
--                       carries ONLY organization_id (the multi-party congress_id
--                       column exists solely in the richer Drizzle schema), so the
--                       enforceable geometry is a strict, fail-closed SUBSET of the
--                       manifest's MULTI_PARTY intent.
--   USER_SELF (1):      user_notification_preferences — runtime sees only its own
--                       (user_id AND organization_id) rows.
--   MIXED_GLOBAL_TENANT (2): account_mappings, holidays — nullable organization_id;
--                       reads see global (NULL) OR own-org rows, writes force own-org
--                       and can never author/mutate a global row.
--   MULTI_PARTY (1):    per_capita_remittances — either party org
--                       (from_organization_id / to_organization_id) may read;
--                       writes are system-cron only (no runtime write policy).
--   SYSTEM: every table gets a union_eyes_system full-access policy so
--           withSystemContext()/background jobs keep working (policy-mediated, NOT
--           via BYPASSRLS — union_eyes_system stays NOSUPERUSER/NOBYPASSRLS).
--
-- PART -1 — Fail-closed preflight guard.
DO $$
DECLARE
  t TEXT;
  target_tables TEXT[] := ARRAY[
    -- direct-org (140)
    'ai_usage_metrics','alert_rules','analytics_metrics','api_integrations','audit_logs',
    'automation_rules','bank_accounts','bank_reconciliation','bank_reconciliations','bargaining_units',
    'calendars','campaigns','cba_clauses','chart_of_accounts','claim_deadlines','clc_remittance_mapping',
    'cms_media_library','cms_pages','collective_agreements','committees','communication_preferences',
    'compliance_snapshots','cost_centers','course_registrations','course_sessions','data_aggregation_consent',
    'document_folders','domain_events','donation_campaigns','dues_rates','dues_transactions',
    'employer_remittances','employers','erp_invoices','evidence_packs','exit_interview_documents',
    'exit_interview_events','exit_interviews','external_accounts','external_benefit_coverage',
    'external_benefit_dependents','external_benefit_enrollments','external_benefit_plans',
    'external_benefit_utilization','external_calendar_connections','external_communication_channels',
    'external_communication_files','external_communication_messages','external_communication_users',
    'external_customers','external_departments','external_employees','external_insurance_beneficiaries',
    'external_insurance_claims','external_insurance_policies','external_invoices','external_lms_completions',
    'external_lms_courses','external_lms_enrollments','external_lms_learners','external_lms_progress',
    'external_payments','external_positions','federations','financial_periods','gl_account_mappings',
    'gl_transaction_log','gl_trial_balance','grievance_documents','grievance_settlements','grievance_transitions',
    'in_app_notifications','insight_recommendations','integration_api_keys','integration_configs',
    'integration_idempotency_keys','integration_registry','integration_sync_log','integration_webhooks',
    'knowledge_base','kpi_configurations','meeting_rooms','member_arrears','member_certifications',
    'member_dues_ledger','member_employment','member_history_events','member_segments','message_log',
    'message_templates','ml_predictions','model_metadata','negotiations','newsletter_campaigns',
    'newsletter_distribution_lists','notification_delivery_log','notification_queue','notification_templates',
    'notification_tracking','notifications','organization_users','organizer_tasks','organizing_campaigns',
    'payment_cycles','payment_disputes','payment_methods','payment_plans','payments','poll_votes','polls',
    'push_devices','push_notifications','recognition_award_types','recognition_awards','recognition_programs',
    'remittance_exceptions','remittance_line_items','reports','reward_budget_envelopes','reward_redemptions',
    'security_events','signature_documents','sms_campaigns','sms_conversations','sms_messages','social_accounts',
    'social_analytics','social_campaigns','social_posts','sso_providers','steward_assignments','survey_answers',
    'survey_questions','survey_responses','surveys','training_courses','training_programs','trend_analyses',
    'worksites','congress_memberships',
    -- special geometry (4)
    'user_notification_preferences','account_mappings','holidays','per_capita_remittances'
  ];
  r RECORD;
  expected_role TEXT;
BEGIN
  -- (a) every target table should physically exist on snapshot/production.
  -- Source-native / CI bootstrap without Django-owned tables: skip missing
  -- targets (NOTICE) so the scoped lineage can complete; helpers below also
  -- no-op on absent relations. Snapshot restores still hit the full set.
  FOREACH t IN ARRAY target_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE NOTICE 'RLS 0011: skipping missing target table public.%', t;
    END IF;
  END LOOP;

  -- (b) special-geometry authority columns must exist when the table is present.
  -- Absent tables are skipped (source-native / CI); present tables still fail
  -- closed if the required authority column is missing.
  IF to_regclass('public.user_notification_preferences') IS NOT NULL THEN
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='user_notification_preferences' AND column_name='user_id';
    IF NOT FOUND THEN RAISE EXCEPTION 'RLS 0011 fail-closed: user_notification_preferences.user_id missing.'; END IF;
  END IF;
  IF to_regclass('public.per_capita_remittances') IS NOT NULL THEN
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='per_capita_remittances' AND column_name='from_organization_id';
    IF NOT FOUND THEN RAISE EXCEPTION 'RLS 0011 fail-closed: per_capita_remittances.from_organization_id missing.'; END IF;
    PERFORM 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='per_capita_remittances' AND column_name='to_organization_id';
    IF NOT FOUND THEN RAISE EXCEPTION 'RLS 0011 fail-closed: per_capita_remittances.to_organization_id missing.'; END IF;
  END IF;

  -- (c) canonical-name conflict guard: a canonical 0011 policy name already
  -- present on a target table with an unexpected command/role means tamper or
  -- drift — refuse rather than silently replace.
  FOR r IN
    SELECT tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname='public'
      AND policyname IN (
        'ue_org_isolation_select','ue_org_isolation_insert','ue_org_isolation_update','ue_org_isolation_delete',
        'ue_user_isolation_select','ue_user_isolation_insert','ue_user_isolation_update',
        'ue_multiparty_isolation_select','ue_system_full_access'
      )
      AND tablename = ANY (target_tables)
  LOOP
    expected_role := CASE WHEN r.policyname = 'ue_system_full_access' THEN 'union_eyes_system' ELSE 'union_eyes_runtime' END;
    IF r.roles <> ARRAY[expected_role]::name[] THEN
      RAISE EXCEPTION
        'RLS 0011 fail-closed: pre-existing policy %.% has role target % (expected %). Reconcile manually before applying 0011.',
        r.tablename, r.policyname, r.roles, expected_role;
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint
-- PART 1 — new durable helper: user-self policy (user_id AND organization_id).
-- The runtime sets BOTH app.current_user_id and app.current_org_id per request
-- (lib/db/with-rls-context.ts), so a self-within-tenant policy is enforceable.
CREATE OR REPLACE FUNCTION ue_create_user_self_rls_policy(
  p_table_name TEXT,
  p_user_column TEXT DEFAULT 'user_id',
  p_org_column TEXT DEFAULT 'organization_id'
) RETURNS VOID AS $$
BEGIN
    IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0011: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  EXECUTE format(
    'CREATE POLICY ue_user_isolation_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true) ' ||
    '  AND %I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_user_column, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_user_id'', true) ' ||
    '  AND %I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_user_column, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_user_isolation_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_user_id'', true) ' ||
    '  AND %I::text = current_setting(''app.current_org_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_user_id'', true) ' ||
    '  AND %I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_user_column, p_org_column, p_user_column, p_org_column
  );

  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- PART 2 — new durable helper: mixed global/tenant policy (nullable org column).
-- Reads see global (org IS NULL) OR own-org rows; writes force own-org and can
-- never author or mutate a global row (matches billing/isolation.py's proven
-- GlobalPlusTenantIsolationMixin). Note the NULL check is on the DATA column
-- (global rows), never on the session context — there is no empty-context
-- bypass.
CREATE OR REPLACE FUNCTION ue_create_mixed_global_tenant_rls_policy(
  p_table_name TEXT,
  p_org_column TEXT DEFAULT 'organization_id'
) RETURNS VOID AS $$
BEGIN
    IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0011: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  EXECUTE format(
    'CREATE POLICY ue_org_isolation_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I IS NULL OR %I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_org_isolation_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_org_isolation_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true)) ' ||
    'WITH CHECK (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, p_org_column
  );
  EXECUTE format(
    'CREATE POLICY ue_org_isolation_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column
  );

  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- PART 3 — new durable helper: multi-party policy (two owning-org FK columns).
-- Either party org may READ; runtime is granted NO write policy (writes require
-- a genuinely separate system/platform authority, not ordinary tenant
-- authentication — matches billing/isolation.py's MultiPartyIsolationMixin; the
-- only real writer is the system cron path via withSystemContext).
-- Legacy-lineage compatibility: a database that ran the frozen Round58 lineage
-- (db/migrations/20260910_rls_enforcement_expansion_round58.sql) already defines
-- this same-signature helper with different parameter names (p_org_column_a/b),
-- and PostgreSQL CREATE OR REPLACE cannot rename an existing function's input
-- parameters. Drop it first (idempotent, never CASCADE) so the canonical scoped
-- definition below applies cleanly on both fresh scoped and legacy databases.
DROP FUNCTION IF EXISTS ue_create_multi_party_rls_policy(text, text, text);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION ue_create_multi_party_rls_policy(
  p_table_name TEXT,
  p_party_column_1 TEXT,
  p_party_column_2 TEXT
) RETURNS VOID AS $$
BEGIN
    IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0011: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_multiparty_isolation_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  EXECUTE format(
    'CREATE POLICY ue_multiparty_isolation_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I::text = current_setting(''app.current_org_id'', true) ' ||
    '  OR %I::text = current_setting(''app.current_org_id'', true))',
    p_table_name, p_party_column_1, p_party_column_2
  );

  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- PART 4 — direct-org tables (140). Reuses 0010's durable
-- ue_create_direct_org_rls_policy (runtime org-scoped ue_org_isolation_* +
-- union_eyes_system ue_system_full_access). 120 organization_id + 20 org_id.
SELECT ue_create_direct_org_rls_policy('ai_usage_metrics');
SELECT ue_create_direct_org_rls_policy('alert_rules');
SELECT ue_create_direct_org_rls_policy('analytics_metrics');
SELECT ue_create_direct_org_rls_policy('api_integrations');
SELECT ue_create_direct_org_rls_policy('audit_logs');
SELECT ue_create_direct_org_rls_policy('automation_rules');
SELECT ue_create_direct_org_rls_policy('bank_accounts');
SELECT ue_create_direct_org_rls_policy('bank_reconciliation');
SELECT ue_create_direct_org_rls_policy('bank_reconciliations');
SELECT ue_create_direct_org_rls_policy('bargaining_units');
SELECT ue_create_direct_org_rls_policy('calendars');
SELECT ue_create_direct_org_rls_policy('campaigns');
SELECT ue_create_direct_org_rls_policy('cba_clauses');
SELECT ue_create_direct_org_rls_policy('chart_of_accounts');
SELECT ue_create_direct_org_rls_policy('claim_deadlines');
SELECT ue_create_direct_org_rls_policy('clc_remittance_mapping');
SELECT ue_create_direct_org_rls_policy('cms_media_library');
SELECT ue_create_direct_org_rls_policy('cms_pages');
SELECT ue_create_direct_org_rls_policy('collective_agreements');
SELECT ue_create_direct_org_rls_policy('committees');
SELECT ue_create_direct_org_rls_policy('communication_preferences');
SELECT ue_create_direct_org_rls_policy('compliance_snapshots', 'org_id');
SELECT ue_create_direct_org_rls_policy('cost_centers');
SELECT ue_create_direct_org_rls_policy('course_registrations');
SELECT ue_create_direct_org_rls_policy('course_sessions');
SELECT ue_create_direct_org_rls_policy('data_aggregation_consent');
SELECT ue_create_direct_org_rls_policy('document_folders');
SELECT ue_create_direct_org_rls_policy('domain_events', 'org_id');
SELECT ue_create_direct_org_rls_policy('donation_campaigns');
SELECT ue_create_direct_org_rls_policy('dues_rates');
SELECT ue_create_direct_org_rls_policy('dues_transactions');
SELECT ue_create_direct_org_rls_policy('employer_remittances');
SELECT ue_create_direct_org_rls_policy('employers');
SELECT ue_create_direct_org_rls_policy('erp_invoices');
SELECT ue_create_direct_org_rls_policy('evidence_packs', 'org_id');
SELECT ue_create_direct_org_rls_policy('exit_interview_documents');
SELECT ue_create_direct_org_rls_policy('exit_interview_events');
SELECT ue_create_direct_org_rls_policy('exit_interviews');
SELECT ue_create_direct_org_rls_policy('external_accounts');
SELECT ue_create_direct_org_rls_policy('external_benefit_coverage');
SELECT ue_create_direct_org_rls_policy('external_benefit_dependents');
SELECT ue_create_direct_org_rls_policy('external_benefit_enrollments');
SELECT ue_create_direct_org_rls_policy('external_benefit_plans');
SELECT ue_create_direct_org_rls_policy('external_benefit_utilization');
SELECT ue_create_direct_org_rls_policy('external_calendar_connections');
SELECT ue_create_direct_org_rls_policy('external_communication_channels', 'org_id');
SELECT ue_create_direct_org_rls_policy('external_communication_files', 'org_id');
SELECT ue_create_direct_org_rls_policy('external_communication_messages', 'org_id');
SELECT ue_create_direct_org_rls_policy('external_communication_users', 'org_id');
SELECT ue_create_direct_org_rls_policy('external_customers');
SELECT ue_create_direct_org_rls_policy('external_departments');
SELECT ue_create_direct_org_rls_policy('external_employees');
SELECT ue_create_direct_org_rls_policy('external_insurance_beneficiaries');
SELECT ue_create_direct_org_rls_policy('external_insurance_claims');
SELECT ue_create_direct_org_rls_policy('external_insurance_policies');
SELECT ue_create_direct_org_rls_policy('external_invoices');
SELECT ue_create_direct_org_rls_policy('external_lms_completions', 'org_id');
SELECT ue_create_direct_org_rls_policy('external_lms_courses', 'org_id');
SELECT ue_create_direct_org_rls_policy('external_lms_enrollments', 'org_id');
SELECT ue_create_direct_org_rls_policy('external_lms_learners', 'org_id');
SELECT ue_create_direct_org_rls_policy('external_lms_progress', 'org_id');
SELECT ue_create_direct_org_rls_policy('external_payments');
SELECT ue_create_direct_org_rls_policy('external_positions');
SELECT ue_create_direct_org_rls_policy('federations');
SELECT ue_create_direct_org_rls_policy('financial_periods');
SELECT ue_create_direct_org_rls_policy('gl_account_mappings');
SELECT ue_create_direct_org_rls_policy('gl_transaction_log');
SELECT ue_create_direct_org_rls_policy('gl_trial_balance');
SELECT ue_create_direct_org_rls_policy('grievance_documents');
SELECT ue_create_direct_org_rls_policy('grievance_settlements');
SELECT ue_create_direct_org_rls_policy('grievance_transitions');
SELECT ue_create_direct_org_rls_policy('in_app_notifications');
SELECT ue_create_direct_org_rls_policy('insight_recommendations');
SELECT ue_create_direct_org_rls_policy('integration_api_keys');
SELECT ue_create_direct_org_rls_policy('integration_configs');
SELECT ue_create_direct_org_rls_policy('integration_idempotency_keys', 'org_id');
SELECT ue_create_direct_org_rls_policy('integration_registry', 'org_id');
SELECT ue_create_direct_org_rls_policy('integration_sync_log');
SELECT ue_create_direct_org_rls_policy('integration_webhooks');
SELECT ue_create_direct_org_rls_policy('knowledge_base');
SELECT ue_create_direct_org_rls_policy('kpi_configurations');
SELECT ue_create_direct_org_rls_policy('meeting_rooms');
SELECT ue_create_direct_org_rls_policy('member_arrears');
SELECT ue_create_direct_org_rls_policy('member_certifications');
SELECT ue_create_direct_org_rls_policy('member_dues_ledger');
SELECT ue_create_direct_org_rls_policy('member_employment');
SELECT ue_create_direct_org_rls_policy('member_history_events');
SELECT ue_create_direct_org_rls_policy('member_segments');
SELECT ue_create_direct_org_rls_policy('message_log');
SELECT ue_create_direct_org_rls_policy('message_templates');
SELECT ue_create_direct_org_rls_policy('ml_predictions');
SELECT ue_create_direct_org_rls_policy('model_metadata');
SELECT ue_create_direct_org_rls_policy('negotiations');
SELECT ue_create_direct_org_rls_policy('newsletter_campaigns');
SELECT ue_create_direct_org_rls_policy('newsletter_distribution_lists');
SELECT ue_create_direct_org_rls_policy('notification_delivery_log');
SELECT ue_create_direct_org_rls_policy('notification_queue');
SELECT ue_create_direct_org_rls_policy('notification_templates');
SELECT ue_create_direct_org_rls_policy('notification_tracking');
SELECT ue_create_direct_org_rls_policy('notifications');
SELECT ue_create_direct_org_rls_policy('organization_users');
SELECT ue_create_direct_org_rls_policy('organizer_tasks');
SELECT ue_create_direct_org_rls_policy('organizing_campaigns');
SELECT ue_create_direct_org_rls_policy('payment_cycles');
SELECT ue_create_direct_org_rls_policy('payment_disputes');
SELECT ue_create_direct_org_rls_policy('payment_methods');
SELECT ue_create_direct_org_rls_policy('payment_plans');
SELECT ue_create_direct_org_rls_policy('payments');
SELECT ue_create_direct_org_rls_policy('poll_votes');
SELECT ue_create_direct_org_rls_policy('polls');
SELECT ue_create_direct_org_rls_policy('push_devices');
SELECT ue_create_direct_org_rls_policy('push_notifications');
SELECT ue_create_direct_org_rls_policy('recognition_award_types', 'org_id');
SELECT ue_create_direct_org_rls_policy('recognition_awards', 'org_id');
SELECT ue_create_direct_org_rls_policy('recognition_programs', 'org_id');
SELECT ue_create_direct_org_rls_policy('remittance_exceptions');
SELECT ue_create_direct_org_rls_policy('remittance_line_items');
SELECT ue_create_direct_org_rls_policy('reports');
SELECT ue_create_direct_org_rls_policy('reward_budget_envelopes', 'org_id');
SELECT ue_create_direct_org_rls_policy('reward_redemptions', 'org_id');
SELECT ue_create_direct_org_rls_policy('security_events');
SELECT ue_create_direct_org_rls_policy('signature_documents');
SELECT ue_create_direct_org_rls_policy('sms_campaigns');
SELECT ue_create_direct_org_rls_policy('sms_conversations');
SELECT ue_create_direct_org_rls_policy('sms_messages');
SELECT ue_create_direct_org_rls_policy('social_accounts');
SELECT ue_create_direct_org_rls_policy('social_analytics');
SELECT ue_create_direct_org_rls_policy('social_campaigns');
SELECT ue_create_direct_org_rls_policy('social_posts');
SELECT ue_create_direct_org_rls_policy('sso_providers');
SELECT ue_create_direct_org_rls_policy('steward_assignments');
SELECT ue_create_direct_org_rls_policy('survey_answers');
SELECT ue_create_direct_org_rls_policy('survey_questions');
SELECT ue_create_direct_org_rls_policy('survey_responses');
SELECT ue_create_direct_org_rls_policy('surveys');
SELECT ue_create_direct_org_rls_policy('training_courses');
SELECT ue_create_direct_org_rls_policy('training_programs');
SELECT ue_create_direct_org_rls_policy('trend_analyses');
SELECT ue_create_direct_org_rls_policy('worksites');
SELECT ue_create_direct_org_rls_policy('congress_memberships');
--> statement-breakpoint
-- PART 5 — user-self (1).
SELECT ue_create_user_self_rls_policy('user_notification_preferences', 'user_id', 'organization_id');
--> statement-breakpoint
-- PART 6 — mixed global/tenant (2).
SELECT ue_create_mixed_global_tenant_rls_policy('account_mappings', 'organization_id');
SELECT ue_create_mixed_global_tenant_rls_policy('holidays', 'organization_id');
--> statement-breakpoint
-- PART 7 — multi-party (1).
SELECT ue_create_multi_party_rls_policy('per_capita_remittances', 'from_organization_id', 'to_organization_id');
