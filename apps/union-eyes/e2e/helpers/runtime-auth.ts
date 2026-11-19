/** Actual password/MFA/org-selection sessions for the owned runtime journeys. */
import { request, type APIRequestContext, type Page } from '@playwright/test'
import { computeTotp } from '@nzila/platform-auth/mfa'
import { UE_TEST_USERS, UE_TEST_USER_PASSWORD } from '../../tests/fixtures/test-users'
import { CANONICAL_ORGANIZATION_AUTHORITY } from '../../lib/auth/organization-authority'
import { readRuntimeFixtureAuth } from '../../scripts/runtime/fixture-auth'

type State = Awaited<ReturnType<APIRequestContext['storageState']>>
// ga-check:exempt — E2E harness: per-run browser session cache, never application persistence.
const sessions = new Map<string, Promise<State>>()
const baseUrl = () => {
  const url = new URL(process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3002')
  if (
    url.protocol !== 'http:' ||
    !['127.0.0.1', 'localhost'].includes(url.hostname) ||
    url.username ||
    url.password ||
    process.env.UE_CANONICAL_BOOTSTRAP_V2 !== '1'
  )
    throw new Error('Owned canonical HTTP runtime required')
  return url.origin
}

export async function loginRuntimeRequest(ctx: APIRequestContext, userId: string): Promise<State> {
  const base = baseUrl()
  const person = Object.values(UE_TEST_USERS).find((user) => user.userId === userId)
  if (!person) throw new Error('Known runtime fixture identity required')
  const fixture = readRuntimeFixtureAuth(process.env.DATABASE_URL ?? '')
  const privatePerson = fixture?.users[userId]
  if (
    !privatePerson ||
    privatePerson.email !== person.email ||
    privatePerson.organizationId !== person.orgId
  )
    throw new Error('Private fixture identity provenance differs')

  const response = await ctx.post(base + '/api/auth/login', {
    data: { email: person.email, password: UE_TEST_USER_PASSWORD },
  })
  if (person.status !== 'active') {
    if (![401, 403].includes(response.status()))
      throw new Error('Inactive fixture login was not denied')
    return await ctx.storageState()
  }
  if (response.status() !== 200)
    throw new Error(`Real runtime password login failed (${response.status()})`)
  const login = (await response.json()) as { requiresMfa?: boolean; mfaChallengeToken?: string }
  if (login.requiresMfa !== true || typeof login.mfaChallengeToken !== 'string')
    throw new Error('Real fixture MFA challenge required')
  const mfa = await ctx.post(base + '/api/auth/mfa/challenge', {
    data: { challengeToken: login.mfaChallengeToken, code: computeTotp(privatePerson.mfaSecret) },
  })
  if (mfa.status() !== 200) throw new Error(`Real runtime MFA failed (${mfa.status()})`)
  const confirmation = (await mfa.json()) as { ok?: boolean; userId?: string }
  if (confirmation.ok !== true || confirmation.userId !== userId)
    throw new Error('MFA identity confirmation differs')
  const before = await ctx.storageState()
  const selected = await ctx.post(base + '/api/organizations/switch', {
    data: { organizationId: person.orgId },
  })
  if (selected.status() !== 200)
    throw new Error(`Real runtime organization selection failed (${selected.status()})`)
  const selection = (await selected.json()) as {
    activeOrganizationId?: string
    organizationAuthority?: string
  }
  if (
    selection.activeOrganizationId !== person.orgId ||
    selection.organizationAuthority !== CANONICAL_ORGANIZATION_AUTHORITY
  )
    throw new Error('Canonical organization confirmation differs')
  const state = await ctx.storageState()
  const cookie = state.cookies.find((cookie) => cookie.name === 'nzila_session')
  if (
    !cookie ||
    cookie.value.startsWith('ue-seed-session-') ||
    cookie.value === before.cookies.find((cookie) => cookie.name === 'nzila_session')?.value
  )
    throw new Error('Rotated real session required')
  return state
}

async function authenticate(userId: string): Promise<State> {
  const ctx = await request.newContext({
    baseURL: baseUrl(),
    extraHTTPHeaders: { 'user-agent': 'ue-canonical-runtime-browser' },
  })
  try {
    return await loginRuntimeRequest(ctx, userId)
  } finally {
    await ctx.dispose()
  }
}

async function fixtureState(userId: string, organizationId: string, freshSignIn = false) {
  const key = `${baseUrl()}:${userId}`
  let pending = freshSignIn ? undefined : sessions.get(key)
  if (!pending) {
    pending = authenticate(userId)
    sessions.set(key, pending)
    pending.catch(() => sessions.delete(key))
  }
  const state = structuredClone(await pending)
  // Only the untrusted selection hint changes for tenant-substitution probes.
  // The real bearer retains its database-bound organization and identity.
  const origin = new URL(baseUrl())
  state.cookies = state.cookies.filter((cookie) => cookie.name !== 'selected_org_id')
  state.cookies.push({
    name: 'selected_org_id',
    value: organizationId,
    domain: origin.hostname,
    path: '/',
    expires: -1,
    httpOnly: false,
    secure: false,
    sameSite: 'Lax',
  })
  return state
}

export async function runtimeRequestAs(
  userId: string,
  organizationId: string,
  headers: Record<string, string> = {},
): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: baseUrl(),
    storageState: await fixtureState(userId, organizationId),
    extraHTTPHeaders: headers,
  })
}
export async function runtimeRequestAfterSignIn(
  userId: string,
  organizationId: string,
): Promise<APIRequestContext> {
  return request.newContext({
    baseURL: baseUrl(),
    storageState: await fixtureState(userId, organizationId, true),
  })
}
export async function loginRuntimePage(
  page: Page,
  userId: string,
  organizationId: string,
): Promise<void> {
  await page.context().addCookies((await fixtureState(userId, organizationId)).cookies)
}
