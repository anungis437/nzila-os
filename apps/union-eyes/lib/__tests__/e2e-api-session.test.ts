import { createServer, type Server } from 'node:http'
import { request as apiRequest, type APIRequestContext } from '@playwright/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UE_TEST_USERS, UE_TEST_USER_PASSWORD } from '../../tests/fixtures/test-users'

const environment = vi.hoisted(() => ({ baseUrl: '' }))
vi.mock('../../tests/e2e/e2e-env', () => ({
  getE2EEnv: () => ({ PLAYWRIGHT_BASE_URL: environment.baseUrl }),
}))
import { loginAsTestUser } from '../../tests/e2e/_helpers'

let server: Server
let context: APIRequestContext
let seen: Array<{ path: string; method: string; cookie: string; body: string }>

beforeEach(async () => {
  vi.stubEnv('PLAYWRIGHT_TEST_AUTH', 'true')
  seen = []
  server = createServer((incoming, response) => {
    let body = ''
    incoming.setEncoding('utf8')
    incoming.on('data', (chunk) => {
      body += chunk
    })
    incoming.on('end', () => {
      const cookie = incoming.headers.cookie ?? ''
      seen.push({ path: incoming.url ?? '', method: incoming.method ?? '', cookie, body })
      if (incoming.url === '/api/auth/login') {
        response.setHeader('Set-Cookie', 'nzila_session=ordinary-fixture-session; Path=/; HttpOnly')
      }
      response.setHeader('Content-Type', 'application/json')
      response.end(JSON.stringify({ cookie }))
    })
  })
  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(0, 'localhost', () => resolve())
  })
  const address = server.address()
  if (!address || typeof address === 'string') throw new Error('Fixture target failed to bind')
  environment.baseUrl = `http://localhost:${address.port}`
  context = await apiRequest.newContext({ baseURL: environment.baseUrl, timeout: 5000 })
})
afterEach(async () => {
  await context?.dispose()
  if (server?.listening)
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()))
    })
  vi.unstubAllEnvs()
})

describe('legacy API fixture uses the existing E2E seed-session harness', () => {
  it('installs a real HttpOnly cookie and sends it through the normal API request jar', async () => {
    await loginAsTestUser(context, UE_TEST_USERS.memberPrimary.email)
    const state = await context.storageState()
    const cookie = state.cookies.find((cookie) => cookie.name === 'nzila_session')
    expect(cookie).toMatchObject({
      value: 'ue-seed-session-ue-qa-member-primary',
      httpOnly: true,
      path: '/',
    })
    expect(seen).toEqual([]) // No application password-login or logout request.
    const response = await context.get('/protected')
    expect((await response.json()).cookie).toContain(
      'nzila_session=ue-seed-session-ue-qa-member-primary',
    )
  })

  it('replaces the existing cookie when switching users without retaining the previous identity', async () => {
    await loginAsTestUser(context, UE_TEST_USERS.memberPrimary.email)
    await loginAsTestUser(context, UE_TEST_USERS.stewardPrimary.email)
    const cookies = (await context.storageState()).cookies.filter(
      (cookie) => cookie.name === 'nzila_session',
    )
    expect(cookies).toHaveLength(1)
    expect(cookies[0]?.value).toBe('ue-seed-session-ue-qa-steward-primary')
    const response = await context.get('/protected')
    expect((await response.json()).cookie).not.toContain('ue-qa-member-primary')
  })

  it.each(['unknown@nzila.test', UE_TEST_USERS.suspendedMember.email])(
    'rejects unknown/inactive fixture %s',
    async (email) => {
      await expect(loginAsTestUser(context, email)).rejects.toThrow(
        'Unknown or inactive seeded fixture',
      )
      expect((await context.storageState()).cookies).toEqual([])
      expect(seen).toEqual([])
    },
  )

  it.each(['https://ue-production.invalid', 'http://ue-production.invalid'])(
    'rejects non-loopback fixture target %s',
    async (baseUrl) => {
      environment.baseUrl = baseUrl
      await expect(loginAsTestUser(context, UE_TEST_USERS.memberPrimary.email)).rejects.toThrow(
        'loopback HTTP target',
      )
      expect((await context.storageState()).cookies).toEqual([])
      expect(seen).toEqual([])
    },
  )

  it('retains the existing password-login flow when test auth is disabled', async () => {
    vi.stubEnv('PLAYWRIGHT_TEST_AUTH', 'false')
    await loginAsTestUser(context, UE_TEST_USERS.memberPrimary.email)
    expect(seen.map((request) => request.path)).toEqual(['/api/auth/logout', '/api/auth/login'])
    expect(JSON.parse(seen[1]?.body ?? '{}')).toEqual({
      email: UE_TEST_USERS.memberPrimary.email,
      password: UE_TEST_USER_PASSWORD,
    })
    expect((await context.storageState()).cookies[0]?.value).toBe('ordinary-fixture-session')
  })
})
