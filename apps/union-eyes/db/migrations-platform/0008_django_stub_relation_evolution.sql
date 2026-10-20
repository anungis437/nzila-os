-- PLATFORM_SQL — empty Django stub relations that occupy Drizzle names.
--
-- Staging snapshot employers matched one of the 33 columns required by
-- 0009_canonical_lineage_relations. The creation lineage for that table, and
-- for worksites, bargaining_units, committees, collective_agreements,
-- cba_clauses, and cost_centers, is the Django initial migration: id,
-- created_at, updated_at, and nullable organization_id. collective_agreements
-- also has nullable cba_number varchar(255).
--
-- This statement runs before 0009. It does not edit 0009. A missing relation
-- is left for 0009 to create. An already canonical relation is left in place
-- and only gains a missing foreign key. An empty recognized stub is widened
-- to the canonical columns. A populated stub, or any unrecognized shape,
-- raises and leaves the rows unchanged.

--> statement-breakpoint
DO $ue$
DECLARE
  spec record;
  actual text[];
BEGIN
  FOR spec IN SELECT * FROM (VALUES
    ('employer_type', ARRAY['private', 'public', 'non_profit', 'crown_corporation', 'municipal', 'provincial', 'federal', 'educational', 'healthcare']::text[]),
    ('employer_status', ARRAY['active', 'inactive', 'contract_expired', 'in_bargaining', 'dispute', 'archived']::text[]),
    ('worksite_status', ARRAY['active', 'temporarily_closed', 'permanently_closed', 'seasonal', 'archived']::text[]),
    ('unit_type', ARRAY['full_time', 'part_time', 'casual', 'mixed', 'craft', 'industrial', 'professional']::text[]),
    ('unit_status', ARRAY['active', 'under_certification', 'decertified', 'merged', 'inactive', 'archived']::text[]),
    ('committee_type', ARRAY['bargaining', 'grievance', 'health_safety', 'political_action', 'equity', 'education', 'organizing', 'steward', 'executive', 'finance', 'communications', 'social', 'pension_benefits', 'other']::text[]),
    ('cba_jurisdiction', ARRAY['federal', 'ontario', 'bc', 'alberta', 'quebec', 'manitoba', 'saskatchewan', 'nova_scotia', 'new_brunswick', 'pei', 'newfoundland', 'northwest_territories', 'yukon', 'nunavut']::text[]),
    ('cba_language', ARRAY['en', 'fr', 'bilingual']::text[]),
    ('cba_status', ARRAY['active', 'expired', 'under_negotiation', 'ratified_pending', 'archived']::text[]),
    ('clause_type', ARRAY['wages_compensation', 'benefits_insurance', 'working_conditions', 'grievance_arbitration', 'seniority_promotion', 'health_safety', 'union_rights', 'management_rights', 'duration_renewal', 'vacation_leave', 'hours_scheduling', 'disciplinary_procedures', 'training_development', 'pension_retirement', 'overtime', 'job_security', 'technological_change', 'workplace_rights', 'other']::text[]),
    ('cost_center_type', ARRAY['department', 'project', 'location', 'program', 'fund', 'grant', 'other']::text[])
  ) AS t(typname, labels)
  LOOP
    BEGIN
      EXECUTE format(
        'CREATE TYPE public.%I AS ENUM (%s)',
        spec.typname,
        (SELECT string_agg(quote_literal(label), ', ') FROM unnest(spec.labels) AS label)
      );
    EXCEPTION WHEN duplicate_object THEN
      SELECT COALESCE(array_agg(e.enumlabel::text ORDER BY e.enumsortorder), ARRAY[]::text[])
        INTO actual
      FROM pg_type t
      JOIN pg_namespace n ON n.oid = t.typnamespace
      JOIN pg_enum e ON e.enumtypid = t.oid
      WHERE n.nspname = 'public' AND t.typname = spec.typname;
      IF actual IS DISTINCT FROM spec.labels THEN
        RAISE EXCEPTION 'incompatible existing type public.%', spec.typname;
      END IF;
    END;
  END LOOP;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  existing text[];
  row_count bigint;
  match_count integer;
  created_at_shape text;
  updated_at_shape text;
  organization_shape text;
