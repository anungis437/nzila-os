/**
 * Review row visibility on PGlite (cache 0047). Not a native PostgreSQL pass: the native proof is
 * review-visibility.postgres.test.ts on PG15 and PG16.
 *
 * Every read here is raw SQL as the runtime role with NO application filter, so what comes back is what the database
 * shows and not what lib/authority/store/review-intake.ts chooses to select. The organization-only policy of 0020 alone
 * would return every review of the organization to every member; the control test below drops the new policy to prove that.
 */
import { beforeAll, describe, expect, it } from 'vitest'
import { ORG, ORG_B, REVIEW_VISIBILITY_RLS_SQL, U, newUuid, seedCast, seedMembership } from './authority-kernel-harness'
import { freshDb, kit } from './authority-kernel-testkit'
import { auditAuthorityMutation, reconcileAuthorityAudit } from '../../lib/authority/store/audit'
import { enforceAuthority } from '../../lib/authority/store/enforce'
import type { SqlExecutor } from '../../lib/authority/store/executor'
import { acceptInstrument, changeMandate, declareOwnRecusal, liftRecusal } from '../../lib/authority/store/lifecycle'
import { openMemberReview } from '../../lib/authority/store/review-intake'
import { registerReview } from '../../lib/authority/store/workflow'
import type { PGlite } from '@electric-sql/pglite'

let db: PGlite
let k: ReturnType<typeof kit>

const HOLDERS = {
  expiring: 'user_overseer_expiring',
  revoked: 'user_overseer_revoked',
  suspended: 'user_overseer_suspended',
  unaccepted: 'user_overseer_unaccepted',
  other: 'user_overseer_other_review',
  recused: 'user_overseer_recused',
  multi: 'user_overseer_two_reviews',
}

let R1: string // opened and filed by member; names reviewer as adverse
let R2: string // opened and filed by member2; names auditor as adverse
let R3: string // opened and filed by clerk; names nobody
let R4: string // privileged, opened by member2; names reviewer as adverse
let ROBO: string // opened by officer on behalf of steward
let RB: string // another organization

const col = async <T extends string>(user: string, sqlText: string, org = ORG, params: unknown[] = []): Promise<T[]> =>
  k.as(user, org)(async (t) => (await t.query<{ v: T }>(sqlText, params)).rows.map((row) => row.v))
// No WHERE clause on purpose: the database alone decides what the principal may see.
const reviews = (user: string, org = ORG) => col<string>(user, `SELECT id::text v FROM ue_authority_reviews ORDER BY id`, org)
const reviewEvents = (user: string, org = ORG) =>
  col<string>(user, `SELECT DISTINCT source_id::text v FROM ue_authority_events WHERE source_table = 'ue_authority_reviews' ORDER BY 1`, org)
const sorted = (...ids: string[]) => [...ids].sort()
const monitorDecision = (user: string, review: string) =>
  k.as(user)((t) => enforceAuthority(t, k.deps, { principalUserId: user, organizationId: ORG, action: 'review:monitor', resource: { type: 'governance_review', id: review, organizationId: ORG } }, { authenticated: true }))

beforeAll(async () => {
  db = await freshDb()
  k = kit(db)
  await k.asAdmin(async () => {
    await seedMembership(db, U.member, ORG_B, 'member')
    for (const holder of Object.values(HOLDERS)) await seedMembership(db, holder, ORG, 'member')
  })
  await k.adoptDefaultRules(
    ORG,
    (domain, operation) =>
      (domain === 'governance_review' && ['issue', 'revoke', 'suspend'].includes(operation)) ||
      (domain === 'supervisory' && operation === 'issue') ||
      (domain === 'recusal' && operation === 'lift'),
  )

  const open = (user: string, adverse: string[], org = ORG) =>
    k.as(user, org)((t) => openMemberReview(t, k.deps, { organizationId: org, actorUserId: user, reviewType: 'complaint', adverseUserIds: adverse })).then((r) => r.id)
  R1 = await open(U.member, [U.reviewer])
  R2 = await open(U.member2, [U.auditor])
  R3 = await open(U.clerk, [])
  R4 = await k.as(U.member2)((t) => registerReview(t, k.deps, { organizationId: ORG, openedBy: U.member2, complainantUserId: U.member2, reviewType: 'complaint', adverseUserIds: [U.reviewer], classification: 'privileged' }))
  ROBO = await k.as(U.officer)((t) => registerReview(t, k.deps, { organizationId: ORG, openedBy: U.officer, complainantUserId: U.steward, reviewType: 'complaint' }))
  RB = await open(U.member, [], ORG_B)
})

