/**
 * Unit Test — NACP Integrity Proof Section
 *
 * Validates that generateNacpIntegrityProofSection() correctly aggregates
 * seal statuses, anomalies, and hash chain info into a signed section.
 */
import { describe, it, expect } from 'vitest'
import {
  generateNacpIntegrityProofSection,
  type NacpIntegrityProofPorts,
  type NacpSealStatus,
  type NacpAnomaly,
} from '../src/nacp-proof'

const MOCK_SEAL_STATUSES: NacpSealStatus[] = [
  { eventType: 'SUBMISSION_SEALED', totalEvents: 100, sealedCount: 100, unsealedCount: 0, lastSealedAt: '2026-02-28T10:00:00Z', lastSubjectId: 'sub-100' },
  { eventType: 'GRADING_FINALIZED', totalEvents: 95, sealedCount: 95, unsealedCount: 0, lastSealedAt: '2026-02-28T09:00:00Z', lastSubjectId: 'grd-95' },
  { eventType: 'EXPORT_GENERATED', totalEvents: 50, sealedCount: 50, unsealedCount: 0, lastSealedAt: '2026-02-27T15:00:00Z', lastSubjectId: 'exp-50' },
]

function makePorts(overrides?: Partial<NacpIntegrityProofPorts>): NacpIntegrityProofPorts {
  return {
    fetchSealStatuses: async () => MOCK_SEAL_STATUSES,
    fetchAnomalies: async () => [],
    fetchExportProofHash: async () => 'abc123def456',
    fetchHashChainInfo: async () => ({ length: 245, head: 'chain-head-hash' }),
    ...overrides,
  }
}

describe('generateNacpIntegrityProofSection', () => {
  it('returns a signed nacp_integrity section', async () => {
    const section = await generateNacpIntegrityProofSection('org-1', makePorts())

    expect(section.sectionType).toBe('nacp_integrity')
    expect(section.sectionId).toMatch(/^nacp-integrity-org-1-/)
    expect(section.signatureHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('aggregates sealed pack totals', async () => {
    const section = await generateNacpIntegrityProofSection('org-1', makePorts())

    expect(section.totalSealedPacks).toBe(100 + 95 + 50)
    expect(section.totalMissingSeals).toBe(0)
  })

  it('includes hash chain info', async () => {
    const section = await generateNacpIntegrityProofSection('org-1', makePorts())

    expect(section.hashChainLength).toBe(245)
    expect(section.hashChainHead).toBe('chain-head-hash')
  })

  it('includes export proof hash', async () => {
    const section = await generateNacpIntegrityProofSection('org-1', makePorts())

    expect(section.exportProofHash).toBe('abc123def456')
  })

  it('verdict is "pass" when no anomalies and no missing seals', async () => {
    const section = await generateNacpIntegrityProofSection('org-1', makePorts())

    expect(section.integrityVerdict).toBe('pass')
  })

  it('verdict is "fail" when missing seals exist', async () => {
    const sealStatuses: NacpSealStatus[] = [
      { eventType: 'SUBMISSION_SEALED', totalEvents: 10, sealedCount: 8, unsealedCount: 2, lastSealedAt: null, lastSubjectId: null },
    ]
    const section = await generateNacpIntegrityProofSection(
      'org-fail',
      makePorts({ fetchSealStatuses: async () => sealStatuses }),
    )

    expect(section.integrityVerdict).toBe('fail')
    expect(section.totalMissingSeals).toBe(2)
  })

  it('verdict is "warn" when anomalies exist but no missing seals', async () => {
    const anomalies: NacpAnomaly[] = [
      {
        type: 'out_of_order',
        subjectId: 'sub-5',
        eventType: 'SUBMISSION_SEALED',
        detectedAt: '2026-02-28T10:00:00Z',
        description: 'Out of order seal detected',
      },
    ]
    const section = await generateNacpIntegrityProofSection(
      'org-warn',
      makePorts({ fetchAnomalies: async () => anomalies }),
    )

    expect(section.integrityVerdict).toBe('warn')
    expect(section.anomalies).toHaveLength(1)
  })

  it('verdict is "fail" when chain break anomaly exists', async () => {
    const anomalies: NacpAnomaly[] = [
      {
        type: 'chain_break',
        subjectId: 'sub-5',
        eventType: 'SUBMISSION_SEALED',
        detectedAt: '2026-02-28T10:00:00Z',
        description: 'Hash chain break detected',
      },
    ]
    const section = await generateNacpIntegrityProofSection(
      'org-broken',
      makePorts({ fetchAnomalies: async () => anomalies }),
    )

    expect(section.integrityVerdict).toBe('fail')
  })
})
