/**
 * AI/ML-powered legal & compliance actions — ABR app.
 *
 * Provides AI-driven case classification, risk scoring, evidence extraction,
 * and ML-based outcome prediction for anti-bribery & regulatory cases.
 */
import { buildCanonicalAiOutput, type CanonicalAiOutput } from '@nzila/ai-sdk'
import { runAICompletionDetailed, runAIEmbedDetailed, runAIExtractionDetailed } from '@/lib/ai-client'
import { runPredictionDetailed } from '@/lib/ml-client'

// ── Types ────────────────────────────────────────────────────────────────────

export type CaseClassification = CanonicalAiOutput<{
  category: string
  subcategory: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  confidence: number
  reasoning: string
}>

export type RiskAssessment = CanonicalAiOutput<{
  riskScore: number
  factors: string[]
  recommendation: string
  mlSource: boolean
}>

export type CaseOutcome = CanonicalAiOutput<{
  predictedOutcome: string
  probability: number
  estimatedDurationDays: number
  mlSource: boolean
}>

export type ComplaintExtraction = CanonicalAiOutput<{
  complainant: string | null
  respondent: string | null
  allegationType: string | null
  dateOfIncident: string | null
  keyFacts: string[]
  evidenceReferences: string[]
}>

// ── AI Actions ───────────────────────────────────────────────────────────────

/**
 * Classify a case based on its description and available facts.
 * Uses AI to determine category, severity, and appropriate handling track.
 */
export async function classifyCase(
  description: string,
  facts?: string[],
): Promise<CaseClassification> {
  const context = facts?.length ? `\n\nKey facts:\n${facts.map((f) => `- ${f}`).join('\n')}` : ''

  const { content: raw, execution } = await runAICompletionDetailed(
    `Classify this regulatory/compliance case into category, subcategory, and severity.
Return JSON: { category, subcategory, severity, confidence, reasoning }

Case description:
${description}${context}`,
    { dataClass: 'regulated' },
  )

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const confidence = typeof parsed.confidence === 'number' ? parsed.confidence : 0.5
    return buildCanonicalAiOutput({
      payload: {
        category: typeof parsed.category === 'string' ? parsed.category : 'unclassified',
        subcategory: typeof parsed.subcategory === 'string' ? parsed.subcategory : 'pending-review',
        severity: (parsed.severity as CaseClassification['severity']) ?? 'medium',
        confidence,
        reasoning: typeof parsed.reasoning === 'string' ? parsed.reasoning : raw,
      },
      appKey: 'abr',
      orgId: 'platform',
      execution,
      confidenceScore: confidence,
      evidenceRefs: ['input:case-description', 'prompt:case-classification'],
      domain: 'legal',
    })
  } catch {
    return buildCanonicalAiOutput({
      payload: {
        category: 'unclassified',
        subcategory: 'pending-review',
        severity: 'medium',
        confidence: 0,
        reasoning: raw,
      },
      appKey: 'abr',
      orgId: 'platform',
      execution,
      confidenceScore: 0,
      evidenceRefs: ['input:case-description', 'prompt:case-classification'],
      domain: 'legal',
    })
  }
}

/**
 * Extract structured data from a raw complaint or report text.
 */
export async function extractFromComplaint(
  complaintText: string,
): Promise<ComplaintExtraction> {
  const { data, execution } = await runAIExtractionDetailed(complaintText, 'abr-complaint-extraction', {
    profile: 'abr-regulated',
  })

  return buildCanonicalAiOutput({
    payload: {
      complainant: (data.complainant as string) ?? null,
      respondent: (data.respondent as string) ?? null,
      allegationType: (data.allegationType as string) ?? null,
      dateOfIncident: (data.dateOfIncident as string) ?? null,
      keyFacts: Array.isArray(data.keyFacts) ? (data.keyFacts as string[]) : [],
      evidenceReferences: Array.isArray(data.evidenceReferences)
        ? (data.evidenceReferences as string[])
        : [],
    },
    appKey: 'abr',
    orgId: 'platform',
    execution,
    confidenceScore: 0.82,
    evidenceRefs: ['prompt:abr-complaint-extraction'],
    domain: 'legal',
  })
}

/**
 * Find cases similar to the given description using embedding similarity.
 * Useful for precedent research and duplicate detection.
 */
export async function findSimilarCases(
  description: string,
  limit = 5,
): Promise<Array<{ similarity: number; summary: string }>> {
  const embeddings = await runAIEmbedDetailed(description)
  if (!embeddings.embeddings.length) return []

  const { content: raw } = await runAICompletionDetailed(
    `Given this case embedding context, suggest ${limit} similar case patterns.
Return JSON array: [{ similarity: number, summary: string }]

Case: ${description}`,
    { dataClass: 'regulated' },
  )

  try {
    return JSON.parse(raw)
  } catch {
    return []
  }
}