describe('what the organization-only policy would have shown (control)', () => {
  it('every member could read every review before 0047, and the new policy is what stops it', async () => {
    const total = Number((await k.asAdmin(() => db.query<{ n: number }>(`SELECT count(*)::int n FROM ue_authority_reviews WHERE organization_id = $1`, [ORG]))).rows[0].n)
    expect(total).toBe(5)
    await k.asAdmin(async () => {
      await db.exec('BEGIN')
      try {
        await db.exec('DROP POLICY ue_authority_reviews_visibility ON ue_authority_reviews')
        await db.exec('DROP POLICY ue_authority_events_review_visibility ON ue_authority_events')
        await db.exec('SET LOCAL ROLE union_eyes_runtime')
        await db.exec(`SELECT set_config('app.current_org_id', '${ORG}', true), set_config('app.current_user_id', '${U.stranger}', true)`)
        const open = await db.query<{ n: number }>(`SELECT count(*)::int n FROM ue_authority_reviews`)
        const history = await db.query<{ n: number }>(`SELECT count(*)::int n FROM ue_authority_events WHERE source_table = 'ue_authority_reviews'`)
        expect(open.rows[0].n).toBe(total)
        expect(history.rows[0].n).toBeGreaterThanOrEqual(total)
      } finally {
        await db.exec('ROLLBACK')
      }
    })
    expect(await reviews(U.stranger)).toEqual([])
  })
})

describe('participants', () => {
  it('a member sees only the reviews they opened or filed, however the register is queried', async () => {
    expect(await reviews(U.member)).toEqual([R1])
    expect(await reviews(U.member2)).toEqual(sorted(R2, R4))
    expect(await reviews(U.clerk)).toEqual([R3])
    expect(await reviews(U.stranger)).toEqual([])
    expect(await col(U.president, `SELECT count(*)::int v FROM ue_authority_reviews`)).toEqual([0])
    expect(await col(U.clerk, `SELECT id::text v FROM ue_authority_reviews WHERE id = $1`, ORG, [R1])).toEqual([])
    expect(await col(U.clerk, `SELECT count(*)::int v FROM ue_authority_reviews WHERE organization_id = $1`, ORG, [ORG])).toEqual([1])
  })

  it('an opener who filed on behalf of a complainant and that complainant both see it; nobody else does', async () => {
    expect(await reviews(U.officer)).toEqual([ROBO])
    expect(await reviews(U.steward)).toEqual([ROBO])
    expect(await reviews(U.steward2)).toEqual([])
  })

  it('no authenticated principal shows nothing, and neither does an empty principal', async () => {
    for (const principal of ['', ' ']) {
      await db.exec('BEGIN')
      try {
        await db.exec(`SELECT set_config('app.current_org_id', '${ORG}', true), set_config('app.current_user_id', '${principal}', true)`)
        expect((await db.query<{ n: number }>(`SELECT count(*)::int n FROM ue_authority_reviews`)).rows[0].n).toBe(0)
        expect((await db.query<{ n: number }>(`SELECT count(*)::int n FROM ue_authority_events WHERE source_table = 'ue_authority_reviews'`)).rows[0].n).toBe(0)
      } finally {
        await db.exec('ROLLBACK')
      }
    }
  })
})

