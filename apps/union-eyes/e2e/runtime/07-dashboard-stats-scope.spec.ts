/**
 * Runtime acceptance 07 (finding R-24): dashboard statistics are scoped to the caller.
 *
 * The count of a caller's cases must equal what the caller can list through GET /api/cases (the same kernel read scope).
 * Seniority, an officer title or administration of the tenant is not a read, so a tenant-wide aggregate must not appear.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const U = UE_TEST_USERS

const as = (user: { userId: string; orgId: string }): Promise<APIRequestContext> =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${user.userId}; selected_org_id=${user.orgId}` } })

const OPEN = (status: string) => !['resolved', 'closed', 'rejected'].includes(status)
const apiOnly = (testInfo: { project: { name: string } }) => testInfo.project.name !== 'desktop'

async function listed(api: APIRequestContext): Promise<Array<{ status: string; priority: string; triageOnly?: boolean }>> {
  const body = await (await api.get('/api/cases')).json()
  const rows = ((body as { data?: unknown }).data ?? body) as unknown
  const list = Array.isArray(rows) ? rows : ((rows as { data?: unknown[] })?.data ?? [])
  // A triage designation lists queue metadata that is not a read, so it is not counted.
  return (list as Array<{ status: string; priority: string; triageOnly?: boolean }>).filter((r) => !r.triageOnly)
}

test.describe('R-24: dashboard statistics never exceed what the caller can read', () => {
  for (const [name, user] of [
    ['member', U.memberPrimary],
    ['steward', U.stewardPrimary],
    ['administrator', U.adminPrimary],
    ['executive', U.executivePrimary],
    ['supervisor', U.supervisorPrimary],
  ] as const) {
    test(`${name}: the counts equal the cases the caller can list`, async ({}, testInfo) => {
      test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
      const api = await as(user)
      const rows = await listed(api)
      const response = await api.get('/api/dashboard/stats')
      expect(response.status(), await response.text()).toBe(200)
      const stats = await response.json()
      expect(stats.activeClaims).toBe(rows.filter((r) => OPEN(r.status)).length)
      expect(stats.resolvedCases).toBe(rows.filter((r) => ['resolved', 'closed'].includes(r.status)).length)
      expect(stats.highPriorityClaims).toBe(rows.filter((r) => OPEN(r.status) && ['high', 'critical'].includes(r.priority)).length)
    })
  }

  test('the administrator and the executive hold no case relationship, so no tenant-wide total is disclosed to them', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    for (const user of [U.adminPrimary, U.executivePrimary]) {
      const stats = await (await (await as(user)).get('/api/dashboard/stats')).json()
      expect(stats.activeClaims + stats.resolvedCases + stats.pendingReviews).toBe(0)
    }
  })

  test('the organization member count is withheld from an ordinary member, and is not shown as zero', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const member = await (await (await as(U.memberPrimary)).get('/api/dashboard/stats')).json()
    expect(member.activeMembers).toBeNull()
    const steward = await (await (await as(U.stewardPrimary)).get('/api/dashboard/stats')).json()
    expect(typeof steward.activeMembers).toBe('number')
  })

  test('another tenant and a platform identity see none of the primary organization’s cases', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const other = await (await as(U.wrongOrgSteward)).get('/api/dashboard/stats')
    expect(other.status()).toBe(200)
    const stats = await other.json()
    const rows = await listed(await as(U.wrongOrgSteward))
    expect(stats.activeClaims).toBe(rows.filter((r) => OPEN(r.status)).length)
    // Platform administration confers no case authority at all.
    expect([401, 403, 404]).toContain((await (await as(U.platformOperator)).get('/api/dashboard/stats')).status())
  })

  test('the caller cannot widen the scope with a client-supplied organization', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const api = await as(U.wrongOrgSteward)
    const own = await (await api.get('/api/dashboard/stats')).json()
    const forged = await (await api.get(`/api/dashboard/stats?organizationId=${U.memberPrimary.orgId}`, { headers: { 'x-org-id': U.memberPrimary.orgId } })).json()
    expect(forged).toEqual(own)
  })
})
