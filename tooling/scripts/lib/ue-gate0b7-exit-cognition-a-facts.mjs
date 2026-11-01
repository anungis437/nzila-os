/**
 * Gate 0B.7 facts: the derived organizational-cognition routes under exit-interviews that this tranche owns (first
 * half): the memory-derived governance profiles, the interview-derived continuity analytics, the cross-domain
 * correlation, the model-assisted continuity risk report and the four legacy slug redirects. Every evidence item is
 * produced by `opAuthoring` from the exact handler, the helper or service it calls, or the resolved schema, and is
 * proved again by the validator. This tranche records the source; it repairs nothing.
 */
import { mk, SESSION } from './ue-gate0b4-record.mjs'
import { APP, guardEv } from './ue-gate0b4-fact-helpers.mjs'

const GATE = 14
const CAP = 'UE-OMIT-EXIT-INTERVIEW-COGNITION-ANALYTICS'
const CAP_AI = 'UE-OMIT-AI-ADVISORY-GOVERNANCE'

const API_DIR = `${APP}app/api/exit-interviews/`
const KT = `${APP}lib/knowledge-transfer/`
const WITH_API = `${APP}lib/api/with-api.ts`
const MEM = `${KT}cognition-memory/memory-store.ts`
const MEM_MODELS = `${KT}cognition-memory/memory-models.ts`
const SESSIONS = `${KT}reasoning-sessions/session-manager.ts`
const PROP = `${KT}propagation/dependency-propagator.ts`
const RESIL = `${KT}resilience-index/resilience-calculator.ts`
const STRAT = `${KT}resilience-strategies/strategy-modeler.ts`
const FORECAST = `${KT}forecasting/continuity-forecaster.ts`
const FED = `${KT}federated-intelligence/federated-engine.ts`
const DECISION = `${KT}decision-intelligence/decision-engine.ts`
const CASCADE = `${KT}cascade-analysis/cascade-analyzer.ts`
const ADAPTIVE = `${KT}adaptive-resilience/adaptive-engine.ts`
const BEHAVIOR = `${KT}behavior-patterns/behavior-engine.ts`
const CULTURE = `${KT}governance-culture/culture-engine.ts`
const ARCHETYPE = `${KT}learning-archetypes/archetype-classifier.ts`
const ADAPTATION = `${KT}governance-adaptation/adaptation-engine.ts`
const RISK = `${KT}continuity-risk/risk-detector.ts`
const CONSENT = `${KT}governance/consent-controls.ts`
const CORRELATION = `${APP}lib/multi-domain-cognition/correlation/index.ts`
const FOUNDATIONAL = `${APP}lib/organizational-operating-intelligence/kernel-bridge-foundational.ts`
const BRIDGE = `${APP}lib/organizational-operating-intelligence/kernel-bridge.ts`
const COGNITION_ROUTE = `${APP}lib/api/cognition-route.ts`
const SDK = 'packages/organizational-cognition-core/src/sdk/index.ts'
const EXPLAIN = 'packages/organizational-cognition-core/src/explainability/index.ts'
const EXIT_SCHEMA = `${APP}db/schema/domains/infrastructure/exit-interviews.ts`

const MEMORY_PROFILE_ROUTES = [
  'exit-interviews/behavior-patterns/route.ts',
  'exit-interviews/governance-adaptation/route.ts',
  'exit-interviews/governance-coherence/route.ts',
  'exit-interviews/governance-culture/route.ts',
  'exit-interviews/governance-momentum/route.ts',
  'exit-interviews/learning-archetypes/route.ts',
]
const INTERVIEW_ANALYTICS_ROUTES = [
  'exit-interviews/adaptive-resilience/route.ts',
  'exit-interviews/cascade-analysis/route.ts',
  'exit-interviews/decision-brief/route.ts',
  'exit-interviews/expertise-map/route.ts',
  'exit-interviews/federated-benchmarking/route.ts',
  'exit-interviews/forecasting/route.ts',
  'exit-interviews/governance-timeline/route.ts',
]
const CORRELATION_ROUTES = ['exit-interviews/cross-domain-correlation/route.ts']
const RISK_ROUTES = ['exit-interviews/continuity-risk/route.ts']
const REDIRECT_ROUTES = [
  'exit-interviews/institutional-cognition/route.ts',
  'exit-interviews/institutional-learning/route.ts',
  'exit-interviews/institutional-narratives/route.ts',
  'exit-interviews/institutional-precedent/route.ts',
]

export const ROUTES = new Set([
  ...MEMORY_PROFILE_ROUTES,
  ...INTERVIEW_ANALYTICS_ROUTES,
  ...CORRELATION_ROUTES,
  ...RISK_ROUTES,
  ...REDIRECT_ROUTES,
])

const ev = (ref, quote) => ({ kind: 'file', ref, quote })

export const GROUPS = {
  COG_A_MEMORY_PROFILES: {
    capabilityId: CAP,
    domain: 'EXIT_COGNITION_MEMORY_PROFILES',
    actor: 'Officer of an organization holding the union knowledge suite reading the governance behaviour, culture, archetype, adaptation, coherence and momentum profiles that are derived from the cognition memory entries and reasoning sessions the organization saved',
    routes: MEMORY_PROFILE_ROUTES,
    evidence: [
      ev(MEM, 'Uses the ue_cognition_memory table. The relation is created by platform'),
      ev(MEM_MODELS, 'This is organizational continuity memory — not employee records.'),
      ev(`${APP}lib/api/cognition-route.ts`, " * Standard route factory for cognition engines."),
    ],
  },
  COG_A_INTERVIEW_DERIVED_ANALYTICS: {
    capabilityId: CAP,
    domain: 'EXIT_COGNITION_INTERVIEW_ANALYTICS',
    actor: 'Officer, and for the expertise map steward, of an organization holding the union knowledge suite reading continuity analytics (resilience, cascade, decision brief, forecast, benchmark, expertise map and governance timeline) that are derived from the organization exit interviews',
    routes: INTERVIEW_ANALYTICS_ROUTES,
    evidence: [
      ev(EXIT_SCHEMA, 'sensitivityLevel: exitInterviewSensitivityEnum(\'sensitivity_level\').notNull().default(\'public_internal\'),'),
      ev(RESIL, 'export async function calculateResilienceIndex(orgId: string): Promise<OrganizationalResilienceIndex> {'),
      ev(`${APP}app/api/exit-interviews/expertise-map/route.ts`, ' * This reflects ORGANIZATIONAL DEPENDENCY STRUCTURE.'),
    ],
  },
  COG_A_CROSS_DOMAIN_CORRELATION: {
    capabilityId: CAP,
    domain: 'EXIT_COGNITION_CORRELATION',
    actor: 'Officer of an organization holding the union knowledge suite asking for the correlations among its governance, continuity, procedural and trust signals',
    routes: CORRELATION_ROUTES,
    evidence: [
      ev(CORRELATION, 'export async function identifyInstitutionalCorrelations(organizationId: string): Promise<CrossDomainCorrelationProfile> {'),
      ev(CORRELATION, 'export interface CrossDomainCorrelationProfile {'),
    ],
  },
  COG_A_CONTINUITY_RISK_MODEL: {
    capabilityId: CAP_AI,
    domain: 'AI_ADVISORY_GOVERNANCE',
    actor: 'Officer of an organization holding the union knowledge suite asking for a model-assisted continuity risk report over its published exit interviews',
    routes: RISK_ROUTES,
    evidence: [
      ev(RISK, 'export async function detectContinuityRisks(orgId: string): Promise<OrgContinuityRiskReport> {'),
      ev(RISK, 'const RISK_ANALYSIS_PROMPT = `You are an organizational continuity risk analyst for a union organization.'),
      ev(`${APP}lib/ai/ai-client.ts`, 'export function getAiClient(): AiClient {'),
    ],
  },
  COG_A_LEGACY_SLUG_REDIRECTS: {
    capabilityId: CAP,
    domain: 'EXIT_COGNITION_LEGACY_REDIRECTS',
    actor: 'External integration that still calls an institutional-* slug of the exit-interview cognition routes and is sent on to the organizational-* route that holds the data and the guard',
    routes: REDIRECT_ROUTES,
    evidence: [
      ev(`${API_DIR}institutional-cognition/route.ts`, ' * Legacy slug redirect — moved to /api/exit-interviews/organizational-cognition.'),
      ev(`${API_DIR}institutional-learning/route.ts`, ' * Legacy slug redirect — moved to /api/exit-interviews/organizational-learning.'),
      ev(`${API_DIR}institutional-narratives/route.ts`, ' * Legacy slug redirect — moved to /api/exit-interviews/organizational-narratives.'),
      ev(`${API_DIR}institutional-precedent/route.ts`, ' * Legacy slug redirect — moved to /api/exit-interviews/organizational-precedent.'),
    ],
  },
}

