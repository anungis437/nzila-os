/**
 * Nzila Business OS - Policy Engine
 * 
 * Constitutional guardrails and policy evaluation.
 * This is the "killer feature" that makes Nzila OS feel like an operating system.
 * 
 * Instead of hardcoding rules throughout the UI, all governance actions
 * are evaluated through this policy engine.
 */

import { 
  CONSTITUTIONAL_THRESHOLDS, 
  ShareClass,
  EquityTransactionType,
  Shareholder,
  ShareHolding,
  calculatePercentage,
  calculateDilution,
  requiresSpecialResolution,
  borrowingExceedsThreshold,
} from '../equity/models'

// ============================================================================
// ACTION TYPES
// ============================================================================

/**
 * All possible governance actions that can be evaluated
 */
export enum GovernanceAction {
  ISSUE_SHARES = 'ISSUE_SHARES',
  TRANSFER_SHARES = 'TRANSFER_SHARES',
  CONVERT_SHARES = 'CONVERT_SHARES',
  BORROW_FUNDS = 'BORROW_FUNDS',
  AMEND_RIGHTS = 'AMEND_RIGHTS',
  M_AND_A = 'M_AND_A',
  DISTRIBUTE_DIVIDEND = 'DISTRIBUTE_DIVIDEND',
  ELECT_DIRECTORS = 'ELECT_DIRECTORS',
  AMEND_CONSTITUTION = 'AMEND_CONSTITUTION',
  REPURCHASE_SHARES = 'REPURCHASE_SHARES',
}

/**
 * Required approval type
 */
export enum ApprovalType {
  BOARD_APPROVAL = 'BOARD_APPROVAL',
  SHAREHOLDER_APPROVAL = 'SHAREHOLDER_APPROVAL',
  SPECIAL_RESOLUTION = 'SPECIAL_RESOLUTION',
  UNANIMOUS_CONSENT = 'UNANIMOUS_CONSENT',
  CFO_APPROVAL = 'CFO_APPROVAL',
  CEO_APPROVAL = 'CEO_APPROVAL',
}

/**
 * Policy requirement result
 */
export interface PolicyRequirement {
  approvalType: ApprovalType
  required: boolean
  threshold?: number
  description: string
  requiredPercentage?: number  // For quorum calculations
}

/**
 * Complete policy evaluation result
 */
export interface PolicyEvaluation {
  action: GovernanceAction
  allowed: boolean
  requirements: PolicyRequirement[]
  blockers: string[]
  warnings: string[]
  notices: PolicyNotice[]
  workflow: WorkflowSpec | null
  deadlines: PolicyDeadline[]
}

/**
 * Policy notice that must be sent
 */
export interface PolicyNotice {
  type: 'ROFR' | 'GENERAL' | 'TRANSFER_NOTICE' | 'MEETING_NOTICE'
  recipient: 'shareholders' | 'board' | 'specific_holder'
  template: string
  beforeActionDays: number
}

/**
 * Workflow specification
 */
export interface WorkflowSpec {
  type: string
  steps: WorkflowStep[]
  autoGenerateResolution: boolean
  estimatedDuration: number  // Days
}

/**
 * Workflow step
 */
export interface WorkflowStep {
  order: number
  type: 'APPROVAL' | 'NOTICE' | 'WAIT' | 'DOCUMENT'
  actor: 'board' | 'shareholders' | 'specific' | 'system'
  required: boolean
  description: string
  deadline?: number  // Days
}

/**
 * Policy deadline
 */
export interface PolicyDeadline {
  type: 'ROFR_EXPIRY' | 'NOTICE_PERIOD' | 'APPROVAL_DEADLINE'
  date: Date
  description: string
}

// ============================================================================
// CAP TABLE CONTEXT
// ============================================================================

/**
 * Current cap table state for policy evaluation
 */
