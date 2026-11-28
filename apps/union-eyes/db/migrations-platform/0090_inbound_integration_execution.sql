-- PLATFORM_SQL 0090_inbound_integration_execution
--
-- Durable inbound integration execution (INT-01..16). Before this, nothing persisted an inbound integration: the platform
-- execution engine took a check-then-record idempotency store and an in-memory run store, and the UE fabric refused every
-- inbound case (INBOUND_PERSISTENCE_NOT_CONFIGURED). These relations are the durable half of lib/integrations/inbound:
--
--   ue_integration_sources           an organization's authorization of one external source. Revocation is terminal and
--                                    stops new ingest at the database; rows already imported stay.
--   ue_integration_mapping_versions  immutable, numbered mapping rules per source, with the rule's digest and the source
--                                    schema version they accept. A receipt pins the version it ran.
--   ue_integration_inbound_receipts  the claim and the authoritative receipt. One row per (organization, source,
--                                    idempotency key): two workers inserting the same key get one row (INSERT ... ON
--                                    CONFLICT DO NOTHING), never check-then-record. A claim carries a fencing token and a
--                                    lease; the domain write and the receipt's completion commit in one transaction, so a
--                                    claim that outlived its lease never has a committed effect and can be taken over.
--                                    completed, rejected and quarantined are terminal and immutable; failed is retried only
--                                    when marked retryable. Failure detail is redacted before it is stored.
--   ue_integration_identity_links    external id -> internal id per (organization, source, entity type). The internal id
--                                    never changes; a link is only ever marked stale (no implicit relink, no DELETE).
--   ue_integration_outbox            the post-commit event: written in the receipt's transaction, published after commit.
--
-- Every relation carries organization_id uuid NOT NULL and binds its source with a composite (organization_id, source_id)
-- key, so a row can never point at another organization's source. RLS is scoped (cache) 0063. Registered UNQUALIFIED.
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_integration_sources (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source_key varchar(100) NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'active',
  authorized_by text NOT NULL,
  authorized_at timestamptz NOT NULL DEFAULT now(),
  revoked_by text,
  revoked_at timestamptz,
  revocation_reason varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_integration_sources_status_check CHECK (status IN ('active', 'revoked')),
  CONSTRAINT ue_integration_sources_key_check CHECK (source_key ~ '^[a-z0-9][a-z0-9._-]{0,99}$'),
  CONSTRAINT ue_integration_sources_revocation_check CHECK (
    (status = 'active' AND revoked_at IS NULL AND revoked_by IS NULL)
    OR (status = 'revoked' AND revoked_at IS NOT NULL AND revoked_by IS NOT NULL AND revocation_reason IS NOT NULL))
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_integration_sources_org_key_idx
  ON public.ue_integration_sources (organization_id, source_key);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_integration_sources_org_id_idx
  ON public.ue_integration_sources (organization_id, id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_integration_mapping_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source_id uuid NOT NULL,
  version integer NOT NULL,
  target_entity varchar(50) NOT NULL,
  source_schema_version varchar(50) NOT NULL,
  rule jsonb NOT NULL,
  rule_digest varchar(64) NOT NULL,
  created_by text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_integration_mapping_versions_version_check CHECK (version > 0),
  CONSTRAINT ue_integration_mapping_versions_digest_check CHECK (rule_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ue_integration_mapping_versions_source_fk FOREIGN KEY (organization_id, source_id)
    REFERENCES public.ue_integration_sources (organization_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_integration_mapping_versions_source_version_idx
  ON public.ue_integration_mapping_versions (organization_id, source_id, version);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_integration_inbound_receipts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source_id uuid NOT NULL,
  idempotency_key varchar(255) NOT NULL,
  payload_digest varchar(64) NOT NULL,
  mapping_version integer NOT NULL,
  status varchar(20) NOT NULL DEFAULT 'claimed',
  claim_token uuid NOT NULL,
  lease_expires_at timestamptz NOT NULL,
  attempts integer NOT NULL DEFAULT 1,
  retryable boolean NOT NULL DEFAULT false,
  reason_code varchar(80),
  reason_detail jsonb,
  effect varchar(20),
  case_id uuid,
  identity_link_id uuid,
  claimed_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  CONSTRAINT ue_integration_inbound_receipts_status_check
    CHECK (status IN ('claimed', 'completed', 'rejected', 'quarantined', 'failed')),
  CONSTRAINT ue_integration_inbound_receipts_digest_check CHECK (payload_digest ~ '^[0-9a-f]{64}$'),
  CONSTRAINT ue_integration_inbound_receipts_key_check CHECK (length(btrim(idempotency_key)) > 0),
  CONSTRAINT ue_integration_inbound_receipts_attempts_check CHECK (attempts > 0),
  CONSTRAINT ue_integration_inbound_receipts_effect_check CHECK (effect IS NULL OR effect IN ('created', 'existing')),
  CONSTRAINT ue_integration_inbound_receipts_completed_check CHECK (
    status <> 'completed'
    OR (case_id IS NOT NULL AND identity_link_id IS NOT NULL AND effect IS NOT NULL AND finished_at IS NOT NULL AND reason_code IS NULL)),
  CONSTRAINT ue_integration_inbound_receipts_unsuccessful_check CHECK (
    status NOT IN ('rejected', 'quarantined', 'failed')
    OR (reason_code IS NOT NULL AND finished_at IS NOT NULL AND case_id IS NULL AND effect IS NULL)),
  CONSTRAINT ue_integration_inbound_receipts_claimed_check CHECK (
    status <> 'claimed' OR (finished_at IS NULL AND case_id IS NULL AND effect IS NULL)),
  CONSTRAINT ue_integration_inbound_receipts_source_fk FOREIGN KEY (organization_id, source_id)
    REFERENCES public.ue_integration_sources (organization_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_integration_inbound_receipts_claim_key_idx
  ON public.ue_integration_inbound_receipts (organization_id, source_id, idempotency_key);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_integration_inbound_receipts_org_id_idx
  ON public.ue_integration_inbound_receipts (organization_id, id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_integration_inbound_receipts_status_idx
  ON public.ue_integration_inbound_receipts (organization_id, status, lease_expires_at);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_integration_identity_links (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  source_id uuid NOT NULL,
  entity_type varchar(50) NOT NULL,
  external_id varchar(255) NOT NULL,
  internal_id uuid NOT NULL,
  created_by_receipt_id uuid NOT NULL,
  stale_at timestamptz,
  stale_reason varchar(500),
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ue_integration_identity_links_external_check CHECK (length(btrim(external_id)) > 0),
  CONSTRAINT ue_integration_identity_links_stale_check CHECK ((stale_at IS NULL) = (stale_reason IS NULL)),
  CONSTRAINT ue_integration_identity_links_source_fk FOREIGN KEY (organization_id, source_id)
    REFERENCES public.ue_integration_sources (organization_id, id),
  CONSTRAINT ue_integration_identity_links_receipt_fk FOREIGN KEY (organization_id, created_by_receipt_id)
    REFERENCES public.ue_integration_inbound_receipts (organization_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_integration_identity_links_external_idx
  ON public.ue_integration_identity_links (organization_id, source_id, entity_type, external_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_integration_identity_links_internal_idx
  ON public.ue_integration_identity_links (organization_id, entity_type, internal_id);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.ue_integration_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  receipt_id uuid NOT NULL,
  event_type varchar(100) NOT NULL,
  payload jsonb NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  published_at timestamptz,
  CONSTRAINT ue_integration_outbox_receipt_fk FOREIGN KEY (organization_id, receipt_id)
    REFERENCES public.ue_integration_inbound_receipts (organization_id, id)
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS ue_integration_outbox_receipt_event_idx
  ON public.ue_integration_outbox (receipt_id, event_type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS ue_integration_outbox_pending_idx
  ON public.ue_integration_outbox (organization_id, published_at);
--> statement-breakpoint
-- Revocation is terminal; a source is never deleted (its history stays attributable).
CREATE OR REPLACE FUNCTION public.ue_integration_source_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'UE_INTEGRATION_SOURCE_RETAINED' USING ERRCODE = '42501';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.source_key IS DISTINCT FROM OLD.source_key
     OR NEW.authorized_by IS DISTINCT FROM OLD.authorized_by OR NEW.authorized_at IS DISTINCT FROM OLD.authorized_at
     OR OLD.status = 'revoked' THEN
    RAISE EXCEPTION 'UE_INTEGRATION_SOURCE_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_integration_source_guard ON public.ue_integration_sources;
--> statement-breakpoint
CREATE TRIGGER ue_integration_source_guard BEFORE UPDATE OR DELETE ON public.ue_integration_sources
  FOR EACH ROW EXECUTE FUNCTION public.ue_integration_source_guard();
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_integration_immutable_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  RAISE EXCEPTION 'UE_INTEGRATION_RECORD_IMMUTABLE:%', TG_TABLE_NAME USING ERRCODE = '42501';
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_integration_mapping_versions_immutable ON public.ue_integration_mapping_versions;
--> statement-breakpoint
CREATE TRIGGER ue_integration_mapping_versions_immutable BEFORE UPDATE OR DELETE ON public.ue_integration_mapping_versions
  FOR EACH ROW EXECUTE FUNCTION public.ue_integration_immutable_guard();
--> statement-breakpoint
-- A claim, a retry and a takeover need an active source: revocation stops new work at the database, not only in code.
-- Terminal receipts never change; a receipt is never deleted.
CREATE OR REPLACE FUNCTION public.ue_integration_receipt_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'UE_INTEGRATION_RECEIPT_RETAINED' USING ERRCODE = '42501';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status IN ('completed', 'rejected', 'quarantined') THEN
      RAISE EXCEPTION 'UE_INTEGRATION_RECEIPT_TERMINAL' USING ERRCODE = '42501';
    END IF;
    IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.source_id IS DISTINCT FROM OLD.source_id
       OR NEW.idempotency_key IS DISTINCT FROM OLD.idempotency_key OR NEW.payload_digest IS DISTINCT FROM OLD.payload_digest
       OR NEW.mapping_version IS DISTINCT FROM OLD.mapping_version OR NEW.claimed_at IS DISTINCT FROM OLD.claimed_at THEN
      RAISE EXCEPTION 'UE_INTEGRATION_RECEIPT_IDENTITY_IMMUTABLE' USING ERRCODE = '42501';
    END IF;
    IF OLD.status = 'failed' AND (NOT OLD.retryable OR NEW.status <> 'claimed') THEN
      RAISE EXCEPTION 'UE_INTEGRATION_RECEIPT_NOT_RETRYABLE' USING ERRCODE = '42501';
    END IF;
    IF NEW.status = 'claimed' AND NEW.claim_token = OLD.claim_token AND OLD.status = 'claimed'
       AND NEW.attempts <> OLD.attempts THEN
      RAISE EXCEPTION 'UE_INTEGRATION_RECEIPT_TAKEOVER_NEEDS_NEW_TOKEN' USING ERRCODE = '42501';
    END IF;
  END IF;
  IF NEW.status = 'claimed' AND (TG_OP = 'INSERT' OR OLD.status <> 'claimed' OR NEW.claim_token <> OLD.claim_token) THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.ue_integration_sources s
      WHERE s.organization_id = NEW.organization_id AND s.id = NEW.source_id AND s.status = 'active'
    ) THEN
      RAISE EXCEPTION 'UE_INTEGRATION_SOURCE_NOT_ACTIVE' USING ERRCODE = '42501';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.ue_integration_mapping_versions m
      WHERE m.organization_id = NEW.organization_id AND m.source_id = NEW.source_id AND m.version = NEW.mapping_version
    ) THEN
      RAISE EXCEPTION 'UE_INTEGRATION_MAPPING_VERSION_UNKNOWN' USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_integration_receipt_guard ON public.ue_integration_inbound_receipts;
--> statement-breakpoint
CREATE TRIGGER ue_integration_receipt_guard BEFORE INSERT OR UPDATE OR DELETE ON public.ue_integration_inbound_receipts
  FOR EACH ROW EXECUTE FUNCTION public.ue_integration_receipt_guard();
--> statement-breakpoint
-- A link's target never changes and a link is never deleted; it can only be marked stale, once, with a reason.
CREATE OR REPLACE FUNCTION public.ue_integration_identity_link_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'UE_INTEGRATION_IDENTITY_LINK_RETAINED' USING ERRCODE = '42501';
  END IF;
  IF NEW.organization_id IS DISTINCT FROM OLD.organization_id OR NEW.source_id IS DISTINCT FROM OLD.source_id
     OR NEW.entity_type IS DISTINCT FROM OLD.entity_type OR NEW.external_id IS DISTINCT FROM OLD.external_id
     OR NEW.internal_id IS DISTINCT FROM OLD.internal_id OR NEW.created_by_receipt_id IS DISTINCT FROM OLD.created_by_receipt_id
     OR OLD.stale_at IS NOT NULL THEN
    RAISE EXCEPTION 'UE_INTEGRATION_IDENTITY_LINK_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_integration_identity_link_guard ON public.ue_integration_identity_links;
--> statement-breakpoint
CREATE TRIGGER ue_integration_identity_link_guard BEFORE UPDATE OR DELETE ON public.ue_integration_identity_links
  FOR EACH ROW EXECUTE FUNCTION public.ue_integration_identity_link_guard();
--> statement-breakpoint
-- An outbox event is published once: only published_at changes, from NULL.
CREATE OR REPLACE FUNCTION public.ue_integration_outbox_guard() RETURNS trigger
LANGUAGE plpgsql SET search_path = pg_catalog, public AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'UE_INTEGRATION_OUTBOX_RETAINED' USING ERRCODE = '42501';
  END IF;
  IF OLD.published_at IS NOT NULL OR NEW.published_at IS NULL
     OR (to_jsonb(NEW) - 'published_at') IS DISTINCT FROM (to_jsonb(OLD) - 'published_at') THEN
    RAISE EXCEPTION 'UE_INTEGRATION_OUTBOX_IMMUTABLE' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS ue_integration_outbox_guard ON public.ue_integration_outbox;
--> statement-breakpoint
CREATE TRIGGER ue_integration_outbox_guard BEFORE UPDATE OR DELETE ON public.ue_integration_outbox
  FOR EACH ROW EXECUTE FUNCTION public.ue_integration_outbox_guard();
