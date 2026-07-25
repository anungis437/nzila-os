/**
 * Phase 0C.2 §12 — Auth-state generator.
 *
 * Produces Playwright `storageState` JSON files for the five canonical Union
 * Eyes QA personas by:
 *
 *   1. POST /api/auth/login with the fixture credentials.
 *   2. Extracting the `nzila_session` cookie from the `Set-Cookie` header.
 *   3. Verifying GET /api/auth/me returns the expected user email.
 *   4. Writing `playwright/.auth/<role>.json` in Playwright storageState v1 shape.
 *
 * The generator assumes the target server is already reachable — it does not
 * boot or manage a server. Boot orchestration is the caller's responsibility
 * (see `prove-phase-0c2-auth-state-generator.ts` and `run.ts`).
 *
 * Personas (from `apps/union-eyes/tests/fixtures/test-users.ts`):
 *
 *   member      → ue.qa.member.primary@nzila.test
 *   steward     → ue.qa.steward.primary@nzila.test
 *   staff       → ue.qa.staff.primary@nzila.test
 *   executive   → ue.qa.executive.primary@nzila.test
 *   admin       → ue.qa.admin.primary@nzila.test
 *
 * Storage-state layout:
 *
 *   {
 *     "cookies": [
 *       {
 *         "name": "nzila_session",
 *         "value": "<opaque-token>",
 *         "domain": "localhost",
 *         "path": "/",
 *         "expires": <unix-seconds>,
 *         "httpOnly": true,
 *         "secure": false,
 *         "sameSite": "Lax"
 *       }
 *     ],
 *     "origins": []
 *   }
 */

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export interface PersonaSpec {
  role: 'member' | 'steward' | 'staff' | 'executive' | 'admin'
  email: string
  password: string
}

export const CANONICAL_PERSONAS: readonly PersonaSpec[] = [
  { role: 'member', email: 'ue.qa.member.primary@nzila.test', password: 'NzilaQa!2026' },
  { role: 'steward', email: 'ue.qa.steward.primary@nzila.test', password: 'NzilaQa!2026' },
  { role: 'staff', email: 'ue.qa.staff.primary@nzila.test', password: 'NzilaQa!2026' },
  { role: 'executive', email: 'ue.qa.executive.primary@nzila.test', password: 'NzilaQa!2026' },
  { role: 'admin', email: 'ue.qa.admin.primary@nzila.test', password: 'NzilaQa!2026' },
] as const

export interface GenerateAuthStatesOptions {
  baseUrl: string
  outputDir: string
  personas?: readonly PersonaSpec[]
  requestTimeoutMs?: number
  /**
   * Maximum number of RETRY attempts (excluding the initial attempt) for a
   * transient failure (HTTP 5xx or fetch/network error) on either the login
   * or /me call. Default 2 → up to 3 total attempts per call.
   *
   * Rationale: Next.js dev-mode compiles routes (including `_error`) lazily
   * and the manifest write can race with concurrent request handlers,
   * producing a transient 500 ("Manifest file is empty"). This retry loop
   * makes the generator resilient to that dev-mode race without masking
   * genuine product bugs — a real 5xx still fails after N attempts and
   * every retry is logged to stderr for visibility.
   *
   * Non-transient failures (4xx, cookie missing, email mismatch) are NOT
   * retried — those are product bugs and must fail loudly.
   */
  maxRetries?: number
  /**
   * Delay in ms between retry attempts. Default 1500ms. Chosen to allow a
   * short-lived Next.js dev-mode compilation window (~1s typical) to
   * complete before the next attempt.
   */
  retryDelayMs?: number
  /**
   * Optional sink for retry log lines (defaults to `process.stderr.write`).
   * Injected in tests to assert retry visibility.
   */
  onRetryLog?: (line: string) => void
}

export interface PersonaResult {
  role: PersonaSpec['role']
  email: string
  ok: boolean
  loginStatus: number
  meStatus: number
  meEmail?: string
  cookieName?: string
  cookieValueSample?: string
  cookieExpires?: number
  storageStatePath?: string
  error?: string
  /** Number of login attempts made (1 = success on first try, 2+ = retries). */
  loginAttempts?: number
  /** Number of /me attempts made (1 = success on first try, 2+ = retries). */
  meAttempts?: number
}

