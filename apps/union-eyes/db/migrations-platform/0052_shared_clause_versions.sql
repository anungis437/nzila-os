-- PLATFORM_SQL 0052_shared_clause_versions
--
-- Editing a shared clause overwrote its text in place, and deleting one removed the row and its tags for good, so an organization that
-- compared or cited a clause saw it change silently or vanish and the only trace was an audit record holding a digest. This migration
-- adds shared_clause_versions: an append-only history of the text a clause had before each change and of the final text when it is
-- deleted. A version row is written by the same transaction as the change (route app/api/clause-library/[id]), so the history cannot be
-- missing for a change that committed.
--
--   * clause_id has NO foreign key: the history must outlive the clause it describes.
--   * (clause_id, version, change_kind) is unique, so a retried request cannot record the same replaced version twice.
--   * text_sha256 lets a reader check the stored text against the digest the audit record carries.
--
-- The application roles may read and insert (cache 0042 limits them to their own organization) and may not change or remove a row.
-- Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'shared clause versions fail-closed: public.organizations does not exist.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.shared_clause_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  clause_id uuid NOT NULL,
  version integer NOT NULL,
  change_kind varchar(20) NOT NULL,
  clause_number varchar(50),
  clause_title varchar(500) NOT NULL,
  clause_text text NOT NULL,
  clause_type varchar(100) NOT NULL,
  sharing_level varchar(50) NOT NULL,
  text_sha256 varchar(64) NOT NULL,
  recorded_by varchar(255) NOT NULL,
  recorded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shared_clause_versions_kind_check CHECK (change_kind IN ('replaced', 'deleted')),
  CONSTRAINT shared_clause_versions_sha_check CHECK (text_sha256 ~ '^[0-9a-f]{64}$'),
  CONSTRAINT shared_clause_versions_unique UNIQUE (clause_id, version, change_kind)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shared_clause_versions_clause_idx ON public.shared_clause_versions (clause_id, version DESC);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS shared_clause_versions_org_idx ON public.shared_clause_versions (organization_id, recorded_at DESC);
