-- 0056_external_authority_principal_precheck
--
-- DEF-0B8-FED-EXTERNAL-ORGANIZATION-FROM-QUERY-OPENS-TENANT-CONTEXT-AND-AUDIT-BEFORE-GRANT. An external representative's request names the
-- organization (and matter) it is about, and the external resource middleware opened that organization's tenant transaction before any grant was
-- checked: anyone signed in could have a transaction opened with app.current_org_id set to any organization id they typed. The middleware now asks
-- first, outside any organization context, whether the caller holds a representation authority in the organization they named, and opens the
-- tenant transaction only when they do.
--
-- That question is answered by one SELECT policy on representation_authorities: with NO organization context (app.current_org_id empty), the
-- runtime role sees only the rows whose representative is the authenticated principal (app.current_user_id). It shows the caller their own
-- authority rows and nothing else: no other principal's row, and nothing at all once an organization context is set (the existing
-- ue_external_authorities_select policy governs that case unchanged). No grant, column, other policy or row changes.
DO $$
BEGIN
  IF to_regclass('public.representation_authorities') IS NULL THEN
    RAISE EXCEPTION 'cache 0056 fail-closed: public.representation_authorities does not exist.';
  END IF;
END $$;
--> statement-breakpoint
DROP POLICY IF EXISTS "ue_external_authorities_select_own_principal" ON "representation_authorities";
--> statement-breakpoint
CREATE POLICY "ue_external_authorities_select_own_principal"
  ON "representation_authorities"
  FOR SELECT TO "union_eyes_runtime"
  USING (
    coalesce(current_setting('app.current_org_id', true), '') = ''
    AND coalesce(current_setting('app.current_user_id', true), '') <> ''
    AND "representative_user_id"::text = current_setting('app.current_user_id', true)
  );
