/**
 * scripts/__tests__/apply-rls-foundation-migration.postgres.test.ts
 *
 * Least-privilege idempotent-reapply regression proof for
 * scripts/apply-rls-foundation-migration.ts, added to fix the defect that
 * caused production run 34790263534 to fail (P4 failed-rollout state
 * assessment, 2026-09-13): the script used to always execute 0108's
 * unconditional ALTER ROLE branches for already-existing runtime/system
 * roles, and PostgreSQL 16 rejects that for a non-superuser CREATEROLE role
 * that does not itself hold SUPERUSER/CREATEDB/REPLICATION/BYPASSRLS —
 * exactly the shape of the real production migration credential.
 *
 * Runs the ACTUAL script as a subprocess (matching how CI invokes it),
 * against a disposable postgres:16-alpine container, connected as a
 * restricted migration-admin role that mirrors production:
 *   LOGIN=true, SUPERUSER=false, CREATEROLE=true, CREATEDB=false,
 *   BYPASSRLS=false, REPLICATION=false.
 */
import { spawnSync } from 'node:child_process'
import { randomUUID } from 'node:crypto'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'

const image = 'postgres:16-alpine'
let containerId = ''
let superuserUrl = ''
let restrictedAdminUrl = ''
let sql: postgres.Sql

const RESTRICTED_ADMIN_PASSWORD = `admin_${randomUUID().replaceAll('-', '')}`

const ALL_FIXTURE_TABLES = [
  'message_notifications', 'message_read_receipts', 'message_participants', 'messages', 'message_threads',
  'cross_org_access_log', 'safety_certifications', 'corrective_actions', 'safety_policies', 'injury_logs',
  'safety_audits', 'ppe_equipment', 'safety_training_records', 'safety_committee_meetings', 'hazard_reports',
  'safety_inspections', 'workplace_incidents', 'member_documents', 'documents', 'claims',
  'grievance_deadlines', 'grievances', 'organization_members', 'organizations',
]

const FIXTURE_DDL = `
  CREATE TABLE organizations (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
  CREATE TABLE organization_members (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id uuid NOT NULL REFERENCES organizations(id),
    user_id text NOT NULL
  );
  CREATE TABLE grievances (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE grievance_deadlines (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), grievance_id uuid NOT NULL REFERENCES grievances(id));
  CREATE TABLE claims (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE member_documents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), user_id text NOT NULL);
  CREATE TABLE workplace_incidents (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_inspections (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE hazard_reports (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_committee_meetings (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_training_records (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE ppe_equipment (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_audits (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE injury_logs (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_policies (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE corrective_actions (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE safety_certifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE message_threads (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), organization_id uuid NOT NULL REFERENCES organizations(id));
  CREATE TABLE messages (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES message_threads(id));
  CREATE TABLE message_participants (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), thread_id uuid NOT NULL REFERENCES message_threads(id));
  CREATE TABLE message_read_receipts (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES messages(id), user_id text NOT NULL);
  CREATE TABLE message_notifications (id uuid PRIMARY KEY DEFAULT gen_random_uuid(), message_id uuid NOT NULL REFERENCES messages(id), user_id text NOT NULL);
  CREATE TABLE cross_org_access_log (id uuid PRIMARY KEY DEFAULT gen_random_uuid());
`

function docker(...args: string[]) {
  return spawnSync('docker', args, { encoding: 'utf8' })
}

function runApplyScript(extraArgs: string[] = []) {
  return spawnSync('pnpm', ['exec', 'tsx', 'scripts/apply-rls-foundation-migration.ts', '--', ...extraArgs], {
    cwd: new URL('../..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      RLS_MIGRATION_ADMIN_DATABASE_URL: restrictedAdminUrl,
    },
  })
}

async function waitForPostgres(url: string) {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      const probe = postgres(url, { max: 1 })
      await probe`SELECT 1`
      await probe.end({ timeout: 0 })
      return
    } catch {
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error('Disposable PostgreSQL did not become ready')
}

