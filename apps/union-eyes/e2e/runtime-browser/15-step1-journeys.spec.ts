import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { request as playwrightRequest, test, expect, type APIRequestContext } from '@playwright/test'
import { computeTotp, encryptSecret, generateTotpSecret } from '@nzila/platform-auth/mfa'
import { hashPassword } from '@nzila/platform-auth/password'
import { loginRuntimePage, runtimeRequestAfterSignIn, runtimeRequestAs } from '../helpers/runtime-auth'
import { readRuntimeFixtureAuth } from '../../scripts/runtime/fixture-auth'
import { UE_TEST_USER_PASSWORD } from '../../tests/fixtures/test-users'
import { queryOwnedRuntime } from '../../scripts/runtime/db-inspect'
import { PLATFORM_ORGANIZATION_ID } from '../../lib/authority/platform-organization'
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

/** The sign-in risk engine counts failures by address. Each journey starts from an empty window so one project's refusals cannot lock the next. */
async function releaseFixtureSignInWindow(): Promise<void> {
  await sql(
    `DELETE FROM user_management.auth_audit_log
      WHERE event_type = 'login_failed' AND ip_address = '127.0.0.1' AND created_at > now() - interval '16 minutes'`,
  )
}

function invitationBearer(email: string): string | undefined {
  const file = join(STATE_DIR, 'invitation-outbox.jsonl')
  const lines = readFileSync(file, 'utf8').trim().split('\n').filter(Boolean)
  return lines
    .map((line) => JSON.parse(line) as { to: string; token: string })
    .filter((entry) => entry.to === email)
    .at(-1)?.token
}

async function ensurePlatformOrganization(): Promise<void> {
  await sql(
    `INSERT INTO public.organizations
      (id, name, slug, organization_type, hierarchy_path, hierarchy_level, sectors, clc_affiliated,
       member_count, active_member_count, settings, features_enabled, status, remittance_day, fiscal_year_end, created_at, updated_at)
     VALUES ($1, 'UE QA Platform', 'ue-qa-platform', 'platform', ARRAY[]::text[], 0,
       ARRAY[]::varchar[], false, 0, 0, '{}'::jsonb, ARRAY[]::text[], 'active', 15, '2024-12-31', now(), now())
     ON CONFLICT (id) DO NOTHING`,
    [PLATFORM_ORGANIZATION_ID],
  )
}

/**
 * A disposable platform executive for this journey only. The shared fixture titles stay unappointed.
 * The bearer, password and MFA secret stay in memory and are never written to the evidence file.
 */
async function appointDisposableExecutive(): Promise<{ userId: string; context: APIRequestContext }> {
  const key = process.env.AUTH_MFA_ENCRYPTION_KEY
  if (!key || key.length < 32) throw new Error('Owned fixture MFA key required')
  const userId = `ue-step1-exec-${stamp()}`
  const email = `${userId}@nzila.test`
  const password = `Step1-Exec-${stamp()}!Aa9`
  const secret = generateTotpSecret()
  const previous = process.env.AUTH_MFA_ENCRYPTION_KEY
  process.env.AUTH_MFA_ENCRYPTION_KEY = key
  let encrypted: string
  try {
    encrypted = encryptSecret(secret)
  } finally {
    if (previous === undefined) delete process.env.AUTH_MFA_ENCRYPTION_KEY
    else process.env.AUTH_MFA_ENCRYPTION_KEY = previous
  }
  await ensurePlatformOrganization()
  await sql(
    `INSERT INTO user_management.users
      (user_id, email, password_hash, is_active, lifecycle_state, is_system_admin, email_verified, account_source, first_name, last_name, display_name)
     VALUES ($1, $2, $3, true, 'active', true, true, 'local', 'Step', 'Executive', 'Step Executive')`,
    [userId, email, await hashPassword(password)],
  )
  await sql(
    `INSERT INTO user_management.organization_users
      (organization_id, user_id, role, is_active, is_primary, joined_at)
     VALUES ($1, $2, 'executive', true, true, now())`,
    [PLATFORM_ORGANIZATION_ID, userId],
  )
  await sql(
    `INSERT INTO user_management.mfa_totp (user_id, secret_encrypted, enabled_at, recovery_codes_hashed)
     VALUES ($1, $2, now(), '[]'::jsonb)`,
    [userId, encrypted],
  )
  const context = await playwrightRequest.newContext({
    baseURL: process.env.PLAYWRIGHT_BASE_URL,
    extraHTTPHeaders: { 'user-agent': 'UnionEyesAcceptance/1.0 (platform-executive)' },
  })
  const login = await context.post('/api/auth/login', { data: { email, password } })
  expect(login.status(), await login.text()).toBe(200)
  const challenge = (await login.json()) as { requiresMfa?: boolean; mfaChallengeToken?: string }
  expect(challenge.requiresMfa).toBe(true)
  const mfa = await context.post('/api/auth/mfa/challenge', {
    data: { challengeToken: challenge.mfaChallengeToken, code: computeTotp(secret) },
  })
  expect(mfa.status(), await mfa.text()).toBe(200)
  const switched = await context.post('/api/organizations/switch', { data: { organizationId: PLATFORM_ORGANIZATION_ID } })
  expect(switched.status(), await switched.text()).toBe(200)
  return { userId, context }
}

