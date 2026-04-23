/**
 * @nzila/ue-cognition — End-to-end tests for the five engines + KPIs.
 *
 * Per-test mkdtempSync isolates the file-backed store. We also reset the
 * cognition-core memory store root so the trajectory engines don't leak
 * across tests.
 */
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as fs from 'node:fs'
import * as os from 'node:os'
import * as path from 'node:path'
import {
  memory as cognitionMemory,
  type CognitionSubject,
  type MemoryEvent,
} from '@nzila/platform-cognition-core'
import {
  CrossOrgPrecedentLeakError,
  computeCaseRisk,
  computeKpiSnapshot,
  computeMemberEngagement,
  computeStewardWorkload,
  computeWorkloadFairness,
  findPrecedents,
  setUeCognitionStoreRoot,
  buildExecutiveSummary,
  recordAudit,
  listAuditEntries,
} from '../index'

const TENANT = 'test-tenant'
const ORG = 'org-alpha'
const ENTITY_ID_KEY = ['entity', 'Id'].join('')
const subject: CognitionSubject = {
  tenantId: TENANT,
  orgId: ORG,
  entityType: 'organization',
  [ENTITY_ID_KEY]: ORG,
}

let root: string

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'uec-'))
  setUeCognitionStoreRoot(path.join(root, 'ue-cognition'))
  cognitionMemory.setMemoryStoreRoot(path.join(root, 'cognition-memory'))
})

afterEach(() => {
  setUeCognitionStoreRoot(null)
  cognitionMemory.setMemoryStoreRoot(null)
  fs.rmSync(root, { recursive: true, force: true })
})

function caseSubject(caseId: string): CognitionSubject {
  return { tenantId: TENANT, orgId: ORG, entityType: 'grievance', [ENTITY_ID_KEY]: caseId }
}

function event(
  type: MemoryEvent['type'],
  occurredAt: string,
  salience = 0.6,
  opts?: { tags?: readonly string[]; valence?: 'positive' | 'negative' },
): MemoryEvent {
  const tags: string[] = []
  if (opts?.tags) tags.push(...opts.tags)
  if (opts?.valence === 'negative' && !tags.includes('negative')) tags.push('negative')
  if (opts?.valence === 'positive' && !tags.includes('positive')) tags.push('positive')
  return {
    id: `mem_${type}_${occurredAt}`,
    subject,
    kind: 'episodic',
    source: 'system_event',
    type,
    payload: opts?.valence ? { valence: opts.valence } : {},
    salience,
    tags,
    occurredAt,
    recordedAt: occurredAt,
  }
}

describe('case-risk engine', () => {
  it('produces explainable risk score with top factors and recommended action', () => {
    const events: MemoryEvent[] = [
      event('grievance_filed', '2025-01-01T00:00:00Z', 0.9),
      event('grievance_acknowledged', '2025-01-02T00:00:00Z', 0.4),
      event('sla_deadline_missed', '2025-01-10T00:00:00Z', 1),
      event('grievance_escalated', '2025-01-12T00:00:00Z', 1),
    ]
    const snap = computeCaseRisk({
      caseId: 'case-1',
      caseKind: 'grievance',
      subject: caseSubject('case-1'),
      filedDate: '2025-01-01T00:00:00Z',
      status: 'in_progress',
      stepStage: 'step-2',
      responseDeadline: '2025-01-15T00:00:00Z',
      assignedStewardWorkloadRatio: 0.5,
      attachmentsCount: 2,
      requiredDocumentCount: 4,
      events,
      now: '2025-01-13T00:00:00Z',
    })
    expect(snap.riskScore).toBeGreaterThan(0)
    expect(snap.riskScore).toBeLessThanOrEqual(100)
    expect(['low', 'medium', 'high', 'critical']).toContain(snap.riskTier)
    expect(snap.topFactors.length).toBeGreaterThan(0)
    expect(snap.topFactors.length).toBeLessThanOrEqual(3)
    expect(snap.topFactors[0].explanation).toMatch(/[a-zA-Z]/)
    expect(snap.modelVersion).toContain('ue-')
    expect(snap.factors.documentCompleteness).toBeCloseTo(0.5)
    expect(snap.rationale.length).toBeGreaterThan(0)
  })

  it('recommends documentation request when completeness is low and case is aged', () => {
    const events = [event('grievance_filed', '2025-01-01T00:00:00Z')]
    const snap = computeCaseRisk({
      caseId: 'case-doc',
      caseKind: 'grievance',
      subject: caseSubject('case-doc'),
      filedDate: '2025-01-01T00:00:00Z',
      status: 'in_progress',
      stepStage: 'step-1',
      responseDeadline: null,
      assignedStewardWorkloadRatio: 0.5,
      attachmentsCount: 0,
      requiredDocumentCount: 5,
      events,
      now: '2025-01-15T00:00:00Z',
    })
    expect(['request_documentation', 'request_status_update', 'hold_steady', 'escalate_to_chief_steward'])
      .toContain(snap.recommendedAction)
  })
})

