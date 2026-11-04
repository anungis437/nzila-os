/**
 * The cross-organization system jobs and webhooks the tenant-context census (CTX-3) judged against the storage-authority manifest, run as the real roles.
 *
 * Each of these ran in `withSystemContext` (the `union_eyes_system` role) while the manifest declared that role nothing on the tables they touch, so on a real
 * deployment the first statement was refused ("permission denied") and nothing in the unit tests or in CI (a superuser) could notice. This runs the unmodified
 * route handlers and services over the combined Django + Drizzle schema, with only the request boundary and the outgoing mail replaced, and proves that
 *   - the Shopify webhook can resolve a shop domain to its organization as the system role (system SELECT on shopify_config), that the tenant runtime role cannot read
 *     the table at all, and that no application role can write it (a row is provisioned by a platform operator);
 *   - the staging proof harness (POST /api/staging-proof/deadline-engine/scenario) runs every scenario as the system role in ONE transaction that is always
 *     rolled back: the synthetic organization, the seed rows and everything the deadline engine wrote are gone afterwards, the system role needs no DELETE and no
 *     UPDATE of an organization, and the run is recorded in the ledger, which commits on its own;
 *   - the daily education reminder job finds the sessions and certifications it must mail as the system role (system SELECT on course_registrations, training_courses,
 *     course_sessions, member_certifications), writes its delivery marker (in_app_notifications INSERT), skips what is already marked, and releases the marker of a
 *     mail the provider refused (DELETE);
 *   - the rewards cron awards the members' anniversaries as the system role (recognition_awards, reward_wallet_ledger INSERT, reward_budget_envelopes UPDATE, the audit entry
 *     of each organization on the same transaction), once a day, and the rewards expiry scan reads the ledger and the member's address inside the organization
 *     (organization_members, not the identity store), writes and claims the expiry marker once per lot and tier, and releases it when the mail fails;
 *   - the public pilot application (an applicant has no organization yet) is written by the system role after the body is validated, and an invalid body writes nothing;
 *   - the signed unsubscribe link ends a recipient's communications with every organization they belong to (communication_preferences, newsletter_list_subscribers,
 *     newsletter_distribution_lists, consent_records), as the system role.
 *
 * Needs UE_AUTHORITY_COMBINED_URL (an ADMIN connection to a disposable, fully bootstrapped database); it fails, it does not skip, without it.
 */
import { randomBytes, randomUUID } from 'node:crypto'
import { NextRequest } from 'next/server'
import type pg from 'pg'
import { sql } from 'drizzle-orm'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertMember, insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const boundary = vi.hoisted(() => ({
  mail: [] as Array<Record<string, any>>,
  expiryMail: [] as Array<Record<string, any>>,
  refuse: new Set<string>(),
  failExpiryMail: false,
}))

vi.mock('@/db/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-savepoint-harness')).contextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-savepoint-harness')).recordAudit }))
// The wrapper's observable contract for a cron route: the handler runs, no tenant transaction opens (a cron has no session).
vi.mock('@/lib/api/with-api', () => ({
  withApi: (_config: unknown, handler: (ctx: unknown) => Promise<unknown>) => async (ctx: unknown) => handler(ctx),
}))
// The mail provider is the boundary: what a job hands to it is what is asserted, and a recipient can be made to refuse it.
vi.mock('@/lib/email-service', () => ({
  getFromEmail: () => 'noreply@example.test',
  sendResendEmail: async (message: { to: string[]; subject: string }) => {
    boundary.mail.push(message)
    return boundary.refuse.has(message.to[0]) ? { success: false, error: 'refused by the provider' } : { success: true, messageId: `message-${boundary.mail.length}` }
  },
}))
vi.mock('@/lib/services/rewards/email-service', () => ({
  sendAwardReceivedEmail: async () => undefined,
  sendApprovalRequestEmail: async () => undefined,
  sendRedemptionConfirmationEmail: async () => undefined,
  sendCreditExpirationEmail: async (message: Record<string, any>) => {
    if (boundary.failExpiryMail) throw new Error('mail provider unavailable')
    boundary.expiryMail.push(message)
  },
}))
// The limiter's counters live in Redis, which this database does not have: that boundary answers "allowed". The CRM is an external service.
vi.mock('@/lib/rate-limiter', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/lib/rate-limiter')>()),
  checkRateLimit: async () => ({ allowed: true, limit: 100, remaining: 99, resetIn: 60 }),
}))
vi.mock('@/lib/services/crm-service', () => ({ upsertContact: async () => null, createDeal: async () => null }))

