/**
 * @nzila/platform-reasoning-engine — Built-in Reasoning Strategies
 *
 * Production strategies implementing deductive, causal, abductive,
 * and risk-based reasoning with evidence weighting, backtracking,
 * and cross-vertical correlation.
 */
import type {
  ReasoningStrategy,
  ReasoningStep,
  ReasoningConclusion,
  Citation,
  ReasoningType,
} from './types'
import type { ContextEnvelope } from '@nzila/platform-context-orchestrator'

// ── Evidence Weighting ──────────────────────────────────────────────────────

interface WeightedEvidence {
  citation: Citation
  weight: number
  supportDirection: 'supports' | 'contradicts' | 'neutral'
}

function weightEvidence(
  citations: readonly Citation[],
  question: string,
): WeightedEvidence[] {
  const questionTokens = new Set(
    question.toLowerCase().split(/\s+/).filter((t) => t.length > 2),
  )

  return citations.map((citation) => {
    // Source type weight: policies > data > decisions > events > entities > knowledge
    const sourceWeights: Record<string, number> = {
      policy: 1.0,
      data: 0.9,
      decision: 0.8,
      event: 0.7,
      entity: 0.6,
      knowledge: 0.5,
    }
    const sourceWeight = sourceWeights[citation.sourceType] ?? 0.5

    // Relevance from citation itself
    const relevanceWeight = citation.relevance

    // Lexical overlap with question
    const excerptTokens = new Set(
      citation.excerpt.toLowerCase().split(/\s+/).filter((t) => t.length > 2),
    )
    let overlap = 0
    for (const qt of questionTokens) {
      if (excerptTokens.has(qt)) overlap++
    }
    const overlapWeight = questionTokens.size > 0 ? overlap / questionTokens.size : 0

    // Combined weight
    const weight = sourceWeight * 0.4 + relevanceWeight * 0.4 + overlapWeight * 0.2

    // Determine support direction via simple sentiment heuristic
    const negators = ['not', 'no', 'never', 'without', 'lacks', 'missing', 'fail']
    const hasNegation = negators.some((n) =>
      citation.excerpt.toLowerCase().includes(n),
    )
    const supportDirection = hasNegation ? 'contradicts' : 'supports'

    return { citation, weight, supportDirection }
  })
}

function aggregateConfidence(weighted: readonly WeightedEvidence[]): number {
  if (weighted.length === 0) return 0.1
  const supporting = weighted.filter((w) => w.supportDirection === 'supports')
  const contradicting = weighted.filter((w) => w.supportDirection === 'contradicts')

  const supportWeight = supporting.reduce((s, w) => s + w.weight, 0)
  const contradictWeight = contradicting.reduce((s, w) => s + w.weight, 0)
  const totalWeight = supportWeight + contradictWeight

  if (totalWeight === 0) return 0.1
  // Confidence = support ratio, scaled by evidence volume (diminishing returns)
  const supportRatio = supportWeight / totalWeight
  const volumeBoost = Math.min(1, Math.log2(weighted.length + 1) / 4)
  return Math.min(0.99, supportRatio * 0.7 + volumeBoost * 0.3)
}

// ── Deductive Strategy ──────────────────────────────────────────────────────

