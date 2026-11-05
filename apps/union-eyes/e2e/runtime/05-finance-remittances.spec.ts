/**
 * Runtime acceptance 05: the financial officer journey, on the real application.
 *
 * Finance is authorized by two independent things that no title supplies: the secretary_treasurer capacity AND a live financial
 * mandate that names the duty. The two QA officers hold SEGREGATED duties on one account (prepare versus reconcile), each issued
 * through the governed approval workflow (an independent approver decided each issuance). A president, an administrator and a
 * steward hold neither.
 */
import { execFileSync } from 'node:child_process'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { UE_TEST_FINANCE } from '../../tests/fixtures/test-finance'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'
import { financeAudit, financeRows } from '../../scripts/runtime/db-inspect'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const PRIMARY = UE_TEST_ORGS.primary.id
const SECONDARY = UE_TEST_ORGS.secondary.id
const U = UE_TEST_USERS

const as = (userId: string, orgId = PRIMARY): Promise<APIRequestContext> =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${userId}; selected_org_id=${orgId}` } })
const adminScript = (...args: string[]) =>
  execFileSync('npx', ['tsx', 'scripts/runtime/authority-admin.ts', ...args], { cwd: process.cwd(), env: { ...process.env, QA_TEST_ENV: 'true' }, shell: process.platform === 'win32', stdio: 'pipe' })
const apiOnly = (testInfo: { project: { name: string } }) => testInfo.project.name !== 'desktop'

const remittance = (number: string) => ({
  employerId: UE_TEST_FINANCE.employerId,
  periodStart: '2026-09-01',
  periodEnd: '2026-09-30',
  fiscalYear: 2026,
  fiscalMonth: 9,
  remittanceDate: '2026-10-05',
  totalAmount: '12500.00',
  memberCount: 42,
  remittanceNumber: number,
})
const rowsOf = (body: unknown) => (((body as { data?: { data?: Array<{ id: string; remittanceNumber?: string }> } }).data?.data) ?? []) as Array<{ id: string; remittanceNumber?: string }>

test.describe.configure({ mode: 'serial' })

test.describe('financial officer: remittances with segregated duties', () => {
  const number = `QA-REM-${Date.now()}`
  let remittanceId = ''

  test.beforeAll(() => {
    adminScript('restore-fixtures')
  })

  test('titles and roles without a financial mandate and the treasurer role are refused', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    for (const who of [U.adminPrimary.userId, U.executivePrimary.userId, U.stewardPrimary.userId, U.memberPrimary.userId, U.auditorReadOnly.userId]) {
      const ctx = await as(who)
      expect((await ctx.get('/api/dues/remittances')).status(), `${who} list`).toBe(403)
      expect((await ctx.post('/api/dues/remittances', { data: remittance('must-fail') })).status(), `${who} create`).toBe(403)
    }
    const outsider = await as(U.memberSecondary.userId, SECONDARY)
    expect((await outsider.get('/api/dues/remittances')).status()).toBe(403)
  })

  test('the preparer holds view and prepare: lists the ledger and prepares a remittance, which persists with its audit', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    test.skip(!process.env.DATABASE_URL, 'needs DATABASE_URL')
    const preparer = await as(U.financePreparer.userId)
    expect((await preparer.get('/api/dues/remittances')).status()).toBe(200)
    const created = await preparer.post('/api/dues/remittances', { data: remittance(number) })
    expect(created.status(), await created.text()).toBeLessThan(300)
    remittanceId = ((await created.json()) as { data: { data: { id: string } } }).data.data.id

    const [row] = await financeRows(remittanceId)
    expect(row).toMatchObject({ organization_id: PRIMARY, employer_id: UE_TEST_FINANCE.employerId, total_amount: '12500.00', member_count: 42, processing_status: 'pending', created_by: U.financePreparer.userId })
    const audit = await financeAudit(remittanceId)
    expect(audit.map((a) => a.action)).toContain('dues.remittance.create')
    expect(audit.find((a) => a.action === 'dues.remittance.create')?.user_id).toBe(U.financePreparer.userId)
  })

  test('a malformed remittance is refused and writes nothing', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const preparer = await as(U.financePreparer.userId)
    const before = rowsOf(await (await preparer.get('/api/dues/remittances')).json()).length
    const bad = await preparer.post('/api/dues/remittances', { data: { ...remittance('bad'), employerId: 'not-a-uuid', fiscalMonth: 13 } })
    expect([400, 422]).toContain(bad.status())
    expect(rowsOf(await (await preparer.get('/api/dues/remittances')).json()).length).toBe(before)
  })

  test('the duties are segregated: the preparer cannot reconcile and the reconciler cannot prepare', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const preparer = await as(U.financePreparer.userId)
    const reconciler = await as(U.financeReconciler.userId)
    const patch = { processingStatus: 'requires_review', notes: 'QA review note' }
    const byPreparer = await preparer.patch(`/api/dues/remittances/${remittanceId}`, { data: patch })
    expect([403, 404], `preparer reconcile: ${await byPreparer.text()}`).toContain(byPreparer.status())
    const byReconcilerCreate = await reconciler.post('/api/dues/remittances', { data: remittance('reconciler-must-fail') })
    expect([403, 404]).toContain(byReconcilerCreate.status())
  })

  test('the reconciler sees the ledger and reconciles; a caller cannot supply reconciliation outputs', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    const reconciler = await as(U.financeReconciler.userId)
    expect(rowsOf(await (await reconciler.get('/api/dues/remittances')).json()).map((r) => r.id)).toContain(remittanceId)
    expect((await reconciler.get(`/api/dues/remittances/${remittanceId}`)).status()).toBe(200)

    // The route is strict: reconciled flags and totals are engine outputs, never caller input.
    const forged = await reconciler.patch(`/api/dues/remittances/${remittanceId}`, { data: { isReconciled: true, variance: '0.00' } })
    expect([400, 422]).toContain(forged.status())

    const reviewed = await reconciler.patch(`/api/dues/remittances/${remittanceId}`, { data: { processingStatus: 'requires_review', notes: 'QA review note' } })
    expect(reviewed.status(), await reviewed.text()).toBe(200)
    const [row] = await financeRows(remittanceId)
    expect(row).toMatchObject({ processing_status: 'requires_review', notes: 'QA review note', is_reconciled: false })
    expect((await financeAudit(remittanceId)).map((a) => a.action)).toContain('dues.remittance.update')
  })

  test('revoking the preparer mandate removes the duty at once; the reconciler is unaffected; restoring reissues it through the governed path', async ({}, testInfo) => {
    test.skip(apiOnly(testInfo), 'API journey: runs once, at desktop')
    adminScript('revoke-mandate', U.financePreparer.userId, 'financial')
    const preparer = await as(U.financePreparer.userId)
    const refused = await preparer.post('/api/dues/remittances', { data: remittance('revoked-must-fail') })
    expect([403, 404], await refused.text()).toContain(refused.status())
    expect((await preparer.get('/api/dues/remittances')).status(), 'a revoked officer loses even view').toBe(403)
    expect((await (await as(U.financeReconciler.userId)).get('/api/dues/remittances')).status()).toBe(200)

    adminScript('restore-fixtures')
    const restored = await preparer.post('/api/dues/remittances', { data: remittance(`${number}-2`) })
    expect(restored.status(), await restored.text()).toBeLessThan(300)

    const stateDir = process.env.UE_RUNTIME_STATE_DIR ?? join(process.cwd(), '..', '..', '.ue-runtime')
    await mkdir(stateDir, { recursive: true })
    await writeFile(join(stateDir, 'finance-journey-state.json'), JSON.stringify({ remittanceId }))
  })
})
