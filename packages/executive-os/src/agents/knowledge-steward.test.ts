import { describe, expect, it } from 'vitest'
import { knowledgeStewardAgent, type KnowledgeSignal } from './knowledge-steward'

function run(input: KnowledgeSignal) {
  return knowledgeStewardAgent.run({ orgId: 'o1', input })
}

describe('knowledgeStewardAgent', () => {
  it('no-signal', async () => {
    const r = await knowledgeStewardAgent.run({ orgId: 'o1' })
    expect(r.summary).toMatch(/No knowledge/i)
  })

  it('flags missing required categories', async () => {
    const r = await run({
      documents: [
        { documentId: 'd1', title: 'X', category: 'minute_book', classification: 'internal', linked: true, uploadedDaysAgo: 5 },
      ],
      requiredCategories: ['minute_book', 'resolution', 'certificate'],
    })
    expect(r.insights.some((i) => /required document categor/i.test(i.title))).toBe(true)
  })

  it('flags stale categories past freshness SLA', async () => {
    const r = await run({
      documents: [
        { documentId: 'd1', title: 'Old Cert', category: 'certificate', classification: 'internal', linked: true, uploadedDaysAgo: 400 },
      ],
      freshnessSlaDays: { certificate: 365 },
    })
    expect(r.insights.some((i) => /past freshness SLA/i.test(i.title))).toBe(true)
  })

  it('flags unlinked linkable documents', async () => {
    const r = await run({
      documents: [
        { documentId: 'd2', title: 'Loose', category: 'resolution', classification: 'internal', linked: false, uploadedDaysAgo: 10 },
      ],
    })
    expect(r.insights.some((i) => /unlinked document/i.test(i.title))).toBe(true)
  })

  it('does not flag unlinked non-linkable docs', async () => {
    const r = await run({
      documents: [
        { documentId: 'd3', title: 'Report', category: 'ingestion_report', classification: 'internal', linked: false, uploadedDaysAgo: 2 },
      ],
    })
    expect(r.insights.some((i) => /unlinked document/i.test(i.title))).toBe(false)
  })

  it('clean when all good', async () => {
    const r = await run({
      documents: [
        { documentId: 'd4', title: 'Latest Cert', category: 'certificate', classification: 'internal', linked: true, uploadedDaysAgo: 5 },
      ],
      freshnessSlaDays: { certificate: 365 },
    })
    expect(r.summary).toMatch(/clean/i)
  })
})
