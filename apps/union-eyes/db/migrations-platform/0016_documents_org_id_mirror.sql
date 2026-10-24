-- PLATFORM_SQL 0016_documents_org_id_mirror
--
-- The Drizzle declaration of public.documents carries a second tenant column, org_id, beside organization_id, and
-- the external grievance document upload writes both. The deployed relation has only organization_id, so every
-- select through the declaration names a column that does not exist and the external upload cannot insert.
--
-- The column is added additively and NULLABLE as a mirror, and a check forces it to equal organization_id whenever it
-- is set, so it can never name a different tenant than the row's authoritative one. Tenant authority stays on
-- organization_id (row-level security is keyed to it); org_id grants nothing.

DO $$
BEGIN
  IF to_regclass('public.documents') IS NULL THEN
    RAISE EXCEPTION 'platform 0016 fail-closed: public.documents does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.documents ADD COLUMN IF NOT EXISTS org_id uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.documents'::regclass AND conname = 'documents_org_id_mirrors_organization_id'
  ) THEN
    ALTER TABLE public.documents
      ADD CONSTRAINT documents_org_id_mirrors_organization_id CHECK (org_id IS NULL OR org_id = organization_id);
  END IF;
END $$;
