import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  audit: vi.fn(),
  issue: vi.fn(),
  insertValues: vi.fn(),
  update: vi.fn(),
}))

vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: h.audit }))
vi.mock('@/lib/authority/store/queued-case-mail', () => ({
  issueQueuedCaseMailCapability: h.issue,
  queuedCaseMailContext: vi.fn(),
}))
vi.mock('@/lib/authority/store/route-adapter', () => ({ drizzleExecutor: (tx: unknown) => tx }))
vi.mock('@/lib/correspondence/email-intent', () => ({
  correspondenceEmailKey: () => 'k'.repeat(40),
  correspondenceEmailRetryAllowed: () => true,
  CORRESPONDENCE_EMAIL_LEASE_MS: 1,
  CORRESPONDENCE_EMAIL_RETRY_WINDOW_MS: 1,
}))
vi.mock('../case-status-intent', () => ({
  CASE_STATUS_EMAIL_PURPOSE: 'case_status_notification_v1',
  sealCaseStatusEmail: (payload: unknown) => payload,
  renderCaseStatusNotification: vi.fn(),
  verifyCaseStatusEmail: vi.fn(),
  sealCaseStatusReceipt: vi.fn(),
  verifyCaseStatusReceipt: vi.fn(),
}))
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: vi.fn() }))
vi.mock('@/lib/email-service', () => ({ getFromEmail: vi.fn(), sendResendEmail: vi.fn() }))

const { isQueuedMailMintDenied, queueCaseStatusEmailOrRecordRefusal } = await import('../case-status-delivery')

const input = {
  organizationId: '11111111-1111-4111-8111-111111111111',
  caseId: '22222222-2222-4222-8222-222222222222',
  queuedBy: 'handler-1',
  recipientId: 'member-1',
  previousStatus: 'submitted' as const,
  newStatus: 'assigned' as const,
}

function fakeTx() {
  const savepoint = {
    insert: () => ({ values: h.insertValues }),
    update: () => ({ set: () => ({ where: h.update }) }),
  }
  const transaction = vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(savepoint))
  return { tx: { transaction } as never, transaction, savepoint }
}

function mintDenied() {
  const cause = Object.assign(new Error('QUEUED_MAIL_MINT_DENIED'), { code: '42501' })
  return Object.assign(new Error('Failed query: SELECT public.ue_issue_queued_case_mail($1::uuid) AS issued'), { cause })
}

beforeEach(() => {
  for (const fn of Object.values(h)) fn.mockReset()
  h.insertValues.mockResolvedValue([])
  h.update.mockResolvedValue([])
  h.audit.mockResolvedValue(undefined)
})

describe('isQueuedMailMintDenied', () => {
  it('recognises only the database mint refusal, through the driver cause chain', () => {
    expect(isQueuedMailMintDenied(mintDenied())).toBe(true)
    expect(isQueuedMailMintDenied(Object.assign(new Error('QUEUED_MAIL_MINT_DENIED'), { code: '42501' }))).toBe(true)
    expect(isQueuedMailMintDenied(Object.assign(new Error('permission denied for table claims'), { code: '42501' }))).toBe(false)
    expect(isQueuedMailMintDenied(Object.assign(new Error('QUEUED_MAIL_MINT_DENIED'), { code: 'P0001' }))).toBe(false)
    expect(isQueuedMailMintDenied(new Error('connection reset'))).toBe(false)
    expect(isQueuedMailMintDenied(undefined)).toBe(false)
  })
})

describe('queueCaseStatusEmailOrRecordRefusal', () => {
  it('queues inside a savepoint and records the queue audit when the capability is minted', async () => {
    const { tx, transaction, savepoint } = fakeTx()
    h.issue.mockResolvedValue('capability')
    const result = await queueCaseStatusEmailOrRecordRefusal(tx, input)
    expect(transaction).toHaveBeenCalledTimes(1)
    expect(result).toEqual({ queued: true, id: expect.any(String) })
    expect(h.issue).toHaveBeenCalledWith(savepoint, { queueId: (result as { id: string }).id })
    expect(h.audit).toHaveBeenCalledWith(savepoint, expect.objectContaining({ action: 'case.status_email_queued' }))
    expect(h.audit).not.toHaveBeenCalledWith(tx, expect.objectContaining({ action: 'case.status_email_not_queued' }))
  })

  it('rolls back only the notice and audits the refusal when the database denies the mint', async () => {
    const { tx } = fakeTx()
    h.issue.mockRejectedValue(mintDenied())
    const result = await queueCaseStatusEmailOrRecordRefusal(tx, input)
    expect(result).toEqual({ queued: false })
    expect(h.audit).toHaveBeenCalledTimes(1)
    expect(h.audit).toHaveBeenCalledWith(tx, {
      organizationId: input.organizationId,
      userId: input.queuedBy,
      action: 'case.status_email_not_queued',
      resourceType: 'claims',
      resourceId: input.caseId,
      details: { recipientId: input.recipientId, newStatus: input.newStatus, reason: 'QUEUED_MAIL_MINT_DENIED' },
    })
  })

  it('propagates every other failure so the transition aborts', async () => {
    const { tx } = fakeTx()
    h.issue.mockRejectedValue(Object.assign(new Error('permission denied for function'), { code: '42501' }))
    await expect(queueCaseStatusEmailOrRecordRefusal(tx, input)).rejects.toThrow('permission denied for function')
    expect(h.audit).not.toHaveBeenCalled()
  })

  it('propagates a refusal-audit failure instead of committing an unaudited skip', async () => {
    const { tx } = fakeTx()
    h.issue.mockRejectedValue(mintDenied())
    h.audit.mockRejectedValue(new Error('audit failed'))
    await expect(queueCaseStatusEmailOrRecordRefusal(tx, input)).rejects.toThrow('audit failed')
  })
})
