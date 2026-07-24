/**
 * Phase 0C.2 §7 — Auth-state generator unit tests.
 *
 * The generator is normally exercised by an integration prove-script
 * (prove-phase-0c2-auth-state-generator.ts) that boots a real Next.js
 * server. Those tests are slow and depend on Postgres + Drizzle +
 * platform-auth. This file instead pins the CONTRACT of the pure
 * generator module by mocking `fetch` and asserting the shape of the
 * requests it issues and the storageState files it writes.
 *
 * Coverage:
 *   1. Happy path — all 5 personas login OK, cookie extracted, me
 *      verified, storageState files written, summary.json allOk=true.
 *   2. Persona-scoped failure — login 401 for one persona leaves the
 *      other four ok; overall allOk=false; error field populated.
 *   3. Cookie missing — login 200 but Set-Cookie header absent →
 *      recorded as failure with "no 'nzila_session' cookie" error.
 *   4. Me mismatch — /api/auth/me returns a different email → refuses
 *      to write storageState; recorded as mismatch error.
 *   5. Me returns non-200 — recorded as me-status failure.
 *   6. Request UA — every login request MUST carry a User-Agent that
 *      contains 'playwright-e2e-auth' (activates the server bypass).
 *   7. StorageState shape — file contains cookie name, domain from
 *     baseUrl hostname, sameSite Lax default, non-null expires.
 *   8. summary.json — always written even on partial failure; contains
 *      per-persona `results` array with role + email preserved.
 *
 * Non-goals:
 *   - This file does NOT exercise the CLI wrapper (main()) — its argv
 *     resolution is trivial and covered by the prove-script.
 *   - This file does NOT exercise the real Next.js login route — that
 *     is the prove-script's job.
 */
import { existsSync, mkdirSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import {
  CANONICAL_PERSONAS,
  generateAuthStates,
  type GenerateAuthStatesResult,
  type PersonaSpec,
} from './generate-auth-states'

// ─── Test scaffolding ───────────────────────────────────────────────────────

const BASE_URL = 'http://localhost:39999'
let tmpDir: string
let fetchMock: ReturnType<typeof vi.fn>

function makeLoginResponse(overrides?: {
  status?: number
  cookie?: string | null
  body?: string
}): Response {
  const status = overrides?.status ?? 200
  const cookie = overrides?.cookie
  const body = overrides?.body ?? '{"ok":true}'
  const headers = new Headers({ 'content-type': 'application/json' })
  if (cookie) headers.append('set-cookie', cookie)
  return new Response(body, { status, headers })
}

function makeMeResponse(email: string | null, status = 200): Response {
  const body = email ? JSON.stringify({ user: { email } }) : '{"user":null}'
  return new Response(body, { status, headers: { 'content-type': 'application/json' } })
}

function goodCookie(role: string): string {
  // Deterministic, obviously test-shaped cookie. NOT a real session token.
  return `nzila_session=session-token-${role}-abcdef1234; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`
}

beforeEach(() => {
  tmpDir = path.join(tmpdir(), `auth-state-test-${process.pid}-${Date.now()}`)
  mkdirSync(tmpDir, { recursive: true })
  fetchMock = vi.fn()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(globalThis as any).fetch = fetchMock
})

afterEach(() => {
  try {
    rmSync(tmpDir, { recursive: true, force: true })
  } catch {
    // ignore
  }
  vi.restoreAllMocks()
})

// ─── Tests ──────────────────────────────────────────────────────────────────

describe('generateAuthStates — happy path (all 5 personas OK)', () => {
  beforeEach(() => {
    // For each of the 5 personas: login(200 + cookie) then me(200 + matching email).
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.endsWith('/api/auth/login')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { email: string }
        const role = body.email.split('.')[2] ?? 'unknown'
        return Promise.resolve(makeLoginResponse({ cookie: goodCookie(role) }))
      }
      if (u.endsWith('/api/auth/me')) {
        // Echo whichever email is in the cookie via role → email map.
        const cookieHeader = String((init?.headers as Record<string, string>)?.cookie ?? '')
        const roleMatch = cookieHeader.match(/session-token-([a-z]+)-/)
        const role = roleMatch?.[1] ?? 'member'
        const persona = CANONICAL_PERSONAS.find((p) => p.role === role)
        return Promise.resolve(makeMeResponse(persona?.email ?? null))
      }
      throw new Error(`unexpected fetch to ${u}`)
    })
  })

  it('writes storageState per persona and summary.json with allOk=true', async () => {
    const result = await generateAuthStates({ baseUrl: BASE_URL, outputDir: tmpDir })

    expect(result.allOk).toBe(true)
    expect(result.results).toHaveLength(5)
    for (const persona of CANONICAL_PERSONAS) {
      const r = result.results.find((x) => x.role === persona.role)
      expect(r).toBeDefined()
      expect(r?.ok).toBe(true)
      expect(r?.loginStatus).toBe(200)
      expect(r?.meStatus).toBe(200)
      expect(r?.meEmail?.toLowerCase()).toBe(persona.email.toLowerCase())
      expect(r?.storageStatePath).toBeDefined()
      expect(existsSync(r!.storageStatePath!)).toBe(true)
    }
    const summaryPath = path.join(tmpDir, 'summary.json')
    expect(existsSync(summaryPath)).toBe(true)
    const parsed = JSON.parse(readFileSync(summaryPath, 'utf8')) as GenerateAuthStatesResult
    expect(parsed.allOk).toBe(true)
    expect(parsed.baseUrl).toBe(BASE_URL)
  })

  it('every login request carries a User-Agent containing "playwright-e2e-auth"', async () => {
    await generateAuthStates({ baseUrl: BASE_URL, outputDir: tmpDir })
    const loginCalls = fetchMock.mock.calls.filter(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (c: any[]) => String(c[0]).endsWith('/api/auth/login'),
    )
    expect(loginCalls).toHaveLength(5)
    for (const call of loginCalls) {
      const init = call[1] as RequestInit
      const headers = init.headers as Record<string, string>
      expect(headers['user-agent']).toBeDefined()
      expect(headers['user-agent']).toContain('playwright-e2e-auth')
    }
  })

  it('written storageState files are Playwright v1 shape with nzila_session cookie', async () => {
    await generateAuthStates({ baseUrl: BASE_URL, outputDir: tmpDir })
    for (const persona of CANONICAL_PERSONAS) {
      const filePath = path.join(tmpDir, `${persona.role}.json`)
      const state = JSON.parse(readFileSync(filePath, 'utf8')) as {
        cookies: Array<{
          name: string
          value: string
          domain: string
          path: string
          expires: number
          httpOnly: boolean
          secure: boolean
          sameSite: string
        }>
        origins: unknown[]
      }
      expect(state.cookies).toHaveLength(1)
      const c = state.cookies[0]
      expect(c.name).toBe('nzila_session')
      expect(c.value).toMatch(/^session-token-[a-z]+-/)
      expect(c.domain).toBe('localhost') // extracted from BASE_URL hostname
      expect(c.path).toBe('/')
      expect(c.httpOnly).toBe(true)
      expect(c.secure).toBe(false)
      expect(c.sameSite).toBe('Lax')
      expect(c.expires).toBeGreaterThan(0)
      expect(state.origins).toEqual([])
    }
  })
})

