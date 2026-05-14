/**
 * Representation projection — protocol-aware `represents` edge materializer.
 *
 * The platform contains multiple representation models (steward-led,
 * LRO-led, national-rep-led). The Phase-1 audit established that
 * representation is **protocol-driven** and must be consulted before any
 * `represents` edge is materialized.
 *
 * This projector NEVER reads the protocol JSON column directly; it consumes
 * already-resolved `RepresentationProtocolSource` rows produced by the
 * adapter (which is responsible for parsing the JSON and emitting one row
 * per active representative-represented pair).
 */
import type { EntityEdge } from '@nzila/platform-entity-graph'
import type { RepresentationProtocolSource } from '../adapters/source-adapter'
import { normalizeLifecycleStatus } from '../lifecycle/normalize'
import {
  IggEntityKinds,
  IggRelationshipKinds,
  substrateRelationshipFor,
  substrateTypeFor,
} from '../ontology/kinds'

export function projectRepresentationEdges(
  rows: readonly RepresentationProtocolSource[],
): readonly EntityEdge[] {
  const edges: EntityEdge[] = []
  for (const row of rows) {
    const lifecycle = normalizeLifecycleStatus(row.status)
    // Only materialize active or provisional representations. Suspended /
    // expired / unknown rows are preserved at the adapter level but NOT
    // surfaced as live edges.
    if (
      lifecycle.status !== 'active' &&
      lifecycle.status !== 'provisional' &&
      lifecycle.status !== 'pending'
    ) {
      continue
    }
    edges.push({
      id: `igg:represents:${row.id}`,
      // Default substrate fallback — concrete kinds preserved in metadata.
      sourceEntityType: substrateTypeFor(IggEntityKinds.MEMBER),
      sourceEntityId: row.representativeEntityId,
      targetEntityType: substrateTypeFor(IggEntityKinds.MEMBER),
      targetEntityId: row.representedEntityId,
      relationshipType: substrateRelationshipFor(IggRelationshipKinds.REPRESENTS),
      metadata: {
        iggKind: IggRelationshipKinds.REPRESENTS,
        sourceRecordId: row.id,
        representativeEntityType: row.representativeEntityType,
        representedEntityType: row.representedEntityType,
        protocolVersion: row.protocolVersion,
        lifecycleStatus: lifecycle.status,
        originalStatus: lifecycle.originalStatus,
        ...(row.validFrom ? { validFrom: row.validFrom } : {}),
        ...(row.validTo ? { validTo: row.validTo } : {}),
        ...(row.metadata ?? {}),
      },
    })
  }
  return edges
}
