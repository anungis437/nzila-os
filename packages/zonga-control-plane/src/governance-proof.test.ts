/**
 * @nzila/zonga-control-plane — Governance Proof Suite
 *
 * Covers GOV-1 through GOV-4 from PROOF_TARGET_MATRIX.md:
 *   GOV-1: Policy enforcement — no action bypasses governance gate
 *   GOV-2: Admin action guard — reason and role validation
 *   GOV-3: Dispute impact — freeze/unfreeze correctness
 *   GOV-4: AI controller — feature-flag gating and fraud scoring
 */
import { describe, it, expect } from 'vitest'
import {
  registerPolicy,
  listPolicies,
  validateGovernancePolicy,
  executeAdminAction,
  payoutPolicy as _payoutPolicy,
  releasePolicy as _releasePolicy,
  eventPolicy as _eventPolicy,
  type GovernancePolicy,
} from './governance-enforcer'
import {
  resolveDisputeImpact,
  resolveDisputeFreeze,
  type DisputeRecord,
} from './dispute-impact'
import {
  executeControlledInference,
  runFraudCheck,
  setFeatureFlag,
  isFeatureEnabled,
  listFeatureFlags,
  AIFeatureFlag,
  type AIInferenceRequest,
  type FraudSignal,
} from './ai-controller'
import {
  recordMetric,
  getMetrics,
  clearMetrics,
  generateCorrelationId,
  onMetric,
  emitLog,
  onLog,
  MetricName,
} from './observability'
import type { ControlPlaneContext } from './types'
import { AuditSeverity } from './types'

// ── Helpers ───────────────────────────────────────────────────────────────

let _ctr = 0
function nextId(prefix = 'gov'): string {
  return `${prefix}_${Date.now()}_${++_ctr}`
}

function makeContext(overrides: Partial<ControlPlaneContext> = {}): ControlPlaneContext {
  return {
    orgId: nextId('org'),
    actorId: nextId('actor'),
    actorRole: 'admin',
    correlationId: nextId('corr'),
    requestId: nextId('req'),
    timestamp: new Date(),
    ...overrides,
  }
}

function makeDispute(overrides: Partial<DisputeRecord> = {}): DisputeRecord {
  return {
    id: nextId('dispute'),
    type: 'payment',
    status: 'open',
    filedBy: nextId('filer'),
    targetCreatorId: nextId('target'),
    relatedReleaseIds: [],
    relatedPayoutIds: [],
    relatedRoyaltyAccrualIds: [],
    evidence: [],
    filedAt: new Date(),
    ...overrides,
  }
}

// ── GOV-1: Policy enforcement ─────────────────────────────────────────────

