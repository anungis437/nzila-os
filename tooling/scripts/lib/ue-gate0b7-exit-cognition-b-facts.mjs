/**
 * Gate 0B.7 facts for the exit-interview derived-analytics routes, second half (20 GET operations):
 * learning-trajectories, maturity-personalities, mitigation-effectiveness, multi-domain-cognition, operating-rhythms,
 * operational-coordination, operational-trust, organizational-cognition, organizational-learning,
 * organizational-narratives, organizational-precedent, procedural-continuity, propagation, resilience-habits,
 * resilience-index, resilience-roadmap, response-elasticity, succession, systems-dynamics and topic-graph.
 *
 * Fourteen of the routes are `cognitionRoute(engine)`: a withApi officer floor with the union_knowledge_suite
 * entitlement around an engine that reads ue_cognition_memory (FORCE RLS, organization from the session) and wraps its
 * result in an explainability envelope. Two of those engines (institutional precedent, procedural continuity) return
 * constant text, and most of the rest turn the number of officer-typed memory entries into scores beside literal
 * constants. Six routes are hand-written: the two aggregators over all 28 engines, the topic graph, the dependency
 * propagation map and the resilience index, which read published exit interviews of every sensitivity level, and the
 * succession report, which also sends those interviews to a model.
 *
 * None of these engines writes a local file: DEF-0B5-COGNITION-SNAPSHOTS-IN-LOCAL-FILES concerns the grievance
 * cognition engines and does not apply here, so it is not repeated. This module creates no capability; it references
 * UE-OMIT-EXIT-INTERVIEW-COGNITION-ANALYTICS (created by exit-cognition-a) and UE-OMIT-AI-ADVISORY-GOVERNANCE.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { reachableFiles } from './ue-gate0b4-provenance.mjs'

let readFile = null
const fileExists = (file) => { try { readFile(file); return true } catch { return false } }

/**
 * Service evidence only counts when the route reaches the file within four import hops. A statement from a deeper file
 * (the organizational-dynamics engines, org-scope, consent-controls) is proved by group evidence instead, so it is
 * dropped from the operation record rather than cited from code the route does not provably run.
 */
const svcR = (a, claim, file, pattern, symbol) => (
  reachableFiles(a.routeFile, readFile, fileExists, 4).has(file) ? a.svc(claim, file, pattern, symbol) : null
)

const ANALYTICS = 'UE-OMIT-EXIT-INTERVIEW-COGNITION-ANALYTICS'
const AI_GOV = 'UE-OMIT-AI-ADVISORY-GOVERNANCE'
const GATE = 14

const KT = `${APP}lib/knowledge-transfer/`
const DYN = `${APP}lib/organizational-dynamics/`
const MDC = `${APP}lib/multi-domain-cognition/`
const COGNITION_ROUTE = `${APP}lib/api/cognition-route.ts`
const FOUNDATIONAL = `${APP}lib/organizational-operating-intelligence/kernel-bridge-foundational.ts`
const BRIDGE = `${APP}lib/organizational-operating-intelligence/kernel-bridge.ts`
const OOI_INDEX = `${APP}lib/organizational-operating-intelligence/index.ts`
const MEMORY_STORE = `${KT}cognition-memory/memory-store.ts`
const ORG_SCOPE = `${KT}org-scope.ts`
const MEMORY_RLS = `${APP}db/migrations-cache/0018_knowledge_transfer_rls_closure.sql`
const MEMORY_TABLE = `${APP}db/migrations-platform/0012_knowledge_transfer_runtime_relations.sql`
const INTERVIEW_SCHEMA = `${APP}db/schema/domains/infrastructure/exit-interviews.ts`
const CONSENT = `${KT}governance/consent-controls.ts`
const PKG = 'packages/organizational-cognition-core/src/'
const ORCHESTRATION = `${PKG}orchestration/index.ts`
const SDK = `${PKG}sdk/index.ts`
const NARRATIVES = `${APP}lib/organizational-narratives/index.ts`
const SUMMARIZE_ROUTE = `${APP}app/api/exit-interviews/[id]/summarize/route.ts`
const COCKPIT = `${APP}components/knowledge-transfer/continuity-intelligence-cockpit.tsx`
const TOPIC_VIZ = `${APP}components/knowledge-transfer/topic-graph/topic-graph-viz.tsx`
const OPERATING_WORKSPACE = `${APP}components/knowledge-transfer/institutional-operating-intelligence/operating-intelligence-workspace.tsx`
const ROUTE_DIR = `${APP}app/api/exit-interviews/`

const ev = (ref, quote) => ({ kind: 'file', ref, quote })
const D = (id, severity, ownerCapabilityId, title, releaseDisposition) => ({
  id, gate: GATE, severity, title, ownerCapabilityId, ...(releaseDisposition ? { releaseDisposition } : {}),
})

const AUDIENCE_DECISION = 'UE-INST-EXIT-INTERVIEW-DERIVED-ANALYTICS-AUDIENCE'
const MODEL_DECISION = 'UE-INST-EXIT-INTERVIEW-MODEL-PROCESSING-CONSENT'

export const DECISIONS = [
  {
    id: AUDIENCE_DECISION,
    status: 'OUTSTANDING',
    question: 'Which offices may read topic graphs, expertise and dependency analyses, resilience indexes and succession reports computed from exit interviews, and does a derived figure or label inherit the reader floor of the most sensitive interview it was computed from?',
    sourceState: 'Reading an interview is gated by its sensitivity level (public_internal member, restricted steward, privileged officer, legal_sensitive and executive_confidential admin), but the derived routes read every published interview whatever its level: the topic graph and the propagation map answer a steward, the resilience index, roadmap, succession report and the two aggregators answer an officer. No source states whether a topic label, role or count computed from an admin-only interview may be shown below admin.',
    softwareOwners: [ANALYTICS],
  },
  {
    id: MODEL_DECISION,
    status: 'OUTSTANDING',
    question: 'May exit-interview content (titles, topics, risk flags, roles and years of service) be sent to a model provider for an organization-wide analysis, which sensitivity levels are excluded, and does retiree consent or an office approval have to exist first?',
    sourceState: 'Consent is recorded per interview and consent-controls applies it only to semantic indexing and to publishing a legal_sensitive interview; the interview summarize route applies the sensitivity floor before it calls a model, and the succession report applies neither the sensitivity floor nor consent before it sends every published interview to the model. No source names who decides what may leave the organization.',
    softwareOwners: [AI_GOV, ANALYTICS],
  },
]

/* -------------------------------------------------------------------------- */
/* Defects                                                                     */
/* -------------------------------------------------------------------------- */

const SENSITIVITY_CONDITION = 'An organization holding the union_knowledge_suite entitlement has published an exit interview classified privileged, legal_sensitive or executive_confidential, and a steward (topic graph, propagation) or an officer (succession, aggregators) calls the route: the text of that interview is then reflected to a reader below the role the interview requires.'