const D = (id, ownerCapabilityId, severity, title, releaseDisposition) => ({
  id, ownerCapabilityId, gate: GATE, severity, title, ...(releaseDisposition ? { releaseDisposition } : {}),
})

const D_SENSITIVITY = 'DEF-0B7-COGA-DERIVED-AGGREGATES-IGNORE-INTERVIEW-SENSITIVITY'
const D_CORRELATION = 'DEF-0B7-COGA-CROSS-DOMAIN-CORRELATIONS-ARE-FIXED-LITERALS'
const D_FORECAST = 'DEF-0B7-COGA-FORECAST-PROJECTIONS-ARE-FIXED-RATES-AND-ALWAYS-IMPROVE'
const D_NAN = 'DEF-0B7-COGA-EMPTY-ORGANIZATION-RESILIENCE-IS-NAN-AND-READS-STRONG'
const D_RISK_MODEL = 'DEF-0B7-COGA-CONTINUITY-RISK-SENDS-INTERVIEW-DATA-TO-MODEL-UNGUARDED'
const D_MEMORY = 'DEF-0B7-COGA-PROFILES-MEASURE-ENTERED-MEMORY-ROWS-NOT-GOVERNANCE'
const D_ENVELOPE = 'DEF-0B7-COGA-ENVELOPE-CONFIDENCE-IS-A-CONSTANT-AND-EXPLAINABILITY-IS-EMPTY'
const D_FEDERATED = 'DEF-0B7-COGA-FEDERATED-PERCENTILE-FROM-UNSOURCED-LITERALS'
const D_RATINGS = 'DEF-0B7-COGA-RISK-RATINGS-ARE-FIXED-RULES-OVER-TAG-COUNTS'
const D_CASCADE = 'DEF-0B7-COGA-CASCADE-REGULATORY-RISK-IS-A-LABEL-TEMPLATE'
const D_COHERENCE = 'DEF-0B7-COGA-COHERENCE-AND-MOMENTUM-ARE-LITERALS-AND-ENTRY-COUNT-RATIOS'
const D_ROADMAP = 'DEF-0B7-COGA-ROADMAP-DOCUMENTATION-STRATEGY-PRECEDENCE-BUG'
const D_TIMELINE = 'DEF-0B7-COGA-TIMELINE-COUNTS-CAPPED-AND-INTERVIEW-WINDOW-UNBOUNDED'

export const DEFECTS = [
  D(D_SENSITIVITY, CAP, 'HIGH', 'The expertise map (steward floor), the cascade analysis, the decision brief, the continuity risk report and the governance timeline (officer floor) read the published, or for the timeline every, exit interview of the organization without selecting or testing its sensitivityLevel and return the topic, expertise tag and role labels, the single-source flags with the role and risk score of the one interview behind a tag, the ids of the interviews awaiting review, and the free-text notes of review events, although the consent policy requires the admin role for legal_sensitive and executive_confidential interviews and the steward or officer role for restricted and privileged ones; nothing in these routes applies that table.', {
    disposition: 'CONDITIONALLY_BLOCKING',
    actualExposure: 'An officer (a steward for the expertise map) of an organization that holds the union_knowledge_suite entitlement receives, in one call and with no sensitivity filter, topic and expertise labels, roles, per-tag risk scores and review notes derived from every interview of the organization, including legal_sensitive and executive_confidential ones that the consent policy reserves for the admin role.',
    potentialImpact: {
      classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
      description: 'A steward or officer below the role that the sensitivity policy names learns the subjects, roles and review commentary of a departing member whose interview was classified legal_sensitive or executive_confidential; a single-source row identifies the one interviewee role and risk score.',
    },
    activationState: 'REACHABLE_ENTITLEMENT_GATED',
    activationEvidence: [
      { ref: `${APP}lib/api/cognition-route.ts`, quote: "auth: { required: true, minRole: 'officer' }," },
      { ref: `${APP}app/api/exit-interviews/expertise-map/route.ts`, quote: "auth: { required: true, minRole: 'steward' }," },
      { ref: CONSENT, quote: "legal_sensitive: 'admin'," },
    ],
    existingContainment: 'NONE',
    blockingCondition: 'The union_knowledge_suite entitlement is granted to an organization whose exit-interview archive holds a published interview classified above public_internal, at which point a steward or officer reads derived content the sensitivity policy withholds from that role.',
    justification: 'The routes are role- and entitlement-gated, so the exposure stays inside one organization and needs an entitled organization with sensitive interviews; no filter, redaction or consent test limits what the derived responses carry, so the disclosure happens as soon as that condition is true and must be closed before the entitlement is sold.',
  }),
  D(D_CORRELATION, CAP, 'HIGH', 'The cross-domain-correlation route answers 200 for every organization with the same five correlation pairs, strengths 0.75, 0.65, 0.60, 0.70 and 0.80, the same three fragility indicators, the same three operating insights and the narrative that the organization shows strong correlations between governance discipline, continuity capability and resilience maturity; the only value read from the organization is the count of cognition memory entries, so no correlation is computed and an empty organization is told the same thing.', {
    disposition: 'RELEASE_BLOCKING',
    actualExposure: 'Any officer of an organization holding the union_knowledge_suite entitlement receives HTTP 200 with five fixed correlation strengths, indicators and a narrative that reports strong correlations as a finding about that organization, whatever its data; only entriesAnalyzed comes from the database.',
    potentialImpact: {
      classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'DATA_QUALITY'],
      description: 'Governance and continuity decisions can cite correlation strengths and a narrative that no analysis produced, and an organization with no data at all is told that its governance and continuity are strongly correlated.',
    },
    activationState: 'REACHABLE_ENTITLEMENT_GATED',
    activationEvidence: [
      { ref: `${APP}lib/api/cognition-route.ts`, quote: "entitlement: 'union_knowledge_suite'," },
      { ref: `${APP}app/api/exit-interviews/cross-domain-correlation/route.ts`, quote: 'export const GET = cognitionRoute(crossDomainCorrelationEngine);' },
    ],
    existingContainment: 'NONE',
    justification: 'The route returns a fabricated analytical result with a success status instead of refusing the capability, and the role floor and entitlement only limit who is told it; no part of the source marks the output as sample or placeholder, so the harm is present for every entitled officer and does not depend on a later condition.',
  }),
  D(D_FORECAST, CAP, 'HIGH', 'The continuity forecast projects twelve months from three fixed monthly rates (concentration +0.3, governance -0.5 and redundancy erosion -0.2) and subtracts the negative erosion from the average redundancy, so projected redundancy rises every month and projected health rises about 0.6 points a month whatever the data, which makes trendDirection read improving for every organization whose projected health stays below 100; its historical series is rebuilt from published interview dates with a fixed vendor concentration of 40 and a fixed fallback point (health 60, five single-source nodes), and the decision brief executive summary states that trend direction as a forecast of continuity health.', {
    disposition: 'CONDITIONALLY_BLOCKING',
    actualExposure: 'An officer of an organization holding the union_knowledge_suite entitlement receives, from the forecasting route and inside the decision brief executive summary that the continuity planning workspace renders, twelve monthly health projections and a trend direction that improve by construction, together with a historical series that is partly fixed literals.',
    potentialImpact: {
      classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'DATA_QUALITY'],
      description: 'A union can read a continuity forecast that says its position will improve when no input supports the claim, and defer succession and documentation work on the strength of a projection whose direction was fixed by a sign error and constant rates.',
    },
    activationState: 'REACHABLE_ENTITLEMENT_GATED',
    activationEvidence: [
      { ref: `${APP}lib/api/cognition-route.ts`, quote: "entitlement: 'union_knowledge_suite'," },
      { ref: `${APP}app/api/exit-interviews/forecasting/route.ts`, quote: 'export const GET = cognitionRoute(continuityForecastEngine);' },
    ],
    existingContainment: 'NONE',
    blockingCondition: 'The union_knowledge_suite entitlement is granted to an organization, or any workspace, report or export presents the forecast or the decision brief summary that repeats it, so that a reader acts on a projection that improves by construction.',
    justification: 'The numbers are computed from real counts but the projection step uses constants and a sign inversion, so its direction does not depend on the organization; the harm needs an entitled organization that acts on the forecast, which is the condition under which this blocks release.',
  }),
  D(D_NAN, CAP, 'MEDIUM', 'When an organization has no published interview, or none that yields a topic, the dependency map has no nodes and the resilience index divides by zero: overallScore and the dimension scores are NaN (null in JSON), statusFromScore(NaN) returns strong, maturity reads initial, the decision brief states strong continuity resilience with a score of NaN out of 100, the federated benchmark places the organization in the nascent cohort at the 97th percentile, and the forecast projections are NaN with a stable trend.'),
  D(D_RISK_MODEL, CAP_AI, 'MEDIUM', 'The continuity risk route sends the role, years of service, title, expertise tags and topics of every published exit interview, whatever its sensitivityLevel or consent flag, to a model through getAiClient under the system organization id with dataClass internal, without guardAiFeature, an AI safety check or an AI interaction audit record; it parses the model reply with JSON.parse and no schema check and returns the flags as they come, answers 200 with empty flags and a manual-review sentence when the reply is not JSON, and lets a failed generate call surface as a 500.'),
  D(D_MEMORY, CAP, 'MEDIUM', 'The behaviour pattern, governance culture, learning archetype, governance adaptation, governance coherence, governance momentum and adaptive resilience routes derive their scores, postures, archetypes and narratives from counts, types and dates of cognition memory entries and reasoning sessions, whose memoryType, title and resilienceScoreAtCapture an officer chooses when saving them through the memory route; an organization with no entries is reported as governance stagnant (archetype score 100, strongly characterized), so the output measures use of the analytics tools and officer-entered scores, not governance decisions, and is presented as the governance culture, momentum, coherence and archetype of the organization.'),
  D(D_ENVELOPE, CAP, 'MEDIUM', 'Every cognitionRoute operation returns an explainability envelope whose confidence band comes from a constant score of 60 (moderate) written in defineFoundationalEngine and defaulted in adaptLegacyEngine, whose evidence, reasoning, assumptions and governance implications are always empty arrays because the engine definitions pass none to buildExplainabilityEnvelope, and which carries no per-organization data-sufficiency signal, so the envelope advertises explainability and a confidence that the engine does not compute.'),
  D(D_FEDERATED, CAP, 'MEDIUM', 'The federated benchmark reports an estimatedPercentile, a cohort and cohort-average dimension comparisons by interpolating the resilience score on an eight-point reference distribution and six cohort averages written as literals with the description based on organizational governance research and no named source, population or date, so the response states that the organization sits at the Nth percentile although no population exists behind the figure, and only the disclaimer text says no cross-organization data is used.'),
  D(D_RATINGS, CAP, 'MEDIUM', 'The expertise map rates a domain critical when one interview mentions its tag, reports averageRiskScore 0 when no interview carries a score, and returns the roles of the one interview behind a single-source tag; the continuity risk report returns overallRiskScore 0 for an organization with no interview, scores coverage gaps against the literal role list steward, chief_steward, officer and admin, and caps each term of the score with fixed weights; the decision brief marks its evidence confidence high as a literal, so the ratings are fixed rules over tag counts presented as measured risk.'),
  D(D_CASCADE, CAP, 'MEDIUM', 'The cascade analysis builds regulatoryRisks by prefixing Regulatory continuity risk: to the identifier of every node impacted by a governance or compliance node, whatever that node is, returns the same three recommendation strings for every organization, and classifies governance and compliance nodes by substring keywords over interview tags (a tag containing meeting or report is a governance node), so the regulatory risk list is a label template and not a regulatory assessment.'),
  D(D_COHERENCE, CAP, 'MEDIUM', 'The governance coherence profile sets overlapScore 50, ambiguousAuthority 40, duplicationLevel 30, the evidence Baseline overlap analysis, a stable trend on every dimension, an empty conflictingPolicies list and fixed breakdown frequency 60 and recovery time 14 whatever the data, and the governance momentum profile computes its five indicators as entry counts divided by fixed denominators (10, 10, 8, 30 and 50) with no time dimension, labelling a small count decelerating or volatile, so neither measures coherence or momentum over time.'),
  D(D_ROADMAP, CAP, 'MEDIUM', 'buildResilienceRoadmap, which the adaptive resilience engine calls, tests the documentation strategy with the expression score ?? 0 < 65, which parses as score ?? (0 < 65), so the strategy is added whenever the documentation score is any nonzero number (including 100) and withheld when the score is 0 or NaN, the opposite of the intent that a low documentation score selects it.'),
  D(D_TIMELINE, CAP, 'LOW', 'The governance timeline reads at most 500 events and every interview created in the six-month window with no limit, then computes eventTypeCounts, governanceUpdatesLast30Days and the stale review counts from the capped event list and the interview list as they stand, so counts silently understate for an organization with more than 500 events in the window while the interview read grows without bound, and the totals carry no truncation marker.'),
]

