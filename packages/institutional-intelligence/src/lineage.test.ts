import { describe, it, expect } from 'vitest'
import { DecisionLineageGraphEngine } from './lineage'
import type { InstitutionalIntelligenceStore } from './store'
import type { DependencyNode, DependencyRiskReport, LineageEdge, LineageNode, LineageSnapshot } from './schema'

function makeStore(): InstitutionalIntelligenceStore {
  const nodes: LineageNode[] = []
  const edges: LineageEdge[] = []
  let snapshot: LineageSnapshot | undefined
  const dependencies: DependencyNode[] = []
  let report: DependencyRiskReport | undefined

  return {
    async appendNode(node) { nodes.push(node) },
    async appendEdge(edge) { edges.push(edge) },
    async getNodes(orgId) { return nodes.filter((n) => n.orgId === orgId) },
    async getEdges(orgId) { return edges.filter((e) => e.orgId === orgId) },
    async getSnapshot() { return snapshot },
    async saveSnapshot(next) { snapshot = next },

    async appendDependency(node) { dependencies.push(node) },
    async getDependencies(orgId) { return dependencies.filter((d) => d.orgId === orgId) },
    async saveDependencyReport(next) { report = next },
    async getDependencyReport() { return report },
  }
}

describe('DecisionLineageGraphEngine', () => {
  it('builds decision lineage with connected relations', async () => {
    const engine = new DecisionLineageGraphEngine(makeStore())

    await engine.addNode({
      id: 'n-decision-1',
      orgId: 'org-1',
      nodeType: 'decision',
      title: 'Queue resilience strategy',
      refId: 'decision-1',
      metadata: {},
    })
    await engine.addNode({
      id: 'n-risk-1',
      orgId: 'org-1',
      nodeType: 'risk',
      title: 'Replay backlog risk',
      refId: 'risk-1',
      metadata: {},
    })
    await engine.addNode({
      id: 'n-evidence-1',
      orgId: 'org-1',
      nodeType: 'evidence-pack',
      title: 'Evidence pack A',
      refId: 'pack-1',
      metadata: {},
    })

    await engine.connect({
      orgId: 'org-1',
      fromNodeId: 'n-decision-1',
      toNodeId: 'n-risk-1',
      relation: 'mitigates',
      rationale: 'Chosen strategy addresses replay backlog.',
      evidenceRefs: ['ev-1'],
    })

    await engine.connect({
      orgId: 'org-1',
      fromNodeId: 'n-decision-1',
      toNodeId: 'n-evidence-1',
      relation: 'references',
      rationale: 'Decision backed by evidence pack A.',
      evidenceRefs: ['ev-2'],
    })

    const lineage = await engine.getDecisionLineage('decision-1', 'org-1')

    expect(lineage.nodes).toHaveLength(3)
    expect(lineage.edges).toHaveLength(2)
    expect(lineage.edges.some((e) => e.relation === 'mitigates')).toBe(true)
    expect(lineage.edges.some((e) => e.relation === 'references')).toBe(true)
  })
})
