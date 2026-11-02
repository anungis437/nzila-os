import { describe, expect, it } from 'vitest'
import { lineageNodeSchema, lineageSnapshotSchema } from './schema'

const validNode = {
  id: 'node-1', orgId: 'org-a', nodeType: 'decision', title: 'Decision evidence',
  refId: 'decision-1', metadata: { tags: ['audited'], detail: { source: 'review' } },
  createdAt: '2026-11-01T00:00:00Z',
}

describe('Zod 4 institutional lineage schema regression', () => {
  it('preserves dynamic metadata with nested values', () => {
    expect(lineageNodeSchema.parse(validNode).metadata).toEqual(validNode.metadata)
  })
  it('preserves default empty metadata when omitted', () => {
    const { metadata: _omitted, ...withoutMetadata } = validNode
    expect(lineageNodeSchema.parse(withoutMetadata).metadata).toEqual({})
  })
  it('rejects array metadata and invalid timestamps', () => {
    expect(lineageNodeSchema.safeParse({ ...validNode, metadata: [] }).success).toBe(false)
    expect(lineageNodeSchema.safeParse({ ...validNode, createdAt: 'not-a-date' }).success).toBe(false)
  })
  it('rejects malformed lineage edges in a snapshot', () => {
    expect(lineageSnapshotSchema.safeParse({
      orgId: 'org-a', generatedAt: '2026-11-02T00:00:00Z', nodes: [validNode],
      edges: [{ id: 'invalid-uuid', orgId: 'org-a', fromNodeId: 'node-1', toNodeId: 'node-2', relation: 'references', rationale: 'review', evidenceRefs: [], createdAt: '2026-11-01T00:00:00Z' }],
    }).success).toBe(false)
  })
})
