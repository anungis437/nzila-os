/**
 * Gate 0B.2 source facts. Every statement here was read from the cited route, service or guard file. The builder
 * refuses to write the register unless each cited quote is present in its file, so a stale fact fails the build.
 * A fact states what the source does. Where the source lacks a control, the record says so and names the defect;
 * a future guard is recorded in requiredFutureGuard and is never counted as an existing control.
 */
import { UNRESOLVED_FACTS } from './ue-gate0b1-facts.mjs'
import { CAPABILITY_IDS_0B2 as IDS, CRUD_ANALYTICS_ROUTES, CRUD_MEMBER_ROUTES, groupOfRoute } from './ue-gate0b2-groups.mjs'
import { aiFacts, AI_ROUTES } from './ue-gate0b2-ai-facts.mjs'
import { platformFacts, PLATFORM_ROUTES } from './ue-gate0b2-platform-facts.mjs'
import { APP_API, APP, ev, routeEv, CRUD_FACTORY, CRUD_GOVERNANCE, LOW_ROLE } from './ue-gate0b2-fact-helpers.mjs'

export const CAPABILITY_GATES = {
  'UE-CAP-K-007': 13,
  'UE-CAP-I-001': 10,
  'UE-CAP-A-003': 1,
  [IDS.AI]: 14,
  [IDS.AUDIT_VISIBILITY]: 14,
  [IDS.OPERATOR]: 9,
  [IDS.ENUMERATION]: 14,
  [IDS.PKI]: 6,
  [IDS.PROTOCOL]: 2,
  [IDS.EXPOSURE]: 14,
}

export const INSTITUTIONAL_DECISIONS = [
  {
    id: 'UE-INST-PLATFORM-STAFF-MANDATE',
    status: 'OUTSTANDING',
    question: 'Which platform staff may read across organizations or operate shared platform services, under what mandate, scope, expiry and audit?',
    sourceState: 'The source uses a platform_lead role title and an isPlatformAdminUser identity check. Neither is an issued, scoped, expiring mandate. No adopted decision in the repository names a platform-staff mandate model.',
    softwareOwners: [IDS.OPERATOR, IDS.ENUMERATION],
  },
  {
    id: 'UE-INST-REPRESENTATION-AUTHORITY-SOURCE',
    status: 'OUTSTANDING',
    question: 'Does the approved per-organization representation protocol, or the kernel issuance model, decide who holds representation authority over a case?',
    sourceState: 'The case-assignment engine refuses to assign without an approved protocol. The kernel also issues mandates and assignments. The source does not say which governs when they differ.',
    softwareOwners: [IDS.PROTOCOL, 'UE-CAP-B-001'],
  },
  {
    id: 'UE-INST-KNOWLEDGE-PUBLICATION',
    status: 'OUTSTANDING',
    question: 'Who may mark a knowledge-base row or collective agreement is_public, and what review precedes publication beyond the organization?',
    sourceState: 'AI search and summarize return another organization\'s row when is_public is true. Agreement creation sets isPublic false and says publication is not decided at creation. No source says who sets the flag.',
    softwareOwners: [IDS.AI, 'UE-CAP-I-001'],
  },
  {
    id: 'UE-INST-AUDIT-HISTORY-READERS',
    status: 'OUTSTANDING',
    question: 'Which roles may read the organization audit history, and which fields must be withheld from each?',
    sourceState: 'The activity feed and AI usage routes return audit-derived rows at member and administrator role floors. No adopted decision names the readers.',
    softwareOwners: [IDS.AUDIT_VISIBILITY],
  },
  {
    id: 'UE-INST-OBSERVABILITY-ALERT-OWNER',
    status: 'OUTSTANDING',
    question: 'Is observability alerting an organization-administration, platform-operations or security-monitoring obligation, and who may read its alerts?',
    sourceState: 'The realtime alerts route returns an organization\'s alert rows at the member role floor under the grievance case suite entitlement. No capability or persona source names observability alerting.',
    softwareOwners: [],
  },
]

const D = (id, gate, severity, ownerCapabilityId, title, extra = {}) => ({ id, gate, severity, ownerCapabilityId, title, ...extra })

