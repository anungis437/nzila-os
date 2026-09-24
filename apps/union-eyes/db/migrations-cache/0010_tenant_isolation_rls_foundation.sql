-- 0010_tenant_isolation_rls_foundation
--
-- Carries the db/migrations/0108 tenant-isolation RLS FOUNDATION (PART 4/5/6/7:
-- ENABLE/FORCE ROW LEVEL SECURITY + ue_org_isolation_* / ue_parent_org_isolation /
-- ue_system_full_access policies + the two durable helper functions) forward into
-- the ACTIVE scoped migration lineage (db/migrations-cache). A source-native
-- bootstrap replays this lineage, never the frozen db/migrations/0108 lineage, so
-- without this migration the 24 canonical tenant tables have the broad DML grant
-- (from 0009) but NO row-level tenant isolation — the security posture the
-- application is built around is absent. This is the RLS analogue of 0009's
-- PART 3 grant reconstruction.
--
-- Scope discipline (RLS ONLY):
--   * Does NOT create/alter roles or set passwords — provisioning owns that.
--   * Does NOT re-grant baseline DML/sequence/CONNECT — 0009 owns that.
--   * Reproduces 0108 PART 0/4/5/6/6b/6c/7/8 verbatim (byte-for-byte policy SQL
--     via the same helper functions) so the resulting catalog is semantically
--     identical to a historical 0108 apply.
--   * Idempotent (DROP POLICY IF EXISTS + CREATE, ENABLE/FORCE RLS, CREATE OR
--     REPLACE FUNCTION) — safe on a fresh source-native DB AND on a DB that
--     already received historical 0108.
--   * Source-native / CI bootstrap without Django-owned tables: helpers and
--     PART 5a/6b/6c/7 skip missing relations (NOTICE) instead of aborting the
--     scoped lineage. Snapshot/production applies still protect every present table.
--   * Does NOT touch the later scoped additive policies (0006 external-specialist
--     ue_external_*, 0007 user_management ue_auth_bootstrap_*, 0008 audit_security
--     ue_runtime_audit_*) — different tables, different policy names, untouched.
--   * Fail-closed: PART -1 below HARD FAILS if a canonical policy name already
--     exists on a protected table with a non-canonical command/role set (tamper
--     / drift), rather than silently replacing it.
--
-- PART -1 — Fail-closed conflict guard.
-- If any canonical 0108 policy name already exists on a protected table but with
-- an unexpected command or role target, refuse to proceed (the operator must
-- reconcile it manually). An exact-canonical pre-existing policy passes this
-- guard and is deterministically re-established (repository doctrine: 0108 itself
-- uses DROP POLICY IF EXISTS + CREATE) by the sections below.
DO $$
DECLARE
  r RECORD;
  expected_cmd TEXT;
  expected_role TEXT;
BEGIN
  FOR r IN
    SELECT tablename, policyname, cmd, roles
    FROM pg_policies
    WHERE schemaname = 'public'
      AND policyname IN (
        'ue_org_isolation_select','ue_org_isolation_insert','ue_org_isolation_update',
        'ue_org_isolation_delete','ue_parent_org_isolation','ue_system_full_access'
      )
      AND tablename = ANY (ARRAY[
        'organization_members','organizations','grievances','claims','grievance_deadlines',
        'documents','member_documents','workplace_incidents','safety_inspections','hazard_reports',
        'safety_committee_meetings','safety_training_records','ppe_equipment','safety_audits',
        'injury_logs','safety_policies','corrective_actions','safety_certifications',
        'message_threads','messages','message_participants','message_read_receipts',
        'message_notifications','cross_org_access_log'
      ])
  LOOP
    expected_cmd := CASE r.policyname
      WHEN 'ue_org_isolation_select' THEN 'SELECT'
      WHEN 'ue_org_isolation_insert' THEN 'INSERT'
      WHEN 'ue_org_isolation_update' THEN 'UPDATE'
      WHEN 'ue_org_isolation_delete' THEN 'DELETE'
      ELSE 'ALL'
    END;
    expected_role := CASE r.policyname
      WHEN 'ue_system_full_access' THEN 'union_eyes_system'
      ELSE 'union_eyes_runtime'
    END;
    IF r.cmd <> expected_cmd OR r.roles <> ARRAY[expected_role]::name[] THEN
      RAISE EXCEPTION
        'RLS 0010 fail-closed: pre-existing policy %.% conflicts with canonical 0108 semantics (found cmd=% roles=%, expected cmd=% role=%). Reconcile manually before applying 0010.',
        r.tablename, r.policyname, r.cmd, r.roles, expected_cmd, expected_role;
    END IF;
  END LOOP;
