/**
 * Unit Test — ABR Proof Section
 *
 * Validates that generateAbrProofSection() correctly aggregates
 * terminal event stats and produces a signed section.
 */
import { describe, it, expect } from 'vitest'
import { generateAbrProofSection, type AbrProofPorts, type AbrTerminalEventStats } from '../src/abr-proof'

const MOCK_STATS: AbrTerminalEventStats[] = [
  { eventType: 'DECISION_ISSUED', totalCount: 42, lastSealedAt: '2026-02-27T10:00:00Z', lastEntityId: 'dec-001' },
  { eventType: 'EXPORT_GENERATED', totalCount: 15, lastSealedAt: '2026-02-28T08:30:00Z', lastEntityId: 'exp-001' },
  { eventType: 'CASE_CLOSED', totalCount: 30, lastSealedAt: '2026-02-26T14:00:00Z', lastEntityId: 'cls-001' },
]

function makePorts(stats = MOCK_STATS, auditCount = 200): AbrProofPorts {
  return {
    fetchTerminalEventStats: async () => stats,
    fetchAuditEventCount: async () => auditCount,
  }
}

describe('generateAbrProofSection', () => {
  it('returns a signed abr_evidence section', async () => {
    const section = await generateAbrProofSection('org-1', makePorts())

    expect(section.sectionType).toBe('abr_evidence')
    expect(section.sectionId).toMatch(/^abr-proof-org-1-/)
    expect(section.signatureHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('aggregates total sealed packs', async () => {
    const section = await generateAbrProofSection('org-1', makePorts())

    expect(section.totalSealedPacks).toBe(42 + 15 + 30)
    expect(section.totalAuditEvents).toBe(200)
  })

  it('picks the latest seal timestamp', async () => {
    const section = await generateAbrProofSection('org-1', makePorts())

    expect(section.lastSealedAt).toBe('2026-02-28T08:30:00Z')
  })

  it('returns all terminal event types', async () => {
    const section = await generateAbrProofSection('org-1', makePorts())

    expect(section.terminalEvents).toHaveLength(3)
    expect(section.terminalEvents.map((e) => e.eventType)).toEqual([
      'DECISION_ISSUED',
      'EXPORT_GENERATED',
      'CASE_CLOSED',
    ])
  })

  it('handles empty terminal events gracefully', async () => {
    const section = await generateAbrProofSection('org-empty', makePorts([], 0))

    expect(section.totalSealedPacks).toBe(0)
    expect(section.lastSealedAt).toBeNull()
    expect(section.signatureHash).toMatch(/^[a-f0-9]{64}$/)
  })

  it('produces different signatures for different orgs', async () => {
    const s1 = await generateAbrProofSection('org-1', makePorts())
    const s2 = await generateAbrProofSection('org-2', makePorts())

    expect(s1.signatureHash).not.toBe(s2.signatureHash)
  })
})
