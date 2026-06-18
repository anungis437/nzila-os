import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  capturedSpans: [] as Array<{ name: string; attributes: Record<string, unknown> }>,
  getMandate: vi.fn(),
  transitionStage: vi.fn(),
  withOrgScope: vi.fn(),
  emit: vi.fn(),
  saveDecisionRecord: vi.fn(),
  evaluateTransition: vi.fn(),
}))

vi.mock('@nzila/otel-core', () => ({
  createNzilaSpan: async (
    name: string,
    attributes: Record<string, unknown>,
    fn: (span: {
      setAttribute: (k: string, v: unknown) => void
      addEvent: (n: string, a?: Record<string, unknown>) => void
      setStatus: (s: { code: number; message?: string }) => void
      end: () => void
    }) => Promise<unknown>,
  ) => {
    mocks.capturedSpans.push({ name, attributes: { ...attributes } })
    return fn({
      setAttribute: () => {},
      addEvent: () => {},
      setStatus: () => {},
      end: () => {},
    })
  },
}))

vi.mock('../../../../../lib/api-guards', () => ({
  withOrgScope: (
    _req: Request,
    handler: (ctx: { userId: string; orgId: string }) => Promise<Response>,
  ) => {
    mocks.withOrgScope({ userId: 'user_test', orgId: 'org_test_uuid' })
    return handler({ userId: 'user_test', orgId: 'org_test_uuid' })
  },
}))

vi.mock('../../../../../lib/mandates-store', () => ({
  getMandate: (...args: unknown[]) => mocks.getMandate(...args),
  transitionStage: (...args: unknown[]) => mocks.transitionStage(...args),
}))

vi.mock('@nzila/trustcore-trustops/fsm', () => ({
  evaluateTransition: (...args: unknown[]) => mocks.evaluateTransition(...args),
}))

vi.mock('@nzila/platform-events', () => ({
  PlatformEventBus: class {
    emit = (...args: unknown[]) => mocks.emit(...args)
  },
  createPlatformEvent: (kind: string, payload: unknown, meta: unknown) => ({
    kind,
    payload,
    meta,
  }),
}))

vi.mock('@nzila/platform-decision-engine', () => ({
  saveDecisionRecord: (...args: unknown[]) => mocks.saveDecisionRecord(...args),
  generateDecisionId: () => 'dec_test',
  nowISO: () => new Date().toISOString(),
}))

