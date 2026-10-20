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
--
-- Frozen 0096 stores committee_action_items.status, committee_action_items.priority,
-- and committee_meetings.status as text. The canonical columns are enums. A text
-- value is cast only when every stored value is already a canonical label.

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
    ('cost_center_type', ARRAY['department', 'project', 'location', 'program', 'fund', 'grant', 'other']::text[]),
    ('committee_action_item_priority', ARRAY['low', 'medium', 'high', 'urgent']::text[]),
    ('committee_action_item_status', ARRAY['pending', 'in_progress', 'completed', 'deferred', 'cancelled']::text[]),
    ('committee_meeting_status', ARRAY['scheduled', 'in_progress', 'completed', 'cancelled', 'postponed']::text[])
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
  rel record;
  existing text[];
  canonical text[];
  row_count bigint;
  match_count integer;
  live record;
  expected record;
  nulls bigint;
  too_long bigint;
  bad bigint;
  repair text;
BEGIN
  CREATE TEMP TABLE IF NOT EXISTS ue_stub_column_contract (
    relname text,
    column_name text,
    data_type text,
    udt_name text,
    is_nullable text,
    character_maximum_length integer,
    numeric_precision integer,
    numeric_scale integer,
    add_sql text,
    PRIMARY KEY (relname, column_name)
  ) ON COMMIT DROP;
  TRUNCATE ue_stub_column_contract;

  -- employers: 33 canonical columns
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'name', 'character varying', 'varchar', 'NO', 255, NULL, NULL, 'varchar(255) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'legal_name', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'dba_name', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'employer_type', 'USER-DEFINED', 'employer_type', 'NO', NULL, NULL, NULL, '"employer_type" NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'status', 'USER-DEFINED', 'employer_status', 'NO', NULL, NULL, NULL, '"employer_status" DEFAULT ''active'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'business_number', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'federal_corporation_number', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'provincial_corporation_number', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'industry_code', 'character varying', 'varchar', 'YES', 20, NULL, NULL, 'varchar(20)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'email', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'phone', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'website', 'character varying', 'varchar', 'YES', 500, NULL, NULL, 'varchar(500)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'main_address', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'total_employees', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'unionized_employees', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'established_date', 'date', 'date', 'YES', NULL, NULL, NULL, 'date');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'primary_contact_name', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'primary_contact_title', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'primary_contact_email', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'primary_contact_phone', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'labour_relations_contact_name', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'labour_relations_contact_email', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'labour_relations_contact_phone', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'parent_company_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'notes', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'custom_fields', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'created_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'updated_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'created_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'updated_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('employers', 'archived_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  -- worksites: 22 canonical columns
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'employer_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'name', 'character varying', 'varchar', 'NO', 255, NULL, NULL, 'varchar(255) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'code', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'status', 'USER-DEFINED', 'worksite_status', 'NO', NULL, NULL, NULL, '"worksite_status" DEFAULT ''active'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'address', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'employee_count', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'shift_count', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'operates_weekends', 'boolean', 'bool', 'YES', NULL, NULL, NULL, 'boolean DEFAULT false');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'operates_24_hours', 'boolean', 'bool', 'YES', NULL, NULL, NULL, 'boolean DEFAULT false');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'site_manager_name', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'site_manager_email', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'site_manager_phone', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'description', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'notes', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'custom_fields', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'created_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'updated_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'created_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'updated_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('worksites', 'archived_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  -- bargaining_units: 27 canonical columns
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'employer_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'worksite_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'name', 'character varying', 'varchar', 'NO', 255, NULL, NULL, 'varchar(255) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'unit_number', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'unit_type', 'USER-DEFINED', 'unit_type', 'NO', NULL, NULL, NULL, '"unit_type" NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'status', 'USER-DEFINED', 'unit_status', 'NO', NULL, NULL, NULL, '"unit_status" DEFAULT ''active'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'certification_number', 'character varying', 'varchar', 'YES', 100, NULL, NULL, 'varchar(100)');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'certification_date', 'date', 'date', 'YES', NULL, NULL, NULL, 'date');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'certification_body', 'character varying', 'varchar', 'YES', 100, NULL, NULL, 'varchar(100)');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'certification_expiry_date', 'date', 'date', 'YES', NULL, NULL, NULL, 'date');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'current_collective_agreement_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'contract_expiry_date', 'date', 'date', 'YES', NULL, NULL, NULL, 'date');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'next_bargaining_date', 'date', 'date', 'YES', NULL, NULL, NULL, 'date');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'member_count', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer DEFAULT 0');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'classifications', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'chief_steward_id', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'bargaining_chair_id', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'description', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'notes', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'custom_fields', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'created_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'updated_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'created_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'updated_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('bargaining_units', 'archived_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  -- committees: 29 canonical columns
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'name', 'character varying', 'varchar', 'NO', 255, NULL, NULL, 'varchar(255) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'committee_type', 'USER-DEFINED', 'committee_type', 'NO', NULL, NULL, NULL, '"committee_type" NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'status', 'character varying', 'varchar', 'NO', 50, NULL, NULL, 'varchar(50) DEFAULT ''active'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'unit_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'worksite_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'is_organization_wide', 'boolean', 'bool', 'YES', NULL, NULL, NULL, 'boolean DEFAULT false');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'mandate', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'meeting_frequency', 'character varying', 'varchar', 'YES', 100, NULL, NULL, 'varchar(100)');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'meeting_day', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'meeting_time', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'meeting_location', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'max_members', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'current_member_count', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer DEFAULT 0');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'requires_appointment', 'boolean', 'bool', 'YES', NULL, NULL, NULL, 'boolean DEFAULT false');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'requires_election', 'boolean', 'bool', 'YES', NULL, NULL, NULL, 'boolean DEFAULT false');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'term_length', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'chair_id', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'secretary_id', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'contact_email', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'description', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'notes', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'custom_fields', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'created_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'updated_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'created_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'updated_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committees', 'archived_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  -- collective_agreements: 37 canonical columns
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'cba_number', 'character varying', 'varchar', 'NO', 100, NULL, NULL, 'varchar(100) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'title', 'character varying', 'varchar', 'NO', 500, NULL, NULL, 'varchar(500) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'jurisdiction', 'USER-DEFINED', 'cba_jurisdiction', 'NO', NULL, NULL, NULL, '"cba_jurisdiction" NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'language', 'USER-DEFINED', 'cba_language', 'NO', NULL, NULL, NULL, '"cba_language" DEFAULT ''en'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'employer_name', 'character varying', 'varchar', 'NO', 300, NULL, NULL, 'varchar(300) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'employer_id', 'character varying', 'varchar', 'YES', 100, NULL, NULL, 'varchar(100)');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'union_name', 'character varying', 'varchar', 'NO', 300, NULL, NULL, 'varchar(300) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'union_local', 'character varying', 'varchar', 'YES', 100, NULL, NULL, 'varchar(100)');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'union_id', 'character varying', 'varchar', 'YES', 100, NULL, NULL, 'varchar(100)');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'effective_date', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'expiry_date', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'signed_date', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'ratification_date', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'industry_sector', 'character varying', 'varchar', 'NO', 200, NULL, NULL, 'varchar(200) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'sector', 'character varying', 'varchar', 'YES', 200, NULL, NULL, 'varchar(200)');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'employee_coverage', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'bargaining_unit_description', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'document_url', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'document_hash', 'character varying', 'varchar', 'YES', 64, NULL, NULL, 'varchar(64)');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'raw_text', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'structured_data', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'embedding', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'summary_generated', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'key_terms', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'ai_processed', 'boolean', 'bool', 'YES', NULL, NULL, NULL, 'boolean DEFAULT false');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'status', 'USER-DEFINED', 'cba_status', 'NO', NULL, NULL, NULL, '"cba_status" DEFAULT ''active'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'is_public', 'boolean', 'bool', 'YES', NULL, NULL, NULL, 'boolean DEFAULT false');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'view_count', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer DEFAULT 0');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'created_at', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'updated_at', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'created_by', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'last_modified_by', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'version', 'integer', 'int4', 'NO', NULL, NULL, NULL, 'integer DEFAULT 1 NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'superseded_by', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('collective_agreements', 'precedes_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  -- cba_clauses: 24 canonical columns
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'cba_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'clause_number', 'character varying', 'varchar', 'NO', 50, NULL, NULL, 'varchar(50) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'clause_type', 'USER-DEFINED', 'clause_type', 'NO', NULL, NULL, NULL, '"clause_type" NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'title', 'character varying', 'varchar', 'NO', 500, NULL, NULL, 'varchar(500) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'content', 'text', 'text', 'NO', NULL, NULL, NULL, 'text NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'content_plain_text', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'content_hash', 'character varying', 'varchar', 'YES', 64, NULL, NULL, 'varchar(64)');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'page_number', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'article_number', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'section_hierarchy', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'parent_clause_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'order_index', 'integer', 'int4', 'NO', NULL, NULL, NULL, 'integer DEFAULT 0 NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'embedding', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'confidence_score', 'numeric', 'numeric', 'YES', NULL, 5, 4, 'numeric(5, 4)');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'orgs', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'key_terms', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'related_clause_ids', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'interpretation_notes', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'view_count', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer DEFAULT 0');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'citation_count', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer DEFAULT 0');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'created_at', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cba_clauses', 'updated_at', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now() NOT NULL');
  -- cost_centers: 19 canonical columns
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'code', 'character varying', 'varchar', 'NO', 50, NULL, NULL, 'varchar(50) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'name', 'character varying', 'varchar', 'NO', 255, NULL, NULL, 'varchar(255) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'description', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'type', 'USER-DEFINED', 'cost_center_type', 'NO', NULL, NULL, NULL, '"cost_center_type" NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'parent_cost_center_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'manager', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'status', 'character varying', 'varchar', 'NO', 50, NULL, NULL, 'varchar(50) DEFAULT ''active'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'budget_amount', 'numeric', 'numeric', 'YES', NULL, 19, 2, 'numeric(19, 2)');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'budget_period', 'character varying', 'varchar', 'YES', 50, NULL, NULL, 'varchar(50)');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'budget_start_date', 'timestamp without time zone', 'timestamp', 'YES', NULL, NULL, NULL, 'timestamp');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'budget_end_date', 'timestamp without time zone', 'timestamp', 'YES', NULL, NULL, NULL, 'timestamp');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'warning_threshold', 'integer', 'int4', 'YES', NULL, NULL, NULL, 'integer DEFAULT 80');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'external_code', 'character varying', 'varchar', 'YES', 100, NULL, NULL, 'varchar(100)');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'created_at', 'timestamp without time zone', 'timestamp', 'NO', NULL, NULL, NULL, 'timestamp DEFAULT now() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'updated_at', 'timestamp without time zone', 'timestamp', 'NO', NULL, NULL, NULL, 'timestamp DEFAULT now() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'created_by', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');
  INSERT INTO ue_stub_column_contract VALUES ('cost_centers', 'updated_by', 'character varying', 'varchar', 'YES', 255, NULL, NULL, 'varchar(255)');

  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'grievance_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'user_id', 'text', 'text', 'NO', NULL, NULL, NULL, 'text NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'access_role', 'USER-DEFINED', 'case_access_role', 'NO', NULL, NULL, NULL, '"case_access_role" DEFAULT ''secondary_lro'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'granted_by', 'text', 'text', 'NO', NULL, NULL, NULL, 'text NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'granted_at', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'expires_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'can_comment', 'boolean', 'bool', 'NO', NULL, NULL, NULL, 'boolean DEFAULT true NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'can_upload_documents', 'boolean', 'bool', 'NO', NULL, NULL, NULL, 'boolean DEFAULT false NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'can_edit_case_notes', 'boolean', 'bool', 'NO', NULL, NULL, NULL, 'boolean DEFAULT false NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'can_draft_actions', 'boolean', 'bool', 'NO', NULL, NULL, NULL, 'boolean DEFAULT false NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'can_view_private_documents', 'boolean', 'bool', 'NO', NULL, NULL, NULL, 'boolean DEFAULT false NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'status', 'USER-DEFINED', 'case_access_status', 'NO', NULL, NULL, NULL, '"case_access_status" DEFAULT ''active'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('grievance_case_access_assignments', 'updated_at', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'document_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'user_id', 'text', 'text', 'NO', NULL, NULL, NULL, 'text NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'granted_by', 'text', 'text', 'NO', NULL, NULL, NULL, 'text NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'status', 'USER-DEFINED', 'document_grant_status', 'NO', NULL, NULL, NULL, '"document_grant_status" DEFAULT ''active'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'can_view', 'boolean', 'bool', 'NO', NULL, NULL, NULL, 'boolean DEFAULT true NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'can_download', 'boolean', 'bool', 'NO', NULL, NULL, NULL, 'boolean DEFAULT false NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'can_share', 'boolean', 'bool', 'NO', NULL, NULL, NULL, 'boolean DEFAULT false NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'expires_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'revoked_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  INSERT INTO ue_stub_column_contract VALUES ('document_access_grants', 'created_at', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('case_documents', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('case_documents', 'claim_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('case_documents', 'document_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('case_documents', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('case_documents', 'linked_by', 'text', 'text', 'NO', NULL, NULL, NULL, 'text NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('case_documents', 'linked_at', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('case_documents', 'link_type', 'text', 'text', 'YES', NULL, NULL, NULL, 'text DEFAULT ''attachment''');
  INSERT INTO ue_stub_column_contract VALUES ('case_documents', 'notes', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('case_documents', 'is_immutable', 'boolean', 'bool', 'YES', NULL, NULL, NULL, 'boolean DEFAULT false');
  INSERT INTO ue_stub_column_contract VALUES ('org_configurations', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('org_configurations', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('org_configurations', 'category', 'text', 'text', 'NO', NULL, NULL, NULL, 'text NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('org_configurations', 'key', 'text', 'text', 'NO', NULL, NULL, NULL, 'text NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('org_configurations', 'value', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('org_configurations', 'description', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('org_configurations', 'created_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('org_configurations', 'updated_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('org_configurations', 'updated_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'committee_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'meeting_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'title', 'character varying', 'varchar', 'NO', 500, NULL, NULL, 'varchar(500) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'description', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'status', 'USER-DEFINED', 'committee_action_item_status', 'NO', NULL, NULL, NULL, '"committee_action_item_status" DEFAULT ''pending'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'priority', 'USER-DEFINED', 'committee_action_item_priority', 'NO', NULL, NULL, NULL, '"committee_action_item_priority" DEFAULT ''medium'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'assigned_to', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'due_date', 'date', 'date', 'YES', NULL, NULL, NULL, 'date');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'completed_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'completed_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'resolution', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'carried_from_meeting_id', 'uuid', 'uuid', 'YES', NULL, NULL, NULL, 'uuid');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'carry_count', 'integer', 'int4', 'YES', NULL, 32, 0, 'integer DEFAULT 0');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'created_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'updated_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'created_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_action_items', 'updated_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'committee_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'organization_id', 'uuid', 'uuid', 'NO', NULL, NULL, NULL, 'uuid NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'title', 'character varying', 'varchar', 'NO', 500, NULL, NULL, 'varchar(500) NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'meeting_date', 'timestamp with time zone', 'timestamptz', 'NO', NULL, NULL, NULL, 'timestamp with time zone NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'end_time', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'location', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'virtual_link', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'status', 'USER-DEFINED', 'committee_meeting_status', 'NO', NULL, NULL, NULL, '"committee_meeting_status" DEFAULT ''scheduled'' NOT NULL');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'agenda', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'agenda_items', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'minutes', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'minutes_approved_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'minutes_approved_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'quorum_met', 'boolean', 'bool', 'YES', NULL, NULL, NULL, 'boolean');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'attendee_count', 'integer', 'int4', 'YES', NULL, 32, 0, 'integer DEFAULT 0');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'external_attendees', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'decisions', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'next_meeting_date', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'attachment_ids', 'jsonb', 'jsonb', 'YES', NULL, NULL, NULL, 'jsonb');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'created_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'updated_at', 'timestamp with time zone', 'timestamptz', 'YES', NULL, NULL, NULL, 'timestamp with time zone DEFAULT now()');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'created_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  INSERT INTO ue_stub_column_contract VALUES ('committee_meetings', 'updated_by', 'text', 'text', 'YES', NULL, NULL, NULL, 'text');
  FOR rel IN
    SELECT relname, count(*)::integer AS expected
    FROM ue_stub_column_contract
    GROUP BY relname
    ORDER BY min(ctid)
  LOOP
    IF to_regclass('public.' || rel.relname) IS NULL THEN
      CONTINUE;
    END IF;

    SELECT COALESCE(array_agg(a.attname::text ORDER BY a.attname), ARRAY[]::text[])
      INTO existing
    FROM pg_attribute a
    WHERE a.attrelid = to_regclass('public.' || rel.relname)
      AND a.attnum > 0
      AND NOT a.attisdropped;

    SELECT COALESCE(array_agg(column_name ORDER BY column_name), ARRAY[]::text[])
      INTO canonical
    FROM ue_stub_column_contract
    WHERE relname = rel.relname;

    IF existing @> canonical THEN
      EXECUTE format(
        'SELECT count(*) FROM information_schema.columns WHERE table_schema = %L AND table_name = %L AND (%s)',
        'public',
        rel.relname,
        (SELECT string_agg(
           format(
             '(column_name = %L AND data_type = %L AND udt_name = %L AND is_nullable = %L%s%s)',
             column_name,
             data_type,
             udt_name,
             is_nullable,
             CASE WHEN character_maximum_length IS NULL THEN ''
                  ELSE format(' AND character_maximum_length = %s', character_maximum_length) END,
             CASE WHEN numeric_precision IS NULL THEN ''
                  ELSE format(' AND numeric_precision = %s AND numeric_scale = %s', numeric_precision, numeric_scale) END
           ),
           ' OR '
         )
         FROM ue_stub_column_contract
         WHERE relname = rel.relname)
      ) INTO match_count;
      IF match_count = rel.expected THEN
        CONTINUE;
      END IF;
    END IF;

    IF NOT (canonical @> existing OR existing @> canonical) THEN
      RAISE EXCEPTION 'incompatible existing relation public.%: unrecognized historical columns (%). Rows were not rewritten.',
        rel.relname, existing;
    END IF;

    EXECUTE format('SELECT count(*) FROM public.%I', rel.relname) INTO row_count;

    FOR live IN
      SELECT column_name, data_type, udt_name, is_nullable, character_maximum_length, numeric_precision, numeric_scale
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = rel.relname
    LOOP
      SELECT * INTO expected
      FROM ue_stub_column_contract
      WHERE relname = rel.relname AND column_name = live.column_name;
      IF NOT FOUND THEN
        CONTINUE;
      END IF;

      IF live.udt_name = expected.udt_name
         AND live.data_type = expected.data_type
         AND live.is_nullable = expected.is_nullable
         AND live.character_maximum_length IS NOT DISTINCT FROM expected.character_maximum_length
         AND (expected.numeric_precision IS NULL OR live.numeric_precision IS NOT DISTINCT FROM expected.numeric_precision)
         AND (expected.numeric_scale IS NULL OR live.numeric_scale IS NOT DISTINCT FROM expected.numeric_scale) THEN
        CONTINUE;
      END IF;

      IF (live.udt_name = 'uuid' AND expected.udt_name = 'text')
         OR (live.udt_name = 'varchar' AND expected.udt_name = 'text') THEN
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN %I TYPE text USING %I::text',
          rel.relname, live.column_name, live.column_name
        );
        live.udt_name := 'text';
        live.data_type := 'text';
        live.character_maximum_length := NULL;
      END IF;

      IF live.udt_name = 'text' AND expected.data_type = 'USER-DEFINED' THEN
        EXECUTE format(
          'SELECT count(*) FROM public.%I AS historical_row WHERE historical_row.%I IS NOT NULL AND historical_row.%I::text NOT IN (
             SELECT e.enumlabel::text
             FROM pg_enum e
             JOIN pg_type ty ON ty.oid = e.enumtypid
             JOIN pg_namespace n ON n.oid = ty.typnamespace
             WHERE n.nspname = %L AND ty.typname = %L
           )',
          rel.relname, live.column_name, live.column_name, 'public', expected.udt_name
        ) INTO bad;
        IF bad > 0 THEN
          RAISE EXCEPTION 'incompatible existing relation public.%: % row(s) store a value outside public.%. Rows were not rewritten.',
            rel.relname, bad, expected.udt_name;
        END IF;
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP DEFAULT', rel.relname, live.column_name);
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN %I TYPE public.%I USING %I::text::public.%I',
          rel.relname, live.column_name, expected.udt_name, live.column_name, expected.udt_name
        );
        repair := substring(expected.add_sql from 'DEFAULT (''[^'']*'')');
        IF repair IS NOT NULL THEN
          EXECUTE format(
            'ALTER TABLE public.%I ALTER COLUMN %I SET DEFAULT %s',
            rel.relname, live.column_name, repair
          );
        END IF;
        live.udt_name := expected.udt_name;
        live.data_type := 'USER-DEFINED';
        live.character_maximum_length := NULL;
      END IF;

      IF live.udt_name = 'timestamptz' AND expected.udt_name = 'timestamp' THEN
        IF row_count > 0 THEN
          RAISE EXCEPTION 'incompatible existing relation public.%: % populated row(s) cannot change %. Rows were not rewritten.',
            rel.relname, row_count, live.column_name;
        END IF;
        EXECUTE format('ALTER TABLE public.%I DROP COLUMN %I', rel.relname, live.column_name);
        EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', rel.relname, live.column_name, expected.add_sql);
        CONTINUE;
      END IF;

      IF live.udt_name IS DISTINCT FROM expected.udt_name OR live.data_type IS DISTINCT FROM expected.data_type
         OR (expected.numeric_precision IS NOT NULL AND (
           live.numeric_precision IS DISTINCT FROM expected.numeric_precision
           OR live.numeric_scale IS DISTINCT FROM expected.numeric_scale
         )) THEN
        RAISE EXCEPTION 'incompatible existing relation public.%: column % has an unrecognized type. Rows were not rewritten.',
          rel.relname, live.column_name;
      END IF;

      IF live.udt_name = 'varchar'
         AND live.character_maximum_length IS DISTINCT FROM expected.character_maximum_length THEN
        IF live.character_maximum_length > expected.character_maximum_length AND row_count > 0 THEN
          EXECUTE format(
            'SELECT count(*) FROM public.%I WHERE length(%I::text) > %s',
            rel.relname, live.column_name, expected.character_maximum_length
          ) INTO too_long;
          IF too_long > 0 THEN
            RAISE EXCEPTION 'incompatible existing relation public.%: % row(s) exceed the canonical length of %. Rows were not rewritten.',
              rel.relname, too_long, live.column_name;
          END IF;
        END IF;
        EXECUTE format(
          'ALTER TABLE public.%I ALTER COLUMN %I TYPE varchar(%s)',
          rel.relname, live.column_name, expected.character_maximum_length
        );
      END IF;

      IF live.is_nullable = 'NO' AND expected.is_nullable = 'YES' THEN
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I DROP NOT NULL', rel.relname, live.column_name);
      ELSIF live.is_nullable = 'YES' AND expected.is_nullable = 'NO' THEN
        IF row_count > 0 THEN
          EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NULL', rel.relname, live.column_name) INTO nulls;
          IF nulls > 0 THEN
            RAISE EXCEPTION 'incompatible existing relation public.%: % populated row(s) have null %. Rows were not rewritten.',
              rel.relname, nulls, live.column_name;
          END IF;
        END IF;
        EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I SET NOT NULL', rel.relname, live.column_name);
      END IF;
    END LOOP;

    FOR expected IN
      SELECT * FROM ue_stub_column_contract
      WHERE relname = rel.relname
        AND column_name NOT IN (
          SELECT column_name FROM information_schema.columns
          WHERE table_schema = 'public' AND table_name = rel.relname
        )
    LOOP
      IF expected.is_nullable = 'NO' AND row_count > 0 THEN
        RAISE EXCEPTION 'incompatible existing relation public.%: % populated row(s) cannot gain canonical NOT NULL column % without a rewrite. Rows were not rewritten.',
          rel.relname, row_count, expected.column_name;
      END IF;
      EXECUTE format('ALTER TABLE public.%I ADD COLUMN %I %s', rel.relname, expected.column_name, expected.add_sql);
    END LOOP;

    EXECUTE format(
      'SELECT count(*) FROM information_schema.columns WHERE table_schema = %L AND table_name = %L AND (%s)',
      'public',
      rel.relname,
      (SELECT string_agg(
         format(
           '(column_name = %L AND data_type = %L AND udt_name = %L AND is_nullable = %L%s%s)',
           column_name,
           data_type,
           udt_name,
           is_nullable,
           CASE WHEN character_maximum_length IS NULL THEN ''
                ELSE format(' AND character_maximum_length = %s', character_maximum_length) END,
           CASE WHEN numeric_precision IS NULL THEN ''
                ELSE format(' AND numeric_precision = %s AND numeric_scale = %s', numeric_precision, numeric_scale) END
         ),
         ' OR '
       )
       FROM ue_stub_column_contract
       WHERE relname = rel.relname)
    ) INTO match_count;
    IF match_count IS DISTINCT FROM rel.expected THEN
      RAISE EXCEPTION 'incompatible existing relation public.%: canonical names are present but % column contracts are not satisfied (found %). Rows were not rewritten.',
        rel.relname, rel.expected, match_count;
    END IF;
  END LOOP;
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
  child_rel := to_regclass('public.grievance_case_access_assignments');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'grievance_case_access_assignments_grievance_id_grievances_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.grievances');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.grievances for grievance_case_access_assignments_grievance_id_grievances_id_fk';
    END IF;
    SELECT count(*) INTO orphans
    FROM public.grievance_case_access_assignments e
    LEFT JOIN public.grievances parent_row ON parent_row.id = e.grievance_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.grievance_case_access_assignments: % row(s) violate grievance_case_access_assignments_grievance_id_grievances_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.grievance_case_access_assignments
      ADD CONSTRAINT grievance_case_access_assignments_grievance_id_grievances_id_fk
      FOREIGN KEY (grievance_id) REFERENCES public.grievances(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.case_documents');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_documents_claim_id_claims_claim_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.claims');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.claims for case_documents_claim_id_claims_claim_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.case_documents e
    LEFT JOIN public.claims parent_row ON parent_row.claim_id = e.claim_id
    WHERE parent_row.claim_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.case_documents: % row(s) violate case_documents_claim_id_claims_claim_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.case_documents
      ADD CONSTRAINT case_documents_claim_id_claims_claim_id_fk
      FOREIGN KEY (claim_id) REFERENCES public.claims(claim_id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.case_documents');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_documents_document_id_documents_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.documents');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.documents for case_documents_document_id_documents_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.case_documents e
    LEFT JOIN public.documents parent_row ON parent_row.id = e.document_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.case_documents: % row(s) violate case_documents_document_id_documents_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.case_documents
      ADD CONSTRAINT case_documents_document_id_documents_id_fk
      FOREIGN KEY (document_id) REFERENCES public.documents(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.case_documents');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'case_documents_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for case_documents_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.case_documents e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.case_documents: % row(s) violate case_documents_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.case_documents
      ADD CONSTRAINT case_documents_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.document_access_grants');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_access_grants_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for document_access_grants_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.document_access_grants e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.document_access_grants: % row(s) violate document_access_grants_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.document_access_grants
      ADD CONSTRAINT document_access_grants_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.document_access_grants');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'document_access_grants_document_id_documents_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.documents');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.documents for document_access_grants_document_id_documents_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.document_access_grants e
    LEFT JOIN public.documents parent_row ON parent_row.id = e.document_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.document_access_grants: % row(s) violate document_access_grants_document_id_documents_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.document_access_grants
      ADD CONSTRAINT document_access_grants_document_id_documents_id_fk
      FOREIGN KEY (document_id) REFERENCES public.documents(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.org_configurations');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'org_configurations_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for org_configurations_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.org_configurations e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.org_configurations: % row(s) violate org_configurations_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.org_configurations
      ADD CONSTRAINT org_configurations_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_action_items');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_action_items_committee_id_committees_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.committees');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.committees for committee_action_items_committee_id_committees_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_action_items e
    LEFT JOIN public.committees parent_row ON parent_row.id = e.committee_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: % row(s) violate committee_action_items_committee_id_committees_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_action_items
      ADD CONSTRAINT committee_action_items_committee_id_committees_id_fk
      FOREIGN KEY (committee_id) REFERENCES public.committees(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_action_items');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_action_items_meeting_id_committee_meetings_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.committee_meetings');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.committee_meetings for committee_action_items_meeting_id_committee_meetings_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_action_items e
    LEFT JOIN public.committee_meetings parent_row ON parent_row.id = e.meeting_id
    WHERE e.meeting_id IS NOT NULL AND parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: % row(s) violate committee_action_items_meeting_id_committee_meetings_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_action_items
      ADD CONSTRAINT committee_action_items_meeting_id_committee_meetings_id_fk
      FOREIGN KEY (meeting_id) REFERENCES public.committee_meetings(id)
      ON DELETE set null ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_action_items');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_action_items_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for committee_action_items_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_action_items e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: % row(s) violate committee_action_items_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_action_items
      ADD CONSTRAINT committee_action_items_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_action_items');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_action_items_assigned_to_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committee_action_items_assigned_to_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_action_items e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.assigned_to
    WHERE e.assigned_to IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: % row(s) violate committee_action_items_assigned_to_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_action_items
      ADD CONSTRAINT committee_action_items_assigned_to_profiles_user_id_fk
      FOREIGN KEY (assigned_to) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_action_items');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_action_items_completed_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committee_action_items_completed_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_action_items e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.completed_by
    WHERE e.completed_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: % row(s) violate committee_action_items_completed_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_action_items
      ADD CONSTRAINT committee_action_items_completed_by_profiles_user_id_fk
      FOREIGN KEY (completed_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_action_items');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_action_items_carried_from_meeting_id_committee_meetings_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.committee_meetings');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.committee_meetings for committee_action_items_carried_from_meeting_id_committee_meetings_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_action_items e
    LEFT JOIN public.committee_meetings parent_row ON parent_row.id = e.carried_from_meeting_id
    WHERE e.carried_from_meeting_id IS NOT NULL AND parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: % row(s) violate committee_action_items_carried_from_meeting_id_committee_meetings_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_action_items
      ADD CONSTRAINT committee_action_items_carried_from_meeting_id_committee_meetings_id_fk
      FOREIGN KEY (carried_from_meeting_id) REFERENCES public.committee_meetings(id)
      ON DELETE set null ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_action_items');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_action_items_created_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committee_action_items_created_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_action_items e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.created_by
    WHERE e.created_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: % row(s) violate committee_action_items_created_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_action_items
      ADD CONSTRAINT committee_action_items_created_by_profiles_user_id_fk
      FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_action_items');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_action_items_updated_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committee_action_items_updated_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_action_items e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.updated_by
    WHERE e.updated_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_action_items: % row(s) violate committee_action_items_updated_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_action_items
      ADD CONSTRAINT committee_action_items_updated_by_profiles_user_id_fk
      FOREIGN KEY (updated_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_meetings');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_meetings_committee_id_committees_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.committees');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.committees for committee_meetings_committee_id_committees_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_meetings e
    LEFT JOIN public.committees parent_row ON parent_row.id = e.committee_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: % row(s) violate committee_meetings_committee_id_committees_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_meetings
      ADD CONSTRAINT committee_meetings_committee_id_committees_id_fk
      FOREIGN KEY (committee_id) REFERENCES public.committees(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_meetings');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_meetings_organization_id_organizations_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for committee_meetings_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_meetings e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: % row(s) violate committee_meetings_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_meetings
      ADD CONSTRAINT committee_meetings_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_meetings');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_meetings_minutes_approved_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committee_meetings_minutes_approved_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_meetings e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.minutes_approved_by
    WHERE e.minutes_approved_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: % row(s) violate committee_meetings_minutes_approved_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_meetings
      ADD CONSTRAINT committee_meetings_minutes_approved_by_profiles_user_id_fk
      FOREIGN KEY (minutes_approved_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_meetings');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_meetings_created_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committee_meetings_created_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_meetings e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.created_by
    WHERE e.created_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: % row(s) violate committee_meetings_created_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_meetings
      ADD CONSTRAINT committee_meetings_created_by_profiles_user_id_fk
      FOREIGN KEY (created_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.committee_meetings');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'committee_meetings_updated_by_profiles_user_id_fk' AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.profiles');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.profiles for committee_meetings_updated_by_profiles_user_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.committee_meetings e
    LEFT JOIN public.profiles parent_row ON parent_row.user_id = e.updated_by
    WHERE e.updated_by IS NOT NULL AND parent_row.user_id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.committee_meetings: % row(s) violate committee_meetings_updated_by_profiles_user_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.committee_meetings
      ADD CONSTRAINT committee_meetings_updated_by_profiles_user_id_fk
      FOREIGN KEY (updated_by) REFERENCES public.profiles(user_id)
      ON DELETE no action ON UPDATE no action;
  END IF;
  child_rel := to_regclass('public.member_jurisdiction_preferences');
  IF child_rel IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = left('member_jurisdiction_preferences_organization_id_organizations_id_fk', 63)
      AND conrelid = child_rel
  ) THEN
    parent_rel := to_regclass('public.organizations');
    IF parent_rel IS NULL THEN
      RAISE EXCEPTION 'missing parent public.organizations for member_jurisdiction_preferences_organization_id_organizations_id_fk';
    END IF;
    SELECT count(*) INTO orphans FROM public.member_jurisdiction_preferences e
    LEFT JOIN public.organizations parent_row ON parent_row.id = e.organization_id
    WHERE parent_row.id IS NULL;
    IF orphans > 0 THEN
      RAISE EXCEPTION 'incompatible existing relation public.member_jurisdiction_preferences: % row(s) violate member_jurisdiction_preferences_organization_id_organizations_id_fk. Rows were not rewritten.', orphans;
    END IF;
    ALTER TABLE public.member_jurisdiction_preferences
      ADD CONSTRAINT member_jurisdiction_preferences_organization_id_organizations_id_fk
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id)
      ON DELETE cascade ON UPDATE no action;
  END IF;
END
$ue$;
