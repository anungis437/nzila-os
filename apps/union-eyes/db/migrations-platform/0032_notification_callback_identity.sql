-- PLATFORM_SQL 0032_notification_callback_identity
-- UNQUALIFIED. Do not apply from Cursor. Native execution is READY_FOR_VS_EXECUTION.
--
-- notification_delivery_log is an append-only evidence ledger. A provider callback
-- decides from a prior read and then inserts. Two concurrent callbacks can both
-- decide to insert the same event. This migration makes that race fail closed:
--
--   1. At most one row per provider message and event, when the provider message id
--      is present. Rows with a null external_event_id stay unrestricted, because a
--      confirmed failure may be recorded again after a later retry.
--   2. One provider message id belongs to one organization. Writers of the same
--      message take a transaction advisory lock, then refuse a second organization.
--
-- Existing duplicates are refused. This migration does not delete a row and does
-- not choose an owning organization. It does not change notification_queue. The
-- queue claim remains the conditional status update in notification-service.ts.

DO $$
BEGIN
  IF to_regclass('public.notification_delivery_log') IS NULL THEN
    RAISE EXCEPTION 'platform 0032 fail-closed: notification_delivery_log does not exist.';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.notification_delivery_log
     WHERE external_event_id IS NOT NULL
     GROUP BY external_event_id, event
    HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'platform 0032 fail-closed: notification_delivery_log already has more than one row for one provider message and event. Do not delete a row to apply this migration.';
  END IF;
  IF EXISTS (
    SELECT 1
      FROM public.notification_delivery_log
     WHERE external_event_id IS NOT NULL
     GROUP BY external_event_id
    HAVING count(DISTINCT organization_id) > 1
  ) THEN
    RAISE EXCEPTION 'platform 0032 fail-closed: one provider message is already recorded for more than one organization. Do not choose an owner to apply this migration.';
  END IF;
END $$;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS notification_delivery_log_provider_event_uidx
  ON public.notification_delivery_log (external_event_id, event)
  WHERE external_event_id IS NOT NULL;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.notification_delivery_log_provider_owner()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  existing_org uuid;
BEGIN
  IF NEW.external_event_id IS NULL THEN
    RETURN NEW;
  END IF;
  PERFORM pg_advisory_xact_lock(hashtextextended(NEW.external_event_id, 0));
  SELECT organization_id INTO existing_org
    FROM public.notification_delivery_log
   WHERE external_event_id = NEW.external_event_id
     AND id IS DISTINCT FROM NEW.id
   LIMIT 1;
  IF existing_org IS NOT NULL AND existing_org IS DISTINCT FROM NEW.organization_id THEN
    RAISE EXCEPTION 'notification_delivery_log provider message % is already owned by another organization', NEW.external_event_id
      USING ERRCODE = '23505';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
     WHERE tgname = 'notification_delivery_log_provider_owner'
       AND tgrelid = 'public.notification_delivery_log'::regclass
  ) THEN
    CREATE TRIGGER notification_delivery_log_provider_owner
      BEFORE INSERT OR UPDATE OF external_event_id, organization_id
      ON public.notification_delivery_log
      FOR EACH ROW
      EXECUTE FUNCTION public.notification_delivery_log_provider_owner();
  END IF;
END $$;
