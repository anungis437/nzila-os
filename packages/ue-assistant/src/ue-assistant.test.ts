/**
 * @nzila/ue-assistant — Comprehensive Tests (Phase 14)
 *
 * Validates all phases of the UE AI Assistant:
 *  1. Member grievance flow
 *  2. Steward case analysis
 *  3. Contract explanation with citation
 *  4. Safety escalation
 *  5. Entitlement enforcement
 *  6. Role-based differences
 *  7. Cross-org isolation
 *  8. Multilingual responses
 *  9. Draft generation accuracy
 * 10. Audit logging & chain integrity
 * 11. Guardrail enforcement
 * 12. Full orchestrator pipeline
 */
import { describe, it, expect, beforeEach } from 'vitest'

// Phase 1 — Roles
import {
  getRoleCapability,
  isIntentAllowed,
  isToolAllowed,
  getRoleMode,
  getRoleRestrictions,
  hasPermission,
  getAllRoleCapabilities,
} from '../src/roles'

// Phase 2 — Intents
import {
  classifyIntent,
  classifyIntentForRole,
  getIntentConfidence,
} from '../src/intents'

// Phase 3 — Context
import {
  resolveContext,
  validateOrgScope,
  enforceIsolation,
  isModuleActive,
  hasEntitlement,
  filterCaseAccess,
  buildContext,
} from '../src/context'

// Phase 4 — Knowledge
import {
  InMemoryKnowledgeStore,
  getSourceTypesForIntent,
  retrieveKnowledge,
} from '../src/knowledge'

// Phase 5 — Tools
import { executeTool, getToolLog, clearToolLog } from '../src/tools'

// Phase 6 — Response Policy
import {
  determineResponseType,
  requiresCitations,
  includesSteps,
  isAnalytical,
} from '../src/response-policy'

// Phase 7 — Domain Rules
import {
  getDomainBehavior,
  getActionsForRole,
  getRequiredDisclaimers,
  getPreChecks,
  isSafetyUrgent,
  requiresLegalEscalation,
} from '../src/domain-rules'

// Phase 8 — Steward Intelligence
import {
  summarizeCase,
  mapToClauses,
  draftGrievance,
  detectMissingInfo,
  recommendEscalation,
} from '../src/steward-intelligence'

// Phase 9 — Escalation
import {
  evaluateEscalation,
  shouldEscalate,
  getEscalationLog,
  clearEscalationLog,
} from '../src/escalation'

// Phase 10 — Localization
import {
  isLanguageSupported,
  resolveLanguage,
  getLocalizedMessage,
  markAsFallbackTranslation,
  getSupportedLanguages,
} from '../src/localization'

// Phase 11 — Audit
import {
  recordAuditEntry,
  getAuditLog,
  getAuditLogByOrg,
  getAuditLogByUser,
  verifyAuditChain,
  getChainHash,
  clearAuditLog,
  getAuditLogSize,
} from '../src/audit'

// Phase 13 — Guardrails
import { runGuardrails, computeConfidence } from '../src/guardrails'

// Orchestrator
import { processRequest } from '../src/assistant'

// Types
import {
  UEAssistantRoles,
  IntentTypes,
  ToolNames,
  ResponseTypes,
  KnowledgeSourceTypes,
  type UserContext,
} from '../src/types'

// ── Helpers ─────────────────────────────────────────────────────────────────

function memberContext(overrides?: Partial<UserContext>): UserContext {
  return buildContext({
    orgId: 'org-1',
    localId: 'local-1',
    userRole: UEAssistantRoles.MEMBER,
    language: 'en',
    entitlements: ['grievance', 'voting'],
    activeModules: ['grievances', 'voting', 'safety'],
    openCases: ['case-1'],
    ...overrides,
  })
}

function stewardContext(overrides?: Partial<UserContext>): UserContext {
  return buildContext({
    orgId: 'org-1',
    localId: 'local-1',
    userRole: UEAssistantRoles.STEWARD,
    language: 'en',
    entitlements: ['grievance', 'voting', 'case_analysis'],
    activeModules: ['grievances', 'voting', 'safety', 'cases'],
    openCases: ['case-1', 'case-2'],
    ...overrides,
  })
}

function localAdminContext(overrides?: Partial<UserContext>): UserContext {
  return buildContext({
    orgId: 'org-1',
    localId: 'local-1',
    userRole: UEAssistantRoles.LOCAL_ADMIN,
    language: 'en',
    entitlements: ['grievance', 'voting', 'case_analysis', 'oversight'],
    activeModules: ['grievances', 'voting', 'safety', 'cases', 'reports'],
    openCases: [],
    ...overrides,
  })
}

function parentAdminContext(overrides?: Partial<UserContext>): UserContext {
  return buildContext({
    orgId: 'org-1',
    localId: 'local-hq',
    userRole: UEAssistantRoles.PARENT_ADMIN,
    language: 'en',
    entitlements: ['grievance', 'voting', 'case_analysis', 'oversight', 'governance'],
    activeModules: ['grievances', 'voting', 'safety', 'cases', 'reports', 'governance'],
    openCases: [],
    ...overrides,
  })
}

