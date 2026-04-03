/**
 * Steward Copilot AI Service
 *
 * Provides AI-assisted capabilities for union stewards:
 * - Timeline summarisation
 * - Suggested next actions
 * - Draft response generation
 * - Custom Q&A (free-form copilot queries)
 *
 * CONSTRAINTS:
 * - Every output: confidence + explanation
 * - All copilot outputs are "pending" until human approves/edits
 * - Org-scoped, audited
 *
 * @module lib/ai/steward-copilot
 */

import { db } from '@/db/db';
import { eq, and, desc } from 'drizzle-orm';
import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import { aiCopilotSessions, type AiCopilotSessionInsert } from '@/db/schema/domains/ml/ai-copilot-sessions';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { auditAiInteraction, buildAiEnvelope, type AiResponseEnvelope } from './ai-feature-guard';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface CopilotInput {
  organizationId: string;
  userId: string;
  userRole: string;
  actionType: 'timeline_summary' | 'suggest_action' | 'draft_response' | 'explain_clause' | 'risk_brief' | 'custom_query';
  relatedEntityType?: string;
  relatedEntityId?: string;
  query?: string;
}

export interface CopilotResult {
  responseText: string;
  structuredOutput: Record<string, unknown> | null;
  sourcesUsed: Array<{ title: string; type: string; relevance: number }>;
}

const MODEL_VERSION = '1.0.0';

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Execute a copilot action.
 */
export async function executeCopilotAction(
  input: CopilotInput,
): Promise<AiResponseEnvelope<CopilotResult>> {
  const { organizationId, userId, userRole, actionType, relatedEntityType, relatedEntityId, query } = input;

  // 1. Build context-aware prompt
  const prompt = await buildCopilotPrompt(input);

  // 2. Call AI
  const ai = getAiClient();
  const aiResult = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.STEWARD_COPILOT,
    input: prompt,
    dataClass: 'internal',
  });

  // 3. Parse
  const parsed = parseCopilotResponse(aiResult.content ?? '');

  // 4. Audit
  const auditRef = await auditAiInteraction({
    featureName: 'steward_copilot',
    userId,
    organizationId,
    resource: relatedEntityType ?? 'copilot',
    resourceId: relatedEntityId,
    action: actionType,
    confidence: parsed.confidence,
    modelVersion: MODEL_VERSION,
  });

  // 5. Persist session
  const insert: AiCopilotSessionInsert = {
    organizationId,
    userId,
    userRole,
    actionType,
    relatedEntityType: relatedEntityType ?? null,
    relatedEntityId: relatedEntityId ?? null,
    query: query ?? null,
    responseText: parsed.result.responseText,
    structuredOutput: parsed.result.structuredOutput,
    confidence: parsed.confidence.toFixed(4),
    explanation: parsed.explanation,
    sourcesUsed: parsed.result.sourcesUsed,
    modelVersion: MODEL_VERSION,
    profileKey: UE_PROFILES.STEWARD_COPILOT,
    auditRef,
    outcome: 'pending',
  };

  await db.insert(aiCopilotSessions).values(insert);

  return buildAiEnvelope(parsed.result, {
    confidence: parsed.confidence,
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    auditRef,
  });
}

/**
 * Summarise the timeline of a grievance.
 */
export async function summarizeTimeline(
  grievanceId: string,
  organizationId: string,
  userId: string,
): Promise<AiResponseEnvelope<CopilotResult>> {
  return executeCopilotAction({
    organizationId,
    userId,
    userRole: 'steward',
    actionType: 'timeline_summary',
    relatedEntityType: 'grievance',
    relatedEntityId: grievanceId,
  });
}

/**
 * Suggest next action for a grievance.
 */
export async function suggestAction(
  grievanceId: string,
  organizationId: string,
  userId: string,
): Promise<AiResponseEnvelope<CopilotResult>> {
  return executeCopilotAction({
    organizationId,
    userId,
    userRole: 'steward',
    actionType: 'suggest_action',
    relatedEntityType: 'grievance',
    relatedEntityId: grievanceId,
  });
}

/**
 * Draft a response for a grievance.
 */
