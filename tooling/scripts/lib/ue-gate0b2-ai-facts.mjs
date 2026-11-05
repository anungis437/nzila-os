/**
 * Gate 0B.2 facts for the AI advisory routes. Each statement was read from the cited route, service or guard file.
 * The route-coverage manifest calls every one of these ROLE_TITLE_CHECK. That is accurate: a role-title floor plus an
 * entitlement and a feature flag. None of those is a kernel decision, so no record here claims kernel authorization.
 */
import { APP, ev, routeEv, appEv, NOT_ATOMIC, GET_WRITES } from './ue-gate0b2-fact-helpers.mjs'

const ROUTE = (route) => `${APP}app/api/${route}`
const TRIAGE = appEv('lib/ai/grievance-triage.ts', 'await persistAtomicAudit(tx, {')
const REASONING = appEv('lib/ai/clause-reasoning.ts', 'await persistAtomicAudit(tx, {')
const COPILOT_AUDIT = appEv('lib/ai/steward-copilot.ts', 'await persistAtomicAudit(tx, {')

const floor = (role) => ({
  authorizationCategory: 'ROLE_FLOOR',
  authorizationDetail: `withRoleAuth('${role}'): a ${role} role-title floor, plus an entitlement and a feature flag that are billing and rollout gates. None is a kernel decision about the resource.`,
})
const SESSION = 'Entra session via withRoleAuth.'
const DOWNGRADE = 'DEF-0B2-AI-DATA-CLASS-DOWNGRADE'
const CASE_AUTH = 'DEF-0B2-AI-GRIEVANCE-NO-CASE-AUTHORITY'
const FINANCE_GATE = 'DEF-0B2-AI-FINANCE-ROLE-TITLE-GATE'

const FACTS = {}
const add = (id, facts) => { FACTS[id] = facts }

const grievanceTriage = (route, origin) => ({
  persona: 'Steward requesting advisory AI triage of a grievance',
  serviceOwner: `${APP}lib/ai/grievance-triage.ts`,
  authenticationMechanism: SESSION,
  ...floor('steward'),
  tenantScope: 'The grievance is read with an organization predicate (eq(grievances.organizationId, organizationId)) and the row is written under withRLSContext for that organization.',
  dataOwnership: 'grievances rows and ai_grievance_triages rows owned by the organization.',
  dataSensitivity: 'Grievance facts and member identity sent to a model',
  privacyDisclosure: 'Grievance content is sent to the model for any grievance in the organization the steward names; the route does not check that the steward holds the case. The route declares the grievance_legal data class and the service calls the model as internal.',
  mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: "The triage row insert and persistAtomicAudit (action 'ai.grievance_triage.create') run in one withRLSContext transaction.",
  implementedBehavior: `Analyses a grievance with a model and stores an advisory triage row (${origin}).`,
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 2,
  requiredFutureGuard: 'Authorize the triage by a kernel case-ownership decision for the named grievance.',
  evidence: [
    routeEv(route, "withRoleAuth('steward'"),
    routeEv(route, "dataClass: 'grievance_legal'"),
    appEv('lib/ai/grievance-triage.ts', 'where: and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId)),'),
    appEv('lib/ai/grievance-triage.ts', 'await tx.insert(aiGrievanceTriages).values(insert);'),
    appEv('lib/ai/grievance-triage.ts', "dataClass: 'internal',"),
    TRIAGE,
  ],
  defects: [CASE_AUTH, DOWNGRADE],
  manifestCorrections: [],
  institutionalDecisions: [],
})
add('ai/grievances/triage/route.ts|POST', grievanceTriage('ai/grievances/triage/route.ts', 'grievance supplied in the request body'))
add('ai/grievances/[id]/triage/route.ts|POST', grievanceTriage('ai/grievances/[id]/triage/route.ts', 'grievance named in the path'))

