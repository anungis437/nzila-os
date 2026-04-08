/**
 * CLC Executive Intelligence — Narrative / NIL Activation Layer
 *
 * Five executive-grade prompt contracts for NIL refinement.
 * Runtime integration: if NIL is available → refine; else → deterministic.
 * nilInvoked is tracked accurately for audit.
 *
 * @module narrative
 */

import type {
  DecisionPromptContract,
  NilReasoningService,
  NilRefinement,
  ExecutivePriority,
  MovementSummary,
  ExecutiveDelta,
} from '../contracts/index.js';

// ── Anonymization Rules (shared) ────────────────────────────────────────────

const EXECUTIVE_ANONYMIZATION = [
  'Never name individual affiliates by name',
  'Never reference individual member counts below cohort threshold',
  'Use sector-level aggregates only',
  'Refer to affiliate types (e.g., "public sector affiliates") not specific organizations',
  'Do not infer or reveal organization identities from pattern descriptions',
  'Executive summaries must be suitable for public leadership documents',
];

// ── Executive Prompt Contracts ──────────────────────────────────────────────

export const EXECUTIVE_PROMPT_CONTRACTS: DecisionPromptContract[] = [
  {
    useCase: 'summarize_movement_posture_for_executives',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Executive Intelligence analyst providing a movement posture summary for senior leadership.
Given the movement summary data (posture, headline, dominant signals, why-now context), produce a refined executive-ready narrative that:
1. Opens with the current posture level and its practical meaning for leadership
2. Synthesizes the dominant signals into a coherent story
3. Explains why this posture exists right now (not historically)
4. Closes with the single most important thing leadership should know
Use authoritative but accessible language. Avoid jargon. Maximum 4 sentences.`,
    requiredOutputFields: ['headline', 'summary', 'keyTakeaway'],
    anonymizationRules: EXECUTIVE_ANONYMIZATION,
    buildInput: (data: { movementSummary: MovementSummary }) => ({
      posture: data.movementSummary.posture,
      headline: data.movementSummary.headline,
      dominantSignals: data.movementSummary.dominantSignals,
      whyNow: data.movementSummary.whyNow,
      confidence: data.movementSummary.confidence,
    }),
  },
  {
    useCase: 'rank_top_executive_priorities',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Executive Intelligence analyst providing priority ranking context for senior leadership.
Given ranked executive priorities (title, watchLevel, recommendedAction, timeframe, whyItMatters), produce a narrative explanation that:
1. Explains why the #1 priority tops the list
2. Highlights any patterns in the top priorities (e.g., multiple sectors, shared urgency)
3. Notes if any priorities are time-sensitive
4. Recommends what leadership should focus on first
Keep response concise: 3-4 sentences maximum.`,
    requiredOutputFields: ['summary', 'keyTakeaway', 'recommendedNextStep'],
    anonymizationRules: EXECUTIVE_ANONYMIZATION,
    buildInput: (data: { priorities: ExecutivePriority[] }) => ({
      priorities: data.priorities.map((p) => ({
        title: p.title,
        watchLevel: p.watchLevel,
        recommendedAction: p.recommendedAction,
        timeframe: p.timeframe,
        whyItMatters: p.whyItMatters,
        priorityScore: p.priorityScore,
      })),
    }),
  },
  {
    useCase: 'explain_why_now',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Executive Intelligence analyst explaining why current signals matter now.
Given the movement posture, top priorities, and dominant signals, produce a concise "why now" explanation that:
1. Connects the signals to the current moment (not historical context)
2. Explains what makes this moment different from routine monitoring
3. Identifies the time-sensitivity of the situation
4. States what would happen if no action is taken
Maximum 3 sentences. Direct, factual tone.`,
    requiredOutputFields: ['summary', 'keyTakeaway'],
    anonymizationRules: EXECUTIVE_ANONYMIZATION,
    buildInput: (data: { summary: MovementSummary; priorities: ExecutivePriority[] }) => ({
      posture: data.summary.posture,
      whyNow: data.summary.whyNow,
      dominantSignals: data.summary.dominantSignals,
      topPriority: data.priorities[0]
        ? {
            title: data.priorities[0].title,
            watchLevel: data.priorities[0].watchLevel,
            timeframe: data.priorities[0].timeframe,
          }
        : null,
    }),
  },
  {
    useCase: 'summarize_changes_since_last_snapshot',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Executive Intelligence analyst summarizing what changed since the last leadership review.
Given a list of deltas (direction, title, explanation), produce a concise change summary that:
1. Opens with the most significant change
2. Groups related changes if possible
3. Distinguishes between new signals, escalations, de-escalations, and resolutions
4. Ends with what these changes mean collectively
Maximum 4 sentences. If no changes, say so clearly.`,
    requiredOutputFields: ['summary', 'keyTakeaway'],
    anonymizationRules: EXECUTIVE_ANONYMIZATION,
    buildInput: (data: { deltas: ExecutiveDelta[] }) => ({
      deltas: data.deltas.map((d) => ({
        direction: d.direction,
        title: d.title,
        explanation: d.explanation,
        confidence: d.confidence,
      })),
    }),
  },
  {
    useCase: 'generate_executive_action_brief',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Executive Intelligence analyst generating a complete action brief for senior leadership.
Given the movement posture, top priorities, what-changed deltas, and recommended next steps, produce:
1. A refined one-sentence headline that captures the most important thing leadership needs to know
2. A 3-4 sentence summary that synthesizes all inputs into a coherent narrative
3. One clear recommended next step (the most urgent action)
The brief should be suitable for a leadership dashboard — concise, authoritative, and actionable.`,
    requiredOutputFields: ['headline', 'summary', 'recommendedNextStep'],
    anonymizationRules: EXECUTIVE_ANONYMIZATION,
    buildInput: (data: {
      summary: MovementSummary;
      priorities: ExecutivePriority[];
      deltas: ExecutiveDelta[];
      nextSteps: string[];
    }) => ({
      posture: data.summary.posture,
      headline: data.summary.headline,
      topPriorities: data.priorities.slice(0, 3).map((p) => ({
        title: p.title,
        watchLevel: p.watchLevel,
        recommendedAction: p.recommendedAction,
      })),
      deltas: data.deltas.map((d) => ({
        direction: d.direction,
        title: d.title,
      })),
      nextSteps: data.nextSteps,
    }),
  },
];

// ── NIL Refinement ─────────────────────────────────────────────────────────

/**
 * Result of attempting NIL refinement.
 */
export interface NilAttemptResult {
  refinement: NilRefinement | null;
  nilInvoked: boolean;
}

/**
 * Attempt to refine output using NIL.
 * Returns { refinement, nilInvoked } so the caller can track accurately.
 *
 * If NIL is unavailable or refine fails, returns { null, false }.
 * Validates NIL output against the contract's requiredOutputFields.
 */
export async function attemptNilRefinement(
  nilService: NilReasoningService | undefined,
  contract: DecisionPromptContract,
  input: Record<string, unknown>,
): Promise<NilAttemptResult> {
  if (!nilService || !nilService.isAvailable()) {
    return { refinement: null, nilInvoked: false };
  }

  try {
    const refinement = await nilService.refine(contract, input);
    if (!refinement) {
      return { refinement: null, nilInvoked: true };
    }
    // Schema validation: ensure required output fields are present
    if (!validateNilOutput(refinement, contract.requiredOutputFields)) {
      return { refinement: null, nilInvoked: true };
    }
    return { refinement, nilInvoked: true };
  } catch {
    // NIL failure is never fatal — fall back to deterministic
    return { refinement: null, nilInvoked: true };
  }
}

/**
 * Validate that a NIL refinement contains all required output fields
 * as declared in the prompt contract.
 */
export function validateNilOutput(
  refinement: NilRefinement,
  requiredFields: string[],
): boolean {
  const available = new Set<string>();
  if (refinement.headline) available.add('headline');
  if (refinement.summary) available.add('summary');
  if (refinement.keyTakeaway) available.add('keyTakeaway');
  if (refinement.recommendedNextStep) available.add('recommendedNextStep');
  if (refinement.additionalFields) {
    for (const key of Object.keys(refinement.additionalFields)) {
      available.add(key);
    }
  }
  return requiredFields.every((f) => available.has(f));
}

/**
 * Find an executive prompt contract by use case.
 */
export function getExecutivePromptContract(useCase: string): DecisionPromptContract | undefined {
  return EXECUTIVE_PROMPT_CONTRACTS.find((c) => c.useCase === useCase);
}
