/**
 * Gate 0B.2 ownership groups. A group names the exact route files whose operations the tranche classified with
 * source evidence, the one capability whose obligation covers them, and the business domain. Routes are listed by
 * exact file. A route prefix or an HTTP method never decides ownership.
 */
import { CAPABILITY_DOMAINS as DOMAINS_0B1 } from './ue-gate0b1-groups.mjs'

export const TRANCHE_ID = 'GATE-0B.2'
export const TRANCHE_SIZE = 100
export const CARRY_FORWARD_FROM = 'GATE-0B.1'
export const ANCHOR_COMMIT = '8480b8899c49d313e8f1254637255674a1c1e4be'
export const NEW_UNEXAMINED_COUNT = 81
export const CARRY_FORWARD_COUNT = 19

const APP = 'apps/union-eyes/'
const CRUD_FACTORY = `${APP}lib/api/crud-factory.ts`
const CRUD_GOVERNANCE = `${APP}lib/api/crud-governance.ts`

export const CAPABILITY_IDS_0B2 = {
  AI: 'UE-OMIT-AI-ADVISORY-GOVERNANCE',
  AUDIT_VISIBILITY: 'UE-OMIT-AUDIT-LOG-VISIBILITY',
  OPERATOR: 'UE-OMIT-PLATFORM-OPERATOR-CONTROLS',
  ENUMERATION: 'UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION',
  PKI: 'UE-OMIT-PKI-SIGNING-WORKFLOW',
  PROTOCOL: 'UE-OMIT-REPRESENTATION-PROTOCOL-POLICY',
  EXPOSURE: 'UE-OMIT-ROUTE-EXPOSURE-HARDENING',
}

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

/** A file only partly inside the tranche: only the listed methods are classified; the others stay SCOPE_UNDECIDED. */
export const METHOD_FILTERS = {
  'analytics/insights/route.ts': ['GET'],
}

export const CRUD_MEMBER_ROUTES = [
  'admin/segments/[id]/execute/route.ts',
  'admin/segments/[id]/route.ts',
  'admin/segments/route.ts',
  'admin/system/settings/route.ts',
  'admin/update-role/route.ts',
]

export const CRUD_ANALYTICS_ROUTES = {
  analytics_metrics: [
    'analytics/claims/categories/route.ts',
    'analytics/claims/route.ts',
    'analytics/claims/stewards/route.ts',
    'analytics/clause-stats/route.ts',
    'analytics/comparative/route.ts',
    'analytics/dashboard/route.ts',
    'analytics/deadlines-metrics/route.ts',
    'analytics/executive/route.ts',
    'analytics/financial/categories/route.ts',
    'analytics/financial/costs/route.ts',
    'analytics/financial/outcomes/route.ts',
    'analytics/financial/route.ts',
    'analytics/financial/trends/route.ts',
    'analytics/heatmap/route.ts',
  ],
  trend_analyses: ['analytics/claims/trends/route.ts'],
  insight_recommendations: ['analytics/insights/route.ts'],
}
export const CRUD_ANALYTICS_ALL = Object.values(CRUD_ANALYTICS_ROUTES).flat().filter((route) => !(route in METHOD_FILTERS))

export const AI_DOMAIN_ROUTES = {
  AI_GRIEVANCE_ADVISORY: ['ai/grievances/[id]/clause-reasoning/route.ts', 'ai/grievances/[id]/triage/route.ts', 'ai/grievances/triage/route.ts'],
  AI_CLAUSE_PRECEDENT: ['ai/classify/route.ts', 'ai/extract-clauses/route.ts', 'ai/match-precedents/route.ts'],
  AI_COPILOT: ['ai/copilot/query/route.ts', 'ai/copilot/sessions/[id]/route.ts'],
  AI_FINANCE_PENSION: ['ai/finance/analysis/route.ts', 'ai/pension/members/[id]/projection/route.ts', 'ai/pension/plans/[id]/funding/route.ts', 'ai/pension/plans/[id]/trustee-summary/route.ts'],
  AI_INSIGHTS: ['ai/employers/[id]/risk/route.ts', 'ai/insights/[reportType]/route.ts', 'ai/insights/summary/route.ts'],
  AI_KNOWLEDGE_SEARCH: ['ai/search/route.ts', 'ai/semantic-search/route.ts', 'ai/summarize/route.ts'],
  AI_KNOWLEDGE_INGESTION: ['ai/ingest/route.ts'],
  AI_FEEDBACK_AND_USAGE: ['ai/feedback/route.ts', 'admin/ai-usage/route.ts'],
  AI_MODEL_UTILITY: ['ai/mamba/route.ts'],
}

