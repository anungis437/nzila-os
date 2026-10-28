/**
 * Runtime acceptance 06: platform operator and federation / parent organization.
 *
 * Doctrine under test: the right to operate a platform, or to oversee an affiliate, does not confer the right to read a
 * union's confidential records, to route its cases, or to touch its money. Neither identity has been issued an institutional
 * mandate, so every institutional action must be refused, over HTTP, against the real database, without writing anything.
 */
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { inspectCase } from '../../scripts/runtime/db-inspect'
import { UE_TEST_CASES } from '../../tests/fixtures/test-cases'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const U = UE_TEST_USERS
const PRIMARY = UE_TEST_ORGS.primary.id
const CASE = UE_TEST_CASES.primaryAssigned.claimId

const as = (userId: string, orgId: string): Promise<APIRequestContext> =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${userId}; selected_org_id=${orgId}` } })

const refused = (status: number) => [401, 403, 404].includes(status)
const apiOnly = (testInfo: { project: { name: string } }) => testInfo.project.name !== 'desktop'

const outsiders = [
  { name: 'platform operator (same tenant, platform role)', user: U.platformOperator },
  { name: 'federation executive (parent organization tenant)', user: U.federationExecutive },
  { name: 'federation staff (parent organization tenant)', user: U.federationStaff },
] as const

test.describe('platform and federation identities hold no institutional authority', () => {
  for (const { name, user } of outsiders) {
    test(`${name}: cannot read, route or reassign a union case, and the case is unchanged`, async ({}, testInfo) => {
      test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
      const before = await inspectCase(CASE)
      const api = await as(user.userId, user.orgId)

      expect(refused((await api.get(`/api/cases/${CASE}`)).status()), 'case read').toBe(true)
      expect(refused((await api.get(`/api/cases/${CASE}/timeline`)).status()), 'case timeline').toBe(true)
      expect(refused((await api.post(`/api/cases/${CASE}/assign`, { data: { assigneeId: U.stewardPrimaryTwo.userId, reason: 'must be refused' } })).status()), 'routing').toBe(true)
      expect(refused((await api.patch(`/api/cases/${CASE}/transition`, { data: { targetStatus: 'under_review', reason: 'must be refused' } })).status()), 'transition').toBe(true)

      const listed = await api.get('/api/cases')
      if (listed.status() < 300) expect(JSON.stringify(await listed.json())).not.toContain(CASE)
      else expect(refused(listed.status())).toBe(true)

      expect(await inspectCase(CASE), 'a refused request writes nothing').toEqual(before)
    })

    test(`${name}: cannot reach the dues ledger or prepare a remittance`, async ({}, testInfo) => {
      test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
      const api = await as(user.userId, user.orgId)
      expect(refused((await api.get('/api/dues/ledger')).status()), 'ledger').toBe(true)
      expect(refused((await api.post('/api/dues/remittances', { data: {} })).status()), 'remittance').toBe(true)
    })

    test(`${name}: cannot administer the organization's triage designations`, async ({}, testInfo) => {
      test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
      const api = await as(user.userId, user.orgId)
      const response = await api.post('/api/triage-designations', {
        data: { scope: 'cases', userId: user.userId, expiresAt: new Date(Date.now() + 24 * 3600 * 1000).toISOString() },
      })
      expect(refused(response.status()), await response.text()).toBe(true)
    })
  }

  test('a federation identity cannot borrow the affiliate by naming it: the client-supplied organization is not an authority grant', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const api = await as(U.federationExecutive.userId, PRIMARY)
    expect(refused((await api.get(`/api/cases/${CASE}`)).status())).toBe(true)
    const listed = await api.get('/api/cases', { headers: { 'x-org-id': PRIMARY } })
    if (listed.status() < 300) expect(JSON.stringify(await listed.json())).not.toContain(CASE)
    else expect(refused(listed.status())).toBe(true)
  })

  test('the unauthenticated caller is refused the same resources', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const anonymous = await pwRequest.newContext({ baseURL: BASE })
    expect(refused((await anonymous.get(`/api/cases/${CASE}`)).status())).toBe(true)
    expect(refused((await anonymous.get('/api/dues/ledger')).status())).toBe(true)
  })
})
