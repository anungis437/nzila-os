-- 0019_deadline_reassignment_convergence
--
-- Mission UE-PRODUCTION-READINESS-20261021.
--
-- deadline_reassignment_convergence is the durable assignment-handoff task. The grievance
-- assign route inserts it in the SAME transaction as grievances.union_rep_id, through
-- withRLSContext, so the writer is union_eyes_runtime with app.current_org_id set
-- (app/api/grievances/[id]/assign/route.ts). The reminder cron then sweeps and updates
-- pending rows as union_eyes_system (app/api/cron/deadline-reminders/route.ts).
--
-- Root migrations/0049_union_eyes_deadline_convergence_tasks.sql is the only previous
-- CREATE, and it installs a PUBLIC policy:
--
--   coalesce(nullif(current_setting('app.current_org_id', true), ''), organization_id::text)
--     = organization_id::text
--
-- An empty organization context therefore matches every tenant. Do not apply 0049 as the
-- security path. This migration creates the table when it is absent, and when 0049 (or a
-- hand-made copy of that policy) is already present it drops that policy before installing
-- the 0010 direct-org policies.
--
-- Runtime receives SELECT, INSERT, UPDATE because the tenant transaction inserts the task
-- and a tenant-scoped session must not be able to read another organization. System receives
-- the same three privileges for the cross-organization sweep. DELETE is not granted.
-- Policies still deny an empty context and a cross-tenant write. This is wider than 0017's
-- "runtime privilege list is empty" note: that note does not match the assign route. 0017 is
-- not edited (its applied hash stays the bytes already shipped). 0017's system-only loop
-- skips this table when it is absent and, when the table already exists, installs only
-- ue_system_full_access. This file is appended after 0017 and is replayed after 0017 by the
-- catalog-authority quarantine path, so the runtime policies are the ones that remain.
--
-- A present table whose tenant columns are not the canonical types is refused before any
-- policy or grant change. Replay is a no-op. No roles are created. No routine rollback.
--
-- Not staging proof. UE_SAAS_OPERATIONAL_READINESS stays NO_GO until an authorized database
-- has this hash applied and a live isolation probe passes. UE_RUNTIME_RLS_TENANT_ISOLATION
-- stays FAIL until that probe exists.

SET LOCAL search_path = public;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regprocedure('ue_create_direct_org_rls_policy(text,text,boolean)') IS NULL THEN
    RAISE EXCEPTION 'deadline reassignment convergence: ue_create_direct_org_rls_policy() is not installed (0010 not applied)';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime')
     OR NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
    RAISE EXCEPTION 'deadline reassignment convergence: union_eyes_runtime and union_eyes_system must already exist';
  END IF;
END $$;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS public.deadline_reassignment_convergence (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id uuid NOT NULL,
  grievance_id uuid NOT NULL,
  previous_assignee_id varchar(255),
  new_assignee_id varchar(255) NOT NULL,
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'converged')),
  attempt_count integer NOT NULL DEFAULT 0,
  last_error text,
  correlation_id text NOT NULL,
  requested_at timestamptz NOT NULL DEFAULT now(),
  last_attempted_at timestamptz,
  converged_at timestamptz,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT deadline_reassignment_convergence_terminal CHECK (
    (status = 'converged' AND converged_at IS NOT NULL)
    OR (status = 'pending' AND converged_at IS NULL)
  )
);
--> statement-breakpoint
DO $$
DECLARE
  v_missing text;
BEGIN
  SELECT string_agg(req.col, ', ' ORDER BY req.col) INTO v_missing
  FROM (VALUES
    ('organization_id', 'uuid', 'NO'),
    ('grievance_id', 'uuid', 'NO'),
    ('new_assignee_id', 'character varying', 'NO'),
    ('status', 'text', 'NO'),
    ('correlation_id', 'text', 'NO'),
    ('attempt_count', 'integer', 'NO'),
    ('updated_at', 'timestamp with time zone', 'NO')
  ) AS req(col, typ, nullable)
  WHERE NOT EXISTS (
    SELECT 1
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'deadline_reassignment_convergence'
      AND c.column_name = req.col
      AND c.data_type = req.typ
      AND c.is_nullable = req.nullable
  );
  IF v_missing IS NOT NULL THEN
    RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, missing or mismatched columns: %', v_missing;
  END IF;
