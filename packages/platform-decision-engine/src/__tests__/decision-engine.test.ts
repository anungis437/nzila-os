import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'node:fs'
import * as path from 'node:path'

import {
  decisionCategorySchema,
  decisionSeveritySchema,
  decisionStatusSchema,
  decisionTypeSchema as _decisionTypeSchema,
  decisionSourceSchema as _decisionSourceSchema,
  evidenceRefSchema,
  decisionRecordSchema,
  decisionFeedbackSchema,
  decisionAuditEntrySchema,
  decisionSummarySchema as _decisionSummarySchema,
  decisionExportPackSchema as _decisionExportPackSchema,
} from '../schemas'

import { generateDecisionId, resetDecisionCounter, nowISO, computeHash } from '../utils'
import { isValidTransition, nextValidStatuses } from '../status'
import { generateDecisions, summariseDecisions } from '../engine'
import {
  DEFAULT_RULES,
  grievanceBacklogRule,
  budgetVarianceRule,
  pricingAnomalyRule,
  partnerPerformanceRule,
  deploymentRiskRule,
  crossAppInsightRule,
  governanceStateRule,
} from '../rules'
import {
  evidenceFromAnomalies,
  evidenceFromInsights,
  evidenceFromSignals,
  evidenceFromChanges as _evidenceFromChanges,
  buildEvidenceRefs,
} from '../evidence'
import {
  evaluateDecisionPolicyContext,
  filterExecutableDecisions as _filterExecutableDecisions,
  classifyDecisions,
} from '../policy'
import { computePriorityScore, rankDecisions, topDecisions } from '../ranking'
import {
  saveDecisionRecord,
  loadDecisionRecord,
  loadAllDecisions,
  listOpenDecisions,
  listDecisionsByOrg,
  updateDecisionStatus,
  appendDecisionReview,
  saveDecisionFeedback,
  loadDecisionFeedback,
} from '../store'
import { recordDecisionFeedback } from '../feedback'
import { createAuditEntry, emitAuditEvent, loadAuditTrail } from '../audit'
import { classifyDecisionIntent, executeDecisionQuery } from '../nl'
import { createDecisionExportPack } from '../export'
import type { DecisionRecord, DecisionEngineInput } from '../types'
import { ENGINE_VERSION } from '../types'
import type { Anomaly } from '@nzila/platform-anomaly-engine'
import type { CrossAppInsight, OperationalSignal } from '@nzila/platform-intelligence'
import * as decisionEngineBarrel from '../index'

// ── Test fixtures ───────────────────────────────────────────────────────────

function findRepoRoot(): string {
  let dir = import.meta.dirname ?? process.cwd()
  for (let i = 0; i < 10; i++) {
    if (fs.existsSync(path.join(dir, 'pnpm-workspace.yaml'))) return dir
    dir = path.dirname(dir)
  }
  return process.cwd()
}

function cleanupTestDirs() {
  const root = findRepoRoot()
  for (const d of ['ops/decisions', 'ops/decision-feedback', 'ops/decision-audit']) {
    const dir = path.join(root, d)
    if (fs.existsSync(dir)) {
      fs.rmSync(dir, { recursive: true, force: true })
    }
  }
}

function makeTestAnomaly(overrides: Partial<Anomaly> = {}): Anomaly {
  return {
    id: '00000000-0000-0000-0000-000000000001',
    timestamp: new Date().toISOString(),
    anomalyType: 'grievance_spike',
    severity: 'high',
    app: 'union-eyes',
    metric: 'grievance_backlog_count',
    expectedValue: 10,
    actualValue: 35,
    deviationFactor: 3.5,
    description: 'Grievance submissions 3.5x above normal',
    suggestedAction: 'Allocate additional grievance handlers',
    ...overrides,
  }
}

function makeTestInsight(overrides: Partial<CrossAppInsight> = {}): CrossAppInsight {
  return {
    id: '00000000-0000-0000-0000-000000000010',
    timestamp: new Date().toISOString(),
    category: 'compliance',
    severity: 'critical',
    apps: ['union-eyes', 'cfo', 'partners'],
    title: 'Cross-app compliance degradation',
    description: 'Multiple apps showing compliance metric decline',
    dataPoints: {},
    recommendations: ['Review compliance baselines', 'Escalate to governance'],
    ...overrides,
  }
}