test.describe.configure({ mode: 'serial', timeout: 180_000 })

test.beforeEach(async ({ page }) => {
  await releaseFixtureSignInWindow()
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
  // Redemption sets the new member's session. Keep it off the administrator's cookie jar.
  const guest = await playwrightRequest.newContext({ baseURL: process.env.PLAYWRIGHT_BASE_URL })
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

  const forged = await guest.post('/api/auth/invite/accept', {
    data: { token: 'forged-token-value', firstName: 'No', lastName: 'One' },
  })
  expect(forged.status()).toBeGreaterThanOrEqual(400)
  expect((await sql<{ accepted_at: string | null }>(`SELECT accepted_at FROM user_management.invites WHERE id = $1`, [inviteId]))[0]?.accepted_at).toBeNull()

  const createdBody = JSON.stringify(invitation)
  const token = invitationBearer(email)
  expect(token, 'the private fixture outbox holds the bearer the email would carry').toBeTruthy()
  expect(createdBody).not.toContain(token)
  const accepted = await guest.post('/api/auth/invite/accept', {
    data: { token, firstName: 'Step', lastName: 'One', organizationId: UE_TEST_ORGS.secondary.id },
  })
  expect(accepted.status(), await accepted.text()).toBeLessThan(400)
  expect(JSON.stringify(await accepted.json())).not.toContain(token)
  const redeemed = await sql<{ accepted_at: string | null }>(`SELECT accepted_at FROM user_management.invites WHERE id = $1`, [inviteId])
  expect(redeemed[0]?.accepted_at).toBeTruthy()
  const member = await sql<{ user_id: string }>(
    `SELECT u.user_id FROM user_management.users u
      JOIN user_management.organization_users m ON m.user_id = u.user_id
      WHERE lower(u.email) = $1 AND m.organization_id = $2 AND m.is_active = true`,
    [email, PRIMARY],
  )
  expect(member).toHaveLength(1)
  const foreignMembership = await sql<{ organization_id: string }>(
    `SELECT organization_id::text FROM user_management.organization_users WHERE user_id = $1`,
    [member[0].user_id],
  )
  expect(foreignMembership.map((row) => row.organization_id)).toEqual([PRIMARY])
  const usedAgain = await guest.post('/api/auth/invite/accept', {
    data: { token, firstName: 'Step', lastName: 'Again' },
  })
  expect(usedAgain.status()).toBeGreaterThanOrEqual(400)
  expect(await sql(`SELECT user_id FROM user_management.users WHERE lower(email) = $1`, [email])).toHaveLength(1)

  const tampered = `${token!.slice(0, -1)}${token!.endsWith('a') ? 'b' : 'a'}`
  const tamperedAccept = await guest.post('/api/auth/invite/accept', {
    data: { token: tampered, firstName: 'Tampered' },
  })
  expect(tamperedAccept.status()).toBeGreaterThanOrEqual(400)

  const expiredEmail = `expired.${stamp()}@nzila.test`
  const expired = await admin.post('/api/auth/invite/create', { data: { email: expiredEmail, role: 'member', organizationId: UE_TEST_ORGS.secondary.id } })
  expect(expired.status(), await expired.text()).toBe(201)
  const expiredOffer = await expired.json()
  expect(expiredOffer).not.toHaveProperty('token')
  const expiredRow = await sql<{ organization_id: string }>(
    `SELECT organization_id::text FROM user_management.invites WHERE id = $1`,
    [expiredOffer.inviteId],
  )
  expect(expiredRow[0]?.organization_id).toBe(PRIMARY)
  await sql(`UPDATE user_management.invites SET expires_at = now() - interval '1 minute' WHERE id = $1`, [expiredOffer.inviteId])
  const expiredToken = invitationBearer(expiredEmail)
  expect(expiredToken).toBeTruthy()
  const expiredAccept = await guest.post('/api/auth/invite/accept', {
    data: { token: expiredToken, firstName: 'Late' },
  })
  expect(expiredAccept.status()).toBeGreaterThanOrEqual(400)
  expect((await sql<{ accepted_at: string | null }>(`SELECT accepted_at FROM user_management.invites WHERE id = $1`, [expiredOffer.inviteId]))[0]?.accepted_at).toBeNull()

  const revokeEmail = `revoke.${stamp()}@nzila.test`
  const second = await admin.post('/api/auth/invite/create', { data: { email: revokeEmail, role: 'member' } })
  expect(second.status(), await second.text()).toBe(201)
  const revokedOffer = await second.json()
  const revoked = await admin.post('/api/auth/invite/manage', { data: { action: 'revoke', inviteId: revokedOffer.inviteId } })
  expect(revoked.status(), await revoked.text()).toBe(200)
  const revokedRow = await sql<{ revoked_at: string | null }>(`SELECT revoked_at FROM user_management.invites WHERE id = $1`, [revokedOffer.inviteId])
  expect(revokedRow[0]?.revoked_at).toBeTruthy()
  const revokedToken = invitationBearer(revokeEmail)
  const reuse = await guest.post('/api/auth/invite/accept', { data: { token: revokedToken, firstName: 'Late' } })
  expect(reuse.status()).toBeGreaterThanOrEqual(400)
  await guest.dispose()
  const foreignRevoke = await (await runtimeRequestAs(U.wrongOrgSteward.userId, UE_TEST_ORGS.secondary.id)).post('/api/auth/invite/manage', {
    data: { action: 'revoke', inviteId },
  })
  expect(foreignRevoke.status()).toBeGreaterThanOrEqual(400)
  expect((await sql<{ accepted_at: string | null }>(`SELECT accepted_at FROM user_management.invites WHERE id = $1`, [inviteId]))[0]?.accepted_at).toBeTruthy()
  EVIDENCE.push({
    journey: 'invitation',
    project: testInfo.project.name,
    inviteId,
    redeemedUser: member[0]?.user_id,
    expired: expiredAccept.status(),
    tampered: tamperedAccept.status(),
    reused: usedAgain.status(),
    foreignRevoke: foreignRevoke.status(),
  })
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

  // Scope this filing only. The canonical fixture cases stay with the holder the kernel seeded.
  execFileSync('npx', ['tsx', 'scripts/runtime/authority-admin.ts', 'scope-case', caseId], {
    cwd: process.cwd(),
    env: { ...process.env, QA_TEST_ENV: 'true' },
    stdio: 'pipe',
  })
  const assigned = await coordinator.post(`/api/cases/${caseId}/assign`, {
    data: { assigneeId: U.stewardPrimary.userId, reason: 'inside the exact-case mandate' },
  })
  expect(assigned.status(), await assigned.text()).toBe(200)
  const reassigned = await coordinator.post(`/api/cases/${caseId}/assign`, {
    data: { assigneeId: U.stewardPrimaryTwo.userId, reason: 'reassigned inside the mandate' },
  })
  expect(reassigned.status(), await reassigned.text()).toBe(200)
  const row = await sql<{ assigned_to: string }>(`SELECT assigned_to FROM claims WHERE claim_id = $1`, [caseId])
  expect(row[0]?.assigned_to).toBe(U.stewardPrimaryTwo.userId)

  await loginRuntimePage(page, U.memberPrimary.userId, PRIMARY)
  await page.goto(`/en-CA/dashboard/claims/${caseId}`)
  await expect(page.getByText(title).first()).toBeVisible()
  const review = await (await runtimeRequestAs(U.supervisorPrimary.userId, PRIMARY)).get(`/api/cases/${caseId}`)
  expect(review.status(), await review.text()).toBe(200)

  const foreign = await (await runtimeRequestAs(U.memberSecondary.userId, UE_TEST_ORGS.secondary.id)).get(`/api/cases/${caseId}`)
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

test('a platform executive creates an organization, and removing the appointment ends that authority', async ({ page }, testInfo) => {
  await loginRuntimePage(page, U.adminPrimary.userId, PRIMARY)
  const refusedSlug = `refused-${stamp()}`
  const refused = await page.context().request.post('/api/organizations', {
    data: { name: 'Not allowed', slug: refusedSlug, type: 'local', parentId: PRIMARY },
  })
  expect(refused.status(), await refused.text()).toBe(403)

  const operator = await (await runtimeRequestAs(U.platformOperator.userId, PRIMARY)).post('/api/organizations', {
    data: { name: 'Unappointed title', slug: `unappointed-${stamp()}`, type: 'local', parentId: PRIMARY },
  })
  expect(operator.status(), await operator.text()).toBe(403)
  expect((await sql(`SELECT 1 FROM organizations WHERE slug = $1`, [refusedSlug]))).toHaveLength(0)

  const appointed = await appointDisposableExecutive()
  const slug = `step1-${stamp()}`
  const created = await appointed.context.post('/api/organizations', {
    data: { name: 'Step 1 disposable local', slug, type: 'local', parentId: PRIMARY },
  })
  expect(created.status(), await created.text()).toBe(201)
  const createdBody = await created.json()
  const organizationId = createdBody.data?.id as string
  expect(organizationId).toBeTruthy()
  const row = await sql<{ id: string; parent_id: string; organization_type: string; hierarchy_level: number }>(
    `SELECT id::text, parent_id::text, organization_type, hierarchy_level FROM organizations WHERE slug = $1`,
    [slug],
  )
  expect(row).toHaveLength(1)
  expect(row[0].id).toBe(organizationId)
  expect(row[0].parent_id).toBe(PRIMARY)
  expect(row[0].organization_type).toBe('local')
  expect(row[0].hierarchy_level).toBe(1)
  const createdAudit = await sql(
    `SELECT 1 FROM public.audit_logs
      WHERE organization_id::text = $1 AND user_id = $2 AND action = 'organization.create' AND resource_id::text = $1`,
    [organizationId, appointed.userId],
  )
  expect(createdAudit).toHaveLength(1)
  const exercise = await sql(
    `SELECT 1 FROM public.audit_logs
      WHERE organization_id::text = $1 AND user_id = $2 AND action = 'platform.organization.manage.authorized'
        AND resource_type = 'platform_authority' AND details->>'basis' = 'platform_executive'`,
    [PLATFORM_ORGANIZATION_ID, appointed.userId],
  )
  expect(exercise.length).toBeGreaterThan(0)

  await sql(
    `UPDATE user_management.organization_users SET role = 'officer' WHERE user_id = $1 AND organization_id = $2`,
    [appointed.userId, PLATFORM_ORGANIZATION_ID],
  )
  const removedSlug = `removed-${stamp()}`
  const removed = await appointed.context.post('/api/organizations', {
    data: { name: 'Authority removed', slug: removedSlug, type: 'local', parentId: PRIMARY },
  })
  expect(removed.status(), await removed.text()).toBe(403)
  expect((await sql(`SELECT 1 FROM organizations WHERE slug = $1`, [removedSlug]))).toHaveLength(0)
  const denial = await sql(
    `SELECT 1 FROM public.audit_logs
      WHERE organization_id::text = $1 AND user_id = $2 AND action = 'platform.organization.manage.denied'
        AND details->>'reason' = 'no_live_scoped_platform_staff_mandate'`,
    [PLATFORM_ORGANIZATION_ID, appointed.userId],
  )
  expect(denial.length).toBeGreaterThan(0)
  await sql(
    `UPDATE user_management.users SET is_active = false, is_system_admin = false WHERE user_id = $1`,
    [appointed.userId],
  )
  await appointed.context.dispose()
  EVIDENCE.push({
    journey: 'platform-executive-organization',
    project: testInfo.project.name,
    organizationId,
    adminStatus: refused.status(),
    operatorStatus: operator.status(),
    createdStatus: created.status(),
    removedStatus: removed.status(),
  })
})

test('an officer reads leadership reporting, a steward drafts correspondence, and a member sees neither private note nor the report', async ({}, testInfo) => {
  const covered = await sql<{ claim_id: string }>(
    `SELECT c.claim_id
       FROM claims c
      WHERE c.organization_id = $1 AND c.assigned_to = $2
      LIMIT 1`,
    [PRIMARY, U.stewardPrimary.userId],
  )
  expect(covered).toHaveLength(1)
  const caseId = covered[0].claim_id
  const marker = `internal note ${stamp()}`
  const note = await (await runtimeRequestAfterSignIn(U.stewardPrimary.userId, PRIMARY)).post(`/api/cases/${caseId}/notes`, {
    data: { text: marker, isInternal: true },
  })
  expect(note.status(), await note.text()).toBeLessThan(300)
  const memberNotes = await (await runtimeRequestAfterSignIn(U.memberPrimary.userId, PRIMARY)).get(`/api/cases/${caseId}/notes`)
  expect(await memberNotes.text()).not.toContain(marker)
  const foreignNotes = await (await runtimeRequestAfterSignIn(U.memberSecondary.userId, UE_TEST_ORGS.secondary.id)).get(`/api/cases/${caseId}/notes`)
  expect(foreignNotes.status()).toBe(404)

  const officer = await runtimeRequestAfterSignIn(U.executivePrimary.userId, PRIMARY)
  const report = await officer.get('/api/dashboard/leadership')
  expect(report.status(), await report.text()).toBe(200)
  expect(await report.text()).not.toContain(marker)
  const memberReport = await (await runtimeRequestAfterSignIn(U.memberPrimary.userId, PRIMARY)).get('/api/dashboard/leadership')
  expect(memberReport.status()).toBe(403)

  const subject = `Step 1 letter ${stamp()}`
  const draft = await (await runtimeRequestAfterSignIn(U.stewardPrimary.userId, PRIMARY)).post('/api/correspondence', {
    data: {
      subject,
      body: 'Please confirm receipt of this draft letter.',
      type: 'letter',
      recipients: [{ name: 'Employer representative', recipientType: 'to' }],
    },
  })
  expect(draft.status(), await draft.text()).toBeLessThan(300)
  const letter = await sql<{ id: string; status: string }>(
    `SELECT id::text, status FROM correspondence WHERE organization_id = $1 AND subject = $2`,
    [PRIMARY, subject],
  )
  expect(letter).toHaveLength(1)
  expect(letter[0].status).toBe('draft')
  const memberLetter = await (await runtimeRequestAfterSignIn(U.memberPrimary.userId, PRIMARY)).get(`/api/correspondence/${letter[0].id}`)
  expect(memberLetter.status()).toBeGreaterThanOrEqual(400)
  const foreignLetter = await (await runtimeRequestAfterSignIn(U.memberSecondary.userId, UE_TEST_ORGS.secondary.id)).get(`/api/correspondence/${letter[0].id}`)
  expect([403, 404]).toContain(foreignLetter.status())
  EVIDENCE.push({
    journey: 'officer-correspondence-privacy',
    project: testInfo.project.name,
    caseId,
    correspondenceId: letter[0].id,
    memberReport: memberReport.status(),
    foreignNotes: foreignNotes.status(),
  })
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
