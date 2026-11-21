/** Actual Chromium journeys against the owned production Next/V2 fixture. No QA cookies or response stubs. */
import assert from 'node:assert/strict'
import { randomUUID } from 'node:crypto'
import { mkdirSync, mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { createRequire } from 'node:module'
import path from 'node:path'
// The optional production-service shim for 'playwright' is deliberately small.
// Engineering uses the installed test SDK's real playwright-core declarations.
import type { Browser, BrowserContext, Page, Response as BrowserResponse } from '@playwright/test'
import type { Client } from 'pg'
import { computeTotp, verifyTotp } from '../../../../packages/platform-auth/src/mfa/totp'
import en from '../../messages/en-CA.json'
import fr from '../../messages/fr-CA.json'
import {
  assertOwnedLocalOrigin, governPrimaryAssignment, login as loginOwnedFixturePrincipal, type OwnedLoadFixture,
} from './authenticated-casework-load'
import type { seedNextHttpSmoke } from './next-http-smoke'

export const BROWSER_PROFILES = [
  { id: 'desktop-en', locale: 'en-CA', viewport: { width: 1440, height: 1000 }, mobile: false },
  { id: 'desktop-fr', locale: 'fr-CA', viewport: { width: 1440, height: 1000 }, mobile: false },
  { id: 'mobile-en', locale: 'en-CA', viewport: { width: 390, height: 844 }, mobile: true },
  { id: 'mobile-fr', locale: 'fr-CA', viewport: { width: 390, height: 844 }, mobile: true },
] as const
export const REQUIRED_BROWSER_CHECKS = [
  'member-password-totp-ui', 'member-intake-labels-and-create', 'member-case-list-reopen',
  'staff-password-totp-ui', 'staff-case-read', 'staff-deadline-create-reschedule-complete-cancel',
  'member-deadline-read-only', 'other-member-case-denial', 'foreign-tenant-case-denial',
  'finance-read-and-write-denial', 'logout-revocation',
] as const
type Profile = (typeof BROWSER_PROFILES)[number]
type CheckStatus = 'UNEXECUTED' | 'PASS' | 'FAIL'
interface ProfileResult {
  id: string
  locale: string
  viewport: { width: number; height: number }
  checks: { name: string; status: CheckStatus; failureKind?: string; failureCode?: string; failureStage?: string; failurePath?: string }[]
  status: CheckStatus
}
interface BrowserResult {
  status: 'FAIL' | 'PASS'
  engine: string | null
  engineVersion: string | null
  profiles: ProfileResult[]
  setup: CheckStatus
  setupPhase?: string
  setupFailureKind?: string
  externalRequestsBlocked: number
  unhandledBrowserErrors: number
  serverErrors: number
  /** 429 responses the browser received from the owned server (evidence only; a 429 that breaks a journey fails its check). */
  rateLimitedResponses: number
  /** Owned-origin paths that answered 5xx, with identifiers masked; no query, body or header is kept. */
  serverErrorPaths: string[]
  cleanup: { browserClosed: boolean; contextsClosed: boolean; errors: string[] }
  limitations: string[]
}
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i

export function browserTargetAllowed(target: string, origin: string) {
  const owned = assertOwnedLocalOrigin(origin)
  try {
    const url = new URL(target)
    if (url.protocol === 'ws:') url.protocol = 'http:'
    if (url.protocol === 'wss:') url.protocol = 'https:'
    return url.origin === owned && !url.username && !url.password
  } catch { return false }
}

/** Error messages/DOM snapshots may contain passwords, tokens, or typed case content. Persist the check and class only. */
export function browserFailureKind(error: unknown) {
  return error instanceof assert.AssertionError ? 'ASSERTION_FAILED' : 'BROWSER_OR_RUNTIME_CHECK_FAILED'
}
/**
 * The fixed code an assertion in this file names (e.g. PASSWORD_MUST_REQUIRE_REAL_MFA), so a CI failure says which proof broke.
 * Only an author-written UPPER_SNAKE constant is kept; a generated message (which can quote compared values) becomes
 * UNNAMED_ASSERTION, and a Playwright wait that ran out becomes PLAYWRIGHT_TIMEOUT. Nothing typed, bound or rendered is persisted.
 */
export function browserFailureCode(error: unknown) {
  if (error instanceof assert.AssertionError) {
    // Node appends the compared values after a blank line; only the author's first line is ever kept.
    const code = error.message.split('\n', 1)[0]
    return error.generatedMessage || !/^[A-Z][A-Z0-9_]{2,63}$/.test(code) ? 'UNNAMED_ASSERTION' : code
  }
  if (error instanceof Error && error.name === 'TimeoutError') return 'PLAYWRIGHT_TIMEOUT'
  return 'UNCLASSIFIED'
}
/**
 * A failed Chromium launch, classified from the launcher's own error into a fixed code. The message itself is never persisted:
 * the code is the only output, so nothing typed or bound can leak, and a CI failure still says why the browser did not start.
 */
export function browserLaunchFailureKind(error: unknown) {
  const message = error instanceof Error ? error.message : ''
  if (/Executable doesn't exist|browserType\.launch: .*not found/i.test(message)) return 'CHROMIUM_EXECUTABLE_MISSING'
  if (/Host system is missing dependencies|error while loading shared libraries/i.test(message)) return 'CHROMIUM_HOST_DEPENDENCIES_MISSING'
  if (/Timeout \d+ms exceeded/i.test(message)) return 'CHROMIUM_LAUNCH_TIMEOUT'
  if (/has been closed|exited|signal=SIG/i.test(message)) return 'CHROMIUM_EXITED_AT_LAUNCH'
  if (/Cannot find module|ERR_MODULE_NOT_FOUND/i.test(message)) return 'PLAYWRIGHT_MODULE_UNRESOLVED'
  return browserFailureKind(error)
}
export function browserProofPassed(result: Pick<BrowserResult,
  'setup' | 'profiles' | 'externalRequestsBlocked' | 'unhandledBrowserErrors' | 'serverErrors' | 'cleanup'>) {
  return result.setup === 'PASS' && result.externalRequestsBlocked === 0 &&
    result.unhandledBrowserErrors === 0 && result.serverErrors === 0 &&
    result.cleanup.browserClosed && result.cleanup.contextsClosed && result.cleanup.errors.length === 0 &&
    result.profiles.length === BROWSER_PROFILES.length &&
    BROWSER_PROFILES.every((profile) => {
      const matches = result.profiles.filter((row) => row.id === profile.id)
      return matches.length === 1 && matches[0].locale === profile.locale &&
        matches[0].viewport.width === profile.viewport.width && matches[0].viewport.height === profile.viewport.height &&
        matches[0].status === 'PASS' && matches[0].checks.length === REQUIRED_BROWSER_CHECKS.length &&
        REQUIRED_BROWSER_CHECKS.every((name) => matches[0].checks.filter((check) => check.name === name && check.status === 'PASS').length === 1)
    })
}
function record(value: unknown): Record<string, unknown> {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), 'JSON_OBJECT_REQUIRED')
  return value as Record<string, unknown>
}
async function json(response: BrowserResponse) {
  assert.ok(response.status() < 300, 'ACTUAL_BROWSER_WRITE_FAILED')
  return record(await response.json())
}
async function noOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth)
  assert.ok(overflow <= 1, 'VISIBLE_PAGE_HORIZONTAL_OVERFLOW')
}
async function visible(page: Page, name: string, role: 'heading' | 'button' | 'alert' = 'heading') {
  await page.getByRole(role, { name, exact: true }).first().waitFor({ state: 'visible', timeout: 30000 })
}
async function navigate(page: Page, origin: string, route: string) {
  const response = await page.goto(origin + route, { waitUntil: 'domcontentloaded', timeout: 60000 })
  assert.ok(response && response.status() === 200, 'ACTUAL_BROWSER_PAGE_NOT_200')
  assert.equal(new URL(page.url()).origin, origin, 'BROWSER_LEFT_OWNED_ORIGIN')
}
/**
 * The cookies the browser holds for the owned origin, read from the whole jar and matched by host and path.
 * `context.cookies(url)` is not used: Playwright treats only `localhost` as local and drops Secure cookies for any other
 * http URL, so on http://127.0.0.1 it hid the production Secure session cookie that Chromium itself stored and sent.
 */