BEGIN
  IF to_regclass('public.employers') IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname), ARRAY[]::text[])
    INTO existing
  FROM pg_attribute a
  WHERE a.attrelid = 'public.employers'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF existing @> ARRAY['archived_at', 'business_number', 'created_at', 'created_by', 'custom_fields', 'dba_name', 'email', 'employer_type', 'established_date', 'federal_corporation_number', 'id', 'industry_code', 'labour_relations_contact_email', 'labour_relations_contact_name', 'labour_relations_contact_phone', 'legal_name', 'main_address', 'name', 'notes', 'organization_id', 'parent_company_id', 'phone', 'primary_contact_email', 'primary_contact_name', 'primary_contact_phone', 'primary_contact_title', 'provincial_corporation_number', 'status', 'total_employees', 'unionized_employees', 'updated_at', 'updated_by', 'website']::text[] THEN
    SELECT count(*) INTO match_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'employers'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'legal_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'dba_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'employer_type' AND data_type = 'USER-DEFINED' AND udt_name = 'employer_type' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'employer_status' AND is_nullable = 'NO')
        OR (column_name = 'business_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'federal_corporation_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'provincial_corporation_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'industry_code' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 20)
        OR (column_name = 'email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'phone' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'website' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 500)
        OR (column_name = 'main_address' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'total_employees' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'unionized_employees' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'established_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'primary_contact_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'primary_contact_title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'primary_contact_email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'primary_contact_phone' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'labour_relations_contact_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'labour_relations_contact_email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'labour_relations_contact_phone' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'parent_company_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'custom_fields' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'archived_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF match_count IS DISTINCT FROM 33 THEN
      RAISE EXCEPTION 'incompatible existing relation public.employers: canonical names are present but 33 column contracts are not satisfied (found %). Rows were not rewritten.', match_count;
    END IF;
    RETURN;
  END IF;
  IF existing IS DISTINCT FROM ARRAY['created_at', 'id', 'organization_id', 'updated_at']::text[] THEN
    RAISE EXCEPTION 'incompatible existing relation public.employers: unrecognized historical columns (%). Rows were not rewritten.', existing;
  END IF;
  SELECT udt_name || ':' || is_nullable INTO organization_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'employers' AND column_name = 'organization_id';
  IF organization_shape IS DISTINCT FROM 'uuid:YES' AND organization_shape IS DISTINCT FROM 'uuid:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.employers: organization_id is not uuid. Rows were not rewritten.';
  END IF;
  SELECT udt_name || ':' || is_nullable INTO created_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'employers' AND column_name = 'created_at';
  SELECT udt_name || ':' || is_nullable INTO updated_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'employers' AND column_name = 'updated_at';
  IF created_at_shape IS DISTINCT FROM 'timestamptz:NO' OR updated_at_shape IS DISTINCT FROM 'timestamptz:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.employers: timestamps are not timestamptz NOT NULL. Rows were not rewritten.';
  END IF;
  SELECT count(*) INTO row_count FROM public.employers;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'incompatible existing relation public.employers: % populated row(s) cannot gain canonical NOT NULL columns without a rewrite. Rows were not rewritten.', row_count;
  END IF;
  ALTER TABLE public.employers ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE public.employers ALTER COLUMN created_at DROP NOT NULL;
  ALTER TABLE public.employers ALTER COLUMN updated_at DROP NOT NULL;
  ALTER TABLE public.employers
    ADD COLUMN "name" varchar(255) NOT NULL,
    ADD COLUMN "legal_name" varchar(255),
    ADD COLUMN "dba_name" varchar(255),
    ADD COLUMN "employer_type" "employer_type" NOT NULL,
    ADD COLUMN "status" "employer_status" DEFAULT 'active' NOT NULL,
    ADD COLUMN "business_number" varchar(50),
    ADD COLUMN "federal_corporation_number" varchar(50),
    ADD COLUMN "provincial_corporation_number" varchar(50),
    ADD COLUMN "industry_code" varchar(20),
    ADD COLUMN "email" varchar(255),
    ADD COLUMN "phone" varchar(50),
    ADD COLUMN "website" varchar(500),
    ADD COLUMN "main_address" jsonb,
    ADD COLUMN "total_employees" integer,
    ADD COLUMN "unionized_employees" integer,
    ADD COLUMN "established_date" date,
    ADD COLUMN "primary_contact_name" varchar(255),
    ADD COLUMN "primary_contact_title" varchar(255),
    ADD COLUMN "primary_contact_email" varchar(255),
    ADD COLUMN "primary_contact_phone" varchar(50),
    ADD COLUMN "labour_relations_contact_name" varchar(255),
    ADD COLUMN "labour_relations_contact_email" varchar(255),
    ADD COLUMN "labour_relations_contact_phone" varchar(50),
    ADD COLUMN "parent_company_id" uuid,
    ADD COLUMN "notes" text,
    ADD COLUMN "custom_fields" jsonb,
    ADD COLUMN "created_by" text,
    ADD COLUMN "updated_by" text,
    ADD COLUMN "archived_at" timestamp with time zone;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  existing text[];
  row_count bigint;
  match_count integer;
  created_at_shape text;
  updated_at_shape text;
  organization_shape text;
BEGIN
  IF to_regclass('public.worksites') IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname), ARRAY[]::text[])
    INTO existing
  FROM pg_attribute a
  WHERE a.attrelid = 'public.worksites'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF existing @> ARRAY['address', 'archived_at', 'code', 'created_at', 'created_by', 'custom_fields', 'description', 'employee_count', 'employer_id', 'id', 'name', 'notes', 'operates_24_hours', 'operates_weekends', 'organization_id', 'shift_count', 'site_manager_email', 'site_manager_name', 'site_manager_phone', 'status', 'updated_at', 'updated_by']::text[] THEN
    SELECT count(*) INTO match_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'worksites'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'employer_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'code' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'worksite_status' AND is_nullable = 'NO')
        OR (column_name = 'address' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'employee_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'shift_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'operates_weekends' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'operates_24_hours' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'site_manager_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'site_manager_email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'site_manager_phone' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'custom_fields' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'archived_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF match_count IS DISTINCT FROM 22 THEN
      RAISE EXCEPTION 'incompatible existing relation public.worksites: canonical names are present but 22 column contracts are not satisfied (found %). Rows were not rewritten.', match_count;
    END IF;
    RETURN;
  END IF;
  IF existing IS DISTINCT FROM ARRAY['created_at', 'id', 'organization_id', 'updated_at']::text[] THEN
    RAISE EXCEPTION 'incompatible existing relation public.worksites: unrecognized historical columns (%). Rows were not rewritten.', existing;
  END IF;
  SELECT udt_name || ':' || is_nullable INTO organization_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'worksites' AND column_name = 'organization_id';
  IF organization_shape IS DISTINCT FROM 'uuid:YES' AND organization_shape IS DISTINCT FROM 'uuid:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.worksites: organization_id is not uuid. Rows were not rewritten.';
  END IF;
  SELECT udt_name || ':' || is_nullable INTO created_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'worksites' AND column_name = 'created_at';
  SELECT udt_name || ':' || is_nullable INTO updated_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'worksites' AND column_name = 'updated_at';
  IF created_at_shape IS DISTINCT FROM 'timestamptz:NO' OR updated_at_shape IS DISTINCT FROM 'timestamptz:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.worksites: timestamps are not timestamptz NOT NULL. Rows were not rewritten.';
  END IF;
  SELECT count(*) INTO row_count FROM public.worksites;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'incompatible existing relation public.worksites: % populated row(s) cannot gain canonical NOT NULL columns without a rewrite. Rows were not rewritten.', row_count;
  END IF;
  ALTER TABLE public.worksites ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE public.worksites ALTER COLUMN created_at DROP NOT NULL;
  ALTER TABLE public.worksites ALTER COLUMN updated_at DROP NOT NULL;
  ALTER TABLE public.worksites
    ADD COLUMN "employer_id" uuid NOT NULL,
    ADD COLUMN "name" varchar(255) NOT NULL,
    ADD COLUMN "code" varchar(50),
    ADD COLUMN "status" "worksite_status" DEFAULT 'active' NOT NULL,
    ADD COLUMN "address" jsonb,
    ADD COLUMN "employee_count" integer,
    ADD COLUMN "shift_count" integer,
    ADD COLUMN "operates_weekends" boolean DEFAULT false,
    ADD COLUMN "operates_24_hours" boolean DEFAULT false,
    ADD COLUMN "site_manager_name" varchar(255),
    ADD COLUMN "site_manager_email" varchar(255),
    ADD COLUMN "site_manager_phone" varchar(50),
    ADD COLUMN "description" text,
    ADD COLUMN "notes" text,
    ADD COLUMN "custom_fields" jsonb,
    ADD COLUMN "created_by" text,
    ADD COLUMN "updated_by" text,
    ADD COLUMN "archived_at" timestamp with time zone;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  existing text[];
  row_count bigint;
  match_count integer;
  created_at_shape text;
  updated_at_shape text;
  organization_shape text;
BEGIN
  IF to_regclass('public.bargaining_units') IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname), ARRAY[]::text[])
    INTO existing
  FROM pg_attribute a
  WHERE a.attrelid = 'public.bargaining_units'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF existing @> ARRAY['archived_at', 'bargaining_chair_id', 'certification_body', 'certification_date', 'certification_expiry_date', 'certification_number', 'chief_steward_id', 'classifications', 'contract_expiry_date', 'created_at', 'created_by', 'current_collective_agreement_id', 'custom_fields', 'description', 'employer_id', 'id', 'member_count', 'name', 'next_bargaining_date', 'notes', 'organization_id', 'status', 'unit_number', 'unit_type', 'updated_at', 'updated_by', 'worksite_id']::text[] THEN
    SELECT count(*) INTO match_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'bargaining_units'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'employer_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'worksite_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'unit_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'unit_type' AND data_type = 'USER-DEFINED' AND udt_name = 'unit_type' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'unit_status' AND is_nullable = 'NO')
        OR (column_name = 'certification_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'certification_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'certification_body' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'certification_expiry_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'current_collective_agreement_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'contract_expiry_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'next_bargaining_date' AND data_type = 'date' AND udt_name = 'date' AND is_nullable = 'YES')
        OR (column_name = 'member_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'classifications' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'chief_steward_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'bargaining_chair_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'custom_fields' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'archived_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF match_count IS DISTINCT FROM 27 THEN
      RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: canonical names are present but 27 column contracts are not satisfied (found %). Rows were not rewritten.', match_count;
    END IF;
    RETURN;
  END IF;
  IF existing IS DISTINCT FROM ARRAY['created_at', 'id', 'organization_id', 'updated_at']::text[] THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: unrecognized historical columns (%). Rows were not rewritten.', existing;
  END IF;
  SELECT udt_name || ':' || is_nullable INTO organization_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bargaining_units' AND column_name = 'organization_id';
  IF organization_shape IS DISTINCT FROM 'uuid:YES' AND organization_shape IS DISTINCT FROM 'uuid:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: organization_id is not uuid. Rows were not rewritten.';
  END IF;
  SELECT udt_name || ':' || is_nullable INTO created_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bargaining_units' AND column_name = 'created_at';
  SELECT udt_name || ':' || is_nullable INTO updated_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'bargaining_units' AND column_name = 'updated_at';
  IF created_at_shape IS DISTINCT FROM 'timestamptz:NO' OR updated_at_shape IS DISTINCT FROM 'timestamptz:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: timestamps are not timestamptz NOT NULL. Rows were not rewritten.';
  END IF;
  SELECT count(*) INTO row_count FROM public.bargaining_units;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: % populated row(s) cannot gain canonical NOT NULL columns without a rewrite. Rows were not rewritten.', row_count;
  END IF;
  ALTER TABLE public.bargaining_units ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE public.bargaining_units ALTER COLUMN created_at DROP NOT NULL;
  ALTER TABLE public.bargaining_units ALTER COLUMN updated_at DROP NOT NULL;
  ALTER TABLE public.bargaining_units
    ADD COLUMN "employer_id" uuid NOT NULL,
    ADD COLUMN "worksite_id" uuid,
    ADD COLUMN "name" varchar(255) NOT NULL,
    ADD COLUMN "unit_number" varchar(50),
    ADD COLUMN "unit_type" "unit_type" NOT NULL,
    ADD COLUMN "status" "unit_status" DEFAULT 'active' NOT NULL,
    ADD COLUMN "certification_number" varchar(100),
    ADD COLUMN "certification_date" date,
    ADD COLUMN "certification_body" varchar(100),
    ADD COLUMN "certification_expiry_date" date,
    ADD COLUMN "current_collective_agreement_id" uuid,
    ADD COLUMN "contract_expiry_date" date,
    ADD COLUMN "next_bargaining_date" date,
    ADD COLUMN "member_count" integer DEFAULT 0,
    ADD COLUMN "classifications" jsonb,
    ADD COLUMN "chief_steward_id" text,
    ADD COLUMN "bargaining_chair_id" text,
    ADD COLUMN "description" text,
    ADD COLUMN "notes" text,
    ADD COLUMN "custom_fields" jsonb,
    ADD COLUMN "created_by" text,
    ADD COLUMN "updated_by" text,
    ADD COLUMN "archived_at" timestamp with time zone;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  existing text[];
  row_count bigint;
  match_count integer;
  created_at_shape text;
  updated_at_shape text;
  organization_shape text;
BEGIN
  IF to_regclass('public.committees') IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname), ARRAY[]::text[])
    INTO existing
  FROM pg_attribute a
  WHERE a.attrelid = 'public.committees'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF existing @> ARRAY['archived_at', 'chair_id', 'committee_type', 'contact_email', 'created_at', 'created_by', 'current_member_count', 'custom_fields', 'description', 'id', 'is_organization_wide', 'mandate', 'max_members', 'meeting_day', 'meeting_frequency', 'meeting_location', 'meeting_time', 'name', 'notes', 'organization_id', 'requires_appointment', 'requires_election', 'secretary_id', 'status', 'term_length', 'unit_id', 'updated_at', 'updated_by', 'worksite_id']::text[] THEN
    SELECT count(*) INTO match_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'committees'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'committee_type' AND data_type = 'USER-DEFINED' AND udt_name = 'committee_type' AND is_nullable = 'NO')
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'unit_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'worksite_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'is_organization_wide' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'mandate' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'meeting_frequency' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'meeting_day' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'meeting_time' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'meeting_location' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'max_members' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'current_member_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'requires_appointment' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'requires_election' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'term_length' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'chair_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'secretary_id' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'contact_email' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'custom_fields' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'created_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'updated_by' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'archived_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
      );
    IF match_count IS DISTINCT FROM 29 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committees: canonical names are present but 29 column contracts are not satisfied (found %). Rows were not rewritten.', match_count;
    END IF;
    RETURN;
  END IF;
  IF existing IS DISTINCT FROM ARRAY['created_at', 'id', 'organization_id', 'updated_at']::text[] THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: unrecognized historical columns (%). Rows were not rewritten.', existing;
  END IF;
  SELECT udt_name || ':' || is_nullable INTO organization_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'committees' AND column_name = 'organization_id';
  IF organization_shape IS DISTINCT FROM 'uuid:YES' AND organization_shape IS DISTINCT FROM 'uuid:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: organization_id is not uuid. Rows were not rewritten.';
  END IF;
  SELECT udt_name || ':' || is_nullable INTO created_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'committees' AND column_name = 'created_at';
  SELECT udt_name || ':' || is_nullable INTO updated_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'committees' AND column_name = 'updated_at';
  IF created_at_shape IS DISTINCT FROM 'timestamptz:NO' OR updated_at_shape IS DISTINCT FROM 'timestamptz:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: timestamps are not timestamptz NOT NULL. Rows were not rewritten.';
  END IF;
  SELECT count(*) INTO row_count FROM public.committees;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'incompatible existing relation public.committees: % populated row(s) cannot gain canonical NOT NULL columns without a rewrite. Rows were not rewritten.', row_count;
  END IF;
  ALTER TABLE public.committees ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE public.committees ALTER COLUMN created_at DROP NOT NULL;
  ALTER TABLE public.committees ALTER COLUMN updated_at DROP NOT NULL;
  ALTER TABLE public.committees
    ADD COLUMN "name" varchar(255) NOT NULL,
    ADD COLUMN "committee_type" "committee_type" NOT NULL,
    ADD COLUMN "status" varchar(50) DEFAULT 'active' NOT NULL,
    ADD COLUMN "unit_id" uuid,
    ADD COLUMN "worksite_id" uuid,
    ADD COLUMN "is_organization_wide" boolean DEFAULT false,
    ADD COLUMN "mandate" text,
    ADD COLUMN "meeting_frequency" varchar(100),
    ADD COLUMN "meeting_day" varchar(50),
    ADD COLUMN "meeting_time" varchar(50),
    ADD COLUMN "meeting_location" text,
    ADD COLUMN "max_members" integer,
    ADD COLUMN "current_member_count" integer DEFAULT 0,
    ADD COLUMN "requires_appointment" boolean DEFAULT false,
    ADD COLUMN "requires_election" boolean DEFAULT false,
    ADD COLUMN "term_length" integer,
    ADD COLUMN "chair_id" text,
    ADD COLUMN "secretary_id" text,
    ADD COLUMN "contact_email" varchar(255),
    ADD COLUMN "description" text,
    ADD COLUMN "notes" text,
    ADD COLUMN "custom_fields" jsonb,
    ADD COLUMN "created_by" text,
    ADD COLUMN "updated_by" text,
    ADD COLUMN "archived_at" timestamp with time zone;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  existing text[];
  row_count bigint;
  match_count integer;
  created_at_shape text;
  updated_at_shape text;
  organization_shape text;
  extra_shape text;
