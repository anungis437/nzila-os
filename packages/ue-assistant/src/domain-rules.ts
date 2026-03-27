/**
 * @nzila/ue-assistant — Domain Behavior Rules (Phase 7)
 *
 * Defines domain-specific behavior for each intent type. Each domain
 * rule set specifies how the assistant should handle queries in that
 * domain, including required checks, guidance patterns, and disclaimers.
 */
import {
  IntentTypes,
  ToolNames,
  UEAssistantRoles,
  type IntentType,
  type ToolName,
  type UserContext,
  type KnowledgeCitation,
} from './types'

// ── Domain Rule ─────────────────────────────────────────────────────────────

export interface DomainAction {
  readonly type: 'check' | 'guide' | 'analyze' | 'escalate' | 'inform'
  readonly description: string
  readonly tool?: ToolName
  readonly disclaimer?: string
}

export interface DomainBehavior {
  readonly intent: IntentType
  readonly preChecks: readonly string[]
  readonly memberActions: readonly DomainAction[]
  readonly stewardActions: readonly DomainAction[]
  readonly adminActions: readonly DomainAction[]
  readonly requiredDisclaimers: readonly string[]
}

// ── Domain Rules ────────────────────────────────────────────────────────────

const DOMAIN_BEHAVIORS: Record<IntentType, DomainBehavior> = {
  [IntentTypes.GRIEVANCE]: {
    intent: IntentTypes.GRIEVANCE,
    preChecks: ['check_existing_case', 'verify_entitlement'],
    memberActions: [
      { type: 'check', description: 'Check if member has an existing open grievance' },
      { type: 'guide', description: 'Guide through grievance filing workflow', tool: ToolNames.OPEN_GRIEVANCE_FORM },
      { type: 'inform', description: 'Explain grievance process steps' },
    ],
    stewardActions: [
      { type: 'analyze', description: 'Analyze case details and history', tool: ToolNames.ANALYZE_CASE },
      { type: 'analyze', description: 'Map issues to contract clauses', tool: ToolNames.MAP_TO_CONTRACT_CLAUSES },
      { type: 'guide', description: 'Draft grievance document', tool: ToolNames.DRAFT_GRIEVANCE },
      { type: 'guide', description: 'Suggest next steps', tool: ToolNames.SUGGEST_NEXT_STEPS },
    ],
    adminActions: [
      { type: 'analyze', description: 'Review case dashboard', tool: ToolNames.CASE_DASHBOARD_INSIGHTS },
      { type: 'analyze', description: 'Analyze workload distribution', tool: ToolNames.WORKLOAD_ANALYSIS },
    ],
    requiredDisclaimers: [
      'This guidance does not constitute legal advice.',
      'Consult your steward or union representative for case-specific guidance.',
    ],
  },

  [IntentTypes.RIGHTS]: {
    intent: IntentTypes.RIGHTS,
    preChecks: ['verify_contract_access'],
    memberActions: [
      { type: 'inform', description: 'Cite relevant agreement/policy section' },
      { type: 'inform', description: 'Explain rights in plain language' },
    ],
    stewardActions: [
      { type: 'inform', description: 'Cite relevant agreement/policy section' },
      { type: 'analyze', description: 'Provide detailed rights analysis with citations' },
    ],
    adminActions: [
      { type: 'inform', description: 'Provide rights overview with policy context' },
    ],
    requiredDisclaimers: [
      'This is informational guidance based on the collective agreement.',
      'No definitive legal claims are made.',
    ],
  },

  [IntentTypes.CONTRACT]: {
    intent: IntentTypes.CONTRACT,
    preChecks: ['verify_contract_access'],
    memberActions: [
      { type: 'inform', description: 'Retrieve and explain clause in plain language', tool: ToolNames.EXPLAIN_AGREEMENT_SECTION },
    ],
    stewardActions: [
      { type: 'inform', description: 'Retrieve clause with full context', tool: ToolNames.EXPLAIN_AGREEMENT_SECTION },
      { type: 'analyze', description: 'Map to related clauses', tool: ToolNames.MAP_TO_CONTRACT_CLAUSES },
    ],
    adminActions: [
      { type: 'inform', description: 'Provide clause overview with interpretation guidance' },
    ],
    requiredDisclaimers: [
      'Always cite the source clause.',
      'This explanation is for informational purposes only.',
    ],
  },

  [IntentTypes.SAFETY]: {
    intent: IntentTypes.SAFETY,
    preChecks: ['assess_urgency'],
    memberActions: [
      { type: 'check', description: 'Assess if situation is urgent/emergency' },
      { type: 'escalate', description: 'If urgent: activate emergency protocol', tool: ToolNames.REPORT_SAFETY_ISSUE },
      { type: 'guide', description: 'If not urgent: guide through reporting workflow', tool: ToolNames.REPORT_SAFETY_ISSUE },
    ],
    stewardActions: [
      { type: 'check', description: 'Assess urgency and scope' },
      { type: 'escalate', description: 'If urgent: activate emergency protocol', tool: ToolNames.REPORT_SAFETY_ISSUE },
      { type: 'guide', description: 'Guide through safety reporting', tool: ToolNames.REPORT_SAFETY_ISSUE },
    ],
    adminActions: [
      { type: 'analyze', description: 'Review safety incident trends' },
      { type: 'escalate', description: 'Escalate to safety officer if needed' },
    ],
    requiredDisclaimers: [
      'If you are in immediate danger, call emergency services.',
    ],
  },

  [IntentTypes.BENEFITS]: {
    intent: IntentTypes.BENEFITS,
    preChecks: ['check_benefits_entitlement'],
    memberActions: [
      { type: 'inform', description: 'Provide benefits information' },
    ],
    stewardActions: [
      { type: 'inform', description: 'Provide detailed benefits guidance with citations' },
    ],
    adminActions: [
      { type: 'inform', description: 'Provide benefits overview' },
    ],
    requiredDisclaimers: [
      'Benefits information is provided for reference only.',
      'Contact your benefits administrator for enrollment or claims.',
    ],
  },

  [IntentTypes.VOTING]: {
    intent: IntentTypes.VOTING,
    preChecks: ['check_voting_module_active'],
    memberActions: [
      { type: 'guide', description: 'Guide to voting page', tool: ToolNames.NAVIGATE_TO_PAGE },
      { type: 'inform', description: 'Explain voting process' },
    ],
    stewardActions: [
      { type: 'inform', description: 'Provide voting status and details' },
    ],
    adminActions: [
      { type: 'analyze', description: 'Provide voting analytics and participation data' },
    ],
    requiredDisclaimers: [],
  },

  [IntentTypes.EDUCATION]: {
    intent: IntentTypes.EDUCATION,
    preChecks: [],
    memberActions: [
      { type: 'inform', description: 'Provide training/education information' },
      { type: 'guide', description: 'Navigate to training page', tool: ToolNames.NAVIGATE_TO_PAGE },
    ],
    stewardActions: [
      { type: 'inform', description: 'Provide training resources' },
    ],
    adminActions: [
      { type: 'inform', description: 'Provide education program overview' },
    ],
    requiredDisclaimers: [],
  },

  [IntentTypes.NAVIGATION]: {
    intent: IntentTypes.NAVIGATION,
    preChecks: [],
    memberActions: [
      { type: 'guide', description: 'Navigate to requested page', tool: ToolNames.NAVIGATE_TO_PAGE },
    ],
    stewardActions: [
      { type: 'guide', description: 'Navigate to requested page', tool: ToolNames.NAVIGATE_TO_PAGE },
    ],
    adminActions: [
      { type: 'guide', description: 'Navigate to requested page', tool: ToolNames.NAVIGATE_TO_PAGE },
    ],
    requiredDisclaimers: [],
  },

  [IntentTypes.CASE_ANALYSIS]: {
    intent: IntentTypes.CASE_ANALYSIS,
    preChecks: ['verify_case_access'],
    memberActions: [],
    stewardActions: [
      { type: 'analyze', description: 'Summarize case', tool: ToolNames.SUMMARIZE_CASE },
      { type: 'analyze', description: 'Analyze case details', tool: ToolNames.ANALYZE_CASE },
      { type: 'guide', description: 'Suggest next steps', tool: ToolNames.SUGGEST_NEXT_STEPS },
    ],
    adminActions: [
      { type: 'analyze', description: 'Dashboard insights', tool: ToolNames.CASE_DASHBOARD_INSIGHTS },
    ],
    requiredDisclaimers: [
      'Case analysis is AI-assisted and should be reviewed by qualified personnel.',
    ],
  },

  [IntentTypes.DRAFTING]: {
    intent: IntentTypes.DRAFTING,
    preChecks: ['verify_case_access'],
    memberActions: [],
    stewardActions: [
      { type: 'analyze', description: 'Draft grievance document', tool: ToolNames.DRAFT_GRIEVANCE },
    ],
    adminActions: [
      { type: 'analyze', description: 'Draft documents', tool: ToolNames.DRAFT_GRIEVANCE },
    ],
    requiredDisclaimers: [
      'All drafts must be reviewed and approved before submission.',
    ],
  },

  [IntentTypes.OVERSIGHT]: {
    intent: IntentTypes.OVERSIGHT,
    preChecks: ['verify_admin_access'],
    memberActions: [],
    stewardActions: [],
    adminActions: [
      { type: 'analyze', description: 'Generate dashboard insights', tool: ToolNames.CASE_DASHBOARD_INSIGHTS },
      { type: 'analyze', description: 'Analyze workload', tool: ToolNames.WORKLOAD_ANALYSIS },
      { type: 'analyze', description: 'Generate trend analysis', tool: ToolNames.TREND_ANALYSIS },
    ],
    requiredDisclaimers: [],
  },

  [IntentTypes.UNKNOWN]: {
    intent: IntentTypes.UNKNOWN,
    preChecks: [],
    memberActions: [],
    stewardActions: [],
    adminActions: [],
    requiredDisclaimers: [],
  },
}

