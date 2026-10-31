-- Rollback for 0042_tenant_scoped_uniqueness: restores global uniqueness, and refuses (nothing changes) when two organizations
-- already share a code, since the global constraint could not be created. Forward recovery is preferred in that case.
DO $$
DECLARE
  spec text[];
  t text;
  c text;
  dup bigint;
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['collective_agreements', 'cba_number'], ARRAY['training_courses', 'course_code'], ARRAY['course_sessions', 'session_code'],
    ARRAY['member_certifications', 'certification_number'], ARRAY['workplace_incidents', 'incident_number'],
    ARRAY['safety_inspections', 'inspection_number'], ARRAY['hazard_reports', 'report_number'], ARRAY['ppe_equipment', 'item_number'],
    ARRAY['organizing_campaigns', 'campaign_code']
  ] LOOP
    t := spec[1];
    c := spec[2];
    IF to_regclass(format('public.%I', t)) IS NULL THEN CONTINUE; END IF;
    EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I WHERE %I IS NOT NULL GROUP BY %I HAVING count(*) > 1) d', t, c, c) INTO dup;
    IF dup > 0 THEN
      RAISE EXCEPTION 'rollback refused: public.% has % codes shared by more than one organization', t, dup;
    END IF;
    EXECUTE format('DROP INDEX IF EXISTS public.%I', 'uq_' || t || '_org_' || c);
    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (%I)', 'uq_' || t || '_' || c || '_global', t, c);
  END LOOP;
END $$;