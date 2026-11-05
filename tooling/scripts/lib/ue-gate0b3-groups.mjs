/**
 * Gate 0B.3 ownership groups. A group names the exact route files whose operations the tranche classified with
 * source evidence, the one capability whose obligation covers them, and the business domain. Routes are listed by
 * exact file. A route prefix or an HTTP method never decides ownership. The one operation Gate 0B.3 still cannot
 * place (billing/batch-status) belongs to no group.
 */
export const TRANCHE_ID = 'GATE-0B.3'
export const TRANCHE_SIZE = 100
export const CARRY_FORWARD_FROM = 'GATE-0B.2'
export const ANCHOR_COMMIT = 'e38eee48d8dbc7b4dddddeb4974ca4067213117a'
export const NEW_UNEXAMINED_COUNT = 99
export const CARRY_FORWARD_COUNT = 1
export const UNRESOLVED_OPERATION = 'billing/batch-status/[jobId]/route.ts|GET'

const APP = 'apps/union-eyes/'
const CRUD_FACTORY = `${APP}lib/api/crud-factory.ts`
const CRUD_GOVERNANCE = `${APP}lib/api/crud-governance.ts`
const DOCTRINE = 'Generic CRUD routes authorise by organization and role floor only'

export const CAPABILITY_IDS_0B3 = {
  BARGAINING: 'UE-OMIT-BARGAINING-RECORDS',
  PRECEDENT: 'UE-OMIT-ARBITRATION-PRECEDENT-LIBRARY',
  PLATFORM_BILLING: 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING',
  ANALYTICS_REPORT: 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION',
  OBSERVABILITY: 'UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY',
}

const ev = (ref, quote) => ({ kind: 'file', ref, quote })
const api = (route, quote) => ev(`${APP}app/api/${route}`, quote)

/** A file only partly inside the tranche: only the listed methods are classified; the others stay SCOPE_UNDECIDED. */
export const METHOD_FILTERS = {
  'analytics/insights/route.ts': ['POST'],
  'calendar-sync/connections/[id]/route.ts': ['DELETE'],
}

export const ANALYTICS_METRIC_ROUTES = [
  'analytics/members/churn-risk/route.ts',
  'analytics/members/cohorts/route.ts',
  'analytics/members/route.ts',
  'analytics/members/trends/route.ts',
  'analytics/operational/bottlenecks/route.ts',
  'analytics/operational/queues/route.ts',
  'analytics/operational/route.ts',
  'analytics/operational/sla/route.ts',
  'analytics/operational/workload/route.ts',
  'analytics/org-activity/route.ts',
  'analytics/precedent-stats/route.ts',
  'analytics/predictions/route.ts',
  'analytics/refresh/route.ts',
  'analytics/trends/route.ts',
]

export const DOMAIN_ROUTES = {
  GENERIC_CRUD_ANALYTICS: ['analytics/kpis/route.ts', ...ANALYTICS_METRIC_ROUTES],
  GENERIC_CRUD_INSIGHTS_POST: ['analytics/insights/route.ts'],
  GENERIC_CRUD_BREAKS: ['breaks/route.ts', 'breaks/[id]/route.ts', 'breaks/policies/route.ts', 'breaks/policies/[id]/route.ts'],
  GENERIC_CRUD_BULK_IMPORT: ['bulk-import/route.ts'],
  GENERIC_CRUD_CALENDAR_DISCONNECT: ['calendar-sync/connections/[id]/route.ts'],
  ARBITRATION_CASE_RECORDS: ['arbitrations/route.ts', 'arbitrations/[id]/route.ts'],
  FINANCE_EXTERNAL_INVOICES: ['billing/invoices/route.ts'],
  AUDIT_LOG_ENGAGEMENTS: ['audits/route.ts', 'audits/[id]/route.ts'],
  BARGAINING_NEGOTIATIONS: ['bargaining/negotiations/route.ts', 'bargaining/negotiations/[id]/route.ts'],
  BARGAINING_PROPOSALS: ['bargaining/proposals/route.ts', 'bargaining/proposals/[id]/route.ts'],
  BARGAINING_NOTES: ['bargaining-notes/route.ts', 'bargaining-notes/[id]/route.ts'],
  BARGAINING_TENTATIVE_AGREEMENTS: ['bargaining/tentative-agreements/route.ts'],
  ARBITRATION_DECISION_LIBRARY: [
    'arbitration/precedents/route.ts',
    'arbitration/precedents/[id]/route.ts',
    'arbitration/precedents/[id]/citations/route.ts',
    'arbitration/precedents/[id]/documents/route.ts',
    'arbitration/precedents/search/route.ts',
  ],
  PLATFORM_SUBSCRIPTIONS: ['billing/subscriptions/route.ts', 'billing/subscriptions/[id]/route.ts'],
  PLATFORM_INVOICING: ['billing/send-invoice/route.ts', 'billing/send-batch/route.ts', 'billing/replay-invoice/route.ts'],
  PLATFORM_TRIAL_EXPIRY: ['billing/credits/check-expired/route.ts'],
  BILLING_VALIDATION: ['billing/validate/route.ts'],
  ANALYTICS_COMPUTED_REPORTS: ['analytics/metrics/route.ts', 'analytics/insights/weekly-summary/route.ts', 'analytics/operational/derived-case-metrics/route.ts'],
  BREAK_COMPLIANCE_REPORT: ['breaks/compliance/route.ts'],
  OBSERVABILITY_ALERT_INBOX: ['alerts/realtime/route.ts'],
}

