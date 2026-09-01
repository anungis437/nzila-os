-- =============================================================================
-- 0108_rls_tenant_isolation_foundation.sql
--
-- Union Eyes — RLS Tenant-Isolation Foundation (root remediation)
--
-- Context: Phase 3A runtime acceptance (docs/union-eyes/reality-remediation/
-- 26_UE_PHASE3A_RUNTIME_ACCEPTANCE.md, PR #751) proved against live staging
-- that:
--   (a) the application's own DATABASE_URL role (`nzilaadmin`) has
--       rolbypassrls = true, so it ignores RLS entirely regardless of what
--       policies exist; and
--   (b) none of the tested tenant-domain tables had RLS enabled at all —
--       zero policies existed on any of them.
-- This migration is the root fix for both: it provisions two new,
-- non-superuser, non-bypass database roles, and enables FAIL-CLOSED,
-- FORCE ROW LEVEL SECURITY policies on the tenant-domain tables that make
-- up the real, currently-shipped Phase 3A capability surface.
--
-- Explicit prohibitions carried over from prior migrations that must NOT be
-- repeated here:
--   - `053_enable_rls_policies.sql` (db/migrations/manual/) is NOT applied by
--     this migration. It targets `app.current_tenant_id`, which the current
--     `withRLSContext()` contract does not set (it sets `app.current_org_id`);
--     running it as-is would silently fail closed for the wrong reason and
--     leave stale policy definitions behind. Superseded, not reused, here.
--   - `0097_nzilaos_rls_org_isolation.sql`'s `system_bypass` policy pattern
--     (`current_setting('app.current_org_id', true) = '' OR ... IS NULL`
--     grants unrestricted access) is explicitly NOT propagated to any table
--     touched by this migration. Missing tenant context must fail closed.
--     System/background access is instead granted to a separately
--     provisioned, separately credentialed role (`union_eyes_system`) —
--     see PART 2 below — never inferred from an app-settable session
--     variable being empty.
--
-- Scope: tables owned by Union Eyes' own schema in this database
-- (nzila_os_staging / the equivalent prod database), confirmed live via
-- information_schema introspection on 2026-09-01. Root-level `/migrations/`
-- tables (e.g. the Sage deadline-engine tables) belong to a different
-- package/database boundary and are explicitly out of scope here.
--
-- Idempotent: safe to re-run. Role creation, RLS enablement, policy
-- creation, and grants are all guarded.
-- =============================================================================

-- =============================================================================
-- PART 1 — Runtime principal (`union_eyes_runtime`)
--
-- This is the role the deployed application's ordinary tenant-scoped
-- DATABASE_URL will use (see the accompanying provisioning script and
-- .github/workflows/deploy-union-eyes.yml change). It must never bypass RLS.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime') THEN
    CREATE ROLE union_eyes_runtime
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS
      INHERIT
      NOLOGIN; -- LOGIN + PASSWORD are set by the provisioning script, never by this migration.
  ELSE
    ALTER ROLE union_eyes_runtime
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS
      INHERIT;
  END IF;
END
$$;

-- =============================================================================
-- PART 2 — System principal (`union_eyes_system`)
--
-- Used ONLY by the application's bounded background/admin code paths
-- (withSystemContext / withSystemRLSContext / withPlatformAdminRLSContext in
-- apps/union-eyes/lib/db/with-rls-context.ts), via a SEPARATE connection the
-- application code establishes explicitly for those paths. It is not reachable
-- by clearing app.current_org_id on the ordinary tenant connection — that
-- connection is never authenticated as this role.
--
-- Deliberately NOT granted BYPASSRLS: authority comes from explicit,
-- named-role policies below (`TO union_eyes_system`), which Postgres verifies
-- via actual role membership, not from any session-settable variable.
-- =============================================================================

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
    CREATE ROLE union_eyes_system
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS
      INHERIT
      NOLOGIN;
  ELSE
    ALTER ROLE union_eyes_system
      NOSUPERUSER
      NOCREATEDB
      NOCREATEROLE
      NOREPLICATION
      NOBYPASSRLS
      INHERIT;
  END IF;
END
$$;

-- =============================================================================
-- PART 3 — Baseline schema/table grants
--
-- Table-level GRANT and row-level RLS POLICY are independent controls. Both
-- roles need ordinary DML grants across the schema so the application keeps
-- working for the (much larger) set of tables that are not part of this
-- migration's protected set — RLS narrows visibility at the row level only
-- for the tables enumerated in PART 5; every other table is unaffected by
-- this migration and continues to be scoped at the application/query-builder
-- layer exactly as it is today.
-- =============================================================================

GRANT USAGE ON SCHEMA public TO union_eyes_runtime, union_eyes_system;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO union_eyes_runtime, union_eyes_system;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO union_eyes_runtime, union_eyes_system;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO union_eyes_runtime, union_eyes_system;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO union_eyes_runtime, union_eyes_system;

DO $$
BEGIN
  EXECUTE format('GRANT CONNECT ON DATABASE %I TO union_eyes_runtime, union_eyes_system', current_database());
END
$$;

-- =============================================================================
-- PART 4 — Helper: fail-closed, direct-org-column policy
--
-- For tables with their own organization column. Unlike
-- create_org_rls_policy() in 0097, this helper creates NO system_bypass
-- policy — a session with no org context sees zero rows, full stop.
-- =============================================================================

CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy(
  p_table_name TEXT,
  p_org_column TEXT DEFAULT 'organization_id',
  p_org_column_is_text BOOLEAN DEFAULT FALSE -- true for organization_members, whose organization_id is TEXT
) RETURNS VOID AS $$
DECLARE
  v_cast TEXT := CASE WHEN p_org_column_is_text THEN '' ELSE '::text' END;
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  EXECUTE format(
    'CREATE POLICY ue_org_isolation_select ON %I FOR SELECT TO union_eyes_runtime ' ||
    'USING (%I%s = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, v_cast
  );
  EXECUTE format(
    'CREATE POLICY ue_org_isolation_insert ON %I FOR INSERT TO union_eyes_runtime ' ||
    'WITH CHECK (%I%s = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, v_cast
  );
  EXECUTE format(
    'CREATE POLICY ue_org_isolation_update ON %I FOR UPDATE TO union_eyes_runtime ' ||
    'USING (%I%s = current_setting(''app.current_org_id'', true)) ' ||
    'WITH CHECK (%I%s = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, v_cast, p_org_column, v_cast
  );
  EXECUTE format(
    'CREATE POLICY ue_org_isolation_delete ON %I FOR DELETE TO union_eyes_runtime ' ||
    'USING (%I%s = current_setting(''app.current_org_id'', true))',
    p_table_name, p_org_column, v_cast
  );

  -- System principal: explicit, unconditional access, gated by actual role
  -- membership (TO union_eyes_system) rather than session state.
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

-- =============================================================================
-- PART 5 — Direct org-owned tables (protected set derived from the actual
-- Phase 3A capability surface, not just the 9 tables from the exploratory
-- probe: members, grievances/claims, deadlines, documents/evidence,
-- Health & Safety).
-- =============================================================================

-- Members
SELECT ue_create_direct_org_rls_policy('organization_members', 'organization_id', TRUE); -- TEXT column, see note above
SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE); -- a tenant sees only its own org row