export const DEFECTS_0B2 = [
  D('DEF-0B2-CRUD-FACADE-SEGMENTS-SETTINGS', 13, 'HIGH', 'UE-CAP-K-007', 'The segment collection, segment item, segment execute and system settings routes advertise a business domain but are the generic CRUD factory over organization_members: GET returns member roster rows at the member floor, every write is refused, and nothing is segmented, executed or configured. A real member_segments table exists in the governance list and is not bound.'),
  D('DEF-0B2-UPDATE-ROLE-INERT', 13, 'HIGH', 'UE-CAP-K-007', 'The update-role route is the generic CRUD factory over organization_members, a READ_ONLY table: GET returns member rows at the steward floor and POST is refused, so no role change can occur through it.'),
  D('DEF-0B2-ANALYTICS-CRUD-FACADE', 13, 'HIGH', 'UE-CAP-K-007', 'The analytics routes (claims, financial, executive, heatmap, comparative, dashboard, deadlines, clause statistics, trends, insights) are the generic CRUD factory over analytics_metrics, trend_analyses or insight_recommendations, which are OPERATIONAL. GET returns stored rows, not computed analytics, and any steward can insert arbitrary rows that are then served as analytics.'),
  D('DEF-0B2-PLATFORM-DIRECTORY-UNSCOPED-READ', 14, 'HIGH', IDS.ENUMERATION, 'The platform user directory and activity feed select organization_members and organizations with no organization predicate at a platform_lead role title and return member name, email and role across organizations. Neither read is audited.'),
  D('DEF-0B2-CROSS-ORG-ANALYTICS-SCOPE-UNPROVEN', 14, 'MEDIUM', IDS.ENUMERATION, 'The cross-organization analytics route selects up to 1000 analytics_metrics rows through the global db handle inside a withRLSContext call that names no organization. The source does not show which rows tenant security returns, and the route is gated by a role title.'),
  D('DEF-0B2-REVOCATION-MULTI-STORE', 1, 'MEDIUM', 'UE-CAP-A-003', 'Member deactivation and removal revoke sessions, the platform-auth membership and the local row in separate stores. The audit record is atomic only with the local status update, and the route returns 502 when a step fails, leaving a partial state for a retry.'),
  D('DEF-0B2-AGREEMENTS-BODY-UNVALIDATED', 13, 'MEDIUM', 'UE-CAP-K-007', 'Agreement creation reads request.json() with no schema: only the status is checked, and every other field is inserted as supplied at a steward role-title floor.'),
  D('DEF-0B2-AI-GRIEVANCE-NO-CASE-AUTHORITY', 2, 'HIGH', 'UE-CAP-B-001', 'AI grievance triage, clause reasoning and the copilot read any grievance in the organization for a steward role title. They do not check that the steward holds the case, so grievance content for cases the steward does not represent is sent to a model.'),
  D('DEF-0B2-AI-DATA-CLASS-DOWNGRADE', 14, 'HIGH', IDS.AI, 'Routes that run enforceAISafety with grievance_legal, confidential or pension_financial data classes call the model with dataClass internal in the service layer. The two vocabularies disagree and the source shows no mapping between them.'),
  D('DEF-0B2-AI-FINANCE-ROLE-TITLE-GATE', 5, 'HIGH', 'UE-CAP-D-003', 'Finance analysis and the pension projection, funding and trustee-summary routes read dues, arrears, remittances, trial-balance and pension data for an officer role title, with no financial mandate.'),
  D('DEF-0B2-AI-GET-WRITES-ROWS', 14, 'MEDIUM', 'UE-CAP-K-005', 'The employer-risk and insight-report GET handlers insert rows (employer_risk_scores, ai_insight_reports) through the global db handle and record the invocation with a separate auditLog event that is not committed with the row.'),
  D('DEF-0B2-AI-INVOCATION-NOT-AUDITED', 14, 'MEDIUM', IDS.AI, 'The classify, match-precedents, summarize and search routes call a model and write no audit event in the route handler or in the service that holds the AI call.'),
  D('DEF-0B2-AI-CLASSIFY-UNGUARDED', 14, 'MEDIUM', IDS.AI, 'The classify route applies no AI feature gate and no AI safety check, although every sibling AI route applies both.'),
  D('DEF-0B2-AI-PUBLIC-KNOWLEDGE-CROSS-TENANT', 14, 'MEDIUM', IDS.AI, 'AI search and summarize return another organization\'s knowledge row when is_public is true, and no source says who may set the flag. Public cross-tenant data is not authorized by being public.'),
  D('DEF-0B2-AI-SEMANTIC-STATS-UNSCOPED', 14, 'MEDIUM', 'UE-CAP-K-006', 'The semantic-search status GET counts every cba_clause and arbitration_precedents row across organizations through the global db handle with no organization predicate, at the member role floor.'),
  D('DEF-0B2-AI-FEEDBACK-READ-OTHER-USERS', 14, 'MEDIUM', IDS.AI, 'The AI feedback GET returns every user\'s rating, comment and user id for a query id in the organization at the member role floor.'),
  D('DEF-0B2-AI-RAG-INDEX-PROCESS-LOCAL', 9, 'MEDIUM', 'UE-CAP-H-004', 'The AI ingest route indexes documents into a process-local Map, so an indexed document is lost on restart and not shared across instances, while the response reports status indexed.'),
  D('DEF-0B2-AI-CACHE-PLATFORM-WIDE-ORG-ADMIN', 13, 'MEDIUM', 'UE-CAP-K-007', 'The embedding cache statistics GET is gated by an organization administrator role title but reports platform-wide cache state.'),
  D('DEF-0B2-PKI-ATTESTATION-NOT-CRYPTOGRAPHIC', 6, 'HIGH', IDS.PKI, 'Signing stores signatureValue ATTESTATION over a document-reference hash. The source says there is no cryptographic signature value, so verification cannot prove who signed or that content is unchanged.'),
]

