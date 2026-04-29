export const FinanceEventTypes = {
  ACCOUNT_CREATED: 'finance.account.created',
  ACCOUNT_SUSPENDED: 'finance.account.suspended',
  TRANSACTION_INITIATED: 'finance.transaction.initiated',
  TRANSACTION_SETTLED: 'finance.transaction.settled',
  TRANSACTION_FAILED: 'finance.transaction.failed',
  TRANSACTION_REVERSED: 'finance.transaction.reversed',
  LEDGER_ENTRY_RECORDED: 'finance.ledger.entry_recorded',
  APPROVAL_REQUESTED: 'finance.approval.requested',
  APPROVAL_GRANTED: 'finance.approval.granted',
  APPROVAL_DENIED: 'finance.approval.denied',
  COMPLIANCE_REVIEW_OPENED: 'finance.compliance.review_opened',
  COMPLIANCE_REVIEW_RESOLVED: 'finance.compliance.review_resolved',
  FUND_CONTRIBUTION_RECEIVED: 'finance.community.contribution_received',
  PROPOSAL_SUBMITTED: 'finance.governance.proposal_submitted',
} as const

export type FinanceEventType = (typeof FinanceEventTypes)[keyof typeof FinanceEventTypes]

export interface FinanceEvent<T = unknown> {
  id: string
  type: FinanceEventType
  orgId: string
  occurredAt: string
  payload: T
  actorId?: string
  correlationId?: string
}