describe('adverse parties', () => {
  it('a person named as adverse sees nothing of the review, even with a live mandate that names it', async () => {
    expect(await reviews(U.reviewer)).toEqual([])
    expect(await reviews(U.auditor)).toEqual([])
    await k.grantMandate('governance_review', U.reviewer, ['monitor', 'access_evidence'], { scope: { resourceIds: [R1, R4] } })
    expect(await reviews(U.reviewer)).toEqual([])
    expect(await col(U.reviewer, `SELECT id::text v FROM ue_authority_reviews WHERE id = ANY ($1::uuid[])`, ORG, [[R1, R4]])).toEqual([])
    expect(await reviewEvents(U.reviewer)).toEqual([])
  })

  it('the kernel reports such a review as not found, so a denial never confirms that someone is a respondent', async () => {
    const adverse = await monitorDecision(U.reviewer, R1)
    expect(adverse.effect).toBe('deny')
    expect(adverse.reasons.map((r) => r.code)).toEqual(['RESOURCE_FACTS_MISSING'])
    const stranger = await monitorDecision(U.stranger, R1)
    expect(stranger.reasons.map((r) => r.code)).toEqual(adverse.reasons.map((r) => r.code))
    const nonexistent = await monitorDecision(U.reviewer, newUuid())
    expect(nonexistent.reasons.map((r) => r.code)).toEqual(adverse.reasons.map((r) => r.code))
  })

  it('an adverse party cannot close, reassign or otherwise write to the review they cannot see', async () => {
    const touched = await k.as(U.reviewer)(async (t) => {
      const closed = await t.query(`UPDATE ue_authority_reviews SET status = 'closed', closed_at = now() WHERE id = $1 RETURNING id`, [R1])
      const owned = await t.query(`UPDATE ue_authority_reviews SET remediation_owner_user_id = $2 WHERE id = $1 RETURNING id`, [R1, U.reviewer])
      return closed.rows.length + owned.rows.length
    })
    expect(touched).toBe(0)
    const row = (await k.asAdmin(() => db.query<{ status: string; remediation_owner_user_id: string | null }>(`SELECT status, remediation_owner_user_id FROM ue_authority_reviews WHERE id = $1`, [R1]))).rows[0]
    expect(row).toEqual({ status: 'open', remediation_owner_user_id: null })
  })

  it('a review cannot be recorded with its own opener or complainant as an adverse party', async () => {
    const before = Number((await k.asAdmin(() => db.query<{ n: number }>(`SELECT count(*)::int n FROM ue_authority_reviews`))).rows[0].n)
    await expect(k.as(U.member)((t) => registerReview(t, k.deps, { organizationId: ORG, openedBy: U.member, complainantUserId: U.member, reviewType: 'complaint', adverseUserIds: [U.member] })))
      .rejects.toMatchObject({ code: 'INVALID_CONTEXT', message: expect.stringContaining('SELF_ADVERSE') })
    await expect(k.as(U.officer)((t) => registerReview(t, k.deps, { organizationId: ORG, openedBy: U.officer, complainantUserId: U.steward, reviewType: 'complaint', adverseUserIds: [U.steward] })))
      .rejects.toMatchObject({ code: 'INVALID_CONTEXT', message: expect.stringContaining('SELF_ADVERSE') })
    // Under the database alone: the opener could not read back the row they wrote, so the INSERT ... RETURNING is refused.
    await expect(k.as(U.member)((t) => t.query(
      `INSERT INTO ue_authority_reviews (organization_id, review_type, complainant_user_id, adverse_user_ids, opened_by) VALUES ($1::uuid,'complaint',$2::text,ARRAY[$2::text],$2::text) RETURNING id`,
      [ORG, U.member],
    ))).rejects.toThrow(/row-level security/)
    expect(Number((await k.asAdmin(() => db.query<{ n: number }>(`SELECT count(*)::int n FROM ue_authority_reviews`))).rows[0].n)).toBe(before)
  })
})

