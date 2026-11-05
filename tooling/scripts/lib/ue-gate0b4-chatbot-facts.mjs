/**
 * Gate 0B.4 facts for the four chatbot routes. The routes configure the guard and call ChatbotService or
 * ChatSessionManager; each statement is read from the exact handler, the service method it calls, or the table definition.
 */
import { mk } from './ue-gate0b4-record.mjs'
import { APP, guardEv } from './ue-gate0b4-fact-helpers.mjs'
import { CAPABILITY_IDS_0B2 } from './ue-gate0b2-groups.mjs'

const GATE = 14
const DEPS = [6, 13]
const SERVICE = `${APP}lib/ai/chatbot-service.ts`
const SCHEMA = `${APP}db/schema/domains/ml/chatbot.ts`
const OWNER = CAPABILITY_IDS_0B2.AI

export const CHATBOT_ROUTES = new Set([
  'chatbot/messages/route.ts', 'chatbot/sessions/[sessionId]/messages/route.ts', 'chatbot/sessions/route.ts',
])

const D = (id, severity, title) => ({ id, gate: GATE, severity, ownerCapabilityId: OWNER, title })
export const CHATBOT_DEFECTS = [
  D('DEF-0B4-CHATBOT-SAFETY-SKIPPED-OR-FAILS-OPEN', 'HIGH', 'The moderation step returns not flagged when OPENAI_API_KEY is unset and, when the moderation request fails, returns a flagged result with the reason Safety system unavailable that sendMessage then ignores and proceeds, although the code comments call the failure closed; a member message reaches the model unmoderated whenever moderation is absent or down.'),
  D('DEF-0B4-CHATBOT-MODERATION-BYPASSES-AI-CONTROL-PLANE', 'MEDIUM', 'The moderation step posts the member message text directly to api.openai.com with a provider key, outside @nzila/ai-sdk which the same file names as the only route for AI calls, so the data-class, budget and audit controls of the AI control plane do not apply to that call.'),
  D('DEF-0B4-CHATBOT-REVIEW-NOT-REQUIRED-AND-FIXED-ROLE', 'MEDIUM', 'The message route marks every reply reviewRequired false and passes the literal role member to enforceAISafety whatever the caller role is, although the service describes the output as advisory with human stewardship preserved, so the policy check never sees the caller real role and the response never asks for review.'),
  D('DEF-0B4-CHATBOT-FALLBACK-PRESENTED-AS-AI-REPLY', 'MEDIUM', 'When the model call fails the service stores a fixed apology as an assistant message with model fallback, and the route returns it as a successful response marked aiGenerated true with the configured deployment name as the model, so an outage is persisted in the transcript and reported as a model reply.'),
  D('DEF-0B4-CHATBOT-RAG-LIMITS-BEFORE-SCORING', 'MEDIUM', 'Retrieval selects at most three active knowledge rows of the organization with no ordering and no vector predicate and only then scores them by similarity, so the context sent to the model is an arbitrary subset of the knowledge base rather than the most relevant documents.'),
  D('DEF-0B4-CHATBOT-SESSION-READ-IGNORES-STATE-AND-FEATURE-GATE', 'MEDIUM', 'The session list and the message read apply no status condition, so archived and deleted sessions stay listed and readable, and the message read applies neither the ai_chatbot entitlement, the AI feature flag, the AI safety check nor a rate limit, so a transcript stays readable after the feature is disabled.'),
]

const roleAuthEv = (a) => [
  ...guardEv(a, 'withApi'),
  a.h('authorization', "auth: { minRole: 'member' },"),
]

const gateEv = (a) => [
  a.h('authorization', "entitlement: 'ai_chatbot',"),
  a.imp('authorization', 'withApi', 'await requireEntitlement(resolvedOrganizationId, options.entitlement, user.id);'),
  a.h('authorization', 'const blocked = await guardAiFeature(AI_FEATURES.AI_CHATBOT'),
  a.h('authorization', 'enforceAISafety({'),
]

const SESSION_TABLE = (a) => a.sch('tenantScope', SCHEMA, /organizationId: uuid\("organization_id"\)/, { symbol: 'chatSessions' })
const TRANSCRIPT = 'A member conversation with the AI assistant: free-text questions about rights, grievances and agreement interpretation, which may name the member, a case or an employer, with the retrieved knowledge excerpts.'
const OWNER_DATA = 'chat_sessions rows belong to one user within one organization; chat_messages rows belong to a session and carry no organization column of their own.'
const common = {
  persona: 'Organization member using the AI rights assistant',
  authn: 'Authenticated session resolved by withApi.',
  gate: GATE,
  deps: DEPS,
  dec: [],
}

const absence = (a, names, defect) => {
  const found = names.filter((name) => a.region.includes(name))
  if (found.length > 0) throw new Error(`${a.route}|${a.method}: the handler unexpectedly contains ${found.join(', ')}`)
  return { claim: 'defect', statement: defect }
}