END
$$;
--> statement-breakpoint
-- PART 0 — Retract historical permissive policies on the protected tables so an
-- OR-combined legacy `TO public` policy can never survive alongside 0108's
-- fail-closed set. Verbatim from 0108 PART 0 (idempotent DROP POLICY IF EXISTS).
DROP POLICY IF EXISTS organizations_select_policy ON organizations;
DROP POLICY IF EXISTS organizations_insert_policy ON organizations;
DROP POLICY IF EXISTS organizations_update_policy ON organizations;
DROP POLICY IF EXISTS organizations_delete_policy ON organizations;
DROP POLICY IF EXISTS "organizations_member_access" ON organizations;
DROP POLICY IF EXISTS claims_select_policy ON claims;
DROP POLICY IF EXISTS claims_insert_policy ON claims;
DROP POLICY IF EXISTS claims_update_policy ON claims;
DROP POLICY IF EXISTS claims_delete_policy ON claims;
DROP POLICY IF EXISTS "documents_read_own" ON documents;
DROP POLICY IF EXISTS "documents_read_org_admin" ON documents;
DROP POLICY IF EXISTS "documents_create_own" ON documents;
DROP POLICY IF EXISTS "documents_update_own" ON documents;
DROP POLICY IF EXISTS "documents_delete_own" ON documents;
DROP POLICY IF EXISTS "messages_read_participant_access" ON messages;
DROP POLICY IF EXISTS "messages_create_participant_only" ON messages;
DROP POLICY IF EXISTS "messages_update_own_recent" ON messages;
DROP POLICY IF EXISTS "messages_delete_own_recent" ON messages;
DROP POLICY IF EXISTS "threads_read_participant_access" ON message_threads;
DROP POLICY IF EXISTS "threads_create_org_members" ON message_threads;
DROP POLICY IF EXISTS "threads_update_participant" ON message_threads;
DROP POLICY IF EXISTS "threads_delete_creator_or_admin" ON message_threads;
DROP POLICY IF EXISTS "threads_delete_participant" ON message_threads;
DROP POLICY IF EXISTS "participants_read_own_or_admin" ON message_participants;
DROP POLICY IF EXISTS "participants_create_org_admin" ON message_participants;
DROP POLICY IF EXISTS "participants_delete_self" ON message_participants;
DROP POLICY IF EXISTS "participants_read_own" ON message_participants;
DROP POLICY IF EXISTS "participants_create_same_org" ON message_participants;
DROP POLICY IF EXISTS "participants_update_own" ON message_participants;
DROP POLICY IF EXISTS "read_receipts_own_only" ON message_read_receipts;
DROP POLICY IF EXISTS "read_receipts_create_own" ON message_read_receipts;
DROP POLICY IF EXISTS "read_receipts_read_own" ON message_read_receipts;
DROP POLICY IF EXISTS "read_receipts_update_own" ON message_read_receipts;
DROP POLICY IF EXISTS "msg_notifications_own_only" ON message_notifications;
DROP POLICY IF EXISTS "msg_notifications_create_own" ON message_notifications;
DROP POLICY IF EXISTS "msg_notifications_update_own" ON message_notifications;
DROP POLICY IF EXISTS "message_notifications_read_own" ON message_notifications;
DROP POLICY IF EXISTS "message_notifications_create_system" ON message_notifications;
DROP POLICY IF EXISTS "message_notifications_update_own" ON message_notifications;
DROP POLICY IF EXISTS "message_notifications_delete_own" ON message_notifications;
DROP POLICY IF EXISTS "cross_org_access_log_participant" ON cross_org_access_log;
DROP POLICY IF EXISTS claim_deadlines_select_policy ON claim_deadlines;
DROP POLICY IF EXISTS claim_deadlines_insert_policy ON claim_deadlines;
DROP POLICY IF EXISTS claim_deadlines_update_policy ON claim_deadlines;
DROP POLICY IF EXISTS claim_deadlines_delete_policy ON claim_deadlines;
--> statement-breakpoint
-- PART 4 — Durable helper: fail-closed, direct-org-column policy (verbatim 0108).
CREATE OR REPLACE FUNCTION ue_create_direct_org_rls_policy(
  p_table_name TEXT,
  p_org_column TEXT DEFAULT 'organization_id',
  p_org_column_is_text BOOLEAN DEFAULT FALSE
) RETURNS VOID AS $$
DECLARE
  v_cast TEXT := CASE WHEN p_org_column_is_text THEN '' ELSE '::text' END;
