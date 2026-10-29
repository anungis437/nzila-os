/**
 * Runtime acceptance 10: promotion of UNIT_VERIFIED security repairs to real HTTP proof on the production build.
 *
 * Each block names the historical defect it promotes. Unit tests proved the repaired handler in isolation; this proves the
 * deployed route, with the real session shim, the real database policies and real principals.
 *
 * NOT PROMOTED HERE, AND WHY: the telemetry routes (DEF-0B10-PIL) and any other withRoleAuth route above the member floor.
 * The runtime authenticates through the QA acceptance session, whose identity carries no role, so getCurrentUser() reports
 * 'member' and those routes refuse EVERY caller, administrators included (R-42). The real password login cannot run in this
 * runtime because AUTH_DATABASE_URL, the dedicated auth-gateway role, is not provisioned (R-43). A refusal here would prove
 * nothing about the repair, so it is not asserted as one.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
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