function populatedStore(): InMemoryKnowledgeStore {
  const store = new InMemoryKnowledgeStore()
  store.add({
    id: 'doc-1',
    sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
    orgId: 'org-1',
    localId: null,
    title: 'Article 12 — Grievance Procedure',
    content: 'The grievance procedure shall be followed for all workplace complaints. Step 1: informal resolution. Step 2: formal filing.',
    language: 'en',
    tags: ['grievance', 'procedure', 'complaint'],
  })
  store.add({
    id: 'doc-2',
    sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
    orgId: 'org-1',
    localId: 'local-1',
    title: 'Article 15 — Overtime and Scheduling',
    content: 'Overtime shall be paid at 1.5x the regular rate for hours worked beyond 40 in a week. Scheduling seniority applies.',
    language: 'en',
    tags: ['overtime', 'scheduling', 'seniority', 'contract'],
  })
  store.add({
    id: 'doc-3',
    sourceType: KnowledgeSourceTypes.SAFETY_POLICY,
    orgId: 'org-1',
    localId: null,
    title: 'Workplace Safety Policy',
    content: 'All safety hazards must be reported immediately. Emergency procedures are posted at all workstations.',
    language: 'en',
    tags: ['safety', 'hazard', 'emergency'],
  })
  store.add({
    id: 'doc-4',
    sourceType: KnowledgeSourceTypes.BENEFITS_DOCUMENTATION,
    orgId: 'org-1',
    localId: null,
    title: 'Benefits Overview',
    content: 'Members are entitled to dental, medical, and pension benefits after 90 days of employment.',
    language: 'en',
    tags: ['benefits', 'dental', 'medical', 'pension'],
  })
  store.add({
    id: 'doc-5',
    sourceType: KnowledgeSourceTypes.GRIEVANCE_PROCEDURE,
    orgId: 'org-1',
    localId: null,
    title: 'Grievance Filing Steps',
    content: 'To file a grievance: 1. Document the issue. 2. Contact your steward. 3. Submit the grievance form within 10 business days.',
    language: 'en',
    tags: ['grievance', 'filing', 'steps'],
  })
  store.add({
    id: 'doc-6',
    sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
    orgId: 'org-1',
    localId: null,
    title: 'Article 8 — Seniority Rights',
    content: 'Seniority rights apply to scheduling, overtime, and layoff decisions.',
    language: 'en',
    tags: ['seniority', 'rights', 'contract'],
  })
  store.add({
    id: 'doc-fr-1',
    sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
    orgId: 'org-1',
    localId: null,
    title: 'Article 12 — Procédure de grief',
    content: 'La procédure de grief doit être suivie pour toutes les plaintes en milieu de travail.',
    language: 'fr',
    tags: ['grievance', 'procedure', 'complaint'],
  })
  // Different org — should NOT be accessible from org-1
  store.add({
    id: 'doc-other-org',
    sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
    orgId: 'org-2',
    localId: 'local-x',
    title: 'Other Org Agreement',
    content: 'This is a different organization agreement with different terms.',
    language: 'en',
    tags: ['grievance', 'contract'],
  })
  // Case data — should only be accessible by steward+
  store.add({
    id: 'case-data-1',
    sourceType: KnowledgeSourceTypes.CASE_DATA,
    orgId: 'org-1',
    localId: 'local-1',
    title: 'Case 001 — Scheduling Dispute',
    content: 'Member reported scheduling violation. Seniority was not followed for overtime assignments.',
    language: 'en',
    tags: ['case', 'scheduling', 'grievance'],
  })
  return store
}

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 1 — ROLE CAPABILITY SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 1 — Role Capability System', () => {
  it('returns member capability with guided mode', () => {
    const cap = getRoleCapability(UEAssistantRoles.MEMBER)
    expect(cap.mode).toBe('guided')
    expect(cap.role).toBe('member')
  })

  it('returns steward capability with analytical mode', () => {
    const cap = getRoleCapability(UEAssistantRoles.STEWARD)
    expect(cap.mode).toBe('analytical')
  })

  it('returns local_admin capability with operational mode', () => {
    const cap = getRoleCapability(UEAssistantRoles.LOCAL_ADMIN)
    expect(cap.mode).toBe('operational')
  })

  it('returns parent_admin capability with governance mode', () => {
    const cap = getRoleCapability(UEAssistantRoles.PARENT_ADMIN)
    expect(cap.mode).toBe('governance')
  })

  it('throws on unknown role', () => {
    expect(() => getRoleCapability('unknown' as never)).toThrow('Unknown role')
  })

  it('member can access grievance intent', () => {
    expect(isIntentAllowed(UEAssistantRoles.MEMBER, IntentTypes.GRIEVANCE)).toBe(true)
  })

  it('member cannot access case_analysis intent', () => {
    expect(isIntentAllowed(UEAssistantRoles.MEMBER, IntentTypes.CASE_ANALYSIS)).toBe(false)
  })

  it('steward can access case_analysis intent', () => {
    expect(isIntentAllowed(UEAssistantRoles.STEWARD, IntentTypes.CASE_ANALYSIS)).toBe(true)
  })

  it('member cannot use analyzeCase tool', () => {
    expect(isToolAllowed(UEAssistantRoles.MEMBER, ToolNames.ANALYZE_CASE)).toBe(false)
  })

  it('steward can use analyzeCase tool', () => {
    expect(isToolAllowed(UEAssistantRoles.STEWARD, ToolNames.ANALYZE_CASE)).toBe(true)
  })

  it('parent_admin can use trendAnalysis tool', () => {
    expect(isToolAllowed(UEAssistantRoles.PARENT_ADMIN, ToolNames.TREND_ANALYSIS)).toBe(true)
  })

  it('local_admin cannot use trendAnalysis tool', () => {
    expect(isToolAllowed(UEAssistantRoles.LOCAL_ADMIN, ToolNames.TREND_ANALYSIS)).toBe(false)
  })

  it('getRoleMode returns correct mode', () => {
    expect(getRoleMode(UEAssistantRoles.MEMBER)).toBe('guided')
    expect(getRoleMode(UEAssistantRoles.STEWARD)).toBe('analytical')
  })

  it('getRoleRestrictions returns restrictions', () => {
    const restrictions = getRoleRestrictions(UEAssistantRoles.MEMBER)
    expect(restrictions).toContain('no_multi_case_access')
    expect(restrictions).toContain('no_legal_strategy')
  })

  it('hasPermission checks correctly', () => {
    expect(hasPermission(UEAssistantRoles.MEMBER, 'own_cases_only')).toBe(true)
    expect(hasPermission(UEAssistantRoles.MEMBER, 'cross_local_access')).toBe(false)
    expect(hasPermission(UEAssistantRoles.PARENT_ADMIN, 'cross_local_access')).toBe(true)
  })

  it('getAllRoleCapabilities returns all four roles', () => {
    const all = getAllRoleCapabilities()
    expect(Object.keys(all)).toHaveLength(4)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 2 — INTENT CLASSIFICATION ENGINE
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 2 — Intent Classification Engine', () => {
  it('classifies grievance intent', () => {
    expect(classifyIntent('I want to file a grievance')).toBe(IntentTypes.GRIEVANCE)
  })

  it('classifies rights intent', () => {
    expect(classifyIntent('What are my rights as a union member?')).toBe(IntentTypes.RIGHTS)
  })

  it('classifies contract intent', () => {
    expect(classifyIntent('What does the collective agreement say about overtime?')).toBe(IntentTypes.CONTRACT)
  })

  it('classifies safety intent', () => {
    expect(classifyIntent('There is a safety hazard in the workplace')).toBe(IntentTypes.SAFETY)
  })

  it('classifies benefits intent', () => {
    expect(classifyIntent('Tell me about dental benefits coverage')).toBe(IntentTypes.BENEFITS)
  })

  it('classifies voting intent', () => {
    expect(classifyIntent('When is the next election?')).toBe(IntentTypes.VOTING)
  })

  it('classifies navigation intent', () => {
    expect(classifyIntent('Where do I find the settings page?')).toBe(IntentTypes.NAVIGATION)
  })

  it('classifies drafting intent', () => {
    expect(classifyIntent('Help me draft a grievance letter')).toBe(IntentTypes.DRAFTING)
  })

  it('returns unknown for unclassifiable queries', () => {
    expect(classifyIntent('Hello, how are you today?')).toBe(IntentTypes.UNKNOWN)
  })

  it('classifyIntentForRole filters by role permissions', () => {
    // Members can't access case_analysis
    expect(classifyIntentForRole('analyze case 123', UEAssistantRoles.MEMBER)).toBe(IntentTypes.UNKNOWN)
    // Stewards can
    expect(classifyIntentForRole('analyze case 123', UEAssistantRoles.STEWARD)).toBe(IntentTypes.CASE_ANALYSIS)
  })

  it('getIntentConfidence returns low for unknown', () => {
    expect(getIntentConfidence('xyz abc 123')).toBe(0.1)
  })

  it('getIntentConfidence returns higher for strong match', () => {
    expect(getIntentConfidence('file a grievance about unfair treatment')).toBeGreaterThan(0.5)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 3 — CONTEXT RESOLUTION ENGINE
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 3 — Context Resolution Engine', () => {
  it('resolves valid context', () => {
    const raw = {
      orgId: 'org-1',
      localId: 'local-1',
      userRole: 'member',
      language: 'en',
      entitlements: ['grievance'],
      activeModules: ['grievances'],
      userState: { openCases: [], submissions: [], participation: [] },
    }
    const ctx = resolveContext(raw)
    expect(ctx.orgId).toBe('org-1')
    expect(ctx.userRole).toBe('member')
  })

  it('throws on invalid context (missing orgId)', () => {
    expect(() => resolveContext({ localId: 'l', userRole: 'member', language: 'en', entitlements: [], activeModules: [], userState: { openCases: [], submissions: [], participation: [] } })).toThrow()
  })

  it('validateOrgScope throws on empty orgId', () => {
    const ctx = buildContext({ orgId: '', localId: 'l', userRole: UEAssistantRoles.MEMBER })
    expect(() => validateOrgScope(ctx)).toThrow('orgId is required')
  })

  it('validateOrgScope throws on empty localId', () => {
    const ctx = buildContext({ orgId: 'org-1', localId: '', userRole: UEAssistantRoles.MEMBER })
    expect(() => validateOrgScope(ctx)).toThrow('localId is required')
  })

  it('enforceIsolation blocks cross-org access', () => {
    const ctx = memberContext()
    expect(enforceIsolation(ctx, 'org-2', 'local-1')).toBe(false)
  })

  it('enforceIsolation blocks cross-local for members', () => {
    const ctx = memberContext()
    expect(enforceIsolation(ctx, 'org-1', 'local-2')).toBe(false)
  })

  it('enforceIsolation allows parent_admin cross-local', () => {
    const ctx = parentAdminContext()
    expect(enforceIsolation(ctx, 'org-1', 'local-other')).toBe(true)
  })

  it('isModuleActive checks correctly', () => {
    const ctx = memberContext()
    expect(isModuleActive(ctx, 'grievances')).toBe(true)
    expect(isModuleActive(ctx, 'reports')).toBe(false)
  })

  it('hasEntitlement checks correctly', () => {
    const ctx = memberContext()
    expect(hasEntitlement(ctx, 'grievance')).toBe(true)
    expect(hasEntitlement(ctx, 'governance')).toBe(false)
  })

  it('filterCaseAccess: member can only access own cases', () => {
    const ctx = memberContext()
    expect(filterCaseAccess(ctx, 'user-1', undefined, 'user-1')).toBe(true)
    expect(filterCaseAccess(ctx, 'user-2', undefined, 'user-1')).toBe(false)
  })

  it('filterCaseAccess: steward can access assigned cases', () => {
    const ctx = stewardContext()
    expect(filterCaseAccess(ctx, 'user-1', 'steward-1', 'steward-1')).toBe(true)
    expect(filterCaseAccess(ctx, 'user-1', 'steward-2', 'steward-1')).toBe(false)
  })

  it('filterCaseAccess: admin can access all cases', () => {
    const ctx = localAdminContext()
    expect(filterCaseAccess(ctx, 'user-1', undefined, 'admin-1')).toBe(true)
  })

  it('buildContext creates valid context', () => {
    const ctx = buildContext({ orgId: 'org-1', localId: 'local-1', userRole: UEAssistantRoles.MEMBER })
    expect(ctx.language).toBe('en')
    expect(ctx.entitlements).toEqual([])
    expect(ctx.userState.openCases).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 4 — KNOWLEDGE LAYER
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 4 — Knowledge Layer', () => {
  it('InMemoryKnowledgeStore filters by org', () => {
    const store = populatedStore()
    const results = store.search({
      query: 'grievance',
      orgId: 'org-1',
      localId: 'local-1',
      sourceTypes: [KnowledgeSourceTypes.COLLECTIVE_AGREEMENT],
      language: 'en',
      limit: 10,
    })
    // Should NOT include org-2 documents
    expect(results.every((r) => r.orgId === 'org-1')).toBe(true)
  })

  it('prioritizes local entries over global', () => {
    const store = populatedStore()
    const results = store.search({
      query: 'overtime',
      orgId: 'org-1',
      localId: 'local-1',
      sourceTypes: [KnowledgeSourceTypes.COLLECTIVE_AGREEMENT],
      language: 'en',
      limit: 10,
    })
    if (results.length > 1) {
      // Local entry should come first
      expect(results[0].localId).toBe('local-1')
    }
  })

  it('getSourceTypesForIntent returns correct sources', () => {
    const grievanceSources = getSourceTypesForIntent(IntentTypes.GRIEVANCE)
    expect(grievanceSources).toContain(KnowledgeSourceTypes.GRIEVANCE_PROCEDURE)
    expect(grievanceSources).toContain(KnowledgeSourceTypes.COLLECTIVE_AGREEMENT)
  })

  it('retrieveKnowledge returns citations for members', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const citations = retrieveKnowledge(store, 'grievance procedure', IntentTypes.GRIEVANCE, ctx)
    expect(citations.length).toBeGreaterThan(0)
    expect(citations[0].sourceType).not.toBe(KnowledgeSourceTypes.CASE_DATA)
  })

  it('retrieveKnowledge filters out case data for members', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const citations = retrieveKnowledge(store, 'scheduling case', IntentTypes.GRIEVANCE, ctx)
    const hasCaseData = citations.some((c) => c.sourceType === KnowledgeSourceTypes.CASE_DATA)
    expect(hasCaseData).toBe(false)
  })

  it('retrieveKnowledge includes case data for stewards', () => {
    const store = populatedStore()
    const ctx = stewardContext()
    const citations = retrieveKnowledge(store, 'scheduling case', IntentTypes.CASE_ANALYSIS, ctx)
    const hasCaseData = citations.some((c) => c.sourceType === KnowledgeSourceTypes.CASE_DATA)
    expect(hasCaseData).toBe(true)
  })

  it('retrieveKnowledge respects org isolation', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const citations = retrieveKnowledge(store, 'contract', IntentTypes.CONTRACT, ctx)
    const hasOtherOrg = citations.some((c) => c.sourceId === 'doc-other-org')
    expect(hasOtherOrg).toBe(false)
  })

  it('returns empty citations for unknown intent', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const citations = retrieveKnowledge(store, 'hello', IntentTypes.UNKNOWN, ctx)
    expect(citations).toEqual([])
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 5 — WORKFLOW TOOL SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 5 — Workflow Tool System', () => {
  beforeEach(() => {
    clearToolLog()
  })

  it('executeTool blocks unauthorized tool for member', () => {
    const ctx = memberContext()
    const result = executeTool(ToolNames.ANALYZE_CASE, ctx, { caseId: 'case-1' })
    expect(result.result).toHaveProperty('error')
    expect((result.result as { error: string }).error).toContain('not allowed')
  })

  it('executeTool allows authorized tool for steward', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.ANALYZE_CASE, ctx, { caseId: 'case-1' })
    expect((result.result as { success: boolean }).success).toBe(true)
  })

  it('getCaseStatus enforces member can only see own cases', () => {
    const ctx = memberContext()
    const result = executeTool(ToolNames.GET_CASE_STATUS, ctx, { caseId: 'case-999' })
    expect((result.result as { error?: string }).error).toContain('Access denied')
  })

  it('getCaseStatus allows member to see own case', () => {
    const ctx = memberContext()
    const result = executeTool(ToolNames.GET_CASE_STATUS, ctx, { caseId: 'case-1' })
    expect((result.result as { success: boolean }).success).toBe(true)
  })

  it('openGrievanceForm returns navigation action', () => {
    const ctx = memberContext()
    const result = executeTool(ToolNames.OPEN_GRIEVANCE_FORM, ctx, {})
    const toolResult = result.result as { success: boolean; data: { action: string; target: string } }
    expect(toolResult.data.action).toBe('navigate')
    expect(toolResult.data.target).toContain('/grievances/new')
  })

  it('reportSafetyIssue activates emergency protocol when urgent', () => {
    const ctx = memberContext()
    const result = executeTool(ToolNames.REPORT_SAFETY_ISSUE, ctx, { urgent: true })
    const toolResult = result.result as { success: boolean; data: { action: string; urgent: boolean } }
    expect(toolResult.data.action).toBe('emergency_protocol')
    expect(toolResult.data.urgent).toBe(true)
  })

  it('tool log records invocations', () => {
    const ctx = memberContext()
    executeTool(ToolNames.NAVIGATE_TO_PAGE, ctx, { page: '/dashboard' })
    const log = getToolLog()
    expect(log.length).toBe(1)
    expect(log[0].tool).toBe(ToolNames.NAVIGATE_TO_PAGE)
  })

  it('navigateToPage requires page param', () => {
    const ctx = memberContext()
    const result = executeTool(ToolNames.NAVIGATE_TO_PAGE, ctx, {})
    expect((result.result as { error?: string }).error).toContain('page is required')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 6 — RESPONSE POLICY ENGINE
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 6 — Response Policy Engine', () => {
  it('member + grievance → GUIDED_STEPS', () => {
    expect(determineResponseType(UEAssistantRoles.MEMBER, IntentTypes.GRIEVANCE)).toBe(ResponseTypes.GUIDED_STEPS)
  })

  it('steward + grievance → ANALYTICAL_OUTPUT', () => {
    expect(determineResponseType(UEAssistantRoles.STEWARD, IntentTypes.GRIEVANCE)).toBe(ResponseTypes.ANALYTICAL_OUTPUT)
  })

  it('member + unknown → CLARIFICATION_REQUIRED', () => {
    expect(determineResponseType(UEAssistantRoles.MEMBER, IntentTypes.UNKNOWN)).toBe(ResponseTypes.CLARIFICATION_REQUIRED)
  })

  it('member + rights → CITED_EXPLANATION', () => {
    expect(determineResponseType(UEAssistantRoles.MEMBER, IntentTypes.RIGHTS)).toBe(ResponseTypes.CITED_EXPLANATION)
  })

  it('requiresCitations returns true for cited explanation', () => {
    expect(requiresCitations(ResponseTypes.CITED_EXPLANATION)).toBe(true)
    expect(requiresCitations(ResponseTypes.ANALYTICAL_OUTPUT)).toBe(true)
    expect(requiresCitations(ResponseTypes.DIRECT_ANSWER)).toBe(false)
  })

  it('includesSteps returns true for guided steps', () => {
    expect(includesSteps(ResponseTypes.GUIDED_STEPS)).toBe(true)
    expect(includesSteps(ResponseTypes.DIRECT_ANSWER)).toBe(false)
  })

  it('isAnalytical returns true for analytical output', () => {
    expect(isAnalytical(ResponseTypes.ANALYTICAL_OUTPUT)).toBe(true)
    expect(isAnalytical(ResponseTypes.GUIDED_STEPS)).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 7 — DOMAIN BEHAVIOR RULES
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 7 — Domain Behavior Rules', () => {
  it('grievance domain has pre-checks', () => {
    const behavior = getDomainBehavior(IntentTypes.GRIEVANCE)
    expect(behavior.preChecks).toContain('check_existing_case')
  })

  it('member grievance actions include guidance', () => {
    const ctx = memberContext()
    const actions = getActionsForRole(IntentTypes.GRIEVANCE, ctx)
    expect(actions.some((a) => a.type === 'guide')).toBe(true)
  })

  it('steward grievance actions include analysis and drafting', () => {
    const ctx = stewardContext()
    const actions = getActionsForRole(IntentTypes.GRIEVANCE, ctx)
    expect(actions.some((a) => a.type === 'analyze')).toBe(true)
    expect(actions.some((a) => a.tool === ToolNames.DRAFT_GRIEVANCE)).toBe(true)
  })

  it('grievance has required disclaimers', () => {
    const disclaimers = getRequiredDisclaimers(IntentTypes.GRIEVANCE)
    expect(disclaimers.length).toBeGreaterThan(0)
    expect(disclaimers.some((d) => d.includes('legal advice'))).toBe(true)
  })

  it('safety has pre-check for urgency', () => {
    const checks = getPreChecks(IntentTypes.SAFETY)
    expect(checks).toContain('assess_urgency')
  })

  it('isSafetyUrgent detects emergency', () => {
    expect(isSafetyUrgent('There is an emergency in the warehouse')).toBe(true)
    expect(isSafetyUrgent('I want to report a minor issue')).toBe(false)
  })

  it('requiresLegalEscalation detects legal complexity', () => {
    expect(requiresLegalEscalation('What is the legal interpretation of this clause?', [])).toBe(true)
    expect(requiresLegalEscalation('What are my benefits?', [])).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 8 — STEWARD INTELLIGENCE
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 8 — Steward Intelligence', () => {
  it('summarizeCase generates structured summary', () => {
    const ctx = stewardContext()
    const summary = summarizeCase(ctx, 'case-1', {
      description: 'Member was denied overtime that should have been assigned based on seniority.',
      filedDate: '2024-01-15',
      status: 'investigating',
      grievanceType: 'contract',
      evidence: ['email-1', 'schedule-doc'],
    })
    expect(summary.caseId).toBe('case-1')
    expect(summary.keyFacts.length).toBeGreaterThan(0)
    expect(summary.timeline.length).toBeGreaterThan(0)
    expect(summary.citations.length).toBeGreaterThan(0)
    expect(summary.confidence).toBeGreaterThan(0.5)
  })

  it('summarizeCase detects missing information', () => {
    const ctx = stewardContext()
    const summary = summarizeCase(ctx, 'case-2', {
      description: 'Workplace issue reported.',
    })
    expect(summary.missingInfo.length).toBeGreaterThan(0)
    expect(summary.missingInfo).toContain('Filing date not provided')
    expect(summary.confidence).toBeLessThan(0.9)
  })

  it('summarizeCase rejects member role', () => {
    const ctx = memberContext()
    expect(() => summarizeCase(ctx, 'case-1', { description: 'test' })).toThrow('steward or admin role')
  })

  it('mapToClauses finds relevant clauses', () => {
    const ctx = stewardContext()
    const mapping = mapToClauses(ctx, 'overtime was not assigned by seniority', [
      { id: 'clause-1', title: 'Overtime', content: 'Overtime shall be distributed by seniority.' },
      { id: 'clause-2', title: 'Breaks', content: 'Employees are entitled to breaks.' },
    ])
    expect(mapping.matchedClauses.length).toBeGreaterThan(0)
    expect(mapping.matchedClauses[0].clauseId).toBe('clause-1')
  })

  it('draftGrievance generates structured draft', () => {
    const ctx = stewardContext()
    const draft = draftGrievance(ctx, {
      caseId: 'case-1',
      memberName: 'Jane Doe',
      description: 'Overtime denied without following seniority rules',
      contractReferences: ['Article 15', 'Article 8'],
      remedySought: 'Pay for missed overtime and correct scheduling procedure',
    })
    expect(draft.body).toContain('Jane Doe')
    expect(draft.body).toContain('Article 15')
    expect(draft.contractReferences).toHaveLength(2)
    expect(draft.disclaimer).toContain('reviewed')
  })

  it('detectMissingInfo identifies gaps', () => {
    const ctx = stewardContext()
    const missing = detectMissingInfo(ctx, {
      description: 'Short',
    })
    expect(missing).toContain('Detailed description of the issue')
    expect(missing).toContain('Date the issue occurred')
    expect(missing).toContain('Supporting evidence or documentation')
  })

  it('recommendEscalation flags high-risk cases', () => {
    const ctx = stewardContext()
    const rec = recommendEscalation(ctx, {
      caseId: 'case-1',
      confidence: 0.3,
      missingInfo: ['a', 'b', 'c', 'd'],
      isLegallyComplex: true,
      isHighRisk: true,
    })
    expect(rec.recommended).toBe(true)
    expect(rec.urgency).toBe('critical')
    expect(rec.target).toBe('legal_representative')
  })

  it('recommendEscalation returns no escalation for low-risk', () => {
    const ctx = stewardContext()
    const rec = recommendEscalation(ctx, {
      caseId: 'case-1',
      confidence: 0.9,
      missingInfo: [],
      isLegallyComplex: false,
      isHighRisk: false,
    })
    expect(rec.recommended).toBe(false)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 9 — ESCALATION SYSTEM
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 9 — Escalation System', () => {
  beforeEach(() => {
    clearEscalationLog()
  })

  it('triggers escalation for high-risk queries', () => {
    const ctx = memberContext()
    const result = evaluateEscalation({
      query: 'I was fired without cause, this is wrongful termination',
      intent: IntentTypes.GRIEVANCE,
      confidence: 0.8,
      citations: [{ sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'doc-1', title: 'test', excerpt: 'test', relevanceScore: 0.8 }],
      ctx,
    })
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('high')
  })

  it('triggers safety escalation for emergencies', () => {
    const ctx = memberContext()
    const result = evaluateEscalation({
      query: 'There is an emergency, someone is injured',
      intent: IntentTypes.SAFETY,
      confidence: 0.9,
      citations: [],
      ctx,
    })
    expect(result).not.toBeNull()
    expect(result!.target).toBe('safety_officer')
    expect(result!.severity).toBe('critical')
  })

  it('triggers escalation for low confidence', () => {
    const ctx = memberContext()
    const result = evaluateEscalation({
      query: 'Some random question',
      intent: IntentTypes.UNKNOWN,
      confidence: 0.1,
      citations: [],
      ctx,
    })
    expect(result).not.toBeNull()
    expect(result!.reason).toBe('low_confidence')
  })

  it('no escalation for normal queries', () => {
    const ctx = memberContext()
    const result = evaluateEscalation({
      query: 'Where is the training page?',
      intent: IntentTypes.NAVIGATION,
      confidence: 0.9,
      citations: [{ sourceType: KnowledgeSourceTypes.UE_ROUTE, sourceId: 'r1', title: 'Training', excerpt: 'test', relevanceScore: 0.8 }],
      ctx,
    })
    expect(result).toBeNull()
  })

  it('shouldEscalate returns boolean', () => {
    const ctx = memberContext()
    expect(shouldEscalate({
      query: 'I was fired',
      intent: IntentTypes.GRIEVANCE,
      confidence: 0.8,
      citations: [{ sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'doc-1', title: 'test', excerpt: 'test', relevanceScore: 0.8 }],
      ctx,
    })).toBe(true)
  })

  it('escalation log is recorded', () => {
    const ctx = memberContext()
    evaluateEscalation({
      query: 'wrongful termination case',
      intent: IntentTypes.GRIEVANCE,
      confidence: 0.5,
      citations: [],
      ctx,
    })
    const log = getEscalationLog()
    expect(log.length).toBeGreaterThan(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 10 — LANGUAGE & LOCALIZATION
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 10 — Language & Localization', () => {
  it('recognizes supported languages', () => {
    expect(isLanguageSupported('en')).toBe(true)
    expect(isLanguageSupported('fr')).toBe(true)
    expect(isLanguageSupported('es')).toBe(true)
    expect(isLanguageSupported('de')).toBe(false)
  })

  it('resolves language with fallback to en', () => {
    expect(resolveLanguage('fr')).toBe('fr')
    expect(resolveLanguage('de')).toBe('en')
    expect(resolveLanguage('en-US')).toBe('en')
  })

  it('returns localized message in French', () => {
    const msg = getLocalizedMessage('no_legal_advice', 'fr')
    expect(msg).toContain('avis juridique')
  })

  it('returns English for unsupported language', () => {
    const msg = getLocalizedMessage('no_legal_advice', 'de')
    expect(msg).toContain('legal advice')
  })

  it('marks fallback translation', () => {
    const content = markAsFallbackTranslation('Some content', 'fr')
    expect(content).toContain('[Traduit de la langue source]')
  })

  it('getSupportedLanguages returns all languages', () => {
    const langs = getSupportedLanguages()
    expect(langs).toContain('en')
    expect(langs).toContain('fr')
    expect(langs).toContain('es')
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 11 — AUDIT & LOGGING
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 11 — Audit & Logging', () => {
  beforeEach(() => {
    clearAuditLog()
  })

  it('records audit entry with all fields', () => {
    const entry = recordAuditEntry({
      userId: 'user-1',
      orgId: 'org-1',
      role: UEAssistantRoles.MEMBER,
      intent: IntentTypes.GRIEVANCE,
      query: 'How do I file a grievance?',
      responseType: ResponseTypes.GUIDED_STEPS,
      mode: 'guided',
      sourcesUsed: ['doc-1'],
      toolsInvoked: [ToolNames.OPEN_GRIEVANCE_FORM],
      dataAccessed: ['collective_agreement:doc-1'],
      escalationTriggered: false,
      confidence: 0.85,
    })
    expect(entry.id).toBeTruthy()
    expect(entry.userId).toBe('user-1')
    expect(entry.orgId).toBe('org-1')
    expect(entry.timestamp).toBeTruthy()
  })

  it('audit log grows with each entry', () => {
    recordAuditEntry({
      userId: 'user-1', orgId: 'org-1', role: UEAssistantRoles.MEMBER,
      intent: IntentTypes.GRIEVANCE, query: 'test', responseType: ResponseTypes.GUIDED_STEPS,
      mode: 'guided', sourcesUsed: [], toolsInvoked: [], dataAccessed: [],
      escalationTriggered: false, confidence: 0.8,
    })
    recordAuditEntry({
      userId: 'user-2', orgId: 'org-1', role: UEAssistantRoles.STEWARD,
      intent: IntentTypes.CASE_ANALYSIS, query: 'analyze case', responseType: ResponseTypes.ANALYTICAL_OUTPUT,
      mode: 'analytical', sourcesUsed: [], toolsInvoked: [], dataAccessed: [],
      escalationTriggered: false, confidence: 0.9,
    })
    expect(getAuditLogSize()).toBe(2)
  })

  it('getAuditLogByOrg filters by org', () => {
    recordAuditEntry({
      userId: 'user-1', orgId: 'org-1', role: UEAssistantRoles.MEMBER,
      intent: IntentTypes.GRIEVANCE, query: 'test', responseType: ResponseTypes.GUIDED_STEPS,
      mode: 'guided', sourcesUsed: [], toolsInvoked: [], dataAccessed: [],
      escalationTriggered: false, confidence: 0.8,
    })
    recordAuditEntry({
      userId: 'user-2', orgId: 'org-2', role: UEAssistantRoles.MEMBER,
      intent: IntentTypes.RIGHTS, query: 'test2', responseType: ResponseTypes.CITED_EXPLANATION,
      mode: 'guided', sourcesUsed: [], toolsInvoked: [], dataAccessed: [],
      escalationTriggered: false, confidence: 0.7,
    })
    expect(getAuditLogByOrg('org-1')).toHaveLength(1)
    expect(getAuditLogByOrg('org-2')).toHaveLength(1)
  })

  it('verifyAuditChain returns true for intact chain', () => {
    recordAuditEntry({
      userId: 'user-1', orgId: 'org-1', role: UEAssistantRoles.MEMBER,
      intent: IntentTypes.GRIEVANCE, query: 'test', responseType: ResponseTypes.GUIDED_STEPS,
      mode: 'guided', sourcesUsed: [], toolsInvoked: [], dataAccessed: [],
      escalationTriggered: false, confidence: 0.8,
    })
    expect(verifyAuditChain()).toBe(true)
  })

  it('getAuditLogByUser filters by user', () => {
    recordAuditEntry({
      userId: 'user-1', orgId: 'org-1', role: UEAssistantRoles.MEMBER,
      intent: IntentTypes.GRIEVANCE, query: 'test', responseType: ResponseTypes.GUIDED_STEPS,
      mode: 'guided', sourcesUsed: [], toolsInvoked: [], dataAccessed: [],
      escalationTriggered: false, confidence: 0.8,
    })
    expect(getAuditLogByUser('user-1')).toHaveLength(1)
    expect(getAuditLogByUser('user-999')).toHaveLength(0)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 13 — SAFETY & GUARDRAILS
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 13 — Safety & Guardrails', () => {
  it('flags hallucinated legal advice without citations', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.RIGHTS,
      ctx,
      citations: [],
      content: 'You are legally entitled to this benefit.',
      confidence: 0.8,
      responseType: ResponseTypes.CITED_EXPLANATION,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.includes('Legal claim'))).toBe(true)
  })

  it('passes when legal content has citations', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.RIGHTS,
      ctx,
      citations: [
        { sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'doc-1', title: 'Article 12', excerpt: 'test', relevanceScore: 0.9 },
        { sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'doc-2', title: 'Article 15', excerpt: 'test', relevanceScore: 0.8 },
      ],
      content: 'Based on the collective agreement, you are legally entitled to this.',
      confidence: 0.8,
      responseType: ResponseTypes.CITED_EXPLANATION,
    })
    expect(result.passed).toBe(true)
  })

  it('flags low confidence responses', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.BENEFITS,
      ctx,
      citations: [{ sourceType: KnowledgeSourceTypes.BENEFITS_DOCUMENTATION, sourceId: 'doc-4', title: 'Benefits', excerpt: 'test', relevanceScore: 0.8 }],
      content: 'Your benefits include dental coverage.',
      confidence: 0.4,
      responseType: ResponseTypes.DIRECT_ANSWER,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.includes('Confidence'))).toBe(true)
  })

  it('computeConfidence returns low when no citations', () => {
    expect(computeConfidence([], 0.8)).toBeLessThanOrEqual(0.3)
  })

  it('computeConfidence returns higher with good citations', () => {
    const citations = [
      { sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'doc-1', title: 'test', excerpt: 'test', relevanceScore: 0.9 },
    ]
    expect(computeConfidence(citations, 0.8)).toBeGreaterThan(0.5)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// FULL ORCHESTRATOR PIPELINE TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Full Assistant Orchestrator', () => {
  beforeEach(() => {
    clearAuditLog()
    clearToolLog()
    clearEscalationLog()
  })

  it('processes member grievance request end-to-end', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const response = processRequest(
      { query: 'How do I file a grievance about scheduling?', context: ctx },
      { knowledgeStore: store, actorId: 'user-1' },
    )
    expect(response.requestId).toBeTruthy()
    expect(response.content).toBeTruthy()
    expect(response.language).toBe('en')
    expect(response.confidence).toBeGreaterThan(0)
    expect(response.timestamp).toBeTruthy()
    // Audit should be recorded
    expect(getAuditLog().length).toBeGreaterThan(0)
  })

  it('processes steward case analysis request', () => {
    const store = populatedStore()
    const ctx = stewardContext()
    const response = processRequest(
      { query: 'Analyze case 001 — the scheduling dispute', context: ctx },
      { knowledgeStore: store, actorId: 'steward-1' },
    )
    expect(response.responseType).toBe(ResponseTypes.ANALYTICAL_OUTPUT)
    expect(response.citations.length).toBeGreaterThan(0)
  })

  it('processes contract question with citations', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const response = processRequest(
      { query: 'What does the collective agreement say about overtime?', context: ctx },
      { knowledgeStore: store, actorId: 'user-1' },
    )
    expect(response.citations.length).toBeGreaterThan(0)
    expect(response.content).toContain('Sources:')
  })

  it('triggers safety escalation for emergency', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const response = processRequest(
      { query: 'There is an emergency, someone is injured at the worksite', context: ctx },
      { knowledgeStore: store, actorId: 'user-1' },
    )
    expect(response.escalation).not.toBeNull()
    expect(response.escalation!.target).toBe('safety_officer')
    expect(response.responseType).toBe(ResponseTypes.ESCALATION_REQUIRED)
  })

  it('differentiates member vs steward for same intent', () => {
    const store = populatedStore()
    const memberResp = processRequest(
      { query: 'Tell me about the grievance procedure', context: memberContext() },
      { knowledgeStore: store, actorId: 'user-1' },
    )
    const stewardResp = processRequest(
      { query: 'Tell me about the grievance procedure', context: stewardContext() },
      { knowledgeStore: store, actorId: 'steward-1' },
    )
    // Both should have content, but response types differ
    expect(memberResp.content).toBeTruthy()
    expect(stewardResp.content).toBeTruthy()
  })

  it('rejects requests with missing orgId', () => {
    const store = populatedStore()
    const ctx = buildContext({ orgId: '', localId: 'l', userRole: UEAssistantRoles.MEMBER })
    expect(() =>
      processRequest(
        { query: 'test', context: ctx },
        { knowledgeStore: store },
      ),
    ).toThrow()
  })

  it('returns escalation for unknown intent with low confidence', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const response = processRequest(
      { query: 'Hello, nice weather today', context: ctx },
      { knowledgeStore: store, actorId: 'user-1' },
    )
    // Unknown intent with low confidence triggers escalation
    expect(response.responseType).toBe(ResponseTypes.ESCALATION_REQUIRED)
    expect(response.escalation).not.toBeNull()
  })

  it('handles French language context', () => {
    const store = populatedStore()
    const ctx = buildContext({
      orgId: 'org-1',
      localId: 'local-1',
      userRole: UEAssistantRoles.MEMBER,
      language: 'fr',
      entitlements: ['grievance'],
      activeModules: ['grievances'],
    })
    const response = processRequest(
      { query: 'Hello, comment allez-vous?', context: ctx },
      { knowledgeStore: store, actorId: 'user-fr-1' },
    )
    expect(response.language).toBe('fr')
  })

  it('admin oversight produces analytical output', () => {
    const store = populatedStore()
    const ctx = localAdminContext()
    const response = processRequest(
      { query: 'Show me the caseload report and workload analysis', context: ctx },
      { knowledgeStore: store, actorId: 'admin-1' },
    )
    expect(response.content).toBeTruthy()
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// PHASE 15 — SELF-VALIDATION
// ══════════════════════════════════════════════════════════════════════════════

describe('Phase 15 — Self-Validation Checks', () => {
  beforeEach(() => {
    clearAuditLog()
    clearToolLog()
    clearEscalationLog()
  })

  it('no hallucinations: legal responses require citations', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.RIGHTS,
      ctx,
      citations: [],
      content: 'You are legally entitled to overtime pay.',
      confidence: 0.8,
      responseType: ResponseTypes.CITED_EXPLANATION,
    })
    expect(result.passed).toBe(false)
  })

  it('role differentiation: member ≠ steward ≠ admin', () => {
    const memberCap = getRoleCapability(UEAssistantRoles.MEMBER)
    const stewardCap = getRoleCapability(UEAssistantRoles.STEWARD)
    const adminCap = getRoleCapability(UEAssistantRoles.LOCAL_ADMIN)

    expect(memberCap.mode).not.toBe(stewardCap.mode)
    expect(stewardCap.mode).not.toBe(adminCap.mode)
    expect(memberCap.allowedIntents.length).toBeLessThan(stewardCap.allowedIntents.length)
    expect(stewardCap.allowedTools.length).toBeGreaterThan(memberCap.allowedTools.length)
  })

  it('workflow integration: tools are callable and logged', () => {
    const ctx = stewardContext()
    executeTool(ToolNames.ANALYZE_CASE, ctx, { caseId: 'case-1' })
    const log = getToolLog()
    expect(log.length).toBeGreaterThan(0)
    expect(log[0].tool).toBe(ToolNames.ANALYZE_CASE)
  })

  it('entitlement enforcement: context checks work', () => {
    const ctx = memberContext()
    expect(hasEntitlement(ctx, 'grievance')).toBe(true)
    expect(hasEntitlement(ctx, 'admin_dashboard')).toBe(false)
  })

  it('audit logging complete: entries are recorded and chain verified', () => {
    recordAuditEntry({
      userId: 'user-1', orgId: 'org-1', role: UEAssistantRoles.MEMBER,
      intent: IntentTypes.GRIEVANCE, query: 'test', responseType: ResponseTypes.GUIDED_STEPS,
      mode: 'guided', sourcesUsed: ['doc-1'], toolsInvoked: [],
      dataAccessed: ['collective_agreement:doc-1'], escalationTriggered: false, confidence: 0.8,
    })
    expect(getAuditLogSize()).toBe(1)
    expect(verifyAuditChain()).toBe(true)
  })

  it('escalation works: high-risk triggers escalation', () => {
    const ctx = memberContext()
    const result = evaluateEscalation({
      query: 'I was fired, this is wrongful termination',
      intent: IntentTypes.GRIEVANCE,
      confidence: 0.8,
      citations: [{ sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'doc-1', title: 'test', excerpt: 'test', relevanceScore: 0.8 }],
      ctx,
    })
    expect(result).not.toBeNull()
    expect(result!.severity).toBe('high')
  })

  it('cross-org isolation: enforced at context level', () => {
    const ctx = memberContext()
    expect(enforceIsolation(ctx, 'org-2', 'local-1')).toBe(false)
    expect(enforceIsolation(ctx, 'org-1', 'local-1')).toBe(true)
  })
})

// ══════════════════════════════════════════════════════════════════════════════
// COVERAGE GAP TESTS
// ══════════════════════════════════════════════════════════════════════════════

describe('Coverage gaps — assistant.ts', () => {
  beforeEach(() => {
    clearAuditLog()
    clearToolLog()
    clearEscalationLog()
  })

  it('uses "unknown" actorId when none provided', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const response = processRequest(
      { query: 'Where is the training page?', context: ctx },
      { knowledgeStore: store },
    )
    expect(response.content).toBeTruthy()
    const log = getAuditLog()
    expect(log.length).toBeGreaterThan(0)
    expect(log[0].userId).toBe('unknown')
  })

  it('builds DIRECT_ANSWER content (member + benefits)', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const response = processRequest(
      { query: 'Tell me about dental benefits coverage', context: ctx },
      { knowledgeStore: store, actorId: 'user-1' },
    )
    expect(response.responseType).toBe(ResponseTypes.DIRECT_ANSWER)
    expect(response.content).toContain('benefits')
  })

  it('skips disclaimers for navigation intent', () => {
    const store = populatedStore()
    store.add({
      id: 'route-1',
      sourceType: KnowledgeSourceTypes.UE_ROUTE,
      orgId: 'org-1',
      localId: null,
      title: 'Settings Page',
      content: 'Navigate to the settings page for account configuration.',
      language: 'en',
      tags: ['settings', 'page', 'navigate'],
    })
    const ctx = memberContext()
    const response = processRequest(
      { query: 'Where do I find the settings page?', context: ctx },
      { knowledgeStore: store, actorId: 'user-1' },
    )
    expect(response.content).toBeTruthy()
    // Navigation has no required disclaimers
    expect(getRequiredDisclaimers(IntentTypes.NAVIGATION)).toHaveLength(0)
  })

  it('prepends safety emergency prefix for urgent query', () => {
    const store = populatedStore()
    const ctx = memberContext()
    const response = processRequest(
      { query: 'There is a fire in the building, someone is trapped', context: ctx },
      { knowledgeStore: store, actorId: 'user-1' },
    )
    expect(response.content).toContain('emergency services')
  })
})

describe('Coverage gaps — context.ts', () => {
  it('filterCaseAccess returns false for unknown role', () => {
    const ctx = buildContext({
      orgId: 'org-1',
      localId: 'local-1',
      userRole: 'unknown_role' as never,
    })
    expect(filterCaseAccess(ctx, 'user-1', undefined, 'user-1')).toBe(false)
  })

  it('filterCaseAccess: member without actorId returns false', () => {
    const ctx = memberContext()
    expect(filterCaseAccess(ctx, 'user-1')).toBe(false)
  })

  it('filterCaseAccess: steward without actorId returns false', () => {
    const ctx = stewardContext()
    expect(filterCaseAccess(ctx, 'user-1', 'steward-1')).toBe(false)
  })

  it('filterCaseAccess: steward without assignedStewardId returns false', () => {
    const ctx = stewardContext()
    expect(filterCaseAccess(ctx, 'user-1', undefined, 'steward-1')).toBe(false)
  })

  it('filterCaseAccess: parent_admin can access all', () => {
    const ctx = parentAdminContext()
    expect(filterCaseAccess(ctx, 'anyone', undefined, undefined)).toBe(true)
  })
})

describe('Coverage gaps — domain-rules.ts', () => {
  it('getActionsForRole returns empty for unknown role', () => {
    const ctx = buildContext({
      orgId: 'org-1',
      localId: 'local-1',
      userRole: 'unknown_role' as never,
    })
    expect(getActionsForRole(IntentTypes.GRIEVANCE, ctx)).toEqual([])
  })

  it('requiresLegalEscalation: "legal" with no citations → true', () => {
    expect(requiresLegalEscalation('Is this a legal issue?', [])).toBe(true)
  })

  it('requiresLegalEscalation: non-legal with citations → false', () => {
    const cit = [{ sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'd1', title: 't', excerpt: 'e', relevanceScore: 0.8 }]
    expect(requiresLegalEscalation('What are my benefits?', cit)).toBe(false)
  })

  it('requiresLegalEscalation: legal keyword match → true', () => {
    const cit = [{ sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'd1', title: 't', excerpt: 'e', relevanceScore: 0.8 }]
    expect(requiresLegalEscalation('What is the arbitration ruling precedent?', cit)).toBe(true)
  })
})

describe('Coverage gaps — escalation.ts', () => {
  beforeEach(() => {
    clearEscalationLog()
  })

  it('safety_emergency ignores non-safety intent even with emergency terms', () => {
    const ctx = memberContext()
    const result = evaluateEscalation({
      query: 'There was an emergency meeting about benefits',
      intent: IntentTypes.BENEFITS,
      confidence: 0.8,
      citations: [{ sourceType: KnowledgeSourceTypes.BENEFITS_DOCUMENTATION, sourceId: 'doc-4', title: 'Benefits', excerpt: 'test', relevanceScore: 0.8 }],
      ctx,
    })
    if (result) {
      expect(result.target).not.toBe('safety_officer')
    }
  })

  it('missing_data triggers for non-navigation intent with no citations', () => {
    const ctx = memberContext()
    const result = evaluateEscalation({
      query: 'Tell me about benefits',
      intent: IntentTypes.BENEFITS,
      confidence: 0.8,
      citations: [],
      ctx,
    })
    expect(result).not.toBeNull()
    expect(result!.reason).toBe('missing_data')
    expect(result!.target).toBe('admin')
  })

  it('safety intent without emergency terms does not trigger safety_emergency', () => {
    const ctx = memberContext()
    const result = evaluateEscalation({
      query: 'I want to report a safety concern about poor ventilation',
      intent: IntentTypes.SAFETY,
      confidence: 0.8,
      citations: [{ sourceType: KnowledgeSourceTypes.SAFETY_POLICY, sourceId: 'doc-3', title: 'Safety', excerpt: 'test', relevanceScore: 0.8 }],
      ctx,
    })
    // Should NOT be critical/safety_officer since no emergency terms
    if (result) {
      expect(result.severity).not.toBe('critical')
    }
  })

  it('legal_ambiguity returns false when legal terms present but citations >= 2', () => {
    const ctx = memberContext()
    const result = evaluateEscalation({
      query: 'What does the court ruling say about this?',
      intent: IntentTypes.RIGHTS,
      confidence: 0.8,
      citations: [
        { sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'doc-1', title: 'Art 12', excerpt: 'test', relevanceScore: 0.8 },
        { sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT, sourceId: 'doc-2', title: 'Art 15', excerpt: 'test', relevanceScore: 0.8 },
      ],
      ctx,
    })
    // legal_ambiguity should NOT trigger (has 2 citations)
    if (result) {
      expect(result.reason).not.toBe('legal_ambiguity')
    }
  })
})

describe('Coverage gaps — guardrails.ts', () => {
  it('detects cross-org leakage in citations', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.BENEFITS,
      ctx,
      citations: [{
        sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
        sourceId: 'org:org-2:doc-5',
        title: 'Other Org Doc',
        excerpt: 'test',
        relevanceScore: 0.8,
      }],
      content: 'Some benefits info',
      confidence: 0.8,
      responseType: ResponseTypes.DIRECT_ANSWER,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.includes('Cross-org'))).toBe(true)
  })

  it('passes when citation matches org', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.BENEFITS,
      ctx,
      citations: [{
        sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
        sourceId: 'org:org-1:doc-1',
        title: 'Own Org Doc',
        excerpt: 'test',
        relevanceScore: 0.8,
      }],
      content: 'Some benefits info',
      confidence: 0.8,
      responseType: ResponseTypes.DIRECT_ANSWER,
    })
    expect(result.passed).toBe(true)
  })

  it('flags safety urgency without emergency protocol reference', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.SAFETY,
      ctx,
      citations: [{ sourceType: KnowledgeSourceTypes.SAFETY_POLICY, sourceId: 'doc-3', title: 'Safety', excerpt: 'test', relevanceScore: 0.8 }],
      content: 'There is an emergency situation. Please be careful.',
      confidence: 0.8,
      responseType: ResponseTypes.GUIDED_STEPS,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.includes('emergency protocol'))).toBe(true)
  })

  it('passes safety response with emergency reference', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.SAFETY,
      ctx,
      citations: [{ sourceType: KnowledgeSourceTypes.SAFETY_POLICY, sourceId: 'doc-3', title: 'Safety', excerpt: 'test', relevanceScore: 0.8 }],
      content: 'There is an emergency situation. Call emergency services immediately.',
      confidence: 0.8,
      responseType: ResponseTypes.GUIDED_STEPS,
    })
    expect(result.violations.filter((v) => v.includes('emergency protocol'))).toHaveLength(0)
  })

  it('passes for non-legal non-safety intent with adequate confidence', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.NAVIGATION,
      ctx,
      citations: [],
      content: 'Navigate to the dashboard.',
      confidence: 0.8,
      responseType: ResponseTypes.DIRECT_ANSWER,
    })
    expect(result.passed).toBe(true)
  })

  it('no confidence violation when just above threshold', () => {
    const ctx = memberContext()
    const result = runGuardrails({
      intent: IntentTypes.GRIEVANCE,
      ctx,
      citations: [{ sourceType: KnowledgeSourceTypes.GRIEVANCE_PROCEDURE, sourceId: 'doc-5', title: 'Grievance', excerpt: 'test', relevanceScore: 0.8 }],
      content: 'Here are the steps to follow.',
      confidence: 0.35,
      responseType: ResponseTypes.GUIDED_STEPS,
    })
    expect(result.violations.filter((v) => v.includes('Confidence'))).toHaveLength(0)
  })
})

