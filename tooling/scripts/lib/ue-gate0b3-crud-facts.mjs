/**
 * Gate 0B.3 facts for the operations that run through the generic CRUD factory. Every statement was read from the
 * cited route, schema or factory file; the builder refuses to write the register unless each quote is present.
 * Ownership is accountability, not authorization: the factory authorises by organization and role floor only, and
 * no record here treats that floor as a kernel decision.
 */
import { ANALYTICS_METRIC_ROUTES, CAPABILITY_IDS_0B3 as IDS } from './ue-gate0b3-groups.mjs'
import { APP, CRUD_FACTORY, CRUD_GOVERNANCE, LOW_ROLE, ev, routeEv, appEv } from './ue-gate0b3-fact-helpers.mjs'

const MASS_CREATE = ev(CRUD_FACTORY, '? { ...(body as Record<string, unknown>) }')
const MASS_PATCH = ev(CRUD_FACTORY, 'let updates = stripBlockedPatchFields(body, { pk, orgScoped, blockedPatchFields });')
const SOFT_DELETE = ev(CRUD_FACTORY, ".set({ status: 'archived', updatedAt: new Date() } as Record<string, unknown>)")
const HARD_DELETE = ev(CRUD_FACTORY, '// Hard delete for tables without a status column')
const FACTORY_AUDIT = ev(CRUD_FACTORY, 'await persistAtomicAudit(tx, {')

const ENUMS = {
  memberBreaks: { file: 'db/schema/domains/member/member-breaks.ts', marker: 'export const breakStatusEnum = pgEnum("break_status", [', column: 'status: breakStatusEnum("break_status").notNull().default("scheduled"),' },
  negotiations: { file: 'db/schema/bargaining-negotiations-schema.ts', marker: 'export const negotiationStatusEnum = pgEnum("negotiation_status", [', column: 'status: negotiationStatusEnum("status").notNull().default("scheduled"),' },
  bargainingProposals: { file: 'db/schema/bargaining-negotiations-schema.ts', marker: 'export const proposalStatusEnum = pgEnum("proposal_status", [', column: 'status: proposalStatusEnum("status").notNull().default("draft"),' },
  arbitrations: { file: 'db/schema/grievance-schema.ts', marker: 'export const arbitrationStatusEnum = pgEnum("arbitration_status", [', column: 'status: arbitrationStatusEnum("status").notNull().default("pending"),' },
}

const AUDIT_TABLE_DETAILS = (sql) => `${sql} is OPERATIONAL, so the factory commits the audit record in the same tenant transaction (crud.${sql}.<action>) and lists the field names it changed.`
const READ_AUDIT = 'A read: the generic factory writes no row and no audit record.'

/**
 * Per-table description. `defects(method, route)` lists the defects the method and route carry; `cross` marks a table
 * whose application query adds no tenant predicate.
 */
