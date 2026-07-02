import { describe, it, expect } from 'vitest'
import {
  computeSignalRiskIndex,
  computeGovernanceDriftScore,
  computeOperationalFragilityIndex,
  computeInstitutionalMemoryScore,
  computeOverallRiskScore,
  computeTrend,
  computeDriftDiagnostics,
} from './scoring.js'
import type { ContinuityRiskSignal } from './schema.js'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeSignal(
  category: ContinuityRiskSignal['category'],
  severity: ContinuityRiskSignal['severity'],
  exposure: ContinuityRiskSignal['exposure'],
  detectability: ContinuityRiskSignal['detectability'],
): ContinuityRiskSignal {
  return {
    id: 'signal-1',
    orgId: 'org-1',
    category,
    description: 'Test signal',
    severity,
    exposure,
    detectability,
    riskIndex: computeSignalRiskIndex(severity, exposure, detectability),
    evidenceRefs: [],
    affectedSystems: [],
    affectedRoles: [],
    mitigationState: 'unmitigated',
    mitigationNotes: '',
    detectedAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  }
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('computeSignalRiskIndex', () => {
  it('computes maximum risk (5×5×5) for worst case', () => {
    const idx = computeSignalRiskIndex(5, 5, 1) // detectability=1 means hardest to detect
    expect(idx).toBe(125) // 5 × 5 × (6−1) = 125
  })

  it('computes minimum risk for trivial signal', () => {
    const idx = computeSignalRiskIndex(1, 1, 5) // easy to detect
    expect(idx).toBe(1) // 1 × 1 × (6−5) = 1
  })

  it('penalises hard-to-detect signals more than easy-to-detect', () => {
    const hard = computeSignalRiskIndex(3, 3, 1)
    const easy = computeSignalRiskIndex(3, 3, 5)
    expect(hard).toBeGreaterThan(easy)
  })
})

describe('computeGovernanceDriftScore', () => {
  it('returns 0 for empty signals', () => {
    expect(computeGovernanceDriftScore([])).toBe(0)
  })

  it('reflects governance-related signal severity in score', () => {
    const signals = [
      makeSignal('governance-drift', 5, 5, 1),
    ]
    expect(computeGovernanceDriftScore(signals)).toBeGreaterThan(50)
  })

  it('ignores non-governance categories', () => {
    const signals = [
      makeSignal('founder-dependency', 5, 5, 1),
    ]
    expect(computeGovernanceDriftScore(signals)).toBe(0)
  })
})

describe('computeOperationalFragilityIndex', () => {
  it('returns 0 for empty signals', () => {
    expect(computeOperationalFragilityIndex([])).toBe(0)
  })

  it('returns high score for extreme founder dependency', () => {
    const signals = [makeSignal('founder-dependency', 5, 5, 1)]
    expect(computeOperationalFragilityIndex(signals)).toBeGreaterThan(80)
  })
})

describe('computeInstitutionalMemoryScore', () => {
  it('returns 0 for empty coverage', () => {
    expect(computeInstitutionalMemoryScore([])).toBe(0)
  })

  it('averages coverage percentages', () => {
    const score = computeInstitutionalMemoryScore([
      { domain: 'architecture', coveragePct: 80, documentedDecisions: 10, undocumentedEstimate: 2, keyPersonDependencies: [], lastUpdatedAt: new Date().toISOString() },
      { domain: 'governance', coveragePct: 60, documentedDecisions: 8, undocumentedEstimate: 4, keyPersonDependencies: [], lastUpdatedAt: new Date().toISOString() },
    ])
    expect(score).toBe(70)
  })
})

describe('computeOverallRiskScore', () => {
  it('returns 0 when all component scores are 0 and memory is perfect', () => {
    const score = computeOverallRiskScore({
      governanceDriftScore: 0,
      operationalFragilityIndex: 0,
      institutionalMemoryScore: 100, // perfect coverage = 0 risk contribution
      escalationInstabilityScore: 0,
    })
    expect(score).toBe(0)
  })

  it('returns near 100 when all component risks are maxed', () => {
    const score = computeOverallRiskScore({
      governanceDriftScore: 100,
      operationalFragilityIndex: 100,
      institutionalMemoryScore: 0,
      escalationInstabilityScore: 100,
    })
    expect(score).toBe(100)
  })
})

describe('computeTrend', () => {
  it('returns insufficient-data when no previous score', () => {
    expect(computeTrend(50, undefined)).toBe('insufficient-data')
  })

  it('returns stable for delta within ±2', () => {
    expect(computeTrend(50, 49)).toBe('stable')
    expect(computeTrend(50, 51)).toBe('stable')
  })

  it('returns improving for significant decrease', () => {
    expect(computeTrend(40, 50)).toBe('improving')
  })

  it('returns worsening for moderate increase', () => {
    expect(computeTrend(60, 50)).toBe('worsening')
  })

  it('returns volatile for sharp increase', () => {
    expect(computeTrend(70, 50)).toBe('volatile')
  })
})

describe('computeDriftDiagnostics', () => {
  it('returns insufficient-data for short history', () => {
    const result = computeDriftDiagnostics([
      {
        at: '2026-05-01T00:00:00Z',
        overallRiskScore: 50,
        governanceDriftScore: 50,
        operationalFragilityIndex: 50,
        institutionalMemoryScore: 50,
        escalationInstabilityScore: 50,
      },
    ])

    expect(result.trajectory).toBe('insufficient-data')
  })

  it('computes degrading trajectory with positive velocity', () => {
    const result = computeDriftDiagnostics([
      {
        at: '2026-05-01T00:00:00Z',
        overallRiskScore: 40,
        governanceDriftScore: 35,
        operationalFragilityIndex: 42,
        institutionalMemoryScore: 70,
        escalationInstabilityScore: 30,
      },
      {
        at: '2026-05-08T00:00:00Z',
        overallRiskScore: 50,
        governanceDriftScore: 45,
        operationalFragilityIndex: 48,
        institutionalMemoryScore: 66,
        escalationInstabilityScore: 38,
      },
      {
        at: '2026-05-15T00:00:00Z',
        overallRiskScore: 58,
        governanceDriftScore: 52,
        operationalFragilityIndex: 55,
        institutionalMemoryScore: 62,
        escalationInstabilityScore: 44,
      },
    ])

    expect(result.overallVelocityPct).toBeGreaterThan(0)
    expect(result.trajectory === 'degrading' || result.trajectory === 'volatile').toBe(true)
  })

  it('computes improving trajectory when risk decreases', () => {
    const result = computeDriftDiagnostics([
      {
        at: '2026-05-01T00:00:00Z',
        overallRiskScore: 70,
        governanceDriftScore: 65,
        operationalFragilityIndex: 72,
        institutionalMemoryScore: 50,
        escalationInstabilityScore: 58,
      },
      {
        at: '2026-05-15T00:00:00Z',
        overallRiskScore: 62,
        governanceDriftScore: 60,
        operationalFragilityIndex: 64,
        institutionalMemoryScore: 56,
        escalationInstabilityScore: 50,
      },
      {
        at: '2026-05-30T00:00:00Z',
        overallRiskScore: 54,
        governanceDriftScore: 52,
        operationalFragilityIndex: 58,
        institutionalMemoryScore: 62,
        escalationInstabilityScore: 44,
      },
    ])

    expect(result.overallVelocityPct).toBeLessThan(0)
    expect(result.trajectory).toBe('improving')
  })
})