add('ai/grievances/[id]/clause-reasoning/route.ts|POST', {
  persona: 'Steward requesting advisory AI clause reasoning for a grievance',
  serviceOwner: `${APP}lib/ai/clause-reasoning.ts`,
  authenticationMechanism: SESSION,
  ...floor('steward'),
  tenantScope: 'The grievance is read with an organization predicate and the reasoning row is written under withRLSContext for that organization.',
  dataOwnership: 'grievances rows and ai_clause_reasonings rows owned by the organization.',
  dataSensitivity: 'Grievance facts and agreement clauses sent to a model',
  privacyDisclosure: 'Grievance content is sent to the model for any grievance in the organization the steward names; the route does not check that the steward holds the case. The route declares grievance_legal and the service calls the model as internal.',
  mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: "The reasoning row insert and persistAtomicAudit (action 'ai.clause_reasoning.create') run in one withRLSContext transaction.",
  implementedBehavior: 'Suggests agreement clauses relevant to a grievance with a model and stores the advisory suggestion.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 2,
  requiredFutureGuard: 'Authorize the reasoning by a kernel case-ownership decision for the named grievance.',
  evidence: [
    routeEv('ai/grievances/[id]/clause-reasoning/route.ts', "withRoleAuth('steward'"),
    routeEv('ai/grievances/[id]/clause-reasoning/route.ts', "dataClass: 'grievance_legal'"),
    appEv('lib/ai/clause-reasoning.ts', 'where: and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId)),'),
    appEv('lib/ai/clause-reasoning.ts', 'await tx.insert(aiClauseReasonings).values(insert);'),
    appEv('lib/ai/clause-reasoning.ts', "dataClass: 'internal',"),
    REASONING,
    appEv('lib/ai/clause-reasoning.ts', "action: 'ai.clause_reasoning.create',"),
  ],
  defects: [CASE_AUTH, DOWNGRADE],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/copilot/query/route.ts|GET', {
  persona: 'Steward reading their own copilot history',
  serviceOwner: `${APP}lib/ai/steward-copilot.ts`,
  authenticationMechanism: SESSION,
  ...floor('steward'),
  tenantScope: 'getCopilotHistory filters on the caller user id and organization id.',
  dataOwnership: 'ai_copilot_sessions rows owned by the steward who created them.',
  dataSensitivity: 'Copilot queries and advisory responses',
  privacyDisclosure: 'A steward reads only their own sessions.',
  mutationAudit: 'NOT_MUTATING',
  auditDetail: 'A read; nothing is written and no read audit is recorded.',
  implementedBehavior: 'Returns the caller copilot session history.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'None beyond the kernel decision that Gate 13 applies to every role-floor route.',
  evidence: [routeEv('ai/copilot/query/route.ts', "withRoleAuth('steward'"), routeEv('ai/copilot/query/route.ts', 'getCopilotHistory(context.userId!, context.organizationId!)'), appEv('lib/ai/steward-copilot.ts', 'eq(aiCopilotSessions.userId, userId),')],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/copilot/query/route.ts|POST', {
  persona: 'Steward asking the advisory copilot a question about a case',
  serviceOwner: `${APP}lib/ai/steward-copilot.ts`,
  authenticationMechanism: SESSION,
  ...floor('steward'),
  tenantScope: 'The related grievance, when named, is read with an organization predicate; the session row is written for the caller organization and user.',
  dataOwnership: 'ai_copilot_sessions rows owned by the steward; grievance rows owned by the organization.',
  dataSensitivity: 'Case facts sent to a model',
  privacyDisclosure: 'A named grievance in the organization is used as model context without checking that the steward holds the case.',
  mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: "The session insert and persistAtomicAudit (action 'ai.copilot.session.create') run in one withRLSContext transaction. The route also records auditAIInvocation, a separate event.",
  implementedBehavior: 'Generates an advisory copilot response and stores it as a pending session.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 2,
  requiredFutureGuard: 'Authorize use of a named grievance by a kernel case-ownership decision.',
  evidence: [routeEv('ai/copilot/query/route.ts', "withRoleAuth('steward'"), routeEv('ai/copilot/query/route.ts', 'const auditRefId = await auditAIInvocation({'), appEv('lib/ai/steward-copilot.ts', 'eq(grievances.organizationId, input.organizationId),'), appEv('lib/ai/steward-copilot.ts', 'await tx.insert(aiCopilotSessions).values(insert);'), COPILOT_AUDIT, appEv('lib/ai/steward-copilot.ts', "action: 'ai.copilot.session.create',")],
  defects: [CASE_AUTH],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/copilot/sessions/[id]/route.ts|PATCH', {
  persona: 'Steward recording the outcome of their own copilot session',
  serviceOwner: `${APP}lib/ai/steward-copilot.ts`,
  authenticationMechanism: SESSION,
  ...floor('steward'),
  tenantScope: 'The update is predicated on session id, organization id and the caller user id, and only while the outcome is pending.',
  dataOwnership: 'ai_copilot_sessions rows owned by the steward who created them.',
  dataSensitivity: 'Copilot session outcome',
  privacyDisclosure: 'No session content is returned.',
  mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: "The outcome update and persistAtomicAudit (action 'ai.copilot.session.outcome') run in one withRLSContext transaction.",
  implementedBehavior: 'Records accepted or rejected on a pending copilot session once.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'None beyond the kernel decision that Gate 13 applies to every role-floor route; the ownership predicate is already in the update.',
  evidence: [routeEv('ai/copilot/sessions/[id]/route.ts', "withRoleAuth('steward'"), appEv('lib/ai/steward-copilot.ts', 'eq(aiCopilotSessions.userId, userId),'), COPILOT_AUDIT, appEv('lib/ai/steward-copilot.ts', "action: 'ai.copilot.session.outcome',")],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/extract-clauses/route.ts|POST', {
  persona: 'Steward extracting clauses from a collective agreement',
  serviceOwner: `${APP}lib/services/ai/clause-extraction-service.ts`,
  authenticationMechanism: SESSION,
  ...floor('steward'),
  tenantScope: 'The organization is taken from the session, never from the body; a different organizationId in the body is rejected. The agreement update is predicated on that organization.',
  dataOwnership: 'collective_agreements and extracted clause rows owned by the organization.',
  dataSensitivity: 'Collective agreement text sent to a model',
  privacyDisclosure: 'Agreement text is sent to a model. The route accepts a caller-supplied URL that is placed in the model prompt.',
  mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: "Clause inserts, the agreement update and persistAtomicAudit (action 'ai.clause_extraction.persist') run in one withRLSContext transaction.",
  implementedBehavior: 'Extracts clauses from an agreement document with a model, saves them and marks the agreement processed.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'Authorize extraction by a kernel resource decision on the agreement.',
  evidence: [routeEv('ai/extract-clauses/route.ts', "withRoleAuth('steward'"), routeEv('ai/extract-clauses/route.ts', 'requestedOrganizationId !== organizationId'), appEv('lib/services/ai/clause-extraction-service.ts', 'await persistAtomicAudit(tx, {'), appEv('lib/services/ai/clause-extraction-service.ts', "action: 'ai.clause_extraction.persist',")],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/feedback/route.ts|POST', {
  persona: 'Organization member rating an AI answer',
  serviceOwner: `${ROUTE('ai/feedback/route.ts')} (inline, ai_usage_metrics)`,
  authenticationMechanism: SESSION,
  ...floor('member'),
  tenantScope: 'The feedback row is created or updated under withRLSContext for the session organization and the caller user.',
  dataOwnership: 'ai_usage_metrics feedback rows owned by the member who gave them.',
  dataSensitivity: 'Rating and free-text comment',
  privacyDisclosure: 'The comment is stored; later reads by other members of the organization are covered by the GET record.',
  mutationAudit: 'ATOMIC_AUDIT_IN_TRANSACTION',
  auditDetail: "The feedback insert or update and persistAtomicAudit (ai.feedback.update and the create action) run in one withRLSContext transaction.",
  implementedBehavior: 'Creates or updates one feedback row per user and query.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'None beyond the kernel decision that Gate 13 applies to every role-floor route.',
  evidence: [routeEv('ai/feedback/route.ts', "withRoleAuth('member'"), routeEv('ai/feedback/route.ts', 'await persistAtomicAudit(tx, {'), routeEv('ai/feedback/route.ts', "action: 'ai.feedback.update',")],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/feedback/route.ts|GET', {
  persona: 'Organization member reading feedback on an AI answer',
  serviceOwner: `${ROUTE('ai/feedback/route.ts')} (inline, ai_usage_metrics)`,
  authenticationMechanism: SESSION,
  ...floor('member'),
  tenantScope: 'The query is predicated on request id, operation feedback and the session organization.',
  dataOwnership: 'ai_usage_metrics feedback rows owned by the member who gave them.',
  dataSensitivity: 'Rating, comment and user id of every member who rated a query',
  privacyDisclosure: 'Any member of the organization reads every other member rating, comment and user id for a query id.',
  mutationAudit: 'NOT_MUTATING',
  auditDetail: 'A read; nothing is written and no read audit is recorded.',
  implementedBehavior: 'Returns all feedback rows for a query id in the organization.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'Return only the caller own feedback to a member and aggregate for other readers.',
  evidence: [routeEv('ai/feedback/route.ts', "withRoleAuth('member'"), routeEv('ai/feedback/route.ts', 'eq(aiUsageMetrics.organizationId, context.organizationId),'), routeEv('ai/feedback/route.ts', 'user_id: r.userId,')],
  defects: ['DEF-0B2-AI-FEEDBACK-READ-OTHER-USERS'],
  manifestCorrections: [],
  institutionalDecisions: [],
})

