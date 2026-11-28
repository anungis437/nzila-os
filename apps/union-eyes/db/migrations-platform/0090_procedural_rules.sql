-- Platform migration procedural_rules
--
-- Versioned procedural intelligence (lib/procedural-rules). Institution-neutral storage for procedural regimes
-- (collective agreements, side letters, statutes) as governed data, never as code:
--   procedural_rule_sources           the instrument a rule is read from: edition, language, effective/supersession dates, reference
--   procedural_rule_sets              versioned rule sets: explicit applicability, stages, transitions and clocks (definition jsonb)
--   procedural_holiday_calendars      versioned holiday calendars with a source and a coverage span
--   procedural_rule_lifecycle_events  append-only record of every draft -> reviewed -> adopted (-> superseded | retired) step
--   grievance_procedure_bindings      the facts a grievance records for rule selection (one current binding per grievance)
--   grievance_procedural_facts        recorded trigger events, pauses, extensions, level hearings and waivers (voided, never deleted)
--   grievance_procedural_exceptions   reviewable exceptions raised instead of a deadline when applicability is uncertain
--
-- Only adopted rules execute. Content is frozen once a version leaves draft; a change is a new version. The drafter can neither
-- review nor adopt their own draft (CHECK). Status moves only along the lifecycle (trigger). Every table carries a direct
-- organization_id uuid NOT NULL; RLS is applied by scoped (cache) 0063 with ue_create_direct_org_rls_policy. This migration
-- grants no DML: exact privileges come from the storage-authority manifest. Additive and idempotent.
DO $ue_procedural_prereq$
BEGIN
  IF to_regclass('public.grievances') IS NULL OR to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'platform procedural_rules fail-closed: public.grievances and public.organizations must exist.';
  END IF;
