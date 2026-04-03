/**
 * Clause Reasoning AI Service
 *
 * Suggests relevant CBA clauses for a grievance and explains
 * why each clause applies, its strength, and any precedents.
 *
 * CONSTRAINTS:
 * - Uses @nzila/ai-sdk via `getAiClient()`
 * - Every output carries confidence + explanation
 * - No clause is auto-linked — results are stored as "suggested"
 * - Org-scoped
 *
 * @module lib/ai/clause-reasoning
 */

import { db } from '@/db/db';
import { eq, and, desc } from 'drizzle-orm';
import { getAiClient, UE_APP_KEY, UE_PROFILES, UE_SYSTEM_ORG_ID } from '@/lib/ai/ai-client';
import { aiClauseReasonings, type AiClauseReasoningInsert } from '@/db/schema/domains/ml/ai-clause-reasoning';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { auditAiInteraction, buildAiEnvelope, type AiResponseEnvelope } from './ai-feature-guard';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface ClauseReasoningInput {
  grievanceId: string;
  organizationId: string;
  userId: string;
}

export interface SuggestedClause {
  clauseArticle: string;
  clauseSection: string | null;
  clauseTitle: string | null;
  clauseSnippet: string | null;
  relevanceScore: number;
  reasoning: string;
  applicationNotes: string | null;
  strengthAssessment: 'strong' | 'moderate' | 'weak';
  precedentRefs: Array<{ id: string; title: string; relevance: number }>;
}

export interface ClauseReasoningResult {
  suggestedClauses: SuggestedClause[];
  overallAnalysis: string;
}

const MODEL_VERSION = '1.0.0';

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Suggest relevant CBA clauses for a grievance.
 */
export async function suggestClausesForGrievance(
  input: ClauseReasoningInput,
): Promise<AiResponseEnvelope<ClauseReasoningResult>> {
  const { grievanceId, organizationId, userId } = input;

  // 1. Fetch grievance
  const grievance = await db.query.grievances.findFirst({
    where: and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId)),
  });

  if (!grievance) {
    throw new Error(`Grievance ${grievanceId} not found in org ${organizationId}`);
  }

  // 2. Call AI
  const ai = getAiClient();
  const prompt = buildClausePrompt(grievance);
  const aiResult = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.CLAUSE_REASONING,
    input: prompt,
    dataClass: 'internal',
  });

  // 3. Parse
  const parsed = parseClauseResponse(aiResult.content ?? '');

  // 4. Audit
  const auditRef = await auditAiInteraction({
    featureName: 'clause_reasoning',
    userId,
    organizationId,
    resource: 'grievances',
    resourceId: grievanceId,
    action: 'suggest_clauses',
    confidence: parsed.confidence,
    modelVersion: MODEL_VERSION,
  });

  // 5. Persist each suggestion
  for (const clause of parsed.result.suggestedClauses) {
    const insert: AiClauseReasoningInsert = {
      organizationId,
      grievanceId,
      cbaId: grievance.cbaId,
      clauseArticle: clause.clauseArticle,
      clauseSection: clause.clauseSection,
      clauseTitle: clause.clauseTitle,
      clauseSnippet: clause.clauseSnippet,
      relevanceScore: clause.relevanceScore.toFixed(4),
      reasoning: clause.reasoning,
      applicationNotes: clause.applicationNotes,
      strengthAssessment: clause.strengthAssessment,
      precedentRefs: clause.precedentRefs,
      confidence: parsed.confidence.toFixed(4),
      explanation: parsed.explanation,
      factorsJson: [],
      modelVersion: MODEL_VERSION,
      profileKey: UE_PROFILES.CLAUSE_REASONING,
      auditRef,
      status: 'suggested',
    };
    await db.insert(aiClauseReasonings).values(insert);
  }

  return buildAiEnvelope(parsed.result, {
    confidence: parsed.confidence,
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    auditRef,
  });
}

/**
 * Explain why a specific clause is relevant to a grievance.
 */
export async function explainClauseRelevance(
  grievanceId: string,
  clauseArticle: string,
  organizationId: string,
  userId: string,
): Promise<AiResponseEnvelope<{ reasoning: string; strength: string }>> {
  const grievance = await db.query.grievances.findFirst({
    where: and(eq(grievances.id, grievanceId), eq(grievances.organizationId, organizationId)),
  });
  if (!grievance) throw new Error(`Grievance ${grievanceId} not found`);

  const ai = getAiClient();
  const prompt = [
    'You are a union contract clause analyst.',
    `Explain why clause article "${clauseArticle}" is relevant to this grievance.`,
    `Grievance: ${grievance.title} — ${grievance.description}`,
    'Return JSON: { reasoning: string, strength: "strong"|"moderate"|"weak", confidence: number, explanation: string }',
  ].join('\n');

  const aiResult = await ai.generate({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.CLAUSE_REASONING,
    input: prompt,
    dataClass: 'internal',
  });

  const json = safeJsonParse(aiResult.content ?? '') as Record<string, unknown>;
  const confidence = typeof json.confidence === 'number' ? json.confidence : 0.5;
  const reasoning = typeof json.reasoning === 'string' ? json.reasoning : 'No reasoning available.';
  const strength = typeof json.strength === 'string' ? json.strength : 'moderate';
  const explanation = typeof json.explanation === 'string' ? json.explanation : 'AI-generated clause relevance explanation.';

  const auditRef = await auditAiInteraction({
    featureName: 'clause_reasoning',
    userId,
    organizationId,
    resource: 'grievances',
    resourceId: grievanceId,
    action: 'explain_clause',
    confidence,
    modelVersion: MODEL_VERSION,
  });

  return buildAiEnvelope(
    { reasoning, strength },
    {
      confidence,
      explanation,
      modelVersion: MODEL_VERSION,
      auditRef,
    },
  );
}

