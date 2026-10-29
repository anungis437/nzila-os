/**
 * Runtime acceptance 10: promotion of UNIT_VERIFIED security repairs to real HTTP proof on the production build.
 *
 * Each block names the historical defect it promotes. Unit tests proved the repaired handler in isolation; this proves the
 * deployed route, with the real session shim, the real database policies and real principals.
 *
 * R-42: the role of a QA-session caller used to default to 'member' everywhere, so every withRoleAuth route above the member floor\n * refused every caller. The role now comes from the caller's own active membership when the identity asserts none.\n * Still not covered: the real password login (R-43).
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { seedTestimonial, testimonialState } from '../../scripts/runtime/db-inspect'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const U = UE_TEST_USERS

const as = (user: { userId: string; orgId: string }): Promise<APIRequestContext> =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${user.userId}; selected_org_id=${user.orgId}` } })
const anonymous = () => pwRequest.newContext({ baseURL: BASE })
const apiOnly = (testInfo: { project: { name: string } }) => testInfo.project.name !== 'desktop'
const status = async (api: APIRequestContext, method: 'get' | 'post' | 'put' | 'patch' | 'delete', path: string) =>
  (await api[method](path, method === 'get' || method === 'delete' ? undefined : { data: {} })).status()

test.describe('promotions: rewards export, profile roles, operational metrics, public surface', () => {
  test('DEF-0B11-PRP rewards export: administrator only, as a no-store CSV; a member, a steward and an anonymous caller are refused', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const admin = await (await as(U.adminPrimary)).get('/api/rewards/export?type=awards')
    expect(admin.status()).toBe(200)
    expect(admin.headers()['content-type']).toContain('text/csv')
    expect(admin.headers()['cache-control']).toContain('no-store')
    expect(await status(await as(U.memberPrimary), 'get', '/api/rewards/export?type=awards')).toBe(403)
    expect(await status(await as(U.stewardPrimary), 'get', '/api/rewards/export?type=awards')).toBe(403)
    expect(await status(await anonymous(), 'get', '/api/rewards/export?type=awards')).toBe(401)
  })

  test('DEF-0B11-PRP profile roles: a caller reads only their own roles, whoever they name', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const response = await (await as(U.stewardPrimary)).get(`/api/profile/roles?userId=${U.memberPrimary.userId}`)
    expect(response.status()).toBe(200)
    const body = await response.json()
    expect(body).toEqual({ role: 'steward', roles: ['steward'] })
    expect(JSON.stringify(body)).not.toContain(U.memberPrimary.userId)
  })

  test('DEF-0B9-ML operational metrics: no organization role reaches platform counters', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    expect(await status(await anonymous(), 'get', '/api/metrics/operational')).toBe(401)
    for (const who of [U.memberPrimary, U.stewardPrimary, U.adminPrimary, U.executivePrimary]) {
      expect(await status(await as(who), 'get', '/api/metrics/operational'), who.userId).toBe(403)
    }
  })

  test('DEF-0B1 version and docs: the public version names no topology, and the API documentation is not public', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const version = await (await anonymous()).get('/api/version')
    expect(version.status()).toBe(200)
    const text = (await version.text()).toLowerCase()
    for (const leak of ['localhost', 'postgres', 'redis', 'azure', 'database_url', 'password', 'secret', '.internal', '10.', '192.168.']) expect(text, leak).not.toContain(leak)
    expect(Object.keys(JSON.parse(text)).sort()).toEqual(['app', 'appversion', 'artifactid', 'buildtimestamp', 'gitsha', 'releaseid'])
    expect(await status(await anonymous(), 'get', '/api/docs')).toBe(401)
    expect(await status(await anonymous(), 'get', '/api/docs/openapi')).toBe(401)
    expect(await status(await as(U.memberPrimary), 'get', '/api/docs')).toBe(403)
  })
})

test.describe('promotions: retired and unimplemented surfaces never claim success', () => {
  test('DEF-0B12-PLT v2 catch-all: every method is Gone, never a 200 that says a write succeeded', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const member = await as(U.memberPrimary)
    for (const method of ['get', 'post', 'put', 'patch', 'delete'] as const) {
      expect(await status(member, method, '/api/v2/anything'), method).toBe(410)
      expect(await status(await anonymous(), method, '/api/v2/anything'), `${method} anonymous`).toBe(401)
    }
  })

  test('DEF-0B4 carbon: 501 with no fabricated measurement, recommendation or certification', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const admin = await as(U.adminPrimary)
    for (const [method, path] of [['get', '/api/carbon/dashboard'], ['get', '/api/carbon/infrastructure'], ['post', '/api/carbon/validate']] as const) {
      const response = await admin[method](path, method === 'post' ? { data: {} } : undefined)
      expect(response.status(), path).toBe(501)
      const text = await response.text()
      for (const invented of ['totalEmissions', 'renewablePercentage', 'certificationEligible', 'validationScore', 'recommendations', '1245.67']) expect(text, `${path} ${invented}`).not.toContain(invented)
    }
  })

  test('DEF-0B12-CRUD tax paths: 501 for every caller, and the per-capita ledger is not served', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    for (const who of [U.memberPrimary, U.adminPrimary]) {
      const api = await as(who)
      for (const path of ['/api/tax/slips', '/api/tax/t106', '/api/tax/rl-1/generate', '/api/tax/cope/receipts']) {
        expect(await status(api, 'get', path), `${who.userId} GET ${path}`).toBe(501)
        expect(await status(api, 'post', path), `${who.userId} POST ${path}`).toBe(501)
      }
    }
  })
})

test.describe('R-42: role floors resolve the real membership role', () => {
  test('an administrator-floor route admits the organization administrator and refuses a steward, a member and an executive', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    expect(await status(await as(U.adminPrimary), 'get', '/api/docs')).toBe(200)
    for (const who of [U.stewardPrimary, U.memberPrimary, U.executivePrimary]) {
      expect(await status(await as(who), 'get', '/api/docs'), who.userId).toBe(403)
    }
  })

  test('a steward-floor route passes the role gate for a steward and an administrator and refuses a member at it', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    // The route then stops at an entitlement that is not enabled for the QA organization: a different refusal. What is proven
    // is that the ROLE gate no longer refuses real stewards and administrators.
    const roleGate = async (who: { userId: string; orgId: string }) => (await (await as(who)).get('/api/ai/copilot/query')).text()
    expect(await roleGate(U.stewardPrimary)).not.toContain('Requires steward role')
    expect(await roleGate(U.adminPrimary)).not.toContain('Requires steward role')
    expect(await roleGate(U.memberPrimary)).toContain('Requires steward role')
  })})

test.describe('promotion: DEF-0B10-PIL telemetry routes read only the caller\'s own organization', () => {
  for (const route of ['champions', 'readiness', 'friction', 'metrics']) {
    test(`pilot/${route}: the administrator reads their own organization; naming another is refused; a member and a steward are refused`, async ({}, testInfo) => {
      test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
      const admin = await as(U.adminPrimary)
      const own = await admin.get(`/api/pilot/${route}`)
      expect(own.status(), await own.text()).toBe(200)
      expect([400, 403, 404], 'a different organization named in the query').toContain((await admin.get(`/api/pilot/${route}?organizationId=${UE_TEST_ORGS.secondary.id}`)).status())
      expect((await (await as(U.memberPrimary)).get(`/api/pilot/${route}`)).status()).toBe(403)
      expect((await (await as(U.stewardPrimary)).get(`/api/pilot/${route}`)).status()).toBe(403)
      expect((await (await anonymous()).get(`/api/pilot/${route}`)).status()).toBe(401)
    })
  }
})

test.describe('promotions: role floors on organization settings, campaigns, health and safety, signatures, testimonials', () => {
  test('DEF-0B11-IDS organization settings: the administrator reads and writes allowed keys; protected keys are refused and unchanged; others are refused', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const admin = await as(U.adminPrimary)
    const before = await admin.get('/api/settings/organization')
    expect(before.status(), await before.text()).toBe(200)
    const settingsOf = async () => ((await (await admin.get('/api/settings/organization')).json()) as { data: { organization: { settings: Record<string, unknown> } } }).data.organization.settings
    const original = await settingsOf()
    for (const key of ['perCapitaRate', 'creditLedger', 'arbitraryKey']) {
      const refused = await admin.put('/api/settings/organization', { data: { settings: { [key]: key === 'perCapitaRate' ? 0.01 : { x: 1 } } } })
      expect(refused.status(), `${key} must be refused`).toBe(400)
      expect(await refused.text()).not.toContain('"x":1')
    }
    expect(await settingsOf(), 'a refused write changes nothing').toEqual(original)
    const allowed = await admin.put('/api/settings/organization', { data: { settings: { timezone: 'America/Toronto' } } })
    expect(allowed.status(), await allowed.text()).toBeLessThan(300)
    expect((await settingsOf()).timezone).toBe('America/Toronto')
    for (const who of [U.stewardPrimary, U.memberPrimary, U.executivePrimary]) {
      expect(await status(await as(who), 'get', '/api/settings/organization'), who.userId).toBe(403)
      expect((await (await as(who)).put('/api/settings/organization', { data: { settings: { timezone: 'UTC' } } })).status(), `${who.userId} write`).toBe(403)
    }
    expect((await (await as(U.wrongOrgSteward)).put('/api/settings/organization', { data: { settings: { timezone: 'UTC' } } })).status()).toBe(403)
    expect((await settingsOf()).timezone, 'no refused caller changed it').toBe('America/Toronto')
  })

  test('DEF-0B10-ORG campaigns: not readable by a member or a steward', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    for (const who of [U.memberPrimary, U.stewardPrimary]) {
      expect(await status(await as(who), 'get', '/api/organizing/campaigns'), who.userId).toBe(403)
    }
    expect(await status(await anonymous(), 'get', '/api/organizing/campaigns')).toBe(401)
  })

  test('DEF-0B8-HS incidents: a member is refused the list and the single-record read; the administrator reads the list', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const member = await as(U.memberPrimary)
    expect(await status(member, 'get', '/api/health-safety/incidents')).toBe(403)
    expect(await status(member, 'get', '/api/health-safety/incidents/00000000-0000-4000-8000-000000000001')).toBe(403)
    expect(await status(await as(U.adminPrimary), 'get', '/api/health-safety/incidents')).toBe(200)
    expect(await status(await anonymous(), 'get', '/api/health-safety/incidents')).toBe(401)
  })

  test('DEF-0B12-CRUD testimonials: no organization administrator, steward or member can change or delete a shared row, and the row is untouched', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const id = '00000000-0000-4000-8000-0000000000a1'
    await seedTestimonial(id)
    for (const who of [U.adminPrimary, U.stewardPrimary, U.memberPrimary]) {
      const api = await as(who)
      expect(await status(api, 'patch', `/api/testimonials/${id}`), `${who.userId} PATCH`).toBe(403)
      expect(await status(api, 'delete', `/api/testimonials/${id}`), `${who.userId} DELETE`).toBe(403)
    }
    expect(await testimonialState(id), 'the row survives every refused write').toEqual({ exists: true, visibility: 'internal' })
  })
  test('DEF-0B11-SOC signatures: a member cannot send a document for signature', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    expect(await status(await as(U.memberPrimary), 'post', '/api/signatures/documents')).toBe(403)
    expect(await status(await anonymous(), 'post', '/api/signatures/documents')).toBe(401)
  })
})