describe('GOV-1: Policy enforcement — no action bypasses governance gate', () => {
  it('built-in policies are auto-registered', () => {
    const policies = listPolicies()
    const ids = policies.map((p) => p.id)
    expect(ids).toContain('payout_policy')
    expect(ids).toContain('release_publish_policy')
    expect(ids).toContain('event_publish_policy')
  })

  it('payout policy rejects amount below threshold', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'payout', {
      id: nextId('payout'),
      amount: 0.50,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.length).toBeGreaterThanOrEqual(1)
    expect(result.violations.some((v) => v.rule === 'minimum_payout_threshold')).toBe(true)
  })

  it('payout policy rejects active dispute', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'payout', {
      id: nextId('payout'),
      amount: 100,
      hasActiveDispute: true,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.rule === 'dispute_payout_freeze')).toBe(true)
  })

  it('payout policy passes valid payout', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'payout', {
      id: nextId('payout'),
      amount: 50,
      hasActiveDispute: false,
    })
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('release policy rejects missing rights', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'release', {
      id: nextId('release'),
      hasValidRights: false,
      splitTotal: 100,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.rule === 'valid_rights_required')).toBe(true)
  })

  it('release policy rejects splits != 100%', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'release', {
      id: nextId('release'),
      hasValidRights: true,
      splitTotal: 95,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.rule === 'splits_sum_100')).toBe(true)
  })

  it('release policy passes valid release', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'release', {
      id: nextId('release'),
      hasValidRights: true,
      splitTotal: 100,
    })
    expect(result.passed).toBe(true)
  })

  it('event policy rejects zero capacity', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'event', {
      id: nextId('event'),
      capacity: 0,
      hasTicketTypes: true,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.rule === 'valid_capacity')).toBe(true)
  })

  it('event policy rejects missing ticket types', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'event', {
      id: nextId('event'),
      capacity: 500,
      hasTicketTypes: false,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.rule === 'ticket_types_required')).toBe(true)
  })

  it('event policy passes valid event', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'event', {
      id: nextId('event'),
      capacity: 500,
      hasTicketTypes: true,
    })
    expect(result.passed).toBe(true)
  })

  it('multiple violations on single entity', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'payout', {
      id: nextId('payout'),
      amount: 0.10,
      hasActiveDispute: true,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.length).toBe(2)
  })

  it('unrelated entity type produces no violations', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'invoice', {
      id: nextId('invoice'),
    })
    expect(result.passed).toBe(true)
    expect(result.violations).toHaveLength(0)
  })

  it('custom policy can be registered and evaluates', () => {
    const policyId = nextId('custom_policy')
    const custom: GovernancePolicy = {
      id: policyId,
      name: 'Test Custom Policy',
      description: 'test',
      evaluate: (_ctx, entityType, entity) => {
        if (entityType === 'custom_entity' && entity['blocked'] === true) {
          return [{
            rule: 'custom_block',
            entity: entityType,
            entityId: (entity['id'] as string) ?? 'unknown',
            message: 'Blocked by custom policy',
            severity: AuditSeverity.ERROR,
          }]
        }
        return []
      },
    }
    registerPolicy(custom)
    const policies = listPolicies()
    expect(policies.some((p) => p.id === policyId)).toBe(true)

    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'custom_entity', {
      id: nextId('ce'),
      blocked: true,
    })
    expect(result.passed).toBe(false)
    expect(result.violations.some((v) => v.rule === 'custom_block')).toBe(true)
  })

  it('split total within tolerance passes', () => {
    const ctx = makeContext()
    const result = validateGovernancePolicy(ctx, 'release', {
      id: nextId('release'),
      hasValidRights: true,
      splitTotal: 100.0005,
    })
    expect(result.passed).toBe(true)
  })
})

// ── GOV-2: Admin action guard ─────────────────────────────────────────────