const GROUPS = {
  GENERIC_CRUD_ANALYTICS: {
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Staff at the role floor through the generic CRUD factory over analytics and KPI tables',
    evidence: [ev(CRUD_FACTORY, 'export function crudRoutes'), ev(CRUD_GOVERNANCE, DOCTRINE), ev(CRUD_GOVERNANCE, "'analytics_metrics'"), ev(CRUD_GOVERNANCE, "'kpi_configurations'")],
  },
  GENERIC_CRUD_INSIGHTS_POST: {
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Steward through the generic CRUD factory over insight_recommendations',
    evidence: [ev(CRUD_FACTORY, 'export function crudRoutes'), ev(CRUD_GOVERNANCE, DOCTRINE), ev(CRUD_GOVERNANCE, "'insight_recommendations'")],
  },
  GENERIC_CRUD_BREAKS: {
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Member and staff through the generic CRUD factory over break policy and member break tables',
    evidence: [ev(CRUD_FACTORY, 'export function crudRoutes'), ev(CRUD_GOVERNANCE, DOCTRINE), ev(CRUD_GOVERNANCE, "'member_breaks'"), ev(CRUD_GOVERNANCE, "'break_policies'")],
  },
  GENERIC_CRUD_BULK_IMPORT: {
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Staff at the role floor through the generic CRUD factory over organization_members',
    evidence: [ev(CRUD_FACTORY, 'export function crudRoutes'), ev(CRUD_GOVERNANCE, DOCTRINE), ev(CRUD_GOVERNANCE, "'organization_members', 'organizations', 'profiles'")],
  },
  GENERIC_CRUD_CALENDAR_DISCONNECT: {
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Organization administrator through the generic CRUD factory over external calendar connections',
    evidence: [ev(CRUD_FACTORY, 'export function crudRoutes'), ev(CRUD_GOVERNANCE, DOCTRINE), ev(CRUD_GOVERNANCE, "'external_calendar_connections'")],
  },
  ARBITRATION_CASE_RECORDS: {
    capabilityId: 'UE-CAP-K-010',
    domain: 'ARBITRATION_CASE_RECORDS',
    actor: 'Steward and above reading and writing the arbitration stage of a grievance',
    evidence: [
      ev(`${APP}db/schema/grievance-schema.ts`, 'grievanceId: uuid("grievance_id").references(() => grievances.id).notNull(),'),
      ev(CRUD_GOVERNANCE, "'arbitrations'"),
      api('arbitrations/route.ts', 'table: arbitrations,'),
    ],
  },
  FINANCE_EXTERNAL_INVOICES: {
    capabilityId: 'UE-CAP-D-003',
    domain: 'FINANCE_EXTERNAL_INVOICES',
    actor: 'Organization member reading union accounting-system invoices synchronized from an external ledger',
    evidence: [
      ev(`${APP}db/schema/domains/data/accounting.ts`, 'external_invoices: Invoices from external accounting systems'),
      ev(`${APP}lib/integrations/adapters/accounting/sync-utils.ts`, 'externalInvoices'),
    ],
  },
  AUDIT_LOG_ENGAGEMENTS: {
    capabilityId: 'UE-OMIT-AUDIT-LOG-VISIBILITY',
    domain: 'AUDIT_LOG_ENGAGEMENTS',
    actor: 'Officer reading organization audit-log rows presented as audit engagements',
    evidence: [api('audits/route.ts', 'Organization audit logs from PostgreSQL.'), ev(`${APP}app/[locale]/dashboard/audits/page.tsx`, '/api/audits')],
  },
  BARGAINING_NEGOTIATIONS: {
    capabilityId: 'UE-OMIT-BARGAINING-RECORDS',
    domain: 'BARGAINING_NEGOTIATIONS',
    actor: 'Member and steward reading and maintaining collective-bargaining negotiation records',
    evidence: [
      ev(`${APP}db/schema/bargaining-negotiations-schema.ts`, 'export const negotiationStatusEnum = pgEnum("negotiation_status", ['),
      ev(`${APP}lib/executive/capability-matrix.ts`, "sources: ['/dashboard/bargaining', 'app/api/bargaining/negotiations', 'app/api/bargaining/proposals']"),
    ],
  },
  BARGAINING_PROPOSALS: {
    capabilityId: 'UE-OMIT-BARGAINING-RECORDS',
    domain: 'BARGAINING_PROPOSALS',
    actor: 'Member and steward reading and maintaining bargaining proposals within a negotiation',
    evidence: [
      ev(`${APP}db/schema/bargaining-negotiations-schema.ts`, 'export const bargainingProposals = pgTable("bargaining_proposals", {'),
      ev(`${APP}lib/executive/capability-matrix.ts`, "sources: ['/dashboard/bargaining', 'app/api/bargaining/negotiations', 'app/api/bargaining/proposals']"),
    ],
  },
  BARGAINING_NOTES: {
    capabilityId: 'UE-OMIT-BARGAINING-RECORDS',
    domain: 'BARGAINING_NOTES',
    actor: 'Member and steward reading and recording bargaining session notes under a confidentiality level',
    evidence: [
      ev(`${APP}db/schema/cba-intelligence-schema.ts`, '// Bargaining notes (corporate knowledge preservation)'),
      ev(`${APP}lib/services/bargaining-notes-service.ts`, 'visibleToUserId'),
    ],
  },
  BARGAINING_TENTATIVE_AGREEMENTS: {
    capabilityId: 'UE-OMIT-BARGAINING-RECORDS',
    domain: 'BARGAINING_TENTATIVE_AGREEMENTS',
    actor: 'Member and steward reading and recording tentative agreements reached in a negotiation',
    evidence: [
      api('bargaining/tentative-agreements/route.ts', 'is derived entirely through negotiation_id -> negotiations.organization_id'),
      ev(`${APP}db/schema/bargaining-negotiations-schema.ts`, 'negotiationStatusEnum'),
    ],
  },
  ARBITRATION_DECISION_LIBRARY: {
    capabilityId: 'UE-OMIT-ARBITRATION-PRECEDENT-LIBRARY',
    domain: 'ARBITRATION_DECISION_LIBRARY',
    actor: 'Member reading and content manager maintaining the shared arbitration decision library',
    evidence: [
      ev(`${APP}db/schema/cba-intelligence-schema.ts`, 'export const arbitrationDecisions = pgTable("arbitration_decisions", {'),
      ev(`${APP}components/precedents/precedents-console.tsx`, '/api/arbitration/precedents'),
    ],
  },
  PLATFORM_SUBSCRIPTIONS: {
    capabilityId: 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING',
    domain: 'PLATFORM_SUBSCRIPTIONS',
    actor: 'Organization representative viewing, pausing, resuming and cancelling the organization subscription to the platform',
    evidence: [
      ev('docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md', '`services/platform-economics` (Nzila SaaS billing) | Nzila platform billing | Labelled; not union finance'),
      api('billing/subscriptions/route.ts', "import { pauseSubscription, resumeSubscription } from '@/services/platform-economics';"),
    ],
  },
  PLATFORM_INVOICING: {
    capabilityId: 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING',
    domain: 'PLATFORM_INVOICING',
    actor: 'Platform billing: generating and replaying platform invoices for subscribed organizations',
    evidence: [
      ev('docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md', '`services/platform-economics` (Nzila SaaS billing) | Nzila platform billing | Labelled; not union finance'),
      api('billing/send-invoice/route.ts', "import { generateInvoice } from '@/services/platform-economics';"),
    ],
  },
  PLATFORM_TRIAL_EXPIRY: {
    capabilityId: 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING',
    domain: 'PLATFORM_TRIAL_EXPIRY',
    actor: 'Organization representative expiring the organization platform trial',
    evidence: [
      ev('docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md', '`services/platform-economics` (Nzila SaaS billing) | Nzila platform billing | Labelled; not union finance'),
      api('billing/credits/check-expired/route.ts', "import { expireTrials } from '@/services/platform-economics/subscription-lifecycle-service';"),
    ],
  },
  BILLING_VALIDATION: {
    capabilityId: 'UE-OMIT-PLATFORM-SUBSCRIPTION-BILLING',
    domain: 'BILLING_VALIDATION',
    actor: 'Organization representative validating a platform billing amount against the CAD-only rule',
    evidence: [
      ev('docs/union-eyes/financial-officer/UE_FINANCIAL_OFFICER_2_1_CONVERGENCE_DISPOSITION.md', '`services/platform-economics` (Nzila SaaS billing) | Nzila platform billing | Labelled; not union finance'),
      api('billing/validate/route.ts', "import { requireEntitlement } from '@/services/platform-economics/entitlement-guard';"),
    ],
  },
  ANALYTICS_COMPUTED_REPORTS: {
    capabilityId: 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION',
    domain: 'ANALYTICS_COMPUTED_REPORTS',
    actor: 'Steward computing and member reading organization analytics, engagement summaries and case metrics',
    evidence: [
      ev(`${APP}components/analytics/analytics-dashboard.tsx`, "fetch('/api/analytics/metrics?limit=10')"),
      api('analytics/metrics/route.ts', 'Endpoint for calculating and retrieving analytics metrics'),
    ],
  },
  BREAK_COMPLIANCE_REPORT: {
    capabilityId: 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION',
    domain: 'BREAK_COMPLIANCE_REPORT',
    actor: 'Steward and officer reviewing per-member break compliance for the organization',
    evidence: [api('breaks/compliance/route.ts', 'useful for stewards and officers reviewing employer compliance')],
  },
  OBSERVABILITY_ALERT_INBOX: {
    capabilityId: 'UE-OMIT-OBSERVABILITY-ALERT-VISIBILITY',
    domain: 'OBSERVABILITY_ALERT_INBOX',
    actor: 'Organization member reading the realtime alerts the observability sweep records for the organization',
    evidence: [
      ev(`${APP}services/observability/realtime-alerting-service.ts`, "category: 'realtime-observability',"),
      ev(`${APP}services/observability/realtime-alerting-service.ts`, 'export async function runRealtimeObservabilitySweep'),
    ],
  },
}

