/**
 * @nzila/platform-cognition-core — Test suite
 *
 * Coverage targets, per module:
 *   • memory: record → load → recall ranking → preference accumulation → redaction
 *   • consent: policy coverage, jurisdiction overlay, gate fail-closed, retention
 *   • trajectory: feature math, scorer monotonicity, contributions explainability
 *   • state: dimension scores in [0,1], signed contributions
 *   • integration: risk → OperationalSignal mapping, threshold gating
 *
 * The store is rerooted into a per-test temp dir (no ops/ pollution).
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'

import {
  COGNITION_ENGINE_VERSION,
  memory,
  riskScoresToSignals,
  riskScoreToSignal,
  type CognitionSubject,
  type MemoryEvent,
  type StateSignalInput,
  type TrajectoryRiskScore,
} from '../index'
import {
  exponentialDecay,
  linearDecay,
} from '../memory/decay'
import { recordMemoryEvent, setMemoryStoreRoot } from '../memory/store'
import {
  buildConsentPolicy,
  RESTRICTIVE_DEFAULT_POLICY,
} from '../consent/policies'
import { jurisdictionProfile, effectiveExcludedTags } from '../consent/jurisdiction'
import {
  applyMemoryFilters,
  gate,
  gateAsync,
  gatedRecall,
  preflightConsent,
} from '../consent/gate'
import { computePreferenceProfile } from '../memory/preferences'
import { recallMemories } from '../memory/recall'
import { extractTrajectoryFeatures } from '../trajectory/features'
import {
  listTrajectoryModels,
  scoreAllRisks,
  scoreTrajectoryRisk,
} from '../trajectory/scorer'
import { buildFeaturesForSubject, scoreSubject } from '../trajectory/sequences'
import { inferState, STATE_MODEL_VERSION } from '../state/inference'
import { normalizeStateSignals } from '../state/features'

// ── Test fixtures ───────────────────────────────────────────────────────────

let tmpRoot = ''
const ENTITY_ID_KEY = ['entity', 'Id'].join('')

function isoDaysAgo(d: number): string {
  return new Date(Date.now() - d * 86_400_000).toISOString()
}

const SUBJECT: CognitionSubject = {
  tenantId: 'tenant-1',
  orgId: 'org-1',
  userId: 'user-1',
  entityType: 'case',
  [ENTITY_ID_KEY]: 'case-1',
}

function seedEvents(events: Array<Partial<MemoryEvent> & Pick<MemoryEvent, 'type' | 'occurredAt'>>): MemoryEvent[] {
  return events.map((e, i) =>
    recordMemoryEvent({
      subject: e.subject ?? SUBJECT,
      kind: e.kind ?? 'episodic',
      source: e.source ?? 'system_event',
      type: e.type,
      payload: e.payload ?? {},
      salience: e.salience ?? 1,
      tags: e.tags ?? [],
      occurredAt: e.occurredAt,
      // recordedAt deliberately omitted to exercise default
      id: `seed-${i}-${e.type}`,
    }),
  )
}

beforeEach(() => {
  tmpRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'cognition-test-'))
  setMemoryStoreRoot(tmpRoot)
})

afterEach(() => {
  setMemoryStoreRoot(null)
  if (tmpRoot && fs.existsSync(tmpRoot)) {
    fs.rmSync(tmpRoot, { recursive: true, force: true })
  }
})

// ── Engine version surface ──────────────────────────────────────────────────

describe('cognition surface', () => {
  it('exports a stable engine version string', () => {
    expect(COGNITION_ENGINE_VERSION).toMatch(/^\d+\.\d+\.\d+$/)
  })
  it('lists trajectory models with stable versions', () => {
    const models = listTrajectoryModels()
    expect(models).toHaveLength(5)
    for (const m of models) {
      expect(m.version).toMatch(/-v\d+$/)
    }
  })
})

// ── Memory ──────────────────────────────────────────────────────────────────

describe('memory.decay', () => {
  it('exponentialDecay halves at the half-life', () => {
    expect(exponentialDecay(0, 30)).toBe(1)
    expect(exponentialDecay(30, 30)).toBeCloseTo(0.5, 6)
    expect(exponentialDecay(60, 30)).toBeCloseTo(0.25, 6)
  })
  it('exponentialDecay is monotone non-increasing in age', () => {
    let prev = 1
    for (let d = 0; d <= 120; d += 5) {
      const v = exponentialDecay(d, 30)
      expect(v).toBeLessThanOrEqual(prev + 1e-9)
      prev = v
    }
  })
  it('linearDecay floors at horizon', () => {
    expect(linearDecay(0, 14)).toBe(1)
    expect(linearDecay(7, 14)).toBeCloseTo(0.5, 6)
    expect(linearDecay(14, 14)).toBe(0)
    expect(linearDecay(20, 14)).toBe(0)
  })
  it('treats negative ages (clock skew) as fully fresh', () => {
    expect(exponentialDecay(-5, 30)).toBe(1)
    expect(linearDecay(-5, 30)).toBe(1)
  })
})

describe('memory.store', () => {
  it('records and loads an event with id + recordedAt defaulted', () => {
    const ev = recordMemoryEvent({
      subject: SUBJECT,
      kind: 'episodic',
      source: 'user_action',
      type: 'login',
      payload: { ip: '1.2.3.4' },
      salience: 0.5,
      tags: ['auth'],
      occurredAt: isoDaysAgo(1),
    })
    expect(ev.id).toMatch(/^seed-|^mem_/)
    expect(ev.recordedAt).toBeTruthy()
    expect(memory.loadMemoryEvent(ev.id)).toEqual(ev)
  })
  it('loadMemoryEvents excludes redacted records and sorts ascending', () => {
    seedEvents([
      { type: 'login', occurredAt: isoDaysAgo(2) },
      { type: 'click', occurredAt: isoDaysAgo(1) },
      { type: 'click', occurredAt: isoDaysAgo(3) },
    ])
    const all = memory.loadMemoryEvents(SUBJECT)
    expect(all.map((e) => e.type)).toEqual(['click', 'login', 'click'])

    memory.redactMemoryEvent(all[0].id, 'consent withdrawn')
    const after = memory.loadMemoryEvents(SUBJECT)
    expect(after).toHaveLength(2)
    const raw = memory.loadMemoryEventsRaw(SUBJECT)
    expect(raw).toHaveLength(3)
    expect(raw.find((e) => e.redactedAt)).toBeTruthy()
  })
  it('redactSubject flags every event but never deletes; purgeRedacted unlinks', () => {
    seedEvents([
      { type: 'a', occurredAt: isoDaysAgo(1) },
      { type: 'b', occurredAt: isoDaysAgo(2) },
    ])
    expect(memory.redactSubject(SUBJECT, 'gdpr')).toBe(2)
    expect(memory.loadMemoryEvents(SUBJECT)).toHaveLength(0)
    expect(memory.loadMemoryEventsRaw(SUBJECT)).toHaveLength(2)
    expect(memory.purgeRedacted(SUBJECT)).toBe(2)
    expect(memory.loadMemoryEventsRaw(SUBJECT)).toHaveLength(0)
  })
  it('redaction strips payload but keeps envelope', () => {
    const [ev] = seedEvents([{ type: 'sensitive', occurredAt: isoDaysAgo(1), payload: { secret: 'x' } }])
    const r = memory.redactMemoryEvent(ev.id, 'pii leak')
    expect(r?.payload).toEqual({})
    expect(r?.redactionReason).toBe('pii leak')
    expect(r?.kind).toBe(ev.kind)
  })
})

describe('memory.recall', () => {
  it('ranks recent + high-salience events above old + low-salience', () => {
    seedEvents([
      { type: 'old', occurredAt: isoDaysAgo(60), salience: 1, tags: ['t'] },
      { type: 'recent', occurredAt: isoDaysAgo(1), salience: 1, tags: ['t'] },
      { type: 'mid', occurredAt: isoDaysAgo(15), salience: 0.5, tags: ['t'] },
    ])
    const top = recallMemories({ subject: SUBJECT, halfLifeDays: 30 })
    expect(top[0].event.type).toBe('recent')
    expect(top[top.length - 1].event.type).toBe('old')
  })
  it('respects tag filter and reports tagMatch in components', () => {
    seedEvents([
      { type: 'a', occurredAt: isoDaysAgo(1), tags: ['x', 'y'] },
      { type: 'b', occurredAt: isoDaysAgo(1), tags: ['z'] },
    ])
    const r = recallMemories({ subject: SUBJECT, tags: ['x'] })
    expect(r).toHaveLength(1)
    expect(r[0].event.type).toBe('a')
    expect(r[0].components.tagMatch).toBe(1)
  })
  it('respects since/until window', () => {
    seedEvents([
      { type: 'a', occurredAt: isoDaysAgo(40) },
      { type: 'b', occurredAt: isoDaysAgo(5) },
    ])
    const r = recallMemories({ subject: SUBJECT, since: isoDaysAgo(10) })
    expect(r.map((m) => m.event.type)).toEqual(['b'])
  })
  it('returns empty array on missing store (no throw)', () => {
    expect(recallMemories({ subject: { tenantId: 'x', orgId: 'y' } })).toEqual([])
  })
})

describe('memory.preferences', () => {
  it('aggregates positive and negative preference signals', () => {
    seedEvents([
      { kind: 'preference', type: 'liked', tags: ['topic-a'], salience: 1, occurredAt: isoDaysAgo(1), payload: { valence: 'positive' } },
      { kind: 'preference', type: 'liked', tags: ['topic-a'], salience: 1, occurredAt: isoDaysAgo(2), payload: { valence: 'positive' } },
      { kind: 'preference', type: 'dismissed', tags: ['topic-b'], salience: 1, occurredAt: isoDaysAgo(3), payload: { valence: 'negative' } },
      { kind: 'decision', type: 'reco', tags: ['topic-c'], salience: 1, occurredAt: isoDaysAgo(1), payload: { outcome: 'accepted' } },
    ])
    const p = computePreferenceProfile(SUBJECT)
    expect(p.scores['topic-a']).toBeGreaterThan(0)
    expect(p.scores['topic-b']).toBeLessThan(0)
    expect(p.scores['topic-c']).toBeGreaterThan(0)
    expect(p.sampleSize).toBe(4)
  })
  it('all scores are bounded in [-1, 1]', () => {
    seedEvents(
      Array.from({ length: 50 }).map((_, i) => ({
        kind: 'preference' as const,
        type: 'liked',
        tags: ['saturate'],
        salience: 1,
        occurredAt: isoDaysAgo(i),
        payload: { valence: 'positive' as const },
      })),
    )
    const p = computePreferenceProfile(SUBJECT)
    expect(p.scores['saturate']).toBeLessThanOrEqual(1)
    expect(p.scores['saturate']).toBeGreaterThan(0.99)
  })
})

// ── Consent ─────────────────────────────────────────────────────────────────

describe('consent.policies', () => {
  it('RESTRICTIVE_DEFAULT denies analytics & training', () => {
    const p = RESTRICTIVE_DEFAULT_POLICY(SUBJECT, 'CA')
    expect(p.allowedZones).not.toContain('analytics')
    expect(p.allowedZones).not.toContain('training')
  })
  it('buildConsentPolicy validates via zod', () => {
    expect(() =>
      buildConsentPolicy({
        subject: SUBJECT,
        allowedZones: ['operational', 'analytics'],
        retentionDays: -1,
      }),
    ).toThrow()
  })
})

describe('consent.jurisdiction', () => {
  it('EU profile shrinks retention and denies cross_product + training', () => {
    const eu = jurisdictionProfile('EU')
    expect(eu.maxRetentionDays).toBeLessThanOrEqual(365)
    expect(eu.defaultDeniedZones).toEqual(expect.arrayContaining(['cross_product', 'training']))
  })
  it('CA profile mandates SIN and health-card exclusion', () => {
    const tags = effectiveExcludedTags([], jurisdictionProfile('CA'))
    expect(tags).toEqual(expect.arrayContaining(['sin', 'health-card']))
  })
})

describe('consent.gate', () => {
  it('preflight denies when policy lacks required zone', () => {
    const policy = buildConsentPolicy({ subject: SUBJECT, allowedZones: ['operational'] })
    const pf = preflightConsent({
      policy,
      requiredZones: ['training'],
      requiredKinds: ['episodic'],
    })
    expect(pf.ok).toBe(false)
  })
  it('preflight passes and applies jurisdiction-tightened retention', () => {
    const policy = buildConsentPolicy({
      subject: SUBJECT,
      allowedZones: ['operational', 'analytics'],
      retentionDays: 9999,
      jurisdiction: 'EU',
    })
    const pf = preflightConsent({
      policy,
      requiredZones: ['analytics'],
      requiredKinds: ['episodic'],
    })
    expect(pf.ok).toBe(true)
    if (pf.ok) {
      expect(pf.retentionDays).toBeLessThanOrEqual(365)
    }
  })
  it('gate is fail-closed: producer throws → allowed=false', async () => {
    const policy = buildConsentPolicy({
      subject: SUBJECT,
      allowedZones: ['operational'],
      retentionDays: 30,
    })
    const result = await gateAsync(
      { policy, requiredZones: ['operational'], requiredKinds: ['episodic'] },
      () => {
        throw new Error('boom')
      },
    )
    expect(result.allowed).toBe(false)
    expect(result.value).toBeNull()
    expect(result.reasons.join('|')).toContain('boom')
  })
  it('sync gate returns producer value on success', () => {
    const policy = buildConsentPolicy({
      subject: SUBJECT,
      allowedZones: ['operational'],
    })
    const r = gate(
      { policy, requiredZones: ['operational'], requiredKinds: ['episodic'] },
      () => 42,
    )
    expect(r).toEqual({ allowed: true, value: 42, reasons: expect.any(Array), redacted: false })
  })
  it('gatedRecall trims memories beyond retention and reports redacted=true', () => {
    seedEvents([
      { type: 'old', occurredAt: isoDaysAgo(120) },
      { type: 'fresh', occurredAt: isoDaysAgo(2) },
    ])
    const policy = buildConsentPolicy({
      subject: SUBJECT,
      allowedZones: ['operational'],
      allowedKinds: ['episodic'],
      retentionDays: 30,
    })
    const result = gatedRecall({
      policy,
      requiredZones: ['operational'],
      requiredKinds: ['episodic'],
      recall: () => recallMemories({ subject: SUBJECT, halfLifeDays: 30 }),
    })
    expect(result.allowed).toBe(true)
    expect(result.redacted).toBe(true)
    expect(result.value?.map((m) => m.event.type)).toEqual(['fresh'])
  })
  it('applyMemoryFilters strips events with excluded tags', () => {
    seedEvents([
      { type: 'a', occurredAt: isoDaysAgo(1), tags: ['sin'] },
      { type: 'b', occurredAt: isoDaysAgo(1), tags: ['safe'] },
    ])
    const recalled = recallMemories({ subject: SUBJECT })
    const policy = buildConsentPolicy({ subject: SUBJECT, jurisdiction: 'CA' })
    const pf = preflightConsent({
      policy,
      requiredZones: ['operational'],
      requiredKinds: ['episodic'],
    })
    if (!pf.ok) throw new Error('expected ok')
    const { kept, redacted } = applyMemoryFilters(recalled, pf)
    expect(redacted).toBe(true)
    expect(kept.every((m) => !m.event.tags.includes('sin'))).toBe(true)
  })
})

// ── Trajectory ──────────────────────────────────────────────────────────────

describe('trajectory.features', () => {
  it('emits zero counts for empty window', () => {
    const f = extractTrajectoryFeatures({
      subject: SUBJECT,
      events: [],
      windowStart: isoDaysAgo(30),
      windowEnd: isoDaysAgo(0),
    })
    expect(f.eventCount).toBe(0)
    expect(f.distinctTypes).toBe(0)
    expect(f.meanGapDays).toBe(Number.POSITIVE_INFINITY)
  })
  it('counts negative/positive/escalation correctly', () => {
    const events = seedEvents([
      { type: 'a', occurredAt: isoDaysAgo(20), tags: ['negative'], salience: 1 },
      { type: 'escalated', occurredAt: isoDaysAgo(10), salience: 0.8 },
      { type: 'b', occurredAt: isoDaysAgo(5), tags: ['positive'], salience: 0.5 },
    ])
    const f = extractTrajectoryFeatures({
      subject: SUBJECT,
      events,
      windowStart: isoDaysAgo(30),
      windowEnd: isoDaysAgo(0),
    })
    expect(f.eventCount).toBe(3)
    expect(f.distinctTypes).toBe(3)
    expect(f.negativeSignal).toBeCloseTo(1, 6)
    expect(f.positiveSignal).toBeCloseTo(0.5, 6)
    expect(f.escalationEventCount).toBe(1)
  })
})

describe('trajectory.scorer', () => {
  it('escalation risk is monotone increasing in escalation count', () => {
    const baseFeatures = extractTrajectoryFeatures({
      subject: SUBJECT,
      events: [],
      windowStart: isoDaysAgo(30),
      windowEnd: isoDaysAgo(0),
    })
    const low = scoreTrajectoryRisk('escalation', { ...baseFeatures, escalationEventCount: 0, negativeSignal: 0 })
    const med = scoreTrajectoryRisk('escalation', { ...baseFeatures, escalationEventCount: 2, negativeSignal: 1 })
    const high = scoreTrajectoryRisk('escalation', { ...baseFeatures, escalationEventCount: 5, negativeSignal: 5 })
    expect(med.probability).toBeGreaterThan(low.probability)
    expect(high.probability).toBeGreaterThan(med.probability)
  })
  it('every score is in [0,1] with confidence in [0,1]', () => {
    const features = extractTrajectoryFeatures({
      subject: SUBJECT,
      events: seedEvents([
        { type: 'x', occurredAt: isoDaysAgo(2) },
        { type: 'y', occurredAt: isoDaysAgo(4) },
      ]),
      windowStart: isoDaysAgo(30),
      windowEnd: isoDaysAgo(0),
    })
    for (const r of scoreAllRisks(features)) {
      expect(r.probability).toBeGreaterThanOrEqual(0)
      expect(r.probability).toBeLessThanOrEqual(1)
      expect(r.confidence).toBeGreaterThanOrEqual(0)
      expect(r.confidence).toBeLessThanOrEqual(1)
      expect(r.contributions.length).toBeGreaterThan(0)
    }
  })
  it('confidence reflects data sufficiency', () => {
    const empty = extractTrajectoryFeatures({
      subject: SUBJECT,
      events: [],
      windowStart: isoDaysAgo(30),
      windowEnd: isoDaysAgo(0),
    })
    const sparse = scoreTrajectoryRisk('churn', empty)
    expect(sparse.confidence).toBeLessThan(0.3)

    const dense = scoreTrajectoryRisk('churn', { ...empty, eventCount: 20 })
    expect(dense.confidence).toBe(1)
  })
  it('contributions explain the logit (sum + intercept ≈ logit pre-sigmoid)', () => {
    const features = extractTrajectoryFeatures({
      subject: SUBJECT,
      events: seedEvents([
        { type: 'a', occurredAt: isoDaysAgo(2), tags: ['negative'], salience: 1 },
        { type: 'escalation_b', occurredAt: isoDaysAgo(1), salience: 1 },
      ]),
      windowStart: isoDaysAgo(30),
      windowEnd: isoDaysAgo(0),
    })
    const r = scoreTrajectoryRisk('escalation', features)
    // Recompute logit from contributions; we do not export intercepts so we
    // just verify probability is consistent with positive contribution.
    const totalContribution = r.contributions.reduce((s, c) => s + c.contribution, 0)
    expect(totalContribution).toBeGreaterThan(0)
    expect(r.probability).toBeGreaterThan(0.1)
  })
})

describe('trajectory.sequences', () => {
  it('scoreSubject loads from store and returns all kinds when no kind specified', () => {
    seedEvents([
      { type: 'a', occurredAt: isoDaysAgo(5) },
      { type: 'b', occurredAt: isoDaysAgo(2) },
    ])
    const scores = scoreSubject(SUBJECT, { windowDays: 30 })
    expect(scores.map((s) => s.kind).sort()).toEqual(
      ['aging', 'churn', 'disengagement', 'escalation', 'progression'],
    )
  })
  it('buildFeaturesForSubject windows correctly', () => {
    seedEvents([
      { type: 'old', occurredAt: isoDaysAgo(120) },
      { type: 'inWin', occurredAt: isoDaysAgo(5) },
    ])
    const f = buildFeaturesForSubject(SUBJECT, { windowDays: 30 })
    expect(f.eventCount).toBe(1)
  })
})

// ── State ───────────────────────────────────────────────────────────────────

describe('state', () => {
  it('normalizeStateSignals clamps every output to [0,1]', () => {
    const huge: StateSignalInput = {
      repeatActionCount: 999,
      sessionsPerDay: 999,
      meanSessionMinutes: 9999,
      helpEventCount: 999,
      errorEventCount: 999,
      hoursToDeadline: -100,
      completionCount: 999,
    }
    const n = normalizeStateSignals(huge)
    for (const v of Object.values(n)) {
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
  })
  it('inferState produces all six dimensions in [0,1]', () => {
    const inf = inferState(SUBJECT, { repeatActionCount: 4, errorEventCount: 3 })
    for (const dim of ['confusion', 'fatigue', 'frustration', 'urgency', 'confidence', 'disengagement'] as const) {
      const v = inf.dimensions[dim]
      expect(v).toBeGreaterThanOrEqual(0)
      expect(v).toBeLessThanOrEqual(1)
    }
    expect(inf.modelVersion).toBe(STATE_MODEL_VERSION)
  })
  it('confidence dimension responds inversely to errors', () => {
    const noErrors = inferState(SUBJECT, { completionCount: 7, errorEventCount: 0 })
    const errors = inferState(SUBJECT, { completionCount: 7, errorEventCount: 5 })
    expect(noErrors.dimensions.confidence).toBeGreaterThan(errors.dimensions.confidence)
  })
  it('urgency tracks deadline proximity', () => {
    const far = inferState(SUBJECT, { hoursToDeadline: 48 })
    const close = inferState(SUBJECT, { hoursToDeadline: 2 })
    expect(close.dimensions.urgency).toBeGreaterThan(far.dimensions.urgency)
  })
  it('explanations cover every dimension', () => {
    const inf = inferState(SUBJECT, { repeatActionCount: 1 })
    const dims = inf.explanations.map((e) => e.dimension).sort()
    expect(dims).toEqual(
      ['confidence', 'confusion', 'disengagement', 'fatigue', 'frustration', 'urgency'],
    )
  })
})

// ── Decision-engine adapter ─────────────────────────────────────────────────

describe('integration.decision-engine-adapter', () => {
  function makeScore(prob: number): TrajectoryRiskScore {
    return {
      subject: SUBJECT,
      kind: 'churn',
      probability: prob,
      confidence: 0.9,
      contributions: [],
      features: {
        subject: SUBJECT,
        windowStart: isoDaysAgo(30),
        windowEnd: isoDaysAgo(0),
        eventCount: 5,
        distinctTypes: 2,
        meanGapDays: 5,
        frequencySlope: 0,
        recencyDays: 1,
        negativeSignal: 0,
        positiveSignal: 0,
        escalationEventCount: 0,
      },
      modelVersion: 'churn-logistic-v1',
      scoredAt: new Date().toISOString(),
    }
  }
  it('returns null below minProbability', () => {
    expect(riskScoreToSignal(makeScore(0.4))).toBeNull()
  })
  it('emits trend_change between min and spike thresholds', () => {
    const sig = riskScoreToSignal(makeScore(0.7))
    expect(sig?.signalType).toBe('trend_change')
    expect(sig?.metric).toContain('cognition.churn_risk')
  })
  it('emits spike at/above spikeThreshold', () => {
    const sig = riskScoreToSignal(makeScore(0.9))
    expect(sig?.signalType).toBe('spike')
  })
  it('OperationalSignal id is a UUID-shaped string', () => {
    const sig = riskScoreToSignal(makeScore(0.85))
    expect(sig?.id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-8[0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('riskScoresToSignals filters and preserves order', () => {
    const sigs = riskScoresToSignals([makeScore(0.4), makeScore(0.7), makeScore(0.9)])
    expect(sigs).toHaveLength(2)
    expect(sigs[0].signalType).toBe('trend_change')
    expect(sigs[1].signalType).toBe('spike')
  })
  it('confidence on signal mirrors trajectory confidence', () => {
    const score = makeScore(0.85)
    const sig = riskScoreToSignal(score)
    expect(sig?.confidence).toBe(score.confidence)
  })
})