async function resetDatabase() {
  await sql.unsafe(`DROP TABLE IF EXISTS ${ALL_FIXTURE_TABLES.join(', ')} CASCADE`)
  // Drop ALL overloads of the two helper functions by exact regprocedure
  // signature, not a single hardcoded signature — a wrong-signature-helper
  // regression test (WRONG_HELPER_SIGNATURE) intentionally leaves behind a
  // helper with a DIFFERENT signature than the original, which a fixed
  // `DROP FUNCTION IF EXISTS name(text, text, boolean)` would silently fail
  // to remove, leaking residue into subsequent tests.
  await sql.unsafe(`
    DO $$
    DECLARE r record;
    BEGIN
      FOR r IN
        SELECT oid::regprocedure AS sig FROM pg_proc
        WHERE proname IN ('ue_create_direct_org_rls_policy', 'ue_create_parent_owned_rls_policy')
      LOOP
        EXECUTE format('DROP FUNCTION IF EXISTS %s', r.sig);
      END LOOP;
    END $$;
  `)
  for (const role of ['union_eyes_runtime', 'union_eyes_system']) {
    const exists = await sql`SELECT 1 FROM pg_roles WHERE rolname = ${role}`
    if (exists.length > 0) {
      // The 0108 schema/database GRANTs were issued by migration_admin_restricted
      // (the role the real apply script connects as). PostgreSQL only revokes an
      // ACL entry when the acting session's identity matches its grantor — even
      // for a cluster superuser — so REVOKE must run under SET ROLE
      // migration_admin_restricted first. DROP OWNED BY / DROP ROLE must then run
      // as the plain superuser (not under SET ROLE), because SET ROLE to a
      // non-superuser role drops superuser powers for the session and
      // migration_admin_restricted (CREATEROLE, PG 16 least-privilege model) is
      // only granted ADMIN OPTION — not INHERIT — over roles it creates, so it
      // cannot itself DROP OWNED BY them.
      await sql.unsafe(`SET ROLE migration_admin_restricted; REVOKE ALL PRIVILEGES ON SCHEMA public FROM ${role}; REVOKE ALL PRIVILEGES ON DATABASE testdb FROM ${role}; RESET ROLE;`)
      await sql.unsafe(`DROP OWNED BY ${role} CASCADE`)
      await sql.unsafe(`DROP ROLE ${role}`)
    }
  }
  // Fixture tables are created AS the restricted migration-admin role, so
  // ownership mirrors production (the migration credential owns the schema
  // objects it manages; its restriction is on ROLE attributes, not table
  // ownership).
  await sql.unsafe(`SET ROLE migration_admin_restricted; ${FIXTURE_DDL} RESET ROLE;`)
}

function applyFoundation(extraArgs: string[] = []) {
  return runApplyScript(extraArgs)
}

