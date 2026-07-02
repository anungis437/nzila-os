import { z } from 'zod'

export const lineageNodeTypeSchema = z.enum([
  'decision',
  'risk',
  'situation-assessment',
  'governance-deviation',
  'evidence-pack',
  'problem-analysis',
  'governance-rationale',
])

export type LineageNodeType = z.infer<typeof lineageNodeTypeSchema>

export const lineageEdgeTypeSchema = z.enum([
  'influencedBy',
  'mitigates',
  'createdFrom',
  'triggeredBy',
  'supersedes',
  'references',
])

export type LineageEdgeType = z.infer<typeof lineageEdgeTypeSchema>

export const lineageNodeSchema = z.object({
  id: z.string().min(1),
  orgId: z.string().min(1),
  nodeType: lineageNodeTypeSchema,
  title: z.string().min(1),
  refId: z.string().min(1),
  metadata: z.record(z.unknown()).default({}),
  createdAt: z.string().datetime(),
})

export type LineageNode = z.infer<typeof lineageNodeSchema>

export const lineageEdgeSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),
  fromNodeId: z.string().min(1),
  toNodeId: z.string().min(1),
  relation: lineageEdgeTypeSchema,
  rationale: z.string().min(1),
  evidenceRefs: z.array(z.string()),
  createdAt: z.string().datetime(),
})

export type LineageEdge = z.infer<typeof lineageEdgeSchema>

export const lineageSnapshotSchema = z.object({
  orgId: z.string().min(1),
  generatedAt: z.string().datetime(),
  nodes: z.array(lineageNodeSchema),
  edges: z.array(lineageEdgeSchema),
})

export type LineageSnapshot = z.infer<typeof lineageSnapshotSchema>

export const dependencyOwnershipSchema = z.object({
  personId: z.string().min(1),
  personName: z.string().min(1),
  responsibilities: z.array(z.string()).min(1),
  knowledgeCoverage: z.number().min(0).max(100),
  operationalReplaceability: z.enum(['high', 'moderate', 'low']),
})

export type DependencyOwnership = z.infer<typeof dependencyOwnershipSchema>

export const dependencyNodeSchema = z.object({
  id: z.string().uuid(),
  orgId: z.string().min(1),
  domain: z.string().min(1),
  criticalProcesses: z.array(z.string()),
  owners: z.array(dependencyOwnershipSchema),
  documentationCoverage: z.number().min(0).max(100),
  busFactor: z.number().int().positive(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
})

export type DependencyNode = z.infer<typeof dependencyNodeSchema>

export const dependencyRiskLevelSchema = z.enum(['low', 'moderate', 'high', 'critical'])

export type DependencyRiskLevel = z.infer<typeof dependencyRiskLevelSchema>

export const dependencyRiskReportSchema = z.object({
  orgId: z.string().min(1),
  generatedAt: z.string().datetime(),
  overallRiskScore: z.number().min(0).max(100),
  riskLevel: dependencyRiskLevelSchema,
  concentrationHotspots: z.array(
    z.object({
      personId: z.string(),
      personName: z.string(),
      dependencyCount: z.number().int().nonnegative(),
      highCriticalityDomains: z.array(z.string()),
    }),
  ),
  nodes: z.array(
    z.object({
      domain: z.string(),
      riskScore: z.number().min(0).max(100),
      riskLevel: dependencyRiskLevelSchema,
      keyPeople: z.array(z.string()),
    }),
  ),
  recommendations: z.array(z.string()),
})

export type DependencyRiskReport = z.infer<typeof dependencyRiskReportSchema>
