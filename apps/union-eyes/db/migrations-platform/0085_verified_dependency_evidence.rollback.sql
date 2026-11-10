-- Rollback for 0085_verified_dependency_evidence: forward recovery only. Drop only after confirming nothing reads
-- ue_verified_dependency_evidence.
DROP INDEX IF EXISTS public.ue_verified_dependency_evidence_lookup_idx;
DROP INDEX IF EXISTS public.ue_verified_dependency_evidence_org_idx;
DROP TABLE IF EXISTS public.ue_verified_dependency_evidence;