export const OPERATOR_DOMAIN_ROUTES = {
  PLATFORM_DATABASE_OPERATIONS: ['admin/database/health/route.ts', 'admin/database/optimize/route.ts'],
  PLATFORM_JOB_QUEUE: ['admin/jobs/[action]/route.ts', 'admin/jobs/retry/route.ts'],
  PLATFORM_FEATURE_FLAGS: ['admin/feature-flags/route.ts'],
  PILOT_OPERATIONS: ['admin/pilot-status/route.ts'],
  PLATFORM_AI_CACHE: ['ai/cache-stats/route.ts'],
}

export const ENUMERATION_DOMAIN_ROUTES = {
  PLATFORM_DIRECTORY: ['admin/users/route.ts', 'admin/organizations/route.ts'],
  PLATFORM_STATISTICS: ['admin/stats/activity/route.ts', 'admin/stats/overview/route.ts', 'admin/members/stats/route.ts', 'analytics/cross-org/route.ts'],
}

export const PKI_DOMAIN_ROUTES = {
  PKI_SIGNING: ['admin/pki/signatures/[id]/sign/route.ts', 'admin/pki/signatures/[id]/verify/route.ts'],
  PKI_WORKFLOW: ['admin/pki/workflows/[id]/route.ts'],
}

export const MEMBER_ACCESS_ROUTES = ['admin/users/[userId]/route.ts']
export const AGREEMENT_ROUTES = ['agreements/route.ts']
export const AUDIT_FEED_ROUTES = ['activities/route.ts']
export const PROTOCOL_ROUTES = ['admin/representation-protocol/route.ts']


const ai = (route, quote) => ev(`${APP}app/api/${route}`, quote)

const OPERATOR_EVIDENCE = {
  PLATFORM_DATABASE_OPERATIONS: [ai('admin/database/health/route.ts', "minRole: 'platform_lead'"), ai('admin/database/optimize/route.ts', 'isPlatformAdminUser(userId)')],
  PLATFORM_JOB_QUEUE: [ai('admin/jobs/[action]/route.ts', 'withSystemAdminAuth'), ai('admin/jobs/retry/route.ts', "action: 'platform.job.retry',")],
  PLATFORM_FEATURE_FLAGS: [ai('admin/feature-flags/route.ts', 'export const PATCH = withSystemAdminAuth(')],
  PILOT_OPERATIONS: [ai('admin/pilot-status/route.ts', "hasMinRole('platform_lead')")],
  PLATFORM_AI_CACHE: [ai('ai/cache-stats/route.ts', 'export const POST = withSystemAdminAuth(')],
}

const ENUMERATION_EVIDENCE = {
  PLATFORM_DIRECTORY: [ai('admin/users/route.ts', "minRole: 'platform_lead'"), ai('admin/organizations/route.ts', "minRole: 'platform_lead'")],
  PLATFORM_STATISTICS: [ai('admin/stats/overview/route.ts', "minRole: 'platform_lead'"), ai('admin/members/stats/route.ts', "hasMinRole('platform_lead')"), ai('analytics/cross-org/route.ts', "dataClass: 'aggregate_only',")],
}

const AI_EVIDENCE = {
  AI_GRIEVANCE_ADVISORY: [ai('ai/grievances/triage/route.ts', 'analyzeGrievance({')],
  AI_CLAUSE_PRECEDENT: [ai('ai/classify/route.ts', 'classifyClause')],
  AI_COPILOT: [ai('ai/copilot/query/route.ts', 'AI_FEATURES.STEWARD_COPILOT')],
  AI_FINANCE_PENSION: [ai('ai/finance/analysis/route.ts', 'generateFinancialInsight({')],
  AI_INSIGHTS: [ai('ai/insights/summary/route.ts', 'AI_FEATURES.EXECUTIVE_INSIGHTS')],
  AI_KNOWLEDGE_SEARCH: [ai('ai/search/route.ts', 'AI_FEATURES.AI_SEARCH')],
  AI_KNOWLEDGE_INGESTION: [ai('ai/ingest/route.ts', 'ragPipeline.addDocuments')],
  AI_FEEDBACK_AND_USAGE: [ai('ai/feedback/route.ts', 'AI_FEATURES.AI_FEEDBACK'), ai('admin/ai-usage/route.ts', "minRole: 'admin'")],
  AI_MODEL_UTILITY: [ai('ai/mamba/route.ts', 'AI_FEATURES.AI_MAMBA')],
}

