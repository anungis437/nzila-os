/**
 * CLC Decision Intelligence — NIL Briefing Contracts
 *
 * Decision-grade prompt contracts for the National Intelligence Layer.
 * Each contract is versioned, schema-validated, includes anonymization
 * rules, and requires evidenceRefs in output.
 *
 * When NIL is unavailable, the deterministic engine output is returned
 * as-is — the system never fails because AI is offline.
 *
 * @module briefings
 */

import type {
  DecisionPromptContract,
  CorrelatedPattern,
  MovementRiskPosture,
  BargainingWatch,
  SectorDivergence,
  ExecutiveBriefingCard,
  DecisionRecommendation,
} from '../contracts/index';

// ── Anonymization Rules (shared) ────────────────────────────────────────────

const STANDARD_ANONYMIZATION = [
  'Never name individual affiliates by name',
  'Never reference individual member counts below cohort threshold',
  'Use sector-level aggregates only',
  'Refer to affiliate types (e.g., "public sector affiliates") not specific organizations',
  'Do not infer or reveal organization identities from pattern descriptions',
];

// ── Prompt Contracts ────────────────────────────────────────────────────────

export const DECISION_PROMPT_CONTRACTS: DecisionPromptContract[] = [
  {
    useCase: 'summarize_movement_risk_posture',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Decision Intelligence analyst.
Given a MovementRiskPosture object (posture, watchAreas, risingSectors, issueClusters, summary, confidence), produce a 3-5 sentence executive summary that:
1. States the current posture level and what it means
2. Highlights the most significant watch areas
3. Notes rising sectors and their implications
4. Ends with a clear recommended next step
Use authoritative, measured language appropriate for CLC executive leadership.`,
    requiredOutputFields: ['summary', 'keyTakeaway', 'recommendedNextStep'],
    anonymizationRules: STANDARD_ANONYMIZATION,
    buildInput: (data: { riskPosture: MovementRiskPosture }) => ({
      riskPosture: data.riskPosture,
    }),
  },
  {
    useCase: 'detect_cross_affiliate_issue_cluster',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Decision Intelligence analyst.
Given a list of CorrelatedPattern objects of type 'cross_affiliate_issue_cluster', synthesize the findings into a briefing that:
1. Names each identified issue cluster by clause type
2. Lists the sectors where each cluster appears
3. Assesses the collective significance for CLC strategy
4. Recommends specific preparation actions
Never name individual affiliates. Use aggregate sector references only.`,
    requiredOutputFields: ['clusters', 'movementSignificance', 'recommendedActions'],
    anonymizationRules: STANDARD_ANONYMIZATION,
    buildInput: (data: { patterns: CorrelatedPattern[] }) => ({
      patterns: data.patterns.filter((p) => p.patternType === 'cross_affiliate_issue_cluster'),
    }),
  },
  {
    useCase: 'recommend_clc_action_from_signals',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Decision Intelligence analyst.
Given a list of DecisionRecommendations with their linked pattern IDs, produce an action-oriented briefing that:
1. Groups actions by urgency (intervene, escalate, prepare, monitor)
2. Explains the rationale for each action in plain language
3. Assigns clear ownership (CLC executive, federation leadership, research team, staff)
4. Suggests a timeline for each action
Be specific — reference the actual signal data, not generic advice.`,
    requiredOutputFields: ['urgentActions', 'preparatoryActions', 'monitoringItems', 'timeline'],
    anonymizationRules: STANDARD_ANONYMIZATION,
    buildInput: (data: { recommendations: DecisionRecommendation[]; patterns: CorrelatedPattern[] }) => ({
      recommendations: data.recommendations,
      patternSummaries: data.patterns.map((p) => ({ id: p.id, title: p.title, summary: p.summary })),
    }),
  },
  {
    useCase: 'generate_bargaining_watch_brief',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Decision Intelligence analyst.
Given a BargainingWatch object, produce a pre-bargaining intelligence brief that:
1. Identifies the sectors with building bargaining pressure
2. Describes the preparation indicators (what signals are being observed)
3. Assesses signal strength and confidence
4. Recommends specific preparation steps for CLC leadership
This is time-sensitive intelligence — be direct and actionable.`,
    requiredOutputFields: ['sectorAnalysis', 'preparationSteps', 'signalAssessment', 'urgency'],
    anonymizationRules: STANDARD_ANONYMIZATION,
    buildInput: (data: { bargainingWatch: BargainingWatch }) => ({
      bargainingWatch: data.bargainingWatch,
    }),
  },
  {
    useCase: 'explain_sector_divergence',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Decision Intelligence analyst.
Given a list of SectorDivergence objects, explain the divergence patterns:
1. Identify which sectors are most divergent from the baseline
2. Explain what unique factors drive each divergence
3. Assess whether divergences represent opportunities or risks
4. Note velocity and trend classifications for each sector
Use precise comparative language. Avoid value judgments about specific sectors.`,
    requiredOutputFields: ['divergentSectors', 'driversAnalysis', 'riskOpportunityAssessment'],
    anonymizationRules: STANDARD_ANONYMIZATION,
    buildInput: (data: { divergence: SectorDivergence[] }) => ({
      sectorDivergence: data.divergence.filter((d) => d.divergenceScore > 0.3),
    }),
  },
  {
    useCase: 'generate_executive_briefing_note',
    version: '1.0.0',
    app: 'union-eyes',
    systemPrompt: `You are a CLC Decision Intelligence analyst preparing a note for the CLC Executive Committee.
Given a set of ExecutiveBriefingCards, compose a structured briefing note that:
1. Opens with a one-sentence posture statement
2. Lists top 3-5 items requiring executive attention, ordered by significance
3. For each item: state the finding, confidence level, and recommended action
4. Closes with a "looking ahead" paragraph noting emerging trends
Write in formal briefing-note style. Be concise — total length should be 200-400 words.`,
    requiredOutputFields: ['postureStatement', 'attentionItems', 'lookingAhead'],
    anonymizationRules: STANDARD_ANONYMIZATION,
    buildInput: (data: { cards: ExecutiveBriefingCard[] }) => ({
      briefingCards: data.cards.slice(0, 10), // Limit to top 10 for prompt budget
    }),
  },
];

/**
 * Look up a prompt contract by use case.
 */
export function getDecisionPromptContract(
  useCase: string,
): DecisionPromptContract | undefined {
  return DECISION_PROMPT_CONTRACTS.find((c) => c.useCase === useCase);
}

/**
 * Get all available decision prompt contract use cases.
 */
export function listDecisionPromptUseCases(): string[] {
  return DECISION_PROMPT_CONTRACTS.map((c) => c.useCase);
}
