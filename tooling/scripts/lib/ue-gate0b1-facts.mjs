/**
 * Gate 0B.1 source facts. Every statement here was read from the cited route, service, or guard file. The builder
 * refuses to write the register unless each cited quote is present in its file, so a stale fact fails the build.
 */
import { BILLING_ROUTES, CLC_REPORT_ROUTES, CRUD_ANALYTICS_METRICS_ROUTES, CRUD_ORG_MEMBERS_ROUTES, DOCUMENT_BACKFILL_ROUTES, INGESTION_ROUTES } from './ue-gate0b1-groups.mjs'

const APP = 'apps/union-eyes/app/api/'
const CRUD_FACTORY = 'apps/union-eyes/lib/api/crud-factory.ts'
const CRUD_GOVERNANCE = 'apps/union-eyes/lib/api/crud-governance.ts'
const LOW_ROLE = 'apps/union-eyes/lib/api/crud-low-role-guard.ts'
const ORG_SCHEMA = 'apps/union-eyes/db/schema-organizations.ts'
const COMPLIANCE = 'apps/union-eyes/services/clc/compliance-reports.ts'
const PROTOCOL = 'apps/union-eyes/lib/representation/protocol-service.ts'
const WORKFLOW = 'apps/union-eyes/services/pki/workflow-engine.ts'

const ev = (ref, quote) => ({ ref, quote })
const routeEv = (route, quote) => ev(`${APP}${route}`, quote)