export const CAPABILITIES = [
  {
    id: CAP,
    parentRegisterId: 'UE-CONV-K-007',
    relatedRegisterIds: ['UE-CONV-K-006', 'UE-CONV-K-005'],
    obligationKey: 'exit-interview-cognition-analytics',
    primaryGate: GATE,
    dependencyGates: [6, 13],
    actor: 'Officer, and for the expertise map steward, of an organization that holds the union knowledge suite reading continuity analytics derived from its exit interviews, cognition memory and reasoning sessions',
    businessOutcome: 'A derived analytic about an organization is computed only from that organization data, is shown only to the offices the institution names for the sensitivity of the interviews it draws on, states what it measured and how sure it is, never presents a fixed literal, a constant rate or an unsourced reference curve as a finding, reports insufficient data when the data are insufficient, and is not a model call that sends interview content out without the AI governance controls.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/exit-interviews (adaptive-resilience, behavior-patterns, cascade-analysis, cross-domain-correlation, decision-brief, expertise-map, federated-benchmarking, forecasting, governance-adaptation, governance-coherence, governance-culture, governance-momentum, governance-timeline, learning-archetypes)',
    service: COGNITION_ROUTE,
    sourceFiles: [COGNITION_ROUTE, FOUNDATIONAL, BRIDGE, MEM, PROP, RESIL, FORECAST],
    proof: [{ type: 'path', ref: COGNITION_ROUTE }],
    auditEvidence: 'The routes are reads and write no audit record; no read of a derived analytic is audited. The memory and session rows they derive from are written, with an atomic audit record, by other routes.',
    privacyClassification: 'Organization-level continuity analytics derived from exit-interview topics, expertise tags, roles, years of service, risk scores and review notes of departing members and staff, and from officer-entered cognition memory and reasoning-session rows.',
    gap: 'UE-OMIT-ANALYTICS-REPORT-AUTHORIZATION owns claims, pilot and telemetry reports that read operational tables, and UE-OMIT-AI-ADVISORY-GOVERNANCE owns routes whose purpose is a model call; neither names exit-interview or cognition-memory derived analytics, and the exit-interview knowledge-transfer capability owns the interview record, its documents and its publication, not the analytics computed over many of them. These routes are organization scoped and role and entitlement gated, but they apply no sensitivity policy to what they aggregate, return fixed correlations, constant-rate forecasts and unsourced percentiles as findings, report NaN resilience as strong for an empty organization, give a constant confidence with empty evidence, and measure analytics-tool activity as governance culture. This record closes none of them and names no office that may read the analytics of privileged interviews, which no source states.',
  },
]

export const DECISIONS = [
  {
    id: 'UE-INST-EXIT-INTERVIEW-DERIVED-ANALYTICS-READERS',
    status: 'OUTSTANDING',
    question: 'Which offices may read analytics, topic maps, single-source flags and event notes derived from exit interviews classified privileged, legal_sensitive or executive_confidential, and must such interviews be excluded from, or redacted in, the aggregates that a steward or officer reads?',
    sourceState: 'The consent policy table assigns a minimum role to each sensitivity level and the AI search and summary routes apply it, while the steward and officer analytics routes aggregate every published interview, and the governance timeline every interview of the window, without reading sensitivityLevel. No adopted decision names the office or the aggregation rule.',
    softwareOwners: [CAP],
  },
]

const GET_ONLY_NOTE = 'A read: the route selects rows and writes no row and no audit record.'
const READ_AUDIT = 'Audit reads of derived exit-interview analytics once the offices that may read them are named; they summarize departing members and sensitive interviews.'
const COG_AUTHZ = 'withApi through cognitionRoute: auth.required true with minRole officer and the union_knowledge_suite entitlement (requireEntitlement refuses an organization without it). The floor is a role comparison, not an authorizeAction kernel decision, so kernelAuthorization stays false; no ownership, sensitivity or consent test follows it.'
const COG_TENANT = 'The organization comes from the authenticated membership that withApi resolves, never from the query or body; cognitionRoute hands only that organization id to the engine.'
const ANALYTICS_FUTURE = 'Decide with the institution which offices read derived exit-interview analytics for each interview sensitivity level, apply that policy to what the engines aggregate, replace literals, constant rates and unsourced curves with measured values or an explicit insufficient-data answer, and emit evidence, reasoning and a computed confidence in the envelope.'

/** Evidence common to the operations that go through cognitionRoute: the guard, the entitlement and the org hand-off. */
function cognitionGuard(a) {
  return [
    a.h('authentication', 'cognitionRoute('),
    a.imp('authentication', 'cognitionRoute', "auth: { required: true, minRole: 'officer' },"),
    a.svc('authentication', WITH_API, "return standardErrorResponse(ErrorCode.AUTH_REQUIRED, 'Authentication required', undefined, traceId);", 'withApi'),
    a.imp('authorization', 'cognitionRoute', "auth: { required: true, minRole: 'officer' },"),
    a.imp('authorization', 'cognitionRoute', "entitlement: 'union_knowledge_suite',"),
    a.svc('authorization', WITH_API, 'if (userLevel < minRoleLevel) {', 'withApi'),
    a.svc('authorization', WITH_API, 'await requireEntitlement(resolvedOrganizationId, options.entitlement, user.id);', 'withApi'),
    a.imp('tenantScope', 'cognitionRoute', 'const envelope = await engine(organizationId!);'),
    a.svc('tenantScope', WITH_API, 'if (resolved) resolvedOrganizationId = resolved;', 'withApi'),
  ]
}

