/**
 * F03-A on real PostgreSQL: the CUPE pilot bootstrap and its origin ledger (platform 0058, RLS cache 0046).
 *
 * DEF-0B10-PIL-CUPE-BOOTSTRAP-RESET-DELETES-ALL-GRIEVANCES-MEMBERS-AND-CHECKLIST-ROWS-OF-THE-ORGANIZATION-AT-THE-FIXTURE-SLUG-WITH-NO-DEMO-MARKER.
 * The route and library run unmodified; only the context boundary is replaced, so each statement runs as the real role:
 * the platform phase as union_eyes_system, the tenant phase as union_eyes_runtime bound to the fixture organization, whose canonical membership
 * requirement (AuthOrgBindingError) is emulated from a membership set. This proves, on the combined Django + Drizzle schema, that
 *   - the migrations apply twice, roll back and re-apply, and the catalog contract's grants (nothing beyond them) are what the roles hold,
 *   - the system role creates the organization and its marker but cannot write a member or a grievance, so the seed is genuinely tenant-side,
 *   - every row the bootstrap creates is in the ledger, and a re-run creates nothing twice (the physical member table has no unique index),
 *   - a reset deletes exactly the ledger's rows, and is refused, with nothing deleted and the refusal recorded, when the organization holds a
 *     row the ledger does not name, an unmarked organization sits at the slug, or a fixture row is referenced by a record the bootstrap did not create,
 *   - a dry run rehearses the real statements and leaves nothing behind but its own record,
 *   - the ledger is organization-scoped: another organization's rows can be neither named nor deleted through it,
 *   - a failing step, or a failing audit write, leaves no partial seed, and concurrent bootstraps neither duplicate the organization nor its members.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const state = vi.hoisted(() => ({
  pool: null as unknown,
  platformAdmins: new Set<string>(),
  members: new Set<string>(),
  fixture: null as unknown,
}))

type Role = 'union_eyes_runtime' | 'union_eyes_system'
type Ctx = { organizationId?: string | null; userId?: string | null }

// One drizzle transaction as the real role. A drizzle transaction object, so that nested transactions become savepoints, and execute() returns
// rows the way the application's postgres-js driver does.
async function inRole<T>(role: Role, ctx: Ctx, work: (tx: unknown) => Promise<T>): Promise<T> {
  const client = await (state.pool as pg.Pool).connect()
  try {
    return await drizzle(client).transaction(async (tx) => {
      await tx.execute(sql.raw(`SET LOCAL ROLE ${role}`))
      await tx.execute(sql`SELECT set_config('app.current_org_id', ${ctx.organizationId ?? ''}, true), set_config('app.current_user_id', ${ctx.userId ?? ''}, true)`)
      const execute = tx.execute.bind(tx)
      ;(tx as unknown as { execute: unknown }).execute = async (query: never) => (await execute(query)).rows
      return work(tx)
    })
  } finally {
    client.release()
  }
}

vi.mock('@/lib/db/with-rls-context', async () => {
  const { AuthOrgBindingError } = await import('@nzila/platform-auth/org-binding')
  return {
    withSystemContext: (work: (tx: unknown) => Promise<unknown>) => inRole('union_eyes_system', {}, work),
    // The canonical binding refuses an actor without an active membership in the organization.
    withRLSContext: async (ctx: Ctx, work: (tx: unknown) => Promise<unknown>) => {
      if (!state.members.has(`${ctx.userId}:${ctx.organizationId}`)) throw new AuthOrgBindingError('MEMBERSHIP_REQUIRED')
      return inRole('union_eyes_runtime', ctx, work)
    },
  }
})
vi.mock('@/lib/api/framework', async () => {
  class ApiError extends Error {
    constructor(readonly status: number, message: string) {
      super(message)
    }
    static unauthorized = () => new ApiError(401, 'Authentication required')
    static forbidden = (message: string) => new ApiError(403, message)
    static badRequest = (message: string) => new ApiError(400, message)
    static conflict = (message: string) => new ApiError(409, message)
    static internal = (message: string) => new ApiError(500, message)
  }
  return {
    ApiError,
    RATE_LIMITS: { ORG_WRITE: 'ORG_WRITE' },
    z: (await import('zod')).z,
    withApi: (_config: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  }
})
vi.mock('@/lib/config/pilot-demo-runtime', () => ({ assertPilotDemoMutationRuntime: () => 'pilot' }))
vi.mock('@/lib/platform/platform-staff', () => ({
  requirePlatformStaffAuthority: async (actor: { userId: string }) => {
    if (!state.platformAdmins.has(actor.userId)) throw Object.assign(new Error('platform-staff authority required'), { status: 403 })
    return actor
  },
}))
vi.mock('@/lib/pilot/fixture-bootstrap', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/pilot/fixture-bootstrap')>()),
  loadCupeFixture: async () => state.fixture,
}))

const routes = URL ? await import('@/app/api/pilot/bootstrap/cupe/route') : null

type Fixture = {
  org: { name: string; slug: string }
  members: Array<{ id: string; first_name: string; last_name: string; email: string; role: string; member_number: string }>
  cases: Array<{ number: string; case_type: string; status: string; title: string; description: string; filed_by: string; filed_at: string }>
  worksites: Array<{ id: string }>
}
type Body = { reset?: boolean; confirmReset?: string; dryRun?: boolean }
type Reply = { status: number; error?: string; data?: Record<string, any> }

describe.skipIf(!URL)('the CUPE pilot bootstrap on the combined schema, as the real roles', () => {
  const STAFF = `staff-${randomUUID().slice(0, 8)}`
  const ACTOR_ORG = randomUUID()
  const orgs: string[] = []
  const previousFlag = process.env.UE_CANONICAL_BOOTSTRAP_V2
  let admin: pg.Client
  let pool: pg.Pool

  const q = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows as Array<Record<string, any>>
  const one = async (query: string, params: unknown[] = []) => (await q(query, params))[0]
  const count = async (query: string, params: unknown[] = []) => Number((await one(query, params)).n)

  function scenario() {
    const tag = randomUUID().slice(0, 8)
    const fixture: Fixture = {
      org: { name: `Fixture ${tag}`, slug: `fx-${tag}` },
      members: [1, 2, 3].map((i) => ({
        id: `fx-${tag}-m${i}`,
        first_name: `First${i}`,
        last_name: `Last${i}`,
        email: `m${i}.${tag}@example.org`,
        role: i === 1 ? 'admin' : 'member',
        member_number: `M-${tag}-${i}`,
      })),
      cases: [1, 2].map((i) => ({
        number: `FX-${tag}-${i}`,
        case_type: 'wage_dispute',
        status: 'filed',
        title: `Case ${i}`,
        description: 'Fixture case',
        filed_by: `fx-${tag}-m${i}`,
        filed_at: '2025-03-01T10:30:00Z',
      })),
      worksites: [{ id: 'w1' }],
    }
    state.fixture = fixture
    return { tag, fixture, slug: fixture.org.slug }
  }

  async function call(body: Body = {}, userId = STAFF): Promise<Reply> {
    try {
      const data = await (routes!.POST as unknown as (ctx: unknown) => Promise<Record<string, any>>)({
        body: { reset: false, dryRun: false, includeDemoScript: false, ...body },
        userId,
        organizationId: ACTOR_ORG,
      })
      return { status: 200, data }
    } catch (error) {
      const cause = (error as { cause?: Error }).cause
      return { status: (error as { status?: number }).status ?? 500, error: `${(error as Error).message}${cause ? ` <- ${cause.message}` : ''}` }
    }
  }

  const orgOf = async (slug: string) => (await one('SELECT id FROM organizations WHERE slug = $1', [slug]))?.id as string | undefined
  const join = (organizationId: string, userId = STAFF) => state.members.add(`${userId}:${organizationId}`)

  // The organization exists and the operator is a member: the state in which the tenant rows can be seeded.
  async function seededOrganization() {
    const s = scenario()
    const first = await call()
    const organizationId = (await orgOf(s.slug))!
    orgs.push(organizationId)
    join(organizationId)
    const second = await call()
    return { ...s, first, second, organizationId }
  }

  const memberIds = async (organizationId: string) => (await q('SELECT id FROM organization_members WHERE organization_id = $1 ORDER BY id', [organizationId])).map((r) => r.id as string)
  const grievanceIds = async (organizationId: string) => (await q('SELECT id FROM grievances WHERE organization_id = $1 ORDER BY id', [organizationId])).map((r) => r.id as string)
  const ledger = async (organizationId: string, type: string) =>
    (await q(`SELECT resource_id FROM pilot_fixture_rows WHERE organization_id = $1 AND resource_type = $2 ORDER BY resource_id`, [organizationId, type])).map((r) => r.resource_id as string)
  const audits = async (organizationId: string, action: string) =>
    q(`SELECT user_id, details FROM public.audit_logs WHERE organization_id = $1 AND action = $2 ORDER BY created_at`, [organizationId, action])
  const realMember = (organizationId: string, userId: string) =>
    admin.query(
      `INSERT INTO organization_members (user_id, organization_id, role, status, is_primary, name, email, joined_at, created_at, updated_at)
       VALUES ($1,$2,'member','active',false,'Real Person','real.person@example.org', now(), now(), now())`,
      [userId, organizationId],
    )
  const realGrievance = (organizationId: string, number: string) =>
    admin.query(
      `INSERT INTO grievances (id, organization_id, created_at, updated_at, has_legal_implications, is_arbitration_eligible, is_confidential, is_group_grievance, priority, status, grievance_number)
       VALUES (gen_random_uuid(), $1, now(), now(), false, false, false, false, 'medium', 'filed', $2) RETURNING id`,
      [organizationId, number],
    )
  const deniedAs = async (role: Role, statement: string) => {
    await admin.query('BEGIN')
    try {
      await admin.query(`SET LOCAL ROLE ${role}`)
      await admin.query(statement)
      return false
    } catch (error) {
      return /permission denied/i.test((error as Error).message)
    } finally {
      await admin.query('ROLLBACK')
    }
  }

  const sqlOf = (file: string) => readFileSync(resolve(__dirname, file), 'utf8').split('--> statement-breakpoint')
  const applyAll = async (file: string) => {
    for (const statement of sqlOf(file)) await admin.query(statement)
  }

  beforeAll(async () => {
    process.env.UE_CANONICAL_BOOTSTRAP_V2 = '1'
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    pool = new pg.Pool({ connectionString: URL, max: 6 })
    state.pool = pool
    state.platformAdmins.add(STAFF)

    await applyAll('../migrations-platform/0058_pilot_fixture_rows.sql')
    await applyAll('../migrations-cache/0046_pilot_fixture_rows_rls_closure.sql')
    // The grants are exactly what the catalog contract, generated from the manifest, derives for this table.
    const contract = JSON.parse(readFileSync(resolve(__dirname, '../../lib/operations/catalog-authority-contract.json'), 'utf8'))
    const entry = contract.payload.entries.find((e: { table: string }) => e.table === 'pilot_fixture_rows')
    await admin.query('REVOKE ALL ON public.pilot_fixture_rows FROM union_eyes_runtime, union_eyes_system')
    await admin.query(`GRANT ${entry.runtime.join(', ')} ON public.pilot_fixture_rows TO union_eyes_runtime`)
    await admin.query(`GRANT ${entry.system.join(', ')} ON public.pilot_fixture_rows TO union_eyes_system`)
    await admin.query(`CREATE OR REPLACE FUNCTION public.ue_f03a_bootstrap_fault() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'injected bootstrap fault'; END $$`)
  }, 180_000)

  afterAll(async () => {
    for (const trigger of ['events', 'audit']) {
      await admin?.query(`DROP TRIGGER IF EXISTS ue_f03a_bootstrap_fault_${trigger} ON ${trigger === 'events' ? 'public.pilot_events' : 'public.audit_logs'}`).catch(() => undefined)
    }
    await admin?.query('DROP FUNCTION IF EXISTS public.ue_f03a_bootstrap_fault()').catch(() => undefined)
    if (orgs.length) {
      const run = (statement: string) => admin.query(statement, [orgs]).catch(() => undefined)
      await run(`DELETE FROM grievance_timeline_events WHERE organization_id = ANY($1::uuid[])`)
      await run(`DELETE FROM grievance_timeline WHERE grievance_id IN (SELECT id FROM grievances WHERE organization_id = ANY($1::uuid[]))`)
      await run(`DELETE FROM grievances WHERE organization_id = ANY($1::uuid[])`)
      await run(`DELETE FROM organization_members WHERE organization_id = ANY($1::uuid[])`)
      await run(`DELETE FROM pilot_events WHERE organization_id = ANY($1::uuid[])`)
      await run(`DELETE FROM pilot_checklist_items WHERE organization_id = ANY($1::uuid[])`)
      await run(`DELETE FROM public.audit_logs WHERE organization_id = ANY($1::uuid[])`)
      await run(`DELETE FROM organizations WHERE id = ANY($1::uuid[])`)
    }
    if (previousFlag === undefined) delete process.env.UE_CANONICAL_BOOTSTRAP_V2
    else process.env.UE_CANONICAL_BOOTSTRAP_V2 = previousFlag
    await pool?.end().catch(() => undefined)
    await admin?.end().catch(() => undefined)
  })

  describe('migrations 0058 and 0046', () => {
    it('apply twice, roll back to nothing, and re-apply, all inside a transaction that is then discarded', async () => {
      await admin.query('BEGIN')
      try {
        await applyAll('../migrations-platform/0058_pilot_fixture_rows.sql')
        await applyAll('../migrations-cache/0046_pilot_fixture_rows_rls_closure.sql')
        for (const file of ['../migrations-cache/0046_pilot_fixture_rows_rls_closure.rollback.sql', '../migrations-platform/0058_pilot_fixture_rows.rollback.sql']) {
          for (const statement of sqlOf(file)) await admin.query(statement)
        }
        expect((await one(`SELECT to_regclass('public.pilot_fixture_rows') AS t`)).t).toBeNull()
        await applyAll('../migrations-platform/0058_pilot_fixture_rows.sql')
        await applyAll('../migrations-cache/0046_pilot_fixture_rows_rls_closure.sql')
        expect((await one(`SELECT to_regclass('public.pilot_fixture_rows') AS t`)).t).toBe('pilot_fixture_rows')
      } finally {
        await admin.query('ROLLBACK')
      }
      expect((await one(`SELECT to_regclass('public.pilot_fixture_rows') AS t`)).t).toBe('pilot_fixture_rows')
    })

    it('hold identifiers only, force row security, and install no update policy', async () => {
      expect((await q(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'pilot_fixture_rows' ORDER BY column_name`)).map((r) => r.column_name)).toEqual([
        'fixture_source', 'id', 'organization_id', 'resource_id', 'resource_type', 'seeded_at', 'seeded_by',
      ])
      expect((await one(`SELECT relforcerowsecurity AS forced FROM pg_class WHERE oid = 'public.pilot_fixture_rows'::regclass`)).forced).toBe(true)
      const policies = await q(`SELECT policyname, cmd, roles::text AS roles FROM pg_policies WHERE tablename = 'pilot_fixture_rows' ORDER BY policyname`)
      expect(policies.map((p) => `${p.policyname}:${p.cmd}`)).toEqual([
        'ue_org_isolation_delete:DELETE', 'ue_org_isolation_insert:INSERT', 'ue_org_isolation_select:SELECT', 'ue_system_full_access:ALL',
      ])
    })

    it('reject a resource type that is not a fixture row, and an organization marker that names another organization', async () => {
      const id = randomUUID()
      await admin.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,'ledger check',$2,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`, [id, `ledger-${id.slice(0, 8)}`])
      orgs.push(id)
      const insert = (type: string, resource: string) =>
        admin.query(`INSERT INTO pilot_fixture_rows (organization_id, fixture_source, resource_type, resource_id, seeded_by) VALUES ($1,'t',$2,$3,'u')`, [id, type, resource])

      await expect(insert('bogus', randomUUID())).rejects.toThrow(/pilot_fixture_rows_type_check/)
      await expect(insert('organization', randomUUID())).rejects.toThrow(/pilot_fixture_rows_organization_check/)
      await insert('organization', id)
      await expect(insert('organization', id)).rejects.toThrow(/pilot_fixture_rows_resource_uq/)
    })

    it('give each role exactly the privileges the catalog contract names', async () => {
      const probe = randomUUID()
      expect(await deniedAs('union_eyes_runtime', `UPDATE public.pilot_fixture_rows SET seeded_by = 'x' WHERE id = '${probe}'`)).toBe(true)
      expect(await deniedAs('union_eyes_system', `DELETE FROM public.pilot_fixture_rows WHERE id = '${probe}'`)).toBe(true)
      expect(await deniedAs('union_eyes_system', `UPDATE public.pilot_fixture_rows SET seeded_by = 'x' WHERE id = '${probe}'`)).toBe(true)
    })

    it('leave the system role unable to write a member or a grievance, so a seed cannot be a platform-role write', async () => {
      expect(await deniedAs('union_eyes_system', `INSERT INTO public.organization_members (id, user_id, organization_id, role, status, is_primary, created_at, updated_at) VALUES (gen_random_uuid(), 'x', gen_random_uuid(), 'member', 'active', false, now(), now())`)).toBe(true)
      expect(await deniedAs('union_eyes_system', `INSERT INTO public.grievances (id, created_at, updated_at) VALUES (gen_random_uuid(), now(), now())`)).toBe(true)
    })
  })

  describe('the first bootstrap', () => {
    it('creates the organization and its marker as the system role, and refuses to write tenant rows for an operator who is not a member of it', async () => {
      const s = scenario()

      const reply = await call()

      expect(reply.error ?? 'ok').toContain('active membership')
      expect(reply.status).toBe(403)
      const organizationId = (await orgOf(s.slug))!
      orgs.push(organizationId)
      expect(await ledger(organizationId, 'organization')).toEqual([organizationId])
      expect((await one('SELECT seeded_by, fixture_source FROM pilot_fixture_rows WHERE organization_id = $1', [organizationId]))).toEqual({ seeded_by: STAFF, fixture_source: 'api/pilot/bootstrap/cupe' })
      expect(await memberIds(organizationId)).toEqual([])
      expect(await grievanceIds(organizationId)).toEqual([])
      expect((await audits(organizationId, 'pilot.bootstrap.cupe.organization_created')).map((a) => a.user_id)).toEqual([STAFF])
      const denied = await audits(organizationId, 'pilot.bootstrap.cupe.denied')
      expect(denied).toHaveLength(1)
      expect(denied[0].details).toMatchObject({ reason: 'membership_required', runtimeMode: 'pilot' })
    })

    it('seeds as the runtime role once the operator holds a membership, and records every row it creates in the ledger', async () => {
      const { second, organizationId, fixture } = await seededOrganization()

      expect(second.status).toBe(200)
      expect(second.data).toMatchObject({ organizationCreated: false, seeded: { members: 3, cases: 2 }, alreadyPresent: { members: 0, cases: 0 }, removed: { members: 0, grievances: 0 } })
      const members = await memberIds(organizationId)
      const cases = await grievanceIds(organizationId)
      expect(members).toHaveLength(fixture.members.length)
      expect(cases).toHaveLength(fixture.cases.length)
      expect(await ledger(organizationId, 'organization_member')).toEqual(members)
      expect(await ledger(organizationId, 'grievance')).toEqual(cases)
      expect(await count(`SELECT count(*) AS n FROM pilot_checklist_items WHERE organization_id = $1 AND item_id = 'org-seeded' AND completed`, [organizationId])).toBe(1)
      expect(await count(`SELECT count(*) AS n FROM pilot_events WHERE organization_id = $1 AND event_type = 'feature_used'`, [organizationId])).toBe(1)
      const done = await audits(organizationId, 'pilot.bootstrap.cupe')
      expect(done).toHaveLength(1)
      expect(done[0].details).toMatchObject({ membersInserted: 3, casesInserted: 2, removed: { members: 0, grievances: 0 } })
    })

    it('creates the organization once and its members once when two bootstraps race', async () => {
      const s = scenario()
      const [a, b] = await Promise.all([call(), call()])
      expect([a.status, b.status]).toEqual([403, 403])
      const organizationId = (await orgOf(s.slug))!
      orgs.push(organizationId)
      expect(await count('SELECT count(*) AS n FROM organizations WHERE slug = $1', [s.slug])).toBe(1)
      expect(await count(`SELECT count(*) AS n FROM pilot_fixture_rows WHERE organization_id = $1 AND resource_type = 'organization'`, [organizationId])).toBe(1)

      join(organizationId)
      const replies = await Promise.all([call(), call()])

      expect(replies.map((r) => r.status)).toEqual([200, 200])
      expect(await count('SELECT count(*) AS n FROM organization_members WHERE organization_id = $1', [organizationId])).toBe(3)
      expect(await count('SELECT count(*) AS n FROM grievances WHERE organization_id = $1', [organizationId])).toBe(2)
      expect(replies.map((r) => r.data!.seeded.members).sort()).toEqual([0, 3])
    })

    it('does nothing twice: a re-run creates nothing and the ledger is unchanged', async () => {
      const { organizationId } = await seededOrganization()
      const before = { members: await memberIds(organizationId), ledger: await ledger(organizationId, 'organization_member') }

      const again = await call()

      expect(again.data).toMatchObject({ seeded: { members: 0, cases: 0 }, alreadyPresent: { members: 3, cases: 2 } })
      expect({ members: await memberIds(organizationId), ledger: await ledger(organizationId, 'organization_member') }).toEqual(before)
    })

    it('skips a case number another organization holds, without claiming it or touching that organization', async () => {
      const s = scenario()
      const other = randomUUID()
      await admin.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,'other',$2,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`, [other, `other-${s.tag}`])
      orgs.push(other)
      const theirs = (await realGrievance(other, s.fixture.cases[0].number)).rows[0].id as string
      await call()
      const organizationId = (await orgOf(s.slug))!
      orgs.push(organizationId)
      join(organizationId)

      const reply = await call()

      expect(reply.data).toMatchObject({ seeded: { members: 3, cases: 1 }, caseNumbersInUse: 1 })
      expect(await grievanceIds(other)).toEqual([theirs])
      expect(await ledger(organizationId, 'grievance')).toHaveLength(1)
      expect(await ledger(organizationId, 'grievance')).not.toContain(theirs)
    })
  })

  describe('a reset', () => {
    it('deletes exactly the rows the ledger names and re-seeds, leaving the checklist row and the marker alone', async () => {
      const { organizationId, slug } = await seededOrganization()
      const old = { members: await memberIds(organizationId), cases: await grievanceIds(organizationId) }
      const checklist = (await one(`SELECT id FROM pilot_checklist_items WHERE organization_id = $1 AND item_id = 'org-seeded'`, [organizationId])).id

      const reply = await call({ reset: true, confirmReset: slug })

      expect(reply.status).toBe(200)
      expect(reply.data).toMatchObject({ reset: true, removed: { members: 3, grievances: 2 }, seeded: { members: 3, cases: 2 }, clearedStale: { members: 0, grievances: 0 } })
      const fresh = { members: await memberIds(organizationId), cases: await grievanceIds(organizationId) }
      expect(fresh.members).toHaveLength(3)
      expect(fresh.members.some((id) => old.members.includes(id))).toBe(false)
      expect(fresh.cases.some((id) => old.cases.includes(id))).toBe(false)
      expect(await ledger(organizationId, 'organization_member')).toEqual(fresh.members)
      expect(await ledger(organizationId, 'grievance')).toEqual(fresh.cases)
      expect(await ledger(organizationId, 'organization')).toEqual([organizationId])
      expect((await one(`SELECT id FROM pilot_checklist_items WHERE organization_id = $1 AND item_id = 'org-seeded'`, [organizationId])).id).toBe(checklist)
    })

    it('clears a ledger entry whose row is already gone, and reports that it did', async () => {
      const { organizationId } = await seededOrganization()
      const [gone] = await memberIds(organizationId)
      await admin.query('DELETE FROM organization_members WHERE id = $1', [gone])

      const reply = await call({ reset: true, confirmReset: (state.fixture as Fixture).org.slug })

      expect(reply.data).toMatchObject({ removed: { members: 2, grievances: 2 }, clearedStale: { members: 1, grievances: 0 } })
      expect(await ledger(organizationId, 'organization_member')).not.toContain(gone)
    })

    it('is refused, with nothing deleted and the refusal recorded, when the organization holds a member the ledger does not name', async () => {
      const { organizationId, slug } = await seededOrganization()
      await realMember(organizationId, `real-${randomUUID().slice(0, 8)}`)
      const before = { members: await memberIds(organizationId), cases: await grievanceIds(organizationId), ledger: await ledger(organizationId, 'organization_member') }

      const reply = await call({ reset: true, confirmReset: slug })

      expect(reply.status).toBe(409)
      expect(reply.error).toMatch(/1 member rows and 0 grievance rows.*Nothing was changed/)
      expect({ members: await memberIds(organizationId), cases: await grievanceIds(organizationId), ledger: await ledger(organizationId, 'organization_member') }).toEqual(before)
      const denied = await audits(organizationId, 'pilot.bootstrap.cupe.denied')
      expect(denied.at(-1)?.details).toMatchObject({ reason: 'foreign_rows', foreign: { members: 1, grievances: 0 } })
    })

    it('is refused for a grievance the ledger does not name, and seeding without a reset is still allowed beside it', async () => {
      const { organizationId, slug, tag } = await seededOrganization()
      const real = (await realGrievance(organizationId, `REAL-${tag}`)).rows[0].id as string

      const refused = await call({ reset: true, confirmReset: slug })
      const seeded = await call()

      expect(refused.status).toBe(409)
      expect(refused.error).toMatch(/0 member rows and 1 grievance rows/)
      expect(seeded.status).toBe(200)
      expect(await grievanceIds(organizationId)).toContain(real)
      expect(await ledger(organizationId, 'grievance')).not.toContain(real)
    })

    it('never claims a row that was already there under a fixture identity, so a later reset refuses instead of deleting it', async () => {
      const s = scenario()
      await call()
      const organizationId = (await orgOf(s.slug))!
      orgs.push(organizationId)
      await realMember(organizationId, s.fixture.members[0].id)
      join(organizationId)

      const seeded = await call()
      const reset = await call({ reset: true, confirmReset: s.slug })

      expect(seeded.data).toMatchObject({ seeded: { members: 2, cases: 2 }, alreadyPresent: { members: 1, cases: 0 } })
      expect(await count(`SELECT count(*) AS n FROM organization_members WHERE organization_id = $1 AND user_id = $2`, [organizationId, s.fixture.members[0].id])).toBe(1)
      expect(reset.status).toBe(409)
      expect(await count(`SELECT count(*) AS n FROM organization_members WHERE organization_id = $1 AND name = 'Real Person'`, [organizationId])).toBe(1)
    })

    it('is refused, leaving every row in place, when a fixture grievance is referenced by a record the bootstrap did not create', async () => {
      const { organizationId, slug } = await seededOrganization()
      const [target] = await grievanceIds(organizationId)
      await admin.query(`INSERT INTO grievance_timeline (id, created_at, updated_at, grievance_id) VALUES (gen_random_uuid(), now(), now(), $1)`, [target])
      const before = { members: await memberIds(organizationId), cases: await grievanceIds(organizationId), ledger: await ledger(organizationId, 'grievance') }

      const reply = await call({ reset: true, confirmReset: slug })

      expect(reply.status).toBe(409)
      expect(reply.error).toContain('still referenced')
      expect({ members: await memberIds(organizationId), cases: await grievanceIds(organizationId), ledger: await ledger(organizationId, 'grievance') }).toEqual(before)
      const denied = await audits(organizationId, 'pilot.bootstrap.cupe.denied')
      expect(denied.at(-1)?.details).toMatchObject({ reason: 'dependent_rows' })
      expect(String((denied.at(-1)?.details as { constraint?: string }).constraint)).toContain('grievance_timeline')
    })

    it('takes a fixture case\'s own timeline events with it, because they are part of that case', async () => {
      const { organizationId, slug } = await seededOrganization()
      const [target] = await grievanceIds(organizationId)
      await admin.query(
        `INSERT INTO grievance_timeline_events (grievance_id, organization_id, event_type, event_date, content_hash) VALUES ($1,$2,'note', now(), repeat('a', 64))`,
        [target, organizationId],
      )

      const reply = await call({ reset: true, confirmReset: slug })

      expect(reply.status).toBe(200)
      expect(await count('SELECT count(*) AS n FROM grievance_timeline_events WHERE grievance_id = $1', [target])).toBe(0)
    })
  })

  describe('an organization the bootstrap did not create', () => {
    it('is refused even when its slug, its rows and a pilot event all look like a fixture, and nothing is written', async () => {
      const s = scenario()
      const organizationId = randomUUID()
      await admin.query(`INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,'Real union local',$2,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`, [organizationId, s.slug])
      orgs.push(organizationId)
      await realMember(organizationId, s.fixture.members[0].id)
      await admin.query(`INSERT INTO pilot_events (organization_id, user_id, session_id, event_type, metadata) VALUES ($1,'u',$2,'org_created','{"source":"api/pilot/bootstrap/cupe"}')`, [organizationId, `pilot-bootstrap:${organizationId}`])
      join(organizationId)

      const seed = await call()
      const reset = await call({ reset: true, confirmReset: s.slug })

      expect([seed.status, reset.status]).toEqual([409, 409])
      expect(seed.error).toContain('was not created by the pilot bootstrap')
      expect(await memberIds(organizationId)).toHaveLength(1)
      expect(await grievanceIds(organizationId)).toEqual([])
      expect(await ledger(organizationId, 'organization')).toEqual([])
      const denied = await audits(organizationId, 'pilot.bootstrap.cupe.denied')
      expect(denied.map((d) => (d.details as { reason: string }).reason)).toEqual(['not_a_fixture_organization', 'not_a_fixture_organization'])
    })
  })

  describe('a dry run', () => {
    it('rehearses the reset and the seed with the real statements, and leaves only its own record', async () => {
      const { organizationId, slug } = await seededOrganization()
      const snapshot = async () => ({
        members: await memberIds(organizationId),
        cases: await grievanceIds(organizationId),
        ledger: await ledger(organizationId, 'organization_member'),
        events: await count('SELECT count(*) AS n FROM pilot_events WHERE organization_id = $1', [organizationId]),
        checklist: await count('SELECT count(*) AS n FROM pilot_checklist_items WHERE organization_id = $1', [organizationId]),
      })
      const before = await snapshot()

      const reply = await call({ reset: true, dryRun: true })

      expect(reply.status).toBe(200)
      expect(reply.data).toMatchObject({ dryRun: true, removed: { members: 3, grievances: 2 }, seeded: { members: 3, cases: 2 } })
      expect(await snapshot()).toEqual(before)
      expect(await audits(organizationId, 'pilot.bootstrap.cupe.dry_run')).toHaveLength(1)
      expect(slug).toBeTruthy()
    })

    it('reports the refusal a real reset would meet, and records it', async () => {
      const { organizationId } = await seededOrganization()
      await realMember(organizationId, `real-${randomUUID().slice(0, 8)}`)

      const reply = await call({ reset: true, dryRun: true })

      expect(reply.status).toBe(409)
      expect((await audits(organizationId, 'pilot.bootstrap.cupe.denied')).at(-1)?.details).toMatchObject({ reason: 'foreign_rows' })
    })

    it('reports the dependent-record refusal a real reset would meet, although the physical foreign keys are only checked at commit', async () => {
      const { organizationId } = await seededOrganization()
      const [target] = await grievanceIds(organizationId)
      await admin.query(`INSERT INTO grievance_timeline (id, created_at, updated_at, grievance_id) VALUES (gen_random_uuid(), now(), now(), $1)`, [target])
      const before = { members: await memberIds(organizationId), cases: await grievanceIds(organizationId) }

      const reply = await call({ reset: true, dryRun: true })

      expect(reply.status).toBe(409)
      expect(reply.error).toContain('still referenced')
      expect({ members: await memberIds(organizationId), cases: await grievanceIds(organizationId) }).toEqual(before)
    })

    it('creates no organization when none exists', async () => {
      const s = scenario()

      const reply = await call({ dryRun: true })

      expect(reply.data).toMatchObject({ dryRun: true, wouldCreateOrganization: true, organizationId: null, planned: { members: 3, cases: 2 } })
      expect(await orgOf(s.slug)).toBeUndefined()
    })
  })

  describe('the ledger is organization-scoped', () => {
    it('cannot be written for another organization, and a poisoned entry naming another organization\'s member deletes nothing of theirs', async () => {
      const x = await seededOrganization()
      const y = await seededOrganization()
      const [theirs] = await memberIds(x.organizationId)

      const forged = await inRole('union_eyes_runtime', { organizationId: y.organizationId, userId: STAFF }, (tx) =>
        (tx as ReturnType<typeof drizzle>).execute(sql`INSERT INTO pilot_fixture_rows (organization_id, fixture_source, resource_type, resource_id, seeded_by)
          VALUES (${x.organizationId}, 'api/pilot/bootstrap/cupe', 'organization_member', ${randomUUID()}, 'attacker')`),
      ).then(() => 'inserted', (error: Error) => (/row-level security/i.test(error.message) || /row-level security/i.test(String((error as { cause?: Error }).cause?.message)) ? 'denied' : error.message))
      await inRole('union_eyes_runtime', { organizationId: y.organizationId, userId: STAFF }, (tx) =>
        (tx as ReturnType<typeof drizzle>).execute(sql`INSERT INTO pilot_fixture_rows (organization_id, fixture_source, resource_type, resource_id, seeded_by)
          VALUES (${y.organizationId}, 'api/pilot/bootstrap/cupe', 'organization_member', ${theirs}, 'attacker')`),
      )
      state.fixture = y.fixture

      const reset = await call({ reset: true, confirmReset: y.slug })

      expect(forged).toBe('denied')
      expect(reset.status).toBe(200)
      expect(reset.data).toMatchObject({ clearedStale: { members: 1, grievances: 0 } })
      expect(await memberIds(x.organizationId)).toContain(theirs)
      expect(await ledger(x.organizationId, 'organization_member')).toContain(theirs)
    })

    it('shows a runtime session only its own organization\'s ledger rows', async () => {
      const x = await seededOrganization()
      const y = await seededOrganization()

      const visible = await inRole('union_eyes_runtime', { organizationId: y.organizationId, userId: STAFF }, async (tx) =>
        (await (tx as ReturnType<typeof drizzle>).execute(sql`SELECT DISTINCT organization_id FROM pilot_fixture_rows`)) as unknown as Array<{ organization_id: string }>,
      )

      expect(visible.map((r) => r.organization_id)).toEqual([y.organizationId])
      expect(x.organizationId).not.toBe(y.organizationId)
    })
  })

  describe('atomicity', () => {
    it('leaves no partial seed when a step fails, and a retry then succeeds', async () => {
      const s = scenario()
      await call()
      const organizationId = (await orgOf(s.slug))!
      orgs.push(organizationId)
      join(organizationId)
      await admin.query(`CREATE TRIGGER ue_f03a_bootstrap_fault_events BEFORE INSERT ON public.pilot_events FOR EACH ROW WHEN (NEW.organization_id = '${organizationId}') EXECUTE FUNCTION public.ue_f03a_bootstrap_fault()`)

      const failed = await call()
      await admin.query('DROP TRIGGER ue_f03a_bootstrap_fault_events ON public.pilot_events')

      expect(failed.status).toBe(500)
      expect(await memberIds(organizationId)).toEqual([])
      expect(await grievanceIds(organizationId)).toEqual([])
      expect(await ledger(organizationId, 'organization_member')).toEqual([])
      expect(await count('SELECT count(*) AS n FROM pilot_checklist_items WHERE organization_id = $1', [organizationId])).toBe(0)
      expect((await call()).data).toMatchObject({ seeded: { members: 3, cases: 2 } })
    })

    it('leaves nothing behind when the audit record cannot be written, including a reset\'s deletions', async () => {
      const { organizationId, slug } = await seededOrganization()
      const before = { members: await memberIds(organizationId), cases: await grievanceIds(organizationId), ledger: await ledger(organizationId, 'grievance') }
      await admin.query(`CREATE TRIGGER ue_f03a_bootstrap_fault_audit BEFORE INSERT ON public.audit_logs FOR EACH ROW WHEN (NEW.action = 'pilot.bootstrap.cupe' AND NEW.organization_id = '${organizationId}') EXECUTE FUNCTION public.ue_f03a_bootstrap_fault()`)

      const failed = await call({ reset: true, confirmReset: slug })
      await admin.query('DROP TRIGGER ue_f03a_bootstrap_fault_audit ON public.audit_logs')

      expect(failed.status).toBe(500)
      expect({ members: await memberIds(organizationId), cases: await grievanceIds(organizationId), ledger: await ledger(organizationId, 'grievance') }).toEqual(before)
    })
  })

  it('refuses a caller without platform-staff authority before creating anything', async () => {
    const s = scenario()

    const reply = await call({}, `outsider-${s.tag}`)

    expect(reply.status).toBe(403)
    expect(await orgOf(s.slug)).toBeUndefined()
  })

  describe('the Django-managed tables the bootstrap writes', () => {
    it('hold their foreign keys deferred to commit, which is why the reset checks constraints immediately', async () => {
      const rows = await q(
        `SELECT conname, condeferrable, condeferred FROM pg_constraint WHERE contype = 'f' AND confrelid = 'public.grievances'::regclass AND conrelid = 'public.grievance_timeline'::regclass`,
      )

      expect(rows).toHaveLength(1)
      expect(rows[0]).toMatchObject({ condeferrable: true, condeferred: true })
    })

    it('accept an organization created through the Drizzle schema alone: the ORM supplies the defaults the physical table does not have', async () => {
      const { organizations } = await import('@/db/schema-organizations')
      const slug = `schema-${randomUUID().slice(0, 8)}`

      const [created] = await inRole('union_eyes_system', {}, async (tx) =>
        (tx as ReturnType<typeof drizzle>).insert(organizations).values({ name: 'Schema convergence check', slug, organizationType: 'local', hierarchyPath: [] }).returning({ id: organizations.id }),
      )
      orgs.push(created.id)

      expect(await one(`SELECT hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, remittance_day, created_at IS NOT NULL AS created, updated_at IS NOT NULL AS updated FROM organizations WHERE id = $1`, [created.id])).toEqual({
        hierarchy_level: 0,
        sectors: [],
        clc_affiliated: false,
        member_count: 0,
        active_member_count: 0,
        settings: {},
        features_enabled: [],
        status: 'active',
        remittance_day: 15,
        created: true,
        updated: true,
      })
    })
  })
})
