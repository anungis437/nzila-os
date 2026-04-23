/**
 * @nzila/platform-growth-os -- Union Target Map CRUD + expansion logic
 */
import { z } from 'zod'
import { listRecords, readRecord, writeRecord } from '../store'
import { makeId, nowISO } from '../utils'
import type { ExpansionRelationship, UnionMapStats, UnionNode } from './types'

const unionNodeSchema = z.object({
  id: z.string().min(1),
  scope: z.object({ tenantId: z.string(), orgId: z.string(), product: z.string().optional() }),
  name: z.string().min(1),
  fullName: z.string(),
  unionScope: z.enum(['national', 'provincial', 'regional', 'local', 'council']),
  parentId: z.string().nullable(),
  sector: z.string(),
  province: z.string().nullable(),
  memberCount: z.number().int().nonnegative().nullable(),
  primaryContactName: z.string().nullable(),
  primaryContactTitle: z.string().nullable(),
  primaryContactEmail: z.string().nullable(),
  websiteUrl: z.string().url().nullable(),
  inPipeline: z.boolean(),
  dealEngineId: z.string().nullable(),
  notes: z.string(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

const expansionRelSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  relationType: z.enum([
    'same_parent', 'same_sector', 'cupe_council', 'clc_affiliate', 'warm_connection', 'conference_cohort',
  ]),
  adjacencyScore: z.number().min(0).max(1),
  notes: z.string(),
  createdAt: z.string(),
})

const UNION_ENTITY = 'union-node'
const EXPANSION_ENTITY = 'union-expansion'

export type CreateUnionNodeInput = Omit<UnionNode, 'id' | 'createdAt' | 'updatedAt'>

export function createUnionNode(input: CreateUnionNodeInput): UnionNode {
  const now = nowISO()
  const record: UnionNode = { id: makeId('union'), ...input, createdAt: now, updatedAt: now }
  return writeRecord(UNION_ENTITY, record.id, record, unionNodeSchema) as UnionNode
}

export function getUnionNode(id: string): UnionNode | null {
  return readRecord(UNION_ENTITY, id, unionNodeSchema) as UnionNode | null
}

export function listUnionNodes(): UnionNode[] {
  return listRecords(UNION_ENTITY, unionNodeSchema) as UnionNode[]
}

export function updateUnionNode(
  id: string,
  patch: Partial<Omit<UnionNode, 'id' | 'createdAt'>>,
): UnionNode | null {
  const existing = getUnionNode(id)
  if (!existing) return null
  const updated = { ...existing, ...patch, updatedAt: nowISO() }
  return writeRecord(UNION_ENTITY, id, updated, unionNodeSchema) as UnionNode
}

export type CreateExpansionInput = Omit<ExpansionRelationship, 'id' | 'createdAt'>

export function createExpansion(input: CreateExpansionInput): ExpansionRelationship {
  const record: ExpansionRelationship = { id: makeId('exp'), ...input, createdAt: nowISO() }
  return writeRecord(EXPANSION_ENTITY, record.id, record, expansionRelSchema) as ExpansionRelationship
}

export function listExpansions(): ExpansionRelationship[] {
  return listRecords(EXPANSION_ENTITY, expansionRelSchema) as ExpansionRelationship[]
}

export interface ExpansionTarget {
  node: UnionNode
  relation: { relationType: string; adjacencyScore: number }
}

export function getExpansionTargets(convertedNodeId: string, topN = 5): ExpansionTarget[] {
  const all = listUnionNodes()
  const byId = new Map(all.map((n) => [n.id, n]))
  const converted = byId.get(convertedNodeId)
  if (!converted) return []

  const expansions = listExpansions().filter(
    (e) => e.sourceId === convertedNodeId || e.targetId === convertedNodeId,
  )

  const scored: { node: UnionNode; adjacencyScore: number; relationType: string }[] = []
  for (const exp of expansions) {
    const targetId = exp.sourceId === convertedNodeId ? exp.targetId : exp.sourceId
    const target = byId.get(targetId)
    if (!target || target.inPipeline) continue
    scored.push({ node: target, adjacencyScore: exp.adjacencyScore, relationType: exp.relationType })
  }

  if (converted.parentId) {
    for (const node of all) {
      if (node.id === convertedNodeId) continue
      if (node.inPipeline) continue
      if (node.parentId === converted.parentId) {
        if (!scored.some((s) => s.node.id === node.id)) {
          scored.push({ node, adjacencyScore: 0.5, relationType: 'same_parent' })
        }
      }
    }
  }

  scored.sort((a, b) => b.adjacencyScore - a.adjacencyScore)
  return scored.slice(0, topN).map((s) => ({
    node: s.node,
    relation: { relationType: s.relationType, adjacencyScore: s.adjacencyScore },
  }))
}

export function getMapStats(): UnionMapStats {
  const all = listUnionNodes()
  const expansions = listExpansions()
  const stats: UnionMapStats = {
    totalNodes: all.length,
    totalMembers: all.reduce((acc, n) => acc + (n.memberCount ?? 0), 0),
    inPipeline: all.filter((n) => n.inPipeline).length,
    expansionPaths: expansions.length,
    byScope: { national: 0, provincial: 0, regional: 0, local: 0, council: 0 },
    bySector: {},
    byProvince: {},
  }
  for (const node of all) {
    stats.byScope[node.unionScope] = (stats.byScope[node.unionScope] ?? 0) + 1
    const sector = node.sector as keyof typeof stats.bySector
    stats.bySector[sector] = (stats.bySector[sector] ?? 0) + 1
    if (node.province) {
      stats.byProvince[node.province] = (stats.byProvince[node.province] ?? 0) + 1
    }
  }
  return stats
}