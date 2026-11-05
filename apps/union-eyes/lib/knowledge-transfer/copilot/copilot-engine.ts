/**
 * Governance Copilot Engine
 *
 * Explainable continuity reasoning assistant for organizational governance.
 * Answers continuity questions with full evidence-chain transparency.
 *
 * All responses are:
 * - evidence-grounded (from actual org data)
 * - reasoning-visible (step-by-step chain)
 * - governance-safe (organizational framing only)
 * - labor-safe (never evaluates individuals)
 * - auditable (persisted with explainability envelope)
 *
 * INV-01: All AI calls via @nzila/ai-sdk getAiClient()
 */

import { randomUUID } from 'crypto';
import { sql } from 'drizzle-orm';
import { ApiError } from '@/lib/api/errors';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { performAuditedOperation } from '@/lib/audit/operation-audit';
import type { RLSTx } from '@/lib/db/with-rls-context';
import { inOrganization, isUuid } from '../org-scope';
import {
  buildOrgAiTrace,
  getAiClient,
  UE_APP_KEY,
  UE_SYSTEM_ORG_ID,
} from '@/lib/ai/ai-client';
import { buildDependencyPropagationMap } from '../propagation/dependency-propagator';
import { calculateResilienceIndex } from '../resilience-index/resilience-calculator';
import {
  buildExplainabilityEnvelope,
  buildPropagationEvidence,
  buildGovernanceFlags,
} from '../copilot-explainability/response-builder';
import type { EvidenceReference, ReasoningLink, GovernanceFlag } from '../copilot-explainability/explainability-models';
import type { CopilotQueryInput, CopilotQueryResult, CopilotMessage } from './copilot-models';

// Profile key for continuity copilot — reuses STEWARD_COPILOT as organizational reasoning profile
const COPILOT_PROFILE = 'ue-steward-copilot';

/**
 * Load or create a conversation, on the caller's transaction. A conversation belongs to the person who opened it: naming one
 * that is not yours (or does not exist) is a not-found, never a new conversation and never a continuation of someone else's.
 */
async function upsertConversation(
  tx: RLSTx,
  orgId: string,
  conversationId: string | null,
  sessionId: string | null,
  contextSnapshot: Record<string, unknown> | null,
  userId: string,
): Promise<{ id: string; created: boolean }> {
  if (conversationId) {
    if (!isUuid(conversationId)) throw ApiError.notFound('Conversation');
    const rows = await tx.execute(sql`
      SELECT id FROM ue_copilot_conversations
      WHERE id = ${conversationId} AND organization_id = ${orgId} AND created_by = ${userId} LIMIT 1
    `);
    const result = rows as any as Record<string, unknown>[];
    if (result.length > 0) return { id: conversationId, created: false };
    throw ApiError.notFound('Conversation');
  }
  // Create new conversation
  const id = randomUUID();
  const now = new Date().toISOString();
  await tx.execute(sql`
    INSERT INTO ue_copilot_conversations (id, organization_id, session_id, context_snapshot, created_by, created_at, updated_at)
    VALUES (
      ${id}, ${orgId}, ${sessionId ?? null},
      ${contextSnapshot ? JSON.stringify(contextSnapshot) : null}::jsonb,
      ${userId}, ${now}::timestamptz, ${now}::timestamptz
    )
  `);
  return { id, created: true };
}

/** Append a message to a conversation, on the caller's transaction. */
async function appendMessage(
  tx: RLSTx,
  orgId: string,
  conversationId: string,
  message: CopilotMessage,
  userId: string,
): Promise<void> {
  await tx.execute(sql`
    UPDATE ue_copilot_conversations
    SET messages = messages || ${JSON.stringify([message])}::jsonb,
        updated_at = now()
    WHERE id = ${conversationId} AND organization_id = ${orgId} AND created_by = ${userId}
  `);
}

/** Build a continuity-aware system prompt from org context. */
function buildSystemPrompt(
  orgId: string,
  resilienceScore: number,
  singleSourceCount: number,
  totalNodes: number,
  bottleneckCount: number,
  criticalGaps: string[],
): string {
  return `You are a governance-aware organizational continuity advisor for a union organization (org: ${orgId}).

Your role is to help organizational leadership understand and improve organizational continuity.

CURRENT ORGANIZATIONAL CONTEXT:
- Continuity resilience score: ${resilienceScore}/100
- Knowledge concentration: ${singleSourceCount} of ${totalNodes} knowledge areas are single-source
- Operational bottlenecks: ${bottleneckCount}
- Critical gaps: ${criticalGaps.length > 0 ? criticalGaps.join('; ') : 'none identified'}

BEHAVIORAL CONSTRAINTS — STRICTLY ENFORCED:
1. You ONLY discuss organizational continuity, governance resilience, documentation, and organizational knowledge.
2. You NEVER evaluate individual employees, suggest workforce reductions, or generate labor-risk intelligence.
3. You NEVER recommend disciplinary actions or assess individual worker value.
4. All framing must be ORGANIZATIONAL — processes, governance structures, documentation gaps.
5. Every claim must reference specific organizational data when available.
6. Acknowledge uncertainty explicitly — do not overstate confidence.

RESPONSE FORMAT:
- Answer the question with specific, organizational framing
- Reference actual data from the organization's continuity analysis when applicable
- Suggest actionable organizational improvements (documentation, governance, cross-training)
- Be concise but thorough
- Use governance-appropriate, professional language`;
}