export const DEFECTS = [
  D('DEF-0B7-COGB-SUCCESSION-SENDS-EVERY-PUBLISHED-INTERVIEW-TO-MODEL-IGNORING-SENSITIVITY', 'HIGH', AI_GOV,
    'The succession GET reads every published exit interview of the organization whatever its sensitivity level or consent flag, builds a prompt from each role, years of service, title, topics and risk flags, sends it to the model provider on every call, and returns the model text (gaps, priorities, recommendations, executive summary) to any officer, while the sibling summarize route refuses an interview unless the caller holds the role its sensitivity level requires (admin for legal_sensitive and executive_confidential).', {
      disposition: 'CONDITIONALLY_BLOCKING',
      actualExposure: 'An officer of an organization that holds the union_knowledge_suite entitlement calls GET succession (the continuity cockpit does so on load): every published interview, including those classified privileged, legal_sensitive and executive_confidential, is sent to the model provider and summarized back to the officer, below the admin floor that the summarize route applies to the same interviews.',
      potentialImpact: {
        classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
        description: 'Titles, topics, risk flags, roles and years of service of departing members and officers, including legal-sensitive and executive-confidential interviews, leave the organization for a model provider and come back as prose that an officer who could not read those interviews can read.',
      },
      activationState: 'REACHABLE_ENTITLEMENT_GATED',
      activationEvidence: [
        { ref: `${ROUTE_DIR}succession/route.ts`, quote: "auth: { required: true, minRole: 'officer' }," },
        { ref: `${ROUTE_DIR}succession/route.ts`, quote: "entitlement: 'union_knowledge_suite'," },
        { ref: COCKPIT, quote: "const res = await fetch('/api/exit-interviews/succession', { cache: 'no-store' });" },
      ],
      existingContainment: {
        summary: 'Only published interviews are read, the caller must be an officer in an organization that holds the union_knowledge_suite entitlement, and the prompt carries no retiring employee name or key lessons; nothing restricts the interviews by sensitivity level or consent.',
        evidence: [
          { ref: `${KT}succession/succession-analyzer.ts`, quote: "eq(exitInterviews.status, 'published')," },
          { ref: `${KT}succession/succession-analyzer.ts`, quote: '`[${i.roleInUnion}, ${i.yearsOfService}y] ${i.title}\\n` +' },
        ],
      },
      blockingCondition: SENSITIVITY_CONDITION,
      justification: 'The route is live behind an officer floor and an entitlement, so the harm needs an organization with the entitlement and an interview published at a restricted level; where that is true the disclosure is complete (every such interview, every call), reaches an external processor and an under-privileged reader, and nothing in the route stops it, so release is blocked for such an organization until the sensitivity floor is applied before the model call.',
    }),
  D('DEF-0B7-COGB-SUCCESSION-CALL-NOT-AUDITED-AND-RUNS-ON-EVERY-GET', 'MEDIUM', AI_GOV,
    'The succession GET wraps the provider call in no audit record (no performAuditedOperation, persistAtomicAudit or auditLog, unlike the summarize route), caches nothing and sets no route rate limit, so each page load of the cockpit sends the full published-interview prompt to the model again, only the default organization limit of 1200 requests per 5 minutes applies, and no record shows who triggered which disclosure.'),
  D('DEF-0B7-COGB-SUCCESSION-MODEL-OUTPUT-UNVALIDATED-AND-PARSE-FAILURE-SWALLOWED', 'MEDIUM', AI_GOV,
    'The model reply is parsed with JSON.parse and cast to the report shape with no schema check, so its five fields are returned verbatim whatever their type or content (the prompt alone forbids naming individuals), nothing in the response marks them as model-generated, and a parse failure is swallowed into an HTTP 200 with empty gap lists and a canned executive summary instead of an error.'),
  D('DEF-0B7-COGB-SUCCESSION-READINESS-SCORE-COUNTS-EXIT-INTERVIEWS-AS-SUCCESSOR-READINESS', 'MEDIUM', ANALYTICS,
    'The succession report scores readiness from how many published exit interviews exist for each of five fixed roles, not from any successor, handover or documentation record: an organization with no interviews scores 50 of 100, a role is "adequate" with two interviews and no stored risk score (average risk 0), "minimal" with one high-risk interview, roles outside the five are skipped, and more departures therefore raise the readiness shown.'),
  D('DEF-0B7-COGB-DERIVED-GRAPHS-IGNORE-INTERVIEW-SENSITIVITY', 'HIGH', ANALYTICS,
    'The topic graph and the propagation map select every published exit interview of the organization with no sensitivity-level or consent condition and return each interview topic and expertise tag as a node label with the contributing roles, so a steward (and an officer through the aggregator) reads the topic text and role of interviews classified legal_sensitive or executive_confidential that the interview routes release only to an admin; only the AI search route applies the readable-levels filter.', {
      disposition: 'CONDITIONALLY_BLOCKING',
      actualExposure: 'A steward of an organization holding the union_knowledge_suite entitlement calls GET topic-graph or propagation (the topic-graph and simulation screens do): every topic and expertise tag of every published interview, with the roles that contributed it and a single-source flag, comes back whatever the interview sensitivity level, and an officer receives the same payloads through organizational-cognition.',
      potentialImpact: {
        classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
        description: 'Topic and expertise tags of legal-sensitive and executive-confidential interviews, with the role of the departing person and a flag that the knowledge sits with one source, are readable by stewards and officers who may not read the interview, which can reveal what a restricted interview is about and who it concerns.',
      },
      activationState: 'REACHABLE_ENTITLEMENT_GATED',
      activationEvidence: [
        { ref: `${ROUTE_DIR}topic-graph/route.ts`, quote: "auth: { required: true, minRole: 'steward' }," },
        { ref: `${ROUTE_DIR}propagation/route.ts`, quote: "auth: { required: true, minRole: 'steward' }," },
        { ref: TOPIC_VIZ, quote: "const res = await fetch('/api/exit-interviews/topic-graph', { cache: 'no-store' });" },
      ],
      existingContainment: {
        summary: 'Only published interviews are read and the caller must hold the steward role and the union_knowledge_suite entitlement; the output is tags and counts, not interview text, and nothing restricts it by sensitivity level.',
        evidence: [
          { ref: `${KT}topic-graph/topic-graph-builder.ts`, quote: 'eq(exitInterviews.status, \'published\'),' },
          { ref: CONSENT, quote: "legal_sensitive: 'admin'," },
        ],
      },
      blockingCondition: SENSITIVITY_CONDITION,
      justification: 'The harm needs the entitlement and an interview published at a restricted level; where both hold, any steward reads the topics and roles of interviews that the interview routes reserve for officers or admins on every call, and the route has no sensitivity check to limit it, so release is blocked for such an organization until derived output follows the interview sensitivity floor.',
    }),
  D('DEF-0B7-COGB-INTERVIEW-DERIVED-ROLE-OUTPUT-IDENTIFIES-SINGLE-DEPARTING-PERSON', 'MEDIUM', ANALYTICS,
    'The topic graph, propagation map and succession report return roles, years of service, risk scores and single-source flags with no minimum cohort size and no labor-safety assertion (the routes bypass the engine wrapper): a topic or role that comes from one published interview names the contributing role of that one departing person, and the succession role row for a role with one interview carries that person years of service and risk score.'),
  D('DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE', 'MEDIUM', ANALYTICS,
    'The propagation map treats two tags that appear together in two interviews as a dependency whose direction is whichever tag has the lower interview count, marks a tag in one interview as a sole expert whose loss "would create compliance gap", and derives path impact, exposure and recovery weeks from fixed formulas, so inferred statements about dependency, sole ownership and recovery time are returned as findings with no record of an actual process, system or owner.'),
  D('DEF-0B7-COGB-TOPIC-CATEGORY-BY-SUBSTRING-DRIVES-CRITICAL-SENSITIVITY', 'LOW', ANALYTICS,
    'Topic categories are assigned by substring match of free-text tags against keyword lists in a fixed order (for example the three-letter compliance keyword esa matches inside any tag containing those letters), and a tag seen in one interview whose category comes out governance or compliance is marked critical sensitivity, so unrelated tags can raise critical bottleneck findings.'),
  D('DEF-0B7-COGB-PROPAGATION-UNKNOWN-NODE-ANSWERS-500-AND-ANALYSIS-TYPE-NOT-VALIDATED', 'LOW', ANALYTICS,
    'An unknown nodeId makes the propagation handler throw a plain Error that withApi answers as an unexpected 500 instead of a 404, nodeId and analysisType are read from the query with no schema, an unrecognised analysisType (and coupling) silently returns the full map, and a nodeId answers a node view whatever analysisType says.'),
  D('DEF-0B7-COGB-INTERVIEW-READS-UNBOUNDED', 'LOW', ANALYTICS,
    'The topic graph, propagation map, resilience index and succession analyzer select every published exit interview of the organization with no limit, the topic graph builds a pair edge for every two tags of each interview, and the succession prompt concatenates every interview, so the cost and the model prompt grow without bound with the interview count.'),
  D('DEF-0B7-COGB-EMPTY-ORGANIZATION-RESILIENCE-INDEX-DIVIDES-BY-ZERO-AND-REPORTS-STRONG', 'MEDIUM', ANALYTICS,
    'For an organization with no published interview the resilience index divides by the zero node count: the knowledge-redundancy, documentation and governance scores are NaN (null in the JSON), statusFromScore(NaN) answers strong for those dimensions and for the overall status, and the resilience roadmap built on it prints "strong continuity maturity (NaN/100)", projects NaN, and recommends no documentation strategy.'),
  D('DEF-0B7-COGB-RESILIENCE-INDEX-TREND-AND-DOCUMENTATION-QUALITY-ARE-HEURISTIC-LABELS', 'MEDIUM', ANALYTICS,
    'The index trend is stable or degrading from one snapshot (single-source nodes over 40 percent of nodes) and can never be improving, the "Estimated doc quality" component is 25, 50 or 75 from the interview count alone, and the maturity level and status are label cut-offs on a score built from node counts, yet the response presents them as a trend, a quality estimate and a maturity assessment.'),
  D('DEF-0B7-COGB-ROADMAP-DOCUMENTATION-RULE-PRECEDENCE-AND-CONSTANT-PROJECTED-GAINS', 'MEDIUM', ANALYTICS,
    'The roadmap tests the documentation dimension with `score ?? 0 < 65`, which returns the score itself, so the documentation strategy is recommended for every non-zero score (including 100) and not for a score of 0, and the projected resilience, governance and dependency gains of each strategy are literal numbers from a per-strategy table (for example 18, 10 and 15) summed into a projected score, not a model of this organization.'),
  D('DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY', 'MEDIUM', ANALYTICS,
    'Every engine adapter passes a fixed confidence score of 60 (the foundational adapter hard-codes it, the dynamics adapter defaults to it and no engine supplies a payload-based score) and supplies no evidence, reasoning, assumptions or governance implications, so the explainability block of each response reports moderate confidence with empty evidence and reasoning whatever the data, including an organization with no memory entries, and the labor-safety assertion is called with a literal organizational scope that cannot fail.'),
  D('DEF-0B7-COGB-MEMORY-ENGINES-RESTATE-OFFICER-TYPED-ENTRIES-AS-MEASURED-CONDITION', 'MEDIUM', ANALYTICS,
    'The memory-based engines compute only from ue_cognition_memory rows that an officer creates through POST cognition-memory with a self-declared memory type and an optional self-declared resilience score between 0 and 100 (saveCognitionMemory has that one caller), so trajectory, learning, personality, habit, mitigation, dynamics and coordination results restate typed entries and typed numbers as measured organizational condition, and a score absent from an entry removes it from the timeline.'),
  D('DEF-0B7-COGB-DYNAMICS-ENGINES-EMBED-LITERAL-NUMBERS-AND-CLAIMS-AS-MEASUREMENTS', 'MEDIUM', ANALYTICS,
    'The systems-dynamics, operational-coordination, operating-rhythms, multi-domain-cognition and operational-trust engines write literal values into their profiles that depend on no stored record (consistency 50 and 60, stabilization signal confidence 75 and 70, coordination frequency 70 and 50, response times of 5, 7 and 3 days, adherence 75, variance 30, stabilization 14 days, integration scores 50 to 70, reasoning-chain confidence 70 and 65, fixed trust indicators such as Reliable mitigation execution), so a reader cannot tell a measured field from a constant.'),
  D('DEF-0B7-COGB-ENTRY-COUNT-PROXIES-LABELLED-AS-COORDINATION-RHYTHM-ELASTICITY-AND-TRUST', 'MEDIUM', ANALYTICS,
    'Coordination efficiency, rhythm stability and predictability, systems velocity and governance stabilization are the number of memory entries divided by 30, trust is that number divided by 20, rhythm frequency is weekly at 12 governance entries whatever their dates, adaptationsPerYear is a plain count, mitigation cycle days is 90 divided by the mitigation count, and elasticity indicators are the share of each typed category, so adding rows raises the figure and none of them observes coordination, cadence, recovery or trust.'),
  D('DEF-0B7-COGB-OPERATIONAL-TRUST-OUT-OF-RANGE-AND-MODERATE-WITH-NO-DATA', 'MEDIUM', ANALYTICS,
    'The operational-trust engine derives all four trust figures from the entry count, subtracting 5 for follow-through (negative with no entries) and adding 5 for mitigation execution (105 from 20 entries), always lists "Consistent governance behavior", "Reliable mitigation execution" and "Stable accountability" as indicators, and states "moderate operational trust" for an organization with no entries at all.'),
  D('DEF-0B7-COGB-PRECEDENT-AND-PROCEDURAL-ENGINES-RETURN-CONSTANT-CONTENT-AS-ORGANIZATION-ANALYSIS', 'HIGH', ANALYTICS,
    'The institutional-precedent and procedural-continuity engines return the same literal profile for every organization (recurring precedents Governance protocols, Continuity procedures and Mitigation patterns; precedent chains with impact 75 and 60; fragility score 45, redundancy 50, procedure resilience 55, continuity risk moderate), reading ue_cognition_memory only to print an entry count and to set undocumented_processes to the count divided by 10, yet both are wrapped in an explainability envelope as analysis of the organization own records and shown on the operating-intelligence screen.', {
      disposition: 'RELEASE_BLOCKING',
      actualExposure: 'An officer of any organization holding the union_knowledge_suite entitlement receives the same fixed precedent and procedural-fragility profile whatever that organization has recorded, directly from the two routes and through organizational-cognition, which the operating-intelligence workspace reads and displays as procedural and precedent panels.',
      potentialImpact: {
        classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'DATA_QUALITY'],
        description: 'A union officer is shown a fragility score, a continuity-risk level, recurring precedents and precedent chains as findings about the union own procedures and decisions when they are constants, which can steer continuity planning and governance reviews with no basis in the union records.',
      },
      activationState: 'REACHABLE_ENTITLEMENT_GATED',
      activationEvidence: [
        { ref: COGNITION_ROUTE, quote: "auth: { required: true, minRole: 'officer' }," },
        { ref: COGNITION_ROUTE, quote: "entitlement: 'union_knowledge_suite'," },
        { ref: OPERATING_WORKSPACE, quote: "procedural: payloadOf('procedural-continuity')," },
      ],
      existingContainment: 'NONE',
      justification: 'The constants are returned on every call with no data dependence, wrapped as an explainability envelope with moderate confidence, and displayed in a screen that fetches them; the only limits are the officer floor and the entitlement, which restrict who is misled but not whether the content is real, so a union that buys the module is told invented findings and release is blocked until the engines compute from records or are removed from the surface.',
    }),
  D('DEF-0B7-COGB-PERSONALITY-LABEL-ASSIGNED-FROM-ABSENCE-OF-DATA', 'MEDIUM', ANALYTICS,
    'The governance personality engine returns the type Resilience-Fragile (with the identity statement "This organization operates as a Resilience-Fragile institution" and a strategic focus) whenever fewer than two entries and sessions exist, so an organization that has simply not recorded anything is characterized with a named personality instead of insufficient data, and every other dimension score is a weighted count of the typed entries.'),
  D('DEF-0B7-COGB-MITIGATION-EFFECTIVENESS-ATTRIBUTES-NEXT-SCORE-TO-INTERVENTION', 'MEDIUM', ANALYTICS,
    'Mitigation effectiveness rates an intervention by the difference between its typed score and the score of the next later entry of any type that carries one, with no limit on the interval (daysToObservableEffect can be months), no control for other entries, and a resilienceRoi, so a score change is presented as the effect of the mitigation and rated highly_effective, ineffective or counterproductive.'),
  D('DEF-0B7-COGB-LEARNING-TRAJECTORY-FORECAST-EXTRAPOLATES-TWO-TYPED-SCORES', 'MEDIUM', ANALYTICS,
    'The learning trajectory forecast extrapolates linearly from the first and last typed scores with a momentum multiplier, from as few as two points, and attaches a confidence range of plus or minus min(3 per month, 20) that is a literal formula rather than an interval from the data, then estimates months to the next maturity milestone from it, so a forecast with no statistical basis is presented with a confidence range.'),
  D('DEF-0B7-COGB-AGGREGATE-ERRORS-RETURNED-VERBATIM-IN-HTTP-200', 'LOW', ANALYTICS,
    'The orchestrator isolates a failing engine into a failures list carrying the raw exception message, and both aggregator routes return that list inside an HTTP 200 body, so a database or provider error text reaches the client and a response with missing engines is a success.'),
  D('DEF-0B7-COGB-AGGREGATE-RUNS-28-ENGINES-PER-REQUEST-UNCACHED', 'LOW', ANALYTICS,
    'Each call to the two aggregator routes runs all 28 engines (17 foundational and 11 dynamics) in parallel, and most of them each reload cognition memory or the published-interview graph for the same organization, with no cache of the envelopes and no route rate limit beyond the default organization limit, so one request multiplies into dozens of tenant transactions.'),
  D('DEF-0B7-COGB-NARRATIVES-CITE-ZERO-EVIDENCE-AS-DERIVED-FROM-EVIDENCE', 'MEDIUM', ANALYTICS,
    'The narrative route states that each narrative is derived from institutional evidence at a confidence band, but the envelopes carry no evidence, reasoning or governance implication, so every summary reads "Derived from 0 institutional evidence items with moderate confidence", the headline is the first sentence of fixed interpretation guidance, key reasoning and review signals are empty, and the executive briefing ranking sees identical scores for every engine.'),
]

