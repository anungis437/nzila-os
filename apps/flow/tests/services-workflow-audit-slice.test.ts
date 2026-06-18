import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLogger,
  mockAuditQuoteTransition,
  mockBuildQuoteEvidencePack,
  mockLogAuditTrail,
} = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockAuditQuoteTransition: vi.fn(),
  mockBuildQuoteEvidencePack: vi.fn(),
  mockLogAuditTrail: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))
vi.mock('@/lib/evidence', () => ({
  auditQuoteTransition: mockAuditQuoteTransition,
  buildQuoteEvidencePack: mockBuildQuoteEvidencePack,
}))
vi.mock('@/lib/commerce-telemetry', () => ({ logAuditTrail: mockLogAuditTrail }))

describe('workflow-audit service slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('emits workflow audit event and builds evidence pack', async () => {
    const { emitWorkflowAuditEvent, buildWorkflowEvidencePack } = await import('@/lib/services/workflow-audit-service')

    emitWorkflowAuditEvent({
      event: 'quote_sent_to_client',
      quoteId: 'q-1',
      orgId: 'org-1',
      userId: 'u-1',
      metadata: { fromStatus: 'DRAFT', toStatus: 'SENT_TO_CLIENT' },
    })

    expect(mockAuditQuoteTransition).toHaveBeenCalled()
    expect(mockLogAuditTrail).toHaveBeenCalled()
    expect(mockLogger.info).toHaveBeenCalled()

    mockBuildQuoteEvidencePack.mockResolvedValueOnce({ id: 'ev-1' })
    const pack = await buildWorkflowEvidencePack({
      event: 'quote_sent_to_client',
      quoteId: 'q-1',
      orgId: 'org-1',
      userId: 'u-1',
    })
    expect(pack).toEqual({ id: 'ev-1' })
  })

  it('covers metadata fallback branches for fromStatus/toStatus', async () => {
    const { emitWorkflowAuditEvent } = await import('@/lib/services/workflow-audit-service')

    emitWorkflowAuditEvent({
      event: 'quote_sent_to_client',
      quoteId: 'q-2',
      orgId: 'org-1',
      userId: 'u-1',
    })

    expect(mockAuditQuoteTransition).toHaveBeenCalledWith(
      expect.objectContaining({
        quoteId: 'q-2',
        fromStatus: 'quote_sent_to_client',
        toStatus: 'quote_sent_to_client',
      }),
    )

    emitWorkflowAuditEvent({
      event: 'quote_sent_to_client',
      quoteId: 'q-3',
      orgId: 'org-1',
      userId: 'u-1',
      metadata: { fromStatus: 'INTERNAL_REVIEW' },
    })

    expect(mockAuditQuoteTransition).toHaveBeenLastCalledWith(
      expect.objectContaining({
        quoteId: 'q-3',
        fromStatus: 'INTERNAL_REVIEW',
        toStatus: 'quote_sent_to_client',
      }),
    )
  })
})
