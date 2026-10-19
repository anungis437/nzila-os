-- =============================================================================
-- 20261018_deadline_engine_rls_fail_closed_closure.sql
--
-- Mission UE-RUNTIME-REALITY-20261018, Phase B (RLS tenant isolation).
--
-- Live staging finding (rls-verify --mode=preflight, 1698/1699): the deadline
-- engine tables still carry pre-0108 "tenant_isolation" policies that fall back
-- to the row's own organization when no tenant context is set:
--
--   COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), organization_id::text)
--     = organization_id::text
--
-- Those policies are PERMISSIVE and are OR-ed with the 0108-style policies, so
-- they defeat fail-closed behaviour: a union_eyes_runtime session with NO org
-- context could read and insert deadline_reminders / deadline_audit_events /
-- deadline_reminder_executions rows for every tenant. deadline_reminder_executions
-- additionally had no runtime/system policy owner and no FORCE ROW LEVEL SECURITY
-- (rls-verify: manifest-rls deadline_reminder_executions UNENFORCED).
--
-- This migration touches exactly three tables and nothing else:
--   deadline_reminders             direct org (organization_id)
--   deadline_audit_events          direct org (organization_id)
--   deadline_reminder_executions   parent-owned via deadline_reminders.id
--
-- Deployment ordering (REQUIRED): the code that runs the reminder worker and the
-- overdue scheduler must execute under withSystemContext (main, PR #923 and later)
-- BEFORE this migration is applied. Builds older than that (for example the image
-- built from eae195f2) rely on the fail-open fallback and will lose access to the
-- queue when it is removed. Rollback: 20261018_deadline_engine_rls_fail_closed_closure_rollback.sql
-- (restores the exact legacy policies; only valid together with a rollback of the
-- application revision).
--
-- Reuses ue_create_direct_org_rls_policy / ue_create_parent_owned_rls_policy_v2
-- installed by 0108 / 0012. Idempotent. Missing context fails closed; the system
-- principal is granted by role (TO union_eyes_system), not by session state.
-- =============================================================================

SET LOCAL search_path = public;

DO $$
DECLARE
  v_tbl TEXT;
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'deadline-engine RLS closure: ue_create_direct_org_rls_policy() is not installed (0108 not applied)';
  END IF;
  IF to_regprocedure('ue_create_parent_owned_rls_policy_v2(text,text,text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'deadline-engine RLS closure: ue_create_parent_owned_rls_policy_v2() is not installed (0012 not applied)';
  END IF;

  FOREACH v_tbl IN ARRAY ARRAY['deadline_reminders', 'deadline_audit_events', 'deadline_reminder_executions'] LOOP
    IF to_regclass('public.' || v_tbl) IS NULL THEN
      RAISE EXCEPTION 'deadline-engine RLS closure: public.% does not exist', v_tbl;
    END IF;
  END LOOP;

  FOREACH v_tbl IN ARRAY ARRAY['deadline_reminders', 'deadline_audit_events'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = v_tbl AND column_name = 'organization_id' AND data_type = 'uuid'
    ) THEN
      RAISE EXCEPTION 'deadline-engine RLS closure: public.%.organization_id (uuid) missing', v_tbl;
    END IF;
  END LOOP;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'deadline_reminder_executions' AND column_name = 'reminder_id' AND data_type = 'uuid'
  ) THEN
    RAISE EXCEPTION 'deadline-engine RLS closure: public.deadline_reminder_executions.reminder_id (uuid) missing';
  END IF;
END $$;

-- Remove the fail-open legacy policies (fallback to the row's own organization).
DROP POLICY IF EXISTS deadline_reminders_tenant_isolation ON public.deadline_reminders;
DROP POLICY IF EXISTS deadline_audit_events_tenant_isolation ON public.deadline_audit_events;
DROP POLICY IF EXISTS deadline_reminder_executions_read ON public.deadline_reminder_executions;

SELECT ue_create_direct_org_rls_policy('deadline_reminders', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('deadline_audit_events', 'organization_id', FALSE);
SELECT ue_create_parent_owned_rls_policy_v2('deadline_reminder_executions', 'reminder_id', 'deadline_reminders', 'organization_id', FALSE);

-- Post-condition: RLS + FORCE + runtime policy + system policy on all three, and no
-- policy on any of them addressed to PUBLIC. Otherwise the whole transaction rolls back.
DO $$
DECLARE
  v_bad TEXT;
BEGIN
  SELECT string_agg(t.tbl, ', ') INTO v_bad
  FROM (VALUES ('deadline_reminders'), ('deadline_audit_events'), ('deadline_reminder_executions')) AS t(tbl)
  JOIN pg_class c ON c.relname = t.tbl AND c.relnamespace = 'public'::regnamespace
  WHERE NOT c.relrowsecurity
     OR NOT c.relforcerowsecurity
     OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_runtime'::regrole = ANY (p.polroles))
     OR NOT EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 'union_eyes_system'::regrole = ANY (p.polroles))
     OR EXISTS (SELECT 1 FROM pg_policy p WHERE p.polrelid = c.oid AND 0::oid = ANY (p.polroles));
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'deadline-engine RLS closure post-condition failed for: %', v_bad;
  END IF;
END $$;
