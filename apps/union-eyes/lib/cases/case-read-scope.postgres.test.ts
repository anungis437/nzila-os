/**
 * The case read scope against the COMBINED deployed schema, as the runtime role, with row-level security and the
 * grants the approved bootstrap activated. Seniority never confers a tenant-wide read; a live cases triage
 * designation exposes only unassigned cases of the caller's own organization.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable database prepared by Django
 * `migrate` and the approved Drizzle bootstrap (see thread-assignment.postgres.test.ts). Not a staging isolation pass.
 */
import { randomUUID } from 'node:crypto'
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { and, eq, inArray, sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { seedMembership, seedUser, type Db } from '../../db/__tests__/authority-kernel-harness'
import { claims } from '@/db/schema/claims-schema'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { grantDesignation, revokeDesignation } from '@/lib/triage/designations'
import { caseReadScope, type CaseActor } from './case-authorization'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const adapt = (c: pg.Client): Db => ({ exec: (s) => c.query(s), query: (s, p) => c.query(s, p as unknown[]) as never })

describe.skipIf(!URL)('case read scope on the combined deployed schema, as the runtime role', () => {
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const id = (name: string) => `${name}-${randomUUID().slice(0, 8)}`
  const U = { admin: id('cs-admin'), chief: id('cs-chief'), officer: id('cs-officer'), steward: id('cs-steward'), member: id('cs-member'), other: id('cs-other'), foreign: id('cs-foreign') }
  const CASES = { own: randomUUID(), assigned: randomUUID(), unassigned: randomUUID(), foreign: randomUUID() }
  let admin: pg.Client
  let runtime: pg.Client
  let rdb: ReturnType<typeof drizzle>

  const actor = (userId: string, role: CaseActor['role'], organizationId = ORG_A): CaseActor => ({ userId, organizationId, role })
  const inOrg = <T>(a: CaseActor, fn: (tx: RLSTx) => Promise<T>) =>
    rdb.transaction(async (t) => {
      await t.execute(sql`SELECT set_config('app.current_org_id', ${a.organizationId}, true), set_config('app.current_user_id', ${a.userId}, true)`)
      return fn(t as unknown as RLSTx)
    })
  const visible = (a: CaseActor) =>
    inOrg(a, async (tx) => {
      const rows = await tx.select({ id: claims.claimId }).from(claims).where(and(caseReadScope(a), inArray(claims.claimId, Object.values(CASES))))
      return Object.entries(CASES).filter(([, v]) => rows.some((r) => r.id === v)).map(([k]) => k).sort()
    })

  beforeAll(async () => {
    admin = new pg.Client({ connectionString: URL })
    await admin.connect()
    const d = adapt(admin)
    for (const [org, slug] of [[ORG_A, id('cs-a')], [ORG_B, id('cs-b')]]) {
      await admin.query(
        `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
         VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
        [org, slug, slug],
      )
    }
    for (const user of Object.values(U)) await seedUser(d, user)
    for (const [user, role] of [[U.admin, 'admin'], [U.chief, 'chief_steward'], [U.officer, 'officer'], [U.steward, 'steward'], [U.member, 'member'], [U.other, 'member']] as const) await seedMembership(d, user, ORG_A, role)
    await seedMembership(d, U.foreign, ORG_B, 'steward')
    const rows: Array<[keyof typeof CASES, string, string, string | null]> = [
      ['own', ORG_A, U.member, null],
      ['assigned', ORG_A, U.other, U.steward],
      ['unassigned', ORG_A, U.other, null],
      ['foreign', ORG_B, U.foreign, null],
    ]
    for (const [name, org, member, assignee] of rows) {
      await admin.query(
        `INSERT INTO claims(id, claim_id, claim_number, created_at, updated_at, organization_id, member_id, assigned_to, is_anonymous, previously_reported, witnesses_present, priority, progress, status)
         VALUES ($1,$2,$3,now(),now(),$4,$5,$6,false,false,false,'medium',0,'submitted')`,
        [randomUUID(), CASES[name], `CS-${name}-${CASES[name].slice(0, 6)}`, org, member, assignee],
      )
    }
    runtime = new pg.Client({ connectionString: URL })
    await runtime.connect()
    await runtime.query('SET ROLE union_eyes_runtime')
    rdb = drizzle(runtime)
  }, 120_000)

  afterAll(async () => {
    await runtime?.end()
    await admin?.end()
  })

  it('shows a member their own case and a steward only the cases assigned to them', async () => {
    expect(await visible(actor(U.member, 'member'))).toEqual(['own'])
    expect(await visible(actor(U.steward, 'steward'))).toEqual(['assigned'])
  })

  it('gives no tenant-wide read to chief steward, officer or admin, and no cross-tenant read to anyone', async () => {
    for (const [user, role] of [[U.chief, 'chief_steward'], [U.officer, 'officer'], [U.admin, 'admin']] as const) {
      expect(await visible(actor(user, role)), role).toEqual([])
    }
    // Another tenant's staff member sees their own organization's case (they filed it) and nothing of this tenant.
    expect(await visible(actor(U.foreign, 'steward', ORG_B))).toEqual(['foreign'])
    expect(await visible(actor(U.foreign, 'steward', ORG_A))).toEqual([])
  })

  it('exposes only unassigned cases to a live cases designation, and stops when it is revoked', async () => {
    const granted = await inOrg(actor(U.admin, 'admin'), (tx) =>
      grantDesignation(tx, actor(U.admin, 'admin'), { scope: 'cases', userId: U.chief, expiresAt: new Date(Date.now() + 30 * 86_400_000) }, { assigneeEligible: async () => true }),
    )
    expect(granted.kind).toBe('ok')
    expect(await visible(actor(U.chief, 'chief_steward'))).toEqual(['own', 'unassigned'])
    // A designation for another scope, or held in another organization, grants nothing.
    expect(await visible(actor(U.chief, 'chief_steward', ORG_B))).toEqual([])
    const live = (await admin.query(`SELECT id FROM triage_designations WHERE organization_id=$1 AND scope='cases' AND user_id=$2 AND revoked_at IS NULL`, [ORG_A, U.chief])).rows[0].id
    expect(await inOrg(actor(U.admin, 'admin'), (tx) => revokeDesignation(tx, actor(U.admin, 'admin'), live))).toEqual({ kind: 'ok' })
    expect(await visible(actor(U.chief, 'chief_steward'))).toEqual([])
    expect(await inOrg(actor(U.admin, 'admin'), (tx) => tx.select({ n: sql<number>`1` }).from(claims).where(eq(claims.claimId, CASES.foreign)))).toEqual([])
  })
})
