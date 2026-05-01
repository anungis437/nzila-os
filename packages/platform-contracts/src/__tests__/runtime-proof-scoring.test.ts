import { describe, expect, it } from 'vitest'
import {
  classifyReleaseLedgerEvidence,
  evaluateRuntimeGate,
  redactSensitiveData,
  scoreRestoreDrillFreshness,
  scoreToGrade,
  type RuntimeProofForGate,
  type ScoringDimension,
} from '../../../../scripts/proof/runtime-proof-core'

function baseBreakdown(overrides: Partial<Record<ScoringDimension['dimension'], Partial<ScoringDimension>>> = {}): ScoringDimension[] {
  const defaults: ScoringDimension[] = [
    { dimension: 'release', weight: 20, earned: 20, rationale: 'ok', bootstrapEvidence: false },
    { dimension: 'deploy', weight: 20, earned: 20, rationale: 'ok', bootstrapEvidence: false },
    { dimension: 'health', weight: 15, earned: 15, rationale: 'ok', bootstrapEvidence: false },
    { dimension: 'drift', weight: 15, earned: 15, rationale: 'ok', bootstrapEvidence: false },
    { dimension: 'restore', weight: 10, earned: 10, rationale: 'ok', bootstrapEvidence: false },
    { dimension: 'security', weight: 10, earned: 10, rationale: 'ok', bootstrapEvidence: false },
    { dimension: 'seal', weight: 10, earned: 10, rationale: 'ok', bootstrapEvidence: false },
  ]

  return defaults.map((dimension) => {
    const override = overrides[dimension.dimension]
    return override ? { ...dimension, ...override } : dimension
  })
}

function gateProof(overrides: Partial<RuntimeProofForGate> = {}): RuntimeProofForGate {
  return {
    period: '2026-04',
    score: 100,
    grade: 'A',
    blockingFindings: [],
    unknowns: [],
    bootstrapSources: [],
    scoringBreakdown: baseBreakdown(),
    ...overrides,
  }
}

function daysAgo(days: number): string {
  return new Date(Date.now() - days * 86_400_000).toISOString()
}

describe('scoreToGrade', () => {
  it('caps A to B when bootstrap evidence is present', () => {
    expect(scoreToGrade(95, true)).toBe('B')
  })

  it('keeps non-A grades unchanged with bootstrap evidence', () => {
    expect(scoreToGrade(74, true)).toBe('C')
  })
})