const financeRecord = (route, role, persona, sensitivity, serviceFile, classQuote, extraEvidence, behavior, method) => ({
  persona,
  serviceOwner: `${APP}${serviceFile}`,
  authenticationMechanism: role === 'officer-withApi' ? 'Entra session via withApi (auth.minRole officer).' : SESSION,
  authorizationCategory: 'ROLE_FLOOR',
  authorizationDetail: 'An officer role-title floor, plus an entitlement and a feature flag that are billing and rollout gates. There is no financial mandate and no kernel decision.',
  tenantScope: 'The service reads with organization predicates for the session organization.',
  dataOwnership: 'Financial or pension rows owned by the organization.',
  dataSensitivity: sensitivity,
  privacyDisclosure: 'Financial or pension data of the organization is sent to a model for any officer role title. The route declares a stricter data class than the service uses when it calls the model.',
  mutationAudit: 'NOT_MUTATING',
  ...(method === 'POST' ? { nonMutationReason: 'The POST returns a model-generated summary and writes no row.' } : {}),
  auditDetail: 'The route writes no row; auditAiInteraction records the model call as a separate audit event.',
  implementedBehavior: behavior,
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 5,
  requiredFutureGuard: 'Authorize by a financial mandate through the kernel, not an officer role title.',
  evidence: [routeEv(route, classQuote.route), appEv(serviceFile, classQuote.service), ...extraEvidence],
  defects: [FINANCE_GATE, DOWNGRADE],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/finance/analysis/route.ts|GET', {
  ...financeRecord('ai/finance/analysis/route.ts', 'officer-withApi', 'Officer requesting AI financial analysis', 'Dues, arrears, remittances, payment plans, trial balance and pension contributions', 'lib/ai/financial-insights.ts', { route: "dataClass: 'confidential'", service: "dataClass: 'internal'," }, [routeEv('ai/finance/analysis/route.ts', "auth: { minRole: 'officer' }"), appEv('lib/ai/financial-insights.ts', 'FROM member_arrears WHERE organization_id = ${orgIdCast}'), appEv('lib/ai/financial-insights.ts', 'const auditRef = await auditAiInteraction({')], 'Gathers organization financial aggregates and asks a model for a financial intelligence report.', 'GET'),
})
add('ai/pension/members/[id]/projection/route.ts|GET', financeRecord('ai/pension/members/[id]/projection/route.ts', 'officer', 'Officer requesting an AI pension benefit projection for a member', 'Pension member and contribution data', 'lib/ai/pension-intelligence.ts', { route: "dataClass: 'pension_financial'", service: "dataClass: 'internal'," }, [routeEv('ai/pension/members/[id]/projection/route.ts', "withRoleAuth('officer'"), appEv('lib/ai/pension-intelligence.ts', 'eq(pensionMembers.organizationId, organizationId),')], 'Projects a pension member benefit with a model.', 'GET'))
add('ai/pension/plans/[id]/funding/route.ts|GET', financeRecord('ai/pension/plans/[id]/funding/route.ts', 'officer', 'Officer requesting an AI pension funding analysis', 'Pension plan funding data', 'lib/ai/pension-intelligence.ts', { route: "dataClass: 'pension_financial'", service: "dataClass: 'internal'," }, [routeEv('ai/pension/plans/[id]/funding/route.ts', "withRoleAuth('officer'"), appEv('lib/ai/pension-intelligence.ts', 'eq(pensionPlans.organizationId, organizationId)')], 'Analyses the funding position of a pension plan with a model.', 'GET'))
add('ai/pension/plans/[id]/trustee-summary/route.ts|POST', financeRecord('ai/pension/plans/[id]/trustee-summary/route.ts', 'officer', 'Officer requesting an AI trustee summary of a pension plan', 'Pension plan and valuation document text', 'lib/ai/pension-intelligence.ts', { route: "dataClass: 'pension_financial'", service: "dataClass: 'internal'," }, [routeEv('ai/pension/plans/[id]/trustee-summary/route.ts', "withRoleAuth('officer'"), appEv('lib/ai/pension-intelligence.ts', 'eq(pensionPlans.organizationId, organizationId)')], 'Summarizes a trustee report for a pension plan with a model.', 'POST'))

