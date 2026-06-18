import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockLogger, mockRecordEventEmissionGap, mockEnforceEventRequirement, mockAssertBootstrapState, mockInitEventPersistence } = vi.hoisted(() => ({
  mockLogger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
  mockRecordEventEmissionGap: vi.fn(),
  mockEnforceEventRequirement: vi.fn(),
  mockAssertBootstrapState: vi.fn(),
  mockInitEventPersistence: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({
  logger: mockLogger,
}))

vi.mock('@/lib/telemetry/counters', () => ({
  recordEventEmissionGap: mockRecordEventEmissionGap,
}))

vi.mock('@/lib/control/dispatch/event-requirement', () => ({
  enforceCriticalCommandEventRequirement: mockEnforceEventRequirement,
}))

vi.mock('@/lib/control/bootstrap-assertions', () => ({
  assertBootstrapState: mockAssertBootstrapState,
}))

vi.mock('@/lib/events/persist', () => ({
  initEventPersistence: mockInitEventPersistence,
}))

// Dynamic imports in bootstrapFlowControlLayer target these modules.
vi.mock('@/lib/control/register-handlers', () => ({}))
vi.mock('@/lib/control/register-integrations', () => ({}))

describe('Flow control command-bus/bootstrap slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.resetModules()
    mockEnforceEventRequirement.mockReturnValue({ ok: true })
  })

  it('returns UNKNOWN_COMMAND when no handler is registered', async () => {
    const { execute } = await import('@/lib/control/command-bus')

    const result = await execute(
      { type: 'unknown_cmd' },
      { org_id: 'org-1', actor_id: 'actor-1', correlation_id: '11111111-1111-4111-8111-111111111111' },
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.code).toBe('UNKNOWN_COMMAND')
    expect(mockLogger.error).toHaveBeenCalledTimes(1)
  })

  it('rejects duplicate handler registration', async () => {
    const { registerHandler } = await import('@/lib/control/command-bus')

    const handler = {
      commandType: 'dup_cmd',
      execute: vi.fn().mockResolvedValue({ success: true, emitted_event_ids: ['evt-1'] }),
    }

    registerHandler(handler)
    expect(() => registerHandler(handler)).toThrow('Handler already registered for command type: dup_cmd')
  })

  it('returns EVENT_REQUIREMENT_VIOLATION for critical command without emitted event', async () => {
    const { registerHandler, execute } = await import('@/lib/control/command-bus')

    registerHandler({
      commandType: 'send_quote',
      execute: vi.fn().mockResolvedValue({ success: true, emitted_event_ids: [] }),
    })
    mockEnforceEventRequirement.mockReturnValue({ ok: false, message: 'missing event' })

    const result = await execute(
      { type: 'send_quote' },
      { org_id: 'org-1', actor_id: 'actor-1', correlation_id: '11111111-1111-4111-8111-111111111111' },
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.code).toBe('EVENT_REQUIREMENT_VIOLATION')
    expect(mockRecordEventEmissionGap).toHaveBeenCalledTimes(1)
  })

  it('maps FlowWorkflowError to structured failure result', async () => {
    const { registerHandler, execute } = await import('@/lib/control/command-bus')
    const { InvalidWorkflowTransitionError } = await import('@/lib/workflows/errors')

    registerHandler({
      commandType: 'wf_err',
      execute: vi.fn().mockRejectedValue(
        new InvalidWorkflowTransitionError('order', 'CREATED', 'SHIPPED', ['CONFIRMED']),
      ),
    })

    const result = await execute(
      { type: 'wf_err' },
      { org_id: 'org-1', actor_id: 'actor-1', correlation_id: '11111111-1111-4111-8111-111111111111' },
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.code).toBe('INVALID_TRANSITION')
    expect(mockLogger.warn).toHaveBeenCalledTimes(1)
  })

  it('maps unexpected errors to INTERNAL_ERROR', async () => {
    const { registerHandler, execute } = await import('@/lib/control/command-bus')

    registerHandler({
      commandType: 'boom',
      execute: vi.fn().mockRejectedValue(new Error('kaboom')),
    })

    const result = await execute(
      { type: 'boom' },
      { org_id: 'org-1', actor_id: 'actor-1', correlation_id: '11111111-1111-4111-8111-111111111111' },
    )

    expect(result.success).toBe(false)
    expect(result.errors?.[0]?.code).toBe('INTERNAL_ERROR')
    expect(result.errors?.[0]?.message).toBe('kaboom')
    expect(mockLogger.error).toHaveBeenCalledTimes(1)
  })

  it('bootstraps once and uses idempotent short-circuit on second call', async () => {
    const { bootstrapFlowControlLayer, isFlowControlLayerBootstrapped } = await import('@/lib/control/bootstrap')

    await bootstrapFlowControlLayer()
    await bootstrapFlowControlLayer()

    expect(isFlowControlLayerBootstrapped()).toBe(true)
    expect(mockInitEventPersistence).toHaveBeenCalledTimes(1)
    expect(mockAssertBootstrapState).toHaveBeenCalledTimes(2)
  })
})
