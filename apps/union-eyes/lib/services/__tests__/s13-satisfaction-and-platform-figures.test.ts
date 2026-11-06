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

  it('reads only organization tenancy metadata under the system role: no member, grievance, agreement or settlement figure (#1116/#1118; DEF-0B10-OPL-14)', () => {
    const stats = src('lib/queries/platform-stats.ts')
    // Platform staff read tenancy metadata from the organizations table only; figures derived from tenant content are null, not counted.
    expect(stats).toContain('withSystemContext')
    expect(stats).toContain('FROM organizations')
    expect(stats).not.toMatch(/organizationMembers|FROM organization_members|FROM grievances|FROM collective_agreements|FROM claims\b/)
    expect(stats).toContain('grievances: null')
    expect(stats).toContain('registeredUsers: null')
    expect(stats).not.toMatch(/FROM settlements|settlements\b.*\bamount|perCapitaRate/)
  })

  // DEF-0B2-AI-RAG-INDEX-PROCESS-LOCAL: the process-local index is gone; the ingest writes the organization's durable knowledge rows.
  it('indexes an ingested document durably, tenant-scoped, and claims no embedding it did not store', () => {
    const ingest = src('app/api/ai/ingest/route.ts')
    expect(ingest).not.toContain('ragPipeline')
    expect(ingest).not.toContain('indexed_in_process_memory')
    expect(ingest).toContain('indexIngestedDocument(')
    expect(ingest).not.toContain('Simplified - actual implementation')
    const index = src('lib/ai/durable-ingest-index.ts')
    expect(index).toMatch(/withRLSContext\(\{ organizationId \}[\s\S]*insert\(knowledgeBase\)[\s\S]*persistAtomicAudit\(tx,/)
    expect(index).toContain("isPublic: false")
    expect(index).toContain("status: 'stored_without_embedding'")
  })

  it('never writes a bare parent id: the item route refuses any parent change (409) until a governed reparent workflow exists (#1116)', () => {
    const route = src('app/api/organizations/[id]/route.ts')
    expect(route).not.toContain('repointHierarchy(')
    expect(route).toContain('Changing parent affiliation or status requires an approved institutional workflow')
  })
})
