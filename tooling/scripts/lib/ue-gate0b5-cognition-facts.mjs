/**
 * Gate 0B.5 facts for the organizational cognition routes: case risk, engagement, executive summary, key indicators,
 * precedents, workload and health. Every evidence quote is read from the exact handler, an import it uses, or a
 * package file it reaches; the validator proves each quote again from the written register.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { APP, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const ANALYTICS_GATE = 14
const OPERATOR_GATE = 9
const PKG = 'packages/ue-cognition/src/'
const ADAPTER = `${APP}lib/cognition/ue-adapter.ts`

export const COGNITION_ROUTES = new Set([
  'cognition/cases/[id]/risk/route.ts', 'cognition/engagement/route.ts', 'cognition/executive-summary/route.ts',
  'cognition/kpis/route.ts', 'cognition/precedents/route.ts', 'cognition/workload/route.ts', 'cognition/health/route.ts',
])

const D = (id, gate, severity, title) => ({ id, gate, severity, title })

export const COGNITION_DEFECTS = [
  D('DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES', ANALYTICS_GATE, 'HIGH', 'Every cognition engine persists its snapshots as JSON files under ops/ue-cognition at the root of the server checkout, one directory per entity shared by every organization, and keeps tenancy only by filtering subject.orgId after reading every file; there is no table, no row level security and no durability across hosts or restarts, so the derived figures a steward and an administrator read are neither tenant-isolated at rest nor reproducible.'),
  D('DEF-0B5-COGNITION-READ-ROUTES-WRITE-FILES-AUDIT-NOT-ATOMIC', ANALYTICS_GATE, 'MEDIUM', 'The risk, workload and key-indicator GET routes and the precedent search compute a snapshot and write it to a local file on every call, then record a separate auditLog event; the write is not in the audit transaction, a GET changes stored state, and a failed audit leaves the snapshot behind.'),
  D('DEF-0B5-COGNITION-ANY-STEWARD-SCORES-ANY-CASE', ANALYTICS_GATE, 'MEDIUM', 'Any steward of the organization requests a risk score, recommended action and rationale for any grievance of the organization, and a precedent search that returns the title of any grievance of the organization, without holding the case or being assigned to it; forCaseId of a precedent search is never checked against the organization.'),
  D('DEF-0B5-COGNITION-ENGAGEMENT-NEVER-COMPUTED', ANALYTICS_GATE, 'MEDIUM', 'computeMemberEngagement has no caller in the application or in any other package, so the engagement route and the disengaged-member counts of the executive summary and key indicators read a store that nothing writes, and report an empty list and zero counts with status 200 as if they were measurements.'),
  D('DEF-0B5-COGNITION-WORKLOAD-BURNOUT-VISIBLE-TO-PEERS', ANALYTICS_GATE, 'MEDIUM', 'The workload route returns, for every active steward of the organization, a burnout signal, utilization ratio and recommended reassignments to any steward, so a steward reads a colleague burnout signal and caseload that no source says the colleague or the union agreed to share.'),
  D('DEF-0B5-COGNITION-KPI-ROI-FROM-ASSUMED-HOURS', ANALYTICS_GATE, 'LOW', 'The key-indicator snapshot computes estimated admin hours saved and a dollar return from constants (hours saved per precedent retrieval, per early warning and per reassignment, and a loaded hourly rate), not from measured time; the route comment calls the artefact the one handed to buyers, so an assumption is presented as a result.'),
  D('DEF-0B5-COGNITION-HEALTH-PLATFORM-POSTURE-TO-ORG-OFFICER', OPERATOR_GATE, 'LOW', 'The cognition health route reports the platform engine registry, ontology and contract versions and engine counts per domain to any officer of any organization; platform runtime posture is a platform operator concern and no source names which organization role may see it.'),
]

const base = (a) => ({
  service: `${APP}app/api/${a.route}`,
  authn: 'Authenticated session resolved by withOrganizationAuth.',
  cat: 'ROLE_FLOOR',
  gate: ANALYTICS_GATE,
  deps: [9, 13],
})

const floor = (a, role) => [
  ...guardEv(a, 'withOrganizationAuth'),
  a.h('authorization', `await hasMinRole('${role}')`),
  a.imp('authorization', 'hasMinRole', 'const resolvedOrgId = await getOrganizationIdForUser(userId);'),
]

const authz = (role) => `withOrganizationAuth then hasMinRole('${role}'): a role floor of ${role} for the organization the session resolves to. A role title is not a kernel decision.`

const writeCorr = { field: 'mutating', manifest: 'read-only GET', actual: 'The route computes a snapshot and writes it to a local JSON file on every call, then records a separate audit event.' }

const FACTS = {
  'cognition/cases/[id]/risk/route.ts|GET': (a) => mk({
    ...base(a),
    persona: 'Steward requesting a cognition-driven risk score for a grievance',
    authz: authz('steward'),
    tenant: 'The grievance is read with an organization predicate on the session organization; the snapshot is written to a shared local directory and carries the organization only inside subject.orgId.',
    owner: 'The grievance row belongs to the organization; the risk snapshot is a JSON file under ops/ue-cognition keyed by a generated id, with caseId and subject.orgId inside it and no owner or author.',
    sens: 'Risk tier, score, confidence, top factors, recommended action and rationale derived from the event history of a named grievance',
    priv: 'Any steward of the organization reads the risk tier, factors and recommended action of any grievance of the organization without holding the case.',
    mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
    auditDetail: 'The handler computes the snapshot, which writes a local JSON file, and then records a DATA_ACCESS auditLog event; the file write is not committed with the audit event.',
    reqAudit: 'Record the authorization decision and the case in a canonical audit record, and decide whether a derived risk figure should be stored at all.',
    does: 'Scores a grievance of the session organization from its event history, persists the snapshot to a local file, audits the computation separately and returns the snapshot with an advisory governance block.',
    status: 'PARTIAL',
    future: 'Persist the snapshot in a tenant-scoped table inside the audit transaction, restrict the score to the stewards who hold the case and to the officers who oversee it, and keep the figure advisory.',
    ev: [
      ...floor(a, 'steward'),
      a.h('tenantScope', 'const snap = await scoreGrievanceRisk(context.organizationId, params.id);'),
      a.svc('tenantScope', ADAPTER, 'eq(grievances.organizationId, organizationId)', 'scoreGrievanceRisk'),
      a.svc('mutation', `${PKG}case-risk/engine.ts`, 'return writeRecord(ENTITY, snapshot.id, snapshot, caseRiskSnapshotSchema)', 'computeCaseRisk'),
      a.h('audit', 'await auditLog({'),
      a.h('behavior', 'autoApplied: false,'),
    ],
    def: ['DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES', 'DEF-0B5-COGNITION-READ-ROUTES-WRITE-FILES-AUDIT-NOT-ATOMIC', 'DEF-0B5-COGNITION-ANY-STEWARD-SCORES-ANY-CASE'],
    corr: [writeCorr],
  }),

  'cognition/engagement/route.ts|GET': (a) => mk({
    ...base(a),
    persona: 'Steward reading member disengagement risk',
    authz: authz('steward'),
    tenant: 'The route reads every stored engagement snapshot of every organization and then filters on subject.orgId equal to the session organization; no query carries a tenant predicate.',
    owner: 'Engagement snapshots are JSON files under ops/ue-cognition carrying memberId and subject.orgId; the organization owns the members they describe.',
    sens: 'Disengagement probability, tier and outreach recommendation for named members',
    priv: 'Any steward reads the disengagement risk of every member of the organization with the member id, and the audit event records only the count.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read of stored snapshots; the handler records a DATA_ACCESS auditLog event with the member count and writes no row.',
    reqAudit: 'Audit which members a steward viewed and decide whether member preference allows the figure to be computed at all.',
    does: 'Lists the latest engagement snapshot per member of the session organization, sorted by disengagement probability; the store it reads is written by no caller, so the list is empty unless a file was placed there.',
    status: 'NOT_IMPLEMENTED_RETURNS_200',
    future: 'Decide whether member disengagement scoring is an institutional capability, name who may see it, compute it from consented data and store it in a tenant table; until then return 501.',
    ev: [
      ...floor(a, 'steward'),
      a.h('tenantScope', 'const all = listEngagementSnapshots().filter((s) => s.subject.orgId === context.organizationId);'),
      a.svc('mutation', `${PKG}engagement/engine.ts`, 'return listRecords(ENTITY, memberEngagementSnapshotSchema)', 'listEngagementSnapshots'),
      a.svc('defect', `${PKG}engagement/engine.ts`, 'export function computeMemberEngagement(input: MemberEngagementInput): MemberEngagementSnapshot {', 'computeMemberEngagement'),
      a.h('audit', 'await auditLog({'),
      a.h('behavior', 'autoApplied: false,'),
    ],
    inf: [{ claim: 'defect', statement: 'A search of apps and packages finds computeMemberEngagement only in its own package (engine, engagement index and package barrel), so no route, job or service calls it and nothing writes the engagement store the route reads.' }],
    def: ['DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES', 'DEF-0B5-COGNITION-ENGAGEMENT-NEVER-COMPUTED'],
  }),

  'cognition/executive-summary/route.ts|GET': (a) => mk({
    ...base(a),
    persona: 'Administrator reading the organization-wide executive view',
    authz: authz('admin'),
    tenant: "The summary is built for orgId equal to the session organization and the literal tenant id union-eyes; each aggregation reads every stored snapshot and filters on subject.orgId.",
    owner: 'The summary is computed on read from stored snapshot files; it has no row of its own.',
    sens: 'Backlog risk by tier, the highest-risk cases with rationale, steward overload and idle lists, and member disengagement counts',
    priv: 'An administrator reads case identifiers with risk rationale and steward utilization for the whole organization.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read of stored snapshots; the handler records a DATA_ACCESS auditLog event with backlog and intervention counts and writes no row.',
    reqAudit: 'Audit the view with the case identifiers disclosed once the readers are named.',
    does: 'Aggregates the latest stored case risk, steward workload, key-indicator and engagement snapshots of the session organization into an advisory executive summary; the figures are only as current as the last time another route computed and stored a snapshot.',
    status: 'PARTIAL',
    future: 'Compute the summary from tenant tables, mark the age of every input, and name the officers who may read case-level rationale.',
    ev: [
      ...floor(a, 'admin'),
      a.h('tenantScope', "const summary = buildExecutiveSummary({ tenantId: 'union-eyes', orgId: context.organizationId });"),
      a.svc('tenantScope', `${PKG}executive/summary.ts`, 'const cases = latestRiskPerCase(subject.orgId)', 'buildExecutiveSummary'),
      a.svc('mutation', `${PKG}executive/summary.ts`, 'const disengaged = disengagedMembersCount(subject.orgId)', 'buildExecutiveSummary'),
      a.h('audit', 'await auditLog({'),
      a.h('behavior', 'autoApplied: false,'),
    ],
    def: ['DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES', 'DEF-0B5-COGNITION-ENGAGEMENT-NEVER-COMPUTED'],
  }),

  'cognition/kpis/route.ts|GET': (a) => mk({
    ...base(a),
    persona: 'Steward requesting a key-indicator snapshot for a reporting window',
    authz: authz('steward'),
    tenant: 'The two raw SQL counts filter on the session organization with a uuid cast; the snapshot engine reads stored files and filters on subject.orgId, and the snapshot is written to a shared local directory.',
    owner: 'The key-indicator snapshot is a JSON file under ops/ue-cognition keyed by a generated id and carrying subject.orgId; it has no author.',
    sens: 'Average grievance cycle time, steward count, backlog risk, estimated admin hours saved and an estimated dollar return for the organization',
    priv: 'Organization-level figures only; no personal data is returned beyond counts.',
    mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
    auditDetail: 'The handler computes the snapshot, which writes a local JSON file, and then records a DATA_ACCESS auditLog event with the hours and return figures; the file write is not committed with the audit event.',
    reqAudit: 'Commit the snapshot and its audit record together once the snapshot is a tenant record.',
    does: 'Computes a key-indicator snapshot for a window of 1 to 365 days from a real average cycle time, a steward count, and stored snapshot files, writes the snapshot to a local file, audits it separately and returns it with its assumptions.',
    status: 'PARTIAL',
    future: 'Store snapshots in a tenant table inside the audit transaction, label every assumption-derived dollar figure as an estimate, and name who may hand a snapshot to a third party.',
    ev: [
      ...floor(a, 'steward'),
      a.h('tenantScope', 'WHERE organization_id = ${context.organizationId}::uuid'),
      a.svc('mutation', `${PKG}kpis/engine.ts`, 'return writeRecord(ENTITY, snapshot.id, snapshot, ueCognitionKpiSnapshotSchema)', 'computeKpiSnapshot'),
      a.svc('defect', `${PKG}kpis/engine.ts`, 'const estimatedRoiCad = adminHoursSaved * rate', 'computeKpiSnapshot'),
      a.svc('defect', `${PKG}utils.ts`, 'fs.writeFileSync(recordPath(entity, id), JSON.stringify(validated, null, 2), \'utf-8\')', 'writeRecord'),
      a.h('audit', 'await auditLog({'),
      a.h('behavior', "note: 'KPI fields are null when source data is insufficient. No inferred values.',"),
    ],
    def: ['DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES', 'DEF-0B5-COGNITION-READ-ROUTES-WRITE-FILES-AUDIT-NOT-ATOMIC', 'DEF-0B5-COGNITION-KPI-ROI-FROM-ASSUMED-HOURS', 'DEF-0B5-COGNITION-ENGAGEMENT-NEVER-COMPUTED'],
    corr: [writeCorr],
  }),

  'cognition/precedents/route.ts|POST': (a) => mk({
    ...base(a),
    persona: 'Steward searching the organization grievance history for precedents',
    authz: authz('steward'),
    tenant: 'The candidate grievances are read with an organization predicate on the session organization and the engine refuses a candidate of another organization; forCaseId is taken from the body and is not looked up.',
    owner: 'The match result is a JSON file under ops/ue-cognition keyed by a generated id, carrying forCaseId and subject.orgId; the candidate grievances belong to the organization.',
    sens: 'Titles, types, outcomes and resolution times of the grievances of the organization that match a case',
    priv: 'Any steward reads the title and outcome of any grievance of the organization, listed by id or by type, without holding the case; the audit event records only counts.',
    mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
    auditDetail: 'The handler runs the search, which writes the match result to a local JSON file, and then records a DATA_ACCESS auditLog event with counts; the file write is not committed with the audit event.',
    reqAudit: 'Record the case the precedent search was made for and the grievances disclosed in a canonical audit record.',
    does: 'Selects up to fifty grievances of the session organization by type or by the ids the caller supplies, ranks them against the case, writes the match result to a local file, audits it separately and returns the ranked precedents.',
    status: 'PARTIAL',
    future: 'Verify the case belongs to the organization and to the steward, return only the precedents the steward may see, and store the match in a tenant table inside the audit transaction.',
    ev: [
      ...floor(a, 'steward'),
      a.h('tenantScope', 'eq(grievances.organizationId, context.organizationId),'),
      a.svc('tenantScope', `${PKG}precedents/engine.ts`, 'throw new CrossOrgPrecedentLeakError(c.descriptor.caseId)', 'findPrecedents'),
      a.svc('mutation', `${PKG}precedents/engine.ts`, 'return writeRecord(ENTITY, result.id, result, precedentMatchSchema)', 'findPrecedents'),
      a.h('privacy', "summary: g.title ?? '',"),
      a.h('audit', 'await auditLog({'),
      a.h('behavior', 'orgScopeEnforced: true,'),
    ],
    def: ['DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES', 'DEF-0B5-COGNITION-READ-ROUTES-WRITE-FILES-AUDIT-NOT-ATOMIC', 'DEF-0B5-COGNITION-ANY-STEWARD-SCORES-ANY-CASE'],
  }),

  'cognition/workload/route.ts|GET': (a) => mk({
    ...base(a),
    persona: 'Steward reading steward workload and fairness',
    authz: authz('steward'),
    tenant: 'The active stewards are read with an organization predicate on the session organization; the snapshots are written to a shared local directory carrying subject.orgId.',
    owner: 'Workload snapshots are JSON files under ops/ue-cognition keyed by a generated id and carrying the steward id and subject.orgId; the steward rows belong to the organization.',
    sens: 'Caseload, utilization ratio, burnout signal and recommended case reassignments for each named steward',
    priv: 'Any steward reads the burnout signal, caseload and reassignment recommendations of every other steward of the organization.',
    mut: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
    auditDetail: 'The handler computes a snapshot per steward, which writes a local JSON file for each, and then records one DATA_ACCESS auditLog event with the steward count; the file writes are not committed with the audit event.',
    reqAudit: 'Commit each snapshot with its audit record once snapshots are tenant records, and audit who viewed a colleague burnout signal.',
    does: 'Computes a workload snapshot for every active steward of the session organization, writes each to a local file, computes organization fairness, audits it separately and returns both with an advisory governance block.',
    status: 'PARTIAL',
    future: 'Decide who may see colleague workload and burnout signals, restrict the burnout signal to the steward and the officers who supervise, and store snapshots in a tenant table inside the audit transaction.',
    ev: [
      ...floor(a, 'steward'),
      a.h('tenantScope', 'const stewards = await scoreStewardWorkloads(context.organizationId);'),
      a.svc('tenantScope', ADAPTER, '.where(and(eq(stewards.orgId, organizationId), eq(stewards.active, true)));', 'scoreStewardWorkloads'),
      a.svc('mutation', `${PKG}workload/engine.ts`, 'return writeRecord(ENTITY, snapshot.id, snapshot, stewardWorkloadSnapshotSchema)', 'computeStewardWorkload'),
      a.svc('privacy', `${PKG}workload/engine.ts`, 'burnoutSignal,', 'computeStewardWorkload'),
      a.h('audit', 'await auditLog({'),
      a.h('behavior', "note: 'Reassignments are recommendations only. Operator must confirm.',"),
    ],
    def: ['DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES', 'DEF-0B5-COGNITION-READ-ROUTES-WRITE-FILES-AUDIT-NOT-ATOMIC', 'DEF-0B5-COGNITION-WORKLOAD-BURNOUT-VISIBLE-TO-PEERS'],
    corr: [writeCorr],
  }),

  'cognition/health/route.ts|GET': (a) => mk({
    service: `${APP}app/api/${a.route}`,
    authn: 'Authenticated session resolved by withApi.',
    persona: 'Officer reading the posture of the organizational cognition runtime',
    authz: "withApi with minRole officer: a role floor of officer. The route reads no organization data, so the role is the only control; a role title is not a kernel decision.",
    tenant: 'None: the handler reads the process-wide engine registry and no table, so every organization officer sees the same platform posture.',
    owner: 'No owner: the response is computed from the in-process registry and the package ontology constants.',
    sens: 'Platform engine counts per domain, ontology and contract versions and missing domains',
    priv: 'No personal data is returned; platform runtime posture is returned to any officer of any organization.',
    gate: OPERATOR_GATE,
    deps: [13, 14],
    mut: 'NOT_MUTATING',
    auditDetail: 'A read of the in-process registry; nothing is written and the read is not audited.',
    reqAudit: 'Health reads need no audit record once only the platform operator can make them.',
    does: 'Counts the registered cognition engines per domain, reports status degraded when a canonical domain has no engine, and always returns HTTP 200.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: 'Name the platform role that reads runtime posture, and serve a liveness probe separately from the operator posture.',
    ev: [
      ...guardEv(a, 'withApi'),
      a.h('authorization', "auth: { required: true, minRole: 'officer' },"),
      a.h('tenantScope', 'const engines = cognitionRegistry.all();'),
      a.h('mutation', 'const status: \'ok\' | \'degraded\' = missingDomains.length === 0 ? \'ok\' : \'degraded\';'),
      a.h('behavior', 'checkedAt: new Date().toISOString(),'),
    ],
    def: ['DEF-0B5-COGNITION-HEALTH-PLATFORM-POSTURE-TO-ORG-OFFICER'],
  }),
}

export function cognitionFacts(a) {
  const make = FACTS[`${a.route}|${a.method}`]
  if (!make) throw new Error(`no Gate 0B.5 cognition facts for ${a.route}|${a.method}`)
  return make(a)
}