-- Grievances / claims
SELECT ue_create_direct_org_rls_policy('grievances');
SELECT ue_create_direct_org_rls_policy('claims');
SELECT ue_create_direct_org_rls_policy('grievance_deadlines');

-- Documents / evidence
-- NOTE: `documents` has both `organization_id` and a duplicate legacy
-- `org_id` column (confirmed live via information_schema, 2026-09-01). This
-- migration authoritatively scopes by `organization_id` only. The duplicate
-- `org_id` column is a pre-existing data-quality issue tracked separately —
-- it is not enforced here so a divergent `org_id` cannot silently EXPAND
-- visibility, only the authoritative column is policy-relevant.
SELECT ue_create_direct_org_rls_policy('documents', 'organization_id');
SELECT ue_create_direct_org_rls_policy('member_documents');

-- Health & Safety (all 11 tables confirmed to carry a direct organization_id)
SELECT ue_create_direct_org_rls_policy('workplace_incidents');
SELECT ue_create_direct_org_rls_policy('safety_inspections');
SELECT ue_create_direct_org_rls_policy('hazard_reports');
SELECT ue_create_direct_org_rls_policy('safety_committee_meetings');
SELECT ue_create_direct_org_rls_policy('safety_training_records');
SELECT ue_create_direct_org_rls_policy('ppe_equipment');
SELECT ue_create_direct_org_rls_policy('safety_audits');
SELECT ue_create_direct_org_rls_policy('injury_logs');
SELECT ue_create_direct_org_rls_policy('safety_policies');
SELECT ue_create_direct_org_rls_policy('corrective_actions');
SELECT ue_create_direct_org_rls_policy('safety_certifications');

-- Correspondence — parent
SELECT ue_create_direct_org_rls_policy('message_threads');