function makeTestSignal(overrides: Partial<OperationalSignal> = {}): OperationalSignal {
  return {
    id: '00000000-0000-0000-0000-000000000020',
    timestamp: new Date().toISOString(),
    signalType: 'threshold_breach',
    app: 'web',
    metric: 'response_time_p99',
    currentValue: 5000,
    baselineValue: 1000,
    deviationPercent: 400,
    confidence: 0.85,
    ...overrides,
  }
}

function makeTestInput(overrides: Partial<DecisionEngineInput> = {}): DecisionEngineInput {
  return {
    org_id: 'test-org',
    anomalies: [],
    insights: [],
    signals: [],
    environment: 'STAGING',
    ...overrides,
  }
}

function makeTestRecord(overrides: Partial<DecisionRecord> = {}): DecisionRecord {
  return {
    decision_id: generateDecisionId(),
    org_id: 'test-org',
    category: 'STAFFING',
    type: 'RECOMMENDATION',
    severity: 'HIGH',
    title: 'Test decision',
    summary: 'Test summary',
    explanation: 'Test explanation',
    confidence_score: 0.8,
    generated_by: { source: 'rules', engine_version: ENGINE_VERSION },
    evidence_refs: [{ type: 'anomaly', ref_id: 'ANO-001', summary: 'Test anomaly' }],
    recommended_actions: ['Action 1', 'Action 2'],
    required_approvals: [],
    review_required: true,
    policy_context: { execution_allowed: true, reasons: [] },
    environment_context: { environment: 'STAGING', protected_environment: true },
    status: 'GENERATED',
    generated_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
    ...overrides,
  }
}

// ── Tests ───────────────────────────────────────────────────────────────────

