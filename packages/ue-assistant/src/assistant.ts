/**
 * @nzila/ue-assistant — Main Assistant Orchestrator
 *
 * Ties together all phases: context resolution, intent classification,
 * role enforcement, knowledge retrieval, tool execution, response
 * policy, domain rules, escalation, guardrails, and audit logging.
 */
import { randomUUID } from 'node:crypto'
import {
  type AssistantRequest,
  type AssistantResponse,
  type ToolInvocation,
  type KnowledgeCitation,
  ResponseTypes,
  assistantRequestSchema,
} from './types'
import { getRoleCapability, getRoleMode } from './roles'
import { classifyIntentForRole, getIntentConfidence } from './intents'
import { validateOrgScope } from './context'
import { type KnowledgeStore, retrieveKnowledge } from './knowledge'
import { executeTool } from './tools'
import { determineResponseType, requiresCitations } from './response-policy'
import { getActionsForRole, getRequiredDisclaimers, isSafetyUrgent } from './domain-rules'
import { evaluateEscalation } from './escalation'
import { resolveLanguage, getLocalizedMessage } from './localization'
import { recordAuditEntry } from './audit'
import { runGuardrails, computeConfidence } from './guardrails'

// ── Assistant Options ───────────────────────────────────────────────────────

export interface AssistantOptions {
  readonly knowledgeStore: KnowledgeStore
  readonly actorId?: string
}

// ── Main Orchestrator ───────────────────────────────────────────────────────

/**
 * Process a single assistant request through the full pipeline:
 *
 * 1. Validate & resolve context
 * 2. Classify intent (role-filtered)
 * 3. Determine response type (role + intent policy)
 * 4. Retrieve scoped knowledge
 * 5. Execute domain actions / tools
 * 6. Evaluate escalation triggers
 * 7. Run guardrails
 * 8. Build response
 * 9. Record audit entry
 */
export function processRequest(
  request: AssistantRequest,
  options: AssistantOptions,
): AssistantResponse {
  const requestId = randomUUID()
  const ctx = request.context

  // 1. Validate context
  assistantRequestSchema.parse(request)
  validateOrgScope(ctx)

  // 2. Classify intent
  const intent = classifyIntentForRole(request.query, ctx.userRole)
  const intentConfidence = getIntentConfidence(request.query)

  // 3. Determine response type
  let responseType = determineResponseType(ctx.userRole, intent)

  // 4. Retrieve knowledge
  const citations: KnowledgeCitation[] = retrieveKnowledge(
    options.knowledgeStore,
    request.query,
    intent,
    ctx,
  )

  // 5. Execute domain actions / tools
  const toolsInvoked: ToolInvocation[] = []
  const actions = getActionsForRole(intent, ctx)
  for (const action of actions) {
    if (action.tool) {
      const invocation = executeTool(action.tool, ctx, {
        query: request.query,
        caseId: ctx.userState.openCases[0],
      })
      toolsInvoked.push(invocation)
    }
  }

  // 6. Compute confidence
  const confidence = computeConfidence(citations, intentConfidence)

  // 7. Evaluate escalation
  const escalation = evaluateEscalation({
    query: request.query,
    intent,
    confidence,
    citations,
    ctx,
  })

  if (escalation) {
    responseType = ResponseTypes.ESCALATION_REQUIRED
  }

  // 8. Build content
  const language = resolveLanguage(ctx.language)
  const disclaimers = getRequiredDisclaimers(intent)
  let content = buildContent(request.query, intent, responseType, citations, language)

  // Append disclaimers
  if (disclaimers.length > 0) {
    content += '\n\n' + disclaimers.join('\n')
  }

  // Safety urgency check
  if (isSafetyUrgent(request.query)) {
    content = getLocalizedMessage('safety_emergency', language) + '\n\n' + content
  }

  // 9. Run guardrails
  const guardrailResult = runGuardrails({
    intent,
    ctx,
    citations,
    content,
    confidence,
    responseType,
  })

  if (!guardrailResult.passed && guardrailResult.adjustedResponseType) {
    responseType = guardrailResult.adjustedResponseType
    content += '\n\n[Guardrail violations detected: ' + guardrailResult.violations.join('; ') + ']'
  }

  // 10. Record audit
  const roleCapability = getRoleCapability(ctx.userRole)
  const actorId = options.actorId ?? 'unknown'
  recordAuditEntry({
    userId: actorId,
    orgId: ctx.orgId,
    role: ctx.userRole,
    intent,
    query: request.query,
    responseType,
    mode: roleCapability.mode,
    sourcesUsed: citations.map((c) => c.sourceId),
    toolsInvoked: toolsInvoked.map((t) => t.tool),
    dataAccessed: citations.map((c) => `${c.sourceType}:${c.sourceId}`),
    escalationTriggered: escalation !== null,
    confidence,
  })

  return {
    requestId,
    responseType,
    content,
    citations,
    toolsInvoked,
    escalation,
    confidence,
    language,
    timestamp: new Date().toISOString(),
  }
}

// ── Content Builder ─────────────────────────────────────────────────────────

function buildContent(
  query: string,
  intent: string,
  responseType: string,
  citations: readonly KnowledgeCitation[],
  language: string,
): string {
  if (responseType === ResponseTypes.CLARIFICATION_REQUIRED) {
    return getLocalizedMessage('clarification_needed', language)
  }

  if (responseType === ResponseTypes.ESCALATION_REQUIRED) {
    return getLocalizedMessage('escalation_notice', language)
  }

  const citationText =
    citations.length > 0
      ? '\n\nSources:\n' +
        citations.map((c) => `- ${c.title}: ${c.excerpt}`).join('\n')
      : ''

  switch (responseType) {
    case ResponseTypes.GUIDED_STEPS:
      return `Here are the steps to proceed with your ${intent} request.${citationText}`
    case ResponseTypes.CITED_EXPLANATION:
      return `Based on the relevant documents, here is the information regarding your ${intent} question.${citationText}`
    case ResponseTypes.ANALYTICAL_OUTPUT:
      return `Analysis of your ${intent} query based on available data and documentation.${citationText}`
    case ResponseTypes.DIRECT_ANSWER:
      return `Regarding your ${intent} question: information has been retrieved from the available sources.${citationText}`
    default:
      return `Response generated for your query about ${intent}.${citationText}`
  }
}