export function cookiesForOwnedOrigin<T extends { domain: string; path: string }>(cookies: readonly T[], origin: string): T[] {
  const url = new URL(assertOwnedLocalOrigin(origin))
  return cookies.filter((cookie) => {
    const domain = cookie.domain.startsWith('.') ? cookie.domain.slice(1) : cookie.domain
    return (url.hostname === domain || url.hostname.endsWith(`.${domain}`)) && url.pathname.startsWith(cookie.path)
  })
}
async function ownedCookies(context: BrowserContext, origin: string) {
  return cookiesForOwnedOrigin(await context.cookies(), origin)
}
/**
 * Request headers carrying the browser's real cookies for the owned origin. Playwright's APIRequestContext applies the same
 * localhost-only rule as context.cookies(url) and would send a Secure session cookie to http://127.0.0.1 nowhere, so every
 * authenticated or denial request would silently go out anonymous.
 */
async function sessionHeaders(context: BrowserContext, origin: string, extra: Record<string, string> = {}) {
  const cookie = (await ownedCookies(context, origin)).map((item) => `${item.name}=${item.value}`).join('; ')
  return cookie ? { ...extra, cookie } : extra
}
/** A URL's pathname with UUIDs and digit runs masked, or null when unparsable; queries and fragments are never kept. */
export function maskedPath(url: string): string | null {
  try {
    return new URL(url).pathname
      .replace(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/gi, ':id')
      .replace(/\d+/g, ':n')
      .slice(0, 160)
  } catch { return null }
}
function actualResponse(page: Page, endpoint: string, method: string) {
  const pending = page.waitForResponse((response) => new URL(response.url()).pathname === endpoint &&
    response.request().method() === method, { timeout: 45000 })
  // A wait abandoned because the action before it failed must not reject unobserved and kill the process before the receipt
  // is written; awaiting it still throws.
  pending.catch(() => undefined)
  return pending
}
/** The last fixed stage a journey reached; persisted with a failure so a timeout says what it was waiting for. */
let browserStage = 'START'
/** The masked path of the last top-level document a journey page navigated to; persisted with a failure. */
let lastPagePath: string | null = null
const stage = (name: string) => { browserStage = name }
async function uiLogin(input: {
  context: BrowserContext; page: Page; origin: string; locale: string; organizationId: string
  person: { id: string; email: string }; password: string; mfaSecret: string
}) {
  const copy = input.locale === 'fr-CA' ? fr : en
  const { page, context, origin, person, password, mfaSecret } = input
  stage('SIGN_IN_PAGE')
  await navigate(page, origin, `/${input.locale}/sign-in`)
  await page.waitForFunction((locale) => document.documentElement.lang.toLowerCase() === locale.toLowerCase(), input.locale)
  await visible(page, copy.loginForm.welcome)
  stage('SIGN_IN_HYDRATION')
  await page.locator('form[data-hydrated="true"]').first().waitFor({ state: 'attached', timeout: 30000 })
  const email = page.getByLabel(copy.auth.email, { exact: true })
  const passwordField = page.getByLabel(copy.auth.password, { exact: true })
  await email.fill(person.email)
  await passwordField.fill(password)
  stage('PASSWORD_LOGIN')
  const loginPromise = actualResponse(page, '/api/auth/login', 'POST')
  await passwordField.press('Enter')
  const loginResponse = await loginPromise
  const login = await json(loginResponse)
  assert.equal(login.requiresMfa, true, 'PASSWORD_MUST_REQUIRE_REAL_MFA')
  assert.equal(record(login.user).id, person.id, 'LOGIN_IDENTITY_SUBSTITUTION')
  assert.ok(!(await ownedCookies(context, origin)).some((cookie) => cookie.name === 'nzila_session'), 'SESSION_ISSUED_BEFORE_MFA')
  stage('MFA_FIELD')
  const code = page.getByLabel(copy.loginForm.authenticatorCode, { exact: true })
  await code.waitFor({ state: 'visible' })
  let invalidCode = '000000'
  while (verifyTotp(mfaSecret, invalidCode)) invalidCode = String(Number(invalidCode) + 1).padStart(6, '0')
  stage('INVALID_MFA')
  await code.fill(invalidCode)
  const refusedPromise = actualResponse(page, '/api/auth/mfa/challenge', 'POST')
  await code.press('Enter')
  assert.equal((await refusedPromise).status(), 401, 'INVALID_UI_MFA_WAS_NOT_DENIED')
  stage('INVALID_MFA_ALERT')
  await page.getByRole('alert').filter({ hasText: copy.loginForm.invalidCode }).waitFor({ state: 'visible' })
  assert.ok(!(await ownedCookies(context, origin)).some((cookie) => cookie.name === 'nzila_session'), 'SESSION_ISSUED_AFTER_INVALID_MFA')
  stage('VALID_MFA')
  await code.fill(computeTotp(mfaSecret))
  const challengePromise = actualResponse(page, '/api/auth/mfa/challenge', 'POST')
  await code.press('Enter')
  const challenge = await json(await challengePromise)
  assert.equal(challenge.ok, true, 'MFA_DID_NOT_CONFIRM_SESSION')
  assert.equal(challenge.userId, person.id, 'MFA_IDENTITY_SUBSTITUTION')
  stage('ORGANIZATION_OR_DASHBOARD')
  const organizationChoice = page.getByRole('combobox', { name: copy.loginForm.organization, exact: true })
  const choice = organizationChoice.waitFor({ state: 'visible', timeout: 45000 }).then(() => 'CHOICE' as const)
  const bound = page.waitForURL((url) => url.pathname.startsWith(`/${input.locale}/dashboard`), { timeout: 45000 })
    .then(() => 'BOUND' as const)
  // The losing wait keeps running and later rejects; observe it so it cannot become an unhandled rejection.
  choice.catch(() => undefined); bound.catch(() => undefined)
  const next = await Promise.race([choice, bound])
  if (next === 'CHOICE') {
    const offered = await organizationChoice.locator('option:not([value=""])').count()
    assert.ok(offered > 0, 'NO_OFFERED_ORGANIZATION')
    if (offered > 1) {
      stage('ORGANIZATION_SWITCH')
      await organizationChoice.selectOption(input.organizationId)
      const selected = actualResponse(page, '/api/organizations/switch', 'POST')
      await page.getByRole('button', { name: copy.loginForm.continueOrganization, exact: true }).click()
      assert.equal((await json(await selected)).activeOrganizationId, input.organizationId, 'UI_ORGANIZATION_SUBSTITUTION')
    }
  }
  stage('DASHBOARD')
  await page.waitForURL((url) => url.pathname.startsWith(`/${input.locale}/dashboard`), { timeout: 45000 })
  stage('SESSION_COOKIE')
  const session = (await ownedCookies(context, origin)).find((cookie) => cookie.name === 'nzila_session')
  assert.ok(session?.value && session.httpOnly, 'REAL_HTTP_ONLY_SESSION_REQUIRED')
  stage('SESSION_ORGANIZATION')
  const selection = await context.request.get(origin + '/api/users/me/organizations', {
    headers: await sessionHeaders(context, origin), timeout: 30000,
  })
  assert.equal(selection.status(), 200, 'CANONICAL_UI_ORGANIZATION_SELECTION_FAILED')
  assert.equal(record(await selection.json()).activeOrganizationId, input.organizationId, 'UI_SESSION_ORGANIZATION_SUBSTITUTION')
  return (await ownedCookies(context, origin)).map((cookie) => `${cookie.name}=${cookie.value}`).join('; ')
}