describe('GOV-2: Admin action guard — reason and role validation', () => {
  it('admin role with valid reason succeeds', () => {
    const result = executeAdminAction({
      action: 'freeze_payout',
      targetEntityId: nextId('payout'),
      targetEntityType: 'payout',
      reason: 'Dispute investigation for order #12345',
      context: makeContext({ actorRole: 'admin' }),
    })
    expect(result.allowed).toBe(true)
    expect(result.executed).toBe(true)
    expect(result.auditEventId).toBeTruthy()
  })

  it('superadmin role succeeds', () => {
    const result = executeAdminAction({
      action: 'delete_entity',
      targetEntityId: nextId('entity'),
      targetEntityType: 'entity',
      reason: 'Compliance requirement per regulation XYZ',
      context: makeContext({ actorRole: 'superadmin' }),
    })
    expect(result.allowed).toBe(true)
    expect(result.executed).toBe(true)
  })

  it('finance role succeeds', () => {
    const result = executeAdminAction({
      action: 'adjust_payout',
      targetEntityId: nextId('payout'),
      targetEntityType: 'payout',
      reason: 'Reconciliation adjustment for period Q2',
      context: makeContext({ actorRole: 'finance' }),
    })
    expect(result.allowed).toBe(true)
    expect(result.executed).toBe(true)
  })

  it('compliance role succeeds', () => {
    const result = executeAdminAction({
      action: 'compliance_review',
      targetEntityId: nextId('report'),
      targetEntityType: 'report',
      reason: 'Annual compliance review for regulatory audit',
      context: makeContext({ actorRole: 'compliance' }),
    })
    expect(result.allowed).toBe(true)
    expect(result.executed).toBe(true)
  })

  it('artist role is denied', () => {
    const result = executeAdminAction({
      action: 'freeze_payout',
      targetEntityId: nextId('payout'),
      targetEntityType: 'payout',
      reason: 'I want to freeze my own payout please',
      context: makeContext({ actorRole: 'artist' }),
    })
    expect(result.allowed).toBe(false)
    expect(result.executed).toBe(false)
    expect(result.denialReason).toContain('artist')
    expect(result.auditEventId).toBeTruthy()
  })

  it('viewer role is denied', () => {
    const result = executeAdminAction({
      action: 'view_admin_panel',
      targetEntityId: nextId('panel'),
      targetEntityType: 'panel',
      reason: 'Attempting unauthorized admin access',
      context: makeContext({ actorRole: 'viewer' }),
    })
    expect(result.allowed).toBe(false)
    expect(result.executed).toBe(false)
  })

  it('empty reason is rejected', () => {
    const result = executeAdminAction({
      action: 'freeze_payout',
      targetEntityId: nextId('payout'),
      targetEntityType: 'payout',
      reason: '',
      context: makeContext({ actorRole: 'admin' }),
    })
    expect(result.allowed).toBe(false)
    expect(result.executed).toBe(false)
    expect(result.denialReason).toContain('10 characters')
  })

  it('short reason (< 10 chars) is rejected', () => {
    const result = executeAdminAction({
      action: 'freeze_payout',
      targetEntityId: nextId('payout'),
      targetEntityType: 'payout',
      reason: 'short',
      context: makeContext({ actorRole: 'admin' }),
    })
    expect(result.allowed).toBe(false)
    expect(result.executed).toBe(false)
  })

  it('whitespace-only reason is rejected', () => {
    const result = executeAdminAction({
      action: 'freeze_payout',
      targetEntityId: nextId('payout'),
      targetEntityType: 'payout',
      reason: '           ',
      context: makeContext({ actorRole: 'admin' }),
    })
    expect(result.allowed).toBe(false)
    expect(result.executed).toBe(false)
  })

  it('exactly 10-char reason is accepted', () => {
    const result = executeAdminAction({
      action: 'review',
      targetEntityId: nextId('entity'),
      targetEntityType: 'entity',
      reason: '1234567890',
      context: makeContext({ actorRole: 'admin' }),
    })
    expect(result.allowed).toBe(true)
    expect(result.executed).toBe(true)
  })
})

// ── GOV-3: Dispute impact — freeze/unfreeze correctness ───────────────────

