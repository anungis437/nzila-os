import { execFileSync } from 'node:child_process'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { connectLocalV2, createCurrentState } from './installer'
import { compileMinimumRoleProvisioningSql } from './minimum-installer'
import { iterateRuntimeSecurityReports } from './runtime-security'
import { compileSecurity } from './security'
import { qualifyNativePrivileges } from './manifest-security'
import { folder, type V2Plan } from './source'
import { sql } from 'drizzle-orm'
import { NextRequest, NextResponse } from 'next/server'
import type { WageData, UnionDensity } from '../../lib/services/external-data/statcan-client'

const { frontendIdentity, frontendAuthModule, syntheticStatCan } = vi.hoisted(() => {
  const frontendIdentity = { actor: '', token: '' }
  const frontendAuthModule = () => ({
    auth: async () => ({ userId: frontendIdentity.actor, identityProvider: 'nzila-password' }),
    currentUser: async () => ({
      publicMetadata: {
        role: 'app_owner',
        organizationId: '44444444-4444-4444-8444-444444444444',
      },
    }),
  })
  const syntheticStatCan = {
    getWageData: vi.fn<() => Promise<WageData[]>>(),
    getUnionDensity: vi.fn<() => Promise<UnionDensity[]>>(),
    getCOLAData:
      vi.fn<
        () => Promise<{ region: string; year: number; cpi: number; inflationRate: number }[]>
      >(),
  }
  return { frontendIdentity, frontendAuthModule, syntheticStatCan }
})
vi.mock('../../../../packages/platform-auth/src/entra/server', () => frontendAuthModule())
vi.mock('@nzila/platform-auth/entra/server', () => frontendAuthModule())
vi.mock('../../lib/services/external-data/statcan-client', () => ({
  statCanClient: syntheticStatCan,
}))
vi.mock('next/headers', () => ({
  cookies: async () => ({ get: () => ({ value: frontendIdentity.token }) }),
}))
vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: async () => ({ allowed: true }),
  createRateLimitHeaders: () => ({}),
  RATE_LIMITS: { DEFAULT_API_ORG: {} },
}))

