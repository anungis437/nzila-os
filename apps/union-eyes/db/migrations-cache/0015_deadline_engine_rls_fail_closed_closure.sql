-- 0015_deadline_engine_rls_fail_closed_closure
--
-- Mission UE-RUNTIME-REALITY-20261018 / change record CHG-2026-0112.
--
-- Live staging finding (rls-verify --mode=preflight as union_eyes_runtime: 1698/1699): the
-- deadline-engine tables created by root migrations/0045_union_eyes_deadline_engine.sql still carry
-- its PERMISSIVE "tenant_isolation" policies, addressed to PUBLIC, of the form
--
--   COALESCE(NULLIF(current_setting('app.current_org_id', true), ''), organization_id::text)
--     = organization_id::text
--
-- Permissive policies are OR-ed with the 0010-style ue_* policies, so a union_eyes_runtime session
-- with NO organization context could read and insert rows of EVERY tenant. 0045 designed this
-- fallback for workers that ran with an empty context; system work now runs as union_eyes_system
-- under withSystemContext() and is authorized by role, so the fallback is obsolete and unsafe.
-- deadline_reminder_executions additionally had no runtime/system policy owner and no FORCE RLS
-- (the single preflight failure).
--
-- Reaches BOTH paths: the legacy policies come from 0045, which the clean-room/fresh path applies
-- before scoped 0000-0014, and the same objects exist in existing staging. Appended after 0014.
--
-- Scope (exactly three tables, RLS only - same envelope as 0010-0014):
--   deadline_reminders             direct org (organization_id)
--   deadline_audit_events          direct org (organization_id)
--   deadline_reminder_executions   parent-owned via deadline_reminders.id
--
-- Does NOT create/alter roles or passwords, does NOT grant or revoke privileges, does NOT touch any
-- other table. REUSES helpers from 0010/0012 (no new policy geometry). Idempotent. Missing tenant
-- context fails closed; the system principal is granted by role (TO union_eyes_system).
--
-- RELEASE ORDER (rehearsed; docs/union-eyes/reality-remediation/29_UE_PHASE3A_RUNTIME_REALITY_DOSSIER.md
-- sections 14 and 18): CLOSURE FIRST, candidate application second. Apply this migration BEFORE the
-- candidate revision is dispatched and before it receives any traffic. It does NOT depend on a newer
-- revision already serving.
--   * The serving revision (eae195f2) cannot reach a policy-dependent statement on these tables on the
--     live schema: its deadline worker, overdue cron and assignment route each fail first on a missing
--     relation or column (deadline_reassignment_convergence, grievance_deadlines.due_date/status),
--     identically with and without this migration.
--   * The candidate worker runs under withSystemContext() and works under both the legacy and the closed
--     policy set, so the candidate is validated against the final policy state before traffic moves.
--   * deploy-union-eyes.yml's post-deploy rls-verify preflight reads the database, not the revision; it
--     stays red until this migration is applied, so applying it first keeps the governed run green.
-- Sequence: R1 read-only catalog/ledger check (STOP on any divergence from the rehearsed pre-state) -> isolate
-- every non-serving active revision -> THIS migration via the governed executor -> rls-verify preflight 1699/1699
-- AND the live isolation probe (the preflight does not detect an extra permissive policy) -> candidate Django
-- migrations -> candidate revision at 0% -> smokes -> traffic.
-- Prerequisites: approved CHG-2026-0112; ALL non-serving active revisions deactivated and the ff989637/wave1
-- labels removed (0% traffic weight is not isolation: every revision has a public FQDN and scale-to-zero revisions
-- wake on request) so only the serving revision (rollback target) and the candidate run; ledger and catalog
-- verified with the governed read-only check using a trusted identity.
-- Not covered here: the Django migration step is a separate blocker for deploying the candidate:
-- content.0004 and grievances.0005 collide with a lineage-restored database (collision-tolerant
-- AddFieldIfNotExists is on the candidate schema branch, not in this migration), and
-- deadline_reassignment_convergence needs its own migration.
--
-- Execution: only through the governed executor
-- (tooling/scripts/apply-union-eyes-scoped-migrations-existing-env.mjs): --check, then --apply. With a
-- staging-like ledger (0000-0005 recorded) it applies 0006-0015; on a staging-shaped database that changes
-- exactly these three tables plus the ue_create_* helper function bodies.
--
-- Recovery: there is NO routine rollback and NO executable fail-open restore. Reopening cross-tenant access is never offered
-- as a script: a session variable or any other free-text token cannot be evidence that a real security decision was made.
-- In order of preference:
--   1. forward fix: deploy an application revision compatible with the closed policies;
--   2. approved point-in-time restore of the database (a change under its own approved record);
--   3. if the closed state was altered by hand, re-close by replaying this file directly in one transaction as the
--      migration-admin principal (idempotent; the ledger is unchanged), then re-run the rls-verify preflight.
-- Any intentional reopening needs a NEW reviewed migration in a PR, under a change record whose approved_by/approval_status
-- are set by the actual approvers, with the maintainer security disposition attached. Nobody may set those fields on their behalf.

SET LOCAL search_path = public;
--> statement-breakpoint
DO $$
DECLARE
  v_tbl TEXT;
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'deadline-engine RLS closure: ue_create_direct_org_rls_policy() is not installed (0010 not applied)';
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
--> statement-breakpoint
DROP POLICY IF EXISTS deadline_reminders_tenant_isolation ON public.deadline_reminders;
--> statement-breakpoint
DROP POLICY IF EXISTS deadline_audit_events_tenant_isolation ON public.deadline_audit_events;
--> statement-breakpoint
DROP POLICY IF EXISTS deadline_reminder_executions_read ON public.deadline_reminder_executions;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('deadline_reminders', 'organization_id', FALSE);
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('deadline_audit_events', 'organization_id', FALSE);
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy_v2('deadline_reminder_executions', 'reminder_id', 'deadline_reminders', 'organization_id', FALSE);
--> statement-breakpoint
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