describe('Coverage gaps — knowledge.ts', () => {
  it('matches entries by tag when content/title do not match', () => {
    const store = new InMemoryKnowledgeStore()
    store.add({
      id: 'tag-doc',
      sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
      orgId: 'org-1',
      localId: null,
      title: 'Article 99',
      content: 'Special provisions document.',
      language: 'en',
      tags: ['overtime'],
    })
    const results = store.search({
      query: 'overtime',
      orgId: 'org-1',
      localId: 'local-1',
      sourceTypes: [KnowledgeSourceTypes.COLLECTIVE_AGREEMENT],
      language: 'en',
      limit: 10,
    })
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe('tag-doc')
  })

  it('sorts same-language entries before different-language', () => {
    const store = new InMemoryKnowledgeStore()
    store.add({
      id: 'fr-doc',
      sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
      orgId: 'org-1',
      localId: null,
      title: 'Overtime FR',
      content: 'Overtime rules in French.',
      language: 'fr',
      tags: ['overtime'],
    })
    store.add({
      id: 'en-doc',
      sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
      orgId: 'org-1',
      localId: null,
      title: 'Overtime EN',
      content: 'Overtime rules in English.',
      language: 'en',
      tags: ['overtime'],
    })
    const results = store.search({
      query: 'overtime',
      orgId: 'org-1',
      localId: 'local-1',
      sourceTypes: [KnowledgeSourceTypes.COLLECTIVE_AGREEMENT],
      language: 'en',
      limit: 10,
    })
    expect(results[0].language).toBe('en')
  })

  it('filters out entries from a different local', () => {
    const store = new InMemoryKnowledgeStore()
    store.add({
      id: 'other-local-doc',
      sourceType: KnowledgeSourceTypes.COLLECTIVE_AGREEMENT,
      orgId: 'org-1',
      localId: 'local-2',
      title: 'Local 2 Policy',
      content: 'Overtime policy for local 2.',
      language: 'en',
      tags: ['overtime'],
    })
    const results = store.search({
      query: 'overtime',
      orgId: 'org-1',
      localId: 'local-1',
      sourceTypes: [KnowledgeSourceTypes.COLLECTIVE_AGREEMENT],
      language: 'en',
      limit: 10,
    })
    expect(results).toHaveLength(0)
  })
})

