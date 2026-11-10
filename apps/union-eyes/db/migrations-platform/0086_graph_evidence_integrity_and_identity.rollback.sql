-- Rollback for 0086_graph_evidence_integrity_and_identity: forward recovery only. Drop/revert only after
-- confirming nothing reads source_fingerprint, evidence_reference_type, evidence_document_id or
-- ue_graph_node_alias.
DROP INDEX IF EXISTS public.ue_graph_node_alias_unique_active_idx;
DROP INDEX IF EXISTS public.ue_graph_node_alias_org_idx;
DROP TABLE IF EXISTS public.ue_graph_node_alias;
ALTER TABLE public.ue_verified_dependency_evidence
  DROP CONSTRAINT IF EXISTS ue_verified_dependency_evidence_document_ref_consistent,
  DROP CONSTRAINT IF EXISTS ue_verified_dependency_evidence_reference_type_check,
  DROP COLUMN IF EXISTS evidence_document_id,
  DROP COLUMN IF EXISTS evidence_reference_type,
  DROP COLUMN IF EXISTS source_fingerprint;
