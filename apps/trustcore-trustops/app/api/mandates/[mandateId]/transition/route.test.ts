import { describe, expect, it, vi, beforeEach } from 'vitest'

const mocks = vi.hoisted(() => ({
  capturedSpans: [] as Array<{ name: string; attributes: Record<string, unknown> }>,
  getMandate: vi.fn(),
  transitionStage: vi.fn(),
  withOrgScope: vi.fn(),
  emit: vi.fn(),
  saveDecisionRecord: vi.fn(),
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
    mocks.capturedSpans.length = 0
    mocks.getMandate.mockReset()
    mocks.transitionStage.mockReset()
    mocks.emit.mockReset()
    mocks.saveDecisionRecord.mockReset()
  })

  it('records nzila.org.id and nzila.user.id on the transition span', async () => {
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
  })
})