/* -------------------------------------------------------------------------- */
/* Groups                                                                      */
/* -------------------------------------------------------------------------- */

const routeFile = (name) => `exit-interviews/${name}/route.ts`
const names = (list) => list.map(routeFile)

const MEMORY_REAL = ['learning-trajectories', 'maturity-personalities', 'mitigation-effectiveness', 'organizational-learning', 'resilience-habits']
const MEMORY_PROXY = ['systems-dynamics', 'operational-coordination', 'operating-rhythms', 'response-elasticity', 'multi-domain-cognition', 'operational-trust']
const STATIC = ['organizational-precedent', 'procedural-continuity']
const AGGREGATE = ['organizational-cognition', 'organizational-narratives']
const INTERVIEW_GRAPH = ['topic-graph', 'propagation']
const RESILIENCE = ['resilience-index', 'resilience-roadmap']

export const ROUTES = new Set(names([...MEMORY_REAL, ...MEMORY_PROXY, ...STATIC, ...AGGREGATE, ...INTERVIEW_GRAPH, ...RESILIENCE, 'succession']))

const group = (capabilityId, domain, actor, routes, evidence) => ({ capabilityId, domain, actor, routes: names(routes), evidence })

export const GROUPS = {
  COG_B_MEMORY_HISTORY_PROFILES: group(ANALYTICS, 'EXIT_COGNITION_MEMORY_HISTORY_PROFILES',
    'Officer reading organization-level learning, trajectory, personality, habit and mitigation profiles computed from the cognition memory entries officers have recorded',
    MEMORY_REAL, [
      ev(COGNITION_ROUTE, 'export function cognitionRoute<T>(engine: CognitionEngineFn<T>) {'),
      ev(MEMORY_STORE, 'export async function loadCognitionMemory('),
      ev(FOUNDATIONAL, 'export const learningTrajectoryEngine = defineFoundationalEngine({'),
    ]),
  COG_B_MEMORY_COUNT_DYNAMICS: group(ANALYTICS, 'EXIT_COGNITION_MEMORY_COUNT_DYNAMICS',
    'Officer reading systems-dynamics, coordination, rhythm, elasticity, multi-domain and trust profiles that the engines derive from the count and type of recorded cognition memory entries',
    MEMORY_PROXY, [
      ev(BRIDGE, 'export const systemsDynamicsEngine = adaptLegacyEngine<SystemsDynamicsProfile>({'),
      ev(BRIDGE, 'export const ADVANCED_ORCHESTRATION_STEPS = ['),
      ev(MEMORY_STORE, 'export async function loadCognitionMemory('),
      ev(ORG_SCOPE, 'return withRLSContext({ organizationId }, operation);'),
      ev(`${DYN}systems-dynamics/systems-engine.ts`, 'consistency: 50,'),
      ev(`${DYN}systems-dynamics/systems-engine.ts`, 'velocity: Math.min(100, (totalEntries / 30) * 100),'),
      ev(`${DYN}operational-coordination/coordination-engine.ts`, 'const efficiency = Math.min(100, (totalEntries / 30) * 100);'),
      ev(`${DYN}operational-coordination/coordination-engine.ts`, 'governanceResponseTime: 5,'),
      ev(`${DYN}rhythms/rhythms-engine.ts`, 'adherence: 75,'),
      ev(`${DYN}rhythms/rhythms-engine.ts`, 'adaptationsPerYear: mitCount + contCount,'),
      ev(`${DYN}elasticity/elasticity-engine.ts`, 'const responsiveness = Math.min(100, (respCount / Math.max(1, totalEntries)) * 200);'),
    ]),
  COG_B_CONSTANT_PROFILES: group(ANALYTICS, 'EXIT_COGNITION_CONSTANT_PROFILES',
    'Officer reading institutional precedent and procedural continuity profiles that the engines return as fixed content',
    STATIC, [
      ev(`${MDC}precedent-intelligence/index.ts`, 'export async function analyzeInstitutionalPrecedent(organizationId: string): Promise<InstitutionalPrecedentProfile> {'),
      ev(`${MDC}procedural-intelligence/index.ts`, 'export async function analyzeProcedualContinuity(organizationId: string): Promise<ProceduralContinuityProfile> {'),
    ]),
  COG_B_AGGREGATE_ORCHESTRATION: group(ANALYTICS, 'EXIT_COGNITION_AGGREGATE_ORCHESTRATION',
    'Officer opening the institutional operating-intelligence workspace or executive briefing that runs every cognition engine for the organization',
    AGGREGATE, [
      ev(OOI_INDEX, 'export async function runFullInstitutionalCognition('),
      ev(OOI_INDEX, 'export const ALL_ORCHESTRATION_STEPS = ['),
      ev(NARRATIVES, 'export function narrateEnvelopes('),
    ]),
  COG_B_INTERVIEW_KNOWLEDGE_GRAPH: group(ANALYTICS, 'EXIT_COGNITION_INTERVIEW_KNOWLEDGE_GRAPH',
    'Steward reading the topic graph and dependency propagation map computed from the organization published exit interviews',
    INTERVIEW_GRAPH, [
      ev(`${KT}topic-graph/topic-graph-builder.ts`, 'export async function buildTopicGraph(orgId: string): Promise<TopicGraph> {'),
      ev(`${KT}propagation/dependency-propagator.ts`, 'export async function buildDependencyPropagationMap(orgId: string): Promise<PropagationMap> {'),
      ev(CONSENT, "legal_sensitive: 'admin',"),
    ]),
  COG_B_RESILIENCE_SCORING: group(ANALYTICS, 'EXIT_COGNITION_RESILIENCE_SCORING',
    'Officer reading the organizational resilience index and the resilience roadmap computed from the published exit interviews',
    RESILIENCE, [
      ev(`${KT}resilience-index/resilience-calculator.ts`, 'export async function calculateResilienceIndex(orgId: string): Promise<OrganizationalResilienceIndex> {'),
      ev(`${KT}resilience-strategies/strategy-modeler.ts`, 'export async function buildResilienceRoadmap(orgId: string): Promise<ResilienceRoadmap> {'),
    ]),
  COG_B_SUCCESSION_MODEL_REPORT: group(AI_GOV, 'EXIT_COGNITION_SUCCESSION_MODEL_REPORT',
    'Officer opening the continuity cockpit succession report that a model writes from the published exit interviews',
    ['succession'], [
      ev(`${KT}succession/succession-analyzer.ts`, 'export async function analyzeSuccessionFragility(orgId: string): Promise<SuccessionFragilityReport> {'),
      ev(`${KT}succession/succession-analyzer.ts`, 'const result = await ai.generate({'),
      ev(CONSENT, "legal_sensitive: 'admin',"),
      ev(SUMMARIZE_ROUTE, 'const minRole = SENSITIVITY_MIN_ROLE[interview.sensitivityLevel as keyof typeof SENSITIVITY_MIN_ROLE];'),
    ]),
}

/* -------------------------------------------------------------------------- */
/* Shared texts                                                                */
/* -------------------------------------------------------------------------- */

const COGNITION_AUTHZ = "withApi minRole officer plus the union_knowledge_suite entitlement (requireEntitlement for the session organization), both set inside cognitionRoute; no sensitivity-level check, no kernel decision and no per-engine role. The engine runs only after both checks pass."
const MEMORY_TENANT = 'organizationId is the session-resolved organization of the withApi context and is the engine only argument; no query or body parameter selects an organization. The engine reads ue_cognition_memory through inOrganization (withRLSContext with app.current_org_id bound) with organization_id = orgId, a FORCE RLS table (0018); nothing is read across organizations.'
const NO_WRITE = 'The handler and the engine write no row and no audit record; the only trace of a read is the request log.'
const ROUTE_AUDIT = 'Reads of organization-level derived analyses are not audited; add an audit event naming the caller, the engine and the entry window once the readers of derived exit-interview analysis are decided.'
const MEMORY_SENS = 'Counts and typed scores of the organization cognition memory entries (decision briefs, mitigation comparisons, governance reasoning, continuity assessments, resilience baselines) summarized as organization-level profiles; the entries themselves are not returned'

const memoryEntryEv = (a) => [
  svcR(a, 'behavior', MEMORY_STORE, 'WHERE organization_id = ${orgId}', 'loadCognitionMemory'),
  svcR(a, 'tenantScope', MEMORY_STORE, 'const rows = await inOrganization(orgId, (tx) =>', 'loadCognitionMemory'),
  svcR(a, 'tenantScope', ORG_SCOPE, 'return withRLSContext({ organizationId }, operation);', 'inOrganization'),
  a.sch('tenantScope', MEMORY_RLS, "SELECT ue_create_direct_org_rls_policy('ue_cognition_memory');"),
  a.sch('privacy', MEMORY_TABLE, 'resilience_score_at_capture integer,'),
]

const cognitionGuardEv = (a, engineSymbol, enginePattern) => [
  a.h('behavior', `cognitionRoute(${engineSymbol})`),
  a.imp('authentication', 'cognitionRoute', "auth: { required: true, minRole: 'officer' },"),
  a.imp('authorization', 'cognitionRoute', "auth: { required: true, minRole: 'officer' },"),
  a.imp('authorization', 'cognitionRoute', "entitlement: 'union_knowledge_suite',"),
  a.imp('tenantScope', 'cognitionRoute', 'const envelope = await engine(organizationId!);'),
  a.imp('mutation', 'cognitionRoute', 'data: payload,'),
  a.imp('behavior', engineSymbol, enginePattern),
]

const envelopeDefectEv = (a, foundational) => [
  foundational
    ? svcR(a, 'defect', FOUNDATIONAL, 'confidenceScore: 60,', 'defineFoundationalEngine')
    : svcR(a, 'defect', BRIDGE, 'const confidenceScore = input.confidenceFromPayload?.(payload) ?? 60;', 'adaptLegacyEngine'),
  svcR(a, 'defect', SDK, "scopeOfObservation: 'organizational',", 'defineCognitionEngine'),
  svcR(a, 'defect', SDK, 'evidence: result.evidence,', 'defineCognitionEngine'),
]

const envelopeInference = {
  claim: 'defect',
  statement: 'The engine compute function returns only payload, confidenceScore and interpretationGuidance, so buildExplainabilityEnvelope fills evidence, reasoning, assumptions and governanceImplications with empty arrays and confidenceBandFromScore(60) gives the moderate band for every call, including one over zero memory entries.',
}

const memoryInference = {
  claim: 'defect',
  statement: 'saveCognitionMemory has one application caller, the officer POST of cognition-memory, whose schema takes memoryType, title, payload and resilienceScoreAtCapture from the request body; no job, engine or workflow writes an entry, so every input of this engine is something an officer typed.',
}