describe('GOV-3: Dispute impact — freeze/unfreeze correctness', () => {
  it('freezes explicit payout IDs from dispute', () => {
    const ctx = makeContext()
    const payoutIds = [nextId('po'), nextId('po')]
    const dispute = makeDispute({
      relatedPayoutIds: payoutIds,
    })
    const result = resolveDisputeImpact(ctx, dispute, [
      { payoutId: payoutIds[0]!, amount: 500, creatorId: dispute.targetCreatorId },
      { payoutId: payoutIds[1]!, amount: 300, creatorId: dispute.targetCreatorId },
    ], [])

    expect(result.frozenPayoutIds).toEqual(payoutIds)
    expect(result.totalFrozenAmount).toBe(800)
    expect(result.affectedCreators).toContain(dispute.targetCreatorId)
  })

  it('auto-detects payouts by target creator when no explicit IDs', () => {
    const ctx = makeContext()
    const targetCreator = nextId('creator')
    const otherCreator = nextId('other')
    const p1 = nextId('po')
    const p2 = nextId('po')
    const p3 = nextId('po')
    const dispute = makeDispute({
      targetCreatorId: targetCreator,
      relatedPayoutIds: [], // no explicit IDs
    })
    const result = resolveDisputeImpact(ctx, dispute, [
      { payoutId: p1, amount: 100, creatorId: targetCreator },
      { payoutId: p2, amount: 200, creatorId: otherCreator },
      { payoutId: p3, amount: 300, creatorId: targetCreator },
    ], [])

    expect(result.frozenPayoutIds).toContain(p1)
    expect(result.frozenPayoutIds).toContain(p3)
    expect(result.frozenPayoutIds).not.toContain(p2)
    expect(result.totalFrozenAmount).toBe(400)
  })

  it('freezes royalty accruals', () => {
    const ctx = makeContext()
    const accrualIds = [nextId('ra'), nextId('ra')]
    const dispute = makeDispute({
      relatedRoyaltyAccrualIds: accrualIds,
    })
    const result = resolveDisputeImpact(ctx, dispute, [], [
      { accrualId: accrualIds[0]!, amount: 1000, holderId: dispute.targetCreatorId },
      { accrualId: accrualIds[1]!, amount: 500, holderId: dispute.targetCreatorId },
    ])

    expect(result.frozenRoyaltyAccrualIds).toEqual(accrualIds)
    expect(result.totalFrozenAmount).toBe(1500)
  })

  it('ownership dispute requires manual review', () => {
    const ctx = makeContext()
    const dispute = makeDispute({ type: 'ownership' })
    const result = resolveDisputeImpact(ctx, dispute, [], [])
    expect(result.requiresManualReview).toBe(true)
  })

  it('territory dispute requires manual review', () => {
    const ctx = makeContext()
    const dispute = makeDispute({ type: 'territory' })
    const result = resolveDisputeImpact(ctx, dispute, [], [])
    expect(result.requiresManualReview).toBe(true)
  })

  it('high-value freeze (>10000) requires manual review', () => {
    const ctx = makeContext()
    const payoutIds = [nextId('po')]
    const dispute = makeDispute({
      type: 'payment',
      relatedPayoutIds: payoutIds,
    })
    const result = resolveDisputeImpact(ctx, dispute, [
      { payoutId: payoutIds[0]!, amount: 15000, creatorId: dispute.targetCreatorId },
    ], [])
    expect(result.requiresManualReview).toBe(true)
    expect(result.totalFrozenAmount).toBe(15000)
  })

  it('many frozen payouts (>5) requires manual review', () => {
    const ctx = makeContext()
    const payoutIds = Array.from({ length: 6 }, () => nextId('po'))
    const dispute = makeDispute({ relatedPayoutIds: payoutIds })
    const result = resolveDisputeImpact(
      ctx, dispute,
      payoutIds.map((id) => ({ payoutId: id, amount: 10, creatorId: dispute.targetCreatorId })),
      [],
    )
    expect(result.requiresManualReview).toBe(true)
  })

  it('provides recommended action per dispute type', () => {
    const ctx = makeContext()
    for (const dtype of ['payment', 'ownership', 'territory', 'split', 'takedown'] as const) {
      const dispute = makeDispute({ type: dtype })
      const result = resolveDisputeImpact(ctx, dispute, [], [])
      expect(result.recommendedAction.length).toBeGreaterThan(0)
    }
  })

  it('affected creators includes filer and target', () => {
    const ctx = makeContext()
    const dispute = makeDispute()
    const result = resolveDisputeImpact(ctx, dispute, [], [])
    expect(result.affectedCreators).toContain(dispute.targetCreatorId)
    expect(result.affectedCreators).toContain(dispute.filedBy)
  })

  // ── Unfreeze resolution ──────────────────────

  it('dismissed resolution unfreezes everything', () => {
    const ctx = makeContext()
    const frozenPayouts = [nextId('po'), nextId('po')]
    const frozenAccruals = [nextId('ra')]
    const result = resolveDisputeFreeze(
      ctx, nextId('dispute'), 'dismissed', frozenPayouts, frozenAccruals,
    )
    expect(result.unfrozenPayoutIds).toEqual(frozenPayouts)
    expect(result.unfrozenRoyaltyAccrualIds).toEqual(frozenAccruals)
    expect(result.requiresPayoutAdjustment).toBe(false)
  })

  it('in_favor_of_target unfreezes everything', () => {
    const ctx = makeContext()
    const frozenPayouts = [nextId('po')]
    const result = resolveDisputeFreeze(
      ctx, nextId('dispute'), 'in_favor_of_target', frozenPayouts, [],
    )
    expect(result.unfrozenPayoutIds).toEqual(frozenPayouts)
    expect(result.requiresPayoutAdjustment).toBe(false)
  })

  it('in_favor_of_filer keeps everything frozen and requires adjustment', () => {
    const ctx = makeContext()
    const frozenPayouts = [nextId('po'), nextId('po')]
    const frozenAccruals = [nextId('ra')]
    const result = resolveDisputeFreeze(
      ctx, nextId('dispute'), 'in_favor_of_filer', frozenPayouts, frozenAccruals,
    )
    expect(result.unfrozenPayoutIds).toHaveLength(0)
    expect(result.unfrozenRoyaltyAccrualIds).toHaveLength(0)
    expect(result.requiresPayoutAdjustment).toBe(true)
  })

  it('split resolution unfreezes but requires adjustment', () => {
    const ctx = makeContext()
    const frozenPayouts = [nextId('po')]
    const result = resolveDisputeFreeze(
      ctx, nextId('dispute'), 'split', frozenPayouts, [],
    )
    expect(result.unfrozenPayoutIds).toEqual(frozenPayouts)
    expect(result.requiresPayoutAdjustment).toBe(true)
  })

  it('full lifecycle: file → freeze → resolve → unfreeze', () => {
    const ctx = makeContext()
    const payoutIds = [nextId('po'), nextId('po')]
    const dispute = makeDispute({
      relatedPayoutIds: payoutIds,
      type: 'split',
    })

    // 1. Assess impact → freeze
    const impact = resolveDisputeImpact(ctx, dispute, [
      { payoutId: payoutIds[0]!, amount: 1000, creatorId: dispute.targetCreatorId },
      { payoutId: payoutIds[1]!, amount: 2000, creatorId: dispute.targetCreatorId },
    ], [])
    expect(impact.frozenPayoutIds).toEqual(payoutIds)
    expect(impact.totalFrozenAmount).toBe(3000)

    // 2. Resolve dispute → unfreeze
    const resolution = resolveDisputeFreeze(
      ctx, dispute.id, 'dismissed',
      impact.frozenPayoutIds, impact.frozenRoyaltyAccrualIds,
    )
    expect(resolution.unfrozenPayoutIds).toEqual(payoutIds)
    expect(resolution.requiresPayoutAdjustment).toBe(false)
  })
})

