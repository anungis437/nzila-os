import { describe, expect, it, vi } from 'vitest';

const { whereMock } = vi.hoisted(() => ({ whereMock: vi.fn() }));
vi.mock('@/db/db', () => ({
  db: { select: () => ({ from: () => ({ where: whereMock }) }) },
}));
vi.mock('@/db/schema', () => ({
  exitInterviews: { id: 'id', roleInUnion: 'roleInUnion', topics: 'topics', expertiseTags: 'expertiseTags', organizationId: 'organizationId', status: 'status' },
}));
vi.mock('drizzle-orm', () => ({ and: (...a: unknown[]) => a, eq: (...a: unknown[]) => a }));

import { buildTopicGraph } from '../topic-graph-builder';

describe('lib/knowledge-transfer/topic-graph/topic-graph-builder', () => {
  it('builds nodes, edges, clusters and categorizes topics', async () => {
    whereMock.mockResolvedValue([
      { id: 'a', roleInUnion: 'steward', topics: ['Grievance System', 'Vendor Contract'], expertiseTags: ['Policy Committee'] },
      { id: 'b', roleInUnion: 'officer', topics: ['Grievance System', 'Vendor Contract'], expertiseTags: ['Policy Committee'] },
      { id: 'c', roleInUnion: 'admin', topics: ['Grievance System', 'Vendor Contract'], expertiseTags: ['Policy Committee', 'Database Tool'] },
      { id: 'd', roleInUnion: 'chief_steward', topics: ['Grievance System'], expertiseTags: ['Solo Topic'] },
      { id: 'e', roleInUnion: 'steward', topics: ['Grievance System', 'Vendor Contract'], expertiseTags: [] },
    ]);

    const graph = await buildTopicGraph('org-1');
    expect(graph.nodes.length).toBeGreaterThan(0);
    const sys = graph.nodes.find((n) => n.label === 'grievance system');
    expect(sys?.category).toBe('system');
    const vendor = graph.nodes.find((n) => n.label === 'vendor contract');
    expect(vendor?.category).toBe('vendor');
    const gov = graph.nodes.find((n) => n.label === 'policy committee');
    expect(gov?.category).toBe('governance');
    // grievance system appears in all 5 -> well-distributed
    expect(graph.wellDistributedTopics).toContain('grievance system');
    // solo topic appears once -> isolated
    expect(graph.isolatedNodes).toContain('solo topic');
    // high co-occurrence cluster between grievance system and vendor contract (weight 4 -> medium)
    expect(graph.edges.some((e) => e.weight >= 3)).toBe(true);
    expect(graph.concentrationClusters.length).toBeGreaterThan(0);
    expect(graph.concentrationClusters.some((c) => c.risk === 'medium' || c.risk === 'high')).toBe(true);
  });

  it('handles empty interview set', async () => {
    whereMock.mockResolvedValue([]);
    const graph = await buildTopicGraph('org-2');
    expect(graph.nodes).toEqual([]);
    expect(graph.edges).toEqual([]);
    expect(graph.isolatedNodes).toEqual([]);
    expect(graph.concentrationClusters).toEqual([]);
  });

  it('categorizes compliance and general topics', async () => {
    whereMock.mockResolvedValue([
      { id: 'a', roleInUnion: 'steward', topics: ['Arbitration Process'], expertiseTags: ['Random Knowledge'] },
    ]);
    const graph = await buildTopicGraph('org-3');
    expect(graph.nodes.find((n) => n.label === 'arbitration process')?.category).toBe('compliance');
    expect(graph.nodes.find((n) => n.label === 'random knowledge')?.category).toBe('general');
  });
});
