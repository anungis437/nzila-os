-- 0019_deadline_reassignment_convergence
--
-- Mission UE-PRODUCTION-READINESS-20261021.
--
-- deadline_reassignment_convergence is the durable assignment-handoff task.
-- requestAssignmentConvergence() inserts it with RETURNING id inside the assign
-- route's withRLSContext transaction, so the writer is union_eyes_runtime and
-- needs SELECT plus INSERT. processAssignmentConvergence() and
-- sweepPendingAssignmentConvergence() select and update pending rows. Both run
-- under withSystemContext (the assign route's post-commit retry, and the
-- reminder cron), so union_eyes_system needs SELECT plus UPDATE. No production
-- path updates as the runtime role or inserts as the system role. DELETE is
-- not granted to either role. The 0010 helper still installs the full
-- direct-org policy set; a policy without a grant does not confer the privilege.
--
-- Root migrations/0049_union_eyes_deadline_convergence_tasks.sql is the only
-- previous CREATE, and it installs a PUBLIC policy:
--
--   coalesce(nullif(current_setting('app.current_org_id', true), ''), organization_id::text)
--     = organization_id::text
--
-- An empty organization context therefore matches every tenant. Supported
-- appliers (scoped journal, catalog quarantine replay, schema-lineage cleanroom,
-- drizzle bootstrap closure tags, platform journal, deploy-union-eyes.yml) do
-- not execute that file. This migration additionally installs an event trigger
-- that rejects a later CREATE POLICY or ALTER POLICY on this table when the
-- policy is PUBLIC, uses the empty-context coalesce fallback, or is not one of
-- the five 0010 policy names. Replaying the locked 0049 file after this closure
-- therefore fails on CREATE POLICY and leaves the approved policies in place.
-- A superuser can disable an event trigger; that action is outside those appliers.
--
-- The physical preflight runs before any policy, grant, or trigger change. It
-- requires the thirteen canonical columns (type, nullability, varchar length,
-- and critical defaults), a primary key on id only, the status check, and the
-- named terminal check. Indexes are created next and then checked, still before
-- the policy change, so a same-named index with the wrong definition is refused
-- rather than left in place by CREATE INDEX IF NOT EXISTS. An extra column fails
-- the column count.
--
-- 0017 is not edited. Its system-only loop skips this table when it is absent
-- and, when the table already exists, installs only ue_system_full_access. This
-- file is appended after 0017 and is replayed after 0017 by the catalog-authority
-- quarantine path, so the runtime policies are the ones that remain.
--
-- Replay of this file is a no-op aside from reasserting the same policies,
-- grants, and guard. No roles are created. No routine rollback.
--
-- Not staging proof. UE_SAAS_OPERATIONAL_READINESS stays NO_GO until an
-- authorized database has this hash applied and a live isolation probe passes.
-- UE_RUNTIME_RLS_TENANT_ISOLATION stays FAIL until that probe exists.

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
  v_count int;
  v_pk text;
  v_default text;
  v_status_check int;
  v_terminal int;
  r record;