export const ROUTE_DEFECT_OWNERS_0B1 = {
  'DEF-0B1-CRUD-FACADE-ORG-MEMBERS': 'UE-CAP-K-007',
  'DEF-0B1-FIX-SUPER-ADMIN-INERT': 'UE-CAP-K-007',
  'DEF-0B1-CLC-ANALYTICS-WRITABLE': 'UE-CAP-K-007',
  'DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME': 'UE-CAP-K-005',
  'DEF-0B1-MANIFEST-DETECTOR': 'UE-CAP-K-008',
  'DEF-0B1-BILLING-HISTORY-FAKE-EMPTY': 'UE-CAP-D-003',
  'DEF-0B1-BILLING-TARGET-ORG-UNBOUND': 'UE-CAP-D-003',
  'DEF-0B1-PLATFORM-ROLE-TITLE-AUTHORITY': 'UE-CAP-K-007',
  'DEF-0B1-BILLING-SCHEDULER-LATENT': 'UE-CAP-D-003',
  'DEF-0B1-CLC-CROSS-TENANT-READ': 'UE-CAP-K-006',
  'DEF-0B1-CLC-PUBLIC-CACHE-CONTROL': 'UE-CAP-K-005',
  'DEF-0B1-AUDIT-READ-MEMBER-FLOOR': IDS.AUDIT_VISIBILITY,
  'DEF-0B1-AI-USAGE-LEGACY-CROSS-TENANT': 'UE-CAP-K-006',
  'DEF-0B1-ORGANIZATIONS-CROSS-ORG-CONTACTS': IDS.ENUMERATION,
  'DEF-0B1-PKI-WORKFLOW-IN-MEMORY': IDS.PKI,
  'DEF-0B1-REP-PROTOCOL-NOT-IN-CAPABILITY-MODEL': IDS.PROTOCOL,
  'DEF-0B1-ALLOWLIST-DRIFT': 'UE-CAP-K-008',
  'DEF-0B1-DOCS-UNAUTH-API-SURFACE': IDS.EXPOSURE,
  'DEF-0B1-VERSION-UNAUTH-TOPOLOGY': IDS.EXPOSURE,
  'DEF-0B1-COMMS-TRACKING-GET-MUTATES': 'UE-CAP-I-002',
  'DEF-0B1-ICRA-TELEMETRY-PROCESS-LOCAL-LIMIT': IDS.EXPOSURE,
}

