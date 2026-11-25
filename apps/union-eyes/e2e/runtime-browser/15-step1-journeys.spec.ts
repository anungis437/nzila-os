import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect } from '@playwright/test'
import { computeTotp } from '@nzila/platform-auth/mfa'
import { loginRuntimePage, runtimeRequestAs } from '../helpers/runtime-auth'
import { readRuntimeFixtureAuth } from '../../scripts/runtime/fixture-auth'
import { UE_TEST_USER_PASSWORD } from '../../tests/fixtures/test-users'
import { queryOwnedRuntime } from '../../scripts/runtime/db-inspect'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

/**
 * The Step 1 journeys that sit beside the sign-in and filing matrix. Each one uses the signed-in browser session,
 * reads the row or audit the route committed, and checks the refusal next to the success.
 */
const PRIMARY = UE_TEST_ORGS.primary.id
const U = UE_TEST_USERS
const STATE_DIR = process.env.UE_RUNTIME_STATE_DIR ?? join(process.cwd(), '..', '..', '.ue-runtime')
const EVIDENCE: Array<Record<string, unknown>> = []
const stamp = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`

async function sql<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  return queryOwnedRuntime<T>(text, values)
}

const audit = (action: string, resourceId: string) =>
  sql<{ action: string }>(
    `SELECT action FROM public.audit_logs WHERE organization_id = $1 AND resource_id = $2 AND action = $3`,
    [PRIMARY, resourceId, action],
  )

test.describe.configure({ mode: 'serial', timeout: 180_000 })

test.beforeEach(async ({ page }) => {
  await page.addLocatorHandler(
    page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^(Reject All|Tout refuser)$/i }) }).first(),
    async (dialog) => {
      await dialog.getByRole('button', { name: /^(Reject All|Tout refuser)$/i }).click()
    },
  )
})

test.afterAll(async ({}, testInfo) => {
  await mkdir(join(STATE_DIR, 'evidence'), { recursive: true })
  await writeFile(join(STATE_DIR, 'evidence', `step1-journeys-${testInfo.project.name}.json`), JSON.stringify(EVIDENCE, null, 2))
})

test('invitation: create, refuse a forged token, redeem, and revoke a second offer', async ({ page }, testInfo) => {
  await loginRuntimePage(page, U.adminPrimary.userId, PRIMARY)
  const admin = page.context().request
  const email = `step1.${stamp()}@nzila.test`
  const created = await admin.post('/api/auth/invite/create', { data: { email, role: 'member' } })
  expect(created.status(), await created.text()).toBe(201)
  const invitation = await created.json()
  const inviteId = invitation.inviteId as string
  expect(inviteId).toBeTruthy()
  expect(invitation).not.toHaveProperty('token')
  const stored = await sql<{ email: string; accepted_at: string | null }>(
    `SELECT email, accepted_at FROM user_management.invites WHERE id = $1`,
    [inviteId],
  )
  expect(stored[0]?.email).toBe(email)
  expect(stored[0]?.accepted_at).toBeNull()

  const forged = await page.context().request.post('/api/auth/invite/accept', {
    data: { token: 'forged-token-value', firstName: 'No', lastName: 'One' },
  })
  expect(forged.status()).toBeGreaterThanOrEqual(400)
  expect((await sql<{ accepted_at: string | null }>(`SELECT accepted_at FROM user_management.invites WHERE id = $1`, [inviteId]))[0]?.accepted_at).toBeNull()

  const outbox = readFileSync(join(STATE_DIR, 'invitation-outbox.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { to: string; token: string })
  const token = outbox.filter((entry) => entry.to === email).at(-1)?.token
  expect(token, 'the fixture outbox holds the bearer the email would carry').toBeTruthy()
  await page.goto(`/invite/accept?token=${encodeURIComponent(token as string)}`)
  const accepted = await page.context().request.post('/api/auth/invite/accept', {
    data: { token, firstName: 'Step', lastName: 'One' },
  })
  expect(accepted.status(), await accepted.text()).toBeLessThan(400)
  const redeemed = await sql<{ accepted_at: string | null }>(`SELECT accepted_at FROM user_management.invites WHERE id = $1`, [inviteId])
  expect(redeemed[0]?.accepted_at).toBeTruthy()
  const member = await sql<{ user_id: string }>(
    `SELECT u.user_id FROM user_management.users u
      JOIN user_management.organization_users m ON m.user_id = u.user_id
      WHERE lower(u.email) = $1 AND m.organization_id = $2 AND m.is_active = true`,
    [email, PRIMARY],
  )
  expect(member).toHaveLength(1)

  const revokeEmail = `revoke.${stamp()}@nzila.test`
  const second = await admin.post('/api/auth/invite/create', { data: { email: revokeEmail, role: 'member' } })
  expect(second.status(), await second.text()).toBe(201)
  const revokedOffer = await second.json()
  const revoked = await admin.post('/api/auth/invite/manage', { data: { action: 'revoke', inviteId: revokedOffer.inviteId } })
  expect(revoked.status(), await revoked.text()).toBe(200)
  const revokedRow = await sql<{ revoked_at: string | null }>(`SELECT revoked_at FROM user_management.invites WHERE id = $1`, [revokedOffer.inviteId])
  expect(revokedRow[0]?.revoked_at).toBeTruthy()
  const revokedToken = readFileSync(join(STATE_DIR, 'invitation-outbox.jsonl'), 'utf8').trim().split('\n').map((line) => JSON.parse(line) as { to: string; token: string }).filter((entry) => entry.to === revokeEmail).at(-1)?.token
  const reuse = await page.context().request.post('/api/auth/invite/accept', { data: { token: revokedToken, firstName: 'Late' } })
  expect(reuse.status()).toBeGreaterThanOrEqual(400)
  EVIDENCE.push({ journey: 'invitation', project: testInfo.project.name, inviteId, redeemedUser: member[0]?.user_id })
})

test('steward assignment and reassignment persist, and the other organization cannot read the case', async ({ page }, testInfo) => {
  const member = await runtimeRequestAs(U.memberPrimary.userId, PRIMARY)
  const title = `Step 1 assignment ${stamp()}`
  const filed = await member.post('/api/cases/intake', {
    data: {
      memberId: U.memberPrimary.userId,
      caseType: 'discipline',
      priority: 'medium',
      title,
      description: `Assignment journey. Marker: ${title}`,
      incidentDate: '2026-10-01',
      location: 'Plant 2',
    },
  })
  expect(filed.status(), await filed.text()).toBe(201)
  const caseId = (await filed.json()).claimId as string
  const coordinator = await runtimeRequestAs(U.chiefStewardPrimary.userId, PRIMARY)
  // A supervisory mandate names the cases it covers. A case filed just now is outside that mandate.
  const uncovered = await coordinator.post(`/api/cases/${caseId}/assign`, {
    data: { assigneeId: U.stewardPrimary.userId, reason: 'outside the mandate' },
  })
  expect(uncovered.status(), await uncovered.text()).toBe(404)

  const covered = await sql<{ claim_id: string; assigned_to: string | null }>(
    `SELECT c.claim_id, c.assigned_to
       FROM claims c
       JOIN public.ue_authority_mandates m
         ON m.organization_id = c.organization_id
        AND m.principal_user_id = $1
        AND m.kind = 'supervisory'
        AND m.status = 'active'
        AND 'assign' = ANY(m.powers)
        AND m.scope->'resourceIds' @> to_jsonb(c.claim_id::text)
      WHERE c.organization_id = $2
      LIMIT 1`,
    [U.chiefStewardPrimary.userId, PRIMARY],
  )
  expect(covered).toHaveLength(1)
  const coveredId = covered[0].claim_id
  const nextAssignee = covered[0].assigned_to === U.stewardPrimary.userId ? U.stewardPrimaryTwo.userId : U.stewardPrimary.userId
  const reassigned = await coordinator.post(`/api/cases/${coveredId}/assign`, {
    data: { assigneeId: nextAssignee, reason: 'reassigned inside the mandate' },
  })
  expect(reassigned.status(), await reassigned.text()).toBe(200)
  const row = await sql<{ assigned_to: string }>(`SELECT assigned_to FROM claims WHERE claim_id = $1`, [coveredId])
  expect(row[0]?.assigned_to).toBe(nextAssignee)

  await loginRuntimePage(page, U.memberPrimary.userId, PRIMARY)
  await page.goto(`/en-CA/dashboard/claims/${caseId}`)
  await expect(page.getByText(title).first()).toBeVisible()
  const review = await (await runtimeRequestAs(U.supervisorPrimary.userId, PRIMARY)).get(`/api/cases/${coveredId}`)
  expect(review.status(), await review.text()).toBe(200)

  const foreign = await (await runtimeRequestAs(U.memberSecondary.userId, UE_TEST_ORGS.secondary.id)).get(`/api/cases/${coveredId}`)
  expect([403, 404]).toContain(foreign.status())
  EVIDENCE.push({ journey: 'assignment', project: testInfo.project.name, caseId, foreignStatus: foreign.status() })
})

test('a member starts a conversation; the inbox shows it and another organization cannot read it', async ({ page }, testInfo) => {
  const subject = `Step 1 message ${stamp()}`
  await loginRuntimePage(page, U.memberPrimary.userId, PRIMARY)
  const started = await page.context().request.post('/api/messages/threads', {
    data: { subject, body: 'Please confirm you received the attached note.' },
  })
  expect(started.status(), await started.text()).toBe(201)
  const threadId = (await started.json()).data.id as string
  expect((await audit('messages.thread.create', threadId)).length).toBeGreaterThan(0)
  await page.goto('/en-CA/dashboard/messages')
  await expect(page.getByText(subject).first()).toBeVisible()
  await page.goto('/fr-CA/dashboard/messages')
  await expect(page.locator('html')).toHaveAttribute('lang', /^fr/)

  const foreign = await (await runtimeRequestAs(U.memberSecondary.userId, UE_TEST_ORGS.secondary.id)).get(`/api/messages/threads/${threadId}`)
  expect([403, 404]).toContain(foreign.status())
  EVIDENCE.push({ journey: 'messages', project: testInfo.project.name, threadId, foreignStatus: foreign.status() })
})

test('documents: the member library is named in both languages, and an unknown document is not found', async ({ page }, testInfo) => {
  await loginRuntimePage(page, U.memberPrimary.userId, PRIMARY)
  await page.goto('/en-CA/dashboard/documents')
  await expect(page.getByRole('link', { name: 'My documents' })).toBeVisible()
  await page.goto('/fr-CA/dashboard/documents')
  await expect(page.getByRole('link', { name: 'Mes documents' })).toBeVisible()
  const missing = await page.context().request.get('/api/documents/repository/11111111-1111-4111-8111-111111111199')
  expect(missing.status()).toBe(404)
  EVIDENCE.push({ journey: 'document-library', project: testInfo.project.name, missingStatus: missing.status() })
})

test('a local administrator and an ineligible platform title are both refused organization creation', async ({ page }, testInfo) => {
  await loginRuntimePage(page, U.adminPrimary.userId, PRIMARY)
  const refused = await page.context().request.post('/api/organizations', {
    data: { name: 'Not allowed', slug: `refused-${stamp()}`, type: 'local' },
  })
  expect(refused.status(), await refused.text()).toBe(403)

  // The fixture platform title is deliberately not a platform executive and cannot select a customer organization as one.
  const operator = await (await runtimeRequestAs(U.platformOperator.userId, PRIMARY)).post('/api/organizations', {
    data: { name: 'Step 1 disposable local', slug: `step1-${stamp()}`, type: 'local' },
  })
  expect(operator.status(), await operator.text()).toBe(403)
  const created = await sql<{ count: string }>(
    `SELECT count(*)::text AS count FROM organizations WHERE name = 'Step 1 disposable local'`,
  )
  expect(created[0]?.count).toBe('0')
  EVIDENCE.push({ journey: 'organization-create-refused', project: testInfo.project.name, adminStatus: refused.status(), operatorStatus: operator.status() })
})

test('an expired session returns to sign-in, and signing in again opens the dashboard', async ({ page }, testInfo) => {
  await loginRuntimePage(page, U.restrictedUxTester.userId, UE_TEST_ORGS.uxTesterIsolated.id)
  await page.goto('/en-CA/dashboard')
  await expect(page).toHaveURL(/\/en-CA\/dashboard/)
  await sql(
    `UPDATE user_management.user_sessions
        SET created_at = now() - interval '2 hours', expires_at = now() - interval '1 minute', is_active = false
      WHERE user_id = $1 AND is_active = true`,
    [U.restrictedUxTester.userId],
  )
  await page.goto('/en-CA/dashboard')
  await expect(page).toHaveURL(/\/en-CA\/login/)
  const secret = readRuntimeFixtureAuth(process.env.UE_RUNTIME_OPERATOR_DATABASE_URL ?? '')?.users[U.restrictedUxTester.userId]?.mfaSecret
  expect(secret, 'private fixture MFA secret').toBeTruthy()
  await page.locator('input[type=email], input[name=email]').first().fill(U.restrictedUxTester.email)
  await page.locator('input[type=password]').first().fill(UE_TEST_USER_PASSWORD)
  await page.getByRole('button', { name: 'Sign in', exact: true }).click()
  const code = page.getByLabel('Authenticator code')
  await expect(code).toBeVisible()
  await code.fill(computeTotp(secret as string))
  await page.getByRole('button', { name: 'Verify', exact: true }).click()
  await page.waitForURL(/\/en-CA\/dashboard/, { timeout: 90_000 })
  EVIDENCE.push({ journey: 'session-expiry', project: testInfo.project.name, reauthenticated: true })
})

test('a failed filing request can be retried and then persists', async ({ page }, testInfo) => {
  await loginRuntimePage(page, U.memberPrimary.userId, PRIMARY)
  await page.goto('/en-CA/dashboard/claims/new')
  let attempts = 0
  await page.route('**/api/cases/intake', async (route) => {
    attempts += 1
    if (attempts === 1) return route.abort('failed')
    return route.continue()
  })
  const title = `Retry journey ${stamp()}`
  await page.locator('#new-case-title').fill(title)
  await page.locator('#new-case-category').selectOption({ index: 1 })
  await page.locator('#new-case-priority').selectOption({ index: 1 })
  await page.locator('#new-case-description').fill(`Retry after a failed request. Marker: ${title}`)
  await page.locator('#new-case-incident-date').fill('2026-10-01')
  await page.locator('#new-case-location').fill('Plant 2')
  await page.locator('form button[type=submit]').last().click()
  await expect(page.getByText(/could not|try again|réessayer|n'a pas pu|failed/i).first()).toBeVisible({ timeout: 20_000 })
  await page.unroute('**/api/cases/intake')
  await page.locator('form button[type=submit]').last().click()
  await expect.poll(async () => (await sql(`SELECT claim_id FROM claims WHERE description LIKE $1`, [`%${title}%`])).length, { timeout: 60_000 }).toBe(1)
  EVIDENCE.push({ journey: 'retry', project: testInfo.project.name, title, attempts })
})
