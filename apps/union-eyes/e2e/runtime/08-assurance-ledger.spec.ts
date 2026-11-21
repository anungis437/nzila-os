/** A financial audit title or platform role does not resurrect excluded ledger access. */
import { test, expect, request } from '@playwright/test'
import { PLATFORM_TITLE_WITHOUT_ELIGIBILITY, runtimeRequestAs } from '../helpers/runtime-auth'
import { financeBoundarySnapshot } from '../../scripts/runtime/runtime-fixture-observations'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

const route = '/api/assurance/finance/ledger'
test('financial assurance stays denied under actual canonical sessions and discloses no ledger', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'API boundary runs once at desktop')
  const before = await financeBoundarySnapshot()
  expect(before.fixtureFinancialMandates).toBe(0)
  for (const person of [
    UE_TEST_USERS.assuranceAuditor,
    UE_TEST_USERS.auditorReadOnly,
    UE_TEST_USERS.governanceApprover,
    UE_TEST_USERS.financePreparer,
    UE_TEST_USERS.financeReconciler,
    UE_TEST_USERS.adminPrimary,
    UE_TEST_USERS.executivePrimary,
    UE_TEST_USERS.stewardPrimary,
    UE_TEST_USERS.memberPrimary,
    UE_TEST_USERS.platformOperator,
    UE_TEST_USERS.memberSecondary,
  ]) {
    const ctx = await runtimeRequestAs(person.userId, person.orgId)
    try {
      const response = await ctx.get(route)
      // A platform-tier title never selected an organization (runtime-auth.ts), so its session is refused outright.
      expect(PLATFORM_TITLE_WITHOUT_ELIGIBILITY.has(person.userId) ? [401, 403] : [403, 501], person.userId).toContain(response.status())
      const payload = await response.json()
      expect(payload.entries).toBeUndefined()
      expect(payload.data?.entries).toBeUndefined()
      expect([404, 405]).toContain((await ctx.post(route, { data: {} })).status())
      expect([404, 405]).toContain((await ctx.delete(route)).status())
    } finally {
      await ctx.dispose()
    }
  }
  const anonymous = await request.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL })
  try {
    expect([401, 403]).toContain((await anonymous.get(route)).status())
  } finally {
    await anonymous.dispose()
  }
  expect(await financeBoundarySnapshot()).toEqual(before)
})
