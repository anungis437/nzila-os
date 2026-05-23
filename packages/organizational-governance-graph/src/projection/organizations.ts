/**
 * Organization projection — Source rows → EntityNode + parent_of EntityEdge.
 *
 * Pure function; no IO. Preserves source identifiers as-is in
 * `entityId` so downstream consumers can join back to the FK schema.
 */
import type { EntityEdge, EntityNode } from '@nzila/platform-entity-graph'
import type { OrganizationSource } from '../adapters/source-adapter'
import { normalizeLifecycleStatus } from '../lifecycle/normalize'
import {
  IggEntityKinds,
  IggRelationshipKinds,
  substrateRelationshipFor,
  substrateTypeFor,
  type IggEntityKind,
} from '../ontology/kinds'

const ORG_TYPE_TO_IGG_KIND: Record<
  OrganizationSource['organizationType'],
  IggEntityKind
> = {
  platform: IggEntityKinds.PLATFORM,
  congress: IggEntityKinds.CONGRESS,
  federation: IggEntityKinds.FEDERATION,
  union: IggEntityKinds.UNION,
  local: IggEntityKinds.LOCAL,
  region: IggEntityKinds.REGION,
  district: IggEntityKinds.DISTRICT,
}

export function projectOrganizationNodes(
  rows: readonly OrganizationSource[],
): readonly EntityNode[] {
  return rows.map((row) => {
    const iggKind = ORG_TYPE_TO_IGG_KIND[row.organizationType]
    const lifecycle = normalizeLifecycleStatus(row.status)
    return {
      entityType: substrateTypeFor(iggKind),
      entityId: row.id,
      tenantId: row.tenantId,
      canonicalName: row.name,
      status: lifecycle.status,
      metadata: {
        iggKind,
        slug: row.slug,
        organizationType: row.organizationType,
        hierarchyPath: row.hierarchyPath,
        hierarchyLevel: row.hierarchyLevel,
        originalStatus: lifecycle.originalStatus,
        ...(lifecycle.warning ? { lifecycleWarning: lifecycle.warning } : {}),
        ...(row.metadata ?? {}),
      },
    }
  })
}

export function projectOrganizationHierarchyEdges(
  rows: readonly OrganizationSource[],
): readonly EntityEdge[] {
  const edges: EntityEdge[] = []
  for (const row of rows) {
    if (!row.parentId) continue
    const parentKindGuess = ORG_TYPE_TO_IGG_KIND[row.organizationType]
    edges.push({
      id: `igg:parent_of:${row.parentId}->${row.id}`,
      sourceEntityType: substrateTypeFor(parentKindGuess),
      sourceEntityId: row.parentId,
      targetEntityType: substrateTypeFor(parentKindGuess),
      targetEntityId: row.id,
      relationshipType: substrateRelationshipFor(IggRelationshipKinds.PARENT_OF),
      metadata: {
        iggKind: IggRelationshipKinds.PARENT_OF,
        childOrganizationType: row.organizationType,
        hierarchyLevel: row.hierarchyLevel,
      },
    })
  }
  return edges
}