END $ue_procedural_prereq$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.procedural_rule_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  source_kind text NOT NULL CHECK (source_kind IN ('collective_agreement','side_letter','letter_of_understanding','statute','regulation','policy','other')),
  title text NOT NULL CHECK (length(btrim(title)) > 0),
  edition text NOT NULL CHECK (length(btrim(edition)) > 0),
  language text NOT NULL CHECK (language ~ '^[a-z]{2}(-[A-Z]{2})?$'),
  reference text NOT NULL CHECK (length(btrim(reference)) > 0),
  effective_from date NOT NULL,
  effective_to date,
  supersedes_source_id uuid REFERENCES public.procedural_rule_sources(id),
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT procedural_rule_sources_dates_ck CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT procedural_rule_sources_not_self_ck CHECK (supersedes_source_id IS NULL OR supersedes_source_id <> id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_procedural_rule_sources_org ON public.procedural_rule_sources (organization_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.procedural_rule_sets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  rule_key text NOT NULL CHECK (rule_key ~ '^[a-z0-9][a-z0-9_./-]{0,119}$'),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','adopted','superseded','retired')),
  origin text NOT NULL CHECK (origin IN ('human_authored','ai_assisted_extraction','imported')),
  source_id uuid NOT NULL REFERENCES public.procedural_rule_sources(id),
  regime text NOT NULL CHECK (length(btrim(regime)) > 0),
  procedure_route text NOT NULL CHECK (length(btrim(procedure_route)) > 0),
  applicability jsonb NOT NULL,
  effective_from date NOT NULL,
  effective_to date,
  definition jsonb NOT NULL,
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  drafted_by text NOT NULL,
  drafted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamptz,
  adopted_by text,
  adopted_at timestamptz,
  closed_by text,
  closed_at timestamptz,
  CONSTRAINT procedural_rule_sets_key_version_uq UNIQUE (organization_id, rule_key, version),
  CONSTRAINT procedural_rule_sets_dates_ck CHECK (effective_to IS NULL OR effective_to > effective_from),
  CONSTRAINT procedural_rule_sets_independent_review_ck CHECK (reviewed_by IS NULL OR reviewed_by <> drafted_by),
  CONSTRAINT procedural_rule_sets_independent_adoption_ck CHECK (adopted_by IS NULL OR adopted_by <> drafted_by),
  CONSTRAINT procedural_rule_sets_reviewed_ck CHECK (status = 'draft' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR status = 'retired'),
  CONSTRAINT procedural_rule_sets_adopted_ck CHECK (status NOT IN ('adopted','superseded') OR (adopted_by IS NOT NULL AND adopted_at IS NOT NULL))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_procedural_rule_sets_selection ON public.procedural_rule_sets (organization_id, regime, procedure_route, status);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.procedural_holiday_calendars (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  calendar_key text NOT NULL CHECK (calendar_key ~ '^[a-z0-9][a-z0-9_./-]{0,119}$'),
  version integer NOT NULL CHECK (version > 0),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','reviewed','adopted','superseded','retired')),
  origin text NOT NULL CHECK (origin IN ('human_authored','ai_assisted_extraction','imported')),
  source_reference text NOT NULL CHECK (length(btrim(source_reference)) > 0),
  coverage_from date NOT NULL,
  coverage_to date NOT NULL,
  days date[] NOT NULL,
  content_digest text NOT NULL CHECK (content_digest ~ '^[0-9a-f]{64}$'),
  drafted_by text NOT NULL,
  drafted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_by text,
  reviewed_at timestamptz,
  adopted_by text,
  adopted_at timestamptz,
  closed_by text,
  closed_at timestamptz,
  CONSTRAINT procedural_holiday_calendars_key_version_uq UNIQUE (organization_id, calendar_key, version),
  CONSTRAINT procedural_holiday_calendars_coverage_ck CHECK (coverage_to >= coverage_from),
  CONSTRAINT procedural_holiday_calendars_independent_review_ck CHECK (reviewed_by IS NULL OR reviewed_by <> drafted_by),
  CONSTRAINT procedural_holiday_calendars_independent_adoption_ck CHECK (adopted_by IS NULL OR adopted_by <> drafted_by),
  CONSTRAINT procedural_holiday_calendars_reviewed_ck CHECK (status = 'draft' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL) OR status = 'retired'),
  CONSTRAINT procedural_holiday_calendars_adopted_ck CHECK (status NOT IN ('adopted','superseded') OR (adopted_by IS NOT NULL AND adopted_at IS NOT NULL))
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.procedural_rule_lifecycle_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  subject_type text NOT NULL CHECK (subject_type IN ('rule_set','holiday_calendar')),
  subject_id uuid NOT NULL,
  from_status text,
  to_status text NOT NULL CHECK (to_status IN ('draft','reviewed','adopted','superseded','retired')),
  actor_id text NOT NULL,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_procedural_rule_lifecycle_subject ON public.procedural_rule_lifecycle_events (organization_id, subject_type, subject_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.grievance_procedure_bindings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  grievance_id uuid NOT NULL REFERENCES public.grievances(id),
  regime text,
  procedure_route text,
  employer_ref text,
  bargaining_group text,
  classification text,
  matter_category text,
  reference_day date,
  determinations jsonb NOT NULL DEFAULT '{}'::jsonb,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  superseded_by text,
  superseded_at timestamptz,
  CONSTRAINT grievance_procedure_bindings_superseded_ck CHECK ((superseded_by IS NULL) = (superseded_at IS NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_grievance_procedure_bindings_current ON public.grievance_procedure_bindings (grievance_id) WHERE superseded_at IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.grievance_procedural_facts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  grievance_id uuid NOT NULL REFERENCES public.grievances(id),
  fact_kind text NOT NULL CHECK (fact_kind IN ('trigger','pause','extension','level_hearing','level_waiver')),
  payload jsonb NOT NULL,
  recorded_by text NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  voided_by text,
  voided_at timestamptz,
  void_reason text,
  CONSTRAINT grievance_procedural_facts_void_ck CHECK ((voided_by IS NULL) = (voided_at IS NULL) AND (voided_at IS NULL OR length(btrim(coalesce(void_reason, ''))) > 0))
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS idx_grievance_procedural_facts_grievance ON public.grievance_procedural_facts (grievance_id, fact_kind) WHERE voided_at IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.grievance_procedural_exceptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations(id),
  grievance_id uuid NOT NULL REFERENCES public.grievances(id),
  clock_key text NOT NULL,
  codes text[] NOT NULL CHECK (cardinality(codes) > 0),
  evidence jsonb NOT NULL,
  evidence_digest text NOT NULL CHECK (evidence_digest ~ '^[0-9a-f]{64}$'),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','resolved','superseded')),
  raised_by text NOT NULL,
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_by text,
  resolved_at timestamptz,
  resolution text,
  CONSTRAINT grievance_procedural_exceptions_resolution_ck CHECK (status = 'open' OR (resolved_by IS NOT NULL AND resolved_at IS NOT NULL AND length(btrim(coalesce(resolution, ''))) > 0))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ux_grievance_procedural_exceptions_open ON public.grievance_procedural_exceptions (grievance_id, clock_key) WHERE status = 'open';
--> statement-breakpoint
-- A grievance-scoped row belongs to the grievance's own organization.
CREATE OR REPLACE FUNCTION public.procedural_grievance_same_org() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.grievances g WHERE g.id = NEW.grievance_id AND g.organization_id = NEW.organization_id) THEN
    RAISE EXCEPTION '%: grievance % is not in organization %', TG_TABLE_NAME, NEW.grievance_id, NEW.organization_id USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $ue_fn$;
--> statement-breakpoint
-- Lifecycle guard shared by rule sets and holiday calendars: content is frozen once a version leaves draft, identity and
-- authorship never change, and status moves only along draft -> reviewed -> adopted -> superseded|retired (reviewed may
-- return to draft; draft and reviewed may be retired).
CREATE OR REPLACE FUNCTION public.procedural_versioned_rule_guard() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
DECLARE
  allowed boolean;
  old_content jsonb := to_jsonb(OLD) - ARRAY['status','reviewed_by','reviewed_at','adopted_by','adopted_at','closed_by','closed_at'];
  new_content jsonb := to_jsonb(NEW) - ARRAY['status','reviewed_by','reviewed_at','adopted_by','adopted_at','closed_by','closed_at'];
BEGIN
  IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  IF OLD.status <> 'draft' AND old_content IS DISTINCT FROM new_content THEN
    RAISE EXCEPTION '%: content is frozen once a version leaves draft; create a new version', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF OLD.id IS DISTINCT FROM NEW.id OR OLD.organization_id IS DISTINCT FROM NEW.organization_id OR OLD.drafted_by IS DISTINCT FROM NEW.drafted_by OR OLD.origin IS DISTINCT FROM NEW.origin THEN
    RAISE EXCEPTION '%: identity and authorship cannot change', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    allowed := (OLD.status, NEW.status) IN (('draft','reviewed'),('draft','retired'),('reviewed','adopted'),('reviewed','draft'),('reviewed','retired'),('adopted','superseded'),('adopted','retired'));
    IF NOT allowed THEN
      RAISE EXCEPTION '%: a version cannot move from % to %', TG_TABLE_NAME, OLD.status, NEW.status USING ERRCODE = 'check_violation';
    END IF;
  END IF;
  IF OLD.status IN ('superseded','retired') THEN
    RAISE EXCEPTION '%: a closed version cannot change', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $ue_fn$;
--> statement-breakpoint
-- Insert-only records: sources, lifecycle events. A no-op UPDATE (every column unchanged) is let through; any change is refused.
CREATE OR REPLACE FUNCTION public.procedural_append_only() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
BEGIN
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  RAISE EXCEPTION '%: rows are append-only', TG_TABLE_NAME USING ERRCODE = 'check_violation';
END $ue_fn$;
--> statement-breakpoint
-- Facts and bindings: the only update is voiding/superseding, once; nothing else changes.
CREATE OR REPLACE FUNCTION public.procedural_void_only() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
DECLARE
  closing text[] := CASE WHEN TG_TABLE_NAME = 'grievance_procedure_bindings' THEN ARRAY['superseded_by','superseded_at'] ELSE ARRAY['voided_by','voided_at','void_reason'] END;
  marker text := CASE WHEN TG_TABLE_NAME = 'grievance_procedure_bindings' THEN 'superseded_at' ELSE 'voided_at' END;
BEGIN
  IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  IF (to_jsonb(OLD) ->> marker) IS NOT NULL THEN
    RAISE EXCEPTION '%: a closed record cannot change', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  IF (to_jsonb(OLD) - closing) IS DISTINCT FROM (to_jsonb(NEW) - closing) THEN
    RAISE EXCEPTION '%: only the closing columns may be set', TG_TABLE_NAME USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $ue_fn$;
--> statement-breakpoint
-- Exceptions: evidence and identity are fixed; only the resolution columns move, from open, once.
CREATE OR REPLACE FUNCTION public.procedural_exception_guard() RETURNS trigger LANGUAGE plpgsql AS $ue_fn$
DECLARE
  resolution_cols text[] := ARRAY['status','resolved_by','resolved_at','resolution'];
BEGIN
  IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  IF OLD.status <> 'open' THEN
    RAISE EXCEPTION 'grievance_procedural_exceptions: a resolved exception cannot change' USING ERRCODE = 'check_violation';
  END IF;
  IF (to_jsonb(OLD) - resolution_cols) IS DISTINCT FROM (to_jsonb(NEW) - resolution_cols) THEN
    RAISE EXCEPTION 'grievance_procedural_exceptions: only the resolution may be recorded' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END $ue_fn$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS procedural_rule_sources_append_only ON public.procedural_rule_sources;
--> statement-breakpoint
CREATE TRIGGER procedural_rule_sources_append_only BEFORE UPDATE OR DELETE ON public.procedural_rule_sources
  FOR EACH ROW EXECUTE FUNCTION public.procedural_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS procedural_rule_lifecycle_events_append_only ON public.procedural_rule_lifecycle_events;
--> statement-breakpoint
CREATE TRIGGER procedural_rule_lifecycle_events_append_only BEFORE UPDATE OR DELETE ON public.procedural_rule_lifecycle_events
  FOR EACH ROW EXECUTE FUNCTION public.procedural_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS procedural_rule_sets_guard ON public.procedural_rule_sets;
--> statement-breakpoint
CREATE TRIGGER procedural_rule_sets_guard BEFORE UPDATE ON public.procedural_rule_sets
  FOR EACH ROW EXECUTE FUNCTION public.procedural_versioned_rule_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS procedural_rule_sets_no_delete ON public.procedural_rule_sets;
--> statement-breakpoint
CREATE TRIGGER procedural_rule_sets_no_delete BEFORE DELETE ON public.procedural_rule_sets
  FOR EACH ROW EXECUTE FUNCTION public.procedural_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS procedural_holiday_calendars_guard ON public.procedural_holiday_calendars;
--> statement-breakpoint
CREATE TRIGGER procedural_holiday_calendars_guard BEFORE UPDATE ON public.procedural_holiday_calendars
  FOR EACH ROW EXECUTE FUNCTION public.procedural_versioned_rule_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS procedural_holiday_calendars_no_delete ON public.procedural_holiday_calendars;
--> statement-breakpoint
CREATE TRIGGER procedural_holiday_calendars_no_delete BEFORE DELETE ON public.procedural_holiday_calendars
  FOR EACH ROW EXECUTE FUNCTION public.procedural_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_procedure_bindings_same_org ON public.grievance_procedure_bindings;
--> statement-breakpoint
CREATE TRIGGER grievance_procedure_bindings_same_org BEFORE INSERT ON public.grievance_procedure_bindings
  FOR EACH ROW EXECUTE FUNCTION public.procedural_grievance_same_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_procedure_bindings_void_only ON public.grievance_procedure_bindings;
--> statement-breakpoint
CREATE TRIGGER grievance_procedure_bindings_void_only BEFORE UPDATE ON public.grievance_procedure_bindings
  FOR EACH ROW EXECUTE FUNCTION public.procedural_void_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_procedure_bindings_no_delete ON public.grievance_procedure_bindings;
--> statement-breakpoint
CREATE TRIGGER grievance_procedure_bindings_no_delete BEFORE DELETE ON public.grievance_procedure_bindings
  FOR EACH ROW EXECUTE FUNCTION public.procedural_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_procedural_facts_same_org ON public.grievance_procedural_facts;
--> statement-breakpoint
CREATE TRIGGER grievance_procedural_facts_same_org BEFORE INSERT ON public.grievance_procedural_facts
  FOR EACH ROW EXECUTE FUNCTION public.procedural_grievance_same_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_procedural_facts_void_only ON public.grievance_procedural_facts;
--> statement-breakpoint
CREATE TRIGGER grievance_procedural_facts_void_only BEFORE UPDATE ON public.grievance_procedural_facts
  FOR EACH ROW EXECUTE FUNCTION public.procedural_void_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_procedural_facts_no_delete ON public.grievance_procedural_facts;
--> statement-breakpoint
CREATE TRIGGER grievance_procedural_facts_no_delete BEFORE DELETE ON public.grievance_procedural_facts
  FOR EACH ROW EXECUTE FUNCTION public.procedural_append_only();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_procedural_exceptions_same_org ON public.grievance_procedural_exceptions;
--> statement-breakpoint
CREATE TRIGGER grievance_procedural_exceptions_same_org BEFORE INSERT ON public.grievance_procedural_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.procedural_grievance_same_org();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_procedural_exceptions_guard ON public.grievance_procedural_exceptions;
--> statement-breakpoint
CREATE TRIGGER grievance_procedural_exceptions_guard BEFORE UPDATE ON public.grievance_procedural_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.procedural_exception_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS grievance_procedural_exceptions_no_delete ON public.grievance_procedural_exceptions;
--> statement-breakpoint
CREATE TRIGGER grievance_procedural_exceptions_no_delete BEFORE DELETE ON public.grievance_procedural_exceptions
  FOR EACH ROW EXECUTE FUNCTION public.procedural_append_only();
