-- Rollback for 0052_shared_clause_versions. The version history is discarded; export it first if the replaced text must be kept.
DROP TABLE IF EXISTS public.shared_clause_versions;