BEGIN
  SELECT count(*) INTO v_count
  FROM information_schema.columns
  WHERE table_schema = 'public'
    AND table_name = 'deadline_reassignment_convergence';
  IF v_count <> 13 THEN
    RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, column count %', v_count;
  END IF;

  FOR r IN
    SELECT * FROM (VALUES
      ('id', 'uuid', 'NO', NULL::int, 'gen_random_uuid()'),
      ('organization_id', 'uuid', 'NO', NULL::int, NULL),
      ('grievance_id', 'uuid', 'NO', NULL::int, NULL),
      ('previous_assignee_id', 'character varying', 'YES', 255, NULL),
      ('new_assignee_id', 'character varying', 'NO', 255, NULL),
      ('status', 'text', 'NO', NULL::int, '''pending'''),
      ('attempt_count', 'integer', 'NO', NULL::int, '0'),
      ('last_error', 'text', 'YES', NULL::int, NULL),
      ('correlation_id', 'text', 'NO', NULL::int, NULL),
      ('requested_at', 'timestamp with time zone', 'NO', NULL::int, 'now()'),
      ('last_attempted_at', 'timestamp with time zone', 'YES', NULL::int, NULL),
      ('converged_at', 'timestamp with time zone', 'YES', NULL::int, NULL),
      ('updated_at', 'timestamp with time zone', 'NO', NULL::int, 'now()')
    ) AS expected(col, typ, nullable, char_len, def)
  LOOP
    SELECT lower(regexp_replace(
             regexp_replace(COALESCE(c.column_default, ''), '[[:space:]]', '', 'g'),
             '::[a-z0-9_\[\]]+', '', 'g'))
      INTO v_default
    FROM information_schema.columns c
    WHERE c.table_schema = 'public'
      AND c.table_name = 'deadline_reassignment_convergence'
      AND c.column_name = r.col
      AND c.data_type = r.typ
      AND c.is_nullable = r.nullable
      AND c.character_maximum_length IS NOT DISTINCT FROM r.char_len;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, column %', r.col;
    END IF;
    IF r.def IS NULL THEN
      IF v_default <> '' THEN
        RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, default on % is %', r.col, v_default;
      END IF;
    ELSIF r.col IN ('requested_at', 'updated_at') THEN
      IF v_default NOT IN ('now()', 'current_timestamp') THEN
        RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, default on % is %', r.col, v_default;
      END IF;
    ELSIF v_default IS DISTINCT FROM r.def AND v_default IS DISTINCT FROM '(' || r.def || ')' THEN
      RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, default on % is %', r.col, v_default;
    END IF;
  END LOOP;

  SELECT string_agg(a.attname, ',' ORDER BY u.ord) INTO v_pk
  FROM pg_constraint con
  JOIN LATERAL unnest(con.conkey) WITH ORDINALITY AS u(attnum, ord) ON true
  JOIN pg_attribute a ON a.attrelid = con.conrelid AND a.attnum = u.attnum
  WHERE con.contype = 'p'
    AND con.conrelid = 'public.deadline_reassignment_convergence'::regclass;
  IF v_pk IS DISTINCT FROM 'id' THEN
    RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, primary key %', COALESCE(v_pk, 'missing');
  END IF;

  SELECT count(*) INTO v_status_check
  FROM pg_constraint con
  WHERE con.conrelid = 'public.deadline_reassignment_convergence'::regclass
    AND con.contype = 'c'
    AND pg_get_constraintdef(con.oid) ILIKE '%pending%'
    AND pg_get_constraintdef(con.oid) ILIKE '%converged%'
    AND pg_get_constraintdef(con.oid) NOT ILIKE '%converged_at%';
  IF v_status_check < 1 THEN
    RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, status check missing';
  END IF;

  SELECT count(*) INTO v_terminal
  FROM pg_constraint con
  WHERE con.conrelid = 'public.deadline_reassignment_convergence'::regclass
    AND con.contype = 'c'
    AND con.conname = 'deadline_reassignment_convergence_terminal'
    AND pg_get_constraintdef(con.oid) ILIKE '%converged_at%'
    AND pg_get_constraintdef(con.oid) ILIKE '%pending%';
  IF v_terminal <> 1 THEN
    RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, terminal check missing';
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
DO $$
DECLARE
  v_pending text;
  v_org text;
BEGIN
  SELECT pg_get_indexdef(c.oid) INTO v_pending
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'deadline_reassignment_convergence_pending_idx';
  IF v_pending IS NULL
     OR v_pending ~* 'CREATE UNIQUE INDEX'
     OR v_pending !~* 'grievance_id'
     OR v_pending !~* 'status[[:space:]]*=[[:space:]]*''pending''' THEN
    RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, pending index %', COALESCE(v_pending, 'missing');
  END IF;

  SELECT pg_get_indexdef(c.oid) INTO v_org
  FROM pg_class c
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
    AND c.relname = 'deadline_reassignment_convergence_org_idx';
  IF v_org IS NULL
     OR v_org ~* 'CREATE UNIQUE INDEX'
     OR v_org ~* 'WHERE'
     OR v_org !~* 'organization_id,[[:space:]]*status' THEN
    RAISE EXCEPTION 'deadline reassignment convergence: refusing to mutate a drifted table, org index %', COALESCE(v_org, 'missing');
  END IF;
END $$;
--> statement-breakpoint
CREATE OR REPLACE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy()
RETURNS event_trigger
LANGUAGE plpgsql
AS $fn$
DECLARE
  obj record;
  pol_name text;
  pol_rel regclass;
  pol_roles oid[];
  pol_qual text;
  pol_check text;