export const DEFECTS = [
  { id: 'DEF-0B1-CRUD-FACADE-ORG-MEMBERS', gate: 13, severity: 'HIGH', title: 'Route name advertises a business domain but the handler is the generic CRUD factory over organization_members; GET returns member roster rows under the advertised name and every write is refused.' },
  { id: 'DEF-0B1-FIX-SUPER-ADMIN-INERT', gate: 13, severity: 'HIGH', title: 'The super-admin role repair route is the generic CRUD factory over organization_members; its documented repair does nothing and POST is refused.' },
  { id: 'DEF-0B1-CLC-ANALYTICS-WRITABLE', gate: 13, severity: 'MEDIUM', title: 'The CLC organization analytics route is the generic CRUD factory over analytics_metrics, an OPERATIONAL table; any steward can create arbitrary analytics metric rows.' },
  { id: 'DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', gate: 14, severity: 'MEDIUM', title: 'The mutation is audited through performAuditedOperation, which records intent and outcome in separate transactions from the effect. The manifest declares an atomic audit that the source does not show.' },
  { id: 'DEF-0B1-MANIFEST-DETECTOR', gate: 15, severity: 'MEDIUM', title: 'The route-coverage scanner misreports this operation: it marks CRUD reads as mutating, overstates the audit class, and misses the guard actually applied.' },
  { id: 'DEF-0B1-BILLING-HISTORY-FAKE-EMPTY', gate: 5, severity: 'HIGH', title: 'Billing history returns HTTP 200 with an empty list for a capability that has no storage; it must be an honest HTTP 501.' },
  { id: 'DEF-0B1-BILLING-TARGET-ORG-UNBOUND', gate: 5, severity: 'HIGH', title: 'The target organization of a billing operation is caller-supplied and the guard checks only the caller role title, not authority over that organization.' },
  { id: 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY', gate: 13, severity: 'MEDIUM', title: 'A platform-wide read or operation is authorized by a role-title floor, not by a kernel decision or a platform-staff mandate.' },
  { id: 'DEF-0B1-BILLING-SCHEDULER-LATENT', gate: 5, severity: 'MEDIUM', title: 'Scheduled billing is latent: no scheduler calls it and the generator needs a session, so the route triggers work the system cannot run headless.' },
  { id: 'DEF-0B1-CLC-CROSS-TENANT-READ', gate: 14, severity: 'HIGH', title: 'The report queries per_capita_remittances with no caller-organization predicate, so an organization administrator reads remittance data across organizations.' },
  { id: 'DEF-0B1-CLC-PUBLIC-CACHE-CONTROL', gate: 14, severity: 'MEDIUM', title: 'Administrator-only financial analytics is served with Cache-Control public, so shared caches may store it.' },
  { id: 'DEF-0B1-AUDIT-READ-MEMBER-FLOOR', gate: 14, severity: 'HIGH', title: 'The organization audit log (user ids, resource ids, event details) is readable at the member role floor.' },
  { id: 'DEF-0B1-AI-USAGE-LEGACY-CROSS-TENANT', gate: 14, severity: 'MEDIUM', title: 'On the legacy path the AI-usage query reads audit_security rows for every organization with no organization predicate.' },
  { id: 'DEF-0B1-ORGANIZATIONS-CROSS-ORG-CONTACTS', gate: 14, severity: 'HIGH', title: 'The organization directory returns member counts and contact name and email across organizations at a role-title floor.' },
  { id: 'DEF-0B1-PKI-WORKFLOW-IN-MEMORY', gate: 6, severity: 'HIGH', title: 'PKI signing workflow state lives in a process-local Map; the signature_workflows table does not exist, so workflows are lost on restart and not shared across instances.' },
  { id: 'DEF-0B1-REP-PROTOCOL-NOT-IN-CAPABILITY-MODEL', gate: 2, severity: 'LOW', title: 'The representation protocol is a real, atomically audited, separation-of-duties flow that no capability names; ownership needs a Gate 0B.2 decision.' },
  { id: 'DEF-0B1-ALLOWLIST-DRIFT', gate: 15, severity: 'MEDIUM', title: 'The three public-route lists disagree and the edge does not enforce them; routes that accept anonymous calls are absent from the lists.' },
  { id: 'DEF-0B1-DOCS-UNAUTH-API-SURFACE', gate: 14, severity: 'MEDIUM', title: 'The complete OpenAPI specification is served without authentication and is not on the public-route allowlist.' },
  { id: 'DEF-0B1-VERSION-UNAUTH-TOPOLOGY', gate: 14, severity: 'MEDIUM', title: 'The version route exposes environment, host, deployment type, feature profile and image digests without authentication and is not on the public-route allowlist.' },
  { id: 'DEF-0B1-COMMS-TRACKING-GET-MUTATES', gate: 11, severity: 'MEDIUM', title: 'Tracking, click and unsubscribe handlers change state on GET (message log, campaign counters, preferences, consent records) although the manifest records them as read-only.' },
  { id: 'DEF-0B1-ICRA-TELEMETRY-PROCESS-LOCAL-LIMIT', gate: 14, severity: 'LOW', title: 'Anonymous telemetry is limited by a process-local in-memory limiter, which does not hold across instances.' },
]

const CRUD_GET = { field: 'mutating', manifest: 'mutating true, audit CRUD_ATOMIC', actual: 'A GET reads rows and writes nothing.' }
const CRUD_REFUSED = { field: 'audit', manifest: 'audit CRUD_ATOMIC', actual: 'organization_members is READ_ONLY, so the write is refused before any row or audit record is written.' }

function advertised(route) {
  return route.replace(/\/route\.ts$/, '').replace(/^admin\//, '').replace(/\/\[[^\]]+\]/g, '')
}

export function crudFacts(route, method) {
  const isMetrics = CRUD_ANALYTICS_METRICS_ROUTES.includes(route)
  const readRole = route === 'admin/fix-super-admin-roles/route.ts' ? 'admin' : 'member'
  const writeRole = route === 'admin/fix-super-admin-roles/route.ts' ? 'admin' : 'steward'
  const table = isMetrics ? 'analyticsMetrics' : 'organizationMembers'
  const isRead = method === 'GET'
  const floor = isRead ? readRole : method === 'DELETE' ? 'admin' : writeRole
  const defects = isMetrics ? ['DEF-0B1-CLC-ANALYTICS-WRITABLE', 'DEF-0B1-MANIFEST-DETECTOR'] : ['DEF-0B1-CRUD-FACADE-ORG-MEMBERS', 'DEF-0B1-MANIFEST-DETECTOR']
  if (route === 'admin/fix-super-admin-roles/route.ts') defects.push('DEF-0B1-FIX-SUPER-ADMIN-INERT')
  const evidence = [routeEv(route, `table: ${table},`), routeEv(route, `readRole: '${readRole}',`), ev(CRUD_FACTORY, 'export function crudRoutes')]
  const corrections = []
  let mutationAudit = 'NOT_MUTATING'
  let auditDetail = 'A read: the generic factory writes no row and no audit record.'
  let implementationStatus = 'FACADE_OVER_GENERIC_TABLE'
  if (isRead) {
    corrections.push(CRUD_GET)
    evidence.push(ev(LOW_ROLE, 'Callers below steward are therefore held to'))
  } else if (isMetrics) {
    mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
    auditDetail = 'analytics_metrics is OPERATIONAL, so the write proceeds and the factory commits the audit record in the same tenant transaction (crud.analytics_metrics.<action>).'
    evidence.push(ev(CRUD_FACTORY, 'await persistAtomicAudit(tx, {'), ev(CRUD_GOVERNANCE, "'analytics_metrics'"))
  } else {
    mutationAudit = 'WRITE_REFUSED_BY_GOVERNANCE'
    auditDetail = 'organization_members is READ_ONLY in the CRUD governance table, so assertCrudWrite refuses with 403 before any write; nothing is mutated and nothing is audited.'
    evidence.push(ev(CRUD_GOVERNANCE, 'export function assertCrudWrite'), ev(CRUD_GOVERNANCE, "'organization_members', 'organizations', 'profiles'"))
    corrections.push(CRUD_REFUSED)
  }
  evidence.push(ev(ORG_SCHEMA, "email: text('email').notNull(),"))
  return {
    domain: 'GENERIC_CRUD',
    crudTable: isMetrics ? 'analytics_metrics' : 'organization_members',
    crudGovernanceClass: isMetrics ? 'OPERATIONAL' : 'READ_ONLY',
    persona: `Staff at the ${floor} role floor through the generic CRUD factory`,
    serviceOwner: 'apps/union-eyes/lib/api/crud-factory.ts (crudRoutes)',
    authorizationCategory: 'ROLE_FLOOR',
    kernelAuthorization: false,
    authorizationDetail: `withApi minRole ${floor} plus the CRUD governance class of ${isMetrics ? 'analytics_metrics (OPERATIONAL)' : 'organization_members (READ_ONLY)'}. A role floor is eligibility, not a kernel decision.`,
    tenantScope: 'Organization-scoped (orgScoped true, RLS organization context); a caller below steward is limited to their own row.',
    dataSensitivity: isMetrics ? 'Operational analytics metrics' : 'Member roster personal data (name, email, phone, role, status)',
    mutationAudit,
    auditDetail,
    implementationStatus,
    evidence,
    defects,
    manifestCorrections: corrections,
    advertisedSurface: `Advertises ${advertised(route)} but ${isMetrics ? 'reads and writes analytics_metrics rows' : 'serves organization_members rows'}.`,
  }
}

const BILLING_POST_CORRECTION = { field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'performAuditedOperation records the intent in one transaction and the outcome in another; it is not committed with the billing effect.' }

const billing = {
  'admin/billing-cycles/preview/route.ts|POST': {
    persona: 'Platform lead previewing a dues billing cycle',
    serviceOwner: 'apps/union-eyes/lib/services/billing-cycle-service.ts (BillingCycleService)',
    mutationAudit: 'NOT_MUTATING',
    nonMutationReason: 'dryRun is hard-coded true, so generateBillingCycle computes the preview and creates no transaction.',
    auditDetail: 'A preview writes nothing and is not audited.',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/billing-cycles/preview/route.ts', "hasMinRole('platform_lead')"), routeEv('admin/billing-cycles/preview/route.ts', 'dryRun: true, // Always dry run for preview')],
    defects: ['DEF-0B1-BILLING-TARGET-ORG-UNBOUND', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [{ field: 'mutating', manifest: 'mutating true, audit COMPUTE_ONLY', actual: 'The route computes a preview only and never writes.' }],
  },
  'admin/billing-cycles/route.ts|GET': {
    persona: 'Platform lead reading billing history',
    serviceOwner: 'apps/union-eyes/app/api/admin/billing-cycles/route.ts (inline, no service)',
    mutationAudit: 'NOT_MUTATING',
    auditDetail: 'A read that returns a constant empty list.',
    implementationStatus: 'NOT_IMPLEMENTED_RETURNS_200',
    evidence: [routeEv('admin/billing-cycles/route.ts', 'No dedicated billing_cycle_history table exists yet; return empty with proper semantics'), routeEv('admin/billing-cycles/route.ts', 'cycles: [],')],
    defects: ['DEF-0B1-BILLING-HISTORY-FAKE-EMPTY', 'DEF-0B1-BILLING-TARGET-ORG-UNBOUND', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [{ field: 'mutating', manifest: 'mutating true, audit ATOMIC_SERVICE', actual: 'The GET returns a constant empty list and touches no data.' }],
  },
  'admin/billing-cycles/route.ts|POST': {
    persona: 'Platform lead generating a dues billing cycle',
    serviceOwner: 'apps/union-eyes/lib/services/billing-cycle-service.ts (BillingCycleService)',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
    auditDetail: 'A real cycle is wrapped in performAuditedOperation (intent, then outcome). A dry run writes nothing and is not audited.',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/billing-cycles/route.ts', "hasMinRole('platform_lead')"), routeEv('admin/billing-cycles/route.ts', 'await performAuditedOperation('), routeEv('admin/billing-cycles/route.ts', 'organizationId: z.guid(),')],
    defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-BILLING-TARGET-ORG-UNBOUND', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [BILLING_POST_CORRECTION],
  },
  'admin/billing-cycles/trigger-scheduled/route.ts|POST': {
    persona: 'Platform lead manually triggering scheduled billing for all organizations',
    serviceOwner: 'apps/union-eyes/lib/jobs/billing-scheduler.ts (BillingScheduler)',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
    auditDetail: 'The run is wrapped in performAuditedOperation against the caller organization. The billing effects are not in that transaction.',
    implementationStatus: 'LATENT_NOT_OPERATIONAL',
    evidence: [routeEv('admin/billing-cycles/trigger-scheduled/route.ts', 'LATENT / NOT_OPERATIONAL'), routeEv('admin/billing-cycles/trigger-scheduled/route.ts', 'BillingScheduler.manualTrigger(frequency)'), routeEv('admin/billing-cycles/trigger-scheduled/route.ts', 'await performAuditedOperation(')],
    defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-BILLING-SCHEDULER-LATENT', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [BILLING_POST_CORRECTION],
  },
}

export function billingFacts(route, method) {
  const fact = billing[`${route}|${method}`]
  return {
    domain: 'FINANCE_BILLING',
    authorizationCategory: 'PLATFORM_ROLE_FLOOR',
    kernelAuthorization: false,
    authorizationDetail: "withApiAuth plus hasMinRole('platform_lead'): a role-title check. No kernel financial mandate is consulted.",
    tenantScope: 'Caller-supplied target organization (body or query); the guard checks the caller role title only.',
    dataSensitivity: 'Financial: dues charges and billing totals',
    ...fact,
  }
}

const CLC_COMMON = {
  domain: 'FINANCE_REMITTANCE_REPORTING',
  persona: 'Organization administrator reading CLC per-capita remittance analytics',
  serviceOwner: 'apps/union-eyes/services/clc/compliance-reports.ts',
  authorizationCategory: 'ROLE_FLOOR',
  kernelAuthorization: false,
  authorizationDetail: "withRoleAuth('admin'): an organization role-title check. No kernel financial mandate is consulted.",
  tenantScope: 'No caller-organization predicate: the service reads per_capita_remittances by year only.',
  dataSensitivity: 'Financial: per-capita remittance amounts across organizations',
  mutationAudit: 'NOT_MUTATING',
  auditDetail: 'A read. The route emits an API log event; no durable audit record is claimed.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  defects: ['DEF-0B1-CLC-CROSS-TENANT-READ', 'DEF-0B1-CLC-PUBLIC-CACHE-CONTROL'],
  manifestCorrections: [],
}

export function clcReportFacts(route) {
  const base = { ...CLC_COMMON }
  const own = [routeEv(route, "withRoleAuth('admin'"), routeEv(route, 'Cache-Control')]
  if (route.endsWith('forecast/route.ts')) {
    return { ...base, evidence: [...own, routeEv(route, 'forecastRemittances(monthsAhead)'), ev(COMPLIANCE, 'export async function forecastRemittances')] }
  }
  if (route.endsWith('annual-report/route.ts')) {
    return { ...base, evidence: [...own, ev(COMPLIANCE, 'export async function generateAnnualComplianceReport(year: number)'), ev(COMPLIANCE, '.where(eq(perCapitaRemittances.remittanceYear, year));')] }
  }
  return { ...base, evidence: [...own, ev(COMPLIANCE, 'export async function analyzeMultiYearTrends'), ev(COMPLIANCE, '.where(eq(perCapitaRemittances.remittanceYear, year));')] }
}

const INGEST_OWN_AUDIT = { field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'performAuditedOperation records intent and outcome around the import; it is not committed with the cases.' }
const ingestion = {
  'admin/duplicates/route.ts|GET': { persona: 'Organization administrator reviewing duplicate groups', mutationAudit: 'NOT_MUTATING', auditDetail: 'A read of duplicate_groups for the caller organization.', evidence: [routeEv('admin/duplicates/route.ts', "auth: { minRole: 'admin' },"), routeEv('admin/duplicates/route.ts', 'eq(duplicateGroups.organizationId, organizationId)')], defects: ['DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [{ field: 'mutating', manifest: 'mutating true, audit ATOMIC', actual: 'A GET lists duplicate groups and writes nothing.' }], tenantScope: 'Organization predicate on every query (duplicateGroups.organizationId).' },
  'admin/duplicates/route.ts|POST': { persona: 'Organization administrator resolving a duplicate group', mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION', auditDetail: 'The status update and persistAtomicAudit commit in one withRLSContext transaction (duplicate.<action>).', evidence: [routeEv('admin/duplicates/route.ts', "auth: { minRole: 'admin' },"), routeEv('admin/duplicates/route.ts', 'await persistAtomicAudit(tx, {'), routeEv('admin/duplicates/route.ts', 'The resolution and its audit record commit together.')], defects: [], manifestCorrections: [], tenantScope: 'Organization predicate on the read and on the update; RLS organization context.' },
  'admin/ingest/batches/[id]/route.ts|GET': { persona: 'Organization administrator reading an ingestion batch', mutationAudit: 'NOT_MUTATING', auditDetail: 'A read of one batch for the caller organization.', evidence: [routeEv('admin/ingest/batches/[id]/route.ts', "auth: { minRole: 'admin' },"), routeEv('admin/ingest/batches/[id]/route.ts', 'getBatchDetail(batchId, organizationId)')], defects: [], manifestCorrections: [], tenantScope: 'Batch lookup takes the caller organizationId.' },
  'admin/ingest/batches/route.ts|GET': { persona: 'Organization administrator listing ingestion batches', mutationAudit: 'NOT_MUTATING', auditDetail: 'A read of batch metrics for the caller organization.', evidence: [routeEv('admin/ingest/batches/route.ts', "auth: { minRole: 'admin' },"), routeEv('admin/ingest/batches/route.ts', 'getMetricsSummary(organizationId)')], defects: [], manifestCorrections: [], tenantScope: 'Listing and summary take the caller organizationId.' },
  'admin/ingest/retry/route.ts|POST': { persona: 'Organization administrator retrying failed ingestion records', mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION', auditDetail: 'The record reset and persistAtomicAudit commit in one withRLSContext transaction.', evidence: [routeEv('admin/ingest/retry/route.ts', "auth: { minRole: 'admin' },"), routeEv('admin/ingest/retry/route.ts', 'await persistAtomicAudit(tx, {')], defects: [], manifestCorrections: [], tenantScope: 'Batch lookup and the record update are predicated on the caller organization.' },
  'admin/ingest/route.ts|POST': { persona: 'Organization administrator importing legacy cases', mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', auditDetail: 'A real import is wrapped in performAuditedOperation (intent, then outcome). A dry run writes nothing.', evidence: [routeEv('admin/ingest/route.ts', "auth: { minRole: 'admin' },"), routeEv('admin/ingest/route.ts', 'await performAuditedOperation('), routeEv('admin/ingest/route.ts', "action: 'admin.case_ingest',")], defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [INGEST_OWN_AUDIT], tenantScope: 'Records naming another organization are rejected against the caller organizationId.' },
}

export function ingestionFacts(route, method) {
  return {
    domain: 'CASE_INGESTION',
    serviceOwner: route.startsWith('admin/duplicates') ? 'apps/union-eyes/db/schema/ingestion-schema.ts (duplicate_groups) via the route' : 'apps/union-eyes/lib/ingestion',
    authorizationCategory: 'ROLE_FLOOR',
    kernelAuthorization: false,
    authorizationDetail: 'withApi minRole admin: an organization role-title check. No kernel decision is consulted for the case-affecting write.',
    dataSensitivity: 'Case and member data imported from legacy systems',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    ...ingestion[`${route}|${method}`],
  }
}

export function backfillFacts() {
  return {
    domain: 'DOCUMENT_STORAGE',
    persona: 'Platform administrator backfilling legacy document versions',
    serviceOwner: 'apps/union-eyes/lib/documents/legacy-storage-backfill.ts',
    authorizationCategory: 'PLATFORM_ADMIN_IDENTITY',
    kernelAuthorization: false,
    authorizationDetail: 'withSystemAdminAuth: a platform-administrator identity check. No kernel decision is consulted for the document write.',
    tenantScope: 'The backfill is run for the caller organization (organizationId from the auth context).',
    dataSensitivity: 'Document storage metadata and content references',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
    auditDetail: 'A real run is wrapped in performAuditedOperation (admin.document_legacy_backfill). A dry run writes nothing.',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/documents/legacy-backfill/route.ts', 'withSystemAdminAuth'), routeEv('admin/documents/legacy-backfill/route.ts', "action: 'admin.document_legacy_backfill',"), routeEv('admin/documents/legacy-backfill/route.ts', 'backfillLegacyDocumentVersions({ organizationId, actorId: userId, dryRun, limit })')],
    defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [{ field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'performAuditedOperation records intent and outcome around the run; it is not committed with the backfill.' }],
  }
}

const NA = 'No existing capability names this obligation, so ownership stays with the programme scope decision.'
const NOT_ATOMIC = { field: 'audit', manifest: 'audit ATOMIC_SERVICE', actual: 'performAuditedOperation records intent and outcome around the effect; it is not committed with it.' }
const GET_CORR = (audit) => ({ field: 'mutating', manifest: `mutating true, audit ${audit}`, actual: 'A GET reads state and writes nothing.' })

export const UNRESOLVED_FACTS = {
  'activities/route.ts|GET': {
    domain: 'UNRESOLVED', proposedCapability: 'Organization activity feed over the hash-chained audit log; candidate owner is Gate 14 audit visibility.',
    unresolvedReason: `${NA} The audit log is a kernel audit surface, not a member journey.`,
    persona: 'Any active member at the member role floor', serviceOwner: 'apps/union-eyes/app/api/activities/route.ts (inline raw SQL)',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: "withApi minRole 'member'. Any member reads the organization audit feed.",
    tenantScope: 'organization_id predicate under withOrgOwnedContext (tenant RLS).', dataSensitivity: 'Audit log metadata: user ids, resource ids, event details',
    mutationAudit: 'NOT_MUTATING', auditDetail: 'A read of audit rows; nothing written.', implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('activities/route.ts', "auth: { required: true, minRole: 'member' },"), routeEv('activities/route.ts', 'FROM public.audit_logs')],
    defects: ['DEF-0B1-AUDIT-READ-MEMBER-FLOOR'], manifestCorrections: [],
  },
  'admin/ai-usage/route.ts|GET': {
    domain: 'UNRESOLVED', proposedCapability: 'AI invocation audit visibility; candidate owner is Gate 14 audit visibility.',
    unresolvedReason: `${NA} It reads the AI invocation audit trail.`,
    persona: 'Organization administrator', serviceOwner: 'apps/union-eyes/app/api/admin/ai-usage/route.ts (inline raw SQL)',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: "withApi minRole 'admin': an organization role-title check.",
    tenantScope: 'Canonical path relies on tenant RLS; the legacy path reads every organization.', dataSensitivity: 'AI invocation audit metadata (model, data class, audit reference)',
    mutationAudit: 'NOT_MUTATING', auditDetail: 'A read; nothing written.', implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/ai-usage/route.ts', "auth: { required: true, minRole: 'admin' },"), routeEv('admin/ai-usage/route.ts', 'legacy: audit_security, all organizations')],
    defects: ['DEF-0B1-AI-USAGE-LEGACY-CROSS-TENANT'], manifestCorrections: [],
  },
  'admin/database/health/route.ts|GET': {
    domain: 'UNRESOLVED', proposedCapability: 'Platform database operations; candidate owner is Gate 9 runtime architecture (UE-CAP-H-004).',
    unresolvedReason: `${NA} It reports database size, connections and the tenant and system principals.`,
    persona: 'Platform operator at the platform_lead role floor', serviceOwner: 'apps/union-eyes/app/api/admin/database/health/route.ts (inline SQL)',
    authorizationCategory: 'PLATFORM_ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: "withApi minRole 'platform_lead': a role-title check on a system-context read.",
    tenantScope: 'Platform-wide (withSystemContext).', dataSensitivity: 'Operational topology: database size, connections, principals',
    mutationAudit: 'NOT_MUTATING', auditDetail: 'A read; nothing written.', implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/database/health/route.ts', "auth: { required: true, minRole: 'platform_lead' }"), routeEv('admin/database/health/route.ts', 'return withSystemContext(async () => {')],
    defects: ['DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'], manifestCorrections: [],
  },
  'admin/database/optimize/route.ts|POST': {
    domain: 'UNRESOLVED', proposedCapability: 'Platform database operations; candidate owner is Gate 9 runtime architecture (UE-CAP-H-004).',
    unresolvedReason: `${NA} It runs ANALYZE across the database.`,
    persona: 'Platform administrator', serviceOwner: 'apps/union-eyes/app/api/admin/database/optimize/route.ts (inline SQL)',
    authorizationCategory: 'PLATFORM_ADMIN_IDENTITY', kernelAuthorization: false, authorizationDetail: 'isPlatformAdminUser(userId): a platform-administrator identity check. The manifest calls it SESSION_AUTH.',
    tenantScope: 'Platform-wide (withSystemContext).', dataSensitivity: 'None: maintenance statement that changes planner statistics only',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', auditDetail: "Wrapped in performAuditedOperation ('platform.database.analyze'). The ANALYZE changes no business row.",
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/database/optimize/route.ts', 'isPlatformAdminUser(userId)'), routeEv('admin/database/optimize/route.ts', "action: 'platform.database.analyze'")],
    defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [{ field: 'guard', manifest: 'SESSION_AUTH', actual: 'The handler checks isPlatformAdminUser(userId).' }, NOT_ATOMIC],
  },
  'admin/feature-flags/route.ts|GET': {
    domain: 'UNRESOLVED', proposedCapability: 'Platform feature-flag governance; candidate owner is Gate 14 audit and mutation isolation.',
    unresolvedReason: `${NA} Feature flags are platform configuration.`,
    persona: 'Organization administrator reading platform flags', serviceOwner: 'apps/union-eyes/lib/feature-flags',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: 'withAdminAuth: an organization admin role-title check on platform-wide flags.',
    tenantScope: 'Platform-wide flags, read by any organization administrator.', dataSensitivity: 'Platform configuration',
    mutationAudit: 'NOT_MUTATING', auditDetail: 'A read; nothing written.', implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/feature-flags/route.ts', 'export const GET = withAdminAuth('), routeEv('admin/feature-flags/route.ts', 'getAllFeatureFlags')],
    defects: ['DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY', 'DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [GET_CORR('ATOMIC_SERVICE')],
  },
  'admin/feature-flags/route.ts|PATCH': {
    domain: 'UNRESOLVED', proposedCapability: 'Platform feature-flag governance; candidate owner is Gate 14 audit and mutation isolation.',
    unresolvedReason: `${NA} Feature flags are platform configuration.`,
    persona: 'Platform administrator', serviceOwner: 'apps/union-eyes/lib/feature-flags',
    authorizationCategory: 'PLATFORM_ADMIN_IDENTITY', kernelAuthorization: false, authorizationDetail: 'withSystemAdminAuth: a platform-administrator identity check.',
    tenantScope: 'Platform-wide flag; the organization-mismatch guard is dead code because the schema strips unknown fields.', dataSensitivity: 'Platform configuration',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', auditDetail: "Wrapped in performAuditedOperation ('platform.feature_flag.toggle'), plus an API log event.",
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/feature-flags/route.ts', 'export const PATCH = withSystemAdminAuth('), routeEv('admin/feature-flags/route.ts', "action: 'platform.feature_flag.toggle',")],
    defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [NOT_ATOMIC],
  },
  'admin/jobs/[action]/route.ts|POST': {
    domain: 'UNRESOLVED', proposedCapability: 'Platform job-queue operations; candidate owner is Gate 9 runtime architecture.',
    unresolvedReason: `${NA} The queues are platform-wide.`,
    persona: 'Platform administrator', serviceOwner: 'apps/union-eyes/lib/job-queue',
    authorizationCategory: 'PLATFORM_ADMIN_IDENTITY', kernelAuthorization: false, authorizationDetail: 'withSystemAdminAuth wrapped inside the handler: a platform-administrator identity check. The manifest calls it ADMIN_AUTH.',
    tenantScope: 'Platform-wide queues; pausing one stops that work for every organization.', dataSensitivity: 'Operational job-queue control',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', auditDetail: "Wrapped in performAuditedOperation ('platform.job_queue.<action>').", implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/jobs/[action]/route.ts', 'return withSystemAdminAuth(async (request, context) => {'), routeEv('admin/jobs/[action]/route.ts', 'action: `platform.job_queue.${action}`,')],
    defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [{ field: 'guard', manifest: 'ADMIN_AUTH', actual: 'The handler applies withSystemAdminAuth.' }, NOT_ATOMIC],
  },
  'admin/jobs/retry/route.ts|POST': {
    domain: 'UNRESOLVED', proposedCapability: 'Platform job-queue operations; candidate owner is Gate 9 runtime architecture.',
    unresolvedReason: `${NA} The queues are platform-wide.`,
    persona: 'Platform administrator', serviceOwner: 'apps/union-eyes/lib/job-queue',
    authorizationCategory: 'PLATFORM_ADMIN_IDENTITY', kernelAuthorization: false, authorizationDetail: 'withSystemAdminAuth: a platform-administrator identity check. The manifest calls it ADMIN_AUTH.',
    tenantScope: 'Platform-wide queues.', dataSensitivity: 'Operational job-queue control',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', auditDetail: "Wrapped in performAuditedOperation ('platform.job.retry').", implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/jobs/retry/route.ts', 'export const POST = withSystemAdminAuth('), routeEv('admin/jobs/retry/route.ts', "action: 'platform.job.retry',")],
    defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [{ field: 'guard', manifest: 'ADMIN_AUTH', actual: 'The handler applies withSystemAdminAuth.' }, NOT_ATOMIC],
  },
  'admin/members/stats/route.ts|GET': {
    domain: 'UNRESOLVED', proposedCapability: 'Platform member statistics; candidate owner is Gate 10 persona journeys once a platform persona exists.',
    unresolvedReason: `${NA} No frozen persona source lists a cross-organization member-statistics journey.`,
    persona: 'Platform lead', serviceOwner: 'apps/union-eyes/app/api/admin/members/stats/route.ts (inline queries)',
    authorizationCategory: 'PLATFORM_ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: "hasMinRole('platform_lead') after a session check. The manifest calls it SESSION_AUTH.",
    tenantScope: 'Aggregate counts across all organizations, or one caller-supplied organizationId.', dataSensitivity: 'Aggregate member counts',
    mutationAudit: 'NOT_MUTATING', auditDetail: 'A read of counts; nothing written.', implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/members/stats/route.ts', "hasMinRole('platform_lead')"), routeEv('admin/members/stats/route.ts', "req.nextUrl.searchParams.get('organizationId')")],
    defects: ['DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY', 'DEF-0B1-MANIFEST-DETECTOR'],
    manifestCorrections: [{ field: 'guard', manifest: 'SESSION_AUTH', actual: "The handler calls hasMinRole('platform_lead')." }],
  },
  'admin/organizations/route.ts|GET': {
    domain: 'UNRESOLVED', proposedCapability: 'Platform organization directory; candidate owner is Gate 10 or Gate 3 once a platform persona exists.',
    unresolvedReason: `${NA} It is a cross-organization directory.`,
    persona: 'Platform lead', serviceOwner: 'apps/union-eyes/app/api/admin/organizations/route.ts (inline queries)',
    authorizationCategory: 'PLATFORM_ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: "withApi minRole 'platform_lead': a role-title check.",
    tenantScope: 'Cross-organization: member counts and contacts grouped by organization with no caller predicate.', dataSensitivity: 'Organization contact personal data (name, email) and member counts',
    mutationAudit: 'NOT_MUTATING', auditDetail: 'A read; nothing written.', implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/organizations/route.ts', "{ auth: { required: true, minRole: 'platform_lead' } },"), routeEv('admin/organizations/route.ts', 'contactMap.set(c.organizationId, { name: c.name, email: c.email });')],
    defects: ['DEF-0B1-ORGANIZATIONS-CROSS-ORG-CONTACTS', 'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'], manifestCorrections: [],
  },
  'admin/pilot-status/route.ts|GET': {
    domain: 'UNRESOLVED', proposedCapability: 'Pilot operations status; candidate owner is Gate 9 runtime architecture.',
    unresolvedReason: `${NA} It reports pilot readiness for the caller organization.`,
    persona: 'Platform lead', serviceOwner: 'apps/union-eyes/lib/pilot-admin.ts',
    authorizationCategory: 'PLATFORM_ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: "withApiAuth plus hasMinRole('platform_lead'): a role-title check.",
    tenantScope: 'The session organization (orgId from the session) predicates the system-context counts.', dataSensitivity: 'Pilot configuration and counts for one organization',
    mutationAudit: 'NOT_MUTATING', auditDetail: 'A read; nothing written.', implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/pilot-status/route.ts', "hasMinRole('platform_lead')"), routeEv('admin/pilot-status/route.ts', 'WHERE organization_id = ${orgId}')],
    defects: ['DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY'], manifestCorrections: [],
  },
  'admin/pki/signatures/[id]/sign/route.ts|POST': {
    domain: 'UNRESOLVED', proposedCapability: 'Digital signatures and signing workflows; candidate owner is Gate 6 documents and records.',
    unresolvedReason: `${NA} Signing is a document-records obligation that no capability names.`,
    persona: 'Organization administrator signing as themselves', serviceOwner: 'apps/union-eyes/services/pki/signature-service.ts and workflow-engine.ts',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: "withRoleAuth('admin') plus a binding that a document is signed only as the authenticated member.",
    tenantScope: 'Workflow organization is compared to the caller organization.', dataSensitivity: 'Digital signatures and signed document references',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', auditDetail: "Wrapped in performAuditedOperation ('pki.document.sign'); the workflow step is recorded afterwards in process memory.",
    implementationStatus: 'PARTIAL',
    evidence: [routeEv('admin/pki/signatures/[id]/sign/route.ts', "export const POST = withRoleAuth('admin'"), routeEv('admin/pki/signatures/[id]/sign/route.ts', "action: 'pki.document.sign',"), ev(WORKFLOW, 'return new Map<string, WorkflowDefinition>()')],
    defects: ['DEF-0B1-PKI-WORKFLOW-IN-MEMORY', 'DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [NOT_ATOMIC],
  },
  'admin/pki/signatures/[id]/verify/route.ts|POST': {
    domain: 'UNRESOLVED', proposedCapability: 'Digital signatures and signing workflows; candidate owner is Gate 6 documents and records.',
    unresolvedReason: `${NA} Verification is a document-records obligation that no capability names.`,
    persona: 'Organization administrator verifying a signature', serviceOwner: 'apps/union-eyes/services/pki/verification-service.ts',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: "withRoleAuth('admin'): an organization role-title check.",
    tenantScope: 'The caller organizationId is passed to the verification service.', dataSensitivity: 'Digital signatures and document content',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', auditDetail: 'The verification is wrapped in performAuditedOperation, so the check is recorded as intent and outcome.',
    implementationStatus: 'PARTIAL',
    evidence: [routeEv('admin/pki/signatures/[id]/verify/route.ts', "export const POST = withRoleAuth('admin'"), routeEv('admin/pki/signatures/[id]/verify/route.ts', 'await performAuditedOperation(')],
    defects: ['DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [NOT_ATOMIC],
  },
  'admin/pki/workflows/[id]/route.ts|DELETE': {
    domain: 'UNRESOLVED', proposedCapability: 'Digital signatures and signing workflows; candidate owner is Gate 6 documents and records.',
    unresolvedReason: `${NA} Cancelling a signing workflow is a document-records obligation.`,
    persona: 'Organization administrator cancelling a signing workflow', serviceOwner: 'apps/union-eyes/services/pki/workflow-engine.ts',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: 'withAdminAuth plus an ownedWorkflow organization check.',
    tenantScope: 'The workflow organization must equal the caller organization.', dataSensitivity: 'Signing workflow state',
    mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC', auditDetail: 'cancelWorkflow runs inside performAuditedOperation, but the workflow itself lives in process memory.',
    implementationStatus: 'PARTIAL',
    evidence: [routeEv('admin/pki/workflows/[id]/route.ts', 'async () => cancelWorkflow(workflowId, userId as string, reason),'), ev(WORKFLOW, 'return new Map<string, WorkflowDefinition>()')],
    defects: ['DEF-0B1-PKI-WORKFLOW-IN-MEMORY', 'DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME', 'DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [NOT_ATOMIC],
  },
  'admin/pki/workflows/[id]/route.ts|GET': {
    domain: 'UNRESOLVED', proposedCapability: 'Digital signatures and signing workflows; candidate owner is Gate 6 documents and records.',
    unresolvedReason: `${NA} Reading signing workflow status is a document-records obligation.`,
    persona: 'Organization administrator reading a signing workflow', serviceOwner: 'apps/union-eyes/services/pki/workflow-engine.ts',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: 'withAdminAuth plus an ownedWorkflow organization check.',
    tenantScope: 'The workflow organization must equal the caller organization.', dataSensitivity: 'Signing workflow state',
    mutationAudit: 'NOT_MUTATING', auditDetail: 'A read of in-memory workflow state.', implementationStatus: 'PARTIAL',
    evidence: [routeEv('admin/pki/workflows/[id]/route.ts', 'const workflow = ownedWorkflow(workflowId, context.organizationId)'), ev(WORKFLOW, 'return new Map<string, WorkflowDefinition>()')],
    defects: ['DEF-0B1-PKI-WORKFLOW-IN-MEMORY', 'DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [GET_CORR('ATOMIC_SERVICE')],
  },
  'admin/pki/workflows/[id]/route.ts|PUT': {
    domain: 'UNRESOLVED', proposedCapability: 'Digital signatures and signing workflows; candidate owner is Gate 6 documents and records.',
    unresolvedReason: `${NA} Manual workflow advancement is deliberately refused.`,
    persona: 'Organization administrator attempting to advance a workflow by hand', serviceOwner: 'apps/union-eyes/app/api/admin/pki/workflows/[id]/route.ts',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: 'withAdminAuth plus an ownedWorkflow organization check, then HTTP 501.',
    tenantScope: 'The workflow organization must equal the caller organization.', dataSensitivity: 'Signing workflow state',
    mutationAudit: 'NOT_MUTATING', nonMutationReason: 'The handler returns HTTP 501 NOT_IMPLEMENTED before any write.', auditDetail: 'Nothing is written.',
    implementationStatus: 'HONEST_501',
    evidence: [routeEv('admin/pki/workflows/[id]/route.ts', "code: 'NOT_IMPLEMENTED',"), routeEv('admin/pki/workflows/[id]/route.ts', '{ status: 501 },')],
    defects: ['DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [{ field: 'audit', manifest: 'mutating true, audit ATOMIC_SERVICE', actual: 'The handler refuses with HTTP 501 and writes nothing, so no audit record is made.' }],
  },
  'admin/representation-protocol/route.ts|GET': {
    domain: 'UNRESOLVED', proposedCapability: 'Representation protocol administration; candidate owners are UE-CAP-B-001 or UE-CAP-B-002, to be adjudicated in Gate 0B.2.',
    unresolvedReason: 'The protocol is a real draft-and-approve flow, but no capability names it and the closest ones (B-001 ownership, B-002 unit and territory) differ in obligation.',
    persona: 'Organization administrator', serviceOwner: 'apps/union-eyes/lib/representation/protocol-service.ts',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: 'withAdminAuth: an organization admin role-title check.',
    tenantScope: 'The protocol is resolved for the caller organizationId.', dataSensitivity: 'Representation configuration',
    mutationAudit: 'NOT_MUTATING', auditDetail: 'A read of the resolved protocol.', implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/representation-protocol/route.ts', 'resolveRepresentationProtocol(organizationId)')],
    defects: ['DEF-0B1-REP-PROTOCOL-NOT-IN-CAPABILITY-MODEL', 'DEF-0B1-MANIFEST-DETECTOR'], manifestCorrections: [GET_CORR('ATOMIC_SERVICE')],
  },
  'admin/representation-protocol/route.ts|POST': {
    domain: 'UNRESOLVED', proposedCapability: 'Representation protocol administration; candidate owners are UE-CAP-B-001 or UE-CAP-B-002, to be adjudicated in Gate 0B.2.',
    unresolvedReason: 'The protocol is a real draft-and-approve flow, but no capability names it and the closest ones (B-001 ownership, B-002 unit and territory) differ in obligation.',
    persona: 'Organization administrator approving a protocol (not the author)', serviceOwner: 'apps/union-eyes/lib/representation/protocol-service.ts',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: 'withAdminAuth plus a service rule that refuses self-approval (SELF_APPROVAL_FORBIDDEN).',
    tenantScope: 'The approval runs under withRLSContext for the caller organizationId.', dataSensitivity: 'Representation configuration',
    mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION', auditDetail: 'approveRepresentationProtocol commits the approval and persistAtomicAudit in one withRLSContext transaction.',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/representation-protocol/route.ts', 'approveRepresentationProtocol(organizationId, userId)'), ev(PROTOCOL, 'await persistAtomicAudit(tx, {'), routeEv('admin/representation-protocol/route.ts', 'SELF_APPROVAL_FORBIDDEN')],
    defects: ['DEF-0B1-REP-PROTOCOL-NOT-IN-CAPABILITY-MODEL'], manifestCorrections: [],
  },
  'admin/representation-protocol/route.ts|PUT': {
    domain: 'UNRESOLVED', proposedCapability: 'Representation protocol administration; candidate owners are UE-CAP-B-001 or UE-CAP-B-002, to be adjudicated in Gate 0B.2.',
    unresolvedReason: 'The protocol is a real draft-and-approve flow, but no capability names it and the closest ones (B-001 ownership, B-002 unit and territory) differ in obligation.',
    persona: 'Organization administrator drafting a protocol', serviceOwner: 'apps/union-eyes/lib/representation/protocol-service.ts',
    authorizationCategory: 'ROLE_FLOOR', kernelAuthorization: false, authorizationDetail: 'withAdminAuth: an organization admin role-title check. The saved protocol stays pending approval.',
    tenantScope: 'saveRepresentationProtocol runs under withRLSContext for the caller organizationId.', dataSensitivity: 'Representation configuration',
    mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION', auditDetail: 'saveRepresentationProtocol commits the configuration and persistAtomicAudit in one transaction; the route also emits a log event.',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    evidence: [routeEv('admin/representation-protocol/route.ts', 'await saveRepresentationProtocol(organizationId, parsed.data.protocol, userId ?? "system");'), ev(PROTOCOL, 'The new configuration and its audit record commit together.'), ev(PROTOCOL, 'await persistAtomicAudit(tx, {')],
    defects: ['DEF-0B1-REP-PROTOCOL-NOT-IN-CAPABILITY-MODEL'], manifestCorrections: [],
  },
}

export const GROUP_OF = (route) => {
  if (CRUD_ORG_MEMBERS_ROUTES.includes(route) || CRUD_ANALYTICS_METRICS_ROUTES.includes(route)) return 'crud'
  if (BILLING_ROUTES.includes(route)) return 'billing'
  if (CLC_REPORT_ROUTES.includes(route)) return 'clc'
  if (INGESTION_ROUTES.includes(route)) return 'ingestion'
  if (DOCUMENT_BACKFILL_ROUTES.includes(route)) return 'backfill'
  return 'unresolved'
}