export interface GenerateAuthStatesResult {
  baseUrl: string
  outputDir: string
  results: PersonaResult[]
  allOk: boolean
}

interface ParsedCookie {
  name: string
  value: string
  domain?: string
  path?: string
  expiresUnix?: number
  httpOnly: boolean
  secure: boolean
  sameSite?: 'Strict' | 'Lax' | 'None'
}

// ─── Set-Cookie parsing ─────────────────────────────────────────────────────

function parseSetCookie(raw: string): ParsedCookie | null {
  if (!raw) return null
  const parts = raw.split(';').map((p) => p.trim())
  const head = parts.shift()
  if (!head) return null
  const eq = head.indexOf('=')
  if (eq <= 0) return null
  const cookie: ParsedCookie = {
    name: head.slice(0, eq).trim(),
    value: head.slice(eq + 1),
    httpOnly: false,
    secure: false,
  }
  for (const attr of parts) {
    const [k, ...vRest] = attr.split('=')
    const key = (k ?? '').toLowerCase().trim()
    const val = vRest.join('=').trim()
    if (key === 'httponly') cookie.httpOnly = true
    else if (key === 'secure') cookie.secure = true
    else if (key === 'path') cookie.path = val
    else if (key === 'domain') cookie.domain = val
    else if (key === 'expires') {
      const t = Date.parse(val)
      if (!Number.isNaN(t)) cookie.expiresUnix = Math.floor(t / 1000)
    } else if (key === 'max-age') {
      const secs = Number(val)
      if (!Number.isNaN(secs)) cookie.expiresUnix = Math.floor(Date.now() / 1000) + secs
    } else if (key === 'samesite') {
      const lv = val.toLowerCase()
      cookie.sameSite = lv === 'strict' ? 'Strict' : lv === 'none' ? 'None' : 'Lax'
    }
  }
  return cookie
}

function extractSessionCookie(res: Response, cookieName: string): ParsedCookie | null {
  const list: string[] =
    typeof (res.headers as unknown as { getSetCookie?: () => string[] }).getSetCookie === 'function'
      ? (res.headers as unknown as { getSetCookie: () => string[] }).getSetCookie()
      : [res.headers.get('set-cookie') ?? ''].filter(Boolean)
  for (const raw of list) {
    const parsed = parseSetCookie(raw)
    if (parsed && parsed.name === cookieName) return parsed
  }
  return null
}

// ─── HTTP with timeout ──────────────────────────────────────────────────────

async function fetchWithTimeout(url: string, init: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    return await fetch(url, { ...init, signal: controller.signal })
  } finally {
    clearTimeout(timer)
  }
}

// ─── Retry helper ───────────────────────────────────────────────────────────
//
// Retries the given async request producer on:
//   - fetch/network errors (any thrown exception), OR
//   - HTTP 5xx responses (transient framework/dev-mode failures).
//
// Does NOT retry on:
//   - 4xx responses (bad credentials, forbidden, not found — product bugs),
//   - 2xx/3xx responses (success — return as-is).
//
// Every retry attempt is logged to the provided sink so real product bugs
// remain visible even after a retry masks a transient framework hiccup.

interface RetryOutcome {
  response?: Response
  error?: unknown
  attempts: number
}

async function sleep(ms: number): Promise<void> {
  await new Promise<void>((resolve) => setTimeout(resolve, ms))
}

async function fetchWithRetry(args: {
  label: string
  requestFn: () => Promise<Response>
  maxRetries: number
  retryDelayMs: number
  log: (line: string) => void
}): Promise<RetryOutcome> {
  const maxAttempts = args.maxRetries + 1
  let lastError: unknown
  let lastResponse: Response | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const response = await args.requestFn()
      if (response.status < 500) {
        return { response, attempts: attempt }
      }
      // 5xx — transient. Consume body so the socket can be reused.
      const bodyPreview = await response.text().catch(() => '')
      lastResponse = new Response(bodyPreview, {
        status: response.status,
        headers: response.headers,
      })
      if (attempt < maxAttempts) {
        args.log(
          `[generate-auth-states] retry ${attempt}/${args.maxRetries} for ${args.label}: HTTP ${response.status} — waiting ${args.retryDelayMs}ms (body: ${bodyPreview.slice(0, 160).replace(/\s+/g, ' ')})\n`,
        )
        await sleep(args.retryDelayMs)
        continue
      }
      return { response: lastResponse, attempts: attempt }
    } catch (err) {
      lastError = err
      if (attempt < maxAttempts) {
        const msg = err instanceof Error ? err.message : String(err)
        args.log(
          `[generate-auth-states] retry ${attempt}/${args.maxRetries} for ${args.label}: fetch error ${msg} — waiting ${args.retryDelayMs}ms\n`,
        )
        await sleep(args.retryDelayMs)
        continue
      }
      return { error: lastError, attempts: attempt }
    }
  }
  // Unreachable — loop always returns.
  return { error: lastError, response: lastResponse, attempts: maxAttempts }
}

