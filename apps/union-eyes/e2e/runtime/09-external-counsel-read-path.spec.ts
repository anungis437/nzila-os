/**
 * Runtime acceptance 09: external counsel on the legacy external-representation path (finding R-29, migration 0033; R-41).
 *
 * SCOPE, STATED PLAINLY: there is no HTTP surface that issues a representation authority or a matter grant, so the grants
 * here are a SYNTHETIC database fixture written by scripts/runtime/external-admin.ts. This spec proves the READ side only:
 * that text principals work after migration 0033, that the route is default-deny, that it projects a whitelist, that each
 * grant permission is enforced, and that revocation, expiry and a lapsed authority each remove access. It does NOT prove
 * that counsel can be granted access through the product (R-41), nor the kernel's counsel-assertion path.
 */
import { execFileSync } from 'node:child_process'
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const PRIMARY = UE_TEST_ORGS.primary.id
const U = UE_TEST_USERS
const MATTER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee01'
const OTHER_MATTER = 'eeeeeeee-eeee-4eee-8eee-eeeeeeeeee99'

const as = (user: { userId: string; orgId: string }): Promise<APIRequestContext> =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${user.userId}; selected_org_id=${user.orgId}` } })
const admin = (command: string) =>
  execFileSync('npx', ['tsx', 'scripts/runtime/external-admin.ts', command], { cwd: process.cwd(), env: { ...process.env, QA_TEST_ENV: 'true' }, shell: process.platform === 'win32', stdio: 'pipe' })
const matter = (id = MATTER, org = PRIMARY) => `/api/external/grievances/${id}?organizationId=${org}`
const apiOnly = (testInfo: { project: { name: string } }) => testInfo.project.name !== 'desktop'
const counsel = () => as(U.externalCounsel)

test.describe.configure({ mode: 'serial' })

test.describe('external counsel: default-deny, whitelist projection, per-permission enforcement, revocation', () => {
  test('without an authority and a grant, counsel is refused', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    admin('seed')
    admin('revoke')
    expect((await (await counsel()).get(matter())).status()).toBe(403)
  })

  test('with a recorded authority and a view grant (text principals), counsel reads a whitelisted projection and nothing internal', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    admin('seed')
    const response = await (await counsel()).get(matter())
    expect(response.status(), await response.text()).toBe(200)
    const body = (await response.json()) as { data: Record<string, unknown> }
    expect(Object.keys(body.data).sort()).toEqual(['caseNumber', 'filedDate', 'id', 'responseDeadline', 'status', 'step', 'summary', 'title'])
    expect(JSON.stringify(body)).not.toContain('PRIVATE internal description')
    expect(body.data.id).toBe(MATTER)
  })

  test('the grant is exact: another matter, another organization, a missing organization, another external user and the union’s own staff are refused', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const c = await counsel()
    expect((await c.get(matter(OTHER_MATTER))).status(), 'other matter').toBe(403)
    expect((await c.get(matter(MATTER, UE_TEST_ORGS.secondary.id))).status(), 'other organization').toBe(403)
    expect((await c.get(`/api/external/grievances/${MATTER}`)).status(), 'no organization').toBe(403)
    // An external user with no grant, in the same home tenant.
    expect((await (await as(U.memberSecondary)).get(matter())).status(), 'ungranted external user').toBe(403)
    // The route is not a back door for the union's own people: none of them holds a grant either.
    for (const who of [U.adminPrimary, U.executivePrimary, U.stewardPrimary]) {
      expect((await (await as(who)).get(matter())).status(), who.userId).toBe(403)
    }
    expect([401, 403]).toContain((await (await pwRequest.newContext({ baseURL: BASE })).get(matter())).status())
  })

  test('each grant permission is enforced: this grant is view-only, so documents and uploads are refused', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const c = await counsel()
    expect((await c.get(`/api/external/grievances/${MATTER}/documents?organizationId=${PRIMARY}`)).status()).toBe(403)
    const upload = await c.post(`/api/external/grievances/${MATTER}/documents/upload?organizationId=${PRIMARY}`, { data: {} })
    expect([403, 405, 415]).toContain(upload.status())
  })

  test('holding the external grant gives no access to the union’s internal records', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const c = await counsel()
    for (const path of [`/api/grievances/${MATTER}`, `/api/cases/${MATTER}`, '/api/dues/ledger', '/api/assurance/finance/ledger']) {
      const status = (await c.get(path)).status()
      expect([401, 403, 404], `${path} -> ${status}`).toContain(status)
    }
  })

  for (const [name, command] of [
    ['the matter grant expires', 'expire'],
    ['the authority lapses while the grant is still active', 'authority-lapse'],
    ['the authority and grant are revoked', 'revoke'],
  ] as const) {
    test(`access ends at once when ${name}, and a reissued fixture restores it`, async ({}, testInfo) => {
      test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
      admin('seed')
      expect((await (await counsel()).get(matter())).status(), 'before').toBe(200)
      admin(command)
      expect((await (await counsel()).get(matter())).status(), 'after').toBe(403)
      admin('seed')
      expect((await (await counsel()).get(matter())).status(), 'reissued').toBe(200)
    })
  }
})