const baseCognition = (a, spec) => mk({
  service: spec.service,
  persona: spec.persona ?? 'Union officer (or higher role) of an organization with the union_knowledge_suite entitlement reading an organization-level derived profile',
  authn: SESSION,
  authz: COGNITION_AUTHZ,
  tenant: spec.tenant ?? MEMORY_TENANT,
  owner: spec.owner,
  sens: spec.sens ?? MEMORY_SENS,
  priv: spec.priv,
  mut: 'NOT_MUTATING',
  auditDetail: NO_WRITE,
  reqAudit: ROUTE_AUDIT,
  does: spec.does,
  status: spec.status ?? 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: spec.future,
  dec: [],
  ev: spec.ev,
  inf: spec.inf ?? [],
  def: spec.def,
  corr: [],
})

/* -------------------------------------------------------------------------- */
/* cognitionRoute engines that compute from the memory history                 */
/* -------------------------------------------------------------------------- */

const MEMORY_REAL_SPEC = {
  'learning-trajectories': (a) => baseCognition(a, {
    service: `${KT}learning-trajectories/trajectory-analyzer.ts`,
    owner: 'A computed learning trajectory of the organization: resilience timeline points, momentum, a 3, 6 and 12 month forecast and maturity milestones; nothing is stored.',
    priv: 'The response carries organization-level scores, forecast points and milestone dates derived from entry timestamps and typed scores; no member, grievance or interview content is returned.',
    does: 'Loads up to 100 active cognition memory entries and 50 reasoning sessions of the session organization, builds the resilience timeline from the entries that carry a typed score, labels momentum from the change in each half, extrapolates a 3, 6 and 12 month forecast with a fixed uncertainty range and maturity milestones, and returns it as the envelope payload with a fixed moderate-confidence explainability block.',
    future: 'Derive the timeline from a measured source, return an interval computed from the data (or none) and a confidence band that depends on the number of points, require a minimum history before a forecast, and keep the organization taken from the session.',
    ev: [
      ...cognitionGuardEv(a, 'learningTrajectoryEngine', 'invoke: analyzeLearningTrajectory,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${KT}learning-trajectories/trajectory-analyzer.ts`, 'loadCognitionMemory(orgId, { limit: 100 }),', 'analyzeLearningTrajectory'),
      svcR(a, 'defect', `${KT}learning-trajectories/trajectory-analyzer.ts`, 'const uncertainty = Math.min(months * 3, 20);', 'buildForecast'),
      svcR(a, 'defect', `${KT}learning-trajectories/trajectory-analyzer.ts`, 'if (points.length < 2) return [];', 'buildForecast'),
      ...envelopeDefectEv(a, true),
    ],
    inf: [memoryInference, envelopeInference],
    def: ['DEF-0B7-COGB-LEARNING-TRAJECTORY-FORECAST-EXTRAPOLATES-TWO-TYPED-SCORES', 'DEF-0B7-COGB-MEMORY-ENGINES-RESTATE-OFFICER-TYPED-ENTRIES-AS-MEASURED-CONDITION', 'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY'],
  }),
  'maturity-personalities': (a) => baseCognition(a, {
    service: `${KT}maturity-personalities/personality-profiler.ts`,
    owner: 'A computed governance personality profile of the organization: a personality type, maturity score, five dimension scores and a stability profile; nothing is stored.',
    priv: 'The response names an organization-level personality type, identity statement and strategic focus; it is described as organizational but is derived from entries that officers typed, and it is shown to every officer of the organization.',
    does: 'Loads up to 100 cognition memory entries and 50 reasoning sessions of the session organization, counts governance and mitigation entries, computes volatility from the typed scores, resolves one of six personality types with a fixed rule order (resilience_fragile when fewer than two interactions exist), scores five dimensions as weighted counts and returns the profile with an identity statement.',
    future: 'Return insufficient data instead of a named personality below a minimum history, state the inputs of each dimension, and name the office that may characterize the organization governance posture.',
    ev: [
      ...cognitionGuardEv(a, 'governancePersonalityEngine', 'invoke: profileGovernancePersonality,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${KT}maturity-personalities/personality-profiler.ts`, 'loadCognitionMemory(orgId, { limit: 100 }),', 'profileGovernancePersonality'),
      svcR(a, 'defect', `${KT}maturity-personalities/personality-profiler.ts`, "if (totalInteractions < 2) return 'resilience_fragile';", 'resolvePersonality'),
      svcR(a, 'defect', `${KT}maturity-personalities/personality-profiler.ts`, 'const identityStatement = `This organization operates as a "${meta.name}" institution', 'profileGovernancePersonality'),
      ...envelopeDefectEv(a, true),
    ],
    inf: [memoryInference, envelopeInference],
    def: ['DEF-0B7-COGB-PERSONALITY-LABEL-ASSIGNED-FROM-ABSENCE-OF-DATA', 'DEF-0B7-COGB-MEMORY-ENGINES-RESTATE-OFFICER-TYPED-ENTRIES-AS-MEASURED-CONDITION', 'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY'],
  }),
  'mitigation-effectiveness': (a) => baseCognition(a, {
    service: `${KT}mitigation-effectiveness/effectiveness-tracker.ts`,
    owner: 'A computed mitigation effectiveness report of the organization: per-intervention before and after score change, a rating, a return figure and a dimension breakdown by tag; nothing is stored.',
    priv: 'The response returns the titles of the organization mitigation comparison and continuity assessment entries, their typed scores and a rating of each as effective or not; no member content is returned.',
    does: 'Loads up to 100 cognition memory entries of the session organization, takes mitigation_comparison and continuity_assessment entries as interventions, pairs each with the next later entry that has a typed score, rates the change from highly_effective to counterproductive, computes an average gain and a tag breakdown and returns an overall rating with a recommendation.',
    future: 'Pair an intervention with a measured outcome in a bounded window or label the change as an association, withhold a rating below a minimum number of pairs, and return the evidence entries behind each rating.',
    ev: [
      ...cognitionGuardEv(a, 'mitigationEffectivenessEngine', 'invoke: trackMitigationEffectiveness,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${KT}mitigation-effectiveness/effectiveness-tracker.ts`, 'const store = await loadCognitionMemory(orgId, { limit: 100 });', 'trackMitigationEffectiveness'),
      svcR(a, 'defect', `${KT}mitigation-effectiveness/effectiveness-tracker.ts`, 'const subsequentBaseline = baselineEntries.find(', 'trackMitigationEffectiveness'),
      svcR(a, 'defect', `${KT}mitigation-effectiveness/effectiveness-tracker.ts`, 'const resilienceRoi = scoreChange > 0 ? Math.round(scoreChange * 10) / 10 : null;', 'trackMitigationEffectiveness'),
      ...envelopeDefectEv(a, true),
    ],
    inf: [memoryInference, envelopeInference],
    def: ['DEF-0B7-COGB-MITIGATION-EFFECTIVENESS-ATTRIBUTES-NEXT-SCORE-TO-INTERVENTION', 'DEF-0B7-COGB-MEMORY-ENGINES-RESTATE-OFFICER-TYPED-ENTRIES-AS-MEASURED-CONDITION', 'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY'],
  }),
  'organizational-learning': (a) => baseCognition(a, {
    service: `${KT}institutional-learning/learning-engine.ts`,
    owner: 'A computed institutional learning report of the organization: resilience evolution, learning insights, a maturity score and stage and a summary; nothing is stored.',
    priv: 'The response returns organization-level insights, scores and evidence data points (titles and typed scores of cognition memory entries); no member, grievance or interview content is returned.',
    does: 'Loads up to 100 cognition memory entries of the session organization, derives the resilience trend, peak, trough and change from the entries that carry a typed score, extracts insight statements (improvement, regression, volatility, mitigation activity, memory depth) with fixed confidence labels, scores maturity and returns the report.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: 'State the inputs and their minimum history for each insight, derive confidence labels from the data, and name the source of the typed scores.',
    ev: [
      ...cognitionGuardEv(a, 'institutionalLearningEngine', 'invoke: analyzeInstitutionalLearning,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${KT}institutional-learning/learning-engine.ts`, 'const store = await loadCognitionMemory(orgId, { limit: 100 });', 'analyzeInstitutionalLearning'),
      svcR(a, 'defect', `${KT}institutional-learning/learning-engine.ts`, "confidence: withScores.length >= 5 ? 'high' : 'medium',", 'extractInsights'),
      ...envelopeDefectEv(a, true),
    ],
    inf: [memoryInference, envelopeInference],
    def: ['DEF-0B7-COGB-MEMORY-ENGINES-RESTATE-OFFICER-TYPED-ENTRIES-AS-MEASURED-CONDITION', 'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY'],
  }),
  'resilience-habits': (a) => baseCognition(a, {
    service: `${KT}resilience-habits/habit-tracker.ts`,
    owner: 'A computed resilience habit profile of the organization: six habit dimension scores, tiers, observations, a consistency score and a narrative; nothing is stored.',
    priv: 'The response describes organization-level habit scores with the counts that produced them; it is framed as organizational engagement, but the underlying events are the entry and session timestamps of the officers who recorded them.',
    does: 'Loads up to 100 cognition memory entries and 50 reasoning sessions of the session organization, scores review cadence from the average days between activity timestamps, mitigation follow-through, documentation discipline, governance responsiveness, continuity planning and resilience assessment from counts, and returns each with a tier, an observation and the evidence counts it used.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: 'Label the scores as measures of recorded activity rather than of habit, bound the window in time, and keep the evidence strings with each dimension.',
    ev: [
      ...cognitionGuardEv(a, 'resilienceHabitsEngine', 'invoke: trackResilienceHabits,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${KT}resilience-habits/habit-tracker.ts`, 'loadCognitionMemory(orgId, { limit: 100 }),', 'trackResilienceHabits'),
      svcR(a, 'behavior', `${KT}resilience-habits/habit-tracker.ts`, 'evidence: `Derived from ${totalInteractions} activity timestamps.`,', 'scoreReviewCadence'),
      ...envelopeDefectEv(a, true),
    ],
    inf: [memoryInference, envelopeInference],
    def: ['DEF-0B7-COGB-MEMORY-ENGINES-RESTATE-OFFICER-TYPED-ENTRIES-AS-MEASURED-CONDITION', 'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY'],
  }),
}

/* -------------------------------------------------------------------------- */
/* cognitionRoute engines built from entry counts and literal constants        */
/* -------------------------------------------------------------------------- */

const PROXY_PRIV = 'The response returns organization-level scores and narrative text; the figures are functions of the count and type of entries an officer recorded and of literal constants, and are presented under names such as coordination, rhythm, elasticity or trust.'
const PROXY_FUTURE = 'Compute each figure from a measured source with stated inputs, remove literal values from the profile or mark them as reference constants, return insufficient data below a minimum history, and supply evidence and a data-dependent confidence band.'
const BASE_PROXY = ['DEF-0B7-COGB-MEMORY-ENGINES-RESTATE-OFFICER-TYPED-ENTRIES-AS-MEASURED-CONDITION', 'DEF-0B7-COGB-ENTRY-COUNT-PROXIES-LABELLED-AS-COORDINATION-RHYTHM-ELASTICITY-AND-TRUST', 'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY']

const MEMORY_PROXY_SPEC = {
  'systems-dynamics': (a) => baseCognition(a, {
    service: `${DYN}systems-dynamics/systems-engine.ts`,
    owner: 'A computed systems dynamics profile of the organization: governance flow pattern, continuity momentum, frictions, inertia, stabilization velocity, coherence indicators, stability signals and an overall systems health figure; nothing is stored.',
    priv: PROXY_PRIV,
    does: 'Loads up to 100 cognition memory entries of the session organization, counts four typed categories, and builds the profile from those counts and literal values (consistency 50 and 60, stabilization signal confidence 75 and 70, average recovery 7 days, frequency 60); an organization with no entries gets a zero profile with an insufficient data narrative, but the envelope still reports moderate confidence.',
    ev: [
      ...cognitionGuardEv(a, 'systemsDynamicsEngine', 'compute: analyzeSystemsDynamics,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${DYN}systems-dynamics/systems-engine.ts`, 'const memory = await loadCognitionMemory(organizationId, { limit: 100 });', 'analyzeSystemsDynamics'),
      svcR(a, 'defect', `${DYN}systems-dynamics/systems-engine.ts`, 'consistency: 50,', 'analyzeSystemsDynamics'),
      svcR(a, 'defect', `${DYN}systems-dynamics/systems-engine.ts`, 'averageRecoveryDays: 7,', 'analyzeSystemsDynamics'),
      svcR(a, 'defect', `${DYN}systems-dynamics/systems-engine.ts`, 'confidence: 75,', 'analyzeSystemsDynamics'),
      svcR(a, 'defect', `${DYN}systems-dynamics/systems-engine.ts`, 'velocity: Math.min(100, (totalEntries / 30) * 100),', 'analyzeSystemsDynamics'),
      ...envelopeDefectEv(a, false),
    ],
    inf: [memoryInference, envelopeInference],
    future: PROXY_FUTURE,
    def: [...BASE_PROXY, 'DEF-0B7-COGB-DYNAMICS-ENGINES-EMBED-LITERAL-NUMBERS-AND-CLAIMS-AS-MEASUREMENTS'],
  }),
  'operational-coordination': (a) => baseCognition(a, {
    service: `${DYN}operational-coordination/coordination-engine.ts`,
    owner: 'A computed operational coordination profile of the organization: a coordination score, bottlenecks, efficiency indicators, a synchronization map with response times and a trajectory; nothing is stored.',
    priv: PROXY_PRIV,
    does: 'Loads up to 100 cognition memory entries of the session organization, counts four typed categories, sets efficiency to the entry count over 30, adds two rule-based bottlenecks with fixed frequencies, and returns response times of 5, 7 and 3 days that are literals; an organization with no entries gets a zero profile, but the envelope still reports moderate confidence.',
    ev: [
      ...cognitionGuardEv(a, 'operationalCoordinationEngine', 'compute: modelCoordinationBehavior,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${DYN}operational-coordination/coordination-engine.ts`, 'const memory = await loadCognitionMemory(organizationId, { limit: 100 });', 'modelCoordinationBehavior'),
      svcR(a, 'defect', `${DYN}operational-coordination/coordination-engine.ts`, 'const efficiency = Math.min(100, (totalEntries / 30) * 100);', 'modelCoordinationBehavior'),
      svcR(a, 'defect', `${DYN}operational-coordination/coordination-engine.ts`, 'governanceResponseTime: 5,', 'modelCoordinationBehavior'),
      svcR(a, 'defect', `${DYN}operational-coordination/coordination-engine.ts`, 'frequency: 70,', 'modelCoordinationBehavior'),
      ...envelopeDefectEv(a, false),
    ],
    inf: [memoryInference, envelopeInference],
    future: PROXY_FUTURE,
    def: [...BASE_PROXY, 'DEF-0B7-COGB-DYNAMICS-ENGINES-EMBED-LITERAL-NUMBERS-AND-CLAIMS-AS-MEASUREMENTS'],
  }),
  'operating-rhythms': (a) => baseCognition(a, {
    service: `${DYN}rhythms/rhythms-engine.ts`,
    owner: 'A computed operating rhythm profile of the organization: governance review frequency, continuity planning cadence, mitigation cycle days, stabilization timing and a stability figure; nothing is stored.',
    priv: PROXY_PRIV,
    does: 'Loads up to 100 cognition memory entries of the session organization, maps the count of governance entries to a frequency (weekly from 12) with no use of their dates, sets adherence 75, variance 30 and stabilization 14 days as literals, derives cycle days as 90 over the mitigation count, and returns rhythm stability as entries over 30; an organization with no entries gets a zero profile, but the envelope still reports moderate confidence.',
    ev: [
      ...cognitionGuardEv(a, 'operatingRhythmsEngine', 'compute: analyzeInstitutionalRhythms,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${DYN}rhythms/rhythms-engine.ts`, 'const memory = await loadCognitionMemory(organizationId, { limit: 100 });', 'analyzeInstitutionalRhythms'),
      svcR(a, 'defect', `${DYN}rhythms/rhythms-engine.ts`, 'if (count >= 12) return \'weekly\';', 'frequencyFromCount'),
      svcR(a, 'defect', `${DYN}rhythms/rhythms-engine.ts`, 'adherence: 75,', 'analyzeInstitutionalRhythms'),
      svcR(a, 'defect', `${DYN}rhythms/rhythms-engine.ts`, 'averageCycleDays: mitCount > 0 ? Math.round(90 / Math.max(1, mitCount)) : 0,', 'analyzeInstitutionalRhythms'),
      svcR(a, 'defect', `${DYN}rhythms/rhythms-engine.ts`, 'adaptationsPerYear: mitCount + contCount,', 'analyzeInstitutionalRhythms'),
      ...envelopeDefectEv(a, false),
    ],
    inf: [memoryInference, envelopeInference],
    future: PROXY_FUTURE,
    def: [...BASE_PROXY, 'DEF-0B7-COGB-DYNAMICS-ENGINES-EMBED-LITERAL-NUMBERS-AND-CLAIMS-AS-MEASUREMENTS'],
  }),
  'response-elasticity': (a) => baseCognition(a, {
    service: `${DYN}elasticity/elasticity-engine.ts`,
    owner: 'A computed response elasticity profile of the organization: four elasticity indicators, an adaptability score, a recovery curve label and a stress response pattern; nothing is stored.',
    priv: PROXY_PRIV,
    does: 'Loads up to 100 cognition memory entries of the session organization and returns four indicators that are each the share of one typed category among all entries (times 2, capped at 100), an adaptability score that is their mean, and recovery curve, stress response and sustainability labels from cut-offs on that score; an organization with no entries gets a zero profile, but the envelope still reports moderate confidence.',
    ev: [
      ...cognitionGuardEv(a, 'responseElasticityEngine', 'compute: measureOrganizationalElasticity,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${DYN}elasticity/elasticity-engine.ts`, 'const memory = await loadCognitionMemory(organizationId, { limit: 100 });', 'measureOrganizationalElasticity'),
      svcR(a, 'defect', `${DYN}elasticity/elasticity-engine.ts`, 'const responsiveness = Math.min(100, (respCount / Math.max(1, totalEntries)) * 200);', 'measureOrganizationalElasticity'),
      svcR(a, 'defect', `${DYN}elasticity/elasticity-engine.ts`, "adaptability >= 70 ? 'Sharp recovery curve' : adaptability >= 40 ? 'Gradual recovery curve' : 'Slow recovery curve',", 'measureOrganizationalElasticity'),
      ...envelopeDefectEv(a, false),
    ],
    inf: [memoryInference, envelopeInference],
    future: PROXY_FUTURE,
    def: BASE_PROXY,
  }),
  'multi-domain-cognition': (a) => baseCognition(a, {
    service: `${MDC}multi-domain-engine.ts`,
    owner: 'A computed multi-domain cognition profile of the organization: eight domain strengths with maturity labels and integration scores, two cross-domain reasoning chains, a cohesion score and narrative text; nothing is stored.',
    priv: PROXY_PRIV,
    does: 'Loads up to 100 cognition memory entries of the session organization, scores eight domains as counts over 8 (or entries over 30), attaches literal integration scores of 50 to 70 and two fixed reasoning chains with confidence 70 and 65 (one asserts "Resilience improves with organizational memory accumulation" for every organization), and has no empty-data branch: an organization with no entries still receives a profile and the same chains.',
    ev: [
      ...cognitionGuardEv(a, 'multiDomainCognitionEngine', 'compute: orchestrateMultiDomainCognition,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${MDC}multi-domain-engine.ts`, 'const memory = await loadCognitionMemory(organizationId, { limit: 100 });', 'orchestrateMultiDomainCognition'),
      svcR(a, 'defect', `${MDC}multi-domain-engine.ts`, 'integrationScore: 60,', 'orchestrateMultiDomainCognition'),
      svcR(a, 'defect', `${MDC}multi-domain-engine.ts`, "synthesizedInsight: 'Resilience improves with organizational memory accumulation.',", 'orchestrateMultiDomainCognition'),
      svcR(a, 'defect', `${MDC}multi-domain-engine.ts`, 'const domainScore = (count: number) => Math.min(100, (count / 8) * 100);', 'orchestrateMultiDomainCognition'),
      ...envelopeDefectEv(a, false),
    ],
    inf: [memoryInference, envelopeInference],
    future: PROXY_FUTURE,
    def: [...BASE_PROXY, 'DEF-0B7-COGB-DYNAMICS-ENGINES-EMBED-LITERAL-NUMBERS-AND-CLAIMS-AS-MEASUREMENTS'],
  }),
  'operational-trust': (a) => baseCognition(a, {
    service: `${MDC}trust-dynamics/index.ts`,
    owner: 'A computed operational trust profile of the organization: four trust figures, fixed indicator strings and a narrative; nothing is stored.',
    priv: 'The response states the organization has strong or moderate operational trust; the figures are the count of recorded entries scaled to 100 and the indicator strings are constants, so the statement describes how many entries exist, not trust between anyone.',
    does: 'Loads up to 100 cognition memory entries of the session organization, sets one trust figure to the entry count over 20 (capped at 100), derives the other three by subtracting or adding 5, returns three fixed indicator strings and the narrative "Organization demonstrates strong/moderate operational trust"; it has no empty-data branch, so an organization with no entries is described as moderate and the follow-through figure is -5.',
    ev: [
      ...cognitionGuardEv(a, 'operationalTrustEngine', 'compute: analyzeOperationalTrust,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${MDC}trust-dynamics/index.ts`, 'const memory = await loadCognitionMemory(organizationId, { limit: 100 });', 'analyzeOperationalTrust'),
      svcR(a, 'defect', `${MDC}trust-dynamics/index.ts`, 'const trustScore = Math.min(100, (memory.totalEntries / 20) * 100);', 'analyzeOperationalTrust'),
      svcR(a, 'defect', `${MDC}trust-dynamics/index.ts`, 'continuity_follow_through_reliability: trustScore - 5,', 'analyzeOperationalTrust'),
      svcR(a, 'defect', `${MDC}trust-dynamics/index.ts`, 'mitigation_execution_trust: trustScore + 5,', 'analyzeOperationalTrust'),
      svcR(a, 'defect', `${MDC}trust-dynamics/index.ts`, "resilience_trust_indicators: ['Consistent governance behavior', 'Reliable mitigation execution', 'Stable accountability'],", 'analyzeOperationalTrust'),
      ...envelopeDefectEv(a, false),
    ],
    inf: [memoryInference, envelopeInference],
    future: PROXY_FUTURE,
    def: [...BASE_PROXY, 'DEF-0B7-COGB-DYNAMICS-ENGINES-EMBED-LITERAL-NUMBERS-AND-CLAIMS-AS-MEASUREMENTS', 'DEF-0B7-COGB-OPERATIONAL-TRUST-OUT-OF-RANGE-AND-MODERATE-WITH-NO-DATA'],
  }),
}

/* -------------------------------------------------------------------------- */
/* cognitionRoute engines that return constant content                         */
/* -------------------------------------------------------------------------- */

const STATIC_SPEC = {
  'organizational-precedent': (a) => baseCognition(a, {
    service: `${MDC}precedent-intelligence/index.ts`,
    persona: 'Union officer (or higher role) of an organization with the union_knowledge_suite entitlement reading what the route presents as the institutional precedent profile of the organization',
    owner: 'No organization data: the profile is a literal object; the only stored value read is the count of cognition memory entries, printed as entriesAnalyzed.',
    sens: 'Fixed precedent names, chains, impact figures and narrative returned as if they were the organization precedent profile; no stored precedent, grievance or decision is read',
    priv: 'The response carries no organization personal data, but it presents constant text such as "Organizational memory shows coherent precedent continuity" as an analysis of this organization precedent.',
    does: 'Loads up to 100 cognition memory entries of the session organization only to report their count, then returns the same literal profile for every organization: recurring precedents (Governance protocols, Continuity procedures, Mitigation patterns), two precedent chains with impact 75 and 60, a decision evolution pattern and reasoning lineage strings, wrapped in an explainability envelope at moderate confidence.',
    status: 'NOT_IMPLEMENTED_RETURNS_200',
    future: 'Compute precedent patterns from stored decisions, grievances or reasoning records with cited evidence, or return 501 until such a computation exists; do not present constants as an organization analysis.',
    ev: [
      ...cognitionGuardEv(a, 'institutionalPrecedentEngine', 'compute: analyzeInstitutionalPrecedent,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${MDC}precedent-intelligence/index.ts`, "const { loadCognitionMemory } = await import('@/lib/knowledge-transfer/cognition-memory');", 'analyzeInstitutionalPrecedent'),
      svcR(a, 'defect', `${MDC}precedent-intelligence/index.ts`, "recurring_precedents: ['Governance protocols', 'Continuity procedures', 'Mitigation patterns'],", 'analyzeInstitutionalPrecedent'),
      svcR(a, 'defect', `${MDC}precedent-intelligence/index.ts`, "{ precedents: ['Risk assessment', 'Mitigation planning', 'Implementation'], impact: 75 },", 'analyzeInstitutionalPrecedent'),
      svcR(a, 'defect', `${MDC}precedent-intelligence/index.ts`, "interpretationGuidance: 'Organizational memory shows coherent precedent continuity.',", 'analyzeInstitutionalPrecedent'),
      ...envelopeDefectEv(a, false),
    ],
    inf: [envelopeInference],
    def: ['DEF-0B7-COGB-PRECEDENT-AND-PROCEDURAL-ENGINES-RETURN-CONSTANT-CONTENT-AS-ORGANIZATION-ANALYSIS', 'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY'],
  }),
  'procedural-continuity': (a) => baseCognition(a, {
    service: `${MDC}procedural-intelligence/index.ts`,
    persona: 'Union officer (or higher role) of an organization with the union_knowledge_suite entitlement reading what the route presents as the procedural continuity profile of the organization',
    owner: 'No organization data: the profile is a literal object; the only stored value read is the count of cognition memory entries, which sets entriesAnalyzed and one derived figure.',
    sens: 'A fixed fragility score, redundancy level, resilience figure and continuity-risk level returned as if measured for the organization; no procedure or handover record is read',
    priv: 'The response carries no organization personal data, but it presents a fragility score of 45, redundancy of 50 and moderate continuity risk as findings about this organization procedures.',
    does: 'Loads up to 100 cognition memory entries of the session organization only to count them, then returns a literal profile for every organization: fragility score 45, redundancy level 50, procedure resilience 55, continuity risk moderate and three fixed map labels, with undocumented_processes set to the entry count divided by 10, wrapped in an explainability envelope at moderate confidence.',
    status: 'NOT_IMPLEMENTED_RETURNS_200',
    future: 'Compute procedural fragility from recorded procedures, handovers and documented workflows with cited evidence, or return 501 until such a computation exists; do not present constants as an organization measurement.',
    ev: [
      ...cognitionGuardEv(a, 'proceduralContinuityEngine', 'compute: analyzeProcedualContinuity,'),
      ...memoryEntryEv(a),
      svcR(a, 'behavior', `${MDC}procedural-intelligence/index.ts`, "const { loadCognitionMemory } = await import('@/lib/knowledge-transfer/cognition-memory');", 'analyzeProcedualContinuity'),
      svcR(a, 'defect', `${MDC}procedural-intelligence/index.ts`, 'fragility_score: 45,', 'analyzeProcedualContinuity'),
      svcR(a, 'defect', `${MDC}procedural-intelligence/index.ts`, 'undocumented_processes: Math.ceil(memory.totalEntries / 10),', 'analyzeProcedualContinuity'),
      svcR(a, 'defect', `${MDC}procedural-intelligence/index.ts`, "continuity_risk: 'moderate',", 'analyzeProcedualContinuity'),
      svcR(a, 'defect', `${MDC}procedural-intelligence/index.ts`, 'procedure_resilience: 55,', 'analyzeProcedualContinuity'),
      ...envelopeDefectEv(a, false),
    ],
    inf: [envelopeInference],
    def: ['DEF-0B7-COGB-PRECEDENT-AND-PROCEDURAL-ENGINES-RETURN-CONSTANT-CONTENT-AS-ORGANIZATION-ANALYSIS', 'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY'],
  }),
}

/* -------------------------------------------------------------------------- */
/* hand-written withApi routes                                                 */
/* -------------------------------------------------------------------------- */

const INTERVIEW_TENANT = 'organizationId is the session-resolved organization of the withApi context; the reads select exit_interviews with organization_id equal to it through the shared db handle (the table is under FORCE RLS), and no query or body parameter selects an organization. Every sensitivity level and consent state of a published interview is read.'
const NO_INTERVIEW_SENS_AUTHZ = 'The role floor and the entitlement are the only checks; the route applies no sensitivity-level filter (the interview routes release privileged to officers and legal_sensitive and executive_confidential to admins) and no consent filter, and makes no kernel decision.'

const interviewSchemaEv = (a) => [
  a.sch('privacy', INTERVIEW_SCHEMA, "sensitivityLevel: exitInterviewSensitivityEnum('sensitivity_level').notNull().default('public_internal'),", { symbol: 'exitInterviews' }),
  a.sch('privacy', INTERVIEW_SCHEMA, "retiringEmployeeName: text('retiring_employee_name').notNull(),", { symbol: 'exitInterviews' }),
]

const topicGraph = (a) => mk({
  service: `${KT}topic-graph/topic-graph-builder.ts`,
  persona: 'Union steward (or higher role) of an organization with the union_knowledge_suite entitlement viewing the operational topic graph of published exit interviews',
  authn: SESSION,
  authz: `${NO_INTERVIEW_SENS_AUTHZ} The handler repeats the steward floor with hasStewardPrivileges after withApi has enforced it.`,
  tenant: INTERVIEW_TENANT,
  owner: 'A computed topic graph of the organization: nodes (tags with interview counts and contributing roles), co-occurrence edges, isolated and well-distributed topics and concentration clusters; nothing is stored.',
  sens: 'Topic and expertise tags of published exit interviews of departing members and officers, with the role in the union of each contributor and single-interview flags',
  priv: 'The graph returns each interview topic and expertise tag as a label with its contributing roles, whatever the interview sensitivity level or consent flag, so a steward reads tags and roles of interviews that are restricted to officers or admins, and a tag from one interview names the role of that one departing person.',
  mut: 'NOT_MUTATING',
  auditDetail: NO_WRITE,
  reqAudit: ROUTE_AUDIT,
  does: 'Selects id, role, topics and expertise tags of every published exit interview of the session organization with no limit, counts tag frequency and pair co-occurrence in memory, assigns a category by keyword substring, marks tags seen once as isolated and pairs seen three or more times as concentration clusters, and returns the graph.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [6, 13],
  future: 'Filter interviews to the sensitivity levels the caller may read (readableSensitivityLevels), apply a minimum cohort size before a role is attached to a tag, bound the read, and name who may see tags derived from restricted interviews.',
  dec: [AUDIENCE_DECISION],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('authorization', "entitlement: 'union_knowledge_suite',"),
    a.h('authorization', 'if (!hasStewardPrivileges(user?.role ?? null)) {'),
    a.h('tenantScope', 'const graph = await buildTopicGraph(organizationId!);'),
    a.h('mutation', 'return { data: graph };'),
    a.imp('tenantScope', 'buildTopicGraph', 'eq(exitInterviews.organizationId, orgId),'),
    a.imp('behavior', 'buildTopicGraph', "eq(exitInterviews.status, 'published'),"),
    a.imp('defect', 'buildTopicGraph', 'existing.roles.add(interview.roleInUnion);'),
    a.imp('defect', 'buildTopicGraph', 'const key = [allTags[i], allTags[j]].sort().join(\'||\');'),
    a.imp('defect', 'buildTopicGraph', 'const isolatedNodes = nodes.filter((n) => n.frequency === 1).map((n) => n.label);'),
    svcR(a, 'defect', `${KT}topic-graph/topic-graph-builder.ts`, 'if (COMPLIANCE_KEYWORDS.some((k) => lower.includes(k))) return \'compliance\';', 'categorize'),
    svcR(a, 'defect', `${KT}topic-graph/topic-graph-builder.ts`, "const COMPLIANCE_KEYWORDS = ['wsib', 'ohsa', 'esa', 'privacy', 'legal', 'arbitration', 'grievance', 'labour board'];"),
    svcR(a, 'privacy', CONSENT, "legal_sensitive: 'admin',"),
    ...interviewSchemaEv(a),
  ],
  inf: [
    { claim: 'defect', statement: 'Neither the route nor buildTopicGraph names sensitivityLevel or consentGranted: the only conditions are the organization and status published, while SENSITIVITY_MIN_ROLE holds legal_sensitive and executive_confidential at admin; a legal_sensitive interview can be published once consent is granted, so its tags enter the graph read by a steward.' },
  ],
  def: [
    'DEF-0B7-COGB-DERIVED-GRAPHS-IGNORE-INTERVIEW-SENSITIVITY',
    'DEF-0B7-COGB-INTERVIEW-DERIVED-ROLE-OUTPUT-IDENTIFIES-SINGLE-DEPARTING-PERSON',
    'DEF-0B7-COGB-TOPIC-CATEGORY-BY-SUBSTRING-DRIVES-CRITICAL-SENSITIVITY',
    'DEF-0B7-COGB-INTERVIEW-READS-UNBOUNDED',
  ],
  corr: [],
})

const propagation = (a) => mk({
  service: `${KT}propagation/dependency-propagator.ts`,
  persona: 'Union steward (or higher role) of an organization with the union_knowledge_suite entitlement tracing how the loss of recorded knowledge could propagate through operations',
  authn: SESSION,
  authz: NO_INTERVIEW_SENS_AUTHZ,
  tenant: INTERVIEW_TENANT,
  owner: 'A computed dependency propagation map of the organization: nodes, inferred dependency edges, bottlenecks, downstream impacts, upstream dependencies, coupling analyses and recommendations; nothing is stored.',
  sens: 'Topic and expertise tags, contributing roles, single-source flags and inferred sole-expert statements derived from published exit interviews of departing members and officers',
  priv: 'The map returns every tag as a node with its associated roles, a continuity sensitivity and a reason text such as "Sole expert in governance area; loss would create compliance gap" for a tag seen in one interview, whatever the interview sensitivity level, so a steward reads restricted-interview tags and a role that identifies the departing person.',
  mut: 'NOT_MUTATING',
  auditDetail: NO_WRITE,
  reqAudit: ROUTE_AUDIT,
  does: 'Builds the topic graph of every published exit interview of the session organization, turns each tag into a node with a sensitivity from its interview count and category, turns each co-occurrence of two or more interviews into a dependency whose direction follows the lower tag frequency, computes bottlenecks, transitive downstream and upstream sets, coupling and heuristic recommendations, and returns the whole map, one node view when nodeId matches, or the map filtered by analysisType; an unknown nodeId throws a plain Error.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Apply the interview sensitivity floor and a minimum cohort before roles are attached, label inferred edges as co-occurrence rather than dependency, validate nodeId and analysisType with a schema and answer 404 for an unknown node, and bound the read.',
  dec: [AUDIENCE_DECISION],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
    a.h('authorization', "entitlement: 'union_knowledge_suite',"),
    a.h('tenantScope', 'const propagationMap = await buildDependencyPropagationMap(organizationId!);'),
    a.h('mutation', 'return { data: filtered };'),
    a.h('defect', "throw new Error('Node not found');"),
    a.h('defect', "const analysisType = searchParams.get('analysisType') || 'full';"),
    a.h('defect', "upstreamDependencies: analysisType === 'downstream' ? [] : propagationMap.upstreamDependencies,"),
    a.imp('tenantScope', 'buildDependencyPropagationMap', '.where(and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, \'published\')));'),
    a.imp('privacy', 'buildDependencyPropagationMap', 'associatedRoles: topic.contributingRoles,'),
    a.imp('defect', 'buildDependencyPropagationMap', 'const dependsOn = sourceNode.frequency <= targetNode.frequency;'),
    a.imp('defect', 'buildDependencyPropagationMap', 'reason = `Sole expert in ${topic.category} area; loss would create compliance gap`;'),
    a.imp('defect', 'buildDependencyPropagationMap', 'rationale: `Topics co-occur in ${edge.weight} interviews; indicates operational coupling`,'),
    svcR(a, 'defect', `${KT}propagation/dependency-propagator.ts`, "'partial',", 'buildPropagationPaths'),
    svcR(a, 'privacy', CONSENT, "executive_confidential: 'admin',"),
    ...interviewSchemaEv(a),
  ],
  inf: [
    { claim: 'defect', statement: 'The propagation builder names neither sensitivityLevel nor consentGranted and takes its nodes from buildTopicGraph, so every tag of every published interview becomes a node; the isSingleSource flag is frequency equal to 1, which says the tag appeared in one interview, not that one person holds the knowledge.' },
    { claim: 'defect', statement: 'estimateRecoveryTime is called with a fixed partial documentation argument and the chain length, so the recoveryTimeWeeks of each path is a formula of path length and vendor or governance presence, not an observed recovery.' },
  ],
  def: [
    'DEF-0B7-COGB-DERIVED-GRAPHS-IGNORE-INTERVIEW-SENSITIVITY',
    'DEF-0B7-COGB-INTERVIEW-DERIVED-ROLE-OUTPUT-IDENTIFIES-SINGLE-DEPARTING-PERSON',
    'DEF-0B7-COGB-PROPAGATION-DEPENDENCIES-AND-SENSITIVITY-INFERRED-FROM-TAG-CO-OCCURRENCE',
    'DEF-0B7-COGB-TOPIC-CATEGORY-BY-SUBSTRING-DRIVES-CRITICAL-SENSITIVITY',
    'DEF-0B7-COGB-PROPAGATION-UNKNOWN-NODE-ANSWERS-500-AND-ANALYSIS-TYPE-NOT-VALIDATED',
    'DEF-0B7-COGB-INTERVIEW-READS-UNBOUNDED',
  ],
  corr: [],
})

const resilienceIndex = (a) => mk({
  service: `${KT}resilience-index/resilience-calculator.ts`,
  persona: 'Union officer (or higher role) of an organization with the union_knowledge_suite entitlement reading the organizational continuity resilience index',
  authn: SESSION,
  authz: `${NO_INTERVIEW_SENS_AUTHZ} The scores count interviews of every level.`,
  tenant: INTERVIEW_TENANT,
  owner: 'A computed resilience index of the organization: five dimension scores with components and recommendations, an overall score, status, trend and maturity level; nothing is stored.',
  sens: 'Counts and ratios of single-source topics, published interviews and bottlenecks of the organization exit interviews, as scores and labels',
  priv: 'The response carries organization-level scores and counts computed from every published interview regardless of sensitivity; it returns no interview text, tag or role.',
  mut: 'NOT_MUTATING',
  auditDetail: NO_WRITE,
  reqAudit: ROUTE_AUDIT,
  does: 'Builds the dependency propagation map and selects every published exit interview of the session organization, computes five dimension scores from node counts, single-source counts and the interview count, averages them into an overall score, labels status and maturity by cut-off, labels the trend degrading when more than 40 percent of nodes are single-source and stable otherwise, and returns the index; with no published interview the redundancy, documentation and governance scores are NaN and the status of those dimensions and the overall status is strong.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Return insufficient data instead of a score when there are no interviews or nodes, label heuristic components as such, derive a trend from stored indexes over time, and restrict interviews to those the policy allows to feed organization-level scores.',
  dec: [AUDIENCE_DECISION],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'officer' },"),
    a.h('authorization', "entitlement: 'union_knowledge_suite',"),
    a.h('tenantScope', 'const resilience = await calculateResilienceIndex(organizationId!);'),
    a.h('mutation', 'return { data: resilience };'),
    a.imp('tenantScope', 'calculateResilienceIndex', 'const interviews = await loadPublishedInterviews(orgId);'),
    svcR(a, 'tenantScope', `${KT}resilience-index/resilience-calculator.ts`, ".where(and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, 'published')));", 'loadPublishedInterviews'),
    a.imp('defect', 'calculateResilienceIndex', "{ name: 'Estimated doc quality', value: interviews.length >= 8 ? 75 : interviews.length >= 4 ? 50 : 25 },"),
    a.imp('defect', 'calculateResilienceIndex', "const trend = propagationMap.nodes.filter((node) => node.isSingleSource).length > propagationMap.nodes.length * 0.4 ? 'degrading' : 'stable' as const;"),
    svcR(a, 'defect', `${KT}resilience-index/resilience-calculator.ts`, 'const avgFrequency = propagationMap.nodes.reduce((sum, node) => sum + node.frequency, 0) / totalNodes;', 'calculateRedundancyScore'),
    svcR(a, 'defect', `${KT}resilience-index/resilience-calculator.ts`, "if (score < 40) return 'critical';", 'statusFromScore'),
    svcR(a, 'defect', `${KT}resilience-index/resilience-calculator.ts`, "if (score < 75) return 'adequate';", 'statusFromScore'),
    ...interviewSchemaEv(a),
  ],
  inf: [
    { claim: 'defect', statement: 'With zero nodes totalNodes is 0, so the redundancy, documentation and governance calculators divide by zero and return NaN (Math.max and Math.min propagate it); every comparison in statusFromScore is false for NaN, so it falls through to strong, and Math.round of the NaN sum gives an overall score that JSON serializes as null while the overall status is strong.' },
  ],
  def: [
    'DEF-0B7-COGB-EMPTY-ORGANIZATION-RESILIENCE-INDEX-DIVIDES-BY-ZERO-AND-REPORTS-STRONG',
    'DEF-0B7-COGB-RESILIENCE-INDEX-TREND-AND-DOCUMENTATION-QUALITY-ARE-HEURISTIC-LABELS',
    'DEF-0B7-COGB-INTERVIEW-READS-UNBOUNDED',
  ],
  corr: [],
})

const succession = (a) => mk({
  service: `${KT}succession/succession-analyzer.ts`,
  persona: 'Union officer (or higher role) of an organization with the union_knowledge_suite entitlement opening the continuity cockpit succession report',
  authn: SESSION,
  authz: `${NO_INTERVIEW_SENS_AUTHZ} The same floor applies to what is sent to the model: the summarize route requires the role of the interview sensitivity level before it sends one interview to the model, this route sends them all.`,
  tenant: INTERVIEW_TENANT,
  owner: 'A computed succession fragility report of the organization: per-role interview counts, years of service, average risk score and areas, a readiness score and model-written gaps, priorities, recommendations and executive summary; nothing is stored.',
  sens: 'Role, years of service, title, topics and continuity risk flags of every published exit interview of departing members and officers, sent to a model provider, and the model text and role rows returned to the caller',
  priv: 'Interview titles, topics, risk flags, roles and years of service of every published interview, whatever its sensitivity level and consent flag, are placed in a prompt and sent to the model provider on every call; the model text is returned to an officer, and a role with one interview returns that one person years of service and risk score.',
  mut: 'NOT_MUTATING',
  auditDetail: 'The handler and the analyzer write no row and no audit record, and the provider call is not wrapped in performAuditedOperation or any audit event, so nothing records that interview content was sent to the model or by whom.',
  reqAudit: 'Record the invocation (caller, organization, interview count, sensitivity levels included, model and profile) in an audit event before the provider call, as the summarize route does, and refuse to send an interview the caller may not read.',
  does: 'Selects role, years of service, title, topics, expertise tags, risk score and flags of every published exit interview of the session organization with no limit, groups them under five fixed roles, scores readiness from interview counts (50 of 100 for no interviews), and when any interview exists sends one prompt of all of them to the model through getAiClient (profile continuity-risk, data class internal), parses the reply as JSON without validation and returns it with the role rows; a parse failure returns 200 with empty lists and a canned summary.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [2, 6, 13],
  future: 'Filter interviews to the sensitivity levels the caller may read and to those with the consent the policy requires before the model call, audit the call, validate the reply against a schema and mark it as model-generated, return an error instead of a canned summary on a parse failure, derive readiness from handover records, and cache or rate-limit the call.',
  dec: [AUDIENCE_DECISION, MODEL_DECISION],
  ev: [
    ...guardEv(a, 'withApi'),
    a.h('authorization', "auth: { required: true, minRole: 'officer' },"),
    a.h('authorization', "entitlement: 'union_knowledge_suite',"),
    a.h('tenantScope', 'const report = await analyzeSuccessionFragility(organizationId!);'),
    a.h('mutation', 'return { data: report };'),
    a.imp('tenantScope', 'analyzeSuccessionFragility', 'eq(exitInterviews.organizationId, orgId),'),
    a.imp('behavior', 'analyzeSuccessionFragility', "eq(exitInterviews.status, 'published'),"),
    a.imp('behavior', 'analyzeSuccessionFragility', 'const result = await ai.generate({'),
    a.imp('privacy', 'analyzeSuccessionFragility', '`[${i.roleInUnion}, ${i.yearsOfService}y] ${i.title}\\n` +'),
    a.imp('privacy', 'analyzeSuccessionFragility', 'dataClass: \'internal\','),
    a.imp('defect', 'analyzeSuccessionFragility', 'const parsed = JSON.parse(result.content) as {'),
    a.imp('defect', 'analyzeSuccessionFragility', 'executiveSummary = `${published.length} exit interviews analyzed. Transition readiness score: ${transitionReadinessScore}/100. Manual review recommended.`;'),
    a.imp('defect', 'analyzeSuccessionFragility', 'const fragility = Math.min('),
    a.imp('defect', 'analyzeSuccessionFragility', 'const transitionReadinessScore = Math.max(0, 100 - Math.round(fragility));'),
    a.imp('defect', 'analyzeSuccessionFragility', 'if (!entry) continue;'),
    svcR(a, 'defect', `${KT}succession/succession-analyzer.ts`, 'if (interviewCount >= 2 && avgRisk < 50) return \'adequate\';', 'scoreReadiness'),
    svcR(a, 'privacy', CONSENT, "legal_sensitive: 'admin',"),
    svcR(a, 'privacy', SUMMARIZE_ROUTE, 'const minRole = SENSITIVITY_MIN_ROLE[interview.sensitivityLevel as keyof typeof SENSITIVITY_MIN_ROLE];'),
    ...interviewSchemaEv(a),
  ],
  inf: [
    { claim: 'defect', statement: 'The succession analyzer names neither sensitivityLevel nor consentGranted and imports no audit function; the sibling summarize route imports SENSITIVITY_MIN_ROLE and performAuditedOperation for the same provider call, so the controls exist in the code base and are absent here.' },
    { claim: 'defect', statement: 'When no interview is published, every role has count 0 and readiness none, fragility is 5 of 5 roles times 50 (50), and the score is 100 minus 50; the score therefore ranges from 50 to 100 and has no value below 50.' },
  ],
  def: [
    'DEF-0B7-COGB-SUCCESSION-SENDS-EVERY-PUBLISHED-INTERVIEW-TO-MODEL-IGNORING-SENSITIVITY',
    'DEF-0B7-COGB-SUCCESSION-CALL-NOT-AUDITED-AND-RUNS-ON-EVERY-GET',
    'DEF-0B7-COGB-SUCCESSION-MODEL-OUTPUT-UNVALIDATED-AND-PARSE-FAILURE-SWALLOWED',
    'DEF-0B7-COGB-SUCCESSION-READINESS-SCORE-COUNTS-EXIT-INTERVIEWS-AS-SUCCESSOR-READINESS',
    'DEF-0B7-COGB-INTERVIEW-DERIVED-ROLE-OUTPUT-IDENTIFIES-SINGLE-DEPARTING-PERSON',
    'DEF-0B7-COGB-INTERVIEW-READS-UNBOUNDED',
  ],
  corr: [],
})

const aggregateEv = (a) => [
  ...guardEv(a, 'withApi'),
  a.h('authorization', "auth: { required: true, minRole: 'officer' },"),
  a.h('authorization', "entitlement: 'union_knowledge_suite',"),
  a.h('tenantScope', 'const result = await runFullInstitutionalCognition(organizationId!);'),
  a.imp('behavior', 'runFullInstitutionalCognition', 'steps: ALL_ORCHESTRATION_STEPS as any as Parameters<'),
  svcR(a, 'tenantScope', MEMORY_STORE, 'WHERE organization_id = ${orgId}', 'loadCognitionMemory'),
  svcR(a, 'tenantScope', ORG_SCOPE, 'return withRLSContext({ organizationId }, operation);', 'inOrganization'),
  svcR(a, 'behavior', ORCHESTRATION, 'input.steps.map(async (step) => {', 'orchestrateCognition'),
  svcR(a, 'defect', ORCHESTRATION, 'error: err instanceof Error ? err.message : String(err),', 'orchestrateCognition'),
  svcR(a, 'defect', FOUNDATIONAL, 'confidenceScore: 60,', 'defineFoundationalEngine'),
  svcR(a, 'defect', BRIDGE, 'const confidenceScore = input.confidenceFromPayload?.(payload) ?? 60;', 'adaptLegacyEngine'),
  svcR(a, 'defect', SDK, 'evidence: result.evidence,', 'defineCognitionEngine'),
  svcR(a, 'defect', OOI_INDEX, 'export const ALL_ORCHESTRATION_STEPS = [', undefined),
]

const organizationalCognition = (a) => mk({
  service: `${APP}lib/organizational-operating-intelligence/index.ts`,
  persona: 'Union officer (or higher role) of an organization with the union_knowledge_suite entitlement opening the institutional operating-intelligence workspace',
  authn: SESSION,
  authz: `${NO_INTERVIEW_SENS_AUTHZ} The 28 engines it runs add no further check of their own.`,
  tenant: 'organizationId is the session-resolved organization of the withApi context and is passed to every engine; the memory engines read ue_cognition_memory through withRLSContext with organization_id = orgId (FORCE RLS) and the interview engines select exit_interviews with organization_id = orgId; nothing is read across organizations.',
  owner: 'The envelopes of all 28 engines for the organization (payload, explainability block and provenance), indexed by engine id, plus the list of engines that failed; nothing is stored.',
  sens: 'The payloads of every cognition engine: counts and typed scores of cognition memory, topic and expertise tags and roles of published exit interviews, dependency, resilience, succession-style and benchmark figures',
  priv: 'The response carries the full payload of the topic graph and dependency propagation engines (tags and roles of every published interview whatever its sensitivity level) together with the constant precedent and procedural profiles and the raw engine failure messages.',
  mut: 'NOT_MUTATING',
  auditDetail: NO_WRITE,
  reqAudit: ROUTE_AUDIT,
  does: 'Runs the 17 foundational and 11 dynamics engines in parallel for the session organization through orchestrateCognition, returns every envelope in a list and indexed by engine id with the engines that threw (their exception message) listed under failures inside an HTTP 200; a failing engine does not fail the request.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Filter the interview-derived engines by the caller sensitivity floor, replace constant engines and fixed confidence with computed ones, return a generic failure indicator instead of exception text, cache the result per organization, and audit the read.',
  dec: [AUDIENCE_DECISION],
  ev: [...aggregateEv(a), a.h('mutation', 'byEngine[env.provenance.engine] = env;')],
  inf: [
    { claim: 'defect', statement: 'The foundational steps include topic-graph, dependency-propagation, resilience-roadmap and decision-brief, which read published interviews with no sensitivity filter, and the dynamics steps include institutional-precedent and procedural-continuity, which return literals, so their envelopes are in byEngine for the officer who called.' },
  ],
  def: [
    'DEF-0B7-COGB-DERIVED-GRAPHS-IGNORE-INTERVIEW-SENSITIVITY',
    'DEF-0B7-COGB-PRECEDENT-AND-PROCEDURAL-ENGINES-RETURN-CONSTANT-CONTENT-AS-ORGANIZATION-ANALYSIS',
    'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY',
    'DEF-0B7-COGB-AGGREGATE-ERRORS-RETURNED-VERBATIM-IN-HTTP-200',
    'DEF-0B7-COGB-AGGREGATE-RUNS-28-ENGINES-PER-REQUEST-UNCACHED',
  ],
  corr: [],
})

const organizationalNarratives = (a) => mk({
  service: NARRATIVES,
  persona: 'Union officer (or higher role) of an organization with the union_knowledge_suite entitlement reading the institutional narrative and executive briefing',
  authn: SESSION,
  authz: `${NO_INTERVIEW_SENS_AUTHZ} The 28 engines it runs add no further check of their own.`,
  tenant: 'organizationId is the session-resolved organization of the withApi context and is passed to every engine; the memory engines read ue_cognition_memory through withRLSContext with organization_id = orgId (FORCE RLS) and the interview engines select exit_interviews with organization_id = orgId; nothing is read across organizations.',
  owner: 'Narratives and an executive briefing computed from the engine envelopes of the organization, plus the engine and narrative failure lists; nothing is stored.',
  sens: 'Narrative headlines and summaries built from each engine interpretation guidance, evidence count and confidence band; the engine payloads are not returned',
  priv: 'The response carries organization-level narrative text projected from fixed interpretation guidance; it names no member or interview, but it returns the raw engine failure messages and states that each narrative is derived from evidence the envelopes do not contain.',
  mut: 'NOT_MUTATING',
  auditDetail: NO_WRITE,
  reqAudit: ROUTE_AUDIT,
  does: 'Runs the 17 foundational and 11 dynamics engines for the session organization, projects each envelope into a narrative whose headline is the first sentence of the engine fixed guidance and whose summary states the number of evidence items and the confidence band, composes a briefing of the first eight narratives ordered by review signals and confidence, and returns it with the engine and narrative failures inside an HTTP 200.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Derive narratives from envelopes that carry evidence and reasoning, refuse to state a derivation from zero evidence items, return a generic failure indicator instead of exception text, cache the result and audit the read.',
  dec: [],
  ev: [
    ...aggregateEv(a),
    a.h('behavior', 'const { narratives, failures: narrativeFailures } = narrateEnvelopes(result.envelopes);'),
    a.h('mutation', 'const briefing = composeExecutiveBriefing(Object.values(narratives));'),
    a.imp('defect', 'narrateEnvelopes', 'const n = narrateEnvelope(env);'),
    svcR(a, 'defect', NARRATIVES, '`Derived from ${evidenceCount} institutional evidence item${evidenceCount === 1 ? \'\' : \'s\'} ${conf}.`,', 'pickSummary'),
    svcR(a, 'defect', NARRATIVES, 'const firstSentence = guidance.split(/(?<=[.!?])\\s/)[0] ?? guidance;', 'pickHeadline'),
    svcR(a, 'defect', NARRATIVES, '(n.reviewSignals.length > 0 ? 10 : 0) +', 'composeExecutiveBriefing'),
  ],
  inf: [
    { claim: 'defect', statement: 'Every engine returns an empty evidence list and a moderate band, so pickSummary always writes "Derived from 0 institutional evidence items with moderate confidence", reasoning and governanceImplications are empty so keyReasoning and reviewSignals are empty, and the briefing sort key is the same number for every narrative.' },
  ],
  def: [
    'DEF-0B7-COGB-NARRATIVES-CITE-ZERO-EVIDENCE-AS-DERIVED-FROM-EVIDENCE',
    'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY',
    'DEF-0B7-COGB-AGGREGATE-ERRORS-RETURNED-VERBATIM-IN-HTTP-200',
    'DEF-0B7-COGB-AGGREGATE-RUNS-28-ENGINES-PER-REQUEST-UNCACHED',
  ],
  corr: [],
})

const resilienceRoadmap = (a) => baseCognition(a, {
  service: `${KT}resilience-strategies/strategy-modeler.ts`,
  tenant: 'organizationId is the session-resolved organization of the withApi context and is the engine only argument; the engine builds the dependency propagation map and the resilience index from exit_interviews with organization_id = orgId, so nothing is read across organizations, but every sensitivity level and consent state of a published interview is counted.',
  owner: 'A computed resilience roadmap of the organization: current and projected score, up to five strategies with durations and gains, three phases and a maturity narrative; nothing is stored.',
  sens: 'Strategies, durations and scores computed from counts of single-source topics, governance and vendor nodes and the resilience index of the published exit interviews',
  priv: 'The response carries organization-level strategies and scores derived from interview-tag counts of every sensitivity level; it returns no interview text, tag or role, and states "strong continuity maturity (NaN/100)" for an organization with no interview.',
  does: 'Builds the dependency propagation map and the resilience index of the session organization, selects up to five strategies from single-source counts and concentration thresholds, copies each strategy gains from a fixed table, sums them into a projected score and returns phases and a maturity narrative chosen by cut-offs on the current score, inside the fixed moderate-confidence envelope.',
  future: 'Return insufficient data for an organization with no interviews, correct the documentation rule precedence, derive gains from an evidence-backed model or label them as reference values, and apply the interview sensitivity floor to the inputs.',
  ev: [
    ...cognitionGuardEv(a, 'resilienceRoadmapEngine', 'invoke: buildResilienceRoadmap,'),
    svcR(a, 'behavior', `${KT}resilience-strategies/strategy-modeler.ts`, 'buildDependencyPropagationMap(orgId),', 'buildResilienceRoadmap'),
    svcR(a, 'tenantScope', `${KT}propagation/dependency-propagator.ts`, '.where(and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, \'published\')));', 'buildDependencyPropagationMap'),
    svcR(a, 'defect', `${KT}resilience-strategies/strategy-modeler.ts`, 'if (resilienceIndex.dimensions.find((d) => d.name === \'Documentation Maturity\')?.score ?? 0 < 65) {', 'buildResilienceRoadmap'),
    svcR(a, 'defect', `${KT}resilience-strategies/strategy-modeler.ts`, 'documentation_foundation:         [18, 10, 15],', 'computeStrategyGain'),
    svcR(a, 'defect', `${KT}resilience-strategies/strategy-modeler.ts`, 'const projectedScore = Math.min(100, currentScore + Math.round(totalGain * 0.7));', 'buildResilienceRoadmap'),
    svcR(a, 'defect', `${KT}resilience-index/resilience-calculator.ts`, "if (score < 75) return 'adequate';", 'statusFromScore'),
    ...interviewSchemaEv(a),
    ...envelopeDefectEv(a, true),
  ],
  inf: [
    { claim: 'defect', statement: 'For an organization with no published interview overallScore is NaN, so the roadmap currentScore is NaN, every cut-off comparison in the maturity narrative is false and the last branch "strong continuity maturity" is returned with NaN printed; the documentation lookup returns NaN, which is falsy, so no strategy is selected.' },
    envelopeInference,
  ],
  def: [
    'DEF-0B7-COGB-EMPTY-ORGANIZATION-RESILIENCE-INDEX-DIVIDES-BY-ZERO-AND-REPORTS-STRONG',
    'DEF-0B7-COGB-ROADMAP-DOCUMENTATION-RULE-PRECEDENCE-AND-CONSTANT-PROJECTED-GAINS',
    'DEF-0B7-COGB-INTERVIEW-READS-UNBOUNDED',
    'DEF-0B7-COGB-ENVELOPE-CONFIDENCE-FIXED-AT-60-AND-EXPLAINABILITY-EMPTY',
  ],
})

const BY_ROUTE = {
  ...Object.fromEntries(Object.entries(MEMORY_REAL_SPEC).map(([name, fn]) => [routeFile(name), fn])),
  ...Object.fromEntries(Object.entries(MEMORY_PROXY_SPEC).map(([name, fn]) => [routeFile(name), fn])),
  ...Object.fromEntries(Object.entries(STATIC_SPEC).map(([name, fn]) => [routeFile(name), fn])),
  [routeFile('topic-graph')]: topicGraph,
  [routeFile('propagation')]: propagation,
  [routeFile('resilience-index')]: resilienceIndex,
  [routeFile('resilience-roadmap')]: resilienceRoadmap,
  [routeFile('succession')]: succession,
  [routeFile('organizational-cognition')]: organizationalCognition,
  [routeFile('organizational-narratives')]: organizationalNarratives,
}

export const CAPABILITIES = []

export function facts(a, readText) {
  readFile = readText
  const build = BY_ROUTE[a.route]
  if (!build) throw new Error(`no facts for ${a.route}`)
  const fields = build(a)
  return { ...fields, evidence: fields.evidence.filter(Boolean) }
}
