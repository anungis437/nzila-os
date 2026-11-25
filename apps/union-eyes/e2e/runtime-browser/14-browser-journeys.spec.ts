import { mkdir, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { test, expect, type Page, type Response } from '@playwright/test'
import { computeTotp } from '@nzila/platform-auth/mfa'
import { readRuntimeFixtureAuth } from '../../scripts/runtime/fixture-auth'
import { queryOwnedRuntime } from '../../scripts/runtime/db-inspect'
import { loginRuntimePage, runtimeRequestAfterSignIn, runtimeRequestAs } from '../helpers/runtime-auth'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS, UE_TEST_USER_PASSWORD } from '../../tests/fixtures/test-users'
import en from '../../messages/en-CA.json'
import fr from '../../messages/fr-CA.json'

/**
 * Runtime acceptance 14: real browser journeys on the production build, in both languages, at desktop and mobile sizes.
 *
 * Real HTTP, real password and MFA sessions, native PostgreSQL. A journey records the browser project, the language, the
 * persona, the HTTP statuses it observed and the rows it read back, in .ue-runtime/evidence/browser-journeys.json.
 *
 * Each language submits one wrong password. Projects share 127.0.0.1, and ten login_failed audits in 15 minutes plus a
 * privileged role is the sign-in risk engine's soft lockout. Each journey releases that fixture window first, so a project
 * does not depend on an earlier project having cleared it. One journey then proves the rule still locks a privileged sign-in.
 */
const PRIMARY = UE_TEST_ORGS.primary.id
const U = UE_TEST_USERS
const STATE_DIR = process.env.UE_RUNTIME_STATE_DIR ?? join(process.cwd(), '..', '..', '.ue-runtime')
const EVIDENCE: Array<Record<string, unknown>> = []
const MESSAGES = { 'en-CA': en, 'fr-CA': fr } as const
const LOCALES = ['en-CA', 'fr-CA'] as const

async function sql<T extends Record<string, unknown>>(text: string, values: unknown[] = []): Promise<T[]> {
  return queryOwnedRuntime<T>(text, values)
}

const settleCookieBanner = (page: Page) =>
  page.addLocatorHandler(
    page.getByRole('dialog').filter({ has: page.getByRole('button', { name: /^(Reject All|Tout refuser)$/i }) }).first(),
    async (dialog) => {
      await dialog.getByRole('button', { name: /^(Reject All|Tout refuser)$/i }).click()
    },
  )

const watch = (page: Page) => {
  const seen: Array<{ method: string; path: string; status: number }> = []
  page.on('response', (response: Response) => {
    const url = new URL(response.url())
    if (url.pathname.startsWith('/api/')) seen.push({ method: response.request().method(), path: url.pathname, status: response.status() })
  })
  return seen
}

async function noHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow, 'the page must not scroll sideways').toBeLessThanOrEqual(1)
}

async function touchTargets(page: Page) {
  return page.evaluate(() =>
    Array.from(document.querySelectorAll<HTMLElement>('button:not([disabled]), a[href], input:not([type=hidden]), select, textarea'))
      .filter((el) => {
        const box = el.getBoundingClientRect()
        const style = getComputedStyle(el)
        return box.width > 0 && box.height > 0 && style.visibility !== 'hidden' && style.display !== 'none' && box.top < window.innerHeight * 3
      })
      .map((el) => {
        const own = el.getBoundingClientRect()
        const labels = Array.from((el as HTMLInputElement).labels ?? []).map((label) => label.getBoundingClientRect())
        const best = [own, ...labels].reduce((a, b) => (Math.min(b.height, b.width) > Math.min(a.height, a.width) ? b : a))
        return {
          tag: el.tagName,
          text: (el.textContent ?? el.getAttribute('aria-label') ?? '').trim().slice(0, 40),
          id: el.id,
          aria: el.getAttribute('aria-label'),
          cls: el.className.toString().slice(0, 80),
          h: Math.round(best.height),
          w: Math.round(best.width),
        }
      })
      .filter((el) => el.h < 32 || el.w < 32),
  )
}

/**
 * WebKit reports a same-origin API fetch that a navigation cancelled as "Fetch API cannot load <url> due to access control checks". The application
 * handles those rejections (organization-selector and breadcrumb both settle on failure); the error is counted in the evidence, not hidden.
 */
