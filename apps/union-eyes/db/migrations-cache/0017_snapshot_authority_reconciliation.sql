-- 0017_snapshot_authority_reconciliation
--
-- Idempotent security reconciliation for ACL-stripped snapshot restore and
-- for a fresh bootstrap that already applied 0006-0016. It does not rewrite
-- those files and it does not change their hashes. A recorded hash is not
-- evidence that these effects are present.
--
-- Effects:
--   * public schema is not granted to PostgreSQL PUBLIC.
--   * runtime and system receive USAGE only, never CREATE.
--   * scoped 0006-0008 table grants and policies are reapplied when the
--     physical relation exists.
--   * SYSTEM_ONLY relations that 0016 does not own gain FORCE RLS and the
--     existing ue_system_full_access geometry. No direct-org policy is added.
--   * Django framework and platform-metadata relations, when present, are
--     granted only to their dedicated roles.
--   * public.users and public.oauth_providers stay self-owned legacy metadata.
--   * evidence_artifacts stays parent-owned through evidence_packs.org_id.
-- CONNECT is not granted here. The bootstrap grants it only after admission.

REVOKE ALL ON SCHEMA public FROM PUBLIC;
--> statement-breakpoint
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'public') THEN
    EXECUTE 'REVOKE CREATE ON SCHEMA public FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT USAGE ON SCHEMA public TO union_eyes_runtime, union_eyes_system';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'user_management') THEN
    EXECUTE 'REVOKE CREATE ON SCHEMA user_management FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT USAGE ON SCHEMA user_management TO union_eyes_runtime, union_eyes_system';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_namespace WHERE nspname = 'audit_security') THEN
    EXECUTE 'REVOKE CREATE ON SCHEMA audit_security FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT USAGE ON SCHEMA audit_security TO union_eyes_runtime';
  END IF;
