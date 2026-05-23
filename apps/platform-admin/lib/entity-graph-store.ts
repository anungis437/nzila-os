/**
 * Platform Admin — Drizzle-backed Entity Graph Store
 *
 * Implements the `EntityGraphStore` interface from `@nzila/platform-entity-graph`
 * against the local `platform_entity_nodes` / `platform_entity_edges` tables.
 * Lives in the app (not the package) so the package stays free of a Drizzle
 * runtime dependency — see the package's narrow dependency list.
 */
import { and, asc, eq } from 'drizzle-orm'
import { z } from 'zod'
import { platformDb } from '@nzila/db/platform'
import {
  platformEntityEdges,
  platformEntityNodes,
} from '@nzila/db/schema'
import {
  OntologyEntityTypes,
  RelationshipTypes,
  type OntologyEntityType,
  type RelationshipType,
} from '@nzila/platform-ontology'
import type {
  EntityEdge,
  EntityGraphStore,
  EntityNode,
} from '@nzila/platform-entity-graph'

const ENTITY_TYPE_VALUES = Object.values(OntologyEntityTypes) as [
  OntologyEntityType,
  ...OntologyEntityType[],
]
const RELATIONSHIP_TYPE_VALUES = Object.values(RelationshipTypes) as [
  RelationshipType,
  ...RelationshipType[],
]

export const createEntityNodeSchema = z.object({
  entityType: z.enum(ENTITY_TYPE_VALUES),
  entityId: z.string().min(1).max(200),
  canonicalName: z.string().min(1).max(400),
  status: z.string().min(1).max(64).default('active'),
  metadata: z.record(z.string(), z.unknown()).default({}),
})
export type CreateEntityNodeInput = z.infer<typeof createEntityNodeSchema>

export const createEntityEdgeSchema = z.object({
  id: z.string().min(1).max(200).optional(),
  sourceEntityType: z.enum(ENTITY_TYPE_VALUES),
  sourceEntityId: z.string().min(1).max(200),
  targetEntityType: z.enum(ENTITY_TYPE_VALUES),
  targetEntityId: z.string().min(1).max(200),
  relationshipType: z.enum(RELATIONSHIP_TYPE_VALUES),
  metadata: z.record(z.string(), z.unknown()).default({}),
})
export type CreateEntityEdgeInput = z.infer<typeof createEntityEdgeSchema>

// ── Row mapping ──────────────────────────────────────────────────────────────

function nodeFromRow(r: typeof platformEntityNodes.$inferSelect): EntityNode {
  const meta = (r.metadata ?? {}) as Record<string, unknown>
  return {
    entityType: r.entityType as OntologyEntityType,
    entityId: r.entityId,
    tenantId: r.tenantId,
    canonicalName: r.canonicalName,
    status: r.status,
    metadata: meta,
  }
}

function edgeFromRow(r: typeof platformEntityEdges.$inferSelect): EntityEdge {
  const meta = (r.metadata ?? {}) as Record<string, unknown>
  return {
    id: r.id,
    sourceEntityType: r.sourceEntityType as OntologyEntityType,
    sourceEntityId: r.sourceEntityId,
    targetEntityType: r.targetEntityType as OntologyEntityType,
    targetEntityId: r.targetEntityId,
    relationshipType: r.relationshipType as RelationshipType,
    metadata: meta,
  }
}

// ── Store ────────────────────────────────────────────────────────────────────