const isWebKitNavigationAbort = (error: Error) => {
  // WebKit puts only the tail of the URL in error.message and the full "Fetch API cannot load http://..." line in the stack.
  // A same-origin fetch cancelled by the next navigation, including an RSC prefetch, is reported this way. The application settles the rejection.
  const text = `${error.message}\n${error.stack ?? ''}`
  return text.includes('due to access control checks') && /https?:\/\/(127\.0\.0\.1|localhost)(:\d+)?\//.test(text)
}
const abortedFetches = new WeakMap<Page, number>()
const pageErrors = new WeakMap<Page, string[]>()
test.beforeEach(({ page }) => {
  const errors: string[] = []
  pageErrors.set(page, errors)
  page.on('pageerror', (error) => {
    if (isWebKitNavigationAbort(error)) {
      abortedFetches.set(page, (abortedFetches.get(page) ?? 0) + 1)
      return
    }
    errors.push(`${error.message}\n${(error.stack ?? '').slice(0, 1200)}`)
  })
})
async function releaseFixtureSignInWindow(): Promise<void> {
  await sql(
    `DELETE FROM user_management.auth_audit_log
      WHERE event_type = 'login_failed' AND ip_address = '127.0.0.1' AND created_at > now() - interval '16 minutes'`,
  )
  await sql(
    `UPDATE user_management.users
        SET failed_login_attempts = 0, account_locked_until = NULL
      WHERE email = $1`,
    [U.memberPrimary.email],
  )
}

test.beforeEach(async () => {
  await releaseFixtureSignInWindow()
})

test.afterEach(async ({ page }, testInfo) => {
  const errors = pageErrors.get(page) ?? []
  if (errors.length > 0) await testInfo.attach('uncaught-page-errors', { body: errors.join('\n---\n'), contentType: 'text/plain' })
  expect(errors, 'no uncaught browser exception').toEqual([])
  const aborted = abortedFetches.get(page) ?? 0
  if (aborted > 0) await testInfo.attach('webkit-navigation-aborted-fetches', { body: String(aborted), contentType: 'text/plain' })
})

test.afterAll(async ({}, testInfo) => {
  await releaseFixtureSignInWindow()
  await mkdir(join(STATE_DIR, 'evidence'), { recursive: true })
  await writeFile(join(STATE_DIR, 'evidence', `browser-journeys-${testInfo.project.name}.json`), JSON.stringify(EVIDENCE, null, 2))
})

test('ten wrong passwords from one address soft-lock the next privileged sign-in', async ({ request }, testInfo) => {
  const agent = { 'user-agent': 'UnionEyesAcceptance/1.0 (soft-lockout proof)' }
  for (let attempt = 0; attempt < 10; attempt += 1) {
    const refused = await request.post('/api/auth/login', {
      headers: agent,
      data: { email: U.memberPrimary.email, password: 'Not-the-password-1!' },
    })
    expect(refused.status(), await refused.text()).toBe(401)
  }
  const locked = await request.post('/api/auth/login', {
    headers: agent,
    data: { email: U.adminPrimary.email, password: UE_TEST_USER_PASSWORD },
  })
  const body = await locked.json()
  expect(locked.status()).toBe(401)
  expect(body.error ?? body.message).toBe(en.loginForm.softLockout)
  const rows = await sql<{ event_type: string }>(
    `SELECT event_type FROM user_management.auth_audit_log
      WHERE ip_address = '127.0.0.1' AND event_type = 'login_soft_lockout' AND created_at > now() - interval '5 minutes'`,
  )
  expect(rows.length).toBeGreaterThan(0)
  EVIDENCE.push({ journey: 'soft-lockout', project: testInfo.project.name, persona: 'admin', statuses: [{ path: '/api/auth/login', status: 401 }] })
})

