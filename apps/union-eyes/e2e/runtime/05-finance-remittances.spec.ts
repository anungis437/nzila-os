/** Base finance exclusion: real authenticated requests disclose no ledger and mutate no financial rows. */
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { runtimeRequestAs } from '../helpers/runtime-auth'
import { financeBoundarySnapshot } from '../../scripts/runtime/runtime-fixture-observations'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'

const primary = UE_TEST_ORGS.primary.id
const people = [
  UE_TEST_USERS.memberPrimary,
  UE_TEST_USERS.stewardPrimary,
  UE_TEST_USERS.adminPrimary,
  UE_TEST_USERS.executivePrimary,
  UE_TEST_USERS.financePreparer,
  UE_TEST_USERS.financeReconciler,
]

test('base financial compatibility denies every fixture role and preserves stored rows', async ({}, testInfo) => {
  test.skip(testInfo.project.name !== 'desktop', 'API boundary runs once at desktop')
  const before = await financeBoundarySnapshot()
  expect(before.fixtureFinancialMandates).toBe(0)
  for (const person of people) {
    const ctx = await runtimeRequestAs(person.userId, person.orgId)
    try {
      for (const path of ['/api/dues/ledger', '/api/dues/remittances']) {
        const response = await ctx.get(path)
        expect([403, 501], `${person.userId} ${path}`).toContain(response.status())
      }
      const attempt = await ctx.post('/api/dues/remittances', {
        data: {
          employerId: '10000000-0000-4000-8000-000000000099',
          periodStart: '2026-09-01',
          periodEnd: '2026-09-30',
          fiscalYear: 2026,
          fiscalMonth: 9,
          remittanceDate: '2026-10-05',
          totalAmount: '12500.00',
          memberCount: 42,
          remittanceNumber: 'BASE-MUST-REFUSE',
        },
      })
      expect([403, 501], `${person.userId} financial mutation`).toContain(attempt.status())
    } finally {
      await ctx.dispose()
    }
  }
  const outsider = await runtimeRequestAs(UE_TEST_USERS.memberSecondary.userId, primary)
  try {
    expect([403, 501]).toContain((await outsider.get('/api/dues/remittances')).status())
  } finally {
    await outsider.dispose()
  }
  const after = await financeBoundarySnapshot()
  expect(after).toEqual(before)
  const stateDir = process.env.UE_RUNTIME_STATE_DIR
  if (!stateDir) throw new Error('Owned runtime evidence directory required')
  await mkdir(stateDir, { recursive: true })
  await writeFile(join(stateDir, 'finance-boundary-state.json'), JSON.stringify(after))
})