const TABLES = {
  kpiConfigurations: {
    sql: 'kpi_configurations', capability: 'UE-CAP-K-007', gate: 13, deps: [14], status: () => 'IMPLEMENTED_IN_SOURCE', deleteKind: 'none',
    ownership: 'kpi_configurations rows owned by the organization; createdBy records the author.',
    sensitivity: 'KPI definitions, alert thresholds and alert recipients',
    privacy: (method) => (method === 'GET' ? 'The alertRecipients column is returned to every member at the read floor.' : 'A steward-supplied alertRecipients value is stored as supplied.'),
    behavior: (method, floor) => (method === 'GET'
      ? `Returns the organization's KPI configurations, including alert thresholds and alert recipients, at a role floor of ${floor}.`
      : `Inserts a caller-supplied KPI configuration for the organization and audits it at a role floor of ${floor}.`),
    future: 'Authorize KPI configuration by the office that owns reporting, validate the body against a schema, and withhold alertRecipients from readers who do not manage alerts.',
    defects: (method) => (method === 'GET' ? ['DEF-0B3-KPI-ALERT-RECIPIENTS-MEMBER-READ'] : ['DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT']),
    extraEvidence: () => [appEv('db/schema/analytics.ts', 'alertRecipients')],
    readAudit: 'Audit reads of alert recipients once the reporting office is named; keep the factory in-transaction audit for writes.',
  },
  analyticsMetrics: {
    sql: 'analytics_metrics', capability: 'UE-CAP-K-007', gate: 13, deps: [14], status: () => 'FACADE_OVER_GENERIC_TABLE', deleteKind: 'none', facade: true,
    ownership: 'analytics_metrics: organization-scoped metric rows with no business owner in this route.',
    sensitivity: 'Organization analytics metric rows',
    privacy: () => 'Rows are returned as stored; the route name advertises a computed analytic that does not exist behind it.',
    behavior: (method, floor, advertised) => (method === 'GET'
      ? `Returns stored analytics_metrics rows for the caller organization under a role floor of ${floor}. The route name advertises ${advertised}; nothing is computed.`
      : `Inserts a caller-supplied analytics_metrics row for the organization and audits it. The route name advertises ${advertised}; nothing is computed.`),
    future: 'Compute analytics from source tables behind a purpose-built handler authorized by a kernel decision, and close the generic write.',
    defects: (method) => ['DEF-0B2-ANALYTICS-CRUD-FACADE', 'DEF-0B1-MANIFEST-DETECTOR', ...(method === 'POST' ? ['DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'] : [])],
    readAudit: 'Reads of stored metrics need no audit record; a computed analytic must record the data it was computed from.',
  },
  insightRecommendations: {
    sql: 'insight_recommendations', capability: 'UE-CAP-K-007', gate: 13, deps: [14], status: () => 'FACADE_OVER_GENERIC_TABLE', deleteKind: 'none', facade: true,
    ownership: 'insight_recommendations: organization-scoped rows that carry an AI reference and confidence score.',
    sensitivity: 'Organization insight recommendations, including AI provenance fields',
    privacy: () => 'A steward can store a recommendation that carries an AI reference and confidence score the caller chose.',
    behavior: (method, floor) => `Inserts a caller-supplied insight_recommendations row at a role floor of ${floor}. The body, including aiReferenceId and confidenceScore, is stored as supplied.`,
    future: 'Create insights only through the computation that produced them and refuse caller-supplied AI provenance fields.',
    defects: () => ['DEF-0B2-ANALYTICS-CRUD-FACADE', 'DEF-0B3-ANALYTICS-ROWS-FORGE-AI-PROVENANCE', 'DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT', 'DEF-0B1-MANIFEST-DETECTOR'],
    extraEvidence: () => [appEv('db/schema/analytics.ts', 'aiReferenceId')],
    readAudit: 'Not applicable: only the write is in this tranche.',
  },
  memberBreaks: {
    sql: 'member_breaks', capability: 'UE-CAP-K-007', gate: 13, deps: [14], status: () => 'PARTIAL', deleteKind: 'soft-invalid-enum', enumKey: 'memberBreaks',
    ownership: 'member_breaks rows about one organization member; memberId references organization_members.id.',
    sensitivity: 'Member break records: schedule, denial reasons and compliance flags per member',
    privacy: (method, route) => (route === 'breaks/route.ts'
      ? (method === 'GET'
        ? 'ownerColumn memberId compares organization_members.id with the session user id for every caller, staff included, so the collection cannot serve a steward reviewing members.'
        : 'The create path does not force memberId, because the explicit ownerColumn sets the low-role mode to open, so a member can record a break and its compliance fields on behalf of another member.')
      : (method === 'DELETE'
        ? 'The delete applies neither an owner column nor the low-role own-rows scope; any administrator can archive any break of the organization.'
        : 'Callers below steward are held to rows whose memberId equals the session user id, which is a UUID column compared with a session identity the source does not show to be the same identifier; staff reach any break of the organization.')),
    behavior: (method, floor, advertised, entitlement, route) => (route === 'breaks/route.ts' ? ({
      GET: `Returns member_breaks rows whose memberId equals the session user id, at a role floor of ${floor}.`,
      POST: `Inserts a caller-supplied member_breaks row for the organization at a role floor of ${floor}; memberId is taken from the body.`,
    }) : ({
      GET: `Returns one member_breaks row of the organization by id at a role floor of ${floor}; callers below steward are limited to rows whose memberId equals the session user id.`,
      PATCH: `Updates the member_breaks row with any body field at a role floor of ${floor}, including status, deniedBy and complianceFlag; callers below steward are limited to rows whose memberId equals the session user id.`,
      DELETE: 'Sets status archived on the organization member_breaks row at the administrator floor; the factory soft-delete value is not a break_status value.',
    }))[method],
    future: 'Bind the owner to the member identity the kernel resolves, force memberId on create, withhold employer-decision fields from members, and use a status the table accepts for deletion.',
    defects: (method, route) => [
      ...(method === 'GET' || route === 'breaks/route.ts' ? ['DEF-0B3-BREAKS-OWNER-IDENTITY-MISMATCH'] : []),
      ...(method === 'POST' ? ['DEF-0B3-BREAKS-CREATE-FOR-OTHER-MEMBER'] : []),
      ...(method === 'POST' || method === 'PATCH' ? ['DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'] : []),
      ...(method === 'DELETE' ? ['DEF-0B3-CRUD-SOFT-DELETE-ARCHIVED-NOT-IN-ENUM'] : []),
    ],
    extraEvidence: (route) => [
      ...(route === 'breaks/route.ts' ? [routeEv(route, "ownerColumn: 'memberId',"), ev(CRUD_FACTORY, 'conditions.push(eq(ownerCol, userId));')] : [ev(LOW_ROLE, 'export function lowRoleModeFor'), ev(CRUD_FACTORY, 'return resolveLowRoleScope(lowRoleMode, userId, organizationId);')]),
      appEv('db/schema/domains/member/member-breaks.ts', 'memberId: uuid("member_id").notNull().references(() => organizationMembers.id),'),
    ],
    readAudit: 'Reads of per-member break records are not audited; audit staff reads once the reviewing office is named.',
  },
  breakPolicies: {
    sql: 'break_policies', capability: 'UE-CAP-K-007', gate: 13, deps: [14], status: () => 'PARTIAL', deleteKind: 'hard',
    ownership: 'break_policies rows owned by the organization; they record CBA-derived break rules.',
    sensitivity: 'Break policy rules and CBA clause references',
    privacy: () => 'Policy rules are organization data with no personal columns.',
    behavior: (method, floor) => ({
      GET: `Returns break_policies rows for the caller organization at a role floor of ${floor}.`,
      POST: `Inserts a caller-supplied break_policies row at a role floor of ${floor}.`,
      PATCH: `Updates a break_policies row with any body field at a role floor of ${floor}.`,
      DELETE: 'Hard-deletes a break_policies row at the administrator floor; the table has no status column.',
    })[method],
    future: 'Authorize policy changes by the office that holds the CBA, validate the body, and keep a record of a policy that was deleted.',
    defects: (method) => (method === 'POST' || method === 'PATCH' ? ['DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'] : []),
    readAudit: 'Reads need no audit record; keep the factory in-transaction audit for writes.',
  },
  organizationMembers: {
    sql: 'organization_members', capability: 'UE-CAP-K-007', gate: 13, deps: [1, 14], status: (method) => (method === 'GET' ? 'FACADE_OVER_GENERIC_TABLE' : 'FACADE_OVER_GENERIC_TABLE'), deleteKind: 'none', members: true,
    ownership: 'Organization members table (identity and membership data owned by the organization member record).',
    sensitivity: 'Member roster: name, email, role, status',
    privacy: (method) => (method === 'GET' ? 'GET returns the caller own row below staff and the organization roster to staff, under a name that advertises an import.' : 'The write is refused, so no member data changes; the route name advertises a function it does not perform.'),
    behavior: (method, floor) => (method === 'GET'
      ? `Returns organization_members rows at a role floor of ${floor} (own row below staff). The route name advertises bulk import; nothing is imported.`
      : 'Attempts a POST on organization_members, which governance refuses with 403. The route name advertises bulk import; nothing is imported.'),
    future: 'Replace the route with a purpose-built import handler authorized by a kernel decision, or retire it to an honest HTTP 501.',
    defects: (method) => ['DEF-0B3-BULK-IMPORT-INERT', ...(method === 'GET' ? ['DEF-0B1-MANIFEST-DETECTOR'] : [])],
    readAudit: 'Reads of the roster are not audited; audit staff reads of the roster once readers are named.',
  },
  externalCalendarConnections: {
    sql: 'external_calendar_connections', capability: 'UE-CAP-K-007', gate: 13, deps: [14], status: () => 'PARTIAL', deleteKind: 'hard',
    ownership: 'external_calendar_connections rows owned by one user; they hold provider access and refresh tokens.',
    sensitivity: 'Calendar provider connection with access and refresh token columns',
    privacy: () => 'The row holds provider tokens; deleting the row removes the local copy only.',
    behavior: () => 'Hard-deletes the session user own calendar connection row at the administrator floor; the route calls no provider to revoke the grant.',
    future: 'Let the owner disconnect their own calendar at their own role, revoke the provider grant, and record the disconnect.',
    defects: () => ['DEF-0B3-CALENDAR-DISCONNECT-ADMIN-FLOOR-NO-REVOKE'],
    extraEvidence: (route) => [routeEv(route, "ownerColumn: 'userId',"), appEv('db/schema/calendar-schema.ts', 'refreshToken')],
    readAudit: 'Not applicable: only the disconnect is in this tranche.',
  },
  arbitrations: {
    sql: 'arbitrations', capability: 'UE-CAP-K-010', gate: 4, deps: [2, 14], status: () => 'IMPLEMENTED_IN_SOURCE', deleteKind: 'soft-invalid-enum', enumKey: 'arbitrations',
    ownership: 'arbitrations rows owned by the organization and tied to a grievance (grievanceId).',
    sensitivity: 'Arbitration stage of a grievance: board, arbitrators, deadlines, award and costs',
    privacy: () => 'Rows describe the arbitration stage of individual grievances and reach every steward in the organization.',
    behavior: (method, floor) => ({
      GET: `Returns arbitrations rows for the caller organization at a role floor of ${floor}.`,
      POST: `Inserts a caller-supplied arbitrations row, including grievanceId, at a role floor of ${floor}.`,
      PATCH: `Updates an arbitrations row with any body field, including status and award fields, at a role floor of ${floor}.`,
      DELETE: 'Sets status archived on an arbitrations row at the administrator floor; archived is not an arbitration_status value.',
    })[method],
    future: 'Authorize arbitration records through the case-ownership kernel, verify the grievance belongs to the organization, validate the body, and use a status the table accepts for deletion.',
    defects: (method) => ['DEF-0B3-ARBITRATION-RECORD-NO-CASE-AUTHORITY', ...(method === 'POST' || method === 'PATCH' ? ['DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'] : []), ...(method === 'DELETE' ? ['DEF-0B3-CRUD-SOFT-DELETE-ARCHIVED-NOT-IN-ENUM'] : [])],
    extraEvidence: () => [appEv('db/schema/grievance-schema.ts', 'grievanceId: uuid("grievance_id").references(() => grievances.id).notNull(),')],
    readAudit: 'Reads of arbitration records are not audited; audit reads once case authority is enforced.',
  },
  externalInvoices: {
    sql: 'external_invoices', capability: 'UE-CAP-D-003', gate: 5, deps: [14], status: (method) => (method === 'GET' ? 'IMPLEMENTED_IN_SOURCE' : 'PARTIAL'), deleteKind: 'none',
    ownership: 'external_invoices rows synchronized from an external accounting system for the organization.',
    sensitivity: 'Union accounting invoices: customer name, amounts, balances and dates',
    privacy: (method) => (method === 'GET' ? 'Customer names and balances reach every member at the read floor, ahead of any financial mandate.' : 'The write is refused, so nothing changes; the route advertises invoice creation.'),
    behavior: (method, floor, advertised, entitlement) => (method === 'GET'
      ? `Returns synchronized external_invoices rows for the caller organization at a role floor of ${floor} under the ${entitlement} entitlement.`
      : 'Attempts a POST on external_invoices, a READ_ONLY table in the CRUD governance list, which governance refuses with 403 before any row is written.'),
    future: 'Authorize invoice reads by a financial mandate and retire the refused write to an honest HTTP 501.',
    defects: (method) => (method === 'GET' ? ['DEF-0B3-EXTERNAL-INVOICES-MEMBER-FLOOR'] : ['DEF-0B3-EXTERNAL-INVOICES-WRITE-ADVERTISED']),
    readAudit: 'Audit reads of synchronized invoices once the financial mandate is enforced.',
  },
  negotiations: {
    sql: 'negotiations', capability: IDS.BARGAINING, gate: 14, deps: [10, 13], status: () => 'IMPLEMENTED_IN_SOURCE', deleteKind: 'soft-invalid-enum', enumKey: 'negotiations',
    ownership: 'negotiations rows owned by the organization; each carries a confidentialityLevel.',
    sensitivity: 'Collective-bargaining negotiation records: positions, strike-vote data and cost limits',
    privacy: (method) => (method === 'GET' ? 'Strike-vote results, cost ceilings and key issues reach every member at the read floor; the route ignores confidentialityLevel.' : 'Any body field is stored, including status, cost limits and strike-vote fields.'),
    behavior: (method, floor) => ({
      GET: `Returns negotiations rows for the caller organization at a role floor of ${floor}, whatever their confidentialityLevel.`,
      POST: `Inserts a caller-supplied negotiations row at a role floor of ${floor}.`,
      PATCH: `Updates a negotiations row with any body field, including status and cost limits, at a role floor of ${floor}.`,
      DELETE: 'Sets status archived on a negotiations row at the administrator floor; archived is not a negotiation_status value.',
    })[method],
    future: 'Authorize negotiation records to the offices that hold bargaining authority, honour confidentialityLevel, validate the body, and use a status the table accepts for deletion.',
    defects: (method) => [...(method === 'GET' ? ['DEF-0B3-BARGAINING-NEGOTIATION-RECORDS-MEMBER-READ'] : []), ...(method === 'POST' || method === 'PATCH' ? ['DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'] : []), ...(method === 'DELETE' ? ['DEF-0B3-CRUD-SOFT-DELETE-ARCHIVED-NOT-IN-ENUM'] : [])],
    extraEvidence: () => [appEv('db/schema/bargaining-negotiations-schema.ts', 'confidentialityLevel: varchar("confidentiality_level", { length: 50 }).default("restricted"),')],
    readAudit: 'Audit reads of negotiation records once the bargaining offices are named.',
  },
  bargainingProposals: {
    sql: 'bargaining_proposals', capability: IDS.BARGAINING, gate: 14, deps: [10, 13], status: () => 'IMPLEMENTED_IN_SOURCE', deleteKind: 'soft-invalid-enum', enumKey: 'bargainingProposals', cross: true,
    ownership: 'bargaining_proposals rows owned through negotiation_id -> negotiations.organization_id; the table has no organization column.',
    sensitivity: 'Bargaining proposals: union and management positions, costing and internal notes',
    privacy: () => 'Positions and internal notes are returned or changed with no application-layer tenant predicate.',
    behavior: (method, floor) => ({
      GET: `Returns bargaining_proposals rows at a role floor of ${floor} with no organization predicate in the query.`,
      POST: `Inserts a caller-supplied bargaining_proposals row, including any negotiationId, at a role floor of ${floor}.`,
      PATCH: `Updates a bargaining_proposals row by id with any body field at a role floor of ${floor}, with no organization predicate.`,
      DELETE: 'Sets status archived on a bargaining_proposals row by id at the administrator floor, with no organization predicate; archived is not a proposal_status value.',
    })[method],
    future: 'Verify every proposal against its parent negotiation and organization in the application layer, authorize to the bargaining offices, and use a status the table accepts for deletion.',
    defects: (method) => ['DEF-0B3-BARGAINING-PROPOSALS-NO-TENANT-PREDICATE', ...(method === 'POST' || method === 'PATCH' ? ['DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'] : []), ...(method === 'DELETE' ? ['DEF-0B3-CRUD-SOFT-DELETE-ARCHIVED-NOT-IN-ENUM'] : [])],
    extraEvidence: () => [appEv('db/schema/bargaining-negotiations-schema.ts', 'export const bargainingProposals = pgTable("bargaining_proposals", {'), ev(`${APP}db/migrations/20260910_rls_enforcement_expansion_round58.sql`, "PERFORM ue_create_parent_owned_rls_policy_v2('bargaining_proposals', 'negotiation_id', 'negotiations', 'organization_id', FALSE);")],
    exposureContract: 'The application query and the create path add no tenant predicate because bargaining_proposals has no organization column, so orgScoped is a no-op. Isolation depends entirely on a parent-owned row-level-security policy that a migration file declares and that this tranche does not prove is applied. No adopted decision authorizes cross-organization access to bargaining positions.',
    readAudit: 'Audit reads of bargaining proposals once the bargaining offices are named.',
  },
  bargainingNotes: {
    sql: 'bargaining_notes', capability: IDS.BARGAINING, gate: 14, deps: [10, 13], status: () => 'PARTIAL', deleteKind: 'hard',
    ownership: 'bargaining_notes rows owned by the organization; each carries a confidentialityLevel and a createdBy author.',
    sensitivity: 'Bargaining session notes under a confidentiality level (public, internal, restricted, confidential)',
    privacy: (method) => (method === 'GET' ? 'Any member reads any note in the organization by id, including restricted and confidential notes the collection route withholds.' : 'Any body field is stored or changed, including confidentialityLevel and the author.'),
    behavior: (method, floor) => ({
      GET: `Returns one bargaining_notes row by id at a role floor of ${floor}, without the confidentiality filter and agreement check the collection route applies.`,
      PATCH: `Updates a bargaining_notes row with any body field at a role floor of ${floor}, without the agreement check the collection create applies.`,
      DELETE: 'Hard-deletes a bargaining_notes row at the administrator floor; the table has no status column, so the note itself is not retained.',
    })[method],
    future: 'Serve note items through the audited bargaining-notes service that applies the confidentiality filter and agreement check, and keep a deleted note recoverable.',
    defects: (method) => [...(method === 'GET' ? ['DEF-0B3-BARGAINING-NOTE-ITEM-ROUTE-BYPASSES-CONFIDENTIALITY'] : []), ...(method === 'PATCH' ? ['DEF-0B3-BARGAINING-NOTE-ITEM-ROUTE-BYPASSES-CONFIDENTIALITY', 'DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'] : [])],
    extraEvidence: () => [appEv('lib/services/bargaining-notes-service.ts', 'visibleToUserId')],
    readAudit: 'Audit reads of restricted and confidential notes.',
  },
  arbitrationDecisions: {
    sql: 'arbitration_decisions', capability: IDS.PRECEDENT, gate: 14, deps: [13], status: () => 'IMPLEMENTED_IN_SOURCE', deleteKind: 'hard', cross: true, decisions: ['UE-INST-KNOWLEDGE-PUBLICATION'],
    ownership: 'arbitration_decisions: shared reference rows with no organization column; isPublic and accessRestrictions describe publication.',
    sensitivity: 'Arbitration decisions: parties, grievor, outcome, remedy and full text',
    privacy: () => 'Every decision row, public or not, is returned to every member of every organization, and an organization administrator can delete a shared row.',
    behavior: (method, floor) => ({
      GET: `Returns arbitration_decisions rows at a role floor of ${floor}; orgScoped is a no-op because the table has no organization column.`,
      POST: `Inserts a caller-supplied arbitration_decisions row at the content_manager role title, a role title in the organization hierarchy.`,
      PATCH: 'Updates a shared arbitration_decisions row with any body field at the content_manager role title.',
      DELETE: 'Hard-deletes a shared arbitration_decisions row at the organization administrator floor; the table has no status column.',
    })[method],
    future: 'Return only decisions marked for publication to other organizations, restrict shared-row writes to a platform mandate, and keep an audit record of every publication change.',
    defects: (method) => ['DEF-0B3-ARBITRATION-DECISIONS-NON-PUBLIC-READABLE-CROSS-TENANT', ...(method === 'POST' || method === 'PATCH' ? ['DEF-0B3-CRUD-BODY-MASS-ASSIGNMENT'] : []), ...(method === 'DELETE' ? ['DEF-0B3-ARBITRATION-DECISIONS-ORG-ADMIN-DELETES-SHARED-ROW'] : [])],
    extraEvidence: () => [ev(`${APP}db/migrations/manual/053_enable_rls_policies.sql`, 'FOR SELECT USING (is_public = true OR get_current_tenant_id() IS NOT NULL);')],
    exposureContract: 'arbitration_decisions has no organization column, so orgScoped is a no-op and the route returns, and lets a role in any organization change, every decision row. The row-level-security policy in the manual RLS file allows any tenant context to read rows where is_public is false. No adopted decision says who may publish a decision or who may change a shared one (UE-INST-KNOWLEDGE-PUBLICATION is outstanding), so reachability is not authorization.',
    readAudit: 'Audit publication changes and reads of restricted decisions.',
  },
}

