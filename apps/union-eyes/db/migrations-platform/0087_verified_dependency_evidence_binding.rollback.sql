-- Rollback for 0087_verified_dependency_evidence_binding: forward recovery only. Drop only after confirming nothing
-- reads evidence_document_integrity, external_attestation, external_attested_by, external_attested_at or
-- identity_key_version. Dropping them discards reviewer attestations; export them first.
ALTER TABLE public.ue_verified_dependency_evidence
  DROP CONSTRAINT IF EXISTS ue_verified_dependency_evidence_external_attestation_consistent,
  DROP CONSTRAINT IF EXISTS ue_verified_dependency_evidence_document_integrity_scope,
  DROP CONSTRAINT IF EXISTS ue_verified_dependency_evidence_identity_key_version_check,
  DROP COLUMN IF EXISTS identity_key_version,
  DROP COLUMN IF EXISTS external_attested_at,
  DROP COLUMN IF EXISTS external_attested_by,
  DROP COLUMN IF EXISTS external_attestation,
  DROP COLUMN IF EXISTS evidence_document_integrity;