export interface CapTableContext {
  totalSharesOutstanding: number
  totalSharesAuthorized: number
  shareholderCount: number
  holdings: Array<{
    shareholderId: string
    shareholderName: string
    shareClass: ShareClass
    shares: number
    votingRights: number
  }>
  recentTransactions?: Array<{
    type: EquityTransactionType
    shares: number
    date: Date
  }>
}

// ============================================================================
// POLICY ENGINE
// ============================================================================

/**
 * The core policy engine that evaluates governance actions.
 * This is the "brain" of Nzila OS constitutional enforcement.
 */
export class PolicyEngine {
  private thresholds = CONSTITUTIONAL_THRESHOLDS

  /**
   * Evaluate any governance action against constitutional rules
   */
  evaluateRequirements(
    action: GovernanceAction,
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    switch (action) {
      case GovernanceAction.ISSUE_SHARES:
        return this.evaluateIssuance(params, context)
      case GovernanceAction.TRANSFER_SHARES:
        return this.evaluateTransfer(params, context)
      case GovernanceAction.CONVERT_SHARES:
        return this.evaluateConversion(params, context)
      case GovernanceAction.BORROW_FUNDS:
        return this.evaluateBorrowing(params, context)
      case GovernanceAction.AMEND_RIGHTS:
        return this.evaluateAmendment(params, context)
      case GovernanceAction.REPURCHASE_SHARES:
        return this.evaluateRepurchase(params, context)
      case GovernanceAction.M_AND_A:
        return this.evaluateMergerAcquisition(params, context)
      case GovernanceAction.DISTRIBUTE_DIVIDEND:
        return this.evaluateDividend(params, context)
      default:
        return this.evaluateGenericAction(action, params, context)
    }
  }

  /**
   * Evaluate share issuance request
   */
  private evaluateIssuance(
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    const requirements: PolicyRequirement[] = []
    const blockers: string[] = []
    const warnings: string[] = []
    const notices: PolicyNotice[] = []
    const deadlines: PolicyDeadline[] = []

    // Extract parameters
    const newShares = (params.shares as number) || 0
    const shareClass = (params.shareClass as ShareClass) || ShareClass.COMMON_A
    const totalConsideration = (params.totalConsideration as number) || 0
    const existingShares = context.totalSharesOutstanding

    // Calculate dilution
    const dilutionPercentage = calculateDilution(newShares, existingShares)
    
    // 1. Board approval always required
    requirements.push({
      approvalType: ApprovalType.BOARD_APPROVAL,
      required: this.thresholds.ISSUANCE_BOARD_APPROVAL,
      description: 'All share issuances require board approval',
    })

    // 2. Check for special resolution threshold
    if (dilutionPercentage >= (this.thresholds.ISSUANCE_SPECIAL_RESOLUTION * 100)) {
      requirements.push({
        approvalType: ApprovalType.SPECIAL_RESOLUTION,
        required: true,
        threshold: this.thresholds.ISSUANCE_SPECIAL_RESOLUTION,
        description: `Issuance of ${dilutionPercentage}% exceeds 20% threshold - requires 75% shareholder approval`,
        requiredPercentage: 75,
      })
      notices.push({
        type: 'GENERAL',
        recipient: 'shareholders',
        template: 'shareholder_meeting_notice',
        beforeActionDays: 30,
      })
    }

    // 3. Check share class specific rules
    if (shareClass === ShareClass.PREFERRED_A || shareClass === ShareClass.PREFERRED_B) {
      warnings.push('Preferred share issuance requires information rights documentation')
    }

    // 4. For founder shares (Class F), check restrictions
    if (shareClass === ShareClass.FOUNDERS_F) {
      requirements.push({
        approvalType: ApprovalType.SPECIAL_RESOLUTION,
        required: true,
        description: 'Founder shares require special resolution due to voting restrictions',
        requiredPercentage: 75,
      })
    }

    // 5. Check authorized shares limit
    const projectedTotal = existingShares + newShares
    if (projectedTotal > context.totalSharesAuthorized) {
      blockers.push(`Issuance would exceed authorized shares: ${projectedTotal} > ${context.totalSharesAuthorized}`)
    }

    // Generate workflow
    const workflow = this.generateIssuanceWorkflow(requirements, dilutionPercentage)

    return {
      action: GovernanceAction.ISSUE_SHARES,
      allowed: blockers.length === 0,
      requirements,
      blockers,
      warnings,
      notices,
      workflow,
      deadlines,
    }
  }

