/**
 * Runtime acceptance 08 (finding R-33): the independent auditor reaches the ledger through a read-only assurance route.
 *
 * The finance routes keep their frozen role allow-list. Assurance authority is a live financial mandate holding the `audit`
 * power on the organization ledger, issued through the governed workflow. It carries no preparation, approval, execution or
 * reconciliation power, and a duty held for finance work does not confer it.
 */
import { execFileSync } from 'node:child_process'
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { financeAudit } from '../../scripts/runtime/db-inspect'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const PRIMARY = UE_TEST_ORGS.primary.id
const SECONDARY = UE_TEST_ORGS.secondary.id
const U = UE_TEST_USERS
const ROUTE = '/api/assurance/finance/ledger'

const as = (userId: string, orgId = PRIMARY): Promise<APIRequestContext> =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${userId}; selected_org_id=${orgId}` } })
const adminScript = (...args: string[]) =>
  execFileSync('npx', ['tsx', 'scripts/runtime/authority-admin.ts', ...args], { cwd: process.cwd(), env: { ...process.env, QA_TEST_ENV: 'true' }, shell: process.platform === 'win32', stdio: 'pipe' })
const apiOnly = (testInfo: { project: { name: string } }) => testInfo.project.name !== 'desktop'

test.describe.configure({ mode: 'serial' })

test.describe('independent auditor: read-only assurance of the dues ledger', () => {
  test.beforeAll(() => {
    adminScript('restore-fixtures')
  })

  test('the auditor reads the ledger through the assurance route, and the read is audited', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const response = await (await as(U.assuranceAuditor.userId)).get(ROUTE)
    expect(response.status(), await response.text()).toBe(200)
    const body = (await response.json()) as { data?: { entries?: unknown[]; readOnly?: boolean; authority?: { power?: string; mandateId?: string } } }
    const data = body.data ?? (body as unknown as NonNullable<typeof body.data>)
    expect(Array.isArray(data.entries)).toBe(true)
    expect(data.readOnly).toBe(true)
    expect(data.authority?.power).toBe('audit')
    const audit = (await financeAudit(PRIMARY)).filter((a) => a.action === 'assurance.finance.ledger_read')
    expect(audit.length).toBeGreaterThan(0)
    expect(audit.at(-1)?.user_id).toBe(U.assuranceAuditor.userId)
  })

  test('the audit duty confers nothing else: the auditor cannot prepare, reconcile or use the finance routes', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const auditor = await as(U.assuranceAuditor.userId)
    expect((await auditor.get('/api/dues/ledger')).status()).toBe(403)
    expect((await auditor.get('/api/dues/remittances')).status()).toBe(403)
    expect((await auditor.post('/api/dues/remittances', { data: {} })).status()).toBe(403)
    // A read-only route accepts no write.
    expect([404, 405]).toContain((await auditor.post(ROUTE, { data: {} })).status())
    expect([404, 405]).toContain((await auditor.delete(ROUTE)).status())
  })

  test('finance duties are not audit authority: auditor-titled user without a mandate, approver, preparer, reconciler, administrator, executive, steward and member are refused', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    for (const who of [U.auditorReadOnly, U.governanceApprover, U.financePreparer, U.financeReconciler, U.adminPrimary, U.executivePrimary, U.stewardPrimary, U.memberPrimary]) {
      const status = (await (await as(who.userId)).get(ROUTE)).status()
      expect(status, `${who.userId}`).toBe(403)
    }
  })

  test('another tenant, a platform identity and an unauthenticated caller are refused', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    expect((await (await as(U.memberSecondary.userId, SECONDARY)).get(ROUTE)).status()).toBe(403)
    expect([401, 403]).toContain((await (await as(U.platformOperator.userId)).get(ROUTE)).status())
    expect([401, 403]).toContain((await (await pwRequest.newContext({ baseURL: BASE })).get(ROUTE)).status())
    // A secondary-tenant user who names the primary organization borrows nothing: the organization comes from membership.
    expect((await (await as(U.memberSecondary.userId, PRIMARY)).get(ROUTE)).status()).toBe(403)
  })

  test('revoking the audit mandate removes the access at once; restoring reissues it through the governed path', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    adminScript('revoke-mandate', U.assuranceAuditor.userId, 'financial')
    expect((await (await as(U.assuranceAuditor.userId)).get(ROUTE)).status()).toBe(403)
    adminScript('restore-fixtures')
    expect((await (await as(U.assuranceAuditor.userId)).get(ROUTE)).status()).toBe(200)
  })
})
