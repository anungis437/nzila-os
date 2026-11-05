-- PLATFORM_SQL 0022_document_intake_and_transcription
--
-- Authoritative storage for three document-lane contracts. RLS is scoped by cache 0022; exact DML comes from the
-- storage-authority manifest (db/rls-storage-authority/documents-evidence.ts).
--
--   document_intakes                     temporary, server-issued intake of an uploaded object:
--                                        open -> accepted | expired | cancelled. Bound to the authenticated
--                                        principal, the organization, the exact server-chosen storage key, the
--                                        server-computed checksum, MIME type and size, and the intended operation.
--   document_transcript_revisions        append-only machine extraction and human-reviewed transcript revisions,
--                                        separate from the immutable original (document_versions). Provenance,
--                                        reviewer identity, classification and a content-bound text hash.
--   document_transcript_publications     append-only record that one reviewed revision was published as evidence, a
--                                        separate governed act from review.
--   document_access_grants.can_process_ocr  an explicit grant to process (extract text from) a document. A view or
--                                        download grant never implies it.
--
-- Invariants are enforced here, not only in the application: an accepted intake is terminal and must name the exact
-- document version that holds its object; an object that any version references can never be marked for deletion;
-- transcript revisions are contiguous, linear and immutable; evidence can only publish the head reviewed revision.

