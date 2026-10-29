import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({
  guard: vi.fn(),
  currentUser: vi.fn(),
  save: vi.fn(),
  get: vi.fn(),
  audit: vi.fn(),
  error: vi.fn(),
}))

vi.mock('@/lib/public-intake/guard', () => ({ guardPublicIntake: m.guard }))
vi.mock('@/lib/api-auth-guard', () => ({ getCurrentUser: m.currentUser }))
vi.mock('@/lib/logger', () => ({ logger: { error: m.error } }))
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }))
vi.mock('@/db/schema', () => ({ organizations: { id: 'org.id' } }))
vi.mock('drizzle-orm', () => ({ eq: vi.fn(() => 'organization-id-match') }))
vi.mock('@/lib/gdpr/consent-manager', () => ({
  CookieConsentOwnershipError: class extends Error {},
  CookieConsentManager: {
    saveCookieConsent: m.save,
    getCookieConsent: m.get,
  },
}))
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: async (fn: (tx: unknown) => Promise<unknown>) => fn({
    select: () => ({
      from: () => ({
        where: () => ({
          limit: async () => [{ id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa' }],
        }),
      }),
    }),
  }),
}))

const consentId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
const organizationId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
const privateReceipt = {
  id: 'internal-row',
  consentId,
  organizationId,
  userId: 'private-auth-principal',
  ipAddress: '198.51.100.17',
  userAgent: 'private-browser-fingerprint',
  essential: true,
  functional: true,
  analytics: false,
  marketing: false,
  expiresAt: new Date('2027-10-29T00:00:00Z'),
  lastUpdated: new Date('2026-10-29T00:00:00Z'),
}

const request = (path: string): NextRequest => ({
  url: `http://localhost${path}`,
  headers: new Headers(),
}) as NextRequest

beforeEach(() => {
  vi.clearAllMocks()
  m.guard.mockResolvedValue({ ok: true, json: { consentId, organizationId, essential: true } })
  m.currentUser.mockResolvedValue({ id: 'private-auth-principal' })
  m.save.mockResolvedValue(privateReceipt)
  m.get.mockResolvedValue(privateReceipt)
  m.audit.mockResolvedValue(undefined)
})

describe('public cookie-consent route privacy and essential integrity', () => {
  it('GET exposes only preferences and expiry, not internal user, IP or browser metadata', async () => {
    const { GET } = await import('../route')
    const response = await GET(request(`/api/gdpr/cookie-consent?consentId=${consentId}`))
    expect(response.status).toBe(200)
    const data = await response.json()
    expect(data).toMatchObject({ consentId, essential: true, functional: true })
    for (const key of ['id', 'userId', 'organizationId', 'ipAddress', 'userAgent'])
      expect(data).not.toHaveProperty(key)
  })

  it('POST never reflects private internal metadata to a client', async () => {
    const { POST } = await import('../route')
    const response = await POST(request('/api/gdpr/cookie-consent'))
    expect(response.status).toBe(200)
    const data = await response.json()
    for (const key of ['id', 'userId', 'organizationId', 'ipAddress', 'userAgent'])
      expect(data).not.toHaveProperty(key)
    expect(m.save).toHaveBeenCalledWith(expect.objectContaining({
      userId: 'private-auth-principal', essential: true, consentId,
    }), expect.anything())
    expect(m.audit).toHaveBeenCalledOnce()
  })

  it('rejects essential=false before writing anything', async () => {
    const { POST } = await import('../route')
    m.guard.mockResolvedValue({ ok: true, json: { consentId, organizationId, essential: false } })
    const response = await POST(request('/api/gdpr/cookie-consent'))
    expect(response.status).toBe(400)
    expect(m.save).not.toHaveBeenCalled()
    expect(m.audit).not.toHaveBeenCalled()
  })
})