// ── Public API ──────────────────────────────────────────────────────────────

export function getDomainBehavior(intent: IntentType): DomainBehavior {
  return DOMAIN_BEHAVIORS[intent]
}

export function getActionsForRole(
  intent: IntentType,
  ctx: UserContext,
): readonly DomainAction[] {
  const behavior = getDomainBehavior(intent)
  switch (ctx.userRole) {
    case UEAssistantRoles.MEMBER:
      return behavior.memberActions
    case UEAssistantRoles.STEWARD:
      return behavior.stewardActions
    case UEAssistantRoles.LOCAL_ADMIN:
    case UEAssistantRoles.PARENT_ADMIN:
      return behavior.adminActions
    default:
      return []
  }
}

export function getRequiredDisclaimers(intent: IntentType): readonly string[] {
  return getDomainBehavior(intent).requiredDisclaimers
}

export function getPreChecks(intent: IntentType): readonly string[] {
  return getDomainBehavior(intent).preChecks
}

/**
 * Check if an intent query contains safety urgency indicators.
 */
export function isSafetyUrgent(query: string): boolean {
  const urgentKeywords = [
    'emergency', 'immediate danger', 'life threatening',
    'injured', 'chemical spill', 'fire', 'collapse',
    'trapped', 'unconscious', 'not breathing',
  ]
  const lower = query.toLowerCase()
  return urgentKeywords.some((kw) => lower.includes(kw))
}

/**
 * Check if a query involves legal interpretation that should be escalated.
 */
export function requiresLegalEscalation(
  query: string,
  citations: readonly KnowledgeCitation[],
): boolean {
  const legalKeywords = [
    'legal interpretation', 'binding', 'arbitration ruling',
    'precedent setting', 'litigation', 'court order',
    'statutory', 'legislation',
  ]
  const lower = query.toLowerCase()
  const hasLegalKeywords = legalKeywords.some((kw) => lower.includes(kw))
  const hasNoCitations = citations.length === 0
  return hasLegalKeywords || (hasNoCitations && lower.includes('legal'))
}
