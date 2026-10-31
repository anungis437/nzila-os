-- 0033_external_authority_principals_text
--
-- The external representation tables declare every principal column as uuid, but application principals are text
-- identifiers (the ORM declaration, the authority kernel and the session layer all use text). A representative, grantor or
-- revoker whose id is not a uuid could therefore never be recorded, so no external counsel or specialist could ever be
-- granted access: every insert failed with "invalid input syntax for type uuid" (R-29). The nine principal columns become
-- text; existing uuid values keep their canonical text form.
--
-- PostgreSQL refuses to retype a column that a policy mentions, so the four policies that name these columns are dropped
-- and recreated byte-for-byte as they were defined in 0006. Their predicates already compare the column as text. No
-- grant, key, index or other policy changes. A view or other object that depends on one of the columns makes the retype
-- fail, and the whole migration rolls back.

DO $$
BEGIN
  IF to_regclass('public.representation_authorities') IS NULL
     OR to_regclass('public.external_matter_access_grants') IS NULL
     OR to_regclass('public.external_document_access_grants') IS NULL THEN
    RAISE EXCEPTION 'cache 0033 fail-closed: an external representation table does not exist.';
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS "ue_external_authorities_select" ON "representation_authorities";
--> statement-breakpoint
DROP POLICY IF EXISTS "ue_external_matter_grants_select" ON "external_matter_access_grants";
--> statement-breakpoint
DROP POLICY IF EXISTS "ue_external_document_grants_select" ON "external_document_access_grants";
--> statement-breakpoint
DROP POLICY IF EXISTS "ue_external_document_grants_insert_self" ON "external_document_access_grants";
--> statement-breakpoint
DO $$
DECLARE
  target record;
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
    IF (SELECT data_type FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = target.table_name AND column_name = target.column_name) = 'uuid' THEN
      EXECUTE format('ALTER TABLE public.%I ALTER COLUMN %I TYPE text USING %I::text', target.table_name, target.column_name, target.column_name);
    END IF;
  END LOOP;
END $$;
--> statement-breakpoint
CREATE POLICY "ue_external_authorities_select"
  ON "representation_authorities"
  FOR SELECT TO "union_eyes_runtime"
  USING (
    "organization_id"::text = current_setting('app.current_org_id', true)
    AND "representative_user_id"::text = current_setting('app.current_user_id', true)
  );
--> statement-breakpoint
CREATE POLICY "ue_external_matter_grants_select"
  ON "external_matter_access_grants"
  FOR SELECT TO "union_eyes_runtime"
  USING (
    "organization_id"::text = current_setting('app.current_org_id', true)
    AND "user_id"::text = current_setting('app.current_user_id', true)
  );
--> statement-breakpoint
CREATE POLICY "ue_external_document_grants_select"
  ON "external_document_access_grants"
  FOR SELECT TO "union_eyes_runtime"
  USING (
    "organization_id"::text = current_setting('app.current_org_id', true)
    AND "user_id"::text = current_setting('app.current_user_id', true)
  );
--> statement-breakpoint
CREATE POLICY "ue_external_document_grants_insert_self"
  ON "external_document_access_grants"
  FOR INSERT TO "union_eyes_runtime"
  WITH CHECK (
    "organization_id"::text = current_setting('app.current_org_id', true)
    AND "user_id"::text = current_setting('app.current_user_id', true)
    AND "granted_by"::text = current_setting('app.current_user_id', true)
  );
