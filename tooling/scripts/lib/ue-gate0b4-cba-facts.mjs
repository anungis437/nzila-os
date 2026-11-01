/**
 * Gate 0B.4 facts for the CBA intelligence routes. The dataset behind them (db/schema/domains/cba-intelligence) has no
 * organization column anywhere, so every route reads or writes one dataset held for all organizations. Each statement is
 * proved from the exact handler, the service function it calls, or the table definition.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { APP, NOT_ATOMIC, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const GATE = 14
const DEPS = [6, 13]
const SVC = (file) => `${APP}lib/services/cba-intelligence/${file}`
const SCH = (file) => `${APP}db/schema/domains/cba-intelligence/${file}`
const PLATFORM = 'UE-INST-PLATFORM-STAFF-MANDATE'

export const CBA_ROUTES = new Set([
  'cba-intelligence/agreements/[id]/route.ts', 'cba-intelligence/agreements/export/route.ts', 'cba-intelligence/agreements/route.ts',
  'cba-intelligence/benchmark/[id]/route.ts', 'cba-intelligence/documents/route.ts', 'cba-intelligence/extraction/route.ts',
  'cba-intelligence/freshness/route.ts', 'cba-intelligence/health/route.ts', 'cba-intelligence/ingestion/route.ts',
  'cba-intelligence/ingestion/run/route.ts', 'cba-intelligence/ingestion/seed/route.ts', 'cba-intelligence/review/route.ts',
  'cba-intelligence/sources/[id]/route.ts', 'cba-intelligence/sources/route.ts',
])

const D = (id, severity, title) => ({ id, gate: GATE, severity, title })
export const CBA_DEFECTS = [
  D('DEF-0B4-CBA-INTEL-SHARED-DATASET-NO-TENANT-PREDICATE', 'MEDIUM', 'No table of the CBA intelligence dataset has an organization column and none of the services filters by organization, so every organization reads, and every administrator or steward writes, one shared dataset; nothing in the source states which organizations may read it or who curates it.'),
  D('DEF-0B4-CBA-INTEL-UNREVIEWED-ROWS-SERVED', 'MEDIUM', 'The agreement list, item and export reads apply a review status filter only when the caller supplies one, so extracted agreements, wage adjustments and clauses that are pending, rejected or superseded are returned as the dataset.'),
  D('DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET', 'HIGH', 'Source registration and update, ingestion, seeding and extraction require only an organization administrator role floor, yet they create and change the dataset every organization reads and call external services at the platform expense, so the administrator of any one organization can curate platform-wide data; no source names the platform staff mandate.'),
  D('DEF-0B4-CBA-INTEL-TENANT-STEWARD-REVIEWS-SHARED-DATASET', 'HIGH', 'A steward of any organization can approve, reject or supersede an extracted record, which sets the review status every organization sees, and the decision records the reviewer role as the literal steward whatever the caller role is.'),
  D('DEF-0B4-CBA-INTEL-AUDIT-NOT-ATOMIC', 'MEDIUM', 'Extraction, ingestion runs and source seeding declare an atomic service audit, but they record intent and outcome through performAuditedOperation around many separate statements and an external provider call, so the audit record is not committed with the state change.'),
  D('DEF-0B4-CBA-BENCHMARK-GET-WRITES-SNAPSHOT-NO-AUDIT', 'MEDIUM', 'The benchmark GET inserts a cba_intel_benchmark_snapshots row when save=true, recording the caller user id, and the route and the service write no audit record, so a state-changing GET is both mislabelled as a read and unaudited.'),
  D('DEF-0B4-CBA-BENCHMARK-HISTORY-NOT-SCOPED', 'MEDIUM', 'The snapshot history is selected by target agreement only and returns the computedBy user id of whoever saved each snapshot, so a steward of one organization reads the user ids of stewards of other organizations.'),
  D('DEF-0B4-CBA-EXPORT-SILENTLY-TRUNCATED', 'MEDIUM', 'The export route asks the service for 10000 rows but listAgreements clamps the limit to 100, so the CSV advertised as an export of the agreements holds at most the first 100 rows and says nothing about it.'),
  D('DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS', 'MEDIUM', 'Source registration accepts any URL for the base, API, feed and terms addresses, and the ingestion adapters fetch the discovered document URLs from the server with no host allow-list or private-address check, so an administrator can make the platform request internal addresses.'),
]

const common = (a, role, extra = {}) => ({
  persona: `Organization ${role} reading the shared CBA intelligence dataset`,
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withApi.',
  authz: `withApi auth.minRole ${role} plus the commercial_reporting entitlement. A role title is not a kernel decision, and no source decides which organization may read or change the shared dataset.`,
  tenant: 'withApi resolves the session organization, but the service queries and the tables carry no organization predicate or column: every organization reads the same rows.',
  gate: GATE,
  deps: DEPS,
  status: 'IMPLEMENTED_IN_SOURCE',
  ...extra,
})

const authEv = (a, role) => [
  ...guardEv(a, 'withApi'),
  a.h('authorization', `minRole: "${role}"`),
  a.h('authorization', 'entitlement: "commercial_reporting",'),
  a.imp('authorization', 'withApi', 'await requireEntitlement(resolvedOrganizationId, options.entitlement, user.id);'),
]

const noOrg = (a, file, table) => a.sch('tenantScope', SCH(file), /pgTable\(/, { symbol: table, absentColumns: ['organizationId', 'organization_id'] })
const READ_NO_AUDIT = { mut: 'NOT_MUTATING', auditDetail: 'A read of the shared dataset: the handler and the service write no row and no audit record.' }
const SHARED = 'The shared cba_intel_* collective-agreement dataset held once for all organizations; no organization owns a row.'
const SHARED_DEFECT = 'DEF-0B4-CBA-INTEL-SHARED-DATASET-NO-TENANT-PREDICATE'
const EXTRACTION = 'extraction-service.ts'
const URL_INFERENCE = { claim: 'defect', statement: 'The route body schema, declared at module scope of this file, validates baseUrl, apiEndpoint, feedUrl and termsUrl only as URL strings, with no host allow-list.' }

const read = (a, o) => mk(common(a, o.role, {
  owner: SHARED,
  sens: o.sens,
  priv: o.priv,
  ...READ_NO_AUDIT,
  reqAudit: o.reqAudit ?? 'Reads of a dataset compiled from published sources need no audit record; audit exports once the readers are named.',
  does: o.does,
  future: o.future,
  ev: [...authEv(a, o.role), ...o.ev, noOrg(a, o.schemaFile, o.table)],
  def: [SHARED_DEFECT, ...(o.def ?? [])],
  dec: o.dec ?? [],
  corr: o.corr ?? [],
}))

const AGREEMENT_SENS = 'Employer, union and local entity names, jurisdiction, sector, effective dates, coverage and source URLs of extracted collective agreements'
const FUTURE_READ = 'Name the dataset owner and the organizations that may read it, restrict reads to reviewed rows, and resolve reads through the kernel decision.'

const listAgreementsEv = (a) => [
  a.imp('mutation', 'listAgreements', 'const items = await db'),
  a.svc('tenantScope', SVC(EXTRACTION), '.where(whereClause);', 'listAgreements'),
  a.svc('defect', SVC(EXTRACTION), 'if (filters.reviewStatus) conditions.push(eq(cbaIntelAgreements.reviewStatus, filters.reviewStatus));', 'listAgreements'),
]

const writeRole = (a, role) => ({ role, persona: `Organization ${role} of any organization operating the shared CBA intelligence dataset` })

const CBA = {
  'cba-intelligence/agreements/route.ts|GET': (a) => read(a, {
    role: 'member',
    sens: AGREEMENT_SENS,
    priv: 'Extracted agreement metadata is returned to every member of every organization whatever the review status of the row.',
    does: 'Lists a page of extracted agreements with search and filters.',
    future: FUTURE_READ,
    ev: [a.h('mutation', 'return listAgreements(filters, { page, limit });'), ...listAgreementsEv(a).slice(1)],
    schemaFile: 'extraction.ts', table: 'cbaIntelAgreements',
    def: ['DEF-0B4-CBA-INTEL-UNREVIEWED-ROWS-SERVED'],
  }),
  'cba-intelligence/agreements/[id]/route.ts|GET': (a) => read(a, {
    role: 'member',
    sens: `${AGREEMENT_SENS}, with wage adjustments and clause text`,
    priv: 'The agreement with its wage adjustments and clauses is returned by id to every member of every organization whatever the review status of the rows.',
    does: 'Returns one agreement by id with its wage adjustments and clauses.',
    future: FUTURE_READ,
    ev: [
      a.h('mutation', 'const agreement = await getAgreementById(params.id);'),
      a.svc('tenantScope', SVC(EXTRACTION), '.where(eq(cbaIntelAgreements.id, id))', 'getAgreementById'),
      a.svc('tenantScope', SVC(EXTRACTION), '.where(eq(cbaIntelClauses.agreementId, agreementId))', 'listClauses'),
    ],
    schemaFile: 'extraction.ts', table: 'cbaIntelClauses',
    def: ['DEF-0B4-CBA-INTEL-UNREVIEWED-ROWS-SERVED'],
  }),
  'cba-intelligence/agreements/export/route.ts|GET': (a) => read(a, {
    role: 'member',
    sens: AGREEMENT_SENS,
    priv: 'A CSV of agreement metadata is produced for any member of any organization, silently limited to the first 100 rows.',
    reqAudit: 'Audit each export with its filters and row count once the readers of the dataset are named.',
    does: 'Builds a CSV attachment of agreements matching the filters; the handler asks for 10000 rows and the service returns at most 100.',
    future: 'Export every matching reviewed row or state the limit, and audit the export.',
    ev: [
      a.h('mutation', 'const { items: rows } = await listAgreements(query, { page: 1, limit: 10000 });'),
      a.svc('defect', SVC(EXTRACTION), 'const limit = Math.min(pagination.limit ?? 25, 100);', 'listAgreements'),
      a.svc('tenantScope', SVC(EXTRACTION), '.where(whereClause);', 'listAgreements'),
      a.svc('defect', SVC(EXTRACTION), 'if (filters.reviewStatus) conditions.push(eq(cbaIntelAgreements.reviewStatus, filters.reviewStatus));', 'listAgreements'),
    ],
    schemaFile: 'extraction.ts', table: 'cbaIntelAgreements',
    def: ['DEF-0B4-CBA-EXPORT-SILENTLY-TRUNCATED', 'DEF-0B4-CBA-INTEL-UNREVIEWED-ROWS-SERVED'],
  }),
  'cba-intelligence/documents/route.ts|GET': (a) => read(a, {
    role: 'member',
    sens: 'Source document URLs, types, processing status and language of ingested collective-agreement documents',
    priv: 'Document metadata of the shared dataset is returned to every member of every organization.',
    does: 'Lists a page of ingested source documents with filters.',
    future: FUTURE_READ,
    ev: [a.h('mutation', 'return { data: await listDocuments(filters as DocumentFilters, { page, limit }) };')],
    schemaFile: 'documents.ts', table: 'cbaIntelDocuments',
  }),
  'cba-intelligence/freshness/route.ts|GET': (a) => read(a, {
    role: 'steward',
    sens: 'Freshness status and check times of the registered sources',
    priv: 'Source freshness of the shared dataset is returned to every steward of every organization.',
    does: 'Computes and returns the freshness overview of every active source against the supplied thresholds.',
    future: 'Restrict operational dataset status to the office that operates the dataset.',
    ev: [
      a.h('mutation', 'return { data: await getFreshnessOverview(thresholds) };'),
      a.svc('tenantScope', SVC('freshness-service.ts'), '.where(eq(cbaIntelSources.isActive, true))', 'getFreshnessOverview'),
    ],
    schemaFile: 'source-registry.ts', table: 'cbaIntelSources',
  }),
  'cba-intelligence/health/route.ts|GET': (a) => read(a, {
    role: 'steward',
    sens: 'Success rates and queue depth of ingestion, extraction and review across the shared dataset',
    priv: 'Operational health of the shared dataset is returned to every steward of every organization.',
    does: 'Returns an operational snapshot of ingestion success, extraction success, the review queue and source freshness.',
    future: 'Restrict operational dataset status to the office that operates the dataset.',
    ev: [
      a.h('mutation', 'return { data: await getCbaIntelOperationalHealth() };'),
      a.svc('tenantScope', SVC('health-service.ts'), 'listIngestionJobs({}, { page: 1, limit: 100 }),', 'getCbaIntelOperationalHealth'),
    ],
    schemaFile: 'ingestion.ts', table: 'cbaIntelIngestionJobs',
  }),
  'cba-intelligence/ingestion/route.ts|GET': (a) => read(a, {
    role: 'steward',
    sens: 'Ingestion jobs: source, trigger type, status, counts, errors and the user id that triggered each job',
    priv: 'Ingestion jobs, including the user id that triggered each, are returned to every steward of every organization.',
    does: 'Lists a page of ingestion jobs with filters.',
    future: 'Restrict operational dataset status to the office that operates the dataset.',
    ev: [
      a.h('mutation', 'return { data: await listIngestionJobs(filters as IngestionJobFilters, { page, limit }) };'),
      a.sch('privacy', SCH('ingestion.ts'), /triggeredBy: varchar\("triggered_by"/, { symbol: 'cbaIntelIngestionJobs' }),
    ],
    schemaFile: 'ingestion.ts', table: 'cbaIntelIngestionJobs',
  }),
  'cba-intelligence/review/route.ts|GET': (a) => read(a, {
    role: 'steward',
    sens: 'Pending extracted findings, agreements, wage adjustments and clauses with their confidence',
    priv: 'The review queue of the shared dataset is returned to every steward of every organization.',
    does: 'Returns the review queue with filters, or the queue counts when counts is requested.',
    future: 'Restrict the review queue to the office that curates the dataset.',
    ev: [a.h('mutation', 'return getReviewQueue(filters, { page, limit });')],
    schemaFile: 'review.ts', table: 'cbaIntelReviewDecisions',
    def: ['DEF-0B4-CBA-INTEL-TENANT-STEWARD-REVIEWS-SHARED-DATASET'],
  }),
  'cba-intelligence/sources/route.ts|GET': (a) => read(a, {
    role: 'steward',
    sens: 'Registered source addresses, terms and redistribution notes, provenance rules and adapter configuration',
    priv: 'The source registry, including adapter configuration, is returned to every steward of every organization.',
    does: 'Lists a page of registered sources with filters.',
    future: 'Restrict the source registry to the office that curates the dataset.',
    ev: [a.h('mutation', 'return { data: await listSources(filters as Record<string, unknown>, { page, limit }) };')],
    schemaFile: 'source-registry.ts', table: 'cbaIntelSources',
  }),
  'cba-intelligence/sources/[id]/route.ts|GET': (a) => read(a, {
    role: 'steward',
    sens: 'A registered source address, terms and redistribution notes, provenance rules and adapter configuration',
    priv: 'A source record, including adapter configuration, is returned by id to every steward of every organization.',
    does: 'Returns one registered source by id.',
    future: 'Restrict the source registry to the office that curates the dataset.',
    ev: [a.h('mutation', 'const source = await getSourceById(params.id);')],
    schemaFile: 'source-registry.ts', table: 'cbaIntelSources',
  }),
}

CBA['cba-intelligence/benchmark/[id]/route.ts|GET'] = (a) => mk(common(a, 'steward', {
  owner: SHARED,
  sens: 'Comparable-agreement benchmarks, and the user ids of whoever saved a snapshot',
  priv: 'A steward of any organization reads benchmark results and snapshot history, including the computedBy user id of stewards of other organizations, and may write a snapshot by adding save=true.',
  mut: 'NONE',
  auditDetail: 'With save=true the GET inserts a cba_intel_benchmark_snapshots row recording the caller; neither the route nor the service writes an audit record.',
  reqAudit: 'Make saving a snapshot an audited POST and keep the GET read-only.',
  does: 'Computes the comparable agreements of an agreement and returns the benchmark; returns the saved snapshot history when history=true; stores a snapshot when save=true.',
  future: 'Split snapshot creation into an audited write, scope snapshot history to the organization that saved it, and restrict benchmarks to the offices that hold bargaining authority.',
  ev: [
    ...authEv(a, 'steward'),
    a.h('mutation', 'const snapshot = await saveBenchmarkSnapshot(result, userId);'),
    a.h('audit', 'return { data: { ...result, snapshotId: snapshot.id } };'),
    a.svc('mutation', SVC('benchmark-service.ts'), '.insert(cbaIntelBenchmarkSnapshots)', 'saveBenchmarkSnapshot'),
    a.svc('tenantScope', SVC('benchmark-service.ts'), '.where(eq(cbaIntelBenchmarkSnapshots.targetAgreementId, agreementId))', 'getBenchmarkSnapshots'),
    a.sch('privacy', SCH('benchmarks.ts'), /computedBy: varchar\("computed_by"/, { symbol: 'cbaIntelBenchmarkSnapshots' }),
    noOrg(a, 'benchmarks.ts', 'cbaIntelBenchmarkSnapshots'),
  ],
  def: [SHARED_DEFECT, 'DEF-0B4-CBA-BENCHMARK-GET-WRITES-SNAPSHOT-NO-AUDIT', 'DEF-0B4-CBA-BENCHMARK-HISTORY-NOT-SCOPED'],
  corr: [{ field: 'mutating', manifest: 'read-only GET, audit NOT_APPLICABLE:READ', actual: 'With save=true the GET inserts a snapshot row.' }],
}))

const dataset = (a, role, o) => mk(common(a, role, {
  persona: writeRole(a, role).persona,
  owner: SHARED,
  gate: GATE,
  dec: [PLATFORM],
  ...o,
}))

const atomicAudit = (a) => [
  a.h('audit', 'await persistAtomicAudit(tx, {'),
  a.imp('audit', 'persistAtomicAudit', 'export async function persistAtomicAudit'),
]

CBA['cba-intelligence/ingestion/route.ts|POST'] = (a) => dataset(a, 'admin', {
  sens: 'An ingestion job naming a source and the user that triggered it',
  priv: 'The triggering user id is stored on a job of the shared dataset.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The job insert and persistAtomicAudit run in one withRLSContext transaction, so the job and its audit record commit together.',
  reqAudit: 'Keep the in-transaction audit record and add the authorization decision and the platform mandate that allows the run.',
  does: 'Creates an ingestion job for an active source in the shared dataset and audits it atomically.',
  future: 'Allow ingestion only to the platform staff mandate, not to an organization administrator, and keep the atomic audit.',
  ev: [
    ...authEv(a, 'admin'),
    a.h('mutation', 'const created = await createIngestionJob({'),
    ...atomicAudit(a),
    noOrg(a, 'ingestion.ts', 'cbaIntelIngestionJobs'),
  ],
  def: [SHARED_DEFECT, 'DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET'],
})

CBA['cba-intelligence/review/route.ts|POST'] = (a) => dataset(a, 'steward', {
  sens: 'A review decision on an extracted record, with the reviewer id and role',
  priv: 'The reviewer id and the decision are stored on the shared dataset.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The decision, the status it sets on its target and persistAtomicAudit run in one withRLSContext transaction.',
  reqAudit: 'Keep the in-transaction audit record and add the authorization decision that makes the reviewer a curator of the dataset.',
  does: 'Records a review decision and sets the review status of the extracted record, with the reviewer role recorded as the literal steward.',
  future: 'Allow review only to the office that curates the dataset and record the real reviewer role.',
  ev: [
    ...authEv(a, 'steward'),
    a.h('mutation', 'const decision = await submitReview({'),
    a.h('defect', 'reviewerRole: "steward", // Could be enriched from user context'),
    ...atomicAudit(a),
    a.svc('mutation', SVC('review-service.ts'), '.update(table)', 'submitReview'),
    noOrg(a, 'review.ts', 'cbaIntelReviewDecisions'),
  ],
  def: [SHARED_DEFECT, 'DEF-0B4-CBA-INTEL-TENANT-STEWARD-REVIEWS-SHARED-DATASET'],
})

CBA['cba-intelligence/sources/route.ts|POST'] = (a) => dataset(a, 'admin', {
  sens: 'A registered source: addresses, terms, provenance rules and adapter configuration',
  priv: 'Source addresses and configuration are stored for the shared dataset.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The source insert and persistAtomicAudit run in one withRLSContext transaction.',
  reqAudit: 'Keep the in-transaction audit record and add the platform mandate that allows registering a source.',
  does: 'Registers a source in the shared registry and audits it atomically; any URL is accepted for the source addresses.',
  future: 'Allow source registration only to the platform staff mandate and restrict the hosts the platform will fetch.',
  ev: [
    ...authEv(a, 'admin'),
    a.h('mutation', 'const created = await createSource(body as any as NewCbaIntelSource, tx);'),
    ...atomicAudit(a),
    noOrg(a, 'source-registry.ts', 'cbaIntelSources'),
  ],
  inf: [URL_INFERENCE],
  def: [SHARED_DEFECT, 'DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET', 'DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS'],
})

CBA['cba-intelligence/sources/[id]/route.ts|PATCH'] = (a) => dataset(a, 'admin', {
  sens: 'A registered source: addresses, terms, provenance rules and adapter configuration',
  priv: 'Source addresses and configuration of the shared dataset are changed.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The update or deactivation and persistAtomicAudit run in one withRLSContext transaction; a request that changes nothing returns the source without a write.',
  reqAudit: 'Keep the in-transaction audit record and add the platform mandate that allows changing a source.',
  does: 'Updates or deactivates a registered source and audits the change atomically; any URL is accepted for the source addresses.',
  future: 'Allow source changes only to the platform staff mandate and restrict the hosts the platform will fetch.',
  ev: [
    ...authEv(a, 'admin'),
    a.h('mutation', 'source = await updateSource(params.id, updateData as Record<string, unknown>, tx);'),
    ...atomicAudit(a),
    noOrg(a, 'source-registry.ts', 'cbaIntelSources'),
  ],
  inf: [URL_INFERENCE],
  def: [SHARED_DEFECT, 'DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET', 'DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS'],
})

const intentAudit = (a) => [
  a.h('audit', 'return await performAuditedOperation('),
  a.imp('audit', 'performAuditedOperation', 'export async function performAuditedOperation'),
]
const NOT_ATOMIC_CORR = [{ ...NOT_ATOMIC, manifest: 'AUDIT_DECLARED_ATOMIC:ATOMIC_SERVICE' }]

CBA['cba-intelligence/extraction/route.ts|POST'] = (a) => dataset(a, 'admin', {
  sens: 'Extracted agreements, wage adjustments and clauses produced by an AI provider from source documents',
  priv: 'Document text is sent to an AI provider and the result is written to the shared dataset.',
  mut: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
  auditDetail: 'performAuditedOperation records the intent before the pipeline and the outcome after; the extraction writes many rows and calls an AI provider outside any transaction with the audit record.',
  reqAudit: 'Commit the run record with its audit record, name the platform mandate that allows a run and record the provider call.',
  does: 'Runs the extraction pipeline for one document or for every raw document and writes extraction runs, findings and agreements.',
  future: 'Allow extraction only to the platform staff mandate and commit its run record with the audit record.',
  ev: [
    ...authEv(a, 'admin'),
    a.h('mutation', 'data: body?.documentId ? await extractDocument(body.documentId) : await runBulkExtraction(),'),
    ...intentAudit(a),
    noOrg(a, 'extraction.ts', 'cbaIntelExtractionRuns'),
  ],
  def: [SHARED_DEFECT, 'DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET', 'DEF-0B4-CBA-INTEL-AUDIT-NOT-ATOMIC'],
  corr: NOT_ATOMIC_CORR,
})

CBA['cba-intelligence/ingestion/run/route.ts|POST'] = (a) => dataset(a, 'admin', {
  sens: 'Documents fetched from external sources and written to the shared dataset',
  priv: 'External documents are fetched and stored; no personal data is read from the organization.',
  mut: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
  auditDetail: 'performAuditedOperation records the intent before the pipeline and the outcome after; the pipeline fetches external sources and writes many rows outside any transaction with the audit record.',
  reqAudit: 'Commit the job record with its audit record, name the platform mandate that allows a run and record each external host fetched.',
  does: 'Runs the ingestion pipeline for one source or for every active source, fetching external documents and writing jobs and documents.',
  future: 'Allow ingestion only to the platform staff mandate, restrict the hosts the platform will fetch and commit the job record with its audit record.',
  ev: [
    ...authEv(a, 'admin'),
    a.h('mutation', 'data: body?.sourceId ? await runSourceIngestion(body.sourceId) : await runFullIngestion(),'),
    ...intentAudit(a),
    a.svc('defect', SVC('adapters/base-adapter.ts'), 'const response = await fetch(url, {'),
    noOrg(a, 'ingestion.ts', 'cbaIntelIngestionJobs'),
  ],
  def: [SHARED_DEFECT, 'DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET', 'DEF-0B4-CBA-INTEL-AUDIT-NOT-ATOMIC', 'DEF-0B4-CBA-INGESTION-FETCHES-UNRESTRICTED-URLS'],
  corr: NOT_ATOMIC_CORR,
})

CBA['cba-intelligence/ingestion/seed/route.ts|POST'] = (a) => dataset(a, 'admin', {
  sens: 'The registry of external data sources',
  priv: 'No personal data is read or written.',
  mut: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
  auditDetail: 'performAuditedOperation records the intent before the seed and the outcome after; the seed inserts the registry one source at a time outside any transaction with the audit record.',
  reqAudit: 'Commit the seed with its audit record and name the platform mandate that allows seeding.',
  does: 'Inserts the built-in Canadian CBA data sources into the shared registry.',
  future: 'Run seeding as a deployment step under the platform staff mandate, not as an organization administrator action, and commit it with its audit record.',
  ev: [
    ...authEv(a, 'admin'),
    a.h('mutation', '() => seedSources(),'),
    ...intentAudit(a),
    noOrg(a, 'source-registry.ts', 'cbaIntelSources'),
  ],
  def: [SHARED_DEFECT, 'DEF-0B4-CBA-INTEL-TENANT-ADMIN-WRITES-SHARED-DATASET', 'DEF-0B4-CBA-INTEL-AUDIT-NOT-ATOMIC'],
  corr: NOT_ATOMIC_CORR,
})

export function cbaFacts(a) {
  const f = CBA[`${a.route}|${a.method}`]
  if (!f) throw new Error(`no CBA intelligence facts for ${a.route}|${a.method}`)
  return f(a)
}
