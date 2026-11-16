/** Opt-in proof on an EMPTY disposable local PostgreSQL. Never accepts a shared or remote database. */
import pg from 'pg'
import { drizzle } from 'drizzle-orm/node-postgres'
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { installAuthoritySchema, newUuid, ORG, seedCast, seedMembership, U, type Db } from '@/db/__tests__/authority-kernel-harness'
import { kit } from '@/db/__tests__/authority-kernel-testkit'
import type { RLSTx } from '@/lib/db/with-rls-context'
import { automaticallyAssignRepresentative } from '@/lib/cases/automatic-assignment'
import { assignPrimaryRepresentative } from '@/lib/services/case-access-service'
import { requireKernelCaseAction } from '@/lib/cases/case-authorization'

const enabled = process.env.UE_ASSIGNMENT_NATIVE === '1'
describe.skipIf(!enabled)('automatic assignment concurrency on native PostgreSQL', () => {
  let owner: pg.Client
  let peerA: pg.Client
  let peerB: pg.Client
  let k: ReturnType<typeof kit>
  let people: string[]
  let cases: string[]
  const actor = { userId: U.officer, organizationId: ORG }
  beforeAll(async () => {
    const raw = process.env.UE_ASSIGNMENT_OWNER_URL
    if (!raw || !['127.0.0.1','localhost'].includes(new URL(raw).hostname)) throw new Error('A disposable local owner URL is required')
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '0')
    owner = new pg.Client({ connectionString: raw }); await owner.connect()
    const fixture: Db = { exec: text => owner.query(text), query: (text, params) => owner.query(text, params) }
    await installAuthoritySchema(fixture); await seedCast(fixture)
    await owner.query(`CREATE TABLE public.organization_members(organization_id uuid,user_id text,role text,status text DEFAULT 'active',deleted_at timestamptz);
      GRANT SELECT ON public.organization_members TO union_eyes_runtime;
      GRANT UPDATE ON public.claims TO union_eyes_runtime;
      SELECT ue_create_direct_org_rls_policy('organization_members'); SET ROLE union_eyes_runtime;`)
    k = kit(fixture)
    await k.adoptDefaultRules(ORG, (domain, operation) => ['case_assignment','supervisory'].includes(domain) && ['issue','revoke'].includes(operation))
    peerA = new pg.Client({ connectionString: raw }); peerB = new pg.Client({ connectionString: raw })
    await peerA.connect(); await peerB.connect()
    await peerA.query('SET ROLE union_eyes_runtime'); await peerB.query('SET ROLE union_eyes_runtime')
  })
  beforeEach(async () => {
    people = [newUuid(), newUuid()].sort(); cases = [newUuid(), newUuid()]
    await k.asAdmin(async () => {
      await owner.query('UPDATE stewards SET active=false')
      const fixture: Db = { exec: text => owner.query(text), query: (text, params) => owner.query(text, params) }
      for (const id of people) {
        await seedMembership(fixture, id, ORG, 'steward')
        await owner.query("INSERT INTO organization_members(organization_id,user_id,role) VALUES($1,$2,'steward')", [ORG,id])
        await owner.query("INSERT INTO stewards(org_id,user_id,specialization,max_caseload,current_caseload) VALUES($1,$2,'safety',1,999)", [ORG,id])
      }
      for (const id of cases) await owner.query("INSERT INTO claims(claim_id,organization_id,member_id,claim_type) VALUES($1,$2,$3,'workplace_safety')", [id,ORG,U.member])
    })
    await k.grantMandate('supervisory', U.officer, ['read','assign'], { scope: { resourceIds: cases } })
  })
  afterAll(async () => {
    await Promise.allSettled([peerA?.end(),peerB?.end(),owner?.end()]); vi.unstubAllEnvs()
  })
  const assign = async (peer: pg.Client, caseId: string, hold?: () => Promise<void>, manual = false) => drizzle(peer).transaction(async raw => {
    const tx = raw as unknown as RLSTx
    await peer.query("SELECT set_config('app.current_org_id',$1,true),set_config('app.current_user_id',$2,true)", [ORG,U.officer])
    await peer.query('SELECT claim_id FROM claims WHERE claim_id=$1 FOR UPDATE', [caseId])
    await requireKernelCaseAction(tx, actor, caseId, 'case:assign')
    const result = manual
      ? await assignPrimaryRepresentative(tx, { ...actor, grievanceId: caseId, issuerUserId: actor.userId, assigneeUserId: people[0]! })
      : await automaticallyAssignRepresentative(tx, actor, caseId, 'workplace_safety')
    if (hold) await hold()
    return result
  })
  async function contend(manual: boolean, singleProfile: boolean) {
    if (singleProfile) await k.asAdmin(() => owner.query('UPDATE stewards SET active=false WHERE user_id=$1::uuid', [people[1]]))
    // Read the backend pid before the connection enters the blocked statement.
    const pid = (await peerB.query('SELECT pg_backend_pid() AS pid')).rows[0].pid
    let held!: () => void; let release!: () => void
    const entered = new Promise<void>(resolve => { held = resolve })
    const resumed = new Promise<void>(resolve => { release = resolve })
    const first = assign(peerA, cases[0]!, async () => { held(); await resumed })
    await Promise.race([entered, first.then(() => undefined)])
    const second = assign(peerB, cases[1]!, undefined, manual).then(value => ({ value, error: null }), error => ({ value: null, error }))
    try {
      const end = Date.now() + 10_000
      let observed = false
      while (Date.now() < end) {
        const wait = await k.asAdmin(() => owner.query('SELECT wait_event FROM pg_stat_activity WHERE pid=$1', [pid]))
        if (wait.rows[0]?.wait_event === 'advisory') { observed = true; break }
        await new Promise(resolve => setTimeout(resolve, 20))
      }
      expect(observed).toBe(true)
    } finally { release() }
    await first
    const result = await second
    const { rows } = await k.asAdmin(() => owner.query(`SELECT principal_user_id,count(*)::int AS n FROM ue_authority_resource_relationships
      WHERE resource_id=ANY($1::uuid[]) AND relation='assignee' AND revoked_at IS NULL GROUP BY principal_user_id`, [cases]))
    return { result, rows }
  }
  it('serializes two automatic requests for the last available capacity without overbooking', async () => {
    const { result, rows } = await contend(false, true)
    expect(result.error).toMatchObject({ code: 'NO_ELIGIBLE_MATCH' })
    expect(rows).toEqual([{ principal_user_id: people[0], n: 1 }])
  })
  it('balances simultaneous requests over separate available representatives after re-reading committed workload', async () => {
    const { result, rows } = await contend(false, false)
    expect(result.error).toBeNull()
    expect(rows.sort((a,b) => a.principal_user_id.localeCompare(b.principal_user_id))).toEqual(people.map(id => ({ principal_user_id: id, n: 1 })))
  })
  it('manual assignment shares the capacity lock with automatic assignment', async () => {
    const { result, rows } = await contend(true, true)
    expect(result.error).toMatchObject({ code: 'PRECONDITION' })
    expect(rows).toEqual([{ principal_user_id: people[0], n: 1 }])
  })
})