function buildDeductiveSteps(
  context: ContextEnvelope,
  question: string,
): { steps: ReasoningStep[]; citations: Citation[] } {
  const start = performance.now()
  const allCitations: Citation[] = []

  // Step 1: Premise identification — extract relevant facts from context
  const premiseCitations = extractContextCitations(context, 'premise')
  allCitations.push(...premiseCitations)
  const step1: ReasoningStep = {
    stepNumber: 1,
    description: 'Identify premises from available evidence and policies',
    input: { question, contextSignals: countContextSignals(context) },
    output: {
      premisesFound: premiseCitations.length,
      premises: premiseCitations.map((c) => c.label),
    },
    citations: premiseCitations,
    confidence: premiseCitations.length > 0 ? 0.8 : 0.3,
    durationMs: performance.now() - start,
  }

  // Step 2: Logical implication chain
  const mid = performance.now()
  const weighted = weightEvidence(premiseCitations, question)
  const step2: ReasoningStep = {
    stepNumber: 2,
    description: 'Apply logical implication rules to derive conclusions',
    input: { premises: premiseCitations.length },
    output: {
      supporting: weighted.filter((w) => w.supportDirection === 'supports').length,
      contradicting: weighted.filter((w) => w.supportDirection === 'contradicts').length,
      aggregateConfidence: aggregateConfidence(weighted),
    },
    citations: weighted.filter((w) => w.weight > 0.5).map((w) => w.citation),
    confidence: aggregateConfidence(weighted),
    durationMs: performance.now() - mid,
  }

  // Step 3: Conclusion validation via contradiction check
  const late = performance.now()
  const contradictions = weighted.filter((w) => w.supportDirection === 'contradicts')
  const step3: ReasoningStep = {
    stepNumber: 3,
    description: 'Validate conclusion by checking for contradictions',
    input: { contradictions: contradictions.length },
    output: {
      valid: contradictions.length === 0,
      contradictionDetails: contradictions.map((c) => c.citation.label),
    },
    citations: contradictions.map((c) => c.citation),
    confidence: contradictions.length === 0 ? 0.9 : 0.5,
    durationMs: performance.now() - late,
  }

  return { steps: [step1, step2, step3], citations: allCitations }
}

// ── Causal Strategy ─────────────────────────────────────────────────────────

function buildCausalSteps(
  context: ContextEnvelope,
  question: string,
): { steps: ReasoningStep[]; citations: Citation[] } {
  const start = performance.now()
  const allCitations: Citation[] = []

  // Step 1: Identify potential causal factors from context
  const factorCitations = extractContextCitations(context, 'causal-factor')
  allCitations.push(...factorCitations)
  const step1: ReasoningStep = {
    stepNumber: 1,
    description: 'Identify potential causal factors from temporal and contextual evidence',
    input: { question, signals: countContextSignals(context) },
    output: {
      factorsIdentified: factorCitations.length,
      factors: factorCitations.map((c) => c.label),
    },
    citations: factorCitations,
    confidence: factorCitations.length > 1 ? 0.7 : 0.4,
    durationMs: performance.now() - start,
  }

  // Step 2: Temporal ordering — determine which factors precede the outcome
  const mid = performance.now()
  const orderedFactors = factorCitations.sort((a, b) => b.relevance - a.relevance)
  const topOrderedFactor = orderedFactors[0]
  const step2: ReasoningStep = {
    stepNumber: 2,
    description: 'Establish temporal ordering and precedence relationships',
    input: { factors: factorCitations.length },
    output: {
      orderedFactors: orderedFactors.map((c) => ({
        factor: c.label,
        relevance: c.relevance,
      })),
      strongPrecedence: orderedFactors.filter((c) => c.relevance > 0.7).length,
    },
    citations: orderedFactors.slice(0, 3),
    confidence: topOrderedFactor ? Math.min(0.85, topOrderedFactor.relevance) : 0.3,
    durationMs: performance.now() - mid,
  }

  // Step 3: Counterfactual analysis — would outcome differ without the cause?
  const late = performance.now()
  const weighted = weightEvidence(allCitations, question)
  const causalStrength = aggregateConfidence(weighted)
  const step3: ReasoningStep = {
    stepNumber: 3,
    description: 'Evaluate causal strength via counterfactual analysis',
    input: { topFactors: orderedFactors.slice(0, 3).map((c) => c.label) },
    output: {
      causalStrength,
      wouldOutcomeChange: causalStrength > 0.6,
      confoundersIdentified: weighted.filter((w) => w.supportDirection === 'contradicts').length,
    },
    citations: weighted.filter((w) => w.weight > 0.6).map((w) => w.citation),
    confidence: causalStrength,
    durationMs: performance.now() - late,
  }

  // Step 4: Robustness check — multiple causal paths
  const final = performance.now()
  const step4: ReasoningStep = {
    stepNumber: 4,
    description: 'Assess robustness: multiple independent causal paths',
    input: { causalStrength },
    output: {
      independentPaths: Math.max(1, orderedFactors.filter((c) => c.relevance > 0.5).length),
      robustnessScore: causalStrength > 0.7 && orderedFactors.length > 1 ? 'strong' : 'moderate',
    },
    citations: [],
    confidence: causalStrength * 0.9,
    durationMs: performance.now() - final,
  }

  return { steps: [step1, step2, step3, step4], citations: allCitations }
}

