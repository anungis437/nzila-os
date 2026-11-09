-- PLATFORM_SQL 0087_verified_dependency_evidence_binding
--
-- DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE (Family 1 final correction).
--
-- Binds a verified dependency to exactly what its reviewer attested. Enforced at read time by the single evaluator in
-- lib/knowledge-transfer/propagation/graph-evidence-evaluator.ts (fail closed, no background job, review history kept):
--
-- 1. evidence_document_integrity: the referenced document's content identity ("version:<n>:<content_hash>" from the
--    latest document_versions row, or "sha256:<hash>" from documents.sha256/checksum), captured at submission and
--    refreshed at verification. A new version or changed hash makes the record stale until re-verified. NULL on a
--    'document' row (rows from before this column) is treated as changed.
-- 2. external_attestation / external_attested_by / external_attested_at: an external citation cannot be resolved by
--    the system, so it backs a confirmed finding only when the reviewer recorded, under their own name, how they
--    checked the source. All three or none; only on external citations; the attester is never the submitter.
-- 3. identity_key_version: the identity-key rules source_fingerprint was computed under (graph-identity.ts). Existing
--    rows are version 1 (DEFAULT 1); new submissions and verifications write version 2.
--
-- Not applied here; native PostgreSQL execution is READY_FOR_VS_EXECUTION, same posture as 0085 and 0086.
--> statement-breakpoint
ALTER TABLE public.ue_verified_dependency_evidence
  ADD COLUMN IF NOT EXISTS evidence_document_integrity varchar(200),
  ADD COLUMN IF NOT EXISTS external_attestation varchar(2000),
  ADD COLUMN IF NOT EXISTS external_attested_by text,
  ADD COLUMN IF NOT EXISTS external_attested_at timestamptz,
  ADD COLUMN IF NOT EXISTS identity_key_version smallint NOT NULL DEFAULT 1;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ue_verified_dependency_evidence_identity_key_version_check'
  ) THEN
    ALTER TABLE public.ue_verified_dependency_evidence
      ADD CONSTRAINT ue_verified_dependency_evidence_identity_key_version_check
      CHECK (identity_key_version IN (1, 2));
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ue_verified_dependency_evidence_document_integrity_scope'
  ) THEN
    ALTER TABLE public.ue_verified_dependency_evidence
      ADD CONSTRAINT ue_verified_dependency_evidence_document_integrity_scope
      CHECK (evidence_reference_type = 'document' OR evidence_document_integrity IS NULL);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'ue_verified_dependency_evidence_external_attestation_consistent'
  ) THEN
    ALTER TABLE public.ue_verified_dependency_evidence
      ADD CONSTRAINT ue_verified_dependency_evidence_external_attestation_consistent
      CHECK (
        (external_attestation IS NULL AND external_attested_by IS NULL AND external_attested_at IS NULL)
        OR (
          external_attestation IS NOT NULL
          AND length(btrim(external_attestation)) > 0
          AND external_attested_by IS NOT NULL
          AND external_attested_at IS NOT NULL
          AND evidence_reference_type = 'external_citation'
          AND external_attested_by <> submitted_by
        )
      );
  END IF;
END $$;
