/**
 * Gate 0B.4 facts for the shared clause library routes. The library holds one row per clause, owned by the organization
 * that shared it, and readable by other organizations according to its sharing level. Reads that cross tenants run on the
 * system role behind a hand-written predicate; owner writes run in the tenant context. Each statement is read from the exact
 * handler, the module-scope helper the handler calls, the sharing authority library or the table definition.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { APP, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { definitionRegion } from './ue-gate0b4-provenance.mjs'

const GATE = 14
const DEPS = [6, 13]
const SHARING = `${APP}lib/clause-library/sharing-authority.ts`
const SCHEMA = `${APP}db/schema/domains/agreements/shared-library.ts`
const PUBLICATION = 'UE-INST-KNOWLEDGE-PUBLICATION'

export const CLAUSE_LIBRARY_ROUTES = new Set([
  'clause-library/[id]/route.ts', 'clause-library/[id]/share/route.ts', 'clause-library/[id]/tags/route.ts',
  'clause-library/compare/route.ts', 'clause-library/route.ts', 'clause-library/search/route.ts',
])

const D = (id, severity, title) => ({ id, gate: GATE, severity, title })
export const CLAUSE_LIBRARY_DEFECTS = [
  D('DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS', 'MEDIUM', 'The list, item, tags, compare and search reads run on the system role, which bypasses row-level security, and the only boundary between organizations is a hand-written application predicate; the route comments name this PRIVILEGED_CROSS_TENANT_REVIEW and no kernel decision stands behind it.'),
  D('DEF-0B4-CLAUSE-LIBRARY-FEDERATION-PREDICATES-DISAGREE', 'MEDIUM', 'The item authority canReadSharedClause admits a federation clause only when the nearest federation ancestor of the caller equals that of the owner, while the list and search predicate admits it whenever the caller federation appears anywhere in the owner hierarchy path, so when federations nest the list and search return clauses the item, tags and compare reads refuse.'),
  D('DEF-0B4-CLAUSE-LIBRARY-ANONYMIZATION-NOT-ENFORCED-ON-READ', 'HIGH', 'The item read returns originalEmployerName and the creator user id to any reader whatever isAnonymized says, and every read returns the owning organization name, so a clause shared as anonymized discloses the employer it was anonymized from.'),
  D('DEF-0B4-CLAUSE-LIBRARY-CREATOR-USER-IDS-DISCLOSED', 'MEDIUM', 'The item read returns the createdBy user id of the clause, and the tags read returns whole clause_library_tags rows with their createdBy user id, to stewards of other organizations that may read the clause.'),
  D('DEF-0B4-CLAUSE-LIBRARY-PUBLISHING-ON-STEWARD-ROLE-TITLE', 'MEDIUM', 'A steward of any organization can create or change a clause to sharing level public, which exposes its text to every organization; sharingChangeDenial checks only federation and congress eligibility, and no source names who may publish collective-agreement text.'),
  D('DEF-0B4-CLAUSE-LIBRARY-BODY-FIELDS-UNVALIDATED', 'LOW', 'Clause create, update, sharing update and tag writes store clause text, title, type, dates, anonymization fields and tag names from the body with no schema validation; only sharingLevel and sharedWithOrgIds are checked, so a malformed value reaches the database or throws as an unhandled error.'),
  D('DEF-0B4-CLAUSE-LIBRARY-ORIGINAL-CLAUSE-ID-UNVERIFIED', 'LOW', 'Clause create stores a caller-supplied originalClauseId that the schema notes as a foreign key to cba_clauses that is not enforced, and the route checks sourceCbaId against the organization but never checks originalClauseId, so a clause can point at another organization clause.'),
  D('DEF-0B4-CLAUSE-LIBRARY-EDIT-AND-DELETE-NO-VERSION-OR-RETENTION', 'MEDIUM', 'The update overwrites the shared clause text and sharing fields without raising version or setting previousVersionId, and the delete removes the row and its tags permanently, so organizations that compared or cited a clause see it change silently or vanish, and only the audit record remains.'),
  D('DEF-0B4-CLAUSE-LIBRARY-COMPARE-WRITES-OTHER-ORGANIZATION-ROWS', 'MEDIUM', 'The compare POST increments comparisonCount on rows owned by other organizations under the system role, and the audit record it commits belongs to the comparing organization, so a reader changes data it does not own and the owner has no record of it.'),
  D('DEF-0B4-CLAUSE-LIBRARY-COMPARE-GET-STUB-AND-EMPTY-KEYWORDS', 'LOW', 'The compare GET returns a usage message with status 200 and performs no comparison, and the compare POST returns commonKeywords as the constant empty list, so part of the advertised analysis is a placeholder presented as a result.'),
]

const D_SYSTEM = 'DEF-0B4-CLAUSE-LIBRARY-SYSTEM-ROLE-CROSS-TENANT-READS'
const D_FED = 'DEF-0B4-CLAUSE-LIBRARY-FEDERATION-PREDICATES-DISAGREE'
const D_ANON = 'DEF-0B4-CLAUSE-LIBRARY-ANONYMIZATION-NOT-ENFORCED-ON-READ'
const D_CREATOR = 'DEF-0B4-CLAUSE-LIBRARY-CREATOR-USER-IDS-DISCLOSED'
const D_PUBLISH = 'DEF-0B4-CLAUSE-LIBRARY-PUBLISHING-ON-STEWARD-ROLE-TITLE'
const D_BODY = 'DEF-0B4-CLAUSE-LIBRARY-BODY-FIELDS-UNVALIDATED'
const D_ORIGINAL = 'DEF-0B4-CLAUSE-LIBRARY-ORIGINAL-CLAUSE-ID-UNVERIFIED'
const D_VERSION = 'DEF-0B4-CLAUSE-LIBRARY-EDIT-AND-DELETE-NO-VERSION-OR-RETENTION'
const D_COMPARE_WRITE = 'DEF-0B4-CLAUSE-LIBRARY-COMPARE-WRITES-OTHER-ORGANIZATION-ROWS'
const D_COMPARE_STUB = 'DEF-0B4-CLAUSE-LIBRARY-COMPARE-GET-STUB-AND-EMPTY-KEYWORDS'

const CLAUSE = 'Collective-agreement clause text with its title, type, sector, province and dates, the owning organization, and the original or anonymized employer name'
const OWNER = 'shared_clause_library rows belong to sourceOrganizationId, which stamps every row from the session organization; sharingLevel and sharedWithOrgIds grant read access to other organizations. clause_library_tags rows belong to their clause.'
const CROSS = 'Clauses owned by one organization are returned to stewards of other organizations when the owning steward sets sharingLevel to public, federation, congress or a private grant list; the grant is a steward role-title decision, not a kernel decision.'

const authEv = (a) => [...guardEv(a, 'withApi'), a.h('authorization', "auth: { required: true, minRole: 'steward' },")]
const systemRoleEv = (a) => [a.imp('tenantScope', 'withSystemContext', 'SET LOCAL ROLE union_eyes_system')]

const common = (a, s) => mk({
  persona: 'Steward of any organization reading or sharing collective-agreement clauses',
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withApi.',
  gate: GATE,
  deps: DEPS,
  status: 'IMPLEMENTED_IN_SOURCE',
  owner: OWNER,
  sens: CLAUSE,
  ...s,
})

const READ_NOTE = 'A read: the handler writes no row and no audit record.'
const READ_REQ_AUDIT = 'Audit reads that return another organization clause once the sharing authority is named in the kernel.'
const OWNER_WRITE_AUDIT = 'Keep the in-transaction audit record and add the sharing level and grant count to it.'

const readerAuthz = 'withApi auth.minRole steward. Visibility of a clause owned by another organization follows its sharing level (owner, public, explicit grant, federation, congress), evaluated by hand-written application code; a role title is not a kernel decision.'
const ownerAuthz = 'withApi auth.minRole steward plus an owner-only check: only the organization that owns the clause may change it, and a zero-row write answers not found. A role title is not a kernel decision.'

const noWriteAudit = { mut: 'NOT_MUTATING', auditDetail: READ_NOTE }

const FACTS = {
  'clause-library/route.ts|GET': (a) => common(a, {
    authz: readerAuthz,
    tenant: 'The query runs on the system role and is bounded by buildClauseVisibilityCondition: the caller own clauses, public clauses, explicit grants to the caller organization, and federation and congress clauses the caller qualifies for.',
    priv: 'Clause text and the owning organization name of clauses owned by other organizations are returned to any steward the sharing level admits.',
    ...noWriteAudit,
    reqAudit: READ_REQ_AUDIT,
    does: 'Lists a page of clauses visible to the caller organization with search, type, sector, province and sharing level filters, hiding expired clauses unless requested.',
    future: 'Resolve clause visibility through the kernel decision, run the read in the caller tenant context, and use one visibility rule for the list and the item.',
    ev: [
      ...authEv(a),
      a.h('tenantScope', 'return await withSystemContext(async () => {'),
      a.h('tenantScope', 'const visibilityCondition = await buildClauseVisibilityCondition(organizationId);'),
      a.imp('tenantScope', 'buildClauseVisibilityCondition', 'eq(sharedClauseLibrary.sourceOrganizationId, callerOrgId),'),
      ...systemRoleEv(a),
      a.h('mutation', '.select({ count: sql<number>`count(*)::int` })'),
      a.h('privacy', 'clauseText: sharedClauseLibrary.clauseText,'),
      a.h('privacy', 'organizationName: organizations.name,'),
      a.imp('defect', 'buildClauseVisibilityCondition', 'OR ${callerFederationId} = ANY(${organizations.hierarchyPath})'),
      a.svc('defect', SHARING, 'return callerFed === ownerFed;', 'canReadSharedClause'),
    ],
    def: [D_SYSTEM, D_FED],
    cross: CROSS,
    corr: [],
  }),

  'clause-library/route.ts|POST': (a) => common(a, {
    authz: 'withApi auth.minRole steward. The create checks federation and congress eligibility for those sharing levels and, when sourceCbaId is supplied, that the agreement belongs to the session organization. Any steward may choose any other level, including public. A role title is not a kernel decision.',
    tenant: 'sourceOrganizationId is stamped from the session organization and the insert runs in the caller tenant context; the body cannot name the owner.',
    priv: 'The clause text, employer name and sharing level in the body are stored and, at level public, readable by every organization.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The clause row and a clause_library.create audit record commit in one tenant transaction.',
    reqAudit: OWNER_WRITE_AUDIT,
    does: 'Creates a shared clause owned by the session organization from the body, defaulting to private, and records the audit event.',
    future: 'Validate the body, name who may publish clause text beyond the organization, and verify originalClauseId against the organization.',
    dec: [PUBLICATION],
    ev: [
      ...authEv(a),
      a.h('authorization', 'const denial = await withSystemContext(() =>'),
      a.imp('authorization', 'sharingChangeDenial', "if (change.sharingLevel === 'federation' && !(await getFederationAncestorId(ownerOrgId))) {"),
      a.h('authorization', '.where(and(eq(collectiveAgreements.id, body.sourceCbaId), eq(collectiveAgreements.organizationId, organizationId)))'),
      a.h('tenantScope', 'sourceOrganizationId: organizationId,'),
      a.h('tenantScope', 'return await withRLSContext({ organizationId }, async (tx) => {'),
      a.h('mutation', '.insert(sharedClauseLibrary)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('privacy', 'originalEmployerName: body.originalEmployerName ?? null,'),
      a.h('defect', 'clauseText: body.clauseText,'),
      a.h('defect', 'originalClauseId: body.originalClauseId ?? null,'),
      a.sch('defect', SCHEMA, 'originalClauseId: uuid("original_clause_id"), // FK to cba_clauses (not enforced yet)', { symbol: 'sharedClauseLibrary' }),
      a.svc('defect', SHARING, "export const SHARING_LEVELS = ['private', 'federation', 'congress', 'public'] as const;"),
    ],
    def: [D_PUBLISH, D_BODY, D_ORIGINAL],
    corr: [],
  }),

  'clause-library/[id]/route.ts|GET': (a) => common(a, {
    authz: readerAuthz,
    tenant: 'The row is read on the system role by id and returned only when canReadSharedClause admits the caller organization; the owner always reads.',
    priv: 'The full clause, including originalEmployerName and the creator user id, is returned to any reader whatever isAnonymized says; the explicit grant list is returned to the owner only.',
    ...noWriteAudit,
    reqAudit: READ_REQ_AUDIT,
    does: 'Returns one clause with its tags and an isOwner flag when the caller organization may read it, and answers not found otherwise.',
    future: 'Withhold the original employer name and the creator identity while a clause is anonymized, resolve visibility through the kernel decision, and use one rule for the list and the item.',
    ev: [
      ...authEv(a),
      a.h('tenantScope', 'return withSystemContext(async () => {'),
      a.h('authorization', 'if (!row || !(await canReadSharedClause(organizationId, row))) {'),
      a.imp('authorization', 'canReadSharedClause', 'if (clause.sourceOrganizationId === callerOrgId) return true;'),
      a.local('tenantScope', 'getClauseRow', '.where(eq(sharedClauseLibrary.id, id))'),
      a.h('mutation', 'const tags = await db.select().from(clauseLibraryTags).where(eq(clauseLibraryTags.clauseId, id));'),
      a.local('privacy', 'formatClause', 'sharedWithOrgIds: isOwner ? r!.sharedWithOrgIds : undefined,'),
      a.local('defect', 'formatClause', 'originalEmployerName: r!.originalEmployerName,'),
      a.local('defect', 'formatClause', 'createdBy: r!.createdBy,'),
      a.sch('defect', SCHEMA, 'isAnonymized: boolean("is_anonymized").default(false),', { symbol: 'sharedClauseLibrary' }),
      ...systemRoleEv(a),
      a.svc('defect', SHARING, 'return callerFed === ownerFed;', 'canReadSharedClause'),
    ],
    def: [D_SYSTEM, D_FED, D_ANON, D_CREATOR],
    cross: CROSS,
    corr: [],
  }),

  'clause-library/[id]/route.ts|PATCH': (a) => ({
    ...common(a, {
      authz: ownerAuthz,
      tenant: 'The update runs in the caller tenant context and is bound to the clause id and sourceOrganizationId equal to the session organization.',
      priv: 'Clause text, employer names, anonymization and sharing fields from the body replace the stored values, and a change to sharingLevel can publish the clause to every organization.',
      mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
      auditDetail: 'The clause update and a clause_library.update audit record, with the field names and the sharing level change, commit in one tenant transaction.',
      reqAudit: OWNER_WRITE_AUDIT,
      does: 'Updates the owner clause with the allow-listed body fields after validating sharingLevel and sharedWithOrgIds, and records the audit event.',
      future: 'Validate the body, create a new version instead of overwriting shared text, and name who may publish.',
      dec: [PUBLICATION],
      ev: [
        ...authEv(a),
        a.h('authorization', 'if (!existing || !isSharedClauseOwner(organizationId, existing)) {'),
        a.imp('authorization', 'isSharedClauseOwner', 'return clause.sourceOrganizationId === callerOrgId;'),
        a.h('authorization', 'const denial = await withSystemContext(() => sharingChangeDenial(organizationId, body));'),
        a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
        a.h('tenantScope', '.where(and(eq(sharedClauseLibrary.id, id), eq(sharedClauseLibrary.sourceOrganizationId, organizationId)))'),
        a.h('mutation', '.update(sharedClauseLibrary)'),
        a.h('audit', 'await persistAtomicAudit(tx, {'),
        a.h('defect', 'if (body.clauseText !== undefined) updateData.clauseText = body.clauseText;'),
        a.h('defect', 'if (body.sharingLevel !== undefined) updateData.sharingLevel = body.sharingLevel;'),
        a.sch('defect', SCHEMA, 'version: integer("version").default(1),', { symbol: 'sharedClauseLibrary' }),
      ],
      def: [D_PUBLISH, D_BODY, D_VERSION],
      corr: [],
    }),
    inferences: [versionAbsence(a)],
  }),

  'clause-library/[id]/route.ts|DELETE': (a) => common(a, {
    authz: ownerAuthz,
    tenant: 'The delete runs in the caller tenant context and is bound to the clause id and sourceOrganizationId equal to the session organization.',
    priv: 'The clause and its tags are removed; organizations that read it keep nothing.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The clause delete and a clause_library.delete audit record commit in one tenant transaction.',
    reqAudit: OWNER_WRITE_AUDIT,
    does: 'Permanently deletes the owner clause, and its tags by cascade, and records the audit event.',
    future: 'Retire a shared clause with a status or tombstone so that readers see it withdrawn.',
    ev: [
      ...authEv(a),
      a.h('authorization', 'if (!existing || !isSharedClauseOwner(organizationId, existing)) {'),
      a.imp('authorization', 'isSharedClauseOwner', 'return clause.sourceOrganizationId === callerOrgId;'),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      a.h('tenantScope', '.where(and(eq(sharedClauseLibrary.id, id), eq(sharedClauseLibrary.sourceOrganizationId, organizationId)))'),
      a.h('mutation', '.delete(sharedClauseLibrary)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.sch('defect', SCHEMA, '.references(() => sharedClauseLibrary.id, { onDelete: "cascade" }),', { symbol: 'clauseLibraryTags' }),
    ],
    def: [D_VERSION],
    corr: [],
  }),

  'clause-library/[id]/share/route.ts|GET': (a) => common(a, {
    authz: ownerAuthz,
    tenant: 'The read runs in the caller tenant context and answers not found unless the clause source organization equals the session organization.',
    priv: 'The sharing configuration, including the list of organizations granted read access, is returned to the owner only.',
    ...noWriteAudit,
    reqAudit: 'Reads of the owner own sharing configuration need no audit record.',
    does: 'Returns the sharing level, the explicit grant list and the anonymization settings of a clause the caller organization owns.',
    future: 'Resolve who may see and change sharing configuration through the kernel decision.',
    ev: [
      ...authEv(a),
      a.h('authorization', 'if (!clause || !isSharedClauseOwner(organizationId, clause)) {'),
      a.imp('authorization', 'isSharedClauseOwner', 'return clause.sourceOrganizationId === callerOrgId;'),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async () => {'),
      a.h('mutation', '.where(eq(sharedClauseLibrary.id, id))'),
      a.h('privacy', 'sharedWithOrgIds: sharedClauseLibrary.sharedWithOrgIds,'),
    ],
    def: [],
    corr: [],
  }),

  'clause-library/[id]/share/route.ts|POST': (a) => common(a, {
    authz: ownerAuthz,
    tenant: 'The update runs in the caller tenant context and is bound to the clause id and sourceOrganizationId equal to the session organization.',
    priv: 'The sharing level and the grant list decide which organizations read the clause text; the body can set the level to public.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The sharing update and a clause_library.sharing.update audit record, with the field names, the level change and the grant count, commit in one tenant transaction.',
    reqAudit: OWNER_WRITE_AUDIT,
    does: 'Updates the sharing level, the explicit grant list and the anonymization settings of a clause the caller organization owns after validating the level and the grant list.',
    future: 'Validate the anonymization fields, name who may publish, and record the grantee organizations in the audit record.',
    dec: [PUBLICATION],
    ev: [
      ...authEv(a),
      a.h('authorization', 'const denial = await withSystemContext(() => sharingChangeDenial(organizationId, updates));'),
      a.imp('authorization', 'sharingChangeDenial', "if (change.sharingLevel === 'federation' && !(await getFederationAncestorId(ownerOrgId))) {"),
      a.h('authorization', 'if (!clause || !isSharedClauseOwner(organizationId, clause)) {'),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      a.h('tenantScope', '.where(and(eq(sharedClauseLibrary.id, id), eq(sharedClauseLibrary.sourceOrganizationId, organizationId)))'),
      a.h('mutation', '.update(sharedClauseLibrary)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'if (body.isAnonymized !== undefined) updates.isAnonymized = body.isAnonymized;'),
      a.h('defect', 'if (body.sharingLevel !== undefined) updates.sharingLevel = body.sharingLevel;'),
      a.svc('defect', SHARING, "export const SHARING_LEVELS = ['private', 'federation', 'congress', 'public'] as const;"),
    ],
    def: [D_PUBLISH, D_BODY],
    corr: [],
  }),

  'clause-library/[id]/tags/route.ts|GET': (a) => common(a, {
    authz: readerAuthz,
    tenant: 'The clause is read on the system role and the tags are returned only when canReadSharedClause admits the caller organization.',
    priv: 'Whole tag rows, including the createdBy user id, are returned to any reader of the clause.',
    ...noWriteAudit,
    reqAudit: READ_REQ_AUDIT,
    does: 'Returns every tag row of a clause the caller organization may read.',
    future: 'Return the tag name only, and resolve visibility through the kernel decision.',
    ev: [
      ...authEv(a),
      a.h('tenantScope', 'return withSystemContext(async () => {'),
      a.h('authorization', 'if (!clause || !(await canReadSharedClause(organizationId, clause))) {'),
      a.imp('authorization', 'canReadSharedClause', 'if (clause.sourceOrganizationId === callerOrgId) return true;'),
      a.h('mutation', '.from(clauseLibraryTags)'),
      a.h('defect', 'const tags = await db'),
      a.sch('defect', SCHEMA, 'createdBy: varchar("created_by", { length: 255 }).notNull(),', { symbol: 'clauseLibraryTags' }),
      ...systemRoleEv(a),
      a.svc('defect', SHARING, 'return callerFed === ownerFed;', 'canReadSharedClause'),
    ],
    def: [D_SYSTEM, D_FED, D_CREATOR],
    cross: CROSS,
    corr: [],
  }),

  'clause-library/[id]/tags/route.ts|POST': (a) => common(a, {
    authz: ownerAuthz,
    tenant: 'The insert runs in the caller tenant context after the clause is shown to belong to the session organization.',
    sens: 'A tag name attached to a clause',
    priv: 'The tag name from the body is stored, with the creating user id.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The tag row and a clause_library.tag.add audit record commit in one tenant transaction.',
    reqAudit: OWNER_WRITE_AUDIT,
    does: 'Adds a tag to a clause the caller organization owns and records the audit event.',
    future: 'Validate the tag name, which the handler trims without checking its type or length.',
    ev: [
      ...authEv(a),
      a.h('authorization', 'if (!clause || !isSharedClauseOwner(organizationId, clause)) {'),
      a.imp('authorization', 'isSharedClauseOwner', 'return clause.sourceOrganizationId === callerOrgId;'),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      a.h('mutation', '.insert(clauseLibraryTags)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
      a.h('defect', 'tagName: tagName.trim(),'),
    ],
    def: [D_BODY],
    corr: [],
  }),

  'clause-library/[id]/tags/route.ts|DELETE': (a) => common(a, {
    authz: ownerAuthz,
    tenant: 'The delete runs in the caller tenant context and is bound to the clause id and, through tagOfOwnedClause, to a clause whose source organization is the session organization.',
    sens: 'A tag name attached to a clause',
    priv: 'The tag rows named by tagId or tagName are removed.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The tag delete and a clause_library.tag.remove audit record commit in one tenant transaction.',
    reqAudit: OWNER_WRITE_AUDIT,
    does: 'Removes the tag named by tagId, or every tag of the clause with the given tagName, from a clause the caller organization owns, and records the audit event.',
    future: 'Validate the tag name and identifier.',
    ev: [
      ...authEv(a),
      a.h('authorization', 'if (!clause || !isSharedClauseOwner(organizationId, clause)) {'),
      a.imp('authorization', 'isSharedClauseOwner', 'return clause.sourceOrganizationId === callerOrgId;'),
      a.h('tenantScope', 'return withRLSContext({ organizationId }, async (tx) => {'),
      a.local('tenantScope', 'tagOfOwnedClause', 'IN (SELECT id FROM shared_clause_library WHERE id = ${clauseId} AND source_organization_id = ${organizationId})'),
      a.h('mutation', '.delete(clauseLibraryTags)'),
      a.h('audit', 'await persistAtomicAudit(tx, {'),
    ],
    def: [],
    corr: [],
  }),

  'clause-library/compare/route.ts|GET': (a) => common(a, {
    authz: 'withApi auth.minRole steward. The handler reads no data.',
    tenant: 'The handler touches no data.',
    sens: 'None: a fixed usage message',
    priv: 'Nothing is disclosed.',
    ...noWriteAudit,
    reqAudit: 'No audit record is needed for a fixed message.',
    does: 'Returns the fixed message Use POST with clauseIds array to compare clauses with status 200 and compares nothing.',
    status: 'NOT_IMPLEMENTED_RETURNS_200',
    future: 'Remove the stub or return 405 with an Allow header.',
    ev: [
      ...authEv(a),
      a.h('mutation', "return { message: 'Use POST with clauseIds array to compare clauses' };"),
      a.h('behavior', "return { message: 'Use POST with clauseIds array to compare clauses' };"),
      a.h('tenantScope', "return { message: 'Use POST with clauseIds array to compare clauses' };"),
    ],
    def: [D_COMPARE_STUB],
    corr: [],
  }),

  'clause-library/compare/route.ts|POST': (a) => common(a, {
    authz: readerAuthz,
    tenant: 'The clauses are read on the system role and an id the caller organization may not read is dropped silently; the comparison counter is then incremented on the rows of other organizations under the same role.',
    priv: 'Clause text and the owning organization name of up to ten clauses owned by other organizations are returned to any steward the sharing level admits.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The comparison counter increments and a clause_library.compare audit record naming the authorized clause ids commit in one system-role transaction; the audit record belongs to the comparing organization.',
    reqAudit: 'Record the compare in the audit trail of each owning organization, or stop writing the counter.',
    does: 'Compares two to ten clauses the caller organization may read, returns them with tags and basic statistics, and increments comparisonCount on each.',
    future: 'Stop a reader from writing to rows it does not own, and compute the keyword analysis or remove it.',
    ev: [
      ...authEv(a),
      a.h('tenantScope', 'return withSystemContext(async (tx) => {'),
      a.h('authorization', 'await Promise.all(rows.map(async (r) => ((await canReadSharedClause(organizationId, r)) ? r : null)))'),
      a.imp('authorization', 'canReadSharedClause', 'if (clause.sourceOrganizationId === callerOrgId) return true;'),
      a.h('mutation', '.update(sharedClauseLibrary)'),
      a.h('mutation', 'set({ comparisonCount: sql`${sharedClauseLibrary.comparisonCount} + 1` })'),
      a.h('audit', 'await persistAtomicAudit(tx as RLSTx, {'),
      a.h('defect', 'commonKeywords: [],'),
      ...systemRoleEv(a),
      a.svc('defect', SHARING, 'return callerFed === ownerFed;', 'canReadSharedClause'),
    ],
    def: [D_SYSTEM, D_FED, D_COMPARE_WRITE, D_COMPARE_STUB],
    cross: 'A steward of any organization increments comparisonCount on clauses owned by other organizations and reads their text and owner name when the sharing level admits it; the grant is a steward role-title decision, not a kernel decision.',
    corr: [],
  }),
}

const SEARCH_EV = (a) => [
  ...authEv(a),
  a.local('tenantScope', 'searchClauses', 'return withSystemContext(async () => {'),
  a.local('tenantScope', 'searchClauses', 'const visibilityCondition = await buildClauseVisibilityCondition(organizationId);'),
  a.svc('tenantScope', SHARING, 'eq(sharedClauseLibrary.sourceOrganizationId, callerOrgId),', 'buildClauseVisibilityCondition'),
  a.local('mutation', 'searchClauses', '.from(sharedClauseLibrary)'),
  a.local('privacy', 'searchClauses', 'clauseText: sharedClauseLibrary.clauseText,'),
  a.svc('defect', SHARING, 'OR ${callerFederationId} = ANY(${organizations.hierarchyPath})', 'buildClauseVisibilityCondition'),
  a.svc('defect', SHARING, 'return callerFed === ownerFed;', 'canReadSharedClause'),
  a.svc('tenantScope', `${APP}lib/db/with-rls-context.ts`, 'SET LOCAL ROLE union_eyes_system', 'withSystemContext'),
  ...(a.method === 'POST' ? [a.h('audit', 'return { clauses: await searchClauses(q, organizationId) };')] : []),
]

const searchFact = (a) => common(a, {
  authz: readerAuthz,
  tenant: 'The search runs on the system role and is bounded by buildClauseVisibilityCondition, the same predicate as the list.',
  priv: 'Clause text and the owning organization name of up to 50 clauses owned by other organizations, matched by title or text, are returned to any steward the sharing level admits.',
  ...noWriteAudit,
  ...(a.method === 'POST' ? { nonMutationReason: 'The POST only runs a search through the shared searchClauses function and writes no row.' } : {}),
  reqAudit: READ_REQ_AUDIT,
  does: `Searches the clauses visible to the caller organization by title or text and returns up to 50, from a ${a.method === 'GET' ? 'query string' : 'JSON body'} term.`,
  future: 'Resolve visibility through the kernel decision and use one rule for the list, the item and the search.',
  ev: SEARCH_EV(a),
  def: [D_SYSTEM, D_FED],
  cross: CROSS,
  corr: [],
})
FACTS['clause-library/search/route.ts|GET'] = searchFact
FACTS['clause-library/search/route.ts|POST'] = searchFact

function versionAbsence(a) {
  const found = ['version', 'previousVersionId'].filter((name) => a.region.includes(name))
  if (found.length > 0) throw new Error(`${a.route}|${a.method}: the handler unexpectedly mentions ${found.join(', ')}`)
  return { claim: 'defect', statement: 'The handler never sets version or previousVersionId, so the update overwrites the stored clause text in place; the table has both columns.' }
}

export function clauseLibraryFacts(a, readText) {
  const fact = FACTS[`${a.route}|${a.method}`]
  if (!fact) throw new Error(`no clause library facts for ${a.route}|${a.method}`)
  if (readText && !definitionRegion(readText(SHARING), 'sharingChangeDenial')?.includes("change.sharingLevel === 'congress'")) throw new Error('sharingChangeDenial no longer has the congress branch the facts describe')
  if (readText && /'public'/.test(definitionRegion(readText(SHARING), 'sharingChangeDenial') ?? '')) throw new Error('sharingChangeDenial now names the public level; the publishing defect must be re-derived')
  return fact(a)
}
