/**
 * Gate 0B.8 facts: the federation, local, external representative and feature flag surface. The federation and local
 * routes are the generic CRUD factory over the federations and bargaining_units tables (the four federation sub-resource
 * paths are copies of the federation item route, and the benchmark path is a copy of the grievance collection route), the
 * four external routes release grievance data to an outside representative through representation authority and grant
 * rows, and the feature flag route evaluates the global feature_flags table for the caller. Every evidence item is
 * produced by `opAuthoring` from the exact handler, the helper or service it calls, or the resolved schema, and is proved
 * again by the validator. This tranche records the source; it repairs nothing.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, API, LOW_ROLE, CRUD_FACTORY, CRUD_GOVERNANCE, guardEv, GET_WRITES } from './ue-gate0b4-fact-helpers.mjs'
import { crudRecord, crudModel } from './ue-gate0b5-crud.mjs'

const FED_CAP = 'UE-OMIT-FEDERATION-LOCAL-HIERARCHY'
const EXTERNAL_CAP = 'UE-CAP-F-002'
const FLAG_CAP = 'UE-OMIT-PLATFORM-OPERATOR-CONTROLS'
const FED_GATE = 14
const EXTERNAL_GATE = 6
const FLAG_GATE = 9

const D_FEDERATION = 'UE-INST-FEDERATION-AFFILIATE-DATA-SHARING'
const D_EXTERNAL_DEPOSIT = 'UE-INST-EXTERNAL-REPRESENTATIVE-DOCUMENT-DEPOSIT'
const D_AUTHORITY = 'UE-INST-REPRESENTATION-AUTHORITY-SOURCE'

const FEDERATION_SCHEMA = `${APP}db/schema/domains/federation/federation-schema.ts`
const STRUCTURE_SCHEMA = `${APP}db/schema/union-structure-schema.ts`
const AUTHORITY_SCHEMA = `${APP}db/schema/representation-authority-schema.ts`
const FEATURES_SCHEMA = `${APP}db/schema/domains/infrastructure/features.ts`
const EXTERNAL_AUTH_SERVICE = `${APP}lib/services/external-resource-authorization-service.ts`
const BLOB_SERVICE = `${APP}lib/services/document-blob-integrity-service.ts`
const AUDIT_LOGGER = `${APP}lib/audit-logger.ts`
const FEATURE_SERVICE = `${APP}lib/services/feature-flags.ts`
const UPLOAD_AUTHORITY = `${APP}lib/services/external-upload-authority.ts`
const DB_PROXY = `${APP}db/db.ts`
const GRIEVANCE_SCHEMA = `${APP}db/schema/domains/claims/grievances.ts`

export const ROUTES = new Set([
  'external/documents/[id]/route.ts',
  'external/grievances/[id]/documents/route.ts',
  'external/grievances/[id]/documents/upload/route.ts',
  'external/grievances/[id]/route.ts',
  'feature-flags/route.ts',
  'federations/[id]/affiliates/route.ts',
  'federations/[id]/dashboard/route.ts',
  'federations/[id]/meetings/route.ts',
  'federations/[id]/remittances/route.ts',
  'federations/[id]/route.ts',
  'federations/benchmark/grievances/route.ts',
  'federations/route.ts',
  'locals/[id]/route.ts',
  'locals/route.ts',
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  FED_FEDERATION_REGISTER: {
    capabilityId: FED_CAP,
    domain: 'FEDERATION_ORGANIZATION_REGISTER',
    actor: 'Steward or officer of a federation organization reading the federation record that the organization holds about itself; no caller can write it through these routes',
    routes: ['federations/route.ts', 'federations/[id]/route.ts'],
    evidence: [
      ev(FEDERATION_SCHEMA, "organizationId: uuid('organization_id').notNull(), // Link to organizations table (type: 'federation')"),
      ev(FEDERATION_SCHEMA, "uniqueFederationOrgId: unique('federations_organization_id_key').on(table.organizationId),"),
      ev(CRUD_GOVERNANCE, "'external_invoices', 'polls', 'federations', 'data_classification_policy',"),
    ],
  },
  FED_FEDERATION_SUBRESOURCE_PATHS: {
    capabilityId: FED_CAP,
    domain: 'FEDERATION_AFFILIATE_DASHBOARD_MEETING_REMITTANCE_PATHS',
    actor: 'Federation steward or officer who would expect the affiliates, dashboard, meetings and remittances of the federation from these paths',
    routes: ['federations/[id]/affiliates/route.ts', 'federations/[id]/dashboard/route.ts', 'federations/[id]/meetings/route.ts', 'federations/[id]/remittances/route.ts'],
    evidence: [
      ev(`${API}federations/[id]/dashboard/route.ts`, ' * CRUD item route for federations'),
      ev(FEDERATION_SCHEMA, 'export const federationRemittances = pgTable('),
      ev(`${APP}db/rls-storage-authority/reference-latent.ts`, 'app/api/federations/[id]/remittances/route.ts'),
    ],
  },
  FED_FEDERATION_BENCHMARK_GRIEVANCES: {
    capabilityId: FED_CAP,
    domain: 'FEDERATION_GRIEVANCE_BENCHMARK',
    actor: 'Federation officer who would expect a benchmark of grievances across affiliates; the route is the grievance collection route of the generic factory',
    routes: ['federations/benchmark/grievances/route.ts'],
    evidence: [
      ev(`${API}federations/benchmark/grievances/route.ts`, ' * CRUD collection route for grievances'),
      ev(CRUD_GOVERNANCE, "const OWN_ROWS_READ = ['grievances', 'claims', 'claim_deadlines'] as const"),
    ],
  },
  FED_LOCAL_BARGAINING_UNITS: {
    capabilityId: FED_CAP,
    domain: 'LOCAL_PATH_BARGAINING_UNIT_RECORDS',
    actor: 'Steward keeping, and member reading, the bargaining unit records of the organization that the locals paths serve',
    routes: ['locals/route.ts', 'locals/[id]/route.ts'],
    evidence: [
      ev(STRUCTURE_SCHEMA, "export const bargainingUnits = pgTable("),
      ev(STRUCTURE_SCHEMA, "certificationNumber: varchar('certification_number', { length: 100 }),"),
      ev(`${APP}db/rls-storage-authority/claims-continuity.ts`, 'app/api/locals/[id]/route.ts'),
    ],
  },
  FED_EXTERNAL_MATTER_PROJECTION: {
    capabilityId: EXTERNAL_CAP,
    domain: 'EXTERNAL_REPRESENTATIVE_GRIEVANCE_VIEW',
    actor: 'External representative holding an active representation authority and a matter grant with the view permission for one grievance',
    routes: ['external/grievances/[id]/route.ts'],
    evidence: [
      ev(AUTHORITY_SCHEMA, "export const externalMatterAccessGrants = pgTable('external_matter_access_grants', {"),
      ev(AUTHORITY_SCHEMA, "canView: boolean('can_view').notNull().default(true),"),
      ev(`${APP}lib/services/external-matter-projection-service.ts`, 'export function toExternalMatterProjection(matter: InternalMatterLike): ExternalMatterProjection {'),
    ],
  },
  FED_EXTERNAL_DOCUMENT_READ: {
    capabilityId: EXTERNAL_CAP,
    domain: 'EXTERNAL_REPRESENTATIVE_DOCUMENT_METADATA',
    actor: 'External representative listing the grievance documents granted to them and reading the metadata of one granted document',
    routes: ['external/grievances/[id]/documents/route.ts', 'external/documents/[id]/route.ts'],
    evidence: [
      ev(AUTHORITY_SCHEMA, "export const externalDocumentAccessGrants = pgTable('external_document_access_grants', {"),
      ev(AUTHORITY_SCHEMA, "canViewDocuments: boolean('can_view_documents').notNull().default(false),"),
      ev(`${APP}db/rls-storage-authority/documents-evidence.ts`, 'app/api/external/documents/[id]/route.ts'),
    ],
  },
  FED_EXTERNAL_DOCUMENT_UPLOAD: {
    capabilityId: EXTERNAL_CAP,
    domain: 'EXTERNAL_REPRESENTATIVE_DOCUMENT_DEPOSIT',
    actor: 'External representative whose matter grant allows uploads, attaching a stored file to the grievance they represent',
    routes: ['external/grievances/[id]/documents/upload/route.ts'],
    evidence: [
      ev(AUTHORITY_SCHEMA, "canUploadDocuments: boolean('can_upload_documents').notNull().default(false),"),
      ev(UPLOAD_AUTHORITY, ' * Upload permission is the live matter grant. It does not let the representative'),
      ev(UPLOAD_AUTHORITY, "const REFUSED_PRIVILEGE_LABELS = ['privileged', 'highly_sensitive'] as const"),
    ],
  },
  FED_FEATURE_FLAG_EVALUATION: {
    capabilityId: FLAG_CAP,
    domain: 'FEATURE_FLAG_EVALUATION_FOR_CALLER',
    actor: 'Any signed-in user whose client asks which feature flags and which single named flag are on for them and their organization',
    routes: ['feature-flags/route.ts'],
    evidence: [
      ev(FEATURES_SCHEMA, 'export const featureFlags = pgTable("feature_flags", {'),
      ev(FEATURE_SERVICE, ' * Centralized feature flag evaluation for LRO progressive rollout.'),
      ev(`${APP}lib/services/feature-flags.constants.ts`, ' * Client-safe constants for feature flag names.'),
    ],
  },
}

export const DECISIONS = [
  {
    id: D_FEDERATION,
    status: 'OUTSTANDING',
    question: 'What may a federation see of its affiliates (member counts, per-capita remittances, meeting records, grievance benchmarks), who in the federation may see it, how is the parent and child relationship between a federation organization and an affiliate established and verified, and what minimum group size suppresses a published grievance statistic?',
    sourceState: 'The federations table links one organization to one federation row (organization_id is unique) and carries aggregate counters, but no source states which organization is the parent of which, who verifies an affiliation, or what an affiliate agrees to disclose; the affiliates, dashboard, meetings and remittances paths and the grievance benchmark path read none of it, and the generic governance table leaves federations READ_ONLY and grievances OWN_ROWS_READ.',
    softwareOwners: [FED_CAP],
  },
  {
    id: D_EXTERNAL_DEPOSIT,
    status: 'OUTSTANDING',
    question: 'Which files may an outside representative deposit on a grievance, through which intake that scans and sizes the file, and which office reviews a deposited file before it joins the case record and before any other party can see it?',
    sourceState: 'The upload route accepts a storage path or URL inside the organization document prefix, derives the document grant from the matter grant, and refuses privilege labels, but no source names the office that approves what an outside party attaches, no route lets an outside party place a new file in storage, and the intake prefix that holds scanned uploads is excluded from this route.',
    softwareOwners: [EXTERNAL_CAP],
  },
]

export const CAPABILITIES = [
  {
    id: FED_CAP,
    parentRegisterId: 'UE-CONV-K-006',
    relatedRegisterIds: ['UE-CONV-K-007', 'UE-CONV-K-005'],
    obligationKey: 'federation-and-local-hierarchy',
    primaryGate: FED_GATE,
    dependencyGates: [1, 13],
    actor: 'Officer of a federation reading the federation record, its affiliates, remittances and meetings and a grievance benchmark; steward and member reading the bargaining unit records served under the locals paths',
    businessOutcome: 'A federation sees of an affiliate only what the institution has decided an affiliate discloses, through a parent and child link that is established, verified and revoked by a named office; affiliate lists, dashboards, remittances and grievance benchmarks are computed from the affiliates and never from the caller organization alone, with small groups suppressed; the federation and local registers are maintained through audited routes that name the office permitted to change them; a local union is a record of its own, distinct from a bargaining unit.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/federations',
    service: `${APP}app/api/federations/route.ts`,
    sourceFiles: [`${APP}app/api/federations/route.ts`, `${APP}app/api/federations/[id]/route.ts`, `${APP}app/api/federations/benchmark/grievances/route.ts`, `${APP}app/api/locals/route.ts`, `${APP}db/schema/domains/federation/federation-schema.ts`],
    proof: [{ type: 'path', ref: `${APP}app/api/federations/route.ts` }],
    auditEvidence: 'The federation and benchmark routes refuse every write before any row or audit record exists. The locals routes write bargaining_units through the generic factory, which commits persistAtomicAudit with the row and lists the field names written. Reads are not audited.',
    privacyClassification: 'Organization contact details, per-capita rate and aggregate counters of a federation, and bargaining unit certification, steward and bargaining chair references with free-text notes; the benchmark path would address grievance rows that carry grievant names and emails.',
    gap: 'No existing capability owns federation or local structure. UE-OMIT-PLATFORM-CROSS-TENANT-ENUMERATION concerns platform enumeration of tenants, UE-OMIT-ROUTE-EXPOSURE-HARDENING concerns route exposure in general, UE-OMIT-EMPLOYER-RELATIONS-RECORDS concerns employer records and UE-OMIT-COLLECTIVE-AGREEMENT-REGISTER concerns agreements, and none owns the parent and child relationship between a federation, its affiliates and their locals, or what flows up it. The source has a federations table and a federation_remittances table, but the affiliates, dashboard, meetings and remittances paths are copies of the federation item route that return the one federation row of the session organization, the grievance benchmark path is a copy of the grievance collection route that the governance table refuses, and the locals paths serve bargaining_units rather than local unions.',
  },
]

const D = (id, ownerCapabilityId, gate, severity, title, extra = {}) => ({ id, ownerCapabilityId, gate, severity, title, ...extra })

const UPLOAD_ROUTE = 'apps/union-eyes/app/api/external/grievances/[id]/documents/upload/route.ts'
const BLOB_REF = 'apps/union-eyes/lib/services/document-blob-integrity-service.ts'

export const DEFECTS = [
  D('DEF-0B8-FED-FEDERATION-SUBRESOURCE-PATHS-ARE-FEDERATION-ITEM-COPIES', FED_CAP, FED_GATE, 'MEDIUM',
    'The /api/federations/[id]/affiliates, /dashboard, /meetings and /remittances routes are four copies of the federation item route (crudRoutes over the federations table, read at member floor and written at steward floor): each one resolves the path id as the id of a federations row of the session organization and returns that same row under all four names, so no affiliate list, dashboard aggregate, meeting record or remittance is read, no child or parent organization is derived or checked, and the federation_remittances table that holds the remittances is not touched by any of them; a federation officer calling the remittances or dashboard path receives the federation profile row (contact fields, per-capita rate, settings, bylaws links) with status 200 and no figure the path name promises.'),
  D('DEF-0B8-FED-FEDERATION-WRITES-REFUSED-NO-ROUTE-MAINTAINS-THE-REGISTER', FED_CAP, FED_GATE, 'LOW',
    'The federation collection and item routes configure a steward write floor and an administrator delete floor, but the CRUD governance table lists federations as READ_ONLY, so every POST, PATCH and DELETE answers 403 before any row or audit record is written and no dedicated route in this tranche creates, edits or retires a federation: the register cannot be maintained through the HTTP surface and the configured write roles are never reached.'),
  D('DEF-0B8-FED-BENCHMARK-ROUTE-IS-GENERIC-GRIEVANCE-CRUD-NOT-A-BENCHMARK', FED_CAP, FED_GATE, 'MEDIUM',
    'The /api/federations/benchmark/grievances route is the generic crudRoutes collection over the grievances table with orgScoped true, not a benchmark: it computes no count, rate or aggregate, derives no federation or affiliate scope and applies no minimum group size, and the only thing that stops it returning identifiable grievance rows (grievant name and email, title, description) is the OWN_ROWS_READ entry for grievances in the governance table, which today refuses every caller with 403 because the grievances table has no userId or memberId owner column and its POST is refused by the same table; the route answers no benchmark to any caller and carries no protection of its own against listing grievance rows if that table entry changes.'),
  D('DEF-0B8-FED-LOCALS-PATHS-SERVE-BARGAINING-UNITS-NOT-LOCAL-UNIONS', FED_CAP, FED_GATE, 'MEDIUM',
    'The /api/locals and /api/locals/[id] routes are crudRoutes over bargaining_units, an employer-linked certification record (employer, worksite, unit type, certification number and body, contract dates, member count, chief steward, bargaining chair) with no parent organization, federation or local-union identity column, so a caller who expects the locals of a federation receives the bargaining units of the session organization with status 200 and no local union record, no affiliation to a federation and no hierarchy between the two.'),
  D('DEF-0B8-FED-LOCALS-READABLE-AT-MEMBER-FLOOR-WITH-NOTES-AND-OFFICER-IDS', FED_CAP, FED_GATE, 'MEDIUM',
    'The locals reads are open to any member of the organization: bargaining_units has no owner, personal or contact column, so the low-role guard stays open and a member receives every unit of the organization with the internal notes text, the custom fields JSON, the certification and contract dates, the member count and the user ids of the chief steward and the bargaining chair, none of which the member role is shown to need.'),
  D('DEF-0B8-FED-LOCALS-WRITES-ANY-STEWARD-ANY-FIELD-REFERENCES-NOT-ORG-CHECKED', FED_CAP, FED_GATE, 'MEDIUM',
    'The locals create and update take the whole request body into the bargaining_units row (the factory strips only the primary key and the organization id on update): a steward can set status, employerId, worksiteId, chiefStewardId, bargainingChairId, currentCollectiveAgreementId, the certification fields, memberCount and updatedBy, and the route applies no organization check to the rows those ids point at, so the only validation of employerId, worksiteId and the officer ids is the existence constraint of the foreign key, not that the referenced employer, worksite or profile belongs to the session organization.'),
  D('DEF-0B8-FED-LOCALS-DELETE-ARCHIVES-STATUS-WITHOUT-ARCHIVED-AT', FED_CAP, FED_GATE, 'LOW',
    'The administrator delete of a locals record sets status to archived and updatedAt and leaves the archivedAt column of bargaining_units empty, and the in-transaction audit record lists only the field status, so an archived unit has no archive timestamp and no stored copy of its name, certification or officers before the change.'),
  D('DEF-0B8-FED-EXTERNAL-UPLOAD-ATTACHES-ANY-ORGANIZATION-BLOB-TO-GRIEVANCE', EXTERNAL_CAP, EXTERNAL_GATE, 'HIGH',
    'The external grievance upload accepts a blobPath (or a fileUrl inside the application storage account) from the representative and checks only that it starts with documents/<organization id>/ and is not under the intake prefix, then creates a document, a version, a grievance link and an external document grant that copies canView and canDownload from the matter grant: the file is never shown to belong to the representative, to the grievance or to a document the representative may see, so a representative whose matter grant allows uploads and downloads can attach the stored file of any other document of the organization (a member document, another grievance, a privileged file) to their grievance under a new document id and then obtain it through the external download route; the route has no caller in the application and no route lets an outside party place a new file in storage, so attaching existing storage is the only thing the endpoint can do.',
    {
      releaseDisposition: {
        disposition: 'CONDITIONALLY_BLOCKING',
        actualExposure: 'An external representative who holds an active representation authority and a matter grant with canUploadDocuments for a grievance, and who names a storage path under documents/<organization id>/ that is not an intake object, gets a new document, version, link and a document grant with the matter grant download right; the route then lets them read that stored file, whatever document it belongs to in the same organization.',
        potentialImpact: {
          classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
          description: 'A document that belongs to another member, another case or a privileged file of the organization becomes readable by an outside party who was never granted it, and the grant, link and audit row make it look like a deposit by that party, so the disclosure is recorded as an upload.',
        },
        activationState: 'REACHABLE_ROLE_RESTRICTED',
        activationEvidence: [
          { ref: UPLOAD_ROUTE, quote: "requiredPermission: 'upload_documents'," },
          { ref: UPLOAD_ROUTE, quote: 'const resolvedBlob = await resolveStoredBlob({' },
          { ref: UPLOAD_ROUTE, quote: 'canDownload: derived.grant.canDownload,' },
        ],
        existingContainment: {
          summary: 'The caller must hold an active representation authority and a matter grant that carries the upload permission, the grant must not be self-issued, the path must sit under the organization own document prefix and not under the intake prefix, and privilege labels cannot be applied; these limit who can reach the route and keep the file inside the tenant but do not tie the path to anything the representative may see.',
          evidence: [
            { ref: BLOB_REF, quote: 'return blobPath.startsWith(`documents/${organizationId}/`);' },
            { ref: BLOB_REF, quote: 'if (blobPath.startsWith(`documents/${organizationId}/intake/`)) {' },
            { ref: 'apps/union-eyes/lib/services/external-upload-authority.ts', quote: "if (!grant.canUploadDocuments) return { ok: false, reason: 'upload_not_granted' }" },
          ],
        },
        blockingCondition: 'An organization issues an external matter grant with canUploadDocuments (and canDownloadDocuments) to an outside representative, which makes the upload route usable by that person against every stored file under the organization document prefix.',
        justification: 'The route is gated by explicit grants, the file stays inside the organization, and nothing in the application calls it, so no one is exposed until a grant with upload and download rights is issued; once such a grant exists the absence of any link between the supplied path and the representative or the matter lets that holder take any stored file of the tenant, which is an over-disclosure that the audit trail records as an upload, so release is blocked when the grant is issued.',
      },
    }),
  D('DEF-0B8-FED-EXTERNAL-UPLOAD-CLIENT-CLAIMED-TYPE-SIZE-NO-SCAN-WHOLE-BLOB-READ', EXTERNAL_CAP, EXTERNAL_GATE, 'MEDIUM',
    'The external grievance upload stores the representative-supplied mimeType, documentType, filename and fileSize on the document row without comparing them to the stored object (no allow-list of types, no size ceiling, no check that the claimed size or type matches the blob), applies no malware scan on this path (the scan sits in putBlob, which resolveStoredBlob never calls) and reads the whole blob into memory with downloadToBuffer to compute its hash, so a stored object of any size or type is attached as the type and size the caller wrote and an oversized object is pulled into the request process.'),
  D('DEF-0B8-FED-EXTERNAL-DECISION-AUDIT-SEPARATE-AND-BEST-EFFORT-IN-LEGACY-MODE', EXTERNAL_CAP, EXTERNAL_GATE, 'MEDIUM',
    'Each external route records the access decision (external_authorization.allowed or denied) through auditLog, a call separate from the read or write that follows, and the read itself (the grievance projection, the document list or the document metadata) is not recorded; outside canonical V2 auditLog catches a failed database insert, logs it and returns, so the grievance data is still released to the outside party when the audit row could not be written, and the document metadata route writes two decision rows for one request.'),
  D('DEF-0B8-FED-EXTERNAL-ORGANIZATION-FROM-QUERY-OPENS-TENANT-CONTEXT-AND-AUDIT-BEFORE-GRANT', EXTERNAL_CAP, EXTERNAL_GATE, 'MEDIUM',
    'The external routes take the organization from the organizationId query parameter and open the row-level-security context for that organization (withRLSContext) before any authority or grant is checked, and on a refusal the decision audit is written into the audit trail of the organization the caller named: outside canonical V2, whose binder requires an active membership in that organization, any signed-in user can name any organization id and have a denied-authorization row written into that organization audit log, and the tenant transaction is opened for an organization the caller has no relationship with.'),
  D('DEF-0B8-FED-EXTERNAL-GRIEVANCE-PROJECTION-READS-COLUMNS-THE-TABLE-LACKS', EXTERNAL_CAP, EXTERNAL_GATE, 'LOW',
    'The projection returned to the external representative reads caseNumber, subject and summary from the grievance row, but the grievances table has none of those columns (it has grievanceNumber and description), so caseNumber and summary are always null in the response and the representative receives no case number and no summary of the grievance, only the id, title, status, step and the filing and response dates.'),
  D('DEF-0B8-FED-FLAGS-ANY-SIGNED-IN-USER-CAN-PROBE-ANY-FLAG-NAME', FLAG_CAP, FLAG_GATE, 'LOW',
    'The feature flag route with ?flag=<name> evaluates any flag name the caller supplies against the global feature_flags table and returns its enabled value, with no role floor and no restriction to the published LRO and AI names, so any signed-in user can enumerate operator-controlled flags (including kill switches and flags targeted to their own organization or user) by guessing names; the response also echoes the caller user id and organization id.'),
  D('DEF-0B8-FED-FLAGS-TYPE-VOCABULARY-ORGANIZATION-NOT-EVALUATED', FLAG_CAP, FLAG_GATE, 'LOW',
    'The feature_flags schema documents the flag types as boolean, percentage, organization and user, but the evaluator switch handles boolean, percentage, tenant and user and answers disabled with reason Unknown flag type for anything else, so an organization-targeted flag stored with the documented type organization is never enabled for any caller and the route returns false for it without an error.'),
]

const REFUSAL_NOTE = 'A role title is not a kernel decision.'

const federationFuture = 'Decide with the institution what a federation may see of its affiliates and through which verified parent and child link, replace the federation sub-resource copies with routes that read the affiliates, remittances and meetings they name under that decision with the federation scope derived on the server and small groups suppressed, and keep the federation register writable only through a dedicated, audited route that names the office permitted to change it.'

function federationProfile(kind) {
  const facade = kind === 'facade'
  return {
    persona: facade
      ? 'Federation steward or officer calling an affiliates, dashboard, meetings or remittances path and receiving the federation profile row'
      : 'Steward or officer of a federation organization reading the federation row of the organization; below steward the read is refused',
    owner: 'federations row of the session organization: organization_id is unique, so each organization has at most one federation row; the row holds contact fields, the per-capita rate, aggregate counters, settings and metadata JSON and the creating user.',
    sens: 'Federation name, contact email, phone and address, per-capita rate, CLC affiliation code, member union and represented worker counters, settings and metadata JSON, and links to the constitution and bylaws',
    priv: (method) => (method === 'GET'
      ? 'A steward or above receives the whole federations row of the session organization, including the contact fields and the per-capita rate; a member is refused with 403 by the low-role guard because the table has email, phone and address columns. No other organization row is returned.'
      : 'Nothing is stored: the write is refused with 403 before any row or audit record is written.'),
    does: (method, _model, floor) => (method === 'GET'
      ? `Returns the federations row${facade ? ` that the path id names inside the session organization, whatever the path segment (affiliates, dashboard, meetings, remittances) says; no affiliate, meeting, remittance or aggregate is read` : ' (a page of at most one row on the collection, the row of the path id on the item route)'} at a declared role floor of ${floor}; the low-role guard raises the effective floor to steward.`
      : `Answers 403 to every caller at the ${floor} role floor: assertCrudWrite refuses the READ_ONLY federations table before any insert, update or delete${facade ? '; the path segment changes nothing' : ''}.`),
    tenant: 'orgScoped: true and federations has an organization column: every read carries eq(organizationId, session organization). The federation scope is the session organization only; no parent, child or affiliate organization is derived, listed or verified, so a federation cannot reach an affiliate row and an affiliate cannot reach a federation row through this route.',
    future: federationFuture,
    gate: FED_GATE,
    deps: [1, 13],
    decisions: [D_FEDERATION],
    status: () => (facade ? 'FACADE_OVER_GENERIC_TABLE' : 'PARTIAL'),
    def: (method) => [
      ...(facade ? ['DEF-0B8-FED-FEDERATION-SUBRESOURCE-PATHS-ARE-FEDERATION-ITEM-COPIES'] : []),
      ...(method !== 'GET' ? ['DEF-0B8-FED-FEDERATION-WRITES-REFUSED-NO-ROUTE-MAINTAINS-THE-REGISTER'] : []),
    ],
    extraEv: (a) => [
      a.tbl('tenantScope', 'federations', /uniqueFederationOrgId: unique\('federations_organization_id_key'\)/),
      ...(a.method === 'GET'
        ? [
          a.tbl('privacy', 'federations', /email: varchar\('email'/),
          a.sch('privacy', LOW_ROLE, "return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }"),
          a.sch('privacy', LOW_ROLE, 'if (!(await isBelowStaff(userId, organizationId))) return {}'),
        ]
        : [a.sch('defect', CRUD_GOVERNANCE, "'external_invoices', 'polls', 'federations', 'data_classification_policy',")]),
      ...(facade ? [a.tbl('defect', 'federations', /perCapitaRate: numeric\('per_capita_rate'/)] : []),
    ],
    reqRead: 'Audit reads of the federation row once the offices that may read it are named; it carries the per-capita rate and the federation contact fields.',
    inferences: () => (facade
      ? [
        { claim: 'defect', statement: 'The route file only configures crudRoutes over the federations table with itemRoute true and the default id parameter, and imports no federation_remittances, affiliate, meeting or dashboard source, so the path segment after the id selects nothing and the same federation row is returned from every one of the four paths.' },
        { claim: 'defect', statement: 'The only organization the factory filters on is the session organization, so no query in the route can return a child, parent or affiliate organization row of the federation.' },
      ]
      : [
        { claim: 'defect', statement: 'The federation routes configure crudRoutes over federations and nothing else: the only organization the factory filters on is the session organization, so no parent or child relationship is derived or verified.' },
      ]),
  }
}

const localsFuture = 'Decide whether a local union is an organization of its own or a bargaining unit, serve each from a route that names it, restrict reads of unit notes and officer references to the offices that need them, allow only the fields the steward may set and validate that every referenced employer, worksite and officer belongs to the organization, and record the archive time and the prior values in the audit record.'

const localsProfile = {
  persona: 'Steward keeping, and member reading, the bargaining unit records of the organization through the locals paths',
  owner: 'bargaining_units rows of the organization: each unit is linked to an employer and optionally a worksite, with certification details, contract dates, member count, chief steward and bargaining chair references, notes and custom fields.',
  sens: 'Unit name and number, employer link, certification number, body and dates, contract expiry and next bargaining date, member count, classifications, chief steward and bargaining chair user ids, internal notes and custom fields',
  priv: (method) => ({
    GET: 'Any member of the organization receives the bargaining units of the organization with notes, custom fields, certification and contract dates and the chief steward and bargaining chair user ids.',
    POST: 'The response returns the stored unit row; the audit record lists the field names written and no values.',
    PATCH: 'The response returns the updated unit row; the audit record lists the field names written and no values.',
    DELETE: 'The archived unit row is returned; the audit record lists only the status field.',
  })[method],
  does: (method, _model, floor) => ({
    GET: `Returns a page of bargaining_units rows of the organization (or the row of the path id on the item route) at a role floor of ${floor}. No local union, parent organization or federation record is read.`,
    POST: `Inserts a bargaining_units row from the request body at a role floor of ${floor}; the factory sets organizationId and createdBy and keeps every other body field.`,
    PATCH: `Updates a bargaining_units row of the organization with any body field except id and organizationId at a role floor of ${floor}; no owner condition applies and no referenced row is checked against the organization.`,
    DELETE: `Soft-deletes the unit of the organization (status archived, updatedAt set, archivedAt left empty) at the fixed administrator floor (${floor}).`,
  })[method],
  future: localsFuture,
  gate: FED_GATE,
  deps: [1, 13],
  decisions: [D_FEDERATION],
  status: () => 'FACADE_OVER_GENERIC_TABLE',
  def: (method) => [
    'DEF-0B8-FED-LOCALS-PATHS-SERVE-BARGAINING-UNITS-NOT-LOCAL-UNIONS',
    ...(method === 'GET' ? ['DEF-0B8-FED-LOCALS-READABLE-AT-MEMBER-FLOOR-WITH-NOTES-AND-OFFICER-IDS'] : []),
    ...(method === 'POST' || method === 'PATCH' ? ['DEF-0B8-FED-LOCALS-WRITES-ANY-STEWARD-ANY-FIELD-REFERENCES-NOT-ORG-CHECKED'] : []),
    ...(method === 'DELETE' ? ['DEF-0B8-FED-LOCALS-DELETE-ARCHIVES-STATUS-WITHOUT-ARCHIVED-AT'] : []),
  ],
  extraEv: (a) => [
    a.tbl('defect', 'bargainingUnits', /unitType: unitTypeEnum\('unit_type'\)\.notNull\(\)/),
    a.tbl('defect', 'bargainingUnits', /employerId: uuid\('employer_id'\)/),
    a.tbl('defect', 'bargainingUnits', /\.references\(\(\) => employers\.id/),
    a.tbl('defect', 'bargainingUnits', /pgTable\(/, { absentColumns: ['parentOrganizationId', 'federationId', 'parentId'] }),
    ...(a.method === 'GET'
      ? [
        a.tbl('defect', 'bargainingUnits', /notes: text\('notes'\)/),
        a.tbl('defect', 'bargainingUnits', /chiefStewardId: text\('chief_steward_id'\)/),
        a.sch('privacy', LOW_ROLE, "return PERSONAL_COLUMNS.some((name) => col(table, name)) ? { kind: 'deny' } : { kind: 'open' }"),
      ]
      : []),
    ...(a.method === 'POST' || a.method === 'PATCH'
      ? [
        a.tbl('defect', 'bargainingUnits', /chiefStewardId: text\('chief_steward_id'\)/),
        a.tbl('defect', 'bargainingUnits', /status: unitStatusEnum\('status'\)/),
      ]
      : []),
    ...(a.method === 'DELETE' ? [a.tbl('defect', 'bargainingUnits', /archivedAt: timestamp\('archived_at'/)] : []),
  ],
  reqRead: 'Audit reads of bargaining unit records once the offices that may read them are named; they carry internal notes and the references to the chief steward and bargaining chair.',
  inferences: () => [
    { claim: 'defect', statement: 'The route file only configures crudRoutes over bargainingUnits and imports no organization, federation or local-union source; the bargaining_units table has no parent organization, federation or local identity column, so the locals path name selects no local union record.' },
  ],
}

function benchmarkFacts(a, readText) {
  const model = crudModel(a, readText)
  const isRead = a.method === 'GET'
  const floor = isRead ? model.readRole : model.writeRole
  const evidence = [
    a.h('authorization', isRead ? `readRole: '${model.readRole}'` : `writeRole: '${model.writeRole}'`),
    ...guardEv(a, 'crud'),
    a.h('tenantScope', 'orgScoped: true,'),
    a.tbl('tenantScope', model.tableName, /organizationId:/),
    a.sch('scope', CRUD_GOVERNANCE, "'grievances'"),
    a.sch('defect', CRUD_GOVERNANCE, "const OWN_ROWS_READ = ['grievances', 'claims', 'claim_deadlines'] as const"),
    a.tbl('defect', 'grievances', /pgTable\(/, { absentColumns: ['userId', 'memberId'] }),
    a.tbl('defect', 'grievances', /grievantEmail: varchar\("grievant_email"/),
    a.tbl('defect', 'grievances', /grievantName: varchar\("grievant_name"/),
  ]
  let mut = 'NOT_MUTATING'
  let auditDetail
  let reqAudit
  const corr = []
  if (isRead) {
    evidence.push(
      a.imp('mutation', 'crudRoutes', 'assertCrudRead(governance);'),
      a.imp('behavior', 'crudRoutes', "if (governance.class === 'OWN_ROWS_READ') return ownRowsScope(ownRowsMode, userId);"),
      a.sch('behavior', LOW_ROLE, "if (mode.kind !== 'own' || !userId) throw ApiError.forbidden()"),
    )
    auditDetail = 'grievances is OWN_ROWS_READ in the CRUD governance table and has no userId or memberId owner column, so readScope calls ownRowsScope, which throws 403 for every caller before any query; nothing is read, written or audited.'
    reqAudit = 'No audit record is needed for a refused read; a dedicated benchmark route that returns aggregates must decide who may read them and audit the reads.'
  } else {
    mut = 'WRITE_REFUSED_BY_GOVERNANCE'
    evidence.push(
      a.imp('mutation', 'crudRoutes', 'assertCrudWrite(governance);'),
      a.sch('audit', CRUD_GOVERNANCE, 'export function assertCrudWrite'),
    )
    auditDetail = 'grievances is OWN_ROWS_READ in the CRUD governance table, so assertCrudWrite refuses the write with 403 before any row or audit record is written; nothing is mutated and nothing is audited.'
    reqAudit = 'No audit record is required for a refused write; a benchmark is a read and needs no write route.'
    corr.push({ field: 'audit', manifest: 'audit CRUD_ATOMIC', actual: 'grievances is OWN_ROWS_READ, so the write is refused before any row or audit record is written.' })
  }
  return mk({
    persona: 'Federation officer or steward calling the benchmark path; the generic factory refuses every caller',
    service: `${CRUD_FACTORY} (crudRoutes over grievances)`,
    authn: 'Authenticated session resolved by the generic CRUD factory (crudRoutes over withApi).',
    authz: `Generic CRUD role floor: ${a.method} requires ${floor}; grievances is OWN_ROWS_READ, so the factory then refuses the ${isRead ? 'read' : 'write'} for every caller. ${REFUSAL_NOTE}`,
    tenant: 'orgScoped: true and grievances has an organization column: the factory would scope the query to the session organization, so even if the governance entry changed the route reaches the grievances of one organization only. It derives no federation scope and reads no affiliate organization.',
    owner: 'grievances rows of the session organization; each row carries the grievant name and email, the title, description, background and desired outcome of a member case.',
    sens: 'Grievance identity (grievant name and email), narrative (description, background, desired outcome), dates, step and status of member cases',
    priv: isRead
      ? 'Nothing is returned: the governance class refuses the read with 403 before the query. The route computes no aggregate and no suppression, so no benchmark and no statistic is produced for anyone.'
      : 'Nothing is stored: the write is refused with 403 before any row or audit record is written.',
    mut,
    auditDetail,
    reqAudit,
    does: isRead
      ? `Answers 403 to every caller at the ${floor} role floor: readScope calls ownRowsScope, which refuses because grievances has no owner column. The path name federations/benchmark suggests an aggregate across affiliates; no aggregate, grouping or federation scope exists.`
      : `Answers 403 to every caller at the ${floor} role floor: assertCrudWrite refuses the OWN_ROWS_READ grievances table before the insert.`,
    status: 'LATENT_NOT_OPERATIONAL',
    gate: FED_GATE,
    deps: [1, 13],
    future: 'Decide with the institution what a grievance benchmark across affiliates is, who may read it and what group size is suppressed, and serve it from a dedicated route that computes aggregates from the affiliates under a verified federation scope and returns no grievance row, grievant name or email; retire this copy of the grievance collection route.',
    dec: [D_FEDERATION],
    ev: evidence,
    inf: [{ claim: 'defect', statement: 'The route file only configures crudRoutes over grievances and imports no aggregation, grouping, federation or affiliate source; whether it ever returns rows depends only on the governance entry for grievances.' }],
    def: ['DEF-0B8-FED-BENCHMARK-ROUTE-IS-GENERIC-GRIEVANCE-CRUD-NOT-A-BENCHMARK'],
    corr,
    crudTable: model.sql,
    crudClass: model.governance,
  })
}

const externalFuture = 'Open the tenant context only after the actor is shown to hold an authority and a grant (derive the organization from the grant, not from the query), write the decision record in the transaction of the read it permits and fail the request when it cannot be stored, record the read of the case data and not only the decision, and tie every deposited file to a scanned intake the representative created rather than to a storage path the representative names.'

function externalEvidence(a, resolver, permission) {
  return [
    a.imp('authentication', 'withExternalMatterResourceAuth', 'const user = await requireUser();'),
    a.imp('authorization', 'withExternalMatterResourceAuth', 'const decision = await authorizeExternalMatterAccess({'),
    a.h('authorization', `requiredPermission: '${permission}',`),
    a.svc('authorization', EXTERNAL_AUTH_SERVICE, 'eq(representationAuthorities.representativeUserId, input.actor.userId),', 'authorizeExternalMatterAccess'),
    a.svc('authorization', EXTERNAL_AUTH_SERVICE, 'eq(externalMatterAccessGrants.userId, input.actor.userId),', 'authorizeExternalMatterAccess'),
    a.imp('tenantScope', resolver, "organizationId: getRequiredSearchParam(request, 'organizationId'),"),
    a.imp('tenantScope', 'withExternalMatterResourceAuth', 'return await withRLSContext({ organizationId: resource.organizationId }, async () => {'),
    a.svc('audit', EXTERNAL_AUTH_SERVICE, 'return auditLog({', 'auditExternalAuthorizationDecision'),
    a.svc('audit', EXTERNAL_AUTH_SERVICE, 'await auditExternalAuthorizationDecision({', 'authorizeExternalMatterAccess'),
    a.svc('mutation', AUDIT_LOGGER, 'return db.insert(auditLogs).values({', 'auditLog'),
    a.svc('defect', AUDIT_LOGGER, "logger.error('Failed to store audit log in database', dbError as Error, {", 'auditLog'),
    a.svc('defect', AUDIT_LOGGER, 'await withRLSContext({ organizationId }, async () => {', 'auditLog'),
    a.svc('defect', `${APP}lib/db/with-rls-context.ts`, 'orgId = explicitOrgId', 'withRLSContext'),
  ]
}

const EXTERNAL_COMMON_INF = [
  { claim: 'defect', statement: 'withExternalMatterResourceAuth reads the organization from resolve(request, params), which takes it from the query string, and calls withRLSContext with it before authorizeExternalMatterAccess; the organization of the decision audit row is the same query value, and the legacy branch of withRLSContext applies that explicit organization id to the transaction with no membership check, while the canonical V2 binder that requires an active membership is a runtime mode the route file does not state.' },
  { claim: 'defect', statement: 'authorizeExternalMatterAccess awaits auditExternalAuthorizationDecision after the grant rows are evaluated and before the handler runs; the audit is a separate call to auditLog, not part of the read transaction, and the handler does not write a record of what it returned.' },
]

const EXTERNAL_COMMON_DEF = [
  'DEF-0B8-FED-EXTERNAL-DECISION-AUDIT-SEPARATE-AND-BEST-EFFORT-IN-LEGACY-MODE',
  'DEF-0B8-FED-EXTERNAL-ORGANIZATION-FROM-QUERY-OPENS-TENANT-CONTEXT-AND-AUDIT-BEFORE-GRANT',
]

const EXTERNAL_BASE = {
  authn: `${SESSION} (requireUser in withExternalMatterResourceAuth; 401 when not signed in, 403 on any other failure).`,
  mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
  auditDetail: 'The GET writes an audit_logs row for the access decision (external_authorization.allowed or denied) through auditLog before the handler runs; the read itself is not recorded. Outside canonical V2 a failed insert is caught and logged and the request continues; in canonical V2 the failure throws and the request fails closed.',
  reqAudit: 'Write the decision record in the transaction of the read, fail the request when it cannot be stored, and record what case data or document metadata was released to the outside party.',
  gate: EXTERNAL_GATE,
  deps: [13],
  future: externalFuture,
  dec: [D_AUTHORITY],
  corr: [GET_WRITES('NOT_APPLICABLE:READ')],
}

function externalProjectionFacts(a) {
  return mk({
    ...EXTERNAL_BASE,
    persona: 'External representative of a grievance (outside counsel or a representing union) holding an active representation authority and a matter grant with the view permission',
    service: `${API}external/grievances/[id]/route.ts (withExternalMatterResourceAuth, toExternalMatterProjection)`,
    authz: 'withExternalMatterResourceAuth requires an active, unexpired, unrevoked representation authority for the actor, organization and matter and an active matter grant with the view permission, and the handler then selects the grievance. These are explicit grants, not a role title and not a kernel decision: authorizeAction is not called.',
    tenant: 'The organization comes from the organizationId query parameter and the matter from the path id, and both are accepted only when authority and grant rows for this actor name them; the grievance is selected by id with the organization predicate. The row-level-security context is opened for the query organization before the grants are checked.',
    owner: 'grievances row of the organization; the representation authority and the matter grant bind the outside party to this matter.',
    sens: 'Grievance title, status, step, filing date and response deadline of a member case',
    priv: 'The caller receives id, title, status, step, filed date and response deadline; the grievant identity, the narrative and the employer details are selected into memory but dropped by the projection. caseNumber and summary are always null because the projection reads columns the grievances table does not have.',
    does: 'Checks the authority and matter grant, reads the whole grievance row of the organization by id, projects it to id, caseNumber, title, status, step, filedDate, responseDeadline and summary and returns it with status 200.',
    status: 'PARTIAL',
    ev: [
      ...externalEvidence(a, 'resolveExternalGrievanceResource', 'view'),
      a.h('tenantScope', 'eq(grievances.id, context.matterId),'),
      a.h('tenantScope', 'eq(grievances.organizationId, context.organizationId),'),
      a.h('behavior', 'return NextResponse.json({ data: toExternalMatterProjection(row) });'),
      a.imp('behavior', 'toExternalMatterProjection', 'title: matter.title ?? matter.subject ?? null,'),
      a.imp('defect', 'toExternalMatterProjection', 'caseNumber: matter.caseNumber ?? null,'),
      a.imp('defect', 'toExternalMatterProjection', 'summary: matter.summary ?? null,'),
      a.sch('defect', GRIEVANCE_SCHEMA, /grievanceNumber: varchar\("grievance_number"/, { symbol: 'grievances' }),
      a.sch('defect', GRIEVANCE_SCHEMA, /description: text\("description"\)\.notNull\(\)/, { symbol: 'grievances' }),
      a.sch('defect', GRIEVANCE_SCHEMA, /pgTable\(/, { symbol: 'grievances', absentColumns: ['caseNumber', 'summary', 'subject'] }),
    ],
    inf: EXTERNAL_COMMON_INF,
    def: [...EXTERNAL_COMMON_DEF, 'DEF-0B8-FED-EXTERNAL-GRIEVANCE-PROJECTION-READS-COLUMNS-THE-TABLE-LACKS'],
  })
}

function externalListFacts(a) {
  return mk({
    ...EXTERNAL_BASE,
    persona: 'External representative of a grievance holding an active representation authority and a matter grant with the view_documents permission',
    service: `${API}external/grievances/[id]/documents/route.ts (withExternalMatterResourceAuth, externalDocumentAccessGrants join)`,
    authz: 'withExternalMatterResourceAuth requires an active representation authority and a matter grant with the view_documents permission; the handler then lists only documents named by an active, unexpired, unrevoked document grant of this authority, matter grant and actor with canView. These are explicit grants, not a role title and not a kernel decision: authorizeAction is not called.',
    tenant: 'The organization comes from the organizationId query parameter and the matter from the path id, and both are accepted only when authority and grant rows for this actor name them; the document grants, the documents and the links are all selected with the organization predicate. The row-level-security context is opened for the query organization before the grants are checked.',
    owner: 'documents rows linked to the grievance and named by external_document_access_grants rows of the actor.',
    sens: 'Title, file name, document type, MIME type, privacy label, upload and creation dates and the download right of each granted grievance document',
    priv: 'The caller receives the metadata of the documents granted to them for this grievance, including the privacy label and whether they may download; no file and no storage link is returned.',
    does: 'Checks the authority and matter grant, then selects the active, undeleted documents linked to the grievance that an active document grant of the actor names, newest first, and returns id, title, filename, type, MIME type, privacy label, canDownload and dates.',
    status: 'IMPLEMENTED_IN_SOURCE',
    ev: [
      ...externalEvidence(a, 'resolveExternalGrievanceResource', 'view_documents'),
      a.h('tenantScope', 'eq(externalDocumentAccessGrants.organizationId, context.organizationId),'),
      a.h('tenantScope', 'eq(documents.organizationId, context.organizationId),'),
      a.h('authorization', 'eq(externalDocumentAccessGrants.userId, context.actor.userId),'),
      a.h('authorization', 'eq(externalDocumentAccessGrants.canView, true),'),
      a.h('behavior', 'eq(documentLinks.linkedEntityId, context.matterId),'),
    ],
    inf: EXTERNAL_COMMON_INF,
    def: EXTERNAL_COMMON_DEF,
  })
}

function externalDocumentFacts(a) {
  return mk({
    ...EXTERNAL_BASE,
    auditDetail: 'The GET writes two audit_logs rows for one request: the matter decision in the middleware and the document decision in authorizeExternalDocumentAccess, each through auditLog and separate from the read; the metadata read itself is not recorded. Outside canonical V2 a failed insert is caught and logged and the request continues; in canonical V2 the failure throws and the request fails closed.',
    persona: 'External representative of a grievance holding an active representation authority, a matter grant with the view_documents permission and a document grant that allows viewing this document',
    service: `${API}external/documents/[id]/route.ts (withExternalMatterResourceAuth, authorizeExternalDocumentAccess)`,
    authz: 'withExternalMatterResourceAuth requires an active representation authority and a matter grant with the view_documents permission for the matter named in the query, and the handler then requires an active, unexpired, unrevoked document grant naming this document, the authority, the matter grant and the actor with canView. These are explicit grants, not a role title and not a kernel decision: authorizeAction is not called.',
    tenant: 'The organization, the matter id and the matter type come from the query string and are accepted only when authority and grant rows for this actor name them; the document is selected by path id with the organization predicate, the active status, no deletion and a link to the grievance. The row-level-security context is opened for the query organization before the grants are checked.',
    owner: 'documents row linked to the grievance and named by an external_document_access_grants row of the actor.',
    sens: 'Title, file name, document type, MIME type, privacy label and dates of one granted grievance document',
    priv: 'The caller receives the metadata of one granted document including its privacy label; no file and no storage link is returned.',
    does: 'Checks the authority, matter grant and document grant, reads the active, undeleted document linked to the grievance by path id and returns id, title, filename, document type, MIME type, privacy label and dates. Any matter type other than grievance is refused with 400.',
    status: 'IMPLEMENTED_IN_SOURCE',
    ev: [
      ...externalEvidence(a, 'resolveExternalDocumentResource', 'view_documents'),
      a.h('authorization', 'const decision = await authorizeExternalDocumentAccess({'),
      a.imp('authorization', 'authorizeExternalDocumentAccess', 'eq(externalDocumentAccessGrants.documentId, input.documentId),'),
      a.imp('authorization', 'authorizeExternalDocumentAccess', 'eq(externalDocumentAccessGrants.userId, input.actor.userId),'),
      a.h('tenantScope', 'eq(documents.organizationId, context.organizationId),'),
      a.h('tenantScope', 'eq(documentLinks.linkedEntityId, context.matterId),'),
      a.h('behavior', "if (context.matterType !== 'grievance') {"),
    ],
    inf: EXTERNAL_COMMON_INF,
    def: EXTERNAL_COMMON_DEF,
  })
}

function externalUploadFacts(a) {
  return mk({
    ...EXTERNAL_BASE,
    persona: 'External representative of a grievance holding an active representation authority and a matter grant that allows document upload, with a representative organization on the session',
    service: `${API}external/grievances/[id]/documents/upload/route.ts (withExternalMatterResourceAuth, resolveStoredBlob, deriveExternalUploadGrant)`,
    authz: 'withExternalMatterResourceAuth requires an active representation authority and a matter grant with the upload_documents permission; the handler then re-reads the matter grant inside the write, refuses a self-issued grant, and copies the document view and download rights of the matter grant to a new document grant (canShare forced false, privilege labels refused). These are explicit grants, not a role title and not a kernel decision: authorizeAction is not called.',
    tenant: 'The organization comes from the organizationId query parameter and the matter from the path id, and both are accepted only when authority and grant rows for this actor name them; the document, version, link and grant rows are written with the query organization. The storage path the caller names is checked only against the prefix documents/<organization id>/ and the intake prefix, not against the matter, the caller or any document the caller may see.',
    owner: 'A new documents row, document_versions row, document_links row to the grievance and external_document_access_grants row of the organization, pointing at a stored object under the organization document prefix.',
    sens: 'The stored file the path names (possibly member personal, medical, disciplinary or privileged content), its claimed title, type, size and privacy label',
    priv: 'The response returns the new document id and title only. The stored file named by the caller becomes a document of the grievance and the caller receives a document grant that carries the download right of the matter grant; the audit row records privacy label, authority and matter and not the path.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The document, its version, its grievance link, the copied document grant and the document.external_upload audit row (persistAtomicAudit) are written through the db handle inside withExplicitUserContext, which scopes db to one tenant transaction, so they commit or roll back together. The access decision is a separate auditLog event written before the handler runs, best-effort outside canonical V2.',
    reqAudit: 'Keep the in-transaction audit row and add the storage path, hash, claimed and actual size and type, and the decision that the file was scanned and accepted.',
    does: 'Checks the authority and matter grant, validates a JSON body (title, filename, blobPath or fileUrl, type, MIME type, privacy label, size), resolves the named storage object inside the organization prefix, downloads it fully to hash it and signs a link, then in one tenant transaction inserts the document, version 1, the grievance link and a document grant copied from the matter grant, writes the audit row and returns 201 with the id and title.',
    status: 'PARTIAL',
    ev: [
      ...externalEvidence(a, 'resolveExternalGrievanceResource', 'upload_documents'),
      a.h('authorization', "if (context.matterType !== 'grievance' || !context.actor.representativeOrganizationId) {"),
      a.h('tenantScope', 'eq(externalMatterAccessGrants.organizationId, context.organizationId),'),
      a.h('behavior', 'const resolvedBlob = await resolveStoredBlob({'),
      a.h('mutation', 'const created = await withExplicitUserContext(context.actor.userId, async () => {'),
      a.h('mutation', 'await persistAtomicAudit(db as unknown as RLSTx, {'),
      a.imp('mutation', 'persistAtomicAudit', 'await tx.insert(auditLogs).values({'),
      a.imp('mutation', 'withExplicitUserContext', 'return await db.transaction(async (tx) => {'),
      a.svc('mutation', DB_PROXY, 'const activeTenantDb = getActiveTenantDb();'),
      a.imp('behavior', 'deriveExternalUploadGrant', 'canDownload: grant.canDownloadDocuments,'),
      a.imp('behavior', 'deriveExternalUploadGrant', "if (!grantedBy || grantedBy === input.actorUserId) return { ok: false, reason: 'self_issued' }"),
      a.h('defect', 'canDownload: derived.grant.canDownload,'),
      a.h('defect', 'blobPath: resolvedBlob.blobPath,'),
      a.imp('defect', 'resolveStoredBlob', 'validateOwnedBlobPath(blobPath, input.organizationId);'),
      a.imp('defect', 'resolveStoredBlob', 'buffer = await downloadBuffer(DOCUMENT_BLOB_CONTAINER, blobPath);'),
      a.svc('defect', BLOB_SERVICE, 'return blobPath.startsWith(`documents/${organizationId}/`);', 'isBlobPathOwnedByOrganization'),
      a.svc('defect', BLOB_SERVICE, 'if (blobPath.startsWith(`documents/${organizationId}/intake/`)) {', 'validateOwnedBlobPath'),
      a.svc('defect', BLOB_SERVICE, "import { computeSha256, downloadBuffer, generateSasUrl } from '@/lib/blob-client';"),
      a.svc('defect', `${APP}lib/blob-client.ts`, "import { assertBufferSafeForUpload, type MalwareScanResult } from '@/lib/security/clamav'"),
      a.local('defect', 'externalUploadSchema', 'fileSize: z.number().int().nonnegative().optional(),'),
      a.local('defect', 'externalUploadSchema', 'mimeType: z.string().min(1).max(120),'),
      a.h('defect', 'contentType: parsed.data.mimeType,'),
      a.h('defect', 'sizeBytes: parsed.data.fileSize,'),
    ],
    inf: [
      ...EXTERNAL_COMMON_INF,
      { claim: 'defect', statement: 'resolveStoredBlob receives the blobPath or fileUrl straight from the validated body and resolves it only through validateOwnedBlobPath (organization prefix, not intake, no unsafe segment) before downloading it; nothing relates the path to the grievance, to a document the actor holds a grant for or to an object the actor created, and the new document grant copies canDownload from the matter grant.' },
      { claim: 'defect', statement: 'No route in this tranche lets an outside representative place a new file in storage and the application has no caller of the upload route, so the only objects the route can attach are objects that already exist under the organization document prefix.' },
      { claim: 'defect', statement: 'The scan helper is imported by blob-client for putBlob; document-blob-integrity-service imports only computeSha256, downloadBuffer and generateSasUrl, so the attach path runs no malware scan, and downloadBuffer reads the whole object into memory.' },
    ],
    def: [
      ...EXTERNAL_COMMON_DEF,
      'DEF-0B8-FED-EXTERNAL-UPLOAD-ATTACHES-ANY-ORGANIZATION-BLOB-TO-GRIEVANCE',
      'DEF-0B8-FED-EXTERNAL-UPLOAD-CLIENT-CLAIMED-TYPE-SIZE-NO-SCAN-WHOLE-BLOB-READ',
    ],
    dec: [D_AUTHORITY, D_EXTERNAL_DEPOSIT],
    corr: [],
  })
}

const flagFuture = 'Restrict the single-flag evaluation to the published flag names, state which flags a client may learn, answer the pilot mode flag from the same source as every other flag, align the documented and evaluated flag types, and write every change of a flag to the audit trail with the actor.'

function flagFacts(a) {
  return mk({
    persona: 'Any signed-in user, through the client feature flag provider and the pilot mode context, asking which flags are on for them and their organization',
    service: `${API}feature-flags/route.ts (withApiAuth, evaluateFeatures over the global feature_flags table)`,
    authn: `${SESSION} (withApiAuth requires a session; 401 otherwise).`,
    cat: 'SESSION_ONLY',
    authz: 'withApiAuth requires a signed-in user and nothing more: no role floor, no entitlement and no office. The decision which flags are visible to which user rests on the flag rows (boolean, percentage, tenant or user allow-lists), not on the caller authority. authorizeAction is not called.',
    tenant: 'The user id and organization id come from the verified session context (withApiAuth), never from the query; the organization id is passed to the evaluation for tenant-typed flags. The feature_flags table is global: it has no organization column, so a flag row is shared by every tenant and the table carries no tenant predicate.',
    owner: 'feature_flags rows, a platform-wide table maintained by operators; the route only reads it (and reads the process environment for the pilot mode flag).',
    sens: 'Whether named operator flags (LRO and AI feature toggles, kill switches, pilot mode) are on for the caller; the response echoes the caller user id and organization id',
    priv: 'The caller receives a boolean for each published LRO and AI flag, or for the single flag name they supplied, plus their own user id and organization id; allow-lists and percentages are never returned.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the route writes no row and no audit record; the evaluation reads feature_flags only.',
    reqAudit: 'Reads need no audit record; changes of a feature flag, made through the administrator route and upsertFeatureFlag, must be audited with the actor in the same transaction.',
    does: 'With ?flag=pilot-mode returns true when NZILA_MODE is pilot or demo, or QA_TEST_ENV is true, or NODE_ENV is test, without reading feature_flags; with any other ?flag name evaluates that name against feature_flags; with no query returns the evaluated values of every published LRO and AI flag. A failure returns 500 with a generic message.',
    status: 'PARTIAL',
    gate: FLAG_GATE,
    deps: [13],
    future: flagFuture,
    dec: [],
    ev: [
      ...guardEv(a, 'withApiAuth'),
      a.h('authorization', "const requestedFlag = request.nextUrl.searchParams.get('flag')?.trim();"),
      a.h('tenantScope', 'const orgId = context.organizationId;'),
      a.h('behavior', 'enabled = isPilotRuntime || isQaTestEnv;'),
      a.h('behavior', 'const single = await evaluateFeatures([requestedFlag], {'),
      a.h('privacy', 'userId,'),
      a.svc('mutation', FEATURE_SERVICE, 'const flag = await db.query.featureFlags.findFirst({', 'evaluateFeature'),
      a.svc('behavior', FEATURE_SERVICE, 'const flag = await db.query.featureFlags.findFirst({', 'evaluateFeature'),
      a.svc('behavior', FEATURE_SERVICE, 'case \'tenant\':', 'evaluateFeature'),
      a.svc('defect', FEATURE_SERVICE, 'reason: `Unknown flag type: ${flag.type}`,', 'evaluateFeature'),
      a.sch('defect', FEATURES_SCHEMA, "type: text(\"type\").notNull().default('boolean'), // 'boolean' | 'percentage' | 'organization' | 'user'", { symbol: 'featureFlags' }),
      a.sch('defect', FEATURES_SCHEMA, 'allowedUsers: json("allowed_users").$type<string[]>(), // For user-specific flags', { symbol: 'featureFlags' }),
    ],
    inf: [
      { claim: 'defect', statement: 'The single-flag branch passes the caller supplied string to evaluateFeatures without comparing it to the LRO_FEATURES and AI_FEATURES constants, and the route has no role check, so every signed-in user can read the enabled value of any row of feature_flags by name.' },
    ],
    def: ['DEF-0B8-FED-FLAGS-ANY-SIGNED-IN-USER-CAN-PROBE-ANY-FLAG-NAME', 'DEF-0B8-FED-FLAGS-TYPE-VOCABULARY-ORGANIZATION-NOT-EVALUATED'],
    corr: [],
  })
}

export function facts(a, readText) {
  const { route } = a
  if (route === 'federations/route.ts' || route === 'federations/[id]/route.ts') return crudRecord(a, readText, federationProfile('register'))
  if (/^federations\/\[id\]\/(affiliates|dashboard|meetings|remittances)\/route\.ts$/.test(route)) return crudRecord(a, readText, federationProfile('facade'))
  if (route === 'federations/benchmark/grievances/route.ts') return benchmarkFacts(a, readText)
  if (route.startsWith('locals/')) return crudRecord(a, readText, localsProfile)
  if (route === 'external/grievances/[id]/route.ts') return externalProjectionFacts(a)
  if (route === 'external/grievances/[id]/documents/route.ts') return externalListFacts(a)
  if (route === 'external/documents/[id]/route.ts') return externalDocumentFacts(a)
  if (route === 'external/grievances/[id]/documents/upload/route.ts') return externalUploadFacts(a)
  if (route === 'feature-flags/route.ts') return flagFacts(a)
  throw new Error(`no federation-external facts for ${a.route}`)
}
