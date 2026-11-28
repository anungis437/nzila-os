-- Rollback for 0090_inbound_integration_execution: forward recovery only. Refuses while any inbound receipt exists, because
-- receipts, identity links and outbox events are the only record of what an external source caused.
DO $$
BEGIN
  IF to_regclass('public.ue_integration_inbound_receipts') IS NOT NULL
     AND EXISTS (SELECT 1 FROM public.ue_integration_inbound_receipts) THEN
    RAISE EXCEPTION 'Rollback 0090 refused: inbound integration receipts exist.';
  END IF;
END $$;
DROP TABLE IF EXISTS public.ue_integration_outbox;
DROP TABLE IF EXISTS public.ue_integration_identity_links;
DROP TABLE IF EXISTS public.ue_integration_inbound_receipts;
DROP TABLE IF EXISTS public.ue_integration_mapping_versions;
DROP TABLE IF EXISTS public.ue_integration_sources;
DROP FUNCTION IF EXISTS public.ue_integration_outbox_guard();
DROP FUNCTION IF EXISTS public.ue_integration_identity_link_guard();
DROP FUNCTION IF EXISTS public.ue_integration_receipt_guard();
DROP FUNCTION IF EXISTS public.ue_integration_immutable_guard();
DROP FUNCTION IF EXISTS public.ue_integration_source_guard();
