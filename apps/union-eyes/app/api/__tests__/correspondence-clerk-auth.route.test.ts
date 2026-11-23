/** Real route/framework composition; tenant services and provider execution are mocked. */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const h = vi.hoisted(() => ({ user: vi.fn(), read: vi.fn(), mutate: vi.fn(), approve: vi.fn(), sign: vi.fn() }))
vi.mock('@/lib/api-auth-guard', async importOriginal => ({
  ...await importOriginal<typeof import('@/lib/api-auth-guard')>(), getCurrentUser: h.user,
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_scope: unknown, callback: () => unknown) => callback(), validateRLSContext: vi.fn(),
}))
vi.mock('@/db/tenant-context-storage', () => ({ getActiveTenantDb: () => undefined }))
vi.mock('@/lib/auth/canonical-context', () => ({ withCanonicalApiContext: (callback: () => unknown) => callback() }))
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: async () => ({ allowed: true }), createRateLimitHeaders: () => ({}), RATE_LIMITS: { DEFAULT_API_ORG: {} } }))
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() } }))
vi.mock('next/server', async importOriginal => ({ ...await importOriginal<typeof import('next/server')>(), after: vi.fn() }))
vi.mock('@/lib/services/correspondence-service', () => ({
  listCorrespondence: h.read, getCorrespondenceById: h.read, getCorrespondenceWithDetails: h.read,
  createCorrespondence: h.mutate, updateCorrespondence: h.mutate, submitForReview: h.mutate,
  cancelCorrespondence: h.mutate, approveCorrespondence: h.approve, signCorrespondence: h.sign,
}))
vi.mock('@/lib/correspondence/email-delivery', () => ({ queueCorrespondenceEmail: h.mutate, settleCorrespondenceEmail: h.mutate, processCorrespondenceEmails: vi.fn() }))

const ORG = '11111111-1111-4111-8111-111111111111'
const ID = '22222222-2222-4222-8222-222222222222'
const endpoints = [
  ['GET', '', '../correspondence/route', undefined, 200],
  ['POST', '', '../correspondence/route', { subject: 'Controlled letter', body: 'Synthetic draft' }, 200],
  ['GET', `/${ID}`, '../correspondence/[id]/route', undefined, 200],
  ['PATCH', `/${ID}`, '../correspondence/[id]/route', { subject: 'Revised draft' }, 200],
  ['POST', `/${ID}/submit`, '../correspondence/[id]/submit/route', undefined, 200],
  ['POST', `/${ID}/cancel`, '../correspondence/[id]/cancel/route', { reason: 'Controlled cancellation' }, 200],
  ['POST', `/${ID}/dispatch`, '../correspondence/[id]/dispatch/route', { dispatchMethod: 'email' }, 202],
  ['POST', `/${ID}/email-status`, '../correspondence/[id]/email-status/route', undefined, 200],
] as const

async function call([method, suffix, module, body]: typeof endpoints[number]) {
  const route = await import(module)
  return route[method](new NextRequest('http://localhost/api/correspondence' + suffix, {
    method, ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  }), { params: Promise.resolve({ id: ID }) })
}

beforeEach(() => {
  vi.clearAllMocks(); vi.stubEnv('UE_CANONICAL_BOOTSTRAP_V2', '1')
  h.user.mockResolvedValue({ id: 'controlled-clerk', role: 'clerk', organizationId: ORG, isSystemAdmin: false })
  h.read.mockResolvedValue({ id: ID, organizationId: ORG })
  h.mutate.mockResolvedValue({ id: ID, state: 'accepted' })
})
afterEach(() => vi.unstubAllEnvs())

describe('canonical Clerk letter access through the actual HTTP wrapper', () => {
  it.each(endpoints)('%s %s admits Clerk through the explicit letter gate', async (...entry) => {
    expect((await call(entry)).status).toBe(entry[4])
  })

  it.each(['member', 'app_owner', 'support_agent'])('denies %s on every letter preparation/read/dispatch endpoint before any service runs', async role => {
    h.user.mockResolvedValue({ id: 'controlled-actor', role, organizationId: ORG, isSystemAdmin: role === 'app_owner' })
    for (const endpoint of endpoints) expect((await call(endpoint)).status).toBe(403)
    expect(h.read).not.toHaveBeenCalled(); expect(h.mutate).not.toHaveBeenCalled()
  })

  it('does not let Clerk approve or sign a letter', async () => {
    for (const operation of ['approve', 'sign']) {
      const route = await import(`../correspondence/[id]/${operation}/route`)
      const response = await route.POST(new NextRequest(`http://localhost/api/correspondence/${ID}/${operation}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ signatureId: ID }),
      }), { params: Promise.resolve({ id: ID }) })
      expect(response.status).toBe(403)
    }
    expect(h.read).not.toHaveBeenCalled(); expect(h.approve).not.toHaveBeenCalled(); expect(h.sign).not.toHaveBeenCalled()
  })

  it('refuses another tenant letter and never submits it', async () => {
    h.read.mockResolvedValue({ id: ID, organizationId: '33333333-3333-4333-8333-333333333333' })
    expect((await call(endpoints[4])).status).toBe(404)
    expect(h.mutate).not.toHaveBeenCalled()
  })
})