END $$;
--> statement-breakpoint
DO $$
BEGIN
  IF to_regclass('user_management.users') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE user_management.users FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE user_management.users TO union_eyes_runtime';
    EXECUTE 'GRANT SELECT, UPDATE ON TABLE user_management.users TO union_eyes_system';
    EXECUTE 'ALTER TABLE user_management.users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE user_management.users FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ue_auth_users_self_select ON user_management.users';
    EXECUTE $policy$CREATE POLICY ue_auth_users_self_select ON user_management.users
      FOR SELECT TO union_eyes_runtime
      USING (user_id = current_setting('app.current_user_id', true))$policy$;
    EXECUTE 'DROP POLICY IF EXISTS ue_auth_bootstrap_users_select_system ON user_management.users';
    EXECUTE $policy$CREATE POLICY ue_auth_bootstrap_users_select_system ON user_management.users
      FOR SELECT TO union_eyes_system USING (true)$policy$;
    EXECUTE 'DROP POLICY IF EXISTS ue_auth_bootstrap_users_update_system ON user_management.users';
    EXECUTE $policy$CREATE POLICY ue_auth_bootstrap_users_update_system ON user_management.users
      FOR UPDATE TO union_eyes_system USING (true) WITH CHECK (true)$policy$;
  END IF;
  IF to_regclass('user_management.organization_users') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE user_management.organization_users FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE user_management.organization_users TO union_eyes_runtime';
    EXECUTE 'GRANT SELECT ON TABLE user_management.organization_users TO union_eyes_system';
    EXECUTE 'ALTER TABLE user_management.organization_users ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE user_management.organization_users FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ue_auth_organization_users_self_select ON user_management.organization_users';
    EXECUTE $policy$CREATE POLICY ue_auth_organization_users_self_select ON user_management.organization_users
      FOR SELECT TO union_eyes_runtime
      USING (user_id = current_setting('app.current_user_id', true))$policy$;
    EXECUTE 'DROP POLICY IF EXISTS ue_auth_bootstrap_organization_users_system ON user_management.organization_users';
    EXECUTE $policy$CREATE POLICY ue_auth_bootstrap_organization_users_system ON user_management.organization_users
      FOR SELECT TO union_eyes_system USING (true)$policy$;
  END IF;
  IF to_regclass('user_management.auth_audit_log') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE user_management.auth_audit_log FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT SELECT, INSERT ON TABLE user_management.auth_audit_log TO union_eyes_system';
    EXECUTE 'ALTER TABLE user_management.auth_audit_log ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE user_management.auth_audit_log FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ue_auth_bootstrap_audit_system ON user_management.auth_audit_log';
    EXECUTE $policy$CREATE POLICY ue_auth_bootstrap_audit_system ON user_management.auth_audit_log
      FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)$policy$;
  END IF;
  IF to_regclass('user_management.mfa_totp') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE user_management.mfa_totp FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE user_management.mfa_totp TO union_eyes_system';
    EXECUTE 'ALTER TABLE user_management.mfa_totp ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE user_management.mfa_totp FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ue_auth_bootstrap_mfa_system ON user_management.mfa_totp';
    EXECUTE $policy$CREATE POLICY ue_auth_bootstrap_mfa_system ON user_management.mfa_totp
      FOR SELECT TO union_eyes_system USING (true)$policy$;
  END IF;
  IF to_regclass('user_management.org_auth_policies') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE user_management.org_auth_policies FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT SELECT ON TABLE user_management.org_auth_policies TO union_eyes_system';
    EXECUTE 'ALTER TABLE user_management.org_auth_policies ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE user_management.org_auth_policies FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ue_auth_bootstrap_org_policies_system ON user_management.org_auth_policies';
    EXECUTE $policy$CREATE POLICY ue_auth_bootstrap_org_policies_system ON user_management.org_auth_policies
      FOR SELECT TO union_eyes_system USING (true)$policy$;
  END IF;
  IF to_regclass('user_management.user_sessions') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE user_management.user_sessions FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE user_management.user_sessions TO union_eyes_system';
    EXECUTE 'ALTER TABLE user_management.user_sessions ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE user_management.user_sessions FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS ue_auth_bootstrap_sessions_system ON user_management.user_sessions';
    EXECUTE $policy$CREATE POLICY ue_auth_bootstrap_sessions_system ON user_management.user_sessions
      FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)$policy$;
  END IF;
  IF to_regclass('audit_security.audit_logs') IS NOT NULL THEN
    EXECUTE 'REVOKE ALL ON TABLE audit_security.audit_logs FROM union_eyes_runtime, union_eyes_system, PUBLIC';
    EXECUTE 'GRANT INSERT ON TABLE audit_security.audit_logs TO union_eyes_runtime';
    EXECUTE 'ALTER TABLE audit_security.audit_logs ENABLE ROW LEVEL SECURITY';
    EXECUTE 'ALTER TABLE audit_security.audit_logs FORCE ROW LEVEL SECURITY';
    EXECUTE 'DROP POLICY IF EXISTS audit_insert_all ON audit_security.audit_logs';
    EXECUTE 'DROP POLICY IF EXISTS ue_runtime_audit_insert ON audit_security.audit_logs';
    EXECUTE $policy$CREATE POLICY ue_runtime_audit_insert ON audit_security.audit_logs
      FOR INSERT TO union_eyes_runtime
      WITH CHECK (
        organization_id IS NOT NULL
        AND organization_id::text = current_setting('app.current_org_id', true)
        AND user_id IS NOT NULL
        AND user_id::text = current_setting('app.current_user_id', true)
      )$policy$;
  END IF;
END $$;
--> statement-breakpoint
-- Relations whose reviewed contract grants union_eyes_system and not
-- union_eyes_runtime, and which 0016 does not own. Skip when absent.
-- Do not install a direct-org policy: several have an organization column
-- and are still cross-organization. deadline_reassignment_convergence is
-- included because its runtime privilege list is empty.
DO $$
DECLARE
  t text;
  system_only text[] := ARRAY[
    'clc_organization_sync_log',
    'council_elections',
    'customer_nps_surveys',
    'customer_onboarding_milestones',
    'golden_shares',
    'governance_events',
    'mission_audits',
    'organization_billing_config',
    'organization_relationships',
    'remittance_approvals',
    'reserved_matter_votes',
    'support_tickets',
    'union_density',
    'webhook_receipts',
    'deadline_reassignment_convergence'
  ];
BEGIN
  FOREACH t IN ARRAY system_only LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('ALTER TABLE public.%I FORCE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_select ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_insert ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_update ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_org_isolation_delete ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_parent_org_isolation_v2 ON public.%I', t);
    EXECUTE format('DROP POLICY IF EXISTS ue_system_full_access ON public.%I', t);
    EXECUTE format(
      'CREATE POLICY ue_system_full_access ON public.%I FOR ALL TO union_eyes_system USING (true) WITH CHECK (true)',
      t
    );
  END LOOP;