DO $$
BEGIN
  IF to_regclass('public.documents') IS NULL
     OR to_regclass('public.document_versions') IS NULL
     OR to_regclass('public.document_access_grants') IS NULL THEN
    RAISE EXCEPTION 'platform 0022 fail-closed: the document relations do not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.document_access_grants
  ADD COLUMN IF NOT EXISTS can_process_ocr boolean NOT NULL DEFAULT false;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.document_intakes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  principal_user_id text NOT NULL,
  operation text NOT NULL,
  target_document_id uuid,
  storage_key text NOT NULL,
  original_filename text NOT NULL,
  mime_type text NOT NULL,
  size_bytes bigint NOT NULL,
  content_hash text NOT NULL,
  status text NOT NULL DEFAULT 'open',
  object_state text NOT NULL DEFAULT 'present',
  created_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  accepted_at timestamptz,
  accepted_document_id uuid,
  accepted_version_id uuid,
  cancelled_at timestamptz,
  expired_at timestamptz,
  deletion_attempts integer NOT NULL DEFAULT 0,
  deletion_attempted_at timestamptz,
  deletion_error text,
  CONSTRAINT document_intakes_operation_ck CHECK (operation IN ('create_document', 'append_version')),
  CONSTRAINT document_intakes_status_ck CHECK (status IN ('open', 'accepted', 'expired', 'cancelled')),
  CONSTRAINT document_intakes_object_state_ck CHECK (object_state IN ('present', 'attached', 'deletion_pending', 'deleted', 'deletion_failed')),
  CONSTRAINT document_intakes_size_ck CHECK (size_bytes > 0 AND size_bytes <= 52428800),
  CONSTRAINT document_intakes_hash_ck CHECK (content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT document_intakes_ttl_ck CHECK (expires_at > created_at AND expires_at <= created_at + interval '1 day'),
  CONSTRAINT document_intakes_target_ck CHECK ((operation = 'append_version') = (target_document_id IS NOT NULL)),
  -- The server chooses the key from the intake id; a client path can never name the object.
  CONSTRAINT document_intakes_key_ck CHECK (storage_key LIKE 'documents/' || organization_id::text || '/intake/' || id::text || '/%'),
  CONSTRAINT document_intakes_open_ck CHECK (status <> 'open' OR (object_state = 'present' AND accepted_at IS NULL AND accepted_document_id IS NULL AND accepted_version_id IS NULL AND cancelled_at IS NULL AND expired_at IS NULL)),
  CONSTRAINT document_intakes_accepted_ck CHECK (status <> 'accepted' OR (object_state = 'attached' AND accepted_at IS NOT NULL AND accepted_document_id IS NOT NULL AND accepted_version_id IS NOT NULL AND cancelled_at IS NULL AND expired_at IS NULL)),
  CONSTRAINT document_intakes_cancelled_ck CHECK (status <> 'cancelled' OR (cancelled_at IS NOT NULL AND object_state <> 'attached' AND accepted_at IS NULL AND accepted_version_id IS NULL)),
  CONSTRAINT document_intakes_expired_ck CHECK (status <> 'expired' OR (expired_at IS NOT NULL AND object_state <> 'attached' AND accepted_at IS NULL AND accepted_version_id IS NULL)),
  CONSTRAINT document_intakes_attached_ck CHECK (object_state <> 'attached' OR status = 'accepted')
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS document_intakes_storage_key_uidx ON public.document_intakes (storage_key);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS document_intakes_accepted_version_uidx ON public.document_intakes (accepted_version_id) WHERE accepted_version_id IS NOT NULL;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS document_intakes_principal_idx ON public.document_intakes (organization_id, principal_user_id, status);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS document_intakes_reaper_idx ON public.document_intakes (status, expires_at) WHERE status = 'open';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS document_intakes_object_idx ON public.document_intakes (object_state) WHERE object_state IN ('present', 'deletion_pending', 'deletion_failed');
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_document_intakes_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_version record;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'document_intakes rows are never deleted' USING ERRCODE = '23000';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW.status <> 'open' THEN
      RAISE EXCEPTION 'an intake starts open' USING ERRCODE = '23000';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.id IS DISTINCT FROM OLD.id
     OR NEW.organization_id IS DISTINCT FROM OLD.organization_id
     OR NEW.principal_user_id IS DISTINCT FROM OLD.principal_user_id
     OR NEW.operation IS DISTINCT FROM OLD.operation
     OR NEW.target_document_id IS DISTINCT FROM OLD.target_document_id
     OR NEW.storage_key IS DISTINCT FROM OLD.storage_key
     OR NEW.original_filename IS DISTINCT FROM OLD.original_filename
     OR NEW.mime_type IS DISTINCT FROM OLD.mime_type
     OR NEW.size_bytes IS DISTINCT FROM OLD.size_bytes
     OR NEW.content_hash IS DISTINCT FROM OLD.content_hash
     OR NEW.created_at IS DISTINCT FROM OLD.created_at
     OR NEW.expires_at IS DISTINCT FROM OLD.expires_at THEN
    RAISE EXCEPTION 'the identity of an intake is immutable' USING ERRCODE = '23000';
  END IF;

  IF OLD.status = 'accepted' THEN
    RAISE EXCEPTION 'an accepted intake is terminal' USING ERRCODE = '23000';
  END IF;

  IF OLD.status IN ('cancelled', 'expired') AND NEW.status <> OLD.status THEN
    RAISE EXCEPTION 'a % intake is terminal', OLD.status USING ERRCODE = '23000';
  END IF;

  IF OLD.status = 'open' AND NEW.status <> 'open' THEN
    IF NEW.status = 'expired' AND now() < OLD.expires_at THEN
      RAISE EXCEPTION 'an intake cannot expire before its expiry' USING ERRCODE = '23000';
    END IF;
    IF NEW.status = 'accepted' THEN
      IF now() >= OLD.expires_at THEN
        RAISE EXCEPTION 'an expired intake cannot be accepted' USING ERRCODE = '23000';
      END IF;
      -- Acceptance must name the exact version that holds this exact object, with the checksum the server computed.
      SELECT dv.document_id, dv.organization_id, dv.storage_key, dv.content_hash
        INTO v_version
        FROM public.document_versions dv
       WHERE dv.id = NEW.accepted_version_id;
      IF NOT FOUND
         OR v_version.document_id IS DISTINCT FROM NEW.accepted_document_id
         OR v_version.organization_id IS DISTINCT FROM OLD.organization_id
         OR v_version.storage_key IS DISTINCT FROM OLD.storage_key
         OR v_version.content_hash IS DISTINCT FROM OLD.content_hash THEN
        RAISE EXCEPTION 'an intake can only be accepted by the version that holds its object' USING ERRCODE = '23000';
      END IF;
      IF OLD.operation = 'append_version' AND NEW.accepted_document_id IS DISTINCT FROM OLD.target_document_id THEN
        RAISE EXCEPTION 'an intake can only be accepted into its target document' USING ERRCODE = '23000';
      END IF;
    END IF;
  END IF;

  IF NEW.object_state IS DISTINCT FROM OLD.object_state THEN
    IF OLD.object_state = 'present' AND NEW.object_state = 'attached' AND NEW.status = 'accepted' THEN
      NULL;
    ELSIF NEW.object_state IN ('deletion_pending', 'deleted', 'deletion_failed')
          AND OLD.object_state IN ('present', 'deletion_pending', 'deletion_failed')
          AND NEW.status IN ('cancelled', 'expired') THEN
      -- An object any version references is attached to a document and is never deleted.
      IF EXISTS (
        SELECT 1 FROM public.document_versions dv
         WHERE dv.organization_id = OLD.organization_id AND dv.storage_key = OLD.storage_key
      ) THEN
        RAISE EXCEPTION 'an object that a document version references cannot be deleted' USING ERRCODE = '23000';
      END IF;
    ELSE
      RAISE EXCEPTION 'illegal object state transition % -> %', OLD.object_state, NEW.object_state USING ERRCODE = '23000';
    END IF;
  END IF;

  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_intakes_guard ON public.document_intakes;
--> statement-breakpoint
CREATE TRIGGER document_intakes_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.document_intakes
  FOR EACH ROW EXECUTE FUNCTION public.ue_document_intakes_guard();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.document_transcript_revisions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.documents (id),
  version_id uuid NOT NULL REFERENCES public.document_versions (id),
  revision_no integer NOT NULL,
  base_revision_no integer,
  state text NOT NULL,
  text text NOT NULL,
  text_hash text NOT NULL,
  source_content_hash text NOT NULL,
  classification text NOT NULL,
  engine text,
  engine_version text,
  language text,
  confidence numeric(5, 2),
  authored_by text NOT NULL,
  reviewed_by text,
  reviewed_at timestamptz,
  change_note text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT document_transcript_revisions_state_ck CHECK (state IN ('machine_extraction', 'human_draft', 'human_reviewed')),
  CONSTRAINT document_transcript_revisions_no_ck CHECK (revision_no >= 1 AND (base_revision_no IS NULL OR base_revision_no = revision_no - 1)),
  CONSTRAINT document_transcript_revisions_hash_ck CHECK (text_hash = encode(sha256(convert_to(text, 'UTF8')), 'hex') AND source_content_hash ~ '^[0-9a-f]{64}$'),
  CONSTRAINT document_transcript_revisions_class_ck CHECK (classification IN ('public_internal', 'team_confidential', 'lro_confidential', 'privileged', 'case_restricted', 'highly_sensitive')),
  CONSTRAINT document_transcript_revisions_machine_ck CHECK (state <> 'machine_extraction' OR (revision_no = 1 AND base_revision_no IS NULL AND engine IS NOT NULL AND engine_version IS NOT NULL AND confidence IS NOT NULL AND reviewed_by IS NULL AND reviewed_at IS NULL)),
  CONSTRAINT document_transcript_revisions_human_ck CHECK (state = 'machine_extraction' OR (revision_no >= 2 AND base_revision_no IS NOT NULL AND engine IS NULL AND confidence IS NULL)),
  CONSTRAINT document_transcript_revisions_draft_ck CHECK (state <> 'human_draft' OR (reviewed_by IS NULL AND reviewed_at IS NULL)),
  CONSTRAINT document_transcript_revisions_reviewed_ck CHECK (state <> 'human_reviewed' OR (reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS document_transcript_revisions_rev_uidx ON public.document_transcript_revisions (document_id, version_id, revision_no);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS document_transcript_revisions_org_idx ON public.document_transcript_revisions (organization_id, document_id);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_document_transcript_revisions_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_doc_org uuid;
  v_ver record;
  v_head integer;
  v_base record;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'transcript revisions are append-only' USING ERRCODE = '23000';
  END IF;

  SELECT organization_id INTO v_doc_org FROM public.documents WHERE id = NEW.document_id;
  SELECT organization_id, document_id, content_hash INTO v_ver FROM public.document_versions WHERE id = NEW.version_id;
  IF v_doc_org IS DISTINCT FROM NEW.organization_id
     OR v_ver.organization_id IS DISTINCT FROM NEW.organization_id
     OR v_ver.document_id IS DISTINCT FROM NEW.document_id THEN
    RAISE EXCEPTION 'a transcript belongs to one version of one document of one organization' USING ERRCODE = '23000';
  END IF;
  IF v_ver.content_hash IS DISTINCT FROM NEW.source_content_hash THEN
    RAISE EXCEPTION 'a transcript records the content hash of the version it was read from' USING ERRCODE = '23000';
  END IF;

  SELECT max(revision_no) INTO v_head FROM public.document_transcript_revisions
   WHERE document_id = NEW.document_id AND version_id = NEW.version_id;
  IF NEW.revision_no IS DISTINCT FROM coalesce(v_head, 0) + 1 THEN
    RAISE EXCEPTION 'transcript revisions are contiguous (head %, got %)', coalesce(v_head, 0), NEW.revision_no USING ERRCODE = '23000';
  END IF;

  IF NEW.state = 'human_reviewed' THEN
    SELECT state, authored_by INTO v_base FROM public.document_transcript_revisions
     WHERE document_id = NEW.document_id AND version_id = NEW.version_id AND revision_no = NEW.base_revision_no;
    -- Review is independent: the reviewer is not the author of the human draft being reviewed.
    IF v_base.state = 'human_draft' AND v_base.authored_by = NEW.reviewed_by THEN
      RAISE EXCEPTION 'a transcript cannot be reviewed by its own author' USING ERRCODE = '23000';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_transcript_revisions_guard ON public.document_transcript_revisions;
--> statement-breakpoint
CREATE TRIGGER document_transcript_revisions_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.document_transcript_revisions
  FOR EACH ROW EXECUTE FUNCTION public.ue_document_transcript_revisions_guard();
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.document_transcript_publications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  document_id uuid NOT NULL REFERENCES public.documents (id),
  version_id uuid NOT NULL REFERENCES public.document_versions (id),
  revision_no integer NOT NULL,
  text_hash text NOT NULL,
  linked_case_id uuid,
  published_by text NOT NULL,
  published_at timestamptz NOT NULL DEFAULT now(),
  purpose text NOT NULL,
  CONSTRAINT document_transcript_publications_purpose_ck CHECK (length(btrim(purpose)) > 0)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS document_transcript_publications_rev_uidx ON public.document_transcript_publications (document_id, version_id, revision_no);
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_document_transcript_publications_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
DECLARE
  v_rev record;
  v_head integer;
BEGIN
  IF TG_OP <> 'INSERT' THEN
    RAISE EXCEPTION 'transcript publications are append-only' USING ERRCODE = '23000';
  END IF;
  SELECT organization_id, state, text_hash INTO v_rev FROM public.document_transcript_revisions
   WHERE document_id = NEW.document_id AND version_id = NEW.version_id AND revision_no = NEW.revision_no;
  IF NOT FOUND OR v_rev.organization_id IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'the published revision does not exist in this organization' USING ERRCODE = '23000';
  END IF;
  IF v_rev.state <> 'human_reviewed' THEN
    RAISE EXCEPTION 'only a human-reviewed revision can be published as evidence' USING ERRCODE = '23000';
  END IF;
  IF v_rev.text_hash IS DISTINCT FROM NEW.text_hash THEN
    RAISE EXCEPTION 'the publication must carry the hash of the revision text' USING ERRCODE = '23000';
  END IF;
  SELECT max(revision_no) INTO v_head FROM public.document_transcript_revisions
   WHERE document_id = NEW.document_id AND version_id = NEW.version_id;
  IF NEW.revision_no IS DISTINCT FROM v_head THEN
    RAISE EXCEPTION 'only the head revision can be published' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS document_transcript_publications_guard ON public.document_transcript_publications;
--> statement-breakpoint
CREATE TRIGGER document_transcript_publications_guard
  BEFORE INSERT OR UPDATE OR DELETE ON public.document_transcript_publications
  FOR EACH ROW EXECUTE FUNCTION public.ue_document_transcript_publications_guard();