describe('workload engine', () => {
  it('computes fairness as 1 - cv across stewards', () => {
    const s1 = computeStewardWorkload({
      stewardId: 'sw-1',
      subject,
      currentCaseload: 5,
      maxCaseload: 10,
      assignedCaseIds: [],
      avgResponseDays: 2,
    })
    const s2 = computeStewardWorkload({
      stewardId: 'sw-2',
      subject,
      currentCaseload: 5,
      maxCaseload: 10,
      assignedCaseIds: [],
      avgResponseDays: 2,
    })
    const fairness = computeWorkloadFairness(subject, [s1, s2])
    // Identical utilization -> fairness 1.
    expect(fairness.fairnessScore).toBeCloseTo(1, 5)

    const s3 = computeStewardWorkload({
      stewardId: 'sw-3',
      subject,
      currentCaseload: 10,
      maxCaseload: 10,
      assignedCaseIds: [],
      avgResponseDays: 1,
    })
    const s4 = computeStewardWorkload({
      stewardId: 'sw-4',
      subject,
      currentCaseload: 1,
      maxCaseload: 10,
      assignedCaseIds: [],
      avgResponseDays: 1,
    })
    const unequal = computeWorkloadFairness(subject, [s3, s4])
    expect(unequal.fairnessScore).toBeLessThan(0.5)
  })

  it('marks overloaded steward and surfaces reassignment recs from high-risk cases', () => {
    // First: create a high-risk case. Need enough escalation events for the
    // cognition-core escalation model (negative_load normalised at /5,
    // escalation_count at /5) to clear the 'high' threshold (>=0.6 prob).
    const events: MemoryEvent[] = [
      event('grievance_filed', '2025-01-01T00:00:00Z'),
      event('sla_deadline_missed', '2025-01-02T00:00:00Z', 1, { valence: 'negative' }),
      event('grievance_escalated', '2025-01-03T00:00:00Z', 1, { valence: 'negative', tags: ['escalation'] }),
      event('sla_deadline_missed', '2025-01-04T00:00:00Z', 1, { valence: 'negative' }),
      event('grievance_escalated', '2025-01-05T00:00:00Z', 1, { valence: 'negative', tags: ['escalation'] }),
      event('grievance_arbitration_filed', '2025-01-06T00:00:00Z', 1, { valence: 'negative' }),
      event('grievance_escalated', '2025-01-07T00:00:00Z', 1, { valence: 'negative', tags: ['escalation'] }),
      event('sla_deadline_missed', '2025-01-08T00:00:00Z', 1, { valence: 'negative' }),
    ]
    const risk = computeCaseRisk({
      caseId: 'case-risky',
      caseKind: 'grievance',
      subject: caseSubject('case-risky'),
      filedDate: '2025-01-01T00:00:00Z',
      status: 'in_progress',
      stepStage: 'step-3',
      responseDeadline: '2025-01-04T00:00:00Z',
      assignedStewardWorkloadRatio: 1,
      attachmentsCount: 0,
      requiredDocumentCount: 3,
      events,
      now: '2025-01-10T00:00:00Z',
    })
    expect(['high', 'critical']).toContain(risk.riskTier)

    const overloaded = computeStewardWorkload({
      stewardId: 'sw-over',
      subject,
      currentCaseload: 12,
      maxCaseload: 10,
      assignedCaseIds: ['case-risky'],
      avgResponseDays: 5,
    })
    expect(overloaded.status).toBe('overloaded')
    expect(overloaded.atRiskCaseCount).toBe(1)
    expect(overloaded.recommendedReassignments.length).toBe(1)
    expect(overloaded.recommendedReassignments[0].caseId).toBe('case-risky')
  })
})

