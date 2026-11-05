/**
 * Member review intake on PGlite. Not a native PostgreSQL pass.
 * Oversight rows are returned only after review:monitor allows that review.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ORG, ORG_B, U, seedMembership } from './authority-kernel-harness'
import { freshDb, kit } from './authority-kernel-testkit'
import { declareOwnRecusal } from '../../lib/authority/store/lifecycle'
import { REVIEW_INTAKE_DAILY_LIMIT, listMemberReviewIntake, openMemberReview } from '../../lib/authority/store/review-intake'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.adoptDefaultRules(ORG, (domain, operation) => domain === 'governance_review' && operation === 'issue')
  await k.asAdmin(() => seedMembership(db, U.member, ORG_B, 'member'))
})

describe('member review intake', () => {
  it('records an active member’s complaint and shows it only to that member', async () => {
    const opened = await k.as(U.member)((t) => openMemberReview(t, k.deps, {
      organizationId: ORG, actorUserId: U.member, reviewType: 'complaint', adverseUserIds: [U.reviewer],
    }))
    expect(opened).toMatchObject({ reviewType: 'complaint', status: 'open', notificationDelivered: false, notificationPolicy: 'not_adopted' })
    const audit = await k.asAdmin(() => db.query<{ action: string }>(
      `SELECT action FROM public.audit_logs WHERE resource_id = $1 AND action = 'authority.review.open'`,
      [opened.id],
    ))
    expect(audit.rows).toHaveLength(1)

    const own = await k.as(U.member)((t) => listMemberReviewIntake(t, k.deps, { organizationId: ORG, actorUserId: U.member }))
    expect(own.notificationPolicy).toBe('not_adopted')
    expect(own.own.map((row) => row.id)).toContain(opened.id)
    expect(JSON.stringify(own.own)).not.toContain(U.reviewer)
    expect(own.oversight).toEqual([])

    const other = await k.as(U.member2)((t) => listMemberReviewIntake(t, k.deps, { organizationId: ORG, actorUserId: U.member2 }))
    expect(other.own.map((row) => row.id)).not.toContain(opened.id)
    expect(other.oversight).toEqual([])

    const foreign = await k.as(U.member, ORG_B)((t) => listMemberReviewIntake(t, k.deps, { organizationId: ORG_B, actorUserId: U.member }))
    expect(foreign.own.map((row) => row.id)).not.toContain(opened.id)
  })

  it('refuses a stranger, a self-named respondent and an unknown type before any write', async () => {
    const before = await k.asAdmin(() => db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ue_authority_reviews`))
    await expect(k.as(U.stranger)((t) => openMemberReview(t, k.deps, {
      organizationId: ORG, actorUserId: U.stranger, reviewType: 'complaint',
    }))).rejects.toMatchObject({ code: 'DENIED' })
    await expect(k.as(U.member)((t) => openMemberReview(t, k.deps, {
      organizationId: ORG, actorUserId: U.member, reviewType: 'complaint', adverseUserIds: [U.member],
    }))).rejects.toMatchObject({ code: 'INVALID_CONTEXT' })
    await expect(k.as(U.member)((t) => openMemberReview(t, k.deps, {
      organizationId: ORG, actorUserId: U.member, reviewType: 'finding',
    }))).rejects.toMatchObject({ code: 'INVALID_CONTEXT' })
    const after = await k.asAdmin(() => db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ue_authority_reviews`))
    expect(Number(after.rows[0].n)).toBe(Number(before.rows[0].n))
  })

  it('returns an oversight row only when review:monitor allows that review', async () => {
    const opened = await k.as(U.member2)((t) => openMemberReview(t, k.deps, {
      organizationId: ORG, actorUserId: U.member2, reviewType: 'appeal', adverseUserIds: [U.reviewer],
    }))
    const hidden = await k.as(U.auditor)((t) => listMemberReviewIntake(t, k.deps, { organizationId: ORG, actorUserId: U.auditor }))
    expect(hidden.oversight.map((row) => row.id)).not.toContain(opened.id)

    await k.grantMandate('governance_review', U.auditor, ['monitor'], { scope: { resourceIds: [opened.id] } })
    await k.grantMandate('governance_review', U.reviewer, ['monitor'], { scope: { resourceIds: [opened.id] } })

    const allowed = await k.as(U.auditor)((t) => listMemberReviewIntake(t, k.deps, { organizationId: ORG, actorUserId: U.auditor }))
    expect(allowed.oversight).toEqual([
      expect.objectContaining({ id: opened.id, reviewType: 'appeal', complainantUserId: U.member2, classification: 'standard' }),
    ])
    expect(JSON.stringify(allowed.oversight)).not.toContain(U.reviewer)

    const adverse = await k.as(U.reviewer)((t) => listMemberReviewIntake(t, k.deps, { organizationId: ORG, actorUserId: U.reviewer }))
    expect(adverse.oversight.map((row) => row.id)).not.toContain(opened.id)
    expect(adverse.own.map((row) => row.id)).not.toContain(opened.id)

    await k.as(U.auditor)((t) => declareOwnRecusal(t, {
      organizationId: ORG, principalUserId: U.auditor, resourceType: 'governance_review', resourceId: opened.id, reason: 'personal conflict',
    }))
    const recused = await k.as(U.auditor)((t) => listMemberReviewIntake(t, k.deps, { organizationId: ORG, actorUserId: U.auditor }))
    expect(recused.oversight.map((row) => row.id)).not.toContain(opened.id)
  })

  it('refuses an adverse party who is not a current member of the organization, without saying which identity failed', async () => {
    const before = await k.asAdmin(() => db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ue_authority_reviews`))
    for (const adverse of [[U.stranger], [U.reviewer, U.stranger]]) {
      await expect(k.as(U.member)((t) => openMemberReview(t, k.deps, {
        organizationId: ORG, actorUserId: U.member, reviewType: 'complaint', adverseUserIds: adverse,
      }))).rejects.toMatchObject({ code: 'INVALID_CONTEXT', message: expect.stringContaining('ADVERSE_NOT_A_MEMBER') })
    }
    const after = await k.asAdmin(() => db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ue_authority_reviews`))
    expect(Number(after.rows[0].n)).toBe(Number(before.rows[0].n))
  })

  it('returns the same open review for a repeat request, whatever order the adverse parties are named in, and writes one row', async () => {
    const input = { organizationId: ORG, actorUserId: U.member2, reviewType: 'reconsideration' }
    const first = await k.as(U.member2)((t) => openMemberReview(t, k.deps, { ...input, adverseUserIds: [U.reviewer, U.auditor] }))
    const again = await k.as(U.member2)((t) => openMemberReview(t, k.deps, { ...input, adverseUserIds: [U.auditor, U.reviewer] }))
    expect(first.created).toBe(true)
    expect(again).toMatchObject({ id: first.id, created: false })
    const rows = await k.asAdmin(() => db.query<{ n: number }>(`SELECT count(*)::int AS n FROM ue_authority_reviews WHERE opened_by = $1 AND review_type = 'reconsideration'`, [U.member2]))
    expect(Number(rows.rows[0].n)).toBe(1)
    const different = await k.as(U.member2)((t) => openMemberReview(t, k.deps, { ...input, adverseUserIds: [U.reviewer] }))
    expect(different.id).not.toBe(first.id)
  })

  it('stops one member at the daily intake limit and leaves other members unaffected', async () => {
    let refused: unknown
    for (let i = 0; i < REVIEW_INTAKE_DAILY_LIMIT + 2; i += 1) {
      // distinct adverse sets, otherwise the duplicate rule would return the first review each time
      const adverse = [`user_filler_${i}`]
      await k.asAdmin(() => seedMembership(db, adverse[0], ORG, 'member'))
      try {
        await k.as(U.clerk)((t) => openMemberReview(t, k.deps, { organizationId: ORG, actorUserId: U.clerk, reviewType: 'complaint', adverseUserIds: adverse }))
      } catch (error) {
        refused = error
        break
      }
    }
    expect(refused).toMatchObject({ code: 'PRECONDITION', message: expect.stringContaining('REVIEW_INTAKE_LIMIT') })
    const other = await k.as(U.auditor)((t) => openMemberReview(t, k.deps, { organizationId: ORG, actorUserId: U.auditor, reviewType: 'complaint' }))
    expect(other.created).toBe(true)
  })})
