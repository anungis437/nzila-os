import { beforeEach, describe, expect, it, vi } from 'vitest'

const { mockEmit, mockCreatePlatformEvent, mockGetEventType, mockGetSensitiveFields, mockWarn } = vi.hoisted(() => ({
  mockEmit: vi.fn(),
  mockCreatePlatformEvent: vi.fn(),
  mockGetEventType: vi.fn(),
  mockGetSensitiveFields: vi.fn(),
  mockWarn: vi.fn(),
}))

vi.mock('@nzila/platform-events/bus', () => ({
  PlatformEventBus: class {
    emit = mockEmit
  },
  createPlatformEvent: mockCreatePlatformEvent,
}))

vi.mock('@nzila/platform-commerce-org/audit', () => ({
  getEventType: mockGetEventType,
  getSensitiveFields: mockGetSensitiveFields,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    warn: mockWarn,
  },
}))

describe('config-events slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockGetEventType.mockReturnValue('org_payment_policy_updated')
  })

  it('emits a single primary platform event when no sensitive fields changed', async () => {
    mockGetSensitiveFields.mockReturnValue([])
    mockCreatePlatformEvent.mockReturnValue({
      type: 'org_payment_policy_updated',
      metadata: { correlationId: 'corr-1' },
    })

    const { emitConfigChange } = await import('@/lib/config-events')

    emitConfigChange({
      orgId: 'org-1',
      actorId: 'user-1',
      configType: 'payment_policy',
      previousValue: { requireDeposit: true },
      newValue: { requireDeposit: false },
    } as never)

    expect(mockCreatePlatformEvent).toHaveBeenCalledTimes(1)
    expect(mockEmit).toHaveBeenCalledTimes(1)
    expect(mockWarn).not.toHaveBeenCalled()
  })

  it('emits additional sensitive-change event and warning when sensitive fields are detected', async () => {
    mockGetSensitiveFields.mockReturnValue([{ field: 'depositPercent', level: 'high' }])
    mockCreatePlatformEvent
      .mockReturnValueOnce({
        type: 'org_payment_policy_updated',
        metadata: { correlationId: 'corr-2' },
      })
      .mockReturnValueOnce({
        type: 'org_config_sensitive_change',
        metadata: { correlationId: 'corr-2' },
      })

    const { emitConfigChange } = await import('@/lib/config-events')

    emitConfigChange({
      orgId: 'org-1',
      actorId: 'user-1',
      configType: 'payment_policy',
      previousValue: { depositPercent: 50 },
      newValue: { depositPercent: 60 },
    } as never)

    expect(mockCreatePlatformEvent).toHaveBeenCalledTimes(2)
    expect(mockEmit).toHaveBeenCalledTimes(2)
    expect(mockWarn).toHaveBeenCalledTimes(1)
  })
})