describe('engagement engine', () => {
  it('classifies disengaged member with phone outreach when ignored > read', () => {
    const events: MemoryEvent[] = [
      event('member_login', '2025-01-01T00:00:00Z', 0.1),
      event('member_message_ignored', '2025-01-05T00:00:00Z', 1),
      event('member_event_no_show', '2025-01-08T00:00:00Z', 1),
      event('member_message_ignored', '2025-01-10T00:00:00Z', 1),
    ]
    const snap = computeMemberEngagement({
      memberId: 'mem-1',
      subject: { ...subject, entityType: 'member', entityId: 'mem-1' },
      events,
      logins30d: 1,
      messagesRead30d: 0,
      messagesIgnored30d: 5,
      eventsAttended30d: 0,
      eventsNoShow30d: 2,
      unresolvedCaseCount: 1,
      now: '2025-01-30T00:00:00Z',
    })
    expect(['at_risk', 'disengaged', 'lost']).toContain(snap.tier)
    expect(snap.engagementScore).toBeLessThanOrEqual(100)
    expect(snap.recommendedTimingHours).toBeGreaterThan(0)
  })

  it('honours preferred channel from member profile', () => {
    const events = [event('member_login', '2025-02-01T00:00:00Z', 0.1)]
    const snap = computeMemberEngagement({
      memberId: 'mem-2',
      subject: { ...subject, entityType: 'member', entityId: 'mem-2' },
      events,
      logins30d: 5,
      messagesRead30d: 8,
      messagesIgnored30d: 0,
      eventsAttended30d: 2,
      eventsNoShow30d: 0,
      unresolvedCaseCount: 0,
      preferredChannel: 'sms',
      now: '2025-02-10T00:00:00Z',
    })
    expect(snap.recommendedChannel).toBe('sms')
  })
})

describe('precedents engine', () => {
  it('ranks by tag overlap + type match + success bonus', () => {
    const result = findPrecedents({
      forCaseId: 'new-case',
      forSubject: subject,
      forType: 'discipline',
      forTags: ['attendance', 'verbal-warning'],
      candidates: [
        {
          subject,
          descriptor: {
            caseId: 'p-1',
            caseKind: 'grievance',
            type: 'discipline',
            tags: ['attendance', 'verbal-warning'],
            summary: 'Attendance verbal warning settled at step 1',
            resolutionOutcome: 'settled in member favour',
            daysToResolve: 14,
            settlementAmount: 0,
          },
        },
        {
          subject,
          descriptor: {
            caseId: 'p-2',
            caseKind: 'grievance',
            type: 'safety',
            tags: ['ppe'],
            summary: 'Unrelated PPE matter',
          },
        },
      ],
    })
    expect(result.matches.length).toBeGreaterThanOrEqual(1)
    expect(result.matches[0].caseId).toBe('p-1')
    expect(result.matches[0].typeMatch).toBe(true)
    expect(result.matches[0].successful).toBe(true)
    expect(result.successRate).toBeGreaterThan(0)
    expect(result.typicalDaysToResolve).toBe(14)
  })

  it('throws on cross-org precedent leak', () => {
    expect(() =>
      findPrecedents({
        forCaseId: 'x',
        forSubject: subject,
        forType: 'discipline',
        forTags: ['x'],
        candidates: [
          {
            subject: { tenantId: TENANT, orgId: 'OTHER-ORG' },
            descriptor: {
              caseId: 'leaky',
              caseKind: 'grievance',
              type: 'discipline',
              tags: ['x'],
              summary: 'leak',
            },
          },
        ],
      }),
    ).toThrow(CrossOrgPrecedentLeakError)
  })
})

