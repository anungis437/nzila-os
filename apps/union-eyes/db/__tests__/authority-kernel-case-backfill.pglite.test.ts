/**
 * Governed backfill of case ownership from the legacy `grievances.union_rep_id` column, on PGlite. The column is
 * never read as authority: the plan is approved by hash against a recorded decision, executed through the normal
 * assignment governance, and all-or-nothing. Not a staging pass.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, seedMembership, U } from './authority-kernel-harness'
import { freshDb, kit } from './authority-kernel-testkit'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import { canonicalMembershipSource } from '../../lib/authority/store/identity'
import { executeOwnershipBackfill, planOwnershipBackfill, hashBackfillCandidates } from '../../lib/authority/store/case-ownership-backfill'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>

const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const REP_A = sid(0x201)
const REP_B = sid(0x202)
const MEMBER_ONLY = sid(0x203)
const [CASE_A, CASE_B, CASE_C, CASE_D] = [newUuid(), newUuid(), newUuid(), newUuid()]
const effectiveAt = () => new Date(Date.now() - 60_000)

const G = (id: string, rep: string | null) =>
  db.query(`INSERT INTO public.grievances (id, organization_id, created_by, union_rep_id) VALUES ($1,$2,$3,$4)`, [id, ORG, U.member, rep])
const plan = () => k.as(U.president)((t) => planOwnershipBackfill(t, canonicalMembershipSource, ORG))
const run = (issuer: string, hash: string, reference = 'EXEC-2026-10 minute 14') =>
  k.as(issuer)((t) => executeOwnershipBackfill(t, k.deps, { organizationId: ORG, issuerUserId: issuer, approvedPlanHash: hash, decisionReference: reference, effectiveAt: effectiveAt() }))
const canRead = (who: string, id: string) =>
  k.as(who)((t) => enforceAuthority(t, k.deps, { principalUserId: who, organizationId: ORG, action: 'case:read_internal', resource: { type: 'case', id, organizationId: ORG } }, { authenticated: true })).then((d) => d.effect)
const liveAssignments = () =>
  k.asAdmin(() => db.query<{ n: string }>(`SELECT count(*)::text n FROM ue_authority_resource_relationships WHERE relation = 'assignee' AND revoked_at IS NULL`)).then((r) => Number(r.rows[0].n))

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(async () => {
    await seedMembership(db, REP_A, ORG, 'steward')
    await seedMembership(db, REP_B, ORG, 'steward')
    await seedMembership(db, MEMBER_ONLY, ORG, 'member')
    await G(CASE_A, REP_A)
    await G(CASE_B, REP_B)
    await G(CASE_C, MEMBER_ONLY) // not a representation capacity: deferred to a person
    await G(CASE_D, null)
  })
  await k.adoptDefaultRules()
  await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [CASE_A, CASE_B, CASE_C, CASE_D] } })
})

describe('plan', () => {
  it('lists only eligible legacy owners as candidates, defers the rest, and writes nothing', async () => {
    const before = await liveAssignments()
    const p = await plan()
    expect(p.candidates.map((c) => c.caseId).sort()).toEqual([CASE_A, CASE_B].sort())
    expect(p.deferred.map((f) => f.caseId)).toEqual([CASE_C])
    expect(p.truncated).toBe(false)
    expect(p.planHash).toBe(hashBackfillCandidates(ORG, p.candidates))
    expect(await liveAssignments()).toBe(before)
    expect(await canRead(REP_A, CASE_A)).toBe('deny')
  })

  it('hashes the candidate set independent of order and sensitive to every member', () => {
    const a = { caseId: CASE_A, assigneeUserId: REP_A }
    const b = { caseId: CASE_B, assigneeUserId: REP_B }
    expect(hashBackfillCandidates(ORG, [a, b])).toBe(hashBackfillCandidates(ORG, [b, a]))
    expect(hashBackfillCandidates(ORG, [a])).not.toBe(hashBackfillCandidates(ORG, [a, b]))
    expect(hashBackfillCandidates(ORG, [a, { ...b, assigneeUserId: REP_A }])).not.toBe(hashBackfillCandidates(ORG, [a, b]))
  })
})

describe('execution', () => {
  it('refuses a missing decision reference, a malformed hash and a stale approval, and writes nothing', async () => {
    const p = await plan()
    await expect(run(U.officer, p.planHash, '   ')).rejects.toThrow(/decision reference/)
    await expect(run(U.officer, 'abc')).rejects.toThrow(/plan hash/)
    await expect(run(U.officer, hashBackfillCandidates(ORG, []))).rejects.toThrow(/changed since it was approved/)
    expect(await liveAssignments()).toBe(0)
  })

  it('refuses an issuer without case:assign authority and rolls the whole backfill back', async () => {
    const p = await plan()
    await expect(run(U.steward2, p.planHash)).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY|DENIED|authority/i)
    expect(await liveAssignments()).toBe(0)
    expect(await canRead(REP_A, CASE_A)).toBe('deny')
  })

  it('a case that gains a kernel owner after approval invalidates the approval', async () => {
    const p = await plan()
    await k.asAdmin(() => db.query(`UPDATE public.grievances SET union_rep_id = $2 WHERE id = $1`, [CASE_B, MEMBER_ONLY]))
    await expect(run(U.officer, p.planHash)).rejects.toThrow(/changed since it was approved/)
    await k.asAdmin(() => db.query(`UPDATE public.grievances SET union_rep_id = $2 WHERE id = $1`, [CASE_B, REP_B]))
    expect(await liveAssignments()).toBe(0)
  })

  it('assigns the approved candidates through governed assignment and records the decision in the audit', async () => {
    const p = await plan()
    const r = await run(U.officer, p.planHash)
    expect(r.assigned.map((a) => a.caseId).sort()).toEqual([CASE_A, CASE_B].sort())
    expect(await canRead(REP_A, CASE_A)).toBe('allow')
    expect(await canRead(REP_B, CASE_B)).toBe('allow')
    expect(await canRead(REP_A, CASE_B)).toBe('deny')
    expect(await canRead(MEMBER_ONLY, CASE_C)).toBe('deny')
    const audit = await k.asAdmin(() => db.query<{ n: string }>(`SELECT count(*)::text n FROM public.audit_logs WHERE details::text LIKE '%EXEC-2026-10 minute 14%'`))
    expect(Number(audit.rows[0].n)).toBeGreaterThanOrEqual(1)
  })

  it('is idempotent: once aligned, the next plan has no candidates and executes nothing', async () => {
    const p = await plan()
    expect(p.candidates).toEqual([])
    const r = await run(U.officer, p.planHash)
    expect(r.assigned).toEqual([])
    expect(await liveAssignments()).toBe(2)
  })
})