const envelopeEvidence = (a, engineFile) => [
  engineFile === FOUNDATIONAL
    ? a.svc('defect', FOUNDATIONAL, 'confidenceScore: 60,', 'defineFoundationalEngine')
    : a.svc('defect', BRIDGE, 'const confidenceScore = input.confidenceFromPayload?.(payload) ?? 60;', 'adaptLegacyEngine'),
  a.svc('defect', EXPLAIN, 'evidence: input.evidence ?? [],', 'buildExplainabilityEnvelope'),
  a.svc('defect', EXPLAIN, 'reasoning: input.reasoning ?? [],', 'buildExplainabilityEnvelope'),
  a.svc('defect', SDK, 'evidence: result.evidence,', 'defineCognitionEngine'),
]

const envelopeInference = {
  claim: 'defect',
  statement: 'The engine definition passes a payload, a confidence score and interpretation guidance to the envelope builder and no evidence, reasoning, assumptions or governance implications, so the builder defaults those four lists to empty arrays for every organization, and the confidence score is the constant 60 on every call.',
}

const MEMORY_SOURCE_EVIDENCE = (a) => [
  a.svc('tenantScope', MEM, 'WHERE organization_id = ${orgId}', 'loadCognitionMemory'),
  a.svc('tenantScope', SESSIONS, 'WHERE organization_id = ${orgId}', 'listReasoningSessions'),
  a.svc('mutation', MEM, 'FROM ue_cognition_memory', 'loadCognitionMemory'),
  a.svc('defect', MEM, '${input.memoryType},', 'saveCognitionMemory'),
  a.svc('defect', MEM, '${input.resilienceScoreAtCapture ?? null},', 'saveCognitionMemory'),
]

const memoryInference = {
  claim: 'defect',
  statement: 'The cognition memory route accepts memoryType from a fixed enum, a title and an optional resilienceScoreAtCapture between 0 and 100 from the request body of an officer and stores them as given, so the counts, types, dates and scores the profile engines read are what officers entered through the analytics tools, not events recorded by the governance process.',
}

const memoryBase = (a) => ({
  service: `${APP}app/api/exit-interviews/${a.route.split('/')[1]}/route.ts (cognitionRoute over the ${a.route.split('/')[1]} engine and the cognition memory and reasoning session stores)`,
  authn: `${SESSION} (withApi auth.required true via cognitionRoute).`,
  authz: COG_AUTHZ,
  tenant: `${COG_TENANT} The engine reads ue_cognition_memory (and, where it uses them, ue_reasoning_sessions) inside the organization RLS context with an explicit organization_id predicate, and reads no local file.`,
  owner: 'Derived profile of the organization; the source rows are ue_cognition_memory and ue_reasoning_sessions entries of the organization that officers saved through the memory and reasoning-session routes.',
  sens: 'Counts, types, dates and officer-entered resilience scores of the organization cognition memory entries and reasoning sessions, shaped into a governance profile with narrative text',
  priv: 'No member or interviewee identifier is returned; the profile describes the organization from entries that officers saved, and its narrative is presented as the organization governance posture.',
  mut: 'NOT_MUTATING',
  auditDetail: GET_ONLY_NOTE,
  reqAudit: READ_AUDIT,
  gate: GATE,
  deps: [6, 13],
  future: ANALYTICS_FUTURE,
})

const memoryOp = (a, { engineSymbol, engineLine, does, persona, defectEvidence, inf, extraDefects = [] }) => mk({
  ...memoryBase(a),
  persona,
  does,
  status: 'PARTIAL',
  ev: [
    ...cognitionGuard(a),
    a.imp('behavior', engineSymbol, engineLine),
    ...MEMORY_SOURCE_EVIDENCE(a),
    ...envelopeEvidence(a, engineLine.startsWith('compute:') ? BRIDGE : FOUNDATIONAL),
    ...defectEvidence,
  ],
  inf: [memoryInference, envelopeInference, ...(inf ?? [])],
  def: [D_MEMORY, D_ENVELOPE, ...extraDefects],
})