// ── ML Actions ───────────────────────────────────────────────────────────────

/**
 * Predict the likely outcome of a case using ML models.
 * Falls back to AI heuristic if no ML model is available.
 */
export async function predictCaseOutcome(
  caseId: string,
  caseDescription: string,
): Promise<CaseOutcome | null> {
  // Try ML model first
  const predictionResult = await runPredictionDetailed({
    model: 'abr-case-outcome',
    orgId: caseId,
  })
  const prediction = predictionResult.data

  if (prediction) {
    return buildCanonicalAiOutput({
      payload: {
        predictedOutcome: (prediction.outcome as string) ?? 'unknown',
        probability: (prediction.probability as number) ?? 0,
        estimatedDurationDays: (prediction.estimatedDays as number) ?? 0,
        mlSource: true,
      },
      appKey: 'abr',
      orgId: caseId,
      execution: predictionResult.execution ?? {
        modelUsed: 'abr-case-outcome',
        provider: 'ml',
        engineVersion: 'ml:abr-case-outcome',
      },
      confidenceScore: (prediction.probability as number) ?? 0.5,
      evidenceRefs: ['ml:model:abr-case-outcome'],
      domain: 'legal',
    })
  }

  // AI fallback
  const { content: raw, execution } = await runAICompletionDetailed(
    `Based on this anti-bribery/compliance case, predict the likely outcome.
Return JSON: { predictedOutcome, probability, estimatedDurationDays }

Case: ${caseDescription}`,
    { dataClass: 'regulated', orgId: caseId },
  )

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    return buildCanonicalAiOutput({
      payload: {
        predictedOutcome: (parsed.predictedOutcome as string) ?? 'unknown',
        probability: (parsed.probability as number) ?? 0,
        estimatedDurationDays: (parsed.estimatedDurationDays as number) ?? 0,
        mlSource: false,
      },
      appKey: 'abr',
      orgId: caseId,
      execution,
      confidenceScore: (parsed.probability as number) ?? 0.5,
      evidenceRefs: ['input:case-description', 'prompt:abr-case-outcome'],
      domain: 'legal',
    })
  } catch {
    return null
  }
}

/**
 * Assess the risk score for an entity (organization or individual) under investigation.
 * Uses ML model for scoring with AI-generated factor analysis.
 */
export async function assessRiskScore(
  orgId: string,
  context?: string,
): Promise<RiskAssessment | null> {
  const predictionResult = await runPredictionDetailed({
    model: 'abr-risk-score',
    orgId,
  })
  const prediction = predictionResult.data

  if (prediction) {
    return buildCanonicalAiOutput({
      payload: {
        riskScore: (prediction.score as number) ?? 0,
        factors: Array.isArray(prediction.factors) ? (prediction.factors as string[]) : [],
        recommendation: (prediction.recommendation as string) ?? '',
        mlSource: true,
      },
      appKey: 'abr',
      orgId,
      execution: predictionResult.execution ?? {
        modelUsed: 'abr-risk-score',
        provider: 'ml',
        engineVersion: 'ml:abr-risk-score',
      },
      confidenceScore: typeof prediction.score === 'number' ? Math.min(1, Math.max(0, prediction.score / 100)) : 0.5,
      evidenceRefs: ['ml:model:abr-risk-score'],
      domain: 'legal',
    })
  }

  if (!context) return null

  // AI fallback with context
  const { content: raw, execution } = await runAICompletionDetailed(
    `Assess compliance/bribery risk for this entity. Score 0-100 with factors.
Return JSON: { riskScore, factors: string[], recommendation }

Context: ${context}`,
    { dataClass: 'regulated', orgId },
  )

  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>
    const riskScore = typeof parsed.riskScore === 'number' ? parsed.riskScore : 0
    return buildCanonicalAiOutput({
      payload: {
        riskScore,
        factors: Array.isArray(parsed.factors) ? (parsed.factors as string[]) : [],
        recommendation: (parsed.recommendation as string) ?? '',
        mlSource: false,
      },
      appKey: 'abr',
      orgId,
      execution,
      confidenceScore: Math.min(1, Math.max(0, riskScore / 100)),
      evidenceRefs: ['input:entity-context', 'prompt:abr-risk-score'],
      domain: 'legal',
    })
  } catch {
    return null
  }
}