END $$;
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deadline_reassignment_convergence_pending_idx
  ON public.deadline_reassignment_convergence (grievance_id)
  WHERE status = 'pending';
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS deadline_reassignment_convergence_org_idx
  ON public.deadline_reassignment_convergence (organization_id, status);
--> statement-breakpoint
DROP POLICY IF EXISTS deadline_reassignment_convergence_tenant_isolation ON public.deadline_reassignment_convergence;
--> statement-breakpoint
SELECT ue_create_direct_org_rls_policy('deadline_reassignment_convergence', 'organization_id', FALSE);
--> statement-breakpoint
DO $$
BEGIN
  IF to_regprocedure('ue_set_updated_at()') IS NULL THEN
    RAISE NOTICE 'deadline reassignment convergence: ue_set_updated_at() absent, updated_at trigger skipped';
    RETURN;
  END IF;
  DROP TRIGGER IF EXISTS trg_deadline_reassignment_convergence_touch ON public.deadline_reassignment_convergence;
  CREATE TRIGGER trg_deadline_reassignment_convergence_touch
    BEFORE UPDATE ON public.deadline_reassignment_convergence
    FOR EACH ROW
    EXECUTE FUNCTION ue_set_updated_at();
END $$;
--> statement-breakpoint
REVOKE ALL ON TABLE public.deadline_reassignment_convergence FROM PUBLIC, union_eyes_runtime, union_eyes_system;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE public.deadline_reassignment_convergence TO union_eyes_runtime;
--> statement-breakpoint
GRANT SELECT, INSERT, UPDATE ON TABLE public.deadline_reassignment_convergence TO union_eyes_system;
--> statement-breakpoint
DO $$
DECLARE
  v_bad text;
BEGIN
  SELECT c.relname INTO v_bad
  FROM pg_class c
  WHERE c.relname = 'deadline_reassignment_convergence'
    AND c.relnamespace = 'public'::regnamespace
    AND (
      NOT c.relrowsecurity
      OR NOT c.relforcerowsecurity
      OR NOT EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = c.oid AND 'union_eyes_runtime'::regrole = ANY (p.polroles)
      )
      OR NOT EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = c.oid AND 'union_eyes_system'::regrole = ANY (p.polroles)
      )
      OR EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = c.oid AND 0::oid = ANY (p.polroles)
      )
      OR EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = c.oid AND p.polname = 'deadline_reassignment_convergence_tenant_isolation'
      )
    );
  IF v_bad IS NOT NULL THEN
    RAISE EXCEPTION 'deadline reassignment convergence post-condition failed';
  END IF;

  IF NOT has_table_privilege('union_eyes_runtime', 'public.deadline_reassignment_convergence', 'INSERT')
     OR NOT has_table_privilege('union_eyes_runtime', 'public.deadline_reassignment_convergence', 'SELECT')
     OR NOT has_table_privilege('union_eyes_runtime', 'public.deadline_reassignment_convergence', 'UPDATE')
     OR has_table_privilege('union_eyes_runtime', 'public.deadline_reassignment_convergence', 'DELETE')
     OR NOT has_table_privilege('union_eyes_system', 'public.deadline_reassignment_convergence', 'SELECT')
     OR NOT has_table_privilege('union_eyes_system', 'public.deadline_reassignment_convergence', 'INSERT')
     OR NOT has_table_privilege('union_eyes_system', 'public.deadline_reassignment_convergence', 'UPDATE')
     OR has_table_privilege('union_eyes_system', 'public.deadline_reassignment_convergence', 'DELETE')
     OR has_table_privilege('public', 'public.deadline_reassignment_convergence', 'SELECT') THEN
    RAISE EXCEPTION 'deadline reassignment convergence: grant post-condition failed';
  END IF;
END $$;