const insightGet = (route, persona, behavior, service, insertQuote, role = 'officer') => ({
  persona,
  serviceOwner: `${APP}${service}`,
  authenticationMechanism: SESSION,
  ...floor(role),
  tenantScope: 'The service reads and writes organization-scoped rows for the session organization.',
  dataOwnership: 'Insight or risk rows owned by the organization.',
  dataSensitivity: 'Organization grievance, steward and employer analytics sent to a model',
  privacyDisclosure: `Organization analytics are sent to a model for a ${role} role title. The route declares the confidential data class and the service calls the model as internal.`,
  mutationAudit: 'SEPARATE_AUDIT_EVENT_NOT_ATOMIC',
  auditDetail: 'The GET inserts a row with the global db handle and records the invocation with auditAiInteraction, a separate event that is not committed with the row.',
  implementedBehavior: behavior,
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'Make generation a POST, commit the row and the audit record in one transaction and authorize by a kernel decision.',
  evidence: [routeEv(route, "withRoleAuth("), appEv(service, insertQuote), appEv(service, 'await auditAiInteraction({'), appEv(service, "dataClass: 'internal',")],
  defects: ['DEF-0B2-AI-GET-WRITES-ROWS', DOWNGRADE],
  manifestCorrections: [GET_WRITES('NOT_APPLICABLE:READ')],
  institutionalDecisions: [],
})
add('ai/employers/[id]/risk/route.ts|GET', { ...insightGet('ai/employers/[id]/risk/route.ts', 'Steward requesting an AI employer risk score', 'Calculates an employer risk score with a model, stores it and returns it.', 'lib/ai/employer-risk.ts', 'await db.insert(employerRiskScores).values(insert);', 'steward'), evidence: [routeEv('ai/employers/[id]/risk/route.ts', "withRoleAuth('steward'"), routeEv('ai/employers/[id]/risk/route.ts', "dataClass: 'confidential'"), appEv('lib/ai/employer-risk.ts', 'await db.insert(employerRiskScores).values(insert);'), appEv('lib/ai/employer-risk.ts', 'await auditAiInteraction({'), appEv('lib/ai/employer-risk.ts', "dataClass: 'internal',")] })
add('ai/insights/[reportType]/route.ts|GET', { ...insightGet('ai/insights/[reportType]/route.ts', 'Officer requesting an AI insight report', 'Generates an insight report of the requested type with a model, stores it and returns it.', 'lib/ai/executive-insights.ts', 'await db.insert(aiInsightReports).values(insert);'), evidence: [routeEv('ai/insights/[reportType]/route.ts', "withRoleAuth('officer'"), routeEv('ai/insights/[reportType]/route.ts', "dataClass: 'confidential'"), appEv('lib/ai/executive-insights.ts', 'await db.insert(aiInsightReports).values(insert);'), appEv('lib/ai/executive-insights.ts', 'await auditAiInteraction({'), appEv('lib/ai/executive-insights.ts', "dataClass: 'internal',")] })