export function createDrizzleGraphStore(): EntityGraphStore {
  return {
    async getNode(tenantId, entityType, entityId) {
      const [row] = await platformDb
        .select()
        .from(platformEntityNodes)
        .where(
          and(
            eq(platformEntityNodes.tenantId, tenantId),
            eq(platformEntityNodes.entityType, entityType),
            eq(platformEntityNodes.entityId, entityId),
          ),
        )
        .limit(1)
      return row ? nodeFromRow(row) : undefined
    },

    async getEdges(tenantId, entityType, entityId) {
      const rows = await platformDb
        .select()
        .from(platformEntityEdges)
        .where(eq(platformEntityEdges.tenantId, tenantId))
      // Filter for edges touching the node in either direction.
      return rows
        .filter(
          (r) =>
            (r.sourceEntityType === entityType && r.sourceEntityId === entityId) ||
            (r.targetEntityType === entityType && r.targetEntityId === entityId),
        )
        .map(edgeFromRow)
    },

    async addNode(node) {
      await platformDb
        .insert(platformEntityNodes)
        .values({
          tenantId: node.tenantId,
          entityType: node.entityType,
          entityId: node.entityId,
          canonicalName: node.canonicalName,
          status: node.status,
          metadata: node.metadata as Record<string, unknown>,
        })
        .onConflictDoUpdate({
          target: [
            platformEntityNodes.tenantId,
            platformEntityNodes.entityType,
            platformEntityNodes.entityId,
          ],
          set: {
            canonicalName: node.canonicalName,
            status: node.status,
            metadata: node.metadata as Record<string, unknown>,
            updatedAt: new Date(),
          },
        })
    },

    async addEdge(edge) {
      // EntityEdge has no tenantId — derive it from the source node so that
      // edges always belong to the same tenant as their endpoints.
      const [src] = await platformDb
        .select({ tenantId: platformEntityNodes.tenantId })
        .from(platformEntityNodes)
        .where(
          and(
            eq(platformEntityNodes.entityType, edge.sourceEntityType),
            eq(platformEntityNodes.entityId, edge.sourceEntityId),
          ),
        )
        .limit(1)
      if (!src) {
        throw new Error(
          `addEdge: source node ${edge.sourceEntityType}:${edge.sourceEntityId} not found`,
        )
      }
      await platformDb
        .insert(platformEntityEdges)
        .values({
          id: edge.id,
          tenantId: src.tenantId,
          sourceEntityType: edge.sourceEntityType,
          sourceEntityId: edge.sourceEntityId,
          targetEntityType: edge.targetEntityType,
          targetEntityId: edge.targetEntityId,
          relationshipType: edge.relationshipType,
          metadata: edge.metadata as Record<string, unknown>,
        })
        .onConflictDoNothing()
    },

    async removeEdge(edgeId) {
      await platformDb
        .delete(platformEntityEdges)
        .where(eq(platformEntityEdges.id, edgeId))
    },
  }
}

// ── List helpers (org-scoped) ────────────────────────────────────────────────

export async function listAllNodes(
  tenantId: string,
  limit = 500,
): Promise<EntityNode[]> {
  const rows = await platformDb
    .select()
    .from(platformEntityNodes)
    .where(eq(platformEntityNodes.tenantId, tenantId))
    .orderBy(asc(platformEntityNodes.entityType), asc(platformEntityNodes.canonicalName))
    .limit(limit)
  return rows.map(nodeFromRow)
}

export async function listAllEdges(
  tenantId: string,
  limit = 2_000,
): Promise<EntityEdge[]> {
  const rows = await platformDb
    .select()
    .from(platformEntityEdges)
    .where(eq(platformEntityEdges.tenantId, tenantId))
    .limit(limit)
  return rows.map(edgeFromRow)
}

export async function insertNode(
  tenantId: string,
  input: CreateEntityNodeInput,
): Promise<EntityNode> {
  const [row] = await platformDb
    .insert(platformEntityNodes)
    .values({
      tenantId,
      entityType: input.entityType,
      entityId: input.entityId,
      canonicalName: input.canonicalName,
      status: input.status,
      metadata: input.metadata,
    })
    .onConflictDoUpdate({
      target: [
        platformEntityNodes.tenantId,
        platformEntityNodes.entityType,
        platformEntityNodes.entityId,
      ],
      set: {
        canonicalName: input.canonicalName,
        status: input.status,
        metadata: input.metadata,
        updatedAt: new Date(),
      },
    })
    .returning()
  return nodeFromRow(row)
}

export async function insertEdge(
  tenantId: string,
  input: CreateEntityEdgeInput,
): Promise<EntityEdge> {
  const id =
    input.id ??
    `${input.sourceEntityType}:${input.sourceEntityId}->${input.relationshipType}->${input.targetEntityType}:${input.targetEntityId}`
  const [row] = await platformDb
    .insert(platformEntityEdges)
    .values({
      id,
      tenantId,
      sourceEntityType: input.sourceEntityType,
      sourceEntityId: input.sourceEntityId,
      targetEntityType: input.targetEntityType,
      targetEntityId: input.targetEntityId,
      relationshipType: input.relationshipType,
      metadata: input.metadata,
    })
    .onConflictDoUpdate({
      target: platformEntityEdges.id,
      set: { metadata: input.metadata },
    })
    .returning()
  return edgeFromRow(row)
}