  /**
   * Evaluate share transfer request
   */
  private evaluateTransfer(
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    const requirements: PolicyRequirement[] = []
    const blockers: string[] = []
    const warnings: string[] = []
    const notices: PolicyNotice[] = []
    const deadlines: PolicyDeadline[] = []

    // Extract parameters
    const shares = (params.shares as number) || 0
    const fromHolderId = (params.fromHolderId as string) || ''
    const toHolderId = (params.toHolderId as string) || ''
    const shareClass = (params.shareClass as ShareClass) || ShareClass.COMMON_A

    // Calculate percentage of total
    const percentageOfTotal = calculatePercentage(shares, context.totalSharesOutstanding)

    // 1. Board approval always required for transfers
    requirements.push({
      approvalType: ApprovalType.BOARD_APPROVAL,
      required: this.thresholds.TRANSFER_BOARD_APPROVAL,
      description: 'All share transfers require board approval',
    })

    // 2. Check ROFR (Right of First Refusal)
    if (shareClass !== ShareClass.COMMON_A) {
      // Preferred shares typically have ROFR
      notices.push({
        type: 'ROFR',
        recipient: 'specific_holder',
        template: 'rofr_notice',
        beforeActionDays: this.thresholds.ROFR_WINDOW_DAYS,
      })
      
      const rofrExpiry = new Date()
      rofrExpiry.setDate(rofrExpiry.getDate() + this.thresholds.ROFR_WINDOW_DAYS)
      deadlines.push({
        type: 'ROFR_EXPIRY',
        date: rofrExpiry,
        description: `ROFR window closes in ${this.thresholds.ROFR_WINDOW_DAYS} days`,
      })
    }

    // 3. Check for special resolution
    if (percentageOfTotal >= (this.thresholds.TRANSFER_SPECIAL_RESOLUTION * 100)) {
      requirements.push({
        approvalType: ApprovalType.SPECIAL_RESOLUTION,
        required: true,
        threshold: this.thresholds.TRANSFER_SPECIAL_RESOLUTION,
        description: `Transfer of ${percentageOfTotal}% exceeds 10% threshold - requires 75% approval`,
        requiredPercentage: 75,
      })
    }

    // 4. Check if transferring to existing shareholder (aggregation)
    const existingHolder = context.holdings.find(h => h.shareholderId === toHolderId)
    if (existingHolder) {
      const aggregateShares = existingHolder.shares + shares
      const aggregatePercentage = calculatePercentage(
        aggregateShares, 
        context.totalSharesOutstanding
      )
      if (aggregatePercentage >= 25) {
        warnings.push(`Transfer would result in ${aggregatePercentage}% ownership - may trigger change of control provisions`)
      }
    }

    // 5. Check transfer restrictions for specific classes
    if (shareClass === ShareClass.FOUNDERS_F) {
      blockers.push('Founder shares (Class F) have transfer restrictions - consult legal')
    }

    // Generate workflow
    const workflow = this.generateTransferWorkflow(requirements, notices.length > 0)

    return {
      action: GovernanceAction.TRANSFER_SHARES,
      allowed: blockers.length === 0,
      requirements,
      blockers,
      warnings,
      notices,
      workflow,
      deadlines,
    }
  }