-- =============================================================================
-- PART 6 — Parent-owned tables (correspondence detail tables scope through
-- message_threads.organization_id; they carry no organization column of
-- their own — confirmed live via information_schema).
-- =============================================================================

CREATE OR REPLACE FUNCTION ue_create_parent_owned_rls_policy(
  p_table_name TEXT,
  p_parent_fk_column TEXT DEFAULT 'thread_id'
) RETURNS VOID AS $$
BEGIN
  EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', p_table_name);
  EXECUTE format('ALTER TABLE %I FORCE ROW LEVEL SECURITY', p_table_name);

  EXECUTE format('DROP POLICY IF EXISTS ue_parent_org_isolation ON %I', p_table_name);
  EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON %I', p_table_name);

  EXECUTE format(
    'CREATE POLICY ue_parent_org_isolation ON %I FOR ALL TO union_eyes_runtime ' ||
    'USING (EXISTS (SELECT 1 FROM message_threads mt WHERE mt.id = %I.%I ' ||
    '  AND mt.organization_id::text = current_setting(''app.current_org_id'', true))) ' ||
    'WITH CHECK (EXISTS (SELECT 1 FROM message_threads mt WHERE mt.id = %I.%I ' ||
    '  AND mt.organization_id::text = current_setting(''app.current_org_id'', true)))',
    p_table_name, p_table_name, p_parent_fk_column, p_table_name, p_parent_fk_column
  );
  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;

SELECT ue_create_parent_owned_rls_policy('messages', 'thread_id');
SELECT ue_create_parent_owned_rls_policy('message_participants', 'thread_id');
SELECT ue_create_parent_owned_rls_policy('message_read_receipts', 'message_id'); -- via messages -> thread_id, handled below
SELECT ue_create_parent_owned_rls_policy('message_notifications', 'thread_id');

-- message_read_receipts references messages(id), not message_threads(id)
-- directly — replace its policy with a two-hop join instead of reusing the
-- generic helper's single-hop assumption.
DROP POLICY IF EXISTS ue_parent_org_isolation ON message_read_receipts;
CREATE POLICY ue_parent_org_isolation ON message_read_receipts FOR ALL TO union_eyes_runtime
  USING (EXISTS (
    SELECT 1 FROM messages m
    JOIN message_threads mt ON mt.id = m.thread_id
    WHERE m.id = message_read_receipts.message_id
      AND mt.organization_id::text = current_setting('app.current_org_id', true)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM messages m
    JOIN message_threads mt ON mt.id = m.thread_id
    WHERE m.id = message_read_receipts.message_id
      AND mt.organization_id::text = current_setting('app.current_org_id', true)
  ));

-- =============================================================================
-- PART 7 — Cross-org audit table
--
-- `cross_org_access_log` has no organization column at all (confirmed live)
-- and, by definition, records events that span organizations. It gets RLS +
-- FORCE RLS with NO tenant-facing SELECT/INSERT/UPDATE/DELETE policy at all —
-- the ordinary runtime role therefore sees nothing here (fail-closed by
-- omission). Only the system role can read/write it.
-- =============================================================================

ALTER TABLE cross_org_access_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE cross_org_access_log FORCE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS ue_system_full_access ON cross_org_access_log;
CREATE POLICY ue_system_full_access ON cross_org_access_log FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);

-- =============================================================================
-- PART 8 — Explicit prohibition check (defensive, documentation-as-code)
--
-- Fails the migration if any policy on a table this migration touches uses
-- the empty-context-bypass pattern. This cannot happen from the statements
-- above, but guards against a future edit accidentally reintroducing it.
-- =============================================================================

DO $$
DECLARE
  v_bad_policy RECORD;
BEGIN
  FOR v_bad_policy IN
    SELECT schemaname, tablename, policyname, qual
    FROM pg_policies
    WHERE tablename IN (
      'organization_members','organizations','grievances','claims','grievance_deadlines',
      'documents','member_documents','workplace_incidents','safety_inspections','hazard_reports',
      'safety_committee_meetings','safety_training_records','ppe_equipment','safety_audits',
      'injury_logs','safety_policies','corrective_actions','safety_certifications',
      'message_threads','messages','message_participants','message_read_receipts',
      'message_notifications','cross_org_access_log'
    )
    AND qual ILIKE '%IS NULL%' AND qual ILIKE '%current_org_id%'
  LOOP
    RAISE EXCEPTION 'Prohibited empty-context-bypass pattern found on %.%: policy % -> %',
      v_bad_policy.schemaname, v_bad_policy.tablename, v_bad_policy.policyname, v_bad_policy.qual;
  END LOOP;
END
$$;
