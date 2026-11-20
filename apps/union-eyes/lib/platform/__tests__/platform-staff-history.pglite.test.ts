/** Runs the real platform gate SQL. Eligibility/audit/transport are synthetic;
 * canonical session issuance and native transport are deliberately not claimed. */
import { PGlite } from '@electric-sql/pglite'
import { PgDialect } from 'drizzle-orm/pg-core'
import type { SQL } from 'drizzle-orm'
import { generateDrizzleJson, generateMigration } from 'drizzle-kit/api'
import { randomUUID } from 'node:crypto'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import * as schema from '../../../db/schema/domains/ml/authority-kernel'

const state = vi.hoisted(() => {
  class TestApiError extends Error {
    constructor(readonly status: number, message: string) { super(message) }
    static forbidden = (message: string) => new TestApiError(403, message)
  }
  return { ApiError: TestApiError, eligible: vi.fn(), transport: vi.fn(), audit: vi.fn() }
})
vi.mock('@/lib/api/framework', () => ({ ApiError: state.ApiError }))
vi.mock('@/lib/api-auth-guard', () => ({ isPlatformAdminUser: state.eligible }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: state.audit }))
vi.mock('@/lib/ai/ai-client', () => ({ UE_SYSTEM_ORG_ID: '00000000-0000-0000-0000-000000000000' }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: state.transport }))
vi.mock('@/lib/logger', () => ({ logger: { error: vi.fn() } }))
import { requirePlatformStaffAuthority } from '../platform-staff'

const SYSTEM_ORG = '00000000-0000-0000-0000-000000000000', tenant = randomUUID(), user = 'synthetic_platform_staff'
let pg: PGlite
// A platform mandate is exercised only while acting from the platform organization.
const actor = { userId: user, organizationId: SYSTEM_ORG }
interface HistoricalRow { organizationId?: string; principal?: string; kind?: string; powers?: string[]; status?: string;
  effective?: string; expires?: string; revoked?: string | null; accepted?: boolean; acceptedBy?: string; acceptanceOrg?: string }

async function historical(over: HistoricalRow = {}) {
  const id = randomUUID(), org = over.organizationId ?? SYSTEM_ORG
  // Trusted disposable seed represents retained history, not a new issuance path.
  await pg.query(`INSERT INTO public.ue_authority_mandates(id,organization_id,principal_user_id,kind,powers,scope,source_instrument,
    granted_by,status,effective_at,expires_at,revoked_at,requires_acceptance)
    VALUES($1,$2,$3,$4,$5,'{}','Synthetic historical fixture','synthetic_issuer',$6,$7::timestamptz,$8::timestamptz,$9::timestamptz,true)`,
  [id, org, over.principal ?? user, over.kind ?? 'platform_staff', over.powers ?? ['platform.stats.read'], over.status ?? 'active',
    over.effective ?? '2000-01-01T00:00:00Z', over.expires ?? '2100-01-01T00:00:00Z', over.revoked ?? null])
  if (over.accepted !== false) await pg.query(`INSERT INTO public.ue_authority_acceptances(organization_id,instrument_type,instrument_id,accepted_by)
    VALUES($1,'mandate',$2,$3)`, [over.acceptanceOrg ?? org, id, over.acceptedBy ?? user])
  return id
}

beforeAll(async () => {
  pg = new PGlite()
  const ddl = await generateMigration(generateDrizzleJson({}), generateDrizzleJson(schema))
  for (const statement of [...ddl.filter(sql => !sql.startsWith('ALTER TABLE')), ...ddl.filter(sql => sql.startsWith('ALTER TABLE'))]) await pg.exec(statement)
  await pg.exec('CREATE ROLE platform_gate_fixture_runtime NOLOGIN NOINHERIT NOSUPERUSER NOBYPASSRLS')
  for (const table of ['ue_authority_mandates', 'ue_authority_acceptances']) await pg.exec(`
    ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY;ALTER TABLE public.${table} FORCE ROW LEVEL SECURITY;
    GRANT SELECT ON public.${table} TO platform_gate_fixture_runtime;
    CREATE POLICY fixture_org ON public.${table} TO platform_gate_fixture_runtime
      USING(organization_id::text=current_setting('app.current_org_id',true));`)
})
afterAll(async () => { await pg?.close() })
beforeEach(async () => {
  vi.clearAllMocks()
  await pg.exec('DELETE FROM public.ue_authority_acceptances;DELETE FROM public.ue_authority_mandates')
  state.eligible.mockResolvedValue(true)
  state.audit.mockResolvedValue(undefined)
  state.transport.mockImplementation(async (context: { organizationId: string }, callback: (tx: { execute: (statement: SQL) => Promise<unknown[]> }) => Promise<unknown>) => {
    await pg.exec('BEGIN;SET LOCAL ROLE platform_gate_fixture_runtime')
    try {
      await pg.query("SELECT set_config('app.current_org_id',$1,true)", [context.organizationId])
      const result = await callback({ execute: async statement => {
        const compiled = new PgDialect().sqlToQuery(statement)
        return (await pg.query(compiled.sql, compiled.params)).rows
      } })
      await pg.exec('COMMIT'); return result
    } catch (error) { await pg.exec('ROLLBACK'); throw error }
  })
})