BEGIN
  IF to_regclass('public.collective_agreements') IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname), ARRAY[]::text[])
    INTO existing
  FROM pg_attribute a
  WHERE a.attrelid = 'public.collective_agreements'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF existing @> ARRAY['ai_processed', 'bargaining_unit_description', 'cba_number', 'created_at', 'created_by', 'document_hash', 'document_url', 'effective_date', 'embedding', 'employee_coverage', 'employer_id', 'employer_name', 'expiry_date', 'id', 'industry_sector', 'is_public', 'jurisdiction', 'key_terms', 'language', 'last_modified_by', 'organization_id', 'precedes_id', 'ratification_date', 'raw_text', 'sector', 'signed_date', 'status', 'structured_data', 'summary_generated', 'superseded_by', 'title', 'union_id', 'union_local', 'union_name', 'updated_at', 'version', 'view_count']::text[] THEN
    SELECT count(*) INTO match_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'collective_agreements'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'cba_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 100)
        OR (column_name = 'title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'jurisdiction' AND data_type = 'USER-DEFINED' AND udt_name = 'cba_jurisdiction' AND is_nullable = 'NO')
        OR (column_name = 'language' AND data_type = 'USER-DEFINED' AND udt_name = 'cba_language' AND is_nullable = 'NO')
        OR (column_name = 'employer_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 300)
        OR (column_name = 'employer_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'union_name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 300)
        OR (column_name = 'union_local' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'union_id' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'effective_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'expiry_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'signed_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'ratification_date' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'YES')
        OR (column_name = 'industry_sector' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 200)
        OR (column_name = 'sector' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 200)
        OR (column_name = 'employee_coverage' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'bargaining_unit_description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'document_url' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'document_hash' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 64)
        OR (column_name = 'raw_text' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'structured_data' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'embedding' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'summary_generated' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'key_terms' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'ai_processed' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'status' AND data_type = 'USER-DEFINED' AND udt_name = 'cba_status' AND is_nullable = 'NO')
        OR (column_name = 'is_public' AND data_type = 'boolean' AND udt_name = 'bool' AND is_nullable = 'YES')
        OR (column_name = 'view_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'last_modified_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'version' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'superseded_by' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'precedes_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
      );
    IF match_count IS DISTINCT FROM 37 THEN
      RAISE EXCEPTION 'incompatible existing relation public.collective_agreements: canonical names are present but 37 column contracts are not satisfied (found %). Rows were not rewritten.', match_count;
    END IF;
    RETURN;
  END IF;
  IF existing IS DISTINCT FROM ARRAY['cba_number', 'created_at', 'id', 'organization_id', 'updated_at']::text[] THEN
    RAISE EXCEPTION 'incompatible existing relation public.collective_agreements: unrecognized historical columns (%). Rows were not rewritten.', existing;
  END IF;
  SELECT udt_name || ':' || is_nullable INTO organization_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'collective_agreements' AND column_name = 'organization_id';
  IF organization_shape IS DISTINCT FROM 'uuid:YES' AND organization_shape IS DISTINCT FROM 'uuid:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.collective_agreements: organization_id is not uuid. Rows were not rewritten.';
  END IF;
  SELECT udt_name || ':' || is_nullable INTO created_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'collective_agreements' AND column_name = 'created_at';
  SELECT udt_name || ':' || is_nullable INTO updated_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'collective_agreements' AND column_name = 'updated_at';
  IF created_at_shape IS DISTINCT FROM 'timestamptz:NO' OR updated_at_shape IS DISTINCT FROM 'timestamptz:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.collective_agreements: timestamps are not timestamptz NOT NULL. Rows were not rewritten.';
  END IF;
  SELECT udt_name || ':' || is_nullable || ':' || COALESCE(character_maximum_length::text, '') INTO extra_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'collective_agreements' AND column_name = 'cba_number';
  IF extra_shape IS DISTINCT FROM 'varchar:YES:255' THEN
    RAISE EXCEPTION 'incompatible existing relation public.collective_agreements: cba_number is not nullable varchar(255). Rows were not rewritten.';
  END IF;
  SELECT count(*) INTO row_count FROM public.collective_agreements;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'incompatible existing relation public.collective_agreements: % populated row(s) cannot gain canonical NOT NULL columns without a rewrite. Rows were not rewritten.', row_count;
  END IF;
  ALTER TABLE public.collective_agreements ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE public.collective_agreements
    ALTER COLUMN cba_number TYPE varchar(100),
    ALTER COLUMN cba_number SET NOT NULL;
  ALTER TABLE public.collective_agreements
    ADD COLUMN "title" varchar(500) NOT NULL,
    ADD COLUMN "jurisdiction" "cba_jurisdiction" NOT NULL,
    ADD COLUMN "language" "cba_language" DEFAULT 'en' NOT NULL,
    ADD COLUMN "employer_name" varchar(300) NOT NULL,
    ADD COLUMN "employer_id" varchar(100),
    ADD COLUMN "union_name" varchar(300) NOT NULL,
    ADD COLUMN "union_local" varchar(100),
    ADD COLUMN "union_id" varchar(100),
    ADD COLUMN "effective_date" timestamp with time zone NOT NULL,
    ADD COLUMN "expiry_date" timestamp with time zone NOT NULL,
    ADD COLUMN "signed_date" timestamp with time zone,
    ADD COLUMN "ratification_date" timestamp with time zone,
    ADD COLUMN "industry_sector" varchar(200) NOT NULL,
    ADD COLUMN "sector" varchar(200),
    ADD COLUMN "employee_coverage" integer,
    ADD COLUMN "bargaining_unit_description" text,
    ADD COLUMN "document_url" text,
    ADD COLUMN "document_hash" varchar(64),
    ADD COLUMN "raw_text" text,
    ADD COLUMN "structured_data" jsonb,
    ADD COLUMN "embedding" text,
    ADD COLUMN "summary_generated" text,
    ADD COLUMN "key_terms" jsonb,
    ADD COLUMN "ai_processed" boolean DEFAULT false,
    ADD COLUMN "status" "cba_status" DEFAULT 'active' NOT NULL,
    ADD COLUMN "is_public" boolean DEFAULT false,
    ADD COLUMN "view_count" integer DEFAULT 0,
    ADD COLUMN "created_by" varchar(255),
    ADD COLUMN "last_modified_by" varchar(255),
    ADD COLUMN "version" integer DEFAULT 1 NOT NULL,
    ADD COLUMN "superseded_by" uuid,
    ADD COLUMN "precedes_id" uuid;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  existing text[];
  row_count bigint;
  match_count integer;
  created_at_shape text;
  updated_at_shape text;
  organization_shape text;
BEGIN
  IF to_regclass('public.cba_clauses') IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname), ARRAY[]::text[])
    INTO existing
  FROM pg_attribute a
  WHERE a.attrelid = 'public.cba_clauses'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF existing @> ARRAY['article_number', 'cba_id', 'citation_count', 'clause_number', 'clause_type', 'confidence_score', 'content', 'content_hash', 'content_plain_text', 'created_at', 'embedding', 'id', 'interpretation_notes', 'key_terms', 'order_index', 'organization_id', 'orgs', 'page_number', 'parent_clause_id', 'related_clause_ids', 'section_hierarchy', 'title', 'updated_at', 'view_count']::text[] THEN
    SELECT count(*) INTO match_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cba_clauses'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'cba_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'clause_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'clause_type' AND data_type = 'USER-DEFINED' AND udt_name = 'clause_type' AND is_nullable = 'NO')
        OR (column_name = 'title' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 500)
        OR (column_name = 'content' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'NO')
        OR (column_name = 'content_plain_text' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'content_hash' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 64)
        OR (column_name = 'page_number' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'article_number' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'section_hierarchy' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'parent_clause_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'order_index' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'NO')
        OR (column_name = 'embedding' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'confidence_score' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 5 AND numeric_scale = 4)
        OR (column_name = 'orgs' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'key_terms' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'related_clause_ids' AND data_type = 'jsonb' AND udt_name = 'jsonb' AND is_nullable = 'YES')
        OR (column_name = 'interpretation_notes' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'view_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'citation_count' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'created_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp with time zone' AND udt_name = 'timestamptz' AND is_nullable = 'NO')
      );
    IF match_count IS DISTINCT FROM 24 THEN
      RAISE EXCEPTION 'incompatible existing relation public.cba_clauses: canonical names are present but 24 column contracts are not satisfied (found %). Rows were not rewritten.', match_count;
    END IF;
    RETURN;
  END IF;
  IF existing IS DISTINCT FROM ARRAY['created_at', 'id', 'organization_id', 'updated_at']::text[] THEN
    RAISE EXCEPTION 'incompatible existing relation public.cba_clauses: unrecognized historical columns (%). Rows were not rewritten.', existing;
  END IF;
  SELECT udt_name || ':' || is_nullable INTO organization_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cba_clauses' AND column_name = 'organization_id';
  IF organization_shape IS DISTINCT FROM 'uuid:YES' AND organization_shape IS DISTINCT FROM 'uuid:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.cba_clauses: organization_id is not uuid. Rows were not rewritten.';
  END IF;
  SELECT udt_name || ':' || is_nullable INTO created_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cba_clauses' AND column_name = 'created_at';
  SELECT udt_name || ':' || is_nullable INTO updated_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cba_clauses' AND column_name = 'updated_at';
  IF created_at_shape IS DISTINCT FROM 'timestamptz:NO' OR updated_at_shape IS DISTINCT FROM 'timestamptz:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.cba_clauses: timestamps are not timestamptz NOT NULL. Rows were not rewritten.';
  END IF;
  SELECT count(*) INTO row_count FROM public.cba_clauses;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'incompatible existing relation public.cba_clauses: % populated row(s) cannot gain canonical NOT NULL columns without a rewrite. Rows were not rewritten.', row_count;
  END IF;
  ALTER TABLE public.cba_clauses ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE public.cba_clauses
    ADD COLUMN "cba_id" uuid NOT NULL,
    ADD COLUMN "clause_number" varchar(50) NOT NULL,
    ADD COLUMN "clause_type" "clause_type" NOT NULL,
    ADD COLUMN "title" varchar(500) NOT NULL,
    ADD COLUMN "content" text NOT NULL,
    ADD COLUMN "content_plain_text" text,
    ADD COLUMN "content_hash" varchar(64),
    ADD COLUMN "page_number" integer,
    ADD COLUMN "article_number" varchar(50),
    ADD COLUMN "section_hierarchy" jsonb,
    ADD COLUMN "parent_clause_id" uuid,
    ADD COLUMN "order_index" integer DEFAULT 0 NOT NULL,
    ADD COLUMN "embedding" text,
    ADD COLUMN "confidence_score" numeric(5, 4),
    ADD COLUMN "orgs" jsonb,
    ADD COLUMN "key_terms" jsonb,
    ADD COLUMN "related_clause_ids" jsonb,
    ADD COLUMN "interpretation_notes" text,
    ADD COLUMN "view_count" integer DEFAULT 0,
    ADD COLUMN "citation_count" integer DEFAULT 0;
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  existing text[];
  row_count bigint;
  match_count integer;
  created_at_shape text;
  updated_at_shape text;
  organization_shape text;
BEGIN
  IF to_regclass('public.cost_centers') IS NULL THEN
    RETURN;
  END IF;
  SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname), ARRAY[]::text[])
    INTO existing
  FROM pg_attribute a
  WHERE a.attrelid = 'public.cost_centers'::regclass
    AND a.attnum > 0
    AND NOT a.attisdropped;
  IF existing @> ARRAY['budget_amount', 'budget_end_date', 'budget_period', 'budget_start_date', 'code', 'created_at', 'created_by', 'description', 'external_code', 'id', 'manager', 'name', 'organization_id', 'parent_cost_center_id', 'status', 'type', 'updated_at', 'updated_by', 'warning_threshold']::text[] THEN
    SELECT count(*) INTO match_count FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'cost_centers'
      AND (
        (column_name = 'id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'organization_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'NO')
        OR (column_name = 'code' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'name' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 255)
        OR (column_name = 'description' AND data_type = 'text' AND udt_name = 'text' AND is_nullable = 'YES')
        OR (column_name = 'type' AND data_type = 'USER-DEFINED' AND udt_name = 'cost_center_type' AND is_nullable = 'NO')
        OR (column_name = 'parent_cost_center_id' AND data_type = 'uuid' AND udt_name = 'uuid' AND is_nullable = 'YES')
        OR (column_name = 'manager' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'status' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'NO' AND character_maximum_length = 50)
        OR (column_name = 'budget_amount' AND data_type = 'numeric' AND udt_name = 'numeric' AND is_nullable = 'YES' AND numeric_precision = 19 AND numeric_scale = 2)
        OR (column_name = 'budget_period' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 50)
        OR (column_name = 'budget_start_date' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'YES')
        OR (column_name = 'budget_end_date' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'YES')
        OR (column_name = 'warning_threshold' AND data_type = 'integer' AND udt_name = 'int4' AND is_nullable = 'YES')
        OR (column_name = 'external_code' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 100)
        OR (column_name = 'created_at' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'NO')
        OR (column_name = 'updated_at' AND data_type = 'timestamp without time zone' AND udt_name = 'timestamp' AND is_nullable = 'NO')
        OR (column_name = 'created_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
        OR (column_name = 'updated_by' AND data_type = 'character varying' AND udt_name = 'varchar' AND is_nullable = 'YES' AND character_maximum_length = 255)
      );
    IF match_count IS DISTINCT FROM 19 THEN
      RAISE EXCEPTION 'incompatible existing relation public.cost_centers: canonical names are present but 19 column contracts are not satisfied (found %). Rows were not rewritten.', match_count;
    END IF;
    RETURN;
  END IF;
  IF existing IS DISTINCT FROM ARRAY['created_at', 'id', 'organization_id', 'updated_at']::text[] THEN
    RAISE EXCEPTION 'incompatible existing relation public.cost_centers: unrecognized historical columns (%). Rows were not rewritten.', existing;
  END IF;
  SELECT udt_name || ':' || is_nullable INTO organization_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cost_centers' AND column_name = 'organization_id';
  IF organization_shape IS DISTINCT FROM 'uuid:YES' AND organization_shape IS DISTINCT FROM 'uuid:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.cost_centers: organization_id is not uuid. Rows were not rewritten.';
  END IF;
  SELECT udt_name || ':' || is_nullable INTO created_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cost_centers' AND column_name = 'created_at';
  SELECT udt_name || ':' || is_nullable INTO updated_at_shape
  FROM information_schema.columns
  WHERE table_schema = 'public' AND table_name = 'cost_centers' AND column_name = 'updated_at';
  IF created_at_shape IS DISTINCT FROM 'timestamptz:NO' OR updated_at_shape IS DISTINCT FROM 'timestamptz:NO' THEN
    RAISE EXCEPTION 'incompatible existing relation public.cost_centers: timestamps are not timestamptz NOT NULL. Rows were not rewritten.';
  END IF;
  SELECT count(*) INTO row_count FROM public.cost_centers;
  IF row_count > 0 THEN
    RAISE EXCEPTION 'incompatible existing relation public.cost_centers: % populated row(s) cannot gain canonical NOT NULL columns without a rewrite. Rows were not rewritten.', row_count;
  END IF;
  ALTER TABLE public.cost_centers ALTER COLUMN organization_id SET NOT NULL;
  ALTER TABLE public.cost_centers DROP COLUMN created_at, DROP COLUMN updated_at;
  ALTER TABLE public.cost_centers
    ADD COLUMN "code" varchar(50) NOT NULL,
    ADD COLUMN "name" varchar(255) NOT NULL,
    ADD COLUMN "description" text,
    ADD COLUMN "type" "cost_center_type" NOT NULL,
    ADD COLUMN "parent_cost_center_id" uuid,
    ADD COLUMN "manager" varchar(255),
    ADD COLUMN "status" varchar(50) DEFAULT 'active' NOT NULL,
    ADD COLUMN "budget_amount" numeric(19, 2),
    ADD COLUMN "budget_period" varchar(50),
    ADD COLUMN "budget_start_date" timestamp,
    ADD COLUMN "budget_end_date" timestamp,
    ADD COLUMN "warning_threshold" integer DEFAULT 80,
    ADD COLUMN "external_code" varchar(100),
    ADD COLUMN "created_at" timestamp DEFAULT now() NOT NULL,
    ADD COLUMN "updated_at" timestamp DEFAULT now() NOT NULL,
    ADD COLUMN "created_by" varchar(255),
    ADD COLUMN "updated_by" varchar(255);
END
$ue$;
--> statement-breakpoint
DO $ue$
DECLARE
  child_rel oid;
  parent_rel oid;
  orphans bigint;
BEGIN
  child_rel := to_regclass('public.employers');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employers_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for employers_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.employers e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.employers: % row(s) violate employers_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.employers
      ADD CONSTRAINT employers_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.employers');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employers_parent_company_id_employers_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.employers');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.employers for employers_parent_company_id_employers_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.employers e
    LEFT JOIN public.employers parent_row ON parent_row.id = e.parent_company_id
    WHERE e.parent_company_id IS NOT NULL AND parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.employers: % row(s) violate employers_parent_company_id_employers_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.employers
      ADD CONSTRAINT employers_parent_company_id_employers_id_fk
      FOREIGN KEY (parent_company_id) REFERENCES public.employers(id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.employers');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employers_created_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for employers_created_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.employers e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.created_by
    WHERE e.created_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.employers: % row(s) violate employers_created_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.employers
      ADD CONSTRAINT employers_created_by_profiles_user_id_fk
      FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.employers');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'employers_updated_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for employers_updated_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.employers e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.updated_by
    WHERE e.updated_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.employers: % row(s) violate employers_updated_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.employers
      ADD CONSTRAINT employers_updated_by_profiles_user_id_fk
      FOREIGN KEY (updated_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.worksites');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'worksites_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for worksites_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.worksites e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.worksites: % row(s) violate worksites_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.worksites
      ADD CONSTRAINT worksites_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.worksites');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'worksites_employer_id_employers_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.employers');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.employers for worksites_employer_id_employers_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.worksites e
    LEFT JOIN public.employers parent_row ON parent_row.id = e.employer_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.worksites: % row(s) violate worksites_employer_id_employers_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.worksites
      ADD CONSTRAINT worksites_employer_id_employers_id_fk
      FOREIGN KEY (employer_id) REFERENCES public.employers(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.worksites');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'worksites_created_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for worksites_created_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.worksites e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.created_by
    WHERE e.created_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.worksites: % row(s) violate worksites_created_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.worksites
      ADD CONSTRAINT worksites_created_by_profiles_user_id_fk
      FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.worksites');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'worksites_updated_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for worksites_updated_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.worksites e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.updated_by
    WHERE e.updated_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.worksites: % row(s) violate worksites_updated_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.worksites
      ADD CONSTRAINT worksites_updated_by_profiles_user_id_fk
      FOREIGN KEY (updated_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.bargaining_units');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bargaining_units_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for bargaining_units_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.bargaining_units e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: % row(s) violate bargaining_units_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.bargaining_units
      ADD CONSTRAINT bargaining_units_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.bargaining_units');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bargaining_units_employer_id_employers_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.employers');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.employers for bargaining_units_employer_id_employers_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.bargaining_units e
    LEFT JOIN public.employers parent_row ON parent_row.id = e.employer_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: % row(s) violate bargaining_units_employer_id_employers_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.bargaining_units
      ADD CONSTRAINT bargaining_units_employer_id_employers_id_fk
      FOREIGN KEY (employer_id) REFERENCES public.employers(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.bargaining_units');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bargaining_units_worksite_id_worksites_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.worksites');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.worksites for bargaining_units_worksite_id_worksites_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.bargaining_units e
    LEFT JOIN public.worksites parent_row ON parent_row.id = e.worksite_id
    WHERE e.worksite_id IS NOT NULL AND parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: % row(s) violate bargaining_units_worksite_id_worksites_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.bargaining_units
      ADD CONSTRAINT bargaining_units_worksite_id_worksites_id_fk
      FOREIGN KEY (worksite_id) REFERENCES public.worksites(id)
      ON DELETE set null ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.bargaining_units');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bargaining_units_chief_steward_id_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for bargaining_units_chief_steward_id_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.bargaining_units e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.chief_steward_id
    WHERE e.chief_steward_id IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: % row(s) violate bargaining_units_chief_steward_id_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.bargaining_units
      ADD CONSTRAINT bargaining_units_chief_steward_id_profiles_user_id_fk
      FOREIGN KEY (chief_steward_id) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.bargaining_units');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bargaining_units_bargaining_chair_id_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for bargaining_units_bargaining_chair_id_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.bargaining_units e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.bargaining_chair_id
    WHERE e.bargaining_chair_id IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: % row(s) violate bargaining_units_bargaining_chair_id_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.bargaining_units
      ADD CONSTRAINT bargaining_units_bargaining_chair_id_profiles_user_id_fk
      FOREIGN KEY (bargaining_chair_id) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.bargaining_units');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bargaining_units_created_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for bargaining_units_created_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.bargaining_units e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.created_by
    WHERE e.created_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: % row(s) violate bargaining_units_created_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.bargaining_units
      ADD CONSTRAINT bargaining_units_created_by_profiles_user_id_fk
      FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.bargaining_units');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'bargaining_units_updated_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for bargaining_units_updated_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.bargaining_units e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.updated_by
    WHERE e.updated_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.bargaining_units: % row(s) violate bargaining_units_updated_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.bargaining_units
      ADD CONSTRAINT bargaining_units_updated_by_profiles_user_id_fk
      FOREIGN KEY (updated_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committees');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'committees_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for committees_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.committees e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committees: % row(s) violate committees_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committees
      ADD CONSTRAINT committees_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committees');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'committees_unit_id_bargaining_units_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.bargaining_units');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.bargaining_units for committees_unit_id_bargaining_units_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.committees e
    LEFT JOIN public.bargaining_units parent_row ON parent_row.id = e.unit_id
    WHERE e.unit_id IS NOT NULL AND parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committees: % row(s) violate committees_unit_id_bargaining_units_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committees
      ADD CONSTRAINT committees_unit_id_bargaining_units_id_fk
      FOREIGN KEY (unit_id) REFERENCES public.bargaining_units(id)
      ON DELETE set null ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committees');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'committees_worksite_id_worksites_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.worksites');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.worksites for committees_worksite_id_worksites_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.committees e
    LEFT JOIN public.worksites parent_row ON parent_row.id = e.worksite_id
    WHERE e.worksite_id IS NOT NULL AND parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committees: % row(s) violate committees_worksite_id_worksites_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committees
      ADD CONSTRAINT committees_worksite_id_worksites_id_fk
      FOREIGN KEY (worksite_id) REFERENCES public.worksites(id)
      ON DELETE set null ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committees');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'committees_chair_id_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committees_chair_id_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.committees e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.chair_id
    WHERE e.chair_id IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committees: % row(s) violate committees_chair_id_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committees
      ADD CONSTRAINT committees_chair_id_profiles_user_id_fk
      FOREIGN KEY (chair_id) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committees');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'committees_secretary_id_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committees_secretary_id_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.committees e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.secretary_id
    WHERE e.secretary_id IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committees: % row(s) violate committees_secretary_id_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committees
      ADD CONSTRAINT committees_secretary_id_profiles_user_id_fk
      FOREIGN KEY (secretary_id) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committees');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'committees_created_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committees_created_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.committees e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.created_by
    WHERE e.created_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committees: % row(s) violate committees_created_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committees
      ADD CONSTRAINT committees_created_by_profiles_user_id_fk
      FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committees');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'committees_updated_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committees_updated_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.committees e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.updated_by
    WHERE e.updated_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committees: % row(s) violate committees_updated_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committees
      ADD CONSTRAINT committees_updated_by_profiles_user_id_fk
      FOREIGN KEY (updated_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.cost_centers');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cost_centers_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for cost_centers_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.cost_centers e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.cost_centers: % row(s) violate cost_centers_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.cost_centers
      ADD CONSTRAINT cost_centers_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.cost_centers');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cost_centers_parent_cost_center_id_cost_centers_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.cost_centers');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.cost_centers for cost_centers_parent_cost_center_id_cost_centers_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.cost_centers e
    LEFT JOIN public.cost_centers parent_row ON parent_row.id = e.parent_cost_center_id
    WHERE e.parent_cost_center_id IS NOT NULL AND parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.cost_centers: % row(s) violate cost_centers_parent_cost_center_id_cost_centers_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.cost_centers
      ADD CONSTRAINT cost_centers_parent_cost_center_id_cost_centers_id_fk
      FOREIGN KEY (parent_cost_center_id) REFERENCES public.cost_centers(id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.cba_clauses');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'cba_clauses_cba_id_collective_agreements_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.collective_agreements');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.collective_agreements for cba_clauses_cba_id_collective_agreements_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.cba_clauses e
    LEFT JOIN public.collective_agreements parent_row ON parent_row.id = e.cba_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.cba_clauses: % row(s) violate cba_clauses_cba_id_collective_agreements_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.cba_clauses
      ADD CONSTRAINT cba_clauses_cba_id_collective_agreements_id_fk
      FOREIGN KEY (cba_id) REFERENCES public.collective_agreements(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
END
$ue$;