BEGIN
  -- Source-native / CI bootstrap may lack Django-owned operational tables.
  -- Protect what exists; skip silently when the relation is absent (0013 pattern).
  IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0010: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
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

  EXECUTE format(
    'CREATE POLICY ue_system_full_access ON %I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
    p_table_name
  );
END;
$$ LANGUAGE plpgsql;
--> statement-breakpoint
-- PART 5a — member_documents tenant-column prerequisite (verbatim 0108 semantics).
-- Guarded for source-native / CI bootstraps where the Django-owned table is absent:
-- skip the column/index/backfill work rather than failing the whole scoped lineage.
DO $$
DECLARE
  v_zero_match_rows BIGINT;
  v_multi_match_rows BIGINT;
BEGIN
  IF to_regclass('public.member_documents') IS NULL THEN
    RAISE NOTICE 'RLS 0010: member_documents absent — skipping PART 5a tenant-column prerequisite';
    RETURN;
  END IF;

  ALTER TABLE member_documents
    ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES organizations(id);
  CREATE INDEX IF NOT EXISTS idx_member_documents_org
    ON member_documents (organization_id);
  CREATE INDEX IF NOT EXISTS idx_member_documents_user
    ON member_documents (user_id);

  SELECT
    count(*) FILTER (WHERE match_counts.distinct_org_count = 0),
    count(*) FILTER (WHERE match_counts.distinct_org_count > 1)
  INTO v_zero_match_rows, v_multi_match_rows
  FROM (
    SELECT md.id, count(DISTINCT om.organization_id) AS distinct_org_count
    FROM member_documents md
    LEFT JOIN organization_members om ON om.user_id = md.user_id
    WHERE md.organization_id IS NULL
    GROUP BY md.id
  ) AS match_counts;

  IF v_zero_match_rows > 0 OR v_multi_match_rows > 0 THEN
    RAISE EXCEPTION
      'member_documents backfill invariant violated: % row(s) with zero tenant matches, % row(s) with multiple tenant matches — ambiguous ownership must be resolved outside this migration before 0010 can proceed',
      v_zero_match_rows, v_multi_match_rows;
  END IF;

  UPDATE member_documents md
  SET organization_id = om.organization_id
  FROM organization_members om
  WHERE md.organization_id IS NULL
    AND om.user_id = md.user_id;
