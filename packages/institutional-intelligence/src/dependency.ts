import { randomUUID } from 'node:crypto'
import {
  dependencyNodeSchema,
  dependencyRiskReportSchema,
  type DependencyNode,
  type DependencyRiskLevel,
  type DependencyRiskReport,
} from './schema.js'
import type { InstitutionalIntelligenceStore } from './store.js'

export class InstitutionalDependencyEngine {
  readonly #store: InstitutionalIntelligenceStore

  constructor(store: InstitutionalIntelligenceStore) {
    this.#store = store
  }

  async recordNode(
    input: Omit<DependencyNode, 'id' | 'createdAt' | 'updatedAt'>,
  ): Promise<DependencyNode> {
    const now = new Date().toISOString()
    const node = dependencyNodeSchema.parse({
      ...input,
      id: randomUUID(),
      createdAt: now,
      updatedAt: now,
    })

    await this.#store.appendDependency(node)
    return node
  }

  async assess(orgId: string): Promise<DependencyRiskReport> {
    const nodes = await this.#store.getDependencies(orgId)

    const byPerson = new Map<string, { personName: string; dependencyCount: number; highCriticalityDomains: string[] }>()

    const nodeRisk = nodes.map((node) => {
      const ownerCount = Math.max(node.owners.length, 1)
      const avgKnowledge =
        node.owners.length === 0
          ? 0
          : node.owners.reduce((sum, o) => sum + o.knowledgeCoverage, 0) / node.owners.length

      const replaceabilityPenalty = node.owners.reduce((score, owner) => {
        if (owner.operationalReplaceability === 'low') return score + 30
        if (owner.operationalReplaceability === 'moderate') return score + 15
        return score + 5
      }, 0) / ownerCount

      const busFactorPenalty = node.busFactor <= 1 ? 40 : node.busFactor === 2 ? 25 : 10
      const documentationPenalty = 100 - node.documentationCoverage

      const raw = Math.round((documentationPenalty * 0.35) + (replaceabilityPenalty * 0.35) + (busFactorPenalty * 0.30))
      const riskScore = Math.max(0, Math.min(100, raw + Math.round((50 - avgKnowledge) * 0.2)))

      for (const owner of node.owners) {
        const existing = byPerson.get(owner.personId)
        if (existing) {
          existing.dependencyCount += 1
          if (riskScore >= 65) existing.highCriticalityDomains.push(node.domain)
        } else {
          byPerson.set(owner.personId, {
            personName: owner.personName,
            dependencyCount: 1,
            highCriticalityDomains: riskScore >= 65 ? [node.domain] : [],
          })
        }
      }

      return {
        domain: node.domain,
        riskScore,
        riskLevel: toRiskLevel(riskScore),
        keyPeople: node.owners.map((o) => o.personName),
      }
    })

    const overallRiskScore =
      nodeRisk.length === 0
        ? 0
        : Math.round(nodeRisk.reduce((sum, n) => sum + n.riskScore, 0) / nodeRisk.length)

    const concentrationHotspots = [...byPerson.entries()]
      .map(([personId, v]) => ({ personId, ...v }))
      .filter((v) => v.dependencyCount >= 2 || v.highCriticalityDomains.length > 0)
      .sort((a, b) => b.dependencyCount - a.dependencyCount)

    const recommendations = buildRecommendations(overallRiskScore, concentrationHotspots.length)

    const report: DependencyRiskReport = dependencyRiskReportSchema.parse({
      orgId,
      generatedAt: new Date().toISOString(),
      overallRiskScore,
      riskLevel: toRiskLevel(overallRiskScore),
      concentrationHotspots,
      nodes: nodeRisk,
      recommendations,
    })

    await this.#store.saveDependencyReport(report)
    return report
  }
}

function toRiskLevel(score: number): DependencyRiskLevel {
  if (score >= 80) return 'critical'
  if (score >= 65) return 'high'
  if (score >= 40) return 'moderate'
  return 'low'
}

function buildRecommendations(overallRiskScore: number, hotspotCount: number): string[] {
  const recommendations: string[] = []

  if (overallRiskScore >= 65) {
    recommendations.push('Mandate continuity runbooks for all high-risk domains within 30 days.')
    recommendations.push('Introduce deputy ownership rotation for critical governance and release functions.')
  }

  if (hotspotCount > 0) {
    recommendations.push('Distribute operational authority to reduce key-person concentration hotspots.')
  }

  if (recommendations.length === 0) {
    recommendations.push('Maintain quarterly continuity dependency audits to prevent future concentration drift.')
  }

  return recommendations
}
