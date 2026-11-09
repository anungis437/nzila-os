-- PLATFORM_SQL 0086_graph_evidence_integrity_and_identity
--
-- DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE (Family 1 exit, round 5).
--
-- Three additions, all read-time, fail-closed enforced in application code (lib/knowledge-transfer/propagation/
-- graph-evidence-service.ts), none requiring a background job:
--
-- 1. source_fingerprint on ue_verified_dependency_evidence: a deterministic hash of the two referenced nodes'
--    meaningful attributes (canonical label, category, nodeType) captured at submission and refreshed at every
--    verification. A verified row whose current fingerprint no longer matches the node's CURRENT attributes, or
--    whose node no longer resolves at all, must not back a confirmed organizational conclusion until re-verified -
--    the row's status stays 'verified' and its full review history is untouched; only read-time currentness
--    changes. NULL (legacy rows predating this column) is treated the same as a mismatch: fail closed, never
--    silently trusted.
-- 2. evidence_reference_type + evidence_document_id: a verified record's evidence_reference was previously an
--    arbitrary free-text string with no resolution guarantee. A 'document' reference now names an actual stored
--    document (resolved and access-checked at submission time via the existing document-authorization primitives,
--    re-resolved at read time so a later-deleted document is caught); 'external_citation' remains free text for
--    evidence that cannot be resolved against this system (e.g. a collective agreement clause number), honestly
--    typed as such rather than presented with the same evidentiary weight as a resolved document.
-- 3. ue_graph_node_alias: a durable, explicitly-authorized identity/alias mapping. graph-identity.ts's
--    canonicalNodeIdentityKey only tolerates COSMETIC drift (case, spacing, punctuation) in a label-derived node
--    id; it deliberately never guesses across a SEMANTIC rename or a label collision, to avoid silently
--    attributing verified evidence to the wrong concept. This table is how a semantic rename or collision is
--    migrated instead: an authorized reviewer records an explicit alias (never inferred), superseding (never
--    deleting) any prior active alias for the same label so the audit history of every past resolution decision
--    is preserved.
--
-- Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION, same posture as 0085.
--> statement-breakpoint
ALTER TABLE public.ue_verified_dependency_evidence
  ADD COLUMN IF NOT EXISTS source_fingerprint varchar(128),
  ADD COLUMN IF NOT EXISTS evidence_reference_type varchar(20) NOT NULL DEFAULT 'external_citation',
  ADD COLUMN IF NOT EXISTS evidence_document_id uuid;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ue_verified_dependency_evidence_reference_type_check'
  ) THEN
    ALTER TABLE public.ue_verified_dependency_evidence
      ADD CONSTRAINT ue_verified_dependency_evidence_reference_type_check
      CHECK (evidence_reference_type IN ('document', 'external_citation'));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ue_verified_dependency_evidence_document_ref_consistent'
  ) THEN
    ALTER TABLE public.ue_verified_dependency_evidence
      ADD CONSTRAINT ue_verified_dependency_evidence_document_ref_consistent
      CHECK (
        (evidence_reference_type = 'document' AND evidence_document_id IS NOT NULL)
        OR (evidence_reference_type = 'external_citation' AND evidence_document_id IS NULL)
      );
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_graph_node_alias (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  alias_label text NOT NULL,
  canonical_concept_label text NOT NULL,
  reason varchar(500) NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  superseded_by text,
  superseded_at timestamptz,
  CONSTRAINT ue_graph_node_alias_not_self_referential CHECK (alias_label <> canonical_concept_label)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_graph_node_alias_org_idx
  ON public.ue_graph_node_alias (organization_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_graph_node_alias_unique_active_idx
  ON public.ue_graph_node_alias (organization_id, alias_label)
  WHERE superseded_at IS NULL;