// ── GOV-4: AI controller — feature-flag gating and fraud scoring ──────────

describe('GOV-4: AI controller — feature-flag gating and fraud scoring', () => {
  it('feature flag defaults to disabled', () => {
    expect(isFeatureEnabled('nonexistent_flag')).toBe(false)
  })

  it('can enable and disable feature flags', () => {
    const flag = `test_flag_${++_ctr}`
    setFeatureFlag(flag, true)
    expect(isFeatureEnabled(flag)).toBe(true)
    setFeatureFlag(flag, false)
    expect(isFeatureEnabled(flag)).toBe(false)
  })

  it('listFeatureFlags returns all flags', () => {
    const flag = `list_test_${++_ctr}`
    setFeatureFlag(flag, true)
    const flags = listFeatureFlags()
    expect(flags.get(flag)).toBe(true)
  })

  it('all AIFeatureFlag constants exist', () => {
    const expected = [
      'FRAUD_TICKET_SCORING',
      'FRAUD_STREAM_ANOMALY',
      'RECOMMEND_TRACKS',
      'RECOMMEND_EVENTS',
      'CREATOR_INSIGHTS',
      'CREATOR_ANOMALY_ALERTS',
      'CONTENT_MODERATION',
    ]
    for (const key of expected) {
      expect(AIFeatureFlag[key as keyof typeof AIFeatureFlag]).toBeDefined()
    }
  })

  it('controlled inference returns disabled when flag is off', () => {
    const ctx = makeContext()
    const req: AIInferenceRequest = {
      modelId: 'test-model',
      featureFlag: AIFeatureFlag.FRAUD_TICKET_SCORING,
      input: { ticketId: nextId('tkt') },
      requestedBy: ctx.actorId,
    }
    setFeatureFlag(AIFeatureFlag.FRAUD_TICKET_SCORING, false)
    const result = executeControlledInference(ctx, req, () => ({
      result: { score: 0.5 },
      explanation: 'test',
      confidence: 0.9,
    }))
    expect(result.enabled).toBe(false)
    expect(result.logged).toBe(true)
    expect(result.inferenceResult).toBeUndefined()
  })

  it('controlled inference executes when flag is on', () => {
    const ctx = makeContext()
    const flag = AIFeatureFlag.RECOMMEND_TRACKS
    setFeatureFlag(flag, true)
    const req: AIInferenceRequest = {
      modelId: 'rec-model',
      featureFlag: flag,
      input: { userId: nextId('user') },
      requestedBy: ctx.actorId,
    }
    const result = executeControlledInference(ctx, req, (input) => ({
      result: { tracks: ['t1', 't2'], inputKeys: Object.keys(input) },
      explanation: 'Collaborative filtering',
      confidence: 0.85,
    }))
    expect(result.enabled).toBe(true)
    expect(result.logged).toBe(true)
    expect(result.inferenceResult).toBeDefined()
    expect(result.explanation).toBe('Collaborative filtering')
    expect(result.confidence).toBe(0.85)
  })

  // ── Fraud check tests ──────────────────────────

  it('fraud check with no signals returns low risk', () => {
    const ctx = makeContext()
    const result = runFraudCheck(ctx, {
      entityType: 'ticket_purchase',
      entityId: nextId('tkt'),
      signals: [],
    })
    expect(result.score).toBe(0)
    expect(result.riskLevel).toBe('low')
    expect(result.flagged).toBe(false)
    expect(result.triggeredSignals).toHaveLength(0)
  })

  it('fraud check below threshold is low risk', () => {
    const ctx = makeContext()
    const signals: FraudSignal[] = [
      { type: 'velocity', value: 3, threshold: 10, description: 'Purchase velocity' },
    ]
    const result = runFraudCheck(ctx, {
      entityType: 'ticket_purchase',
      entityId: nextId('tkt'),
      signals,
    })
    expect(result.riskLevel).toBe('low')
    expect(result.flagged).toBe(false)
    expect(result.triggeredSignals).toHaveLength(0)
  })

  it('fraud check at threshold triggers', () => {
    const ctx = makeContext()
    const signals: FraudSignal[] = [
      { type: 'velocity', value: 10, threshold: 10, description: 'Exact threshold' },
    ]
    const result = runFraudCheck(ctx, {
      entityType: 'ticket_purchase',
      entityId: nextId('tkt'),
      signals,
    })
    expect(result.triggeredSignals).toHaveLength(1)
    expect(result.score).toBe(25) // (10/10) * 25 = 25
    expect(result.riskLevel).toBe('low')
  })

  it('multiple triggered signals accumulate score', () => {
    const ctx = makeContext()
    const signals: FraudSignal[] = [
      { type: 'velocity', value: 20, threshold: 10, description: 'High velocity' },
      { type: 'geographic', value: 5, threshold: 5, description: 'Geo anomaly' },
    ]
    const result = runFraudCheck(ctx, {
      entityType: 'ticket_purchase',
      entityId: nextId('tkt'),
      signals,
    })
    // (20/10)*25 + (5/5)*25 = 50 + 25 = 75
    expect(result.score).toBe(75)
    expect(result.riskLevel).toBe('high')
    expect(result.flagged).toBe(true)
    expect(result.triggeredSignals).toHaveLength(2)
  })

  it('critical risk level when score >= 80', () => {
    const ctx = makeContext()
    const signals: FraudSignal[] = [
      { type: 'velocity', value: 30, threshold: 10, description: 'xxx' },
      { type: 'device_fingerprint', value: 10, threshold: 10, description: 'xxx' },
    ]
    const result = runFraudCheck(ctx, {
      entityType: 'stream_play',
      entityId: nextId('stream'),
      signals,
    })
    // (30/10)*25 + (10/10)*25 = 75 + 25 = 100
    expect(result.score).toBe(100)
    expect(result.riskLevel).toBe('critical')
    expect(result.flagged).toBe(true)
  })

  it('score is clamped at 100', () => {
    const ctx = makeContext()
    const signals: FraudSignal[] = [
      { type: 'velocity', value: 100, threshold: 10, description: 'extreme' },
      { type: 'geographic', value: 100, threshold: 10, description: 'extreme' },
      { type: 'payment_pattern', value: 100, threshold: 10, description: 'extreme' },
    ]
    const result = runFraudCheck(ctx, {
      entityType: 'ticket_transfer',
      entityId: nextId('xfer'),
      signals,
    })
    expect(result.score).toBe(100)
  })

  it('medium risk level between 30 and 59', () => {
    const ctx = makeContext()
    const signals: FraudSignal[] = [
      { type: 'velocity', value: 15, threshold: 10, description: 'slightly high' },
    ]
    const result = runFraudCheck(ctx, {
      entityType: 'ticket_purchase',
      entityId: nextId('tkt'),
      signals,
    })
    // (15/10)*25 = 37.5
    expect(result.score).toBe(37.5)
    expect(result.riskLevel).toBe('medium')
    expect(result.flagged).toBe(false)
  })

  // ── Observability integration ──────────────────

  it('recordMetric and getMetrics work', () => {
    clearMetrics()
    recordMetric(MetricName.LEDGER_INTEGRITY_FAILURES, 1, { org: 'test' })
    recordMetric(MetricName.LEDGER_INTEGRITY_FAILURES, 1, { org: 'test2' })
    recordMetric(MetricName.PAYOUT_LATENCY_MS, 42, {})

    const allMetrics = getMetrics()
    expect(allMetrics.length).toBeGreaterThanOrEqual(3)

    const ledgerMetrics = getMetrics(MetricName.LEDGER_INTEGRITY_FAILURES)
    expect(ledgerMetrics.length).toBeGreaterThanOrEqual(2)
    clearMetrics()
  })

  it('onMetric handler receives emitted metrics', () => {
    clearMetrics()
    const received: { name: string; value: number }[] = []
    const unsubscribe = onMetric((m) => {
      received.push({ name: m.name, value: m.value })
    })
    recordMetric(MetricName.FRAUD_SIGNALS_DETECTED, 5, {})
    expect(received).toHaveLength(1)
    expect(received[0]!.name).toBe(MetricName.FRAUD_SIGNALS_DETECTED)
    expect(received[0]!.value).toBe(5)
    unsubscribe()
    recordMetric(MetricName.FRAUD_SIGNALS_DETECTED, 10, {})
    expect(received).toHaveLength(1) // no new metric after unsubscribe
    clearMetrics()
  })

  it('generateCorrelationId produces unique IDs', () => {
    const ids = new Set<string>()
    for (let i = 0; i < 100; i++) {
      ids.add(generateCorrelationId('test'))
    }
    expect(ids.size).toBe(100)
  })

  it('onLog receives structured log entries', () => {
    const logs: { level: string; message: string }[] = []
    const unsubscribe = onLog((log) => {
      logs.push({ level: log.level, message: log.message })
    })
    emitLog({
      level: 'info',
      message: 'Test log',
      correlationId: nextId('corr'),
    })
    expect(logs).toHaveLength(1)
    expect(logs[0]!.message).toBe('Test log')
    unsubscribe()
  })

  it('MetricName covers all expected domains', () => {
    const names = Object.values(MetricName)
    // Economic
    expect(names).toContain('zonga.ledger.integrity_failures')
    expect(names).toContain('zonga.payout.latency_ms')
    // Events/Tickets
    expect(names).toContain('zonga.ticket.scan_conflicts')
    expect(names).toContain('zonga.inventory.oversell_blocks')
    // Fraud
    expect(names).toContain('zonga.fraud.signals_detected')
    // Workflows
    expect(names).toContain('zonga.workflow.executions_total')
    // Rights
    expect(names).toContain('zonga.rights.disputes_filed')
    // AI
    expect(names).toContain('zonga.ai.inference_total')
    // System
    expect(names).toContain('zonga.audit.events_total')
  })
})