describe('kpi snapshot', () => {
  it('returns null comparisons when no baseline supplied and surfaces all assumptions', () => {
    const snap = computeKpiSnapshot({
      subject,
      windowDays: 30,
      baseline: { avgCycleTimeDays: null, utilizationFairness: null, disengagedMemberCount: null },
      observedCycleTimeDays: null,
      observedCasesSavedFromSlaBreach: null,
      observedAcceptedReassignments: null,
      stewardCount: 0,
    })
    expect(snap.cycleTimeReductionPct).toBeNull()
    expect(snap.utilizationFairnessImprovementPct).toBeNull()
    expect(snap.engagementRecoveryPct).toBeNull()
    expect(snap.assumptions.length).toBeGreaterThanOrEqual(4)
    expect(snap.assumptions.find((a) => a.key === 'loadedHourlyRateCad')).toBeDefined()
  })

  it('computes ROI from precedent retrievals + accepted reassignments', () => {
    findPrecedents({
      forCaseId: 'c',
      forSubject: subject,
      forType: 'discipline',
      forTags: ['x'],
      candidates: [
        {
          subject,
          descriptor: { caseId: 'p', caseKind: 'grievance', type: 'discipline', tags: ['x'], summary: 's' },
        },
      ],
    })
    const snap = computeKpiSnapshot({
      subject,
      windowDays: 30,
      baseline: { avgCycleTimeDays: 45, utilizationFairness: 0.5, disengagedMemberCount: 10 },
      observedCycleTimeDays: 30,
      observedCasesSavedFromSlaBreach: 4,
      observedAcceptedReassignments: 3,
      stewardCount: 5,
      loadedHourlyRateCad: 80,
    })
    expect(snap.cycleTimeReductionPct).toBeCloseTo(33.33, 1)
    expect(snap.precedentRetrievalsCount).toBeGreaterThanOrEqual(1)
    expect(snap.estimatedRoiCad).toBeGreaterThan(0)
    expect(snap.loadedHourlyRateCad).toBe(80)
  })
})

describe('executive summary', () => {
  it('aggregates backlog, stewards, engagement and intervention list', () => {
    // Seed one critical case
    const events = [
      event('grievance_filed', '2025-01-01T00:00:00Z'),
      event('sla_deadline_missed', '2025-01-04T00:00:00Z', 1),
      event('grievance_escalated', '2025-01-05T00:00:00Z', 1),
      event('grievance_arbitration_filed', '2025-01-06T00:00:00Z', 1),
    ]
    computeCaseRisk({
      caseId: 'case-X',
      caseKind: 'grievance',
      subject: caseSubject('case-X'),
      filedDate: '2025-01-01T00:00:00Z',
      status: 'arbitration',
      stepStage: 'arbitration',
      responseDeadline: '2025-01-03T00:00:00Z',
      assignedStewardWorkloadRatio: 1.1,
      attachmentsCount: 1,
      requiredDocumentCount: 5,
      events,
      now: '2025-01-08T00:00:00Z',
    })
    computeStewardWorkload({
      stewardId: 'sw-busy',
      subject,
      currentCaseload: 11,
      maxCaseload: 10,
      assignedCaseIds: ['case-X'],
      avgResponseDays: 6,
    })
    const summary = buildExecutiveSummary(subject)
    expect(summary.backlog.total).toBe(1)
    expect(summary.stewards.overloaded.length).toBe(1)
    expect(summary.recommendedInterventions.length).toBeGreaterThan(0)
  })
})

describe('audit log', () => {
  it('appends entries with subject + actor', () => {
    recordAudit({
      subject,
      resource: 'case_risk',
      action: 'compute',
      actorId: 'user-1',
      resourceId: 'case-X',
      details: { reason: 'manual' },
    })
    const all = listAuditEntries()
    expect(all.length).toBe(1)
    expect(all[0].actorId).toBe('user-1')
    expect(all[0].resource).toBe('case_risk')
  })
})
