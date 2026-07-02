import type {
  LineageNode,
  LineageEdge,
  LineageSnapshot,
  DependencyNode,
  DependencyRiskReport,
} from './schema'

export interface InstitutionalIntelligenceStore {
  appendNode(node: LineageNode): Promise<void>
  appendEdge(edge: LineageEdge): Promise<void>
  getNodes(orgId: string): Promise<LineageNode[]>
  getEdges(orgId: string): Promise<LineageEdge[]>
  getSnapshot(orgId: string): Promise<LineageSnapshot | undefined>
  saveSnapshot(snapshot: LineageSnapshot): Promise<void>

  appendDependency(node: DependencyNode): Promise<void>
  getDependencies(orgId: string): Promise<DependencyNode[]>
  saveDependencyReport(report: DependencyRiskReport): Promise<void>
  getDependencyReport(orgId: string): Promise<DependencyRiskReport | undefined>
}