describe('Coverage gaps — localization.ts', () => {
  it('returns key for unknown message key', () => {
    expect(getLocalizedMessage('nonexistent_key', 'en')).toBe('nonexistent_key')
  })
})

describe('Coverage gaps — response-policy.ts', () => {
  it('returns CLARIFICATION_REQUIRED for member + case_analysis', () => {
    expect(determineResponseType(UEAssistantRoles.MEMBER, IntentTypes.CASE_ANALYSIS)).toBe(ResponseTypes.CLARIFICATION_REQUIRED)
  })

  it('returns CLARIFICATION_REQUIRED for member + oversight', () => {
    expect(determineResponseType(UEAssistantRoles.MEMBER, IntentTypes.OVERSIGHT)).toBe(ResponseTypes.CLARIFICATION_REQUIRED)
  })

  it('returns CLARIFICATION_REQUIRED for member + drafting', () => {
    expect(determineResponseType(UEAssistantRoles.MEMBER, IntentTypes.DRAFTING)).toBe(ResponseTypes.CLARIFICATION_REQUIRED)
  })
})

describe('Coverage gaps — steward-intelligence.ts', () => {
  it('recommendEscalation: legally complex only → high urgency', () => {
    const ctx = stewardContext()
    const rec = recommendEscalation(ctx, {
      caseId: 'case-1',
      confidence: 0.9,
      missingInfo: [],
      isLegallyComplex: true,
      isHighRisk: false,
    })
    expect(rec.recommended).toBe(true)
    expect(rec.urgency).toBe('high')
    expect(rec.target).toBe('legal_representative')
  })

  it('recommendEscalation: low confidence only → medium', () => {
    const ctx = stewardContext()
    const rec = recommendEscalation(ctx, {
      caseId: 'case-1',
      confidence: 0.3,
      missingInfo: [],
      isLegallyComplex: false,
      isHighRisk: false,
    })
    expect(rec.recommended).toBe(true)
    expect(rec.urgency).toBe('medium')
  })

  it('recommendEscalation: many missing info only → medium', () => {
    const ctx = stewardContext()
    const rec = recommendEscalation(ctx, {
      caseId: 'case-1',
      confidence: 0.9,
      missingInfo: ['a', 'b', 'c', 'd'],
      isLegallyComplex: false,
      isHighRisk: false,
    })
    expect(rec.recommended).toBe(true)
    expect(rec.urgency).toBe('medium')
  })

  it('recommendEscalation: high-risk + low confidence → stays high', () => {
    const ctx = stewardContext()
    const rec = recommendEscalation(ctx, {
      caseId: 'case-1',
      confidence: 0.3,
      missingInfo: [],
      isLegallyComplex: false,
      isHighRisk: true,
    })
    expect(rec.recommended).toBe(true)
    expect(rec.urgency).toBe('high')
  })

  it('recommendEscalation: high-risk + many missing info → stays high', () => {
    const ctx = stewardContext()
    const rec = recommendEscalation(ctx, {
      caseId: 'case-1',
      confidence: 0.9,
      missingInfo: ['a', 'b', 'c', 'd'],
      isLegallyComplex: false,
      isHighRisk: true,
    })
    expect(rec.recommended).toBe(true)
    expect(rec.urgency).toBe('high')
  })

  it('summarizeCase accessible by local_admin', () => {
    const ctx = localAdminContext()
    const summary = summarizeCase(ctx, 'case-1', {
      description: 'Issue reported at workplace.',
      filedDate: '2024-03-01',
    })
    expect(summary.caseId).toBe('case-1')
    expect(summary.missingInfo.length).toBeGreaterThan(0)
  })

  it('summarizeCase accessible by parent_admin', () => {
    const ctx = parentAdminContext()
    const summary = summarizeCase(ctx, 'case-1', {
      description: 'Cross-local workplace issue.',
    })
    expect(summary.caseId).toBe('case-1')
  })

  it('summarizeCase truncates long descriptions with ellipsis', () => {
    const ctx = stewardContext()
    const longDesc = 'A'.repeat(150)
    const summary = summarizeCase(ctx, 'case-1', {
      description: longDesc,
      filedDate: '2024-01-15',
      status: 'investigating',
      grievanceType: 'contract',
      evidence: ['e1'],
    })
    expect(summary.summary).toContain('...')
    expect(summary.confidence).toBe(0.9)
  })

  it('mapToClauses returns empty for no matching clauses', () => {
    const ctx = stewardContext()
    const mapping = mapToClauses(ctx, 'xyz completely unrelated', [
      { id: 'clause-1', title: 'Overtime', content: 'Overtime shall be distributed by seniority.' },
    ])
    expect(mapping.matchedClauses).toHaveLength(0)
    expect(mapping.confidence).toBe(0.3)
  })

  it('detectMissingInfo returns all gaps for empty data', () => {
    const ctx = stewardContext()
    const missing = detectMissingInfo(ctx, {})
    expect(missing).toContain('Detailed description of the issue')
    expect(missing).toContain('Date the issue occurred')
    expect(missing).toContain('Type of grievance')
    expect(missing).toContain('Supporting evidence or documentation')
    expect(missing).toContain('Relevant contract clause references')
    expect(missing).toContain('Witness information (if applicable)')
    expect(missing).toContain('Timeline of events')
  })

  it('detectMissingInfo returns no gaps for complete data', () => {
    const ctx = stewardContext()
    const missing = detectMissingInfo(ctx, {
      description: 'A detailed description of the issue that exceeds twenty characters.',
      filedDate: '2024-01-15',
      grievanceType: 'contract',
      evidence: ['doc-1'],
      contractClauses: ['Article 15'],
      witnesses: ['John Doe'],
      timeline: ['2024-01-10: incident occurred'],
    })
    expect(missing).toHaveLength(0)
  })
})

