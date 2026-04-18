export type AiBusinessDomain =
  | 'generic'
  | 'legal'
  | 'finance'
  | 'labour'
  | 'education'
  | 'commerce'
  | 'media'

export interface CanonicalAiOutputFields {
  confidence_score: number
  evidence_refs: string[]
  review_required: boolean
  engine_version: string
  generated_at: string
  org_id: string
  trace_id: string | null
}

export type CanonicalAiOutput<T extends object> = T & CanonicalAiOutputFields

export interface AiExecutionTelemetry {
  requestId?: string | null
  traceId?: string | null
  modelUsed: string
  provider?: string | null
  engineVersion: string
  latencyMs?: number | null
  tokenCostUsd?: number | null
  tokensIn?: number | null
  tokensOut?: number | null
}

export interface AiGovernanceMetric {
  appKey: string
  orgId: string
  modelUsed: string
  engineVersion: string
  latencyMs: number | null
  tokenCostUsd: number | null
  tokensIn: number | null
  tokensOut: number | null
  errorRate: number
  approvalRate: number | null
  overrideRate: number | null
  reviewRequired: boolean
  approved: boolean | null
  overridden: boolean | null
  traceId: string | null
  requestId: string | null
  status: 'success' | 'error' | 'pending_review' | 'approved' | 'rejected'
}

function clampConfidence(value?: number | null): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0.5
  return Math.min(1, Math.max(0, value))
}

function uniqueEvidenceRefs(values?: string[]): string[] {
  if (!values?.length) return []
  return Array.from(new Set(values.map((value) => value.trim()).filter(Boolean)))
}

export function requiresHumanReview(domain?: AiBusinessDomain): boolean {
  return domain === 'legal' || domain === 'finance' || domain === 'labour'
}

export function buildAiEngineVersion(provider: string | null | undefined, modelUsed: string): string {
  const normalizedProvider = provider?.trim()
  return normalizedProvider ? `${normalizedProvider}:${modelUsed}` : modelUsed
}

export function emitAiGovernanceMetric(payload: AiGovernanceMetric): void {
  const metric = {
    _type: 'nzila.ai.governance.metric',
    timestamp: new Date().toISOString(),
    ...payload,
  }
  process.stdout.write(JSON.stringify(metric) + '\n')
}

export function recordAiReviewDecision(input: {
  appKey: string
  orgId: string
  modelUsed: string
  engineVersion: string
  approved: boolean
  overridden?: boolean
  traceId?: string | null
  requestId?: string | null
}): void {
  emitAiGovernanceMetric({
    appKey: input.appKey,
    orgId: input.orgId,
    modelUsed: input.modelUsed,
    engineVersion: input.engineVersion,
    latencyMs: null,
    tokenCostUsd: null,
    tokensIn: null,
    tokensOut: null,
    errorRate: 0,
    approvalRate: input.approved ? 1 : 0,
    overrideRate: input.overridden ? 1 : 0,
    reviewRequired: true,
    approved: input.approved,
    overridden: input.overridden ?? false,
    traceId: input.traceId ?? input.requestId ?? null,
    requestId: input.requestId ?? null,
    status: input.approved ? 'approved' : 'rejected',
  })
}

export function buildCanonicalAiOutput<T extends object>(input: {
  payload: T
  appKey: string
  orgId: string
  execution: AiExecutionTelemetry
  confidenceScore?: number | null
  evidenceRefs?: string[]
  reviewRequired?: boolean
  domain?: AiBusinessDomain
  generatedAt?: string
}): CanonicalAiOutput<T> {
  const generatedAt = input.generatedAt ?? new Date().toISOString()
  const reviewRequired = input.reviewRequired ?? requiresHumanReview(input.domain)

  emitAiGovernanceMetric({
    appKey: input.appKey,
    orgId: input.orgId,
    modelUsed: input.execution.modelUsed,
    engineVersion: input.execution.engineVersion,
    latencyMs: input.execution.latencyMs ?? null,
    tokenCostUsd: input.execution.tokenCostUsd ?? null,
    tokensIn: input.execution.tokensIn ?? null,
    tokensOut: input.execution.tokensOut ?? null,
    errorRate: 0,
    approvalRate: null,
    overrideRate: null,
    reviewRequired,
    approved: null,
    overridden: null,
    traceId: input.execution.traceId ?? input.execution.requestId ?? null,
    requestId: input.execution.requestId ?? null,
    status: reviewRequired ? 'pending_review' : 'success',
  })

  return {
    ...input.payload,
    confidence_score: clampConfidence(input.confidenceScore),
    evidence_refs: uniqueEvidenceRefs(input.evidenceRefs),
    review_required: reviewRequired,
    engine_version: input.execution.engineVersion,
    generated_at: generatedAt,
    org_id: input.orgId,
    trace_id: input.execution.traceId ?? input.execution.requestId ?? null,
  }
}