  /**
   * Evaluate share conversion request
   */
  private evaluateConversion(
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    const requirements: PolicyRequirement[] = []
    const blockers: string[] = []
    const warnings: string[] = []
    const notices: PolicyNotice[] = []
    const deadlines: PolicyDeadline[] = []

    // Extract parameters
    const fromClass = (params.fromClass as ShareClass) || ShareClass.PREFERRED_B
    const toClass = (params.toClass as ShareClass) || ShareClass.COMMON_A
    const shares = (params.shares as number) || 0

    // 1. Board approval required
    requirements.push({
      approvalType: ApprovalType.BOARD_APPROVAL,
      required: this.thresholds.CONVERSION_BOARD_APPROVAL,
      description: 'All share conversions require board approval',
    })

    // 2. Check conversion ratio
    const conversionRatio = params.conversionRatio as number
    if (!conversionRatio || conversionRatio <= 0) {
      blockers.push('Invalid conversion ratio - must be positive number')
    }

    // 3. Check if conversion is allowed for this class
    if (fromClass !== ShareClass.PREFERRED_B && fromClass !== ShareClass.PREFERRED_C) {
      warnings.push(`Conversion from ${fromClass} may have specific requirements`)
    }

    // 4. Check qualified offering trigger
    const conversionTrigger = params.conversionTrigger as string
    if (conversionTrigger === 'QUALIFIED_OFFERING') {
      notices.push({
        type: 'GENERAL',
        recipient: 'shareholders',
        template: 'conversion_notice',
        beforeActionDays: 10,
      })
    }

    // Generate workflow
    const workflow: WorkflowSpec = {
      type: 'CONVERSION',
      steps: [
        { order: 1, type: 'APPROVAL', actor: 'board', required: true, description: 'Board approval of conversion' },
        { order: 2, type: 'DOCUMENT', actor: 'system', required: true, description: 'Generate conversion certificate' },
        { order: 3, type: 'NOTICE', actor: 'shareholders', required: false, description: 'Send conversion notice' },
      ],
      autoGenerateResolution: true,
      estimatedDuration: 5,
    }

    return {
      action: GovernanceAction.CONVERT_SHARES,
      allowed: blockers.length === 0,
      requirements,
      blockers,
      warnings,
      notices,
      workflow,
      deadlines,
    }
  }

  /**
   * Evaluate borrowing request
   */
  private evaluateBorrowing(
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    const requirements: PolicyRequirement[] = []
    const blockers: string[] = []
    const warnings: string[] = []
    const notices: PolicyNotice[] = []
    const deadlines: PolicyDeadline[] = []

    // Extract parameters
    const amount = (params.amount as number) || 0

    // 1. Board approval always required
    requirements.push({
      approvalType: ApprovalType.BOARD_APPROVAL,
      required: this.thresholds.BORROWING_BOARD_APPROVAL,
      description: 'All borrowing requires board approval',
    })

    // 2. Check for special resolution threshold
    if (borrowingExceedsThreshold(amount)) {
      requirements.push({
        approvalType: ApprovalType.SPECIAL_RESOLUTION,
        required: true,
        threshold: this.thresholds.BORROWING_SPECIAL_RESOLUTION,
        description: `Borrowing of $${amount.toLocaleString()} exceeds $${this.thresholds.BORROWING_SPECIAL_RESOLUTION.toLocaleString()} threshold - requires 75% approval`,
        requiredPercentage: 75,
      })
      notices.push({
        type: 'GENERAL',
        recipient: 'shareholders',
        template: 'borrowing_approval_notice',
        beforeActionDays: 30,
      })
    }

    // 3. Check debt-to-equity ratio warnings
    warnings.push('Ensure debt covenants are reviewed before final approval')

    // Generate workflow
    const workflow = this.generateBorrowingWorkflow(requirements, amount)

    return {
      action: GovernanceAction.BORROW_FUNDS,
      allowed: blockers.length === 0,
      requirements,
      blockers,
      warnings,
      notices,
      workflow,
      deadlines,
    }
  }