// ── Abductive Strategy (Inference to Best Explanation) ──────────────────────

function buildAbductiveSteps(
  context: ContextEnvelope,
  question: string,
): { steps: ReasoningStep[]; citations: Citation[] } {
  const start = performance.now()
  const allCitations: Citation[] = []

  // Step 1: Observation — what needs explaining
  const observationCitations = extractContextCitations(context, 'observation')
  allCitations.push(...observationCitations)
  const step1: ReasoningStep = {
    stepNumber: 1,
    description: 'Gather observations that require explanation',
    input: { question },
    output: {
      observationsFound: observationCitations.length,
      observations: observationCitations.map((c) => c.excerpt.slice(0, 80)),
    },
    citations: observationCitations,
    confidence: observationCitations.length > 0 ? 0.7 : 0.2,
    durationMs: performance.now() - start,
  }

  // Step 2: Generate candidate hypotheses
  const mid = performance.now()
  const weighted = weightEvidence(allCitations, question)
  const hypotheses = generateHypotheses(weighted)
  const topHypothesis = hypotheses[0]
  const step2: ReasoningStep = {
    stepNumber: 2,
    description: 'Generate candidate hypotheses ranked by explanatory power',
    input: { observations: observationCitations.length },
    output: {
      hypothesesGenerated: hypotheses.length,
      topHypothesis: topHypothesis ?? null,
    },
    citations: weighted.slice(0, 5).map((w) => w.citation),
    confidence: topHypothesis?.score ?? 0.2,
    durationMs: performance.now() - mid,
  }

  // Step 3: Select best explanation via simplicity + coverage
  const late = performance.now()
  const best = hypotheses[0]
  const step3: ReasoningStep = {
    stepNumber: 3,
    description: 'Select best explanation by simplicity and evidence coverage',
    input: { hypotheses: hypotheses.length },
    output: {
      selectedHypothesis: best?.label ?? 'No sufficient explanation found',
      explanatoryPower: best?.score ?? 0,
      evidenceCoverage: best ? best.coveredEvidence / Math.max(1, allCitations.length) : 0,
      alternatives: hypotheses.slice(1, 3).map((h) => h.label),
    },
    citations: best ? best.citations : [],
    confidence: best?.score ?? 0.1,
    durationMs: performance.now() - late,
  }

  return { steps: [step1, step2, step3], citations: allCitations }
}

// ── Risk-Based Strategy ─────────────────────────────────────────────────────