describe.sequential('apply-rls-foundation-migration least-privilege idempotent reapply (disposable PostgreSQL 16)', () => {
  beforeAll(async () => {
    const started = docker(
      'run', '--rm', '-d',
      '-e', 'POSTGRES_PASSWORD=postgres',
      '-e', 'POSTGRES_DB=testdb',
      '-p', '127.0.0.1::5432',
      image,
    )
    expect(started.status, started.stderr).toBe(0)
    containerId = started.stdout.trim()
    const port = docker('port', containerId, '5432/tcp')
    expect(port.status, port.stderr).toBe(0)
    const hostPort = port.stdout.trim().split(':').at(-1)
    superuserUrl = `postgresql://postgres:postgres@localhost:${hostPort}/testdb`
    await waitForPostgres(superuserUrl)

    sql = postgres(superuserUrl, { max: 1 })
    await sql`SELECT 1`
    await sql.unsafe('CREATE EXTENSION IF NOT EXISTS pgcrypto')

    // Restricted migration-admin role mirroring the real production
    // credential: LOGIN + CREATEROLE only, never SUPERUSER/CREATEDB/
    // REPLICATION/BYPASSRLS. This is the exact shape that made production
    // run 34790263534 fail on the old unconditional ALTER ROLE.
    await sql.unsafe(`
      CREATE ROLE migration_admin_restricted LOGIN PASSWORD '${RESTRICTED_ADMIN_PASSWORD}'
        NOSUPERUSER NOCREATEDB CREATEROLE NOBYPASSRLS NOREPLICATION;
      GRANT CREATE, USAGE ON SCHEMA public TO migration_admin_restricted WITH GRANT OPTION;
      GRANT CONNECT ON DATABASE testdb TO migration_admin_restricted WITH GRANT OPTION;
      GRANT migration_admin_restricted TO postgres;
    `)
    restrictedAdminUrl = `postgresql://migration_admin_restricted:${RESTRICTED_ADMIN_PASSWORD}@localhost:${hostPort}/testdb`
  }, 30_000)

  beforeEach(async () => {
    await resetDatabase()
  })

  afterAll(async () => {
    await sql?.end({ timeout: 1 })
    if (containerId) docker('rm', '-f', containerId)
  })

  it('FIRST_APPLY: applies 0108 verbatim and produces a complete foundation when both roles are absent', async () => {
    const result = applyFoundation(['--expect-pre-provisioning'])
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('FOUNDATION_STATE=NOT_APPLIED')
    expect(result.stdout).toContain('APPLIED:')

    const roles = await sql`SELECT rolname, rolcanlogin FROM pg_roles WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`
    expect(roles).toHaveLength(2)
    for (const r of roles) expect(r.rolcanlogin).toBe(false)

    const policies = await sql`SELECT count(*)::int AS c FROM pg_policies WHERE schemaname = 'public'`
    expect(Number(policies[0].c)).toBeGreaterThan(0)
  })

  it('SECOND_APPLY: succeeds as a no-op under the restricted migration role, without mutating any foundation object', async () => {
    const first = applyFoundation(['--expect-pre-provisioning'])
    expect(first.status, first.stdout + first.stderr).toBe(0)

    const before = await sql`
      SELECT polname, polrelid, oid FROM pg_policy ORDER BY oid
    `
    const rolesBefore = await sql`
      SELECT rolname, xmin FROM pg_authid WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system') ORDER BY rolname
    `

    const second = applyFoundation(['--expect-pre-provisioning'])
    expect(second.status, second.stdout + second.stderr).toBe(0)
    expect(second.stdout).toContain('ALREADY_APPLIED_VERIFIED')
    expect(second.stdout).not.toContain('APPLIED:')

    const after = await sql`SELECT polname, polrelid, oid FROM pg_policy ORDER BY oid`
    expect(after).toEqual(before)
    const rolesAfter = await sql`
      SELECT rolname, xmin FROM pg_authid WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system') ORDER BY rolname
    `
    // xmin is the row version — unchanged xmin proves the pg_authid row was
    // never touched by an ALTER ROLE on the second apply.
    expect(rolesAfter).toEqual(rolesBefore)
  })

  it('PARTIAL_ROLE_STATE: fails closed when only one of the two roles exists', async () => {
    await sql.unsafe(`SET ROLE migration_admin_restricted; CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN; RESET ROLE;`)

    const result = applyFoundation()
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PARTIAL_OR_DRIFTED')
    expect(result.stderr).toContain('union_eyes_system')

    const roles = await sql`SELECT rolname FROM pg_roles WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`
    expect(roles).toHaveLength(1)
  })

  it('MISSING_HELPER: fails closed when a required helper function is missing after a complete first apply', async () => {
    const first = applyFoundation(['--expect-pre-provisioning'])
    expect(first.status, first.stdout + first.stderr).toBe(0)

    await sql.unsafe('DROP FUNCTION ue_create_direct_org_rls_policy(text, text, boolean)')

    const result = applyFoundation(['--expect-pre-provisioning'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PARTIAL_OR_DRIFTED')
    expect(result.stderr).toContain('Missing helper function: ue_create_direct_org_rls_policy')
  })

  it('RLS_POLICY_DRIFT: fails closed when an expected policy is removed after a complete first apply', async () => {
    const first = applyFoundation(['--expect-pre-provisioning'])
    expect(first.status, first.stdout + first.stderr).toBe(0)

    await sql.unsafe('DROP POLICY ue_org_isolation_select ON organizations')

    const result = applyFoundation(['--expect-pre-provisioning'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PARTIAL_OR_DRIFTED')
    expect(result.stderr).toContain('organizations: missing policy ue_org_isolation_select')
  })

  it('IMMUTABLE_ROLE_DRIFT: fails closed and does not attempt to self-heal a superuser-caused attribute drift', async () => {
    const first = applyFoundation(['--expect-pre-provisioning'])
    expect(first.status, first.stdout + first.stderr).toBe(0)

    // Only the disposable-fixture superuser can cause this drift — the
    // restricted migration role itself could never grant BYPASSRLS.
    await sql.unsafe('ALTER ROLE union_eyes_runtime BYPASSRLS')

    const result = applyFoundation(['--expect-pre-provisioning'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PARTIAL_OR_DRIFTED')
    expect(result.stderr).toContain('union_eyes_runtime: rolbypassrls=true')

    const [role] = await sql`SELECT rolbypassrls FROM pg_roles WHERE rolname = 'union_eyes_runtime'`
    // Still drifted — proves the script never attempted (successfully or
    // otherwise) to alter it back.
    expect(role.rolbypassrls).toBe(true)
  })

  it('PRE_PROVISIONING_FLAG_TEST: passes with --expect-pre-provisioning while both roles remain NOLOGIN', async () => {
    const first = applyFoundation(['--expect-pre-provisioning'])
    expect(first.status, first.stdout + first.stderr).toBe(0)

    const second = applyFoundation(['--expect-pre-provisioning'])
    expect(second.status, second.stdout + second.stderr).toBe(0)
    expect(second.stdout).toContain('ALREADY_APPLIED_VERIFIED')
  })

  it('POST_PROVISIONING_NO_FLAG_TEST: passes without the flag once roles have been provisioned to LOGIN', async () => {
    const first = applyFoundation()
    expect(first.status, first.stdout + first.stderr).toBe(0)

    await sql.unsafe(`
      ALTER ROLE union_eyes_runtime LOGIN PASSWORD 'runtime_${randomUUID().replaceAll('-', '')}';
      ALTER ROLE union_eyes_system LOGIN PASSWORD 'system_${randomUUID().replaceAll('-', '')}';
    `)

    const result = applyFoundation()
    expect(result.status, result.stdout + result.stderr).toBe(0)
    expect(result.stdout).toContain('ALREADY_APPLIED_VERIFIED')
  })

  it('WRONG_RUNTIME_POLICY_EXPRESSION: fails closed when a runtime tenant-isolation policy exists but its predicate does not match the exact expected expression', async () => {
    const first = applyFoundation(['--expect-pre-provisioning'])
    expect(first.status, first.stdout + first.stderr).toBe(0)

    // A structurally-correct, correctly-named, correctly-role-scoped policy
    // with a permissive `USING (true)` predicate must still fail closed —
    // presence of a non-null expression is not sufficient attestation.
    await sql.unsafe('ALTER POLICY ue_org_isolation_select ON organizations USING (true)')

    const result = applyFoundation(['--expect-pre-provisioning'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PARTIAL_OR_DRIFTED')
    expect(result.stderr).toContain('organizations.ue_org_isolation_select: USING expression does not match expected tenant predicate')
  })

  it('WRONG_SYSTEM_POLICY_EXPRESSION: fails closed when ue_system_full_access exists but is not the canonical unconditional `true` predicate', async () => {
    const first = applyFoundation(['--expect-pre-provisioning'])
    expect(first.status, first.stdout + first.stderr).toBe(0)

    await sql.unsafe('ALTER POLICY ue_system_full_access ON organizations USING (false)')

    const result = applyFoundation(['--expect-pre-provisioning'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PARTIAL_OR_DRIFTED')
    expect(result.stderr).toContain('organizations.ue_system_full_access: USING expression is not the canonical `true`')
  })

  it('WRONG_HELPER_SIGNATURE: fails closed when a helper function is replaced by a same-named function with a different signature', async () => {
    const first = applyFoundation(['--expect-pre-provisioning'])
    expect(first.status, first.stdout + first.stderr).toBe(0)

    await sql.unsafe(`
      DROP FUNCTION ue_create_direct_org_rls_policy(text, text, boolean);
      CREATE FUNCTION ue_create_direct_org_rls_policy(p_table_name text) RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;
    `)

    const result = applyFoundation(['--expect-pre-provisioning'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PARTIAL_OR_DRIFTED')
    expect(result.stderr).toContain('ue_create_direct_org_rls_policy: signature mismatch')
  })

  it('ROLES_ABSENT_WITH_0108_RESIDUE: classifies as PARTIAL_OR_DRIFTED (never NOT_APPLIED) when both roles are absent but a 0108 artifact survives', async () => {
    // beforeEach already reset to a clean, role-absent state. Leave a single
    // 0108-owned helper function behind without ever creating the roles —
    // a damaged/partially-torn-down environment, not a genuine first apply.
    await sql.unsafe(`SET ROLE migration_admin_restricted;
      CREATE FUNCTION ue_create_direct_org_rls_policy(p_table_name text, p_org_column text DEFAULT 'organization_id', p_org_column_is_text boolean DEFAULT false)
      RETURNS void AS $$ BEGIN END; $$ LANGUAGE plpgsql;
      RESET ROLE;`)

    const result = applyFoundation(['--expect-pre-provisioning'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PARTIAL_OR_DRIFTED')
    expect(result.stderr).toContain('Residual 0108 helper function present while both runtime/system roles are absent: ue_create_direct_org_rls_policy')

    const roles = await sql`SELECT rolname FROM pg_roles WHERE rolname IN ('union_eyes_runtime', 'union_eyes_system')`
    expect(roles).toHaveLength(0)
  })

  it('POST_PROVISIONING_WITH_FLAG_TEST: fails when --expect-pre-provisioning is asserted against already-provisioned LOGIN roles', async () => {
    const first = applyFoundation()
    expect(first.status, first.stdout + first.stderr).toBe(0)

    await sql.unsafe(`
      ALTER ROLE union_eyes_runtime LOGIN PASSWORD 'runtime_${randomUUID().replaceAll('-', '')}';
      ALTER ROLE union_eyes_system LOGIN PASSWORD 'system_${randomUUID().replaceAll('-', '')}';
    `)

    const result = applyFoundation(['--expect-pre-provisioning'])
    expect(result.status).not.toBe(0)
    expect(result.stderr).toContain('PARTIAL_OR_DRIFTED')
    expect(result.stderr).toContain('rolcanlogin=true (--expect-pre-provisioning asserts NOLOGIN at this stage)')
  })
})
