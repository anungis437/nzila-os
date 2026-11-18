import { describe, expect, it } from 'vitest'
import {
  summarizeRuntimeSignals, type CiRunRecord, type DoraSnapshot,
} from '../../scripts/sre/generate-executive-dashboard'

const now = new Date('2026-11-17T21:00:00.000Z')
const currentRun: CiRunRecord = {
  repository: 'synthetic/test', runId: '123', runAttempt: 1,
  completedAt: '2026-11-17T20:00:00.000Z', conclusion: 'success', bootstrapEvidence: false,
}

describe('SRE runtime evidence separation', () => {
  it('retains current CI success as CI evidence without inventing deployment success or rollbacks', () => {
    const result = summarizeRuntimeSignals([
      currentRun, { ...currentRun }, { ...currentRun, runId: '124', conclusion: 'failure' },
    ], {}, now)
    expect(result.ciWorkflowCount).toBe(2)
    expect(result.ciWorkflowSuccessRatePct).toBe(50)
    expect(result.ciFailedWorkflowCount).toBe(1)
    expect(result.deploySuccessRatePct).toBeNull()
    expect(result.rollbackCount).toBeNull()
  })

  it('does not promote historical, bootstrap, malformed, future or contradictory CI records into current signals', () => {
    const result = summarizeRuntimeSignals([
      { ...currentRun, completedAt: '2026-05-01T00:00:00Z' },
      { ...currentRun, bootstrapEvidence: true },
      { ...currentRun, completedAt: 'invalid' },
      { ...currentRun, completedAt: '2026-11-18T00:00:00Z' },
      { ...currentRun, runAttempt: 0 },
      { ...currentRun, runId: null },
      currentRun, { ...currentRun, conclusion: 'failure' },
    ], {}, now)
    expect(result.ciWorkflowCount).toBe(0)
    expect(result.ciWorkflowSuccessRatePct).toBeNull()
    expect(result.contradictoryCiRecords).toBe(1)
  })

  it('does not turn vulnerability-remediation zeroes into runtime incident zeroes', () => {
    const snapshot: DoraSnapshot = {
      collected_at: '2026-11-17T20:00:00Z',
      metrics: {
        mttr: { value: 0, source: 'ops/compliance/mttr-dashboard.json', note: 'Vulnerability remediation fallback' },
        incidents_last_30d: { value: 0, source: 'ops/compliance/mttr-dashboard.json' },
      },
    }
    const result = summarizeRuntimeSignals([], snapshot, now)
    expect(result.mttrHours).toBeNull()
    expect(result.incidentsLast30Days).toBeNull()
  })

  it('retains fresh runtime incident feed metrics with the explicit source and time window', () => {
    const snapshot: DoraSnapshot = {
      collected_at: '2026-11-17T20:00:00Z',
      metrics: {
        mttr: { value: 4.5, source: 'reports/runtime/incident-events.jsonl', note: null },
        incidents_last_30d: { value: 2, source: 'reports/runtime/incident-events.jsonl' },
      },
    }
    const result = summarizeRuntimeSignals([], snapshot, now)
    expect(result.mttrHours).toBe(4.5)
    expect(result.incidentsLast30Days).toBe(2)
    expect(result.windowDays).toBe(30)
    expect(result.incidentSnapshotAt).toBe(snapshot.collected_at)
    expect(summarizeRuntimeSignals([], { ...snapshot, collected_at: '2026-08-25T00:00:00Z' }, now).mttrHours).toBeNull()
  })

  it('keeps MTTR unknown when the feed has no resolved incidents', () => {
    const result = summarizeRuntimeSignals([], {
      collected_at: '2026-11-17T20:00:00Z',
      metrics: {
        mttr: { value: 0, source: 'ops/outputs/incident-events.jsonl', note: 'No resolved incidents in window' },
        incidents_last_30d: { value: 3, source: 'ops/outputs/incident-events.jsonl' },
      },
    }, now)
    expect(result.mttrHours).toBeNull()
    expect(result.incidentsLast30Days).toBe(3)
  })
})