describe('overseers', () => {
  it('an overseer sees exactly the reviews a live mandate names, and the kernel agrees', async () => {
    expect(await reviews(HOLDERS.multi)).toEqual([])
    await k.grantMandate('governance_review', HOLDERS.multi, ['monitor'], { scope: { resourceIds: [R1, R3] } })
    expect(await reviews(HOLDERS.multi)).toEqual(sorted(R1, R3))
    expect((await monitorDecision(HOLDERS.multi, R1)).effect).toBe('allow')
    expect(await reviews(U.auditor)).toEqual([])
    await k.grantMandate('governance_review', U.auditor, ['monitor'], { scope: { resourceIds: [R1] } })
    expect(await reviews(U.auditor)).toEqual([R1])
    expect(await reviewEvents(U.auditor)).toEqual([R1])
  })

  it('a privileged review is visible to the same people and to nobody else', async () => {
    expect(await reviews(U.member2)).toContain(R4)
    expect(await reviews(HOLDERS.multi)).not.toContain(R4)
    await k.grantMandate('governance_review', HOLDERS.other, ['monitor', 'access_evidence'], { scope: { resourceIds: [R4] } })
    expect(await reviews(HOLDERS.other)).toEqual([R4])
    expect(await col(HOLDERS.other, `SELECT classification v FROM ue_authority_reviews`)).toEqual(['privileged'])
    // The kernel still withholds privileged evidence from every oversight mandate.
    const evidence = await k.as(HOLDERS.other)((t) => enforceAuthority(t, k.deps, { principalUserId: HOLDERS.other, organizationId: ORG, action: 'review:access_evidence', resource: { type: 'governance_review', id: R4, organizationId: ORG } }, { authenticated: true }))
    expect(evidence.effect).toBe('deny')
    expect(evidence.reasons.map((r) => r.code)).toContain('PRIVILEGED_MATTER')
  })

  it('an expired mandate shows nothing', async () => {
    await k.grantMandate('governance_review', HOLDERS.expiring, ['monitor'], { scope: { resourceIds: [R3] }, expiresAt: new Date(Date.now() + 5000) })
    expect(await reviews(HOLDERS.expiring)).toEqual([R3])
    await new Promise((resolve) => setTimeout(resolve, 5500))
    expect(await reviews(HOLDERS.expiring)).toEqual([])
    expect(await reviewEvents(HOLDERS.expiring)).toEqual([])
  }, 30_000)

  it('a revoked or suspended mandate shows nothing, and a resumed one shows the review again', async () => {
    const revoked = await k.grantMandate('governance_review', HOLDERS.revoked, ['monitor'], { scope: { resourceIds: [R2] } })
    expect(await reviews(HOLDERS.revoked)).toEqual([R2])
    await k.as(U.president)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, mandateId: revoked, change: 'revoke' }))
    expect(await reviews(HOLDERS.revoked)).toEqual([])

    const suspended = await k.grantMandate('governance_review', HOLDERS.suspended, ['monitor'], { scope: { resourceIds: [R2] } })
    expect(await reviews(HOLDERS.suspended)).toEqual([R2])
    await k.as(U.president)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, mandateId: suspended, change: 'suspend' }))
    expect(await reviews(HOLDERS.suspended)).toEqual([])
    await k.as(U.president)((t) => changeMandate(t, k.deps, { organizationId: ORG, issuerUserId: U.president, mandateId: suspended, change: 'resume' }))
    expect(await reviews(HOLDERS.suspended)).toEqual([R2])
  })

  it('a mandate the holder has not accepted shows nothing until they accept it', async () => {
    const mandate = await k.grantMandate('governance_review', HOLDERS.unaccepted, ['monitor'], { scope: { resourceIds: [R2] }, accept: false })
    const needsAcceptance = (await k.asAdmin(() => db.query<{ r: boolean }>(`SELECT requires_acceptance r FROM ue_authority_mandates WHERE id = $1`, [mandate]))).rows[0].r
    expect(needsAcceptance).toBe(true)
    expect(await reviews(HOLDERS.unaccepted)).toEqual([])
    await k.as(HOLDERS.unaccepted)((t) => acceptInstrument(t, { organizationId: ORG, instrumentType: 'mandate', instrumentId: mandate, holderUserId: HOLDERS.unaccepted }))
    expect(await reviews(HOLDERS.unaccepted)).toEqual([R2])
  })

  it('a mandate for a different kind of authority shows nothing, even when its scope lists a review', async () => {
    await k.grantMandate('supervisory', U.chief, ['read'], { scope: { resourceIds: [R1, R2, R3] } })
    expect(await reviews(U.chief)).toEqual([])
    expect(await reviews(HOLDERS.other)).toEqual([R4])
  })

  it('a recused overseer sees nothing until the recusal is lifted', async () => {
    await k.grantMandate('governance_review', HOLDERS.recused, ['monitor'], { scope: { resourceIds: [R3] } })
    expect(await reviews(HOLDERS.recused)).toEqual([R3])
    const recusal = await k.as(HOLDERS.recused)((t) => declareOwnRecusal(t, { organizationId: ORG, principalUserId: HOLDERS.recused, resourceType: 'governance_review', resourceId: R3, reason: 'personal conflict' }))
    // The clerk opened R3, not this overseer, so the recusal alone removes it.
    expect(await reviews(HOLDERS.recused)).toEqual([])
    await k.as(U.president)((t) => liftRecusal(t, k.deps, { organizationId: ORG, issuerUserId: U.president, recusalId: recusal }))
    expect(await reviews(HOLDERS.recused)).toEqual([R3])
  })

  it('an overseer can act on a review they can see, and the event of that act is theirs to read', async () => {
    const owner = U.steward2
    const updated = await k.as(HOLDERS.multi)(async (t) => {
      const result = await t.query<{ id: string }>(`UPDATE ue_authority_reviews SET remediation_owner_user_id = $2 WHERE id = $1 RETURNING id::text id`, [R1, owner])
      await auditAuthorityMutation(t, { organizationId: ORG, action: 'review.update.test', resourceType: 'ue_authority_reviews', resourceId: R1 })
      return result.rows.map((row) => row.id)
    })
    expect(updated).toEqual([R1])
    const blind = await k.as(U.clerk)(async (t) => (await t.query(`UPDATE ue_authority_reviews SET remediation_owner_user_id = $2 WHERE id = $1 RETURNING id`, [R1, U.clerk])).rows.length)
    expect(blind).toBe(0)
  })
})

