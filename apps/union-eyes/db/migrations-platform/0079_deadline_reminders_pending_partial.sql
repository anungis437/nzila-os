-- Platform migration deadline_reminders_pending_partial
--
-- deadline_reminders_pending_uidx is unique over the PENDING reminders only. The deadline engine's scheduler (lib/deadline-engine/reminder-scheduler.ts) cancels a deadline's pending
-- reminders and inserts the new ones with `on conflict (source_deadline_id, recipient_email_hash, offset_days, reminder_kind) where status = 'pending' do nothing`, and its header says
-- rescheduling relies on the pending-uniqueness partial index. The canonical lineage (platform 0009) created the index over every status, so a cancelled reminder kept the key and
-- a reschedule that reused an offset inserted nothing: the staging proof scenario "reschedule" showed it on real PostgreSQL (no new reminder, no error). Replacing the index with
-- the partial one only relaxes it, so no existing row can violate it.

DO $ue_index$
BEGIN
  IF to_regclass('public.deadline_reminders') IS NULL THEN
    RAISE EXCEPTION 'platform deadline_reminders_pending_partial fail-closed: public.deadline_reminders does not exist.';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_attribute WHERE attrelid = 'public.deadline_reminders'::regclass AND attname = 'status' AND NOT attisdropped
  ) THEN
    RAISE EXCEPTION 'platform deadline_reminders_pending_partial fail-closed: public.deadline_reminders has no status column.';
  END IF;
END $ue_index$;
--> statement-breakpoint
DROP INDEX IF EXISTS public.deadline_reminders_pending_uidx;
--> statement-breakpoint
CREATE UNIQUE INDEX deadline_reminders_pending_uidx ON public.deadline_reminders USING btree (source_deadline_id, recipient_email_hash, offset_days, reminder_kind) WHERE status = 'pending';
--> statement-breakpoint
COMMENT ON INDEX public.deadline_reminders_pending_uidx IS 'platform-migration:deadline_reminders_pending_partial';
