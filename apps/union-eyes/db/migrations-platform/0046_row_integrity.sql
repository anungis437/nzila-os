-- PLATFORM_SQL 0046_row_integrity
--
-- Three integrity gaps that the application could only check, not settle:
--
--   1. member_jurisdiction_preferences had no unique row per (user_id, organization_id), so two concurrent first saves inserted two
--      rows and a read returned an arbitrary one. A unique index takes its place; the route upserts against it.
--   2. employers.parent_company_id is a foreign key to employers.id with no organization condition, so an employer of one
--      organization could name another organization's employer as its parent. A trigger refuses a parent of another organization
--      (SQLSTATE 23514) and a self-parent; the routes also check before the write.
--   3. external_document_access_grants had no version column, so a download released whichever version was highest at the time of
--      the request, including a version added after the grant. document_version_no pins the version the grant covers; a grant with no
--      pin (every grant issued before this migration) keeps its earlier meaning and is not rewritten.
--
-- Fail closed: duplicate preference rows or an existing cross-organization parent abort the migration and nothing is deleted or
-- rewritten. Relations that do not exist are skipped. Idempotent.
-- Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
DECLARE
  dup bigint;
BEGIN
  IF to_regclass('public.member_jurisdiction_preferences') IS NOT NULL THEN
    SELECT count(*) INTO dup FROM (
      SELECT 1 FROM public.member_jurisdiction_preferences GROUP BY user_id, organization_id HAVING count(*) > 1
    ) d;
    IF dup > 0 THEN
      RAISE EXCEPTION 'row integrity fail-closed: % user/organization pair(s) hold more than one jurisdiction preference row. Rows were not rewritten.', dup;
    END IF;
    CREATE UNIQUE INDEX IF NOT EXISTS member_jurisdiction_preferences_user_org_uq
      ON public.member_jurisdiction_preferences (user_id, organization_id);
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  bad bigint;
BEGIN
  IF to_regclass('public.employers') IS NULL THEN
    RETURN;
  END IF;
  SELECT count(*) INTO bad
  FROM public.employers c
  JOIN public.employers p ON p.id = c.parent_company_id
  WHERE p.organization_id IS DISTINCT FROM c.organization_id OR p.id = c.id;
  IF bad > 0 THEN
    RAISE EXCEPTION 'row integrity fail-closed: % employer(s) name a parent of another organization or themselves. Rows were not rewritten.', bad;
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_employers_parent_same_organization() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  parent_org uuid;
BEGIN
  IF NEW.parent_company_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF NEW.parent_company_id = NEW.id THEN
    RAISE EXCEPTION 'an employer cannot be its own parent' USING ERRCODE = '23514';
  END IF;
  SELECT organization_id INTO parent_org FROM public.employers WHERE id = NEW.parent_company_id;
  IF parent_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'parent employer must belong to the same organization' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.employers') IS NOT NULL THEN
    DROP TRIGGER IF EXISTS ue_employers_parent_same_organization ON public.employers;
    CREATE TRIGGER ue_employers_parent_same_organization
      BEFORE INSERT OR UPDATE OF parent_company_id, organization_id ON public.employers
      FOR EACH ROW EXECUTE FUNCTION public.ue_employers_parent_same_organization();
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.external_document_access_grants') IS NOT NULL THEN
    ALTER TABLE public.external_document_access_grants ADD COLUMN IF NOT EXISTS document_version_no integer;
    IF NOT EXISTS (
      SELECT 1 FROM pg_constraint WHERE conname = 'external_document_grants_version_positive'
        AND conrelid = 'public.external_document_access_grants'::regclass
    ) THEN
      ALTER TABLE public.external_document_access_grants
        ADD CONSTRAINT external_document_grants_version_positive CHECK (document_version_no IS NULL OR document_version_no > 0);
    END IF;
  END IF;
END $$;