END;
$$;
--> statement-breakpoint
-- PART 5b — Direct org-owned tables (verbatim 0108 PART 5 invocation list).
SELECT ue_create_direct_org_rls_policy('organization_members', 'organization_id', FALSE);
SELECT ue_create_direct_org_rls_policy('organizations', 'id', FALSE);
SELECT ue_create_direct_org_rls_policy('grievances');
SELECT ue_create_direct_org_rls_policy('claims');
SELECT ue_create_direct_org_rls_policy('documents', 'organization_id');
SELECT ue_create_direct_org_rls_policy('member_documents');
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
SELECT ue_create_direct_org_rls_policy('message_threads');
--> statement-breakpoint
-- PART 6 — Durable helper: parent-owned policy (verbatim 0108).
CREATE OR REPLACE FUNCTION ue_create_parent_owned_rls_policy(
  p_table_name TEXT,
  p_parent_fk_column TEXT DEFAULT 'thread_id'
) RETURNS VOID AS $$
BEGIN
  IF to_regclass(format('public.%I', p_table_name)) IS NULL THEN
    RAISE NOTICE 'RLS 0010: skipping missing table public.%', p_table_name;
    RETURN;
  END IF;
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
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy('messages', 'thread_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy('message_participants', 'thread_id');
--> statement-breakpoint
SELECT ue_create_parent_owned_rls_policy('message_read_receipts', 'message_id');
--> statement-breakpoint
-- message_read_receipts two-hop parent policy (existence-guarded for source-native / CI bootstrap)
DO $$
BEGIN
  IF to_regclass('public.message_read_receipts') IS NULL THEN
    RAISE NOTICE 'RLS 0010: message_read_receipts absent — skipping message_read_receipts two-hop parent policy';
    RETURN;
  END IF;
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
END;
$$;
--> statement-breakpoint
-- PART 6b grievance_deadlines policies (existence-guarded for source-native / CI bootstrap)
DO $$
BEGIN
  IF to_regclass('public.grievance_deadlines') IS NULL THEN
    RAISE NOTICE 'RLS 0010: grievance_deadlines absent — skipping PART 6b grievance_deadlines policies';
    RETURN;
  END IF;
  ALTER TABLE grievance_deadlines ENABLE ROW LEVEL SECURITY;
  ALTER TABLE grievance_deadlines FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS ue_org_isolation_select ON grievance_deadlines;
  DROP POLICY IF EXISTS ue_org_isolation_insert ON grievance_deadlines;
  DROP POLICY IF EXISTS ue_org_isolation_update ON grievance_deadlines;
  DROP POLICY IF EXISTS ue_org_isolation_delete ON grievance_deadlines;
  DROP POLICY IF EXISTS ue_system_full_access ON grievance_deadlines;
  CREATE POLICY ue_org_isolation_select ON grievance_deadlines FOR SELECT TO union_eyes_runtime
    USING (EXISTS (
      SELECT 1 FROM grievances g
      WHERE g.id = grievance_deadlines.grievance_id
        AND g.organization_id::text = current_setting('app.current_org_id', true)
    ));
  CREATE POLICY ue_org_isolation_insert ON grievance_deadlines FOR INSERT TO union_eyes_runtime
    WITH CHECK (EXISTS (
      SELECT 1 FROM grievances g
      WHERE g.id = grievance_deadlines.grievance_id
        AND g.organization_id::text = current_setting('app.current_org_id', true)
    ));
  CREATE POLICY ue_org_isolation_update ON grievance_deadlines FOR UPDATE TO union_eyes_runtime
    USING (EXISTS (
      SELECT 1 FROM grievances g
      WHERE g.id = grievance_deadlines.grievance_id
        AND g.organization_id::text = current_setting('app.current_org_id', true)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM grievances g
      WHERE g.id = grievance_deadlines.grievance_id
        AND g.organization_id::text = current_setting('app.current_org_id', true)
    ));
  CREATE POLICY ue_org_isolation_delete ON grievance_deadlines FOR DELETE TO union_eyes_runtime
    USING (EXISTS (
      SELECT 1 FROM grievances g
      WHERE g.id = grievance_deadlines.grievance_id
        AND g.organization_id::text = current_setting('app.current_org_id', true)
    ));
  CREATE POLICY ue_system_full_access ON grievance_deadlines FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
END;
$$;
--> statement-breakpoint
-- PART 6c message_notifications policies (existence-guarded for source-native / CI bootstrap)
DO $$
BEGIN
  IF to_regclass('public.message_notifications') IS NULL THEN
    RAISE NOTICE 'RLS 0010: message_notifications absent — skipping PART 6c message_notifications policies';
    RETURN;
  END IF;
  ALTER TABLE message_notifications ENABLE ROW LEVEL SECURITY;
  ALTER TABLE message_notifications FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS ue_parent_org_isolation ON message_notifications;
  DROP POLICY IF EXISTS ue_system_full_access ON message_notifications;
  CREATE POLICY ue_parent_org_isolation ON message_notifications FOR ALL TO union_eyes_runtime
    USING (EXISTS (
      SELECT 1 FROM messages m
      JOIN message_threads mt ON mt.id = m.thread_id
      WHERE m.id = message_notifications.message_id
        AND mt.organization_id::text = current_setting('app.current_org_id', true)
    ))
    WITH CHECK (EXISTS (
      SELECT 1 FROM messages m
      JOIN message_threads mt ON mt.id = m.thread_id
      WHERE m.id = message_notifications.message_id
        AND mt.organization_id::text = current_setting('app.current_org_id', true)
    ));
  CREATE POLICY ue_system_full_access ON message_notifications FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
END;
$$;
--> statement-breakpoint
-- PART 7 cross_org_access_log policies (existence-guarded for source-native / CI bootstrap)
DO $$
BEGIN
  IF to_regclass('public.cross_org_access_log') IS NULL THEN
    RAISE NOTICE 'RLS 0010: cross_org_access_log absent — skipping PART 7 cross_org_access_log policies';
    RETURN;
  END IF;
  ALTER TABLE cross_org_access_log ENABLE ROW LEVEL SECURITY;
  ALTER TABLE cross_org_access_log FORCE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS ue_system_full_access ON cross_org_access_log;
  CREATE POLICY ue_system_full_access ON cross_org_access_log FOR ALL TO union_eyes_system USING (true) WITH CHECK (true);
END;
$$;
--> statement-breakpoint
-- PART 8 — Prohibition check (verbatim 0108): fail if any protected-table policy
-- reintroduces the empty-context-bypass anti-pattern.
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
