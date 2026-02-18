/**
 * @nzila/os-core — Policy engine
 *
 * Evaluates governance actions against an entity's policy config
 * (with constitutional defaults) and returns requirements / blockers.
 */
import {
  GovernanceActionType,
  PolicyConfig,
  PolicyEvaluation,
  PolicyRequirement,
  DEFAULT_POLICY_CONFIG,
} from './types'

interface ActionContext {
  /** Total existing shares for the entity */
  totalSharesOutstanding?: number
  /** Quantity being issued / transferred / repurchased */
  quantity?: number
  /** Dollar amount (for borrowing) */
  amount?: number
  /** Does the entity's constitution restrict transfers on this class? */
  transferRestricted?: boolean
  /** Is there an existing ROFR clause? */
  rofrApplies?: boolean
}

export function evaluateGovernanceRequirements(
  action: GovernanceActionType,
  ctx: ActionContext = {},
  config: Partial<PolicyConfig> = {},
): PolicyEvaluation {
  const cfg: PolicyConfig = { ...DEFAULT_POLICY_CONFIG, ...config }
  const requirements: PolicyRequirement[] = []
  const blockers: string[] = []
  const warnings: string[] = []
  const notices: string[] = []

  switch (action) {
    // ── Share issuance ────────────────────────────────────────────────────
    case 'issue_shares': {
      requirements.push({
        kind: 'board_approval',
        description: 'Board resolution required for share issuance.',
        threshold: cfg.boardQuorum,
      })
      const dilution =
        ctx.totalSharesOutstanding && ctx.quantity
          ? ctx.quantity / (ctx.totalSharesOutstanding + ctx.quantity)
          : 0
      if (dilution >= cfg.issuanceDilutionThreshold) {
        requirements.push({
          kind: 'shareholder_approval',
          description: `Issuance dilutes >=${(cfg.issuanceDilutionThreshold * 100).toFixed(0)}% — shareholder ordinary resolution required.`,
          threshold: cfg.ordinaryResolutionThreshold,
        })
      }
      notices.push('Update share register and cap table after issuance.')
      break
    }

    // ── Transfer ──────────────────────────────────────────────────────────
    case 'transfer_shares': {
      if (ctx.transferRestricted) {
        requirements.push({
          kind: 'board_approval',
          description: 'Board approval required for transfer of restricted shares.',
          threshold: cfg.boardQuorum,
        })
      }
      const pct =
        ctx.totalSharesOutstanding && ctx.quantity
          ? ctx.quantity / ctx.totalSharesOutstanding
          : 0
      if (pct >= cfg.transferApprovalThreshold) {
        requirements.push({
          kind: 'board_approval',
          description: `Block >= ${(cfg.transferApprovalThreshold * 100).toFixed(0)}% of outstanding — board approval required.`,
          threshold: cfg.boardQuorum,
        })
      }
      if (ctx.rofrApplies) {
        requirements.push({
          kind: 'notice',
          description: `Right of first refusal: ${cfg.rofrDays}-day notice to existing shareholders.`,
          deadlineDays: cfg.rofrDays,
        })
      }
      break
    }

    // ── Conversion ────────────────────────────────────────────────────────
    case 'convert_shares': {
      requirements.push({
        kind: 'board_approval',
        description: 'Board resolution required for share conversion.',
        threshold: cfg.boardQuorum,
      })
      notices.push('Update ledger with conversion entries.')
      break
    }

    // ── Borrow funds ──────────────────────────────────────────────────────
    case 'borrow_funds': {
      if (ctx.amount && ctx.amount > cfg.borrowingThreshold) {
        requirements.push({
          kind: 'board_approval',
          description: `Borrowing >${cfg.borrowingThreshold.toLocaleString()} requires board resolution.`,
          threshold: cfg.boardQuorum,
        })
        warnings.push('Ensure covenant compliance before committing.')
      }
      break
    }

    // ── Amend share rights ────────────────────────────────────────────────
    case 'amend_rights': {
      requirements.push({
        kind: 'special_resolution',
        description: 'Amending share class rights requires a special resolution.',
        threshold: cfg.specialResolutionThreshold,
      })
      requirements.push({
        kind: 'filing',
        description: 'File articles of amendment with registrar after approval.',
      })
      break
    }

    // ── Create share class ────────────────────────────────────────────────
    case 'create_class': {
      requirements.push({
        kind: 'special_resolution',
        description: 'Creating a new share class requires a special resolution.',
        threshold: cfg.specialResolutionThreshold,
      })
      requirements.push({
        kind: 'filing',
        description: 'File articles of amendment.',
      })
      break
    }

    // ── Repurchase ────────────────────────────────────────────────────────
    case 'repurchase_shares': {
      requirements.push({
        kind: 'board_approval',
        description: 'Board resolution required for share repurchase.',
        threshold: cfg.boardQuorum,
      })
      warnings.push('Ensure solvency test is met post-repurchase.')
      break
    }

    // ── Dividend ──────────────────────────────────────────────────────────
    case 'dividend': {
      requirements.push({
        kind: 'board_approval',
        description: 'Board must declare the dividend.',
        threshold: cfg.boardQuorum,
      })
      warnings.push('Solvency test must be satisfied before payment.')
      break
    }

    // ── M&A ───────────────────────────────────────────────────────────────
    case 'merger_acquisition': {
      requirements.push({
        kind: 'special_resolution',
        description: 'Merger/acquisition requires special shareholder resolution.',
        threshold: cfg.specialResolutionThreshold,
      })
      requirements.push({
        kind: 'board_approval',
        description: 'Board must recommend the transaction.',
        threshold: cfg.boardQuorum,
      })
      warnings.push('Obtain fairness opinion / independent valuation.')
      break
    }

    // ── Elect directors ───────────────────────────────────────────────────
    case 'elect_directors': {
      requirements.push({
        kind: 'shareholder_approval',
        description: 'Directors elected by ordinary resolution of shareholders.',
        threshold: cfg.ordinaryResolutionThreshold,
      })
      requirements.push({
        kind: 'filing',
        description: 'File Form 6 (Notice of Directors) within 15 days.',
        deadlineDays: 15,
      })
      break
    }

    // ── Amend constitution ────────────────────────────────────────────────
    case 'amend_constitution': {
      requirements.push({
        kind: 'special_resolution',
        description: 'Constitutional amendment requires special resolution.',
        threshold: cfg.specialResolutionThreshold,
      })
      requirements.push({
        kind: 'filing',
        description: 'File restated articles with registrar.',
      })
      break
    }
  }

  return {
    action,
    allowed: blockers.length === 0,
    requirements,
    blockers,
    warnings,
    notices,
  }
}
