import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const src = (path: string) => readFileSync(join(process.cwd(), path), 'utf8').replace(/\r\n/g, '\n')

describe('Gate 0 batch B69: satisfaction figures, platform statistics and the in-memory index', () => {
  it('guards representative satisfaction figures with the officer rule, a minimum response count and a read record', () => {
    const rankings = src('app/api/satisfaction/rankings/route.ts')
    const item = src('app/api/satisfaction/lro/[lroId]/route.ts')
    expect(rankings).toContain("minRole: 'officer'")
    expect(rankings).toContain('withEnoughResponses')
    expect(rankings).toContain("action: 'satisfaction.rankings.read'")
    expect(item).toContain('mayReadRepresentativeFigures')
    expect(item).toContain("action: 'satisfaction.representative.read'")
    expect(item).toContain('figures: null')
    expect(item).toContain('Satisfaction ratings for this representative')
  })

  it('counts people once and agreed settlements only, and reads under the system role on purpose', () => {
    const stats = src('lib/queries/platform-stats.ts')
    expect(stats).toContain('count(distinct ${organizationMembers.userId})')
    expect(stats).toContain('isNull(organizationMembers.deletedAt)')
    expect(stats).toContain("filter (where status IN ('agreed', 'implemented'))")
    expect(stats).toContain("status IN ('settled', 'closed')")
    expect(stats).toContain('withSystemContext')
    expect(stats).toContain('WHERE deleted_at IS NULL')
  })

  it('does not claim the process-local document index is durable or counted', () => {
    const ingest = src('app/api/ai/ingest/route.ts')
    expect(ingest).toContain("status: 'indexed_in_process_memory'")
    expect(ingest).toContain('durable: false')
    expect(ingest).not.toContain('Simplified - actual implementation')
  })

  it('repoints the hierarchy on an organization parent change instead of writing a bare parent id', () => {
    const route = src('app/api/organizations/[id]/route.ts')
    expect(route).toContain('repointHierarchy(tx, id, body.parent_id ?? null)')
    expect(src('lib/organizations/reparent.ts')).toContain("'cycle'")
  })
})
