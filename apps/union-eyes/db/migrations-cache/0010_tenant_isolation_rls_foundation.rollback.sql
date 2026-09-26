-- 0010_tenant_isolation_rls_foundation — rollback
--
-- CLASSIFICATION: TEST / DEVELOPMENT ROLLBACK ONLY — NOT a normal production
-- recovery path. Executing this DISABLES tenant-isolation RLS on the 24 canonical
-- tables and thereby WEAKENS production security. Do not run against a database
-- with real tenant data as a routine operation.
--
-- Scope: only the objects 0010 owns — the ue_org_isolation_* / ue_parent_org_isolation
-- / ue_system_full_access policies on the 24 canonical tables, FORCE/ENABLE RLS on
-- those tables, and the two durable helper functions. It deliberately does NOT drop:
--   * the later scoped additive policies (0006 ue_external_*, 0007 ue_auth_bootstrap_*,
--     0008 ue_runtime_audit_*) or their tables' RLS
--   * the baseline grants owned by 0009
--   * the union_eyes_runtime / union_eyes_system roles
--   * the member_documents.organization_id column / indexes (data-preserving; a
--     column drop is not a safe rollback and could lose tenant assignments)
DROP FUNCTION IF EXISTS ue_create_direct_org_rls_policy(TEXT, TEXT, BOOLEAN);--> statement-breakpoint
DROP FUNCTION IF EXISTS ue_create_parent_owned_rls_policy(TEXT, TEXT);--> statement-breakpoint
DO $$
DECLARE
  t TEXT;
  tables TEXT[] := ARRAY[
    'organization_members','organizations','grievances','claims','grievance_deadlines',
    'documents','member_documents','workplace_incidents','safety_inspections','hazard_reports',
    'safety_committee_meetings','safety_training_records','ppe_equipment','safety_audits',
    'injury_logs','safety_policies','corrective_actions','safety_certifications',
    'message_threads','messages','message_participants','message_read_receipts',
    'message_notifications','cross_org_access_log'
  ];
BEGIN
  FOREACH t IN ARRAY tables LOOP
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_parent_org_isolation ON %I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', t);
    EXECUTE format('ALTER TABLE %I NO FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE %I DISABLE ROW LEVEL SECURITY', t);
  END LOOP;
END
$$;