describe('other organizations', () => {
  it('a principal reads only the reviews of the organization context, and a mandate elsewhere confers nothing here', async () => {
    expect(await reviews(U.member, ORG_B)).toEqual([RB])
    expect(await col(U.member, `SELECT id::text v FROM ue_authority_reviews WHERE organization_id = $1`, ORG_B, [ORG])).toEqual([])
    await k.asAdmin(() => seedCast(db, ORG_B))
    await k.adoptDefaultRules(ORG_B, (domain, operation) => domain === 'governance_review' && operation === 'issue')
    await k.grantMandate('governance_review', U.clerk, ['monitor'], { scope: { resourceIds: [R1, RB] } }, ORG_B)
    expect(await reviews(U.clerk, ORG_B)).toEqual([RB])
    expect(await reviews(U.clerk, ORG)).toEqual([R3])
    expect(await reviews(U.member, ORG)).toEqual([R1])
  })
})

describe('the event history', () => {
  it('an event of a review is visible exactly where the review is, and nowhere else', async () => {
    expect(await reviewEvents(U.member)).toEqual([R1])
    expect(await reviewEvents(U.member2)).toEqual(sorted(R2, R4))
    expect(await reviewEvents(U.clerk)).toEqual([R3])
    expect(await reviewEvents(U.stranger)).toEqual([])
    expect(await reviewEvents(U.reviewer)).toEqual([])
    expect(await col(U.clerk, `SELECT row_after ->> 'complainant_user_id' v FROM ue_authority_events WHERE source_table = 'ue_authority_reviews'`)).toEqual([U.clerk])
    expect(await col(U.clerk, `SELECT actor_user_id v FROM ue_authority_events WHERE source_id = $1`, ORG, [R1])).toEqual([])
  })

  it('events of every other authority relation stay organization-readable, as the kernel needs', async () => {
    const mandates = Number((await col(U.stranger, `SELECT count(*)::int v FROM ue_authority_events WHERE source_table = 'ue_authority_mandates'`))[0])
    expect(mandates).toBeGreaterThan(0)
  })

  it('the audit reconciliation, which must read every event, is clean for a role that is not narrowed', async () => {
    const result = await k.asAdmin(() => reconcileAuthorityAudit(db as unknown as SqlExecutor, ORG))
    expect(result).toEqual({ eventsWithoutAudit: [], auditRowsWithUnknownEvents: [], chainBreaks: [] })
  })
})

describe('the migration', () => {
  it('applies twice and rolls back to the organization-only policy', async () => {
    await k.asAdmin(async () => {
      const statements = REVIEW_VISIBILITY_RLS_SQL.split('--> statement-breakpoint')
      await db.exec('BEGIN')
      try {
        for (let pass = 0; pass < 2; pass += 1) for (const statement of statements) await db.exec(statement)
        const present = await db.query<{ n: number }>(`SELECT count(*)::int n FROM pg_policies WHERE policyname IN ('ue_authority_reviews_visibility', 'ue_authority_events_review_visibility')`)
        expect(present.rows[0].n).toBe(2)
        await db.exec('DROP POLICY ue_authority_events_review_visibility ON ue_authority_events; DROP POLICY ue_authority_reviews_visibility ON ue_authority_reviews;')
        const gone = await db.query<{ n: number }>(`SELECT count(*)::int n FROM pg_policies WHERE policyname IN ('ue_authority_reviews_visibility', 'ue_authority_events_review_visibility')`)
        expect(gone.rows[0].n).toBe(0)
      } finally {
        await db.exec('ROLLBACK')
      }
    })
    expect((await col(U.clerk, `SELECT count(*)::int v FROM pg_policies WHERE policyname = 'ue_authority_reviews_visibility'`))[0]).toBe(1)
  })
})