describe('actual platform gate SQL over retained synthetic platform-staff rows', () => {
  it('retains the specific supported platform positive only with eligibility and an accepted live exact responsibility', async () => {
    await historical()
    await expect(requirePlatformStaffAuthority(actor, 'platform.stats.read')).resolves.toEqual(actor)
    expect(state.audit).not.toHaveBeenCalled()
    expect(state.transport).toHaveBeenCalledWith({ organizationId: SYSTEM_ORG, userId: user }, expect.any(Function))
  })

  it.each<[string, HistoricalRow]>([
    ['wrong organization', { organizationId: tenant }], ['wrong holder', { principal: 'someone_else' }],
    ['wrong kind', { kind: 'supervisory' }], ['wrong capability', { powers: ['platform.organization.manage'] }],
    ['revoked status', { status: 'revoked', revoked: '2001-01-01T00:00:00Z' }],
    ['revocation despite active label', { revoked: '2001-01-01T00:00:00Z' }],
    ['suspended', { status: 'suspended' }], ['expired', { expires: '2001-01-01T00:00:00Z' }],
    ['future effective', { effective: '2099-01-01T00:00:00Z' }], ['unaccepted', { accepted: false }],
    ['another accepting person', { acceptedBy: 'someone_else' }], ['acceptance in wrong organization', { acceptanceOrg: tenant }],
  ])('refuses a %s retained row through the actual query', async (_name, row) => {
    await historical(row)
    await expect(requirePlatformStaffAuthority(actor, 'platform.stats.read')).rejects.toMatchObject({ status: 403 })
    expect(state.audit).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ organizationId: SYSTEM_ORG,
      action: 'platform.stats.read.denied', details: { reason: 'no_live_scoped_platform_staff_mandate' } }), 'failure')
  })

  it('refuses the same live mandate when its holder acts from a customer organization, and never queries it', async () => {
    await historical()
    const fromTenant = { userId: user, organizationId: tenant }
    await expect(requirePlatformStaffAuthority(fromTenant, 'platform.stats.read')).rejects.toMatchObject({ status: 403 })
    expect(state.transport).toHaveBeenCalledTimes(1)
    expect(state.transport).toHaveBeenCalledWith(fromTenant, expect.any(Function))
    expect(state.audit).toHaveBeenCalledWith(expect.any(Object), expect.objectContaining({ organizationId: tenant,
      details: { reason: 'not_acting_from_platform_organization' } }), 'failure')
  })

  it('does not grant another platform responsibility from an otherwise valid historical stats mandate', async () => {
    await historical()
    await expect(requirePlatformStaffAuthority(actor, 'platform.organization.manage')).rejects.toMatchObject({ status: 403 })
  })

  it('refuses an eligible administrator flag alone without a mandate', async () => {
    await expect(requirePlatformStaffAuthority(actor, 'platform.stats.read')).rejects.toMatchObject({ status: 403 })
  })

  it('refuses an ineligible role-holder even with the historical mandate and acceptance', async () => {
    await historical(); state.eligible.mockResolvedValue(false)
    await expect(requirePlatformStaffAuthority(actor, 'platform.stats.read')).rejects.toMatchObject({ status: 403 })
    expect(state.transport).toHaveBeenCalledTimes(1)
    expect(state.transport).toHaveBeenCalledWith(actor, expect.any(Function))
  })
})
