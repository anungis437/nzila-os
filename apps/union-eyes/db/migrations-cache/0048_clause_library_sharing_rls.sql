-- 0048_clause_library_sharing_rls
--
-- The database policy the shared clause library has needed since its sharing authority was written (storage-authority manifest: "RLS_POLICY_HELPER_REQUIRED").
-- A clause has one owner and a sharing level that may let other organizations read it: private with an explicit grant list, federation, congress or
-- public. 0011/0012 gave the table the owner, explicit-grant and public SELECT policy only, so federation and congress readers could not be admitted by the
-- database, and the routes that serve them ran on the system role (which holds no privilege on the table in the activated grants, so they could not run at
-- all against the real roles) with a hand-written predicate as the only boundary between organizations.
--
-- This adds the missing rule as ONE function and ONE additional permissive SELECT policy for the runtime role:
--
--   ue_clause_readable_by(source, level, grants, reader)   the owner reads; public is read by anyone; private is read by an organization named in the grant
--                                                          list; federation by an organization whose nearest federation is the owner's nearest federation;
--                                                          congress by a CLC-affiliated organization with an active congress membership when the owner is too.
--                                                          Any other level reads for the owner only (fail closed).
--
-- The policy admits a federation or congress row only through that function, so the explicit-grant and public rows stay with the policy that already
-- covers them and nothing owner-only is widened. The functions are SECURITY DEFINER because they must read other organizations' hierarchy and congress
-- membership, which the tenant policy on those tables hides from a tenant; they are STABLE, pin their search_path, take no table name or SQL from the caller,
-- and are executable by the runtime and system roles only. The routes use the same function for the list, search, compare and item reads, so the list and
-- the item cannot disagree. ue_clause_source_name returns the owner's name only for a clause the caller may read, so it is not a directory of organizations.
--
-- "Nearest federation" is the deepest federation on the organization's hierarchy path (or the organization itself when it is one): with nested federations
-- the earlier code picked whichever row the database returned first.
-- Write authority is untouched: INSERT, UPDATE and DELETE stay owner-only, and reading a shared clause never implies writing it.

