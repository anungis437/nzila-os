#!/usr/bin/env node
/**
 * Disposable proof that an ACL-stripped database with a recorded foundation
 * hash does not pass authority verification until 0017 reconciles the effects.
 * Drops only the database it creates.
 */
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import pg from 'pg'
import { activateCatalogPrivileges } from './lib/union-eyes-catalog-authority.mjs'
import { verifyRestoredAuthority } from './lib/union-eyes-restore-authority.mjs'
import { computeMigrationHash } from './lib/union-eyes-scoped-migrations.mjs'

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const cacheDir = path.join(repoRoot, 'apps/union-eyes/db/migrations-cache')
const database = process.env.UE_PROOF_DATABASE || 'ue_snapshot_authority'
const proofPort = process.env.UE_PROOF_PORT || ''
const evidencePath = process.env.UE_PROOF_EVIDENCE || '/opt/cursor/artifacts/snapshot-authority-evidence.json'
const evidence = []

function record(name, detail) {
  evidence.push({ name, ...detail })
  process.stdout.write(`${name} ${JSON.stringify(detail)}\n`)
}

function admin(sql) {
  const args = ['-u', 'postgres', 'psql', '-v', 'ON_ERROR_STOP=1', '-d', 'postgres']
  if (proofPort) args.push('-p', proofPort)
  args.push('-c', sql)
  const result = spawnSync('sudo', args, { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || result.stdout || sql)
}

function clientFor() {
  const url = new URL(process.env.DATABASE_URL)
  if (proofPort) url.port = proofPort
  url.pathname = `/${database}`
  return new pg.Client({ connectionString: url.toString() })
}

async function applyFile(client, fileName) {
  const sql = fs.readFileSync(path.join(cacheDir, fileName), 'utf8')
  const statements = sql.split('--> statement-breakpoint').map((statement) => statement.trim()).filter(Boolean)
  await client.query('BEGIN')
  try {
    for (const statement of statements) await client.query(statement)
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  }
}

async function main() {
  admin(`DROP DATABASE IF EXISTS ${database}`)
  admin(`CREATE DATABASE ${database}`)
  const client = clientFor()
  await client.connect()
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS pgcrypto')
    await client.query(`
      DO $roles$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_runtime') THEN
          CREATE ROLE union_eyes_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'union_eyes_system') THEN
          CREATE ROLE union_eyes_system NOLOGIN NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END $roles$;
      CREATE SCHEMA user_management;
      CREATE SCHEMA audit_security;
      CREATE TABLE user_management.users (
        user_id varchar(255) PRIMARY KEY,
        is_active boolean NOT NULL DEFAULT true,
        lifecycle_state varchar(20) NOT NULL DEFAULT 'active',
        is_system_admin boolean NOT NULL DEFAULT false
      );
      CREATE TABLE user_management.organization_users (user_id varchar(255), organization_id uuid);
      CREATE TABLE user_management.auth_audit_log (id uuid PRIMARY KEY);
      CREATE TABLE user_management.mfa_totp (user_id varchar(255) PRIMARY KEY);
      CREATE TABLE user_management.org_auth_policies (organization_id uuid PRIMARY KEY);
      CREATE TABLE user_management.user_sessions (
        session_id uuid PRIMARY KEY,
        user_id varchar(255) NOT NULL,
        organization_id uuid,
        session_token_hash text,
        is_active boolean DEFAULT true,
        expires_at timestamptz NOT NULL
      );
      CREATE TABLE audit_security.audit_logs (
        audit_id uuid PRIMARY KEY,
        organization_id uuid,
        user_id varchar(255)
      );
      CREATE TABLE public.council_elections (id uuid PRIMARY KEY);
      CREATE TABLE public.auth_user (
        id integer PRIMARY KEY,
        username varchar(150) NOT NULL,
        is_active boolean NOT NULL,
        is_staff boolean NOT NULL,
        is_superuser boolean NOT NULL
      );
      CREATE TABLE public.django_migrations (id integer PRIMARY KEY, app varchar(255), name varchar(255));
      CREATE TABLE public.failed_login_attempts (id uuid PRIMARY KEY);
      CREATE TABLE public.users (id uuid PRIMARY KEY, user_id varchar(255));
      CREATE TABLE public.oauth_providers (id uuid PRIMARY KEY, user_id varchar(255));
      CREATE TABLE public.evidence_packs (id uuid PRIMARY KEY, org_id uuid NOT NULL);
      CREATE TABLE public.evidence_artifacts (id uuid PRIMARY KEY, pack_id uuid NOT NULL);
      GRANT ALL ON SCHEMA public TO public;
    `)
    await client.query('CREATE SCHEMA IF NOT EXISTS drizzle')
    await client.query(`CREATE TABLE drizzle.__drizzle_migrations (id serial PRIMARY KEY, hash text NOT NULL, created_at bigint)`)
    for (const tag of [
      '0006_external_specialist_runtime_privilege_closure',
      '0007_auth_bootstrap_runtime_remediation',
      '0008_runtime_acceptance_closure',
      '0009_baseline_runtime_role_grants',
    ]) {
      const { hash } = computeMigrationHash(cacheDir, tag)
      await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [hash, 1])
    }
    const stamped = await verifyRestoredAuthority(client, { migrationsDir: cacheDir, restored: true })
    record('stamped_hash_without_effects', {
      historical: stamped.HISTORICAL_MIGRATION_RECORDED,
      security: stamped.SECURITY_EFFECTS_VERIFIED,
      gaps: stamped.securityGaps,
    })
    if (stamped.SECURITY_EFFECTS_VERIFIED) throw new Error('A recorded hash concealed missing security effects')

    await applyFile(client, '0010_tenant_isolation_rls_foundation.sql')
    await applyFile(client, '0012_storage_authority_rls_final_closure.sql')
    await applyFile(client, '0017_snapshot_authority_reconciliation.sql')
    await applyFile(client, '0017_snapshot_authority_reconciliation.sql')
    const reconciled = await verifyRestoredAuthority(client, { migrationsDir: cacheDir, restored: true })
    record('reconciled', {
      historical: reconciled.HISTORICAL_MIGRATION_RECORDED,
      physical: reconciled.PHYSICAL_SCHEMA_VERIFIED,
      security: reconciled.SECURITY_EFFECTS_VERIFIED,
      complete: reconciled.RESTORE_RECONCILIATION_COMPLETE,
      gaps: reconciled.securityGaps,
    })
    if (!reconciled.RESTORE_RECONCILIATION_COMPLETE) {
      throw new Error(`reconciliation incomplete ${JSON.stringify(reconciled.securityGaps)}`)
    }

    await client.query('DROP POLICY ue_runtime_audit_insert ON audit_security.audit_logs')
    const interrupted = await verifyRestoredAuthority(client, { migrationsDir: cacheDir, restored: true })
    record('interrupted_security', {
      security: interrupted.SECURITY_EFFECTS_VERIFIED,
      complete: interrupted.RESTORE_RECONCILIATION_COMPLETE,
      gaps: interrupted.securityGaps,
    })
    if (interrupted.SECURITY_EFFECTS_VERIFIED || interrupted.RESTORE_RECONCILIATION_COMPLETE) {
      throw new Error('interrupted policy still attested security')
    }
    await applyFile(client, '0017_snapshot_authority_reconciliation.sql')
    const recovered = await verifyRestoredAuthority(client, { migrationsDir: cacheDir, restored: true })
    record('interrupted_recovery', {
      security: recovered.SECURITY_EFFECTS_VERIFIED,
      complete: recovered.RESTORE_RECONCILIATION_COMPLETE,
      gaps: recovered.securityGaps,
    })
    if (!recovered.RESTORE_RECONCILIATION_COMPLETE) {
      throw new Error(`recovery incomplete ${JSON.stringify(recovered.securityGaps)}`)
    }

    await client.query('CREATE TABLE public.zz_unclassified_probe (id uuid PRIMARY KEY)')
    let unclassifiedFailed = false
    try {
      await activateCatalogPrivileges(client, { repoRoot, enforce: true })
    } catch (error) {
      unclassifiedFailed = String(error.message).includes('zz_unclassified_probe is unclassified')
      record('unclassified_rejected', { failed: unclassifiedFailed })
    }
    if (!unclassifiedFailed) throw new Error('unclassified relation was admitted')
    await client.query('DROP TABLE public.zz_unclassified_probe')
    await client.query(`SELECT ue_create_direct_org_rls_policy('evidence_packs', 'org_id')`)

    const admitted = await activateCatalogPrivileges(client, { repoRoot, enforce: true })
    record('admission', { applied: admitted.applied, entries: admitted.manifestEntries, ready: admitted.applicationReady })
    if (admitted.applicationReady !== false) throw new Error('applicationReady was asserted')

    await client.query('INSERT INTO public.council_elections (id) VALUES (gen_random_uuid())')
    await client.query('GRANT SELECT ON public.council_elections TO union_eyes_runtime')
    await client.query('SET ROLE union_eyes_runtime')
    const hidden = await client.query('SELECT count(*)::int AS n FROM public.council_elections')
    await client.query('RESET ROLE')
    await client.query('REVOKE SELECT ON public.council_elections FROM union_eyes_runtime')
    await client.query('SET ROLE union_eyes_system')
    const visible = await client.query('SELECT count(*)::int AS n FROM public.council_elections')
    await client.query('RESET ROLE')
    record('system_rls', { runtimeRows: hidden.rows[0].n, systemRows: visible.rows[0].n })
    if (hidden.rows[0].n !== 0 || visible.rows[0].n !== 1) throw new Error('system RLS boundary failed')

    await client.query(`INSERT INTO public.users (id, user_id) VALUES (gen_random_uuid(), 'actor-a'), (gen_random_uuid(), 'actor-b')`)
    await client.query("SELECT set_config('app.current_user_id', 'actor-a', false)")
    await client.query('SET ROLE union_eyes_runtime')
    const ownUsers = await client.query('SELECT user_id FROM public.users ORDER BY user_id')
    await client.query('RESET ROLE')
    record('legacy_user_rls', { visible: ownUsers.rows.map((row) => row.user_id) })
    if (ownUsers.rows.map((row) => row.user_id).join(',') !== 'actor-a') throw new Error('public.users isolation failed')

    const org = '11111111-1111-1111-1111-111111111111'
    await client.query("SELECT set_config('app.current_org_id', $1, false)", [org])
    await client.query('SET ROLE union_eyes_runtime')
    await client.query(
      'INSERT INTO audit_security.audit_logs (audit_id, organization_id, user_id) VALUES (gen_random_uuid(), $1, $2)',
      [org, 'actor-a'],
    )
    let crossTenantRejected = false
    try {
      await client.query(
        'INSERT INTO audit_security.audit_logs (audit_id, organization_id, user_id) VALUES (gen_random_uuid(), $1, $2)',
        ['22222222-2222-2222-2222-222222222222', 'actor-a'],
      )
    } catch {
      crossTenantRejected = true
    }
    await client.query('RESET ROLE')
    record('audit_insert', { crossTenantRejected })
    if (!crossTenantRejected) throw new Error('cross-tenant audit insert was accepted')

    const runtimeCreate = await client.query(`SELECT has_schema_privilege('union_eyes_runtime', 'public', 'CREATE') AS allowed`)
    const publicCreate = await client.query(`SELECT has_schema_privilege('public', 'public', 'CREATE') AS allowed`)
    record('schema_create', { runtime: runtimeCreate.rows[0].allowed, public: publicCreate.rows[0].allowed })
    if (runtimeCreate.rows[0].allowed || publicCreate.rows[0].allowed) throw new Error('CREATE survived reconciliation')

    const djangoGrant = await client.query(
      `SELECT has_table_privilege('union_eyes_runtime', 'public.auth_user', 'SELECT') AS runtime,
              has_table_privilege('ue_framework_admin', 'public.auth_user', 'SELECT') AS admin`,
    )
    record('django_authority', djangoGrant.rows[0])
    if (djangoGrant.rows[0].runtime || !djangoGrant.rows[0].admin) throw new Error('framework authority collapsed into runtime')

    const version = await client.query('SHOW server_version')
    const hasInheritOption = await client.query(`
      SELECT EXISTS (
        SELECT 1 FROM pg_attribute
        WHERE attrelid = 'pg_auth_members'::regclass AND attname = 'inherit_option' AND NOT attisdropped
      ) AS present
    `)
    const membershipSql = hasInheritOption.rows[0].present
      ? `SELECT m.rolname AS member, g.rolname AS granted, a.admin_option, a.inherit_option, a.set_option
         FROM pg_auth_members a
         JOIN pg_roles m ON m.oid = a.member
         JOIN pg_roles g ON g.oid = a.roleid
         WHERE m.rolname IN ('ue_framework_gateway', 'ue_framework_worker_gateway')
         ORDER BY m.rolname, g.rolname`
      : `SELECT m.rolname AS member, g.rolname AS granted, a.admin_option
         FROM pg_auth_members a
         JOIN pg_roles m ON m.oid = a.member
         JOIN pg_roles g ON g.oid = a.roleid
         WHERE m.rolname IN ('ue_framework_gateway', 'ue_framework_worker_gateway')
         ORDER BY m.rolname, g.rolname`
    const membership = await client.query(membershipSql)
    record('gateway_membership', { serverVersion: version.rows[0].server_version, rows: membership.rows })
    if (membership.rows.length !== 3 || membership.rows.some((row) => row.admin_option !== false)) {
      throw new Error('framework gateway has role-administration capability')
    }
    if (hasInheritOption.rows[0].present && membership.rows.some((row) => row.inherit_option !== false || row.set_option !== true)) {
      throw new Error('framework gateway membership is inheriting or cannot SET ROLE')
    }

    const attributes = await client.query(`
      SELECT rolname, rolcanlogin, rolinherit, rolsuper, rolbypassrls, rolcreatedb, rolcreaterole
      FROM pg_roles
      WHERE rolname IN (
        'ue_framework_gateway','ue_framework_identity','ue_framework_admin',
        'ue_framework_worker_gateway','ue_framework_worker','ue_framework_authority_reader'
      )
      ORDER BY rolname
    `)
    record('framework_attributes', { rows: attributes.rows })
    if (attributes.rows.length !== 6 || attributes.rows.some((row) =>
      row.rolcanlogin || row.rolinherit || row.rolsuper || row.rolbypassrls || row.rolcreatedb || row.rolcreaterole
    )) {
      throw new Error('framework role attributes are not NOLOGIN NOINHERIT')
    }

    await client.query(`
      DO $probe$ BEGIN
        IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'ue_framework_probe_login') THEN
          CREATE ROLE ue_framework_probe_login NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE;
        END IF;
      END $probe$;
      GRANT ue_framework_gateway TO ue_framework_probe_login
    `)
    const authUserOid = await client.query(`SELECT 'public.auth_user'::regclass::oid AS oid`)
    await client.query('SET SESSION AUTHORIZATION ue_framework_probe_login')
    const inherited = await client.query(
      `SELECT has_table_privilege(current_user, $1::oid, 'SELECT') AS allowed`,
      [authUserOid.rows[0].oid],
    )
    let selectBeforeSetRole = 'denied'
    try {
      await client.query('SELECT count(*) FROM public.auth_user')
      selectBeforeSetRole = 'allowed'
    } catch (error) {
      selectBeforeSetRole = String(error.message).includes('permission denied') ? 'denied' : String(error.message)
    }
    await client.query('SET ROLE ue_framework_gateway')
    await client.query('SET ROLE ue_framework_admin')
    const hiddenByPolicy = await client.query('SELECT count(*)::int AS n FROM public.auth_user')
    let grantDenied = false
    try {
      await client.query('GRANT ue_framework_admin TO union_eyes_runtime')
    } catch {
      grantDenied = true
    }
    await client.query('RESET ROLE')
    await client.query('RESET SESSION AUTHORIZATION')
    record('set_role_authority', {
      inheritedSelect: inherited.rows[0].allowed,
      selectBeforeSetRole,
      rowsVisibleBeforeAdminSession: hiddenByPolicy.rows[0].n,
      adminGrantDenied: grantDenied,
    })
    if (inherited.rows[0].allowed || selectBeforeSetRole !== 'denied' || hiddenByPolicy.rows[0].n !== 0 || !grantDenied) {
      throw new Error('framework gateway inherited access or administered a role')
    }

    await client.query(`INSERT INTO public.auth_user (id, username, is_active, is_staff, is_superuser) VALUES (1, 'visible', true, false, false)`)
    await client.query(`
      INSERT INTO user_management.users (user_id, is_active, lifecycle_state, is_system_admin)
      VALUES ('framework-admin', true, 'active', true)
    `)
    await client.query(`
      INSERT INTO user_management.user_sessions (session_id, user_id, session_token_hash, is_active, expires_at)
      VALUES (
        gen_random_uuid(),
        'framework-admin',
        encode(sha256(convert_to('framework-token', 'UTF8')), 'hex'),
        true,
        statement_timestamp() + interval '1 hour'
      )
    `)
    await client.query('SET SESSION AUTHORIZATION ue_framework_probe_login')
    await client.query('SET ROLE ue_framework_gateway')
    await client.query('SET ROLE ue_framework_admin')
    await client.query("SELECT set_config('app.current_user_id', 'framework-admin', false)")
    await client.query("SELECT set_config('app.current_session_token', 'wrong-token', false)")
    const hiddenByWrongToken = await client.query('SELECT count(*)::int AS n FROM public.auth_user')
    await client.query("SELECT set_config('app.current_session_token', 'framework-token', false)")
    const visibleToAdmin = await client.query('SELECT count(*)::int AS n FROM public.auth_user')
    let superuserInsertRejected = false
    try {
      await client.query(`INSERT INTO public.auth_user (id, username, is_active, is_staff, is_superuser) VALUES (2, 'root', true, true, true)`)
    } catch {
      superuserInsertRejected = true
    }
    await client.query('RESET ROLE')
    await client.query('RESET SESSION AUTHORIZATION')
    record('framework_policy', {
      hiddenByWrongToken: hiddenByWrongToken.rows[0].n,
      visibleToAdmin: visibleToAdmin.rows[0].n,
      superuserInsertRejected,
    })
    if (hiddenByWrongToken.rows[0].n !== 0 || visibleToAdmin.rows[0].n !== 1 || !superuserInsertRejected) {
      throw new Error('framework admin policy did not enforce')
    }

    await client.query('SET SESSION AUTHORIZATION union_eyes_runtime')
    let runtimeSetRoleDenied = false
    try {
      await client.query('SET ROLE ue_framework_admin')
    } catch {
      runtimeSetRoleDenied = true
    }
    let runtimeSelectDenied = false
    try {
      await client.query('SELECT count(*) FROM public.auth_user')
    } catch (error) {
      runtimeSelectDenied = String(error.message).includes('permission denied')
    }
    await client.query('RESET SESSION AUTHORIZATION')
    record('runtime_framework_denial', { runtimeSetRoleDenied, runtimeSelectDenied })
    if (!runtimeSetRoleDenied || !runtimeSelectDenied) throw new Error('runtime reached a framework role')

    const foundationTags = [
      '0006_external_specialist_runtime_privilege_closure',
      '0007_auth_bootstrap_runtime_remediation',
      '0008_runtime_acceptance_closure',
      '0009_baseline_runtime_role_grants',
    ]
    const foundationHashes = foundationTags.map((tag) => computeMigrationHash(cacheDir, tag).hash)
    const recordedFoundation = await client.query(
      'SELECT hash FROM drizzle.__drizzle_migrations WHERE hash = ANY($1::text[]) ORDER BY hash',
      [foundationHashes],
    )
    const current0017 = computeMigrationHash(cacheDir, '0017_snapshot_authority_reconciliation').hash
    const before0017 = await client.query('SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations WHERE hash = $1', [current0017])
    if (before0017.rows[0].n !== 0) throw new Error('0017 hash was stamped before physical verification')
    await client.query('INSERT INTO drizzle.__drizzle_migrations (hash, created_at) VALUES ($1, $2)', [current0017, 1790140000000])
    await applyFile(client, '0017_snapshot_authority_reconciliation.sql')
    const after0017 = await client.query('SELECT count(*)::int AS n FROM drizzle.__drizzle_migrations WHERE hash = $1', [current0017])
    const recordedAgain = await client.query(
      'SELECT hash FROM drizzle.__drizzle_migrations WHERE hash = ANY($1::text[]) ORDER BY hash',
      [foundationHashes],
    )
    record('ledger', {
      foundationUnchanged: JSON.stringify(recordedFoundation.rows) === JSON.stringify(recordedAgain.rows),
      current0017Count: after0017.rows[0].n,
    })
    if (JSON.stringify(recordedFoundation.rows) !== JSON.stringify(recordedAgain.rows) || after0017.rows[0].n !== 1) {
      throw new Error('migration ledger was rewritten')
    }

    fs.writeFileSync(evidencePath, JSON.stringify(evidence, null, 2))
    record('evidence_written', { path: evidencePath })
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  process.stderr.write(`${error.stack || error.message}\n`)
  process.exit(1)
})
