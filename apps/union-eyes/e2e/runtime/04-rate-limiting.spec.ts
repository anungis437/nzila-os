/**
 * Runtime acceptance 04: rate limiting contract, against the real application and (when started with --redis) a real Redis.
 *
 * The contract (lib/rate-limiter.ts, proxy.ts):
 *   - The organization mutation bucket of the proxy is keyed by something the CLIENT cannot choose. A client that omits, or
 *     forges, an organization header neither escapes its own limit nor consumes another tenant's.
 *   - An explicit per-route limit REJECTS when Redis is missing or down; only the catch-all organization limit fails open.
 *   - Health reports the degraded state honestly, and recovers when Redis returns.
 *
 * Needs a production build (the proxy skips this block in development). The Redis tests need `ue-runtime-up.mjs up --prod --redis`
 * and run only when UE_RUNTIME_REDIS_CONTAINER names the container, so they can stop and start it.
 */
import { execFileSync } from 'node:child_process'
import { test, expect, request as pwRequest, type APIRequestContext } from '@playwright/test'
import { UE_TEST_ORGS } from '../../tests/fixtures/test-orgs'
import { UE_TEST_USERS } from '../../tests/fixtures/test-users'

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://localhost:3002'
const PRIMARY = UE_TEST_ORGS.primary.id
const SECONDARY = UE_TEST_ORGS.secondary.id
const REDIS = process.env.UE_RUNTIME_REDIS_CONTAINER
const MUTATION_LIMIT = 60

const as = (userId: string, orgId: string, headers: Record<string, string> = {}): Promise<APIRequestContext> =>
  pwRequest.newContext({ baseURL: BASE, extraHTTPHeaders: { cookie: `nzila_session=ue-seed-session-${userId}; selected_org_id=${orgId}`, ...headers } })

/** Cheap authenticated mutation the handler refuses (400): it creates nothing but still counts against the bucket. */
const mutate = (ctx: APIRequestContext) => ctx.post('/api/cases/intake', { data: {} })
async function burst(ctx: APIRequestContext, n: number) {
  const codes: number[] = []
  let firstLimited: { status: number; headers: Record<string, string> } | null = null
  for (let i = 0; i < n; i += 1) {
    const response = await mutate(ctx)
    codes.push(response.status())
    if (response.status() === 429 && !firstLimited) firstLimited = { status: 429, headers: response.headers() }
  }
  return { codes, allowed: codes.filter((c) => c !== 429).length, limited: codes.filter((c) => c === 429).length, firstLimited }
}
const docker = (...args: string[]) => execFileSync('docker', args, { stdio: 'pipe' }).toString()
const health = async () => (await (await pwRequest.newContext({ baseURL: BASE })).get('/api/health')).json() as Promise<{ checks: { redis: { status: string; note?: string } } }>

test.describe.configure({ mode: 'serial' })

test.describe('rate limiting contract', () => {
  test.beforeEach(({}, testInfo) => test.skip(testInfo.project.name !== 'desktop', 'API journey: runs once, at desktop'))

  test('a client cannot escape the mutation limit by omitting headers: no organization header and no idempotency key are needed', async () => {
    test.setTimeout(240_000)
    const result = await burst(await as(UE_TEST_USERS.staffPrimary.userId, PRIMARY), MUTATION_LIMIT + 15)
    expect(result.allowed, `statuses: ${[...new Set(result.codes)]}`).toBe(MUTATION_LIMIT)
    expect(result.limited).toBe(15)
    expect(result.firstLimited?.headers['x-ratelimit-scope']).toBe('session')
    expect(Number(result.firstLimited?.headers['retry-after'])).toBeGreaterThan(0)
  })

  test("a forged organization header cannot exhaust another tenant's allowance", async () => {
    test.setTimeout(240_000)
    const attacker = await as(UE_TEST_USERS.auditorReadOnly.userId, PRIMARY, { 'x-org-id': SECONDARY, 'idempotency-key': 'forged' })
    const result = await burst(attacker, MUTATION_LIMIT + 15)
    expect(result.limited, 'the attacker is limited by their own credential').toBeGreaterThanOrEqual(15)
    const victim = await as(UE_TEST_USERS.memberSecondary.userId, SECONDARY, { 'x-org-id': SECONDARY, 'idempotency-key': 'legit' })
    expect((await mutate(victim)).status(), 'the other tenant is untouched').not.toBe(429)
  })

  test('Redis present: health is ok and the limit is enforced from the shared store', async () => {
    test.skip(!REDIS, 'needs ue-runtime-up.mjs up --prod --redis')
    test.setTimeout(240_000)
    expect((await health()).checks.redis.status).toBe('ok')
    const result = await burst(await as(UE_TEST_USERS.restrictedUxTester.userId, UE_TEST_USERS.restrictedUxTester.orgId), MUTATION_LIMIT + 5)
    expect(result.allowed).toBe(MUTATION_LIMIT)
    expect(result.firstLimited?.headers['x-ratelimit-mode']).toBe('shared')
  })

  test('Redis stopped: health says degraded, the limit still holds from memory and the response says so, reads keep working', async () => {
    test.skip(!REDIS, 'needs ue-runtime-up.mjs up --prod --redis')
    test.setTimeout(300_000)
    docker('stop', REDIS as string)
    try {
      await expect.poll(async () => (await health()).checks.redis.status, { timeout: 45_000 }).toBe('degraded')
      expect((await health()).checks.redis.note ?? '').toMatch(/unreachable|degraded/i)
      const result = await burst(await as(UE_TEST_USERS.supervisorPrimary.userId, PRIMARY), MUTATION_LIMIT + 5)
      expect(result.allowed, 'an outage must not turn a write limit into no limit, nor reject a caller early').toBe(MUTATION_LIMIT)
      expect(result.firstLimited?.headers['x-ratelimit-mode']).toBe('degraded')
      const member = await as(UE_TEST_USERS.memberSecondary.userId, SECONDARY)
      expect((await member.get('/api/cases')).status(), 'a read is not taken down by a limiter outage').toBeLessThan(500)
    } finally {
      docker('start', REDIS as string)
    }
  })

  test('Redis recovered: health returns to ok and limiting returns to the shared store without restarting the application', async () => {
    test.skip(!REDIS, 'needs ue-runtime-up.mjs up --prod --redis')
    test.setTimeout(300_000)
    await expect.poll(async () => (await health()).checks.redis.status, { timeout: 90_000 }).toBe('ok')
    // The limiter's circuit breaker holds the shared store out for its cool-down (30 s) before probing it again: recovery is bounded.
    const modeOf = async () => (await (await pwRequest.newContext({ baseURL: BASE })).get('/api/cases')).headers()['x-ratelimit-mode']
    await expect.poll(modeOf, { timeout: 90_000, intervals: [2_000] }).toBe('shared')
    const result = await burst(await as(UE_TEST_USERS.executivePrimary.userId, PRIMARY), MUTATION_LIMIT + 5)
    expect(result.allowed).toBe(MUTATION_LIMIT)
    expect(result.firstLimited?.headers['x-ratelimit-mode'], 'back on the shared store').toBe('shared')
  })
})