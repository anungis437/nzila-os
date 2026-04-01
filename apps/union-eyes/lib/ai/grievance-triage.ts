/**
 * Grievance Triage AI Service
 *
 * Analyses a grievance and recommends:
 *  - Priority (low / medium / high / urgent)
 *  - Category (contract / harassment / safety … )
 *  - Complexity (routine / moderate / complex / unprecedented)
 *  - Estimated days to resolve
 *  - Similar past grievances
 *
 * CONSTRAINTS:
 * - Uses @nzila/ai-sdk via the singleton `getAiClient()`
 * - Every output carries confidence + explanation
 * - No action is auto-applied — results are stored as "pending"
 * - Org-scoped: all queries filter on organizationId
 *
 * @module lib/ai/grievance-triage
 */

import { db } from '@/db/db';
import { eq, and, desc } from 'drizzle-orm';
import { getAiClient, UE_APP_KEY, UE_PROFILES } from '@/lib/ai/ai-client';
import { aiGrievanceTriages, type AiGrievanceTriageInsert } from '@/db/schema/domains/ml/ai-grievance-triage';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { auditAiInteraction, buildAiEnvelope, type AiResponseEnvelope } from './ai-feature-guard';
import { logger } from '@/lib/logger';

// ============================================================================
// TYPES
// ============================================================================

export interface TriageInput {
  grievanceId: string;
  organizationId: string;
  userId: string;
}

export interface TriageResult {
  suggestedPriority: string;
  suggestedCategory: string;
  complexity: 'routine' | 'moderate' | 'complex' | 'unprecedented';
  estimatedDaysToResolve: number | null;
  suggestedStep: string | null;
  similarGrievanceIds: string[];
  factors: Array<{ name: string; weight: number; description: string }>;
  /**
   * Always true — triage results are advisory and may NEVER drive case updates
   * without an explicit PATCH /api/ai/grievances/[id]/triage (reviewTriage) call.
   */
  requiresHumanConfirmation: true;
}

const MODEL_VERSION = '1.0.0';

// ── NZ-RISK-012: Input sanitization limits ──────────────────────────────────
// Cap field lengths to prevent abuse (e.g. employer-crafted adversarial text
// injected into grievance fields to manipulate triage scoring). Also strips
// null bytes and excessive whitespace.

const FIELD_LIMITS = {
  title: 500,
  description: 10_000,
  background: 5_000,
  desiredOutcome: 3_000,
} as const;

function sanitizeField(value: string | null | undefined, maxLength: number): string {
  if (!value) return '';
  return value
    .replace(/\0/g, '')              // strip null bytes
    .replace(/[\r\n]{3,}/g, '\n\n') // collapse excessive newlines
    .replace(/ {4,}/g, '   ')       // collapse excessive spaces
    .slice(0, maxLength)
    .trim();
}

// ============================================================================
// SERVICE
// ============================================================================

/**
 * Analyse a grievance and produce a triage recommendation.
 * Returns a full AI envelope with confidence + explanation.
 */
export async function analyzeGrievance(
  input: TriageInput,
): Promise<AiResponseEnvelope<TriageResult>> {
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
  const prompt = buildTriagePrompt(grievance);
  const aiResult = await ai.generate({
    orgId: organizationId,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.GRIEVANCE_TRIAGE,
    input: prompt,
    dataClass: 'internal',
  });

  // 3. Parse AI response
  const parsed = parseTriageResponse(aiResult.content ?? '');

  // 4. Audit
  const auditRef = await auditAiInteraction({
    featureName: 'grievance_triage',
    userId,
    organizationId,
    resource: 'grievances',
    resourceId: grievanceId,
    action: 'triage',
    confidence: parsed.confidence,
    modelVersion: MODEL_VERSION,
  });

  // 5. Persist
  const insert: AiGrievanceTriageInsert = {
    organizationId,
    grievanceId,
    suggestedPriority: parsed.triage.suggestedPriority,
    suggestedCategory: parsed.triage.suggestedCategory,
    complexity: parsed.triage.complexity,
    estimatedDaysToResolve: parsed.triage.estimatedDaysToResolve?.toString() ?? null,
    suggestedStep: parsed.triage.suggestedStep,
    confidence: parsed.confidence.toFixed(4),
    explanation: parsed.explanation,
    factorsJson: parsed.triage.factors,
    similarGrievanceIds: parsed.triage.similarGrievanceIds,
    modelVersion: MODEL_VERSION,
    profileKey: UE_PROFILES.GRIEVANCE_TRIAGE,
    auditRef,
    status: 'pending',
  };

  await db.insert(aiGrievanceTriages).values(insert);

  // 6. Envelope
  return buildAiEnvelope(parsed.triage, {
    confidence: parsed.confidence,
    explanation: parsed.explanation,
    modelVersion: MODEL_VERSION,
    auditRef,
  });
}

/**
 * Find past triage results for a grievance.
 */
export async function getTriageHistory(
  grievanceId: string,
  organizationId: string,
) {
  return db.query.aiGrievanceTriages.findMany({
    where: and(
      eq(aiGrievanceTriages.grievanceId, grievanceId),
      eq(aiGrievanceTriages.organizationId, organizationId),
    ),
    orderBy: [desc(aiGrievanceTriages.createdAt)],
  });
}

