/**
 * Gate 0B.7 facts for the core exit-interview routes (records, documents, governance, review and publication, search,
 * template, summaries, copilot, and the cognition and analytics routes that sit directly under exit-interviews).
 *
 * The record routes are hand-written withApi handlers over exit_interviews. Their write paths commit the row, the event
 * and persistAtomicAudit in one tenant transaction and are the best-formed code of the domain. The gaps are on the read
 * and derivation side: the list, item and document reads and the knowledge-base copy made at publication apply no
 * sensitivity level or consent condition, although the search, summary and AI routes do; consent and classification are
 * administrator-asserted and withdraw nothing already derived; publication sends the interview text to the AI control
 * plane for every sensitivity level; and the scenario, simulation, comparison, graph, memory and session routes derive
 * from every published interview and return fixed or caller-asserted figures as modelled results.
 *
 * Ownership: the interview record, document, governance, publication, search and template routes belong to the shared
 * UE-OMIT-EXIT-INTERVIEW-KNOWLEDGE-TRANSFER capability this module creates; the summary and copilot routes send content to
 * a model and belong to UE-OMIT-AI-ADVISORY-GOVERNANCE; the derived cognition and analytics routes belong to
 * UE-OMIT-EXIT-INTERVIEW-COGNITION-ANALYTICS, created by another module and only referenced here.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { APP, guardEv } from './ue-gate0b4-fact-helpers.mjs'

export const KT = 'UE-OMIT-EXIT-INTERVIEW-KNOWLEDGE-TRANSFER'
const AI = 'UE-OMIT-AI-ADVISORY-GOVERNANCE'
const COG = 'UE-OMIT-EXIT-INTERVIEW-COGNITION-ANALYTICS'
const GATE = 14
const API_DIR = `${APP}app/api/exit-interviews/`

const SCHEMA_EI = `${APP}db/schema/domains/infrastructure/exit-interviews.ts`
const SCHEMA_RT = `${APP}db/schema/domains/ml/knowledge-transfer-runtime.ts`
const KT_LIB = `${APP}lib/knowledge-transfer/`
const CONSENT = `${KT_LIB}governance/consent-controls.ts`
const INDEXER = `${KT_LIB}indexing/semantic-indexer.ts`
const HYBRID = `${KT_LIB}search/hybrid-search.ts`
const SUMMARIZER = `${KT_LIB}summaries/knowledge-summarizer.ts`
const EXTRACTOR = `${KT_LIB}expertise/expertise-extractor.ts`
const MEMORY = `${KT_LIB}cognition-memory/memory-store.ts`
const SESSIONS = `${KT_LIB}reasoning-sessions/session-manager.ts`
const COPILOT = `${KT_LIB}copilot/copilot-engine.ts`
const RESPONSE_BUILDER = `${KT_LIB}copilot-explainability/response-builder.ts`
const SIMULATOR = `${KT_LIB}simulation/continuity-simulator.ts`
const SCENARIOS = `${KT_LIB}scenarios/scenario-modeler.ts`
const MITIGATION = `${KT_LIB}mitigation-comparison/mitigation-comparator.ts`
const MITIGATION_MODELS = `${KT_LIB}mitigation-comparison/mitigation-models.ts`
const GRAPH = `${KT_LIB}graph-query/graph-reasoner.ts`
const PROPAGATION = `${KT_LIB}propagation/dependency-propagator.ts`
const TOPIC_GRAPH = `${KT_LIB}topic-graph/topic-graph-builder.ts`
const KB_LIST = `${APP}app/api/knowledge-base/route.ts`
const KB_ITEM = `${APP}app/api/knowledge-base/[id]/route.ts`
const AI_SUMMARIZE = `${APP}app/api/ai/summarize/route.ts`

const ev = (ref, quote) => ({ kind: 'file', ref, quote })
const D = (id, ownerCapabilityId, severity, title, releaseDisposition) => ({
  id, gate: GATE, severity, title, ownerCapabilityId, ...(releaseDisposition ? { releaseDisposition } : {}),
})

const D_READERS = 'UE-INST-EXIT-INTERVIEW-RECORD-READERS'

export const DECISIONS = [
  {
    id: D_READERS,
    status: 'OUTSTANDING',
    question: 'Which offices may read the full text, attached documents and transcripts, event notes and AI summary of an exit interview at each sensitivity level, is the consent of the retiring member a precondition of publication, of reading and of any model or search use, who may record that consent or its withdrawal on the retiree behalf, and who owns the knowledge archive that the published copy lives in?',
    sourceState: 'The code carries two incompatible answers. SENSITIVITY_MIN_ROLE names a minimum role per level (member, steward, officer, admin) and the search, summary and AI routes apply it, while the interview list, the interview item, the document list and the knowledge-base copy made at publication are readable by any member of the organization at every level. Consent defaults to false, gates only the embedding step, and is recorded by an administrator, not by the retiree. No source names an archive owner, a records officer or a legal-review step for legal_sensitive interviews.',
    softwareOwners: [KT],
  },
]

export const DEFECTS = [
  D('DEF-0B7-EXC-READS-IGNORE-SENSITIVITY-LEVEL', KT, 'HIGH', 'The interview list, the interview item (with its events and attached documents) and the document list return published and archived interviews to any member of the organization with no sensitivity level or consent condition: the whole row, including the full interview text, the retiring employee name, the retirement reason, the AI summary, the risk score and the user ids, and the transcripts and file URLs of the attachments, are returned for privileged, legal_sensitive and executive_confidential interviews, although SENSITIVITY_MIN_ROLE assigns those levels to officer and admin and the search, summary and AI routes enforce it.', {
    disposition: 'RELEASE_BLOCKING',
    actualExposure: 'Any member of an organization that holds the union_knowledge_suite entitlement (the three reads are minRole member) can list up to 200 published or archived interviews and open any of them with its events and attached documents. Each response carries the whole row and the transcripts whatever sensitivity level an administrator assigned, so a legal_sensitive or executive_confidential interview is read in full by the lowest role.',
    potentialImpact: {
      classes: ['SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
      description: 'Bargaining advice, mediation tactics and case knowledge classified as privileged, legal sensitive or executive confidential, and the personal reason a named retiree left (including health), are readable by every member of the organization, defeating the classification an administrator sets and the legal-review expectation the governance module states.',
    },
    activationState: 'REACHABLE_ENTITLEMENT_GATED',
    activationEvidence: [
      { ref: `${API_DIR}[id]/route.ts`, quote: "auth: { required: true, minRole: 'member' }," },
      { ref: `${API_DIR}[id]/route.ts`, quote: "entitlement: 'union_knowledge_suite'," },
      { ref: `${API_DIR}[id]/route.ts`, quote: "const isPublished = row.status === 'published' || row.status === 'archived';" },
    ],
    existingContainment: {
      summary: 'Only the status condition limits these reads: a member sees published and archived interviews and not the drafts of other users. No sensitivity level, consent or role-per-level condition exists on the list, item or document path.',
      evidence: [{ ref: `${API_DIR}route.ts`, quote: "inArray(exitInterviews.status, ['published', 'archived'])," }],
    },
    justification: 'The classification that governance records exists to restrict who reads an interview, and three member-floor reads disclose the content of every classified interview in full to the whole organization. The status condition hides only unpublished drafts, so it does not contain the exposure, and the sibling routes that do enforce the level show the intended behaviour is absent here.',
  }),
  D('DEF-0B7-EXC-PUBLISH-AND-INDEX-COPY-INTERVIEW-TEXT-TO-ORG-WIDE-KNOWLEDGE-BASE', KT, 'HIGH', 'Publication inserts an active knowledge_base row holding the full interview text and the retiring employee name for every sensitivity level and consent state (isPublishAllowed is defined and tested but never called), and the re-index route rewrites that row from the interview; the knowledge-base list and item routes return active rows to any authenticated user of the organization and of its child organizations with no sensitivity, consent, entitlement or role condition, so the classification and consent attached to the interview do not follow the copy.', {
    disposition: 'RELEASE_BLOCKING',
    actualExposure: 'An administrator publishing a reviewed interview creates a knowledge_base row with the whole text; GET /api/knowledge-base/[id] then returns its content to any authenticated user whose organization, or whose parent organization, owns the row, and GET /api/knowledge-base lists it and matches the content with q. No entitlement, role or sensitivity condition is applied on those routes, so the copy of a legal_sensitive interview is read by every member and by members of child organizations.',
    potentialImpact: {
      classes: ['CROSS_TENANT_DISCLOSURE', 'SAME_TENANT_OVER_DISCLOSURE', 'PRIVACY_OR_CONSENT'],
      description: 'The full text of an interview, with the name of the retiring member, becomes readable outside the knowledge-transfer entitlement by every member of the organization and by the members of every child organization of a federation, regardless of the sensitivity level and consent the interview record carries.',
    },
    activationState: 'REACHABLE_ANY_AUTHENTICATED',
    activationEvidence: [
      { ref: KB_ITEM, quote: 'export const GET = withApiAuth(async (' },
      { ref: KB_ITEM, quote: 'const orgIds = parentId ? [orgId, parentId] : [orgId];' },
      { ref: `${API_DIR}[id]/publish/route.ts`, quote: "sourceType: 'exit_interview'," },
    ],
    existingContainment: {
      summary: 'The knowledge-base row is created with isPublic false, and the AI search and AI summarize routes withhold exit-interview rows below the interview sensitivity role; the knowledge-base list and item routes apply neither, so the containment does not reach the read that discloses the copy.',
      evidence: [
        { ref: `${API_DIR}[id]/publish/route.ts`, quote: 'isPublic: false,' },
        { ref: AI_SUMMARIZE, quote: "if (doc.sourceType === 'exit_interview' && doc.sourceId) {" },
      ],
    },
    justification: 'The copy is created by the publication step for every interview, is active at once, and is served in full by routes that any authenticated user can call and that cross to the parent organization. The sibling AI routes already withhold these rows below the interview role, so the gap is on the knowledge-base reads, and because it discloses to members of other organizations as well as to the whole tenant it is release blocking.',
  }),
  D('DEF-0B7-EXC-CONSENT-WITHDRAWAL-AND-RECLASSIFICATION-WITHDRAW-NOTHING-DERIVED', KT, 'HIGH', 'The governance route changes consent and sensitivity on the exit_interviews row only: withdrawing consent leaves the knowledge_base row active with its content and embedding, the re-index refusal marks indexing skipped without touching that row, and neither the keyword search nor the semantic search carries a consent condition, so an interview whose retiree consent is withdrawn is still returned by search and still served by the knowledge-base routes.', {
    disposition: 'CONDITIONALLY_BLOCKING',
    actualExposure: 'An administrator can set consentGranted to false on a published interview, and the route reports success and an indexingEligible flag, but the knowledge_base copy and its embedding stay active and every member who can pass the sensitivity floor of search still receives the interview, because the search queries filter on status and sensitivity and never on consent.',
    potentialImpact: {
      classes: ['PRIVACY_OR_CONSENT'],
      description: 'A retiring member who withdraws consent to the use of their interview in search and retrieval has no effect on what the organization serves: the stored copy, the vector and the keyword match remain available to members, and the audit record shows a consent change that changed nothing.',
    },
    activationState: 'REACHABLE_ENTITLEMENT_GATED',
    activationEvidence: [
      { ref: `${API_DIR}[id]/governance/route.ts`, quote: "auth: { required: true, minRole: 'admin' }," },
      { ref: `${API_DIR}[id]/governance/route.ts`, quote: 'updates.consentGranted = body.consentGranted;' },
      { ref: HYBRID, quote: "eq(exitInterviews.status, 'published')," },
    ],
    existingContainment: {
      summary: 'A reclassification to a higher sensitivity level is honoured by the search queries, which test the current level of the interview on every request; consent has no equivalent condition.',
      evidence: [{ ref: HYBRID, quote: 'AND ei.sensitivity_level = ANY(${allowedSensitivityLevels}::text[])' }],
    },
    blockingCondition: 'An organization records the withdrawal of a retiree consent on an interview that is already published or indexed; from then the withdrawal has no effect on search results, the knowledge-base copy or the stored embedding.',
    justification: 'The route advertises consent control and the effect of a withdrawal is nil, but the exposure needs a withdrawal to be recorded on a published interview, which no organization is known to have done; once one does, the retiree is still served to members, so the defect blocks release on that condition and not before.',
  }),
  D('DEF-0B7-EXC-PUBLISH-SENDS-EVERY-INTERVIEW-TO-AI-WITHOUT-CONSENT-GATE-OR-AUDIT', KT, 'HIGH', 'After the publication transaction commits, a setImmediate job sends the interview text to the AI control plane for expertise extraction for every sensitivity level and consent state (only the embedding step is gated by isIndexingAllowed), with data class internal, no intent or outcome audit record, and every error swallowed, then updates expertiseTags, continuityRiskScore and continuityRiskFlags on the row with no status condition and no audit record.', {
    disposition: 'CONDITIONALLY_BLOCKING',
    actualExposure: 'Each publication by an administrator (minRole admin, entitlement required) triggers one model call carrying the title, lessons, bargaining and mediation advice and topics of the interview, even for privileged, legal_sensitive or executive_confidential interviews and an interview without retiree consent, and then writes model-derived columns on the interview; the summarize and re-index routes record an intent audit before any provider call, and this one records nothing.',
    potentialImpact: {
      classes: ['PRIVACY_OR_CONSENT'],
      description: 'Content that governance marks as requiring legal review or executive access, and content of a retiree who has not consented, is disclosed to a model provider through the AI control plane without a record that the disclosure happened or who triggered it.',
    },
    activationState: 'REACHABLE_ENTITLEMENT_GATED',
    activationEvidence: [
      { ref: `${API_DIR}[id]/publish/route.ts`, quote: "auth: { required: true, minRole: 'admin' }," },
      { ref: `${API_DIR}[id]/publish/route.ts`, quote: 'const expertiseProfile = await extractExpertise(existing);' },
      { ref: EXTRACTOR, quote: "dataClass: 'internal'," },
    ],
    existingContainment: 'NONE',
    blockingCondition: 'An organization publishes an interview classified privileged, legal_sensitive or executive_confidential, or one whose retiree has not consented, while the ue-expertise-extraction profile resolves to a model provider outside the control of the organization; each such publication then discloses the text to that provider with no audit record.',
    justification: 'The extraction runs on every publication and ignores both gates that the same job applies to indexing, and it leaves no record, which is the property that makes a disclosure reviewable. Whether the text leaves the organization control depends on how the control plane profile is wired, which the source does not fix, so the defect blocks release when a classified or non-consented interview is published against an external provider.',
  }),
  D('DEF-0B7-EXC-PUBLISH-PARSE-FAILURE-STORES-DEFAULT-MEDIUM-RISK-SCORE', KT, 'MEDIUM', 'When the model reply for expertise extraction is not valid JSON, extractExpertise returns a fallback profile with continuitySensitivity medium and an empty undocumented-workflow list, and the publish job turns it into continuityRiskScore 40 and writes it to the interview as if it had been assessed; the failure leaves no event and no flag, so analytics and the risk views count an unassessed interview as a medium-risk one.'),
  D('DEF-0B7-EXC-CONSENT-IS-ADMIN-ASSERTED-AND-RECLASSIFICATION-HAS-NO-REVIEW', KT, 'MEDIUM', 'The governance route records consentGranted from an administrator body flag with consentGrantedBy set to the administrator user id and an optional note kept only in the event, so the retiring member is never identified as the grantor and no consent evidence is required, and any single administrator can lower a published interview from legal_sensitive or executive_confidential to public_internal, or grant its consent, with no second approver and no legal-review step; the interview row also keeps the previous values from a read made before the transaction.'),
  D('DEF-0B7-EXC-NEW-INTERVIEWS-DEFAULT-PUBLIC-INTERNAL-WITH-NO-CLASSIFICATION-STEP', KT, 'MEDIUM', 'The create schema has no sensitivity or consent field, so every interview is born public_internal with consent false, and neither submit, review nor publish requires that a classification decision was recorded: an interview that no administrator ever classified is published at the lowest level and, through the unconditioned reads, is visible to every member.'),
  D('DEF-0B7-EXC-SEPARATION-OF-DUTIES-ONLY-AGAINST-THE-CREATOR', KT, 'MEDIUM', 'The review route refuses only the creator of the interview, but any officer who edited the draft (steward and above may edit any draft) or submitted it, and who did not create it, may review it, the table records no submitter, and the publish route compares neither the reviewer nor the creator with the publisher, so one administrator can edit, review and publish the same interview although the route comment calls the review an independent check.'),
  D('DEF-0B7-EXC-DOCUMENT-ATTACH-ACCEPTS-ANY-URL-ON-SHARED-HOST-OR-LOCALHOST', KT, 'MEDIUM', 'The document attach route accepts any URL whose host is the platform shared storage account or its subdomains, localhost or 127.0.0.1, stores it with the client-supplied mime type and size, and never checks that the blob exists, belongs to the organization or has the declared type, so a steward can register another organization blob path or a loopback URL as an interview document that every member who can read the interview then receives.'),
  D('DEF-0B7-EXC-DOCUMENTS-ATTACHABLE-AFTER-REVIEW', KT, 'MEDIUM', 'The document attach route refuses only published and archived interviews, so a steward can attach a document and a transcript of up to 100000 characters to an interview that has already been reviewed and is awaiting publication, material that the reviewer never saw and that is published with the interview without a second review.'),
  D('DEF-0B7-EXC-SEARCH-LIMITS-BEFORE-FILTERING-BY-SENSITIVITY', KT, 'MEDIUM', 'The keyword search applies the row limit (twice the requested limit) in SQL and filters out the interviews the caller role may not read afterwards in memory, so a member whose first matching rows are of a higher level receives fewer results, or none, although readable interviews match, and total reports the filtered length as if it were the match count.'),
  D('DEF-0B7-EXC-INDEX-FAILURE-RETURNS-200-WITH-RAW-ERROR-TEXT', KT, 'LOW', 'The re-index route returns status 200 with indexed false and the raw error string (String(err)) when the embedding or the database write fails, and the same shape for a governance refusal, so a failure is indistinguishable by status from a refusal and internal error text reaches the response.'),

  D('DEF-0B7-EXC-SUMMARIZE-STORES-UNVALIDATED-OR-PLACEHOLDER-OUTPUT-AS-GENERATED', AI, 'MEDIUM', 'The summary generator parses the model reply with JSON.parse and no shape check, and on a parse failure returns a fixed placeholder sentence with empty lists; the route stores operationalSummary as ai_summary, records the event "AI knowledge summary generated" and returns 200, so a failed generation is stored, searched by the keyword search and shown to members as the AI summary of the interview, and a reply without operationalSummary writes nothing while still recording the event.'),
  D('DEF-0B7-EXC-SUMMARIZE-SENDS-ANY-CONSENT-STATE-TO-MODEL-AS-INTERNAL', AI, 'MEDIUM', 'The summarize route sends the interview lessons, best practices, bargaining, mediation and incoming-officer advice to the AI control plane with data class internal for any consent state and for legal_sensitive and executive_confidential interviews when the caller is an administrator, and never reads consentGranted or containsPii, so the consent that gates the embedding does not gate this model call.'),
  D('DEF-0B7-EXC-AI-ROUTES-APPLY-NO-FEATURE-GATE-SAFETY-CHECK-OR-USER-RATE-LIMIT', AI, 'MEDIUM', 'The summarize and copilot routes call the model with only the union_knowledge_suite entitlement and the default organization rate limit: they apply no guardAiFeature feature flag, no AI safety check of the caller text and no per-user AI rate limit, which the other advisory AI routes of the application declare, and the copilot passes the free text query and up to twenty caller-supplied prior messages straight into the model input.'),
  D('DEF-0B7-EXC-COPILOT-CONVERSATIONS-HAVE-NO-OWNER-AND-ARE-READABLE-BY-ANY-STEWARD', AI, 'MEDIUM', 'ue_copilot_conversations has no user column, so any steward lists the conversations of the whole organization, reads the full message history of any conversation id, and a POST with another conversation id appends the caller messages and the model answer to it; the questions that officers and administrators put to the copilot are readable and writable by every steward.'),
  D('DEF-0B7-EXC-COPILOT-EXPLAINABILITY-IS-FIXED-TEXT-AND-NOT-STORED', AI, 'MEDIUM', 'The copilot returns an evidence envelope built from the aggregate counts and fixed sentences (three reasoning steps whose first claims a retrieval from published exit interviews that the model never received, fixed assumptions, evidence confidence high) around a model answer whose claims are linked to none of it, and the envelope is not persisted (explainabilityRef null), so the history shows no lineage although the engine header says each response is persisted with its explainability envelope.'),
  D('DEF-0B7-EXC-COPILOT-CONTEXT-IS-CLIENT-SUPPLIED-HISTORY', AI, 'LOW', 'The copilot builds the model input from priorMessages sent by the client, with roles user or assistant, and not from the stored conversation, so a caller can supply assistant turns that were never generated and the answer is conditioned on a history that differs from the persisted conversation.'),

  D('DEF-0B7-EXC-DERIVED-VIEWS-IGNORE-SENSITIVITY-AND-CONSENT', COG, 'MEDIUM', 'The topic graph and the dependency propagation map behind the graph query, simulation, scenario and mitigation comparison routes are built from every published interview with no sensitivity or consent condition, so the topic labels, the contributing roles and the single-source findings drawn from privileged, legal_sensitive and executive_confidential interviews are returned to stewards (graph query) and officers.'),
  D('DEF-0B7-EXC-SCENARIOS-ALWAYS-RETURN-THE-CANNED-MINIMAL-SIMULATION', COG, 'HIGH', 'Every preset scenario carries an empty affectedNodeIds, so the simulator takes its no-match branch for all four scenario types and returns the fixed minimal result (immediate impact 20, severity low, autonomous recovery probability 85, empty domain impacts and timeline) for each; the scenarios route reports best case, worst case, average impact 20 and four hard-coded cross-scenario mitigations for a retirement wave, rapid turnover, governance transition or vendor disruption as a modelled comparison, and the preset affectedRoles and timelineWeeks are never read.', {
    disposition: 'CONDITIONALLY_BLOCKING',
    actualExposure: 'An officer of an organization with the union_knowledge_suite entitlement who posts any of the four scenario types receives HTTP 200 with a comparison whose every figure comes from the fixed minimal result: low severity, an average impact of 20 and an 85 percent chance of autonomous recovery, whatever the organization published interviews say; the only hint is the executive summary text asking the reader to review parameters.',
    potentialImpact: {
      classes: ['FALSE_ATTESTATION_OR_OUTCOME', 'DATA_QUALITY'],
      description: 'Leadership asking what a retirement wave or a vendor disruption would do to continuity is told, as a modelled outcome, that the impact is low and recovery is likely, which can postpone documentation, cross-training and succession work that the organization actual single-source knowledge calls for.',
    },
    activationState: 'REACHABLE_ENTITLEMENT_GATED',
    activationEvidence: [
      { ref: `${API_DIR}scenarios/route.ts`, quote: "auth: { required: true, minRole: 'officer' }," },
      { ref: `${API_DIR}scenarios/route.ts`, quote: "entitlement: 'union_knowledge_suite'," },
      { ref: SCENARIOS, quote: "{ simulationType: 'retirement', affectedNodeIds: [], affectedRoles: ['officer', 'steward'], timelineWeeks: 26 }," },
    ],
    existingContainment: {
      summary: 'The no-match result carries an executive summary that says the scenario parameters did not match the available organizational knowledge, and one immediate action asking the reader to review the parameters and retry, so a careful reader of the text can see it is not a model result; no status or flag in the response says so.',
      evidence: [{ ref: SIMULATOR, quote: "executiveSummary: 'Scenario parameters did not match available organizational knowledge. Review and retry.'," }],
    },
    blockingCondition: 'An organization uses the scenario comparison, in the interface or in a report, to decide or to show how a retirement wave, turnover or vendor disruption would affect continuity; the output is the same fixed result for every organization, so it blocks release as soon as the route is offered as a modelling feature.',
    justification: 'The route cannot produce a real simulation for any of its four inputs, so every response is a reassuring constant presented under the shape of a comparison. Only the text of the summary tells a careful reader, which limits the harm to readers who act on the figures; the route is reachable by officers of entitled organizations only, so it blocks release on the condition that the scenario feature is offered as a model of the organization.',
  }),
  D('DEF-0B7-EXC-SIMULATION-UNMATCHED-NODES-RETURN-REASSURING-RESULT-AND-ROLES-ARE-IGNORED', COG, 'MEDIUM', 'The simulation route passes affectedNodeIds, an unvalidated array of free strings, to a simulator that returns the fixed minimal result (impact 20, severity low, recovery 85) with status 200 when none matches a node, and never reads affectedRoles, context or timelineWeeks, so a mistyped or stale node id and every role-based scenario read as a low-impact simulation.'),
  D('DEF-0B7-EXC-MITIGATION-PROJECTIONS-ARE-FIXED-MULTIPLIERS-WITH-CONSTANT-CONFIDENCE', COG, 'MEDIUM', 'The mitigation comparison computes exposure reduction, resilience gain and the recommended scenario from a fixed effectiveness table by mitigation and node type and a fixed investment bonus (0.7, 1.0, 1.2), labels the per-domain confidence from that constant (high at 0.7 and above), returns an empty result with no error when the targetNodeIds match no node, and ranks and recommends a scenario from them, so the projections and the recommendation reflect the table and not evidence of the organization.'),
  D('DEF-0B7-EXC-GRAPH-QUERY-ACCEPTS-FILTERS-AND-EXPLANATION-LEVEL-IT-NEVER-READS', COG, 'MEDIUM', 'The graph query route validates and forwards category, roleFilter, depthLimit and explanationLevel, and the reasoner reads none of them (only minimumRiskLevel, in the isolated knowledge query), so a caller who narrows by category or role, limits the depth or asks for a brief or exhaustive explanation receives the same unfiltered findings for every value.'),
  D('DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR', COG, 'MEDIUM', 'The cognition memory POST stores a memory type such as simulation_snapshot or resilience_baseline, a resilience score and an unbounded payload exactly as the officer supplied them, with no author column on ue_cognition_memory and no check against the real simulation or index, and the load builds the resilience timeline and change-from-previous figures from those asserted scores, so organizational memory and the timeline can hold figures nobody computed.'),
  D('DEF-0B7-EXC-REASONING-SESSIONS-HAVE-NO-OWNER-AND-ARE-READABLE-BY-ANY-STEWARD', COG, 'MEDIUM', 'ue_reasoning_sessions records no creator, so the sessions list returns every session of the organization, with its context description, graph state, annotations and linked memory ids, to any steward, and no route limits a session to the person who opened it.'),
  D('DEF-0B7-EXC-ANALYTICS-REPORTS-FULL-CONSENT-FOR-MONTHS-WITH-NO-INTERVIEWS', COG, 'LOW', 'The analytics timeline reports a consent coverage rate of 100 for any month with no interviews and a current exposure score of 0 when no interview has a score, so empty months and an unassessed organization read as the best case, and it loads every interview and event of the last twelve months into memory with no limit.'),
]

export const CAPABILITIES = [
  {
    id: KT,
    parentRegisterId: 'UE-CONV-K-007',
    relatedRegisterIds: ['UE-CONV-K-005', 'UE-CONV-K-006'],
    obligationKey: 'exit-interview-knowledge-transfer',
    primaryGate: GATE,
    dependencyGates: [6, 9, 13],
    actor: 'Steward or officer capturing an exit interview of a departing member or officer; officer reviewing; administrator classifying, publishing and indexing; member searching and reading published interviews',
    businessOutcome: 'An exit interview belongs to one organization, is written by the person who holds the knowledge, is reviewed by someone other than those who prepared it, carries a sensitivity level and the retiree consent before it is published, is read only by the offices the level allows, is copied into search and the knowledge archive only when its level and consent permit, and a change of level or a withdrawal of consent withdraws what was derived from it; and every change commits with its audit record.',
    sourceStatus: 'PARTIAL',
    apiRoute: 'app/api/exit-interviews (records, documents, governance, index, publish, review, submit, search, template)',
    service: `${API_DIR}[id]/publish/route.ts`,
    sourceFiles: [
      `${API_DIR}route.ts`,
      `${API_DIR}[id]/route.ts`,
      `${API_DIR}[id]/publish/route.ts`,
      `${API_DIR}[id]/governance/route.ts`,
      CONSENT,
      INDEXER,
      HYBRID,
      SCHEMA_EI,
    ],
    proof: [{ type: 'path', ref: `${API_DIR}[id]/publish/route.ts` }],
    auditEvidence: 'Create, update, submit, review, publish, governance change and document attach commit the row, the exit_interview_events row and persistAtomicAudit in one tenant transaction, with a status condition on the transitions. Indexing commits each state change with its audit record and records an intent and an outcome around the embedding call. Reads are not audited, including reads of privileged and legal_sensitive interviews. The background expertise extraction after publication writes the interview with no audit record.',
    privacyClassification: 'Exit interviews of named retiring members and officers: name, role, years of service, retirement reason (including health), lessons, bargaining and mediation advice, key cases, attached documents and transcripts, consent state, sensitivity level, AI summary and continuity risk score; and the copy of the full text held in the knowledge base.',
    gap: 'No existing capability owns exit-interview records. UE-OMIT-AI-ADVISORY-GOVERNANCE owns the advisory AI routes and is used here only for the summary and copilot operations, and UE-OMIT-COMMITTEE-WORKSPACE, UE-OMIT-EDUCATION-AND-TRAINING-RECORDS and UE-OMIT-COLLECTIVE-AGREEMENT-REGISTER hold none of these tables, so the record, document, governance, publication, search and template routes had no owner but the route-domain catch-all. The write paths are the best-formed code of the domain (status conditions, a reviewer who is not the creator, atomic audit). The gaps are that the list, item and document reads and the knowledge-base copy ignore the sensitivity level and the consent, consent is asserted by an administrator and withdraws nothing, publication sends the text to the AI control plane for every level and records nothing, and search can return fewer results than exist. This record closes none of them. Who may read at each level, whether consent is a precondition and who owns the archive is an institutional matter no source states.',
  },
]

const group = (capabilityId, domain, actor, routes, evidence) => ({ capabilityId, domain, actor, routes, evidence })

export const GROUPS = {
  EXIT_CORE_RECORDS: group(KT, 'EXIT_INTERVIEW_RECORDS',
    'Steward or officer capturing, submitting and reviewing exit interviews of departing members; member reading published interviews and the interview template',
    ['exit-interviews/route.ts', 'exit-interviews/[id]/route.ts', 'exit-interviews/[id]/submit/route.ts', 'exit-interviews/[id]/review/route.ts', 'exit-interviews/template/route.ts'], [
      ev(SCHEMA_EI, 'export const exitInterviews = pgTable('),
      ev(`${API_DIR}schemas.ts`, 'retiringEmployeeName: z.string().min(2).max(255),'),
      ev(`${API_DIR}template/route.ts`, 'Returns a role-specific template for strategic knowledge extraction interviews.'),
    ]),
  EXIT_CORE_DOCUMENTS: group(KT, 'EXIT_INTERVIEW_DOCUMENTS',
    'Steward attaching, and member reading, the documents and transcripts of an exit interview',
    ['exit-interviews/[id]/documents/route.ts'], [
      ev(SCHEMA_EI, 'export const exitInterviewDocuments = pgTable('),
      ev(`${API_DIR}[id]/documents/route.ts`, ' * File upload is handled client-side to Azure Blob Storage (presigned URL flow).'),
    ]),
  EXIT_CORE_GOVERNANCE_PUBLICATION: group(KT, 'EXIT_INTERVIEW_GOVERNANCE_PUBLICATION',
    'Administrator classifying, recording consent for, publishing and indexing an exit interview',
    ['exit-interviews/[id]/governance/route.ts', 'exit-interviews/[id]/index/route.ts', 'exit-interviews/[id]/publish/route.ts'], [
      ev(CONSENT, ' * Enforces privacy-safe publishing restrictions and consent lifecycle for'),
      ev(INDEXER, ' * Generates vector embeddings for published exit interview content and upserts'),
      ev(SCHEMA_EI, 'export const exitInterviewSensitivityEnum = pgEnum('),
    ]),
  EXIT_CORE_SEARCH: group(KT, 'EXIT_INTERVIEW_SEARCH',
    'Member searching the published exit-interview knowledge by keyword and meaning',
    ['exit-interviews/search/route.ts'], [
      ev(HYBRID, ' * Hybrid Knowledge Search'),
      ev(HYBRID, 'export async function hybridKnowledgeSearch('),
    ]),
  EXIT_CORE_AI_ASSISTANCE: group(AI, 'EXIT_INTERVIEW_AI_ASSISTANCE',
    'Steward generating an AI knowledge summary of a published interview or asking the continuity copilot',
    ['exit-interviews/[id]/summarize/route.ts', 'exit-interviews/copilot/route.ts'], [
      ev(SUMMARIZER, ' * AI Knowledge Summarizer'),
      ev(COPILOT, ' * Governance Copilot Engine'),
      ev(SCHEMA_RT, "export const ueCopilotConversations = pgTable('ue_copilot_conversations', {"),
    ]),
  EXIT_CORE_COGNITION: group(COG, 'EXIT_INTERVIEW_COGNITION',
    'Steward or officer querying the derived continuity graph, simulations, scenarios and mitigation comparisons, keeping cognition memory and reasoning sessions, and reading the governance timeline',
    [
      'exit-interviews/analytics/route.ts', 'exit-interviews/cognition-memory/route.ts', 'exit-interviews/graph-query/route.ts',
      'exit-interviews/mitigation-comparison/route.ts', 'exit-interviews/reasoning-sessions/route.ts', 'exit-interviews/scenarios/route.ts',
      'exit-interviews/simulation/route.ts',
    ], [
      ev(MEMORY, ' * Cognition Memory Store'),
      ev(SCHEMA_RT, "export const ueReasoningSessions = pgTable('ue_reasoning_sessions', {"),
      ev(SCENARIOS, ' * Resilience Scenario Modeler'),
      ev(SIMULATOR, ' * Continuity Impact Simulator'),
    ]),
}

export const ROUTES = new Set(Object.values(GROUPS).flatMap((g) => g.routes))

const SERVICE_OF = (a) => `${APP}app/api/${a.route}`
const SESSION_AUTHN = 'Authenticated session resolved by withApi (auth.required true); the user, role and organization come from the session.'
const ENT = (a) => a.h('authorization', "entitlement: 'union_knowledge_suite',")
const ROLE = (a, role) => a.h('authorization', `auth: { required: true, minRole: '${role}' },`)

const authzText = (role, more = '') => `withApi with minRole ${role} and the union_knowledge_suite entitlement (requireEntitlement for the session organization): a role floor of ${role}.${more} A role title is not a kernel decision.`

const SENS_RECORD = 'Retiring employee name, role in the union, years of service, retirement reason (including health), title, summary, key lessons, best practices, bargaining advice, mediation advice, incoming officer advice, topics, key cases, the PII flag, sensitivity level, consent state, AI summary, continuity risk score and flags, and the user ids of the author, reviewer and consent grantor'

const IDOR = 'The row is selected and changed with the path id and organization_id equal to the session organization, so an id of another organization answers 404.'

// --- interview collection and item -----------------------------------------------------------------------------------------

const interviewList = (a) => mk({
  persona: 'Member reading the published exit interviews of the organization; steward or officer reading every status, including the drafts of other users',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('member', ' The handler then limits callers below steward to published and archived interviews and applies no sensitivity or consent condition.'),
  tenant: 'The query starts from organization_id equal to the session organization before the optional status and mine conditions.',
  owner: 'exit_interviews rows of the organization; createdBy names the author user id.',
  sens: SENS_RECORD,
  priv: 'Any member of an entitled organization reads, for up to 200 published or archived interviews, the whole row of each (full text, retiring employee name, retirement reason, AI summary, risk score, user ids) whatever the sensitivity level and consent state; steward and above also read the drafts of other users.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record; reads of interviews of any sensitivity level are not audited.',
  reqAudit: 'Audit reads of interviews above public_internal, with the caller and the level, once the readers of each level are named.',
  does: 'Returns up to 200 exit_interviews rows with every column, newest first, for the session organization, optionally filtered by status values and by mine; callers below steward see only published and archived rows; no condition on sensitivityLevel or consentGranted exists, and total is the length of the returned page.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 9, 13],
  future: 'Return only the columns a reader needs and apply the SENSITIVITY_MIN_ROLE floor and the consent condition on every read, name the offices that read each level, and audit reads above public_internal.',
  dec: [D_READERS],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'member'),
    ENT(a),
    a.h('tenantScope', 'const conditions = [eq(exitInterviews.organizationId, organizationId!)];'),
    a.h('mutation', '.orderBy(desc(exitInterviews.createdAt))'),
    a.h('scope', 'const stewardPlus = hasStewardPrivileges(user?.role ?? null);'),
    a.h('defect', "inArray(exitInterviews.status, ['published', 'archived']),"),
    a.h('defect', '.select()'),
    a.h('defect', '.limit(200);'),
    a.tbl('privacy', 'exitInterviews', /retirementReason: exitInterviewRetirementReasonEnum/),
    a.tbl('privacy', 'exitInterviews', /sensitivityLevel: exitInterviewSensitivityEnum/),
    a.tbl('defect', 'exitInterviews', /consentGranted: boolean\('consent_granted'\)\.notNull\(\)\.default\(false\),/),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler references neither sensitivityLevel nor consentGranted: its conditions are the organization, the optional status list, the published-and-archived restriction below steward and mine, and db.select() selects every column of the table, so the list is an unprojected whole-row read for every role.' },
  ],
  def: ['DEF-0B7-EXC-READS-IGNORE-SENSITIVITY-LEVEL'],
})

const interviewCreate = (a) => mk({
  persona: 'Steward or officer capturing the exit interview of a departing member or officer as a draft',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('steward'),
  tenant: 'organizationId and createdBy are set from the session after the body is spread, so a body cannot choose them, and the row is created inside withRLSContext for the session organization.',
  owner: 'The new exit_interviews row, its created event and its audit record, all of the session organization; the author is recorded as createdBy.',
  sens: SENS_RECORD,
  priv: 'The body names a retiring employee and their lessons, advice and key cases; the row is created with sensitivity public_internal, consent false and the status draft, and the PII flag is whatever the caller states.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The interview row, the created event and persistAtomicAudit (exit_interview.create) commit in one tenant transaction.',
  reqAudit: 'Keep the in-transaction record, and record the classification decision and the consent evidence that the draft needs before it can be published.',
  does: 'Inserts a draft exit_interviews row from the validated body with organizationId, createdBy and updatedBy from the session, writes the created event and the audit record in the same transaction and returns the row; the schema offers no sensitivity or consent field, so the row takes the defaults public_internal and consent false.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Require a sensitivity classification and a record of the retiree consent route at creation, or refuse to publish without them, and bound the free-text fields.',
  dec: [D_READERS],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'steward'),
    ENT(a),
    a.h('tenantScope', 'const created = await withRLSContext({ organizationId: organizationId! }, async (tx) => {'),
    a.h('mutation', '.insert(exitInterviews)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'exit_interview.create',"),
    a.h('defect', '...body,'),
    a.tbl('defect', 'exitInterviews', /sensitivityLevel: exitInterviewSensitivityEnum\('sensitivity_level'\)\.notNull\(\)\.default\('public_internal'\),/),
    a.tbl('defect', 'exitInterviews', /consentGranted: boolean\('consent_granted'\)\.notNull\(\)\.default\(false\),/),
  ],
  inf: [
    { claim: 'defect', statement: 'createExitInterviewSchema in schemas.ts declares no sensitivityLevel, consentGranted or status field, and the object schema drops unknown keys, so a new interview always takes the table defaults public_internal and consent false and a classification can only be set later by the administrator governance route.' },
  ],
  def: ['DEF-0B7-EXC-NEW-INTERVIEWS-DEFAULT-PUBLIC-INTERNAL-WITH-NO-CLASSIFICATION-STEP'],
})

const interviewGet = (a) => mk({
  persona: 'Member reading one published interview with its events and documents; the owner or a steward reading a draft',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('member', ' The handler then refuses a draft, submitted or reviewed interview to a caller who is neither steward-level nor its creator, and applies no sensitivity or consent condition.'),
  tenant: `${IDOR} The events and documents are read with the same organization predicate.`,
  owner: 'One exit_interviews row of the organization, its exit_interview_events rows and its exit_interview_documents rows.',
  sens: `${SENS_RECORD}; the event notes and payloads (including consent notes and the previous and new sensitivity and consent values), and the attachment titles, file URLs and transcripts`,
  priv: 'Any member reads the whole interview, every event with its notes and actor user id, and every attached document with its file URL and transcript for a published or archived interview of any sensitivity level and consent state.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: three selects, no row written and no audit record; the reading of a privileged interview is not recorded although the event enum has a viewed type.',
  reqAudit: 'Audit reads of interviews above public_internal, with the caller and the level, once the readers of each level are named.',
  does: 'Returns the interview of the session organization with its events (oldest first) and documents, refusing unpublished interviews to non-owners below steward; the body is the whole row plus the events and documents, with no sensitivity, consent or column projection.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 9, 13],
  future: 'Apply the SENSITIVITY_MIN_ROLE floor and the consent condition before returning the row, project the events and documents to what the level allows, and audit reads above public_internal.',
  dec: [D_READERS],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'member'),
    ENT(a),
    a.h('tenantScope', '.where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))'),
    a.h('mutation', '.orderBy(asc(exitInterviewEvents.createdAt)),'),
    a.h('scope', "const isPublished = row.status === 'published' || row.status === 'archived';"),
    a.h('scope', 'if (!stewardPlus && !isOwner && !isPublished) {'),
    a.h('defect', 'return { data: { ...row, events, documents } };'),
    a.tbl('privacy', 'exitInterviewDocuments', /transcriptText: text\('transcript_text'\),/),
    a.tbl('privacy', 'exitInterviews', /sensitivityLevel: exitInterviewSensitivityEnum/),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler tests the status, the creator and the steward role and nothing about sensitivityLevel or consentGranted, so for a published or archived row the only difference between legal_sensitive and public_internal is the value of one column of the response.' },
  ],
  def: ['DEF-0B7-EXC-READS-IGNORE-SENSITIVITY-LEVEL'],
})

const interviewPatch = (a) => mk({
  persona: 'Steward or officer editing the draft of an exit interview',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('steward', ' The handler adds an owner-or-steward check that no caller at the steward floor can fail, and a draft-only condition.'),
  tenant: `${IDOR} The update also carries the draft status in its WHERE clause.`,
  owner: 'The editable content fields of one draft exit_interviews row of the organization; updatedBy and updatedAt are set from the session.',
  sens: SENS_RECORD,
  priv: 'The caller rewrites interview content, including the PII flag and free metadata; the response returns the whole row.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The draft update, the updated event and persistAtomicAudit (exit_interview.update, recording the changed field names) commit in one tenant transaction, and the update is conditional on the status still being draft.',
  reqAudit: 'Keep the in-transaction record and add the previous values, or a version, of a changed content field.',
  does: 'Reads the interview of the session organization, refuses a non-draft interview with 409, updates the declared fields of the body with updatedBy and updatedAt in a transaction conditional on the draft status, writes the updated event and the audit record and returns the row.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [6, 13],
  future: 'Keep the draft condition and the atomic audit, record who edited a draft so a reviewer can be refused, and bound the free-text fields.',
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'steward'),
    ENT(a),
    a.h('tenantScope', ".where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!), eq(exitInterviews.status, 'draft')))"),
    a.h('mutation', '.update(exitInterviews)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'exit_interview.update',"),
    a.h('scope', "if (existing.status !== 'draft') {"),
  ],
  def: [],
})

// --- workflow: submit, review, publish ---------------------------------------------------------------------------------------

const interviewSubmit = (a) => mk({
  persona: 'Steward or officer submitting a draft exit interview for review',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('steward', ' The handler adds an owner-or-steward check that no caller at the steward floor can fail.'),
  tenant: `${IDOR} The update also carries the draft status in its WHERE clause.`,
  owner: 'The status, submittedAt and updatedBy columns of one exit_interviews row of the organization.',
  sens: 'The interview status transition; the interview content is not returned beyond the row of the transition',
  priv: 'The response returns the whole row to the caller who submitted it.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The draft to submitted update, the submitted event and persistAtomicAudit (exit_interview.submit) commit in one tenant transaction conditional on the status still being draft.',
  reqAudit: 'Keep the in-transaction record and record the submitter as a column, not only as the event actor.',
  does: 'Moves a draft interview of the session organization to submitted with submittedAt and updatedBy, conditional on the status draft, writes the submitted event and the audit record and returns the row; a non-draft interview answers 409.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [6, 13],
  future: 'Keep the conditional transition and the atomic audit, and require the content and the classification to be complete before submission.',
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'steward'),
    ENT(a),
    a.h('tenantScope', ".where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!), eq(exitInterviews.status, 'draft')))"),
    a.h('mutation', ".set({ status: 'submitted', submittedAt: now, updatedAt: now, updatedBy: userId! })"),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'exit_interview.submit',"),
    a.h('scope', "if (existing.status !== 'draft') {"),
  ],
  def: [],
})

const interviewReview = (a) => mk({
  persona: 'Officer or administrator marking a submitted exit interview as reviewed',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('officer', ' The handler repeats the officer check and refuses the creator of the interview; it compares no other editor or submitter.'),
  tenant: `${IDOR} The update also carries the submitted status in its WHERE clause.`,
  owner: 'The status, reviewedAt, reviewedBy and updatedBy columns of one exit_interviews row of the organization.',
  sens: 'The interview status transition and the reviewer note kept in the event',
  priv: 'The response returns the whole row to the reviewer.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The submitted to reviewed update, the reviewed event and persistAtomicAudit (exit_interview.review) commit in one tenant transaction conditional on the status still being submitted.',
  reqAudit: 'Keep the in-transaction record and record the content version that was reviewed, so later changes are visible.',
  does: 'Refuses a caller below officer or the creator of the interview, moves a submitted interview of the session organization to reviewed with reviewedAt and reviewedBy, writes the reviewed event and the audit record in one transaction and returns the row.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [6, 13],
  future: 'Refuse every person who edited, submitted or classified the interview, record the version reviewed, and require a recorded classification before a review.',
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'officer'),
    ENT(a),
    a.h('tenantScope', '.where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))'),
    a.h('mutation', '.update(exitInterviews)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'exit_interview.review',"),
    a.h('scope', 'if (existing.createdBy === userId) {'),
    a.h('defect', "throw ApiError.forbidden('The author of an exit interview cannot review it');"),
    a.tbl('defect', 'exitInterviews', /submittedAt: timestamp\('submitted_at', \{ withTimezone: true \}\),/),
  ],
  inf: [
    { claim: 'defect', statement: 'The only comparison between the reviewer and a person is existing.createdBy === userId; updatedBy (the last editor), the submitter and any classifier are never compared, and the table has a submittedAt column but no submitter column, so an officer who edited or submitted the interview is not refused.' },
  ],
  def: ['DEF-0B7-EXC-SEPARATION-OF-DUTIES-ONLY-AGAINST-THE-CREATOR', 'DEF-0B7-EXC-NEW-INTERVIEWS-DEFAULT-PUBLIC-INTERNAL-WITH-NO-CLASSIFICATION-STEP'],
})

const interviewPublish = (a) => mk({
  persona: 'Administrator publishing a reviewed exit interview into the knowledge base',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('admin', ' The handler checks that the status is reviewed and nothing about the sensitivity level, consent or who reviewed it.'),
  tenant: `${IDOR} The knowledge_base row is inserted with the session organization and the status update is conditional on the reviewed status.`,
  owner: 'The status and publication columns of one exit_interviews row, a new knowledge_base row holding a copy of the interview text, a published event, and the background expertise tags and risk score written afterwards.',
  sens: `${SENS_RECORD}; the knowledge_base copy of the full interview text with the retiring employee name`,
  priv: 'The full interview text and the retiring employee name are copied into an active knowledge_base row for every sensitivity level and consent state; after the transaction a background job sends the interview text to the AI control plane and writes model-derived risk columns, with no audit record.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The knowledge_base insert, the reviewed to published update, the published event and persistAtomicAudit (exit_interview.publish) commit in one tenant transaction. The background expertise extraction, the update of expertiseTags and continuityRiskScore and the failure of either are not audited, and its errors are swallowed.',
  reqAudit: 'Keep the in-transaction record, record the sensitivity level and consent at the time of publication, and record the model disclosure and the derived columns it writes.',
  does: 'Refuses an interview that is not reviewed (an already published one is returned as it is), inserts an active knowledge_base guide holding the full text and the retiring employee name, marks the interview published with the knowledge base id, writes the event and the audit record in one transaction, returns the row and the knowledge asset, and then in a setImmediate job sends the interview text to the model for expertise extraction, writes tags and a risk score on the row, and indexes it when the level and consent allow.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 9, 13],
  future: 'Publish only an interview that has a recorded sensitivity level and the consent that level needs (call isPublishAllowed), copy to the knowledge base only what the level allows and carry the level and consent with the copy, record the model disclosure in an audit record and apply the consent and level gates before the extraction, and refuse a publisher who reviewed or prepared the interview.',
  dec: [D_READERS],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'admin'),
    ENT(a),
    a.h('tenantScope', '.where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))'),
    a.h('tenantScope', ".where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!), eq(exitInterviews.status, 'reviewed')))"),
    a.h('mutation', '.insert(knowledgeBase)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'exit_interview.publish',"),
    a.h('scope', "if (existing.status !== 'reviewed') {"),
    a.h('defect', '`Retiring employee: ${existing.retiringEmployeeName}`,'),
    a.h('defect', "sourceType: 'exit_interview',"),
    a.h('defect', 'isPublic: false,'),
    a.h('defect', 'isActive: true,'),
    a.h('defect', 'const expertiseProfile = await extractExpertise(existing);'),
    a.h('defect', 'const shouldIndex = isIndexingAllowed('),
    a.h('defect', 'continuityRiskScore: riskScore,'),
    a.h('defect', '} catch {'),
    a.h('defect', 'reviewedBy: existing.reviewedBy ?? userId!,'),
    a.svc('defect', EXTRACTOR, "dataClass: 'internal',", 'extractExpertise'),
    a.svc('defect', EXTRACTOR, "continuitySensitivity: 'medium',", 'extractExpertise'),
    a.svc('defect', EXTRACTOR, "continuityJustification: 'Unable to parse AI extraction result; manual review recommended.',", 'extractExpertise'),
    a.svc('defect', CONSENT, 'export function isPublishAllowed(', 'isPublishAllowed'),
  ],
  inf: [
    { claim: 'defect', statement: 'isPublishAllowed is exported by consent-controls and tested, but no route or service imports it; this handler never reads sensitivityLevel or consentGranted before inserting the knowledge_base row, and the only gate it applies to the existing row is the reviewed status.' },
    { claim: 'defect', statement: 'The setImmediate callback runs after the response; extractExpertise is called before and independently of shouldIndex, the update of expertiseTags and continuityRiskScore carries no status condition and no audit call, and the empty catch records neither the failure nor the disclosure.' },
    { claim: 'defect', statement: 'A published interview that the same administrator reviewed passes: the handler compares neither existing.reviewedBy nor existing.createdBy with the acting user, and it keeps the earlier reviewer (reviewedBy: existing.reviewedBy ?? userId!).' },
  ],
  def: [
    'DEF-0B7-EXC-PUBLISH-AND-INDEX-COPY-INTERVIEW-TEXT-TO-ORG-WIDE-KNOWLEDGE-BASE',
    'DEF-0B7-EXC-PUBLISH-SENDS-EVERY-INTERVIEW-TO-AI-WITHOUT-CONSENT-GATE-OR-AUDIT',
    'DEF-0B7-EXC-PUBLISH-PARSE-FAILURE-STORES-DEFAULT-MEDIUM-RISK-SCORE',
    'DEF-0B7-EXC-NEW-INTERVIEWS-DEFAULT-PUBLIC-INTERNAL-WITH-NO-CLASSIFICATION-STEP',
    'DEF-0B7-EXC-SEPARATION-OF-DUTIES-ONLY-AGAINST-THE-CREATOR',
  ],
})

// --- documents -------------------------------------------------------------------------------------------------------------

const documentsGet = (a) => mk({
  persona: 'Member reading the documents and transcripts attached to a published interview; the owner or a steward reading those of a draft',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('member', ' The handler refuses the attachments of an unpublished interview to a caller who is neither its creator nor steward-level and applies no sensitivity or consent condition.'),
  tenant: 'The interview is looked up with its path id and organization_id equal to the session organization, and the documents are selected with the same organization predicate.',
  owner: 'exit_interview_documents rows of one interview of the organization.',
  sens: 'Attachment titles, file URLs, mime types, sizes and transcripts of the interview',
  priv: 'Any member reads every attachment, including the transcript text, of any published or archived interview whatever its sensitivity level and consent state.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: two selects, no row written and no audit record.',
  reqAudit: 'Audit reads of the attachments of interviews above public_internal, with the caller and the level.',
  does: 'Returns every exit_interview_documents row (all columns) of one interview of the session organization, refusing the attachments of an unpublished interview to non-owners below steward; no sensitivity, consent or column projection is applied.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 9, 13],
  future: 'Apply the sensitivity floor and the consent condition to the attachments and the transcripts as the interview does, and return file URLs only to readers the level allows.',
  dec: [D_READERS],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'member'),
    ENT(a),
    a.h('tenantScope', '.where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))'),
    a.h('mutation', '.from(exitInterviewDocuments)'),
    a.h('scope', "const isPublished = interview.status === 'published' || interview.status === 'archived';"),
    a.h('defect', 'if (!isPublished && interview.createdBy !== userId && !hasStewardPrivileges(user?.role ?? null)) {'),
    a.tbl('privacy', 'exitInterviewDocuments', /transcriptText: text\('transcript_text'\),/),
  ],
  inf: [
    { claim: 'defect', statement: 'The interview lookup selects only id, status and createdBy, so the handler never has the sensitivity level in hand, and nothing after the status test consults it before db.select() returns every column of the documents.' },
  ],
  def: ['DEF-0B7-EXC-READS-IGNORE-SENSITIVITY-LEVEL'],
})

const documentsPost = (a) => mk({
  persona: 'Steward registering an already-uploaded file and its transcript against an exit interview',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('steward', ' The handler adds an owner-or-steward check that no caller at the steward floor can fail, and refuses published and archived interviews.'),
  tenant: 'The interview is looked up with its path id and organization_id equal to the session organization, and the document row is inserted with the session organization inside withRLSContext.',
  owner: 'A new exit_interview_documents row of one interview of the organization; the file itself lives in storage outside this route.',
  sens: 'Attachment title, file URL, mime type, size and a transcript of up to 100000 characters of the interview',
  priv: 'The caller supplies a URL and a transcript that every member who can read the interview later receives; the URL is checked against a host list and the file is not read.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The document insert and persistAtomicAudit (exit_interview.document_attach, recording the interview id and mime type) commit in one tenant transaction.',
  reqAudit: 'Keep the in-transaction record and add the file URL, a content hash and the status of the interview at attachment.',
  does: 'Refuses a published or archived interview, checks the file URL host against the platform storage account, localhost and 127.0.0.1, inserts the document row with the supplied title, URL, mime type, size and transcript and writes the audit record in the same transaction.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Verify that the blob exists in the organization container with the declared type and size, drop loopback hosts outside development, and refuse attachments after the review.',
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'steward'),
    ENT(a),
    a.h('tenantScope', '.where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))'),
    a.h('mutation', '.insert(exitInterviewDocuments)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'exit_interview.document_attach',"),
    a.h('scope', "if (interview.status === 'published' || interview.status === 'archived') {"),
    a.h('defect', "'nzilacanadastore.blob.core.windows.net',"),
    a.h('defect', "'127.0.0.1',"),
    a.h('defect', 'if (!allowedHosts.some((h) => parsedUrl.hostname === h || parsedUrl.hostname.endsWith(`.${h}`))) {'),
    a.h('defect', 'transcriptText: body!.transcriptText,'),
    a.local('defect', 'attachDocumentSchema', 'transcriptText: z.string().max(100_000).optional(),'),
  ],
  inf: [
    { claim: 'defect', statement: 'The host check is the only validation of fileUrl: the handler never fetches or lists the blob, and the platform storage account host is shared by every organization, so a path of another organization on the same host passes; mimeType and sizeBytes are stored as declared.' },
  ],
  def: ['DEF-0B7-EXC-DOCUMENT-ATTACH-ACCEPTS-ANY-URL-ON-SHARED-HOST-OR-LOCALHOST', 'DEF-0B7-EXC-DOCUMENTS-ATTACHABLE-AFTER-REVIEW'],
})

// --- governance and indexing --------------------------------------------------------------------------------------------------

const governancePatch = (a) => mk({
  persona: 'Administrator classifying the sensitivity of an exit interview and recording the consent of the retiring member',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('admin', ' No second approver, legal review or evidence of the retiree consent is required.'),
  tenant: `${IDOR}`,
  owner: 'The sensitivityLevel, consentGranted, consentGrantedAt and consentGrantedBy columns of one exit_interviews row of the organization, and a governance_updated event.',
  sens: 'Sensitivity level, consent flag, the administrator user id recorded as the consent grantor and the consent note kept in the event',
  priv: 'The change decides who may read and index the interview; the response returns the whole updated row and whether it is indexing eligible.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The row update, the governance_updated event and persistAtomicAudit (exit_interview.governance_update, with the previous and new level and consent) commit in one tenant transaction; the previous values come from a read made before the transaction and the update has no status condition.',
  reqAudit: 'Keep the in-transaction record, record who the consent came from and its evidence, and require a second approval to lower a level or grant consent on a published interview.',
  does: 'Updates the sensitivity level and the consent flag of one interview of the session organization at any status, sets consentGrantedAt and consentGrantedBy to the administrator when consent is granted and clears them when it is withdrawn, writes the event and the audit record in one transaction and returns the row with an indexingEligible flag; it withdraws no knowledge_base row, embedding or search entry.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Record the retiree as the grantor with evidence, require a second approver and legal review to lower a level, and on a withdrawal or an upward reclassification deactivate the knowledge_base copy and the embedding in the same transaction.',
  dec: [D_READERS],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'admin'),
    ENT(a),
    a.h('tenantScope', '.where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))'),
    a.h('mutation', '.update(exitInterviews)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'exit_interview.governance_update',"),
    a.h('defect', 'updates.consentGrantedBy = userId;'),
    a.h('defect', 'previousSensitivity: existing.sensitivityLevel,'),
    a.h('defect', 'const indexingEligible = SENSITIVITY_LEVELS[updated.sensitivityLevel]?.indexingAllowed && updated.consentGranted;'),
    a.local('defect', 'governanceSchema', 'consentNotes: z.string().max(1000).optional(),'),
  ],
  inf: [
    { claim: 'defect', statement: 'The handler updates exit_interviews only: it imports no knowledge_base table and calls no unindex, deactivate or delete function, so the knowledge_base content, embedding and is_active flag of an interview whose consent was withdrawn are untouched.' },
    { claim: 'defect', statement: 'consentGrantedBy is the acting administrator user id, the body carries no retiree identity or evidence reference, and consentNotes is stored only in the event notes, so the consent record names the administrator who ticked the flag.' },
  ],
  def: ['DEF-0B7-EXC-CONSENT-WITHDRAWAL-AND-RECLASSIFICATION-WITHDRAW-NOTHING-DERIVED', 'DEF-0B7-EXC-CONSENT-IS-ADMIN-ASSERTED-AND-RECLASSIFICATION-HAS-NO-REVIEW'],
})

const indexPost = (a) => mk({
  persona: 'Administrator re-triggering semantic indexing of a published exit interview',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('admin', ' The handler requires the published status and refuses the interview when isIndexingAllowed is false for its level and consent; the indexer repeats the sensitivity and consent gate.'),
  tenant: `${IDOR} The indexer repeats the organization predicate on every statement it runs inside withRLSContext.`,
  owner: 'The indexingStatus, indexedAt and knowledgeBaseId columns of one exit_interviews row, and its knowledge_base row (content, embedding, tags and keywords).',
  sens: 'The indexable interview text (title, role, years, summary, lessons, advice, expertise tags and topics) sent to the embedding model and stored in knowledge_base',
  priv: 'For an interview whose level and consent allow it, the text is sent to the AI control plane for an embedding and written to the active knowledge_base row, which the knowledge-base routes serve to every member without a level condition.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The route has no audit call of its own. indexExitInterview commits every state change (skipped, indexed, failed) with persistAtomicAudit in the same tenant transaction as the interview and knowledge_base update, and wraps the embedding call in performAuditedOperation, which records an intent before the call and an outcome after it, outside the transaction.',
  reqAudit: 'Keep the per-state in-transaction records and the intent and outcome around the provider call, and record the level and consent that allowed the indexing.',
  does: 'Refuses an interview that is not published (409), answers 200 with indexed false and a reason when the sensitivity level or consent does not allow it, and otherwise calls indexExitInterview, which embeds the text and inserts or updates the knowledge_base row and marks the interview indexed, or marks it skipped or failed; a failure comes back as 200 with indexed false and the error text.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Return a failure status for a failed index and no raw error text, keep the intent and outcome audit around the embedding, and give the knowledge_base copy the same level and consent condition as the interview.',
  dec: [D_READERS],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'admin'),
    ENT(a),
    a.h('tenantScope', '.where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))'),
    a.h('mutation', 'const result = await indexExitInterview(params.id, organizationId!, userId!, {'),
    a.svc('mutation', INDEXER, '.update(knowledgeBase)', 'indexExitInterview'),
    a.svc('audit', INDEXER, 'persistAtomicAudit(', 'indexExitInterview'),
    a.svc('audit', INDEXER, 'const embedding = await performAuditedOperation(', 'indexExitInterview'),
    a.h('scope', "if (interview.status !== 'published') {"),
    a.h('scope', 'const allowed = isIndexingAllowed('),
    a.h('defect', 'return { data: result };'),
    a.svc('defect', INDEXER, 'return { indexed: false, reason: String(err) };', 'indexExitInterview'),
    a.svc('defect', INDEXER, 'content,', 'indexExitInterview'),
    a.svc('defect', INDEXER, 'isActive: true,', 'indexExitInterview'),
  ],
  inf: [
    { claim: 'defect', statement: 'The route returns whatever indexExitInterview returns inside a 200 data envelope, and the service returns { indexed: false, reason: String(err) } from its catch block instead of throwing, so an embedding or database failure has no failing status code.' },
  ],
  def: ['DEF-0B7-EXC-INDEX-FAILURE-RETURNS-200-WITH-RAW-ERROR-TEXT', 'DEF-0B7-EXC-PUBLISH-AND-INDEX-COPY-INTERVIEW-TEXT-TO-ORG-WIDE-KNOWLEDGE-BASE'],
})

// --- search and template -----------------------------------------------------------------------------------------------------

const searchPost = (a) => mk({
  persona: 'Member searching the published exit-interview knowledge by keyword and meaning',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('member', ' The route maps the caller role to the sensitivity levels it may read (member public_internal, steward adds restricted, officer adds privileged, admin all) and passes the list to the search.'),
  tenant: 'Both the keyword query and the semantic query carry organization_id equal to the session organization, and the semantic query joins exit_interviews on the source id of the knowledge_base row.',
  owner: 'Published exit_interviews rows of the organization and their knowledge_base embeddings; the route writes nothing.',
  sens: 'Interview id, title, role, years of service, summary, sensitivity level, expertise tags, topics, publication time and relevance scores',
  priv: 'A member receives the title, summary, role and tags of published public_internal interviews matching the query; the query text is sent to the AI control plane to be embedded.',
  mut: 'NOT_MUTATING',
  nonMutationReason: 'The POST computes a search over published interviews from the body and returns the matches; it inserts, updates and deletes nothing and records no audit event.',
  auditDetail: 'A read: the search writes no row and no audit record, although the event enum has a searched type, and the model call that embeds the query is not audited.',
  reqAudit: 'Record the query, the caller, the levels applied and the number of results returned for searches that reach restricted and higher levels.',
  does: 'Runs a keyword search (case-insensitive match on title, lessons, advice and AI summary) and, when the query embeds, a vector search of the knowledge base, limited to published interviews of the session organization, filters by the sensitivity levels of the caller role and returns the merged, scored list; the embedding failure is swallowed and the search continues keyword only.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [6, 13],
  future: 'Apply the limit after the level filter, add the consent condition, bound and audit the query, and say in the response when the semantic part did not run.',
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'member'),
    ENT(a),
    a.h('tenantScope', 'orgId: organizationId!,'),
    a.h('mutation', 'const results = await hybridKnowledgeSearch({'),
    a.h('audit', 'return { data: results, total: results.length };'),
    a.h('scope', 'allowedSensitivityLevels: allowedSensitivityLevels(user?.role ?? null),'),
    a.svc('tenantScope', HYBRID, 'eq(exitInterviews.organizationId, orgId),', 'keywordSearch'),
    a.svc('scope', HYBRID, 'AND ei.sensitivity_level = ANY(${allowedSensitivityLevels}::text[])', 'semanticSearch'),
    a.svc('defect', HYBRID, '.limit(limit);', 'keywordSearch'),
    a.svc('defect', HYBRID, '.filter((r) => allowedSensitivityLevels.includes(r.sensitivityLevel as ExitInterviewSensitivityLevel))', 'keywordSearch'),
    a.svc('defect', HYBRID, '} catch {', 'generateQueryEmbedding'),
  ],
  inf: [
    { claim: 'defect', statement: 'keywordSearch limits to limit*2 rows in SQL and removes rows above the caller level afterwards in JavaScript, and no query in the file references consent_granted or consentGranted.' },
  ],
  def: ['DEF-0B7-EXC-SEARCH-LIMITS-BEFORE-FILTERING-BY-SENSITIVITY'],
})

const templateGet = (a) => mk({
  persona: 'Member or steward reading the question template for an exit interview of a given role',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('member'),
  tenant: 'None by organization: the response is a constant per role compiled into the route file and reads no organization data; the entitlement check still uses the session organization.',
  owner: 'No record: the template is static text in the route file.',
  sens: 'Public interview questions; no personal data',
  priv: 'No stored data is read; the response carries the common questions and one role-specific question.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read of constant text: no row written and no audit record.',
  reqAudit: 'No audit record is needed for constant text.',
  does: 'Returns, for the requested role (default steward), a fixed thirty-minute interview with the four common questions and one role-specific question.',
  status: 'IMPLEMENTED_IN_SOURCE',
  gate: GATE,
  deps: [13],
  future: 'None beyond keeping the template editable by the organization if the offices that own the archive want their own questions.',
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'member'),
    ENT(a),
    a.h('tenantScope', "const role = query.role ?? 'steward';"),
    a.h('mutation', 'questions: roleTemplates[role] ?? roleTemplates.steward,'),
  ],
  def: [],
})

// --- summaries and copilot (AI advisory) -----------------------------------------------------------------------------------------

const summarizePost = (a) => mk({
  persona: 'Steward, officer or administrator generating an AI operational handoff summary of a published exit interview',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('steward', ' The handler repeats the steward check and then requires the role that SENSITIVITY_MIN_ROLE names for the interview level; a caller below it receives 404.'),
  tenant: `${IDOR} The update also carries the published status in its WHERE clause.`,
  owner: 'The aiSummary and aiSummaryGeneratedAt columns of one published exit_interviews row, and a summarized event.',
  sens: 'The interview lessons, best practices, bargaining, mediation and incoming-officer advice sent to the AI control plane, and the stored AI summary',
  priv: 'Interview content goes to the model with data class internal for any consent state; the generated summary is stored on the interview and returned to every member who reads it.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The aiSummary update, the summarized event and persistAtomicAudit (exit_interview.summarize) commit in one tenant transaction conditional on the published status. The model call is wrapped in performAuditedOperation, which records an intent before it and an outcome after it, outside the transaction.',
  reqAudit: 'Keep the in-transaction record and the intent and outcome around the model call, add the consent state and data class sent, and record the model and prompt version.',
  does: 'Refuses a caller below the interview sensitivity role and an interview that is not published, sends the interview text to the model through performAuditedOperation, takes the JSON reply (or a fixed placeholder when it does not parse), stores operationalSummary as the interview AI summary with the summarized event and the audit record in one transaction, and returns the summary.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [2, 6, 13],
  future: 'Validate the reply against the summary schema and refuse to store a placeholder, check consent and containsPii before the model call, apply the AI feature gate, safety check and per-user rate limit, and mark the stored summary as unreviewed machine output.',
  dec: [D_READERS],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'steward'),
    ENT(a),
    a.h('tenantScope', '.where(and(eq(exitInterviews.id, params.id), eq(exitInterviews.organizationId, organizationId!)))'),
    a.h('mutation', '.update(exitInterviews)'),
    a.h('audit', 'await persistAtomicAudit(tx, {'),
    a.h('audit', "action: 'exit_interview.summarize.generate',"),
    a.h('scope', 'const minRole = SENSITIVITY_MIN_ROLE[interview.sensitivityLevel as keyof typeof SENSITIVITY_MIN_ROLE];'),
    a.h('defect', 'summary = await performAuditedOperation('),
    a.h('defect', 'aiSummary: summary.operationalSummary,'),
    a.h('defect', "notes: 'AI knowledge summary generated',"),
    a.svc('defect', SUMMARIZER, "dataClass: 'internal',", 'generateKnowledgeSummary'),
    a.svc('defect', SUMMARIZER, 'const parsed = JSON.parse(result.content) as Omit<KnowledgeSummary, \'sourceInterviewId\' | \'generatedAt\'>;', 'generateKnowledgeSummary'),
    a.svc('defect', SUMMARIZER, 'operationalSummary: `Exit interview for ${interview.roleInUnion} with ${interview.yearsOfService} years of service. Manual review of source content is recommended.`,', 'generateKnowledgeSummary'),
    a.svc('defect', SUMMARIZER, 'if (interview.keyLessons) parts.push(`Key lessons:\\n${interview.keyLessons}`);', 'buildSummaryInput'),
  ],
  inf: [
    { claim: 'defect', statement: 'The route and generateKnowledgeSummary never read consentGranted or containsPii, and neither the route file nor the summarizer imports guardAiFeature, a safety check or a per-user rate limit, which the sibling ai/summarize route applies.' },
    { claim: 'defect', statement: 'The catch in generateKnowledgeSummary returns the placeholder summary with the same fields as a real one, so the route cannot tell it from a generated summary and stores it with the event text AI knowledge summary generated.' },
  ],
  def: [
    'DEF-0B7-EXC-SUMMARIZE-STORES-UNVALIDATED-OR-PLACEHOLDER-OUTPUT-AS-GENERATED',
    'DEF-0B7-EXC-SUMMARIZE-SENDS-ANY-CONSENT-STATE-TO-MODEL-AS-INTERNAL',
    'DEF-0B7-EXC-AI-ROUTES-APPLY-NO-FEATURE-GATE-SAFETY-CHECK-OR-USER-RATE-LIMIT',
  ],
})

const copilotGet = (a) => mk({
  persona: 'Steward listing the recent copilot conversations of the organization or reading one conversation history',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('steward', ' No condition ties a conversation to the user who held it.'),
  tenant: 'The conversation lookup and the list carry organization_id equal to the session organization and run inside withRLSContext on a FORCE RLS table.',
  owner: 'ue_copilot_conversations rows of the organization; the table has no user column.',
  sens: 'Conversation titles, ids and message counts, and the full message history of any conversation id, which holds the questions asked by officers and administrators and the model answers',
  priv: 'Any steward lists every conversation of the organization and reads the full history of any conversation id, whoever held it.',
  mut: 'NOT_MUTATING',
  auditDetail: 'A read: the handler writes no row and no audit record.',
  reqAudit: 'Tie conversations to their users and audit reads of another user conversation.',
  does: 'Returns the messages of one conversation of the session organization when conversationId is given (an unknown or malformed id returns an empty list), and otherwise the most recent conversations (id, title, updated time, message count) of the organization up to the limit.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [6, 13],
  future: 'Add the author to each conversation and return a user own conversations, or name the offices that may read the others.',
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'steward'),
    ENT(a),
    a.h('mutation', 'const conversations = await listConversations(organizationId!, query.limit);'),
    a.svc('tenantScope', COPILOT, 'WHERE id = ${conversationId} AND organization_id = ${orgId}', 'loadConversationHistory'),
    a.svc('tenantScope', COPILOT, 'WHERE organization_id = ${orgId}', 'listConversations'),
    a.sch('defect', SCHEMA_RT, /sessionId: text\('session_id'\),/, { symbol: 'ueCopilotConversations' }),
    a.sch('privacy', SCHEMA_RT, /messages: jsonb\('messages'\)\.notNull\(\)\.default\(\[\]\),/, { symbol: 'ueCopilotConversations' }),
  ],
  inf: [
    { claim: 'defect', statement: 'ueCopilotConversations declares id, organizationId, sessionId, title, messages, contextSnapshot and timestamps and no user id column, so neither the list nor the history query can be limited to the person who held the conversation.' },
  ],
  def: ['DEF-0B7-EXC-COPILOT-CONVERSATIONS-HAVE-NO-OWNER-AND-ARE-READABLE-BY-ANY-STEWARD'],
})

const copilotPost = (a) => mk({
  persona: 'Steward asking the continuity copilot a question about organizational continuity',
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  authz: authzText('steward', ' No condition ties a conversation id in the body to the user who opened it.'),
  tenant: 'The continuity context is built for the session organization, and the conversation is looked up and written with organization_id equal to the session organization inside withRLSContext on a FORCE RLS table.',
  owner: 'A ue_copilot_conversations row of the organization with the user query and the model answer appended; the table has no user column.',
  sens: 'The free-text query and up to twenty prior messages sent to the AI control plane with the organization resilience score and single-source counts, the stored conversation, and the returned evidence envelope',
  priv: 'The question and the history leave the application as model input with data class internal; the conversation is stored for the organization and readable by every steward.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The conversation insert or lookup, both appended messages and persistAtomicAudit (exit_interview.copilot.converse) commit in one tenant transaction. The model call is wrapped in performAuditedOperation, which records an intent before it and an outcome after it, outside the transaction, and the user text is not in either record.',
  reqAudit: 'Keep the in-transaction record and the intent and outcome around the model call, store the author, and persist the explainability envelope with the answer.',
  does: 'Builds the dependency propagation map and the resilience index of the organization, sends a system prompt of aggregate counts, the caller-supplied prior messages and the query to the model through performAuditedOperation, appends the query and the answer to the named or a new conversation with the audit record, and returns the answer with an evidence envelope built from the counts and fixed sentences.',
  status: 'PARTIAL',
  gate: GATE,
  deps: [2, 6, 13],
  future: 'Apply the AI feature gate, safety check and per-user rate limit, take the history from the stored conversation, store the author, link answer claims to evidence the model received, and persist the envelope.',
  dec: [],
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'steward'),
    ENT(a),
    a.h('mutation', 'const result = await processCopilotQuery(organizationId!, {'),
    a.svc('tenantScope', COPILOT, 'SELECT id FROM ue_copilot_conversations WHERE id = ${conversationId} AND organization_id = ${orgId} LIMIT 1', 'upsertConversation'),
    a.svc('mutation', COPILOT, 'UPDATE ue_copilot_conversations', 'appendMessage'),
    a.svc('audit', COPILOT, 'await persistAtomicAudit(tx, {', 'processCopilotQuery'),
    a.svc('audit', COPILOT, 'const aiResult = await performAuditedOperation(', 'processCopilotQuery'),
    a.h('defect', 'priorMessages: body.priorMessages,'),
    a.svc('defect', COPILOT, "dataClass: 'internal',", 'processCopilotQuery'),
    a.svc('defect', COPILOT, "reasoning: 'Retrieved organizational dependency propagation map from published exit interviews',", 'processCopilotQuery'),
    a.svc('defect', COPILOT, 'explainabilityRef: null,', 'processCopilotQuery'),
    a.svc('defect', COPILOT, "confidence: 'high',", 'processCopilotQuery'),
    a.svc('defect', COPILOT, '...(input.priorMessages ?? []).map((m) => ({', 'processCopilotQuery'),
    a.svc('defect', RESPONSE_BUILDER, 'overallConfidence: assessConfidence(evidence),', 'buildExplainabilityEnvelope'),
  ],
  inf: [
    { claim: 'defect', statement: 'processCopilotQuery builds the model input from input.priorMessages, which the route copies from the body, and never loads the stored messages of the conversation; the evidence array and the three reasoning steps are assembled from counts and fixed sentences, and the answer text appears only as a 120 character slice in the third step.' },
    { claim: 'defect', statement: 'Neither the route nor processCopilotQuery imports guardAiFeature, a safety check or a per-user rate limit; the only controls before the model call are the entitlement and the default organization rate limit of withApi.' },
  ],
  def: [
    'DEF-0B7-EXC-AI-ROUTES-APPLY-NO-FEATURE-GATE-SAFETY-CHECK-OR-USER-RATE-LIMIT',
    'DEF-0B7-EXC-COPILOT-CONVERSATIONS-HAVE-NO-OWNER-AND-ARE-READABLE-BY-ANY-STEWARD',
    'DEF-0B7-EXC-COPILOT-EXPLAINABILITY-IS-FIXED-TEXT-AND-NOT-STORED',
    'DEF-0B7-EXC-COPILOT-CONTEXT-IS-CLIENT-SUPPLIED-HISTORY',
  ],
})

// --- derived cognition and analytics ---------------------------------------------------------------------------------------------

const computeBase = (a) => ({
  service: SERVICE_OF(a),
  authn: SESSION_AUTHN,
  mut: 'NOT_MUTATING',
  gate: GATE,
  deps: [6, 13],
  status: 'PARTIAL',
  dec: [D_READERS],
})

const analyticsGet = (a) => mk({
  ...computeBase(a),
  persona: 'Officer reading the governance and continuity timeline of the organization over the last twelve months',
  authz: authzText('officer'),
  tenant: 'The interview and event queries both carry organization_id equal to the session organization and a twelve-month created_at lower bound.',
  owner: 'Aggregates computed from exit_interviews and exit_interview_events rows of the organization; the route writes nothing.',
  sens: 'Monthly counts of interviews, publications and governance updates, average continuity risk score, consent coverage rate, a current exposure score and a trend direction',
  priv: 'Aggregates only: no interview text or name is returned, but the consent coverage and exposure figures describe the organization knowledge-transfer governance.',
  auditDetail: 'A read: two selects and in-memory aggregation, no row written and no audit record.',
  reqAudit: 'Aggregate reads need no audit record once the readers are named.',
  does: 'Loads every interview and every event of the last twelve months, groups them into twelve monthly buckets (new, published, governance updates, mean risk score, consent coverage in percent), compares the last three months with the three before for a trend, and returns the series with a current exposure score that is the mean of all risk scores or 0.',
  future: 'Bound the load, return null rather than 100 percent consent for months with no interviews and null rather than 0 for an unassessed organization, and name the readers.',
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'officer'),
    ENT(a),
    a.h('tenantScope', 'eq(exitInterviews.organizationId, orgId),'),
    a.h('mutation', '.from(exitInterviewEvents)'),
    a.h('scope', 'gte(exitInterviews.createdAt, new Date(sinceIso)),'),
    a.h('defect', ': 100,'),
    a.h('defect', 'const currentExposureScore ='),
    a.h('defect', 'consentCoverageRate:'),
  ],
  inf: [
    { claim: 'defect', statement: 'Both selects have no limit and the months without an interview take the else branch of the consent coverage ternary, which is the literal 100; currentExposureScore is 0 when allRiskScores is empty.' },
  ],
  def: ['DEF-0B7-EXC-ANALYTICS-REPORTS-FULL-CONSENT-FOR-MONTHS-WITH-NO-INTERVIEWS'],
})

const cognitionMemoryGet = (a) => mk({
  ...computeBase(a),
  persona: 'Officer loading the saved organizational cognition memory and its resilience timeline',
  authz: authzText('officer'),
  tenant: 'The query carries organization_id equal to the session organization and runs inside withRLSContext on a FORCE RLS table; the entry id lookups are checked as UUIDs.',
  owner: 'ue_cognition_memory rows of the organization; the table has no author column.',
  sens: 'Memory entries of the organization: type, title, context summary, free payload, resilience score at capture, tags, key insights and session id',
  priv: 'Any officer reads every active memory entry of the organization, including the free payload that another officer saved.',
  auditDetail: 'A read: one select, no row written and no audit record.',
  reqAudit: 'Aggregate reads need no audit record once the readers and the author of each entry are named.',
  does: 'Returns the most recent active memory entries of the session organization (default 50, at most 200, optional type and session filters) with a resilience timeline and change-from-previous figures computed from the scores the entries carry.',
  future: 'Store and show the author of each entry, mark entries whose figures were typed by a person and not computed, and bound the payload.',
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'officer'),
    ENT(a),
    a.h('mutation', 'const store = await loadCognitionMemory(organizationId!, {'),
    a.svc('tenantScope', MEMORY, 'WHERE organization_id = ${orgId}', 'loadCognitionMemory'),
    a.svc('defect', MEMORY, 'changeFromPrevious: idx === 0 ? null : e.resilienceScoreAtCapture! - withScores[idx - 1].resilienceScoreAtCapture!,', 'loadCognitionMemory'),
    a.sch('defect', SCHEMA_RT, /resilienceScoreAtCapture: integer\('resilience_score_at_capture'\),/, { symbol: 'ueCognitionMemory' }),
    a.sch('defect', SCHEMA_RT, /payload: jsonb\('payload'\)\.notNull\(\)\.default\(\{\}\),/, { symbol: 'ueCognitionMemory' }),
  ],
  inf: [
    { claim: 'defect', statement: 'The timeline is derived only from resilienceScoreAtCapture values stored on the entries, which the POST route takes from the caller, and ueCognitionMemory has no column for who saved an entry.' },
  ],
  def: ['DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR'],
})

const cognitionMemoryPost = (a) => mk({
  ...computeBase(a),
  persona: 'Officer saving a cognition memory entry, or archiving one by id',
  authz: authzText('officer'),
  tenant: 'The insert and the archive update carry organization_id equal to the session organization inside withRLSContext on a FORCE RLS table; the archive id must be a UUID of an active entry of the organization.',
  owner: 'A new ue_cognition_memory row of the organization, or the status of an existing one; the table has no author column and the author appears only in the audit record.',
  sens: 'Memory type, title, context summary, an unbounded free payload, a resilience score, tags, key insights and a session id, all as the caller states them',
  priv: 'The officer free text and payload are stored and read back by every officer; nothing is checked against a simulation, index or session.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The insert and persistAtomicAudit (cognition_memory.save), or the archive update and persistAtomicAudit (cognition_memory.archive), commit in one tenant transaction; an archive of an unknown id writes and audits nothing.',
  reqAudit: 'Keep the in-transaction record and store the author on the row.',
  does: 'Archives an active entry when archiveId is given, otherwise inserts a memory entry with the type, title, summary, payload, score, tags, insights and session id taken from the body, with the audit record in the same transaction, and returns the entry.',
  future: 'Compute the snapshot figures on the server from the simulation or index they claim to capture, bound the payload, verify the session id, and store the author.',
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'officer'),
    ENT(a),
    a.h('mutation', 'const entry = await saveCognitionMemory(organizationId!, {'),
    a.svc('tenantScope', MEMORY, 'INSERT INTO ue_cognition_memory', 'saveCognitionMemory'),
    a.svc('audit', MEMORY, 'await persistAtomicAudit(tx, {', 'saveCognitionMemory'),
    a.svc('audit', MEMORY, "action: 'cognition_memory.save',", 'saveCognitionMemory'),
    a.h('defect', 'resilienceScoreAtCapture: body.resilienceScoreAtCapture,'),
    a.h('defect', 'payload: body.payload ?? {},'),
    a.local('defect', 'SaveMemorySchema', 'payload: z.record(z.string(), z.unknown()).optional(),'),
    a.sch('defect', SCHEMA_RT, /payload: jsonb\('payload'\)\.notNull\(\)\.default\(\{\}\),/, { symbol: 'ueCognitionMemory' }),
  ],
  inf: [
    { claim: 'defect', statement: 'The INSERT lists id, organization_id, memory_type, title, context_summary, payload, resilience_score_at_capture, tags, key_insights, session_id, status and timestamps and no user column, and nothing in the route or the store compares memoryType, the score or the payload with a computed result.' },
  ],
  def: ['DEF-0B7-EXC-COGNITION-MEMORY-STORES-CALLER-ASSERTED-SNAPSHOTS-WITH-NO-AUTHOR'],
})

const reasoningSessionsGet = (a) => mk({
  ...computeBase(a),
  persona: 'Steward listing the reasoning sessions of the organization',
  authz: authzText('steward', ' No condition ties a session to the user who opened it.'),
  tenant: 'The query carries organization_id equal to the session organization and runs inside withRLSContext on a FORCE RLS table.',
  owner: 'ue_reasoning_sessions rows of the organization; the table has no creator column.',
  sens: 'Session titles, focus, status, context description, graph state, simulation references, annotations, linked memory ids and the latest resilience score',
  priv: 'Any steward reads every session of the organization, including the context description and annotations that another steward wrote.',
  auditDetail: 'A read: one select, no row written and no audit record.',
  reqAudit: 'Store the creator of each session and audit reads of another user session.',
  does: 'Returns up to the limit (default 20, at most 100) reasoning sessions of the session organization, optionally by status, most recently updated first, with every column mapped.',
  future: 'Record the creator of a session and list a steward own sessions, or name the offices that may read the others.',
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'steward'),
    ENT(a),
    a.h('mutation', 'const sessions = await listReasoningSessions(organizationId!, {'),
    a.svc('tenantScope', SESSIONS, 'WHERE organization_id = ${orgId}', 'listReasoningSessions'),
    a.svc('privacy', SESSIONS, 'annotations: (row.annotations as SessionAnnotation[]) ?? [],', 'rowToSession'),
    a.sch('defect', SCHEMA_RT, /contextDescription: text\('context_description'\)\.notNull\(\)\.default\(''\),/, { symbol: 'ueReasoningSessions' }),
    a.sch('defect', SCHEMA_RT, /annotations: jsonb\('annotations'\)\.notNull\(\)\.default\(\[\]\),/, { symbol: 'ueReasoningSessions' }),
  ],
  inf: [
    { claim: 'defect', statement: 'ueReasoningSessions declares no user id column, so listReasoningSessions cannot condition on a creator and returns the sessions of the whole organization.' },
  ],
  def: ['DEF-0B7-EXC-REASONING-SESSIONS-HAVE-NO-OWNER-AND-ARE-READABLE-BY-ANY-STEWARD'],
})

const reasoningSessionsPost = (a) => mk({
  ...computeBase(a),
  persona: 'Steward opening a reasoning session to hold a line of continuity analysis',
  authz: authzText('steward'),
  tenant: 'The insert carries organization_id equal to the session organization inside withRLSContext on a FORCE RLS table.',
  owner: 'A new ue_reasoning_sessions row of the organization; the creator appears only in the audit record.',
  sens: 'Session title, focus and context description as the caller states them',
  priv: 'The steward free text is stored and read back by every steward of the organization.',
  mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: 'The insert and persistAtomicAudit (reasoning_session.create) commit in one tenant transaction.',
  reqAudit: 'Keep the in-transaction record and store the creator on the row.',
  does: 'Inserts an active reasoning session with the title, focus and context description of the body for the session organization, with the audit record in the same transaction, and returns it.',
  future: 'Store the creator on the row and bound the context description.',
  ev: [
    ...guardEv(a, 'withApi'),
    ROLE(a, 'steward'),
    ENT(a),
    a.h('mutation', 'const session = await createReasoningSession(organizationId!, {'),
    a.svc('tenantScope', SESSIONS, 'INSERT INTO ue_reasoning_sessions', 'createReasoningSession'),
    a.svc('audit', SESSIONS, 'await auditSession(tx, orgId, userId, \'reasoning_session.create\', id, { focus: input.focus ?? \'general_continuity\' });', 'createReasoningSession'),
    a.svc('audit', SESSIONS, 'return persistAtomicAudit(tx, {', 'auditSession'),
    a.sch('defect', SCHEMA_RT, /contextDescription: text\('context_description'\)\.notNull\(\)\.default\(''\),/, { symbol: 'ueReasoningSessions' }),
  ],
  inf: [
    { claim: 'defect', statement: 'The INSERT lists id, organization_id, title, focus, context_description and timestamps and no user column; the creator is only the userId passed to auditSession.' },
  ],
  def: ['DEF-0B7-EXC-REASONING-SESSIONS-HAVE-NO-OWNER-AND-ARE-READABLE-BY-ANY-STEWARD'],
})

const computeRecord = (a, spec) => mk({
  ...computeBase(a),
  authz: authzText(spec.role),
  nonMutationReason: spec.nonMutationReason,
  ...spec.fields,
})

const graphQueryPost = (a) => computeRecord(a, {
  role: 'steward',
  nonMutationReason: 'The POST computes a graph query over published interviews from the body and returns the findings; it inserts, updates and deletes nothing and records no audit event.',
  fields: {
    persona: 'Steward asking an explainable question of the continuity dependency graph built from published interviews',
    tenant: 'The graph is built for the session organization: the interviews are selected with organization_id equal to the session organization and the published status, and the query organization comes from the session, not from the body.',
    owner: 'No record is written: the findings are computed from the topics, roles and expertise tags of the published interviews of the organization.',
    sens: 'Topic labels, categories, associated roles, single-source flags and sensitivity reasons derived from the published interviews, with findings and recommendations',
    priv: 'Labels and roles drawn from every published interview, privileged and legal_sensitive ones included, reach a steward; a single-source finding names the role of the one interview that mentions the topic.',
    auditDetail: 'A compute-only POST: no row is written and no audit record, so the query, the caller and the interviews it drew on are not recorded.',
    reqAudit: 'Record the query type, the caller and the sensitivity levels the graph drew on once the readers of each level are named.',
    does: 'Builds the dependency propagation map of the session organization from its published interviews and returns the findings for the requested query type with a confidence score; category, roleFilter, depthLimit and explanationLevel are accepted and not applied, and minimumRiskLevel is applied by the isolated knowledge query only.',
    future: 'Build the graph only from interviews the caller level may read, apply or reject every accepted filter, and name the readers of derived findings.',
    ev: [
      ...guardEv(a, 'withApi'),
      ROLE(a, 'steward'),
      ENT(a),
      a.h('mutation', 'const result = await executeGraphQuery(organizationId!, query);'),
      a.h('audit', 'return { data: result };'),
      a.h('tenantScope', 'organizationId: organizationId!,'),
      a.h('defect', 'filters: body.filters,'),
      a.h('defect', 'explanationLevel: body.explanationLevel,'),
      a.svc('tenantScope', PROPAGATION, 'eq(exitInterviews.organizationId, orgId)', 'buildDependencyPropagationMap'),
      a.svc('defect', PROPAGATION, "eq(exitInterviews.status, 'published')", 'buildDependencyPropagationMap'),
      a.svc('defect', GRAPH, 'if (query.filters?.minimumRiskLevel) {', 'queryIsolatedKnowledge'),
      a.svc('defect', TOPIC_GRAPH, "eq(exitInterviews.status, 'published'),", 'buildTopicGraph'),
    ],
    inf: [
      { claim: 'defect', statement: 'A search of graph-query for depthLimit, roleFilter, filters.category and explanationLevel finds only the type declarations and the route schema; the nine query functions read minimumRiskLevel only inside queryIsolatedKnowledge, so the other filters and the explanation level change nothing.' },
      { claim: 'defect', statement: 'buildDependencyPropagationMap and buildTopicGraph select the published interviews with no sensitivityLevel or consentGranted condition, so the derived graph contains the topics of every published interview.' },
    ],
    def: ['DEF-0B7-EXC-GRAPH-QUERY-ACCEPTS-FILTERS-AND-EXPLANATION-LEVEL-IT-NEVER-READS', 'DEF-0B7-EXC-DERIVED-VIEWS-IGNORE-SENSITIVITY-AND-CONSENT'],
  },
})

const mitigationPost = (a) => computeRecord(a, {
  role: 'officer',
  nonMutationReason: 'The POST computes mitigation projections from the body and the derived graph and returns them; it inserts, updates and deletes nothing and records no audit event.',
  fields: {
    persona: 'Officer comparing up to six continuity mitigation scenarios side by side',
    tenant: 'The propagation map and the resilience index are built for the session organization, and the scenarios come from the body but are evaluated only against that map.',
    owner: 'No record is written: the projections are computed from the derived graph, the resilience index and fixed tables.',
    sens: 'Mitigation type, target node ids, investment level, duration, projected resilience gain, exposure reduction, action plans and a recommended scenario',
    priv: 'Node labels from every published interview appear in the domain deltas and the residual risks; no member data is returned.',
    auditDetail: 'A compute-only POST: no row is written and no audit record, so a recommendation that is later cited cannot be traced to a request.',
    reqAudit: 'Record the request, the table version and the recommendation if a recommendation may be cited in a decision.',
    does: 'Evaluates each scenario against the propagation map with a fixed effectiveness multiplier by mitigation and node type and a fixed investment bonus, computes gain, ROI class, implementation effort and a twelve-week curve, ranks the scenarios by gain and returns a recommended scenario, a rationale and up to five residual risks.',
    future: 'Mark the figures as table-based planning estimates, reject target node ids that match no node, derive confidence from evidence, and record the table version used.',
    ev: [
      ...guardEv(a, 'withApi'),
      ROLE(a, 'officer'),
      ENT(a),
      a.h('mutation', 'const result = await compareMitigations(organizationId!, body.scenarios as MitigationScenario[]);'),
      a.h('audit', 'return { data: result };'),
      a.h('tenantScope', 'organizationId!,'),
      a.svc('tenantScope', MITIGATION, 'buildDependencyPropagationMap(orgId),', 'compareMitigations'),
      a.svc('defect', MITIGATION, "confidence: effectiveness >= 0.7 ? 'high' : effectiveness >= 0.5 ? 'medium' : 'low',", 'evaluateMitigationScenario'),
      a.svc('defect', MITIGATION, ': scenario.investmentLevel === \'low\' ? 0.7 : 1.0;', 'evaluateMitigationScenario'),
      a.svc('defect', MITIGATION, 'const best = sorted[0];', 'compareMitigations'),
      a.svc('defect', MITIGATION_MODELS, 'documentation_campaign: {', 'getMitigationEffectivenessMultiplier'),
      a.svc('defect', MITIGATION, 'const resilienceGain = Math.round(Math.min(40, avgExposureReduction * 0.5));', 'evaluateMitigationScenario'),
    ],
    inf: [
      { claim: 'defect', statement: 'When targetNodeIds is non-empty the affected nodes are the ones whose id is in the list, so ids that match nothing give an empty list, an average reduction of 0 and a result with gain 0 and no error; the effectiveness values come from the typeMap literal and the node exposure from the node sensitivity, so no figure depends on a measured outcome.' },
    ],
    def: ['DEF-0B7-EXC-MITIGATION-PROJECTIONS-ARE-FIXED-MULTIPLIERS-WITH-CONSTANT-CONFIDENCE', 'DEF-0B7-EXC-DERIVED-VIEWS-IGNORE-SENSITIVITY-AND-CONSENT'],
  },
})

const scenariosPost = (a) => computeRecord(a, {
  role: 'officer',
  nonMutationReason: 'The POST models a preset scenario and returns the comparison; it inserts, updates and deletes nothing and records no audit event.',
  fields: {
    persona: 'Officer modelling a retirement wave, rapid turnover, governance transition or vendor disruption',
    tenant: 'The model is built for the session organization; the body supplies only the preset name, and the simulator selects the published interviews with organization_id equal to the session organization.',
    owner: 'No record is written: the comparison is computed from the presets and the simulator result.',
    sens: 'Scenario name, the preset scenarios, simulation results, best and worst case, average impact, common vulnerabilities and cross-scenario mitigations',
    priv: 'No member data is returned; the figures are fixed minimal results presented as an organizational simulation.',
    auditDetail: 'A compute-only POST: no row is written and no audit record, so a scenario result that is shown to leadership cannot be traced to a request.',
    reqAudit: 'Record the request and the result if a scenario result may be cited in a decision.',
    does: 'Runs the simulator on each preset scenario of the requested type; every preset has an empty affectedNodeIds, so each run returns the fixed minimal result (impact 20, severity low, recovery 85), and the route returns it with best and worst case, an average impact of 20 and four fixed mitigations as the model of the scenario.',
    status: 'PARTIAL',
    future: 'Resolve each preset to the nodes of the organization graph it affects before simulating, refuse to return a result when nothing matches, and label any fixed output as a template.',
    ev: [
      ...guardEv(a, 'withApi'),
      ROLE(a, 'officer'),
      ENT(a),
      a.h('mutation', 'const model = await modelResilienceScenario(organizationId!, body.scenarioType);'),
      a.h('audit', 'return { data: model };'),
      a.h('tenantScope', 'const model = await modelResilienceScenario(organizationId!, body.scenarioType);'),
      a.h('defect', 'if (!(body.scenarioType in PRESET_SCENARIOS)) {'),
      a.svc('defect', SCENARIOS, "{ simulationType: 'retirement', affectedNodeIds: [], affectedRoles: ['officer', 'steward'], timelineWeeks: 26 },", 'PRESET_SCENARIOS'),
      a.svc('defect', SCENARIOS, "'Cross-train across all critical roles',", 'modelResilienceScenario'),
      a.svc('defect', SCENARIOS, 'averageImpact: Math.round(impacts.reduce((a, b) => a + b, 0) / impacts.length),', 'modelResilienceScenario'),
      a.svc('defect', SIMULATOR, 'return buildMinimalSimulation(orgId, scenario, baselineContinuityScore);', 'simulateContinuityImpact'),
      a.svc('defect', SIMULATOR, 'immediateImpactScore: 20,', 'buildMinimalSimulation'),
      a.svc('defect', SIMULATOR, 'autonomousRecoveryProbability: 85,', 'buildMinimalSimulation'),
    ],
    inf: [
      { claim: 'defect', statement: 'All four preset functions in PRESET_SCENARIOS return scenarios whose affectedNodeIds is the empty array, and simulateContinuityImpact filters the graph nodes by scenario.affectedNodeIds.includes(n.id), so affectedNodes is empty for every preset and the minimal branch is the only reachable one; affectedRoles and timelineWeeks of the presets are never read by the simulator.' },
    ],
    def: ['DEF-0B7-EXC-SCENARIOS-ALWAYS-RETURN-THE-CANNED-MINIMAL-SIMULATION', 'DEF-0B7-EXC-DERIVED-VIEWS-IGNORE-SENSITIVITY-AND-CONSENT'],
  },
})

const simulationPost = (a) => computeRecord(a, {
  role: 'officer',
  nonMutationReason: 'The POST simulates a scenario from the body and the derived graph and returns the result; it inserts, updates and deletes nothing and records no audit event.',
  fields: {
    persona: 'Officer simulating the continuity impact of a retirement, departure, vendor loss or knowledge loss',
    tenant: 'The graph and the baseline interviews are selected with organization_id equal to the session organization; the node ids in the body are matched only against that organization graph.',
    owner: 'No record is written: the result is computed from the derived graph, the published interviews and the body.',
    sens: 'Scenario, baseline continuity score, impact scores, domain impacts, degradation timeline, weaknesses, actions and recovery estimates',
    priv: 'Node labels and findings drawn from every published interview reach the officer; no member data is returned.',
    auditDetail: 'A compute-only POST: no row is written and no audit record, so a simulation that is cited later cannot be traced to a request.',
    reqAudit: 'Record the request and the result if a simulation may be cited in a decision.',
    does: 'Matches affectedNodeIds against the nodes of the organization dependency graph and, when some match, computes domain impacts, a timeline, weaknesses, actions and a recovery probability; when none match it returns the fixed minimal result with status 200; affectedRoles, context and timelineWeeks are accepted and never read.',
    future: 'Reject node ids that match no node, apply or refuse the role and timeline inputs, and mark a fallback result as such in a status field.',
    ev: [
      ...guardEv(a, 'withApi'),
      ROLE(a, 'officer'),
      ENT(a),
      a.h('mutation', 'const result = await simulateContinuityImpact(organizationId!, scenario);'),
      a.h('audit', 'return { data: result };'),
      a.h('tenantScope', 'const result = await simulateContinuityImpact(organizationId!, scenario);'),
      a.h('defect', 'affectedNodeIds: body.affectedNodeIds,'),
      a.h('defect', 'affectedRoles: body.affectedRoles,'),
      a.local('defect', 'SimulationRequestSchema', 'affectedNodeIds: z.array(z.string()),'),
      a.svc('tenantScope', SIMULATOR, 'eq(exitInterviews.organizationId, orgId)', 'loadPublishedInterviews'),
      a.svc('defect', SIMULATOR, 'const affectedNodes = propagationMap.nodes.filter((n) => scenario.affectedNodeIds.includes(n.id));', 'simulateContinuityImpact'),
      a.svc('defect', SIMULATOR, 'return buildMinimalSimulation(orgId, scenario, baselineContinuityScore);', 'simulateContinuityImpact'),
      a.svc('defect', SIMULATOR, 'immediateImpactScore: 20,', 'buildMinimalSimulation'),
      a.svc('defect', SIMULATOR, 'autonomousRecoveryProbability: 85,', 'buildMinimalSimulation'),
    ],
    inf: [
      { claim: 'defect', statement: 'A search of the simulation module finds affectedRoles and timelineWeeks only in the type declaration and context nowhere beyond the scenario object that is returned, so those inputs have no effect on any computed figure.' },
    ],
    def: ['DEF-0B7-EXC-SIMULATION-UNMATCHED-NODES-RETURN-REASSURING-RESULT-AND-ROLES-ARE-IGNORED', 'DEF-0B7-EXC-DERIVED-VIEWS-IGNORE-SENSITIVITY-AND-CONSENT'],
  },
})

const BUILDERS = {
  'exit-interviews/route.ts|GET': interviewList,
  'exit-interviews/route.ts|POST': interviewCreate,
  'exit-interviews/[id]/route.ts|GET': interviewGet,
  'exit-interviews/[id]/route.ts|PATCH': interviewPatch,
  'exit-interviews/[id]/submit/route.ts|POST': interviewSubmit,
  'exit-interviews/[id]/review/route.ts|POST': interviewReview,
  'exit-interviews/[id]/publish/route.ts|POST': interviewPublish,
  'exit-interviews/[id]/documents/route.ts|GET': documentsGet,
  'exit-interviews/[id]/documents/route.ts|POST': documentsPost,
  'exit-interviews/[id]/governance/route.ts|PATCH': governancePatch,
  'exit-interviews/[id]/index/route.ts|POST': indexPost,
  'exit-interviews/search/route.ts|POST': searchPost,
  'exit-interviews/template/route.ts|GET': templateGet,
  'exit-interviews/[id]/summarize/route.ts|POST': summarizePost,
  'exit-interviews/copilot/route.ts|GET': copilotGet,
  'exit-interviews/copilot/route.ts|POST': copilotPost,
  'exit-interviews/analytics/route.ts|GET': analyticsGet,
  'exit-interviews/cognition-memory/route.ts|GET': cognitionMemoryGet,
  'exit-interviews/cognition-memory/route.ts|POST': cognitionMemoryPost,
  'exit-interviews/reasoning-sessions/route.ts|GET': reasoningSessionsGet,
  'exit-interviews/reasoning-sessions/route.ts|POST': reasoningSessionsPost,
  'exit-interviews/graph-query/route.ts|POST': graphQueryPost,
  'exit-interviews/mitigation-comparison/route.ts|POST': mitigationPost,
  'exit-interviews/scenarios/route.ts|POST': scenariosPost,
  'exit-interviews/simulation/route.ts|POST': simulationPost,
}

export function facts(a) {
  const build = BUILDERS[`${a.route}|${a.method}`]
  if (!build) throw new Error(`no exit-core facts for ${a.route}|${a.method}`)
  return build(a)
}
