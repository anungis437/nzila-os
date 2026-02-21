/**
 * @nzila/tax — Governance integration
 *
 * Policy engine rules specific to the finance + tax overlay:
 * - Dividend → board resolution gate
 * - Borrowing threshold → governance link gate
 * - Fiscal year close → artifact gate
 *
 * Extends the os-core policy engine with finance-specific rules.
 */
import type { PolicyRequirement } from '@nzila/os-core'

export interface FinancePolicyContext {
  /** Province of the entity (for CO-17 requirement) */
  province?: string | null
  /** Whether a board resolution for FS approval exists */
  hasFsApprovalResolution: boolean
  /** Whether a dividend resolution exists (if dividends declared) */
  hasDividendResolution: boolean
  /** Whether dividends were declared this fiscal year */
  dividendsDeclared: boolean
  /** Total borrowing this fiscal year */
  borrowingAmount: number
  /** Borrowing threshold from entity policy config */
  borrowingThreshold: number
  /** Whether a borrowing governance link exists */
  hasBorrowingGovernanceLink: boolean
}

/**
 * Evaluate finance + tax governance requirements for fiscal year close.
 * Returns additional requirements/blockers on top of the base policy engine.
 */
export function evaluateFinanceGovernanceRequirements(
  ctx: FinancePolicyContext,
): {
  requirements: PolicyRequirement[]
  blockers: string[]
  warnings: string[]
} {
  const requirements: PolicyRequirement[] = []
  const blockers: string[] = []
  const warnings: string[] = []

  // FS approval resolution required
  if (!ctx.hasFsApprovalResolution) {
    requirements.push({
      kind: 'board_approval',
      description: 'Board resolution approving financial statements required before fiscal year close.',
    })
    blockers.push('Financial statement approval resolution not yet recorded.')
  }

  // Dividend → board resolution gate
  if (ctx.dividendsDeclared && !ctx.hasDividendResolution) {
    requirements.push({
      kind: 'board_approval',
      description: 'Board resolution required for dividend declaration before tax filing records are allowed.',
    })
    blockers.push('Dividend declared but no board resolution linked.')
  }

  // Borrowing threshold gate
  if (ctx.borrowingAmount > ctx.borrowingThreshold && !ctx.hasBorrowingGovernanceLink) {
    requirements.push({
      kind: 'board_approval',
      description: `Borrowing of $${ctx.borrowingAmount.toLocaleString()} exceeds threshold of $${ctx.borrowingThreshold.toLocaleString()}. Governance link required before tax year can close.`,
    })
    blockers.push(
      `Borrowing exceeds $${ctx.borrowingThreshold.toLocaleString()} threshold — governance link required.`,
    )
  }

  // CO-17 warning for QC entities
  if (ctx.province === 'QC') {
    warnings.push('Quebec entity — CO-17 filing artifact required in addition to T2.')
  }

  return { requirements, blockers, warnings }
}

// ── Audit event action taxonomy for finance + tax ───────────────────────────

export const FINANCE_AUDIT_ACTIONS = {
  // Close lifecycle
  CLOSE_PERIOD_OPEN: 'close_period.open',
  CLOSE_PERIOD_SUBMIT: 'close_period.submit',
  CLOSE_PERIOD_APPROVE: 'close_period.approve',
  CLOSE_PERIOD_REJECT: 'close_period.reject',
  CLOSE_PERIOD_CLOSE: 'close_period.close',
  CLOSE_TASK_COMPLETE: 'close_task.complete',
  CLOSE_EXCEPTION_RAISE: 'close_exception.raise',
  CLOSE_EXCEPTION_RESOLVE: 'close_exception.resolve',
  CLOSE_EXCEPTION_WAIVE: 'close_exception.waive',

  // QBO
  QBO_CONNECT: 'qbo.connect',
  QBO_DISCONNECT: 'qbo.disconnect',
  QBO_SYNC_START: 'qbo.sync.start',
  QBO_SYNC_COMPLETE: 'qbo.sync.complete',
  QBO_SYNC_FAIL: 'qbo.sync.fail',

  // Tax governance
  TAX_PROFILE_CREATE: 'tax.profile.create',
  TAX_PROFILE_UPDATE: 'tax.profile.update',
  TAX_YEAR_CREATE: 'tax.year.create',
  TAX_YEAR_CLOSE: 'tax.year.close',
  TAX_FILING_UPLOAD: 'tax.filing.upload',
  TAX_FILING_REVIEW: 'tax.filing.review',
  TAX_INSTALLMENT_RECORD: 'tax.installment.record',
  TAX_NOTICE_UPLOAD: 'tax.notice.upload',

  // Indirect tax
  INDIRECT_TAX_ACCOUNT_CREATE: 'indirect_tax.account.create',
  INDIRECT_TAX_PERIOD_CREATE: 'indirect_tax.period.create',
  INDIRECT_TAX_PERIOD_FILE: 'indirect_tax.period.file',
  INDIRECT_TAX_PERIOD_PAY: 'indirect_tax.period.pay',
  INDIRECT_TAX_SUMMARY_UPDATE: 'indirect_tax.summary.update',

  // Governance links
  GOVERNANCE_LINK_CREATE: 'governance_link.create',

  // Evidence
  TAX_YEAR_CLOSED: 'tax.year_closed',
  EVIDENCE_PACK_GENERATED: 'evidence_pack.generated',
} as const

export type FinanceAuditAction = (typeof FINANCE_AUDIT_ACTIONS)[keyof typeof FINANCE_AUDIT_ACTIONS]
