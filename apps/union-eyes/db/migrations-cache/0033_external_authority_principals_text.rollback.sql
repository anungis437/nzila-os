-- 0033_external_authority_principals_text rollback: restore uuid. Refuses when any recorded principal is not a uuid (the cast would lose history).
DO $$
DECLARE
  target record;
  uuid_re constant text := '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$';
  offending bigint;
BEGIN
  FOR target IN
    SELECT * FROM (VALUES
      ('representation_authorities', 'representative_user_id'),
      ('representation_authorities', 'revoked_by'),
      ('representation_authorities', 'created_by'),
      ('external_matter_access_grants', 'user_id'),
      ('external_matter_access_grants', 'revoked_by'),
      ('external_matter_access_grants', 'granted_by'),
      ('external_document_access_grants', 'user_id'),
      ('external_document_access_grants', 'revoked_by'),
      ('external_document_access_grants', 'granted_by')
    ) AS t(table_name, column_name)
  LOOP
    EXECUTE format('SELECT count(*) FROM public.%I WHERE %I IS NOT NULL AND %I !~* %L', target.table_name, target.column_name, target.column_name, uuid_re) INTO offending;
    IF offending > 0 THEN
      RAISE EXCEPTION 'cache 0033 rollback refused: %.% holds principals that are not uuids.', target.table_name, target.column_name;
    END IF;
  END LOOP;

  DROP POLICY IF EXISTS "ue_external_authorities_select" ON "representation_authorities";
  DROP POLICY IF EXISTS "ue_external_matter_grants_select" ON "external_matter_access_grants";
  DROP POLICY IF EXISTS "ue_external_document_grants_select" ON "external_document_access_grants";
  DROP POLICY IF EXISTS "ue_external_document_grants_insert_self" ON "external_document_access_grants";

  FOR target IN
    SELECT * FROM (VALUES
      ('representation_authorities', 'representative_user_id'),
      ('representation_authorities', 'revoked_by'),
      ('representation_authorities', 'created_by'),
      ('external_matter_access_grants', 'user_id'),
      ('external_matter_access_grants', 'revoked_by'),
      ('external_matter_access_grants', 'granted_by'),
      ('external_document_access_grants', 'user_id'),
      ('external_document_access_grants', 'revoked_by'),
      ('external_document_access_grants', 'granted_by')
    ) AS t(table_name, column_name)
  LOOP
    EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE uuid USING %I::uuid', target.table_name, target.column_name, target.column_name);
  END LOOP;

  CREATE POLICY "ue_external_authorities_select" ON "representation_authorities" FOR SELECT TO "union_eyes_runtime"
    USING ("organization_id"::text = current_setting('app.current_org_id', true) AND "representative_user_id"::text = current_setting('app.current_user_id', true));
  CREATE POLICY "ue_external_matter_grants_select" ON "external_matter_access_grants" FOR SELECT TO "union_eyes_runtime"
    USING ("organization_id"::text = current_setting('app.current_org_id', true) AND "user_id"::text = current_setting('app.current_user_id', true));
  CREATE POLICY "ue_external_document_grants_select" ON "external_document_access_grants" FOR SELECT TO "union_eyes_runtime"
    USING ("organization_id"::text = current_setting('app.current_org_id', true) AND "user_id"::text = current_setting('app.current_user_id', true));
  CREATE POLICY "ue_external_document_grants_insert_self" ON "external_document_access_grants" FOR INSERT TO "union_eyes_runtime"
    WITH CHECK ("organization_id"::text = current_setting('app.current_org_id', true) AND "user_id"::text = current_setting('app.current_user_id', true) AND "granted_by"::text = current_setting('app.current_user_id', true));
END $$;
