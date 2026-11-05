-- Platform migration rollback deadline_reminders_pending_partial
--
-- Restores deadline_reminders_pending_uidx over every status, as platform 0009 created it. Refuses when the index is not the one this migration made, and when reminders of
-- different statuses already share a key (the history a reschedule leaves behind): the all-status unique index cannot hold them.

DO $ue_rollback$
BEGIN
  IF to_regclass('public.deadline_reminders') IS NULL THEN
    RETURN;
  END IF;
  IF to_regclass('public.deadline_reminders_pending_uidx') IS NULL
     OR obj_description('public.deadline_reminders_pending_uidx'::regclass, 'pg_class') IS DISTINCT FROM 'platform-migration:deadline_reminders_pending_partial' THEN
    RAISE EXCEPTION 'rollback deadline_reminders_pending_partial refuses: deadline_reminders_pending_uidx was not made by this migration.';
  END IF;
  IF EXISTS (
    SELECT 1 FROM public.deadline_reminders GROUP BY source_deadline_id, recipient_email_hash, offset_days, reminder_kind HAVING count(*) > 1
  ) THEN
    RAISE EXCEPTION 'rollback deadline_reminders_pending_partial refuses: reminders of different statuses share a key, and an index unique over every status cannot hold them.';
  END IF;
  DROP INDEX IF EXISTS public.deadline_reminders_pending_uidx;
  CREATE UNIQUE INDEX deadline_reminders_pending_uidx ON public.deadline_reminders USING btree (source_deadline_id, recipient_email_hash, offset_days, reminder_kind);
END $ue_rollback$;