/** Extract follow-up suggestions from an AI response. */
function extractFollowUps(query: string, _responseType: string): string[] {
  const suggestions: Record<string, string[]> = {
    fragility: [
      'What governance processes are most fragile?',
      'What mitigation reduces the highest concentration risk?',
      'Show me the propagation paths from this fragile area.',
    ],
    governance: [
      'What happens if this governance process becomes unavailable?',
      'How do we decentralize this governance responsibility?',
      'What documentation would stabilize this governance area?',
    ],
    mitigation: [
      'How long would this mitigation take to show results?',
      'What resources does this mitigation require?',
      'How does this compare to other mitigation options?',
    ],
    dependency: [
      'What is the downstream impact of this dependency?',
      'Are there alternative paths if this dependency fails?',
      'What would reduce this dependency concentration?',
    ],
    default: [
      'What continuity areas need the most urgent attention?',
      'How has resilience changed over time?',
      'What governance investments matter most?',
    ],
  };

  const q = query.toLowerCase();
  if (q.includes('fragil') || q.includes('weak') || q.includes('risk')) return suggestions.fragility;
  if (q.includes('govern') || q.includes('compliance') || q.includes('regulatory')) return suggestions.governance;
  if (q.includes('mitig') || q.includes('fix') || q.includes('improve')) return suggestions.mitigation;
  if (q.includes('depend') || q.includes('chain') || q.includes('propagat')) return suggestions.dependency;
  return suggestions.default;
}

/**
 * Process a continuity copilot query.
 * Returns a fully explainable, governance-safe response.
 */
