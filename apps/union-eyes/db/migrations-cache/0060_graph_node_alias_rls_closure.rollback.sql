-- Rollback for 0060_graph_node_alias_rls_closure: disables RLS on ue_graph_node_alias and drops its policies.
-- Forward recovery only; confirm nothing relies on tenant isolation for this table before rolling back.
DO $$
BEGIN
  IF to_regclass('public.ue_graph_node_alias') IS NOT NULL THEN
    ALTER TABLE public.ue_graph_node_alias DISABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS ue_org_isolation_select ON public.ue_graph_node_alias;
    DROP POLICY IF EXISTS ue_org_isolation_insert ON public.ue_graph_node_alias;
    DROP POLICY IF EXISTS ue_org_isolation_update ON public.ue_graph_node_alias;
    DROP POLICY IF EXISTS ue_org_isolation_delete ON public.ue_graph_node_alias;
    DROP POLICY IF EXISTS ue_system_full_access ON public.ue_graph_node_alias;
  END IF;
END $$;