add('ai/insights/summary/route.ts|GET', {
  persona: 'Officer reading the latest stored AI insight reports',
  serviceOwner: `${APP}lib/ai/executive-insights.ts (getInsightReports)`,
  authenticationMechanism: SESSION,
  ...floor('officer'),
  tenantScope: 'getInsightReports is called with the session organization id.',
  dataOwnership: 'ai_insight_reports rows owned by the organization.',
  dataSensitivity: 'Stored organization analytics reports',
  privacyDisclosure: 'Stored report content reaches any officer role title.',
  mutationAudit: 'NOT_MUTATING',
  auditDetail: 'No row is written. auditAIInvocation records the read as a separate audit event.',
  implementedBehavior: 'Returns the most recent stored report of each insight type.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'None beyond the kernel decision that Gate 13 applies to every role-floor route.',
  evidence: [routeEv('ai/insights/summary/route.ts', "withRoleAuth('officer'"), routeEv('ai/insights/summary/route.ts', "getInsightReports(context.organizationId!, 'trend_forecast', 1),"), routeEv('ai/insights/summary/route.ts', 'const auditRefId = await auditAIInvocation({')],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/ingest/route.ts|POST', {
  persona: 'Officer ingesting a document into the AI knowledge pipeline',
  serviceOwner: `${APP}lib/ai/rag-pipeline.ts`,
  authenticationMechanism: SESSION,
  ...floor('officer'),
  tenantScope: 'Chunks carry the session organization id. The index is a Map inside the running process, shared by nothing else.',
  dataOwnership: 'Uploaded document content owned by the organization.',
  dataSensitivity: 'Uploaded document content, parsed and optionally entity-extracted',
  privacyDisclosure: 'Document content is parsed in the request and, when addToRAG is set, held in process memory.',
  mutationAudit: 'INTENT_OUTCOME_AUDIT_NOT_ATOMIC',
  auditDetail: "When addToRAG is set, performAuditedOperation records intent and outcome around the in-memory index write (action 'ai.ingest.rag_index'). The effect is not in a database transaction. Without addToRAG nothing is written.",
  implementedBehavior: 'Parses an uploaded document, optionally extracts entities and adds it to a process-local index; the response reports status indexed.',
  implementationStatus: 'PARTIAL',
  requiredGate: 9,
  requiredFutureGuard: 'Persist the index durably and share it across instances, with the audit record committed with the write.',
  evidence: [routeEv('ai/ingest/route.ts', "withRoleAuth('officer'"), routeEv('ai/ingest/route.ts', "action: 'ai.ingest.rag_index',"), routeEv('ai/ingest/route.ts', 'await performAuditedOperation('), appEv('lib/ai/rag-pipeline.ts', 'private chunks: Map<string, TextChunk> = new Map();')],
  defects: ['DEF-0B2-AI-RAG-INDEX-PROCESS-LOCAL', 'DEF-0B1-NON-ATOMIC-AUDIT-INTENT-OUTCOME'],
  manifestCorrections: [NOT_ATOMIC],
  institutionalDecisions: [],
})
add('ai/ingest/route.ts|GET', {
  persona: 'Officer reading the ingestion API description',
  serviceOwner: `${ROUTE('ai/ingest/route.ts')} (inline)`,
  authenticationMechanism: SESSION,
  ...floor('officer'),
  tenantScope: 'None needed: the response is a static description of the endpoint.',
  dataOwnership: 'No data: a static description.',
  dataSensitivity: 'No organization data is returned.',
  privacyDisclosure: 'Nothing personal or organization-specific is returned.',
  mutationAudit: 'NOT_MUTATING',
  auditDetail: 'A read of a static description; nothing is written.',
  implementedBehavior: 'Returns static API information. The documented stats and status actions are not implemented.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'No further guard is required beyond the kernel decision that Gate 13 applies to every role-floor route.',
  evidence: [routeEv('ai/ingest/route.ts', "withRoleAuth('officer'"), routeEv('ai/ingest/route.ts', "name: 'AI Data Ingestion API',")],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/mamba/route.ts|POST', {
  persona: 'Officer running the local sequence-model utility',
  serviceOwner: `${APP}lib/ai/mamba-service.ts`,
  authenticationMechanism: SESSION,
  ...floor('officer'),
  tenantScope: 'The route reads no organization data: the model processes only the text in the request.',
  dataOwnership: 'The caller-supplied input only.',
  dataSensitivity: 'Caller-supplied text',
  privacyDisclosure: 'The input is processed by a local model and returned.',
  mutationAudit: 'NOT_MUTATING',
  nonMutationReason: 'The POST returns the model result and writes no row.',
  auditDetail: 'No row and no audit record is written; the route logs the inference.',
  implementedBehavior: 'Processes caller-supplied text with a local sequence model.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'None beyond the kernel decision that Gate 13 applies to every role-floor route.',
  evidence: [routeEv('ai/mamba/route.ts', "withRoleAuth('officer'"), routeEv('ai/mamba/route.ts', 'await mambaModel.process(input, {')],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})
