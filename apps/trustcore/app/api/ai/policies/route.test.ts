import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'

// ── Stable mock references ────────────────────────────────────────────────
const mocks = vi.hoisted(() => ({
  withRequiredRole: vi.fn(),
  decideAccess: vi.fn(),
  createAuditEvent: vi.fn(),
  withNzilaSpan: vi.fn(),
  generatePrivacyPolicy: vi.fn(),
  generateDataGovernancePolicy: vi.fn(),
}))

vi.mock('@/lib/rbac/requireRole', () => ({
  withRequiredRole: mocks.withRequiredRole,
}))

vi.mock('@nzila/consent-engine', () => ({
  decideAccess: mocks.decideAccess,
  createAuditEvent: mocks.createAuditEvent,
  ConsentRole: { ADMIN: 'ADMIN', CLINICIAN: 'CLINICIAN', AUDITOR: 'AUDITOR' },
  ConsentScope: { READ_TIMELINE: 'READ_TIMELINE' },
}))

vi.mock('@nzila/otel-core', () => ({
  withNzilaSpan: mocks.withNzilaSpan,
}))

vi.mock('@/lib/compliance/policy-generator', () => ({
  generatePrivacyPolicy: mocks.generatePrivacyPolicy,
  generateDataGovernancePolicy: mocks.generateDataGovernancePolicy,
}))

// ── Fixtures ──────────────────────────────────────────────────────────────
const fakeCtx = { userId: 'user_1', orgId: 'org_1', role: 'org_admin' as const }

const validInput = {
  step1: { orgName: 'Test Org', industry: 'Health', province: 'ON' },
  step2: { officerName: 'Jane', officerEmail: 'jane@test.com', officerTitle: 'CPO' },
  step3: { collectsPersonalData: true, dataTypes: ['health'] },
  step4: { usesThirdPartyTools: false, selectedVendors: [] },
  step5: { collectsConsent: true, handlesDsrRequests: true, hasIncidentProcedures: true },
}

function makeRequest(body: unknown): NextRequest {
  return new NextRequest('http://localhost/api/ai/policies', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: { 'Content-Type': 'application/json' },
  })
}

// ── Helpers ───────────────────────────────────────────────────────────────
function setupWithRequiredRole() {
  mocks.withRequiredRole.mockImplementation(
    (_roles: unknown, handler: (...args: unknown[]) => unknown) =>
      (request: NextRequest) =>
        handler(request, fakeCtx),
  )
}

describe('POST /api/ai/policies', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    setupWithRequiredRole()
    mocks.decideAccess.mockReturnValue({ allowed: true, reason: 'ok', requiresBreakGlass: false })
    mocks.createAuditEvent.mockReturnValue({ eventId: 'audit_1' })
    mocks.withNzilaSpan.mockImplementation((_name: string, _orgId: string, fn: () => unknown) => fn())
    mocks.generatePrivacyPolicy.mockResolvedValue({ title: 'Privacy Policy' })
    mocks.generateDataGovernancePolicy.mockResolvedValue({ title: 'Data Governance Policy' })
  })

  it('returns 400 for an invalid request body', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ mode: 'both', input: {} }) // missing required fields
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(400)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Invalid AI policy request payload')
    expect(body.issues).toBeDefined()
  })

  it('returns 403 when decideAccess denies access', async () => {
    mocks.decideAccess.mockReturnValue({
      allowed: false,
      reason: 'Insufficient permissions',
      requiresBreakGlass: true,
    })
    const { POST } = await import('./route')
    const req = makeRequest({ mode: 'both', input: validInput })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(403)
    expect(body.success).toBe(false)
    expect(body.error).toBe('Insufficient permissions')
    expect(body.requiresBreakGlass).toBe(true)
  })

  it('mode=both generates both policies', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ mode: 'both', input: validInput })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data).toEqual({
      privacyPolicy: { title: 'Privacy Policy' },
      dataGovernancePolicy: { title: 'Data Governance Policy' },
    })
    expect(mocks.generatePrivacyPolicy).toHaveBeenCalledOnce()
    expect(mocks.generateDataGovernancePolicy).toHaveBeenCalledOnce()
  })

  it('mode=privacy_policy generates only the privacy policy', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ mode: 'privacy_policy', input: validInput })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual({ privacyPolicy: { title: 'Privacy Policy' } })
    expect(mocks.generatePrivacyPolicy).toHaveBeenCalledOnce()
    expect(mocks.generateDataGovernancePolicy).not.toHaveBeenCalled()
  })

  it('mode=data_governance generates only the governance policy', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ mode: 'data_governance', input: validInput })
    const res = await POST(req)
    const body = await res.json()
    expect(res.status).toBe(200)
    expect(body.data).toEqual({ dataGovernancePolicy: { title: 'Data Governance Policy' } })
    expect(mocks.generateDataGovernancePolicy).toHaveBeenCalledOnce()
    expect(mocks.generatePrivacyPolicy).not.toHaveBeenCalled()
  })

  it('defaults mode to both when omitted', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ input: validInput }) // no mode
    const res = await POST(req)
    expect(res.status).toBe(200)
    expect(mocks.generatePrivacyPolicy).toHaveBeenCalledOnce()
    expect(mocks.generateDataGovernancePolicy).toHaveBeenCalledOnce()
  })

  it('returns meta with access and audit in the response', async () => {
    const { POST } = await import('./route')
    const req = makeRequest({ mode: 'both', input: validInput })
    const res = await POST(req)
    const body = await res.json()
    expect(body.meta.access).toEqual({ allowed: true, reason: 'ok', requiresBreakGlass: false })
    expect(body.meta.audit).toEqual({ eventId: 'audit_1' })
  })
})
