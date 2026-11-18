import { beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({
  authenticate: vi.fn(),
  context: vi.fn(),
  enforce: vi.fn(),
  create: vi.fn(),
  list: vi.fn(),
  order: [] as string[],
  proofAdapter: { createProof: vi.fn() },
}))
vi.mock('@/lib/api-guards', () => ({
  authenticateUser: m.authenticate,
  withRequestContext: (_req: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@nzila/os-core/telemetry', () => ({
  withSpan: (_name: string, _attrs: unknown, fn: () => unknown) => fn(),
}))
vi.mock('@/lib/resolve-org', () => ({ resolveOrgContext: m.context }))
vi.mock('@/lib/db', () => ({ quoteRepo: { create: m.create, findAll: m.list } }))
vi.mock('@nzila/decision-core', () => ({ enforceDecision: m.enforce }))
vi.mock('@/lib/audit/platform-nar-proof', () => ({
  createPlatformNarProofAdapter: () => m.proofAdapter,
}))

const ctx = {
  orgId: 'internal-org',
  actorId: 'canonical-actor',
  role: 'sales',
  permissions: ['quote:create', 'quote:read'],
  requestId: 'r',
}
const quote = { id: 'created-quote', orgId: ctx.orgId }
const request = (body: object) =>
  new Request('https://flow.test/api/quotes?orgId=foreign', {
    method: 'POST',
    body: JSON.stringify(body),
  })

beforeEach(() => {
  vi.resetModules()
  vi.clearAllMocks()
  m.order = []
  m.authenticate.mockResolvedValue({ ok: true, userId: ctx.actorId })
  m.context.mockResolvedValue(ctx)
  m.list.mockResolvedValue([quote])
  m.create.mockImplementation(async () => {
    m.order.push('create')
    return quote
  })
  m.enforce.mockImplementation(async (input) => {
    m.order.push(input.resourceId === 'pending' ? 'preflight-proof' : 'recorded-proof')
    return { allowed: true, decision: { id: input.resourceId } }
  })
})

describe('quote route through the commerce service', () => {
  it('denies before resolving scope or reading commerce data', async () => {
    m.authenticate.mockResolvedValue({
      ok: false,
      response: new Response('denied', { status: 401 }),
    })
    const { GET, POST } = await import('@/app/api/quotes/route')
    expect((await GET(request({}))).status).toBe(401)
    expect((await POST(request({ title: 'quote' }))).status).toBe(401)
    expect(m.context).not.toHaveBeenCalled()
    expect(m.list).not.toHaveBeenCalled()
    expect(m.create).not.toHaveBeenCalled()
  })
  it('lists only the resolved internal organization', async () => {
    const { GET } = await import('@/app/api/quotes/route')
    expect(await (await GET(request({}))).json()).toEqual({ ok: true, data: [quote] })
    expect(m.list).toHaveBeenCalledExactlyOnceWith(ctx.orgId)
  })
  it('retains input validation before starting the decision or commerce write', async () => {
    const { POST } = await import('@/app/api/quotes/route')
    expect((await POST(request({}))).status).toBe(400)
    expect(m.enforce).not.toHaveBeenCalled()
    expect(m.create).not.toHaveBeenCalled()
  })
  it('uses canonical scope/actor and preserves preflight proof, create, recorded proof ordering', async () => {
    const { POST } = await import('@/app/api/quotes/route')
    const response = await POST(request({ title: 'quote', orgId: 'foreign', actorId: 'forged' }))
    expect(response.status).toBe(201)
    expect(m.order).toEqual(['preflight-proof', 'create', 'recorded-proof'])
    expect(m.create).toHaveBeenCalledWith({
      orgId: ctx.orgId,
      title: 'quote',
      tier: 'STANDARD',
      customerId: 'unknown',
      boxCount: 1,
      lines: [],
    })
    for (const [input] of m.enforce.mock.calls) {
      expect(input).toMatchObject({
        organizationId: ctx.orgId,
        actor: { id: ctx.actorId, role: ctx.role, authorityScope: ctx.permissions },
        proofAdapter: m.proofAdapter,
        actionType: 'quote:create',
      })
    }
    expect(m.enforce.mock.calls.map(([input]) => input.resourceId)).toEqual(['pending', quote.id])
    expect(await response.json()).toMatchObject({
      ok: true,
      data: quote,
      decision: { id: quote.id },
    })
  })
  it('does not create a quote when preflight refuses authority', async () => {
    m.enforce.mockResolvedValueOnce({ allowed: false, decision: { id: 'denied' } })
    const { POST } = await import('@/app/api/quotes/route')
    expect((await POST(request({ title: 'quote' }))).status).toBe(422)
    expect(m.create).not.toHaveBeenCalled()
  })
  it('does not create a quote when preflight proof persistence fails', async () => {
    m.enforce.mockRejectedValueOnce(new Error('proof unavailable'))
    const { POST } = await import('@/app/api/quotes/route')
    expect((await POST(request({ title: 'quote' }))).status).toBe(500)
    expect(m.create).not.toHaveBeenCalled()
  })
  it('never acknowledges success if the final proof fails after the separate commerce write', async () => {
    m.enforce
      .mockResolvedValueOnce({ allowed: true, decision: { id: 'preflight' } })
      .mockRejectedValueOnce(new Error('final proof unavailable'))
    const { POST } = await import('@/app/api/quotes/route')
    expect((await POST(request({ title: 'quote' }))).status).toBe(500)
    expect(m.create).toHaveBeenCalledTimes(1)
  })
})