export async function draftResponse(
  grievanceId: string,
  organizationId: string,
  userId: string,
): Promise<AiResponseEnvelope<CopilotResult>> {
  return executeCopilotAction({
    organizationId,
    userId,
    userRole: 'steward',
    actionType: 'draft_response',
    relatedEntityType: 'grievance',
    relatedEntityId: grievanceId,
  });
}

/**
 * Record outcome for a copilot session.
 */
export async function recordCopilotOutcome(
  sessionId: string,
  organizationId: string,
  outcome: 'accepted' | 'edited' | 'rejected',
  editedResponse?: string,
  feedbackRating?: number,
  feedbackNotes?: string,
) {
  await db
    .update(aiCopilotSessions)
    .set({
      outcome,
      editedResponse: editedResponse ?? null,
      feedbackRating: feedbackRating?.toFixed(2) ?? null,
      feedbackNotes: feedbackNotes ?? null,
      humanApproved: outcome === 'accepted' || outcome === 'edited',
      completedAt: new Date(),
    })
    .where(and(eq(aiCopilotSessions.id, sessionId), eq(aiCopilotSessions.organizationId, organizationId)));
}

/**
 * Get copilot session history for a user.
 */
export async function getCopilotHistory(
  userId: string,
  organizationId: string,
  limit = 20,
) {
  return db.query.aiCopilotSessions.findMany({
    where: and(
      eq(aiCopilotSessions.userId, userId),
      eq(aiCopilotSessions.organizationId, organizationId),
    ),
    orderBy: [desc(aiCopilotSessions.createdAt)],
    limit,
  });
}

// ============================================================================
// INTERNALS
// ============================================================================

async function buildCopilotPrompt(input: CopilotInput): Promise<string> {
  const parts: string[] = [
    'You are a steward copilot for a union organization.',
    `User role: ${input.userRole}`,
    `Action: ${input.actionType}`,
  ];

  // If related to a grievance, fetch context
  if (input.relatedEntityType === 'grievance' && input.relatedEntityId) {
    const grievance = await db.query.grievances.findFirst({
      where: and(
        eq(grievances.id, input.relatedEntityId),
        eq(grievances.organizationId, input.organizationId),
      ),
    });

    if (grievance) {
      parts.push('');
      parts.push(`Grievance #${grievance.grievanceNumber}`);
      parts.push(`Status: ${grievance.status}`);
      parts.push(`Type: ${grievance.type}`);
      parts.push(`Priority: ${grievance.priority ?? 'unset'}`);
      parts.push(`Title: ${grievance.title}`);
      parts.push(`Description: ${grievance.description}`);
      if (grievance.background) parts.push(`Background: ${grievance.background}`);
      if (grievance.desiredOutcome) parts.push(`Desired outcome: ${grievance.desiredOutcome}`);
      if (grievance.timeline) {
        parts.push(`Timeline: ${JSON.stringify(grievance.timeline)}`);
      }
    }
  }

  if (input.query) {
    parts.push('');
    parts.push(`User query: ${input.query}`);
  }

  parts.push('');
  parts.push('Return JSON: { responseText: string, structuredOutput?: object, sourcesUsed: [{ title, type, relevance }], confidence: number (0-1), explanation: string }');
  parts.push('Respond ONLY with valid JSON.');

  return parts.join('\n');
}

function parseCopilotResponse(raw: string): {
  result: CopilotResult;
  confidence: number;
  explanation: string;
} {
  try {
    const json = JSON.parse(raw);
    return {
      result: {
        responseText: String(json.responseText ?? ''),
        structuredOutput: json.structuredOutput ?? null,
        sourcesUsed: Array.isArray(json.sourcesUsed) ? json.sourcesUsed : [],
      },
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.5)),
      explanation: String(json.explanation ?? 'AI copilot response.'),
    };
  } catch {
    logger.warn('Failed to parse copilot AI response');
    return {
      result: {
        responseText: raw || 'Unable to generate response. Please try again.',
        structuredOutput: null,
        sourcesUsed: [],
      },
      confidence: 0.3,
      explanation: 'AI response could not be parsed as JSON.',
    };
  }
}
