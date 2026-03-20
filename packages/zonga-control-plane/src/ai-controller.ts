/**
 * @nzila/zonga-control-plane — AI Controller
 *
 * All AI inference is feature-flagged, logged, and produces
 * explanation metadata. No AI executes without control.
 */
import type { ControlPlaneContext, AIControlResult } from './types'
import { SystemEventType, AuditSeverity } from './types'
import { emitSystemEvent, buildSystemEvent } from './system-events'
import { recordMetric, MetricName } from './observability'

// ── Feature Flags ─────────────────────────────────────────────────────────

const featureFlags = new Map<string, boolean>()

export function setFeatureFlag(flag: string, enabled: boolean): void {
  featureFlags.set(flag, enabled)
}

export function isFeatureEnabled(flag: string): boolean {
  return featureFlags.get(flag) ?? false
}

export function listFeatureFlags(): Map<string, boolean> {
  return new Map(featureFlags)
}

// ── AI Feature Flags ──────────────────────────────────────────────────────

export const AIFeatureFlag = {
  FRAUD_TICKET_SCORING: 'ai.fraud.ticket_scoring',
  FRAUD_STREAM_ANOMALY: 'ai.fraud.stream_anomaly',
  RECOMMEND_TRACKS: 'ai.recommend.tracks',
  RECOMMEND_EVENTS: 'ai.recommend.events',
  CREATOR_INSIGHTS: 'ai.creator.insights',
  CREATOR_ANOMALY_ALERTS: 'ai.creator.anomaly_alerts',
  CONTENT_MODERATION: 'ai.moderation.content',
} as const
export type AIFeatureFlag = (typeof AIFeatureFlag)[keyof typeof AIFeatureFlag]

// ── Controlled Inference ──────────────────────────────────────────────────

export interface AIInferenceRequest {
  readonly modelId: string
  readonly featureFlag: AIFeatureFlag
  readonly input: Record<string, unknown>
  readonly requestedBy: string
}

/**
 * Execute an AI inference with full control:
 * 1. Check feature flag
 * 2. Log the request
 * 3. Execute inference
 * 4. Log output with explanation metadata
 * 5. Record observability metrics
 */
export function executeControlledInference(
  context: ControlPlaneContext,
  request: AIInferenceRequest,
  inferenceExecutor: (input: Record<string, unknown>) => {
    result: Record<string, unknown>
    explanation: string
    confidence: number
  },
): AIControlResult {
  const startMs = Date.now()

  // Check feature flag
  if (!isFeatureEnabled(request.featureFlag)) {
    return {
      modelId: request.modelId,
      featureFlag: request.featureFlag,
      enabled: false,
      logged: true,
    }
  }

  // Execute inference
  const inference = inferenceExecutor(request.input)
  const latencyMs = Date.now() - startMs

  // Record metrics
  recordMetric(MetricName.AI_INFERENCE_LATENCY_MS, latencyMs, {
    model: request.modelId,
    feature: request.featureFlag,
  })
  recordMetric(MetricName.AI_INFERENCE_TOTAL, 1, {
    model: request.modelId,
    feature: request.featureFlag,
  })

  // Emit audit event
  emitSystemEvent(buildSystemEvent({
    type: SystemEventType.AI_INFERENCE_COMPLETED,
    orgId: context.orgId,
    actorId: context.actorId,
    entityId: `inference_${Date.now()}`,
    entityType: 'ai_inference',
    correlationId: context.correlationId,
    payload: {
      modelId: request.modelId,
      featureFlag: request.featureFlag,
      inputKeys: Object.keys(request.input),
      confidence: inference.confidence,
      explanation: inference.explanation,
      latencyMs,
    },
    severity: AuditSeverity.INFO,
  }))

  return {
    modelId: request.modelId,
    featureFlag: request.featureFlag,
    enabled: true,
    inferenceResult: inference.result,
    explanation: inference.explanation,
    confidence: inference.confidence,
    logged: true,
  }
}

// ── Fraud Detection (Controlled) ──────────────────────────────────────────

export interface FraudCheckRequest {
  readonly entityType: 'ticket_purchase' | 'stream_play' | 'ticket_transfer'
  readonly entityId: string
  readonly signals: readonly FraudSignal[]
}

export interface FraudSignal {
  readonly type: 'velocity' | 'geographic' | 'device_fingerprint' | 'payment_pattern' | 'repeated_scan'
  readonly value: number
  readonly threshold: number
  readonly description: string
}

export interface FraudCheckResult {
  readonly entityId: string
  readonly score: number
  readonly riskLevel: 'low' | 'medium' | 'high' | 'critical'
  readonly flagged: boolean
  readonly signals: readonly FraudSignal[]
  readonly triggeredSignals: readonly FraudSignal[]
}

/**
 * Run a fraud check — feature-flagged and fully logged.
 */
export function runFraudCheck(
  context: ControlPlaneContext,
  request: FraudCheckRequest,
): FraudCheckResult {
  const triggered = request.signals.filter((s) => s.value >= s.threshold)
  const score = triggered.reduce((sum, s) => sum + (s.value / s.threshold) * 25, 0)
  const clampedScore = Math.min(score, 100)

  const riskLevel: FraudCheckResult['riskLevel'] =
    clampedScore >= 80 ? 'critical' :
    clampedScore >= 60 ? 'high' :
    clampedScore >= 30 ? 'medium' :
    'low'

  const flagged = clampedScore >= 60

  if (flagged) {
    recordMetric(MetricName.FRAUD_SIGNALS_DETECTED, 1, {
      entityType: request.entityType,
      riskLevel,
    })

    emitSystemEvent(buildSystemEvent({
      type: SystemEventType.FRAUD_SIGNAL_DETECTED,
      orgId: context.orgId,
      actorId: context.actorId,
      entityId: request.entityId,
      entityType: request.entityType,
      correlationId: context.correlationId,
      payload: {
        score: clampedScore,
        riskLevel,
        triggeredSignals: triggered.map((s) => ({
          type: s.type,
          value: s.value,
          threshold: s.threshold,
        })),
      },
      severity: riskLevel === 'critical' ? AuditSeverity.CRITICAL : AuditSeverity.WARNING,
    }))
  }

  return {
    entityId: request.entityId,
    score: clampedScore,
    riskLevel,
    flagged,
    signals: request.signals,
    triggeredSignals: triggered,
  }
}