add('ai/mamba/route.ts|GET', {
  persona: 'Officer reading the local sequence-model description',
  serviceOwner: `${ROUTE('ai/mamba/route.ts')} (mambaModel.getInfo)`,
  authenticationMechanism: SESSION,
  ...floor('officer'),
  tenantScope: 'None needed: the response describes the model.',
  dataOwnership: 'No data: model information.',
  dataSensitivity: 'No organization data is returned.',
  privacyDisclosure: 'Nothing personal or organization-specific is returned.',
  mutationAudit: 'NOT_MUTATING',
  auditDetail: 'A read of model information; nothing is written.',
  implementedBehavior: 'Returns model capabilities.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'No further guard is required beyond the kernel decision that Gate 13 applies to every role-floor route.',
  evidence: [routeEv('ai/mamba/route.ts', "withRoleAuth('officer'"), routeEv('ai/mamba/route.ts', 'const info = mambaModel.getInfo();')],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/classify/route.ts|POST', {
  persona: 'Organization member requesting AI clause classification',
  serviceOwner: `${APP}lib/services/ai/auto-classification-service.ts`,
  authenticationMechanism: SESSION,
  ...floor('member'),
  tenantScope: 'The route reads no organization data: the model classifies the text in the request.',
  dataOwnership: 'The caller-supplied text only.',
  dataSensitivity: 'Caller-supplied clause or precedent text sent to a model',
  privacyDisclosure: 'Caller-supplied text is sent to a model with no AI feature gate and no AI safety check.',
  mutationAudit: 'NOT_MUTATING',
  nonMutationReason: 'The POST returns a model classification and writes no row.',
  auditDetail: 'No row and no audit record is written, and no AI invocation event is recorded.',
  implementedBehavior: 'Classifies, tags, enriches or batch-classifies caller-supplied text with a model.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'Apply the AI feature gate and AI safety check that sibling routes apply and record the invocation.',
  evidence: [routeEv('ai/classify/route.ts', "withRoleAuth('member'"), routeEv('ai/classify/route.ts', "checkEntitlement(context.organizationId!, 'ai_classify')"), routeEv('ai/classify/route.ts', 'const classification = await classifyClause(content, classificationContext);')],
  defects: ['DEF-0B2-AI-CLASSIFY-UNGUARDED', 'DEF-0B2-AI-INVOCATION-NOT-AUDITED'],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/match-precedents/route.ts|POST', {
  persona: 'Organization member matching a claim against arbitration precedents',
  serviceOwner: `${APP}lib/services/ai/precedent-matching-service.ts`,
  authenticationMechanism: SESSION,
  ...floor('member'),
  tenantScope: 'The route reads no organization data: it matches caller-supplied claim text against the precedent corpus.',
  dataOwnership: 'The caller-supplied claim; the precedent corpus is shared reference data.',
  dataSensitivity: 'Caller-supplied claim facts sent to a model',
  privacyDisclosure: 'Claim facts are sent to a model; the action memorandum returns a generated legal memorandum.',
  mutationAudit: 'NOT_MUTATING',
  nonMutationReason: 'The POST returns matches, an analysis or a memorandum and writes no row.',
  auditDetail: 'No row and no audit record is written, and no AI invocation event is recorded.',
  implementedBehavior: 'Matches a claim to precedents, analyzes it or generates a legal memorandum.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'Record the invocation and authorize by a kernel decision.',
  evidence: [routeEv('ai/match-precedents/route.ts', "withRoleAuth('member'"), routeEv('ai/match-precedents/route.ts', 'const memorandum = await generateLegalMemorandum(claim, fullAnalysis);'), routeEv('ai/match-precedents/route.ts', "enforceAISafety({ origin: 'match-precedents'")],
  defects: ['DEF-0B2-AI-INVOCATION-NOT-AUDITED'],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/search/route.ts|GET', {
  persona: 'Organization member reading knowledge-base statistics',
  serviceOwner: `${ROUTE('ai/search/route.ts')} (inline query over knowledge_base)`,
  authenticationMechanism: SESSION,
  ...floor('member'),
  tenantScope: 'The statistics query is predicated on the session organization id.',
  dataOwnership: 'knowledge_base rows owned by the organization.',
  dataSensitivity: 'Document counts',
  privacyDisclosure: 'Counts only.',
  mutationAudit: 'NOT_MUTATING',
  auditDetail: 'A read; nothing is written and no read audit is recorded.',
  implementedBehavior: 'Returns document and embedding counts for the organization knowledge base.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'None beyond the kernel decision that Gate 13 applies to every role-floor route.',
  evidence: [routeEv('ai/search/route.ts', "withRoleAuth('member'"), routeEv('ai/search/route.ts', 'AND organization_id = ${statsOrgId}')],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})

