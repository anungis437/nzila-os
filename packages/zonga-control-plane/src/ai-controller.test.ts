import { describe, it, expect, beforeEach } from 'vitest'
import type { ControlPlaneContext } from './types'
import { SystemEventType } from './types'
import { clearEventLog, getEventLog } from './system-events'
import { clearMetrics, getMetrics, MetricName } from './observability'
import {
  setFeatureFlag,
  isFeatureEnabled,
  listFeatureFlags,
  executeControlledInference,
  runFraudCheck,
  AIFeatureFlag,
  type AIInferenceRequest,
  type FraudSignal,
} from './ai-controller'

function makeContext(overrides?: Partial<ControlPlaneContext>): ControlPlaneContext {
  return {
    orgId: 'org-test',
    actorId: 'actor-test',
    actorRole: 'admin',
    correlationId: 'corr-test',
    requestId: 'req-test',
    timestamp: new Date(),
    ...overrides,
  }
}

describe('@nzila/zonga-control-plane — AI Controller', () => {
  beforeEach(() => {
    clearEventLog()
    clearMetrics()
    // Reset flags by setting all to false
    for (const flag of Object.values(AIFeatureFlag)) {
      setFeatureFlag(flag, false)
    }
  })

  // ── Feature Flags ─────────────────────────────────────────────────

  describe('feature flags', () => {
    it('defaults to disabled for unknown flags', () => {
      expect(isFeatureEnabled('unknown_flag')).toBe(false)
    })

    it('enables and disables flags', () => {
      setFeatureFlag(AIFeatureFlag.FRAUD_TICKET_SCORING, true)
      expect(isFeatureEnabled(AIFeatureFlag.FRAUD_TICKET_SCORING)).toBe(true)

      setFeatureFlag(AIFeatureFlag.FRAUD_TICKET_SCORING, false)
      expect(isFeatureEnabled(AIFeatureFlag.FRAUD_TICKET_SCORING)).toBe(false)
    })

    it('lists all feature flags', () => {
      setFeatureFlag(AIFeatureFlag.RECOMMEND_TRACKS, true)
      setFeatureFlag(AIFeatureFlag.CONTENT_MODERATION, false)

      const flags = listFeatureFlags()
      expect(flags.get(AIFeatureFlag.RECOMMEND_TRACKS)).toBe(true)
      expect(flags.get(AIFeatureFlag.CONTENT_MODERATION)).toBe(false)
    })
  })

  // ── Controlled Inference ──────────────────────────────────────────

  describe('executeControlledInference', () => {
    it('returns disabled result when feature flag is off', () => {
      const ctx = makeContext()
      const request: AIInferenceRequest = {
        modelId: 'fraud-v1',
        featureFlag: AIFeatureFlag.FRAUD_TICKET_SCORING,
        input: { ticketId: 't-1' },
        requestedBy: 'actor-test',
      }

      const result = executeControlledInference(ctx, request, () => ({
        result: { score: 0.9 },
        explanation: 'high fraud',
        confidence: 0.95,
      }))

      expect(result.enabled).toBe(false)
      expect(result.logged).toBe(true)
      expect(result.inferenceResult).toBeUndefined()
    })

    it('executes inference when feature flag is enabled', () => {
      setFeatureFlag(AIFeatureFlag.FRAUD_TICKET_SCORING, true)
      const ctx = makeContext()
      const request: AIInferenceRequest = {
        modelId: 'fraud-v1',
        featureFlag: AIFeatureFlag.FRAUD_TICKET_SCORING,
        input: { ticketId: 't-1' },
        requestedBy: 'actor-test',
      }

      const result = executeControlledInference(ctx, request, (input) => ({
        result: { score: 0.85, ticketId: input['ticketId'] },
        explanation: 'Multiple velocity signals',
        confidence: 0.92,
      }))

      expect(result.enabled).toBe(true)
      expect(result.inferenceResult).toEqual({ score: 0.85, ticketId: 't-1' })
      expect(result.explanation).toBe('Multiple velocity signals')
      expect(result.confidence).toBe(0.92)
    })

    it('records latency and total metrics', () => {
      setFeatureFlag(AIFeatureFlag.RECOMMEND_TRACKS, true)
      const ctx = makeContext()
      const request: AIInferenceRequest = {
        modelId: 'rec-v2',
        featureFlag: AIFeatureFlag.RECOMMEND_TRACKS,
        input: { userId: 'u-1' },
        requestedBy: 'actor-test',
      }

      executeControlledInference(ctx, request, () => ({
        result: { tracks: ['t1', 't2'] },
        explanation: 'collaborative filtering',
        confidence: 0.8,
      }))

      const latencyMetrics = getMetrics(MetricName.AI_INFERENCE_LATENCY_MS)
      expect(latencyMetrics.length).toBeGreaterThanOrEqual(1)

      const totalMetrics = getMetrics(MetricName.AI_INFERENCE_TOTAL)
      expect(totalMetrics.length).toBeGreaterThanOrEqual(1)
    })

    it('emits audit event for inference', () => {
      setFeatureFlag(AIFeatureFlag.CREATOR_INSIGHTS, true)
      const ctx = makeContext()
      const request: AIInferenceRequest = {
        modelId: 'insights-v1',
        featureFlag: AIFeatureFlag.CREATOR_INSIGHTS,
        input: { creatorId: 'c-1' },
        requestedBy: 'actor-test',
      }

      executeControlledInference(ctx, request, () => ({
        result: { insight: 'growing audience' },
        explanation: 'trend analysis',
        confidence: 0.88,
      }))

      const events = getEventLog()
      const aiEvent = events.find((e) => e.type === SystemEventType.AI_INFERENCE_COMPLETED)
      expect(aiEvent).toBeDefined()
      expect(aiEvent!.payload['modelId']).toBe('insights-v1')
    })
  })

  // ── Fraud Detection ───────────────────────────────────────────────

  describe('runFraudCheck', () => {
    it('returns low risk when no signals triggered', () => {
      const ctx = makeContext()
      const result = runFraudCheck(ctx, {
        entityType: 'ticket_purchase',
        entityId: 'tp-1',
        signals: [
          { type: 'velocity', value: 2, threshold: 10, description: 'Purchase velocity' },
        ],
      })

      expect(result.riskLevel).toBe('low')
      expect(result.flagged).toBe(false)
      expect(result.triggeredSignals).toHaveLength(0)
    })

    it('returns high/critical risk when signals exceed thresholds', () => {
      const ctx = makeContext()
      const signals: FraudSignal[] = [
        { type: 'velocity', value: 20, threshold: 10, description: 'Purchase velocity' },
        { type: 'device_fingerprint', value: 5, threshold: 3, description: 'Device reuse' },
        { type: 'geographic', value: 8, threshold: 5, description: 'Geo anomaly' },
      ]

      const result = runFraudCheck(ctx, {
        entityType: 'ticket_purchase',
        entityId: 'tp-2',
        signals,
      })

      expect(result.triggeredSignals).toHaveLength(3)
      expect(result.flagged).toBe(true)
      expect(['high', 'critical']).toContain(result.riskLevel)
      expect(result.score).toBeGreaterThan(0)
    })

    it('emits fraud event when flagged', () => {
      const ctx = makeContext()
      const signals: FraudSignal[] = [
        { type: 'velocity', value: 50, threshold: 10, description: 'Purchase velocity' },
        { type: 'payment_pattern', value: 30, threshold: 5, description: 'Payment anomaly' },
        { type: 'repeated_scan', value: 20, threshold: 3, description: 'Scan abuse' },
      ]

      runFraudCheck(ctx, {
        entityType: 'ticket_purchase',
        entityId: 'tp-3',
        signals,
      })

      const events = getEventLog()
      const fraudEvent = events.find((e) => e.type === SystemEventType.FRAUD_SIGNAL_DETECTED)
      expect(fraudEvent).toBeDefined()
    })

    it('records fraud metric when flagged', () => {
      const ctx = makeContext()
      const signals: FraudSignal[] = [
        { type: 'velocity', value: 100, threshold: 10, description: 'Extreme velocity' },
      ]

      runFraudCheck(ctx, {
        entityType: 'stream_play',
        entityId: 'sp-1',
        signals,
      })

      const fraudMetrics = getMetrics(MetricName.FRAUD_SIGNALS_DETECTED)
      expect(fraudMetrics.length).toBeGreaterThanOrEqual(1)
    })

    it('clamps score to 100', () => {
      const ctx = makeContext()
      const signals: FraudSignal[] = [
        { type: 'velocity', value: 1000, threshold: 1, description: 'Massive velocity' },
        { type: 'device_fingerprint', value: 500, threshold: 1, description: 'Massive reuse' },
      ]

      const result = runFraudCheck(ctx, {
        entityType: 'ticket_transfer',
        entityId: 'tt-1',
        signals,
      })

      expect(result.score).toBeLessThanOrEqual(100)
    })
  })
})
