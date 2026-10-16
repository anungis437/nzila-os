import { execFileSync } from 'node:child_process'
import { randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { compileSyntheticAuthFixtureSql } from './auth-fixture'
import { compileAuthBootstrapSql } from './auth-sql'
import {
  FRAMEWORK_MODEL_OWNERS,
  FRAMEWORK_ROLES,
  DEDICATED_ADMIN_MODEL_OWNERS,
} from './framework-contract'
import { compileFrameworkSql } from './framework-sql'
import { inspectFrameworkPrivileges } from './framework-privileges'
import { proveFrameworkBoundary, type FrameworkProofClients } from './framework-runtime'
import { folder, type V2Plan } from './source'
import { producerOwnsSharedRole } from './manifest-trace'
import { proveFrameworkApplication } from './framework-application'
import { compileSecurity } from './security'
import { compileRolePrerequisiteAssertions } from '../../../../packages/db/src/auth-storage-authority/role-prerequisites'
import { FRAMEWORK_MEMBERSHIPS } from './framework-contract'

const plan: V2Plan = JSON.parse(
  readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
)

describe('current framework execution authority source contract', () => {
  it('has an assertion-only role profile without implicit role or membership creation', () => {
    const framework = compileFrameworkSql(plan, { rolesPreprovisioned: true })
    const auth = compileAuthBootstrapSql({ rolesPreprovisioned: true })
    for (const sql of [framework, auth]) {
      expect(sql).toContain('CANONICAL_PREPROVISIONED_ROLE_MISSING')
      expect(sql).toContain('CANONICAL_PREPROVISIONED_ROLE_UNSAFE')
      expect(sql).toContain('CANONICAL_PREPROVISIONED_MEMBERSHIP_DRIFT')
      expect(sql).not.toContain('CREATE ROLE')
    }
    for (const [roles, memberships] of [
      [[], {}],
      [['invalid-role'], {}],
      [['valid_role', 'valid_role'], {}],
      [['valid_role'], { unknown_member: ['valid_role'] }],
      [['valid_role'], { valid_role: ['unknown_target'] }],
      [['valid_role'], { valid_role: ['valid_role', 'valid_role'] }],
    ] as const)
      expect(() => compileRolePrerequisiteAssertions(roles, memberships)).toThrow(
        'CANONICAL_ROLE_PREREQUISITE_CONTRACT_INVALID',
      )
  })
  it('never attributes auth or core roles to the framework producer', () => {
    expect(
      producerOwnsSharedRole('CANONICAL_FRAMEWORK_EXECUTION', 'role:ue_framework_identity'),
    ).toBe(true)
    expect(
      producerOwnsSharedRole(
        'CANONICAL_FRAMEWORK_EXECUTION',
        'role_membership:ue_framework_identity:ue_framework_gateway',
      ),
    ).toBe(true)
    for (const identity of [
      'role:ue_v2_owner',
      'role:nzila_auth_gateway',
      'role_membership:nzila_auth_identity:nzila_auth_gateway',
      'role_membership:ue_framework_admin:nzila_auth_gateway',
    ])
      expect(producerOwnsSharedRole('CANONICAL_FRAMEWORK_EXECUTION', identity)).toBe(false)
    expect(producerOwnsSharedRole('CANONICAL_AUTH_EXECUTION', 'role:nzila_auth_gateway')).toBe(true)
    expect(producerOwnsSharedRole('CANONICAL_AUTH_EXECUTION', 'role:ue_framework_gateway')).toBe(
      false,
    )
  })
  it('requires all current package model owners and canonical authentication', () => {
    expect(() => compileFrameworkSql({ ...plan, authExecution: undefined })).toThrow(
      'UE_V2_FRAMEWORK_CANONICAL_AUTH_REQUIRED',
    )
    expect(() =>
      compileFrameworkSql({
        ...plan,
        currentModels: {
          ...plan.currentModels,
          models: plan.currentModels.models.filter((model) => model.table !== 'auth_user'),
        },
      }),
    ).toThrow('UE_V2_FRAMEWORK_CURRENT_MODEL_REQUIRED:auth_user')
    const compiled = compileFrameworkSql(plan)
    expect(compiled).toContain('ue_framework_admin_authorized')
    expect(compiled).not.toContain('GRANT ALL ON ALL TABLES')
    expect(compiled).not.toContain('CREATE TABLE IF NOT EXISTS')
    expect(Object.keys(FRAMEWORK_MODEL_OWNERS)).toHaveLength(18)
  })
})

const native = process.env.UE_V2_NATIVE_FRAMEWORK === '1' ? describe : describe.skip
native('local current Django framework role and RLS boundary', () => {
  const name = `ue-v2-framework-${randomUUID()}`
  const password = randomBytes(24).toString('hex')
  let container: string | null = null
  const opened: pg.Client[] = []
  let clients: FrameworkProofClients
  beforeAll(async () => {
    container = execFileSync(
      'docker',
      [
        'run',
        '-d',
        '--pull',
        'never',
        '--name',
        name,
        '--label',
        'nzila.mission=UE_BOOTSTRAP_V2_FRAMEWORK',
        '--memory',
        '1g',
        '--cpus',
        '2',
        '--tmpfs',
        '/var/lib/postgresql/data:rw,size=512m',
        '-p',
        '127.0.0.1::5432',
        '-e',
        `POSTGRES_PASSWORD=${password}`,
        'pgvector/pgvector:0.8.1-pg16@sha256:33198da2828a14c30348d2ccb4750833d5ed9a44c88d840a0e523d7417120337',
      ],
      { encoding: 'utf8' },
    ).trim()
    const port = Number(
      execFileSync('docker', ['port', container, '5432/tcp'], { encoding: 'utf8' })
        .trim()
        .split(':')
        .at(-1),
    )
    for (let attempt = 0; ; attempt++) {
      try {
        execFileSync(
          'docker',
          ['exec', container, 'pg_isready', '-h', '127.0.0.1', '-U', 'postgres'],
          {
            stdio: 'pipe',
          },
        )
        break
      } catch (error: unknown) {
        if (attempt >= 60) throw error
        await new Promise((resolve) => setTimeout(resolve, 250))
      }
    }
    const connect = async (user: string) => {
      const client = new pg.Client({
        host: '127.0.0.1',
        port,
        database: 'postgres',
        user,
        password,
      })
      opened.push(client)
      await client.connect()
      return client
    }
    const owner = await connect('postgres')
    await owner.query(
      'CREATE ROLE union_eyes_runtime NOLOGIN NOSUPERUSER NOBYPASSRLS; CREATE ROLE union_eyes_system NOLOGIN NOSUPERUSER NOBYPASSRLS; REVOKE ALL ON SCHEMA public FROM PUBLIC; GRANT USAGE ON SCHEMA public TO union_eyes_runtime,union_eyes_system;',
    )
    await owner.query(compileSyntheticAuthFixtureSql())
    for (const statement of plan.currentModels.ddl.filter(
      (entry) =>
        Boolean(DEDICATED_ADMIN_MODEL_OWNERS[entry.owner]) ||
        ['users', 'oauth_providers', 'organizations', 'donations', 'audit_logs'].includes(
          entry.owner,
        ),
    ))
      await owner.query(statement.sql)
    await owner.query(
      'ALTER TABLE public.donations ADD CONSTRAINT ue_framework_donation_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) DEFERRABLE INITIALLY DEFERRED;',
    )
    await owner.query(
      'ALTER TABLE public.audit_logs ADD CONSTRAINT ue_framework_audit_organization_fk FOREIGN KEY (organization_id) REFERENCES public.organizations(id) DEFERRABLE INITIALLY DEFERRED;',
    )
    await owner.query(compileAuthBootstrapSql())
    await owner.query(compileFrameworkSql(plan))
    const security = compileSecurity({
      ...plan,
      tables: plan.tables.filter(
        (table) =>
          ['users', 'oauth_providers', 'organizations', 'donations', 'audit_logs'].includes(
            table.name,
          ) ||
          (Boolean(DEDICATED_ADMIN_MODEL_OWNERS[table.name]) &&
            !FRAMEWORK_MODEL_OWNERS[table.name]),
      ),
    })
    for (const statement of security.statements) await owner.query(statement)
    for (const [login, target] of [
      ['ue_framework_proof_ordinary', 'union_eyes_runtime'],
      ['ue_framework_proof_legacy', 'union_eyes_system'],
      ['ue_framework_proof_request', FRAMEWORK_ROLES.gateway],
      ['ue_framework_proof_worker', FRAMEWORK_ROLES.workerGateway],
      ['ue_framework_proof_auth', 'nzila_auth_gateway'],
    ])
      await owner.query(
        `CREATE ROLE "${login}" LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'; GRANT "${target}" TO "${login}" WITH INHERIT FALSE, SET TRUE;`,
      )
    clients = {
      owner,
      ordinary: await connect('ue_framework_proof_ordinary'),
      legacySystem: await connect('ue_framework_proof_legacy'),
      request: await connect('ue_framework_proof_request'),
      worker: await connect('ue_framework_proof_worker'),
    }
  }, 120000)

  afterAll(async () => {
    for (const client of opened.reverse()) await client.end()
    if (container) {
      const label = execFileSync(
        'docker',
        ['inspect', '--format', '{{index .Config.Labels "nzila.mission"}}', container],
        { encoding: 'utf8' },
      ).trim()
      expect(label).toBe('UE_BOOTSTRAP_V2_FRAMEWORK')
      execFileSync('docker', ['rm', '-f', container], { stdio: 'pipe' })
    }
  })

  it('proves canonical actor/admin and isolated worker operations on all 18 real tables', async () => {
    const proof = await proveFrameworkBoundary(
      clients,
      plan,
      process.env.UE_V2_NATIVE_FRAMEWORK_APPLICATION === '1'
        ? () => {
            if (!container || !process.env.UE_V2_WHEELHOUSE)
              throw new Error('UE_FRAMEWORK_APPLICATION_FIXTURE_REQUIRED')
            return proveFrameworkApplication({
              containerId: container,
              database: 'postgres',
              password,
              wheelhouse: process.env.UE_V2_WHEELHOUSE,
              users: {
                runtime: 'ue_framework_proof_ordinary',
                auth: 'ue_framework_proof_auth',
                request: 'ue_framework_proof_request',
                worker: 'ue_framework_proof_worker',
              },
            })
          }
        : undefined,
    )
    expect(proof.failures).toEqual([])
    expect(proof.result).toBe('PASS')
    expect(proof.tableReports).toHaveLength(21)
    expect(proof.tableReports.every((report) => report.status === 'PASS')).toBe(true)
    expect(proof.applicationInvocation).toBe(
      process.env.UE_V2_NATIVE_FRAMEWORK_APPLICATION === '1'
        ? 'PASS_CURRENT_FRAMEWORK_CONSUMERS'
        : 'NOT_YET_PROVEN',
    )
    expect(proof.fixtureCleanup).toBe('PASS')
  }, 600000)
  it('independently rejects extra policies, column overgrants and sequence mutation authority', async () => {
    for (const [sql, expected] of [
      [
        'CREATE POLICY unexpected_tenant_access ON public.auth_user TO union_eyes_runtime USING (true)',
        'FRAMEWORK_POLICY_UNEXPECTED:public.auth_user:unexpected_tenant_access',
      ],
      [
        'GRANT SELECT ON user_management.users TO ue_framework_authority_reader',
        'FRAMEWORK_TABLE_AUTHORITY:ue_framework_authority_reader:user_management.users:SELECT',
      ],
      [
        'GRANT UPDATE ON SEQUENCE public.auth_user_id_seq TO ue_framework_identity',
        'FRAMEWORK_SEQUENCE_AUTHORITY:ue_framework_identity:public.auth_user_id_seq:UPDATE',
      ],
      [
        'ALTER POLICY ue_framework_admin ON public.auth_user USING (true) WITH CHECK (true)',
        'FRAMEWORK_POLICY_UNSAFE:public.auth_user:ue_framework_admin',
      ],
      [
        'ALTER POLICY ue_platform_metadata_admin ON public.failed_login_attempts USING (true) WITH CHECK (true)',
        'FRAMEWORK_POLICY_UNSAFE:public.failed_login_attempts:ue_platform_metadata_admin',
      ],
      [
        'GRANT SELECT ON public.clc_chart_of_accounts TO ue_framework_identity',
        'FRAMEWORK_TABLE_AUTHORITY:ue_framework_identity:public.clc_chart_of_accounts:SELECT',
      ],
      [
        'GRANT ue_framework_admin TO union_eyes_runtime',
        'FRAMEWORK_MEMBERSHIP_UNSAFE:union_eyes_runtime:ue_framework_admin',
      ],
      [
        'GRANT EXECUTE ON FUNCTION user_management.auth_provider_user() TO ue_framework_identity',
        'FRAMEWORK_UNDECLARED_FUNCTION_AUTHORITY:ue_framework_identity:user_management.auth_provider_user()',
      ],
    ]) {
      await clients.owner.query('BEGIN')
      try {
        await clients.owner.query(sql)
        expect((await inspectFrameworkPrivileges(clients.owner)).failures).toContain(expected)
      } finally {
        await clients.owner.query('ROLLBACK')
      }
    }
    expect((await inspectFrameworkPrivileges(clients.owner)).failures).toEqual([])
  }, 120000)
  it('validates preprovisioned roles through the real restricted LOGIN and rejects drift', async () => {
    const assertions = compileRolePrerequisiteAssertions(
      Object.values(FRAMEWORK_ROLES),
      FRAMEWORK_MEMBERSHIPS,
    )
    await clients.request.query(assertions)
    for (const [mutation, error] of [
      ['ALTER ROLE ue_framework_identity LOGIN', 'CANONICAL_PREPROVISIONED_ROLE_UNSAFE'],
      [
        'GRANT ue_framework_worker TO ue_framework_gateway',
        'CANONICAL_PREPROVISIONED_MEMBERSHIP_DRIFT',
      ],
      [
        'REVOKE ue_framework_identity FROM ue_framework_gateway',
        'CANONICAL_PREPROVISIONED_MEMBERSHIP_DRIFT',
      ],
    ]) {
      await clients.owner.query('BEGIN')
      try {
        await clients.owner.query(mutation)
        await expect(clients.owner.query(assertions)).rejects.toThrow(error)
      } finally {
        await clients.owner.query('ROLLBACK')
      }
    }
    await clients.request.query(assertions)
  })
})