const { savepointHarness, RUNTIME_ROLE, SYSTEM_ROLE } = await import('./native-savepoint-harness')
const shop = await import('@/lib/services/rewards/webhook-service')
const stagingProof = await import('@/app/api/staging-proof/deadline-engine/scenario/route')
const education = await import('@/app/api/cron/education-reminders/route')
const rewardsCron = await import('@/app/api/rewards/cron/route')
const pilotApply = await import('@/app/api/pilot/apply/route')
const rewardsNotifications = await import('@/lib/services/rewards/notification-service')
const unsubscribe = await import('@/app/api/communications/unsubscribe/[recipientId]/route')
const { createProofSignature } = await import('@/lib/staging-proof/deadline-engine-auth')
const { signTrackingPayload } = await import('@/lib/communications/tracking-token')

type Row = Record<string, any>
type Handler = (ctx: unknown) => Promise<Response>

describe('the cross-organization system jobs and webhooks, as the real roles', () => {
  const tag = `cj${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const saved: Record<string, string | undefined> = {}
  let admin: pg.Client

  const rows = async (query: string, params: unknown[] = []) => (await admin.query(query, params)).rows as Row[]
  const codeOf = async (work: Promise<unknown>) => {
    const failure = await work.then(() => null, (error: unknown) => error as { code?: string; cause?: { code?: string } })
    return failure?.cause?.code ?? failure?.code ?? null
  }
  const env = (values: Record<string, string>) => {
    for (const [key, value] of Object.entries(values)) {
      if (!(key in saved)) saved[key] = process.env[key]
      process.env[key] = value
    }
  }

  beforeAll(async () => {
    if (!URL) throw new Error('UE_AUTHORITY_COMBINED_URL is required: this proof runs on a native PostgreSQL database')
    admin = await savepointHarness.start(URL)
    await insertOrganization(admin, tag, { id: ORG_A, name: `Alpha Union ${tag}` })
    await insertOrganization(admin, tag, { id: ORG_B, name: `Beta Union ${tag}` })
  }, 180_000)

  afterAll(async () => {
    for (const [key, value] of Object.entries(saved)) {
      if (value === undefined) delete process.env[key]
      else process.env[key] = value
    }
    await admin?.end()
    await savepointHarness.stop()
  })

  describe('the Shopify webhook', () => {
    it('resolves the signed shop domain to its one organization as the system role, whatever the case, and to nothing for a shop nobody configured', async () => {
      await admin.query(`INSERT INTO shopify_config (org_id, shop_domain, storefront_token_secret_ref, webhook_secret_ref) VALUES ($1, $2, 'ref-a', 'ref-a'), ($3, $4, 'ref-b', 'ref-b')`, [ORG_A, `Shop-A-${tag}.myshopify.com`, ORG_B, `shop-b-${tag}.myshopify.com`])

      expect(await shop.resolveShopOrganization(`shop-a-${tag}.myshopify.com`)).toBe(ORG_A)
      expect(await shop.resolveShopOrganization(`SHOP-B-${tag}.MYSHOPIFY.COM`)).toBe(ORG_B)
      expect(await shop.resolveShopOrganization(`nobody-${tag}.myshopify.com`)).toBeNull()
      expect(await shop.resolveShopOrganization('not a domain')).toBeNull()
    })

    it('holds the system role to a read: the tenant runtime role is refused the table and no application role can write it', async () => {
      const as = (role: string, statement: string) => savepointHarness.context(role, ORG_A, null, (tx) => tx.execute(sql.raw(statement)))
      expect(await codeOf(as(RUNTIME_ROLE, `SELECT org_id FROM shopify_config`))).toBe('42501')
      expect(await codeOf(as(SYSTEM_ROLE, `INSERT INTO shopify_config (org_id, shop_domain, storefront_token_secret_ref, webhook_secret_ref) VALUES ('${randomUUID()}', 'x.myshopify.com', 'r', 'r')`))).toBe('42501')
      expect(await codeOf(as(SYSTEM_ROLE, `UPDATE shopify_config SET shop_domain = 'y.myshopify.com'`))).toBe('42501')
      expect(await codeOf(as(SYSTEM_ROLE, `DELETE FROM shopify_config`))).toBe('42501')
    })
  })

  describe('the staging proof scenarios', () => {
    const secret = randomBytes(24).toString('hex')
    const request = (scenario: string, nonce = randomBytes(18).toString('base64url')) => {
      const timestamp = new Date().toISOString()
      return new NextRequest('http://localhost/api/staging-proof/deadline-engine/scenario', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-staging-proof-timestamp': timestamp,
          'x-staging-proof-nonce': nonce,
          'x-staging-proof-signature': createProofSignature(secret, timestamp, nonce, scenario as 'schedule-basic'),
        },
        body: JSON.stringify({ scenario }),
      })
    }
    const leftBehind = async () => ({
      organizations: Number((await rows(`SELECT count(*)::int AS n FROM organizations WHERE slug LIKE 'staging-proof-%'`))[0].n),
      grievances: Number((await rows(`SELECT count(*)::int AS n FROM grievances WHERE title LIKE 'staging-proof-%'`))[0].n),
      deadlines: Number((await rows(`SELECT count(*)::int AS n FROM grievance_deadlines WHERE deadline_type = 'wave1a_proof'`))[0].n),
    })

    beforeAll(() => {
      env({
        NEXT_PUBLIC_APP_ENV: 'staging',
        TARGET_ENVIRONMENT: 'staging',
        STAGING_PROOFS_ENABLED: 'true',
        UNION_EYES_RUNTIME_ID: 'union-eyes-staging',
        UE_ENVIRONMENT: 'staging',
        STAGING_PROOF_SECRET: secret,
      })
    })

    it.each(['schedule-basic', 'reschedule', 'cancel'])('runs %s as the system role in a transaction that is rolled back, and every assertion of the scenario holds', async (scenario) => {
      const response = await stagingProof.POST(request(scenario))
      const body = (await response.json()) as Row

      expect(response.status, JSON.stringify(body).slice(0, 600)).toBe(200)
      expect(body.scenario).toBe(scenario)
      expect((body.assertions as Array<{ name: string; passed: boolean; detail?: unknown }>).filter((assertion) => !assertion.passed), JSON.stringify(body).slice(0, 2500)).toEqual([])
      expect(body.passed).toBe(true)
      expect(await leftBehind()).toEqual({ organizations: 0, grievances: 0, deadlines: 0 })

      const [run] = await rows(`SELECT status, scenario FROM staging_proof_runs WHERE id = $1`, [body.proofRunId])
      expect(run).toEqual({ status: 'completed', scenario })
    })

    it('refuses a request signed for another scenario, and writes nothing', async () => {
      const timestamp = new Date().toISOString()
      const nonce = randomBytes(18).toString('base64url')
      const forged = new NextRequest('http://localhost/api/staging-proof/deadline-engine/scenario', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-staging-proof-timestamp': timestamp,
          'x-staging-proof-nonce': nonce,
          'x-staging-proof-signature': createProofSignature(secret, timestamp, nonce, 'cancel'),
        },
        body: JSON.stringify({ scenario: 'reschedule' }),
      })

      expect((await stagingProof.POST(forged)).status).toBe(404)
      expect(await leftBehind()).toEqual({ organizations: 0, grievances: 0, deadlines: 0 })
    })
  })

  describe('the daily education reminder job', () => {
    const MEMBER = `edu-member-${tag}`
    const MEMBER_REFUSED = `edu-refused-${tag}`
    const run = () => (education.POST as unknown as Handler)({})
    const marker = async (key: string) => rows(`SELECT user_id FROM in_app_notifications WHERE organization_id = $1 AND data->>'dedupeKey' = $2`, [ORG_A, key])
    let session: { registrationOk: string; registrationRefused: string; certification: string }

    beforeAll(async () => {
      await insertMember(admin, ORG_A, { userId: MEMBER, name: 'Edu Member', email: `${MEMBER}@example.test` })
      await insertMember(admin, ORG_A, { userId: MEMBER_REFUSED, name: 'Edu Refused', email: `${MEMBER_REFUSED}@example.test` })
      const course = (await rows(`INSERT INTO training_courses (organization_id, course_code, course_name, course_category, delivery_method, is_active, is_mandatory, duration_hours) VALUES ($1, $2, $3, 'safety', 'online', true, false, 4) RETURNING id::text AS id`, [ORG_A, `EC-${tag}`, `Course ${tag}`]))[0].id
      const sessionId = (await rows(`INSERT INTO course_sessions (organization_id, course_id, session_code, start_date, end_date, delivery_method) VALUES ($1, $2, $3, current_date + 3, current_date + 3, 'online') RETURNING id::text AS id`, [ORG_A, course, `ES-${tag}`]))[0].id
      const registration = async (member: string) =>
        (await rows(`INSERT INTO course_registrations (organization_id, member_id, course_id, session_id) VALUES ($1, $2, $3, $4) RETURNING id::text AS id`, [ORG_A, member, course, sessionId]))[0].id as string
      const certification = (await rows(`INSERT INTO member_certifications (organization_id, member_id, certification_name, certification_number, issue_date, expiry_date) VALUES ($1, $2, $3, 'CN-1', current_date - 300, current_date + 30) RETURNING id::text AS id`, [ORG_A, MEMBER, `Certificate ${tag}`]))[0].id
      session = { registrationOk: await registration(MEMBER), registrationRefused: await registration(MEMBER_REFUSED), certification }
    })

    it('mails the registered members of the session and the holder of the expiring certification as the system role, and records each delivery once', async () => {
      boundary.mail.length = 0
      boundary.refuse.clear()

      const response = await run()
      const body = (await response.json()) as Row

      expect(response.status, JSON.stringify(body).slice(0, 600)).toBe(200)
      expect(boundary.mail.map((message) => message.to[0]).sort()).toEqual([`${MEMBER}@example.test`, `${MEMBER}@example.test`, `${MEMBER_REFUSED}@example.test`])
      expect(await marker(`education:session:${session.registrationOk}:3`)).toHaveLength(1)
      expect(await marker(`education:session:${session.registrationRefused}:3`)).toHaveLength(1)
      expect(await marker(`education:certification:${session.certification}:30`)).toHaveLength(1)
    })

    it('mails nothing the second time: the marker excludes what was delivered', async () => {
      boundary.mail.length = 0

      const response = await run()

      expect(response.status).toBe(200)
      expect(boundary.mail).toEqual([])
    })

    it('releases the marker of a mail the provider refused, so the next run tries again, and keeps the marker of the one it accepted', async () => {
      await admin.query(`DELETE FROM in_app_notifications WHERE organization_id = $1 AND data->>'dedupeKey' LIKE 'education:%'`, [ORG_A])
      boundary.mail.length = 0
      boundary.refuse.clear()
      boundary.refuse.add(`${MEMBER_REFUSED}@example.test`)

      const response = await run()

      expect(response.status, 'a failed delivery is a failed run, not a green one').toBe(500)
      expect(await marker(`education:session:${session.registrationOk}:3`)).toHaveLength(1)
      expect(await marker(`education:session:${session.registrationRefused}:3`)).toHaveLength(0)
      boundary.refuse.clear()
    })
  })

  describe('the rewards expiry scan', () => {
    const HOLDER = `reward-holder-${tag}`
    const NO_ADDRESS = `reward-nobody-${tag}`
    const lotDate = () => new Date(Date.now() + 6 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)
    const markers = async () => rows(`SELECT user_id, data->>'dedupeKey' AS key FROM in_app_notifications WHERE organization_id = $1 AND data->>'kind' = 'rewards_expiry_warning' ORDER BY user_id`, [ORG_B])

    beforeAll(async () => {
      await insertMember(admin, ORG_B, { userId: HOLDER, name: 'Reward Holder', email: `${HOLDER}@example.test` })
      await admin.query(
        `INSERT INTO reward_wallet_ledger (org_id, user_id, event_type, amount_credits, balance_after, source_type, expires_at) VALUES ($1, $2, 'earn', 100, 100, 'system', now() + interval '6 days'), ($1, $3, 'earn', 50, 50, 'system', now() + interval '6 days')`,
        [ORG_B, HOLDER, NO_ADDRESS],
      )
    })

    it('finds the lots in the organization of each member, reading the address from organization_members, and claims one marker per lot and tier', async () => {
      boundary.expiryMail.length = 0

      const result = await rewardsNotifications.notifyExpiringCredits(7)

      expect(result).toMatchObject({ success: true, sent: 1, failed: 0 })
      expect(boundary.expiryMail).toHaveLength(1)
      expect(boundary.expiryMail[0]).toMatchObject({ recipientEmail: `${HOLDER}@example.test`, expiringAmount: 100 })
      expect(await markers()).toEqual([{ user_id: HOLDER, key: `rewards-expiry:7:${lotDate()}` }])
    })

    it('warns nobody twice for the same lot and tier', async () => {
      boundary.expiryMail.length = 0

      const result = await rewardsNotifications.notifyExpiringCredits(7)

      expect(result).toMatchObject({ success: true, sent: 0, failed: 0 })
      expect(boundary.expiryMail).toEqual([])
      expect(await markers()).toHaveLength(1)
    })

    it('releases the marker when the mail cannot be sent, so the next run warns', async () => {
      await admin.query(`DELETE FROM in_app_notifications WHERE organization_id = $1 AND data->>'kind' = 'rewards_expiry_warning'`, [ORG_B])
      boundary.failExpiryMail = true
      try {
        const result = await rewardsNotifications.notifyExpiringCredits(7)

        expect(result).toMatchObject({ success: false, failed: 1 })
        expect(await markers()).toEqual([])
      } finally {
        boundary.failExpiryMail = false
      }
    })
  })

  describe('the rewards cron: anniversary awards', () => {
    const ORG_C = randomUUID()
    const secret = `native-rewards-cron-secret-${tag}-0123456789abcdef`
    const MEMBERS = [`anniversary-1-${tag}`, `anniversary-2-${tag}`]

    beforeAll(async () => {
      env({ CRON_SECRET_KEY: secret })
      await insertOrganization(admin, tag, { id: ORG_C, name: `Gamma Union ${tag}` })
      const program = randomUUID()
      await admin.query(`INSERT INTO recognition_programs (id, org_id, name, status) VALUES ($1, $2, 'Recognition', 'active')`, [program, ORG_C])
      await admin.query(
        `INSERT INTO recognition_award_types (id, org_id, program_id, name, kind, default_credit_amount, requires_approval) VALUES ($1, $2, $3, 'Work Anniversary', 'automated', 5, false)`,
        [randomUUID(), ORG_C, program],
      )
      await admin.query(
        `INSERT INTO reward_budget_envelopes (org_id, program_id, name, scope_type, period, amount_limit, starts_at, ends_at) VALUES ($1, $2, 'Annual budget', 'org', 'annual', 100, now() - interval '1 day', now() + interval '1 year')`,
        [ORG_C, program],
      )
      for (const member of MEMBERS) {
        await admin.query(
          `INSERT INTO organization_members (user_id, organization_id, role, status, is_primary, name, email, joined_at, created_at, updated_at) VALUES ($1, $2, 'member', 'active', false, $3, $4, CURRENT_DATE - interval '3 years', now(), now())`,
          [member, ORG_C, `Name ${member}`, `${member}@example.test`],
        )
      }
    })

    it('awards each member their anniversary as the system role: the award, the wallet ledger entry and the budget, in one transaction per organization with its audit entry', async () => {
      const response = await rewardsCron.POST(new NextRequest('http://localhost/api/rewards/cron?task=anniversaries', { method: 'POST', headers: { 'x-cron-secret': secret } }))

      expect(response.status, JSON.stringify(await response.clone().json()).slice(0, 800)).toBe(200)
      expect(await rows(`SELECT recipient_user_id, status FROM recognition_awards WHERE org_id = $1 ORDER BY recipient_user_id`, [ORG_C])).toEqual(MEMBERS.map((member) => ({ recipient_user_id: member, status: 'issued' })))
      expect(await rows(`SELECT user_id, event_type, amount_credits FROM reward_wallet_ledger WHERE org_id = $1 ORDER BY user_id`, [ORG_C])).toEqual(MEMBERS.map((member) => ({ user_id: member, event_type: 'earn', amount_credits: 5 })))
      expect(await rows(`SELECT amount_used FROM reward_budget_envelopes WHERE org_id = $1`, [ORG_C])).toEqual([{ amount_used: 10 }])
      expect(savepointHarness.audits.filter((entry) => entry.organizationId === ORG_C && entry.action === 'rewards.cron.anniversaries')).toHaveLength(1)
    })

    it('awards nobody a second time on the same day, and touches no other organization', async () => {
      const response = await rewardsCron.POST(new NextRequest('http://localhost/api/rewards/cron?task=anniversaries', { method: 'POST', headers: { 'x-cron-secret': secret } }))

      expect(response.status).toBe(200)
      expect(Number((await rows(`SELECT count(*)::int AS n FROM recognition_awards WHERE org_id = $1`, [ORG_C]))[0].n)).toBe(2)
      expect(Number((await rows(`SELECT count(*)::int AS n FROM recognition_awards WHERE org_id = ANY($1)`, [[ORG_A, ORG_B]]))[0].n)).toBe(0)
      expect(await rows(`SELECT amount_used FROM reward_budget_envelopes WHERE org_id = $1`, [ORG_C])).toEqual([{ amount_used: 10 }])
    })
  })

  describe('the public pilot application', () => {
    const application = (body: unknown) =>
      new NextRequest('http://localhost/api/pilot/apply', { method: 'POST', headers: { 'content-type': 'application/json', 'x-forwarded-for': '203.0.113.9' }, body: JSON.stringify(body) })

    it('records an application that names no organization as the system role, after the body is validated', async () => {
      const response = await pilotApply.POST(application({ organizationName: `Prospect ${tag}`, contactName: 'Pat Applicant', contactEmail: `pat-${tag}@example.test`, memberCount: 120, organizationType: 'local', sectors: ['education'] }))

      expect(response.status, await response.clone().text()).toBeLessThan(300)
      expect(await rows(`SELECT organization_name, contact_email, member_count FROM pilot_applications WHERE contact_email = $1`, [`pat-${tag}@example.test`])).toEqual([{ organization_name: `Prospect ${tag}`, contact_email: `pat-${tag}@example.test`, member_count: 120 }])
    })

    it('writes nothing for an application that does not validate', async () => {
      const response = await pilotApply.POST(application({ organizationName: `Invalid ${tag}`, contactName: 'No Email', contactEmail: 'not-an-email' }))

      expect(response.status).toBe(400)
      expect(await rows(`SELECT 1 FROM pilot_applications WHERE organization_name = $1`, [`Invalid ${tag}`])).toEqual([])
    })
  })

  describe('the signed unsubscribe link', () => {
    const RECIPIENT = `unsub-${tag}`
    const OTHER = `stays-${tag}`
    const secret = `native-unsubscribe-secret-${tag}`

    beforeAll(async () => {
      env({ COMMUNICATIONS_TRACKING_SECRET: secret })
      for (const [org, name] of [[ORG_A, 'A'], [ORG_B, 'B']] as const) {
        const list = (await rows(`INSERT INTO newsletter_distribution_lists (organization_id, name) VALUES ($1, $2) RETURNING id::text AS id`, [org, `List ${name} ${tag}`]))[0].id
        await admin.query(`INSERT INTO newsletter_list_subscribers (list_id, profile_id, email) VALUES ($1, $2, $3), ($1, $4, $5)`, [list, RECIPIENT, `${RECIPIENT}@example.test`, OTHER, `${OTHER}@example.test`])
      }
      // One organization already holds a preference for the recipient (the update path), the other holds none (the insert path).
      await admin.query(`INSERT INTO communication_preferences (organization_id, user_id) VALUES ($1, $2)`, [ORG_A, RECIPIENT])
    })

    it('ends the recipient\'s communications with every organization they belong to, records the consent, and leaves other recipients alone', async () => {
      const token = signTrackingPayload(secret, `${RECIPIENT}:unsubscribe-all`)
      const post = new NextRequest(`http://localhost/api/communications/unsubscribe/${RECIPIENT}?scope=all&token=${token}`, { method: 'POST' })

      const response = await unsubscribe.POST(post, { params: Promise.resolve({ recipientId: RECIPIENT }) })

      expect(response.status, await response.clone().text()).toBe(200)
      expect(await rows(`SELECT status FROM newsletter_list_subscribers WHERE profile_id = $1 ORDER BY status`, [RECIPIENT])).toEqual([{ status: 'unsubscribed' }, { status: 'unsubscribed' }])
      expect(await rows(`SELECT status FROM newsletter_list_subscribers WHERE profile_id = $1`, [OTHER])).toEqual([{ status: 'subscribed' }, { status: 'subscribed' }])
      expect(await rows(`SELECT organization_id::text AS org, email_enabled, globally_unsubscribed FROM communication_preferences WHERE user_id = $1 ORDER BY organization_id::text`, [RECIPIENT])).toEqual(
        [ORG_A, ORG_B].sort().map((org) => ({ org, email_enabled: false, globally_unsubscribed: true })),
      )
      expect(await rows(`SELECT organization_id::text AS org, status FROM consent_records WHERE user_id = $1 AND consent_type = 'email_marketing' ORDER BY organization_id::text`, [RECIPIENT])).toEqual(
        [ORG_A, ORG_B].sort().map((org) => ({ org, status: 'revoked' })),
      )
    })

    it('refuses a token that does not carry the recipient\'s own capability, and changes nothing', async () => {
      const forged = new NextRequest(`http://localhost/api/communications/unsubscribe/${OTHER}?scope=all&token=${signTrackingPayload(secret, `${RECIPIENT}:unsubscribe-all`)}`, { method: 'POST' })

      const response = await unsubscribe.POST(forged, { params: Promise.resolve({ recipientId: OTHER }) })

      expect(response.status).toBe(401)
      expect(await rows(`SELECT status FROM newsletter_list_subscribers WHERE profile_id = $1`, [OTHER])).toEqual([{ status: 'subscribed' }, { status: 'subscribed' }])
    })
  })
})