export async function processCopilotQuery(
  orgId: string,
  input: CopilotQueryInput,
  userId: string,
): Promise<CopilotQueryResult> {
  // The model's history is the stored conversation of the caller, never what the client says was said: a caller cannot put
  // words in the assistant's mouth or smuggle instructions in as prior turns. A conversation that is not theirs is not found.
  let storedMessages: CopilotMessage[] = [];
  if (input.conversationId) {
    const owned = await loadOwnedMessages(orgId, input.conversationId, userId);
    if (owned === null) throw ApiError.notFound('Conversation');
    storedMessages = owned;
  }

  // Load org continuity context
  const [propagationMap, resilienceIndex] = await Promise.all([
    buildDependencyPropagationMap(orgId),
    calculateResilienceIndex(orgId),
  ]);

  const nodes = propagationMap.nodes;
  const singleSourceCount = nodes.filter((n) => n.isSingleSource).length;
  const totalNodes = nodes.length;
  const bottleneckCount = propagationMap.bottlenecks.length;
  const govNodes = nodes.filter((n) => n.category === 'governance' || n.category === 'compliance');
  const govSingleSource = govNodes.filter((n) => n.isSingleSource);
  const criticalGaps = resilienceIndex.dimensions
    .filter((d) => d.score < 40)
    .map((d) => d.name);

  // Build system prompt with org context
  const systemPrompt = buildSystemPrompt(
    orgId,
    resilienceIndex.overallScore,
    singleSourceCount,
    totalNodes,
    bottleneckCount,
    criticalGaps,
  );

  // Build message history
  const messages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
    { role: 'system', content: systemPrompt },
    ...storedMessages.slice(-20).map((m) => ({
      role: m.role as 'user' | 'assistant',
      content: m.content,
    })),
    { role: 'user', content: input.query },
  ];

  // The provider call cannot share the database transaction: its intent is recorded first and the call is skipped if
  // that record cannot be written.
  const ai = getAiClient();
  const aiResult = await performAuditedOperation(
    {
      organizationId: orgId,
      userId,
      action: 'exit_interview.copilot.generate',
      resourceType: 'ue_copilot_conversations',
      details: { conversationId: input.conversationId ?? null },
    },
    () =>
      ai.generate({
        orgId: UE_SYSTEM_ORG_ID,
        trace: buildOrgAiTrace(orgId),
        appKey: UE_APP_KEY,
        profileKey: COPILOT_PROFILE,
        input: messages,
        dataClass: 'internal',
      }),
  );

  const answer = aiResult.content;

  // Build explainability
  const evidence: EvidenceReference[] = [
    ...buildPropagationEvidence(singleSourceCount, totalNodes, bottleneckCount),
    {
      observation: `Organizational resilience score: ${resilienceIndex.overallScore}/100 (${resilienceIndex.status})`,
      dataPoint: `${resilienceIndex.overallScore}/100`,
      sourceType: 'resilience_index',
      confidence: 'high',
    },
    {
      observation: `${resilienceIndex.dimensions.length} resilience dimensions analyzed`,
      dataPoint: resilienceIndex.dimensions.map((d) => `${d.name}: ${d.score}`).join(', '),
      sourceType: 'resilience_index',
      confidence: 'high',
    },
  ];

  const reasoning: ReasoningLink[] = [
    {
      stepNumber: 1,
      reasoning: 'Retrieved organizational dependency propagation map from published exit interviews',
      conclusion: `${totalNodes} knowledge nodes analyzed, ${singleSourceCount} single-source`,
      assumption: 'Published exit interviews reflect current organizational knowledge distribution',
    },
    {
      stepNumber: 2,
      reasoning: 'Assessed multi-dimensional organizational resilience index',
      conclusion: `Overall resilience: ${resilienceIndex.overallScore}/100`,
      assumption: 'Resilience dimensions are weighted equally unless otherwise specified',
    },
    {
      stepNumber: 3,
      reasoning: 'Formulated governance-safe response with organizational framing',
      conclusion: answer.slice(0, 120) + (answer.length > 120 ? '…' : ''),
      assumption: 'Response addresses organizational continuity, not individual assessment',
    },
  ];

  const govFlags: GovernanceFlag[] = buildGovernanceFlags(govSingleSource.length, govNodes.length);

  const explainability = buildExplainabilityEnvelope(
    evidence,
    reasoning,
    [
      'Analysis is based on published exit interviews in this organization',
      'Single-source counts may undercount undocumented knowledge coverage',
      'Resilience scores are computed from interview frequency and coverage patterns',
    ],
    govFlags,
    [
      'This analysis does not include real-time operational data',
      'Continuity risk is inferred — direct operational audits provide more certainty',
    ],
    'Review the dependency propagation graph and resilience index for verification.',
  );

  const userMsgId = randomUUID();
  const assistantMsgId = randomUUID();
  const now = new Date().toISOString();

  // The conversation and both messages commit with their audit record or not at all
  const convId = await inOrganization(orgId, async (tx) => {
    const conversation = await upsertConversation(
      tx,
      orgId,
      input.conversationId ?? null,
      input.sessionId ?? null,
      { resilienceScore: resilienceIndex.overallScore, singleSourceCount, totalNodes },
      userId,
    );
    await appendMessage(tx, orgId, conversation.id, { id: userMsgId, role: 'user', content: input.query, createdAt: now }, userId);
    await appendMessage(tx, orgId, conversation.id, {
      id: assistantMsgId,
      role: 'assistant',
      content: answer,
      createdAt: now,
      explainabilityRef: null,
    }, userId);
    await persistAtomicAudit(tx, {
      organizationId: orgId,
      userId,
      action: 'exit_interview.copilot.converse',
      resourceType: 'ue_copilot_conversations',
      resourceId: conversation.id,
      details: { newConversation: conversation.created, assistantMessageId: assistantMsgId },
    });
    return conversation.id;
  });

  const followUps = extractFollowUps(input.query, 'default');

  return {
    conversationId: convId,
    messageId: assistantMsgId,
    answer,
    summary: answer.slice(0, 200) + (answer.length > 200 ? '…' : ''),
    evidenceReferences: explainability.evidenceReferences,
    reasoningChain: explainability.reasoningChain,
    governanceFlags: explainability.governanceFlags,
    assumptions: explainability.assumptions,
    limitations: explainability.limitations,
    overallConfidence: explainability.overallConfidence,
    followUpSuggestions: followUps,
    organizationalContext: `Continuity analysis for organization ${orgId}. Resilience score: ${resilienceIndex.overallScore}/100.`,
    generatedAt: now,
  };
}

/** The messages of a conversation the caller opened; null when it is not theirs, does not exist, or the id is malformed. */
async function loadOwnedMessages(orgId: string, conversationId: string, userId: string): Promise<CopilotMessage[] | null> {
  if (!isUuid(conversationId)) return null;
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      SELECT messages FROM ue_copilot_conversations
      WHERE id = ${conversationId} AND organization_id = ${orgId} AND created_by = ${userId}
      LIMIT 1
    `),
  );
  const result = rows as any as Record<string, unknown>[];
  if (result.length === 0) return null;
  return (result[0].messages as CopilotMessage[]) ?? [];
}

/** Load conversation history for a conversation the caller opened (empty for any other). */
export async function loadConversationHistory(
  orgId: string,
  conversationId: string,
  userId: string,
): Promise<CopilotMessage[]> {
  return (await loadOwnedMessages(orgId, conversationId, userId)) ?? [];
}

/** List the caller's own recent conversations. */
export async function listConversations(
  orgId: string,
  userId: string,
  limit = 10,
): Promise<Array<{ id: string; title: string; updatedAt: string; messageCount: number }>> {
  const rows = await inOrganization(orgId, (tx) =>
    tx.execute(sql`
      SELECT id, title, updated_at, jsonb_array_length(messages) AS message_count
      FROM ue_copilot_conversations
      WHERE organization_id = ${orgId} AND created_by = ${userId}
      ORDER BY updated_at DESC
      LIMIT ${limit}
    `),
  );
  return (rows as any as Record<string, unknown>[]).map((r) => ({
    id: r.id as string,
    title: r.title as string,
    updatedAt: (r.updated_at as Date)?.toISOString?.() ?? (r.updated_at as string),
    messageCount: Number(r.message_count ?? 0),
  }));
}
