import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const m = vi.hoisted(() => ({ recordSignature: vi.fn(), auth: vi.fn() }))

vi.mock('@/lib/api-auth-guard', () => ({ requireApiAuth: m.auth }))
vi.mock('@/lib/signature/signature-service', () => ({
  SignatureService: { recordSignature: m.recordSignature },
  SignatureAuthorityError: class SignatureAuthorityError extends Error {
    constructor(readonly code: 'FORBIDDEN' | 'CONFLICT', message: string) { super(message) }
  },
}))
vi.mock('@/lib/api/standardized-responses', () => ({
  ErrorCode: { AUTH_REQUIRED: 'AUTH_REQUIRED', VALIDATION_ERROR: 'VALIDATION_ERROR', FORBIDDEN: 'FORBIDDEN', INTERNAL_ERROR: 'INTERNAL_ERROR' },
  standardErrorResponse: (code: string, message: string) => new Response(JSON.stringify({ code, message }), { status: code === 'INTERNAL_ERROR' ? 500 : code === 'FORBIDDEN' ? 403 : code === 'AUTH_REQUIRED' ? 401 : 400 }),
}))

const SIGNER = '00000000-0000-4000-8000-0000000000a1'
const PNG = 'data:image/png;base64,iVBORw0KGgo='

const sign = async (body: Record<string, unknown>, headers: Record<string, string> = {}) => {
  const { POST } = await import('../route')
  return POST(new NextRequest('http://localhost/api/signatures/sign', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'user-agent': 'TestAgent/1.0', ...headers },
    body: JSON.stringify({ signerId: SIGNER, signatureImageUrl: PNG, signatureType: 'electronic', ...body }),
  }))
}

describe('signatures/sign route inputs (F06 A6)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    delete process.env.UE_TRUSTED_PROXY_HOPS
    m.auth.mockReset().mockResolvedValue({ userId: 'signer-1', organizationId: 'org-1' })
    m.recordSignature.mockResolvedValue({ id: SIGNER, status: 'signed' })
  })

  it('records the address the trusted proxy appended, not the first value the client sent, with how it was obtained', async () => {
    const response = await sign({}, { 'x-forwarded-for': '9.9.9.9, 203.0.113.7' })

    expect(response.status).toBe(200)
    expect(m.recordSignature).toHaveBeenCalledWith(expect.objectContaining({
      ipAddress: '203.0.113.7',
      ipProvenance: { source: 'x-forwarded-for', trustedProxyHops: 1 },
    }))
  })

  it('records no address, never the string "unknown" or a guess, when none can be trusted', async () => {
    await sign({}, { 'x-forwarded-for': 'not-an-address' })

    const call = m.recordSignature.mock.calls[0][0]
    expect(call.ipAddress).toBeUndefined()
    expect(call.ipProvenance).toMatchObject({ source: 'none' })
  })

  it('does not pass on a position the signer\'s browser reported', async () => {
    await sign({ geolocation: { latitude: 45.4, longitude: -75.7 } })

    expect(m.recordSignature.mock.calls[0][0]).not.toHaveProperty('geolocation')
  })

  // The signer and the document are looked up inside the organization the caller is authenticated in, and nowhere else.
  it('acts inside the authenticated organization and passes it, with the signer, to the service', async () => {
    const response = await sign({})

    expect(response.status).toBe(200)
    expect(m.auth).toHaveBeenCalledWith({ orgScoped: true })
    expect(m.recordSignature).toHaveBeenCalledWith(expect.objectContaining({ signerId: SIGNER, actorUserId: 'signer-1', organizationId: 'org-1' }))
  })

  it('refuses a caller with no organization context, and records nothing', async () => {
    m.auth.mockResolvedValue({ userId: 'signer-1', organizationId: null })
    const response = await sign({})

    expect(response.status).toBe(403)
    expect(m.recordSignature).not.toHaveBeenCalled()
  })

  it('answers an unauthenticated or organization-less session with its own status and not a server fault', async () => {
    m.auth.mockRejectedValue(new Error('Unauthorized: Authentication required'))
    expect((await sign({})).status).toBe(401)
    m.auth.mockRejectedValue(new Error('Forbidden: Organization context unavailable'))
    expect((await sign({})).status).toBe(403)
    m.auth.mockRejectedValue(new Error('connection reset'))
    expect((await sign({})).status).toBe(500)
    expect(m.recordSignature).not.toHaveBeenCalled()
  })

  it('answers a signer that is not the caller\'s, or not in the organization, with a refusal and not a server fault', async () => {
    const { SignatureAuthorityError } = await import('@/lib/signature/signature-service')
    m.recordSignature.mockRejectedValue(new SignatureAuthorityError('FORBIDDEN', 'You are not authorized to sign as this signer'))
    const response = await sign({})

    expect(response.status).toBe(403)
  })

  it.each([
    ['a link to an image elsewhere', 'https://evil.example/signature.png'],
    ['a script-bearing data URL', 'data:text/html;base64,PHNjcmlwdD4='],
    ['an SVG data URL', 'data:image/svg+xml;base64,PHN2Zz4='],
    ['an oversized image', `data:image/png;base64,${'A'.repeat(262_200)}`],
  ])('refuses %s as the signature image and records nothing', async (_label, signatureImageUrl) => {
    const response = await sign({ signatureImageUrl })

    expect(response.status).toBe(400)
    expect(m.recordSignature).not.toHaveBeenCalled()
  })
})
