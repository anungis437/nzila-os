import { describe, it, expect } from 'vitest'
import { collectAIEvalEvidence, type AIEvalRun } from '../ai-evals'
import { collectIncidentSimEvidence, type IncidentSimRecord } from '../incident-sims'
import { collectMLDriftEvidence, type ModelDriftRecord } from '../ml-drift'
import { collectStripeCloseEvidence } from '../stripe-close'
import { collectYearEndEvidence } from '../year-end'
import { collectSchemaEvidence } from '../schema'

// ── ai-evals ──────────────────────────────────────────────────────────────

describe('collectAIEvalEvidence', () => {
  const passingRun: AIEvalRun = {
    evalName: 'intent-classification',
    model: 'gpt-4o',
    runAt: '2026-06-01T00:00:00Z',
    sampleCount: 100,
    passCount: 95,
    failCount: 5,
    scorecard: { accuracy: 0.95 },
  }

  it('returns one artifact of type ai-eval-results', () => {
    const arts = collectAIEvalEvidence({ periodLabel: 'Q2-2026', evalRuns: [passingRun] })
    expect(arts).toHaveLength(1)
    expect(arts[0]!.type).toBe('ai-eval-results')
  })

  it('marks passed=true when overall pass rate >= threshold', () => {
    const arts = collectAIEvalEvidence({ periodLabel: 'Q2', evalRuns: [passingRun] })
    expect(arts[0]!.passed).toBe(true)
  })

  it('marks passed=false when overall pass rate < threshold', () => {
    const failRun: AIEvalRun = { ...passingRun, passCount: 50 }
    const arts = collectAIEvalEvidence({ periodLabel: 'Q2', evalRuns: [failRun] })
    expect(arts[0]!.passed).toBe(false)
  })

  it('respects custom minPassRate', () => {
    const arts = collectAIEvalEvidence({
      periodLabel: 'Q2',
      evalRuns: [{ ...passingRun, passCount: 80 }],
      minPassRate: 0.8,
    })
    expect(arts[0]!.passed).toBe(true)
  })

  it('handles empty eval runs', () => {
    const arts = collectAIEvalEvidence({ periodLabel: 'Q2', evalRuns: [] })
    expect(arts[0]!.overallPassRate).toBe(0)
  })
})

// ── incident-sims ─────────────────────────────────────────────────────────

describe('collectIncidentSimEvidence', () => {
  const sim: IncidentSimRecord = {
    simulationId: 'sim-1',
    scenarioName: 'DB failover',
    conductedAt: '2026-06-01',
    participantCount: 5,
    rtoAchievedMinutes: 30,
    rpoAchievedMinutes: 10,
    passedGates: ['failover', 'restore'],
    failedGates: [],
    remediationItems: [],
    facilitator: 'ops-lead',
  }

  it('returns an incident-simulation-summary artifact', () => {
    const arts = collectIncidentSimEvidence({ periodLabel: 'Q2', simRecords: [sim] })
    expect(arts[0]!.type).toBe('incident-simulation-summary')
    expect(arts[0]!.simulationCount).toBe(1)
  })

  it('passes when all RTO/RPO within targets', () => {
    const arts = collectIncidentSimEvidence({ periodLabel: 'Q2', simRecords: [sim] })
    const incidentSummary = arts[0] as unknown as { rto: { allPassed: boolean }; rpo: { allPassed: boolean } }
    expect(incidentSummary.rto.allPassed).toBe(true)
    expect(incidentSummary.rpo.allPassed).toBe(true)
  })

  it('fails when RTO exceeds target', () => {
    const slow = { ...sim, rtoAchievedMinutes: 300 }
    const arts = collectIncidentSimEvidence({ periodLabel: 'Q2', simRecords: [slow] })
    const incidentSummary = arts[0] as unknown as { rto: { allPassed: boolean } }
    expect(incidentSummary.rto.allPassed).toBe(false)
  })

  it('handles empty simRecords', () => {
    const arts = collectIncidentSimEvidence({ periodLabel: 'Q2', simRecords: [] })
    expect(arts[0]!.simulationCount).toBe(0)
  })
})

// ── ml-drift ──────────────────────────────────────────────────────────────

describe('collectMLDriftEvidence', () => {
  const clean: ModelDriftRecord = {
    modelName: 'risk-scorer',
    modelVersion: '1.2',
    evaluatedAt: '2026-06-01',
    psi: 0.05,
    driftDetected: false,
    retrainingRequired: false,
  }

  it('passes when no drift detected', () => {
    const arts = collectMLDriftEvidence({ periodLabel: 'Q2', models: [clean] })
    expect(arts[0]!.passed).toBe(true)
    expect(arts[0]!.driftedModelCount).toBe(0)
  })

  it('fails when drift detected', () => {
    const drifted = { ...clean, driftDetected: true, psi: 0.35 }
    const arts = collectMLDriftEvidence({ periodLabel: 'Q2', models: [drifted] })
    expect(arts[0]!.passed).toBe(false)
    expect(arts[0]!.driftedModelCount).toBe(1)
  })

  it('tracks retraining required count', () => {
    const needsRetrain = { ...clean, retrainingRequired: true }
    const arts = collectMLDriftEvidence({ periodLabel: 'Q2', models: [needsRetrain] })
    expect(arts[0]!.retrainingRequiredCount).toBe(1)
  })

  it('reports maxPsi', () => {
    const arts = collectMLDriftEvidence({ periodLabel: 'Q2', models: [clean, { ...clean, psi: 0.22 }] })
    expect(arts[0]!.maxPsi).toBe(0.22)
  })
})

