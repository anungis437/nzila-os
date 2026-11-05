/**
 * Gate 0B.1 ownership groups. Each group names the exact route files whose operations the tranche classified
 * with source evidence, the one existing capability that genuinely covers them, and the business domain.
 * Routes are listed by exact file. A route prefix or an HTTP method never decides ownership.
 */
export const TRANCHE_ID = 'GATE-0B.1'
export const TRANCHE_SIZE = 100
export const ANCHOR_COMMIT = 'ed2cf69d83f366ca431817c21113d7b6dd15fb28'

export const CRUD_ORG_MEMBERS_ROUTES = [
  'admin/alerts/escalations/[id]/route.ts',
  'admin/alerts/escalations/route.ts',
  'admin/alerts/executions/route.ts',
  'admin/alerts/recipients/[id]/route.ts',
  'admin/alerts/recipients/route.ts',
  'admin/alerts/rules/[id]/route.ts',
  'admin/alerts/rules/route.ts',
  'admin/clc/analytics/anomalies/route.ts',
  'admin/clc/analytics/patterns/route.ts',
  'admin/employment/[id]/route.ts',
  'admin/employment/member/[memberId]/history/route.ts',
  'admin/employment/member/[memberId]/route.ts',
  'admin/employment/route.ts',
  'admin/fix-super-admin-roles/route.ts',
  'admin/job-classifications/[id]/route.ts',
  'admin/job-classifications/route.ts',
  'admin/jobs/route.ts',
  'admin/leaves/[id]/route.ts',
  'admin/leaves/route.ts',
  'admin/lro/metrics/route.ts',
  'admin/members/bulk-import/route.ts',
  'admin/organizations/[id]/route.ts',
  'admin/organizations/bulk-import/route.ts',
  'admin/pki/certificates/[id]/route.ts',
  'admin/pki/certificates/route.ts',
  'admin/pki/signatures/route.ts',
  'admin/pki/workflows/route.ts',
  'admin/roles/batch/route.ts',
]

export const CRUD_ANALYTICS_METRICS_ROUTES = ['admin/clc/analytics/organizations/route.ts']

export const BILLING_ROUTES = [
  'admin/billing-cycles/preview/route.ts',
  'admin/billing-cycles/route.ts',
  'admin/billing-cycles/trigger-scheduled/route.ts',
]

export const CLC_REPORT_ROUTES = [
  'admin/clc/analytics/annual-report/route.ts',
  'admin/clc/analytics/forecast/route.ts',
  'admin/clc/analytics/multi-year-trends/route.ts',
  'admin/clc/analytics/trends/route.ts',
]

export const INGESTION_ROUTES = [
  'admin/duplicates/route.ts',
  'admin/ingest/batches/[id]/route.ts',
  'admin/ingest/batches/route.ts',
  'admin/ingest/retry/route.ts',
  'admin/ingest/route.ts',
]

export const DOCUMENT_BACKFILL_ROUTES = ['admin/documents/legacy-backfill/route.ts']

const CRUD_GOVERNANCE = 'apps/union-eyes/lib/api/crud-governance.ts'
const CRUD_FACTORY = 'apps/union-eyes/lib/api/crud-factory.ts'

export const OWNERSHIP_GROUPS = [
  {
    id: 'RULE-0B1-GENERIC-CRUD',
    capabilityId: 'UE-CAP-K-007',
    domain: 'GENERIC_CRUD',
    actor: 'Staff at the role floor through the generic CRUD factory',
    routes: [...CRUD_ORG_MEMBERS_ROUTES, ...CRUD_ANALYTICS_METRICS_ROUTES],
    evidence: [
      { kind: 'file', ref: CRUD_FACTORY, quote: 'export function crudRoutes' },
      { kind: 'file', ref: CRUD_GOVERNANCE, quote: 'Generic CRUD routes authorise by organization and role floor only' },
      { kind: 'file', ref: CRUD_GOVERNANCE, quote: 'export function assertCrudWrite' },
    ],
  },
  {
    id: 'RULE-0B1-BILLING-CYCLES',
    capabilityId: 'UE-CAP-D-003',
    domain: 'FINANCE_BILLING',
    actor: 'Platform lead running dues billing',
    routes: BILLING_ROUTES,
    evidence: [
      { kind: 'file', ref: 'apps/union-eyes/app/api/admin/billing-cycles/route.ts', quote: "hasMinRole('platform_lead')" },
      { kind: 'file', ref: 'apps/union-eyes/app/api/admin/billing-cycles/route.ts', quote: 'BillingCycleService.generateBillingCycle' },
    ],
  },
  {
    id: 'RULE-0B1-CLC-REMITTANCE-REPORTING',
    capabilityId: 'UE-OMIT-FINANCE-UNAVAILABLE',
    domain: 'FINANCE_REMITTANCE_REPORTING',
    actor: 'Organization administrator reading per-capita remittance analytics',
    routes: CLC_REPORT_ROUTES,
    evidence: [
      { kind: 'file', ref: 'apps/union-eyes/services/clc/compliance-reports.ts', quote: 'export async function generateAnnualComplianceReport' },
      { kind: 'file', ref: 'apps/union-eyes/services/clc/compliance-reports.ts', quote: '.from(perCapitaRemittances)' },
    ],
  },
  {
    id: 'RULE-0B1-CASE-INGESTION',
    capabilityId: 'UE-CAP-K-010',
    domain: 'CASE_INGESTION',
    actor: 'Organization administrator importing and reviewing legacy case data',
    routes: INGESTION_ROUTES,
    evidence: [
      { kind: 'file', ref: 'apps/union-eyes/app/api/admin/ingest/route.ts', quote: "action: 'admin.case_ingest'" },
      { kind: 'file', ref: 'apps/union-eyes/db/schema/ingestion-schema.ts', quote: "// 'case' | 'document' | 'timeline_event'" },
    ],
  },
  {
    id: 'RULE-0B1-DOCUMENT-LEGACY-BACKFILL',
    capabilityId: 'UE-CAP-F-002',
    domain: 'DOCUMENT_STORAGE',
    actor: 'Platform administrator backfilling legacy document versions',
    routes: DOCUMENT_BACKFILL_ROUTES,
    evidence: [
      { kind: 'file', ref: 'apps/union-eyes/app/api/admin/documents/legacy-backfill/route.ts', quote: 'backfillLegacyDocumentVersions' },
    ],
  },
]

export function ownershipRulesForTranche() {
  return OWNERSHIP_GROUPS.map((group) => ({
    id: group.id,
    precedence: 40,
    prefixes: group.routes,
    capabilityId: group.capabilityId,
    disposition: 'OWNED',
    actor: group.actor,
    privacy: 'CAPABILITY',
    evidence: group.evidence,
  }))
}

export const CAPABILITY_DOMAINS = {
  'UE-CAP-K-007': ['GENERIC_CRUD'],
  'UE-CAP-D-003': ['FINANCE_BILLING'],
  'UE-OMIT-FINANCE-UNAVAILABLE': ['FINANCE_REMITTANCE_REPORTING'],
  'UE-CAP-K-010': ['CASE_INGESTION'],
  'UE-CAP-F-002': ['DOCUMENT_STORAGE'],
  'UE-OMIT-ROUTE-DOMAIN-SCOPE': ['UNRESOLVED'],
}
