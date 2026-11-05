/**
 * The recognition & rewards server actions and the member rewards pages' reads on real PostgreSQL, as the real roles.
 *
 * Every rewards service reads and writes through the module-level handle; the actions called them with no organization set, so on the runtime role
 * every program, award, budget and wallet read came back empty and every write was refused by row-level security. This runs the unmodified
 * actions and services (the services open their own transactions inside the action's context, which are savepoints there) with only the request
 * boundary replaced (the signed-in user, the membership lookup, the audit sink) and proves that
 *   - each member and administrator read returns the organization's own data and none of another organization's, and the same selects with
 *     no organization set show nothing;
 *   - a write is stored in the organization of the signed-in user whatever the form says, refers only to that organization's programs,
 *     awards and members, and commits or fails together with its audit;
 *   - a member can cancel only their own redemption; an issuance is audited as the administrator who made it;
 *   - the wallet page and the recognition page read the same figures and people.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertMember, insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL
const who = vi.hoisted(() => ({ userId: null as string | null, organizationOf: new Map<string, string>() }))
// The store is an external service, so it is the one thing replaced besides the request boundary.
const shopify = vi.hoisted(() => ({ fail: false, discountCodes: [] as string[] }))

vi.mock('@/lib/services/rewards/shopify-service', () => ({
  createDiscountCode: async () => {
    if (shopify.fail) throw new Error('shopify down')
    shopify.discountCodes.push('DISC')
    return { code: 'DISC' }
  },
  createCheckoutSession: async (code: string) => ({ checkoutUrl: `https://shop.example/cart?discount=${code}` }),
  isStoreCheckoutUrl: (candidate: string) => candidate.startsWith('https://shop.example/'),
}))

vi.mock('@/db/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-savepoint-harness')).contextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-savepoint-harness')).recordAudit }))
vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: async () => ({ userId: who.userId }) }))
vi.mock('@/lib/organization-utils', () => ({
  getOrganizationIdForUser: async (userId: string) => {
    const organizationId = who.organizationOf.get(userId)
    // The real resolver fails closed with an error of this shape (OrgContextRequiredError), whose message is written for the log.
    if (!organizationId) {
      throw Object.assign(new Error(`No verified organization membership for user ${userId}. Refusing silent Default Organization fallback (BR-6).`), {
        code: 'ORG_CONTEXT_REQUIRED',
        name: 'OrgContextRequiredError',
      })
    }
    return organizationId
  },
}))
vi.mock('next/cache', () => ({ revalidatePath: vi.fn() }))

const { savepointHarness, ambientDb, RUNTIME_ROLE } = await import('./native-savepoint-harness')
const actions = URL ? await import('@/actions/rewards-actions') : null
const pageReads = URL ? await import('@/lib/rewards/page-reads') : null
const schema = URL ? await import('@/db/schema') : null
const awardService = URL ? await import('@/lib/services/rewards/award-service') : null

type Outcome = { success: boolean; error?: string; data?: unknown }

describe.skipIf(!URL)('the rewards actions and page reads on the combined schema, as the real roles', () => {
  const tag = `rw${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const user = (name: string) => `u-${name}-${tag}`
  const U = {
    adminA: user('adminA'),
    memberA1: user('memberA1'),
    memberA2: user('memberA2'),
    formerA: user('formerA'),
    removedA: user('removedA'),
    strangerA: user('strangerA'),
    adminB: user('adminB'),
    memberB1: user('memberB1'),
  }
  let admin: pg.Client
  const ids = { programA: '', programB: '', typePeerA: '', typeAdminA: '', typeB: '', envelopeA: '', awardPendingB: '', awardIssuedA1: '' }

  const as = <T>(userId: string | null, run: () => Promise<T>): Promise<T> => {
    who.userId = userId
    return run()
  }
  const one = async <T>(query: string, params: unknown[] = []) => (await admin.query(query, params)).rows[0] as T
  const count = async (query: string, params: unknown[] = []) => Number((await one<{ n: string }>(query, params)).n)
  const auditsOf = (action: string) => savepointHarness.audits.filter((audit) => audit.action === action)
  const balanceOf = async (organizationId: string, userId: string) =>
    (await one<{ b: number | null }>(`SELECT balance_after AS b FROM reward_wallet_ledger WHERE org_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`, [organizationId, userId]))?.b ?? 0

  beforeAll(async () => {
    admin = await savepointHarness.start(URL!)
    await insertOrganization(admin, tag, { id: ORG_A })
    await insertOrganization(admin, tag, { id: ORG_B })
    await insertMember(admin, ORG_A, { userId: U.adminA, role: 'admin', name: 'Zed Admin' })
    await insertMember(admin, ORG_A, { userId: U.memberA1, name: 'Alice Member' })
    await insertMember(admin, ORG_A, { userId: U.memberA2, name: 'Bob Member' })
    await insertMember(admin, ORG_A, { userId: U.formerA, name: 'Carl Former', status: 'inactive' })
    const removed = await insertMember(admin, ORG_A, { userId: U.removedA, name: 'Dana Removed' })
    await admin.query(`UPDATE organization_members SET deleted_at = now() WHERE id = $1`, [removed])
    await insertMember(admin, ORG_B, { userId: U.adminB, role: 'admin', name: 'Eve Admin' })
    await insertMember(admin, ORG_B, { userId: U.memberB1, name: 'Fay Member' })
    for (const userId of [U.adminA, U.memberA1, U.memberA2, U.formerA, U.removedA]) who.organizationOf.set(userId, ORG_A)
    for (const userId of [U.adminB, U.memberB1]) who.organizationOf.set(userId, ORG_B)
    // U.strangerA belongs to no organization.

    const program = async (organizationId: string, name: string, status = 'active') =>
      (await one<{ id: string }>(`INSERT INTO recognition_programs (org_id, name, status) VALUES ($1, $2, $3) RETURNING id::text AS id`, [organizationId, name, status])).id
    ids.programA = await program(ORG_A, `Program A ${tag}`)
    ids.programB = await program(ORG_B, `Program B ${tag}`)
    await program(ORG_A, `Draft A ${tag}`, 'draft')

    const awardType = async (organizationId: string, programId: string, name: string, kind: string, credits: number, approval: boolean) =>
      (
        await one<{ id: string }>(
          `INSERT INTO recognition_award_types (org_id, program_id, name, kind, default_credit_amount, requires_approval) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id::text AS id`,
          [organizationId, programId, name, kind, credits, approval],
        )
      ).id
    ids.typePeerA = await awardType(ORG_A, ids.programA, `Peer A ${tag}`, 'peer', 25, true)
    ids.typeAdminA = await awardType(ORG_A, ids.programA, `Admin A ${tag}`, 'admin', 10, false)
    ids.typeB = await awardType(ORG_B, ids.programB, `Type B ${tag}`, 'peer', 5, false)

    const envelope = async (organizationId: string, programId: string, name: string) =>
      (
        await one<{ id: string }>(
          `INSERT INTO reward_budget_envelopes (org_id, program_id, name, scope_type, period, amount_limit, starts_at, ends_at)
           VALUES ($1, $2, $3, 'org', 'annual', 1000, now() - interval '1 day', now() + interval '300 days') RETURNING id::text AS id`,
          [organizationId, programId, name],
        )
      ).id
    ids.envelopeA = await envelope(ORG_A, ids.programA, `Envelope A ${tag}`)
    await envelope(ORG_B, ids.programB, `Envelope B ${tag}`)

    const ledger = (organizationId: string, userId: string, eventType: string, amount: number, balance: number, sourceType: string, ago: string) =>
      admin.query(
        `INSERT INTO reward_wallet_ledger (org_id, user_id, event_type, amount_credits, balance_after, source_type, created_at) VALUES ($1, $2, $3, $4, $5, $6, now() - $7::interval)`,
        [organizationId, userId, eventType, amount, balance, sourceType, ago],
      )
    await ledger(ORG_A, U.memberA1, 'earn', 100, 100, 'system', '2 hours')
    await ledger(ORG_A, U.memberA1, 'spend', -30, 70, 'redemption', '1 hour')
    await ledger(ORG_B, U.memberB1, 'earn', 500, 500, 'system', '1 hour')

    const award = async (organizationId: string, programId: string, typeId: string, recipient: string, status: string) =>
      (
        await one<{ id: string }>(
          `INSERT INTO recognition_awards (org_id, program_id, award_type_id, recipient_user_id, issuer_user_id, reason, status) VALUES ($1, $2, $3, $4, 'issuer', 'Seeded', $5) RETURNING id::text AS id`,
          [organizationId, programId, typeId, recipient, status],
        )
      ).id
    ids.awardIssuedA1 = await award(ORG_A, ids.programA, ids.typeAdminA, U.memberA1, 'issued')
    await award(ORG_A, ids.programA, ids.typeAdminA, U.memberA2, 'pending')
    ids.awardPendingB = await award(ORG_B, ids.programB, ids.typeB, U.memberB1, 'pending')
  }, 180_000)

  afterAll(async () => {
    await admin?.end()
    await savepointHarness.stop()
  })

  describe('what a member reads', () => {
    it('lists the programs of the member organization and none of another', async () => {
      const own = (await as(U.memberA1, () => actions!.listRecognitionPrograms())) as Outcome
      expect(own.success).toBe(true)
      expect((own.data as Array<{ name: string }>).map((program) => program.name).sort()).toEqual([`Draft A ${tag}`, `Program A ${tag}`])

      const other = (await as(U.memberB1, () => actions!.listRecognitionPrograms())) as Outcome
      expect((other.data as Array<{ name: string }>).map((program) => program.name)).toEqual([`Program B ${tag}`])
    })

    it('lists the award types of a program of the member organization, and finds none for a program of another', async () => {
      const own = (await as(U.memberA1, () => actions!.listAwardTypes(ids.programA))) as Outcome
      expect((own.data as Array<{ id: string }>).map((type) => type.id).sort()).toEqual([ids.typePeerA, ids.typeAdminA].sort())

      const foreign = (await as(U.memberB1, () => actions!.listAwardTypes(ids.programA))) as Outcome
      expect(foreign).toMatchObject({ success: true, data: [] })
    })

    it("reads the member's own balance, ledger, awards and redemptions, and another organization's member sees none of them", async () => {
      expect(await as(U.memberA1, () => actions!.getMyWalletBalance())).toEqual({ success: true, data: { balance: 70 } })
      expect(await as(U.memberB1, () => actions!.getMyWalletBalance())).toEqual({ success: true, data: { balance: 500 } })
      expect(await as(U.memberA2, () => actions!.getMyWalletBalance())).toEqual({ success: true, data: { balance: 0 } })

      const ledger = (await as(U.memberA1, () => actions!.getMyWalletLedger())) as Outcome
      expect(ledger.data).toMatchObject({ total: 2 })
      expect((ledger.data as { entries: Array<{ amountCredits: number }> }).entries.map((entry) => entry.amountCredits)).toEqual([-30, 100])

      const awards = (await as(U.memberA1, () => actions!.listMyAwards())) as Outcome
      expect((awards.data as Array<{ id: string }>).map((award) => award.id)).toEqual([ids.awardIssuedA1])
      // A pending award is between whoever made it and the administrators: the person it names is not told about it before it is decided.
      expect(((await as(U.memberB1, () => actions!.listMyAwards())) as Outcome).data).toEqual([])
      expect(((await as(U.memberA2, () => actions!.listMyAwards())) as Outcome).data).toEqual([])
      expect(((await as(U.memberA1, () => actions!.listMyRedemptions())) as Outcome).data).toMatchObject({ total: 0 })
    })

    it('shows the same selects nothing when no organization is set, which is why every read needs its context', async () => {
      const bare = await savepointHarness.context(RUNTIME_ROLE, null, null, async (tx) => ({
        programs: (await tx.select().from(schema!.recognitionPrograms)).length,
        awards: (await tx.select().from(schema!.recognitionAwards)).length,
        envelopes: (await tx.select().from(schema!.rewardBudgetEnvelopes)).length,
        ledger: (await tx.select().from(schema!.rewardWalletLedger)).length,
      }))
      expect(bare).toEqual({ programs: 0, awards: 0, envelopes: 0, ledger: 0 })
      expect(await ambientDb.select().from(schema!.recognitionPrograms)).toEqual([])
    })

    it('does not tell a user who belongs to no organization anything, and not what the resolver wrote for the log', async () => {
      const result = (await as(U.strangerA, () => actions!.listRecognitionPrograms())) as Outcome
      expect(result).toEqual({ success: false, error: 'You do not belong to an organization' })
    })
  })

  describe('what an administrator reads', () => {
    it('summarises the organization own awards, budgets and wallet, and nothing of another organization', async () => {
      const summary = (await as(U.adminA, () => actions!.getRewardsSummary())) as Outcome
      expect(summary.error).toBeUndefined()
      expect(summary.data).toMatchObject({
        active_programs_count: 1,
        pending_awards_count: 1,
        total_credits_issued: 100,
        total_credits_redeemed: 30,
        total_credits_outstanding: 70,
        active_members: 1,
      })
      expect((summary.data as { budgetUsage: Array<{ envelopeId: string }> }).budgetUsage.map((usage) => usage.envelopeId)).toEqual([ids.envelopeA])
    })

    it('lists the awards by status, and the envelopes of a program, of the administrator organization only', async () => {
      const pending = (await as(U.adminA, () => actions!.listAwardsByStatus({ statuses: ['pending'] }))) as Outcome
      expect(pending.data as unknown[]).toHaveLength(1)
      expect((pending.data as Array<{ id: string; orgId: string }>)[0].orgId).toBe(ORG_A)

      const own = (await as(U.adminA, () => actions!.listBudgetEnvelopes(ids.programA))) as Outcome
      expect((own.data as Array<{ id: string }>).map((envelope) => envelope.id)).toEqual([ids.envelopeA])
      const foreign = (await as(U.adminA, () => actions!.listBudgetEnvelopes(ids.programB))) as Outcome
      expect(foreign).toMatchObject({ success: true, data: [] })
      expect(((await as(U.adminA, () => actions!.getBudgetUsageSummary(ids.programB))) as Outcome).data).toEqual([])
    })

    it('refuses a member who is not an administrator', async () => {
      for (const run of [() => actions!.getRewardsSummary(), () => actions!.listAwardsByStatus({}), () => actions!.createRecognitionProgram({ name: 'x' })]) {
        expect(await as(U.memberA1, run as () => Promise<Outcome>)).toEqual({ success: false, error: 'Insufficient permissions' })
      }
    })
  })

  describe('what the wallet page and the recognition page read', () => {
    it('reads the wallet of the member in the organization: the balance beside its newest entry, and the totals', async () => {
      const wallet = await pageReads!.loadWalletOverview(ORG_A, U.memberA1)

      expect(wallet.balance).toBe(70)
      expect(wallet.entries.map((entry) => entry.amountCredits)).toEqual([-30, 100])
      expect(wallet.entries[0].balanceAfter).toBe(wallet.balance)
      expect(wallet).toMatchObject({ totalEarned: 100, totalRedeemed: 30 })
    })

    it('finds an empty wallet for a member with no entry, and none for a member of another organization or an organization the member is not in', async () => {
      expect(await pageReads!.loadWalletOverview(ORG_A, U.memberA2)).toEqual({ balance: 0, entries: [], totalEarned: 0, totalRedeemed: 0 })
      expect(await pageReads!.loadWalletOverview(ORG_A, U.memberB1)).toEqual({ balance: 0, entries: [], totalEarned: 0, totalRedeemed: 0 })
      expect(await pageReads!.loadWalletOverview(ORG_B, U.memberA1)).toEqual({ balance: 0, entries: [], totalEarned: 0, totalRedeemed: 0 })
      expect((await pageReads!.loadWalletOverview(ORG_B, U.memberB1)).balance).toBe(500)
    })

    it('lists the current members of the organization as the people a recognition can go to, by name and nothing else about them', async () => {
      const candidates = await pageReads!.listRecognitionCandidates(ORG_A)

      expect(candidates.map((candidate) => candidate.userId)).toEqual([U.memberA1, U.memberA2, U.adminA])
      expect(candidates[0]).toEqual({ userId: U.memberA1, name: 'Alice Member' })
      expect(candidates.some((candidate) => 'email' in candidate || 'role' in candidate)).toBe(false)
      expect((await pageReads!.listRecognitionCandidates(ORG_B)).map((candidate) => candidate.userId)).toEqual([U.adminB, U.memberB1])
    })

    it('adds the e-mail address only when an administrator page asks for it', async () => {
      const candidates = await pageReads!.listRecognitionCandidates(ORG_A, { includeEmail: true })

      expect(candidates[0]).toEqual({ userId: U.memberA1, name: 'Alice Member', email: `${U.memberA1}@example.test` })
    })

    it('names the members of the organization by user id, and nobody of another organization', async () => {
      const names = await pageReads!.loadMemberNames(ORG_A, [U.memberA1, U.adminA, U.memberB1, 'nobody'])

      expect(names).toEqual({ [U.memberA1]: 'Alice Member', [U.adminA]: 'Zed Admin' })
      expect(await pageReads!.loadMemberNames(ORG_A, [])).toEqual({})
    })

    it('finds the active program of the organization, and none for an organization with no active program', async () => {
      expect(await pageReads!.loadActiveProgram(ORG_A)).toEqual({ id: ids.programA, name: `Program A ${tag}` })
      expect(await pageReads!.loadActiveProgram(ORG_B)).toEqual({ id: ids.programB, name: `Program B ${tag}` })
      expect(await pageReads!.loadActiveProgram(randomUUID())).toBeNull()
    })
  })

  describe('what an administrator writes', () => {
    it('writes programs and award types as the runtime role because the storage-authority manifest declares SELECT, INSERT and UPDATE for them', async () => {
      // No GRANT here: a manifest regression (a privilege dropped from the declaration) must fail this test, and then the writes below.
      for (const table of ['recognition_programs', 'recognition_award_types']) {
        for (const privilege of ['SELECT', 'INSERT', 'UPDATE']) {
          const granted = (await one<{ ok: boolean }>(`SELECT has_table_privilege($1, $2, $3) AS ok`, [RUNTIME_ROLE, table, privilege])).ok
          expect(granted, `${RUNTIME_ROLE} ${privilege} on ${table}`).toBe(true)
        }
      }
    })

    it('stores a program in the administrator organization whatever the form says, and audits it', async () => {
      const result = (await as(U.adminA, () => actions!.createRecognitionProgram({ name: `Created ${tag}`, orgId: ORG_B, organizationId: ORG_B }))) as Outcome
      expect(result.error).toBeUndefined()
      const stored = await one<{ id: string; org_id: string; status: string }>(`SELECT id::text AS id, org_id::text AS org_id, status::text AS status FROM recognition_programs WHERE name = $1`, [`Created ${tag}`])
      expect(stored).toMatchObject({ org_id: ORG_A, status: 'draft' })
      expect(auditsOf('rewards.program.create').find((audit) => audit.resourceId === stored.id)).toMatchObject({
        organizationId: ORG_A,
        userId: U.adminA,
        resourceType: 'recognition_programs',
        details: { name: `Created ${tag}`, status: 'draft' },
      })
    })

    it('stores nothing when the audit cannot be written, and the caller is not told why', async () => {
      savepointHarness.failNextAudit()

      const result = (await as(U.adminA, () => actions!.createRecognitionProgram({ name: `Unaudited ${tag}` }))) as Outcome

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/^Something went wrong\. Please try again\. \(reference [0-9a-f]{8}\)$/)
      expect(result.error).not.toContain('audit sink unavailable')
      expect(await count(`SELECT count(*) AS n FROM recognition_programs WHERE name = $1`, [`Unaudited ${tag}`])).toBe(0)
    })

    it('updates a program of the organization and audits the fields, and finds no program of another organization to update', async () => {
      const changed = (await as(U.adminA, () => actions!.updateRecognitionProgram(ids.programA, { description: `Renamed ${tag}` }))) as Outcome
      expect(changed.error).toBeUndefined()
      expect((await one<{ description: string }>(`SELECT description FROM recognition_programs WHERE id = $1`, [ids.programA])).description).toBe(`Renamed ${tag}`)
      expect(auditsOf('rewards.program.update').find((audit) => audit.resourceId === ids.programA)).toMatchObject({ userId: U.adminA, details: { changed: ['description'] } })

      const foreign = (await as(U.adminA, () => actions!.updateRecognitionProgram(ids.programB, { description: 'taken over' }))) as Outcome
      expect(foreign).toEqual({ success: false, error: 'Program not found' })
      expect((await one<{ description: string | null }>(`SELECT description FROM recognition_programs WHERE id = $1`, [ids.programB])).description).not.toBe('taken over')
      expect(auditsOf('rewards.program.update').some((audit) => audit.resourceId === ids.programB)).toBe(false)
    })

    it('creates an award type only for a program of the organization, in the organization, and audits it', async () => {
      const refused = (await as(U.adminA, () =>
        actions!.createRecognitionAwardType({ programId: ids.programB, name: `Foreign ${tag}`, kind: 'peer', defaultCreditAmount: 5 }),
      )) as Outcome
      expect(refused).toEqual({ success: false, error: 'Program not found' })
      expect(await count(`SELECT count(*) AS n FROM recognition_award_types WHERE name = $1`, [`Foreign ${tag}`])).toBe(0)

      const created = (await as(U.adminA, () =>
        actions!.createRecognitionAwardType({ programId: ids.programA, name: `Kudos ${tag}`, kind: 'peer', defaultCreditAmount: 15 }),
      )) as Outcome
      expect(created.error).toBeUndefined()
      const stored = await one<{ id: string; org_id: string }>(`SELECT id::text AS id, org_id::text AS org_id FROM recognition_award_types WHERE name = $1`, [`Kudos ${tag}`])
      expect(stored.org_id).toBe(ORG_A)
      expect(auditsOf('rewards.award_type.create').find((audit) => audit.resourceId === stored.id)).toMatchObject({ organizationId: ORG_A, userId: U.adminA })
    })

    it('creates a budget envelope only for a program of the organization, in the organization, and audits it', async () => {
      const envelope = (programId: string, name: string) => ({
        programId,
        name,
        period: 'monthly',
        amountLimit: 200,
        startsAt: '2030-01-01T00:00:00.000Z',
        endsAt: '2030-02-01T00:00:00.000Z',
      })
      const refused = (await as(U.adminA, () => actions!.createBudgetEnvelope(envelope(ids.programB, `Foreign ${tag}`)))) as Outcome
      expect(refused.success).toBe(false)
      expect(await count(`SELECT count(*) AS n FROM reward_budget_envelopes WHERE name = $1`, [`Foreign ${tag}`])).toBe(0)

      const created = (await as(U.adminA, () => actions!.createBudgetEnvelope(envelope(ids.programA, `Monthly ${tag}`)))) as Outcome
      expect(created.error).toBeUndefined()
      const stored = await one<{ id: string; org_id: string; amount_limit: number }>(`SELECT id::text AS id, org_id::text AS org_id, amount_limit FROM reward_budget_envelopes WHERE name = $1`, [`Monthly ${tag}`])
      expect(stored).toMatchObject({ org_id: ORG_A, amount_limit: 200 })
      expect(auditsOf('rewards.budget_envelope.create').find((audit) => audit.resourceId === stored.id)).toMatchObject({ organizationId: ORG_A, userId: U.adminA })
    })
  })

  describe('the award lifecycle', () => {
    let awardId = ''
    const award = (recipientUserId: string) => ({ programId: ids.programA, awardTypeId: ids.typePeerA, recipientUserId, reason: `Thanks ${tag}` })

    it('creates an award only for a current member of the organization', async () => {
      for (const recipient of [U.memberB1, U.formerA, U.removedA, U.strangerA]) {
        expect(await as(U.adminA, () => actions!.createAward(award(recipient)) as Promise<Outcome>)).toEqual({
          success: false,
          error: 'Recipient is not an active member of this organization',
        })
      }
      expect(await count(`SELECT count(*) AS n FROM recognition_awards WHERE reason = $1`, [`Thanks ${tag}`])).toBe(0)

      const created = (await as(U.adminA, () => actions!.createAward(award(U.memberA1)))) as Outcome
      expect(created.error).toBeUndefined()
      const stored = await one<{ id: string; org_id: string; status: string; issuer_user_id: string }>(
        `SELECT id::text AS id, org_id::text AS org_id, status::text AS status, issuer_user_id FROM recognition_awards WHERE reason = $1`,
        [`Thanks ${tag}`],
      )
      awardId = stored.id
      expect(stored).toMatchObject({ org_id: ORG_A, status: 'pending', issuer_user_id: U.adminA })
      expect(auditsOf('rewards.award.create').find((audit) => audit.resourceId === awardId)).toMatchObject({ organizationId: ORG_A, userId: U.adminA })
    })

    it('does not approve an award of another organization', async () => {
      const result = (await as(U.adminA, () => actions!.approveAward({ awardId: ids.awardPendingB }))) as Outcome

      expect(result).toEqual({ success: false, error: 'Award not found' })
      expect((await one<{ status: string }>(`SELECT status::text AS status FROM recognition_awards WHERE id = $1`, [ids.awardPendingB])).status).toBe('pending')
    })

    it('approves and issues the award, credits the member wallet and the budget, and audits both as the administrator', async () => {
      expect(((await as(U.adminA, () => actions!.approveAward({ awardId }))) as Outcome).error).toBeUndefined()
      expect(auditsOf('rewards.award.approve').find((audit) => audit.resourceId === awardId)).toMatchObject({ userId: U.adminA })

      const issued = (await as(U.adminA, () => actions!.issueAward({ awardId }))) as Outcome
      expect(issued.error).toBeUndefined()
      expect(issued.data).toMatchObject({ newBalance: 95 })
      expect(await balanceOf(ORG_A, U.memberA1)).toBe(95)
      expect(await count(`SELECT amount_used AS n FROM reward_budget_envelopes WHERE id = $1`, [ids.envelopeA])).toBe(25)
      expect(auditsOf('rewards.award.issue').find((audit) => audit.resourceId === awardId)).toMatchObject({ organizationId: ORG_A, userId: U.adminA })
    })

    it('does not issue the same award twice', async () => {
      const again = (await as(U.adminA, () => actions!.issueAward({ awardId }))) as Outcome

      expect(again.success).toBe(false)
      expect(await balanceOf(ORG_A, U.memberA1)).toBe(95)
    })

    it('revokes the award, takes the credits back and refunds the budget', async () => {
      const revoked = (await as(U.adminA, () => actions!.revokeAward({ awardId, reason: `Mistake ${tag}` }))) as Outcome

      expect(revoked.error).toBeUndefined()
      expect(await balanceOf(ORG_A, U.memberA1)).toBe(70)
      expect(await count(`SELECT amount_used AS n FROM reward_budget_envelopes WHERE id = $1`, [ids.envelopeA])).toBe(0)
      expect(auditsOf('rewards.award.revoke').find((audit) => audit.resourceId === awardId)).toMatchObject({ userId: U.adminA })
    })
  })

  describe('redemptions', () => {
    let redemptionId = ''

    it('deducts the credits of the member in their organization and audits it, for a program of that organization only', async () => {
      const foreign = (await as(U.memberA1, () => actions!.initiateRedemption({ programId: ids.programB, creditsToSpend: 20 }))) as Outcome
      expect(foreign).toEqual({ success: false, error: 'Program not found' })
      expect(await balanceOf(ORG_A, U.memberA1)).toBe(70)

      const initiated = (await as(U.memberA1, () => actions!.initiateRedemption({ programId: ids.programA, creditsToSpend: 20 }))) as Outcome
      expect(initiated.error).toBeUndefined()
      redemptionId = (initiated.data as { id: string }).id
      expect(await one(`SELECT org_id::text AS org_id, user_id, status::text AS status, credits_spent FROM reward_redemptions WHERE id = $1`, [redemptionId])).toEqual({
        org_id: ORG_A,
        user_id: U.memberA1,
        status: 'initiated',
        credits_spent: 20,
      })
      expect(await balanceOf(ORG_A, U.memberA1)).toBe(50)
      expect(auditsOf('rewards.redemption.initiate').find((audit) => audit.resourceId === redemptionId)).toMatchObject({ organizationId: ORG_A, userId: U.memberA1 })
    })

    it('refuses more credits than the wallet holds, and changes nothing', async () => {
      const result = (await as(U.memberA1, () => actions!.initiateRedemption({ programId: ids.programA, creditsToSpend: 100_000 }))) as Outcome

      expect(result.success).toBe(false)
      expect(result.error).toMatch(/Insufficient balance/)
      expect(await balanceOf(ORG_A, U.memberA1)).toBe(50)
    })

    it('lets only the member who made the redemption cancel it', async () => {
      const byColleague = (await as(U.memberA2, () => actions!.cancelRedemption({ redemptionId, reason: 'not mine' }))) as Outcome
      expect(byColleague).toEqual({ success: false, error: 'Redemption not found' })
      expect(await balanceOf(ORG_A, U.memberA1)).toBe(50)

      const byOtherOrganization = (await as(U.memberB1, () => actions!.cancelRedemption({ redemptionId, reason: 'not mine' }))) as Outcome
      expect(byOtherOrganization).toEqual({ success: false, error: 'Redemption not found' })

      const byOwner = (await as(U.memberA1, () => actions!.cancelRedemption({ redemptionId, reason: 'changed my mind' }))) as Outcome
      expect(byOwner.error).toBeUndefined()
      expect(await balanceOf(ORG_A, U.memberA1)).toBe(70)
      expect(auditsOf('rewards.redemption.cancel').find((audit) => audit.resourceId === redemptionId)).toMatchObject({ organizationId: ORG_A, userId: U.memberA1 })
    })

    it('lists the redemptions of the member in their organization', async () => {
      const mine = (await as(U.memberA1, () => actions!.listMyRedemptions())) as Outcome
      expect(mine.data).toMatchObject({ total: 1 })
      expect(((await as(U.memberB1, () => actions!.listMyRedemptions())) as Outcome).data).toMatchObject({ total: 0 })
    })

    it('gives the credits back, and says so, when the store cannot create the checkout', async () => {
      vi.stubEnv('SHOPIFY_ENABLED', 'true')
      shopify.fail = true
      try {
        const before = await balanceOf(ORG_A, U.memberA1)

        const result = (await as(U.memberA1, () => actions!.initiateRedemption({ programId: ids.programA, creditsToSpend: 20 }))) as Outcome

        expect(result.success).toBe(false)
        expect(result.error).toMatch(/nothing was redeemed and your credits were not spent/)
        expect(result).not.toHaveProperty('data')
        expect(await balanceOf(ORG_A, U.memberA1)).toBe(before)
        const row = await one<{ status: string }>(`SELECT status::text AS status FROM reward_redemptions WHERE org_id = $1 AND user_id = $2 ORDER BY created_at DESC LIMIT 1`, [ORG_A, U.memberA1])
        expect(row.status).toBe('cancelled')
      } finally {
        shopify.fail = false
        vi.unstubAllEnvs()
      }
    })

    it('returns the checkout of the store, and records it on the redemption, when the store answers', async () => {
      vi.stubEnv('SHOPIFY_ENABLED', 'true')
      try {
        const before = await balanceOf(ORG_A, U.memberA1)

        const result = (await as(U.memberA1, () => actions!.initiateRedemption({ programId: ids.programA, creditsToSpend: 20 }))) as Outcome

        expect(result.error).toBeUndefined()
        expect(result.data).toMatchObject({ checkout_url: 'https://shop.example/cart?discount=DISC' })
        expect(await balanceOf(ORG_A, U.memberA1)).toBe(before - 20)
        const row = await one<{ provider_checkout_id: string | null; status: string }>(
          `SELECT provider_checkout_id, status::text AS status FROM reward_redemptions WHERE id = $1`,
          [(result.data as { id: string }).id],
        )
        expect(row.provider_checkout_id).toBe('DISC')
      } finally {
        vi.unstubAllEnvs()
      }
    })
  })

  describe('peer nominations', () => {
    const nominate = (recipientUserId: string, awardTypeId = ids.typePeerA) => ({ awardTypeId, recipientUserId, reason: `Helped out ${tag}` })
    let nominationId = ''

    it('lets a member who is no administrator nominate a colleague: a pending request of the organization, with the member as its issuer, audited', async () => {
      const refusedAward = (await as(U.memberA1, () =>
        actions!.createAward({ programId: ids.programA, awardTypeId: ids.typePeerA, recipientUserId: U.memberA2, reason: 'x' }),
      )) as Outcome
      expect(refusedAward).toEqual({ success: false, error: 'Insufficient permissions' })

      const result = (await as(U.memberA1, () => actions!.nominatePeer({ ...nominate(U.memberA2), orgId: ORG_B, organizationId: ORG_B }))) as Outcome

      expect(result).toMatchObject({ success: true, data: { status: 'pending' } })
      nominationId = (result.data as { id: string }).id
      expect(
        await one(
          `SELECT org_id::text AS org_id, program_id::text AS program_id, award_type_id::text AS award_type_id, recipient_user_id, issuer_user_id,
                  status::text AS status, reason, metadata_json
           FROM recognition_awards WHERE id = $1`,
          [nominationId],
        ),
      ).toEqual({
        org_id: ORG_A,
        program_id: ids.programA,
        award_type_id: ids.typePeerA,
        recipient_user_id: U.memberA2,
        issuer_user_id: U.memberA1,
        status: 'pending',
        reason: `Helped out ${tag}`,
        metadata_json: { nomination: true },
      })
      expect(auditsOf('rewards.award.nominate').find((audit) => audit.resourceId === nominationId)).toMatchObject({
        organizationId: ORG_A,
        userId: U.memberA1,
        resourceType: 'recognition_awards',
        details: { status: 'pending', recipientUserId: U.memberA2 },
      })
    })

    it('is not told to the colleague it names, who reads only decided awards', async () => {
      expect(((await as(U.memberA2, () => actions!.listMyAwards())) as Outcome).data).toEqual([])
    })

    it('refuses to nominate oneself, anybody who is not a current member of the organization, and the same colleague for the same award while it waits', async () => {
      const refusals: Array<[string, string]> = [
        [U.memberA1, 'You cannot nominate yourself'],
        [U.memberB1, 'Recipient is not an active member of this organization'],
        [U.formerA, 'Recipient is not an active member of this organization'],
        [U.removedA, 'Recipient is not an active member of this organization'],
        [U.strangerA, 'Recipient is not an active member of this organization'],
        [U.memberA2, 'You have already nominated this colleague for this award; it is waiting for review'],
      ]
      for (const [recipient, error] of refusals) {
        expect(await as(U.memberA1, () => actions!.nominatePeer(nominate(recipient)) as Promise<Outcome>), recipient).toEqual({ success: false, error })
      }
      expect(await count(`SELECT count(*) AS n FROM recognition_awards WHERE issuer_user_id = $1`, [U.memberA1])).toBe(1)
    })

    it('refuses an award that is not a peer one, one of another organization, one of a program that is not active, and stores nothing', async () => {
      const draftType = (
        await one<{ id: string }>(
          `INSERT INTO recognition_award_types (org_id, program_id, name, kind, default_credit_amount)
           SELECT $1, id, $2, 'peer', 5 FROM recognition_programs WHERE org_id = $1 AND status = 'draft' RETURNING id::text AS id`,
          [ORG_A, `Draft peer ${tag}`],
        )
      ).id
      const refusals: Array<[string, string]> = [
        [ids.typeAdminA, 'Award type not found'],
        [ids.typeB, 'Award type not found'],
        [randomUUID(), 'Award type not found'],
        [draftType, 'This recognition program is not accepting nominations'],
      ]

      for (const [awardTypeId, error] of refusals) {
        expect(await as(U.memberA1, () => actions!.nominatePeer(nominate(U.adminA, awardTypeId)) as Promise<Outcome>), awardTypeId).toEqual({ success: false, error })
      }
      expect(await count(`SELECT count(*) AS n FROM recognition_awards WHERE issuer_user_id = $1`, [U.memberA1])).toBe(1)
    })

    it('keeps at most the allowed number of nominations of one member waiting for review', async () => {
      const limit = awardService!.MAX_PENDING_NOMINATIONS_PER_MEMBER
      await admin.query(
        `INSERT INTO recognition_awards (org_id, program_id, award_type_id, recipient_user_id, issuer_user_id, reason, status)
         SELECT $1, $2, $3, 'seeded-' || g, $4, 'seeded', 'pending' FROM generate_series(1, $5::int) g`,
        [ORG_A, ids.programA, ids.typePeerA, U.memberA2, limit],
      )
      try {
        const result = (await as(U.memberA2, () => actions!.nominatePeer(nominate(U.memberA1)))) as Outcome

        expect(result.success).toBe(false)
        expect(result.error).toMatch(/too many nominations waiting for review/)
        expect(await count(`SELECT count(*) AS n FROM recognition_awards WHERE issuer_user_id = $1 AND reason = $2`, [U.memberA2, `Helped out ${tag}`])).toBe(0)
      } finally {
        await admin.query(`DELETE FROM recognition_awards WHERE issuer_user_id = $1 AND reason = 'seeded'`, [U.memberA2])
      }
    })

    it('is decided by an administrator of the organization only, and a rejection is added to what the row already records', async () => {
      const refusedForMember = [
        (await as(U.memberA1, () => actions!.rejectAward({ awardId: nominationId, reason: 'x' }))) as Outcome,
        (await as(U.memberA1, () => actions!.approveAward({ awardId: nominationId }))) as Outcome,
      ]
      expect(refusedForMember).toEqual([
        { success: false, error: 'Insufficient permissions' },
        { success: false, error: 'Insufficient permissions' },
      ])
      expect(await as(U.adminB, () => actions!.rejectAward({ awardId: nominationId, reason: 'x' }) as Promise<Outcome>)).toEqual({
        success: false,
        error: 'Award not found or cannot be rejected',
      })

      const rejected = (await as(U.adminA, () => actions!.rejectAward({ awardId: nominationId, reason: `Not this time ${tag}` }))) as Outcome

      expect(rejected.success).toBe(true)
      expect(await one(`SELECT status::text AS status, metadata_json FROM recognition_awards WHERE id = $1`, [nominationId])).toMatchObject({
        status: 'rejected',
        metadata_json: { nomination: true, rejectedBy: U.adminA, rejectedReason: `Not this time ${tag}` },
      })
      expect(auditsOf('rewards.award.reject').find((audit) => audit.resourceId === nominationId)).toMatchObject({
        organizationId: ORG_A,
        userId: U.adminA,
        details: { reason: `Not this time ${tag}` },
      })
      expect(((await as(U.adminA, () => actions!.rejectAward({ awardId: nominationId, reason: 'again' }))) as Outcome).success).toBe(false)
      expect(((await as(U.memberA2, () => actions!.listMyAwards())) as Outcome).data).toEqual([])
    })

    it('credits the colleague once an administrator approves and issues it, and only then shows it to them', async () => {
      const nominated = (await as(U.memberA1, () => actions!.nominatePeer(nominate(U.memberA2)))) as Outcome
      expect(nominated.success).toBe(true)
      const awardId = (nominated.data as { id: string }).id

      expect(((await as(U.adminA, () => actions!.approveAward({ awardId }))) as Outcome).error).toBeUndefined()
      expect(await balanceOf(ORG_A, U.memberA2)).toBe(0)
      expect(((await as(U.adminA, () => actions!.issueAward({ awardId }))) as Outcome).error).toBeUndefined()

      expect(await balanceOf(ORG_A, U.memberA2)).toBe(25)
      expect(((await as(U.memberA2, () => actions!.listMyAwards())) as Outcome).data as Array<{ id: string }>).toMatchObject([{ id: awardId }])
    })
  })
})
