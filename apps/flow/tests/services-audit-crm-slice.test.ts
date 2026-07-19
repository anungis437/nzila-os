import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockAuditQuoteTransition,
  mockBuildQuoteEvidencePack,
  mockLogAuditTrail,
  mockLoggerInfo,
  mockLoggerWarn,
  mockLoggerError,
  mockUpsertContact,
  mockCreateDeal,
  mockHubSpotClientCtor,
} = vi.hoisted(() => ({
  mockAuditQuoteTransition: vi.fn(),
  mockBuildQuoteEvidencePack: vi.fn(),
  mockLogAuditTrail: vi.fn(),
  mockLoggerInfo: vi.fn(),
  mockLoggerWarn: vi.fn(),
  mockLoggerError: vi.fn(),
  mockUpsertContact: vi.fn(),
  mockCreateDeal: vi.fn(),
  mockHubSpotClientCtor: vi.fn(function HubSpotClient() {
    return {
      upsertContact: mockUpsertContact,
      createDeal: mockCreateDeal,
    }
  }),
}))

vi.mock('@/lib/evidence', () => ({
  auditQuoteTransition: mockAuditQuoteTransition,
  buildQuoteEvidencePack: mockBuildQuoteEvidencePack,
}))

vi.mock('@/lib/commerce-telemetry', () => ({
  logAuditTrail: mockLogAuditTrail,
}))

vi.mock('@/lib/logger', () => ({
  logger: {
    info: mockLoggerInfo,
    warn: mockLoggerWarn,
    error: mockLoggerError,
  },
}))

vi.mock('@nzila/crm-hubspot', () => ({
  HubSpotClient: mockHubSpotClientCtor,
}))

describe('workflow audit and CRM service slices', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    process.env.HUBSPOT_API_KEY = ''
    mockAuditQuoteTransition.mockReturnValue({ id: 'audit-1' })
    mockBuildQuoteEvidencePack.mockResolvedValue({ sealed: true })
    mockUpsertContact.mockResolvedValue({ ok: true, id: 'contact-1' })
    mockCreateDeal.mockResolvedValue({ ok: true, id: 'deal-1' })
  })

  it('emits workflow audit events and builds evidence packs', async () => {
    const audit = await import('@/lib/services/workflow-audit-service')

    audit.emitWorkflowAuditEvent({
      event: 'payment_status_changed',
      quoteId: 'quote-1',
      orgId: 'org-1',
      userId: 'user-1',
      metadata: { fromStatus: 'draft', toStatus: 'sent' },
    })

    expect(mockAuditQuoteTransition).toHaveBeenCalledWith(expect.objectContaining({
      quoteId: 'quote-1',
      fromStatus: 'draft',
      toStatus: 'sent',
      userId: 'user-1',
      orgId: 'org-1',
    }))
    expect(mockLogAuditTrail).toHaveBeenCalledWith({ orgId: 'org-1', actorId: 'user-1' }, 'quote', 'payment_status_changed', 'org-1')
    expect(mockLoggerInfo).toHaveBeenCalledWith('Workflow audit event emitted', expect.objectContaining({ quoteId: 'quote-1' }))

    await expect(audit.buildWorkflowEvidencePack({
      event: 'deposit_required_set',
      quoteId: 'quote-2',
      orgId: 'org-2',
      userId: 'user-2',
    })).resolves.toEqual({ sealed: true })
    expect(mockBuildQuoteEvidencePack).toHaveBeenCalledWith(expect.objectContaining({
      orgId: 'org-2',
      targetEntityId: 'quote-2',
      triggerEvent: 'deposit_required_set',
      actorId: 'user-2',
    }))
  })

  it('handles CRM disabled, success, and failure branches', async () => {
    const crm = await import('@/lib/services/crm-service')

    expect(await crm.upsertFlowLead({ email: 'no-key@example.com' } as never)).toBeNull()
    expect(mockLoggerWarn).toHaveBeenCalledWith('HUBSPOT_API_KEY not set - Flow CRM sync disabled')

    process.env.HUBSPOT_API_KEY = 'test-key'
    await vi.resetModules()
    const crmEnabled = await import('@/lib/services/crm-service')

    mockUpsertContact.mockResolvedValueOnce({ ok: true, id: 'contact-9' })
    expect(await crmEnabled.upsertFlowLead({ email: 'ok@example.com' } as never)).toBe('contact-9')
    expect(mockHubSpotClientCtor).toHaveBeenCalledWith({ apiKey: 'test-key' })

    mockUpsertContact.mockResolvedValueOnce({ ok: false, error: 'boom' })
    expect(await crmEnabled.upsertFlowLead({ email: 'bad@example.com' } as never)).toBeNull()
    expect(mockLoggerError).toHaveBeenCalledWith('Flow HubSpot upsertContact failed', expect.objectContaining({ email: 'bad@example.com' }))

    mockCreateDeal.mockResolvedValueOnce({ ok: true, id: 'deal-9' })
    expect(await crmEnabled.createFlowDeal({ name: 'Deal' } as never)).toBe('deal-9')

    mockCreateDeal.mockResolvedValueOnce({ ok: false, error: 'deal failed' })
    expect(await crmEnabled.createFlowDeal({ name: 'Bad deal' } as never)).toBeNull()
    expect(mockLoggerError).toHaveBeenCalledWith('Flow HubSpot createDeal failed', expect.objectContaining({ deal: 'Bad deal' }))
  })
})
