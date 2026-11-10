-- PLATFORM_SQL 0085_verified_dependency_evidence
--
-- DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE.
--
-- The propagation map (lib/knowledge-transfer/propagation) infers dependency direction, sole-expert ownership and
-- recovery time from exit-interview tag co-occurrence alone - an exploratory association, never a verified
-- operational fact. ue_verified_dependency_evidence is the separate, verified graph: a directional dependency
-- between two propagation-map node ids is only "verified" once a reviewer distinct from the submitter attributes
-- it to a named process or system and a named responsible organizational authority, with an evidence reference.
--
-- status starts pending_review on submission; a review either verifies or rejects it (never silently). A verified
-- record can later be revoked (status revoked) when the dependency it named no longer holds - revoking narrows
-- what is treated as verified, it does not delete the historical record of what was once verified and why.
--
-- Tenant-scoped (organization_id uuid not null). RLS is scoped (cache) 0059. Registered UNQUALIFIED. Not applied
-- here; native PostgreSQL execution is READY_FOR_VS_EXECUTION.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_verified_dependency_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  dependent_node_id text NOT NULL,
  depends_on_node_id text NOT NULL,
  process_or_system varchar(300) NOT NULL,
  responsible_authority varchar(300) NOT NULL,
  evidence_reference varchar(500) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'pending_review',
  submitted_by text NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  review_notes varchar(1000),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_verified_dependency_evidence_status_check
    CHECK (status IN ('pending_review', 'verified', 'rejected', 'revoked')),
  CONSTRAINT ue_verified_dependency_evidence_not_self_dependent
    CHECK (dependent_node_id <> depends_on_node_id),
  CONSTRAINT ue_verified_dependency_evidence_reviewer_distinct
    CHECK (reviewed_by IS NULL OR reviewed_by <> submitted_by)
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_verified_dependency_evidence_org_idx
  ON public.ue_verified_dependency_evidence (organization_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_verified_dependency_evidence_lookup_idx
  ON public.ue_verified_dependency_evidence (organization_id, dependent_node_id, depends_on_node_id, status);
