-- 0063_procedural_rules_rls_closure
--
-- Forward RLS for the procedural rule tables (platform 0090). Each is a direct-org tenant table: reuses
-- ue_create_direct_org_rls_policy from 0010, which enables and FORCES row level security and creates the
-- union_eyes_runtime policies. This migration does not grant DML. Exact privileges come from the
-- storage-authority manifest at grant activation.

DO $$
DECLARE
  rel text;
BEGIN
  FOREACH rel IN ARRAY ARRAY['procedural_rule_sources','procedural_rule_sets','procedural_holiday_calendars','procedural_rule_lifecycle_events','grievance_procedure_bindings','grievance_procedural_facts','grievance_procedural_exceptions'] LOOP
    IF to_regclass(format('public.%I', rel)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0063 fail-closed: public.% does not exist.', rel;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = rel AND column_name = 'organization_id' AND udt_name = 'uuid' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'RLS 0063 fail-closed: public.% organization_id is not uuid NOT NULL.', rel;
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_class c JOIN pg_roles r ON r.oid = c.relowner
      WHERE c.oid = format('public.%I', rel)::regclass AND r.rolname IN ('union_eyes_runtime', 'union_eyes_system')
    ) THEN
      RAISE EXCEPTION 'RLS 0063 fail-closed: public.% is owned by a runtime role.', rel;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('procedural_rule_sources');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('procedural_rule_sets');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('procedural_holiday_calendars');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('procedural_rule_lifecycle_events');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('grievance_procedure_bindings');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('grievance_procedural_facts');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('grievance_procedural_exceptions');