describe('generateAuthStates — per-persona failure isolation', () => {
  it('one login failure does not prevent the other four from succeeding', async () => {
    fetchMock.mockImplementation((url: string, init?: RequestInit) => {
      const u = String(url)
      if (u.endsWith('/api/auth/login')) {
        const body = JSON.parse(String(init?.body ?? '{}')) as { email: string }
        if (body.email.includes('.staff.')) {
          return Promise.resolve(makeLoginResponse({ status: 401, cookie: null, body: '{"error":"bad-creds"}' }))
        }
        const role = body.email.split('.')[2] ?? 'unknown'
        return Promise.resolve(makeLoginResponse({ cookie: goodCookie(role) }))
      }
      if (u.endsWith('/api/auth/me')) {
        const cookieHeader = String((init?.headers as Record<string, string>)?.cookie ?? '')
        const roleMatch = cookieHeader.match(/session-token-([a-z]+)-/)
        const role = roleMatch?.[1] ?? 'member'
        const persona = CANONICAL_PERSONAS.find((p) => p.role === role)
        return Promise.resolve(makeMeResponse(persona?.email ?? null))
      }
      throw new Error(`unexpected fetch to ${u}`)
    })

    const result = await generateAuthStates({ baseUrl: BASE_URL, outputDir: tmpDir })

    expect(result.allOk).toBe(false)
    const staff = result.results.find((r) => r.role === 'staff')
    expect(staff?.ok).toBe(false)
    expect(staff?.loginStatus).toBe(401)
    expect(staff?.error).toContain('login returned 401')

    // Other 4 personas succeeded.
    const otherRoles: PersonaSpec['role'][] = ['member', 'steward', 'executive', 'admin']
    for (const role of otherRoles) {
      const r = result.results.find((x) => x.role === role)
      expect(r?.ok).toBe(true)
      expect(existsSync(path.join(tmpDir, `${role}.json`))).toBe(true)
    }
    // No file for the failing persona.
    expect(existsSync(path.join(tmpDir, 'staff.json'))).toBe(false)
  })
})

