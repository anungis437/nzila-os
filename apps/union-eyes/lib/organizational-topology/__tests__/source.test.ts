import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  queue: [] as unknown[],
  loggerWarn: vi.fn(),
  redactProtected: vi.fn((g) => g),
  nodesOfIggKind: vi.fn(() => []),
  hierarchyAncestors: vi.fn(() => []),
  hierarchyDescendants: vi.fn(() => []),
  resolveDelegationChains: vi.fn(() => []),
  lineageChain: vi.fn(() => []),
  buildContinuityTimeline: vi.fn(() => []),
}))

function chain() {
  const c: Record<string, unknown> = {}
  for (const m of ['select', 'from']) {
    c[m] = vi.fn(() => c)
  }
  ;(c as { then: (resolve: (v: unknown) => void) => void }).then = (resolve) => {
    resolve(h.queue.shift() ?? [])
  }
  return c
}

vi.mock('@/db/db', () => ({ db: { select: vi.fn(() => chain()) } }))

// PR #752 round 8: getInstitutionalGraph() now executes under
// withSystemContext (see lib/organizational-topology/source.ts) — the
// mock just runs the callback immediately against the mocked `db` above,
// matching every other withSystemContext test mock in this codebase.
vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn((fn: (tx?: unknown) => unknown) => fn({})),
}))

vi.mock('@/db/schema-organizations', () => ({
  organizations: new Proxy({}, { get: (_t, p) => `organizations.${String(p)}` }),
  organizationRelationships: new Proxy({}, { get: (_t, p) => `organizationRelationships.${String(p)}` }),
}))

vi.mock('@/lib/logger', () => ({
  logger: { warn: h.loggerWarn, info: vi.fn(), error: vi.fn(), debug: vi.fn() },
}))

vi.mock('@nzila/organizational-governance-graph', () => ({
  IggEntityKinds: {
    PLATFORM: 'platform',
    CONGRESS: 'congress',
    FEDERATION: 'federation',
    UNION: 'union',
    LOCAL: 'local',
    REGION: 'region',
    DISTRICT: 'district',
    COMMITTEE: 'committee',
    BARGAINING_UNIT: 'bargaining_unit',
  },
  IggRelationshipKinds: {
    AFFILIATED_WITH: 'affiliated_with',
    REPRESENTS: 'represents',
    SUPERSEDES: 'supersedes',
    PARENT_OF: 'parent_of',
    OVERRIDES: 'overrides',
  },
  redactProtected: h.redactProtected,
  nodesOfIggKind: h.nodesOfIggKind,
  hierarchyAncestors: h.hierarchyAncestors,
  hierarchyDescendants: h.hierarchyDescendants,
  resolveDelegationChains: h.resolveDelegationChains,
  lineageChain: h.lineageChain,
  buildContinuityTimeline: h.buildContinuityTimeline,
}))

import { getInstitutionalGraph, getInstitutionalTopologyView } from '../source'

beforeEach(() => {
  h.queue = []
  h.loggerWarn.mockReset()
  h.redactProtected.mockClear()
  h.nodesOfIggKind.mockReset().mockImplementation(() => [])
  h.hierarchyAncestors.mockReset().mockImplementation(() => [])
  h.hierarchyDescendants.mockReset().mockImplementation(() => [])
  h.resolveDelegationChains.mockReset().mockImplementation(() => [])
  h.lineageChain.mockReset().mockImplementation(() => [])
  h.buildContinuityTimeline.mockReset().mockImplementation(() => [])
})