END $$;
--> statement-breakpoint
-- Direct-org only when the physical column is already uuid NOT NULL.
-- A present relation with a different geometry fails closed.
DO $$
DECLARE
  t text;
  direct_org text[] := ARRAY[
    'anti_scab_violations',
    'cnesst_filings',
    'joint_hs_committees',
    'member_dues_issues',
    'pay_equity_exercises',
    'payroll_deductions',
    'preventive_withdrawals',
    'right_of_refusal_events',
    'wcb_claims',
    'wcb_employer_assessments'
  ];
BEGIN
  FOREACH t IN ARRAY direct_org LOOP
    IF to_regclass(format('public.%I', t)) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = t
        AND column_name = 'organization_id' AND udt_name = 'uuid' AND is_nullable = 'NO'
    ) THEN
      RAISE EXCEPTION '0017 fail-closed: public.% exists without uuid NOT NULL organization_id', t;
    END IF;
    PERFORM ue_create_direct_org_rls_policy(t);
  END LOOP;
END $$;
--> statement-breakpoint
DO $framework$
DECLARE
  role_name text;
  target text;
  relation text;
  own_predicate text;
  identity_privilege text;
  framework_tables text[] := ARRAY[
    'auth_group','auth_group_permissions','auth_permission','auth_user','auth_user_groups',
    'auth_user_user_permissions','django_admin_log','django_content_type','django_migrations',
    'django_session','django_celery_beat_clockedschedule','django_celery_beat_crontabschedule',
    'django_celery_beat_intervalschedule','django_celery_beat_periodictask',
    'django_celery_beat_periodictasks','django_celery_beat_solarschedule',
    'django_celery_results_chordcounter','django_celery_results_groupresult',
    'django_celery_results_taskresult','failed_login_attempts','rate_limit_events'
  ];
  identity_grants text[] := ARRAY[
    'auth_user:SELECT','auth_user:INSERT','auth_user:UPDATE',
    'auth_user_groups:SELECT','auth_user_user_permissions:SELECT',
    'auth_group:SELECT','auth_group_permissions:SELECT',
    'auth_permission:SELECT','django_content_type:SELECT'
  ];
