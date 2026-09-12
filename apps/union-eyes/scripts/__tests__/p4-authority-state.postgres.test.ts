import { spawnSync } from 'node:child_process'
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import postgres from 'postgres'

const image = 'postgres:16-alpine'
let containerId = ''
let databaseUrl = ''
let sql: postgres.Sql

function docker(...args: string[]) {
  return spawnSync('docker', args, { encoding: 'utf8' })
}

function runState(mode: 'preflight' | 'attest', url = databaseUrl) {
  return spawnSync('pnpm', ['exec', 'tsx', 'scripts/p4-authority-state.ts', `--mode=${mode}`], {
    cwd: new URL('../..', import.meta.url),
    encoding: 'utf8',
    env: {
      ...process.env,
      NODE_ENV: 'test',
      UE_P4_ALLOW_DISPOSABLE_TEST_TARGET: '1',
      UE_P4_MIGRATION_ADMIN_DATABASE_URL: url,
    },
  })
}

async function waitForPostgres() {
  for (let attempt = 0; attempt < 30; attempt += 1) {
    try {
      sql = postgres(databaseUrl, { max: 1 })
      await sql`SELECT 1`
      return
    } catch {
      await sql?.end({ timeout: 0 }).catch(() => undefined)
      await new Promise((resolve) => setTimeout(resolve, 250))
    }
  }
  throw new Error('Disposable PostgreSQL did not become ready')
}

async function establishPrerequisites() {
  await sql.unsafe(`
    CREATE TABLE django_migrations (app varchar(255) NOT NULL, name varchar(255) NOT NULL);
    CREATE TABLE organizations (id uuid PRIMARY KEY, auth_provider_org_id text);
    CREATE TABLE pilot_applications (
      id uuid PRIMARY KEY,
      verified_organization_id uuid,
      verified_member_count integer,
      verified_pilot_amount numeric,
      verified_subscription_plan_id text,
      commercial_terms_approved_by text,
      commercial_terms_approved_at timestamptz
    );
    INSERT INTO django_migrations (app, name) VALUES
      ('auth_core', '0003_rename_clerk_organization_id'),
      ('content', '0002_pilotapplications_verified_organization'),
      ('content', '0003_pilotapplications_commercial_terms');
  `)
}

async function establishFinalAuthorityState(includeCoreLedger = true) {
  await sql.unsafe(`
    CREATE TABLE automation_rules (
      id uuid PRIMARY KEY,
      organization_id varchar(255) NOT NULL
    );
    CREATE INDEX idx_automation_rules_org ON automation_rules (organization_id);
    ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;
    ALTER TABLE automation_rules FORCE ROW LEVEL SECURITY;
    CREATE POLICY ue_org_isolation_select ON automation_rules FOR SELECT
      USING (organization_id = current_setting('app.current_org_id', true));
    CREATE POLICY ue_org_isolation_insert ON automation_rules FOR INSERT
      WITH CHECK (organization_id = current_setting('app.current_org_id', true));
    CREATE POLICY ue_org_isolation_update ON automation_rules FOR UPDATE
      USING (organization_id = current_setting('app.current_org_id', true))
      WITH CHECK (organization_id = current_setting('app.current_org_id', true));
    CREATE POLICY ue_org_isolation_delete ON automation_rules FOR DELETE
      USING (organization_id = current_setting('app.current_org_id', true));
    CREATE POLICY ue_system_full_access ON automation_rules FOR ALL TO union_eyes_system
      USING (true) WITH CHECK (true);
    GRANT SELECT ON automation_rules TO union_eyes_system;
  `)
  if (includeCoreLedger) {
    await sql`INSERT INTO django_migrations (app, name) VALUES ('core', '0003_automation_rules_organization_id')`
  }
}

describe.sequential('P4 authority state census on disposable PostgreSQL', () => {
  beforeAll(async () => {
    const started = docker(
      'run', '--rm', '-d',
      '-e', 'POSTGRES_PASSWORD=postgres',
      '-e', 'POSTGRES_DB=nzila_os_prod',
      '-p', '127.0.0.1::5432',
      image,
    )
    expect(started.status, started.stderr).toBe(0)
    containerId = started.stdout.trim()
    const port = docker('port', containerId, '5432/tcp')
    expect(port.status, port.stderr).toBe(0)
    databaseUrl = `postgresql://postgres:postgres@127.0.0.1:${port.stdout.trim().split(':').at(-1)}/nzila_os_prod`
    await waitForPostgres()
    await sql.unsafe(`
      CREATE ROLE union_eyes_runtime NOSUPERUSER NOBYPASSRLS NOLOGIN;
      CREATE ROLE union_eyes_system NOSUPERUSER NOBYPASSRLS NOLOGIN;
    `)
  }, 30_000)

  beforeEach(async () => {
    await sql.unsafe('DROP TABLE IF EXISTS automation_rules, pilot_applications, organizations, django_migrations CASCADE')
    await establishPrerequisites()
  })

  afterAll(async () => {
    await sql?.end({ timeout: 1 })
    if (containerId) docker('rm', '-f', containerId)
  })

  it('fails closed without resolving a missing automation_rules relation', () => {
    expect(runState('preflight').status).not.toBe(0)
  })

  it('accepts an empty table with no ownership column', async () => {
    await sql`CREATE TABLE automation_rules (id uuid PRIMARY KEY)`
    expect(runState('preflight').status).toBe(0)
  })

  it('accepts empty legacy UUID ownership with its FK and index', async () => {
    await sql.unsafe(`
      CREATE TABLE automation_rules (
        id uuid PRIMARY KEY,
        org_id uuid NOT NULL CONSTRAINT automation_rules_org_id_organizations_id_fk
          REFERENCES organizations(id)
      );
      CREATE INDEX automation_rules_org_idx ON automation_rules (org_id);
    `)
    expect(runState('preflight').status).toBe(0)
  })

  it('accepts canonical geometry before the core ledger row is recorded', async () => {
    await establishFinalAuthorityState(false)
    expect(runState('preflight').status).toBe(0)
  })

  it.each([
    ['unknown ownership type', `CREATE TABLE automation_rules (id uuid PRIMARY KEY, organization_id integer)`],
    ['populated nullable canonical ownership', `CREATE TABLE automation_rules (id uuid PRIMARY KEY, organization_id varchar(255)); INSERT INTO automation_rules (id) VALUES (gen_random_uuid())`],
    ['dual ownership columns', `CREATE TABLE automation_rules (id uuid PRIMARY KEY, organization_id varchar(255), org_id uuid)`],
  ])('rejects %s', async (_name, fixture) => {
    await sql.unsafe(fixture)
    expect(runState('preflight').status).not.toBe(0)
  })

  it('requires the core ledger row even when final physical authority is exact', async () => {
    await establishFinalAuthorityState(false)
    expect(runState('attest').status).not.toBe(0)
  })

  it('attests the exact final authority state', async () => {
    await establishFinalAuthorityState()
    const result = runState('attest')
    expect(result.status, result.stderr).toBe(0)
  })

  it('rejects a drill host before attempting a connection', () => {
    const result = runState(
      'preflight',
      'postgresql://user:password@nzila-ue-prod-db-drill-20260520.postgres.database.azure.com/nzila_os_prod',
    )
    expect(result.status).not.toBe(0)
  })
})