describe('evaluateRuntimeGate', () => {
  it('fails production gate on bootstrap-only deploy evidence', () => {
    const proof = gateProof({
      bootstrapSources: ['deploy'],
      score: 88,
      grade: 'B',
      scoringBreakdown: baseBreakdown({
        deploy: {
          earned: 10,
          rationale: 'CI: bootstrap only; Azure: healthy',
          bootstrapEvidence: true,
        },
      }),
    })

    const result = evaluateRuntimeGate(proof, 'production')
    expect(result.pass).toBe(false)
    expect(result.reasons.some((reason) => reason.includes('bootstrap-only'))).toBe(true)
  })

  it('allows staging gate with unknown Azure evidence', () => {
    const proof = gateProof({
      score: 72,
      grade: 'C',
      unknowns: ['[deploy] Azure: unknown'],
      scoringBreakdown: baseBreakdown({
        deploy: {
          earned: 10,
          rationale: 'CI: 1/1 success; Azure: unknown',
        },
      }),
    })

    const result = evaluateRuntimeGate(proof, 'staging')
    expect(result.pass).toBe(true)
    expect(result.reasons).toHaveLength(0)
  })

  it('fails production gate when unknown evidence remains', () => {
    const proof = gateProof({ unknowns: ['[deploy] Azure: unknown'] })
    const result = evaluateRuntimeGate(proof, 'production')
    expect(result.pass).toBe(false)
    expect(result.reasons.some((reason) => reason.includes('unknown evidence'))).toBe(true)
  })

  it('fails production gate for required hard failures', () => {
    const proof = gateProof({
      score: 40,
      grade: 'F',
      blockingFindings: ['[deploy] no success runs'],
      scoringBreakdown: baseBreakdown({
        deploy: { earned: 0, rationale: 'CI: no success runs (0 total); Azure: unknown' },
        health: { earned: 0, rationale: 'health status: fail' },
        drift: { earned: 0, rationale: 'blocking drift detected (2 items)' },
        restore: { earned: 3, rationale: 'restore drill passed; age 220d' },
        seal: { earned: 5, rationale: 'snapshot present but missing sha256 integrity evidence' },
        security: { earned: 0, rationale: 'no security proof' },
      }),
    })

    const result = evaluateRuntimeGate(proof, 'production')
    expect(result.pass).toBe(false)
    expect(result.reasons.some((reason) => reason.includes('score'))).toBe(true)
    expect(result.reasons.some((reason) => reason.includes('blocking finding'))).toBe(true)
    expect(result.reasons.some((reason) => reason.includes('health checks'))).toBe(true)
    expect(result.reasons.some((reason) => reason.includes('blocking drift'))).toBe(true)
    expect(result.reasons.some((reason) => reason.includes('restore drill'))).toBe(true)
    expect(result.reasons.some((reason) => reason.includes('seal verification'))).toBe(true)
    expect(result.reasons.some((reason) => reason.includes('critical missing security proof'))).toBe(true)
  })

  it('fails production gate when expected production app footprint is incomplete even with high score', () => {
    const proof = gateProof({
      score: 95,
      grade: 'A',
      blockingFindings: ['[deploy] [production] expected app missing: partners (nzila-os-partners)'],
      scoringBreakdown: baseBreakdown({
        deploy: {
          earned: 20,
          rationale: 'CI: 2/2 success; Azure: healthy',
        },
      }),
    })

    const result = evaluateRuntimeGate(proof, 'production')
    expect(result.pass).toBe(false)
    expect(result.reasons.some((reason) => reason.includes('incomplete'))).toBe(true)
  })
})

describe('restore drill freshness scoring', () => {
  it('returns 10 for fresh drills < 90 days', () => {
    expect(scoreRestoreDrillFreshness(daysAgo(45))).toBe(10)
  })

  it('returns 6 for 90-179 days', () => {
    expect(scoreRestoreDrillFreshness(daysAgo(120))).toBe(6)
  })

  it('returns 3 for stale drills >= 180 days', () => {
    expect(scoreRestoreDrillFreshness(daysAgo(181))).toBe(3)
  })
})

describe('redaction helper', () => {
  it('redacts token/secret/key/password/credential fields deeply', () => {
    const input = {
      apiToken: 'abc',
      nested: {
        secret: 'shh',
        accessKey: 'k1',
        password: 'pw',
        credentialId: 'cred',
        safeField: 'ok',
      },
    }

    const redacted = redactSensitiveData(input)

    expect(redacted.apiToken).toBe('[REDACTED]')
    expect(redacted.nested.secret).toBe('[REDACTED]')
    expect(redacted.nested.accessKey).toBe('[REDACTED]')
    expect(redacted.nested.password).toBe('[REDACTED]')
    expect(redacted.nested.credentialId).toBe('[REDACTED]')
    expect(redacted.nested.safeField).toBe('ok')
  })
})

describe('release ledger validation in scoring', () => {
  it('fails malformed release-ledger entries', () => {
    const malformedEntry = { version: '1.2.3', notes: 'missing releaseId and timestamp' }
    const dimension = classifyReleaseLedgerEvidence([malformedEntry], 1)

    expect(dimension.earned).toBe(0)
    expect(dimension.rationale).toContain('malformed entries: 1')
    expect(dimension.rationale).toContain('no valid release ledger entries')
  })

  it('scores missing release manifests as partial release evidence', () => {
    const validEntry = {
      version: '1.2.3',
      releaseId: 'rel-123',
      timestamp: '2026-04-12T01:00:00.000Z',
    }

    const dimension = classifyReleaseLedgerEvidence([validEntry], 0)

    expect(dimension.earned).toBe(10)
    expect(dimension.rationale).toContain('no release manifests found')
  })
})