export async function runBrowserAcceptance(input: {
  origin: string
  seed: Client
  fixture: Awaited<ReturnType<typeof seedNextHttpSmoke>>
  runtimeUrl: string
  authUrl: string
  stateDirectory: string
}): Promise<BrowserResult> {
  const result: BrowserResult = {
    status: 'FAIL', engine: null, engineVersion: null, profiles: [], setup: 'UNEXECUTED',
    externalRequestsBlocked: 0, unhandledBrowserErrors: 0, serverErrors: 0, rateLimitedResponses: 0, serverErrorPaths: [],
    cleanup: { browserClosed: false, contextsClosed: false, errors: [] },
    limitations: [
      'Owned disposable production Next/native V2 proof only; no staging, production, real inbox or live customer acceptance.',
      'Chromium desktop/mobile emulation only; physical devices, other browser engines and full WCAG certification remain unexecuted.',
      'Accessibility checks cover named controls, visible error feedback, keyboard authentication/reopening and horizontal overflow on the tested journeys.',
      'Required sign-in checks include sole-membership auto-binding and an explicit multiple-membership UI choice; fixture binding does not substitute for that flow.',
      'Context request interception is not an operating-system network-isolation proof.',
      'No screenshots, traces, videos, storageState, credential values, raw cookies or typed case narratives are written to this receipt.',
    ],
  }
  let browser: Browser | undefined
  let browserTemp: string | undefined
  const contexts = new Set<BrowserContext>()
  let fixture: OwnedLoadFixture
  const origin = assertOwnedLocalOrigin(input.origin)
  // Any other stray rejection during the browser run is recorded as a cleanup failure (the proof fails) instead of killing the
  // process before a receipt exists.
  const strayRejection = () => { result.cleanup.errors.push('UNHANDLED_BROWSER_REJECTION') }
  process.on('unhandledRejection', strayRejection)
  const close = async (context: BrowserContext) => {
    await context.close()
    contexts.delete(context)
  }
  const open = async (profile: Profile) => {
    assert.ok(browser, 'BROWSER_NOT_STARTED')
    const context = await browser.newContext({
      baseURL: origin, locale: profile.locale, viewport: profile.viewport,
      isMobile: profile.mobile, hasTouch: profile.mobile, timezoneId: 'America/Toronto',
      serviceWorkers: 'block', acceptDownloads: false,
    })
    contexts.add(context)
    await context.route('**/*', async (route) => {
      if (browserTargetAllowed(route.request().url(), origin)) await route.continue()
      else { result.externalRequestsBlocked++; await route.abort('blockedbyclient') }
    })
    await context.routeWebSocket('**/*', (socket) => {
      if (browserTargetAllowed(socket.url(), origin)) socket.connectToServer()
      else { result.externalRequestsBlocked++; socket.close({ code: 1008, reason: 'Owned fixture only' }) }
    })
    context.on('page', (page) => {
      page.on('pageerror', () => { result.unhandledBrowserErrors++ })
      page.on('framenavigated', (frame) => { if (frame === page.mainFrame()) lastPagePath = maskedPath(frame.url()) })
      page.on('response', (response) => {
        if (response.status() >= 500) {
          result.serverErrors++
          const masked = maskedPath(response.url())
          if (masked && result.serverErrorPaths.length < 20 && !result.serverErrorPaths.includes(masked)) result.serverErrorPaths.push(masked)
        }
        if (response.status() === 429) result.rateLimitedResponses++
      })
    })
    const page = await context.newPage()
    page.setDefaultTimeout(30000)
    return { context, page }
  }
  try {
    result.setupPhase = 'VERIFY_OWNED_FIXTURE'
    assert.ok(input.fixture.loadFixture, 'PRODUCER_OWNED_CASEWORK_FIXTURE_REQUIRED')
    fixture = input.fixture.loadFixture
    assert.ok(uuid.test(fixture.ownership), 'OWNED_FIXTURE_ID_REQUIRED')
    for (const url of [input.runtimeUrl, input.authUrl]) {
      const target = new URL(url)
      assert.equal(target.protocol, 'postgresql:')
      assert.equal(target.hostname, '127.0.0.1')
      assert.ok(Number(target.port) > 1024)
    }
    const cases = await input.seed.query(
      'SELECT claim_id::text,organization_id::text,member_id,claim_number FROM public.claims WHERE claim_id=ANY($1::uuid[])',
      [[fixture.memberCaseId, fixture.assignedCaseId, fixture.foreignCaseId]],
    )
    assert.equal(cases.rowCount, 3, 'ACTUAL_PRODUCER_CASES_REQUIRED')
    for (const row of cases.rows) {
      assert.equal(row.member_id, fixture.people.member.id)
      assert.equal(row.organization_id, row.claim_id === fixture.foreignCaseId ? fixture.foreignOrganizationId : fixture.organizationId)
    }
    // A positive base-case entitlement is fixture data, not a bypass or finance implementation.
    await input.seed.query(
      `INSERT INTO public.org_entitlements(id,organization_id,feature_key,status,granted_by,metadata)
       VALUES($1,$2,'grievance_case_suite','active',$3,$4::jsonb)
       ON CONFLICT(organization_id,feature_key) DO NOTHING`,
      [randomUUID(), fixture.organizationId, 'owned-browser-fixture', JSON.stringify({ fixtureOwnership: fixture.ownership })],
    )
    result.setupPhase = 'VERIFY_BROWSER_ENVIRONMENT'
    assert.ok(!process.env.DEBUG && !process.env.DEBUG_FILE && !process.env.PWDEBUG,
      'BROWSER_DEBUG_OUTPUT_MUST_BE_DISABLED')
    assert.ok(!process.env.HTTP_PROXY && !process.env.HTTPS_PROXY && !process.env.ALL_PROXY &&
      !process.env.http_proxy && !process.env.https_proxy && !process.env.all_proxy,
    'BROWSER_DRIVER_MUST_NOT_INHERIT_EXTERNAL_PROXIES')
    result.setupPhase = 'LAUNCH_INSTALLED_CHROMIUM'
    const playwright = createRequire(import.meta.url)('playwright') as Pick<typeof import('@playwright/test'), 'chromium'>
    mkdirSync(path.join(input.stateDirectory, 'browser-downloads'), { recursive: true })
    // Chromium creates its singleton socket under TMPDIR, and a Unix socket path is limited to 107 bytes. The owned state
    // directory sits deep in the workspace on CI, which pushed that path over the limit and Chromium aborted at launch. The
    // browser therefore gets its own short, owned temporary directory, removed when this stage ends.
    browserTemp = mkdtempSync(path.join(tmpdir(), 'uev2b-'))
    browser = await playwright.chromium.launch({
      channel: 'chromium', headless: true,
      downloadsPath: path.join(input.stateDirectory, 'browser-downloads'),
      env: {
        HOME: input.stateDirectory, TMPDIR: browserTemp, TMP: browserTemp, TEMP: browserTemp,
        ...(process.env.PATH ? { PATH: process.env.PATH } : {}),
        ...(process.env.SystemRoot ? { SystemRoot: process.env.SystemRoot } : {}),
        ...(process.env.WINDIR ? { WINDIR: process.env.WINDIR } : {}),
      },
    })
    result.engine = 'Chromium'
    result.engineVersion = browser.version()
    result.setupPhase = 'VERIFY_OR_ISSUE_SYNTHETIC_PRIMARY_ASSIGNMENT'
    const assigned = await input.seed.query(
      `SELECT 1 FROM public.ue_authority_resource_relationships WHERE organization_id=$1
       AND resource_id=$2 AND principal_user_id=$3 AND origin='explicit' AND relation='assignee'`,
      [fixture.organizationId, fixture.assignedCaseId, fixture.people.steward.id],
    )
    if (!assigned.rowCount) {
      const cookies = new Map<string, string>()
      for (const role of Object.keys(fixture.people) as (keyof OwnedLoadFixture['people'])[]) {
        cookies.set(role, await loginOwnedFixturePrincipal(origin, fixture.people[role], input.fixture.password,
          input.fixture.mfaSecret, fixture.organizationId))
      }
      await governPrimaryAssignment({ fixture, cookies, runtimeUrl: input.runtimeUrl, authUrl: input.authUrl })
      cookies.clear()
    }
    result.setup = 'PASS'
    result.setupPhase = 'QUALIFY_NAMED_BROWSER_JOURNEYS'
    for (const profile of BROWSER_PROFILES) {
      const copy = profile.locale === 'fr-CA' ? fr : en
      const row: ProfileResult = {
        id: profile.id, locale: profile.locale, viewport: profile.viewport, status: 'UNEXECUTED',
        checks: REQUIRED_BROWSER_CHECKS.map((name) => ({ name, status: 'UNEXECUTED' })),
      }
      result.profiles.push(row)
      const scope: BrowserContext[] = []
      let activeCheck = row.checks[0]
      const step = async (name: (typeof REQUIRED_BROWSER_CHECKS)[number], operation: () => Promise<void>) => {
        activeCheck = row.checks.find((check) => check.name === name)!
        stage('START')
        try { await operation(); activeCheck.status = 'PASS' }
        catch (error) {
          activeCheck.status = 'FAIL'; activeCheck.failureKind = browserFailureKind(error); activeCheck.failureCode = browserFailureCode(error); activeCheck.failureStage = browserStage
          if (lastPagePath) activeCheck.failurePath = lastPagePath
          throw error
        }
      }
      try {
        const member = await open(profile); scope.push(member.context)
        const staff = await open(profile); scope.push(staff.context)
        let createdId = '', createdNumber = '', deadlineId = '', memberCookie = ''
        const memberLogin = { ...member, origin, locale: profile.locale, organizationId: fixture.organizationId,
          person: fixture.people.member, password: input.fixture.password, mfaSecret: input.fixture.mfaSecret }
        await step('member-password-totp-ui', async () => { memberCookie = await uiLogin(memberLogin) })
        await step('member-intake-labels-and-create', async () => {
          stage('INTAKE_PAGE')
          await navigate(member.page, origin, `/${profile.locale}/dashboard/claims/new`)
          stage('INTAKE_HYDRATION')
          await member.page.locator('[data-testid="new-claim-form"][data-hydrated="true"]').waitFor({ state: 'attached', timeout: 30000 })
          stage('INTAKE_LABELS')
          for (const name of [copy.forms.caseTitle, copy.forms.category, copy.priority.label, copy.forms.detailedDescription,
            copy.forms.whenOccurred, copy.forms.location, copy.forms.witnesses]) {
            await member.page.getByLabel(name, { exact: false }).waitFor({ state: 'visible' })
          }
          await noOverflow(member.page)
          await member.page.getByLabel(copy.forms.caseTitle, { exact: false }).fill(`Owned browser intake ${fixture.ownership} ${profile.id}`)
          await member.page.getByLabel(copy.forms.category, { exact: false }).selectOption('Safety')
          await member.page.getByLabel(copy.forms.detailedDescription, { exact: false }).fill('Synthetic browser acceptance case. No customer data.')
          await member.page.getByLabel(copy.forms.whenOccurred, { exact: false }).fill(new Date(Date.now() - 86400000).toISOString().slice(0, 10))
          stage('INTAKE_SUBMIT')
          const responsePromise = actualResponse(member.page, '/api/cases/intake', 'POST')
          await member.page.getByRole('button', { name: copy.forms.submitCase, exact: true }).click()
          const body = await json(await responsePromise)
          assert.ok(typeof body.claimId === 'string' && uuid.test(body.claimId), 'INTAKE_DID_NOT_RETURN_CASE_ID')
          createdId = body.claimId
          const persisted = await input.seed.query(
            'SELECT claim_number,organization_id::text,member_id FROM public.claims WHERE claim_id=$1', [createdId],
          )
          assert.equal(persisted.rowCount, 1, 'UI_INTAKE_NOT_PERSISTED_EXACTLY_ONCE')
          assert.equal(persisted.rows[0].organization_id, fixture.organizationId)
          assert.equal(persisted.rows[0].member_id, fixture.people.member.id)
          createdNumber = persisted.rows[0].claim_number
          stage('INTAKE_LANDING')
          await member.page.waitForURL(`**/${profile.locale}/dashboard/claims/${createdId}`, { timeout: 30000 })
          await visible(member.page, createdNumber)
          await noOverflow(member.page)
        })
        await step('member-case-list-reopen', async () => {
          await navigate(member.page, origin, `/${profile.locale}/dashboard/claims`)
          await visible(member.page, copy.claimsPage.memberTitle)
          const link = member.page.locator(`[data-testid="member-case-list"] a[href="/${profile.locale}/dashboard/claims/${createdId}"]:visible`).first()
          await link.waitFor({ state: 'visible' })
          await noOverflow(member.page)
          await link.focus()
          await link.press('Enter')
          await visible(member.page, createdNumber)
        })
        await step('staff-password-totp-ui', async () => {
          await uiLogin({ ...staff, origin, locale: profile.locale, organizationId: fixture.organizationId,
            person: fixture.people.steward, password: input.fixture.password, mfaSecret: input.fixture.mfaSecret })
        })
        await step('staff-case-read', async () => {
          await navigate(staff.page, origin, `/${profile.locale}/dashboard/claims/${fixture.assignedCaseId}`)
          await visible(staff.page, cases.rows.find((caseRow) => caseRow.claim_id === fixture.assignedCaseId).claim_number)
          await staff.page.getByTestId('case-deadlines').getByLabel(copy.caseDeadlines.name, { exact: true }).waitFor({ state: 'visible' })
          await noOverflow(staff.page)
        })
        const deadlineName = `Owned browser deadline ${profile.id} ${fixture.ownership.slice(0, 8)}`
        const dueDay = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10)
        const nextDay = new Date(Date.now() + 8 * 86400000).toISOString().slice(0, 10)
        await step('staff-deadline-create-reschedule-complete-cancel', async () => {
          const section = staff.page.getByTestId('case-deadlines')
          const endpoint = `/api/cases/${fixture.assignedCaseId}/deadlines`
          await section.getByLabel(copy.caseDeadlines.name, { exact: true }).fill(deadlineName)
          await section.getByLabel(copy.caseDeadlines.dueDay, { exact: true }).fill(dueDay)
          const created = actualResponse(staff.page, endpoint, 'POST')
          await section.getByRole('button', { name: copy.caseDeadlines.create, exact: true }).click()
          const body = await json(await created)
          const deadline = record(body.deadline)
          assert.ok(typeof deadline.id === 'string' && uuid.test(deadline.id), 'UI_DEADLINE_ID_REQUIRED')
          deadlineId = deadline.id
          assert.equal(deadline.dueDay, dueDay)
          let item = section.locator('li').filter({ hasText: deadlineName })
          await item.getByRole('button', { name: copy.caseDeadlines.reschedule, exact: true }).click()
          await item.getByLabel(copy.caseDeadlines.newDueDay, { exact: true }).fill(nextDay)
          const rescheduled = actualResponse(staff.page, endpoint, 'PATCH')
          await item.getByRole('button', { name: copy.caseDeadlines.saveDate, exact: true }).click()
          assert.equal(record((await json(await rescheduled)).deadline).dueDay, nextDay)
          item = section.locator('li').filter({ hasText: deadlineName })
          const completed = actualResponse(staff.page, endpoint, 'PATCH')
          await item.getByRole('button', { name: copy.caseDeadlines.complete, exact: true }).click()
          assert.equal(record((await json(await completed)).deadline).status, 'completed')
          await item.getByText(copy.caseDeadlines.completed, { exact: false }).waitFor({ state: 'visible' })
          const persisted = await input.seed.query(
            'SELECT status,completed_by FROM public.claim_deadlines WHERE id=$1 AND claim_id=$2 AND organization_id=$3',
            [deadlineId, fixture.assignedCaseId, fixture.organizationId],
          )
          assert.deepEqual(persisted.rows, [{ status: 'completed', completed_by: fixture.people.steward.id }])
          const audit = await input.seed.query(
            'SELECT event_type FROM public.deadline_audit_events WHERE source_deadline_id=$1 AND organization_id=$2 ORDER BY event_type',
            [deadlineId, fixture.organizationId],
          )
          assert.deepEqual(audit.rows.map((event) => event.event_type),
            ['deadline.completed', 'deadline.created', 'deadline.rescheduled'])
          const cancelledName = `${deadlineName} cancelled`
          await section.getByLabel(copy.caseDeadlines.name, { exact: true }).fill(cancelledName)
          await section.getByLabel(copy.caseDeadlines.dueDay, { exact: true }).fill(dueDay)
          const secondCreated = actualResponse(staff.page, endpoint, 'POST')
          await section.getByRole('button', { name: copy.caseDeadlines.create, exact: true }).click()
          const secondDeadline = record((await json(await secondCreated)).deadline)
          assert.ok(typeof secondDeadline.id === 'string' && uuid.test(secondDeadline.id))
          const cancelled = actualResponse(staff.page, endpoint, 'PATCH')
          await section.locator('li').filter({ hasText: cancelledName })
            .getByRole('button', { name: copy.caseDeadlines.cancel, exact: true }).click()
          assert.equal(record((await json(await cancelled)).deadline).status, 'cancelled')
          const cancelledRow = await input.seed.query(
            'SELECT status FROM public.claim_deadlines WHERE id=$1 AND claim_id=$2 AND organization_id=$3',
            [secondDeadline.id, fixture.assignedCaseId, fixture.organizationId],
          )
          assert.deepEqual(cancelledRow.rows, [{ status: 'waived' }])
          const cancelledAudit = await input.seed.query(
            'SELECT event_type FROM public.deadline_audit_events WHERE source_deadline_id=$1 AND organization_id=$2 ORDER BY event_type',
            [secondDeadline.id, fixture.organizationId],
          )
          assert.deepEqual(cancelledAudit.rows.map((event) => event.event_type), ['deadline.cancelled', 'deadline.created'])
          await noOverflow(staff.page)
        })
        await step('member-deadline-read-only', async () => {
          await navigate(member.page, origin, `/${profile.locale}/dashboard/claims/${fixture.assignedCaseId}`)
          const section = member.page.getByTestId('case-deadlines')
          await section.getByText(deadlineName, { exact: true }).waitFor({ state: 'visible' })
          assert.equal(await section.getByLabel(copy.caseDeadlines.name, { exact: true }).count(), 0)
          const deniedId = randomUUID()
          const denied = await member.context.request.post(origin + `/api/cases/${fixture.assignedCaseId}/deadlines`, {
            headers: await sessionHeaders(member.context, origin, { origin }), data: { id: deniedId, title: 'Denied synthetic member deadline', dueDay }, timeout: 30000,
          })
          assert.ok([403, 404].includes(denied.status()), 'MEMBER_DEADLINE_MUTATION_WAS_NOT_DENIED')
          assert.equal((await input.seed.query('SELECT 1 FROM public.claim_deadlines WHERE id=$1', [deniedId])).rowCount, 0,
            'DENIED_MEMBER_DEADLINE_PERSISTED')
          await noOverflow(member.page)
        })
        await step('other-member-case-denial', async () => {
          const outsider = await open(profile); scope.push(outsider.context)
          await uiLogin({ ...outsider, origin, locale: profile.locale, organizationId: fixture.organizationId,
            person: { id: input.fixture.actor, email: `${input.fixture.actor}@example.invalid` },
            password: input.fixture.password, mfaSecret: input.fixture.mfaSecret })
          const response = await outsider.context.request.get(origin + `/api/cases/${createdId}`, { headers: await sessionHeaders(outsider.context, origin) })
          assert.ok([403, 404].includes(response.status()), 'OTHER_MEMBER_CASE_READ_ALLOWED')
          assert.ok(!(await response.text()).includes(createdNumber), 'DENIED_CASE_METADATA_DISCLOSED')
          await navigate(outsider.page, origin, `/${profile.locale}/dashboard/claims/${createdId}`)
          await visible(outsider.page, copy.claimsPage.notAvailableTitle)
          assert.equal(await outsider.page.getByRole('heading', { name: createdNumber, exact: true }).count(), 0)
        })
        await step('foreign-tenant-case-denial', async () => {
          const foreignNumber = cases.rows.find((caseRow) => caseRow.claim_id === fixture.foreignCaseId).claim_number
          for (const person of [member, staff]) {
            const response = await person.context.request.get(origin + `/api/cases/${fixture.foreignCaseId}`, { headers: await sessionHeaders(person.context, origin) })
            assert.ok([403, 404].includes(response.status()), 'FOREIGN_CASE_READ_ALLOWED')
            assert.ok(!(await response.text()).includes(foreignNumber), 'FOREIGN_CASE_METADATA_DISCLOSED')
          }
        })
        await step('finance-read-and-write-denial', async () => {
          const before = await input.seed.query('SELECT count(*)::text AS count FROM public.platform_invoices WHERE organization_id=$1', [fixture.organizationId])
          for (const person of [member, staff]) {
            assert.equal((await person.context.request.get(origin + '/api/finance/summary', { headers: await sessionHeaders(person.context, origin) })).status(), 403,
              'FINANCE_SUMMARY_WAS_NOT_DENIED')
            assert.equal((await person.context.request.post(origin + '/api/finance/invoices', {
              headers: await sessionHeaders(person.context, origin, { origin }), data: { billingPeriodId: randomUUID() },
            })).status(), 403, 'FINANCE_INVOICE_WRITE_WAS_NOT_DENIED')
          }
          const after = await input.seed.query('SELECT count(*)::text AS count FROM public.platform_invoices WHERE organization_id=$1', [fixture.organizationId])
          assert.deepEqual(after.rows, before.rows, 'DENIED_FINANCE_WRITE_PERSISTED')
        })
        await step('logout-revocation', async () => {
          // The browser's real cookie jar supplies and consumes the session cookie; no raw cookie is persisted.
          assert.ok(memberCookie.includes('nzila_session='), 'LOGOUT_NEEDS_A_REAL_SESSION')
          assert.equal((await member.context.request.post(origin + '/api/auth/logout', {
            headers: await sessionHeaders(member.context, origin, { origin }),
          })).status(), 200, 'REAL_LOGOUT_FAILED')
          assert.equal((await member.context.request.get(origin + '/api/auth/me', { headers: await sessionHeaders(member.context, origin) })).status(), 401,
            'BROWSER_SESSION_SURVIVED_LOGOUT')
          assert.equal((await member.context.request.get(origin + '/api/auth/me', { headers: { cookie: memberCookie } })).status(), 401,
            'REVOKED_REAL_SESSION_WAS_STILL_ACCEPTED')
          memberCookie = ''
        })
        row.status = 'PASS'
      } catch (error) {
        if (activeCheck.status !== 'FAIL') {
          activeCheck.status = 'FAIL'; activeCheck.failureKind = browserFailureKind(error); activeCheck.failureCode = browserFailureCode(error); activeCheck.failureStage = browserStage
          if (lastPagePath) activeCheck.failurePath = lastPagePath
        }
        row.status = 'FAIL'
      } finally {
        for (const context of scope) {
          try { await close(context) } catch { result.cleanup.errors.push('CONTEXT_CLOSE_FAILED') }
        }
      }
    }
  } catch (error) {
    result.setup = 'FAIL'
    result.setupFailureKind = result.setupPhase === 'LAUNCH_INSTALLED_CHROMIUM'
      ? browserLaunchFailureKind(error) : browserFailureKind(error)
  } finally {
    for (const context of contexts) {
      try { await close(context) } catch { result.cleanup.errors.push('CONTEXT_CLOSE_FAILED') }
    }
    result.cleanup.contextsClosed = contexts.size === 0
    try { await browser?.close(); result.cleanup.browserClosed = true }
    catch { result.cleanup.errors.push('BROWSER_CLOSE_FAILED') }
    if (browserTemp) {
      try { rmSync(browserTemp, { recursive: true, force: true }) }
      catch { result.cleanup.errors.push('BROWSER_TEMP_REMOVAL_FAILED') }
    }
    // Waits rejected by the context/browser close above settle on the next turns; let them land while the listener is attached.
    await new Promise((resolve) => setTimeout(resolve, 50))
    process.off('unhandledRejection', strayRejection)
    result.status = browserProofPassed(result) ? 'PASS' : 'FAIL'
  }
  return result
}