BEGIN
  FOR obj IN
    SELECT *
    FROM pg_event_trigger_ddl_commands()
    WHERE command_tag IN ('CREATE POLICY', 'ALTER POLICY')
      AND object_type = 'policy'
  LOOP
    pol_name := NULL;
    pol_rel := NULL;
    pol_roles := NULL;
    pol_qual := NULL;
    pol_check := NULL;
    SELECT p.polname, p.polrelid, p.polroles,
           pg_get_expr(p.polqual, p.polrelid),
           pg_get_expr(p.polwithcheck, p.polrelid)
      INTO pol_name, pol_rel, pol_roles, pol_qual, pol_check
      FROM pg_policy p
     WHERE p.oid = obj.objid;

    IF pol_name IS NULL THEN
      IF COALESCE(obj.object_identity, '') ILIKE '%deadline_reassignment_convergence%' THEN
        RAISE EXCEPTION 'deadline reassignment convergence: refusing policy % outside the canonical closure', obj.object_identity
          USING ERRCODE = '42501';
      END IF;
      CONTINUE;
    END IF;

    IF pol_rel IS DISTINCT FROM 'public.deadline_reassignment_convergence'::regclass THEN
      CONTINUE;
    END IF;

    IF pol_name = 'deadline_reassignment_convergence_tenant_isolation'
       OR (pol_roles IS NOT NULL AND 0 = ANY (pol_roles))
       OR COALESCE(pol_qual, '') ~* 'coalesce[[:space:]]*\([[:space:]]*nullif'
       OR COALESCE(pol_check, '') ~* 'coalesce[[:space:]]*\([[:space:]]*nullif'
       OR pol_name NOT IN (
         'ue_org_isolation_select',
         'ue_org_isolation_insert',
         'ue_org_isolation_update',
         'ue_org_isolation_delete',
         'ue_system_full_access'
       )
    THEN
      RAISE EXCEPTION 'deadline reassignment convergence: refusing policy % outside the canonical closure', pol_name
        USING ERRCODE = '42501';
    END IF;
  END LOOP;
END;
$fn$;
--> statement-breakpoint
DROP EVENT TRIGGER IF EXISTS ue_guard_deadline_reassignment_convergence_policy;
--> statement-breakpoint
CREATE EVENT TRIGGER ue_guard_deadline_reassignment_convergence_policy
  ON ddl_command_end
  WHEN TAG IN ('CREATE POLICY', 'ALTER POLICY')
  EXECUTE FUNCTION public.ue_guard_deadline_reassignment_convergence_policy();
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
GRANT SELECT, INSERT ON TABLE public.deadline_reassignment_convergence TO union_eyes_runtime;
--> statement-breakpoint
GRANT SELECT, UPDATE ON TABLE public.deadline_reassignment_convergence TO union_eyes_system;
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

  IF NOT has_table_privilege('union_eyes_runtime', 'public.deadline_reassignment_convergence', 'SELECT')
     OR NOT has_table_privilege('union_eyes_runtime', 'public.deadline_reassignment_convergence', 'INSERT')
     OR has_table_privilege('union_eyes_runtime', 'public.deadline_reassignment_convergence', 'UPDATE')
     OR has_table_privilege('union_eyes_runtime', 'public.deadline_reassignment_convergence', 'DELETE')
     OR NOT has_table_privilege('union_eyes_system', 'public.deadline_reassignment_convergence', 'SELECT')
     OR has_table_privilege('union_eyes_system', 'public.deadline_reassignment_convergence', 'INSERT')
     OR NOT has_table_privilege('union_eyes_system', 'public.deadline_reassignment_convergence', 'UPDATE')
     OR has_table_privilege('union_eyes_system', 'public.deadline_reassignment_convergence', 'DELETE')
     OR has_table_privilege('public', 'public.deadline_reassignment_convergence', 'SELECT')
     OR has_table_privilege('public', 'public.deadline_reassignment_convergence', 'INSERT')
     OR has_table_privilege('public', 'public.deadline_reassignment_convergence', 'UPDATE')
     OR has_table_privilege('public', 'public.deadline_reassignment_convergence', 'DELETE') THEN
    RAISE EXCEPTION 'deadline reassignment convergence: grant post-condition failed';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_event_trigger
    WHERE evtname = 'ue_guard_deadline_reassignment_convergence_policy'
      AND evtenabled = 'O'
      AND evtfoid = 'public.ue_guard_deadline_reassignment_convergence_policy()'::regprocedure
  ) THEN
    RAISE EXCEPTION 'deadline reassignment convergence: policy guard is not enabled';
  END IF;
END $$;
