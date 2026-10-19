-- 0015_deadline_engine_rls_fail_closed_closure.rollback
--
-- EXCEPTIONAL RECOVERY ONLY. NOT a routine rollback and NOT executed by any migration runner
-- (it is not in meta/_journal.json).
--
-- Restoring these policies RE-OPENS CROSS-TENANT ACCESS: with no organization context, any
-- union_eyes_runtime session can read and write deadline_reminders, deadline_audit_events and
-- deadline_reminder_executions of every tenant. Prefer restoring service by deploying an application
-- revision compatible with the fail-closed policies (deadline work under withSystemContext()).
--
-- The script refuses to run unless the session carries an explicit, recorded security disposition:
--   SELECT set_config('ue.fail_open_recovery_disposition', '<security disposition id>', false);
-- and it is meant to be run inside a single transaction by the migration-admin principal. After it
-- runs, the deploy-time rls-verify preflight is EXPECTED TO FAIL until the closure is restored.
--
-- RE-CLOSING: the governed executor still records 0015 as applied, so --apply is a no-op and will NOT
-- re-close (rehearsed). Re-close by replaying 0015_deadline_engine_rls_fail_closed_closure.sql directly
-- in one transaction as the migration-admin principal (it is idempotent and leaves the ledger unchanged),
-- then re-run the rls-verify preflight.

DO $$
BEGIN
  IF coalesce(length(current_setting('ue.fail_open_recovery_disposition', true)), 0) < 8 THEN
    RAISE EXCEPTION 'refusing: reopening cross-tenant access requires ue.fail_open_recovery_disposition (security disposition id) to be set';
  END IF;
END $$;

SET LOCAL search_path = public;

DROP POLICY IF EXISTS deadline_reminders_tenant_isolation ON public.deadline_reminders;
CREATE POLICY deadline_reminders_tenant_isolation ON public.deadline_reminders
  USING (COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text)
  WITH CHECK (COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text);

DROP POLICY IF EXISTS deadline_audit_events_tenant_isolation ON public.deadline_audit_events;
CREATE POLICY deadline_audit_events_tenant_isolation ON public.deadline_audit_events
  USING (COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text)
  WITH CHECK (COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), organization_id::text) = organization_id::text);

DROP POLICY IF EXISTS ue_parent_org_isolation_v2 ON public.deadline_reminder_executions;
DROP POLICY IF EXISTS ue_system_full_access ON public.deadline_reminder_executions;
DROP POLICY IF EXISTS deadline_reminder_executions_read ON public.deadline_reminder_executions;
CREATE POLICY deadline_reminder_executions_read ON public.deadline_reminder_executions
  USING (EXISTS (
    SELECT 1 FROM public.deadline_reminders r
    WHERE r.id = deadline_reminder_executions.reminder_id
      AND COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), r.organization_id::text) = r.organization_id::text))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.deadline_reminders r
    WHERE r.id = deadline_reminder_executions.reminder_id
      AND COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), r.organization_id::text) = r.organization_id::text));
ALTER TABLE public.deadline_reminder_executions NO FORCE ROW LEVEL SECURITY;