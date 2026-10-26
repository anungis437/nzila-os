/**
 * Member review intake on PGlite. Not a native PostgreSQL pass.
 * Oversight rows are returned only after review:monitor allows that review.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ORG, ORG_B, U, seedMembership } from './authority-kernel-harness'
import { freshDb, kit } from './authority-kernel-testkit'
import { declareOwnRecusal } from '../../lib/authority/store/lifecycle'
import { listMemberReviewIntake, openMemberReview } from '../../lib/authority/store/review-intake'
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
})