function memoryProfileFacts(a) {
  switch (a.route) {
    case 'exit-interviews/behavior-patterns/route.ts':
      return memoryOp(a, {
        persona: 'Officer of an organization holding the union knowledge suite reading the recurring governance behaviour patterns of the organization',
        engineSymbol: 'behaviorPatternsEngine',
        engineLine: 'invoke: detectBehaviorPatterns,',
        does: 'Loads up to 100 cognition memory entries and 50 reasoning sessions of the organization and returns the behaviour patterns (resilience improvement cycle, mitigation follow-through gap, adaptive learning loop, governance stagnation, documentation momentum, resilience fragility) detected from entry types, counts, scores and dates, wrapped in a canonical envelope.',
        defectEvidence: [
          a.svc('defect', BEHAVIOR, "description: 'No continuity governance activity has been recorded. The organization lacks organizational cognition history.',", 'detectGovernanceStagnation'),
          a.svc('defect', BEHAVIOR, "evidenceStrength: 'strong',", 'detectGovernanceStagnation'),
        ],
      })
    case 'exit-interviews/governance-adaptation/route.ts':
      return memoryOp(a, {
        persona: 'Officer of an organization holding the union knowledge suite reading how its governance reasoning has adapted over its saved sessions and memory',
        engineSymbol: 'governanceAdaptationEngine',
        engineLine: 'invoke: analyzeGovernanceAdaptation,',
        does: 'Loads up to 100 cognition memory entries and 50 reasoning sessions, builds adaptation events and recurring patterns from entry types, scores and dates, and returns an adaptation health (insufficient history, actively adapting, slowly adapting or stagnant), a progression narrative and a next-focus recommendation, wrapped in a canonical envelope.',
        defectEvidence: [
          a.svc('defect', ADAPTATION, "adaptationHealth = 'stagnant';", 'analyzeGovernanceAdaptation'),
          a.svc('defect', ADAPTATION, 'events: events.slice(0, 50), // cap for performance', 'analyzeGovernanceAdaptation'),
        ],
      })
    case 'exit-interviews/governance-culture/route.ts':
      return memoryOp(a, {
        persona: 'Officer of an organization holding the union knowledge suite reading the characterization of its governance culture',
        engineSymbol: 'governanceCultureEngine',
        engineLine: 'invoke: analyzeGovernanceCulture,',
        does: 'Loads up to 100 cognition memory entries and 50 reasoning sessions and returns a dominant posture, a culture health signal, a 0 to 100 culture score, a discipline profile, indicators that carry literal confidence numbers and evolution phases, wrapped in a canonical envelope.',
        defectEvidence: [
          a.svc('defect', CULTURE, 'confidence: 85,', 'buildIndicators'),
          a.svc('defect', CULTURE, 'return `This organization ${postureDesc[posture]}. ${healthDesc[health]} Governance culture score: ${score}/100.`;', 'cultureSummary'),
        ],
      })
    case 'exit-interviews/learning-archetypes/route.ts':
      return memoryOp(a, {
        persona: 'Officer of an organization holding the union knowledge suite reading the learning archetype that classifies its governance style',
        engineSymbol: 'learningArchetypeEngine',
        engineLine: 'invoke: classifyLearningArchetype,',
        does: 'Loads up to 100 cognition memory entries and 50 reasoning sessions, scores eight archetypes from entry counts, resilience trend and volatility, and returns the primary and secondary archetype with a confidence of 40, 60 or 80 set by the interaction count, wrapped in a canonical envelope.',
        defectEvidence: [
          a.svc('defect', ARCHETYPE, '(totalInteractions === 0 ? 90 : 0) +', 'scoreFits'),
          a.svc('defect', ARCHETYPE, ': `Strongly characterized as "${primaryArchetype.name}" based on available governance history.`;', 'classifyLearningArchetype'),
        ],
      })
    case 'exit-interviews/governance-coherence/route.ts':
      return memoryOp(a, {
        persona: 'Officer of an organization holding the union knowledge suite reading the coherence of its governance decision streams',
        engineSymbol: 'governanceCoherenceEngine',
        engineLine: 'compute: evaluateGovernanceCoherence,',
        does: 'Loads up to 100 cognition memory entries and returns an overall coherence score from three dimensions computed as ratios of governance, continuity and mitigation entry counts, together with an operational overlap block, breakdown indicators and maps whose values are fixed literals; an organization with no entries gets an all-zero profile.',
        defectEvidence: [],
        extraDefects: [D_COHERENCE],
        inf: [
          { claim: 'defect', statement: 'evaluateGovernanceCoherence in organizational-dynamics/governance-coherence/coherence-engine.ts returns operationalGovernanceOverlap with overlapScore 50, ambiguousAuthority 40 and duplicationLevel 30 and the evidence Baseline overlap analysis, sets trend stable on each dimension, returns conflictingPolicies as an empty array and the governanceSilos, integrationGaps and alignedInitiatives lists as empty arrays, and gives the one possible breakdown the literal frequency 60 and recoveryTime 14, none of which is read from the memory entries.' },
          { claim: 'defect', statement: 'The three dimension scores are computed from govCount, contCount, mitCount and totalEntries as ratios (govCount over totalEntries times 200, capped at 100; govCount plus contCount over totalEntries times 150; and the smaller of govCount and contCount over the larger), so the coherence score depends on how many entries of each type were saved and on nothing about decision streams or policy text.' },
        ],
      })
    case 'exit-interviews/governance-momentum/route.ts':
      return memoryOp(a, {
        persona: 'Officer of an organization holding the union knowledge suite reading the momentum of its governance trajectory',
        engineSymbol: 'governanceMomentumEngine',
        engineLine: 'compute: modelGovernanceMomentum,',
        does: 'Loads up to 100 cognition memory entries and returns five momentum indicators and an overall momentum score computed as entry counts divided by fixed denominators, an acceleration trend label (accelerating, steady, decelerating or volatile) and a sustainability rating; an organization with no entries gets zeros and the label volatile.',
        defectEvidence: [],
        extraDefects: [D_COHERENCE],
        inf: [
          { claim: 'defect', statement: 'modelGovernanceMomentum in organizational-dynamics/momentum/momentum-engine.ts computes maturityAccel as governance entries over 10, resilienceMomentum as mitigation entries over 10, continuityVelocity as continuity entries over 8, learningAccel as total entries over 30 and sustainability as total entries over 50, each capped at 100, and derives the trend label from their mean; it reads no entry date, so the figures are cumulative counts and not a rate of change.' },
        ],
      })
    default:
      throw new Error(`no memory profile facts for ${a.route}`)
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* interview-derived analytics                                                                                    */
/* ------------------------------------------------------------------------------------------------------------ */

const interviewBase = (a, name, what) => ({
  service: `${APP}app/api/exit-interviews/${name}/route.ts (${what})`,
  authn: `${SESSION} (withApi auth.required true).`,
  tenant: `${COG_TENANT} The interview reads filter exitInterviews.organizationId to that organization and keep status published; they read no local file.`,
  mut: 'NOT_MUTATING',
  auditDetail: GET_ONLY_NOTE,
  reqAudit: READ_AUDIT,
  gate: GATE,
  deps: [6, 13],
  future: ANALYTICS_FUTURE,
})

const PROP_READ = (a) => [
  a.svc('tenantScope', PROP, 'and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, \'published\'))', 'buildDependencyPropagationMap'),
  a.svc('mutation', PROP, '.from(exitInterviews)', 'buildDependencyPropagationMap'),
  a.svc('defect', PROP, 'expertiseTags: exitInterviews.expertiseTags,', 'buildDependencyPropagationMap'),
  a.svc('defect', PROP, 'associatedRoles: topic.contributingRoles,', 'buildDependencyPropagationMap'),
]

const sensitivityInference = {
  claim: 'defect',
  statement: 'The interview select of this route chain lists status published and the organization as its only row filters and never selects or tests exitInterviews.sensitivityLevel, so a published interview classified privileged, legal_sensitive or executive_confidential contributes its topics, tags and roles to the response exactly as a public_internal one does.',
}

const resilienceNanEvidence = (a) => [
  a.svc('defect', RESIL, 'const avgFrequency = propagationMap.nodes.reduce((sum, node) => sum + node.frequency, 0) / totalNodes;', 'calculateRedundancyScore'),
  a.svc('defect', RESIL, "return 'strong';", 'statusFromScore'),
]

const nanInference = {
  claim: 'defect',
  statement: 'buildDependencyPropagationMap returns an empty node list when no interview is published and calculateResilienceIndex then divides by the zero node count, producing NaN scores; NaN fails every comparison in statusFromScore, which therefore returns strong, and JSON serialization turns the NaN numbers into null while string templates print NaN.',
}

function analyticsFacts(a) {
  switch (a.route) {
    case 'exit-interviews/adaptive-resilience/route.ts':
      return mk({
        ...interviewBase(a, 'adaptive-resilience', 'cognitionRoute over the adaptive resilience engine, the cognition memory store and the resilience roadmap'),
        persona: 'Officer of an organization holding the union knowledge suite reading continuity strategies re-ranked by the organization saved mitigation history',
        authz: COG_AUTHZ,
        owner: 'Derived roadmap of the organization: strategies from a fixed catalog selected from the interview-derived resilience index, re-weighted by ue_cognition_memory entries that officers saved.',
        sens: 'Strategy names, original and adapted priorities, projected resilience gains, adaptation reasons and the count of memory entries used',
        priv: 'No interviewee identifier or interview text is returned; the strategies come from a fixed catalog and the adaptation reasons count memory entries.',
        does: 'Builds the resilience roadmap from the published interviews, loads up to 100 cognition memory entries, re-weights each strategy priority and gain by mitigation and improvement counts and returns the adapted list with an overall confidence label derived from the entry count, wrapped in a canonical envelope.',
        status: 'PARTIAL',
        ev: [
          ...cognitionGuard(a),
          a.imp('behavior', 'adaptiveResilienceEngine', 'invoke: computeAdaptiveResilience,'),
          a.svc('tenantScope', MEM, 'WHERE organization_id = ${orgId}', 'loadCognitionMemory'),
          a.svc('mutation', MEM, 'FROM ue_cognition_memory', 'loadCognitionMemory'),
          a.svc('behavior', ADAPTIVE, "historicalEvidence: evidence,", 'computeAdaptiveResilience'),
          a.svc('defect', STRAT, "if (resilienceIndex.dimensions.find((d) => d.name === 'Documentation Maturity')?.score ?? 0 < 65) {", 'buildResilienceRoadmap'),
          a.svc('defect', MEM, '${input.memoryType},', 'saveCognitionMemory'),
          ...envelopeEvidence(a, FOUNDATIONAL),
        ],
        inf: [
          envelopeInference,
          memoryInference,
          { claim: 'defect', statement: 'In JavaScript the expression score ?? 0 < 65 groups as score ?? (0 < 65); the right operand is used only when the score is null or undefined, so any defined documentation score is the condition itself: nonzero scores (including 100) select the documentation strategy, and a score of 0 or NaN does not.' },
        ],
        def: [D_ROADMAP, D_MEMORY, D_ENVELOPE],
      })
    case 'exit-interviews/cascade-analysis/route.ts':
      return mk({
        ...interviewBase(a, 'cascade-analysis', 'cognitionRoute over the cascade analyzer and the dependency propagation map'),
        persona: 'Officer of an organization holding the union knowledge suite reading how a governance gap cascades through the operations it supports',
        authz: COG_AUTHZ,
        owner: 'Derived analysis of the organization: governance and compliance topic nodes taken from the tags and topics of its published exit interviews and the topics they co-occur with.',
        sens: 'Topic labels of governance and compliance nodes, the identifiers of the nodes they impact, severity, cascade depth and fixed recommendation strings, derived from the topics and expertise tags of departing members of every sensitivity level',
        priv: 'No interviewee name or text is returned, but topic labels and contributing roles come from interviews of every sensitivity level and a single-source topic points at one interview.',
        does: 'Builds the dependency propagation map from the published interviews, keeps the governance and compliance nodes, lists the topics each one impacts, prefixes every impacted topic with Regulatory continuity risk and returns three fixed recommendations, wrapped in a canonical envelope.',
        status: 'PARTIAL',
        ev: [
          ...cognitionGuard(a),
          a.imp('behavior', 'cascadeRisksEngine', 'invoke: analyzeCascadeRisks,'),
          ...PROP_READ(a),
          a.svc('defect', CASCADE, '].map((area) => `Regulatory continuity risk: ${area}`);', 'analyzeCascadeRisks'),
          a.svc('defect', CASCADE, "'Formalize all governance procedures',", 'analyzeCascadeRisks'),
          a.svc('defect', CASCADE, "filter((node) => node.category === 'governance' || node.category === 'compliance')", 'analyzeCascadeRisks'),
          ...envelopeEvidence(a, FOUNDATIONAL),
        ],
        inf: [sensitivityInference, envelopeInference, {
          claim: 'defect',
          statement: 'The regulatoryRisks list is built from impact.allAffectedNodes of every governance or compliance node and each entry receives the same prefix regardless of what the affected node is, and the recommendations array holds three string literals returned on every call.',
        }],
        def: [D_SENSITIVITY, D_CASCADE, D_ENVELOPE],
      })
    case 'exit-interviews/decision-brief/route.ts':
      return mk({
        ...interviewBase(a, 'decision-brief', 'cognitionRoute over the decision engine, the dependency map, the resilience index and the forecast'),
        persona: 'Officer of an organization holding the union knowledge suite reading the prioritized continuity decision brief that the continuity planning page shows',
        authz: COG_AUTHZ,
        owner: 'Derived brief of the organization: recommendations, evidence items, a reasoning chain and an executive summary built from its published interviews through the dependency map, the resilience index and the continuity forecast.',
        sens: 'Recommendation headlines naming single-source topic labels, evidence observations with literal confidence labels, a continuity score and status, and an executive summary, derived from interviews of every sensitivity level',
        priv: 'No interviewee name or text is returned, but topic labels of single-source knowledge, a continuity score and the forecast come from interviews of every sensitivity level.',
        does: 'Builds the dependency map, resilience index and forecast from the published interviews and returns up to four recommendations (single-source dependencies, governance, documentation, vendor) with evidence labelled high or medium confidence as literals, the continuity score and status, strengths, critical gaps and an executive summary sentence, wrapped in a canonical envelope.',
        status: 'PARTIAL',
        ev: [
          ...cognitionGuard(a),
          a.imp('behavior', 'decisionBriefEngine', 'invoke: generateDecisionBrief,'),
          ...PROP_READ(a),
          a.svc('defect', DECISION, "confidence: 'high',", 'buildSingleSourceRecommendation'),
          a.svc('defect', DECISION, ': `Organization demonstrates strong continuity resilience (score: ${score}/100). Focus on sustaining and extending current strengths.`;', 'generateDecisionBrief'),
          a.svc('defect', DECISION, '`Forecast: continuity health is ${forecast.trendDirection} over the next 12 months.`,', 'generateDecisionBrief'),
          ...resilienceNanEvidence(a),
          a.svc('defect', FORECAST, 'const projectedRedundancy = Math.max(currentMetrics.averageRedundancy - redundancyErosion * month, 1);', 'projectFutureTrends'),
          ...envelopeEvidence(a, FOUNDATIONAL),
        ],
        inf: [sensitivityInference, nanInference, envelopeInference, {
          claim: 'defect',
          statement: 'generateDecisionBrief awaits forecastContinuityTrends beside the dependency map and the resilience index and writes the trend direction and the score into its executive summary and current-state text; the projection rates and the NaN behaviour of those two functions therefore reach the brief, and the evidence confidence values high and medium are string literals in the recommendation builders, not computed.',
        }],
        def: [D_SENSITIVITY, D_NAN, D_FORECAST, D_RATINGS, D_ENVELOPE],
      })
    case 'exit-interviews/federated-benchmarking/route.ts':
      return mk({
        ...interviewBase(a, 'federated-benchmarking', 'cognitionRoute over the federated benchmark engine, the resilience index and the cognition memory store'),
        persona: 'Officer of an organization holding the union knowledge suite reading where its continuity maturity sits against a reference distribution',
        authz: COG_AUTHZ,
        owner: 'Derived benchmark of the organization: its resilience index score placed on a reference distribution and cohort averages that are literals in the engine, with the previous score from its memory timeline.',
        sens: 'The resilience score, cohort, an estimated percentile, per-dimension gaps to a cohort average and the whole reference distribution',
        priv: 'No data of another organization is read or returned; the reference curve is written in the engine, and the figures describe only the caller organization.',
        does: 'Computes the resilience index of the organization, maps its overall score to a cohort and an interpolated percentile on eight literal reference points, compares each dimension with a literal cohort average, adds the previous score from up to 50 memory entries and returns the position, comparisons, the reference distribution and a disclaimer, wrapped in a canonical envelope.',
        status: 'PARTIAL',
        ev: [
          ...cognitionGuard(a),
          a.imp('behavior', 'federatedBenchmarkEngine', 'invoke: generateFederatedBenchmark,'),
          a.svc('tenantScope', RESIL, "and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, 'published'))", 'loadPublishedInterviews'),
          a.svc('tenantScope', MEM, 'WHERE organization_id = ${orgId}', 'loadCognitionMemory'),
          a.svc('mutation', RESIL, '.from(exitInterviews)', 'loadPublishedInterviews'),
          a.svc('defect', FED, "{ percentile: 50, scoreAtPercentile: 52, cohortLabel: 'developing', description: 'Median organizational continuity posture — moderate resilience with known gaps.' },", 'REFERENCE_DISTRIBUTION'),
          a.svc('defect', FED, 'nascent: 10,', 'COHORT_DIMENSION_AVERAGES'),
          a.svc('defect', FED, 'return 97;', 'scoreToPercentile'),
          a.svc('defect', FED, '`At ${percentile}th percentile, this organization\'s continuity posture is ${cohort}-level.`,', 'generateFederatedBenchmark'),
          ...resilienceNanEvidence(a),
          ...envelopeEvidence(a, FOUNDATIONAL),
        ],
        inf: [nanInference, envelopeInference, {
          claim: 'defect',
          statement: 'scoreToPercentile compares the score with each pair of reference points and falls through to 97 when no comparison holds, which is the case for NaN, and scoreToCohort returns nascent for a score that matches no band; the reference points and cohort averages are literals with no source, population or date in the file.',
        }],
        def: [D_FEDERATED, D_NAN, D_ENVELOPE],
      })
    case 'exit-interviews/forecasting/route.ts':
      return mk({
        ...interviewBase(a, 'forecasting', 'cognitionRoute over the continuity forecaster and the dependency propagation map'),
        persona: 'Officer of an organization holding the union knowledge suite reading the twelve-month continuity forecast',
        authz: COG_AUTHZ,
        owner: 'Derived forecast of the organization: a rebuilt monthly history, twelve projected months, tracked risks and thresholds computed from its published interviews and the dependency map.',
        sens: 'Monthly health score, single-source count, redundancy, governance maturity, undocumented and vendor concentration risk for the past and next twelve months, tracked risks and recommendations',
        priv: 'No interviewee identifier or text is returned; the series are organization-level figures derived from interviews of every sensitivity level.',
        does: 'Builds the dependency map and the published-interview list, rebuilds a 13-point history from interview dates, projects twelve months with fixed monthly rates, derives a trend direction and tracked risks, and returns a confidence of 50 to 85 from the interview and node counts, wrapped in a canonical envelope.',
        status: 'PARTIAL',
        ev: [
          ...cognitionGuard(a),
          a.imp('behavior', 'continuityForecastEngine', 'invoke: forecastContinuityTrends,'),
          a.svc('tenantScope', FORECAST, "and(eq(exitInterviews.organizationId, orgId), eq(exitInterviews.status, 'published'))", 'loadPublishedInterviews'),
          a.svc('mutation', FORECAST, '.from(exitInterviews)', 'loadPublishedInterviews'),
          a.svc('defect', FORECAST, 'const projectedRedundancy = Math.max(currentMetrics.averageRedundancy - redundancyErosion * month, 1);', 'projectFutureTrends'),
          a.svc('defect', FORECAST, 'const redundancyErosion = -0.2; // -0.2 average per month', 'projectFutureTrends'),
          a.svc('defect', FORECAST, 'vendorConcentrationRisk: 40,', 'buildHistoricalTrendData'),
          a.svc('defect', FORECAST, 'healthScore: 60,', 'buildHistoricalTrendData'),
          a.svc('defect', FORECAST, 'if (change > 5) return \'improving\' as const;', 'determineTrendDirection'),
          a.svc('defect', FORECAST, 'const avgFrequency = propagationMap.nodes.reduce((sum, node) => sum + node.frequency, 0) / totalNodes;', 'buildCurrentMetrics'),
          ...envelopeEvidence(a, FOUNDATIONAL),
        ],
        inf: [nanInference, envelopeInference, {
          claim: 'defect',
          statement: 'The projected health is a weighted sum in which redundancy (projectedRedundancy times 20, weight 0.2) grows by 0.8 per month because the negative erosion is subtracted, while concentration growth costs 0.09 and the governance drift costs 0.125 per month, so each month adds about 0.58 points and the twelve-month change exceeds 5 whenever health stays below 100, which determineTrendDirection reports as improving.',
        }],
        def: [D_FORECAST, D_NAN, D_ENVELOPE],
      })
    case 'exit-interviews/expertise-map/route.ts':
      return mk({
        ...interviewBase(a, 'expertise-map', 'withApi over exit_interviews, aggregated in the handler'),
        persona: 'Steward of an organization holding the union knowledge suite reading which expertise domains have one holder and which have several',
        authz: 'withApi auth.required true with minRole steward and the union_knowledge_suite entitlement. The floor is a role comparison, not an authorizeAction kernel decision, so kernelAuthorization stays false; the route applies no sensitivity, consent or ownership test to the interviews it aggregates.',
        owner: 'Exit-interview rows of the organization (status published): role in union, expertise tags, topics and continuity risk score are aggregated into a domain coverage map.',
        sens: 'Expertise and topic tags of departing members, the role in union of the interviews behind each tag, single-source flags and the mean continuity risk score, which for a single-source tag is the score of one interview',
        priv: 'No interviewee name is returned, but a single-source row names the role of the one interview that holds the tag and its risk score, and tags come from interviews of every sensitivity level.',
        does: 'Reads the published exit interviews of the organization with their role, tags, topics and risk score, merges tags and topics into a domain map with coverage count, roles, a single-source flag, the mean risk score and a risk level (critical when one interview mentions the tag), and returns the domains with single-source and well-covered lists and a category breakdown.',
        status: 'PARTIAL',
        ev: [
          ...guardEv(a, 'withApi').filter((item) => item.claim !== 'authorization'),
          a.h('authorization', "auth: { required: true, minRole: 'steward' },"),
          a.imp('authorization', 'withApi', 'const minRoleLevel = options.auth?.minRole'),
          a.h('authorization', "entitlement: 'union_knowledge_suite',"),
          a.imp('authorization', 'withApi', 'await requireEntitlement(resolvedOrganizationId, options.entitlement, user.id);'),
          a.h('tenantScope', 'eq(exitInterviews.organizationId, organizationId!),'),
          a.h('tenantScope', "eq(exitInterviews.status, 'published'),"),
          a.h('mutation', '.select({'),
          a.h('defect', 'roleInUnion: exitInterviews.roleInUnion,'),
          a.h('defect', 'existing.roles.add(interview.roleInUnion);'),
          a.h('defect', 'riskLevel: riskLevel(data.coverageCount, isSingleSource),'),
          a.h('defect', 'data.riskCount > 0 ? Math.round(data.totalRisk / data.riskCount) : 0,'),
          a.local('defect', 'riskLevel', "if (isSingleSource) return coverageCount === 1 ? 'critical' : 'high';"),
          a.local('defect', 'categorizeDomain', 'if (SYSTEM_KEYWORDS.some((k) => lower.includes(k))) return \'system\';'),
          a.tbl('defect', 'exitInterviews', "sensitivityLevel: exitInterviewSensitivityEnum('sensitivity_level').notNull().default('public_internal'),"),
        ],
        inf: [sensitivityInference, {
          claim: 'defect',
          statement: 'riskLevel returns critical for any tag whose coverageCount is 1, so each tag that a single interview happens to mention is rated critical, and the averageRiskScore of that row is the continuityRiskScore of that one interview or 0 when it has none; no minimum group size, suppression or sensitivity filter applies before the role and score are returned.',
        }],
        def: [D_SENSITIVITY, D_RATINGS],
      })
    case 'exit-interviews/governance-timeline/route.ts':
      return mk({
        ...interviewBase(a, 'governance-timeline', 'withApi over exit_interview_events and exit_interviews, aggregated in the handler'),
        persona: 'Officer of an organization holding the union knowledge suite reading the governance event timeline and review drift of the exit-interview programme',
        authz: 'withApi auth.required true with minRole officer and the union_knowledge_suite entitlement. The floor is a role comparison, not an authorizeAction kernel decision, so kernelAuthorization stays false; the route applies no sensitivity, consent or ownership test to the events and interviews it summarizes.',
        owner: 'exit_interview_events (up to 500 of the last six months) and exit_interviews rows of the organization of every status created in the last six months; the event notes are free text written by reviewers and officers.',
        sens: 'Event types and free-text notes of governance, publish, review, index and summary events, the ids of interviews awaiting review, the distribution of sensitivity levels, indexing status and counts of the interviews of the window',
        priv: 'The timeline feed returns the event notes and interview ids as written, and the stale review ids are those of submitted, unpublished interviews; the actor user id is read but not returned.',
        does: 'Reads the events of the last six months (limit 500) and every interview created in that window, counts events by type, finds submitted interviews older than 14 days, counts governance updates in the last 30 days, the sensitivity and indexing distributions, and returns a feed of up to 50 events with their notes.',
        status: 'PARTIAL',
        ev: [
          ...guardEv(a, 'withApi').filter((item) => item.claim !== 'authorization'),
          a.h('authorization', "auth: { required: true, minRole: 'officer' },"),
          a.imp('authorization', 'withApi', 'const minRoleLevel = options.auth?.minRole'),
          a.h('authorization', "entitlement: 'union_knowledge_suite',"),
          a.imp('authorization', 'withApi', 'await requireEntitlement(resolvedOrganizationId, options.entitlement, user.id);'),
          a.h('tenantScope', 'eq(exitInterviewEvents.organizationId, orgId),'),
          a.h('tenantScope', 'eq(exitInterviews.organizationId, orgId),'),
          a.h('mutation', '.from(exitInterviewEvents)'),
          a.h('defect', 'notes: e.notes,'),
          a.h('defect', 'staleReviewIds: staleReviews.map((i) => i.id),'),
          a.h('defect', '.limit(500),'),
          a.h('defect', 'sensitivityLevel: exitInterviews.sensitivityLevel,'),
          a.tbl('defect', 'exitInterviewEvents', 'notes: text(\'notes\'),'),
        ],
        inf: [sensitivityInference, {
          claim: 'defect',
          statement: 'The event select applies the organization, the six-month lower bound and limit 500 and no status or sensitivity predicate, the interview select has no limit and no status predicate, and the counts (eventTypeCounts, governanceUpdatesLast30Days) are computed over the capped event array without any truncation marker in the response.',
        }],
        def: [D_SENSITIVITY, D_TIMELINE],
      })
    default:
      throw new Error(`no interview analytics facts for ${a.route}`)
  }
}

/* ------------------------------------------------------------------------------------------------------------ */
/* cross-domain correlation                                                                                       */
/* ------------------------------------------------------------------------------------------------------------ */

function correlationFacts(a) {
  return mk({
    service: `${APP}app/api/exit-interviews/cross-domain-correlation/route.ts (cognitionRoute over identifyInstitutionalCorrelations)`,
    persona: 'Officer of an organization holding the union knowledge suite asking for the correlations among its governance, continuity, procedural and trust signals',
    authn: `${SESSION} (withApi auth.required true via cognitionRoute).`,
    authz: COG_AUTHZ,
    tenant: `${COG_TENANT} The only organization data the engine reads is the entry count of ue_cognition_memory for that organization; every other field of the response is a literal.`,
    owner: 'No stored analytic: the correlations, indicators, insights and narrative are literals in the engine; only entriesAnalyzed comes from the organization cognition memory.',
    sens: 'Five named correlation pairs with strengths, three fragility indicators, three operating insights, a narrative and the count of memory entries',
    priv: 'No personal data is returned; the response is the same text for every organization except the entry count.',
    mut: 'NOT_MUTATING',
    auditDetail: GET_ONLY_NOTE,
    reqAudit: READ_AUDIT,
    does: 'Loads up to 100 cognition memory entries only to count them and returns five fixed correlation pairs (strengths 0.75, 0.65, 0.60, 0.70, 0.80), three fixed fragility indicators, three fixed insights and the narrative that the organization shows strong correlations, with HTTP 200 for every organization.',
    status: 'NOT_IMPLEMENTED_RETURNS_200',
    gate: GATE,
    deps: [6, 13],
    future: 'Return HTTP 501 until a correlation is computed from organization data; when implemented, derive each strength from observed series, state the sample size and confidence, and return insufficient data for an empty organization.',
    ev: [
      ...cognitionGuard(a),
      a.imp('behavior', 'crossDomainCorrelationEngine', 'compute: identifyInstitutionalCorrelations,'),
      a.svc('tenantScope', MEM, 'WHERE organization_id = ${orgId}', 'loadCognitionMemory'),
      a.svc('mutation', MEM, 'FROM ue_cognition_memory', 'loadCognitionMemory'),
      a.svc('behavior', CORRELATION, "{ dimension1: 'Governance fragmentation', dimension2: 'Continuity fragility', correlation_strength: 0.75, impact: 'high' },", 'identifyInstitutionalCorrelations'),
      a.svc('defect', CORRELATION, "{ dimension1: 'Operational trust', dimension2: 'Continuity maturity', correlation_strength: 0.80, impact: 'high' },", 'identifyInstitutionalCorrelations'),
      a.svc('defect', CORRELATION, "correlation_narrative: 'Organization shows strong correlations between governance discipline, continuity capability, and resilience maturity.',", 'identifyInstitutionalCorrelations'),
      a.svc('defect', CORRELATION, 'entriesAnalyzed: memory.totalEntries,', 'identifyInstitutionalCorrelations'),
      ...envelopeEvidence(a, BRIDGE),
    ],
    inf: [
      envelopeInference,
      { claim: 'defect', statement: 'No statement of identifyInstitutionalCorrelations computes a correlation: the memory it loads is read only for totalEntries, and the correlation pairs, indicators, insights and narrative are array and string literals returned on every call, including for an organization with zero entries.' },
    ],
    def: [D_CORRELATION, D_ENVELOPE],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* continuity risk (model assisted)                                                                              */
/* ------------------------------------------------------------------------------------------------------------ */

function riskFacts(a) {
  return mk({
    service: `${APP}app/api/exit-interviews/continuity-risk/route.ts (withApi over detectContinuityRisks, which reads exit_interviews and calls the AI client)`,
    persona: 'Officer of an organization holding the union knowledge suite asking for the model-assisted continuity risk report over its published exit interviews',
    authn: `${SESSION} (withApi auth.required true).`,
    authz: 'withApi auth.required true with minRole officer and the union_knowledge_suite entitlement, then a second in-handler comparison of the role against the officer level (hasOfficerPrivileges). Both are role comparisons, not an authorizeAction kernel decision, so kernelAuthorization stays false; no sensitivity, consent or AI feature guard follows them.',
    tenant: `${COG_TENANT} The interview read filters exitInterviews.organizationId to that organization and status published; the organization id passed to the model is the system organization, with the domain organization only in the trace.`,
    owner: 'Exit-interview rows of the organization (status published); the report is derived, and the model reply is an unstored external result.',
    sens: 'Role in union, years of service, title, expertise tags and topics of every published interview sent to a model, and returned: single-source topics, isolated expertise tags, coverage gaps, a risk score and model-written risk flags with affected roles and topic areas',
    priv: 'Interview titles, roles and years of service of departing members of every sensitivity level leave the application in the model prompt without a consent or sensitivity check or an AI interaction audit record; the response returns roles and topic labels, not names.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read of the interview table that then calls the model; the route writes no row and no audit record, and no AI interaction audit record is written either.',
    reqAudit: 'Record each model call (profile, organization, number of interviews, sensitivity levels included) and audit reads of the report once the offices that may read it are named.',
    does: 'Reads every published interview of the organization, computes single-source topics, isolated expertise, coverage gaps against a literal role list and a capped weighted risk score, sends the role, years, title, tags and topics of all of them to a model, parses the reply as JSON into risk flags and an executive summary, and returns the report; with no interview it returns score 0 and a begin-capturing sentence without calling the model.',
    status: 'PARTIAL',
    gate: GATE,
    deps: [6, 13, 14],
    future: 'Apply the AI feature guard, the AI safety check and an AI interaction audit record to the model call, exclude or redact interviews above the sensitivity the institution allows for model processing and respect the consent flag, validate the model reply against a schema, and return an explicit failure instead of an empty report when the reply cannot be used.',
    ev: [
      ...guardEv(a, 'withApi').filter((item) => item.claim !== 'authorization'),
      a.h('authorization', "auth: { required: true, minRole: 'officer' },"),
      a.imp('authorization', 'withApi', 'const minRoleLevel = options.auth?.minRole'),
      a.h('authorization', "entitlement: 'union_knowledge_suite',"),
      a.imp('authorization', 'withApi', 'await requireEntitlement(resolvedOrganizationId, options.entitlement, user.id);'),
      a.h('authorization', "throw ApiError.forbidden('Officer-level access required');"),
      a.h('tenantScope', 'const report = await detectContinuityRisks(organizationId!);'),
      a.imp('tenantScope', 'detectContinuityRisks', 'eq(exitInterviews.organizationId, orgId),'),
      a.imp('mutation', 'detectContinuityRisks', '.from(exitInterviews)'),
      a.imp('behavior', 'detectContinuityRisks', 'const ai = getAiClient();'),
      a.imp('behavior', 'detectContinuityRisks', "{ role: 'user', content: buildRiskInput(publishedInterviews) },"),
      a.imp('defect', 'detectContinuityRisks', "dataClass: 'internal',"),
      a.imp('defect', 'detectContinuityRisks', 'orgId: UE_SYSTEM_ORG_ID,'),
      a.imp('defect', 'detectContinuityRisks', 'const parsed = JSON.parse(result.content) as {'),
      a.imp('defect', 'detectContinuityRisks', 'executiveSummary = `${publishedInterviews.length} exit interviews analyzed. Manual review recommended.`;'),
      a.svc('defect', RISK, '`[${i.roleInUnion}, ${i.yearsOfService}y] ${i.title}\\n` +', 'buildRiskInput'),
      a.svc('defect', RISK, "const allRoles = ['steward', 'chief_steward', 'officer', 'admin'];", 'detectCoverageGaps'),
      a.svc('defect', RISK, 'if (params.totalInterviews === 0) return 0;', 'computeRiskScore'),
      a.sch('defect', EXIT_SCHEMA, "sensitivityLevel: exitInterviewSensitivityEnum('sensitivity_level').notNull().default('public_internal'),", { symbol: 'exitInterviews' }),
    ],
    inf: [
      sensitivityInference,
      {
        claim: 'defect',
        statement: 'Neither the route nor detectContinuityRisks imports or calls guardAiFeature, an AI safety check or auditAiInteraction, selects consentGranted or sensitivityLevel, or validates the parsed reply, so every published interview reaches the model whatever its classification and consent, and the reply is returned as parsed.',
      },
      {
        claim: 'defect',
        statement: 'The JSON.parse is inside a try block whose catch only sets the manual-review sentence, so an unusable reply returns HTTP 200 with empty riskFlags and the rule-based score, while the ai.generate call is outside the try block and its rejection propagates to the route wrapper.',
      },
    ],
    def: [D_SENSITIVITY, D_RISK_MODEL, D_RATINGS],
  })
}

/* ------------------------------------------------------------------------------------------------------------ */
/* legacy slug redirects                                                                                          */
/* ------------------------------------------------------------------------------------------------------------ */

function redirectFacts(a) {
  const slug = a.route.split('/')[1].replace('institutional-', '')
  const target = `/api/exit-interviews/organizational-${slug}`
  return mk({
    service: `${APP}app/api/exit-interviews/${a.route.split('/')[1]}/route.ts (plain redirect handler to ${target})`,
    persona: `External integration or browser still calling the legacy institutional-${slug} slug`,
    authn: 'None: the handler is a plain function with no session check; it reads nothing and redirects every caller, so authentication is enforced only by the route it redirects to.',
    cat: 'NONE_PUBLIC',
    authz: `No authentication and no role check in the handler. The 308 response carries no data; the target route ${target} applies its own guard when the client follows the redirect.`,
    tenant: 'None: the handler reads no organization data and no session; it rewrites the request pathname and keeps the origin and query string.',
    owner: 'No stored data: the response is a redirect with a Location header and no body.',
    sens: 'Only the redirect location, which is the request URL with the pathname replaced by the organizational slug',
    priv: 'No personal or organization data is returned; the query string of the request is copied into the Location header.',
    mut: 'NOT_MUTATING',
    auditDetail: GET_ONLY_NOTE,
    reqAudit: 'No audit is required for a pure redirect; the redirect target audits whatever it serves, and the slug should be retired once integrations move.',
    does: `Rewrites the request pathname to ${target} and answers 308 permanent redirect; it reads no data and runs no guard, and a client that follows it reaches the officer-guarded route.`,
    status: 'IMPLEMENTED_IN_SOURCE',
    gate: GATE,
    deps: [13],
    future: 'Keep the handler a pure redirect that reads and returns no data, list it in the public-route allowlist and the route manifest detector so it stops reading as unauthenticated, and retire it when external integrations use the organizational slug.',
    ev: [
      a.h('authentication', 'export function GET(request: Request) {'),
      a.h('authorization', 'export function GET(request: Request) {'),
      a.h('tenantScope', `url.pathname = '${target}';`),
      a.h('mutation', 'return NextResponse.redirect(url, 308);'),
      a.h('behavior', 'return NextResponse.redirect(url, 308);'),
      a.h('privacy', 'return NextResponse.redirect(url, 308);'),
      a.h('defect', `url.pathname = '${target}';`),
    ],
    inf: [{
      claim: 'defect',
      statement: 'The handler contains no call to getCurrentUser, withApi, a database module or the request body, so it exposes no data; the only recorded problems are the earlier register defects that the route is absent from the public-route allowlists and the route manifest detector.',
    }],
    def: ['DEF-0B1-ALLOWLIST-DRIFT', 'DEF-0B1-MANIFEST-DETECTOR'],
  })
}

export function facts(a) {
  if (MEMORY_PROFILE_ROUTES.includes(a.route)) return memoryProfileFacts(a)
  if (INTERVIEW_ANALYTICS_ROUTES.includes(a.route)) return analyticsFacts(a)
  if (CORRELATION_ROUTES.includes(a.route)) return correlationFacts(a)
  if (RISK_ROUTES.includes(a.route)) return riskFacts(a)
  if (REDIRECT_ROUTES.includes(a.route)) return redirectFacts(a)
  throw new Error(`no exit-cognition-a facts for ${a.route}`)
}