describe('POST /api/mandates/[mandateId]/transition — OTEL attributes', () => {
  beforeEach(() => {
    vi.stubEnv('NODE_ENV', 'test')
    mocks.capturedSpans.length = 0
    mocks.getMandate.mockReset()
    mocks.transitionStage.mockReset()
    mocks.emit.mockReset()
    mocks.saveDecisionRecord.mockReset()
    mocks.evaluateTransition.mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('records nzila.org.id and nzila.user.id on the transition span', async () => {
    mocks.evaluateTransition.mockReturnValue({ ok: true })
    mocks.getMandate.mockResolvedValue({
      id: 'm-001',
      name: 'Test',
      debtorName: 'Debtor',
      stage: 'mandate_intake',
    })
    mocks.transitionStage.mockResolvedValue(undefined)

    const { POST } = await import('./route')

    const form = new FormData()
    form.set('toStage', 'engagement_signed')
    const req = new Request(
      'http://localhost:3018/api/mandates/m-001/transition',
      { method: 'POST', body: form },
    )

    const res = await POST(req as never, {
      params: Promise.resolve({ mandateId: 'm-001' }),
    })

    expect(res).toBeDefined()
    expect(mocks.capturedSpans).toHaveLength(1)
    const [span] = mocks.capturedSpans
    expect(span.name).toBe('trustcore.trustops.mandate.transition')
    expect(span.attributes['nzila.org.id']).toBe('org_test_uuid')
    expect(span.attributes['nzila.user.id']).toBe('user_test')
    expect(mocks.transitionStage).toHaveBeenCalledWith(
      'm-001',
      'engagement_signed',
      'user_test',
      'manual',
      'org_test_uuid',
    )
    expect(mocks.emit).toHaveBeenCalledTimes(1)
    expect(mocks.saveDecisionRecord).toHaveBeenCalledTimes(1)
  })

  it('still records nzila.org.id when the mandate is not found', async () => {
    mocks.getMandate.mockResolvedValue(null)

    const { POST } = await import('./route')

    const form = new FormData()
    form.set('toStage', 'engagement_signed')
    const req = new Request(
      'http://localhost:3018/api/mandates/missing/transition',
      { method: 'POST', body: form },
    )

    await POST(req as never, {
      params: Promise.resolve({ mandateId: 'missing' }),
    })

    expect(mocks.capturedSpans.length).toBeGreaterThanOrEqual(1)
    const span = mocks.capturedSpans.at(-1)!
    expect(span.attributes['nzila.org.id']).toBe('org_test_uuid')
    expect(span.attributes['nzila.user.id']).toBe('user_test')
    expect(mocks.transitionStage).not.toHaveBeenCalled()
    expect(mocks.evaluateTransition).not.toHaveBeenCalled()
  })

  it('rejects invalid transitions with a 400 response', async () => {
    mocks.getMandate.mockResolvedValue({
      id: 'm-400',
      name: 'Test',
      debtorName: 'Debtor',
      stage: 'mandate_intake',
    })
    mocks.evaluateTransition.mockReturnValue({ ok: false, reason: 'invalid_transition' })

    const { POST } = await import('./route')

    const form = new FormData()
    form.set('toStage', 'distribution')
    const req = new Request(
      'http://localhost:3018/api/mandates/m-400/transition',
      { method: 'POST', body: form },
    )

    const res = await POST(req as never, {
      params: Promise.resolve({ mandateId: 'm-400' }),
    })

    expect(res.status).toBe(400)
    expect(mocks.transitionStage).not.toHaveBeenCalled()
    expect(mocks.emit).not.toHaveBeenCalled()
  })

  it('uses unknown reason when transition rejection reason is undefined', async () => {
    mocks.getMandate.mockResolvedValue({
      id: 'm-401',
      name: 'Test',
      debtorName: 'Debtor',
      stage: 'mandate_intake',
    })
    mocks.evaluateTransition.mockReturnValue({ ok: false })

    const { POST } = await import('./route')

    const req = new Request(
      'http://localhost:3018/api/mandates/m-401/transition',
      { method: 'POST', body: new FormData() },
    )

    const res = await POST(req as never, {
      params: Promise.resolve({ mandateId: 'm-401' }),
    })

    expect(res.status).toBe(400)
    expect(mocks.transitionStage).not.toHaveBeenCalled()
  })

  it('continues redirect flow when decision persistence fails', async () => {
    mocks.getMandate.mockResolvedValue({
      id: 'm-500',
      name: 'Test',
      debtorName: 'Debtor',
      stage: 'mandate_intake',
    })
    mocks.evaluateTransition.mockReturnValue({ ok: true })
    mocks.saveDecisionRecord.mockImplementation(() => {
      throw new Error('decision-write-failure')
    })

    const { POST } = await import('./route')

    const form = new FormData()
    form.set('toStage', 'engagement_signed')
    const req = new Request(
      'http://localhost:3018/api/mandates/m-500/transition',
      { method: 'POST', body: form },
    )

    const res = await POST(req as never, {
      params: Promise.resolve({ mandateId: 'm-500' }),
    })

    expect(res.status).toBe(303)
    expect(res.headers.get('location')).toContain('/mandates/m-500')
    expect(mocks.transitionStage).toHaveBeenCalledTimes(1)
    expect(mocks.emit).toHaveBeenCalledTimes(1)
  })

  it('persists production environment context when NODE_ENV is production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    mocks.getMandate.mockResolvedValue({
      id: 'm-prod',
      name: 'Test',
      debtorName: 'Debtor',
      stage: 'mandate_intake',
    })
    mocks.evaluateTransition.mockReturnValue({ ok: true })

    const { POST } = await import('./route')

    const form = new FormData()
    form.set('toStage', 'engagement_signed')
    const req = new Request(
      'http://localhost:3018/api/mandates/m-prod/transition',
      { method: 'POST', body: form },
    )

    await POST(req as never, {
      params: Promise.resolve({ mandateId: 'm-prod' }),
    })

    expect(mocks.saveDecisionRecord).toHaveBeenCalledTimes(1)
    const [payload] = mocks.saveDecisionRecord.mock.calls[0] as [
      { environment_context?: { environment?: string } },
    ]
    expect(payload.environment_context?.environment).toBe('PRODUCTION')
  })
})
