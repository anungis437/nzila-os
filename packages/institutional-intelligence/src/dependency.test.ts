import { describe, it, expect } from 'vitest'
import { InstitutionalDependencyEngine } from './dependency.js'
import type { InstitutionalIntelligenceStore } from './store.js'
import type { DependencyNode, DependencyRiskReport, LineageEdge, LineageNode, LineageSnapshot } from './schema.js'

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

describe('InstitutionalDependencyEngine', () => {
  it('flags concentration hotspots and computes risk report', async () => {
    const store = makeStore()
    const engine = new InstitutionalDependencyEngine(store)

    await engine.recordNode({
      orgId: 'org-1',
      domain: 'release-governance',
      criticalProcesses: ['gate approvals', 'rollback approvals'],
      owners: [
        {
          personId: 'p1',
          personName: 'Aubert',
          responsibilities: ['gate approvals', 'release sequencing'],
          knowledgeCoverage: 90,
          operationalReplaceability: 'low',
        },
      ],
      documentationCoverage: 40,
      busFactor: 1,
    })

    await engine.recordNode({
      orgId: 'org-1',
      domain: 'vendor-negotiations',
      criticalProcesses: ['procurement negotiation'],
      owners: [
        {
          personId: 'p1',
          personName: 'Aubert',
          responsibilities: ['vendor negotiation'],
          knowledgeCoverage: 80,
          operationalReplaceability: 'low',
        },
      ],
      documentationCoverage: 35,
      busFactor: 1,
    })

    const report = await engine.assess('org-1')

    expect(report.overallRiskScore).toBeGreaterThanOrEqual(65)
    expect(report.riskLevel === 'high' || report.riskLevel === 'critical').toBe(true)
    expect(report.concentrationHotspots.some((h) => h.personName === 'Aubert')).toBe(true)
    expect(report.recommendations.length).toBeGreaterThan(0)
  })
})
