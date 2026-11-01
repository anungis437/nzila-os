-- 0050_clause_library_sharing_functions_retired rollback: restores the objects cache 0048 created (the four helper functions and the two federation
-- and congress policies). They are SECURITY DEFINER functions executable by the runtime and system roles, which the catalog admission contract
-- refuses, so a database that applies this rollback fails the privilege preflight until 0050 is applied again.

DO $$
BEGIN
  IF to_regclass('public.shared_clause_library') IS NULL OR to_regclass('public.organizations') IS NULL OR to_regclass('public.congress_memberships') IS NULL
     OR to_regclass('public.clause_library_tags') IS NULL THEN
    RAISE EXCEPTION 'rollback of 0050 fail-closed: shared_clause_library, clause_library_tags, organizations or congress_memberships does not exist.';
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
