/**
 * The dashboard reads of lib/dashboard-reads/*, lib/rewards/admin-reads.ts and the credit-history reads of lib/rewards/page-reads.ts on real PostgreSQL,
 * as the real roles.
 *
 * The pages behind them read tenant tables (cms_pages, training_courses, course_registrations, security_events, security_posture_checks,
 * integration_api_keys, integration_webhooks, integration_partners, integration_configs, organizations, recognition_programs, recognition_awards,
 * reward_wallet_ledger, organization_members) as the system role, which holds no grant on most of them, and swallowed the failure into an empty page.
 * This runs the unmodified functions with only the context boundary replaced by the harness's (a tenant transaction for withRLSContext, a system
 * transaction for withSystemContext) and proves that
 *   - each read returns the data of the organization it is asked for and none of another's, and the same statements with no organization set show nothing;
 *   - the system role (what the pages used) is refused those tables, so the pages could never have worked on the real roles;
 *   - the platform data-source overview is a system read over every organization; the manifest declares the system SELECT it needs.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertMember, insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-savepoint-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-savepoint-harness')).contextModule)

const { savepointHarness, RUNTIME_ROLE, SYSTEM_ROLE } = await import('./native-savepoint-harness')
const content = URL ? await import('@/lib/dashboard-reads/content') : null
const security = URL ? await import('@/lib/dashboard-reads/security') : null
const integrations = URL ? await import('@/lib/dashboard-reads/integrations') : null
const platformSettings = URL ? await import('@/lib/dashboard-reads/platform-settings') : null
const dataSource = URL ? await import('@/lib/dashboard-reads/data-source') : null
const rewardsAdmin = URL ? await import('@/lib/rewards/admin-reads') : null
const pageReads = URL ? await import('@/lib/rewards/page-reads') : null
const { sql } = await import('drizzle-orm')

describe.skipIf(!URL)('the organization dashboards read on the combined schema, as the real roles', () => {
  const tag = `dr${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const PLATFORM_ORG = randomUUID()
  const user = (name: string) => `u-${name}-${tag}`
  const U = { adminA: user('adminA'), memberA1: user('memberA1'), memberA2: user('memberA2'), memberB1: user('memberB1') }
  let admin: pg.Client

  /** drizzle wraps the driver's error in a "Failed query" error; the driver's message is its cause. */
  const refusedBy = async (work: Promise<unknown>) => {
    const error = await work.then(() => null, (failure: unknown) => failure as { message?: string; cause?: { message?: string } })
    return `${error?.message ?? ''} ${error?.cause?.message ?? ''}`
  }
  const one = async <T>(query: string, params: unknown[] = []) => (await admin.query(query, params)).rows[0] as T

  beforeAll(async () => {
    admin = await savepointHarness.start(URL!)
    await insertOrganization(admin, tag, { id: ORG_A })
    await insertOrganization(admin, tag, { id: ORG_B })
    // 'congress' is one of the two organization types the platform view reads.
    await insertOrganization(admin, tag, { id: PLATFORM_ORG, type: 'congress' })
    await admin.query(`UPDATE organizations SET settings = $2::jsonb, features_enabled = ARRAY['feature-x'] WHERE id = $1`, [PLATFORM_ORG, JSON.stringify({ sessionTimeout: 45 })])

    // content
    const page = (org: string, slug: string, title: string, type: string, status: string, views: number) =>
      admin.query(`INSERT INTO cms_pages (organization_id, title, slug, status, content_type, view_count, meta_description) VALUES ($1, $2, $3, $4, $5, $6, $7)`, [org, title, slug, status, type, views, `About ${title}`])
    await page(ORG_A, `tpl-a-${tag}`, `Template A ${tag}`, 'template', 'published', 7)
    await page(ORG_A, `res-a-${tag}`, `Resource A ${tag}`, 'resource', 'draft', 1)
    await page(ORG_B, `tpl-b-${tag}`, `Template B ${tag}`, 'template', 'published', 99)
    const course = async (org: string, code: string, active: boolean, mandatory: boolean) =>
      (await one<{ id: string }>(`INSERT INTO training_courses (organization_id, course_code, course_name, course_category, delivery_method, is_active, is_mandatory, duration_hours) VALUES ($1, $2, $3, 'safety', 'online', $4, $5, 8) RETURNING id::text AS id`, [org, code, `Course ${code}`, active, mandatory])).id
    const courseA = await course(ORG_A, `CA-${tag}`, true, true)
    await course(ORG_A, `CX-${tag}`, false, false)
    await course(ORG_B, `CB-${tag}`, true, false)
    const session = (await one<{ id: string }>(`INSERT INTO course_sessions (organization_id, course_id, session_code, start_date, end_date, delivery_method) VALUES ($1, $2, $3, current_date, current_date, 'online') RETURNING id::text AS id`, [ORG_A, courseA, `S-${tag}`])).id
    await admin.query(`INSERT INTO course_registrations (organization_id, member_id, course_id, session_id, completed) VALUES ($1, 'm1', $2, $3, true), ($1, 'm2', $2, $3, false)`, [ORG_A, courseA, session])

    // security
    await admin.query(`INSERT INTO security_events (organization_id, event_type, severity, status, description) VALUES ($1, 'login_failed', 'high', 'open', 'A one'), ($1, 'port_scan', 'low', 'blocked', 'A two'), ($2, 'login_failed', 'critical', 'open', 'B one')`, [ORG_A, ORG_B])
    await admin.query(`INSERT INTO security_posture_checks (organization_id, check_name, category, status, score) VALUES ($1, 'mfa', 'identity', 'warn', 80), ($2, 'mfa', 'identity', 'fail', 10)`, [ORG_A, ORG_B])

    // integrations
    await admin.query(`INSERT INTO integration_api_keys (organization_id, name, key_hash, key_prefix, scopes, created_by, usage_count) VALUES ($1, $2, 'hash-a', 'pfx-a', ARRAY['read'], 'seed', 12), ($1, $3, 'hash-a2', 'pfx-a2', ARRAY['write'], 'seed', 0), ($4, $5, 'hash-b', 'pfx-b', ARRAY['read'], 'seed', 5)`, [ORG_A, `Key A ${tag}`, `Key A2 ${tag}`, ORG_B, `Key B ${tag}`])
    await admin.query(`UPDATE integration_api_keys SET revoked_at = now() WHERE name = $1`, [`Key A2 ${tag}`])
    await admin.query(`INSERT INTO integration_api_keys (organization_id, name, key_hash, key_prefix, scopes, created_by, usage_count) VALUES ($1, $2, 'hash-p', 'pfx-p', ARRAY['platform'], 'seed', 3)`, [PLATFORM_ORG, `Platform key ${tag}`])
    await admin.query(`INSERT INTO integration_webhooks (organization_id, url, events, secret, created_by, description) VALUES ($1, 'https://a.example.test/hook', ARRAY['grievance.created'], 's', 'seed', $2), ($3, 'https://b.example.test/hook', ARRAY['x'], 's', 'seed', $4)`, [ORG_A, `Hook A ${tag}`, ORG_B, `Hook B ${tag}`])
    await admin.query(`INSERT INTO integration_partners (organization_id, name, provider, category) VALUES ($1, $2, 'p', 'hris'), ($3, $4, 'p', 'hris')`, [ORG_A, `Partner A ${tag}`, ORG_B, `Partner B ${tag}`])
    await admin.query(`INSERT INTO integration_configs (organization_id, type, provider, credentials, settings, enabled) VALUES ($1, 'hris', 'workday', '{}'::jsonb, '{"k":"a"}'::jsonb, true), ($2, 'hris', 'adp', '{}'::jsonb, '{"k":"b"}'::jsonb, false)`, [ORG_A, ORG_B])
    await admin.query(`INSERT INTO platform_services (service_name, status) VALUES ($1, 'healthy'), ($2, 'down') ON CONFLICT (service_name) DO UPDATE SET status = EXCLUDED.status`, [`web-${tag}`, `queue-${tag}`])

    // rewards
    for (const [org, who] of [[ORG_A, [U.adminA, U.memberA1, U.memberA2]], [ORG_B, [U.memberB1]]] as const) {
      for (const [index, userId] of who.entries()) await insertMember(admin, org, { userId, name: `${userId.split('-')[1]} Name`, email: `${userId}@example.test`, role: index === 0 && org === ORG_A ? 'admin' : 'member' })
    }
    const program = async (org: string, name: string) => (await one<{ id: string }>(`INSERT INTO recognition_programs (org_id, name, status) VALUES ($1, $2, 'active') RETURNING id::text AS id`, [org, name])).id
    const programA = await program(ORG_A, `Program A ${tag}`)
    const programB = await program(ORG_B, `Program B ${tag}`)
    const awardType = async (org: string, programId: string, name: string) =>
      (await one<{ id: string }>(`INSERT INTO recognition_award_types (org_id, program_id, name, kind, default_credit_amount, requires_approval) VALUES ($1, $2, $3, 'peer', 25, false) RETURNING id::text AS id`, [org, programId, name])).id
    const typeA = await awardType(ORG_A, programA, `Type A ${tag}`)
    const typeB = await awardType(ORG_B, programB, `Type B ${tag}`)
    const award = async (org: string, programId: string, typeId: string, recipient: string, status: string) =>
      (await one<{ id: string }>(`INSERT INTO recognition_awards (org_id, program_id, award_type_id, recipient_user_id, issuer_user_id, reason, status) VALUES ($1, $2, $3, $4, 'issuer', 'Thanks', $5) RETURNING id::text AS id`, [org, programId, typeId, recipient, status])).id
    const awardA = await award(ORG_A, programA, typeA, U.memberA1, 'issued')
    await award(ORG_A, programA, typeA, U.memberA2, 'pending')
    const awardB = await award(ORG_B, programB, typeB, U.memberB1, 'issued')
    const ledger = (org: string, userId: string, eventType: string, amount: number, balance: number, awardId: string | null, ago: string) =>
      admin.query(`INSERT INTO reward_wallet_ledger (org_id, user_id, event_type, amount_credits, balance_after, source_type, award_id, created_at) VALUES ($1, $2, $3, $4, $5, 'system', $6, now() - $7::interval)`, [org, userId, eventType, amount, balance, awardId, ago])
    await ledger(ORG_A, U.memberA1, 'earn', 100, 100, awardA, '3 hours')
    await ledger(ORG_A, U.memberA1, 'spend', -30, 70, null, '2 hours')
    await ledger(ORG_A, U.memberA1, 'expire', -10, 60, null, '1 hour')
    await ledger(ORG_B, U.memberB1, 'earn', 500, 500, awardB, '1 hour')

    // data-source
    await admin.query(`INSERT INTO external_data_sync_log (source, source_type, sync_id, started_at, status, sync_type) VALUES ($1, 'wages', $2, now(), 'completed', 'full')`, [`src-${tag}`, randomUUID()])
  }, 240_000)

  afterAll(async () => {
    await admin?.end()
    await savepointHarness.stop()
  })

  describe('the content dashboard', () => {
    it('reads the content and the active training courses of the organization, with their completions, and none of another organization', async () => {
      const a = await content!.loadContentDashboard(ORG_A)
      expect(a.items.map((item) => item.title).sort()).toEqual([`Resource A ${tag}`, `Template A ${tag}`])
      expect(a.items.find((item) => item.type === 'template')).toMatchObject({ status: 'published', views: 7, description: `About Template A ${tag}` })
      expect(a.courses.map((course) => course.courseCode)).toEqual([`CA-${tag}`])
      expect(a.courses[0]).toMatchObject({ completions: 1, isMandatory: true, durationLabel: '8 hours' })

      const b = await content!.loadContentDashboard(ORG_B)
      expect(b.items.map((item) => item.title)).toEqual([`Template B ${tag}`])
      expect(b.courses.map((course) => course.courseCode)).toEqual([`CB-${tag}`])
      expect(b.courses[0].completions).toBe(0)
    })

    it('reads one template by slug inside the organization, and finds no template of another organization', async () => {
      expect(await content!.loadContentTemplate(ORG_A, `tpl-a-${tag}`)).toMatchObject({ title: `Template A ${tag}`, status: 'published', content: [] })
      expect(await content!.loadContentTemplate(ORG_B, `tpl-a-${tag}`)).toBeNull()
      expect(await content!.loadContentTemplate(ORG_A, `missing-${tag}`)).toBeNull()
    })

    it('control: with no organization set the runtime role sees none of it, and the system role is refused the tables: the old pages could not work', async () => {
      const bare = await savepointHarness.context(RUNTIME_ROLE, null, null, async (tx) => ({
        pages: Array.from((await tx.execute(sql`SELECT id FROM cms_pages`)) as Iterable<unknown>).length,
        courses: Array.from((await tx.execute(sql`SELECT id FROM training_courses`)) as Iterable<unknown>).length,
      }))
      expect(bare).toEqual({ pages: 0, courses: 0 })
      // training_courses and course_registrations are not in this list: the daily education reminder job (a cross-organization system job) holds SELECT on them, so only the content table is refused.
      for (const table of ['cms_pages']) {
        expect(await refusedBy(savepointHarness.context(SYSTEM_ROLE, null, null, (tx) => tx.execute(sql.raw(`SELECT 1 FROM ${table}`))))).toMatch(/permission denied/)
      }
    })
  })

  describe('the security dashboard', () => {
    it('reads the events and the posture checks of the organization and none of another', async () => {
      const a = await security!.loadSecurityDashboard(ORG_A)
      expect(a.events.map((event) => event.description).sort()).toEqual(['A one', 'A two'])
      expect(a.events.find((event) => event.description === 'A one')).toMatchObject({ severity: 'high', status: 'open', eventType: 'login_failed' })
      expect(a.posture).toMatchObject([{ checkName: 'mfa', status: 'warn', score: 80 }])

      const b = await security!.loadSecurityDashboard(ORG_B)
      expect(b.events.map((event) => event.description)).toEqual(['B one'])
      expect(b.posture).toMatchObject([{ status: 'fail', score: 10 }])
    })

    it('control: no organization set reads nothing, and the system role is refused both tables', async () => {
      const bare = await savepointHarness.context(RUNTIME_ROLE, null, null, async (tx) => Array.from((await tx.execute(sql`SELECT id FROM security_events`)) as Iterable<unknown>).length)
      expect(bare).toBe(0)
      for (const table of ['security_events', 'security_posture_checks']) {
        expect(await refusedBy(savepointHarness.context(SYSTEM_ROLE, null, null, (tx) => tx.execute(sql.raw(`SELECT 1 FROM ${table}`))))).toMatch(/permission denied/)
      }
    })
  })

  describe('the integrations dashboard and the integration settings', () => {
    it('reads the API keys with their derived status, the webhooks and the partners of the organization and none of another', async () => {
      const a = await integrations!.loadIntegrationsDashboard(ORG_A)
      expect(a.apiKeys.map((key) => [key.name, key.status, key.requestCount])).toEqual([[`Key A ${tag}`, 'active', 12], [`Key A2 ${tag}`, 'revoked', 0]])
      expect(a.webhooks.map((hook) => hook.name)).toEqual([`Hook A ${tag}`])
      expect(a.partners.map((partner) => partner.name)).toEqual([`Partner A ${tag}`])

      const b = await integrations!.loadIntegrationsDashboard(ORG_B)
      expect(b.apiKeys.map((key) => key.name)).toEqual([`Key B ${tag}`])
      expect(b.webhooks.map((hook) => hook.name)).toEqual([`Hook B ${tag}`])
    })

    it('reads the integration configurations of the organization with their derived status, and counts the external-data tables of the deployment as the catalog lists them', async () => {
      const a = await integrations!.loadIntegrationSettings(ORG_A)
      expect(a.configs).toMatchObject([{ type: 'hris', provider: 'workday', status: 'active', metadata: { k: 'a' } }])
      expect((await integrations!.loadIntegrationSettings(ORG_B)).configs).toMatchObject([{ provider: 'adp', status: 'inactive' }])

      const catalog = Number((await one<{ n: string }>(`SELECT count(*) AS n FROM pg_catalog.pg_tables WHERE schemaname = 'public' AND starts_with(tablename, 'external_')`)).n)
      expect(a.domainStats.reduce((sum, stat) => sum + stat.tableCount, 0)).toBe(catalog)
    })

    it('control: no organization set reads nothing, and the system role is refused the keys and the configurations', async () => {
      expect(await savepointHarness.context(RUNTIME_ROLE, null, null, async (tx) => Array.from((await tx.execute(sql`SELECT id FROM integration_api_keys`)) as Iterable<unknown>).length)).toBe(0)
      for (const table of ['integration_api_keys', 'integration_configs']) {
        expect(await refusedBy(savepointHarness.context(SYSTEM_ROLE, null, null, (tx) => tx.execute(sql.raw(`SELECT 1 FROM ${table}`))))).toMatch(/permission denied/)
      }
    })
  })

  describe('the platform settings', () => {
    it('reads the settings, the keys and the services of the platform organization the person belongs to', async () => {
      const rows = await platformSettings!.loadPlatformSettings(PLATFORM_ORG)

      expect(rows).toMatchObject({ settings: { sessionTimeout: 45 }, featuresEnabled: ['feature-x'] })
      expect(rows?.apiKeys.map((key) => key.name)).toEqual([`Platform key ${tag}`])
      expect(rows?.apiKeys[0]).toMatchObject({ status: 'active', scopes: ['platform'], requestCount: 3 })
      expect(rows?.services.find((service) => service.serviceName === `queue-${tag}`)?.status).toBe('down')
    })

    it('has no platform settings for an organization that is not a platform one, and never shows another organization key', async () => {
      expect(await platformSettings!.loadPlatformSettings(ORG_A)).toBeNull()
      expect(await platformSettings!.loadPlatformSettings(randomUUID())).toBeNull()
    })
  })

  describe('the rewards administrator pages', () => {
    it('reports the awards, credits and recipients of the organization, and none of another', async () => {
      const a = await rewardsAdmin!.loadRewardsReport(ORG_A)
      expect(a.stats).toMatchObject({ active_programs: '1', total_awards: '2', issued_awards: '1', pending_awards: '1', unique_recipients: '1', unique_givers: '1' })
      expect(Number(a.stats.credits_issued)).toBe(100)
      expect(Number(a.stats.awards_last_30_days)).toBe(2)
      expect(a.recent).toHaveLength(2)
      expect(a.top).toMatchObject([{ award_count: '1', user_id: U.memberA1 }])
      expect(Number(a.top[0].total_points)).toBe(100)

      const b = await rewardsAdmin!.loadRewardsReport(ORG_B)
      expect(b.stats).toMatchObject({ total_awards: '1' })
      expect(Number(b.stats.credits_issued)).toBe(500)
    })

    it('lists the members with the balance and the lifetime totals of their wallet, filters by name or e-mail and pages', async () => {
      const wallets = await rewardsAdmin!.loadMemberWallets(ORG_A)
      expect(wallets.total).toBe(3)
      const alice = wallets.rows.find((row) => row.email === `${U.memberA1}@example.test`)
      expect(alice).toMatchObject({ balance: 60 })
      expect(Number(alice?.lifetime_earned)).toBe(100)
      expect(Number(alice?.lifetime_redeemed)).toBe(40)
      expect(wallets.rows[0].email).toBe(`${U.memberA1}@example.test`)

      expect((await rewardsAdmin!.loadMemberWallets(ORG_A, { search: 'memberA2' })).rows).toHaveLength(1)
      expect((await rewardsAdmin!.loadMemberWallets(ORG_A, { perPage: 2, page: 2 })).rows).toHaveLength(1)
      expect((await rewardsAdmin!.loadMemberWallets(ORG_B)).rows.map((row) => row.email)).toEqual([`${U.memberB1}@example.test`])
    })

    it("sums up the whole organization's wallets, whatever the search or the page, and nobody else's", async () => {
      const everyone = await rewardsAdmin!.loadMemberWallets(ORG_A)
      expect(everyone.summary).toEqual({ members: 3, withBalance: 1, outstanding: 60 })

      // A search or a page narrows the list, not the figures of the organization.
      expect((await rewardsAdmin!.loadMemberWallets(ORG_A, { search: 'memberA2' })).summary).toEqual(everyone.summary)
      expect((await rewardsAdmin!.loadMemberWallets(ORG_A, { perPage: 1, page: 3 })).summary).toEqual(everyone.summary)
      expect((await rewardsAdmin!.loadMemberWallets(ORG_B)).summary).toEqual({ members: 1, withBalance: 1, outstanding: 500 })
    })

    it('control: no organization set reads nothing, and the system role is refused the recognition tables', async () => {
      expect(await savepointHarness.context(RUNTIME_ROLE, null, null, async (tx) => Array.from((await tx.execute(sql`SELECT id FROM reward_wallet_ledger`)) as Iterable<unknown>).length)).toBe(0)
      // reward_wallet_ledger is not in this list: the rewards cron (a cross-organization system job) holds SELECT and INSERT on it, so only the recognition table is refused.
      for (const table of ['recognition_programs']) {
        expect(await refusedBy(savepointHarness.context(SYSTEM_ROLE, null, null, (tx) => tx.execute(sql.raw(`SELECT 1 FROM ${table}`))))).toMatch(/permission denied/)
      }
    })

    it('reads the balance a member can redeem, and a page of their ledger filtered by event type with totals over the whole ledger', async () => {
      expect(await pageReads!.loadWalletBalance(ORG_A, U.memberA1)).toBe(60)
      expect(await pageReads!.loadWalletBalance(ORG_A, U.memberA2)).toBe(0)
      expect(await pageReads!.loadWalletBalance(ORG_B, U.memberA1)).toBe(0)

      const all = await pageReads!.loadCreditHistory(ORG_A, U.memberA1, { eventType: 'all', limit: 25, page: 1 })
      expect(all.entries.map((entry) => entry.eventType)).toEqual(['expire', 'spend', 'earn'])
      expect(all).toMatchObject({ matching: 3, totalTransactions: 3, totalEarned: 100, totalSpent: 30, totalExpired: 10 })

      const spent = await pageReads!.loadCreditHistory(ORG_A, U.memberA1, { eventType: 'spend', limit: 25, page: 1 })
      expect(spent.entries.map((entry) => entry.eventType)).toEqual(['spend'])
      // The totals are over the whole ledger, not over the filter or the page.
      expect(spent).toMatchObject({ matching: 1, totalTransactions: 3, totalEarned: 100 })

      const second = await pageReads!.loadCreditHistory(ORG_A, U.memberA1, { eventType: 'all', limit: 25, page: 2 })
      expect(second.entries).toEqual([])
      expect(second.matching).toBe(3)
      expect(await pageReads!.loadCreditHistory(ORG_B, U.memberA1, { eventType: 'all', limit: 25, page: 1 })).toMatchObject({ entries: [], matching: 0, totalTransactions: 0 })
    })
  })

  describe('the platform data-source overview', () => {
    it('holds system SELECT on claim_deadlines and external_data_sync_log, as the storage-authority manifest declares for the overview', async () => {
      const granted = async (table: string) => (await one<{ ok: boolean }>(`SELECT has_table_privilege('${SYSTEM_ROLE}', '${table}', 'SELECT') AS ok`)).ok
      expect(await granted('claim_deadlines')).toBe(true)
      expect(await granted('external_data_sync_log')).toBe(true)
    })

    it('counts the records of every organization as the system role and lists the recent syncs', async () => {
      const overview = await dataSource!.loadDataSourceOverview()

      expect(overview.internalCounts.organization_members).toBeGreaterThanOrEqual(4)
      expect(Object.keys(overview.internalCounts).sort()).toEqual(['claim_deadlines', 'claims', 'dues_assignments', 'organization_members'])
      expect(Object.keys(overview.externalCounts).sort()).toEqual(['contribution_rates', 'cost_of_living_data', 'union_density', 'wage_benchmarks'])
      expect(overview.totalExternalRecords).toBe(Object.values(overview.externalCounts).reduce((sum, count) => sum + count, 0))
      expect(overview.syncLogs.map((entry) => entry.source)).toContain(`src-${tag}`)
    })

    it('fails, instead of showing zero records and no sync history, when a table cannot be read', async () => {
      await admin.query(`REVOKE SELECT ON external_data_sync_log FROM ${SYSTEM_ROLE}`)
      try {
        const failure = await refusedBy(dataSource!.loadDataSourceOverview())

        expect(failure).toMatch(/permission denied/)
      } finally {
        await admin.query(`GRANT SELECT ON external_data_sync_log TO ${SYSTEM_ROLE}`)
      }
    })
  })
})
