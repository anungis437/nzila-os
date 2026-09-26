-- 0014_lineage_restoration_rls_closure
--
-- Closes RLS for the 100 physically-present, manifest-RLS-required tables that
-- the clean-room lineage restoration materialized (platform 0001-0004 + historical
-- SCHEMA_CREATION) but that 0010/0011/0012 never owned. Classification:
--   * 80 DIRECT_ORG via organization_id (ue_create_direct_org_rls_policy)
--   * 4 DIRECT_ORG via org_id
--   * 16 PARENT_OWNED via ue_create_parent_owned_rls_policy_v2
--   * 0 platform-global exemptions (all 100 are TENANT_RLS_REQUIRED / REQUIRED
--     in the runtime-schema authority oracle; none are GLOBAL_REFERENCE_DATA)
--
-- Scope discipline (RLS ONLY - same envelope as 0010/0011/0012):
--   * Does NOT create/alter roles or passwords; does NOT re-grant baseline DML
--     (0009 already granted ALL TABLES before this migration in clean-room order).
--   * REUSES helpers from 0010/0011/0012 (no new policy geometry invented).
--   * Idempotent DROP POLICY IF EXISTS + ENABLE/FORCE via helpers.
--   * Fail-closed if a target/parent table is absent.

-- PART -1 - Fail-closed preflight guard.
DO $$
DECLARE
  t TEXT;
  target_tables TEXT[] := ARRAY[
    'ai_clause_reasonings','ai_copilot_sessions','ai_grievance_triages','ai_insight_reports','allocation_basis_snapshots',
    'allocation_rule_versions','allocation_rules','allocation_run_lines','allocation_runs','billing_accounts',
    'billing_periods','billing_subscriptions','break_policies','case_documents','cba_rule_set_items',
    'cba_rule_versions','chargeback_statements','clause_embeddings','commercial_contracts','committee_action_items',
    'committee_documents','committee_intelligence_snapshots','committee_meeting_attendees','committee_meetings','compliance_alerts',
    'contract_covered_orgs','contract_line_items','correspondence','correspondence_audit_trail','correspondence_recipients',
    'data_quality_warnings','deadline_audit_events','deadline_reminders','dispatch_assignments','dispatch_requests',
    'dispatch_rules','document_access_grants','document_links','document_versions','dues_assignments',
    'duplicate_group_members','duplicate_groups','employer_communications','employer_contacts','employer_execution_artifacts',
    'employer_execution_compliance_events','employer_execution_evidence_links','employer_execution_profiles','employer_execution_replays','employer_payroll_run_items',
    'employer_payroll_runs','employer_remittance_run_items','employer_remittance_runs','employer_reports','employer_risk_scores',
    'employer_timesheet_batches','employer_timesheet_entries','entitlement_usage_log','fee_adjustments','governance_policies',
    'grievance_case_access_assignments','grievance_events','grievance_timeline_events','ingestion_batches','ingestion_records',
    'integration_partners','member_breaks','member_jurisdiction_preferences','org_configurations','org_entitlements',
    'org_subscriptions','payment_allocations','pension_benefit_claims','pension_contributions','pension_members',
    'pension_plans','pension_t4a_records','pension_trustee_meetings','pension_trustees','pilot_checklist_items',
    'pilot_demo_seeds','pilot_enrollments','pilot_events','pilot_feedback','pilot_milestones',
    'platform_cost_ledger_entries','platform_invoice_line_items','platform_invoices','platform_payments','reconciliation_exceptions',
    'reconciliation_matches','reconciliation_runs','satisfaction_surveys','security_posture_checks','stewards',
    'strategic_goals','subscription_events_log','transaction_fee_events','transaction_fee_rules','user_signatures'
  ];
  parent_tables TEXT[] := ARRAY['allocation_rules','allocation_runs','cba_clauses','commercial_contracts','committee_meetings','correspondence','dispatch_requests','duplicate_groups','employers','grievances','ingestion_batches','platform_invoices','platform_payments','reconciliation_runs'];