// ─── Storage-state file ─────────────────────────────────────────────────────

function buildStorageState(
  cookie: ParsedCookie,
  domain: string,
): { cookies: unknown[]; origins: unknown[] } {
  const expires =
    cookie.expiresUnix ?? Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60
  return {
    cookies: [
      {
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain ?? domain,
        path: cookie.path ?? '/',
        expires,
        httpOnly: cookie.httpOnly,
        secure: cookie.secure,
        sameSite: cookie.sameSite ?? 'Lax',
      },
    ],
    origins: [],
  }
}

function extractDomain(baseUrl: string): string {
  try {
    return new URL(baseUrl).hostname
  } catch {
    return 'localhost'
  }
}

// ─── Main generator ─────────────────────────────────────────────────────────

const SESSION_COOKIE_NAME = 'nzila_session'

/**
 * User-Agent required to activate the Playwright E2E auth bypass in
 * `@nzila/platform-auth`. The server-side check (`isPlaywrightE2EAuthRequest`)
 * requires BOTH:
 *
 *   - `PLAYWRIGHT_TEST_AUTH=true` in the server env, AND
 *   - a User-Agent string containing `playwright-e2e-auth`.
 *
 * The generator sends this UA on every request so the auth service:
 *   (a) skips the MFA gate (test fixture users have no TOTP enrolled),
 *   (b) skips risk assessment (avoids "try again in a few minutes" rate-limit),
 *   (c) still exercises the real password hash comparison and session write.
 */
const E2E_USER_AGENT = 'nzila-phase-0c2-auth-state-generator playwright-e2e-auth'

