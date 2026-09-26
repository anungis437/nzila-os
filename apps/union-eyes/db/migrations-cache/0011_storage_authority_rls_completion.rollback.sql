-- 0011_storage_authority_rls_completion — rollback
--
-- CLASSIFICATION: TEST / DEVELOPMENT ROLLBACK ONLY — NOT a normal production
-- recovery path. Executing this DISABLES tenant-isolation RLS on the 144
-- storage-authority tables 0011 covers and thereby WEAKENS production security.
-- Do not run against a database with real tenant data as a routine operation.
--
-- Scope: only the objects 0011 owns — the ue_org_isolation_* / ue_user_isolation_*
-- / ue_multiparty_isolation_* / ue_system_full_access policy INSTANCES on the 144
-- tables, FORCE/ENABLE RLS on those tables, and the THREE new durable helper
-- functions 0011 introduced. It deliberately does NOT drop:
--   * 0010's ue_create_direct_org_rls_policy / ue_create_parent_owned_rls_policy
--     helper functions (0010 owns them) or the 24 canonical 0108 tables' RLS
--   * the 0006 ue_external_* / 0007 ue_auth_bootstrap_* / 0008 ue_runtime_audit_*
--     policies or their tables' RLS
--   * the baseline grants owned by 0009
--   * the union_eyes_runtime / union_eyes_system roles
DROP FUNCTION IF EXISTS ue_create_user_self_rls_policy(TEXT, TEXT, TEXT);--> statement-breakpoint
DROP FUNCTION IF EXISTS ue_create_mixed_global_tenant_rls_policy(TEXT, TEXT);--> statement-breakpoint
DROP FUNCTION IF EXISTS ue_create_multi_party_rls_policy(TEXT, TEXT, TEXT);--> statement-breakpoint
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
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
    'user_notification_preferences','account_mappings','holidays','per_capita_remittances'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_insert ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_user_isolation_update ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_multiparty_isolation_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;
