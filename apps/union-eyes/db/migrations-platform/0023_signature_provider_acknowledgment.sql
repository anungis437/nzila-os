-- Platform 0023: provider acknowledgment on signature documents.
--
-- A signature request, a provider's acknowledgment of an event, and a verified completion are different facts:
--   provider_acknowledged_at     the EVENT time the provider itself reported (never the local clock). Null until a
--                                provider supplies one; once set it can never change or be cleared.
--   provider_status_observed_at  when this system last received a provider status. A local receipt time, kept apart
--                                from the event time so it can never be read as one.
-- An acknowledgment can only exist on a document that has a provider envelope with an external provider; the
-- built-in internal provider cannot acknowledge anything.

DO $$
BEGIN
  IF to_regclass('public.signature_documents') IS NULL THEN
    RAISE EXCEPTION 'platform 0023 fail-closed: public.signature_documents does not exist.';
  END IF;
END $$;
--> statement-breakpoint
ALTER TABLE public.signature_documents
  ADD COLUMN IF NOT EXISTS provider_acknowledged_at timestamptz,
  ADD COLUMN IF NOT EXISTS provider_status_observed_at timestamptz;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conrelid = 'public.signature_documents'::regclass AND conname = 'signature_documents_provider_ack_ck'
  ) THEN
    ALTER TABLE public.signature_documents
      ADD CONSTRAINT signature_documents_provider_ack_ck
      CHECK (provider_acknowledged_at IS NULL OR (provider_envelope_id IS NOT NULL AND provider::text <> 'internal'));
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_signature_documents_ack_guard() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
  IF OLD.provider_acknowledged_at IS NOT NULL
     AND NEW.provider_acknowledged_at IS DISTINCT FROM OLD.provider_acknowledged_at THEN
    RAISE EXCEPTION 'a provider acknowledgment timestamp is immutable once recorded' USING ERRCODE = '23000';
  END IF;
  RETURN NEW;
END $$;
--> statement-breakpoint
DROP TRIGGER IF EXISTS signature_documents_ack_guard ON public.signature_documents;
--> statement-breakpoint
CREATE TRIGGER signature_documents_ack_guard
  BEFORE UPDATE ON public.signature_documents
  FOR EACH ROW EXECUTE FUNCTION public.ue_signature_documents_ack_guard();