// ── stripe-close ──────────────────────────────────────────────────────────

describe('collectStripeCloseEvidence', () => {
  it('reconciles when totals match within tolerance', () => {
    const arts = collectStripeCloseEvidence({
      periodLabel: 'Jan-2026',
      month: '2026-01',
      stripePayoutTotal: 10000,
      internalCommissionTotal: 10050,
      refundCount: 2,
      disputeCount: 0,
    })
    expect(arts[0]!.type).toBe('stripe-month-close')
    const stripeSummary = arts[0] as unknown as { reconciled: boolean }
    expect(stripeSummary.reconciled).toBe(true)
    expect(arts[0]!.passed).toBe(true) // reconciled AND 0 disputes
  })

  it('fails when discrepancy exceeds tolerance', () => {
    const arts = collectStripeCloseEvidence({
      periodLabel: 'Jan-2026',
      month: '2026-01',
      stripePayoutTotal: 10000,
      internalCommissionTotal: 12000,
      refundCount: 0,
      disputeCount: 0,
    })
    const stripeSummary = arts[0] as unknown as { reconciled: boolean }
    expect(stripeSummary.reconciled).toBe(false)
    expect(arts[0]!.passed).toBe(false)
  })

  it('fails when there are disputes even if reconciled', () => {
    const arts = collectStripeCloseEvidence({
      periodLabel: 'Jan-2026',
      month: '2026-01',
      stripePayoutTotal: 10000,
      internalCommissionTotal: 10000,
      refundCount: 0,
      disputeCount: 1,
    })
    expect(arts[0]!.passed).toBe(false)
  })

  it('handles zero payout total', () => {
    const arts = collectStripeCloseEvidence({
      periodLabel: 'Jan-2026',
      month: '2026-01',
      stripePayoutTotal: 0,
      internalCommissionTotal: 0,
      refundCount: 0,
      disputeCount: 0,
    })
    const stripeSummary = arts[0] as unknown as { reconciled: boolean }
    expect(stripeSummary.reconciled).toBe(true)
  })
})

// ── year-end ──────────────────────────────────────────────────────────────

describe('collectYearEndEvidence', () => {
  const passingOpts = {
    year: 2026,
    evidencePackIds: ['pack-1', 'pack-2'],
    blobContainer: 'evidence',
    securityPassed: true,
    schemaDriftDetected: false,
    mlDriftedModelCount: 0,
    aiEvalPassRate: 0.95,
    incidentSimCount: 4,
    stripeReconciled: true,
    retentionRunCount: 12,
    auditEventCount: 1000,
  }

  it('passes when all checks are green', () => {
    const arts = collectYearEndEvidence(passingOpts)
    expect(arts[0]!.type).toBe('year-end-summary')
    const yearEndSummary = arts[0] as unknown as { overallPassed: boolean }
    expect(yearEndSummary.overallPassed).toBe(true)
  })

  it('fails when security not passed', () => {
    const arts = collectYearEndEvidence({ ...passingOpts, securityPassed: false })
    const yearEndSummary = arts[0] as unknown as { overallPassed: boolean }
    expect(yearEndSummary.overallPassed).toBe(false)
  })

  it('fails when schema drift detected', () => {
    const arts = collectYearEndEvidence({ ...passingOpts, schemaDriftDetected: true })
    const yearEndSummary = arts[0] as unknown as { overallPassed: boolean }
    expect(yearEndSummary.overallPassed).toBe(false)
  })

  it('fails when ML models have drift', () => {
    const arts = collectYearEndEvidence({ ...passingOpts, mlDriftedModelCount: 2 })
    const yearEndSummary = arts[0] as unknown as { overallPassed: boolean }
    expect(yearEndSummary.overallPassed).toBe(false)
  })

  it('fails when AI eval pass rate below 0.9', () => {
    const arts = collectYearEndEvidence({ ...passingOpts, aiEvalPassRate: 0.85 })
    const yearEndSummary = arts[0] as unknown as { overallPassed: boolean }
    expect(yearEndSummary.overallPassed).toBe(false)
  })

  it('fails when stripe not reconciled', () => {
    const arts = collectYearEndEvidence({ ...passingOpts, stripeReconciled: false })
    const yearEndSummary = arts[0] as unknown as { overallPassed: boolean }
    expect(yearEndSummary.overallPassed).toBe(false)
  })
})

// ── schema (pure function) ──────────────────────────────────────────────

describe('collectSchemaEvidence', () => {
  it('returns an array of artifacts', () => {
    const arts = collectSchemaEvidence({
      periodLabel: 'Q2-2026',
      driftPresent: false,
    })
    expect(Array.isArray(arts)).toBe(true)
    expect(arts.length).toBeGreaterThan(0)
    expect(arts[0]!.type).toBe('db-schema-validation')
  })

  it('reports drift when detected', () => {
    const arts = collectSchemaEvidence({
      periodLabel: 'Q2',
      driftPresent: true,
    })
    expect(arts[0]!.driftPresent).toBe(true)
    expect(arts[0]!.passed).toBe(false)
  })
})