export const OWNERSHIP_GROUPS = [
  {
    id: 'RULE-0B2-GENERIC-CRUD-MEMBERS',
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Staff at the role floor through the generic CRUD factory over organization_members',
    routes: CRUD_MEMBER_ROUTES,
    evidence: [
      ev(CRUD_FACTORY, 'export function crudRoutes'),
      ev(CRUD_GOVERNANCE, 'Generic CRUD routes authorise by organization and role floor only'),
      ev(CRUD_GOVERNANCE, "'organization_members', 'organizations', 'profiles'"),
    ],
  },
  {
    id: 'RULE-0B2-GENERIC-CRUD-INSIGHTS-GET',
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Staff at the role floor through the generic CRUD factory over insight_recommendations',
    routes: ['analytics/insights/route.ts'],
    methods: METHOD_FILTERS['analytics/insights/route.ts'],
    evidence: [
      ev(CRUD_FACTORY, 'export function crudRoutes'),
      ev(CRUD_GOVERNANCE, 'Generic CRUD routes authorise by organization and role floor only'),
      ev(CRUD_GOVERNANCE, "'insight_recommendations'"),
    ],
  },
  {
    id: 'RULE-0B2-GENERIC-CRUD-ANALYTICS',
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Staff at the role floor through the generic CRUD factory over analytics tables',
    routes: CRUD_ANALYTICS_ALL,
    evidence: [
      ev(CRUD_FACTORY, 'export function crudRoutes'),
      ev(CRUD_GOVERNANCE, 'Generic CRUD routes authorise by organization and role floor only'),
      ev(CRUD_GOVERNANCE, "'analytics_metrics'"),
    ],
  },
  {
    id: 'RULE-0B2-AGREEMENTS',
    capabilityId: 'UE-CAP-I-001',
    domain: 'COLLECTIVE_AGREEMENTS',
    actor: 'Representative reading and registering collective agreements for the organization (persona action R15)',
    routes: AGREEMENT_ROUTES,
    evidence: [
      ev('docs/union-eyes/convergence/register/ue-gate0a-persona-source-recovery.json', '| R15 agreements | LIMITED |'),
      ev(`${APP}app/api/agreements/route.ts`, 'CRUD for collective bargaining agreements (org-scoped)'),
    ],
  },
  {
    id: 'RULE-0B2-MEMBER-ACCESS-REVOCATION',
    capabilityId: 'UE-CAP-A-003',
    domain: 'MEMBER_ACCESS_REVOCATION',
    actor: 'Platform administrator deactivating, reactivating or removing a member membership',
    routes: MEMBER_ACCESS_ROUTES,
    evidence: [
      ev(`${APP}app/api/admin/users/[userId]/route.ts`, 'revokeMemberAccess'),
      ev(`${APP}lib/services/member-access-revocation-service.ts`, 'await withMemberAuthMutation(input, \'revoke-sessions\''),
      ev('docs/union-eyes/convergence/register/ue-convergence-register.json', 'every kernel record type (mandates, delegations, assignments, relationships, grants, WorkAid referral) proven to deny after session revocation, membership deactivation and user suspension'),
    ],
  },
  {
    id: 'RULE-0B2-AUDIT-FEED',
    capabilityId: CAPABILITY_IDS_0B2.AUDIT_VISIBILITY,
    domain: 'AUDIT_ACTIVITY_FEED',
    actor: 'Organization member reading the organization activity feed derived from the audit log',
    routes: AUDIT_FEED_ROUTES,
    evidence: [ev(`${APP}app/api/activities/route.ts`, 'FROM public.audit_logs')],
  },
  {
    id: 'RULE-0B2-PROTOCOL',
    capabilityId: CAPABILITY_IDS_0B2.PROTOCOL,
    domain: 'REPRESENTATION_PROTOCOL',
    actor: 'Organization administrators drafting and independently approving the representation protocol',
    routes: PROTOCOL_ROUTES,
    evidence: [
      ev(`${APP}lib/representation/protocol-service.ts`, 'Fails closed when the protocol is missing, malformed, unapproved or self-approved.'),
      ev(`${APP}lib/case-assignment-engine.ts`, 'Assignment requires a configured, independently approved protocol.'),
    ],
  },
  ...Object.entries(PKI_DOMAIN_ROUTES).map(([domain, routes]) => ({
    id: `RULE-0B2-${domain.replaceAll('_', '-')}`,
    capabilityId: CAPABILITY_IDS_0B2.PKI,
    domain,
    actor: domain === 'PKI_SIGNING' ? 'Organization administrator signing or verifying a document signature as themselves' : 'Organization administrator reading or cancelling a signing workflow',
    routes,
    evidence: [
      ev(`${APP}services/pki/signature-service.ts`, 'signatureValue: \'ATTESTATION\''),
      ev(`${APP}services/pki/workflow-engine.ts`, 'return new Map<string, WorkflowDefinition>()'),
    ],
  })),
  ...Object.entries(OPERATOR_DOMAIN_ROUTES).map(([domain, routes]) => ({
    id: `RULE-0B2-${domain.replaceAll('_', '-')}`,
    capabilityId: CAPABILITY_IDS_0B2.OPERATOR,
    domain,
    actor: {
      PLATFORM_DATABASE_OPERATIONS: 'Platform operator inspecting or maintaining the shared database',
      PLATFORM_JOB_QUEUE: 'Platform operator controlling the shared background job queues',
      PLATFORM_FEATURE_FLAGS: 'Platform operator reading and toggling platform feature flags',
      PILOT_OPERATIONS: 'Platform operator reading pilot status for an organization',
      PLATFORM_AI_CACHE: 'Platform operator inspecting and clearing the shared embedding cache',
    }[domain],
    routes,
    evidence: OPERATOR_EVIDENCE[domain],
  })),
  ...Object.entries(ENUMERATION_DOMAIN_ROUTES).map(([domain, routes]) => ({
    id: `RULE-0B2-${domain.replaceAll('_', '-')}`,
    capabilityId: CAPABILITY_IDS_0B2.ENUMERATION,
    domain,
    actor: domain === 'PLATFORM_DIRECTORY' ? 'Platform operator enumerating users and organizations across organizations' : 'Platform operator reading statistics and aggregates across organizations',
    routes,
    evidence: ENUMERATION_EVIDENCE[domain],
  })),
  ...Object.entries(AI_DOMAIN_ROUTES).map(([domain, routes]) => ({
    id: `RULE-0B2-${domain.replaceAll('_', '-')}`,
    capabilityId: CAPABILITY_IDS_0B2.AI,
    domain,
    actor: {
      AI_GRIEVANCE_ADVISORY: 'Steward requesting advisory AI analysis of a grievance',
      AI_CLAUSE_PRECEDENT: 'Staff requesting advisory AI classification, extraction or precedent matching',
      AI_COPILOT: 'Steward using the advisory AI copilot and recording the outcome',
      AI_FINANCE_PENSION: 'Officer requesting advisory AI analysis of finance or pension data',
      AI_INSIGHTS: 'Officer requesting advisory AI insight reports and employer risk scores',
      AI_KNOWLEDGE_SEARCH: 'Member requesting AI search, semantic search or summarization of the knowledge base',
      AI_KNOWLEDGE_INGESTION: 'Officer ingesting documents into the AI knowledge pipeline',
      AI_FEEDBACK_AND_USAGE: 'Organization member giving AI feedback and administrator reading AI usage',
      AI_MODEL_UTILITY: 'Officer running the local sequence model utility',
    }[domain],
    routes,
    evidence: [ev(`${APP}lib/ai/ai-feature-guard.ts`, 'export async function auditAiInteraction'), ...AI_EVIDENCE[domain]],
  })),
]

