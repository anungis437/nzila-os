import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockInfo, mockWarn, mockError, mockRandomUUID } = vi.hoisted(() => ({
  mockInfo: vi.fn(),
  mockWarn: vi.fn(),
  mockError: vi.fn(),
  mockRandomUUID: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockInfo,
    warn: mockWarn,
    error: mockError,
  },
}))

vi.mock('crypto', () => ({
  randomUUID: mockRandomUUID,
}))

describe('orchestrator-dispatch slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    vi.stubGlobal('fetch', vi.fn())
    mockRandomUUID.mockImplementation(() => 'uuid-fixed')
  })

  it('dispatchOrchestratorWorkflow returns success payload on accepted dispatch', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ ok: true, runId: 'run-1', status: 'queued', deduplicated: false }),
    })

    const { dispatchOrchestratorWorkflow } = await import('@/lib/orchestrator-dispatch')
    const result = await dispatchOrchestratorWorkflow({
      orgId: 'org-1',
      actorId: 'actor-1',
      playbook: 'onboarding_trigger',
      idempotencyKey: 'idem-1',
      payload: { x: 1 },
    })

    expect(result).toEqual({ ok: true, runId: 'run-1', status: 'queued', deduplicated: false })
    expect(mockInfo).toHaveBeenCalledTimes(1)
  })

  it('dispatchOrchestratorWorkflow surfaces reject reason when orchestrator denies', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      json: async () => ({ ok: false, error: { code: 'DENIED', message: 'denied' } }),
    })

    const { dispatchOrchestratorWorkflow } = await import('@/lib/orchestrator-dispatch')
    const result = await dispatchOrchestratorWorkflow({
      orgId: 'org-1',
      actorId: 'actor-1',
      playbook: 'reminder_dispatch',
      idempotencyKey: 'idem-2',
    })

    expect(result).toEqual({ ok: false, error: 'denied' })
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })

  it('dispatchOrchestratorWorkflow returns catch-path error when fetch throws', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('network down'))

    const { dispatchOrchestratorWorkflow } = await import('@/lib/orchestrator-dispatch')
    const result = await dispatchOrchestratorWorkflow({
      orgId: 'org-1',
      actorId: 'actor-1',
      playbook: 'reminder_dispatch',
      idempotencyKey: 'idem-3',
    })

    expect(result).toEqual({ ok: false, error: 'network down' })
    expect(mockError).toHaveBeenCalledTimes(1)
  })

  it('invoice and onboarding helper dispatchers build expected workflows and keys', async () => {
    ;(fetch as unknown as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce({ json: async () => ({ ok: true, runId: 'run-r', status: 'queued' }) })
      .mockResolvedValueOnce({ json: async () => ({ ok: true, runId: 'run-o', status: 'queued' }) })

    const { dispatchInvoiceReminder, dispatchOnboardingTrigger } = await import('@/lib/orchestrator-dispatch')

    await dispatchInvoiceReminder({
      orgId: 'org-1',
      actorId: 'actor-1',
      invoiceId: 'inv-1',
      reminderCycle: 'day_7',
      recipientEmail: 'x@example.com',
    })
    await dispatchOnboardingTrigger({
      orgId: 'org-2',
      actorId: 'actor-2',
      orgName: 'Org 2',
      planId: 'pro',
    })

    const firstCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0]
    const secondCall = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[1]
    const firstBody = JSON.parse(firstCall[1].body as string)
    const secondBody = JSON.parse(secondCall[1].body as string)

    expect(firstBody.workflowId).toBe('reminder_dispatch')
    expect(firstBody.idempotencyKey).toContain('reminder:invoice:inv-1:day_7:')
    expect(secondBody.workflowId).toBe('onboarding_trigger')
    expect(secondBody.idempotencyKey).toBe('onboarding:org-2')
  })
})