describe('generateAuthStates — cookie extraction failure', () => {
  it('records failure when login 200 but no Set-Cookie header', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url)
      if (u.endsWith('/api/auth/login')) {
        // 200 but NO set-cookie header
        return Promise.resolve(makeLoginResponse({ cookie: null }))
      }
      throw new Error('should not reach me endpoint')
    })
    const result = await generateAuthStates({
      baseUrl: BASE_URL,
      outputDir: tmpDir,
      personas: [CANONICAL_PERSONAS[0]!],
    })
    expect(result.allOk).toBe(false)
    expect(result.results).toHaveLength(1)
    const r = result.results[0]!
    expect(r.ok).toBe(false)
    expect(r.loginStatus).toBe(200)
    expect(r.error).toContain("no 'nzila_session' cookie")
    expect(existsSync(path.join(tmpDir, `${r.role}.json`))).toBe(false)
  })
})

describe('generateAuthStates — /me verification', () => {
  it('records failure when me returns a different email', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url)
      if (u.endsWith('/api/auth/login')) {
        return Promise.resolve(makeLoginResponse({ cookie: goodCookie('member') }))
      }
      if (u.endsWith('/api/auth/me')) {
        return Promise.resolve(makeMeResponse('imposter@nzila.test'))
      }
      throw new Error(`unexpected ${u}`)
    })
    const result = await generateAuthStates({
      baseUrl: BASE_URL,
      outputDir: tmpDir,
      personas: [CANONICAL_PERSONAS[0]!], // member
    })
    expect(result.allOk).toBe(false)
    const r = result.results[0]!
    expect(r.ok).toBe(false)
    expect(r.meStatus).toBe(200)
    expect(r.meEmail).toBe('imposter@nzila.test')
    expect(r.error).toContain('me email mismatch')
    expect(existsSync(path.join(tmpDir, `${r.role}.json`))).toBe(false)
  })

  it('records failure when me returns non-200 status', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url)
      if (u.endsWith('/api/auth/login')) {
        return Promise.resolve(makeLoginResponse({ cookie: goodCookie('admin') }))
      }
      if (u.endsWith('/api/auth/me')) {
        return Promise.resolve(makeMeResponse(null, 403))
      }
      throw new Error(`unexpected ${u}`)
    })
    const result = await generateAuthStates({
      baseUrl: BASE_URL,
      outputDir: tmpDir,
      personas: [CANONICAL_PERSONAS.find((p) => p.role === 'admin')!],
    })
    expect(result.allOk).toBe(false)
    const r = result.results[0]!
    expect(r.ok).toBe(false)
    expect(r.meStatus).toBe(403)
    expect(r.error).toContain('me returned status=403')
  })
})

describe('generateAuthStates — summary.json is always written', () => {
  it('writes summary.json even when every persona fails', async () => {
    fetchMock.mockResolvedValue(
      makeLoginResponse({ status: 500, cookie: null, body: '{"error":"boom"}' }),
    )
    const result = await generateAuthStates({ baseUrl: BASE_URL, outputDir: tmpDir })

    expect(result.allOk).toBe(false)
    expect(result.results.every((r) => r.ok === false)).toBe(true)

    const summaryPath = path.join(tmpDir, 'summary.json')
    expect(existsSync(summaryPath)).toBe(true)
    const parsed = JSON.parse(readFileSync(summaryPath, 'utf8')) as GenerateAuthStatesResult
    expect(parsed.allOk).toBe(false)
    expect(parsed.results).toHaveLength(5)
    for (const r of parsed.results) {
      expect(r.ok).toBe(false)
      expect(r.loginStatus).toBe(500)
      expect(r.error).toContain('login returned 500')
      // Verify each canonical persona.email is preserved.
      const canonical = CANONICAL_PERSONAS.find((p) => p.role === r.role)
      expect(r.email).toBe(canonical?.email)
    }
  })
})

describe('generateAuthStates — network error propagates as per-persona error', () => {
  it('captures thrown fetch error into result.error without crashing the run', async () => {
    fetchMock.mockImplementation((url: string) => {
      const u = String(url)
      if (u.endsWith('/api/auth/login')) {
        return Promise.reject(new Error('ECONNREFUSED'))
      }
      if (u.endsWith('/api/auth/me')) {
        return Promise.resolve(makeMeResponse('irrelevant@test'))
      }
      throw new Error(`unexpected ${u}`)
    })

    const result = await generateAuthStates({
      baseUrl: BASE_URL,
      outputDir: tmpDir,
      personas: [CANONICAL_PERSONAS[0]!],
    })

    expect(result.allOk).toBe(false)
    const r = result.results[0]!
    expect(r.ok).toBe(false)
    expect(r.error).toContain('ECONNREFUSED')
    // No storageState written.
    expect(existsSync(path.join(tmpDir, `${r.role}.json`))).toBe(false)
  })
})
