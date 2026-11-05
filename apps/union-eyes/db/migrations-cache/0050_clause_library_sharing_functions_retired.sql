-- 0050_clause_library_sharing_functions_retired
--
-- Retires the SECURITY DEFINER helpers that cache 0048 added for federation and congress sharing of the clause library, and the two policies that
-- called them. The catalog admission contract does not allow the tenant (union_eyes_runtime) or system role to execute a SECURITY DEFINER
-- function (the bootstrap refused the fresh schema: "is a SECURITY DEFINER function executable by a runtime principal"), and no approved
-- cross-tenant helper exists for hierarchy facts. The tenant read of a clause is therefore the owner, explicit-grant and public policy of
-- 0011/0012 and nothing else; a clause shared at the federation or congress level is readable by its owner only (fail closed) until an
-- approved way to evaluate another organization's hierarchy exists.
--
-- This does not widen anything: it removes the only objects 0048 created. Idempotent; a relation or function that is absent is skipped.

DO $$
BEGIN
  IF to_regclass('public.shared_clause_library') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_shared_library_select_sharing ON public.shared_clause_library;
  END IF;
  IF to_regclass('public.clause_library_tags') IS NOT NULL THEN
    DROP POLICY IF EXISTS ue_shared_library_child_select_sharing ON public.clause_library_tags;
  END IF;
END $$;
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_clause_source_name(uuid);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_clause_readable_by(uuid, text, uuid[], uuid);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_clause_congress_eligible(uuid);
--> statement-breakpoint
DROP FUNCTION IF EXISTS public.ue_clause_federation_ancestor(uuid);
