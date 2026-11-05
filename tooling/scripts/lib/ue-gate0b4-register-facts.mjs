/**
 * Gate 0B.4 facts for the collective agreement register (cbas) and the clauses of an agreement (clauses). The agreement
 * routes call an organization-scoped audited service; the clause collection and search routes are the generic CRUD
 * factory over cba_clauses; the clause item and compare routes call an organization-scoped audited service. Each
 * statement is read from the exact handler, the service function it calls, or the table definition.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { crudRecord } from './ue-gate0b4-crud.mjs'
import { APP, GET_WRITES, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const GATE = 14
const DEPS = [6, 13]
const SERVICES = `${APP}lib/services/`
const CBA_AUDITED = `${SERVICES}cba-audited-service.ts`
const CBA_SERVICE = `${SERVICES}cba-service.ts`
const CLAUSE_SERVICE = `${SERVICES}clause-service.ts`
const NOTES_SERVICE = `${SERVICES}bargaining-notes-service.ts`
const AGREEMENT_SCHEMA = `${APP}db/schema/domains/agreements/collective-agreements.ts`

export const REGISTER_ROUTES = new Set([
  'cbas/[id]/route.ts', 'cbas/route.ts', 'clauses/[id]/route.ts', 'clauses/compare/route.ts', 'clauses/route.ts', 'clauses/search/route.ts',
])

const D = (id, severity, title) => ({ id, gate: GATE, severity, title })
export const REGISTER_DEFECTS = [
  D('DEF-0B4-CBAS-DETAIL-GET-WRITES-VIEW-COUNT', 'MEDIUM', 'The agreement detail GET increments collective_agreements.view_count in a tenant transaction whenever includeAnalytics=true, at the member floor, with no audit record, so a read-only operation changes stored state and any member can inflate the counter.'),
  D('DEF-0B4-CBA-CHILD-RECORDS-READ-BY-AGREEMENT-ID-ONLY', 'HIGH', 'The agreement detail returns clauses and bargaining notes by cbaId alone: getClausesByCBAId and getBargainingNotesByCBA carry no organization predicate, and the clause create stores any cbaId, so a clause written by one organization against another organization agreement id is returned in that agreement detail.'),
  D('DEF-0B4-CLAUSES-CREATE-ACCEPTS-ANY-CBA-ID', 'HIGH', 'The clause create is the generic factory, which stores the body cbaId, a foreign key to collective_agreements.id that no organization condition guards, so a steward can attach clauses to the agreement of another organization; the organization column is forced from the session but the agreement is not checked.'),
  D('DEF-0B4-CLAUSES-ITEM-GET-WRITES-VIEW-COUNT', 'MEDIUM', 'The clause item GET passes countView true on every request that does not ask for the hierarchy, so each read updates cba_clauses.view_count at the member floor with no audit record.'),
  D('DEF-0B4-CLAUSES-SEARCH-FACADE', 'MEDIUM', 'The clause search route is the generic CRUD configuration over cba_clauses and applies no search term: GET lists clause rows and POST creates a clause, so no search is performed.'),
  D('DEF-0B4-CLAUSES-COMPARE-PLACEHOLDER-RECOMMENDATIONS', 'MEDIUM', 'The clause comparison groups clauses by type, always returns empty differences and best practices, and returns three fixed recommendation sentences whatever the clauses say; the route returns this as an analysis and, with save true, stores it as the analysis result of a named comparison.'),
  D('DEF-0B4-CBAS-LIST-LIMIT-UNBOUNDED', 'LOW', 'The agreement list passes the caller limit and page, parsed without a ceiling, to the service, which clamps neither, so a member can request an unbounded page of agreements.'),
  D('DEF-0B4-CBAS-DETAIL-EMBEDS-INTERNAL-NOTES-FOR-MEMBERS', 'MEDIUM', 'With includeNotes=true the agreement detail returns every bargaining note of the agreement whose confidentiality level is public or internal to any member at the member floor, so internal bargaining notes reach members who hold no bargaining role.'),
  D('DEF-0B4-CBAS-CBA-NUMBER-GLOBALLY-UNIQUE', 'MEDIUM', 'collective_agreements.cba_number carries a single unique constraint across every organization, and the create and update routes answer a duplicate with a conflict, so a steward of one organization learns whether any organization holds a given agreement number and cannot use a number another organization holds.'),
]

const D_VIEW = 'DEF-0B4-CBAS-DETAIL-GET-WRITES-VIEW-COUNT'
const D_CHILD = 'DEF-0B4-CBA-CHILD-RECORDS-READ-BY-AGREEMENT-ID-ONLY'
const D_CBA_ID = 'DEF-0B4-CLAUSES-CREATE-ACCEPTS-ANY-CBA-ID'
const D_CLAUSE_VIEW = 'DEF-0B4-CLAUSES-ITEM-GET-WRITES-VIEW-COUNT'
const D_SEARCH = 'DEF-0B4-CLAUSES-SEARCH-FACADE'
const D_COMPARE = 'DEF-0B4-CLAUSES-COMPARE-PLACEHOLDER-RECOMMENDATIONS'
const D_LIMIT = 'DEF-0B4-CBAS-LIST-LIMIT-UNBOUNDED'
const D_NOTES = 'DEF-0B4-CBAS-DETAIL-EMBEDS-INTERNAL-NOTES-FOR-MEMBERS'
const D_NUMBER = 'DEF-0B4-CBAS-CBA-NUMBER-GLOBALLY-UNIQUE'

const AGREEMENT = 'Collective agreement record: agreement number, title, jurisdiction, employer and union names, effective, expiry and signed dates, sector, employee coverage, bargaining unit description and document URL'
const AGREEMENT_OWNER = 'collective_agreements rows belong to the organization in organizationId, which every write stamps from the session; isPublic is forced false on create and rejected on update.'
const CLAUSE_OWNER = 'cba_clauses rows belong to the organization in organizationId and to an agreement through cbaId; the table has no author column.'
const READ_NOTE = 'A read: the handler and the service write no row and no audit record.'

const roleAuthEv = (a, role) => [...guardEv(a, 'withRoleAuth'), a.h('authorization', `withRoleAuth('${role}'`)]

const base = (a, s) => mk({
  persona: s.persona,
  service: s.service,
  authn: 'Authenticated session resolved by withRoleAuth.',
  authz: `withRoleAuth ${s.role}: the guard resolves the session organization and checks the role title; the service then looks the record up by id and organization. A role title is not a kernel decision.`,
  gate: GATE,
  deps: DEPS,
  status: 'IMPLEMENTED_IN_SOURCE',
  ...s.fields,
})

const cbasList = (a) => base(a, {
  persona: 'Organization member reading the collective agreements of the organization',
  service: `${CBA_SERVICE} (listCBAs)`,
  role: 'member',
  fields: {
    tenant: 'The route refuses a requested organizationId other than the session organization and the service filters the list by the session organization.',
    owner: AGREEMENT_OWNER,
    sens: AGREEMENT,
    priv: 'Every member of the organization reads the agreement metadata of the organization.',
    mut: 'NOT_MUTATING',
    auditDetail: READ_NOTE,
    reqAudit: 'Reads of agreement metadata need no audit record.',
    does: 'Lists a page of the agreements of the session organization with status, jurisdiction and search filters.',
    future: 'Clamp the page size and resolve who reads agreements through the kernel decision.',
    ev: [
      ...roleAuthEv(a, 'member'),
      a.h('tenantScope', 'if (requestedOrg && requestedOrg !== organizationId) {'),
      a.h('tenantScope', 'const filters: CBAFilters = { organizationId };'),
      a.h('mutation', 'const result = await withRLSContext({ organizationId }, async () => listCBAs(filters, { page, limit }));'),
      a.svc('tenantScope', CBA_SERVICE, 'conditions.push(eq(collectiveAgreements.organizationId, filters.organizationId));', 'listCBAs'),
      a.h('defect', "const limit = parseInt(url.searchParams.get('limit') || '20', 10);"),
      a.svc('defect', CBA_SERVICE, 'const offset = (page - 1) * limit;', 'listCBAs'),
      a.sch('privacy', AGREEMENT_SCHEMA, /documentUrl: text\("document_url"\)/, { symbol: 'collectiveAgreements' }),
    ],
    def: [D_LIMIT],
    corr: [],
  },
})

const cbasCreate = (a) => base(a, {
  persona: 'Steward creating a collective agreement record for the organization',
  service: `${CBA_AUDITED} (createCbaAudited)`,
  role: 'steward',
  fields: {
    tenant: 'The service stamps organizationId from the session and the insert runs in the tenant context; a body organizationId other than the session organization is refused.',
    owner: AGREEMENT_OWNER,
    sens: AGREEMENT,
    priv: 'The agreement metadata in the body is stored; a duplicate agreement number is answered with a conflict whichever organization holds it.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The agreement row and a cba.create audit record commit in one tenant transaction.',
    reqAudit: 'Keep the in-transaction audit record.',
    does: 'Validates the body, creates an agreement owned by the session organization with isPublic false, and records the audit event.',
    future: 'Scope the agreement number to the organization and decide who may register an agreement through the kernel decision.',
    ev: [
      ...roleAuthEv(a, 'steward'),
      a.h('tenantScope', 'if (requestedOrg && requestedOrg !== organizationId) {'),
      a.h('mutation', 'const cba = await createCbaAudited({ organizationId, userId }, data);'),
      a.svc('tenantScope', CBA_AUDITED, 'organizationId: scope.organizationId,', 'createCbaAudited'),
      a.svc('mutation', CBA_AUDITED, '.insert(collectiveAgreements)', 'createCbaAudited'),
      a.svc('audit', CBA_AUDITED, 'await persistAtomicAudit(tx, {', 'createCbaAudited'),
      a.h('defect', "return NextResponse.json({ error: 'CBA number already exists' }, { status: 409 });"),
      a.sch('defect', AGREEMENT_SCHEMA, 'cbaNumber: varchar("cba_number", { length: 100 }).notNull().unique(),', { symbol: 'collectiveAgreements' }),
    ],
    def: [D_NUMBER],
    corr: [],
  },
})

const cbasDetail = (a) => base(a, {
  persona: 'Organization member reading one collective agreement, optionally with its clauses and bargaining notes',
  service: `${CBA_AUDITED} (getCbaForOrganization)`,
  role: 'member',
  fields: {
    tenant: 'The agreement is selected by id and the session organization; the clauses and notes that follow are selected by the agreement id alone.',
    owner: AGREEMENT_OWNER,
    sens: `${AGREEMENT}; with the options, clause text and bargaining notes`,
    priv: 'The agreement, and on request its clauses and the public and internal bargaining notes, are returned to any member of the organization; notes of the caller own authorship are returned at every confidentiality level.',
    mut: 'NONE',
    auditDetail: 'With includeAnalytics=true the GET updates view_count in a tenant transaction; neither the route nor the service writes an audit record for it.',
    reqAudit: 'Remove the counter write from the GET, or record views through a governed analytics path.',
    does: 'Returns one agreement of the session organization; with includeClauses, includeNotes and includeAnalytics it adds the clauses, the visible bargaining notes and a view count increment.',
    future: 'Keep reads read-only, select child records by agreement id and organization, and restrict internal bargaining notes to the offices that hold bargaining authority.',
    ev: [
      ...roleAuthEv(a, 'member'),
      a.h('tenantScope', 'const cba = await getCbaForOrganization(organizationId, id, { countView: includeAnalytics });'),
      a.svc('tenantScope', CBA_AUDITED, 'const inOrganization = and(eq(collectiveAgreements.id, id), eq(collectiveAgreements.organizationId, organizationId));', 'getCbaForOrganization'),
      a.h('mutation', 'const cba = await getCbaForOrganization(organizationId, id, { countView: includeAnalytics });'),
      a.svc('mutation', CBA_AUDITED, '.update(collectiveAgreements)', 'getCbaForOrganization'),
      a.h('audit', 'return NextResponse.json(response);'),
      a.h('defect', 'const clauses = await getClausesByCBAId(id);'),
      a.svc('defect', CLAUSE_SERVICE, '.where(eq(cbaClause.cbaId, cbaId))', 'getClausesByCBAId'),
      a.svc('defect', NOTES_SERVICE, '.where(and(...conditions))', 'getBargainingNotesByCBA'),
      a.h('defect', "['public', 'internal'].includes(note.confidentialityLevel) ||"),
    ],
    def: [D_VIEW, D_CHILD, D_NOTES],
    corr: [GET_WRITES('NOT_APPLICABLE:READ')],
  },
})

const cbasUpdate = (a) => base(a, {
  persona: 'Steward updating a collective agreement record of the organization',
  service: `${CBA_AUDITED} (updateCbaAudited)`,
  role: 'steward',
  fields: {
    tenant: 'The update is bound to the agreement id and the session organization; a status change also carries the status it expects, so a concurrent change is a conflict.',
    owner: AGREEMENT_OWNER,
    sens: AGREEMENT,
    priv: 'Agreement metadata in the body replaces the stored values; a duplicate agreement number is answered with a conflict whichever organization holds it. A body isPublic is refused.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The agreement update and a cba.update audit record, with the field names and any status change, commit in one tenant transaction; a not-found or conflict outcome writes and audits nothing.',
    reqAudit: 'Keep the in-transaction audit record.',
    does: 'Validates the body, refuses isPublic, updates the agreement of the session organization and records the audit event.',
    future: 'Scope the agreement number to the organization and decide who may change status and metadata through the kernel decision.',
    ev: [
      ...roleAuthEv(a, 'steward'),
      a.h('authorization', "if (body && typeof body === 'object' && 'isPublic' in body) {"),
      a.h('mutation', 'const result = await updateCbaAudited({ organizationId, userId }, id, validation.data);'),
      a.svc('tenantScope', CBA_AUDITED, 'const inOrganization = and(eq(collectiveAgreements.id, id), eq(collectiveAgreements.organizationId, scope.organizationId));', 'updateCbaAudited'),
      a.svc('mutation', CBA_AUDITED, '.update(collectiveAgreements)', 'updateCbaAudited'),
      a.svc('audit', CBA_AUDITED, 'await persistAtomicAudit(tx, {', 'updateCbaAudited'),
      a.h('defect', 'ErrorCode.ALREADY_EXISTS,'),
      a.sch('defect', AGREEMENT_SCHEMA, 'cbaNumber: varchar("cba_number", { length: 100 }).notNull().unique(),', { symbol: 'collectiveAgreements' }),
    ],
    def: [D_NUMBER],
    corr: [],
  },
})

const cbasArchive = (a) => base(a, {
  persona: 'Steward archiving a collective agreement record of the organization',
  service: `${CBA_AUDITED} (archiveCbaAudited)`,
  role: 'steward',
  fields: {
    tenant: 'The archive is bound to the agreement id and the session organization and refuses an agreement that is already archived.',
    owner: AGREEMENT_OWNER,
    sens: AGREEMENT,
    priv: 'The agreement status becomes archived; its clauses and notes remain.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The status change and a cba.archive audit record commit in one tenant transaction.',
    reqAudit: 'Keep the in-transaction audit record.',
    does: 'Sets the agreement status to archived and records the audit event; the response says deleted true although nothing is deleted.',
    future: 'Decide who may archive an agreement through the kernel decision and describe the result as an archive.',
    ev: [
      ...roleAuthEv(a, 'steward'),
      a.h('mutation', 'const result = await archiveCbaAudited({ organizationId, userId }, id);'),
      a.svc('tenantScope', CBA_AUDITED, 'const inOrganization = and(eq(collectiveAgreements.id, id), eq(collectiveAgreements.organizationId, scope.organizationId));', 'archiveCbaAudited'),
      a.svc('mutation', CBA_AUDITED, ".set({ status: 'archived', lastModifiedBy: scope.userId, updatedAt: new Date() })", 'archiveCbaAudited'),
      a.svc('audit', CBA_AUDITED, 'await persistAtomicAudit(tx, {', 'archiveCbaAudited'),
    ],
    def: [],
    corr: [],
  },
})

const CLAUSE_SERVICE_AUDITED = `${SERVICES}clause-audited-service.ts`

const clauseItem = (a, s) => base(a, {
  persona: 'Organization member reading, and steward changing, one clause of a collective agreement',
  service: `${CLAUSE_SERVICE_AUDITED} (${s.fn})`,
  role: s.role,
  fields: {
    tenant: 'The clause is looked up by id and the session organization; a clause in another organization answers not found.',
    owner: CLAUSE_OWNER,
    sens: 'Collective-agreement clause text, interpretation notes and key terms',
    ...s.fields,
  },
})

const clausesGet = (a) => clauseItem(a, {
  fn: 'getClauseForOrganization', role: 'member',
  fields: {
    priv: 'The whole clause row is returned to any member of the organization.',
    mut: 'NONE',
    auditDetail: 'Unless the hierarchy is requested the GET updates view_count in a tenant transaction; neither the route nor the service writes an audit record for it.',
    reqAudit: 'Remove the counter write from the GET, or record views through a governed analytics path.',
    does: 'Returns one clause of the session organization, or with includeHierarchy its parent, itself and its children, and increments its view count.',
    future: 'Keep reads read-only and resolve clause visibility through the kernel decision.',
    ev: [
      ...roleAuthEv(a, 'member'),
      a.h('tenantScope', 'const hierarchy = await getClauseHierarchyForOrganization(organizationId, id);'),
      a.imp('tenantScope', 'getClauseForOrganization', 'const inOrganization = and(eq(cbaClause.id, id), eq(cbaClause.organizationId, organizationId));'),
      a.h('mutation', 'const clause = await getClauseForOrganization(organizationId, id, { countView: true });'),
      a.imp('mutation', 'getClauseForOrganization', '.update(cbaClause)'),
      a.h('audit', 'return NextResponse.json({ clause });'),
    ],
    def: [D_CLAUSE_VIEW],
    corr: [GET_WRITES('NOT_APPLICABLE:READ')],
  },
})

const clausesPatch = (a) => clauseItem(a, {
  fn: 'updateClauseAudited', role: 'steward',
  fields: {
    priv: 'The permitted clause fields in the body replace the stored values; ownership fields are not writable.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The clause update and a clause.update audit record commit in one tenant transaction.',
    reqAudit: 'Keep the in-transaction audit record.',
    does: 'Validates the body against a strict allow-list, updates the clause of the session organization and records the audit event.',
    future: 'Decide who may change clause text through the kernel decision.',
    ev: [
      ...roleAuthEv(a, 'steward'),
      a.h('mutation', 'const updatedClause = await updateClauseAudited({ organizationId, userId }, id, validation.data);'),
      a.imp('tenantScope', 'updateClauseAudited', '.where(and(eq(cbaClause.id, id), eq(cbaClause.organizationId, scope.organizationId)))'),
      a.imp('mutation', 'updateClauseAudited', '.update(cbaClause)'),
      a.imp('audit', 'updateClauseAudited', 'await persistAtomicAudit(tx, {'),
    ],
    def: [],
    corr: [],
  },
})

const clausesDelete = (a) => clauseItem(a, {
  fn: 'deleteClauseAudited', role: 'steward',
  fields: {
    priv: 'The clause row is removed permanently; only the audit record remains.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The clause delete and a clause.delete audit record commit in one tenant transaction.',
    reqAudit: 'Keep the in-transaction audit record.',
    does: 'Deletes the clause of the session organization and records the audit event.',
    future: 'Decide who may remove clause text through the kernel decision, and retain rather than delete.',
    ev: [
      ...roleAuthEv(a, 'steward'),
      a.h('mutation', 'const success = await deleteClauseAudited({ organizationId, userId }, id);'),
      a.imp('tenantScope', 'deleteClauseAudited', '.where(and(eq(cbaClause.id, id), eq(cbaClause.organizationId, scope.organizationId)))'),
      a.imp('mutation', 'deleteClauseAudited', '.delete(cbaClause)'),
      a.imp('audit', 'deleteClauseAudited', 'await persistAtomicAudit(tx, {'),
    ],
    def: [],
    corr: [],
  },
})

const clausesCompare = (a) => base(a, {
  persona: 'Organization member comparing clauses of the organization',
  service: `${CLAUSE_SERVICE_AUDITED} (compareClausesInOrganization, saveClauseComparisonAudited)`,
  role: 'member',
  fields: {
    tenant: 'Every requested clause id must belong to the session organization, otherwise the route answers not found; a body organizationId other than the session organization is refused.',
    owner: 'cba_clauses rows belong to the organization; clause_comparisons rows, written when save is true, belong to the organization and the user who saved them.',
    sens: 'Collective-agreement clause text and a saved comparison name with its analysis',
    priv: 'Clauses of the organization are returned together; with save true a named comparison is stored for the organization.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'A saved comparison and a clause.comparison.save audit record commit in one tenant transaction; a comparison that is not saved writes nothing.',
    reqAudit: 'Keep the in-transaction audit record for saved comparisons.',
    does: 'Compares two to ten clauses of the session organization by grouping them by type and returns fixed recommendation sentences; with save true it stores the result under a name.',
    future: 'Compute the comparison or label it as a stub, and decide who may save comparisons through the kernel decision.',
    ev: [
      ...roleAuthEv(a, 'member'),
      a.h('tenantScope', 'const result = await compareClausesInOrganization(contextOrganizationId, {'),
      a.imp('tenantScope', 'compareClausesInOrganization', '.where(and(inArray(cbaClause.id, ids), eq(cbaClause.organizationId, organizationId))),'),
      a.imp('mutation', 'saveClauseComparisonAudited', '.insert(clauseComparisons)'),
      a.imp('audit', 'saveClauseComparisonAudited', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'recommendations: result.recommendations'),
      a.svc('defect', CLAUSE_SERVICE, '"Consider standardizing clause language across CBAs",', 'compareClauses'),
      a.svc('defect', CLAUSE_SERVICE, 'differences: [],', 'compareClauses'),
    ],
    def: [D_COMPARE],
    corr: [],
  },
})

const FACTS = {
  'cbas/route.ts|GET': cbasList,
  'cbas/route.ts|POST': cbasCreate,
  'cbas/[id]/route.ts|GET': cbasDetail,
  'cbas/[id]/route.ts|PATCH': cbasUpdate,
  'cbas/[id]/route.ts|DELETE': cbasArchive,
  'clauses/[id]/route.ts|GET': clausesGet,
  'clauses/[id]/route.ts|PATCH': clausesPatch,
  'clauses/[id]/route.ts|DELETE': clausesDelete,
  'clauses/compare/route.ts|POST': clausesCompare,
}

const CLAUSES_TABLE_FILE = 'cbaClause'
const clauseCrudProfile = (route) => ({
  persona: 'Organization member reading, and steward writing, clauses of collective agreements through the generic CRUD factory',
  owner: CLAUSE_OWNER,
  sens: 'Collective-agreement clause text, interpretation notes, key terms, the stored embedding and the extraction confidence',
  priv: (method) => (method === 'GET'
    ? 'Every member of the organization reads the whole clause row, including content, interpretationNotes, embedding and confidenceScore.'
    : 'Any body field is stored, including cbaId, viewCount, citationCount, embedding, contentHash and confidenceScore; cbaId is not checked against the organization.'),
  does: (method, _model, floor) => (route === 'clauses/search/route.ts'
    ? (method === 'GET'
      ? `Returns cba_clauses rows of the organization at a role floor of ${floor}; the route applies no search term.`
      : `Inserts a cba_clauses row from the body at a role floor of ${floor}, whatever the route name (search) says.`)
    : (method === 'GET'
      ? `Returns cba_clauses rows of the organization at a role floor of ${floor}.`
      : `Inserts a cba_clauses row from the body at a role floor of ${floor}.`)),
  future: 'Verify that the agreement belongs to the organization before attaching a clause, validate the body, keep view and citation counters out of the writable body, and either implement search or remove the route.',
  gate: GATE,
  deps: DEPS,
  status: () => (route === 'clauses/search/route.ts' ? 'FACADE_OVER_GENERIC_TABLE' : 'PARTIAL'),
  def: (method) => [
    ...(method === 'POST' ? [D_CBA_ID] : []),
    ...(route === 'clauses/search/route.ts' ? [D_SEARCH] : []),
  ],
  extraEv: (a) => [a.tbl('defect', CLAUSES_TABLE_FILE, /cbaId: uuid\("cba_id"\)\.notNull\(\)\.references/)],
})

export function registerFacts(a, readText) {
  const fact = FACTS[`${a.route}|${a.method}`]
  if (fact) return fact(a)
  if (a.route === 'clauses/route.ts' || a.route === 'clauses/search/route.ts') return crudRecord(a, readText, clauseCrudProfile(a.route))
  throw new Error(`no register facts for ${a.route}|${a.method}`)
}