/**
 * Accept or reject a pending triage.
 * Throws if the triage is not in 'pending' status — prevents double-review
 * and ensures the human-confirmation gate cannot be bypassed.
 *
 * NZ-RISK-016: When a steward overrides the AI-suggested priority the override
 * and its reason are persisted in the reviewNotes (structured JSON prefix) and
 * audit log, preserving a full audit trail of human vs. AI judgement.
 */
export async function reviewTriage(
  triageId: string,
  organizationId: string,
  reviewedBy: string,
  accept: boolean,
  notes?: string,
  override?: { priority: string; reason: string },
) {
  // Guard: only pending triages may be reviewed
  const [existing] = await db
    .select({ id: aiGrievanceTriages.id, status: aiGrievanceTriages.status, suggestedPriority: aiGrievanceTriages.suggestedPriority })
    .from(aiGrievanceTriages)
    .where(and(eq(aiGrievanceTriages.id, triageId), eq(aiGrievanceTriages.organizationId, organizationId)))
    .limit(1);

  if (!existing) {
    throw new Error(`Triage ${triageId} not found in org ${organizationId}`);
  }
  if (existing.status !== 'pending') {
    throw new Error(
      `Triage ${triageId} is already '${existing.status}' and cannot be re-reviewed. Create a new triage to get a fresh AI assessment.`,
    );
  }

  // NZ-RISK-016: Build structured review notes preserving override audit trail
  let reviewNotes = notes ?? null;
  if (override) {
    const overrideLog = JSON.stringify({
      overridePriority: override.priority,
      originalPriority: existing.suggestedPriority,
      overrideReason: override.reason,
      reviewedBy,
      reviewedAt: new Date().toISOString(),
    });
    reviewNotes = reviewNotes
      ? `[OVERRIDE] ${overrideLog}\n${reviewNotes}`
      : `[OVERRIDE] ${overrideLog}`;

    logger.info('[grievance-triage] Priority override applied', {
      triageId,
      organizationId,
      reviewedBy,
      originalPriority: existing.suggestedPriority,
      overridePriority: override.priority,
      reason: override.reason,
    });
  }

  await db
    .update(aiGrievanceTriages)
    .set({
      status: accept ? 'accepted' : 'rejected',
      reviewedBy,
      reviewedAt: new Date(),
      reviewNotes,
      humanApproved: accept,
    })
    .where(and(eq(aiGrievanceTriages.id, triageId), eq(aiGrievanceTriages.organizationId, organizationId)));
}

// ============================================================================
// INTERNALS
// ============================================================================

function buildTriagePrompt(g: typeof grievances.$inferSelect): string {
  // NZ-RISK-012: sanitize and cap all user-supplied fields before prompt injection
  const title = sanitizeField(g.title, FIELD_LIMITS.title);
  const description = sanitizeField(g.description, FIELD_LIMITS.description);
  const background = sanitizeField(g.background, FIELD_LIMITS.background);
  const desiredOutcome = sanitizeField(g.desiredOutcome, FIELD_LIMITS.desiredOutcome);

  return [
    'You are a union grievance triage assistant.',
    'Analyse the following grievance and return a JSON object with:',
    '  suggestedPriority (low|medium|high|urgent)',
    '  suggestedCategory (string)',
    '  complexity (routine|moderate|complex|unprecedented)',
    '  estimatedDaysToResolve (number or null)',
    '  suggestedStep (step_1|step_2|step_3|final|arbitration or null)',
    '  similarGrievanceIds (string[] — empty if none)',
    '  factors (array of {name, weight 0-1, description})',
    '  confidence (number 0-1)',
    '  explanation (string — why you reached this assessment)',
    '',
    `Grievance #${g.grievanceNumber}`,
    `Type: ${g.type}`,
    `Current status: ${g.status}`,
    `Priority: ${g.priority ?? 'not set'}`,
    `Title: ${title}`,
    `Description: ${description}`,
    background ? `Background: ${background}` : '',
    desiredOutcome ? `Desired outcome: ${desiredOutcome}` : '',
    g.incidentDate ? `Incident date: ${g.incidentDate.toISOString()}` : '',
    '',
    'Respond ONLY with valid JSON. No markdown.',
  ]
    .filter(Boolean)
    .join('\n');
}

function parseTriageResponse(raw: string): {
  triage: TriageResult;
  confidence: number;
  explanation: string;
} {
  try {
    const json = JSON.parse(raw);
    return {
      triage: {
        suggestedPriority: json.suggestedPriority ?? 'medium',
        suggestedCategory: json.suggestedCategory ?? 'general',
        complexity: json.complexity ?? 'moderate',
        estimatedDaysToResolve: json.estimatedDaysToResolve ?? null,
        suggestedStep: json.suggestedStep ?? null,
        similarGrievanceIds: json.similarGrievanceIds ?? [],
        factors: json.factors ?? [],
        requiresHumanConfirmation: true as const,
      },
      confidence: Math.min(1, Math.max(0, Number(json.confidence) || 0.5)),
      explanation: json.explanation ?? 'No explanation provided by model.',
    };
  } catch {
    logger.warn('Failed to parse triage AI response, using defaults');
    return {
      triage: {
        suggestedPriority: 'medium',
        suggestedCategory: 'general',
        complexity: 'moderate',
        estimatedDaysToResolve: null,
        suggestedStep: null,
        similarGrievanceIds: [],
        factors: [],
        requiresHumanConfirmation: true as const,
      },
      confidence: 0.3,
      explanation: 'AI response could not be parsed. Manual triage recommended.',
    };
  }
}
