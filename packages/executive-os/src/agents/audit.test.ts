import { describe, expect, it } from 'vitest'
import { auditAgent, type AuditSignal, type EvidencePackSummary } from './audit'

function pack(p: Partial<EvidencePackSummary>): EvidencePackSummary {
  return {
    packId: 'P1',
    controlFamily: 'access',
    eventType: 'access-review',
    status: 'sealed',
    chainIntegrity: 'VERIFIED',
    allHashesVerified: true,
    artifactCount: 1,
    ageDays: 1,
    ...p,
  }
}

function run(input: AuditSignal) {
  return auditAgent.run({ orgId: 'o1', input })
}

describe('auditAgent', () => {
  it('no-signal', async () => {
    const r = await auditAgent.run({ orgId: 'o1' })
    expect(r.summary).toMatch(/No audit/i)
  })

  it('flags BROKEN chain as critical and generates actions', async () => {
    const r = await run({ packs: [pack({ chainIntegrity: 'BROKEN' })] })
    expect(r.insights[0]?.severity).toBe('critical')
    expect(r.actions.some((a) => /broken chain/i.test(a.title))).toBe(true)
  })

  it('flags sealed+unverified packs', async () => {
    const r = await run({ packs: [pack({ status: 'sealed', chainIntegrity: 'UNVERIFIED' })] })
    expect(r.insights.some((i) => /awaiting chain verification/i.test(i.title))).toBe(true)
  })

  it('flags stale drafts past seal SLA', async () => {
    const r = await run({
      packs: [pack({ status: 'draft', ageDays: 30 })],
      draftSealSlaDays: 14,
    })
    expect(r.insights.some((i) => /past 14d seal SLA/i.test(i.title))).toBe(true)
  })

  it('escalates audit-event chain gaps as critical', async () => {
    const r = await run({
      packs: [],
      auditEventsLast30d: 1000,
      auditEventsChainGaps: 3,
    })
    expect(r.insights.find((i) => /chain gap/i.test(i.title))?.severity).toBe('critical')
  })

  it('flags missing control families within coverage window', async () => {
    const r = await run({
      packs: [pack({ controlFamily: 'access', ageDays: 10 })],
      requiredFamilies: ['access', 'change-mgmt', 'incident-response'],
      coverageWindowDays: 90,
    })
    expect(r.insights.some((i) => /control famil.+without evidence/i.test(i.title))).toBe(true)
  })

  it('healthy when clean', async () => {
    const r = await run({ packs: [pack({})] })
    expect(r.summary).toMatch(/healthy/i)
  })
})