BEGIN
  FOREACH t IN ARRAY target_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0014 fail-closed: target table public.% does not exist.', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY parent_tables LOOP
    IF to_regclass('public.' || quote_ident(t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0014 fail-closed: parent table public.% does not exist.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint

-- PART A - Direct-org (organization_id)
SELECT ue_create_direct_org_rls_policy('ai_clause_reasonings');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ai_copilot_sessions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ai_grievance_triages');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ai_insight_reports');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('allocation_rules');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('allocation_runs');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('billing_accounts');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('billing_periods');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('billing_subscriptions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('break_policies');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('case_documents');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('cba_rule_set_items');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('cba_rule_versions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('chargeback_statements');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('commercial_contracts');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('committee_action_items');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('committee_documents');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('committee_intelligence_snapshots');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('committee_meetings');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('contract_covered_orgs');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('correspondence');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('data_quality_warnings');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('deadline_audit_events');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('deadline_reminders');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('document_access_grants');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('document_links');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('document_versions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('dues_assignments');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('duplicate_groups');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_communications');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_contacts');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_execution_artifacts');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_execution_compliance_events');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_execution_evidence_links');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_execution_profiles');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_execution_replays');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_payroll_run_items');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_payroll_runs');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_remittance_run_items');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_remittance_runs');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_risk_scores');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_timesheet_batches');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employer_timesheet_entries');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('entitlement_usage_log');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('fee_adjustments');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('governance_policies');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('grievance_case_access_assignments');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('grievance_timeline_events');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('ingestion_batches');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('integration_partners');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('member_breaks');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('member_jurisdiction_preferences');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('org_configurations');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('org_entitlements');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('org_subscriptions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pension_benefit_claims');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pension_contributions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pension_members');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pension_plans');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pension_t4a_records');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pension_trustee_meetings');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pension_trustees');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pilot_checklist_items');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pilot_demo_seeds');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pilot_enrollments');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pilot_events');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pilot_feedback');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('pilot_milestones');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('platform_cost_ledger_entries');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('platform_invoices');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('platform_payments');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('reconciliation_exceptions');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('reconciliation_runs');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('satisfaction_surveys');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('security_posture_checks');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('strategic_goals');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('subscription_events_log');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('transaction_fee_events');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('transaction_fee_rules');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('user_signatures');
--> statement-breakpoint

-- PART B - Direct-org (org_id)
SELECT ue_create_direct_org_rls_policy('compliance_alerts', 'org_id');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('dispatch_requests', 'org_id');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('dispatch_rules', 'org_id');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('stewards', 'org_id');
--> statement-breakpoint

-- PART C - Parent-owned
SELECT ue_create_parent_owned_rls_policy_v2('allocation_basis_snapshots', 'run_id', 'allocation_runs', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('allocation_rule_versions', 'rule_id', 'allocation_rules', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('allocation_run_lines', 'run_id', 'allocation_runs', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('committee_meeting_attendees', 'meeting_id', 'committee_meetings', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('contract_line_items', 'contract_id', 'commercial_contracts', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('correspondence_audit_trail', 'correspondence_id', 'correspondence', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('correspondence_recipients', 'correspondence_id', 'correspondence', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('dispatch_assignments', 'request_id', 'dispatch_requests', 'org_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('reconciliation_matches', 'run_id', 'reconciliation_runs', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('clause_embeddings', 'clause_id', 'cba_clauses', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('duplicate_group_members', 'group_id', 'duplicate_groups', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('employer_reports', 'employer_id', 'employers', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('grievance_events', 'grievance_id', 'grievances', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('ingestion_records', 'batch_id', 'ingestion_batches', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('payment_allocations', 'payment_id', 'platform_payments', 'organization_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('platform_invoice_line_items', 'invoice_id', 'platform_invoices', 'organization_id');
--> statement-breakpoint
