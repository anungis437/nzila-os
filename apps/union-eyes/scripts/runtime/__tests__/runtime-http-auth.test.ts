import type { APIRequestContext, APIResponse } from '@playwright/test'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { UE_TEST_USERS } from '@/tests/fixtures/test-users'

const fixture = vi.hoisted(() => ({ read: vi.fn() }))
vi.mock('../fixture-auth', () => ({ readRuntimeFixtureAuth: fixture.read }))
import { loginRuntimeRequest } from '../../../e2e/helpers/runtime-auth'

const person = UE_TEST_USERS.memberPrimary
const cookie = (value: string) => ({
  name: 'nzila_session',
  value,
  domain: '127.0.0.1',
  path: '/',
  expires: -1,
  httpOnly: true,
  secure: false,
  sameSite: 'Lax' as const,
})
const response = (status: number, body: unknown) =>
  ({ status: () => status, json: async () => body }) as APIResponse

function transport() {
  const post = vi
    .fn<APIRequestContext['post']>()
    .mockResolvedValueOnce(
      response(200, { requiresMfa: true, mfaChallengeToken: 'actual-server-challenge' }),
    )
    .mockResolvedValueOnce(response(200, { ok: true, userId: person.userId }))
    .mockResolvedValueOnce(
      response(200, {
        activeOrganizationId: person.orgId,
        organizationAuthority: 'CANONICAL_CURRENT_STATE_V2',
      }),
    )
  const storageState = vi
    .fn<APIRequestContext['storageState']>()
    .mockResolvedValueOnce({ cookies: [cookie('server-session-before-selection')], origins: [] })
    .mockResolvedValueOnce({ cookies: [cookie('server-session-after-selection')], origins: [] })
  return { post, storageState } as Pick<APIRequestContext, 'post' | 'storageState'>
}

describe('owned browser authentication protocol', () => {
  beforeEach(() => {
    vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
    vi.stubEnv('PLAYWRIGHT_BASE_URL', 'http://127.0.0.1:3002')
    vi.stubEnv('DATABASE_URL', 'postgresql://ue_runtime_web@127.0.0.1:55516/ue_runtime')
    fixture.read.mockReturnValue({
      users: {
        [person.userId]: {
          email: person.email,
          organizationId: person.orgId,
          mfaSecret: 'A'.repeat(32),
        },
      },
    })
  })
  afterEach(() => {
    vi.unstubAllEnvs()
    vi.clearAllMocks()
  })

  it('requires actual password, MFA identity and canonical organization confirmation before accepting a rotated cookie', async () => {
    const ctx = transport()
    const state = await loginRuntimeRequest(ctx as APIRequestContext, person.userId)
    expect(vi.mocked(ctx.post).mock.calls.map(([url]) => url)).toEqual([
      'http://127.0.0.1:3002/api/auth/login',
      'http://127.0.0.1:3002/api/auth/mfa/challenge',
      'http://127.0.0.1:3002/api/organizations/switch',
    ])
    expect(state.cookies[0].value).toBe('server-session-after-selection')
  })

  it('refuses a legacy or absent MFA login result before selecting an organization', async () => {
    const ctx = transport()
    vi.mocked(ctx.post)
      .mockReset()
      .mockResolvedValue(response(200, { userId: person.userId }))
    await expect(loginRuntimeRequest(ctx as APIRequestContext, person.userId)).rejects.toThrow(
      'MFA challenge required',
    )
    expect(ctx.post).toHaveBeenCalledTimes(1)
  })

  it('refuses a mismatched MFA identity, forged selection, and predictable or unrotated cookie', async () => {
    for (const defect of [
      'mfa-user',
      'organization',
      'authority',
      'predictable-cookie',
      'unrotated-cookie',
    ]) {
      const ctx = transport()
      const post = vi.mocked(ctx.post)
      post
        .mockReset()
        .mockResolvedValueOnce(
          response(200, { requiresMfa: true, mfaChallengeToken: 'actual-server-challenge' }),
        )
        .mockResolvedValueOnce(
          response(200, {
            ok: true,
            userId: defect === 'mfa-user' ? 'another-principal' : person.userId,
          }),
        )
        .mockResolvedValueOnce(
          response(200, {
            activeOrganizationId:
              defect === 'organization' ? UE_TEST_USERS.memberSecondary.orgId : person.orgId,
            organizationAuthority: defect === 'authority' ? 'legacy' : 'CANONICAL_CURRENT_STATE_V2',
          }),
        )
      if (defect.endsWith('cookie'))
        vi.mocked(ctx.storageState)
          .mockReset()
          .mockResolvedValueOnce({
            cookies: [cookie('server-session-before-selection')],
            origins: [],
          })
          .mockResolvedValueOnce({
            cookies: [
              cookie(
                defect === 'predictable-cookie'
                  ? 'ue-seed-session-member'
                  : 'server-session-before-selection',
              ),
            ],
            origins: [],
          })
      await expect(
        loginRuntimeRequest(ctx as APIRequestContext, person.userId),
        defect,
      ).rejects.toThrow()
    }
  })

  it('rejects an external HTTP target or missing private identity before sending a password', async () => {
    const ctx = transport()
    vi.stubEnv('PLAYWRIGHT_BASE_URL', 'https://external.invalid')
    await expect(loginRuntimeRequest(ctx as APIRequestContext, person.userId)).rejects.toThrow(
      'Owned canonical HTTP runtime',
    )
    expect(ctx.post).not.toHaveBeenCalled()
    vi.stubEnv('PLAYWRIGHT_BASE_URL', 'http://127.0.0.1:3002')
    fixture.read.mockReturnValue(null)
    await expect(loginRuntimeRequest(ctx as APIRequestContext, person.userId)).rejects.toThrow(
      'Private fixture identity',
    )
    expect(ctx.post).not.toHaveBeenCalled()
  })
})