DO $$
BEGIN
  IF to_regclass('public.shared_clause_library') IS NULL OR to_regclass('public.organizations') IS NULL OR to_regclass('public.congress_memberships') IS NULL
     OR to_regclass('public.clause_library_tags') IS NULL THEN
    RAISE EXCEPTION 'RLS 0048 fail-closed: shared_clause_library, clause_library_tags, organizations or congress_memberships does not exist.';
  END IF;
  IF to_regrole('union_eyes_runtime') IS NULL OR to_regrole('union_eyes_system') IS NULL THEN
    RAISE EXCEPTION 'RLS 0048 fail-closed: the runtime or system role does not exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE schemaname = 'public' AND tablename = 'shared_clause_library' AND policyname = 'ue_shared_library_select'
  ) THEN
    RAISE EXCEPTION 'RLS 0048 fail-closed: the owner, grant and public policy (0011/0012) is not installed on shared_clause_library.';
  END IF;
  IF (
    SELECT count(*) FROM information_schema.columns
    WHERE table_schema = 'public'
      AND ((table_name = 'shared_clause_library' AND column_name IN ('source_organization_id', 'sharing_level', 'shared_with_org_ids'))
        OR (table_name = 'organizations' AND column_name IN ('hierarchy_path', 'hierarchy_level', 'organization_type', 'clc_affiliated', 'name'))
        OR (table_name = 'congress_memberships' AND column_name IN ('organization_id', 'status')))
  ) <> 10 THEN
    RAISE EXCEPTION 'RLS 0048 fail-closed: the clause sharing, hierarchy or congress membership columns are not as expected.';
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_clause_federation_ancestor(p_org uuid) RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT CASE
    WHEN o.organization_type = 'federation' THEN o.id
    ELSE (
      SELECT a.id FROM public.organizations a
       WHERE a.organization_type = 'federation' AND a.id::text = ANY (o.hierarchy_path::text[])
       ORDER BY a.hierarchy_level DESC, a.id
       LIMIT 1
    )
  END
  FROM public.organizations o
  WHERE o.id = p_org
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_clause_congress_eligible(p_org uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT EXISTS (
    SELECT 1
      FROM public.organizations o
      JOIN public.congress_memberships m ON m.organization_id = o.id AND m.status = 'active'
     WHERE o.id = p_org AND o.clc_affiliated IS TRUE
  )
$$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_clause_readable_by(p_source uuid, p_level text, p_grants uuid[], p_reader uuid) RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT COALESCE(
    p_source IS NOT NULL AND p_reader IS NOT NULL AND (
      p_source = p_reader
      OR p_level = 'public'
      OR (p_level = 'private' AND p_reader = ANY (COALESCE(p_grants, '{}'::uuid[])))
      OR (p_level = 'federation'
          AND public.ue_clause_federation_ancestor(p_reader) IS NOT NULL
          AND public.ue_clause_federation_ancestor(p_reader) = public.ue_clause_federation_ancestor(p_source))
      OR (p_level = 'congress'
          AND public.ue_clause_congress_eligible(p_reader)
          AND public.ue_clause_congress_eligible(p_source))
    ),
    false
  )
$$;
--> statement-breakpoint
-- The owner's name, only for a clause the caller's organization may read; the caller's organization is the one bound to the transaction.
CREATE OR REPLACE FUNCTION public.ue_clause_source_name(p_clause uuid) RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, public AS $$
  SELECT o.name
    FROM public.shared_clause_library c
    JOIN public.organizations o ON o.id = c.source_organization_id
   WHERE c.id = p_clause
     AND public.ue_clause_readable_by(
           c.source_organization_id, c.sharing_level, c.shared_with_org_ids,
           CASE WHEN current_setting('app.current_org_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                THEN current_setting('app.current_org_id', true)::uuid END)
$$;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.ue_clause_federation_ancestor(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.ue_clause_congress_eligible(uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.ue_clause_readable_by(uuid, text, uuid[], uuid) FROM PUBLIC;
--> statement-breakpoint
REVOKE ALL ON FUNCTION public.ue_clause_source_name(uuid) FROM PUBLIC;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.ue_clause_federation_ancestor(uuid) TO union_eyes_runtime, union_eyes_system;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.ue_clause_congress_eligible(uuid) TO union_eyes_runtime, union_eyes_system;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.ue_clause_readable_by(uuid, text, uuid[], uuid) TO union_eyes_runtime, union_eyes_system;
--> statement-breakpoint
GRANT EXECUTE ON FUNCTION public.ue_clause_source_name(uuid) TO union_eyes_runtime, union_eyes_system;
--> statement-breakpoint
DROP POLICY IF EXISTS ue_shared_library_select_sharing ON public.shared_clause_library;
--> statement-breakpoint
CREATE POLICY ue_shared_library_select_sharing ON public.shared_clause_library
  AS PERMISSIVE
  FOR SELECT
  TO union_eyes_runtime
  USING (
    sharing_level IN ('federation', 'congress')
    AND public.ue_clause_readable_by(
      source_organization_id, sharing_level, shared_with_org_ids,
      CASE WHEN current_setting('app.current_org_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
           THEN current_setting('app.current_org_id', true)::uuid END)
  );
--> statement-breakpoint
DROP POLICY IF EXISTS ue_shared_library_child_select_sharing ON public.clause_library_tags;
--> statement-breakpoint
-- A clause's tags follow the clause: whoever the sharing rule admits to a federation or congress clause reads its tags too. The subquery on the parent is
-- itself subject to the parent's policies, and the existing child policies keep covering the owner, explicit-grant and public rows.
CREATE POLICY ue_shared_library_child_select_sharing ON public.clause_library_tags
  AS PERMISSIVE
  FOR SELECT
  TO union_eyes_runtime
  USING (
    EXISTS (
      SELECT 1
        FROM public.shared_clause_library parent
       WHERE parent.id = clause_library_tags.clause_id
         AND parent.sharing_level IN ('federation', 'congress')
         AND public.ue_clause_readable_by(
               parent.source_organization_id, parent.sharing_level, parent.shared_with_org_ids,
               CASE WHEN current_setting('app.current_org_id', true) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'
                    THEN current_setting('app.current_org_id', true)::uuid END)
    )
  );