const PUBLIC_ROW = 'Public cross-tenant rows are not authorized by being public: no source says who may set is_public.'
add('ai/search/route.ts|POST', {
  persona: 'Organization member searching the knowledge base',
  serviceOwner: `${ROUTE('ai/search/route.ts')} (inline query over knowledge_base)`,
  authenticationMechanism: SESSION,
  ...floor('member'),
  tenantScope: 'The query returns rows of the session organization and every row with is_public true from any organization.',
  dataOwnership: 'knowledge_base rows owned by the organization that created them.',
  dataSensitivity: 'Knowledge-base document titles and content previews',
  privacyDisclosure: 'Another organization row that is marked public is returned to this member. ' + PUBLIC_ROW,
  mutationAudit: 'NOT_MUTATING',
  nonMutationReason: 'The POST returns search hits and an optional generated answer and writes no row.',
  auditDetail: 'No row and no audit record is written, and no AI invocation event is recorded for the generated answer.',
  implementedBehavior: 'Runs a vector search and optionally generates an answer grounded on the hits.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'Decide who may publish a knowledge row beyond its organization and record the invocation.',
  evidence: [routeEv('ai/search/route.ts', "withRoleAuth('member'"), routeEv('ai/search/route.ts', 'AND (organization_id = ${orgId} OR is_public = true)'), routeEv('ai/search/route.ts', 'const gen = await ai.generate({')],
  defects: ['DEF-0B2-AI-PUBLIC-KNOWLEDGE-CROSS-TENANT', 'DEF-0B2-AI-INVOCATION-NOT-AUDITED'],
  manifestCorrections: [],
  institutionalDecisions: ['UE-INST-KNOWLEDGE-PUBLICATION'],
  crossTenantExposure: true,
  crossTenantAuthorized: false,
  exposureContract: 'Returns another organization knowledge row when is_public is true. No adopted decision names who may publish; the exposure is recorded as an implementation defect, not authorized access.',
})

