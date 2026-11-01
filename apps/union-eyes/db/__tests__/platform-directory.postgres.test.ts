/**
 * F03-A on real PostgreSQL: the platform-wide reads (user directory, member activity, platform statistics) as the system role.
 *
 * DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ and DEF-0B10-OPL-14. These read every organization's people and figures, so what they may see
 * is decided by the system role's grants and policies and what they return by their projection. The route-level authority check is
 * proven in the route tests; this proves, on the combined Django + Drizzle schema with each statement run as the real role, that
 *   - the system role can read the tables the statistics need (a silent zero would be a failure of its own) and holds no privilege on
 *     settlements, which the earlier statistics query read, so that query could never have run under it,
 *   - the figures match what the superuser counts, carry no settlement or per-capita figure, and are recorded with the read,
 *   - the directory returns a masked address, leaves out a removed member, narrows to one organization when asked and takes LIKE
 *     characters literally; the activity feed gives an abbreviated name and no address,
 *   - a tenant runtime session sees only its own organization, so a platform-wide figure cannot come out of one by accident,
 *   - the read and its audit record commit together, and a read whose record cannot be written returns nothing,
 *   - a caller without platform-staff authority is refused and the refusal is recorded under their own organization.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const state = vi.hoisted(() => ({ pool: null as unknown, platformAdmins: new Set<string>() }))

type Role = 'union_eyes_runtime' | 'union_eyes_system'
type Ctx = { organizationId?: string | null; userId?: string | null }

// One transaction as the real role, with the context a real request would carry. execute() returns rows the way the application's
// postgres-js driver does, so the statements read their results as they do in production.
async function inRole<T>(role: Role, ctx: Ctx, work: (tx: unknown) => Promise<T>): Promise<T> {
  const client = await (state.pool as pg.Pool).connect()
  try {
    await client.query('BEGIN')
    await client.query(`SET LOCAL ROLE ${role}`)
    await client.query(`SELECT set_config('app.current_org_id', $1, true), set_config('app.current_user_id', $2, true)`, [ctx.organizationId ?? '', ctx.userId ?? ''])
    const db = drizzle(client)
    const execute = db.execute.bind(db)
    ;(db as unknown as { execute: unknown }).execute = async (query: never) => (await execute(query)).rows
    const result = await work(db)
    await client.query('COMMIT')
    return result
  } catch (error) {
    await client.query('ROLLBACK').catch(() => undefined)
    throw error
  } finally {
    client.release()
  }
}

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: (work: (tx: unknown) => Promise<unknown>) => inRole('union_eyes_system', {}, work),
  withRLSContext: (ctx: Ctx, work: (tx: unknown) => Promise<unknown>) => inRole('union_eyes_runtime', ctx, work),
}))
vi.mock('@/lib/api/framework', () => {
  class ApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message)
    }
    static forbidden = (message: string) => new ApiError(403, message)
    static conflict = (message: string) => new ApiError(409, message)
  }
  return { ApiError }
})
vi.mock('@/lib/api-auth-guard', () => ({ isPlatformAdminUser: async (id: string) => state.platformAdmins.has(id) }))

const modules = URL
  ? {
      stats: await import('@/lib/queries/platform-stats'),
      directory: await import('@/lib/platform/user-directory'),
      read: await import('@/lib/audit/audited-platform-read'),
      staff: await import('@/lib/platform/platform-staff'),
    }
  : null

describe.skipIf(!URL)('platform-wide reads on the combined schema, as the system role', () => {
  const tag = randomUUID().slice(0, 8)
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const STAFF = `staff-${tag}`
  const OUTSIDER = `outsider-${tag}`
  const seeded: Record<'pat' | 'lee' | 'sam' | 'pct' | 'gone', string> = { pat: '', lee: '', sam: '', pct: '', gone: '' }
  const seededIds = () => Object.values(seeded)
  const previousFlag = process.env.UE_CANONICAL_BOOTSTRAP_V2
  let admin: pg.Client
  let pool: pg.Pool

  const scalar = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows[0] as Record<string, unknown>
  const audits = async (action: string, user: string) =>
    (await admin.query(`SELECT organization_id, user_id, details FROM public.audit_logs WHERE action = $1 AND user_id = $2`, [action, user])).rows as Array<{
      organization_id: string
      user_id: string
      details: Record<string, unknown>
    }>
  const readDirectory = (input: { search?: string; organizationId?: string }) =>
    inRole('union_eyes_system', {}, (tx) => modules!.directory.listPlatformUsers(tx as never, input))

  async function org(id: string, label: string) {
    await admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, `F03A ${label} ${tag}`, `f03a-${label.toLowerCase()}-${tag}`],
    )
  }
  async function member(organizationId: string, user: string, name: string, email: string, deleted = false) {
    const result = await admin.query(
      `INSERT INTO organization_members (user_id, organization_id, role, status, is_primary, name, email, joined_at, deleted_at, created_at, updated_at)
       VALUES ($1,$2,'member','active',false,$3,$4,now(), ${deleted ? 'now()' : 'NULL'}, now(), now()) RETURNING id`,
      [user, organizationId, name, email],
    )
    return result.rows[0].id as string
  }

  beforeAll(async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 4 })
    state.pool = pool
    state.platformAdmins.add(STAFF)

    await org(ORG_A, 'A')
    await org(ORG_B, 'B')
    seeded.pat = await member(ORG_A, `pat-${tag}`, 'Pat Morgan', `pat.morgan.${tag}@example.org`)
    seeded.lee = await member(ORG_A, `lee-${tag}`, 'Lee Tran', `lee.tran.${tag}@example.org`)
    seeded.sam = await member(ORG_B, `sam-${tag}`, 'Sam Rivera', `sam.rivera.${tag}@example.org`)
    seeded.pct = await member(ORG_B, `pct-${tag}`, 'Tax 100% Club', `pct.${tag}@example.org`)
    seeded.gone = await member(ORG_B, `gone-${tag}`, 'Gale Removed', `gale.removed.${tag}@example.org`, true)
    for (const [organizationId, status] of [[ORG_A, 'open'], [ORG_B, 'settled']]) {
      await admin.query(
        `INSERT INTO grievances (id, organization_id, created_at, updated_at, has_legal_implications, is_arbitration_eligible, is_confidential, is_group_grievance, priority, status)
         VALUES (gen_random_uuid(), $1, now(), now(), false, false, false, false, 'medium', $2)`,
        [organizationId, status],
      )
    }
    await admin.query(
      `INSERT INTO collective_agreements (id, created_at, updated_at, organization_id, cba_number, title, jurisdiction, employer_name, union_name, effective_date, expiry_date, industry_sector)
       VALUES (gen_random_uuid(), now(), now(), $1, $2, 'F03-A agreement', 'federal', 'Employer', 'Union', now(), now() + interval '1 year', 'public')`,
      [ORG_A, `F03A-${tag}`],
    )
    await admin.query(`CREATE OR REPLACE FUNCTION public.ue_f03a_audit_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN
        IF NEW.action = 'platform.f03a_fault.read' THEN RAISE EXCEPTION 'injected audit fault'; END IF; RETURN NEW; END $$`)
    await admin.query(`DROP TRIGGER IF EXISTS ue_f03a_audit_fault_trg ON public.audit_logs`)
    await admin.query(`CREATE TRIGGER ue_f03a_audit_fault_trg BEFORE INSERT ON public.audit_logs FOR EACH ROW EXECUTE FUNCTION public.ue_f03a_audit_fault()`)
  }, 120_000)

  afterAll(async () => {
    if (previousFlag === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    else process.env.UE_CANONICAL_BOOTSTRAP_V2 = previousFlag
    await admin?.query(`DROP TRIGGER IF EXISTS ue_f03a_audit_fault_trg ON public.audit_logs`).catch(() => undefined)
    await admin?.query(`DROP FUNCTION IF EXISTS public.ue_f03a_audit_fault()`).catch(() => undefined)
    await admin?.query(`DELETE FROM organization_members WHERE organization_id = ANY($1)`, [[ORG_A, ORG_B]]).catch(() => undefined)
    await admin?.query(`DELETE FROM grievances WHERE organization_id = ANY($1)`, [[ORG_A, ORG_B]]).catch(() => undefined)
    await admin?.query(`DELETE FROM collective_agreements WHERE organization_id = ANY($1)`, [[ORG_A, ORG_B]]).catch(() => undefined)
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  it('the system role holds the privileges these reads need on the real schema, and none on settlements', async () => {
    const can = async (table: string) => (await scalar(`SELECT has_table_privilege('union_eyes_system', $1, 'SELECT') AS ok`, [table])).ok
    for (const table of ['organizations', 'organization_members', 'grievances', 'collective_agreements']) expect(await can(table), table).toBe(true)
    expect(await can('settlements')).toBe(false)
  })

  it('platform statistics count every organization, match the superuser, carry no settlement or per-capita figure, and are recorded', async () => {
    const truth = {
      organizations: Number((await scalar(`SELECT count(*) AS n FROM organizations WHERE organization_type <> 'platform'`)).n),
      people: Number((await scalar(`SELECT count(DISTINCT user_id) AS n FROM organization_members WHERE deleted_at IS NULL`)).n),
      grievances: Number((await scalar(`SELECT count(*) AS n FROM grievances`)).n),
      agreements: Number((await scalar(`SELECT count(*) AS n FROM collective_agreements`)).n),
    }
    const stats = await modules!.stats.getPlatformStatsFromDb({ userId: STAFF, organizationId: ORG_A })

    expect(stats.totalOrganizations).toBe(truth.organizations)
    expect(stats.registeredUsers).toBe(truth.people)
    expect(stats.grievances.total).toBe(truth.grievances)
    expect(stats.collectiveAgreements.total).toBe(truth.agreements)
    expect(stats.totalOrganizations).toBeGreaterThanOrEqual(2)
    expect(stats.grievances.total).toBeGreaterThanOrEqual(2)
    expect(stats.collectiveAgreements.total).toBeGreaterThanOrEqual(1)
    expect(stats).not.toHaveProperty('settlements')
    for (const row of stats.organizations) expect(row).not.toHaveProperty('perCapitaRate')

    const recorded = await audits('platform_stats.read', STAFF)
    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({ organization_id: ORG_A, user_id: STAFF })
    expect(recorded[0].details).toMatchObject({ organizationsCounted: stats.totalOrganizations })
  })

  it('a tenant runtime session sees only its own organization, so a platform-wide figure cannot come out of one by accident', async () => {
    const rows = await inRole('union_eyes_runtime', { organizationId: ORG_A, userId: STAFF }, (tx) => modules!.directory.listPlatformUsers(tx as never, {}))
    expect(new Set(rows.map((row) => row.organizationId))).toEqual(new Set([ORG_A]))
    expect(rows.map((row) => row.id)).toEqual(expect.arrayContaining([seeded.pat, seeded.lee]))
    expect(rows.map((row) => row.id)).not.toContain(seeded.sam)
  })

  it('the directory gives a masked address, leaves out a removed member and narrows to one organization when asked', async () => {
    const everyone = (await readDirectory({})).filter((row) => seededIds().includes(row.id))
    expect(everyone.map((row) => row.id).sort()).toEqual([seeded.pat, seeded.lee, seeded.sam, seeded.pct].sort())
    expect(everyone.map((row) => row.id)).not.toContain(seeded.gone)
    for (const row of everyone) expect(row.email).toMatch(/^.\*\*\*@example\.org$/)
    expect(JSON.stringify(everyone.map((row) => row.email))).not.toContain(tag)

    const narrowed = await readDirectory({ organizationId: ORG_B })
    expect(narrowed.every((row) => row.organizationId === ORG_B)).toBe(true)
    expect(narrowed.map((row) => row.id)).toEqual(expect.arrayContaining([seeded.sam, seeded.pct]))
    expect(narrowed.map((row) => row.id)).not.toContain(seeded.pat)
  })

  it('takes the pattern characters of a search literally, so a wildcard cannot widen it', async () => {
    const percent = (await readDirectory({ search: '100%' })).filter((row) => seededIds().includes(row.id))
    expect(percent.map((row) => row.id)).toEqual([seeded.pct])
    expect(await readDirectory({ search: '___' })).toEqual([])
    expect((await readDirectory({ search: 'Morgan' })).map((row) => row.id)).toContain(seeded.pat)
  })

  it('the activity feed gives an abbreviated name and no address, and no removed member', async () => {
    const feed = await inRole('union_eyes_system', {}, (tx) => modules!.directory.recentMemberActivity(tx as never, 50))
    const mine = feed.filter((row) => seededIds().includes(row.id))
    expect(mine.map((row) => row.id).sort()).toEqual([seeded.pat, seeded.lee, seeded.sam, seeded.pct].sort())
    const text = JSON.stringify(mine)
    expect(text).not.toContain('@')
    expect(text).not.toContain('Morgan')
    expect(text).not.toContain('Removed')
    expect(text).toContain('Pat M.')
    expect(feed.length).toBeLessThanOrEqual(50)
  })

  it('the read and its audit record commit together, and the record holds the count and nothing about who was read', async () => {
    const rows = await modules!.read.performAtomicPlatformRead(
      { organizationId: ORG_A, userId: STAFF },
      {
        action: 'platform.user_directory.read',
        resourceType: 'organization_members',
        details: { searched: false, scopedToOrganization: false, limit: 100 },
        resultDetails: (value) => ({ returned: value.length }),
      },
      (tx) => modules!.directory.listPlatformUsers(tx, {}),
    )
    const recorded = await audits('platform.user_directory.read', STAFF)
    expect(recorded).toHaveLength(1)
    expect(recorded[0]).toMatchObject({ organization_id: ORG_A, user_id: STAFF })
    expect(recorded[0].details).toMatchObject({ returned: rows.length, searched: false })
    expect(JSON.stringify(recorded[0].details)).not.toMatch(/@|Morgan|Rivera|Tran/)
  })

  it('a read whose audit record cannot be written returns nothing', async () => {
    await expect(
      modules!.read.performAtomicPlatformRead(
        { organizationId: ORG_A, userId: STAFF },
        { action: 'platform.f03a_fault.read', resourceType: 'organization_members' },
        (tx) => modules!.directory.listPlatformUsers(tx, {}),
      ),
    ).rejects.toMatchObject({ status: 409 })
    expect(await audits('platform.f03a_fault.read', STAFF)).toHaveLength(0)
  })

  it('refuses a caller without platform-staff authority and records the refusal under their own organization', async () => {
    await expect(modules!.staff.requirePlatformStaffAuthority({ userId: OUTSIDER, organizationId: ORG_B }, 'platform.user_directory.read')).rejects.toMatchObject({ status: 403 })
    const denial = await audits('platform.user_directory.read.denied', OUTSIDER)
    expect(denial).toHaveLength(1)
    expect(denial[0]).toMatchObject({ organization_id: ORG_B, user_id: OUTSIDER })
    expect(denial[0].details).toMatchObject({ reason: 'no_platform_staff_authority' })

    await expect(modules!.staff.requirePlatformStaffAuthority({ userId: STAFF, organizationId: ORG_A }, 'platform.user_directory.read')).resolves.toEqual({ userId: STAFF, organizationId: ORG_A })
    expect(await audits('platform.user_directory.read.denied', STAFF)).toHaveLength(0)
  })
})