export const RELEASE_BLOCKING_0B1 = ['DEF-0B1-DOCS-UNAUTH-API-SURFACE', 'DEF-0B1-VERSION-UNAUTH-TOPOLOGY', 'DEF-0B1-ALLOWLIST-DRIFT']

const CRUD_GET = { field: 'mutating', manifest: 'mutating true, audit CRUD_ATOMIC', actual: 'A GET reads rows and writes nothing.' }
const CRUD_REFUSED = { field: 'audit', manifest: 'audit CRUD_ATOMIC', actual: 'organization_members is READ_ONLY, so the write is refused before any row or audit record is written.' }

const ADVERTISED = {
  'admin/segments/route.ts': 'member segments',
  'admin/segments/[id]/route.ts': 'a member segment',
  'admin/segments/[id]/execute/route.ts': 'segment execution',
  'admin/system/settings/route.ts': 'system settings',
  'admin/update-role/route.ts': 'member role assignment',
}

const TABLE_SQL = { organizationMembers: 'organization_members', analyticsMetrics: 'analytics_metrics', trendAnalyses: 'trend_analyses', insightRecommendations: 'insight_recommendations' }
const TABLE_OF_ROUTE = Object.fromEntries([
  ...CRUD_MEMBER_ROUTES.map((route) => [route, 'organizationMembers']),
  ...Object.entries(CRUD_ANALYTICS_ROUTES).flatMap(([sql, routes]) => routes.map((route) => [route, { analytics_metrics: 'analyticsMetrics', trend_analyses: 'trendAnalyses', insight_recommendations: 'insightRecommendations' }[sql]])),
])

