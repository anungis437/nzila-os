-- 0016_catalog_rls_authority_closure
--
-- Forward RLS for physical relations that 0014 and 0015 do not own.
-- Direct-org tables reuse ue_create_direct_org_rls_policy from 0010.
-- SYSTEM_ONLY ICRA tables get the reviewed system-policy shape and no
-- runtime policy. This migration does not grant or revoke DML.
-- 0014 and 0015 are not modified.

DO $$
DECLARE
  t text;
  direct_org text[] := ARRAY[
    'bargaining_units',
    'cba_clauses',
    'collective_agreements',
    'committees',
    'cost_centers',
    'employers',
    'strike_fund_disbursements',
    'worksites'
  ];
  system_only text[] := ARRAY[
    'icra_assessment_answers',
    'icra_assessments',
    'icra_continuity_scores',
    'icra_followup_recommendations',
    'icra_governance_flags',
    'icra_maturity_profiles',
    'icra_organizations'
  ];
BEGIN
  FOREACH t IN ARRAY direct_org LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0016 fail-closed: public.% does not exist.', t;
    END IF;
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.columns
      WHERE table_schema = 'public'
        AND table_name = t
        AND column_name = 'organization_id'
        AND udt_name = 'uuid'
        AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION 'RLS 0016 fail-closed: public.% organization_id is not uuid NOT NULL.', t;
    END IF;
  END LOOP;
  FOREACH t IN ARRAY system_only LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      RAISE EXCEPTION 'RLS 0016 fail-closed: public.% does not exist.', t;
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('bargaining_units');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('cba_clauses');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('collective_agreements');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('committees');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('cost_centers');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('employers');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('strike_fund_disbursements');
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('worksites');
--> statement-breakpoint
DO $$
DECLARE
  t text;
  system_only text[] := ARRAY[
    'icra_assessment_answers',
    'icra_assessments',
    'icra_continuity_scores',
    'icra_followup_recommendations',
    'icra_governance_flags',
    'icra_maturity_profiles',
    'icra_organizations'
  ];
BEGIN
  FOREACH t IN ARRAY system_only LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY ue_system_full_access ON public.%I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
--> statement-breakpoint
-- The 0006 policies keep the tighter SELECT (and document INSERT) predicates.
-- Manifest write privileges for these three tables had no write policy, so
-- RLS would deny the representation services. These policies add only the
-- missing commands and use the direct-org predicate. They do not replace
-- the existing SELECT policies.
DROP POLICY IF EXISTS ue_external_authorities_insert ON representation_authorities;
--> statement-breakpoint
CREATE POLICY ue_external_authorities_insert
  ON representation_authorities
  FOR INSERT TO union_eyes_runtime
  WITH CHECK ((organization_id)::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
DROP POLICY IF EXISTS ue_external_authorities_update ON representation_authorities;
--> statement-breakpoint
CREATE POLICY ue_external_authorities_update
  ON representation_authorities
  FOR UPDATE TO union_eyes_runtime
  USING ((organization_id)::text = current_setting('app.current_org_id', true))
  WITH CHECK ((organization_id)::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
DROP POLICY IF EXISTS ue_external_matter_grants_insert ON external_matter_access_grants;
--> statement-breakpoint
CREATE POLICY ue_external_matter_grants_insert
  ON external_matter_access_grants
  FOR INSERT TO union_eyes_runtime
  WITH CHECK ((organization_id)::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
DROP POLICY IF EXISTS ue_external_matter_grants_update ON external_matter_access_grants;
--> statement-breakpoint
CREATE POLICY ue_external_matter_grants_update
  ON external_matter_access_grants
  FOR UPDATE TO union_eyes_runtime
  USING ((organization_id)::text = current_setting('app.current_org_id', true))
  WITH CHECK ((organization_id)::text = current_setting('app.current_org_id', true));
--> statement-breakpoint
DROP POLICY IF EXISTS ue_external_document_grants_update ON external_document_access_grants;
--> statement-breakpoint
CREATE POLICY ue_external_document_grants_update
  ON external_document_access_grants
  FOR UPDATE TO union_eyes_runtime
  USING ((organization_id)::text = current_setting('app.current_org_id', true))
  WITH CHECK ((organization_id)::text = current_setting('app.current_org_id', true));