  /**
   * Evaluate rights amendment
   */
  private evaluateAmendment(
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    const requirements: PolicyRequirement[] = []
    const blockers: string[] = []
    const warnings: string[] = []
    const notices: PolicyNotice[] = []
    const deadlines: PolicyDeadline[] = []

    // Extract parameters
    const amendmentType = (params.amendmentType as string) || 'general'
    const affectedClasses = (params.affectedClasses as ShareClass[]) || []

    // 1. Board approval always required
    requirements.push({
      approvalType: ApprovalType.BOARD_APPROVAL,
      required: true,
      description: 'All amendments require board approval',
    })

    // 2. Special resolution for fundamental changes
    if (['voting', 'conversion', 'liquidation'].includes(amendmentType)) {
      requirements.push({
        approvalType: ApprovalType.SPECIAL_RESOLUTION,
        required: true,
        description: `${amendmentType} amendments require 75% shareholder approval`,
        requiredPercentage: 75,
      })
      notices.push({
        type: 'GENERAL',
        recipient: 'shareholders',
        template: 'amendment_notice',
        beforeActionDays: 30,
      })
    }

    // 3. Unanimous consent for charter amendments
    if (amendmentType === 'charter' || affectedClasses.length > 3) {
      requirements.push({
        approvalType: ApprovalType.UNANIMOUS_CONSENT,
        required: true,
        description: 'Charter amendments require unanimous shareholder consent',
      })
    }

    // Generate workflow
    const workflow: WorkflowSpec = {
      type: 'AMENDMENT',
      steps: [
        { order: 1, type: 'APPROVAL', actor: 'board', required: true, description: 'Board approval of amendment' },
        { order: 2, type: 'NOTICE', actor: 'system', required: true, description: 'Send shareholder notice', deadline: 30 },
        { order: 3, type: 'WAIT', actor: 'system', required: true, description: 'Wait notice period' },
        { order: 4, type: 'APPROVAL', actor: 'shareholders', required: true, description: 'Shareholder vote' },
        { order: 5, type: 'DOCUMENT', actor: 'system', required: true, description: 'File amended articles' },
      ],
      autoGenerateResolution: true,
      estimatedDuration: 45,
    }

    return {
      action: GovernanceAction.AMEND_RIGHTS,
      allowed: blockers.length === 0,
      requirements,
      blockers,
      warnings,
      notices,
      workflow,
      deadlines,
    }
  }

  /**
   * Evaluate share repurchase
   */
  private evaluateRepurchase(
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    const requirements: PolicyRequirement[] = []
    const blockers: string[] = []
    const warnings: string[] = []
    const notices: PolicyNotice[] = []
    const deadlines: PolicyDeadline[] = []

    const shares = (params.shares as number) || 0
    const percentageOfTotal = calculatePercentage(shares, context.totalSharesOutstanding)

    // 1. Board approval required
    requirements.push({
      approvalType: ApprovalType.BOARD_APPROVAL,
      required: true,
      description: 'All share repurchases require board approval',
    })

    // 2. Special resolution for large repurchases
    if (percentageOfTotal >= 10) {
      requirements.push({
        approvalType: ApprovalType.SPECIAL_RESOLUTION,
        required: true,
        description: `Repurchase of ${percentageOfTotal}% requires 75% approval`,
        requiredPercentage: 75,
      })
    }

    // 3. Check solvency
    warnings.push('Ensure solvency test is completed before proceeding')

    return {
      action: GovernanceAction.REPURCHASE_SHARES,
      allowed: blockers.length === 0,
      requirements,
      blockers,
      warnings,
      notices,
      workflow: null,
      deadlines,
    }
  }

