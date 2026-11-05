/**
 * The communications hub's read (lib/communications/hub-metrics.ts) on real PostgreSQL, as the real roles.
 *
 * The hub page read campaigns, distribution lists, templates and SMS campaigns through the module-level handle with no organization set, so the
 * runtime role saw none of them and the page rendered zeros, and a failure was rendered as the same zeros. This runs the unmodified loader, with only
 * the context boundary replaced by the harness's (a tenant transaction with app.current_org_id set), and proves that
 *   - the counts, the subscriber total and the recent-campaign feed are the organization's own and match what was seeded;
 *   - another organization's rows are counted nowhere, and an organization with none gets zeros from a real read;
 *   - the same statements with no organization set (the old page behaviour) read nothing.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'
import { insertOrganization } from './page-reads-seed'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)

const { harness, RUNTIME_ROLE } = await import('./native-route-harness')
const hub = URL ? await import('@/lib/communications/hub-metrics') : null
const schema = URL ? await import('@/db/schema') : null

describe.skipIf(!URL)('the communications hub read on the combined schema, as the real roles', () => {
  const tag = `ch${randomUUID().slice(0, 8)}`
  const ORG_A = randomUUID()
  const ORG_B = randomUUID()
  const EMPTY = randomUUID()
  let admin: pg.Client

  const campaign = (organizationId: string, name: string, status: string, createdAt: string) =>
    admin.query(
      `INSERT INTO campaigns (organization_id, name, type, channel, created_by, status, created_at) VALUES ($1, $2, 'broadcast', 'email', 'user-1', $3, $4)`,
      [organizationId, `${name}-${tag}`, status, createdAt],
    )

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const id of [ORG_A, ORG_B, EMPTY]) await insertOrganization(admin, tag, { id })

    await campaign(ORG_A, 'draft', 'draft', '2026-01-01T00:00:00Z')
    await campaign(ORG_A, 'scheduled', 'scheduled', '2026-01-02T00:00:00Z')
    await campaign(ORG_A, 'sending', 'sending', '2026-01-03T00:00:00Z')
    await campaign(ORG_A, 'sent-1', 'sent', '2026-01-04T00:00:00Z')
    await campaign(ORG_A, 'sent-2', 'sent', '2026-01-05T00:00:00Z')
    await campaign(ORG_A, 'paused', 'paused', '2026-01-06T00:00:00Z')
    await campaign(ORG_A, 'newest', 'draft', '2026-01-07T00:00:00Z')
    await campaign(ORG_B, 'b-sent', 'sent', '2026-02-01T00:00:00Z')
    await campaign(ORG_B, 'b-scheduled', 'scheduled', '2026-02-02T00:00:00Z')

    await admin.query(`INSERT INTO newsletter_distribution_lists (organization_id, name, subscriber_count) VALUES ($1, $2, 40), ($1, $3, 2), ($4, $5, 1000)`, [ORG_A, `List 1 ${tag}`, `List 2 ${tag}`, ORG_B, `B list ${tag}`])
    await admin.query(`INSERT INTO message_templates (organization_id, name, type, body, created_by) VALUES ($1, $2, 'email', 'b', 'u'), ($1, $3, 'sms', 'b', 'u'), ($4, $5, 'email', 'b', 'u')`, [ORG_A, `T1 ${tag}`, `T2 ${tag}`, ORG_B, `BT ${tag}`])
    await admin.query(`INSERT INTO sms_campaigns (organization_id, name, message) VALUES ($1, $2, 'm'), ($3, $4, 'm'), ($3, $5, 'm')`, [ORG_A, `S1 ${tag}`, ORG_B, `BS1 ${tag}`, `BS2 ${tag}`])
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  it('counts the organization\'s own campaigns, lists, templates and SMS campaigns and feeds its newest campaigns', async () => {
    const metrics = await hub!.loadCommunicationsHubMetrics(ORG_A)
    expect(metrics).toMatchObject({ activeCampaignCount: 4, scheduledCount: 1, sentCount: 2, listCount: 2, totalSubscribers: 42, templateCount: 2, smsCampaignCount: 1 })
    expect(metrics.recentCampaigns.map((row) => row.name)).toEqual([`newest-${tag}`, `paused-${tag}`, `sent-2-${tag}`, `sent-1-${tag}`, `sending-${tag}`])
  })

  it('counts another organization\'s own rows for it and none of the first organization\'s', async () => {
    const metrics = await hub!.loadCommunicationsHubMetrics(ORG_B)
    expect(metrics).toMatchObject({ activeCampaignCount: 2, scheduledCount: 1, sentCount: 1, listCount: 1, totalSubscribers: 1000, templateCount: 1, smsCampaignCount: 2 })
    expect(metrics.recentCampaigns.map((row) => row.name)).toEqual([`b-scheduled-${tag}`, `b-sent-${tag}`])
  })

  it('answers an organization with nothing with real zeros', async () => {
    expect(await hub!.loadCommunicationsHubMetrics(EMPTY)).toEqual({
      activeCampaignCount: 0, scheduledCount: 0, sentCount: 0, listCount: 0, totalSubscribers: 0, templateCount: 0, smsCampaignCount: 0, recentCampaigns: [],
    })
  })

  it('control: the same tables read with no organization set show the runtime role nothing, which is why the page read needs its context', async () => {
    const seen = await harness.tenant(RUNTIME_ROLE, null, null, async (tx) => ({
      campaigns: await tx.select().from(schema!.campaigns),
      lists: await tx.select().from(schema!.newsletterDistributionLists),
      templates: await tx.select().from(schema!.messageTemplates),
      sms: await tx.select().from(schema!.smsCampaigns),
    }))
    expect(seen).toEqual({ campaigns: [], lists: [], templates: [], sms: [] })
  })
})