export async function generateAuthStates(
  options: GenerateAuthStatesOptions,
): Promise<GenerateAuthStatesResult> {
  const personas = options.personas ?? CANONICAL_PERSONAS
  const timeoutMs = options.requestTimeoutMs ?? 20_000
  const maxRetries = options.maxRetries ?? 2
  const retryDelayMs = options.retryDelayMs ?? 1500
  const log =
    options.onRetryLog ??
    ((line: string) => {
      process.stderr.write(line)
    })
  const domain = extractDomain(options.baseUrl)

  mkdirSync(options.outputDir, { recursive: true })

  const results: PersonaResult[] = []

  for (const persona of personas) {
    const result: PersonaResult = {
      role: persona.role,
      email: persona.email,
      ok: false,
      loginStatus: 0,
      meStatus: 0,
    }

    try {
      // 1) Login (with retry on 5xx / network error)
      const loginOutcome = await fetchWithRetry({
        label: `POST /api/auth/login (${persona.role})`,
        maxRetries,
        retryDelayMs,
        log,
        requestFn: () =>
          fetchWithTimeout(
            `${options.baseUrl.replace(/\/$/, '')}/api/auth/login`,
            {
              method: 'POST',
              headers: {
                'content-type': 'application/json',
                accept: 'application/json',
                'user-agent': E2E_USER_AGENT,
              },
              body: JSON.stringify({ email: persona.email, password: persona.password }),
            },
            timeoutMs,
          ),
      })
      result.loginAttempts = loginOutcome.attempts
      if (!loginOutcome.response) {
        const msg =
          loginOutcome.error instanceof Error
            ? loginOutcome.error.message
            : String(loginOutcome.error ?? 'unknown fetch error')
        result.error = `login fetch failed after ${loginOutcome.attempts} attempts: ${msg}`
        results.push(result)
        continue
      }
      const loginRes = loginOutcome.response
      result.loginStatus = loginRes.status
      if (loginRes.status !== 200) {
        const text = await loginRes.text().catch(() => '')
        result.error = `login returned ${loginRes.status} after ${loginOutcome.attempts} attempts: ${text.slice(0, 240)}`
        results.push(result)
        continue
      }

      const cookie = extractSessionCookie(loginRes, SESSION_COOKIE_NAME)
      if (!cookie) {
        result.error = `login OK but no '${SESSION_COOKIE_NAME}' cookie in response`
        results.push(result)
        continue
      }
      result.cookieName = cookie.name
      result.cookieValueSample = cookie.value.slice(0, 8) + '…'
      result.cookieExpires = cookie.expiresUnix

      // 2) Verify via /api/auth/me carrying the cookie (with retry on 5xx / network error)
      const meOutcome = await fetchWithRetry({
        label: `GET /api/auth/me (${persona.role})`,
        maxRetries,
        retryDelayMs,
        log,
        requestFn: () =>
          fetchWithTimeout(
            `${options.baseUrl.replace(/\/$/, '')}/api/auth/me`,
            {
              method: 'GET',
              headers: {
                cookie: `${cookie.name}=${cookie.value}`,
                accept: 'application/json',
              },
            },
            timeoutMs,
          ),
      })
      result.meAttempts = meOutcome.attempts
      if (!meOutcome.response) {
        const msg =
          meOutcome.error instanceof Error
            ? meOutcome.error.message
            : String(meOutcome.error ?? 'unknown fetch error')
        result.error = `me fetch failed after ${meOutcome.attempts} attempts: ${msg}`
        results.push(result)
        continue
      }
      const meRes = meOutcome.response
      result.meStatus = meRes.status
      let meBody: { user?: { email?: string } | null } = { user: null }
      try {
        meBody = (await meRes.json()) as { user?: { email?: string } | null }
      } catch {
        // leave default
      }
      const meEmail = meBody.user?.email
      result.meEmail = meEmail
      if (meRes.status !== 200 || !meEmail) {
        result.error = `me returned status=${meRes.status} email=${JSON.stringify(meEmail)} after ${meOutcome.attempts} attempts`
        results.push(result)
        continue
      }
      if (meEmail.toLowerCase() !== persona.email.toLowerCase()) {
        result.error = `me email mismatch: expected ${persona.email}, got ${meEmail}`
        results.push(result)
        continue
      }

      // 3) Write storageState file
      const filePath = path.join(options.outputDir, `${persona.role}.json`)
      const state = buildStorageState(cookie, domain)
      writeFileSync(filePath, JSON.stringify(state, null, 2) + '\n', 'utf8')
      result.storageStatePath = filePath
      result.ok = true
      results.push(result)
    } catch (err) {
      result.error = err instanceof Error ? err.message : String(err)
      results.push(result)
    }
  }

  const summary: GenerateAuthStatesResult = {
    baseUrl: options.baseUrl,
    outputDir: options.outputDir,
    results,
    allOk: results.every((r) => r.ok),
  }
  writeFileSync(
    path.join(options.outputDir, 'summary.json'),
    JSON.stringify(summary, null, 2) + '\n',
    'utf8',
  )
  return summary
}

// ─── CLI wrapper ────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const baseUrl = process.env.NZILA_AUTH_STATE_BASE_URL ?? process.env.NEXT_PUBLIC_APP_URL
  if (!baseUrl) {
    process.stderr.write(
      '[generate-auth-states] NZILA_AUTH_STATE_BASE_URL or NEXT_PUBLIC_APP_URL required\n',
    )
    process.exit(2)
  }
  const outputDir =
    process.env.NZILA_AUTH_STATE_DIR ??
    path.resolve(__dirname, '..', '..', 'playwright', '.auth')

  const summary = await generateAuthStates({ baseUrl, outputDir })
  process.stdout.write(JSON.stringify(summary, null, 2) + '\n')
  process.exit(summary.allOk ? 0 : 1)
}

// Only run main when invoked directly (not when imported).
// tsx / Node loaders both leave process.argv[1] pointing at this file.
const invokedDirectly =
  process.argv[1] &&
  (process.argv[1].endsWith('generate-auth-states.ts') ||
    process.argv[1].endsWith('generate-auth-states.js'))

if (invokedDirectly) {
  main().catch((err) => {
    process.stderr.write(
      `[generate-auth-states] fatal: ${err instanceof Error ? err.stack : String(err)}\n`,
    )
    process.exit(3)
  })
}
