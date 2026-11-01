-- PLATFORM_SQL 0058_pilot_fixture_rows
--
-- The CUPE pilot bootstrap seeds a demo organization (members and grievances under fixed fixture identities) and, on request, resets it. Until
-- now the only thing that said a row was fixture data was that its identity (a user id or a case number) appeared in the fixture file, and the
-- only thing that said an organization was a fixture organization was a pilot event. A reset therefore trusted a coincidence of names.
--
-- This migration adds the origin ledger. One row says: "this bootstrap created this row (or this organization) from this fixture". A reset
-- deletes exactly the rows the ledger names and nothing else; a row that is not in the ledger is not fixture data, whatever it is called.
--
--   * resource_type 'organization' marks the organization itself (resource_id = organization_id); the bootstrap refuses to seed into or reset
--     an organization that is not marked.
--   * resource_type 'organization_member' and 'grievance' record the primary key of each row the bootstrap actually inserted. A row skipped
--     because it already existed is never recorded, so it is never claimed.
--   * The ledger names row identifiers only. It holds no member name, address or case content.
--
-- Idempotent. Registered UNQUALIFIED. Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION. RLS is cache 0046.
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('public.organizations') IS NULL THEN
    RAISE EXCEPTION 'pilot fixture rows fail-closed: public.organizations does not exist.';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.pilot_fixture_rows (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL REFERENCES public.organizations (id) ON DELETE CASCADE,
  fixture_source varchar(100) NOT NULL,
  resource_type varchar(40) NOT NULL,
  resource_id uuid NOT NULL,
  seeded_by varchar(255) NOT NULL,
  seeded_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT pilot_fixture_rows_resource_uq UNIQUE (organization_id, resource_type, resource_id),
  CONSTRAINT pilot_fixture_rows_type_check CHECK (resource_type IN ('organization', 'organization_member', 'grievance')),
  CONSTRAINT pilot_fixture_rows_organization_check CHECK (resource_type <> 'organization' OR resource_id = organization_id)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS pilot_fixture_rows_org_source_idx ON public.pilot_fixture_rows (organization_id, fixture_source);