  /**
   * Evaluate merger/acquisition
   */
  private evaluateMergerAcquisition(
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    const requirements: PolicyRequirement[] = []
    const blockers: string[] = []
    const warnings: string[] = []
    const notices: PolicyNotice[] = []
    const deadlines: PolicyDeadline[] = []

    // M&A always requires special resolution
    requirements.push({
      approvalType: ApprovalType.BOARD_APPROVAL,
      required: true,
      description: 'M&A transactions require board approval',
    })
    requirements.push({
      approvalType: ApprovalType.SPECIAL_RESOLUTION,
      required: true,
      description: 'M&A transactions require 75% shareholder approval',
      requiredPercentage: 75,
    })
    requirements.push({
      approvalType: ApprovalType.UNANIMOUS_CONSENT,
      required: false,
      description: 'Some shareholders may have appraisal rights',
    })

    notices.push({
      type: 'GENERAL',
      recipient: 'shareholders',
      template: 'ma_meeting_notice',
      beforeActionDays: 45,
    })

    const workflow: WorkflowSpec = {
      type: 'M_AND_A',
      steps: [
        { order: 1, type: 'APPROVAL', actor: 'board', required: true, description: 'Board approval of transaction' },
        { order: 2, type: 'DOCUMENT', actor: 'system', required: true, description: 'Prepare information circular' },
        { order: 3, type: 'NOTICE', actor: 'system', required: true, description: 'Send shareholder notice', deadline: 45 },
        { order: 4, type: 'WAIT', actor: 'system', required: true, description: 'Wait notice period' },
        { order: 5, type: 'APPROVAL', actor: 'shareholders', required: true, description: 'Shareholder meeting and vote' },
      ],
      autoGenerateResolution: true,
      estimatedDuration: 60,
    }

    return {
      action: GovernanceAction.M_AND_A,
      allowed: blockers.length === 0,
      requirements,
      blockers,
      warnings,
      notices,
      workflow,
      deadlines,
    }
  }

  /**
   * Evaluate dividend distribution
   */
  private evaluateDividend(
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    const requirements: PolicyRequirement[] = []
    const blockers: string[] = []
    const warnings: string[] = []
    const notices: PolicyNotice[] = []

    // Dividends require board approval
    requirements.push({
      approvalType: ApprovalType.BOARD_APPROVAL,
      required: true,
      description: 'Dividend distributions require board approval',
    })

    warnings.push('Ensure sufficient retained earnings before declaring dividend')

    return {
      action: GovernanceAction.DISTRIBUTE_DIVIDEND,
      allowed: blockers.length === 0,
      requirements,
      blockers,
      warnings,
      notices,
      workflow: null,
      deadlines: [],
    }
  }

  /**
   * Fallback for unhandled actions
   */
  private evaluateGenericAction(
    action: GovernanceAction,
    params: Record<string, unknown>,
    context: CapTableContext
  ): PolicyEvaluation {
    return {
      action,
      allowed: true,
      requirements: [
        {
          approvalType: ApprovalType.BOARD_APPROVAL,
          required: true,
          description: 'This action requires board approval',
        },
      ],
      blockers: [],
      warnings: [],
      notices: [],
      workflow: null,
      deadlines: [],
    }
  }

  // ============================================================================
  // WORKFLOW GENERATORS
  // ============================================================================

  private generateIssuanceWorkflow(
    requirements: PolicyRequirement[],
    dilutionPercentage: number
  ): WorkflowSpec {
    const steps: WorkflowStep[] = [
      { order: 1, type: 'APPROVAL', actor: 'board', required: true, description: 'Board approval of issuance' },
    ]

    const specialResRequired = requirements.some(
      r => r.approvalType === ApprovalType.SPECIAL_RESOLUTION
    )

    if (specialResRequired) {
      steps.push(
        { order: 2, type: 'NOTICE', actor: 'system', required: true, description: 'Send shareholder meeting notice', deadline: 30 },
        { order: 3, type: 'WAIT', actor: 'system', required: true, description: 'Wait notice period' },
        { order: 4, type: 'APPROVAL', actor: 'shareholders', required: true, description: 'Special resolution vote' },
        { order: 5, type: 'DOCUMENT', actor: 'system', required: true, description: 'Generate share certificates' },
        { order: 6, type: 'DOCUMENT', actor: 'system', required: true, description: 'Update share register' }
      )
    } else {
      steps.push(
        { order: 2, type: 'DOCUMENT', actor: 'system', required: true, description: 'Generate subscription agreement' },
        { order: 3, type: 'DOCUMENT', actor: 'system', required: true, description: 'Generate share certificates' },
        { order: 4, type: 'DOCUMENT', actor: 'system', required: true, description: 'Update share register' }
      )
    }

    return {
      type: 'ISSUANCE',
      steps,
      autoGenerateResolution: specialResRequired,
      estimatedDuration: specialResRequired ? 45 : 10,
    }
  }

