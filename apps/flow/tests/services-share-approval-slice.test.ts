import { beforeEach, describe, expect, it, vi } from 'vitest'

const {
  mockLogger,
  mockEmitWorkflowAuditEvent,
  mockValidateShareLink,
  mockMarkShareLinkUsed,
  mockApprovalRepo,
  mockRevisionRepo,
  mockRecordTimelineEvent,
  mockQuoteRepo,
  mockExecuteCommand,
} = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockEmitWorkflowAuditEvent: vi.fn(),
  mockValidateShareLink: vi.fn(),
  mockMarkShareLinkUsed: vi.fn(),
  mockApprovalRepo: { save: vi.fn() },
  mockRevisionRepo: { save: vi.fn(), updateStatus: vi.fn() },
  mockRecordTimelineEvent: vi.fn(),
  mockQuoteRepo: { findById: vi.fn() },
  mockExecuteCommand: vi.fn(),
}))

vi.mock('@/lib/logger', () => ({ logger: mockLogger }))
vi.mock('@/lib/services/workflow-audit-service', () => ({ emitWorkflowAuditEvent: mockEmitWorkflowAuditEvent }))

vi.mock('@/lib/services/share-link-service', () => ({
  validateShareLink: mockValidateShareLink,
  markShareLinkUsed: mockMarkShareLinkUsed,
}))

vi.mock('@/lib/repositories/workflow-repository', () => ({
  approvalRepo: mockApprovalRepo,
  revisionRepo: mockRevisionRepo,
  recordTimelineEvent: mockRecordTimelineEvent,
}))

vi.mock('@/lib/db', () => ({ quoteRepo: mockQuoteRepo }))
vi.mock('@/lib/control/control-adapter', () => ({ executeCommand: mockExecuteCommand }))

vi.mock('@nzila/platform-commerce-org/defaults', () => ({
  SHOPMOICA_BRANDING: { hashSalt: 'salt' },
}))

describe('Flow share/approval services slice', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('quote approval service handles accept, revision and address flows', async () => {
    const { processQuoteApproval, addressRevision } = await import('@/lib/services/quote-approval-service')

    mockValidateShareLink.mockResolvedValue({
      ok: true,
      link: { id: 'sl-1', quoteId: 'q-1' },
    })
    mockQuoteRepo.findById.mockResolvedValue({ id: 'q-1', orgId: 'org-1', status: 'SENT_TO_CLIENT' })
    mockExecuteCommand.mockResolvedValue({ ok: true })

    const accepted = await processQuoteApproval(
      'a'.repeat(64),
      {
        action: 'ACCEPT',
        customerName: 'Jane',
        customerEmail: 'jane@example.com',
      },
      '127.0.0.1',
    )
    expect(accepted.ok).toBe(true)
    expect(accepted.action).toBe('ACCEPT')

    const revised = await processQuoteApproval(
      'b'.repeat(64),
      {
        action: 'REQUEST_REVISION',
        customerName: 'Jane',
        customerEmail: 'jane@example.com',
        message: 'Change quantity',
      },
      '127.0.0.1',
    )
    expect(revised.ok).toBe(true)
    expect(mockRevisionRepo.save).toHaveBeenCalled()

    await addressRevision('rev-1', 'q-1', 'org-1', 'u-1')
    expect(mockRevisionRepo.updateStatus).toHaveBeenCalledWith('rev-1', 'ADDRESSED')
  })

  it('quote approval service rejects invalid token/input/state', async () => {
    const { processQuoteApproval } = await import('@/lib/services/quote-approval-service')

    mockValidateShareLink.mockResolvedValueOnce({ ok: false, reason: 'expired' })
    const badToken = await processQuoteApproval('bad', {}, '127.0.0.1')
    expect(badToken.ok).toBe(false)

    mockValidateShareLink.mockResolvedValueOnce({ ok: true, link: { id: 'sl-2', quoteId: 'q-2' } })
    const badInput = await processQuoteApproval('c'.repeat(64), {}, '127.0.0.1')
    expect(badInput.ok).toBe(false)

    mockValidateShareLink.mockResolvedValueOnce({ ok: true, link: { id: 'sl-3', quoteId: 'q-3' } })
    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-3', orgId: 'org-1', status: 'ACCEPTED' })
    const badState = await processQuoteApproval(
      'd'.repeat(64),
      { action: 'ACCEPT', customerName: 'Jane', customerEmail: 'jane@example.com' },
      '127.0.0.1',
    )
    expect(badState.ok).toBe(false)
  })

  it('quote approval service covers quote-missing, command-failure, and default-message branches', async () => {
    const { processQuoteApproval } = await import('@/lib/services/quote-approval-service')

    mockValidateShareLink.mockResolvedValueOnce({ ok: true, link: { id: 'sl-4', quoteId: 'q-missing' } })
    mockQuoteRepo.findById.mockResolvedValueOnce(null)
    const missingQuote = await processQuoteApproval(
      'e'.repeat(64),
      { action: 'ACCEPT', customerName: 'Jane', customerEmail: 'jane@example.com' },
    )
    expect(missingQuote).toEqual({ ok: false, error: 'Quote not found' })

    mockValidateShareLink.mockResolvedValueOnce({ ok: true, link: { id: 'sl-5', quoteId: 'q-5' } })
    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-5', orgId: 'org-1', status: 'SENT_TO_CLIENT' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: false, error: 'accept failed' })
    const acceptFail = await processQuoteApproval(
      'f'.repeat(64),
      { action: 'ACCEPT', customerName: 'Jane', customerEmail: 'jane@example.com' },
    )
    expect(acceptFail).toEqual({ ok: false, error: 'accept failed' })

    mockValidateShareLink.mockResolvedValueOnce({ ok: true, link: { id: 'sl-6', quoteId: 'q-6' } })
    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-6', orgId: 'org-1', status: 'SENT_TO_CLIENT' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: false })
    const revisionFail = await processQuoteApproval(
      'g'.repeat(64),
      { action: 'REQUEST_REVISION', customerName: 'Jane', customerEmail: 'jane@example.com' },
    )
    expect(revisionFail).toEqual({ ok: false, error: 'Failed to request revision' })

    mockValidateShareLink.mockResolvedValueOnce({ ok: true, link: { id: 'sl-7', quoteId: 'q-7' } })
    mockQuoteRepo.findById.mockResolvedValueOnce({ id: 'q-7', orgId: 'org-1', status: 'SENT_TO_CLIENT' })
    mockExecuteCommand.mockResolvedValueOnce({ ok: true })
    const revisedNoMessage = await processQuoteApproval(
      'h'.repeat(64),
      { action: 'REQUEST_REVISION', customerName: 'Jane', customerEmail: 'jane@example.com' },
    )
    expect(revisedNoMessage).toEqual({ ok: true, action: 'REQUEST_REVISION' })
    expect(mockRevisionRepo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ requestMessage: 'Revision requested' }),
    )
    expect(mockApprovalRepo.save).toHaveBeenLastCalledWith(
      expect.objectContaining({ sourceIpHash: null }),
    )
  })
})
