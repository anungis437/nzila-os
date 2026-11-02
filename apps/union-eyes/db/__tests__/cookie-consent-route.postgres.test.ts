/**
 * POST /api/gdpr/cookie-consent on real PostgreSQL, as the real roles (UE-CONV-H-007).
 *
 * cookie_consents.user_id is a foreign key to profiles(id): the profile row of a signed-in visitor, a uuid. The declaration called it text and named
 * profiles.user_id, and the route handed the session's identity string straight to the insert, so a signed-in visitor's save failed with an invalid-uuid or
 * foreign-key fault and only an anonymous visitor's succeeded. This runs the unmodified route against the combined Django + Drizzle schema with only the
 * request boundary replaced (see native-route-harness.ts), and proves that
 *   - an anonymous visitor saves a record that belongs to nobody, and it is audited under the system actor;
 *   - a signed-in visitor's record holds the profile uuid, not the identity string, and updating it again keeps it;
 *   - a signed-in visitor with no profile row is recorded like an anonymous one, not refused;
 *   - a record a signed-in member holds cannot be changed by another member or by an anonymous visitor, and a record never moves organization;
 *   - a body that is not valid is a client error, and writes nothing.
 *
 * Skipped unless UE_AUTHORITY_COMBINED_URL points at an ADMIN connection to a disposable, fully bootstrapped database.
 */
import { randomUUID } from 'node:crypto'
import type pg from 'pg'
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest'

const URL = process.env.UE_AUTHORITY_COMBINED_URL

const session = vi.hoisted(() => ({ user: null as { id: string } | null }))

vi.mock('@/db/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/db', async () => ({ db: (await import('./native-route-harness')).ambientDb }))
vi.mock('@/lib/db/with-rls-context', async () => (await import('./native-route-harness')).rlsContextModule)
vi.mock('@/lib/audit/atomic-audit', async () => ({ persistAtomicAudit: (await import('./native-route-harness')).recordAudit }))
vi.mock('@/lib/api-auth-guard', () => ({ getCurrentUser: async () => session.user }))
vi.mock('@/lib/public-intake/guard', () => ({ guardPublicIntake: async (request: Request) => ({ ok: true, json: await request.json().catch(() => ({})) }) }))

const { harness } = await import('./native-route-harness')
const route = URL ? await import('@/app/api/gdpr/cookie-consent/route') : null

type Row = Record<string, unknown>

describe.skipIf(!URL)('the cookie consent route on the combined schema, as the real roles', () => {
  let admin: pg.Client
  const tag = randomUUID().slice(0, 8)
  const ORG = randomUUID()
  const OTHER_ORG = randomUUID()
  const owner = { identity: `entra|owner-${tag}`, profile: randomUUID() }
  const stranger = { identity: `entra|stranger-${tag}`, profile: randomUUID() }

  const post = (payload: unknown, user: { id: string } | null = null) => {
    session.user = user
    return (route!.POST as unknown as (request: Request) => Promise<Response>)(
      new Request('http://localhost/api/gdpr/cookie-consent', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(payload) }),
    )
  }
  const stored = async (consentId: string) => (await admin.query(`SELECT * FROM public.cookie_consents WHERE consent_id = $1`, [consentId])).rows as Row[]
  const newOrganization = (id: string) =>
    admin.query(
      `INSERT INTO organizations (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated, member_count, active_member_count, settings, features_enabled, status, created_at, updated_at, remittance_day)
       VALUES ($1,$2,$3,'local','{}',0,'{}',false,0,0,'{}','{}','active',now(),now(),1)`,
      [id, `Cookie ${id}`, `cookie-${id}`],
    )

  beforeAll(async () => {
    admin = await harness.start(URL!)
    await newOrganization(ORG)
    await newOrganization(OTHER_ORG)
    for (const who of [owner, stranger]) {
      await admin.query(`INSERT INTO public.profiles (id, user_id, email) VALUES ($1, $2, $3)`, [who.profile, who.identity, `${who.profile}@example.org`])
    }
  }, 60_000)

  afterAll(async () => {
    await admin?.end()
    await harness.stop()
  })

  it('saves an anonymous visitor\'s record, which belongs to nobody, and audits it under the system actor', async () => {
    const consentId = randomUUID()
    const response = await post({ consentId, organizationId: ORG, functional: true, analytics: false, marketing: false })
    expect(response.status).toBe(200)
    const rows = await stored(consentId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ organization_id: ORG, user_id: null, essential: true, functional: true, analytics: false })
    expect(harness.audits.some((audit) => audit.action === 'gdpr.cookie_consent.save' && audit.userId === 'system:cookie-consent' && audit.resourceId === rows[0].id)).toBe(true)
  })

  it('stores the profile uuid of a signed-in visitor, not the identity string, and keeps it on an update', async () => {
    const consentId = randomUUID()
    expect((await post({ consentId, organizationId: ORG, analytics: true }, { id: owner.identity })).status).toBe(200)
    let rows = await stored(consentId)
    expect(rows[0].user_id).toBe(owner.profile)
    expect(rows[0].analytics).toBe(true)

    expect((await post({ consentId, organizationId: ORG, analytics: false, marketing: true }, { id: owner.identity })).status).toBe(200)
    rows = await stored(consentId)
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ user_id: owner.profile, analytics: false, marketing: true })
  })

  it('records a signed-in visitor with no profile row like an anonymous one', async () => {
    const consentId = randomUUID()
    const response = await post({ consentId, organizationId: ORG, functional: true }, { id: `entra|no-profile-${tag}` })
    expect(response.status).toBe(200)
    expect((await stored(consentId))[0].user_id).toBeNull()
  })

  it('refuses a change by another member or by an anonymous visitor, and refuses a move to another organization', async () => {
    const consentId = randomUUID()
    expect((await post({ consentId, organizationId: ORG, analytics: true }, { id: owner.identity })).status).toBe(200)
    expect((await post({ consentId, organizationId: ORG, analytics: false }, { id: stranger.identity })).status).toBe(403)
    expect((await post({ consentId, organizationId: ORG, analytics: false })).status).toBe(403)
    expect((await post({ consentId, organizationId: OTHER_ORG, analytics: false }, { id: owner.identity })).status).toBe(403)
    expect((await stored(consentId))[0]).toMatchObject({ organization_id: ORG, user_id: owner.profile, analytics: true })
  })

  it('answers a client error and writes nothing for a body that is not valid, or an organization that does not exist', async () => {
    const before = Number((await admin.query(`SELECT count(*) FROM public.cookie_consents`)).rows[0].count)
    expect((await post({ consentId: 'not-a-uuid', organizationId: ORG })).status).toBe(400)
    expect((await post({ consentId: randomUUID(), organizationId: 'nope' })).status).toBe(400)
    expect((await post({ consentId: randomUUID(), organizationId: randomUUID() })).status).toBe(400)
    expect(Number((await admin.query(`SELECT count(*) FROM public.cookie_consents`)).rows[0].count)).toBe(before)
  })
})
