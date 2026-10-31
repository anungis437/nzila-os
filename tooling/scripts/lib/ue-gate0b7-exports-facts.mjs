/**
 * Gate 0B.7 facts: the export and external-data surface. The /exports routes (collection, item, csv, excel, pdf) are
 * generic CRUD over the reports table, the evidence export is a static JSON snapshot, the external-data routes are
 * generic CRUD over the DENIED external_accounts table, and the external document download releases a storage link to a
 * represented outside party. Every evidence item is produced by `opAuthoring` from the exact handler, the helper or
 * service it calls, or the resolved schema, and is proved again by the validator. This tranche records the source; it
 * repairs nothing.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { GET_WRITES } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord } from './ue-gate0b5-crud.mjs'

const REPORT_CAP = 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION'
const PROVIDER_CAP = 'UE-OMIT-CALENDAR-AND-PROVIDER-CONNECTIONS'
const DOCUMENT_CAP = 'UE-CAP-F-002'
const REPORT_GATE = 14
const PROVIDER_GATE = 14
const DOCUMENT_GATE = 6

const REPORT_SCHEMA = `${APP}db/schema/domains/analytics/reports.ts`
const ACCOUNTING_SCHEMA = `${APP}db/schema/domains/data/accounting.ts`
const AUTHORITY_SCHEMA = `${APP}db/schema/representation-authority-schema.ts`
const EXTERNAL_AUTH_SERVICE = `${APP}lib/services/external-resource-authorization-service.ts`
const ROLES = `${APP}lib/auth/roles.ts`
const CRUD_GOVERNANCE_FILE = `${APP}lib/api/crud-governance.ts`

export const ROUTES = new Set([
  'evidence/export/route.ts',
  'exports/[id]/route.ts',
  'exports/csv/route.ts',
  'exports/excel/route.ts',
  'exports/pdf/route.ts',
  'exports/route.ts',
  'external-data/lrb/route.ts',
  'external-data/route.ts',
  'external/documents/[id]/download/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  EXPORTS_REPORT_DEFINITIONS: {
    capabilityId: REPORT_CAP,
    domain: 'EXPORT_SUITE_REPORT_DEFINITIONS',
    actor: 'Steward keeping, and member reading, the report definitions that sit behind the export suite entitlement, and any caller of the csv, excel and pdf export paths',
    routes: ['exports/route.ts', 'exports/[id]/route.ts', 'exports/csv/route.ts', 'exports/excel/route.ts', 'exports/pdf/route.ts'],
    evidence: [
      ev(REPORT_SCHEMA, "export const reports = pgTable('reports', {"),
      ev(REPORT_SCHEMA, "config: jsonb('config').notNull(), // Report configuration (data sources, fields, filters, etc.)"),
      ev(REPORT_SCHEMA, "export const reportFormatEnum = pgEnum('report_format', ["),
      ev(`${APP}services/platform-economics/entitlement-guard.ts`, "EXPORT_SUITE: 'export_suite',"),
    ],
  },
  EXPORTS_EVIDENCE_PACK: {
    capabilityId: REPORT_CAP,
    domain: 'EVIDENCE_PACK_SNAPSHOT',
    actor: 'Staff-level user requesting the evidence pack snapshot that a procurement or security reviewer reads, and the control-plane adapters that consume it',
    routes: ['evidence/export/route.ts'],
    evidence: [
      ev(`${APP}app/api/evidence/export/route.ts`, ' * Returns an evidence pack summary suitable for procurement / security'),
      ev(`${APP}app/api/evidence/export/route.ts`, " * `pnpm evidence:all` pipeline (collect → seal → verify). This endpoint"),
    ],
  },
  EXPORTS_EXTERNAL_PROVIDER_ACCOUNTS: {
    capabilityId: PROVIDER_CAP,
    domain: 'EXTERNAL_PROVIDER_ACCOUNT_DATA',
    actor: 'Steward and member reading and adding the chart-of-accounts rows that an accounting provider connection synchronizes into the organization',
    routes: ['external-data/route.ts', 'external-data/lrb/route.ts'],
    evidence: [
      ev(ACCOUNTING_SCHEMA, "export const externalAccounts = pgTable("),
      ev(ACCOUNTING_SCHEMA, "externalProvider: varchar('external_provider', { length: 50 }).notNull(),"),
      ev(`${APP}db/rls-storage-authority/integrations-workers.ts`, 'REAL live path: app/api/external-data/route.ts and app/api/external-data/lrb/route.ts are generic crud-factory'),
    ],
  },
  EXPORTS_EXTERNAL_DOCUMENT_DOWNLOAD: {
    capabilityId: DOCUMENT_CAP,
    domain: 'EXTERNAL_REPRESENTATIVE_DOCUMENT_DOWNLOAD',
    actor: 'External representative holding a representation authority, a matter grant and a document grant, downloading a document linked to a grievance they represent',
    routes: ['external/documents/[id]/download/route.ts'],
    evidence: [
      ev(AUTHORITY_SCHEMA, "export const externalDocumentAccessGrants = pgTable('external_document_access_grants', {"),
      ev(AUTHORITY_SCHEMA, "canDownload: boolean('can_download').notNull().default(false),"),
      ev(`${APP}db/rls-storage-authority/documents-evidence.ts`, 'app/api/external/documents/[id]/download/route.ts'),
    ],
  },
}

const D = (id, ownerCapabilityId, gate, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate, severity, title, ...extra })

export const DEFECTS = [
  D('DEF-0B7-EXP-EXPORT-ROUTES-ARE-REPORT-DEFINITION-CRUD-NO-FILE', REPORT_CAP, REPORT_GATE, 'MEDIUM',
    'The /api/exports, /api/exports/[id], /api/exports/csv, /api/exports/excel and /api/exports/pdf routes are the same generic crudRoutes configuration over the reports table: the csv, excel and pdf path segments are cosmetic, no handler reads any source table, builds a CSV, workbook or PDF, streams a file or sets a content type, and the reports table has no format, file or job column although a report_format enum of pdf, excel, csv, json and html exists, so a POST to /api/exports/pdf answers success with a report definition row and a GET answers a list of definitions, and nothing is exported.'),
  D('DEF-0B7-EXP-REPORT-DEFINITIONS-READABLE-AT-MEMBER-FLOOR', REPORT_CAP, REPORT_GATE, 'MEDIUM',
    'The export suite reads of the reports table are open to any member of an entitled organization: the table has no owner or personal column and the routes declare no ownerColumn, so the low-role guard stays open and a member receives every report definition of the organization, including definitions the author kept private (isPublic false), written by other users, in the financial, members and claims categories, with the whole config JSON that names the data sources, fields and filters of each report.'),
  D('DEF-0B7-EXP-REPORT-WRITES-ANY-STEWARD-ANY-FIELD', REPORT_CAP, REPORT_GATE, 'MEDIUM',
    'The export suite create and update take the whole request body into the reports row: a steward can create a report of reportType system, mark it a template or public, and set runCount, lastRunAt and templateId, and the update has no owner condition and blocks no field, so any steward can rewrite any report of the organization, including its createdBy, updatedBy, config, runCount and lastRunAt, which makes the author and usage columns of a report definition unreliable.'),
  D('DEF-0B7-EXP-REPORT-HARD-DELETE-AUDIT-NAMES-NO-FIELDS', REPORT_CAP, REPORT_GATE, 'LOW',
    'The reports table has no status column, so the administrator delete of an export suite report removes the row (hard delete) and the in-transaction audit record it writes lists an empty field set, which leaves no stored copy of the name, category or config of the deleted report definition.'),
  D('DEF-0B7-EXP-EVIDENCE-PACK-ATTESTATIONS-HARD-CODED', REPORT_CAP, REPORT_GATE, 'HIGH',
    'The evidence export, described as an evidence pack summary suitable for procurement and security review, returns policy_checks (grievance creation, status transition, escalation, arbitration seal and evidence immutability as enforced, cross_org_access as denied), org_isolation (enforced true, enforced at the db, route and audit layers, cross_org_read_attempts_blocked true) and an sbom marked available as string and boolean literals of the handler: the handler reads no database, test result, policy engine, sealed bundle or build artifact, so each assertion is returned whether or not the control holds, and the build timestamp, commit and version are environment fallbacks (process start time, local, 0.0.0).',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'Any authenticated caller whose organization role is not member and not empty, including the deprecated guest role, receives a 200 JSON document that states cross-organization access is denied and organization isolation is enforced at three layers, with no check behind any of the statements.',
        potentialImpact: {
          classes: ['FALSE_ATTESTATION_OR_OUTCOME'],
          description: 'A procurement or security reviewer, or a control-plane evidence adapter that consumes the same shape, receives hard-coded assurances of tenant isolation and evidence immutability as if they were measured, and can rely on them for a purchase, audit or compliance decision.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          { ref: 'apps/union-eyes/app/api/evidence/export/route.ts', quote: 'if (!orgRole || MEMBER_ONLY_ROLES.has(orgRole)) {' },
          { ref: 'apps/union-eyes/scripts/perf-baseline.ts', quote: "{ name: 'evidence-export', method: 'GET', path: '/api/evidence/export', threshold_p95_ms: 3000 }," },
        ],
        existingContainment: {
          summary: 'The handler refuses unauthenticated callers and callers whose organization role is member or empty, and its header states that the sealed evidence bundle is produced by the evidence pipeline, which limits who receives the snapshot but does not make any of its statements true.',
          evidence: [
            { ref: 'apps/union-eyes/app/api/evidence/export/route.ts', quote: 'if (!authResult.ok) return authResult.response' },
            { ref: 'apps/union-eyes/app/api/evidence/export/route.ts', quote: 'const MEMBER_ONLY_ROLES = new Set([\'member\', \'MEMBER\'])' },
          ],
        },
        blockingCondition: 'The snapshot is given to a procurement or security reviewer, or consumed by a platform evidence-pack adapter, as evidence of tenant isolation and evidence immutability before those controls are measured by the evidence pipeline and the statements are derived from that result.',
        justification: 'The route is live for non-member staff and its output is built for external review, so the harm is a false assurance rather than a data leak; no cross-tenant data is disclosed and the audience is role restricted, so the release is blocked only when the snapshot is used as evidence of controls that no code in the handler verifies.',
      },
    }),
  D('DEF-0B7-EXP-EVIDENCE-PACK-ORG-ID-ECHOED-FROM-QUERY', REPORT_CAP, REPORT_GATE, 'MEDIUM',
    'The evidence export labels the pack with the orgId query parameter (default unscoped) and never reads the organization of the session, so a caller can have the pack that asserts cross-organization access is denied issued under the identifier of any other organization, or of no organization, and the isolation assertions are not tied to the caller organization.'),
  D('DEF-0B7-EXP-EVIDENCE-PACK-ROLE-DENYLIST', REPORT_CAP, REPORT_GATE, 'LOW',
    'The evidence export role gate is a deny list of the two spellings member and MEMBER: every other organization role string passes, including the deprecated guest role and any role string that is not in the canonical list, and the response gives the deployed version and commit.'),
  D('DEF-0B7-EXP-EVIDENCE-PACK-EXPORT-NOT-AUDITED', REPORT_CAP, REPORT_GATE, 'LOW',
    'The evidence export records each issue only by incrementing a process-local counter (recordEvidenceExport), with no audit row, actor or organization, so who obtained the pack and when is lost on restart and is not reproducible across instances.'),
  D('DEF-0B7-EXP-EXTERNAL-DATA-ROUTES-REFUSE-EVERY-REQUEST-AND-MISNAMED', PROVIDER_CAP, PROVIDER_GATE, 'MEDIUM',
    'The /api/external-data and /api/external-data/lrb routes are the same generic crudRoutes configuration over external_accounts, the chart of accounts that accounting providers synchronize, which the CRUD governance table lists as DENIED, so every GET and POST answers 403 before any query; the lrb path name suggests labour relations board data but no board source is read by either route, and the table-level register of the repository still describes both routes as the live select and insert path of the table.'),
  D('DEF-0B7-EXP-EXTERNAL-DOWNLOAD-BEARER-LINK-NOT-BOUND-TO-GRANT', DOCUMENT_CAP, DOCUMENT_GATE, 'MEDIUM',
    'The external document download returns a read-only storage link in the JSON body with the default sixty-minute lifetime (generateSasUrl is called without an expiry), not bound to the caller, address or grant: the grant, the expiry and the revocation are checked only when the link is issued, so the link keeps working for the rest of its hour after the document grant is revoked or expires and can be passed to a person who holds no grant, and the audit row records the issue of the link, not a read of the blob.'),
  D('DEF-0B7-EXP-EXTERNAL-DOWNLOAD-RELEASES-LATEST-VERSION-NOT-GRANTED-VERSION', DOCUMENT_CAP, DOCUMENT_GATE, 'MEDIUM',
    'The external document download releases the document version with the highest version number at the time of the request: the external_document_access_grants table has no version column and the handler binds the grant to the document only, so a revision uploaded after the grant was made, which no one reviewed for disclosure to the outside party, is released under the earlier grant.'),
]

const MEMBER_READ_NOTE = 'The generic factory returns the reports rows of the session organization to any member; the low-role guard stays open because the table has no owner or personal column.'

const reportsFuture = 'Decide with the institution what an export is and who may request one, replace the report-definition CRUD with a real export operation that names the source, the format and the requester, authorizes the data it reads, escapes formula characters, stores or streams a file and records the request, and restrict report definitions to their author and the offices the institution names.'

const reportsProfile = {
  persona: 'Steward keeping, and member reading, report definitions through the export suite paths; no caller receives an exported file',
  owner: 'reports rows of the organization; createdBy holds the creating user id, set by the factory on create and rewritable by an update; config holds the report configuration JSON.',
  sens: 'Report names, descriptions, categories (claims, members, financial, compliance, performance) and the config JSON that names data sources, fields and filters; no exported data is stored in the row',
  priv: (method) => ({
    GET: 'Any member of an organization with the export_suite entitlement receives report definitions of the organization, including private and other users definitions with their config JSON; no exported data is returned.',
    POST: 'The response returns the stored definition row; the audit record lists the field names written and no values.',
    PATCH: 'The response returns the updated definition row; the audit record lists the field names written and no values.',
    DELETE: 'The deleted definition row is returned; the audit record names no field, so the removed definition is not kept.',
  })[method],
  does: (method, _model, floor) => ({
    GET: `Returns a page of reports rows of the organization (or one row by id on the item route) at a role floor of ${floor} and the export_suite entitlement. It reads no source table, builds no file and returns no export.`,
    POST: `Inserts a reports row from the request body at a role floor of ${floor} and the export_suite entitlement and returns it as success. It generates no file, reads no source table and records no export job, whatever the path segment (exports, csv, excel, pdf) says.`,
    PATCH: `Updates a reports row of the organization with any body field except id and organization at a role floor of ${floor}; no owner condition applies.`,
    DELETE: `Deletes the reports row of the organization (the table has no status column, so the delete is hard) at the fixed administrator floor (${floor}).`,
  })[method],
  future: reportsFuture,
  gate: REPORT_GATE,
  deps: [10, 13],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  def: (method) => [
    'DEF-0B7-EXP-EXPORT-ROUTES-ARE-REPORT-DEFINITION-CRUD-NO-FILE',
    ...(method === 'GET' ? ['DEF-0B7-EXP-REPORT-DEFINITIONS-READABLE-AT-MEMBER-FLOOR'] : []),
    ...(method === 'POST' || method === 'PATCH' ? ['DEF-0B7-EXP-REPORT-WRITES-ANY-STEWARD-ANY-FIELD'] : []),
    ...(method === 'DELETE' ? ['DEF-0B7-EXP-REPORT-HARD-DELETE-AUDIT-NAMES-NO-FIELDS'] : []),
  ],
  extraEv: (a) => [
    a.tbl('defect', 'reports', /config: jsonb\('config'\)\.notNull\(\)/),
    a.tbl('defect', 'reports', /isPublic: boolean\('is_public'\)/),
    a.tbl('defect', 'reports', 'reportType: reportTypeEnum(\'report_type\').notNull().default(\'custom\'),'),
    a.tbl('defect', 'reports', /createdBy: varchar\('created_by'/),
    ...(a.method === 'GET' ? [a.sch('privacy', `${APP}lib/api/crud-low-role-guard.ts`, "return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }")] : []),
    ...(a.method === 'POST' || a.method === 'PATCH' ? [a.tbl('defect', 'reports', /runCount: integer\('run_count'\)/)] : []),
    ...(a.method === 'DELETE' ? [a.imp('defect', 'crudRoutes', /const deleted = await audited\(organizationId, userId, 'delete', \[\],/)] : []),
    a.sch('defect', REPORT_SCHEMA, "export const reportFormatEnum = pgEnum('report_format', [", { symbol: 'reportFormatEnum' }),
  ],
  reqRead: 'Audit reads of report definitions once the offices that may read them are named; they carry the data sources, fields and filters of reports over claims, members and finances.',
  inferences: () => [
    { claim: 'defect', statement: 'The route file only configures crudRoutes over the reports table and imports no export engine, file writer, storage or format library, and the table has no format column, so the path segments csv, excel and pdf select nothing and the same definition rows come back from every export path.' },
  ],
}

const externalDataFuture = 'Decide which provider data the organization may read through an API, serve it from a dedicated route that names the provider and the office that may read balances, and either retire these generic routes or take the table out of the DENIED class only with an authority-checked, audited read and a verified provider source.'

const externalDataProfile = {
  persona: 'Steward or member attempting to list or add synchronized chart-of-accounts rows through the generic factory, which refuses both',
  owner: 'external_accounts rows of the organization, written by the accounting provider adapters (QuickBooks and Xero) and keyed by organization, provider and external id.',
  sens: 'Chart-of-accounts names, account types, classification and the current balance of each account synchronized from an accounting provider',
  priv: (method) => (method === 'GET'
    ? 'Nothing is returned: the governance class of external_accounts is DENIED, so the read is refused with 403 before the query.'
    : 'Nothing is stored: the write is refused with 403 before any row or audit record is written.'),
  does: (method, _model, floor) => (method === 'GET'
    ? `Answers 403 to every caller at the ${floor} role floor: assertCrudRead refuses the DENIED table before any query. The path name external-data/lrb suggests labour relations board data; no board source is read.`
    : `Answers 403 to every caller at the ${floor} role floor: assertCrudWrite refuses the DENIED table before the insert. The path name external-data/lrb suggests labour relations board data; no board source is read.`),
  future: externalDataFuture,
  gate: PROVIDER_GATE,
  deps: [1, 13],
  status: () => 'LATENT_NOT_OPERATIONAL',
  def: () => ['DEF-0B7-EXP-EXTERNAL-DATA-ROUTES-REFUSE-EVERY-REQUEST-AND-MISNAMED'],
  extraEv: (a) => [
    a.sch('defect', CRUD_GOVERNANCE_FILE, "'external_accounts', 'security_events', 'poll_votes', 'wcb_claims', 'member_employment', 'pending_profiles',"),
    a.tbl('privacy', 'externalAccounts', /currentBalance: numeric\('current_balance'/),
    a.tbl('privacy', 'externalAccounts', /externalProvider: varchar\('external_provider'/),
  ],
  reqRead: 'No audit record is needed for a refused read; a dedicated, authority-checked provider-data route must audit the reads that return account balances.',
}

const evidenceFuture = 'Compute every assertion of the pack from the evidence pipeline result or a live check and leave a statement out when it was not measured, issue the pack for the organization of the session, allow the named staff roles rather than deny two role spellings, rate limit it and write an audit record of who obtained it.'

function evidenceFacts(a) {
  return mk({
    persona: 'Staff-level user, or any holder of a non-member role, requesting the evidence pack snapshot for procurement or security review',
    service: `${API}evidence/export/route.ts (GET)`,
    authn: `${SESSION}: authenticateUser returns 401 when auth() carries no user id.`,
    authz: 'authenticateUser plus an in-handler deny list: the caller is refused only when the organization role from auth() is empty or the exact string member or MEMBER. Every other role string passes. A role title is not a kernel decision and the route names no office that may obtain evidence.',
    tenant: 'No organization data is read. The handler ignores the organization of the session and takes orgId from the query string, defaulting to unscoped, and echoes it in the response.',
    owner: 'No stored rows. The response is built from literals and environment variables of the running process.',
    sens: 'The deployed package version and commit, a build timestamp, and assertions about the isolation and immutability controls of the product',
    priv: 'No member or organization data is returned. The response states that cross-organization access is denied and that organization isolation is enforced for the organization id the caller named, which no code in the handler checks.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the handler writes no row and no audit record. recordEvidenceExport increments a process-local counter and stores no actor, organization or time.',
    reqAudit: 'Record each issue of the evidence pack with the actor and organization in the audit trail, and derive every assertion in it from the evidence pipeline.',
    does: 'Returns a JSON document with the package version, commit and build timestamp, an sbom marked available, policy checks marked enforced or denied, organization isolation marked enforced and the pipeline script names. Every assertion is a literal of the handler; nothing is read from a database, test result or sealed bundle.',
    status: 'PARTIAL',
    gate: REPORT_GATE,
    deps: [13, 15],
    future: evidenceFuture,
    ev: [
      a.imp('authentication', 'authenticateUser', 'const { userId } = await auth()'),
      a.h('authentication', 'const authResult = await authenticateUser()'),
      a.h('authorization', 'const { orgRole } = await auth()'),
      a.h('authorization', 'if (!orgRole || MEMBER_ONLY_ROLES.has(orgRole)) {'),
      a.h('tenantScope', "const orgId = searchParams.get('orgId') ?? 'unscoped'"),
      a.h('mutation', 'recordEvidenceExport()'),
      a.h('behavior', "cross_org_access: 'denied',"),
      a.h('behavior', "evidence_immutability: 'enforced',"),
      a.h('behavior', 'cross_org_read_attempts_blocked: true,'),
      a.h('behavior', "sbom: { format: 'cyclonedx', available: true, source: 'pnpm evidence:collect' },"),
      a.h('defect', 'org_id: orgId,'),
      a.h('defect', 'enforced: true,'),
      a.imp('defect', 'recordEvidenceExport', 'evidenceExportCount++'),
      a.svc('defect', ROLES, 'GUEST = "guest",'),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler body consists of the authentication call, the role check, the query parameter read and a response built from literals and process constants; it contains no database, policy engine, file or network call, so none of the policy_checks, org_isolation or sbom values is derived from a control.' },
      { claim: 'defect', statement: 'The handler never reads the organization of the session: only the orgRole and userId fields of auth() are used, and orgId comes from the query string and is echoed as org_id.' },
    ],
    def: [
      'DEF-0B7-EXP-EVIDENCE-PACK-ATTESTATIONS-HARD-CODED',
      'DEF-0B7-EXP-EVIDENCE-PACK-ORG-ID-ECHOED-FROM-QUERY',
      'DEF-0B7-EXP-EVIDENCE-PACK-ROLE-DENYLIST',
      'DEF-0B7-EXP-EVIDENCE-PACK-EXPORT-NOT-AUDITED',
    ],
  })
}

const downloadFuture = 'Bind the issued link to the grant: a short lifetime measured in minutes, a link bound to the caller, and a download streamed through the route after the grant is checked, or a revocation that invalidates outstanding links; bind the document grant to the version it was made for; and decide with the institution which privileged and member-sensitive documents an outside representative may be granted.'

function downloadFacts(a) {
  return mk({
    persona: 'External representative of a grievance (outside counsel or a representing union) holding an active representation authority, a matter grant that allows downloads and a document grant that allows download of this document',
    service: `${API}external/documents/[id]/download/route.ts (withExternalMatterResourceAuth, authorizeExternalDocumentAccess)`,
    authn: `${SESSION} (requireUser in withExternalMatterResourceAuth; 401 when not signed in, 403 on any failure).`,
    authz: 'withExternalMatterResourceAuth requires an active representation authority and matter grant with the download_documents permission for the actor, the matter and the organization named in the query, and the handler then requires an active, unexpired, unrevoked document grant that names this document, the authority, the matter grant and the actor with canDownload. These are explicit grants, not a role title and not a kernel decision: authorizeAction is not called.',
    tenant: 'The organization and matter come from the query string but are only accepted when an authority and grant rows for this actor name them; the document is selected by path id with the organization predicate, the active status, no deletion and a link to the grievance, and the version is selected with the organization predicate.',
    owner: 'documents and document_versions rows of the organization; the grievance link, the representation authority and the matter and document grants bind the outside party.',
    sens: 'The stored file of a grievance document (possibly member personal, medical, disciplinary or privileged content), its title, MIME type and a storage link',
    priv: 'The caller receives a read-only storage link to the latest version of the document, valid for sixty minutes, together with the title and MIME type. The audit row names the authority, grants, document and version and never the link.',
    mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
    auditDetail: 'The GET writes an audit_logs row (document.external_download) through persistAtomicAudit before the link is returned, and returns 503 when that write fails. The grant decision, allowed or denied, is recorded separately by auditLog inside authorizeExternalDocumentAccess before the handler continues; the two writes are separate and the link read from storage is not recorded.',
    reqAudit: 'Keep the audit row written before the link is returned and add the actual blob read or an issue-and-use pair, so that a download by a revoked grant holder can be told from the issue of a link.',
    does: 'Checks the authority, matter grant and document grant, reads the active document linked to the grievance, selects its latest version, generates a read-only storage link of the default sixty-minute lifetime, writes the audit row and returns the document id, title, MIME type and link. It streams no file.',
    status: 'PARTIAL',
    gate: DOCUMENT_GATE,
    deps: [13],
    future: downloadFuture,
    ev: [
      a.imp('authentication', 'withExternalMatterResourceAuth', 'const user = await requireUser();'),
      a.imp('authorization', 'withExternalMatterResourceAuth', 'const decision = await authorizeExternalMatterAccess({'),
      a.h('authorization', "requiredPermission: 'download_documents',"),
      a.h('authorization', 'const decision = await authorizeExternalDocumentAccess({'),
      a.imp('authorization', 'authorizeExternalDocumentAccess', 'eq(externalDocumentAccessGrants.documentId, input.documentId),'),
      a.imp('authorization', 'authorizeExternalDocumentAccess', 'eq(externalDocumentAccessGrants.userId, input.actor.userId),'),
      a.imp('tenantScope', 'withExternalMatterResourceAuth', 'return await withRLSContext({ organizationId: resource.organizationId }, async () => {'),
      a.h('tenantScope', 'eq(documents.organizationId, context.organizationId),'),
      a.h('tenantScope', 'eq(documentLinks.linkedEntityId, context.matterId),'),
      a.h('tenantScope', 'eq(documentVersions.organizationId, context.organizationId),'),
      a.h('mutation', 'await persistAtomicAudit(db as unknown as RLSTx, {'),
      a.imp('mutation', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.svc('audit', EXTERNAL_AUTH_SERVICE, 'return auditLog({', 'auditExternalAuthorizationDecision'),
      a.h('behavior', 'downloadUrl = await generateSasUrl(DOCUMENT_BLOB_CONTAINER, latestVersion.storageKey);'),
      a.h('defect', '.orderBy(desc(documentVersions.versionNo))'),
      a.sch('defect', AUTHORITY_SCHEMA, /export const externalDocumentAccessGrants = pgTable\(/, { symbol: 'externalDocumentAccessGrants', absentColumns: ['versionId', 'documentVersionId', 'versionNo'] }),
    ],
    inf: [
      { claim: 'defect', statement: 'The handler calls generateSasUrl with a container and a blob path only, so the lifetime is the default of the @nzila/blob helper (expiresInMinutes = 60, read permission, no caller or address condition in packages/blob/src/index.ts, a workspace package outside the app import graph that the provenance check cannot cite); the grant checks run before the call and are not repeated when the link is used against storage.' },
      { claim: 'defect', statement: 'The version query selects by document and organization ordered by version number descending with a limit of one and consults no grant column, and the grant table has no version column.' },
    ],
    def: ['DEF-0B7-EXP-EXTERNAL-DOWNLOAD-BEARER-LINK-NOT-BOUND-TO-GRANT', 'DEF-0B7-EXP-EXTERNAL-DOWNLOAD-RELEASES-LATEST-VERSION-NOT-GRANTED-VERSION'],
    corr: [GET_WRITES('NOT_APPLICABLE:READ')],
  })
}

export function facts(a, readText) {
  const { route } = a
  if (route === 'evidence/export/route.ts') return evidenceFacts(a)
  if (route === 'external/documents/[id]/download/route.ts') return downloadFacts(a)
  if (route.startsWith('exports/')) return crudRecord(a, readText, reportsProfile)
  if (route.startsWith('external-data/')) return crudRecord(a, readText, externalDataProfile)
  throw new Error(`no exports facts for ${a.route}`)
}
