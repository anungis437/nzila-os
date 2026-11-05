-- PLATFORM_SQL 0042_tenant_scoped_uniqueness
--
-- Record numbers and codes that one organization chooses were unique across every organization, so one organization's choice
-- of a number refused another's, and the refusal disclosed that the number was taken elsewhere. Each becomes unique within the
-- organization: the single-column unique constraint (or standalone unique index) on the code is dropped and a unique index on
-- (organization_id, code) takes its place.
--
--   collective_agreements.cba_number          training_courses.course_code        course_sessions.session_code
--   member_certifications.certification_number workplace_incidents.incident_number safety_inspections.inspection_number
--   hazard_reports.report_number              ppe_equipment.item_number           organizing_campaigns.campaign_code
--
-- Fail closed: a table that exists but lacks organization_id or the code column aborts the migration; so does an organization that
-- already holds the same code twice (possible only where no uniqueness was enforced), and nothing is deleted. A constraint that a
-- foreign key depends on cannot be dropped and aborts the transaction. Relations that do not exist are skipped. Idempotent.
-- Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
DECLARE
  spec text[];
  t text;
  c text;
  attno smallint;
  dup bigint;
  con record;
  idx record;
BEGIN
  FOREACH spec SLICE 1 IN ARRAY ARRAY[
    ARRAY['collective_agreements', 'cba_number'],
    ARRAY['training_courses', 'course_code'],
    ARRAY['course_sessions', 'session_code'],
    ARRAY['member_certifications', 'certification_number'],
    ARRAY['workplace_incidents', 'incident_number'],
    ARRAY['safety_inspections', 'inspection_number'],
    ARRAY['hazard_reports', 'report_number'],
    ARRAY['ppe_equipment', 'item_number'],
    ARRAY['organizing_campaigns', 'campaign_code']
  ] LOOP
    t := spec[1];
    c := spec[2];
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = t AND column_name = 'organization_id') THEN
      RAISE EXCEPTION 'tenant uniqueness fail-closed: public.% has no organization_id', t;
    END IF;
    SELECT a.attnum INTO attno FROM pg_attribute a WHERE a.attrelid = format('public.%I', t)::regclass AND a.attname = c AND NOT a.attisdropped;
    IF attno IS NULL THEN
      RAISE EXCEPTION 'tenant uniqueness fail-closed: public.%.% does not exist', t, c;
    END IF;
    EXECUTE format('SELECT count(*) FROM (SELECT 1 FROM public.%I WHERE %I IS NOT NULL GROUP BY organization_id, %I HAVING count(*) > 1) d', t, c, c) INTO dup;
    IF dup > 0 THEN
      RAISE EXCEPTION 'tenant uniqueness fail-closed: public.% holds % duplicate %s within one organization', t, dup, c;
    END IF;

    FOR con IN
      SELECT k.conname FROM pg_constraint k
      WHERE k.conrelid = format('public.%I', t)::regclass AND k.contype = 'u' AND array_length(k.conkey, 1) = 1 AND k.conkey[1] = attno
    LOOP
      EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', t, con.conname);
    END LOOP;

    FOR idx IN
      SELECT i.relname FROM pg_index x JOIN pg_class i ON i.oid = x.indexrelid
      WHERE x.indrelid = format('public.%I', t)::regclass AND x.indisunique AND NOT x.indisprimary
        AND x.indnkeyatts = 1 AND x.indkey[0] = attno AND x.indpred IS NULL AND x.indexprs IS NULL
        AND NOT EXISTS (SELECT 1 FROM pg_constraint k WHERE k.conindid = x.indexrelid)
    LOOP
      EXECUTE format('DROP INDEX public.%I', idx.relname);
    END LOOP;

    EXECUTE format('CREATE UNIQUE INDEX IF NOT EXISTS %I ON public.%I (organization_id, %I)', 'uq_' || t || '_org_' || c, t, c);
  END LOOP;
END $$;