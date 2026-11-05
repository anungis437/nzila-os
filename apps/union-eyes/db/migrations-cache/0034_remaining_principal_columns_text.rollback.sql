-- 0034_remaining_principal_columns_text rollback: restore uuid. Refuses when any recorded principal is not a uuid (the cast would lose history).
DO $$
DECLARE
  target record;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  offending bigint;
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
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NOT NULL AND %I !~* %L', target.table_name, target.column_name, target.column_name, uuid_re) INTO offending;
    IF offending > 0 THEN
      RAISE EXCEPTION 'cache 0034 rollback refused: %.% holds principals that are not uuids.', target.table_name, target.column_name;
    END IF;
  END LOOP;
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
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE uuid USING %I::uuid', target.table_name, target.column_name, target.column_name);
  END LOOP;
END $$;
