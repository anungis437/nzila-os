import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockUpsertFlowLead,
  mockCreateFlowDeal,
  mockEmitTrialStarted,
  mockBusEmit,
} = vi.hoisted(() => ({
  mockUpsertFlowLead: vi.fn(),
  mockCreateFlowDeal: vi.fn(),
  mockEmitTrialStarted: vi.fn((payload: unknown, meta: unknown) => ({ kind: 'trial.started', payload, meta })),
  mockBusEmit: vi.fn(),
}))

vi.mock('@/lib/services/crm-service', () => ({
  upsertFlowLead: mockUpsertFlowLead,
  createFlowDeal: mockCreateFlowDeal,
}))

vi.mock('@nzila/platform-events/commercial', () => ({
  emitTrialStarted: mockEmitTrialStarted,
}))

vi.mock('@nzila/platform-events', () => ({
  PlatformEventBus: class {
    emit = mockBusEmit
  },
}))

describe('api trial route slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('accepts valid payloads and computes ARR across team-size branches', async () => {
    const { POST } = await import('@/app/api/trial/route')

    mockUpsertFlowLead
      .mockResolvedValueOnce('contact-a')
      .mockResolvedValueOnce('contact-b')
      .mockResolvedValueOnce('contact-c')
      .mockResolvedValueOnce('contact-d')

    const base = {
      firstName: 'Ada',
      lastName: 'Lovelace',
      email: 'ada@example.com',
      company: 'Analytical Engines',
      primaryUseCase: 'automation',
      industry: 'manufacturing',
      website: 'https://example.com',
      brandName: 'AE',
      primaryColor: '#123456',
      logoUrl: 'https://example.com/logo.svg',
      currency: 'CAD',
      taxRegion: 'QC',
      taxId: 'GST-123',
      defaultTaxRate: '14.975',
      products: [{ name: 'Starter Box', sku: 'SB-1', unitPrice: '49.99' }],
    }

    const payloads = [
      { ...base, email: 'a@example.com', teamSize: undefined },
      { ...base, email: 'b@example.com', teamSize: '100+' },
      { ...base, email: 'c@example.com', teamSize: '21-50' },
      { ...base, email: 'd@example.com', teamSize: '6-20' },
    ]

    for (const payload of payloads) {
      const response = await POST(new Request('http://localhost/api/trial', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      }) as never)

      expect(response.status).toBe(200)
      await expect(response.json()).resolves.toMatchObject({ ok: true, trialEndsAt: expect.any(String) })
    }

    expect(mockUpsertFlowLead).toHaveBeenCalledTimes(4)
    expect(mockCreateFlowDeal).toHaveBeenCalledTimes(4)
    expect(mockCreateFlowDeal).toHaveBeenNthCalledWith(1, expect.objectContaining({
      properties: expect.objectContaining({ flow_arr_estimate: '3000' }),
    }))
    expect(mockCreateFlowDeal).toHaveBeenNthCalledWith(2, expect.objectContaining({
      properties: expect.objectContaining({ flow_arr_estimate: '24000' }),
    }))
    expect(mockCreateFlowDeal).toHaveBeenNthCalledWith(3, expect.objectContaining({
      properties: expect.objectContaining({ flow_arr_estimate: '12000' }),
    }))
    expect(mockCreateFlowDeal).toHaveBeenNthCalledWith(4, expect.objectContaining({
      properties: expect.objectContaining({ flow_arr_estimate: '6000' }),
    }))

    expect(mockEmitTrialStarted).toHaveBeenCalledTimes(4)
    expect(mockBusEmit).toHaveBeenCalledTimes(4)
  })

  it('handles missing contact id by skipping deal creation and still emits event', async () => {
    const { POST } = await import('@/app/api/trial/route')

    mockUpsertFlowLead.mockResolvedValueOnce(null)

    const response = await POST(new Request('http://localhost/api/trial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'No',
        email: 'nocontact@example.com',
        company: 'No Contact Co',
        teamSize: '1-5',
      }),
    }) as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true })
    expect(mockCreateFlowDeal).not.toHaveBeenCalled()
    expect(mockBusEmit).toHaveBeenCalledTimes(1)
  })

  it('covers optional-property false branches and malformed team-size fallback', async () => {
    const { POST } = await import('@/app/api/trial/route')

    mockUpsertFlowLead.mockResolvedValueOnce('contact-z')
    mockCreateFlowDeal.mockResolvedValueOnce({ id: 'deal-z' })

    const response = await POST(new Request('http://localhost/api/trial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Fallback',
        email: 'fallback@example.com',
        company: 'Fallback Co',
        teamSize: 'many',
      }),
    }) as never)

    expect(response.status).toBe(200)
    await expect(response.json()).resolves.toMatchObject({ ok: true })

    expect(mockUpsertFlowLead).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({
        flow_source: 'flow-trial-signup',
        flow_trial_status: 'trialing',
      }),
    }))
    expect(mockUpsertFlowLead).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.not.objectContaining({
        flow_primary_use_case: expect.anything(),
        flow_tax_region: expect.anything(),
        flow_currency: expect.anything(),
      }),
    }))

    expect(mockCreateFlowDeal).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({ flow_arr_estimate: '3000' }),
    }))
  })

  it('maps missing seed product unitPrice to empty string', async () => {
    const { POST } = await import('@/app/api/trial/route')

    mockUpsertFlowLead.mockResolvedValueOnce('contact-seed')
    mockCreateFlowDeal.mockResolvedValueOnce({ id: 'deal-seed' })

    const response = await POST(new Request('http://localhost/api/trial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Seed',
        email: 'seed@example.com',
        company: 'Seed Co',
        products: [{ name: 'No Price Product', sku: 'NP-1' }],
      }),
    }) as never)

    expect(response.status).toBe(200)
    expect(mockUpsertFlowLead).toHaveBeenCalledWith(expect.objectContaining({
      properties: expect.objectContaining({
        flow_seed_products: JSON.stringify([{ name: 'No Price Product', sku: 'NP-1', unitPrice: '' }]),
      }),
    }))
  })

  it('returns 400 for invalid payload and 500 for unexpected error', async () => {
    const { POST } = await import('@/app/api/trial/route')

    const invalid = await POST(new Request('http://localhost/api/trial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ firstName: '', email: 'not-an-email' }),
    }) as never)

    expect(invalid.status).toBe(400)
    await expect(invalid.json()).resolves.toMatchObject({ ok: false, error: 'Invalid trial payload' })

    mockUpsertFlowLead.mockRejectedValueOnce(new Error('crm unavailable'))
    const failing = await POST(new Request('http://localhost/api/trial', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        firstName: 'Err',
        email: 'err@example.com',
        company: 'Err Co',
      }),
    }) as never)

    expect(failing.status).toBe(500)
    await expect(failing.json()).resolves.toMatchObject({ ok: false, error: 'Failed to create trial lead' })
  })
})
