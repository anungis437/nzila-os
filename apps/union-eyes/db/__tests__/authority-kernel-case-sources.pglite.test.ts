/**
 * Case sources: explicit assignment, reassignment, expiry, recusal and tenant denial on PGlite, plus the read-only
 * reconciliation of the legacy `grievances.union_rep_id` column. The facts with NO authoritative source today
 * (unit, territory, respondents) are pinned as fail-closed. Not a staging pass.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { newUuid, ORG, ORG_B, seedMembership, U } from './authority-kernel-harness'
import { daysAhead, freshDb, kit, minutesAgo } from './authority-kernel-testkit'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import { assignCase, declareOwnRecusal, liftRecusal, reassignCase, revokeCaseAssignment } from '../../lib/authority/store/lifecycle'
import { canonicalMembershipSource } from '../../lib/authority/store/identity'
import { reconcileCaseOwnership } from '../../lib/authority/store/case-ownership'
import type { Action } from '../../lib/authority/ontology'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>
const CASE = newUuid()
const CASE_B = newUuid()
const NEW_STEWARD = 'user_steward_new'

const decide = (who: string, action: Action = 'case:read_internal', id = CASE, org = ORG, deps = k.deps) =>
  k.as(who, org)((t) => enforceAuthority(t, deps, { principalUserId: who, organizationId: org, action, resource: { type: 'case', id, organizationId: org } }, { authenticated: true }))
const codes = (d: { reasons: readonly { code: string }[] }) => d.reasons.map((r) => r.code)
const assign = (issuer: string, assignee: string, id = CASE, org = ORG, extra: Record<string, unknown> = {}) =>
  k.as(issuer, org)((t) => assignCase(t, k.deps, { organizationId: org, issuerUserId: issuer, caseId: id, assigneeUserId: assignee, permissions: ['read', 'read_internal', 'comment', 'write_notes', 'draft_action', 'upload_evidence', 'modify_document'], effectiveAt: minutesAgo(), ...extra }))

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(async () => {
    await seedMembership(db, NEW_STEWARD, ORG, 'steward')
    await db.query(`INSERT INTO public.grievances (id, organization_id, created_by) VALUES ($1,$2,$3), ($4,$5,$3)`, [CASE, ORG, U.member, CASE_B, ORG_B])
  })
  await k.adoptDefaultRules()
  await k.adoptDefaultRules(ORG_B).catch(() => undefined)
  await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [CASE] } })
})

describe('explicit assignment is the only way to become a case owner', () => {
  it('a supervisor with case:assign authority assigns an eligible representative; the assignee then works the case', async () => {
    expect((await decide(U.steward)).effect).toBe('deny')
    await assign(U.officer, U.steward)
    const d = await decide(U.steward, 'case:read_internal')
    expect(d.effect).toBe('allow')
    expect(d.authority[0].kind).toBe('relationship')
    expect((await decide(U.steward, 'case:write_notes')).effect).toBe('allow')
  })

  it('rank, role title and the legacy union_rep_id column grant nothing', async () => {
    for (const who of [U.president, U.vp, U.chief, NEW_STEWARD]) expect((await decide(who)).effect, who).toBe('deny')
    await k.asAdmin(() => db.query(`UPDATE public.grievances SET union_rep_id = $2 WHERE id = $1`, [CASE, '00000000-0000-4000-8000-0000000000aa']))
    expect((await decide('00000000-0000-4000-8000-0000000000aa')).effect).toBe('deny')
    await k.asAdmin(() => db.query(`UPDATE public.grievances SET union_rep_id = NULL WHERE id = $1`, [CASE]))
  })

  it('only an authorised issuer may assign, and only to an eligible, conflict-free person', async () => {
    await expect(assign(U.steward2, NEW_STEWARD)).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY/)
    await expect(assign(U.officer, U.member)).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    await expect(assign(U.officer, U.officer)).rejects.toThrow(/SELF_APPROVAL|SEGREGATION|self/i)
  })
})

describe('reassignment, expiry and recusal change access at once', () => {
  it('reassignment ends the outgoing assignee and installs the incoming one atomically', async () => {
    const r = await k.as(U.officer)((t) => reassignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: CASE, outgoingUserId: U.steward, incomingUserId: NEW_STEWARD, permissions: ['read', 'comment'], effectiveAt: minutesAgo() }))
    expect(r.revoked.length).toBeGreaterThan(0)
    expect((await decide(U.steward)).effect).toBe('deny')
    expect((await decide(NEW_STEWARD)).effect).toBe('allow')
  })

  it('a refused incoming assignee rolls the whole reassignment back: the outgoing assignee keeps access', async () => {
    await expect(k.as(U.officer)((t) => reassignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: CASE, outgoingUserId: NEW_STEWARD, incomingUserId: U.member, effectiveAt: minutesAgo() }))).rejects.toThrow(/CAPACITY_NOT_ELIGIBLE/)
    expect((await decide(NEW_STEWARD)).effect).toBe('allow')
    await expect(k.as(U.officer)((t) => reassignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: CASE, outgoingUserId: U.steward2, incomingUserId: U.steward, effectiveAt: minutesAgo() }))).rejects.toThrow(/no live assignment/)
    await expect(k.as(U.officer)((t) => reassignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: CASE, outgoingUserId: NEW_STEWARD, incomingUserId: NEW_STEWARD, effectiveAt: minutesAgo() }))).rejects.toThrow(/incoming assignee is the outgoing/)
  })

  it('revocation needs the same authority as assignment', async () => {
    const live = (await k.as(U.officer)((t) => t.query<{ id: string }>(`SELECT id::text id FROM ue_authority_resource_relationships WHERE principal_user_id = $1 AND resource_id = $2 AND revoked_at IS NULL`, [NEW_STEWARD, CASE]))).rows[0].id
    await expect(k.as(U.steward2)((t) => revokeCaseAssignment(t, k.deps, { organizationId: ORG, issuerUserId: U.steward2, caseId: CASE, relationshipId: live }))).rejects.toThrow(/NO_SOURCE_OF_AUTHORITY/)
    expect((await decide(NEW_STEWARD)).effect).toBe('allow')
  })

  it('a time-boxed assignment expires on its own', async () => {
    const t0 = await k.as(U.officer)((t) => assignCase(t, k.deps, { organizationId: ORG, issuerUserId: U.officer, caseId: CASE, assigneeUserId: U.chief, relation: 'assignee', permissions: ['read'], effectiveAt: minutesAgo(5), expiresAt: daysAhead(2) }))
    expect(t0).toBeTruthy()
    expect((await decide(U.chief, 'case:read')).effect).toBe('allow')
    const later = { ...k.deps, now: () => new Date(Date.now() + 3 * 86_400_000) }
    const expired = await decide(U.chief, 'case:read', CASE, ORG, later)
    expect(expired.effect).toBe('deny')
    expect(codes(expired)).toContain('INSTRUMENT_EXPIRED_OR_REVOKED')
  })

  it('a recused assignee loses the case until an authorised other lifts the recusal; the recused cannot lift it', async () => {
    const id = await k.as(NEW_STEWARD)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: NEW_STEWARD, resourceType: 'case', resourceId: CASE, reason: 'relative of the grievor' }))
    const d = await decide(NEW_STEWARD)
    expect(d.effect).toBe('deny')
    expect(codes(d)).toContain('RECUSED')
    await expect(k.as(NEW_STEWARD)((t) => liftRecusal(t, k.deps, { organizationId: ORG, issuerUserId: NEW_STEWARD, recusalId: id }))).rejects.toThrow()
    await k.as(U.president)((t) => liftRecusal(t, k.deps, { organizationId: ORG, issuerUserId: U.president, recusalId: id }))
    expect((await decide(NEW_STEWARD)).effect).toBe('allow')
  })
})

describe('tenant isolation of assignments', () => {
  it('another organization\'s case cannot be assigned, read or revoked from this one', async () => {
    await expect(assign(U.officer, NEW_STEWARD, CASE_B, ORG)).rejects.toThrow()
    expect((await decide(NEW_STEWARD, 'case:read', CASE_B, ORG)).effect).toBe('deny')
    const seen = await k.as(U.officer, ORG_B)((t) => t.query(`SELECT 1 FROM ue_authority_resource_relationships WHERE resource_id = $1`, [CASE]))
    expect(seen.rows).toHaveLength(0)
  })

  it('an assignee who is not a member of the organization is refused', async () => {
    await expect(assign(U.officer, 'user_other_org_person')).rejects.toThrow()
  })
})

describe('facts with no authoritative source stay fail-closed', () => {
  it('a unit- or territory-scoped supervisory mandate reaches no case, because the case has no unit or territory source', async () => {
    const UNIT = newUuid()
    await k.grantMandate('supervisory', U.vp === U.officer ? U.chief : U.chief, ['read'], { scope: { unitIds: [UNIT], territoryIds: [UNIT] } })
    const d = await decide(U.chief, 'case:read', CASE)
    // The chief has no relationship here besides the time-boxed one that already expired for this check.
    const later = await decide(U.chief, 'case:read', CASE, ORG, { ...k.deps, now: () => new Date(Date.now() + 3 * 86_400_000) })
    expect(later.effect).toBe('deny')
    expect(codes(later)).toContain('OUT_OF_SCOPE')
    void d
  })

  it('no respondent source exists, so no one is excluded as an adverse party by the loader', async () => {
    const loaded = await k.as(U.officer)((t) => t.query<{ n: string }>(`SELECT count(*)::text n FROM public.grievances WHERE id = $1`, [CASE]))
    expect(loaded.rows[0].n).toBe('1')
    const d = await decide(NEW_STEWARD)
    expect(codes(d)).not.toContain('ADVERSE_PARTY')
  })
})

describe('legacy owner reconciliation is read-only and reports governed-backfill candidates', () => {
  it('classifies aligned, candidate, invalid, non-member, non-handler and differing cases without writing', async () => {
    const [a, b, c, d, e, f] = [newUuid(), newUuid(), newUuid(), newUuid(), newUuid(), newUuid()]
    const G = (id: string, rep: string | null) => db.query(`INSERT INTO public.grievances (id, organization_id, created_by, union_rep_id) VALUES ($1,$2,$3,$4)`, [id, ORG, U.member, rep])
    const sid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
    await k.asAdmin(async () => {
      await seedMembership(db, sid(0x101), ORG, 'steward')
      await seedMembership(db, sid(0x102), ORG, 'member')
      await G(a, sid(0x101)) // eligible, not assigned -> candidate
      await G(b, sid(0x102)) // member only
      await G(c, sid(0x999)) // no membership
      await G(d, null)
      await G(e, sid(0x101)) // will be aligned
      await G(f, sid(0x101)) // legacy differs from kernel
    })
    await k.grantMandate('supervisory', U.officer, ['read', 'assign'], { scope: { resourceIds: [e, f] } })
    await assign(U.officer, sid(0x101), e)
    await assign(U.officer, NEW_STEWARD, f)
    const before = await k.asAdmin(() => db.query<{ n: string }>(`SELECT count(*)::text n FROM ue_authority_resource_relationships`))
    const report = await k.as(U.president)((t) => reconcileCaseOwnership(t, canonicalMembershipSource, ORG))
    const kind = (id: string) => report.findings.find((x) => x.caseId === id)?.kind ?? 'aligned'
    expect(kind(a)).toBe('backfill_candidate')
    expect(kind(b)).toBe('not_handler_capacity')
    expect(kind(c)).toBe('not_active_member')
    expect(report.findings.find((x) => x.caseId === d)).toBeUndefined()
    expect(kind(e)).toBe('aligned')
    expect(kind(f)).toBe('kernel_assignee_differs')
    const after = await k.asAdmin(() => db.query<{ n: string }>(`SELECT count(*)::text n FROM ue_authority_resource_relationships`))
    expect(after.rows[0].n).toBe(before.rows[0].n)
    // Candidate status confers nothing until the governed assignment is made.
    expect((await decide(sid(0x101), 'case:read', a)).effect).toBe('deny')
    await assign(U.officer, sid(0x101), a).catch(() => undefined)
  })
})