export function groupOfRoute(route) {
  return OWNERSHIP_GROUPS.find((group) => group.routes.includes(route))
}

export function ownershipRulesForTranche2() {
  return OWNERSHIP_GROUPS.map((group) => {
    const methods = group.methods ?? undefined
    const rule = {
      id: group.id,
      precedence: 40,
      prefixes: group.routes,
      capabilityId: group.capabilityId,
      disposition: 'OWNED',
      actor: group.actor,
      privacy: 'CAPABILITY',
      evidence: group.evidence,
    }
    if (methods) rule.methods = methods
    return rule
  })
}

export const CAPABILITY_DOMAINS = {
  ...DOMAINS_0B1,
  'UE-CAP-K-007': ['GENERIC_CRUD'],
  'UE-CAP-I-001': ['COLLECTIVE_AGREEMENTS'],
  'UE-CAP-A-003': ['MEMBER_ACCESS_REVOCATION'],
  [CAPABILITY_IDS_0B2.AI]: Object.keys(AI_DOMAIN_ROUTES),
  [CAPABILITY_IDS_0B2.AUDIT_VISIBILITY]: ['AUDIT_ACTIVITY_FEED'],
  [CAPABILITY_IDS_0B2.OPERATOR]: Object.keys(OPERATOR_DOMAIN_ROUTES),
  [CAPABILITY_IDS_0B2.ENUMERATION]: Object.keys(ENUMERATION_DOMAIN_ROUTES),
  [CAPABILITY_IDS_0B2.PKI]: Object.keys(PKI_DOMAIN_ROUTES),
  [CAPABILITY_IDS_0B2.PROTOCOL]: ['REPRESENTATION_PROTOCOL'],
  [CAPABILITY_IDS_0B2.EXPOSURE]: [],
}