const SUBRESOURCES = { 'arbitration/precedents/[id]/citations/route.ts': 'citations', 'arbitration/precedents/[id]/documents/route.ts': 'documents', 'arbitration/precedents/search/route.ts': 'search results' }

export const CRUD_ROUTES_0B3 = new Set([
  'analytics/kpis/route.ts', ...ANALYTICS_METRIC_ROUTES, 'analytics/insights/route.ts',
  'breaks/route.ts', 'breaks/[id]/route.ts', 'breaks/policies/route.ts', 'breaks/policies/[id]/route.ts',
  'bulk-import/route.ts', 'calendar-sync/connections/[id]/route.ts', 'arbitrations/route.ts', 'arbitrations/[id]/route.ts',
  'billing/invoices/route.ts', 'bargaining/negotiations/route.ts', 'bargaining/negotiations/[id]/route.ts',
  'bargaining/proposals/route.ts', 'bargaining/proposals/[id]/route.ts', 'bargaining-notes/[id]/route.ts',
  'arbitration/precedents/route.ts', 'arbitration/precedents/[id]/route.ts', 'arbitration/precedents/[id]/citations/route.ts',
  'arbitration/precedents/[id]/documents/route.ts', 'arbitration/precedents/search/route.ts',
])

const advertisedOf = (route) => route.replace(/\/route\.ts$/, '').replace(/^analytics\//, 'analytics ').replace(/\//g, ' ')

export function crudFacts3(route, method, source, readSource) {
  const tableName = source.match(/table: (\w+),/)?.[1]
  const table = TABLES[tableName]
  if (!table) throw new Error(`no Gate 0B.3 CRUD description for table ${tableName} in ${route}`)
  const readRole = source.match(/readRole: '(\w+)'/)?.[1]
  const writeRole = source.match(/writeRole: '(\w+)'/)?.[1]
  const entitlement = source.match(/entitlement: '(\w+)'/)?.[1]
  const isRead = method === 'GET'
  const floor = isRead ? readRole : method === 'DELETE' ? 'admin' : writeRole
  const isMembers = Boolean(table.members)
  const refused = (isMembers || table.sql === 'external_invoices') && !isRead
  const advertised = advertisedOf(route)
  const sub = SUBRESOURCES[route]

  const evidence = [routeEv(route, `table: ${tableName},`), ev(CRUD_FACTORY, 'export function crudRoutes'), ev(CRUD_GOVERNANCE, `'${table.sql}'`)]
  if (isRead) evidence.push(routeEv(route, `readRole: '${readRole}',`))
  else if (method !== 'DELETE') evidence.push(routeEv(route, `writeRole: '${writeRole}',`))
  if (entitlement) evidence.push(routeEv(route, `entitlement: '${entitlement}',`))
  if (isRead && isMembers) evidence.push(ev(LOW_ROLE, 'Callers below steward are therefore held to'))
  if (isRead && !isMembers) evidence.push(ev(LOW_ROLE, 'export function lowRoleModeFor'))
  evidence.push(...(table.extraEvidence?.(route) ?? []))

  let mutationAudit = 'NOT_MUTATING'
  let auditDetail = READ_AUDIT
  let requiredAudit = table.readAudit
  const corrections = []
  if (!isRead) {
    if (refused) {
      mutationAudit = 'WRITE_REFUSED_BY_GOVERNANCE'
      auditDetail = `${table.sql} is READ_ONLY in the CRUD governance table, so assertCrudWrite refuses with 403 before any write; nothing is mutated and nothing is audited.`
      evidence.push(ev(CRUD_GOVERNANCE, 'export function assertCrudWrite'))
      corrections.push({ field: 'audit', manifest: 'audit CRUD_ATOMIC', actual: `${table.sql} is READ_ONLY, so the write is refused before any row or audit record is written.` })
      requiredAudit = 'No audit record is required for a refused write; if the write is later enabled it must commit its audit record in the same transaction.'
    } else {
      mutationAudit = 'ATOMIC_AUDIT_IN_TRANSACTION'
      auditDetail = AUDIT_TABLE_DETAILS(table.sql)
      evidence.push(FACTORY_AUDIT)
      requiredAudit = 'Keep the factory in-transaction audit record and add the authorization decision and the changed values to it.'
    }
    if (method === 'POST' && !refused) evidence.push(MASS_CREATE)
    if (method === 'PATCH') evidence.push(MASS_PATCH)
    if (method === 'DELETE') {
      if (table.deleteKind === 'hard') evidence.push(HARD_DELETE)
      else {
        evidence.push(SOFT_DELETE)
        const spec = ENUMS[table.enumKey]
        evidence.push(appEv(spec.file, spec.marker), appEv(spec.file, spec.column))
        const text = readSource(`${APP}${spec.file}`)
        const start = text.indexOf(spec.marker)
        const block = text.slice(start, text.indexOf(']);', start))
        if (start < 0 || /archived/.test(block)) throw new Error(`${spec.marker} must exist and must not list archived for the soft-delete defect to be true`)
      }
    }
  }

  const defects = table.defects(method, route)
  if (sub) defects.push('DEF-0B3-ARBITRATION-DECISION-SUBRESOURCES-FACADE')
  const record = {
    persona: `Organization ${floor} or above through the generic CRUD factory`,
    serviceOwner: `${APP}lib/api/crud-factory.ts (crudRoutes over ${table.sql})`,
    authenticationMechanism: 'Authenticated session resolved by the generic CRUD factory (crudRoutes).',
    authorizationCategory: 'ROLE_FLOOR',
    kernelAuthorization: false,
    authorizationDetail: `Generic CRUD role floor: ${method} requires ${floor}${entitlement ? ` and the ${entitlement} entitlement` : ''}. A role title is not a kernel decision.`,
    tenantScope: table.cross ? 'orgScoped: true is a no-op here: the table has no organization column, so the query carries no tenant predicate.' : 'orgScoped: true: the factory scopes rows to the session organization.',
    dataOwnership: table.ownership,
    dataSensitivity: table.sensitivity,
    privacyDisclosure: table.privacy(method, route),
    mutationAudit,
    auditDetail,
    requiredAudit,
    implementedBehavior: sub ? `${table.behavior(method, floor, advertised, entitlement, route)} The route name advertises ${sub}; it returns or changes arbitration_decisions rows and serves no ${sub}.` : table.behavior(method, floor, advertised, entitlement, route),
    implementationStatus: sub ? 'FACADE_OVER_GENERIC_TABLE' : table.status(method),
    requiredGate: table.gate,
    dependencyGates: table.deps,
    requiredFutureGuard: table.future,
    institutionalDecisions: table.decisions ?? [],
    crudTable: table.sql,
    crudGovernanceClass: refused || isMembers || table.sql === 'external_invoices' ? 'READ_ONLY' : 'OPERATIONAL',
    evidence,
    defects: [...new Set(defects)],
    manifestCorrections: corrections,
  }
  if (table.cross) {
    record.crossTenantExposure = true
    record.crossTenantAuthorized = false
    record.exposureContract = table.exposureContract
  }
  return record
}