export function crudFacts2(route, method, source) {
  const table = TABLE_OF_ROUTE[route]
  const sql = TABLE_SQL[table]
  const isMembers = table === 'organizationMembers'
  const readRole = source.match(/readRole: '(\w+)'/)?.[1]
  const writeRole = source.match(/writeRole: '(\w+)'/)?.[1]
  const entitlement = source.match(/entitlement: '(\w+)'/)?.[1]
  const isRead = method === 'GET'
  const floor = isRead ? readRole : method === 'DELETE' ? 'admin' : writeRole
  const advertised = ADVERTISED[route] ?? route.replace(/\/route\.ts$/, '').replace(/^analytics\//, 'analytics ')
  const defects = isMembers
    ? [route === 'admin/update-role/route.ts' ? 'DEF-0B2-UPDATE-ROLE-INERT' : 'DEF-0B2-CRUD-FACADE-SEGMENTS-SETTINGS', 'DEF-0B1-MANIFEST-DETECTOR']
    : ['DEF-0B2-ANALYTICS-CRUD-FACADE', 'DEF-0B1-MANIFEST-DETECTOR']
  const evidence = [routeEv(route, `table: ${table},`), routeEv(route, `readRole: '${readRole}',`), ev(CRUD_FACTORY, 'export function crudRoutes')]
  if (entitlement) evidence.push(routeEv(route, `entitlement: '${entitlement}',`))
  const corrections = []
  let mutationAudit = 'NOT_MUTATING'
  let auditDetail = 'A read: the generic factory writes no row and no audit record.'
  if (isRead) {
    corrections.push(CRUD_GET)
    evidence.push(ev(LOW_ROLE, 'Callers below steward are therefore held to'))
  } else if (!isMembers) {
    mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
    auditDetail = `${sql} is OPERATIONAL, so the write proceeds and the factory commits the audit record in the same tenant transaction (crud.${sql}.<action>).`
    evidence.push(ev(CRUD_FACTORY, 'await persistAtomicAudit(tx, {'), ev(CRUD_GOVERNANCE, `'${sql}'`))
  } else {
    mutationAudit = 'WRITE_REFUSED_BY_GOVERNANCE'
    auditDetail = 'organization_members is READ_ONLY in the CRUD governance table, so assertCrudWrite refuses with 403 before any write; nothing is mutated and nothing is audited.'
    evidence.push(ev(CRUD_GOVERNANCE, 'export function assertCrudWrite'), ev(CRUD_GOVERNANCE, "'organization_members', 'organizations', 'profiles'"))
    corrections.push(CRUD_REFUSED)
    if (route.startsWith('admin/segments')) evidence.push(ev(CRUD_GOVERNANCE, "'member_segments'"))
  }
  const behavior = isRead
    ? `Returns ${sql} rows for the caller organization under a role floor of ${floor}. The route name advertises ${advertised}; no segment, setting or analytics computation exists behind it.`
    : isMembers
      ? `Attempts a ${method} on ${sql}, which governance refuses with 403. The route name advertises ${advertised}; nothing is changed.`
      : `Inserts a caller-supplied ${sql} row for the organization and audits it. The route name advertises ${advertised}; nothing is computed.`
  return {
    persona: `Organization ${floor} or above through the generic CRUD factory`,
    serviceOwner: `${APP}lib/api/crud-factory.ts (crudRoutes over ${sql})`,
    authenticationMechanism: 'Authenticated session resolved by the generic CRUD factory (crudRoutes).',
    authorizationCategory: 'ROLE_FLOOR',
    kernelAuthorization: false,
    authorizationDetail: `Generic CRUD role floor: ${method} requires ${floor}${entitlement ? ` and the ${entitlement} entitlement` : ''}. A role title is not a kernel decision.`,
    tenantScope: 'orgScoped: true: the factory scopes rows to the session organization.',
    dataOwnership: isMembers ? 'Organization members table (identity and membership data owned by the organization member record).' : `${sql}: organization-scoped metric rows with no business owner in this route.`,
    dataSensitivity: isMembers ? 'Member roster: name, email, role, status' : 'Organization analytics metric rows',
    privacyDisclosure: isMembers ? (isRead ? 'GET returns member roster rows to any caller at the read floor under a name that does not say so.' : 'The write is refused, so no member data changes; the route name advertises a function it does not perform.') : 'Rows are returned as supplied; the entitlement, where present, is a billing gate and not a privacy decision.',
    mutationAudit,
    auditDetail,
    implementedBehavior: behavior,
    implementationStatus: 'FACADE_OVER_GENERIC_TABLE',
    requiredGate: 13,
    requiredFutureGuard: isMembers ? 'Replace the route with a purpose-built handler authorized by a kernel decision, or retire it to an honest HTTP 501.' : 'Compute analytics from source tables behind a purpose-built handler authorized by a kernel decision, and close the generic write.',
    crudTable: sql,
    crudGovernanceClass: isMembers ? 'READ_ONLY' : 'OPERATIONAL',
    evidence,
    defects,
    manifestCorrections: corrections,
  }
}

const GATE_0B1_NEW = {
  carriedForwardFrom: 'GATE-0B.1',
}

const CARRY_EXTRA = {
  'activities/route.ts|GET': { owner: 'Audit log rows (public.audit_logs), owned by the audit kernel.', behavior: 'Returns the organization audit-log rows as an activity feed.', future: 'Define the readers and redact fields by role under UE-INST-AUDIT-HISTORY-READERS; read through a policy rather than a member role floor.', gate: 14, privacy: 'User ids, resource ids and event details reach every active member.', decisions: ['UE-INST-AUDIT-HISTORY-READERS'], authn: 'Entra session via withApi (auth.required true).' },
  'admin/ai-usage/route.ts|GET': { owner: 'AI invocation audit rows, owned by the audit kernel.', behavior: 'Returns AI invocation audit metadata, from the canonical path under tenant security or from the legacy audit_security path across every organization.', future: 'Remove the legacy cross-organization path and read through an audit-visibility policy.', gate: 14, privacy: 'Model, data class and audit reference are returned to an administrator role title.', decisions: ['UE-INST-AUDIT-HISTORY-READERS'], authn: 'Entra session via withApi (auth.required true).' },
  'admin/database/health/route.ts|GET': { owner: 'Platform database; not an organization resource.', behavior: 'Reports database size, connections and database principals through a system-context read.', future: 'Authorize by a platform-staff mandate and return operational detail only to that mandate.', gate: 9, privacy: 'Operational topology: database size, connections and principals.', decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'], authn: 'Entra session via withApi (auth.required true).' },
  'admin/database/optimize/route.ts|POST': { owner: 'Platform database; not an organization resource.', behavior: 'Runs ANALYZE across the database after an identity check and records intent and outcome.', future: 'Authorize by a platform-staff mandate and commit the audit record with the effect, or record a non-business maintenance class.', gate: 9, privacy: 'None: planner statistics only.', decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'], authn: 'Entra session; the handler resolves the caller with auth() and checks isPlatformAdminUser.' },
  'admin/feature-flags/route.ts|GET': { owner: 'Platform feature-flag configuration.', behavior: 'Returns every platform feature flag to an organization administrator.', future: 'Authorize reads by a platform-staff mandate or scope flags to the organization.', gate: 9, privacy: 'Platform configuration.', decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'], authn: 'Entra session via withAdminAuth.' },
  'admin/feature-flags/route.ts|PATCH': { owner: 'Platform feature-flag configuration.', behavior: 'Toggles a platform feature flag for every organization after a platform-administrator check and records intent and outcome.', future: 'Authorize by a platform-staff mandate and commit the audit record with the flag change.', gate: 9, privacy: 'Platform configuration.', decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'], authn: 'Entra session via withSystemAdminAuth.' },
  'admin/jobs/[action]/route.ts|POST': { owner: 'Platform job queues.', behavior: 'Pauses, resumes or runs a named platform job-queue action for every organization and records intent and outcome.', future: 'Authorize by a platform-staff mandate and bound the actions an operator may take.', gate: 9, privacy: 'Operational job-queue control.', decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'], authn: 'Entra session via withSystemAdminAuth.' },
  'admin/jobs/retry/route.ts|POST': { owner: 'Platform job queues.', behavior: 'Retries a failed platform job and records intent and outcome.', future: 'Authorize by a platform-staff mandate.', gate: 9, privacy: 'Operational job-queue control.', decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'], authn: 'Entra session via withSystemAdminAuth.' },
  'admin/members/stats/route.ts|GET': { owner: 'Aggregate member counts across organizations.', behavior: 'Returns member counts across all organizations or for one caller-supplied organizationId.', future: 'Bind the organizationId to the caller mandate and audit the read.', gate: 14, privacy: 'Aggregate counts only; a caller-supplied organization id selects another organization.', decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'], authn: 'Entra session resolved in the handler; the handler checks hasMinRole(platform_lead).', crossTenant: true },
  'admin/organizations/route.ts|GET': { owner: 'Organization directory and organization contact records.', behavior: 'Lists organizations with member counts and contact name and email across organizations.', future: 'Authorize by a platform-staff mandate and withhold contact personal data the reader does not need.', gate: 14, privacy: 'Contact name and email of every organization are returned.', decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'], authn: 'Entra session via withApi (auth.required true).', crossTenant: true },
  'admin/pilot-status/route.ts|GET': { owner: 'Pilot configuration for the session organization.', behavior: 'Returns pilot configuration and counts for the session organization through a system-context read.', future: 'Authorize by a platform-staff mandate; the session organization is the only predicate today.', gate: 9, privacy: 'Pilot configuration and counts for one organization.', decisions: ['UE-INST-PLATFORM-STAFF-MANDATE'], authn: 'Entra session via withApiAuth.' },
  'admin/pki/signatures/[id]/sign/route.ts|POST': { owner: 'Signature and signing-workflow records owned by the organization.', behavior: 'Records an attestation signature for the authenticated member against a workflow held in process memory.', future: 'Produce a cryptographic signature, hold the workflow in a durable table and commit the audit record with the effect.', gate: 6, privacy: 'Signed document references and signer identity.', decisions: [], authn: 'Entra session via withRoleAuth.', defectsAdd: ['DEF-0B2-PKI-ATTESTATION-NOT-CRYPTOGRAPHIC'], evidenceAdd: [['services/pki/signature-service.ts', 'Attestation signature (no cryptographic signature value)']] },
  'admin/pki/signatures/[id]/verify/route.ts|POST': { owner: 'Signature records owned by the organization.', behavior: 'Verifies a stored signature record and records intent and outcome; the signature is an attestation, so verification confirms the record, not a cryptographic proof.', future: 'Verify a cryptographic signature and commit the audit record with the check.', gate: 6, privacy: 'Signature and document content.', decisions: [], authn: 'Entra session via withRoleAuth.', defectsAdd: ['DEF-0B2-PKI-ATTESTATION-NOT-CRYPTOGRAPHIC'], evidenceAdd: [['services/pki/signature-service.ts', 'Attestation signature (no cryptographic signature value)']] },
  'admin/pki/workflows/[id]/route.ts|DELETE': { owner: 'Signing-workflow state held in process memory.', behavior: 'Cancels a signing workflow in process memory after an organization check.', future: 'Hold workflows in a durable table and commit the audit record with the cancel.', gate: 6, privacy: 'Signing workflow state.', decisions: [], authn: 'Entra session via withAdminAuth.' },
  'admin/pki/workflows/[id]/route.ts|GET': { owner: 'Signing-workflow state held in process memory.', behavior: 'Reads a signing workflow from process memory after an organization check.', future: 'Hold workflows in a durable table.', gate: 6, privacy: 'Signing workflow state.', decisions: [], authn: 'Entra session via withAdminAuth.' },
  'admin/pki/workflows/[id]/route.ts|PUT': { owner: 'Signing-workflow state held in process memory.', behavior: 'Refuses manual workflow advancement with HTTP 501 after an organization check.', future: 'None required for the refusal; keep the HTTP 501 until a durable workflow exists.', gate: 6, privacy: 'Signing workflow state.', decisions: [], authn: 'Entra session via withAdminAuth.' },
  'admin/representation-protocol/route.ts|GET': { owner: 'Organization representation configuration (org_configurations).', behavior: 'Returns the resolved representation protocol for the caller organization.', future: 'Authorize by a kernel decision once UE-INST-REPRESENTATION-AUTHORITY-SOURCE is adopted.', gate: 2, privacy: 'Representation configuration.', decisions: ['UE-INST-REPRESENTATION-AUTHORITY-SOURCE'], authn: 'Entra session via withAdminAuth.' },
  'admin/representation-protocol/route.ts|POST': { owner: 'Organization representation configuration (org_configurations).', behavior: 'Approves the pending protocol for the caller organization; the service refuses self-approval and commits the approval with its audit record.', future: 'Authorize by a kernel decision once UE-INST-REPRESENTATION-AUTHORITY-SOURCE is adopted.', gate: 2, privacy: 'Representation configuration.', decisions: ['UE-INST-REPRESENTATION-AUTHORITY-SOURCE'], authn: 'Entra session via withAdminAuth.' },
  'admin/representation-protocol/route.ts|PUT': { owner: 'Organization representation configuration (org_configurations).', behavior: 'Saves a draft protocol for the caller organization in pending-approval state and commits it with its audit record.', future: 'Authorize by a kernel decision once UE-INST-REPRESENTATION-AUTHORITY-SOURCE is adopted.', gate: 2, privacy: 'Representation configuration.', decisions: ['UE-INST-REPRESENTATION-AUTHORITY-SOURCE'], authn: 'Entra session via withAdminAuth.' },
}

export const CARRY_FORWARD_IDS = Object.keys(CARRY_EXTRA)

function carryForwardFacts(id) {
  const base = UNRESOLVED_FACTS[id]
  if (!base) throw new Error(`no Gate 0B.1 facts for carried-forward operation ${id}`)
  const extra = CARRY_EXTRA[id]
  const { proposedCapability, unresolvedReason, domain, ...rest } = base
  void proposedCapability
  void unresolvedReason
  void domain
  const record = {
    ...rest,
    authenticationMechanism: extra.authn,
    dataOwnership: extra.owner,
    privacyDisclosure: extra.privacy,
    implementedBehavior: extra.behavior,
    requiredGate: extra.gate,
    requiredFutureGuard: extra.future,
    institutionalDecisions: extra.decisions,
    carriedForwardFrom: GATE_0B1_NEW.carriedForwardFrom,
    evidence: [...base.evidence, ...(extra.evidenceAdd ?? []).map(([route, quote]) => ev(`${APP}${route}`, quote))],
    defects: [...new Set([...(base.defects ?? []), ...(extra.defectsAdd ?? [])])],
  }
  if (extra.crossTenant) {
    record.crossTenantExposure = true
    record.crossTenantAuthorized = false
    record.exposureContract = 'Reads organization-spanning data at a platform_lead role title. No adopted decision authorizes the read; it is recorded as an implementation defect, not as authorized access.'
  }
  if (id === 'admin/database/health/route.ts|GET' || id === 'admin/feature-flags/route.ts|GET' || id === 'admin/jobs/[action]/route.ts|POST' || id === 'admin/jobs/retry/route.ts|POST' || id === 'admin/database/optimize/route.ts|POST' || id === 'admin/feature-flags/route.ts|PATCH') {
    record.platformScoped = true
  }
  if (id.startsWith('admin/representation-protocol/route.ts') && id.endsWith('GET')) record.defects = record.defects.filter((item) => item !== 'DEF-0B1-REP-PROTOCOL-NOT-IN-CAPABILITY-MODEL')
  return record
}

export function factsFor(id, readSource) {
  const [route, method] = id.split('|')
  if (CARRY_FORWARD_IDS.includes(id)) return carryForwardFacts(id)
  if (CRUD_MEMBER_ROUTES.includes(route) || Object.values(CRUD_ANALYTICS_ROUTES).flat().includes(route)) {
    return crudFacts2(route, method, readSource(`${APP_API}${route}`))
  }
  if (PLATFORM_ROUTES.has(id)) return platformFacts(id)
  if (AI_ROUTES.has(id)) return aiFacts(id)
  if (id === 'alerts/realtime/route.ts|GET') return null
  throw new Error(`no Gate 0B.2 facts for ${id}`)
}

export const UNRESOLVED_0B2 = {
  'alerts/realtime/route.ts|GET': {
    domain: 'UNRESOLVED',
    proposedCapability: 'Observability alerting visibility for an organization; a new narrow capability is not warranted until the institutional owner is named, and the closest existing owner (UE-CAP-K-005, audit and security) names mutation audit, not alert reading.',
    unresolvedReason: 'No register entry, persona source or capability record names observability alerting. The route is a real organization-scoped read, but whether alert rules are organization administration, platform operations or security monitoring is not stated in the source.',
    evidenceGap: 'The institutional owner of observability alerting (UE-INST-OBSERVABILITY-ALERT-OWNER) is not recorded. The software owner cannot be chosen without it, because the candidate capabilities carry different gates and different readers.',
    softwareOwnerCandidate: 'UE-CAP-K-005 for the audit-in-transaction obligation of the sweep that writes alerts; reader ownership is undecided.',
    institutionalDecisions: ['UE-INST-OBSERVABILITY-ALERT-OWNER'],
    persona: 'Organization member holding the grievance_case_suite entitlement',
    serviceOwner: `${APP}services/observability/realtime-alerting-service.ts`,
    authenticationMechanism: 'Entra session via withApi (auth.minRole member).',
    authorizationCategory: 'ROLE_FLOOR',
    kernelAuthorization: false,
    authorizationDetail: "withApi minRole 'member' plus the grievance_case_suite entitlement. Any member reads the organization's realtime alerts.",
    tenantScope: 'getRecentRealtimeAlerts filters on the caller organizationId.',
    dataOwnership: 'alert_rules rows written by the observability sweep.',
    dataSensitivity: 'Alert rule names and messages for the organization',
    privacyDisclosure: 'Alert content reaches every member; the source states no redaction.',
    mutationAudit: 'NOT_MUTATING',
    auditDetail: 'A read of alert rows; nothing is written.',
    implementedBehavior: 'Returns recent observability alerts for the caller organization.',
    implementationStatus: 'IMPLEMENTED_IN_SOURCE',
    requiredGate: 14,
    requiredFutureGuard: 'Name the owner, then authorize readers by role or mandate.',
    evidence: [
      routeEv('alerts/realtime/route.ts', "auth: { minRole: 'member' },"),
      routeEv('alerts/realtime/route.ts', 'getRecentRealtimeAlerts(organizationId'),
      ev(`${APP}services/observability/realtime-alerting-service.ts`, 'export async function getRecentRealtimeAlerts'),
    ],
    defects: [],
    manifestCorrections: [],
  },
}

export { groupOfRoute }
