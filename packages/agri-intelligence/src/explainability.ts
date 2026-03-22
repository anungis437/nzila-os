// ---------------------------------------------------------------------------
// @nzila/agri-intelligence — Explainability contract
// ---------------------------------------------------------------------------
// Every intelligence output must satisfy the ExplainableOutput contract
// from @nzila/agri-core: { explanation, sourceDataRefs, confidenceLevel,
// modelVersion, generatedAt }.
// ---------------------------------------------------------------------------

import type {
  ExplainableOutput,
  IntelligenceRecommendation,
  IntelligenceAlert,
  IntelligenceInsight,
  SourceDataRef,
  ConfidenceLevel,
} from '@nzila/agri-core'

let idCounter = 0

function makeId(prefix: string): string {
  idCounter++
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

/**
 * Create a fully explainable recommendation.
 */
export function createRecommendation(params: {
  type: string
  title: string
  explanation: string
  sourceDataRefs: SourceDataRef[]
  confidenceLevel: ConfidenceLevel
  modelVersion: string
  priority: IntelligenceRecommendation['priority']
  suggestedAction?: string
  expiresAt?: string
}): IntelligenceRecommendation {
  return {
    id: makeId('rec'),
    type: params.type,
    title: params.title,
    explanation: params.explanation,
    sourceDataRefs: params.sourceDataRefs,
    confidenceLevel: params.confidenceLevel,
    modelVersion: params.modelVersion,
    generatedAt: new Date().toISOString(),
    priority: params.priority,
    actionable: !!params.suggestedAction,
    suggestedAction: params.suggestedAction ?? null,
    expiresAt: params.expiresAt ?? null,
  }
}

/**
 * Create a fully explainable alert.
 */
export function createAlert(params: {
  type: string
  severity: IntelligenceAlert['severity']
  title: string
  explanation: string
  sourceDataRefs: SourceDataRef[]
  confidenceLevel: ConfidenceLevel
  modelVersion: string
  affectedEntities: string[]
}): IntelligenceAlert {
  return {
    id: makeId('alert'),
    type: params.type,
    severity: params.severity,
    title: params.title,
    explanation: params.explanation,
    sourceDataRefs: params.sourceDataRefs,
    confidenceLevel: params.confidenceLevel,
    modelVersion: params.modelVersion,
    generatedAt: new Date().toISOString(),
    affectedEntities: params.affectedEntities,
  }
}

/**
 * Create a fully explainable insight.
 */
export function createInsight(params: {
  type: string
  title: string
  explanation: string
  sourceDataRefs: SourceDataRef[]
  confidenceLevel: ConfidenceLevel
  modelVersion: string
  metricValue?: number
  metricUnit?: string
  comparisonPeriod?: string
}): IntelligenceInsight {
  return {
    id: makeId('insight'),
    type: params.type,
    title: params.title,
    explanation: params.explanation,
    sourceDataRefs: params.sourceDataRefs,
    confidenceLevel: params.confidenceLevel,
    modelVersion: params.modelVersion,
    generatedAt: new Date().toISOString(),
    metricValue: params.metricValue ?? null,
    metricUnit: params.metricUnit ?? null,
    comparisonPeriod: params.comparisonPeriod ?? null,
  }
}

/**
 * Validate that an output satisfies the explainability contract.
 */
export function assertExplainable(output: ExplainableOutput): void {
  if (!output.explanation) {
    throw new Error('INTELLIGENCE_CONTRACT_VIOLATION: explanation is required')
  }
  if (!output.sourceDataRefs || output.sourceDataRefs.length === 0) {
    throw new Error('INTELLIGENCE_CONTRACT_VIOLATION: at least one source data ref is required')
  }
  if (!output.confidenceLevel) {
    throw new Error('INTELLIGENCE_CONTRACT_VIOLATION: confidence level is required')
  }
  if (!output.modelVersion) {
    throw new Error('INTELLIGENCE_CONTRACT_VIOLATION: model version is required')
  }
}
