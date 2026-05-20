import type { DecisionRegistryEntry } from './types'

const decisionRegistry = new Map<string, DecisionRegistryEntry>()

export function registerDecisionType(entry: DecisionRegistryEntry): DecisionRegistryEntry {
  decisionRegistry.set(entry.type, entry)
  return entry
}

export function getDecisionType(type: string): DecisionRegistryEntry | undefined {
  return decisionRegistry.get(type)
}

export function listDecisionTypes(): DecisionRegistryEntry[] {
  return Array.from(decisionRegistry.values()).sort((left, right) => left.type.localeCompare(right.type))
}

export function clearDecisionRegistry() {
  decisionRegistry.clear()
}

/**
 * Decision types that MUST be registered for the platform to operate.
 * Verified at startup via `verifyDecisionRegistry()` to catch tree-shaking
 * regressions, import-order bugs, or accidental removals that would
 * otherwise surface only at request time as `UNREGISTERED_DECISION_TYPE`.
 */
export const REQUIRED_DECISION_TYPES: readonly string[] = [
  'union.grievance.intake.submitted',
  'union.case.escalated',
  'faircase.case.classified',
  'flow.quote.created',
  'flow.vendor.selected',
  'zonga.rights.validated',
  'zonga.payout.approved',
  'platform.workflow.authorized',
  'platform.org.entitlement.checked',
  'platform.governance.action.executed',
  'platform.workflow.executed',
] as const

export class DecisionRegistryStartupError extends Error {
  constructor(public readonly missing: readonly string[]) {
    super(`Decision registry is missing required types: ${missing.join(', ')}`)
    this.name = 'DecisionRegistryStartupError'
  }
}

/**
 * Throws if any required decision type is missing from the registry.
 * Call once during process bootstrap (server entrypoint, worker init, etc.).
 */
export function verifyDecisionRegistry(
  required: readonly string[] = REQUIRED_DECISION_TYPES,
): void {
  const missing = required.filter((type) => !decisionRegistry.has(type))
  if (missing.length > 0) {
    throw new DecisionRegistryStartupError(missing)
  }
}

/**
 * Initial policy-version allow-list for v1 registry entries.
 *
 * All in-tree call sites today (control-plane governance actions, NAR
 * tests, decision-intelligence tests, audit-pack verifier) use `1.0.0`.
 * Pinning here means a stray caller sending `'1.0.1'` or `'2026-05-01'`
 * is rejected with `POLICY_VERSION_NOT_ALLOWED` instead of silently
 * recorded with a drifting version. To roll a new policy version: add
 * it to this list (or to a per-entry override) — drop the old one only
 * after all callers migrate.
 */
const PINNED_V1: readonly string[] = ['1.0.0']

export const DEFAULT_DECISION_TYPES: DecisionRegistryEntry[] = [
  registerDecisionType({
    type: 'union.grievance.intake.submitted',
    domain: 'labour',
    resourceType: 'grievance',
    requiredAuthority: ['grievance:create'],
    requiredPolicy: 'labour.grievance.intake',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'legal_7_year',
    requiredInputFields: ['memberId', 'caseType', 'incidentDate', 'title'],
    narCompatible: true,
    proofRequired: true,
    enforcementLevel: 'block',
  }),
  registerDecisionType({
    type: 'union.case.escalated',
    domain: 'labour',
    resourceType: 'case',
    requiredAuthority: ['case:escalate'],
    requiredPolicy: 'labour.case.escalation',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'legal_7_year',
    requiredInputFields: ['caseId', 'reason'],
    narCompatible: true,
    proofRequired: true,
    enforcementLevel: 'block',
  }),
  registerDecisionType({
    type: 'faircase.case.classified',
    domain: 'legal',
    resourceType: 'case',
    requiredAuthority: ['case:classify'],
    requiredPolicy: 'legal.case.classification',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'legal_7_year',
    requiredInputFields: ['caseId', 'classification'],
    narCompatible: true,
    proofRequired: true,
    enforcementLevel: 'block',
  }),
  registerDecisionType({
    type: 'flow.quote.created',
    domain: 'commerce',
    resourceType: 'quote',
    requiredAuthority: ['quote:create'],
    requiredPolicy: 'commerce.quote.approval',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'business_7_year',
    requiredInputFields: ['title', 'customerId'],
    narCompatible: true,
    proofRequired: true,
    enforcementLevel: 'block',
  }),
  registerDecisionType({
    type: 'flow.vendor.selected',
    domain: 'commerce',
    resourceType: 'vendor-selection',
    requiredAuthority: ['vendor:select'],
    requiredPolicy: 'commerce.vendor.selection',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'business_7_year',
    requiredInputFields: ['vendorId', 'quoteId'],
    narCompatible: true,
    proofRequired: false,
    enforcementLevel: 'warn',
  }),
  registerDecisionType({
    type: 'zonga.rights.validated',
    domain: 'media',
    resourceType: 'rights',
    requiredAuthority: ['rights:validate'],
    requiredPolicy: 'media.rights.validation',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'rights_7_year',
    requiredInputFields: ['assetId'],
    narCompatible: true,
    proofRequired: false,
    enforcementLevel: 'warn',
  }),
  registerDecisionType({
    type: 'zonga.payout.approved',
    domain: 'media',
    resourceType: 'payout',
    requiredAuthority: ['payout:approve'],
    requiredPolicy: 'media.payout.approval',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'finance_7_year',
    requiredInputFields: ['creatorId'],
    narCompatible: true,
    proofRequired: true,
    enforcementLevel: 'block',
  }),
  registerDecisionType({
    type: 'platform.workflow.authorized',
    domain: 'platform',
    resourceType: 'workflow',
    requiredAuthority: ['workflow:authorize'],
    requiredPolicy: 'platform.workflow.authorization',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'platform_7_year',
    requiredInputFields: ['workflowId', 'requestId'],
    narCompatible: true,
    proofRequired: true,
    enforcementLevel: 'block',
  }),
  registerDecisionType({
    type: 'platform.org.entitlement.checked',
    domain: 'platform',
    resourceType: 'organization',
    requiredAuthority: ['org:entitlement:check'],
    requiredPolicy: 'platform.org.entitlement',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'platform_7_year',
    requiredInputFields: ['feature'],
    narCompatible: true,
    proofRequired: true,
    enforcementLevel: 'block',
  }),
  registerDecisionType({
    type: 'platform.governance.action.executed',
    domain: 'platform',
    resourceType: 'governance-action',
    requiredAuthority: ['governance:action:execute'],
    requiredPolicy: 'platform.governance.action',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'platform_7_year',
    requiredInputFields: ['operation', 'orgId'],
    narCompatible: true,
    proofRequired: true,
    enforcementLevel: 'block',
  }),
  registerDecisionType({
    type: 'platform.workflow.executed',
    domain: 'platform',
    resourceType: 'workflow-execution',
    requiredAuthority: ['workflow:execute'],
    requiredPolicy: 'platform.workflow.execution',
    allowedPolicyVersions: PINNED_V1,
    auditRequired: true,
    replaySupported: true,
    exportSupported: true,
    retentionClass: 'platform_7_year',
    requiredInputFields: ['workflowId', 'requestId'],
    narCompatible: true,
    proofRequired: true,
    enforcementLevel: 'block',
  }),
]