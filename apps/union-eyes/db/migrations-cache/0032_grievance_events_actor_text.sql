-- 0032_grievance_events_actor_text
--
-- The canonical grievance_events table declares actor_user_id as uuid, but every application principal is a text identifier
-- (the ORM declaration, the Django model and the authority kernel all use text), so recording an escalation event for any
-- non-uuid principal failed with "invalid input syntax for type uuid" and rolled the escalation back. The column becomes text;
-- existing uuid values are preserved as their canonical text form. The table is append-only history, so nothing else changes.

DO $$
BEGIN
  IF to_regclass('public.grievance_events') IS NULL THEN
    RAISE EXCEPTION 'cache 0032 fail-closed: public.grievance_events does not exist.';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
       WHERE table_schema = 'public' AND table_name = 'grievance_events' AND column_name = 'actor_user_id') = 'uuid' THEN
    ALTER TABLE public.grievance_events ALTER COLUMN actor_user_id TYPE text USING actor_user_id::text;
  END IF;
END $$;