export const OWNERSHIP_GROUPS = Object.entries(GROUPS).map(([domainKey, group]) => {
  const routes = DOMAIN_ROUTES[domainKey]
  const methods = routes.length === 1 ? METHOD_FILTERS[routes[0]] : undefined
  return {
    id: `RULE-0B3-${domainKey.replaceAll('_', '-')}`,
    domainKey,
    ...group,
    routes,
    ...(methods ? { methods } : {}),
  }
})

export function groupOfRoute(route, method) {
  return OWNERSHIP_GROUPS.find((group) => group.routes.includes(route) && (!group.methods || !method || group.methods.includes(method)))
}

export function ownershipRulesForTranche3() {
  return OWNERSHIP_GROUPS.map((group) => {
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
    if (group.methods) rule.methods = group.methods
    return rule
  })
}

export const CAPABILITY_DOMAINS = {
  'UE-CAP-K-007': ['GENERIC_CRUD'],
  'UE-CAP-K-010': ['ARBITRATION_CASE_RECORDS'],
  'UE-CAP-D-003': ['FINANCE_EXTERNAL_INVOICES'],
  'UE-OMIT-AUDIT-LOG-VISIBILITY': ['AUDIT_LOG_ENGAGEMENTS'],
  [CAPABILITY_IDS_0B3.BARGAINING]: ['BARGAINING_NEGOTIATIONS', 'BARGAINING_PROPOSALS', 'BARGAINING_NOTES', 'BARGAINING_TENTATIVE_AGREEMENTS'],
  [CAPABILITY_IDS_0B3.PRECEDENT]: ['ARBITRATION_DECISION_LIBRARY'],
  [CAPABILITY_IDS_0B3.PLATFORM_BILLING]: ['PLATFORM_SUBSCRIPTIONS', 'PLATFORM_INVOICING', 'PLATFORM_TRIAL_EXPIRY', 'BILLING_VALIDATION'],
  [CAPABILITY_IDS_0B3.ANALYTICS_REPORT]: ['ANALYTICS_COMPUTED_REPORTS', 'BREAK_COMPLIANCE_REPORT'],
  [CAPABILITY_IDS_0B3.OBSERVABILITY]: ['OBSERVABILITY_ALERT_INBOX'],
}
