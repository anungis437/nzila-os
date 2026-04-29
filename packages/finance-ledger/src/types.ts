export type EntryType = 'debit' | 'credit'

export interface LedgerEntry {
  id: string
  orgId: string
  journalBatchId: string
  accountId: string
  entryType: EntryType
  amountCents: number
  currency: string
  description: string
  createdAt: string
  immutable: true
  metadata?: Record<string, unknown>
}

export type JournalBatchStatus = 'draft' | 'posted' | 'reversed'

export interface JournalBatch {
  id: string
  orgId: string
  entries: LedgerEntry[]
  totalDebits: number
  totalCredits: number
  balanced: boolean
  postedAt: string
  createdBy: string
  status: JournalBatchStatus
  reversalBatchId?: string
}

export type ReconciliationState = 'unreconciled' | 'in_progress' | 'reconciled' | 'disputed'

export interface ReconciliationRun {
  id: string
  orgId: string
  periodStart: string
  periodEnd: string
  state: ReconciliationState
  reconciledAt?: string
  totalMatched: number
  totalUnmatched: number
  runBy: string
}
