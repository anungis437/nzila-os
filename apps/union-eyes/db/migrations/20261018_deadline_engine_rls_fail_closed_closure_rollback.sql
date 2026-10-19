-- =============================================================================
-- 20261018_deadline_engine_rls_fail_closed_closure_rollback.sql
--
-- Reverts 20261018_deadline_engine_rls_fail_closed_closure.sql: drops the policies
-- it created and restores the exact legacy policies that existed on staging on
-- 2026-10-18 (including deadline_reminder_executions NO FORCE ROW LEVEL SECURITY).
--
-- WARNING: the restored legacy policies are fail-open when no tenant context is
-- set. Use only to recover an application revision that predates withSystemContext
-- in the deadline worker (for example the image built from eae195f2), and re-apply
-- the closure as soon as a compatible revision is serving traffic. Re-running is a
-- no-op.
-- =============================================================================

SET LOCAL search_path = public;

-- deadline_reminders / deadline_audit_events already carried 0108-style ue_* policies
-- before the closure; the closure re-issues them idempotently, so only the legacy
-- policies need to be restored.
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