const native = process.env.UE_V2_NATIVE_MANIFEST === '1' ? describe : describe.skip
native('current tenant positive writes with genuine restricted execution', () => {
  const password = randomBytes(24).toString('hex')
  const opened: pg.Client[] = []
  let container: string | undefined
  let seed: pg.Client
  let runtime: pg.Client
  let system: pg.Client
  let frontendRuntimeUrl: string
  let frontendAuthUrl: string
  let frontendSystemUrl: string
  const plan: V2Plan = JSON.parse(
    readFileSync(path.join(folder, 'UE_CANONICAL_SCHEMA_V2_SOURCE_PLAN.json'), 'utf8'),
  )
  const rules = compileSecurity(plan).rules.filter((rule) =>
    /RLS_REQUIRED$/.test(rule.classification),
  )
  let iterator: ReturnType<typeof iterateRuntimeSecurityReports> | undefined

  beforeAll(async () => {
    container = execFileSync(
      'docker',
      [
        'run',
        '-d',
        '--pull',
        'never',
        '--name',
        `ue-v2-runtime-${randomUUID()}`,
        '--label',
        'nzila.mission=UE_BOOTSTRAP_V2_RUNTIME',
        '--memory',
        '1g',
        '--cpus',
        '2',
        '--tmpfs',
        '/var/lib/postgresql/data:rw,size=768m',
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
    const config = { host: '127.0.0.1', port, password }
    const admin = new pg.Client({ ...config, user: 'postgres', database: 'postgres' })
    opened.push(admin)
    await admin.connect()
    await admin.query(compileMinimumRoleProvisioningSql())
    await admin.query('CREATE DATABASE ue_v2_clean_positive_writes OWNER ue_v2_owner')
    seed = await connectLocalV2({
      ...config,
      user: 'postgres',
      database: 'ue_v2_clean_positive_writes',
    })
    opened.push(seed)
    await seed.query('BEGIN')
    await createCurrentState(seed, plan)
    await seed.query('COMMIT')
    expect((await qualifyNativePrivileges(seed, plan)).mismatches).toEqual([])
    for (const [sql, mismatch] of [
      [
        'REVOKE SELECT (sync_id) ON public.external_data_sync_log FROM union_eyes_system',
        'COLUMN_SELECT_GRANT_MISMATCH:external_data_sync_log.sync_id:union_eyes_system',
      ],
      [
        'GRANT SELECT (error_details) ON public.external_data_sync_log TO union_eyes_system',
        'COLUMN_SELECT_GRANT_MISMATCH:external_data_sync_log.error_details:union_eyes_system',
      ],
      [
        'REVOKE SELECT (contract_number) ON public.commercial_contracts FROM union_eyes_system',
        'COLUMN_SELECT_GRANT_MISMATCH:commercial_contracts.contract_number:union_eyes_system',
      ],
      [
        'GRANT SELECT (metadata) ON public.commercial_contracts TO union_eyes_system',
        'COLUMN_SELECT_GRANT_MISMATCH:commercial_contracts.metadata:union_eyes_system',
      ],
    ]) {
      await seed.query('BEGIN')
      try {
        await seed.query(sql)
        expect((await qualifyNativePrivileges(seed, plan)).mismatches).toContain(mismatch)
      } finally {
        await seed.query('ROLLBACK')
      }
    }
    for (const [user, role] of [
      ['ue_v2_positive_runtime', 'union_eyes_runtime'],
      ['ue_v2_positive_system', 'union_eyes_system'],
      ['ue_v2_positive_auth', 'nzila_auth_gateway'],
    ]) {
      await admin.query(
        `CREATE ROLE ${user} LOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS NOCREATEDB NOCREATEROLE PASSWORD '${password}'; GRANT ${role} TO ${user}`,
      )
    }
    runtime = await connectLocalV2({
      ...config,
      user: 'ue_v2_positive_runtime',
      database: 'ue_v2_clean_positive_writes',
    })
    system = await connectLocalV2({
      ...config,
      user: 'ue_v2_positive_system',
      database: 'ue_v2_clean_positive_writes',
    })
    opened.push(runtime, system)
    frontendRuntimeUrl = `postgresql://ue_v2_positive_runtime:${password}@127.0.0.1:${port}/ue_v2_clean_positive_writes`
    frontendAuthUrl = `postgresql://ue_v2_positive_auth:${password}@127.0.0.1:${port}/ue_v2_clean_positive_writes`
    frontendSystemUrl = `postgresql://ue_v2_positive_system:${password}@127.0.0.1:${port}/ue_v2_clean_positive_writes`
  }, 600000)

  afterAll(async () => {
    try {
      await Promise.all(opened.map((client) => client.end()))
    } finally {
      if (container) {
        expect(
          execFileSync(
            'docker',
            ['inspect', '--format', '{{index .Config.Labels "nzila.mission"}}', container],
            { encoding: 'utf8' },
          ).trim(),
        ).toBe('UE_BOOTSTRAP_V2_RUNTIME')
        execFileSync('docker', ['rm', '-f', container], { stdio: 'pipe' })
      }
    }
  })

  it('maps the actual Next application context to the canonical non-owner role and isolated rows', async () => {
    vi.stubEnv('DATABASE_URL', frontendRuntimeUrl)
    vi.stubEnv('AUTH_DATABASE_URL', frontendAuthUrl)
    vi.stubEnv('SYSTEM_DATABASE_URL', frontendSystemUrl)
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    vi.stubEnv('DATABASE_TYPE', 'postgresql')
    frontendIdentity.actor = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'
    frontendIdentity.token = 'ue-v2-current-application-synthetic-only'
    const applicationOrg = '33333333-3333-4333-8333-333333333333'
    await seed.query(
      `INSERT INTO public.organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
       member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
      SELECT id,'Synthetic application organization','ue-native-application-'||id::text,'local',ARRAY[]::text[],0,
             ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now()
      FROM unnest($1::uuid[]) AS fixture(id)`,
      [[applicationOrg, '44444444-4444-4444-8444-444444444444']],
    )
    await seed.query('INSERT INTO user_management.users(user_id,email) VALUES ($1,$2)', [
      frontendIdentity.actor,
      'ue-native-application@example.invalid',
    ])
    await seed.query(
      "INSERT INTO user_management.organization_users(user_id,organization_id,role,is_active) VALUES ($1,$2,'member',true)",
      [frontendIdentity.actor, applicationOrg],
    )
    await seed.query(
      "INSERT INTO user_management.user_sessions(user_id,organization_id,session_token,session_token_hash,expires_at,is_active) VALUES ($1,$2,$3,$3,now()+interval '1 hour',true)",
      [
        frontendIdentity.actor,
        applicationOrg,
        createHash('sha256').update(frontendIdentity.token).digest('hex'),
      ],
    )
    const { withRLSContext, withSystemContext, withPlatformAdminRLSContext } =
      await import('../../lib/db/with-rls-context')
    const { db, client } = await import('../../db/db')
    const { closeSystemClient } = await import('../../db/system-db')
    const { closeAuthClients } = await import('../../../../packages/db/src/auth-client')
    try {
      await withRLSContext(async () => {
        const actor = await db.execute<{ role: string; user_id: string; organization_id: string }>(
          sql`SELECT current_user AS role,current_setting('app.current_user_id') AS user_id,
            current_setting('app.current_org_id') AS organization_id`,
        )
        expect(actor[0]).toEqual({
          role: 'union_eyes_runtime',
          user_id: frontendIdentity.actor,
          organization_id: applicationOrg,
        })
        const rows = await db.execute<{ id: string }>(sql`SELECT id FROM public.organizations`)
        expect(rows.map((row) => row.id)).toEqual([applicationOrg])
      })
      const syncId = `ue-v2-next-sync-${randomUUID()}`
      await withSystemContext(async () => {
        const context = await db.execute<{
          role: string
          user_id: string
          organization_id: string
        }>(
          sql`SELECT current_user AS role,current_setting('app.current_user_id') AS user_id,
            current_setting('app.current_org_id') AS organization_id`,
        )
        expect(context[0]).toEqual({
          role: 'union_eyes_system',
          user_id: '',
          organization_id: '',
        })
        await db.execute(sql`INSERT INTO public.external_data_sync_log
          (sync_id,source,source_type,status,sync_type)
          VALUES (${syncId},'synthetic','synthetic','running','scheduled')`)
        const updated = await db.execute<{
          sync_id: string
        }>(sql`UPDATE public.external_data_sync_log
          SET status='completed',records_processed=1,completed_at=statement_timestamp()
          WHERE sync_id=${syncId} RETURNING sync_id`)
        expect(updated.map((row) => row.sync_id)).toEqual([syncId])
      })
      await expect(
        withSystemContext(async () => {
          await db.execute(sql`SELECT * FROM public.external_data_sync_log`)
        }),
      ).rejects.toMatchObject({ cause: { code: '42501' } })
      const unauthorizedPlatformOperation = vi.fn()
      await expect(
        withPlatformAdminRLSContext(
          frontendIdentity.actor,
          'synthetic-native-proof',
          unauthorizedPlatformOperation,
        ),
      ).rejects.toMatchObject({ code: 'ROLE_REQUIRED' })
      expect(unauthorizedPlatformOperation).not.toHaveBeenCalled()
      await seed.query(
        "UPDATE user_management.organization_users SET role='admin' WHERE user_id=$1 AND organization_id=$2",
        [frontendIdentity.actor, applicationOrg],
      )
      const actualGuards =
        await vi.importActual<typeof import('../../lib/api-auth-guard')>('@/lib/api-auth-guard')
      expect(await actualGuards.getUserContext()).toMatchObject({
        userId: frontendIdentity.actor,
        organizationId: applicationOrg,
        roles: ['admin'],
      })
      expect(await actualGuards.getCurrentUser()).toMatchObject({
        id: frontendIdentity.actor,
        organizationId: applicationOrg,
        role: 'admin',
        isSystemAdmin: false,
      })
      expect(await actualGuards.getUserRole(frontendIdentity.actor, applicationOrg)).toBe('admin')
      expect(await actualGuards.isSystemAdmin()).toBe(false)
      const { getOrganizationIdForUser } = await import('../../lib/organization-utils')
      const { getUserRole } = await import('../../lib/auth/rbac-server')
      expect(await getOrganizationIdForUser(frontendIdentity.actor)).toBe(applicationOrg)
      expect(await getUserRole(frontendIdentity.actor, applicationOrg)).toBe('admin')
      await expect(
        actualGuards.getUserContextForOrganization('44444444-4444-4444-8444-444444444444'),
      ).rejects.toMatchObject({ code: 'MEMBERSHIP_REQUIRED' })
      await expect(
        getOrganizationIdForUser('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'),
      ).rejects.toMatchObject({ code: 'ACTOR_MISMATCH' })
      const { withApi } = await import('../../lib/api/with-api')
      const ownOrganizations = withApi({}, async () => {
        const rows = await db.execute<{ id: string }>(sql`SELECT id FROM public.organizations`)
        return rows.map((row) => row.id)
      })
      const request = () => new NextRequest('http://localhost/api/synthetic-canonical-proof')
      const deprecatedOrganizationHandler = async (
        _request: NextRequest,
        context: Record<string, unknown>,
      ) => {
        expect(context).toMatchObject({
          userId: frontendIdentity.actor,
          organizationId: applicationOrg,
        })
        const rows = await db.execute<{ id: string }>(sql`SELECT id FROM public.organizations`)
        return NextResponse.json(rows.map((row) => row.id))
      }
      const deprecatedOwnOrganizations = actualGuards.withApiAuth(deprecatedOrganizationHandler)
      const deprecatedMemberOrganizations = actualGuards.withRoleAuth(
        'member',
        deprecatedOrganizationHandler,
      )
      const deprecatedSystemOrganizations = actualGuards.withSystemAdminAuth(
        deprecatedOrganizationHandler,
      )
      vi.stubEnv('PLATFORM_ADMIN_USER_IDS', frontendIdentity.actor)
      for (const [membershipRole, isSystemAdmin, expectedRole] of [
        ['member', false, 'member'],
        ['admin', false, 'admin'],
        ['member', true, 'app_owner'],
      ] as const) {
        await seed.query(
          'UPDATE user_management.organization_users SET role=$1 WHERE user_id=$2 AND organization_id=$3',
          [membershipRole, frontendIdentity.actor, applicationOrg],
        )
        await seed.query('UPDATE user_management.users SET is_system_admin=$1 WHERE user_id=$2', [
          isSystemAdmin,
          frontendIdentity.actor,
        ])
        expect(await actualGuards.getUserContext()).toMatchObject({ roles: [expectedRole] })
        expect(await actualGuards.getCurrentUser()).toMatchObject({
          role: expectedRole,
          isSystemAdmin,
          organizationId: applicationOrg,
        })
        expect(await actualGuards.requireApiAuth({ orgScoped: true })).toEqual({
          userId: frontendIdentity.actor,
          organizationId: applicationOrg,
          role: null,
        })
        expect(
          await actualGuards.requireApiAuth({ orgScoped: true, roles: [expectedRole] }),
        ).toEqual({
          userId: frontendIdentity.actor,
          organizationId: applicationOrg,
          role: expectedRole,
        })
        await expect(
          actualGuards.requireApiAuth({
            orgScoped: true,
            roles: [expectedRole === 'member' ? 'admin' : 'member'],
          }),
        ).rejects.toThrow('Forbidden: Requires one of roles:')
        expect(await actualGuards.hasRole('app_owner')).toBe(isSystemAdmin)
        expect(await actualGuards.hasMinRole('app_owner')).toBe(isSystemAdmin)
        const response = await ownOrganizations(request())
        expect(response.status).toBe(200)
        expect(await response.json()).toMatchObject({ data: [applicationOrg] })
        const deprecatedResponse = await deprecatedOwnOrganizations(request(), {
          userId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
          organizationId: '44444444-4444-4444-8444-444444444444',
        })
        expect(deprecatedResponse.status).toBe(200)
        expect(await deprecatedResponse.json()).toEqual([applicationOrg])
        expect((await deprecatedMemberOrganizations(request(), {})).status).toBe(200)
        expect((await deprecatedSystemOrganizations(request(), {})).status).toBe(
          isSystemAdmin ? 200 : 403,
        )
        const administrative = withApi(
          { registry: { orgScoping: 'platform-admin-only' } },
          async () => ({ authorized: true }),
        )
        expect((await administrative(request())).status).toBe(isSystemAdmin ? 200 : 403)
      }
      await withPlatformAdminRLSContext(
        frontendIdentity.actor,
        'synthetic-authorized-platform-proof',
        async () => {
          const context = await db.execute<{ role: string; user_id: string }>(
            sql`SELECT current_user AS role,current_setting('app.current_user_id') AS user_id`,
          )
          expect(context[0]).toEqual({
            role: 'union_eyes_system',
            user_id: frontendIdentity.actor,
          })
        },
      )
      await seed.query('UPDATE user_management.users SET is_system_admin=false WHERE user_id=$1', [
        frontendIdentity.actor,
      ])
      await seed.query(
        'UPDATE user_management.user_sessions SET organization_id=NULL WHERE user_id=$1',
        [frontendIdentity.actor],
      )
      await seed.query(
        'UPDATE user_management.organization_users SET is_active=false WHERE user_id=$1',
        [frontendIdentity.actor],
      )
      expect(await actualGuards.getCurrentUser()).toMatchObject({
        id: frontendIdentity.actor,
        role: 'member',
        organizationId: null,
        isSystemAdmin: false,
      })
      expect(await actualGuards.requireApiAuth()).toEqual({
        userId: frontendIdentity.actor,
        organizationId: null,
        role: null,
      })
      await expect(actualGuards.requireApiAuth({ orgScoped: true })).rejects.toThrow(
        'Forbidden: Organization context unavailable',
      )
      await expect(actualGuards.requireApiAuth({ roles: ['member'] })).rejects.toThrow(
        'Forbidden: Organization context unavailable',
      )
      const profile = withApi({ requireOrg: false }, async ({ user }) => ({ id: user?.id }))
      expect((await profile(request())).status).toBe(200)
      expect((await ownOrganizations(request())).status).toBe(403)
      expect((await deprecatedOwnOrganizations(request(), {})).status).toBe(403)
      const deprecatedProfile = actualGuards.withApiAuth(
        async (_request, context) => NextResponse.json({ id: context.userId }),
        { requireOrg: false },
      )
      const deprecatedProfileResponse = await deprecatedProfile(request(), {})
      expect(deprecatedProfileResponse.status).toBe(200)
      expect(await deprecatedProfileResponse.json()).toEqual({ id: frontendIdentity.actor })
      const privateToken = frontendIdentity.token
      try {
        frontendIdentity.token = `ue-v2-invalid-private-session-${randomUUID()}`
        await expect(actualGuards.requireApiAuth()).rejects.toThrow(/^Unauthorized:/)
      } finally {
        frontendIdentity.token = privateToken
      }
      expect(await actualGuards.requireApiAuth()).toEqual({
        userId: frontendIdentity.actor,
        organizationId: null,
        role: null,
      })
      for (const sessionState of ['expired', 'revoked'] as const) {
        await seed.query(
          sessionState === 'expired'
            ? "UPDATE user_management.user_sessions SET expires_at=now()-interval '1 second' WHERE user_id=$1"
            : 'UPDATE user_management.user_sessions SET is_active=false WHERE user_id=$1',
          [frontendIdentity.actor],
        )
        try {
          await expect(actualGuards.requireApiAuth()).rejects.toThrow(/^Unauthorized:/)
        } finally {
          await seed.query(
            "UPDATE user_management.user_sessions SET expires_at=now()+interval '1 hour',is_active=true WHERE user_id=$1",
            [frontendIdentity.actor],
          )
        }
        expect(await actualGuards.requireApiAuth()).toEqual({
          userId: frontendIdentity.actor,
          organizationId: null,
          role: null,
        })
      }
    } finally {
      try {
        await Promise.all([closeAuthClients(), client.end({ timeout: 5 }), closeSystemClient()])
      } finally {
        vi.unstubAllEnvs()
      }
    }
  }, 120000)

  it('qualifies the source-owned system sync selector without broad content reads', async () => {
    await system.query('BEGIN')
    try {
      await system.query('SET LOCAL ROLE union_eyes_system')
      const syncId = `ue-v2-native-sync-${randomUUID()}`
      expect(
        (
          await system.query(
            "INSERT INTO public.external_data_sync_log(sync_id,source,source_type,status,sync_type) VALUES ($1,'synthetic','synthetic','running','scheduled')",
            [syncId],
          )
        ).rowCount,
      ).toBe(1)
      expect(
        (
          await system.query(
            "UPDATE public.external_data_sync_log SET status='completed',records_processed=1,completed_at=statement_timestamp() WHERE sync_id=$1",
            [syncId],
          )
        ).rowCount,
      ).toBe(1)
      expect(
        (
          await system.query('SELECT sync_id FROM public.external_data_sync_log WHERE sync_id=$1', [
            syncId,
          ])
        ).rowCount,
      ).toBe(1)
      await system.query('SAVEPOINT ue_v2_broad_sync_read')
      await expect(
        system.query('SELECT * FROM public.external_data_sync_log'),
      ).rejects.toMatchObject({
        code: '42501',
      })
      await system.query('ROLLBACK TO SAVEPOINT ue_v2_broad_sync_read')
    } finally {
      await system.query('ROLLBACK')
    }
  })

  it('executes actual external-reference service inserts and selector updates through the system proxy', async () => {
    vi.resetModules()
    vi.stubEnv('DATABASE_URL', frontendRuntimeUrl)
    vi.stubEnv('AUTH_DATABASE_URL', frontendAuthUrl)
    vi.stubEnv('SYSTEM_DATABASE_URL', frontendSystemUrl)
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    vi.stubEnv('DATABASE_TYPE', 'postgresql')
    const { WageEnrichmentService } =
      await import('../../lib/services/external-data/wage-enrichment-service')
    const { client } = await import('../../db/db')
    const { closeSystemClient } = await import('../../db/system-db')
    const service = new WageEnrichmentService()
    const wage: WageData = {
      GEO: '01',
      GEOUID: '01',
      GEOName: 'Synthetic Canada',
      NAICS: '',
      NAICSName: '',
      NOC: '99999',
      NOCName: 'Synthetic occupation',
      Wages: { UOM: 'hourly', Vector: 'synthetic', Coordinate: 1, Value: 20, Decimals: 2 },
      Sex: 'B',
      AgeGroup: '',
      AgeGroupName: '',
      Education: '',
      EducationName: '',
      Statistics: 'Average',
      StatisticsName: 'Average',
      DataType: 'synthetic',
      DataTypeName: 'Synthetic',
      RefDate: '2026-09',
      Source: 'synthetic',
    }
    const density: UnionDensity = {
      GEO: '01',
      GEOUID: '01',
      GEOName: 'Synthetic Canada',
      Sex: 'B',
      UnionStatus: 'synthetic',
      UnionStatusName: 'Synthetic membership',
      Value: 20,
      Vector: 'synthetic',
      Coordinate: 1,
      Decimals: 2,
      RefDate: '2026-09',
      Source: 'synthetic',
    }
    const syncIds: string[] = []
    try {
      for (const update of [false, true]) {
        syntheticStatCan.getWageData.mockResolvedValue([
          { ...wage, Wages: { ...wage.Wages, Value: update ? 25 : 20 } },
        ])
        syntheticStatCan.getUnionDensity.mockResolvedValue([
          { ...density, Value: update ? 25 : 20 },
        ])
        syntheticStatCan.getCOLAData.mockResolvedValue([
          { region: '01', year: 2099, cpi: update ? 125 : 120, inflationRate: 2 },
        ])
        for (const execute of [
          () => service.syncWageData({ nocCodes: [wage.NOC] }),
          () => service.syncUnionDensity({ geography: '01' }),
          () => service.syncCOLAData({ geography: '01', startYear: 2099, endYear: 2099 }),
        ]) {
          const result = await execute()
          syncIds.push(result.syncId)
          expect(result, result.errors.join('\n')).toMatchObject({
            success: true,
            recordsProcessed: 1,
            recordsInserted: update ? 0 : 1,
            recordsUpdated: update ? 1 : 0,
            recordsFailed: 0,
            errors: [],
          })
          expect(
            (
              await seed.query(
                'SELECT status,records_processed,records_inserted,records_updated FROM public.external_data_sync_log WHERE sync_id=$1',
                [result.syncId],
              )
            ).rows,
          ).toEqual([
            {
              status: 'completed',
              records_processed: 1,
              records_inserted: update ? 0 : 1,
              records_updated: update ? 1 : 0,
            },
          ])
        }
      }
      expect(
        (
          await seed.query('SELECT wage_value FROM public.wage_benchmarks WHERE noc_code=$1', [
            wage.NOC,
          ])
        ).rows.map((row) => Number(row.wage_value)),
      ).toEqual([25])
      expect(
        (
          await seed.query('SELECT density_value FROM public.union_density WHERE union_status=$1', [
            density.UnionStatus,
          ])
        ).rows.map((row) => Number(row.density_value)),
      ).toEqual([25])
      expect(
        (
          await seed.query('SELECT cpi_value FROM public.cost_of_living_data WHERE year=2099')
        ).rows.map((row) => Number(row.cpi_value)),
      ).toEqual([125])
      for (const table of ['wage_benchmarks', 'union_density', 'cost_of_living_data']) {
        await runtime.query('BEGIN')
        try {
          await runtime.query('SET LOCAL ROLE union_eyes_runtime')
          await expect(runtime.query(`SELECT * FROM public.${table}`)).rejects.toMatchObject({
            code: '42501',
          })
        } finally {
          await runtime.query('ROLLBACK')
        }
      }
    } finally {
      try {
        await seed.query('DELETE FROM public.wage_benchmarks WHERE noc_code=$1', [wage.NOC])
        await seed.query('DELETE FROM public.union_density WHERE union_status=$1', [
          density.UnionStatus,
        ])
        await seed.query('DELETE FROM public.cost_of_living_data WHERE year=2099')
        await seed.query(
          'DELETE FROM public.external_data_sync_log WHERE sync_id=ANY($1::text[])',
          [syncIds],
        )
      } finally {
        await Promise.all([client.end({ timeout: 5 }), closeSystemClient()])
        vi.unstubAllEnvs()
      }
    }
  }, 120000)

  it('qualifies the actual commercial transition selector without broad contract reads', async () => {
    const organizationId = randomUUID()
    const billingAccountId = randomUUID()
    const contractNumber = `ue-v2-${randomUUID()}`
    await seed.query(
      `INSERT INTO public.organizations
      (id,name,slug,organization_type,hierarchy_path,hierarchy_level,sectors,clc_affiliated,
       member_count,active_member_count,settings,features_enabled,status,remittance_day,created_at,updated_at)
      VALUES ($1::uuid,'Synthetic contract organization',$1::uuid::text,'local',ARRAY[]::text[],0,
       ARRAY[]::varchar[],false,0,0,'{}',ARRAY[]::text[],'active',15,now(),now())`,
      [organizationId],
    )
    await seed.query(
      `INSERT INTO public.billing_accounts(id,organization_id,display_name,billing_email)
       VALUES ($1,$2,'Synthetic billing account','ue-v2-commercial@example.invalid')`,
      [billingAccountId, organizationId],
    )
    await system.query('BEGIN')
    try {
      await system.query('SET LOCAL ROLE union_eyes_system')
      expect(
        (
          await system.query(
            'SELECT id FROM public.commercial_contracts WHERE contract_number=$1',
            [contractNumber],
          )
        ).rowCount,
      ).toBe(0)
      const inserted = await system.query<{ id: string }>(
        `INSERT INTO public.commercial_contracts
        (organization_id,billing_account_id,contract_number,name,status,effective_date,expiration_date)
        VALUES ($1,$2,$3,'Synthetic pilot contract','pending_approval',now(),now()+interval '90 days')
        RETURNING id`,
        [organizationId, billingAccountId, contractNumber],
      )
      expect(inserted.rowCount).toBe(1)
      expect(
        (
          await system.query(
            "UPDATE public.commercial_contracts SET status='active',signed_at=now(),updated_at=now() WHERE id=$1",
            [inserted.rows[0].id],
          )
        ).rowCount,
      ).toBe(1)
      await system.query('SET CONSTRAINTS ALL IMMEDIATE')
      expect(
        (
          await system.query(
            'SELECT id FROM public.commercial_contracts WHERE contract_number=$1',
            [contractNumber],
          )
        ).rows,
      ).toEqual([{ id: inserted.rows[0].id }])
      await system.query('SAVEPOINT ue_v2_contract_content_read')
      await expect(system.query('SELECT * FROM public.commercial_contracts')).rejects.toMatchObject(
        {
          code: '42501',
        },
      )
      await system.query('ROLLBACK TO SAVEPOINT ue_v2_contract_content_read')
    } finally {
      await system.query('ROLLBACK')
      try {
        expect(
          (
            await seed.query(
              'SELECT id FROM public.commercial_contracts WHERE contract_number=$1',
              [contractNumber],
            )
          ).rowCount,
        ).toBe(0)
      } finally {
        await seed.query('DELETE FROM public.billing_accounts WHERE id=$1', [billingAccountId])
        await seed.query('DELETE FROM public.organizations WHERE id=$1', [organizationId])
      }
    }
  })

  for (const rule of rules) {
    it(`${rule.table}: qualifies every source-authorized actor operation and constraints`, async () => {
      iterator ??= iterateRuntimeSecurityReports(seed, runtime, system, plan, rules)
      const next = await iterator.next()
      if (next.done) throw new Error(`UE_V2_NATIVE_TABLE_PROOF_MISSING:${rule.table}`)
      const report = next.value
      expect(report.table).toBe(rule.table)
      expect(report.status, report.failure).toBe('PASS')
      for (const actorClass of ['MEMBER', 'ORG_ADMIN', 'PLATFORM_ADMIN']) {
        expect(report?.cases, `${rule.table}:${actorClass}`).toContain(
          `${actorClass}:FIXTURE_MUTATIONS_ROLLED_BACK`,
        )
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE', 'DELETE']) {
          const expected = rule.runtimePrivileges.includes(privilege)
            ? privilege === 'SELECT'
              ? `${actorClass}:OWN_READ_ALLOWED_FOREIGN_READ_DENIED`
              : `${actorClass}:OWN_${privilege}_ALLOWED_CONSTRAINT_VERIFIED_FOREIGN_AND_UNAUTHENTICATED_DENIED`
            : `${actorClass}:SOURCE_UNAUTHORIZED_${privilege}_DENIED`
          expect(report?.cases, `${rule.table}:${actorClass}:${privilege}`).toContain(expected)
        }
      }
      if (rule.runtimePrivileges.includes('INSERT')) {
        expect(report.cases, rule.table).toContain(
          'OWN_TENANT_INSERT_ALLOWED_CONSTRAINT_VERIFIED_AND_ROLLED_BACK',
        )
        expect(report.cases, rule.table).toContain('FOREIGN_TENANT_INSERT_RLS_DENIED')
      }
    }, 120000)
  }

  it('finishes the exact complete native matrix and verifies role-escalation denials', async () => {
    if (!iterator) throw new Error('UE_V2_NATIVE_MATRIX_NOT_STARTED')
    const next = await iterator.next()
    if (!next.done) throw new Error(`UE_V2_NATIVE_EXTRA_TABLE_PROOF:${next.value.table}`)
    const proof = next.value
    expect(proof.reports.filter((report) => report.status === 'FAIL')).toEqual([])
    expect(proof.reports.map((report) => report.table)).toEqual(rules.map((rule) => rule.table))
    expect(proof.nativeActorClassQualification.result).toBe('PASS')
    expect(proof.nativeActorClassQualification.qualified).toBe(rules.length)
    expect(proof.nativeActorClassQualification.denominator).toBe(rules.length)
  }, 120000)
})
