/**
 * The movement-insights consent read (lib/movement-insights/consent-read.ts) on real PostgreSQL, as the real roles.
 *
 * The data-sharing and movement-insights pages read data_aggregation_consent through the module-level handle with no organization set, so the runtime
 * role saw no row and every organization looked as if it had never consented. This runs the unmodified function, with only the context boundary replaced
 * by the harness's (a tenant transaction with app.current_org_id set), and proves that
 *   - an organization reads its own consent record, whether it consented or a stored row records no consent, and nothing of another's;
 *   - an organization with no row, and a caller with no tenant organization, read none;
 *   - the same select with no organization set (the old page behaviour) finds nothing.
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
const consents = URL ? await import('@/lib/movement-insights/consent-read') : null
const marketing = URL ? await import('@/db/schema/domains/marketing') : null

describe.skipIf(!URL)('the movement-insights consent read on the combined schema, as the real roles', () => {
  const tag = `mc${randomUUID().slice(0, 8)}`
  const GIVEN = randomUUID()
  const WITHDRAWN = randomUUID()
  const NONE = randomUUID()
  let admin: pg.Client

  beforeAll(async () => {
    admin = await harness.start(URL!)
    for (const id of [GIVEN, WITHDRAWN, NONE]) await insertOrganization(admin, tag, { id })
    await admin.query(
      `INSERT INTO data_aggregation_consent (organization_id, consent_given, consent_date, categories, expires_at)
       VALUES ($1, true, '2026-01-15 12:00:00', '{grievance-type,sector-trend}', '2027-01-15 12:00:00'), ($2, false, '2025-06-01 12:00:00', '{systemic-issue}', NULL)`,
      [GIVEN, WITHDRAWN],
    )
  }, 120_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  it('reads an organization\'s consent: when it was given, what it covers and when it expires', async () => {
    const consent = await consents!.readOrganizationConsent(GIVEN)
    expect(consent).toMatchObject({ consentGiven: true, categories: ['grievance-type', 'sector-trend'] })
    expect(consent?.consentDate.toISOString().slice(0, 10)).toBe('2026-01-15')
    expect(consent?.expiresAt?.toISOString().slice(0, 10)).toBe('2027-01-15')
  })

  it('returns a stored row that records no consent as it is, so the page can show it as no consent', async () => {
    expect(await consents!.readOrganizationConsent(WITHDRAWN)).toMatchObject({ consentGiven: false, categories: ['systemic-issue'], expiresAt: null })
  })

  it('reads nothing for an organization with no row, for another organization\'s id asked as someone else, and for no tenant organization', async () => {
    expect(await consents!.readOrganizationConsent(NONE)).toBeNull()
    expect(await consents!.readOrganizationConsent(randomUUID())).toBeNull()
    expect(await consents!.readOrganizationConsent('platform')).toBeNull()
  })

  it('control: another organization\'s context sees only its own row, and with no organization set the runtime role sees none', async () => {
    const asNone = await harness.tenant(RUNTIME_ROLE, NONE, null, (tx) => tx.select({ id: marketing!.dataAggregationConsent.organizationId }).from(marketing!.dataAggregationConsent))
    expect(asNone).toEqual([])
    const asGiven = await harness.tenant(RUNTIME_ROLE, GIVEN, null, (tx) => tx.select({ id: marketing!.dataAggregationConsent.organizationId }).from(marketing!.dataAggregationConsent))
    expect(asGiven).toEqual([{ id: GIVEN }])
    expect(await harness.tenant(RUNTIME_ROLE, null, null, (tx) => tx.select().from(marketing!.dataAggregationConsent))).toEqual([])
  })
})