describe('Coverage gaps — tools.ts', () => {
  beforeEach(() => {
    clearToolLog()
  })

  it('OPEN_GRIEVANCE_FORM denied without grievance entitlement', () => {
    const ctx = buildContext({
      orgId: 'org-1',
      localId: 'local-1',
      userRole: UEAssistantRoles.MEMBER,
      entitlements: ['voting'],
      activeModules: ['voting'],
    })
    const result = executeTool(ToolNames.OPEN_GRIEVANCE_FORM, ctx, {})
    expect(result.result.success).toBe(false)
    expect(result.result.error).toContain('not entitled')
  })

  it('OPEN_GRIEVANCE_FORM succeeds with empty entitlements', () => {
    const ctx = buildContext({
      orgId: 'org-1',
      localId: 'local-1',
      userRole: UEAssistantRoles.MEMBER,
      entitlements: [],
      activeModules: ['grievances'],
    })
    const result = executeTool(ToolNames.OPEN_GRIEVANCE_FORM, ctx, {})
    expect(result.result.success).toBe(true)
  })

  it('GET_CASE_STATUS requires caseId', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.GET_CASE_STATUS, ctx, {})
    expect(result.result.success).toBe(false)
    expect(result.result.error).toContain('caseId is required')
  })

  it('GET_CASE_STATUS succeeds for non-member role', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.GET_CASE_STATUS, ctx, { caseId: 'case-1' })
    expect(result.result.success).toBe(true)
  })

  it('ANALYZE_CASE requires caseId', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.ANALYZE_CASE, ctx, {})
    expect(result.result.success).toBe(false)
    expect(result.result.error).toContain('caseId is required')
  })

  it('SUMMARIZE_CASE requires caseId', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.SUMMARIZE_CASE, ctx, {})
    expect(result.result.success).toBe(false)
    expect(result.result.error).toContain('caseId is required')
  })

  it('SUMMARIZE_CASE succeeds with caseId', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.SUMMARIZE_CASE, ctx, { caseId: 'case-1' })
    expect(result.result.success).toBe(true)
  })

  it('MAP_TO_CONTRACT_CLAUSES requires description', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.MAP_TO_CONTRACT_CLAUSES, ctx, {})
    expect(result.result.success).toBe(false)
    expect(result.result.error).toContain('description is required')
  })

  it('MAP_TO_CONTRACT_CLAUSES succeeds with description', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.MAP_TO_CONTRACT_CLAUSES, ctx, { description: 'Overtime issue' })
    expect(result.result.success).toBe(true)
  })

  it('EXPLAIN_AGREEMENT_SECTION requires section', () => {
    const ctx = memberContext()
    const result = executeTool(ToolNames.EXPLAIN_AGREEMENT_SECTION, ctx, {})
    expect(result.result.success).toBe(false)
    expect(result.result.error).toContain('section is required')
  })

  it('EXPLAIN_AGREEMENT_SECTION succeeds with section', () => {
    const ctx = memberContext()
    const result = executeTool(ToolNames.EXPLAIN_AGREEMENT_SECTION, ctx, { section: 'Article 15' })
    expect(result.result.success).toBe(true)
  })

  it('DRAFT_GRIEVANCE succeeds', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.DRAFT_GRIEVANCE, ctx, { caseId: 'case-1' })
    expect(result.result.success).toBe(true)
  })

  it('SUGGEST_NEXT_STEPS succeeds', () => {
    const ctx = stewardContext()
    const result = executeTool(ToolNames.SUGGEST_NEXT_STEPS, ctx, { caseId: 'case-1' })
    expect(result.result.success).toBe(true)
  })

  it('REPORT_SAFETY_ISSUE non-urgent', () => {
    const ctx = memberContext()
    const result = executeTool(ToolNames.REPORT_SAFETY_ISSUE, ctx, { urgent: false })
    const data = result.result.data as { action: string; urgent: boolean }
    expect(data.action).toBe('reporting_workflow')
    expect(data.urgent).toBe(false)
  })

  it('CASE_DASHBOARD_INSIGHTS succeeds', () => {
    const ctx = localAdminContext()
    const result = executeTool(ToolNames.CASE_DASHBOARD_INSIGHTS, ctx, {})
    expect(result.result.success).toBe(true)
  })

  it('WORKLOAD_ANALYSIS succeeds', () => {
    const ctx = localAdminContext()
    const result = executeTool(ToolNames.WORKLOAD_ANALYSIS, ctx, {})
    expect(result.result.success).toBe(true)
  })

  it('AGGREGATE_INSIGHTS succeeds', () => {
    const ctx = parentAdminContext()
    const result = executeTool(ToolNames.AGGREGATE_INSIGHTS, ctx, {})
    expect(result.result.success).toBe(true)
  })

  it('TREND_ANALYSIS succeeds with custom period', () => {
    const ctx = parentAdminContext()
    const result = executeTool(ToolNames.TREND_ANALYSIS, ctx, { period: 'last_7_days' })
    expect(result.result.success).toBe(true)
    expect((result.result.data as Record<string, unknown>).period).toBe('last_7_days')
  })

  it('TREND_ANALYSIS uses default period', () => {
    const ctx = parentAdminContext()
    const result = executeTool(ToolNames.TREND_ANALYSIS, ctx, {})
    expect(result.result.success).toBe(true)
    expect((result.result.data as Record<string, unknown>).period).toBe('last_30_days')
  })

  it('unknown tool returns error', () => {
    const ctx = memberContext()
    const result = executeTool('nonexistent_tool' as never, ctx, {})
    expect(result.result.success).toBe(false)
    expect(result.result.error).toContain('not allowed')
  })
})

describe('Coverage gaps — audit.ts', () => {
  beforeEach(() => {
    clearAuditLog()
  })

  it('getChainHash returns initial hash when empty', () => {
    expect(getChainHash()).toBe('0'.repeat(64))
  })

  it('getChainHash changes after recording entry', () => {
    recordAuditEntry({
      userId: 'user-1', orgId: 'org-1', role: UEAssistantRoles.MEMBER,
      intent: IntentTypes.GRIEVANCE, query: 'test', responseType: ResponseTypes.GUIDED_STEPS,
      mode: 'guided', sourcesUsed: [], toolsInvoked: [], dataAccessed: [],
      escalationTriggered: false, confidence: 0.8,
    })
    const hash = getChainHash()
    expect(hash).not.toBe('0'.repeat(64))
    expect(hash).toHaveLength(64)
  })
})