  private generateTransferWorkflow(
    requirements: PolicyRequirement[],
    hasROFR: boolean
  ): WorkflowSpec {
    const steps: WorkflowStep[] = [
      { order: 1, type: 'APPROVAL', actor: 'board', required: true, description: 'Board approval of transfer' },
    ]

    if (hasROFR) {
      steps.push(
        { order: 2, type: 'NOTICE', actor: 'system', required: true, description: 'Send ROFR notice to existing shareholders' },
        { order: 3, type: 'WAIT', actor: 'system', required: true, description: 'ROFR window', deadline: 30 },
        { order: 4, type: 'DOCUMENT', actor: 'system', required: true, description: 'Generate transfer agreement' },
        { order: 5, type: 'DOCUMENT', actor: 'system', required: true, description: 'Update share register' }
      )
    } else {
      steps.push(
        { order: 2, type: 'DOCUMENT', actor: 'system', required: true, description: 'Generate transfer agreement' },
        { order: 3, type: 'DOCUMENT', actor: 'system', required: true, description: 'Update share register' }
      )
    }

    return {
      type: 'TRANSFER',
      steps,
      autoGenerateResolution: requirements.some(r => r.approvalType === ApprovalType.SPECIAL_RESOLUTION),
      estimatedDuration: hasROFR ? 40 : 7,
    }
  }

  private generateBorrowingWorkflow(
    requirements: PolicyRequirement[],
    amount: number
  ): WorkflowSpec {
    const specialResRequired = requirements.some(
      r => r.approvalType === ApprovalType.SPECIAL_RESOLUTION
    )

    const steps: WorkflowStep[] = [
      { order: 1, type: 'APPROVAL', actor: 'board', required: true, description: 'Board approval of borrowing' },
    ]

    if (specialResRequired) {
      steps.push(
        { order: 2, type: 'NOTICE', actor: 'system', required: true, description: 'Send shareholder notice', deadline: 30 },
        { order: 3, type: 'WAIT', actor: 'system', required: true, description: 'Wait notice period' },
        { order: 4, type: 'APPROVAL', actor: 'shareholders', required: true, description: 'Special resolution vote' },
        { order: 5, type: 'DOCUMENT', actor: 'system', required: true, description: 'Execute loan documents' }
      )
    } else {
      steps.push(
        { order: 2, type: 'DOCUMENT', actor: 'system', required: true, description: 'Execute loan documents' }
      )
    }

    return {
      type: 'BORROWING',
      steps,
      autoGenerateResolution: specialResRequired,
      estimatedDuration: specialResRequired ? 45 : 5,
    }
  }
}

// ============================================================================
// FACTORY
// ============================================================================

/**
 * Get a singleton policy engine instance
 */
export function getPolicyEngine(): PolicyEngine {
  return new PolicyEngine()
}

/**
 * Convenience function to evaluate requirements
 */
export function evaluateAction(
  action: GovernanceAction,
  params: Record<string, unknown>,
  context: CapTableContext
): PolicyEvaluation {
  const engine = new PolicyEngine()
  return engine.evaluateRequirements(action, params, context)
}