add('ai/semantic-search/route.ts|GET', {
  persona: 'Organization member reading semantic-search index status',
  serviceOwner: `${ROUTE('ai/semantic-search/route.ts')} (inline counts)`,
  authenticationMechanism: SESSION,
  ...floor('member'),
  tenantScope: 'None: the counts select every cba_clause and arbitration_precedents row through the global db handle with no organization predicate.',
  dataOwnership: 'cba_clause rows owned by each organization; arbitration precedents are shared reference data.',
  dataSensitivity: 'Row counts across organizations',
  privacyDisclosure: 'Counts of every organization clause set reach any member.',
  mutationAudit: 'NOT_MUTATING',
  auditDetail: 'A read; nothing is written and no read audit is recorded.',
  implementedBehavior: 'Returns clause and precedent counts and embedding coverage across organizations.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'Scope the counts to the organization and the shared reference corpus.',
  evidence: [routeEv('ai/semantic-search/route.ts', "withRoleAuth('member'"), routeEv('ai/semantic-search/route.ts', '.from(cbaClause);'), routeEv('ai/semantic-search/route.ts', '.from(arbitrationPrecedents);')],
  defects: ['DEF-0B2-AI-SEMANTIC-STATS-UNSCOPED'],
  manifestCorrections: [],
  institutionalDecisions: [],
  crossTenantExposure: true,
  crossTenantAuthorized: false,
  exposureContract: 'Reports counts over every organization clause rows at the member role floor. No adopted decision authorizes it; it is recorded as an implementation defect.',
})
add('ai/semantic-search/route.ts|POST', {
  persona: 'Organization member searching clauses and precedents semantically',
  serviceOwner: `${ROUTE('ai/semantic-search/route.ts')} (semantic search services)`,
  authenticationMechanism: SESSION,
  ...floor('member'),
  tenantScope: 'Clause and similar-clause searches are confined to the session organization; an organization in the filters is never honoured. The precedent search takes no organization and searches the shared reference corpus.',
  dataOwnership: 'cba_clause rows owned by the organization; arbitration precedents are shared reference data.',
  dataSensitivity: 'Agreement clause text and precedent text',
  privacyDisclosure: 'Clause results are the organization own; precedent results come from a shared corpus.',
  mutationAudit: 'NOT_MUTATING',
  nonMutationReason: 'The POST returns search results and writes no row.',
  auditDetail: 'No row and no audit record is written.',
  implementedBehavior: 'Searches clauses, precedents or both, or finds similar clauses.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'None beyond the kernel decision that Gate 13 applies to every role-floor route.',
  evidence: [routeEv('ai/semantic-search/route.ts', "withRoleAuth('member'"), routeEv('ai/semantic-search/route.ts', 'const scopedFilters = { ...filters, organizationId };')],
  defects: [],
  manifestCorrections: [],
  institutionalDecisions: [],
})

add('ai/summarize/route.ts|POST', {
  persona: 'Organization member summarizing text or a knowledge-base document',
  serviceOwner: `${ROUTE('ai/summarize/route.ts')} (knowledge_base lookup)`,
  authenticationMechanism: SESSION,
  ...floor('member'),
  tenantScope: 'A knowledge document is returned when it belongs to the session organization or is marked public; a document derived from an exit interview is withheld below the interview sensitivity role.',
  dataOwnership: 'knowledge_base rows owned by the organization that created them.',
  dataSensitivity: 'Knowledge-base document content sent to a model',
  privacyDisclosure: 'Another organization document marked public is summarized for this member. ' + PUBLIC_ROW,
  mutationAudit: 'NOT_MUTATING',
  nonMutationReason: 'The POST returns a model summary and writes no row.',
  auditDetail: 'No row and no audit record is written, and no AI invocation event is recorded.',
  implementedBehavior: 'Summarizes supplied text or a knowledge document with a model.',
  implementationStatus: 'IMPLEMENTED_IN_SOURCE',
  requiredGate: 14,
  requiredFutureGuard: 'Decide who may publish a knowledge row beyond its organization and record the invocation.',
  evidence: [routeEv('ai/summarize/route.ts', "withRoleAuth('member'"), routeEv('ai/summarize/route.ts', 'if (doc.organizationId !== orgId && !doc.isPublic) {'), routeEv('ai/summarize/route.ts', 'const result = await ai.generate({')],
  defects: ['DEF-0B2-AI-PUBLIC-KNOWLEDGE-CROSS-TENANT', 'DEF-0B2-AI-INVOCATION-NOT-AUDITED'],
  manifestCorrections: [],
  institutionalDecisions: ['UE-INST-KNOWLEDGE-PUBLICATION'],
  crossTenantExposure: true,
  crossTenantAuthorized: false,
  exposureContract: 'Summarizes another organization document when isPublic is true. No adopted decision names who may publish; the exposure is recorded as an implementation defect, not authorized access.',
})

export const AI_ROUTES = new Set(Object.keys(FACTS))

export function aiFacts(id) {
  const facts = FACTS[id]
  if (!facts) throw new Error(`no AI facts for ${id}`)
  return structuredClone(facts)
}

void ev