describe('organizational-topology/source', () => {
  it('getInstitutionalGraph builds nodes/edges/decisions', async () => {
    h.queue = [
      [
        {
          id: 'org1',
          appId: 'tenant1',
          displayName: 'Org One',
          name: 'Org 1',
          status: 'active',
          organizationType: 'union',
          slug: 'org1',
          hierarchyLevel: 1,
          affiliationDate: new Date('2024-01-01'),
          createdAt: new Date('2024-01-01'),
          parentId: null,
        },
        {
          id: 'org2',
          appId: null,
          displayName: null,
          name: 'Org 2',
          status: null,
          organizationType: 'local',
          slug: 'org2',
          hierarchyLevel: 2,
          affiliationDate: null,
          createdAt: new Date('2024-02-01'),
          parentId: 'org1',
        },
      ],
      [
        {
          id: 'rel1',
          childOrgId: 'org2',
          parentOrgId: 'org1',
          relationshipType: 'affiliate',
          metadata: { note: 'x' },
          effectiveDate: new Date('2024-02-01'),
          endDate: null,
          createdAt: new Date('2024-02-01'),
        },
      ],
    ]

    const graph = await getInstitutionalGraph()
    expect(graph.nodes).toHaveLength(2)
    expect(graph.edges.length).toBeGreaterThanOrEqual(2)
    expect(graph.decisions).toHaveLength(1)
  })

  it('getInstitutionalGraph returns empty graph on error', async () => {
    const { db } = await import('@/db/db')
    ;(db.select as ReturnType<typeof vi.fn>).mockImplementationOnce(() => {
      throw new Error('db fail')
    })
    const graph = await getInstitutionalGraph()
    expect(graph).toEqual({ nodes: [], edges: [], decisions: [] })
    expect(h.loggerWarn).toHaveBeenCalled()
  })

  it('getInstitutionalTopologyView composes all sections', async () => {
    h.queue = [
      [
        {
          id: 'org1',
          appId: 'tenant1',
          displayName: 'Org One',
          name: 'Org 1',
          status: 'active',
          organizationType: 'union',
          slug: 'org1',
          hierarchyLevel: 1,
          affiliationDate: null,
          createdAt: new Date('2024-01-01'),
          parentId: null,
        },
      ],
      [
        {
          id: 'rel1',
          childOrgId: 'org1',
          parentOrgId: 'org1',
          relationshipType: 'affiliate',
          metadata: { iggKind: 'affiliated_with' },
          effectiveDate: new Date('2024-02-01'),
          endDate: null,
          createdAt: new Date('2024-02-01'),
        },
      ],
    ]

    h.nodesOfIggKind.mockImplementation((nodes, kind) =>
      kind === 'union' ? [{ entityId: 'org1' }] : []
    )
    h.hierarchyAncestors.mockReturnValue(['root'])
    h.hierarchyDescendants.mockReturnValue(['child'])
    h.resolveDelegationChains.mockReturnValue([])
    h.lineageChain.mockReturnValue(['org1'])
    h.buildContinuityTimeline.mockReturnValue([{ id: 'ct1' }])

    const view = await getInstitutionalTopologyView()
    expect(view.substrate.nodes).toBe(1)
    expect(view.hierarchy.length).toBeGreaterThan(0)
    expect(view.affiliationRepresentation).toHaveProperty('edges')
    expect(view.lineage.length).toBeGreaterThan(0)
    expect(view.continuityTopology).toEqual([{ id: 'ct1' }])
  })

  it('topology builds cohorts, represents edges, and dedups lineage origins', async () => {
    h.queue = [
      [
        {
          id: 'u1',
          appId: 't1',
          displayName: 'Union',
          name: 'Union',
          status: 'active',
          organizationType: 'union',
          slug: 'u1',
          hierarchyLevel: 1,
          affiliationDate: null,
          createdAt: new Date('2024-01-01'),
          parentId: null,
        },
        {
          id: 'l1',
          appId: 't1',
          displayName: 'Local',
          name: 'Local',
          status: 'active',
          organizationType: 'local',
          slug: 'l1',
          hierarchyLevel: 2,
          affiliationDate: null,
          createdAt: new Date('2024-01-02'),
          parentId: 'u1',
        },
      ],
      [
        {
          id: 'e1',
          childOrgId: 'l1',
          parentOrgId: 'u1',
          relationshipType: 'affiliate',
          metadata: {},
          effectiveDate: new Date('2024-02-01'),
          endDate: null,
          createdAt: new Date('2024-02-01'),
        },
        {
          id: 'e2',
          childOrgId: 'u1',
          parentOrgId: 'u1',
          relationshipType: 'unknown',
          metadata: { iggKind: 'represents' },
          effectiveDate: new Date('2024-02-01'),
          endDate: null,
          createdAt: new Date('2024-02-01'),
        },
      ],
    ]

    h.nodesOfIggKind.mockImplementation((nodes, kind) =>
      kind === 'union' || kind === 'local' ? nodes : []
    )
    h.lineageChain
      .mockImplementationOnce(() => ['originA', 'u1'])
      .mockImplementationOnce(() => ['originA', 'l1'])

    const view = await getInstitutionalTopologyView()
    expect(view.affiliationRepresentation.edges.length).toBeGreaterThanOrEqual(1)
    expect(view.affiliationRepresentation.cohorts.length).toBeGreaterThanOrEqual(1)
    expect(view.lineage).toHaveLength(1)
  })
})