describe('@nzila/platform-decision-engine', () => {
  beforeEach(() => {
    resetDecisionCounter()
  })

  afterEach(() => {
    cleanupTestDirs()
  })

  // ── Schema validation ─────────────────────────────────────────────────

  describe('schemas', () => {
    it('validates decision categories', () => {
      expect(decisionCategorySchema.parse('STAFFING')).toBe('STAFFING')
      expect(decisionCategorySchema.parse('FINANCIAL')).toBe('FINANCIAL')
      expect(() => decisionCategorySchema.parse('INVALID')).toThrow()
    })

    it('validates decision severities', () => {
      expect(decisionSeveritySchema.parse('CRITICAL')).toBe('CRITICAL')
      expect(() => decisionSeveritySchema.parse('INVALID')).toThrow()
    })

    it('validates decision statuses', () => {
      expect(decisionStatusSchema.parse('GENERATED')).toBe('GENERATED')
      expect(decisionStatusSchema.parse('PENDING_REVIEW')).toBe('PENDING_REVIEW')
      expect(() => decisionStatusSchema.parse('INVALID')).toThrow()
    })

    it('validates evidence refs', () => {
      const ref = { type: 'anomaly', ref_id: 'ANO-001', summary: 'Test' }
      expect(evidenceRefSchema.parse(ref)).toEqual(ref)
    })

    it('validates a full decision record', () => {
      const record = makeTestRecord()
      const result = decisionRecordSchema.parse(record)
      expect(result.decision_id).toBe(record.decision_id)
    })

    it('validates decision feedback', () => {
      const feedback = {
        decision_id: 'DEC-2025-0001',
        actor: 'admin',
        action: 'APPROVE',
        created_at: new Date().toISOString(),
      }
      expect(decisionFeedbackSchema.parse(feedback)).toEqual(feedback)
    })

    it('validates audit entries', () => {
      const entry = {
        decision_id: 'DEC-2025-0001',
        event_type: 'decision_generated',
        actor: 'system',
        timestamp: new Date().toISOString(),
      }
      expect(decisionAuditEntrySchema.parse(entry)).toEqual(entry)
    })
  })

  // ── Utils ─────────────────────────────────────────────────────────────

  describe('utils', () => {
    it('generates sequential decision IDs', () => {
      const id1 = generateDecisionId()
      const id2 = generateDecisionId()
      expect(id1).toMatch(/^DEC-\d{4}-0001$/)
      expect(id2).toMatch(/^DEC-\d{4}-0002$/)
    })

    it('resets counter', () => {
      generateDecisionId()
      resetDecisionCounter()
      const id = generateDecisionId()
      expect(id).toMatch(/-0001$/)
    })

    it('returns ISO timestamp', () => {
      const ts = nowISO()
      expect(new Date(ts).toISOString()).toBe(ts)
    })

    it('computes deterministic hash', () => {
      const hash1 = computeHash({ a: 1 })
      const hash2 = computeHash({ a: 1 })
      const hash3 = computeHash({ a: 2 })
      expect(hash1).toBe(hash2)
      expect(hash1).not.toBe(hash3)
    })
  })

  // ── Status transitions ────────────────────────────────────────────────

  describe('status transitions', () => {
    it('allows GENERATED → PENDING_REVIEW', () => {
      expect(isValidTransition('GENERATED', 'PENDING_REVIEW')).toBe(true)
    })

    it('allows PENDING_REVIEW → APPROVED', () => {
      expect(isValidTransition('PENDING_REVIEW', 'APPROVED')).toBe(true)
    })

    it('blocks CLOSED → GENERATED', () => {
      expect(isValidTransition('CLOSED', 'GENERATED')).toBe(false)
    })

    it('blocks EXECUTED → APPROVED', () => {
      expect(isValidTransition('EXECUTED', 'APPROVED')).toBe(false)
    })

    it('returns correct next valid statuses', () => {
      expect(nextValidStatuses('GENERATED')).toEqual(['PENDING_REVIEW', 'EXPIRED', 'CLOSED'])
      expect(nextValidStatuses('CLOSED')).toEqual([])
    })
  })

  // ── Rules ─────────────────────────────────────────────────────────────

  describe('rules', () => {
    it('grievance backlog rule generates decisions from grievance_spike anomalies', () => {
      const input = makeTestInput({
        anomalies: [makeTestAnomaly()],
      })
      const decisions = grievanceBacklogRule.evaluate(input)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].category).toBe('STAFFING')
      expect(decisions[0].severity).toBe('HIGH')
    })

    it('budget variance rule triggers on financial_irregularity', () => {
      const input = makeTestInput({
        anomalies: [makeTestAnomaly({ anomalyType: 'financial_irregularity', severity: 'critical' })],
      })
      const decisions = budgetVarianceRule.evaluate(input)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].category).toBe('FINANCIAL')
      expect(decisions[0].type).toBe('ESCALATION')
    })

    it('pricing anomaly rule triggers on pricing_outlier', () => {
      const input = makeTestInput({
        anomalies: [makeTestAnomaly({ anomalyType: 'pricing_outlier' })],
      })
      const decisions = pricingAnomalyRule.evaluate(input)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].category).toBe('FINANCIAL')
      expect(decisions[0].type).toBe('REVIEW_REQUEST')
    })

    it('partner performance rule triggers on partner_performance_drop', () => {
      const input = makeTestInput({
        anomalies: [makeTestAnomaly({ anomalyType: 'partner_performance_drop' })],
      })
      const decisions = partnerPerformanceRule.evaluate(input)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].category).toBe('PARTNER')
    })

    it('cross-app insight rule triggers on critical insights', () => {
      const input = makeTestInput({
        insights: [makeTestInsight()],
      })
      const decisions = crossAppInsightRule.evaluate(input)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].type).toBe('ESCALATION')
    })

    it('governance state rule triggers on threshold_breach signals', () => {
      const input = makeTestInput({
        signals: [makeTestSignal()],
      })
      const decisions = governanceStateRule.evaluate(input)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].category).toBe('GOVERNANCE')
    })

    it('deployment risk rule triggers on high-risk prod changes', () => {
      const input = makeTestInput({
        change_records: [{
          change_id: 'CHG-2026-0001',
          title: 'Deploy v3',
          description: 'Major deploy',
          service: 'web',
          environment: 'PROD',
          change_type: 'NORMAL',
          risk_level: 'HIGH',
          impact_summary: 'All users',
          requested_by: 'admin',
          approvers_required: ['admin'],
          approved_by: [],
          approval_status: 'PENDING',
          implementation_window_start: new Date().toISOString(),
          implementation_window_end: new Date().toISOString(),
          rollback_plan: 'Rollback',
          test_evidence_refs: [],
          linked_prs: [],
          linked_commits: [],
          status: 'APPROVED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        }],
      })
      const decisions = deploymentRiskRule.evaluate(input)
      expect(decisions).toHaveLength(1)
      expect(decisions[0].category).toBe('DEPLOYMENT')
    })

    it('ignores anomalies that do not match rule type', () => {
      const input = makeTestInput({
        anomalies: [makeTestAnomaly({ anomalyType: 'usage_anomaly' })],
      })
      expect(grievanceBacklogRule.evaluate(input)).toHaveLength(0)
      expect(budgetVarianceRule.evaluate(input)).toHaveLength(0)
      expect(pricingAnomalyRule.evaluate(input)).toHaveLength(0)
    })

    it('DEFAULT_RULES contains all 8 rules', () => {
      expect(DEFAULT_RULES).toHaveLength(8)
    })
  })

  // ── Engine ────────────────────────────────────────────────────────────

  describe('engine', () => {
    it('generates decisions from mixed input', () => {
      const input = makeTestInput({
        anomalies: [makeTestAnomaly(), makeTestAnomaly({ anomalyType: 'pricing_outlier' })],
        insights: [makeTestInsight()],
        signals: [makeTestSignal()],
      })
      const decisions = generateDecisions(input)
      expect(decisions.length).toBeGreaterThanOrEqual(4)
    })

    it('returns empty array for empty input', () => {
      const decisions = generateDecisions(makeTestInput())
      expect(decisions).toHaveLength(0)
    })

    it('summarises decisions correctly', () => {
      const records: DecisionRecord[] = [
        makeTestRecord({ severity: 'CRITICAL', status: 'GENERATED', category: 'STAFFING' }),
        makeTestRecord({ severity: 'HIGH', status: 'PENDING_REVIEW', category: 'FINANCIAL' }),
        makeTestRecord({ severity: 'LOW', status: 'CLOSED', category: 'STAFFING' }),
      ]
      const summary = summariseDecisions(records)
      expect(summary.total).toBe(3)
      expect(summary.pending_review).toBe(2) // GENERATED + PENDING_REVIEW
      expect(summary.critical_open).toBe(1)
      expect(summary.by_severity.CRITICAL).toBe(1)
      expect(summary.by_category.STAFFING).toBe(2)
    })

    it('does not count expired critical decisions as critical open', () => {
      const summary = summariseDecisions([
        makeTestRecord({ severity: 'CRITICAL', status: 'EXPIRED' }),
      ])

      expect(summary.critical_open).toBe(0)
    })
  })

  // ── Evidence ──────────────────────────────────────────────────────────

  describe('evidence', () => {
    it('builds evidence refs from anomalies', () => {
      const refs = evidenceFromAnomalies([makeTestAnomaly()])
      expect(refs).toHaveLength(1)
      expect(refs[0].type).toBe('anomaly')
    })

    it('builds evidence refs from insights', () => {
      const refs = evidenceFromInsights([makeTestInsight()])
      expect(refs).toHaveLength(1)
      expect(refs[0].type).toBe('insight')
    })

    it('builds evidence refs from signals', () => {
      const refs = evidenceFromSignals([makeTestSignal()])
      expect(refs).toHaveLength(1)
      expect(refs[0].type).toBe('metric')
    })

    it('builds combined evidence refs', () => {
      const refs = buildEvidenceRefs({
        anomalies: [makeTestAnomaly()],
        insights: [makeTestInsight()],
        signals: [makeTestSignal()],
      })
      expect(refs).toHaveLength(3)
    })

    it('builds evidence refs from change records', () => {
      const refs = _evidenceFromChanges([
        {
          change_id: 'CHG-2026-0002',
          title: 'Deploy worker',
          description: 'Routine release',
          service: 'worker',
          environment: 'STAGING',
          change_type: 'STANDARD',
          risk_level: 'LOW',
          impact_summary: 'Background job improvements',
          requested_by: 'ops',
          approvers_required: [],
          approved_by: [],
          approval_status: 'APPROVED',
          implementation_window_start: new Date().toISOString(),
          implementation_window_end: new Date().toISOString(),
          rollback_plan: 'Rollback image',
          test_evidence_refs: [],
          linked_prs: [],
          linked_commits: [],
          status: 'APPROVED',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        },
      ])

      expect(refs).toEqual([
        {
          type: 'change',
          ref_id: 'CHG-2026-0002',
          summary: 'STANDARD: Deploy worker',
        },
      ])
    })
  })

  // ── Policy ────────────────────────────────────────────────────────────

  describe('policy', () => {
    it('blocks execution for critical decisions', () => {
      const record = makeTestRecord({ severity: 'CRITICAL' })
      const ctx = evaluateDecisionPolicyContext(record)
      expect(ctx.execution_allowed).toBe(false)
      expect(ctx.reasons).toContain('Critical severity — escalation required before execution')
    })

    it('blocks execution in protected environment', () => {
      const record = makeTestRecord({
        environment_context: { environment: 'PRODUCTION', protected_environment: true },
      })
      const ctx = evaluateDecisionPolicyContext(record)
      expect(ctx.execution_allowed).toBe(false)
    })

    it('allows execution for non-critical unprotected decisions', () => {
      const record = makeTestRecord({
        severity: 'LOW',
        required_approvals: [],
        environment_context: { environment: 'LOCAL', protected_environment: false },
      })
      const ctx = evaluateDecisionPolicyContext(record)
      expect(ctx.execution_allowed).toBe(true)
    })

    it('classifies decisions into executable and blocked', () => {
      const records = [
        makeTestRecord({
          severity: 'LOW',
          required_approvals: [],
          environment_context: { environment: 'LOCAL', protected_environment: false },
        }),
        makeTestRecord({ severity: 'CRITICAL' }),
      ]
      const { executable, blocked } = classifyDecisions(records)
      expect(executable).toHaveLength(1)
      expect(blocked).toHaveLength(1)
    })

    it('blocks execution when approvals are pending or the decision has expired', () => {
      const pending = makeTestRecord({
        severity: 'LOW',
        required_approvals: ['director'],
        reviewed_by: [],
        environment_context: { environment: 'LOCAL', protected_environment: false },
      })
      const expired = makeTestRecord({
        severity: 'LOW',
        required_approvals: [],
        environment_context: { environment: 'LOCAL', protected_environment: false },
        expires_at: '2020-01-01T00:00:00.000Z',
      })

      expect(evaluateDecisionPolicyContext(pending).reasons).toContain('Pending approvals: director')
      expect(evaluateDecisionPolicyContext(expired).reasons).toContain('Decision has expired')
      expect(_filterExecutableDecisions([pending, expired])).toEqual([])
    })
  })

  // ── Ranking ───────────────────────────────────────────────────────────

  describe('ranking', () => {
    it('ranks critical above low severity', () => {
      const critical = makeTestRecord({ severity: 'CRITICAL' })
      const low = makeTestRecord({ severity: 'LOW' })
      const ranked = rankDecisions([low, critical])
      expect(ranked[0].severity).toBe('CRITICAL')
    })

    it('topDecisions returns n results', () => {
      const records = Array.from({ length: 5 }, (_, i) =>
        makeTestRecord({ title: `Decision ${i}` }),
      )
      expect(topDecisions(records, 3)).toHaveLength(3)
    })

    it('computes priority score', () => {
      const record = makeTestRecord({ severity: 'HIGH', confidence_score: 0.9 })
      const score = computePriorityScore(record)
      expect(score).toBeGreaterThan(0)
    })

    it('prefers recent decisions over stale ones when other factors match', () => {
      const recent = makeTestRecord({ generated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString() })
      const midAged = makeTestRecord({ generated_at: new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString() })
      const stale = makeTestRecord({ generated_at: new Date(Date.now() - 96 * 60 * 60 * 1000).toISOString() })

      expect(computePriorityScore(recent)).toBeGreaterThan(computePriorityScore(midAged))
      expect(computePriorityScore(midAged)).toBeGreaterThan(computePriorityScore(stale))
    })
  })

  // ── Store ─────────────────────────────────────────────────────────────

  describe('store', () => {
    it('saves and loads decision records', () => {
      const record = makeTestRecord()
      saveDecisionRecord(record)
      const loaded = loadDecisionRecord(record.decision_id)
      expect(loaded).not.toBeNull()
      expect(loaded!.decision_id).toBe(record.decision_id)
    })

    it('loads all decisions sorted by date', () => {
      const r1 = makeTestRecord({ generated_at: '2025-01-01T00:00:00.000Z' })
      const r2 = makeTestRecord({ generated_at: '2025-06-01T00:00:00.000Z' })
      saveDecisionRecord(r1)
      saveDecisionRecord(r2)
      const all = loadAllDecisions()
      expect(all).toHaveLength(2)
      expect(all[0].generated_at).toBe('2025-06-01T00:00:00.000Z')
    })

    it('lists open decisions (excludes CLOSED/EXECUTED/EXPIRED/REJECTED)', () => {
      saveDecisionRecord(makeTestRecord({ status: 'GENERATED' }))
      saveDecisionRecord(makeTestRecord({ status: 'CLOSED' }))
      saveDecisionRecord(makeTestRecord({ status: 'PENDING_REVIEW' }))
      const open = listOpenDecisions()
      expect(open).toHaveLength(2)
    })

    it('lists decisions by org', () => {
      saveDecisionRecord(makeTestRecord({ org_id: 'org-a' }))
      saveDecisionRecord(makeTestRecord({ org_id: 'org-b' }))
      expect(listDecisionsByOrg('org-a')).toHaveLength(1)
    })

    it('updates decision status with valid transition', () => {
      const record = makeTestRecord({ status: 'GENERATED' })
      saveDecisionRecord(record)
      const updated = updateDecisionStatus(record.decision_id, 'PENDING_REVIEW', 'admin', 'Reviewing')
      expect(updated).not.toBeNull()
      expect(updated!.status).toBe('PENDING_REVIEW')
    })

    it('rejects invalid status transition', () => {
      const record = makeTestRecord({ status: 'CLOSED' })
      saveDecisionRecord(record)
      const updated = updateDecisionStatus(record.decision_id, 'APPROVED')
      expect(updated).toBeNull()
    })

    it('appends review to decision', () => {
      const record = makeTestRecord()
      saveDecisionRecord(record)
      const updated = appendDecisionReview(record.decision_id, 'reviewer-1', 'Looks good')
      expect(updated).not.toBeNull()
      expect(updated!.reviewed_by).toContain('reviewer-1')
      expect(updated!.review_notes).toContain('Looks good')
    })

    it('returns null or empty results when records do not exist', () => {
      expect(loadDecisionRecord('DEC-2099-9999')).toBeNull()
      expect(updateDecisionStatus('DEC-2099-9999', 'APPROVED')).toBeNull()
      expect(appendDecisionReview('DEC-2099-9999', 'reviewer', 'missing')).toBeNull()
      expect(loadAllDecisions()).toEqual([])
    })

    it('saves and loads decision feedback in chronological order', () => {
      saveDecisionFeedback({
        decision_id: 'DEC-2025-0001',
        actor: 'admin',
        action: 'COMMENT',
        note: 'First',
        created_at: '2026-01-01T00:00:00.000Z',
      })
      saveDecisionFeedback({
        decision_id: 'DEC-2025-0001',
        actor: 'admin',
        action: 'APPROVE',
        note: 'Second',
        created_at: '2026-01-02T00:00:00.000Z',
      })

      const feedback = loadDecisionFeedback('DEC-2025-0001')

      expect(feedback).toHaveLength(2)
      expect(feedback[0].note).toBe('First')
      expect(feedback[1].note).toBe('Second')
    })
  })

  // ── Feedback ──────────────────────────────────────────────────────────

  describe('feedback', () => {
    it('records feedback and updates decision status', () => {
      const record = makeTestRecord({ status: 'PENDING_REVIEW' })
      saveDecisionRecord(record)
      const { feedback, decision } = recordDecisionFeedback(
        record.decision_id,
        'admin',
        'APPROVE',
        'Approved after review',
      )
      expect(feedback.action).toBe('APPROVE')
      expect(decision).not.toBeNull()
      expect(decision!.status).toBe('APPROVED')
    })

    it('records comment without status change', () => {
      const record = makeTestRecord({ status: 'PENDING_REVIEW' })
      saveDecisionRecord(record)
      const { decision } = recordDecisionFeedback(
        record.decision_id,
        'admin',
        'COMMENT',
        'Need more info',
      )
      expect(decision).not.toBeNull()
      expect(decision!.status).toBe('PENDING_REVIEW')
    })
  })

  // ── Audit ─────────────────────────────────────────────────────────────

  describe('audit', () => {
    it('creates audit entries', () => {
      const entry = createAuditEntry('DEC-2025-0001', 'decision_generated', 'system')
      expect(entry.decision_id).toBe('DEC-2025-0001')
      expect(entry.event_type).toBe('decision_generated')
    })

    it('saves and loads audit trail', () => {
      emitAuditEvent('DEC-2025-0001', 'decision_generated', 'system', 'Generated')
      emitAuditEvent('DEC-2025-0001', 'decision_approved', 'admin', 'Approved')
      const trail = loadAuditTrail('DEC-2025-0001')
      expect(trail).toHaveLength(2)
    })
  })

  // ── NL decision support ───────────────────────────────────────────────

  describe('nl', () => {
    it('classifies open queries', () => {
      expect(classifyDecisionIntent('show open decisions')).toBe('list_open')
    })

    it('classifies critical queries', () => {
      expect(classifyDecisionIntent('any critical decisions?')).toBe('list_critical')
    })

    it('classifies summary queries', () => {
      expect(classifyDecisionIntent('give me a summary')).toBe('summary')
    })

    it('classifies count queries', () => {
      expect(classifyDecisionIntent('how many decisions')).toBe('count')
    })

    it('classifies detail queries', () => {
      expect(classifyDecisionIntent('show DEC-2025-0001')).toBe('detail')
    })

    it('executes summary query', () => {
      saveDecisionRecord(makeTestRecord())
      const result = executeDecisionQuery('summary', 'summary')
      expect(result.answer).toContain('1 total')
      expect(result.summary).toBeDefined()
    })

    it('executes open query', () => {
      saveDecisionRecord(makeTestRecord({ status: 'GENERATED' }))
      saveDecisionRecord(makeTestRecord({ status: 'CLOSED' }))
      const result = executeDecisionQuery('list_open', 'open decisions')
      expect(result.answer).toContain('1 open')
    })

    it('classifies unknown queries', () => {
      expect(classifyDecisionIntent('hello there')).toBe('unknown')
    })

    it('executes critical, count, detail, and fallback query branches', () => {
      const critical = makeTestRecord({
        decision_id: 'DEC-2026-0001',
        severity: 'CRITICAL',
        status: 'GENERATED',
        title: 'Critical decision',
      })
      const closed = makeTestRecord({
        decision_id: 'DEC-2026-0002',
        severity: 'CRITICAL',
        status: 'CLOSED',
        title: 'Closed decision',
      })

      saveDecisionRecord(critical)
      saveDecisionRecord(closed)

      const criticalResult = executeDecisionQuery('list_critical', 'critical decisions')
      const countResult = executeDecisionQuery('count', 'count decisions')
      const detailHit = executeDecisionQuery('detail', 'show DEC-2026-0001')
      const detailMiss = executeDecisionQuery('detail', 'show DEC-2026-9999')
      const detailPrompt = executeDecisionQuery('detail', 'show me the latest decision')
      const fallback = executeDecisionQuery('unknown', 'help')

      expect(criticalResult.records).toHaveLength(1)
      expect(countResult.answer).toContain('2 decision(s) in total')
      expect(detailHit.answer).toContain('Found decision DEC-2026-0001')
      expect(detailMiss.answer).toContain('No decision found with ID DEC-2026-9999')
      expect(detailPrompt.answer).toContain('Please specify a decision ID')
      expect(fallback.answer).toContain('I can help with decision queries')
    })
  })

  // ── Export ────────────────────────────────────────────────────────────

  describe('export', () => {
    it('creates decision export pack with hash', () => {
      const record = makeTestRecord()
      saveDecisionRecord(record)
      const pack = createDecisionExportPack(record)
      expect(pack.decision_record.decision_id).toBe(record.decision_id)
      expect(pack.output_hash).toBeTruthy()
      expect(pack.exported_at).toBeTruthy()
    })
  })

  describe('barrel exports', () => {
    it('exposes public runtime exports from the package entrypoint', () => {
      expect(decisionEngineBarrel.ENGINE_VERSION).toBe(ENGINE_VERSION)
      expect(decisionEngineBarrel.generateDecisions).toBe(generateDecisions)
      expect(decisionEngineBarrel.classifyDecisionIntent).toBe(classifyDecisionIntent)
    })
  })
})
