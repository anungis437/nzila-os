import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { createAuditorAccessToken } from '@/lib/auditor-token'

const m = vi.hoisted(() => ({
  metrics: vi.fn(),
  benchmarks: vi.fn(),
  insights: vi.fn(),
  intelligenceHealth: vi.fn(),
  export: vi.fn(),
  verify: vi.fn(),
  health: vi.fn(),
  list: vi.fn(),
  create: vi.fn(),
  submit: vi.fn(),
  decide: vi.fn(),
  execute: vi.fn(),
  authorize: vi.fn(),
  enforce: vi.fn(),
}))
vi.mock('@/lib/services/intelligence-service', () => ({
  collectDecisionMetrics: m.metrics,
  collectDecisionBenchmarks: m.benchmarks,
  collectPolicyInsights: m.insights,
  readIntelligencePipelineHealth: m.intelligenceHealth,
}))
vi.mock('@/lib/services/audit-read-service', () => ({
  exportAuditRecords: m.export,
  verifyAuditProof: m.verify,
}))
vi.mock('@/lib/services/pipeline-health-service', () => ({ readPipelineHealth: m.health }))
vi.mock('@/lib/services/governance/state-machine', () => ({
  listGovernanceActions: m.list,
  createGovernanceAction: m.create,
  submitGovernanceAction: m.submit,
  decideApproval: m.decide,
  executeGovernanceAction: m.execute,
}))
vi.mock('@/lib/services/authority/workflow-authorizer', () => ({
  authorizeWorkflowTrigger: m.authorize,
}))
vi.mock('@/lib/services/platform-nar-proof', () => ({
  createPlatformNarProofAdapter: () => ({ createProof: vi.fn() }),
}))
vi.mock('@nzila/decision-core', () => ({ enforceDecision: m.enforce }))
vi.mock('@nzila/os-core', () => ({
  createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}))

const org = '11111111-1111-4111-8111-111111111111',
  foreign = '22222222-2222-4222-8222-222222222222'
const key = { 'x-api-key': 'synthetic-route-key' }
const request = (url: string, body?: object, headers: Record<string, string> = key) =>
  new NextRequest('https://control.test' + url, {
    method: body ? 'POST' : 'GET',
    headers,
    ...(body ? { body: JSON.stringify(body) } : {}),
  })
const routes = [
  {
    name: 'audit export',
    status: 401,
    call: async (r: NextRequest) => (await import('@/app/api/audit/export/route')).GET(r),
  },
  {
    name: 'audit verify',
    status: 401,
    call: async (r: NextRequest) => (await import('@/app/api/audit/verify/route')).POST(r),
  },
  {
    name: 'metrics',
    status: 401,
    call: async (r: NextRequest) => (await import('@/app/api/intelligence/metrics/route')).GET(r),
  },
  {
    name: 'benchmarks',
    status: 401,
    call: async (r: NextRequest) =>
      (await import('@/app/api/intelligence/benchmarks/route')).GET(r),
  },
  {
    name: 'policy insights',
    status: 401,
    call: async (r: NextRequest) =>
      (await import('@/app/api/intelligence/policy-insights/route')).GET(r),
  },
  {
    name: 'intelligence health',
    status: 401,
    call: async (r: NextRequest) =>
      (await import('@/app/api/intelligence/pipeline-health/route')).GET(r),
  },
  {
    name: 'pipeline health',
    status: 503,
    call: async (r: NextRequest) => (await import('@/app/api/pipeline-health/route')).GET(r),
  },
  {
    name: 'workflow authorize',
    status: 401,
    call: async (r: NextRequest) =>
      (await import('@/app/api/control-plane/authority/authorize-workflow/route')).POST(r),
  },
  {
    name: 'governance list',
    status: 401,
    call: async (r: NextRequest) =>
      (await import('@/app/api/control-plane/governance/actions/route')).GET(r),
  },
]

beforeEach(() => {
  vi.resetAllMocks()
  vi.stubEnv('NODE_ENV', 'test')
  vi.stubEnv('CONTROL_PLANE_API_KEY', key['x-api-key'])
  vi.stubEnv('AUDITOR_TOKEN_SECRET', 'synthetic-auditor-secret')
  for (const fn of [m.metrics, m.benchmarks, m.insights, m.intelligenceHealth])
    fn.mockResolvedValue({ ok: true, data: { preserved: true } })
  m.export.mockResolvedValue({
    verification: { checksum: 'checksum', signature: 'signature' },
    records: [],
  })
  m.verify.mockResolvedValue({ status: 200, body: { ok: true, data: { valid: true } } })
  m.health.mockResolvedValue({ status: 'ok', alerts: [] })
  m.list.mockResolvedValue([])
  m.enforce.mockResolvedValue({
    allowed: true,
    decision: { id: 'proof', outcome: { status: 'approved' } },
  })
  m.authorize.mockResolvedValue({
    authorized: true,
    authorization: { token: 'synthetic-signed-result' },
  })
  m.create.mockResolvedValue({ ok: true, data: { id: org } })
})
afterEach(() => vi.unstubAllEnvs())

