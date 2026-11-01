-- 0034_remaining_principal_columns_text
--
-- Continues 0033 (R-29). Six more principal columns are uuid in the database but text in the ORM, the authority kernel and
-- the session layer, so any actor whose id is not a uuid could not be recorded: employer_communications.sender_user_id and
-- created_by, employer_contacts.created_by, ai_grievance_triages.reviewed_by, ai_clause_reasonings.reviewed_by and
-- ai_copilot_sessions.user_id. They become text; existing uuid values keep their canonical text form.
--
-- Verified before writing: no policy, view, key or other constraint depends on any of these columns (the tables' policies
-- are the organization_id isolation policies), so nothing is dropped. cookie_consents.user_id is deliberately NOT changed: it
-- is a foreign key to profiles(id), and retyping it would remove referential integrity, which is a product decision (R-29).
-- If a dependent object is ever present, the retype fails and the whole migration rolls back.

DO $$
BEGIN
  IF to_regclass('public.employer_communications') IS NULL
     OR to_regclass('public.employer_contacts') IS NULL
     OR to_regclass('public.ai_grievance_triages') IS NULL
     OR to_regclass('public.ai_clause_reasonings') IS NULL
     OR to_regclass('public.ai_copilot_sessions') IS NULL THEN
    RAISE EXCEPTION 'cache 0034 fail-closed: a table named by this migration does not exist.';
  END IF;
END $$;
--> statement-breakpoint
DO $$
DECLARE
  target record;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('employer_communications', 'sender_user_id'),
      ('employer_communications', 'created_by'),
      ('employer_contacts', 'created_by'),
      ('ai_grievance_triages', 'reviewed_by'),
      ('ai_clause_reasonings', 'reviewed_by'),
      ('ai_copilot_sessions', 'user_id')
    ) AS t(table_name, column_name)
  LOOP
    IF (SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = target.table_name AND column_name = target.column_name) = 'uuid' THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE text USING %I::text', target.table_name, target.column_name, target.column_name);
    END IF;
  END LOOP;
END $$;