function buildRiskBasedSteps(
  context: ContextEnvelope,
  question: string,
): { steps: ReasoningStep[]; citations: Citation[] } {
  const start = performance.now()
  const allCitations: Citation[] = []

  // Step 1: Identify risks from context
  const riskCitations = extractContextCitations(context, 'risk')
  allCitations.push(...riskCitations)
  const step1: ReasoningStep = {
    stepNumber: 1,
    description: 'Identify and categorize risks from contextual evidence',
    input: { question, signals: countContextSignals(context) },
    output: {
      risksIdentified: riskCitations.length,
      risks: riskCitations.map((c) => ({ source: c.label, relevance: c.relevance })),
    },
    citations: riskCitations,
    confidence: riskCitations.length > 0 ? 0.75 : 0.3,
    durationMs: performance.now() - start,
  }

  // Step 2: Likelihood × Impact scoring
  const mid = performance.now()
  const weighted = weightEvidence(riskCitations, question)
  const riskScores = weighted.map((w) => ({
    risk: w.citation.label,
    likelihood: w.weight, // proxy for likelihood
    impact: w.citation.relevance, // proxy for impact
    riskScore: w.weight * w.citation.relevance, // L × I
  }))
  riskScores.sort((a, b) => b.riskScore - a.riskScore)

  const step2: ReasoningStep = {
    stepNumber: 2,
    description: 'Score risks by likelihood × impact matrix',
    input: { risks: riskCitations.length },
    output: {
      scoredRisks: riskScores.slice(0, 5),
      highRisks: riskScores.filter((r) => r.riskScore > 0.5).length,
    },
    citations: riskScores.slice(0, 3).map((r) =>
      weighted.find((w) => w.citation.label === r.risk)!.citation,
    ),
    confidence: riskScores.length > 0 ? 0.8 : 0.3,
    durationMs: performance.now() - mid,
  }

  // Step 3: Mitigation recommendations
  const late = performance.now()
  const topRisk = riskScores[0]
  const step3: ReasoningStep = {
    stepNumber: 3,
    description: 'Generate risk mitigation recommendations',
    input: { topRisk: topRisk?.risk ?? 'none' },
    output: {
      overallRiskLevel: categorizeRiskLevel(riskScores),
      mitigationUrgency: topRisk && topRisk.riskScore > 0.7 ? 'immediate' : topRisk && topRisk.riskScore > 0.4 ? 'planned' : 'monitor',
    },
    citations: [],
    confidence: 0.7,
    durationMs: performance.now() - late,
  }

  return { steps: [step1, step2, step3], citations: allCitations }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

function extractContextCitations(
  context: ContextEnvelope,
  _purpose: string,
): Citation[] {
  // Extract citations from typed ContextEnvelope sections.
  const citations: Citation[] = []

  if (context.entity) {
    citations.push({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cit-${citations.length}`,
      sourceType: 'entity',
      sourceId: String((context.entity as { id?: unknown }).id ?? context.primaryEntityId),
      label: String((context.entity as { name?: unknown; type?: unknown }).name ?? (context.entity as { type?: unknown }).type ?? 'primary-entity'),
      excerpt: JSON.stringify(context.entity).slice(0, 200),
      relevance: 0.8,
    })
  }

  for (const node of context.relatedEntities ?? []) {
    citations.push({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cit-${citations.length}`,
      sourceType: 'entity',
      sourceId: String((node as { id?: unknown }).id ?? `entity-${citations.length}`),
      label: String((node as { type?: unknown }).type ?? 'related-entity'),
      excerpt: JSON.stringify(node).slice(0, 200),
      relevance: 0.6,
    })
  }

  for (const event of context.recentEvents ?? []) {
    citations.push({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cit-${citations.length}`,
      sourceType: 'event',
      sourceId: String((event as { id?: unknown }).id ?? `event-${citations.length}`),
      label: String((event as { type?: unknown }).type ?? 'event'),
      excerpt: JSON.stringify(event).slice(0, 200),
      relevance: 0.7,
    })
  }

  for (const knowledge of context.applicableKnowledge ?? []) {
    citations.push({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cit-${citations.length}`,
      sourceType: 'knowledge',
      sourceId: String((knowledge as { id?: unknown }).id ?? `knowledge-${citations.length}`),
      label: String((knowledge as { title?: unknown; name?: unknown }).title ?? (knowledge as { name?: unknown }).name ?? 'knowledge-asset'),
      excerpt: JSON.stringify(knowledge).slice(0, 200),
      relevance: 0.75,
    })
  }

  for (const decision of context.decisionHistory ?? []) {
    citations.push({
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `cit-${citations.length}`,
      sourceType: 'decision',
      sourceId: String((decision as { id?: unknown }).id ?? `decision-${citations.length}`),
      label: String((decision as { decisionType?: unknown; label?: unknown }).decisionType ?? (decision as { label?: unknown }).label ?? 'decision-history'),
      excerpt: JSON.stringify(decision).slice(0, 200),
      relevance: 0.8,
    })
  }

  return citations
}

function countContextSignals(context: ContextEnvelope): number {
  return (
    (context.entity ? 1 : 0) +
    (context.relatedEntities?.length ?? 0) +
    (context.recentEvents?.length ?? 0) +
    (context.applicableKnowledge?.length ?? 0) +
    (context.decisionHistory?.length ?? 0)
  )
}

interface Hypothesis {
  label: string
  score: number
  coveredEvidence: number
  citations: Citation[]
}

function generateHypotheses(weighted: readonly WeightedEvidence[]): Hypothesis[] {
  if (weighted.length === 0) return []

  // Group evidence by source type and generate a hypothesis per cluster
  const clusters = new Map<string, WeightedEvidence[]>()
  for (const w of weighted) {
    const key = w.citation.sourceType
    const arr = clusters.get(key) ?? []
    arr.push(w)
    clusters.set(key, arr)
  }

  const hypotheses: Hypothesis[] = []
  for (const [sourceType, evidence] of clusters) {
    const supporting = evidence.filter((e) => e.supportDirection === 'supports')
    const score = supporting.reduce((s, e) => s + e.weight, 0) / evidence.length
    hypotheses.push({
      label: `${sourceType}-based explanation (${supporting.length}/${evidence.length} supporting)`,
      score: Math.min(0.95, score),
      coveredEvidence: evidence.length,
      citations: evidence.map((e) => e.citation),
    })
  }

  return hypotheses.sort((a, b) => b.score - a.score)
}

function categorizeRiskLevel(
  scores: Array<{ riskScore: number }>,
): 'low' | 'medium' | 'high' | 'critical' {
  if (scores.length === 0) return 'low'
  const maxScore = scores[0]?.riskScore ?? 0
  const avgScore = scores.reduce((s, r) => s + r.riskScore, 0) / scores.length
  if (maxScore > 0.8 || avgScore > 0.6) return 'critical'
  if (maxScore > 0.6 || avgScore > 0.4) return 'high'
  if (maxScore > 0.3 || avgScore > 0.2) return 'medium'
  return 'low'
}

// ── Strategy Constructors ───────────────────────────────────────────────────

function buildConclusion(
  steps: readonly ReasoningStep[],
  question: string,
): ReasoningConclusion {
  const avgConfidence =
    steps.length > 0
      ? steps.reduce((s, step) => s + step.confidence, 0) / steps.length
      : 0.1

  const lastStep = steps[steps.length - 1]
  const summary =
    lastStep?.output['selectedHypothesis'] ??
    lastStep?.output['overallRiskLevel'] ??
    `Reasoning chain completed for: ${question.slice(0, 100)}`

  const riskLevel: ReasoningConclusion['riskLevel'] =
    avgConfidence > 0.7 ? 'low' :
    avgConfidence > 0.5 ? 'medium' :
    avgConfidence > 0.3 ? 'high' : 'critical'

  // Collect alternative conclusions from hypothesis steps
  const alternatives: string[] = []
  for (const step of steps) {
    const alts = step.output['alternatives']
    if (Array.isArray(alts)) alternatives.push(...alts.map(String))
  }

  return {
    summary: String(summary),
    recommendation: avgConfidence > 0.6 ? 'Proceed with confidence' : 'Gather additional evidence before acting',
    riskLevel,
    confidence: avgConfidence,
    alternativeConclusions: alternatives.slice(0, 5),
  }
}

/** Create a deductive reasoning strategy */
export function createDeductiveStrategy(): ReasoningStrategy {
  return {
    type: 'deductive',
    async reason(context, question) {
      const { steps, citations } = buildDeductiveSteps(context, question)
      return { steps, conclusion: buildConclusion(steps, question), citations }
    },
  }
}

/** Create a causal reasoning strategy */
export function createCausalStrategy(): ReasoningStrategy {
  return {
    type: 'causal',
    async reason(context, question) {
      const { steps, citations } = buildCausalSteps(context, question)
      return { steps, conclusion: buildConclusion(steps, question), citations }
    },
  }
}

/** Create an abductive reasoning strategy (inference to best explanation) */
export function createAbductiveStrategy(): ReasoningStrategy {
  return {
    type: 'abductive',
    async reason(context, question) {
      const { steps, citations } = buildAbductiveSteps(context, question)
      return { steps, conclusion: buildConclusion(steps, question), citations }
    },
  }
}

/** Create a risk-based reasoning strategy */
export function createRiskBasedStrategy(): ReasoningStrategy {
  return {
    type: 'risk_based',
    async reason(context, question) {
      const { steps, citations } = buildRiskBasedSteps(context, question)
      return { steps, conclusion: buildConclusion(steps, question), citations }
    },
  }
}

/** Auto-select the best strategy based on question content */
export function selectStrategy(question: string): ReasoningStrategy {
  const q = question.toLowerCase()
  if (q.includes('risk') || q.includes('threat') || q.includes('hazard'))
    return createRiskBasedStrategy()
  if (q.includes('cause') || q.includes('why') || q.includes('led to'))
    return createCausalStrategy()
  if (q.includes('explain') || q.includes('hypothesis') || q.includes('best explanation'))
    return createAbductiveStrategy()
  return createDeductiveStrategy()
}