describe('Control Plane routes retain their real authority boundaries', () => {
  it.each(routes)('$name denies before any service operation', async (route) => {
    expect((await route.call(request('/api', {}, {}))).status).toBe(route.status)
    for (const operation of Object.values(m)) expect(operation).not.toHaveBeenCalled()
  })
  it.each([
    'audit/export',
    'intelligence/metrics',
    'intelligence/benchmarks',
    'intelligence/policy-insights',
  ])('%s denies a foreign organization with a real signed auditor token', async (path) => {
    const token = createAuditorAccessToken({
      organizationId: org,
      expiresAt: new Date(Date.now() + 60_000).toISOString(),
    })
    const names: Record<string, string> = {
      'audit/export': 'audit export',
      'intelligence/metrics': 'metrics',
      'intelligence/benchmarks': 'benchmarks',
      'intelligence/policy-insights': 'policy insights',
    }
    const route = routes.find((r) => names[path] === r.name)!
    const response = await route.call(
      request(`/api/${path}?orgId=${foreign}&decisionType=type&domain=domain`, undefined, {
        authorization: `Bearer ${token}`,
        'x-intelligence-tier': 'enterprise',
      }),
    )
    expect(response.status).toBe(403)
    for (const operation of Object.values(m)) expect(operation).not.toHaveBeenCalled()
  })
  it('forwards resolved metric scope and preserves tier denial before querying', async () => {
    const { GET } = await import('@/app/api/intelligence/metrics/route')
    expect((await GET(request(`/api?orgId=${org}`))).status).toBe(200)
    expect(m.metrics).toHaveBeenCalledWith({ orgId: org, from: null, to: null, tier: 'basic' })
    const { GET: insights } = await import('@/app/api/intelligence/policy-insights/route')
    expect((await insights(request(`/api?orgId=${org}&decisionType=type`))).status).toBe(403)
    expect(m.insights).not.toHaveBeenCalled()
  })
  it('retains the ZIP response and detached signature file', async () => {
    const { GET } = await import('@/app/api/audit/export/route')
    const response = await GET(request(`/api?orgId=${org}&format=zip&limit=25`))
    expect(response.status).toBe(200)
    expect(response.headers.get('content-type')).toBe('application/zip')
    const { default: JSZip } = await import('jszip')
    const zip = await JSZip.loadAsync(Buffer.from(await response.arrayBuffer()))
    expect(await zip.file('audit-pack.sig')!.async('string')).toBe('checksum:signature')
    expect(m.export).toHaveBeenCalledWith({
      orgId: org,
      from: null,
      to: null,
      limit: 25,
      generatedBy: 'control-plane',
    })
  })
  it('retains critical health HTTP503 and refuses to report database failure as success', async () => {
    const { GET } = await import('@/app/api/pipeline-health/route')
    m.health.mockResolvedValueOnce({ status: 'critical', alerts: [{ id: 'critical' }] })
    expect((await GET(request('/api'))).status).toBe(503)
    m.health.mockRejectedValueOnce(new Error('database unavailable'))
    expect((await GET(request('/api'))).status).toBe(503)
  })
  it('retains workflow preflight before service authorization and the approval response', async () => {
    const { POST } = await import('@/app/api/control-plane/authority/authorize-workflow/route')
    const body = {
      workflowId: 'workflow',
      orgId: org,
      requestId: foreign,
      initiatedBy: { actorId: 'actor', actorType: 'service' },
    }
    m.enforce.mockResolvedValueOnce({ allowed: false, decision: { id: 'denied' } })
    expect((await POST(request('/api', body))).status).toBe(422)
    expect(m.authorize).not.toHaveBeenCalled()
    m.authorize.mockResolvedValueOnce({
      authorized: false,
      requiresApproval: true,
      reason: 'Approval needed',
    })
    expect((await POST(request('/api', body))).status).toBe(202)
    expect(m.authorize).toHaveBeenCalledWith(
      expect.objectContaining({
        orgId: org,
        initiatedBy: { actorId: 'actor', actorType: 'service' },
        executionContext: { dryRun: false, priority: 'normal' },
      }),
    )
    expect(m.enforce.mock.invocationCallOrder.at(-1)!).toBeLessThan(
      m.authorize.mock.invocationCallOrder.at(-1)!,
    )
  })
  it('retains governance create/proof sequencing and organization-scoped list arguments', async () => {
    const { GET, POST } = await import('@/app/api/control-plane/governance/actions/route')
    expect((await GET(request(`/api?orgId=${org}`))).status).toBe(200)
    expect(m.list).toHaveBeenCalledExactlyOnceWith(org)
    expect(
      (
        await POST(
          request('/api', {
            operation: 'create',
            orgId: org,
            actionType: 'share_issuance',
            createdBy: 'actor',
          }),
        )
      ).status,
    ).toBe(201)
    expect(m.enforce.mock.invocationCallOrder[0]).toBeLessThan(m.create.mock.invocationCallOrder[0])
    expect(m.create.mock.invocationCallOrder[0]).toBeLessThan(m.enforce.mock.invocationCallOrder[1])
    m.enforce.mockRejectedValueOnce(new Error('proof unavailable'))
    expect(
      (
        await POST(
          request('/api', {
            operation: 'create',
            orgId: org,
            actionType: 'share_issuance',
            createdBy: 'actor',
          }),
        )
      ).status,
    ).toBe(500)
    expect(m.create).toHaveBeenCalledTimes(1)
  })
})