for (const locale of LOCALES) {
  const text = MESSAGES[locale]
  const lang = locale === 'fr-CA' ? 'fr' : 'en'

  test.describe(`browser journeys [${locale}]`, () => {
    test.describe.configure({ mode: 'default', timeout: 180_000 })

    test(`${locale}: a wrong password is refused in the page language with no technical text, then password + MFA signs the member in`, async ({ page }, testInfo) => {
      await settleCookieBanner(page)
      const calls = watch(page)
      await page.goto(`/${locale}/login`)
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${lang}`))
      await page.locator('input[type=email], input[name=email]').first().fill(U.memberPrimary.email)
      await page.locator('input[type=password]').first().fill('Not-the-password-1!')
      const refusedResponse = page.waitForResponse((r) => new URL(r.url()).pathname === '/api/auth/login')
      await page.getByRole('button', { name: text.loginForm.signIn, exact: true }).click()
      await refusedResponse
      const refusal = page.locator('[role=alert]:not(#__next-route-announcer__)').filter({ hasText: /\S/ })
      await expect(refusal.first()).toBeVisible()
      const refusalText = (await refusal.first().innerText()).trim()
      expect(refusalText).not.toMatch(/HTTP \d|undefined|\[object|Error:|stack|SQL|ECONN|Failed to fetch|status code/i)
      if (lang === 'fr') expect(refusalText).not.toMatch(/Invalid email|password|Internal server/i)
      const refused = calls.find((call) => call.path === '/api/auth/login')
      expect([401, 403]).toContain(refused?.status)
      if (testInfo.project.name.startsWith('mobile')) await noHorizontalOverflow(page)

      await page.locator('input[type=password]').first().fill(UE_TEST_USER_PASSWORD)
      await page.getByRole('button', { name: text.loginForm.signIn, exact: true }).click()
      const code = page.getByLabel(text.loginForm.authenticatorCode)
      await expect(code).toBeVisible()
      const secret = readRuntimeFixtureAuth(process.env.DATABASE_URL ?? '')?.users[U.memberPrimary.userId]?.mfaSecret
      expect(secret, 'private fixture MFA secret').toBeTruthy()
      await code.fill(computeTotp(secret as string))
      await page.getByRole('button', { name: text.loginForm.verify, exact: true }).click()
      await page.waitForURL(new RegExp(`/${locale}/dashboard`), { timeout: 90_000 })
      expect(calls.filter((call) => call.path === '/api/auth/login').map((call) => call.status)).toEqual([refused?.status, 200])
      expect(calls.find((call) => call.path === '/api/auth/mfa/challenge')?.status).toBe(200)
      await noHorizontalOverflow(page)
      EVIDENCE.push({ journey: 'sign-in', locale, project: testInfo.project.name, persona: 'member', statuses: calls.filter((call) => call.path.startsWith('/api/auth')) })
    })

    test(`${locale}: the member files a case in the browser; it persists, is listed and opens`, async ({ page }, testInfo) => {
      await settleCookieBanner(page)
      const calls = watch(page)
      await loginRuntimePage(page, U.memberPrimary.userId, PRIMARY)
      await page.goto(`/${locale}/dashboard/claims/new`)
      const title = `Browser acceptance ${testInfo.project.name} ${locale} ${Date.now()}`
      await page.locator('#new-case-title').fill(title)
      await page.locator('#new-case-category').selectOption({ index: 1 })
      await page.locator('#new-case-priority').selectOption({ index: 1 })
      await page.locator('#new-case-description').fill(`Written by the browser acceptance journey to prove the filing reaches the database. Marker: ${title}`)
      await page.locator('#new-case-incident-date').fill('2026-10-01')
      await page.locator('#new-case-location').fill('Plant 2')
      if (testInfo.project.name.startsWith('mobile')) {
        await noHorizontalOverflow(page)
        const small = await touchTargets(page)
        expect(small.filter((el) => el.h < 24 || el.w < 24), JSON.stringify(small)).toEqual([])
      }
      await page.locator('form button[type=submit]').last().click()
      await expect.poll(() => calls.find((call) => call.path === '/api/cases/intake' && call.method === 'POST')?.status ?? 0, { timeout: 60_000 }).toBe(201)
      const rows = await sql<{ claim_number: string | null; status: string; member_id: string; organization_id: string }>(
        `SELECT claim_number, status, member_id, organization_id FROM claims WHERE description LIKE $1`,
        [`%Marker: ${title}`],
      )
      expect(rows).toHaveLength(1)
      expect(rows[0].member_id).toBe(U.memberPrimary.userId)
      expect(rows[0].organization_id).toBe(PRIMARY)
      await page.goto(`/${locale}/dashboard/claims`)
      // Desktop renders a table; below the md breakpoint the same cases are cards, each one link.
      const claimLink = page.getByRole('link', { name: new RegExp(rows[0].claim_number as string) }).first()
      await expect(claimLink).toBeVisible({ timeout: 60_000 })
      await noHorizontalOverflow(page)
      const feedback = page.getByRole('button', { name: text.pilotFeedbackWidget.dismissLabel })
      if (await feedback.isVisible().catch(() => false)) await feedback.click()
      await claimLink.click()
      await expect(page).toHaveURL(/\/dashboard\/claims\//, { timeout: 60_000 })
      await expect(page.locator('body')).toContainText(rows[0].claim_number as string, { timeout: 60_000 })
      await expect(page.locator('body')).toContainText(text.claimTypes.wageDispute)
      await expect(page.locator('body')).not.toContainText('wage_dispute')
      const audit = await sql<{ n: string }>(
        `SELECT count(*)::text AS n FROM public.audit_logs WHERE organization_id=$1 AND details::text LIKE $2`,
        [PRIMARY, `%${title}%`],
      )
      EVIDENCE.push({ journey: 'file-case', locale, project: testInfo.project.name, persona: 'member', status: calls.find((call) => call.path === '/api/cases/intake')?.status, claim: rows[0], auditRowsMentioningFiling: Number(audit[0].n) })
    })

    test(`${locale}: pages the member reaches fit the viewport, carry the page language and show no untranslated keys`, async ({ page }, testInfo) => {
      await settleCookieBanner(page)
      await loginRuntimePage(page, U.memberPrimary.userId, PRIMARY)
      const paths = ['dashboard', 'dashboard/claims', 'dashboard/claims/new', 'dashboard/inbox', 'dashboard/documents', 'dashboard/notifications', 'dashboard/messages']
      const seen: Array<Record<string, unknown>> = []
      for (const path of paths) {
        const response = await page.goto(`/${locale}/${path}`).catch(async (error: Error) => {
          if (!/interrupted by another navigation/.test(error.message)) throw error
          await page.waitForLoadState('load')
          return null
        })
        const status = response?.status() ?? 200
        const landedOn = new URL(page.url()).pathname
        await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${lang}`))
        const body = (await page.locator('body').innerText()).slice(0, 20_000)
        expect(body, `${path} shows a message key`).not.toMatch(/MISSING_MESSAGE|(?<![\w@./-])[a-z]+[A-Z][A-Za-z]*\.[a-zA-Z]+(?:\.[a-zA-Z]+)*(?![\w@-])/)
        expect(body, `${path} shows technical text`).not.toMatch(/Application error|Unhandled|undefined|\[object Object\]|Internal Server Error/)
        if (lang === 'fr') expect(body, `${path} English fallback`).not.toMatch(/Something went wrong|Failed to load|Request failed/)
        await noHorizontalOverflow(page)
        seen.push({ path, status, landedOn, bytes: body.length })
        expect([200, 404], `${path}`).toContain(status)
      }
      EVIDENCE.push({ journey: 'layout-and-language', locale, project: testInfo.project.name, persona: 'member', pages: seen })
    })

    test(`${locale}: the organization administrator changes the sign-in policy and reads it back independently, then restores it`, async ({ page }, testInfo) => {
      await settleCookieBanner(page)
      const calls = watch(page)
      await loginRuntimePage(page, U.adminPrimary.userId, PRIMARY)
      await page.goto(`/${locale}/admin/auth-policy`)
      const toggle = page.getByLabel(lang === 'fr' ? /réinitialisation.*mot de passe/i : /self-service password reset/i)
      await expect(toggle).toBeVisible({ timeout: 60_000 })
      const before = await toggle.isChecked()
      const rowBefore = await sql<{ password_reset_allowed: boolean }>(`SELECT password_reset_allowed FROM user_management.org_auth_policies WHERE organization_id=$1`, [PRIMARY])
      const auditBefore = Number((await sql<{ n: string }>(`SELECT count(*)::text AS n FROM user_management.auth_audit_log WHERE event_type='org_policy_updated' AND metadata->>'organizationId'=$1`, [PRIMARY]))[0].n)
      await toggle.setChecked(!before)
      await page.getByRole('button', { name: lang === 'fr' ? /^Enregistrer la politique/ : /^Save policy/ }).click()
      await expect(page.getByRole('status').filter({ hasText: lang === 'fr' ? /Le serveur confirme/ : /server confirms/i })).toBeVisible({ timeout: 60_000 })
      const stored = await sql<{ password_reset_allowed: boolean }>(`SELECT password_reset_allowed FROM user_management.org_auth_policies WHERE organization_id=$1`, [PRIMARY])
      expect(stored[0].password_reset_allowed).toBe(!before)
      const puts = calls.filter((call) => call.path === '/api/auth/policy' && call.method === 'PUT').map((call) => call.status)
      const gets = calls.filter((call) => call.path === '/api/auth/policy' && call.method === 'GET').map((call) => call.status)
      expect(puts).toEqual([200])
      expect(gets.length, 'the page reads the policy back after the save').toBeGreaterThanOrEqual(2)
      const audit = await sql<{ n: string }>(`SELECT count(*)::text AS n FROM user_management.auth_audit_log WHERE event_type='org_policy_updated' AND metadata->>'organizationId'=$1`, [PRIMARY])
      expect(Number(audit[0].n), 'one independent audit record for the save').toBe(auditBefore + 1)
      await noHorizontalOverflow(page)
      await toggle.setChecked(before)
      await page.getByRole('button', { name: lang === 'fr' ? /^Enregistrer la politique/ : /^Save policy/ }).click()
      await expect.poll(async () => (await sql<{ v: boolean }>(`SELECT password_reset_allowed AS v FROM user_management.org_auth_policies WHERE organization_id=$1`, [PRIMARY]))[0].v, { timeout: 60_000 }).toBe(before)
      EVIDENCE.push({ journey: 'sign-in-policy', locale, project: testInfo.project.name, persona: 'administrator', before: rowBefore[0] ?? null, puts, gets, auditRows: Number(audit[0].n) })
    })

    test(`${locale}: a member cannot open the sign-in policy page's data, and a stale save is refused`, async ({ page }, testInfo) => {
      await settleCookieBanner(page)
      const member = await runtimeRequestAs(U.memberPrimary.userId, PRIMARY)
      expect((await member.get('/api/auth/policy')).status()).toBe(403)
      const admin = await runtimeRequestAs(U.adminPrimary.userId, PRIMARY)
      const current = await (await admin.get('/api/auth/policy')).json()
      const stale = { ...current, allowedEmailDomains: ['stale-snapshot.example'] }
      const refused = await admin.put('/api/auth/policy', { data: { expected: stale, passwordResetAllowed: current.passwordResetAllowed } })
      expect(refused.status()).toBe(409)
      const other = await runtimeRequestAs(U.memberSecondary.userId, U.memberSecondary.orgId)
      expect((await other.get('/api/auth/policy')).status()).toBe(403)
      EVIDENCE.push({ journey: 'sign-in-policy-refusals', locale, project: testInfo.project.name, member: 403, stale: refused.status(), otherOrganization: 403 })
    })

    test(`${locale}: sign-out ends the session and a signed-out browser is sent to sign in`, async ({ page }, testInfo) => {
      await settleCookieBanner(page)
      const calls = watch(page)
      const signedIn = await runtimeRequestAfterSignIn(U.stewardPrimaryTwo.userId, U.stewardPrimaryTwo.orgId)
      await page.context().addCookies((await signedIn.storageState()).cookies)
      await page.goto(`/${locale}/dashboard`)
      await expect(page).toHaveURL(new RegExp(`/${locale}/dashboard`))
      const response = await page.request.post('/api/auth/logout')
      expect([200, 204]).toContain(response.status())
      expect((await page.request.get('/api/cases')).status()).toBe(401)
      await page.goto(`/${locale}/dashboard/claims`)
      await expect(page).toHaveURL(/login|sign-in/)
      await expect(page.locator('input[type=email], input[name=email]').first()).toBeVisible()
      await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${lang}`))
      EVIDENCE.push({ journey: 'sign-out', locale, project: testInfo.project.name, persona: 'steward', logout: response.status(), afterwards: 401, landedOn: new URL(page.url()).pathname, statuses: calls.filter((call) => call.path.startsWith('/api/auth')) })
    })

    test(`${locale}: a browser with no session, or a forged session cookie, is sent to a sign-in page that renders in its language`, async ({ page, context }, testInfo) => {
      await settleCookieBanner(page)
      await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: new URL(testInfo.project.use.baseURL ?? 'http://127.0.0.1:3002').origin }])
      const landings: Array<Record<string, unknown>> = []
      for (const cookie of [null, 'forged-session-value']) {
        await context.clearCookies({ name: 'nzila_session' })
        if (cookie) await context.addCookies([{ name: 'nzila_session', value: cookie, url: new URL(testInfo.project.use.baseURL ?? 'http://127.0.0.1:3002').origin }])
        const response = await page.goto('/dashboard/claims/new')
        await expect(page.locator('input[type=email], input[name=email]').first(), 'the sign-in form renders').toBeVisible()
        await expect(page.locator('html')).toHaveAttribute('lang', new RegExp(`^${lang}`))
        await expect(page.getByRole('button', { name: text.loginForm.signIn, exact: true })).toBeVisible()
        expect(await page.locator('body').innerText()).not.toMatch(/Application error|client-side exception|Internal Server Error/)
        landings.push({ session: cookie ? 'forged' : 'none', finalStatus: response?.status(), landedOn: new URL(page.url()).pathname })
        expect(new URL(page.url()).pathname).toBe(`/${locale}/login`)
      }
      EVIDENCE.push({ journey: 'no-session-redirect', locale, project: testInfo.project.name, persona: 'anonymous', landings })
    })

    test(`${locale}: password recovery pages render in the page language, refuse a forged link in it, and acknowledge a request neutrally`, async ({ page, context }, testInfo) => {
      await settleCookieBanner(page)
      const origin = new URL(testInfo.project.use.baseURL ?? 'http://127.0.0.1:3002').origin
      await context.addCookies([{ name: 'NEXT_LOCALE', value: locale, url: origin }])
      const calls = watch(page)
      const recovery = text.passwordRecovery
      const html = () => page.locator('html')

      await page.goto('/forgot-password')
      await expect(page.getByRole('heading', { name: recovery.forgotTitle })).toBeVisible()
      await expect(html()).toHaveAttribute('lang', new RegExp(`^${lang}`))
      await page.getByLabel(recovery.email).fill(`nobody-${Date.now()}@example.test`)
      await page.getByRole('button', { name: recovery.sendResetLink }).click()
      await expect(page.getByRole('heading', { name: recovery.checkEmailTitle })).toBeVisible({ timeout: 60_000 })
      expect(calls.find((call) => call.path === '/api/auth/forgot-password')?.status).toBe(200)
      await noHorizontalOverflow(page)

      await page.goto('/reset-password?token=forged-token-value')
      await expect(page.getByRole('heading', { name: recovery.newPasswordTitle })).toBeVisible()
      await page.getByLabel(recovery.newPassword, { exact: true }).fill('Another-Secret-1')
      await page.getByLabel(recovery.confirmPassword).fill('Another-Secret-1')
      await page.getByRole('button', { name: recovery.resetPassword, exact: true }).click()
      const refusal = page.locator('div.text-red-700').filter({ hasText: /\S/ })
      await expect(refusal.first()).toBeVisible({ timeout: 60_000 })
      const refusalText = (await refusal.first().innerText()).trim()
      expect(refusalText).toBe(recovery.refusals.linkInvalid)
      expect(calls.find((call) => call.path === '/api/auth/reset-password')?.status).toBe(400)
      await expect(page.getByRole('heading', { name: recovery.resetDoneTitle })).toHaveCount(0)
      await noHorizontalOverflow(page)

      await page.goto('/reset-password')
      await expect(page.getByRole('heading', { name: recovery.invalidLinkTitle })).toBeVisible()
      await page.getByRole('link', { name: recovery.requestNewLink }).click()
      await expect(page.getByRole('heading', { name: recovery.forgotTitle })).toBeVisible()
      EVIDENCE.push({ journey: 'password-recovery', locale, project: testInfo.project.name, persona: 'anonymous', forged: refusalText, statuses: calls.filter((call) => call.path.startsWith('/api/auth')) })
    })
  })
}
