-- Rollback of 0048_clause_library_sharing_rls: federation and congress clauses are again readable only through the application predicate.
DROP POLICY IF EXISTS ue_shared_library_child_select_sharing ON public.clause_library_tags;
DROP POLICY IF EXISTS ue_shared_library_select_sharing ON public.shared_clause_library;
DROP FUNCTION IF EXISTS public.ue_clause_source_name(uuid);
DROP FUNCTION IF EXISTS public.ue_clause_readable_by(uuid, text, uuid[], uuid);
DROP FUNCTION IF EXISTS public.ue_clause_congress_eligible(uuid);
DROP FUNCTION IF EXISTS public.ue_clause_federation_ancestor(uuid);