/**
 * Legal disclaimer surfaced in every clause-reasoning response.
 * Clause suggestions are AI-generated and do NOT constitute legal advice.
 */
export const CLAUSE_REASONING_LEGAL_DISCLAIMER =
  'AI-suggested clauses are advisory only and do not constitute legal advice. ' +
  'A qualified steward or labour relations officer must assess the applicability of any clause ' +
  'before citing it in a grievance. Nzila assumes no liability for outcomes arising from ' +
  'reliance on AI-generated clause suggestions.';

/**
 * Record a steward's accept/reject/supersede decision on a clause suggestion.
 * Prevents re-review of an already-actioned suggestion.
 */
export async function reviewClauseReasoning(opts: {
  clauseReasoningId: string;
  organizationId: string;
  reviewedBy: string;
  action: 'accepted' | 'rejected' | 'superseded';
}): Promise<void> {
  const { clauseReasoningId, organizationId, reviewedBy, action } = opts;

  const [existing] = await db
    .select({ id: aiClauseReasonings.id, status: aiClauseReasonings.status })
    .from(aiClauseReasonings)
    .where(
      and(
        eq(aiClauseReasonings.id, clauseReasoningId),
        eq(aiClauseReasonings.organizationId, organizationId),
      ),
    )
    .limit(1);

  if (!existing) {
    throw new Error(`Clause reasoning ${clauseReasoningId} not found in org ${organizationId}`);
  }
  if (existing.status !== 'suggested') {
    throw new Error(
      `Clause reasoning ${clauseReasoningId} is already '${existing.status}' and cannot be re-reviewed.`,
    );
  }

  await db
    .update(aiClauseReasonings)
    .set({
      status: action,
      reviewedBy,
      reviewedAt: new Date(),
      humanApproved: action === 'accepted',
    })
    .where(
      and(
        eq(aiClauseReasonings.id, clauseReasoningId),
        eq(aiClauseReasonings.organizationId, organizationId),
      ),
    );
}

/**
 * Get clause reasoning history for a grievance.
 */
export async function getClauseReasoningHistory(
  grievanceId: string,
  organizationId: string,
) {
  return db.query.aiClauseReasonings.findMany({
    where: and(
      eq(aiClauseReasonings.grievanceId, grievanceId),
      eq(aiClauseReasonings.organizationId, organizationId),
    ),
    orderBy: [desc(aiClauseReasonings.relevanceScore)],
  });
}

// ============================================================================
// INTERNALS
// ============================================================================

function buildClausePrompt(g: typeof grievances.$inferSelect): string {
  return [
    'You are a union CBA clause analyst.',
    'Given the following grievance, suggest relevant CBA clauses.',
    'Return JSON: {',
    '  suggestedClauses: [{ clauseArticle, clauseSection?, clauseTitle?, clauseSnippet?,',
    '    relevanceScore (0-1), reasoning, applicationNotes?, strengthAssessment (strong|moderate|weak),',
    '    precedentRefs: [{ id, title, relevance }] }],',
    '  overallAnalysis: string,',
    '  confidence: number (0-1),',
    '  explanation: string',
    '}',
    '',
    `Grievance #${g.grievanceNumber}`,
    `Type: ${g.type}`,
    `Title: ${g.title}`,
    `Description: ${g.description}`,
    g.cbaArticle ? `Current CBA article: ${g.cbaArticle}` : '',
    g.cbaSection ? `CBA section: ${g.cbaSection}` : '',
    g.background ? `Background: ${g.background}` : '',
    '',
    'Respond ONLY with valid JSON.',
  ].filter(Boolean).join('\n');
}

function parseClauseResponse(raw: string): {
  result: ClauseReasoningResult;
  confidence: number;
  explanation: string;
} {
  try {
    const json = JSON.parse(raw);
    return {
      result: {
        suggestedClauses: (json.suggestedClauses ?? []).map((c: Record<string, unknown>) => ({
          clauseArticle: String(c.clauseArticle ?? ''),
          clauseSection: c.clauseSection ? String(c.clauseSection) : null,
          clauseTitle: c.clauseTitle ? String(c.clauseTitle) : null,
          clauseSnippet: c.clauseSnippet ? String(c.clauseSnippet) : null,
          relevanceScore: Math.min(1, Math.max(0, Number(c.relevanceScore) || 0)),
          reasoning: String(c.reasoning ?? ''),
          applicationNotes: c.applicationNotes ? String(c.applicationNotes) : null,
          strengthAssessment: (['strong', 'moderate', 'weak'].includes(String(c.strengthAssessment))
            ? String(c.strengthAssessment)
            : 'moderate') as 'strong' | 'moderate' | 'weak',
          precedentRefs: Array.isArray(c.precedentRefs) ? c.precedentRefs : [],
        })),
        overallAnalysis: String(json.overallAnalysis ?? ''),
      },
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.5)),
      explanation: String(json.explanation ?? 'AI-generated clause analysis.'),
    };
  } catch {
    logger.warn('Failed to parse clause reasoning AI response');
    return {
      result: { suggestedClauses: [], overallAnalysis: 'Parse error — manual review required.' },
      confidence: 0.3,
      explanation: 'AI response could not be parsed.',
    };
  }
}

function safeJsonParse(raw: string): Record<string, unknown> {
  try { return JSON.parse(raw); } catch { return {}; }
}
