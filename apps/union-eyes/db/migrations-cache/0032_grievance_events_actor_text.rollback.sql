-- 0032_grievance_events_actor_text rollback: restore uuid. Refuses when any recorded actor is not a uuid (the cast would lose history).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.grievance_events WHERE actor_user_id !~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$') THEN
    RAISE EXCEPTION 'cache 0032 rollback refused: grievance_events holds actors that are not uuids.';
  END IF;
  ALTER TABLE public.grievance_events ALTER COLUMN actor_user_id TYPE uuid USING actor_user_id::uuid;
END $$;
