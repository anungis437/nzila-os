import { describe, it, expect } from 'vitest'
import {
  buildLegitimacySummary,
  buildReleaseLineage,
  compareTopology,
  projectAttestationForView,
} from '../index'

const sample = {
  contentHash: 'sha256:aaa',
  class: 'release' as const,
  verdict: 'verified' as const,
  issuedAt: '2026-05-09T12:00:00.000Z',
  issuer: 'gitops-deploy',
  releaseId: 'r1',
  environmentId: 'staging',
  citedEvidence: [],
  interpretation: 'Verified.',
  accessClass: 'governance-forum' as const,
}

describe('attestation visibility', () => {
  it('projects a viewer-safe attestation', () => {
    const proj = projectAttestationForView(sample)
    expect(proj.verdict).toBe('verified')
  })

  it('builds release lineage chronologically', () => {
    const a = projectAttestationForView({ ...sample, contentHash: 'sha256:a', issuedAt: '2026-05-08T12:00:00.000Z' })
    const b = projectAttestationForView({ ...sample, contentHash: 'sha256:b', issuedAt: '2026-05-09T12:00:00.000Z' })
    const c = projectAttestationForView({ ...sample, contentHash: 'sha256:c', issuedAt: '2026-05-10T12:00:00.000Z' })
    const ordered = buildReleaseLineage([c, a, b])
    expect(ordered.map((x) => x.contentHash)).toEqual(['sha256:a', 'sha256:b', 'sha256:c'])
  })

  it('refuses to silently downgrade a rejected verdict', () => {
    const rejected = projectAttestationForView({ ...sample, verdict: 'rejected', interpretation: 'Rejected.' })
    const summary = buildLegitimacySummary(rejected)
    expect(summary.verdict).toBe('rejected')
  })

  it('rejects topology with missing manifest components', () => {
    const result = compareTopology(['svc-a'], ['svc-a', 'svc-b'])
    expect(result.verdict).toBe('rejected')
    expect(result.missing).toEqual(['svc-b'])
  })

  it('marks unexpected components as partial, never verified', () => {
    const result = compareTopology(['svc-a', 'svc-x'], ['svc-a'])
    expect(result.verdict).toBe('partial')
    expect(result.unexpected).toEqual(['svc-x'])
  })
})
