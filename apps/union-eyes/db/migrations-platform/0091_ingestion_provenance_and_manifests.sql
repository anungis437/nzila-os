-- PLATFORM_SQL 0091_ingestion_provenance_and_manifests
--
-- Historical import fidelity (MIG-02, 03, 05, 07, 09, 11). lib/ingestion wrote cases, timelines and documents but kept no
-- statement of what the source was expected to hold, no chain between successive imports, no raw source values, and only
-- a reference ("unverified:<id>") for a document's content. These relations hold that, separately from the case tables:
--
--   ue_ingestion_source_manifests     what a source is declared to contain (its case ids and expected counts) for one
--                                     organization; immutable. Verification reconciles a batch against it.
--   ue_ingestion_batch_manifests      one per import batch: its source manifest, its predecessor (the previous batch of the
--                                     same organization and source), the exact digest of its records and value mapping, and
--                                     its sealed outcome. One root and at most one successor per batch: imports form a single
--                                     chain. Sealed once, then immutable.
--   ue_ingestion_record_provenance    per imported case and batch: the raw source status, priority and step, the values they
--                                     were mapped to, the full record fingerprint, and when the import observed it. The import
--                                     observation lives here, never in the case's historical timeline.
--   ue_imported_document_evidence     per imported document: the source-declared digest and the verification state. A
--                                     document starts as reference_only; only bytes whose SHA-256 equals the declared digest
--                                     make it digest_verified. A malware scan is recorded separately and nothing sets it to
--                                     clean yet, so no imported document is available as verified content.
--
-- Tenant-scoped (organization_id uuid NOT NULL). RLS is scoped (cache) 0064. Registered UNQUALIFIED.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_ingestion_source_manifests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source_system varchar(100) NOT NULL,
  manifest_digest varchar(64) NOT NULL,
  expected_case_ids jsonb NOT NULL,
  expected_case_count integer NOT NULL,
  expected_document_count integer NOT NULL,
  declared_by text NOT NULL,
  declared_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_ingestion_source_manifests_digest_check CHECK (manifest_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ue_ingestion_source_manifests_ids_check CHECK (jsonb_typeof(expected_case_ids) = 'array'),
  CONSTRAINT ue_ingestion_source_manifests_count_check CHECK (
    expected_case_count >= 0 AND expected_document_count >= 0 AND expected_case_count = jsonb_array_length(expected_case_ids))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_ingestion_source_manifests_org_id_idx
  ON public.ue_ingestion_source_manifests (organization_id, id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_ingestion_source_manifests_digest_idx
  ON public.ue_ingestion_source_manifests (organization_id, source_system, manifest_digest);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_ingestion_batch_manifests (
  batch_id uuid PRIMARY KEY,
  organization_id uuid NOT NULL,
  source_system varchar(100) NOT NULL,
  source_manifest_id uuid,
  predecessor_batch_id uuid,
  record_count integer NOT NULL,
  record_digest varchar(64) NOT NULL,
  mapping_digest varchar(64) NOT NULL,
  succeeded integer,
  failed integer,
  skipped integer,
  outcome varchar(20),
  created_at timestamptz NOT NULL DEFAULT now(),
  sealed_at timestamptz,
  CONSTRAINT ue_ingestion_batch_manifests_digest_check CHECK (record_digest ~ '^[0-9a-f]{64}$' AND mapping_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ue_ingestion_batch_manifests_not_self_check CHECK (predecessor_batch_id IS NULL OR predecessor_batch_id <> batch_id),
  CONSTRAINT ue_ingestion_batch_manifests_outcome_check CHECK (outcome IS NULL OR outcome IN ('completed', 'partial', 'failed')),
  CONSTRAINT ue_ingestion_batch_manifests_sealed_check CHECK (
    (sealed_at IS NULL AND outcome IS NULL AND succeeded IS NULL AND failed IS NULL AND skipped IS NULL)
    OR (sealed_at IS NOT NULL AND outcome IS NOT NULL AND succeeded >= 0 AND failed >= 0 AND skipped >= 0
        AND succeeded + failed + skipped = record_count)),
  CONSTRAINT ue_ingestion_batch_manifests_batch_fk FOREIGN KEY (batch_id)
    REFERENCES public.ingestion_batches (id),
  CONSTRAINT ue_ingestion_batch_manifests_source_fk FOREIGN KEY (organization_id, source_manifest_id)
    REFERENCES public.ue_ingestion_source_manifests (organization_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_ingestion_batch_manifests_org_batch_idx
  ON public.ue_ingestion_batch_manifests (organization_id, batch_id);
--> statement-breakpoint
-- The predecessor is a batch manifest of the same organization (a composite self-reference).
ALTER TABLE public.ue_ingestion_batch_manifests DROP CONSTRAINT IF EXISTS ue_ingestion_batch_manifests_predecessor_fk;
--> statement-breakpoint
ALTER TABLE public.ue_ingestion_batch_manifests ADD CONSTRAINT ue_ingestion_batch_manifests_predecessor_fk
  FOREIGN KEY (organization_id, predecessor_batch_id) REFERENCES public.ue_ingestion_batch_manifests (organization_id, batch_id);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_ingestion_batch_manifests_successor_idx
  ON public.ue_ingestion_batch_manifests (predecessor_batch_id) WHERE predecessor_batch_id IS NOT NULL;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_ingestion_batch_manifests_root_idx
  ON public.ue_ingestion_batch_manifests (organization_id, source_system) WHERE predecessor_batch_id IS NULL;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_ingestion_record_provenance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  grievance_id uuid NOT NULL,
  external_case_id varchar(255) NOT NULL,
  record_fingerprint varchar(64) NOT NULL,
  source_status_raw varchar(255) NOT NULL,
  source_priority_raw varchar(255),
  source_step_raw varchar(255),
  mapped_status varchar(20) NOT NULL,
  mapped_priority varchar(20) NOT NULL,
  mapped_step varchar(20),
  observed_at timestamptz NOT NULL,
  CONSTRAINT ue_ingestion_record_provenance_fingerprint_check CHECK (record_fingerprint ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ue_ingestion_record_provenance_batch_fk FOREIGN KEY (organization_id, batch_id)
    REFERENCES public.ue_ingestion_batch_manifests (organization_id, batch_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_ingestion_record_provenance_batch_case_idx
  ON public.ue_ingestion_record_provenance (batch_id, external_case_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_ingestion_record_provenance_case_idx
  ON public.ue_ingestion_record_provenance (organization_id, grievance_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_imported_document_evidence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL,
  batch_id uuid NOT NULL,
  source_declared_digest varchar(64),
  verification_state varchar(20) NOT NULL DEFAULT 'reference_only',
  verified_digest varchar(64),
  byte_size bigint,
  scan_state varchar(20) NOT NULL DEFAULT 'not_scanned',
  verified_by text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_imported_document_evidence_state_check
    CHECK (verification_state IN ('reference_only', 'digest_verified', 'digest_mismatch')),
  CONSTRAINT ue_imported_document_evidence_scan_check CHECK (scan_state IN ('not_scanned', 'clean', 'infected')),
  CONSTRAINT ue_imported_document_evidence_digest_check CHECK (
    (source_declared_digest IS NULL OR source_declared_digest ~ '^[0-9a-f]{64}$')
    AND (verified_digest IS NULL OR verified_digest ~ '^[0-9a-f]{64}$')),
  CONSTRAINT ue_imported_document_evidence_verified_check CHECK (
    (verification_state = 'reference_only' AND verified_digest IS NULL AND verified_at IS NULL AND byte_size IS NULL)
    OR (verification_state = 'digest_verified' AND source_declared_digest IS NOT NULL AND verified_digest = source_declared_digest
        AND byte_size >= 0 AND verified_at IS NOT NULL AND verified_by IS NOT NULL)
    OR (verification_state = 'digest_mismatch' AND source_declared_digest IS NOT NULL AND verified_digest IS NOT NULL
        AND verified_digest <> source_declared_digest AND verified_at IS NOT NULL AND verified_by IS NOT NULL)),
  CONSTRAINT ue_imported_document_evidence_batch_fk FOREIGN KEY (organization_id, batch_id)
    REFERENCES public.ue_ingestion_batch_manifests (organization_id, batch_id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_imported_document_evidence_document_idx
  ON public.ue_imported_document_evidence (document_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_imported_document_evidence_org_idx
  ON public.ue_imported_document_evidence (organization_id, verification_state);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_ingestion_immutable_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  -- A statement that changes nothing is not a modification.
  IF TG_OP = 'UPDATE' AND to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  RAISE EXCEPTION 'UE_INGESTION_RECORD_IMMUTABLE:%', TG_TABLE_NAME USING ERRCODE = '42501';
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_ingestion_source_manifests_immutable ON public.ue_ingestion_source_manifests;
--> statement-breakpoint
CREATE TRIGGER ue_ingestion_source_manifests_immutable BEFORE UPDATE OR DELETE ON public.ue_ingestion_source_manifests
  FOR EACH ROW EXECUTE FUNCTION public.ue_ingestion_immutable_guard();
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_ingestion_record_provenance_immutable ON public.ue_ingestion_record_provenance;
--> statement-breakpoint
CREATE TRIGGER ue_ingestion_record_provenance_immutable BEFORE UPDATE OR DELETE ON public.ue_ingestion_record_provenance
  FOR EACH ROW EXECUTE FUNCTION public.ue_ingestion_immutable_guard();
--> statement-breakpoint
-- A batch manifest names a predecessor of its own organization and source, and is sealed once: only the outcome columns
-- move, from unsealed to sealed. It is never deleted.
CREATE OR REPLACE FUNCTION public.ue_ingestion_batch_manifest_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'UE_INGESTION_BATCH_MANIFEST_RETAINED' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.predecessor_batch_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.ue_ingestion_batch_manifests p
      WHERE p.batch_id = NEW.predecessor_batch_id AND p.organization_id = NEW.organization_id AND p.source_system = NEW.source_system
    ) THEN
      RAISE EXCEPTION 'UE_INGESTION_PREDECESSOR_MISMATCH' USING ERRCODE = '23503';
    END IF;
    IF NEW.sealed_at IS NOT NULL THEN
      RAISE EXCEPTION 'UE_INGESTION_BATCH_MANIFEST_SEALED_ON_INSERT' USING ERRCODE = '42501';
    END IF;
    RETURN NEW;
  END IF;
  IF to_jsonb(NEW) = to_jsonb(OLD) THEN RETURN NEW; END IF;
  IF OLD.sealed_at IS NOT NULL OR NEW.sealed_at IS NULL
     OR (to_jsonb(NEW) - ARRAY['succeeded','failed','skipped','outcome','sealed_at'])
        IS DISTINCT FROM (to_jsonb(OLD) - ARRAY['succeeded','failed','skipped','outcome','sealed_at']) THEN
    RAISE EXCEPTION 'UE_INGESTION_BATCH_MANIFEST_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_ingestion_batch_manifest_guard ON public.ue_ingestion_batch_manifests;
--> statement-breakpoint
CREATE TRIGGER ue_ingestion_batch_manifest_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ue_ingestion_batch_manifests
  FOR EACH ROW EXECUTE FUNCTION public.ue_ingestion_batch_manifest_guard();
--> statement-breakpoint
-- Document evidence is verified once (reference_only -> digest_verified | digest_mismatch); a scan result is recorded once.
-- Nothing else changes, and nothing is deleted.
CREATE OR REPLACE FUNCTION public.ue_imported_document_evidence_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'UE_IMPORTED_DOCUMENT_EVIDENCE_RETAINED' USING ERRCODE = '42501';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.document_id IS DISTINCT FROM OLD.document_id
     OR NEW.batch_id IS DISTINCT FROM OLD.batch_id OR NEW.source_declared_digest IS DISTINCT FROM OLD.source_declared_digest
     OR (OLD.verification_state <> 'reference_only' AND (NEW.verification_state, NEW.verified_digest, NEW.byte_size, NEW.verified_at)
         IS DISTINCT FROM (OLD.verification_state, OLD.verified_digest, OLD.byte_size, OLD.verified_at))
     OR (OLD.scan_state <> 'not_scanned' AND NEW.scan_state IS DISTINCT FROM OLD.scan_state) THEN
    RAISE EXCEPTION 'UE_IMPORTED_DOCUMENT_EVIDENCE_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_imported_document_evidence_guard ON public.ue_imported_document_evidence;
--> statement-breakpoint
CREATE TRIGGER ue_imported_document_evidence_guard BEFORE UPDATE OR DELETE ON public.ue_imported_document_evidence
  FOR EACH ROW EXECUTE FUNCTION public.ue_imported_document_evidence_guard();