BEGIN
  FOREACH role_name IN ARRAY ARRAY[
    'ue_framework_gateway','ue_framework_identity','ue_framework_admin',
    'ue_framework_worker_gateway','ue_framework_worker','ue_framework_authority_reader'
  ] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = role_name) THEN
      EXECUTE format(
        'CREATE ROLE %I NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE',
        role_name
      );
    END IF;
    IF EXISTS (
      SELECT 1 FROM pg_roles
      WHERE rolname = role_name
        AND (rolsuper OR rolbypassrls OR rolcanlogin OR rolinherit OR rolcreatedb OR rolcreaterole)
    ) THEN
      RAISE EXCEPTION 'Unsafe existing framework role: %', role_name;
    END IF;
  END LOOP;
  -- Plain membership. The gateway roles are created NOINHERIT and rejected if
  -- that changes. On PostgreSQL 15, which is the snapshot acceptance server,
  -- that role attribute is what keeps the membership from inheriting table
  -- privileges while still allowing SET ROLE. The per-grant inherit clause is
  -- PostgreSQL 16 syntax and fails there.
  EXECUTE 'GRANT ue_framework_identity, ue_framework_admin TO ue_framework_gateway';
  EXECUTE 'GRANT ue_framework_worker TO ue_framework_worker_gateway';
  EXECUTE 'GRANT USAGE ON SCHEMA public TO ue_framework_identity, ue_framework_admin, ue_framework_worker';
  IF to_regclass('user_management.users') IS NOT NULL AND to_regclass('user_management.user_sessions') IS NOT NULL THEN
    EXECUTE 'GRANT USAGE ON SCHEMA user_management TO ue_framework_authority_reader, ue_framework_identity, ue_framework_admin';
    EXECUTE 'GRANT SELECT ON TABLE user_management.users, user_management.user_sessions TO ue_framework_authority_reader';
    EXECUTE 'REVOKE CREATE ON SCHEMA user_management FROM ue_framework_authority_reader';
    EXECUTE 'DROP POLICY IF EXISTS ue_framework_authority_reader_select ON user_management.users';
    EXECUTE 'CREATE POLICY ue_framework_authority_reader_select ON user_management.users FOR SELECT TO ue_framework_authority_reader USING (true)';
    EXECUTE 'DROP POLICY IF EXISTS ue_framework_authority_reader_select ON user_management.user_sessions';
    EXECUTE 'CREATE POLICY ue_framework_authority_reader_select ON user_management.user_sessions FOR SELECT TO ue_framework_authority_reader USING (true)';
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION user_management.ue_framework_actor_authorized()
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
      AS $body$
        SELECT EXISTS (
          SELECT FROM user_management.users u
          JOIN user_management.user_sessions s ON s.user_id = u.user_id
          WHERE u.user_id = NULLIF(current_setting('app.current_user_id', true), '')
            AND u.is_active AND u.lifecycle_state = 'active'
            AND s.session_token_hash = encode(sha256(convert_to(NULLIF(current_setting('app.current_session_token', true), ''), 'UTF8')), 'hex')
            AND s.is_active AND s.expires_at > statement_timestamp()
            AND (s.organization_id IS NULL OR s.organization_id::text = NULLIF(current_setting('app.current_org_id', true), ''))
        )
      $body$
    $fn$;
    EXECUTE $fn$
      CREATE OR REPLACE FUNCTION user_management.ue_framework_admin_authorized()
      RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog
      AS $body$
        SELECT EXISTS (
          SELECT FROM user_management.users u
          JOIN user_management.user_sessions s ON s.user_id = u.user_id
          WHERE u.user_id = NULLIF(current_setting('app.current_user_id', true), '')
            AND u.is_active AND u.lifecycle_state = 'active' AND u.is_system_admin
            AND s.session_token_hash = encode(sha256(convert_to(NULLIF(current_setting('app.current_session_token', true), ''), 'UTF8')), 'hex')
            AND s.is_active AND s.expires_at > statement_timestamp()
            AND (s.organization_id IS NULL OR s.organization_id::text = NULLIF(current_setting('app.current_org_id', true), ''))
        )
      $body$
    $fn$;
    EXECUTE 'ALTER FUNCTION user_management.ue_framework_actor_authorized() OWNER TO ue_framework_authority_reader';
    EXECUTE 'ALTER FUNCTION user_management.ue_framework_admin_authorized() OWNER TO ue_framework_authority_reader';
    EXECUTE 'REVOKE ALL ON FUNCTION user_management.ue_framework_actor_authorized() FROM PUBLIC, union_eyes_runtime, union_eyes_system';
    EXECUTE 'REVOKE ALL ON FUNCTION user_management.ue_framework_admin_authorized() FROM PUBLIC, union_eyes_runtime, union_eyes_system';
    EXECUTE 'GRANT EXECUTE ON FUNCTION user_management.ue_framework_actor_authorized() TO ue_framework_identity, ue_framework_admin';
    EXECUTE 'GRANT EXECUTE ON FUNCTION user_management.ue_framework_admin_authorized() TO ue_framework_identity, ue_framework_admin';
  END IF;

  FOREACH target IN ARRAY framework_tables LOOP
    IF to_regclass(format('public.%I', target)) IS NULL THEN
      CONTINUE;
    END IF;
    relation := format('public.%I', target);
    EXECUTE format('ALTER TABLE %s ENABLE ROW LEVEL SECURITY', relation);
    EXECUTE format('ALTER TABLE %s FORCE ROW LEVEL SECURITY', relation);
    EXECUTE format(
      'REVOKE ALL ON TABLE %s FROM PUBLIC, union_eyes_runtime, union_eyes_system, ue_framework_gateway, ue_framework_identity, ue_framework_admin, ue_framework_worker_gateway, ue_framework_worker, ue_framework_authority_reader',
      relation
    );
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO ue_framework_admin', relation);
    IF target LIKE 'django_celery_%' THEN
      EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE %s TO ue_framework_worker', relation);
      EXECUTE format('DROP POLICY IF EXISTS ue_framework_worker ON %s', relation);
      EXECUTE format(
        'CREATE POLICY ue_framework_worker ON %s FOR ALL TO ue_framework_worker USING (true) WITH CHECK (true)',
        relation
      );
    END IF;
    FOREACH identity_privilege IN ARRAY identity_grants LOOP
      IF split_part(identity_privilege, ':', 1) <> target THEN
        CONTINUE;
      END IF;
      EXECUTE format(
        'GRANT %s ON TABLE %s TO ue_framework_identity',
        split_part(identity_privilege, ':', 2),
        relation
      );
      IF target = 'auth_user' THEN
        own_predicate := 'username = (''uev2_''||encode(sha256(convert_to(NULLIF(current_setting(''app.current_user_id'', true), ''''), ''UTF8'')), ''hex'')) AND is_active';
      ELSIF target IN ('auth_user_groups', 'auth_user_user_permissions') THEN
        own_predicate := format(
          'EXISTS (SELECT FROM public.auth_user u WHERE u.id = %s.user_id AND u.username = (''uev2_''||encode(sha256(convert_to(NULLIF(current_setting(''app.current_user_id'', true), ''''), ''UTF8'')), ''hex'')))',
          relation
        );
      ELSE
        own_predicate := 'true';
      END IF;
      EXECUTE format('DROP POLICY IF EXISTS %I ON %s', 'ue_framework_identity_' || lower(split_part(identity_privilege, ':', 2)), relation);
      IF split_part(identity_privilege, ':', 2) = 'SELECT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON %s FOR SELECT TO ue_framework_identity USING (user_management.ue_framework_actor_authorized() AND (%s))',
          'ue_framework_identity_select', relation, own_predicate
        );
      ELSIF split_part(identity_privilege, ':', 2) = 'INSERT' THEN
        EXECUTE format(
          'CREATE POLICY %I ON %s FOR INSERT TO ue_framework_identity WITH CHECK (user_management.ue_framework_actor_authorized() AND (%s)%s)',
          'ue_framework_identity_insert', relation, own_predicate,
          CASE WHEN target = 'auth_user' THEN ' AND NOT is_superuser AND (NOT is_staff OR user_management.ue_framework_admin_authorized())' ELSE '' END
        );
      ELSE
        EXECUTE format(
          'CREATE POLICY %I ON %s FOR UPDATE TO ue_framework_identity USING (user_management.ue_framework_actor_authorized() AND (%s)) WITH CHECK (user_management.ue_framework_actor_authorized() AND (%s)%s)',
          'ue_framework_identity_update', relation, own_predicate, own_predicate,
          CASE WHEN target = 'auth_user' THEN ' AND NOT is_superuser AND (NOT is_staff OR user_management.ue_framework_admin_authorized())' ELSE '' END
        );
      END IF;
    END LOOP;
    EXECUTE format('DROP POLICY IF EXISTS ue_framework_admin ON %s', relation);
    IF target = 'auth_user' THEN
      EXECUTE format(
        'CREATE POLICY ue_framework_admin ON %s FOR ALL TO ue_framework_admin USING (user_management.ue_framework_admin_authorized()) WITH CHECK (user_management.ue_framework_admin_authorized() AND NOT is_superuser)',
        relation
      );
    ELSIF target IN ('failed_login_attempts', 'rate_limit_events') THEN
      EXECUTE format('DROP POLICY IF EXISTS ue_platform_metadata_admin ON %s', relation);
      EXECUTE format(
        'CREATE POLICY ue_platform_metadata_admin ON %s FOR ALL TO ue_framework_admin USING (user_management.ue_framework_admin_authorized()) WITH CHECK (user_management.ue_framework_admin_authorized())',
        relation
      );
    ELSE
      EXECUTE format(
        'CREATE POLICY ue_framework_admin ON %s FOR ALL TO ue_framework_admin USING (user_management.ue_framework_admin_authorized()) WITH CHECK (user_management.ue_framework_admin_authorized())',
        relation
      );
    END IF;
  END LOOP;
END $framework$;
--> statement-breakpoint
DO $$
DECLARE
  legacy text;
BEGIN
  FOREACH legacy IN ARRAY ARRAY['users', 'oauth_providers'] LOOP
    IF to_regclass(format('public.%I', legacy)) IS NULL THEN
      CONTINUE;
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = legacy
        AND column_name = 'user_id' AND udt_name = 'varchar'
    ) THEN
      RAISE EXCEPTION '0017 fail-closed: public.% user_id is not varchar. It is not user_management.users.', legacy;
    END IF;
    PERFORM ue_create_user_rls_policy(legacy, 'user_id');
  END LOOP;
  IF to_regclass('public.evidence_artifacts') IS NOT NULL THEN
    IF to_regclass('public.evidence_packs') IS NULL OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'evidence_artifacts' AND column_name = 'pack_id'
    ) OR NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'evidence_packs' AND column_name = 'org_id'
    ) THEN
      RAISE EXCEPTION '0017 fail-closed: evidence_artifacts parent geometry is not pack_id -> evidence_packs.org_id';
    END IF;
    PERFORM ue_create_parent_owned_rls_policy_v2('evidence_artifacts', 'pack_id', 'evidence_packs', 'org_id');
  END IF;
END $$;