const FACTS = {
  'chatbot/messages/route.ts|POST': (a) => mk({
    ...common,
    service: `${SERVICE} (ChatbotService.sendMessage)`,
    authz: "withApi auth.minRole member plus the ai_chatbot entitlement, the AI feature flag and enforceAISafety, which the route calls with the literal role member. A role title is not a kernel decision.",
    tenant: 'The service loads the session by id and refuses unless the session userId equals the session user and its organizationId equals the session organization; knowledge retrieval and citation counts are bound to that organization.',
    owner: OWNER_DATA,
    sens: TRANSCRIPT,
    priv: 'The member message is sent to the moderation provider and to the model provider and stored in chat_messages; a flagged message is also stored verbatim in ai_safety_filters.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The user message, the assistant reply, the session counters, the citation counts and a chatbot.message.exchange audit record commit in one tenant transaction. Around the moderation, retrieval and model calls the service records intent and outcome with performAuditedOperation, and the route records a separate AI invocation event before the call.',
    reqAudit: 'Keep the in-transaction exchange record; record the model that answered, whether the reply was a fallback, and the retrieved document identifiers in it.',
    does: 'Validates the body, moderates the message, retrieves up to three knowledge documents of the organization, calls the model, stores the member message and the reply, and returns the reply with AI metadata; when the model call fails it stores and returns a fixed apology.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: 'Resolve the caller real role into the AI policy check, fail closed when moderation is unavailable, route moderation through the AI control plane, mark the reply as requiring review, and do not persist a fallback as an assistant reply.',
    ev: [
      ...roleAuthEv(a),
      ...gateEv(a),
      a.h('mutation', 'assistantMessage = await chatbotService.sendMessage({'),
      a.h('audit', 'const auditRefId = await auditAIInvocation({'),
      a.h('defect', 'userRole: \'member\','),
      a.h('defect', 'reviewRequired: false,'),
      a.h('defect', "model: process.env.AZURE_OPENAI_DEPLOYMENT ?? 'gpt-4',"),
      a.svc('tenantScope', SERVICE, 'if (session.userId !== data.userId || session.organizationId !== data.organizationId) {', 'ChatbotService.sendMessage'),
      a.svc('mutation', SERVICE, 'await tx.insert(chatMessages).values({', 'ChatbotService.sendMessage'),
      a.svc('audit', SERVICE, 'await persistAtomicAudit(tx, {', 'ChatbotService.sendMessage'),
      a.svc('audit', SERVICE, 'const { response, retrievedDocs, responseTime } = await performAuditedOperation(', 'ChatbotService.sendMessage'),
      a.svc('defect', SERVICE, "if (safetyCheck.reason === 'Safety system unavailable') {", 'ChatbotService.sendMessage'),
      a.svc('defect', SERVICE, "model: 'fallback',", 'ChatbotService.sendMessage'),
      a.svc('defect', SERVICE, 'if (!apiKey) {', 'ChatbotService.checkContentSafety'),
      a.svc('defect', SERVICE, 'const response = await fetch("https://api.openai.com/v1/moderations", {', 'ChatbotService.checkContentSafety'),
      a.svc('defect', SERVICE, "return { flagged: true, reason: 'Safety system unavailable' }; // Fail closed"),
      a.svc('defect', SERVICE, '.limit(options.limit || 5);', 'RAGService.searchDocuments'),
      a.svc('defect', SERVICE, 'INV-01: All AI calls routed through @nzila/ai-sdk'),
      a.sch('privacy', SCHEMA, /content: text\("content"\)\.notNull\(\)/, { symbol: 'chatMessages' }),
      a.sch('tenantScope', SCHEMA, /sessionId: uuid\("session_id"\)/, { symbol: 'chatMessages' }),
    ],
    def: [
      'DEF-0B4-CHATBOT-SAFETY-SKIPPED-OR-FAILS-OPEN', 'DEF-0B4-CHATBOT-MODERATION-BYPASSES-AI-CONTROL-PLANE',
      'DEF-0B4-CHATBOT-REVIEW-NOT-REQUIRED-AND-FIXED-ROLE', 'DEF-0B4-CHATBOT-FALLBACK-PRESENTED-AS-AI-REPLY',
      'DEF-0B4-CHATBOT-RAG-LIMITS-BEFORE-SCORING',
    ],
    corr: [],
  }),

  'chatbot/sessions/[sessionId]/messages/route.ts|GET': (a) => ({
    ...mk({
      ...common,
      service: `${SERVICE} (ChatbotService.getMessages)`,
      authz: 'withApi auth.minRole member. The service refuses unless the session belongs to the session user in the session organization. The handler applies no entitlement, no AI feature flag, no AI safety check and no rate limit.',
      tenant: 'The service loads the session by id and refuses unless the session userId equals the session user and its organizationId equals the session organization.',
      owner: OWNER_DATA,
      sens: TRANSCRIPT,
      priv: 'The caller own conversation is returned, including the retrieved document excerpts stored with each reply, whatever the status of the session.',
      mut: 'NOT_MUTATING',
      auditDetail: 'A read: the handler and the service write no row and no audit record.',
      reqAudit: 'Reads of the caller own transcript need no audit record.',
      does: 'Returns up to 100 messages of one chat session of the caller in chronological order.',
      status: 'IMPLEMENTED_IN_SOURCE',
      future: 'Apply the entitlement and the AI feature flag to transcript reads, exclude deleted sessions, and decide whether a steward may ever read a member transcript.',
      ev: [
        ...roleAuthEv(a),
        a.h('mutation', 'const messages = await chatbotService'),
        a.svc('tenantScope', SERVICE, 'if (!session || session.userId !== owner.userId || session.organizationId !== owner.organizationId) {', 'ChatbotService.getMessages'),
        a.svc('mutation', SERVICE, '.where(eq(chatMessages.sessionId, sessionId))', 'ChatbotService.getMessages'),
        a.svc('defect', SERVICE, '.limit(options.limit || 100)', 'ChatbotService.getMessages'),
        SESSION_TABLE(a),
        a.sch('privacy', SCHEMA, /content: text\("content"\)\.notNull\(\)/, { symbol: 'chatMessages' }),
      ],
      def: ['DEF-0B4-CHATBOT-SESSION-READ-IGNORES-STATE-AND-FEATURE-GATE'],
      corr: [],
    }),
    inferences: [absence(a, ['entitlement', 'guardAiFeature', 'rateLimit', 'enforceAISafety'], 'The handler configuration lists auth and openapi only: it names no entitlement, no rateLimit, and the handler calls neither guardAiFeature nor enforceAISafety.')],
  }),

  'chatbot/sessions/route.ts|GET': (a) => mk({
    ...common,
    service: `${SERVICE} (ChatSessionManager.getUserSessions)`,
    authz: 'withApi auth.minRole member plus the ai_chatbot entitlement, the AI feature flag and enforceAISafety, which the route calls with the literal role member.',
    tenant: 'The service selects sessions whose userId equals the session user and whose organizationId equals the session organization.',
    owner: OWNER_DATA,
    sens: 'Conversation titles and context tags, which the member or the first message may have worded with case detail',
    priv: 'The caller own sessions, including archived and deleted ones, are listed.',
    mut: 'NOT_MUTATING',
    auditDetail: 'A read: the handler and the service write no row and no audit record.',
    reqAudit: 'Reads of the caller own session list need no audit record.',
    does: 'Lists up to 50 chat sessions of the caller in the session organization, newest message first.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: 'Exclude deleted sessions and apply one status rule across the session routes.',
    ev: [
      ...roleAuthEv(a),
      ...gateEv(a),
      a.h('mutation', 'const sessions = await sessionManager.getUserSessions(userId!, {'),
      a.svc('tenantScope', SERVICE, 'const conditions = [eq(chatSessions.userId, userId)];', 'ChatSessionManager.getUserSessions'),
      a.svc('tenantScope', SERVICE, 'conditions.push(eq(chatSessions.organizationId, options.organizationId));', 'ChatSessionManager.getUserSessions'),
      a.svc('defect', SERVICE, 'if (options.status) {', 'ChatSessionManager.getUserSessions'),
      SESSION_TABLE(a),
    ],
    def: ['DEF-0B4-CHATBOT-SESSION-READ-IGNORES-STATE-AND-FEATURE-GATE'],
    corr: [],
  }),

  'chatbot/sessions/route.ts|POST': (a) => mk({
    ...common,
    service: `${SERVICE} (ChatSessionManager.createSession)`,
    authz: 'withApi auth.minRole member plus the ai_chatbot entitlement, the AI feature flag and enforceAISafety, which the route calls with the literal role member.',
    tenant: 'The route refuses when no organization is selected and the service writes the session with the session organization and user.',
    owner: OWNER_DATA,
    sens: 'A conversation title worded by the member',
    priv: 'The member title is stored on the session.',
    mut: 'ATOMIC_AUDIT_IN_TRANSACTION',
    auditDetail: 'The session row and a chatbot.session.create audit record commit in one tenant transaction.',
    reqAudit: 'Keep the in-transaction audit record.',
    does: 'Creates a chat session for the caller with a title of at most 500 characters.',
    status: 'IMPLEMENTED_IN_SOURCE',
    future: 'Resolve the caller real role into the AI policy check.',
    ev: [
      ...roleAuthEv(a),
      ...gateEv(a),
      a.h('tenantScope', 'if (!organizationId) {'),
      a.h('mutation', 'const session = await sessionManager.createSession({'),
      a.h('defect', "userRole: 'member',"),
      a.svc('mutation', SERVICE, '.insert(chatSessions)', 'ChatSessionManager.createSession'),
      a.svc('audit', SERVICE, 'await persistAtomicAudit(tx, {', 'ChatSessionManager.createSession'),
      a.svc('tenantScope', SERVICE, 'organizationId: data.organizationId,', 'ChatSessionManager.createSession'),
      SESSION_TABLE(a),
    ],
    def: ['DEF-0B4-CHATBOT-REVIEW-NOT-REQUIRED-AND-FIXED-ROLE'],
    corr: [],
  }),
}

export function chatbotFacts(a) {
  const fact = FACTS[`${a.route}|${a.method}`]
  if (!fact) throw new Error(`no chatbot facts for ${a.route}|${a.method}`)
  return fact(a)
}
