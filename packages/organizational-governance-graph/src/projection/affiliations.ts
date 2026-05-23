/**
 * Affiliation projection — Congress memberships → affiliated_with edges.
 */
import type { EntityEdge } from '@nzila/platform-entity-graph'
import type { CongressMembershipSource } from '../adapters/source-adapter'
import { normalizeLifecycleStatus } from '../lifecycle/normalize'
import {
  IggEntityKinds,
  IggRelationshipKinds,
  substrateRelationshipFor,
  substrateTypeFor,
} from '../ontology/kinds'

export function projectAffiliationEdges(
  rows: readonly CongressMembershipSource[],
): readonly EntityEdge[] {
  return rows.map((row) => {
    const lifecycle = normalizeLifecycleStatus(row.status)
    return {
      id: `igg:affiliated_with:${row.id}`,
      sourceEntityType: substrateTypeFor(IggEntityKinds.UNION),
      sourceEntityId: row.memberOrganizationId,
      targetEntityType: substrateTypeFor(IggEntityKinds.CONGRESS),
      targetEntityId: row.congressId,
      relationshipType: substrateRelationshipFor(
        IggRelationshipKinds.AFFILIATED_WITH,
      ),
      metadata: {
        iggKind: IggRelationshipKinds.AFFILIATED_WITH,
        sourceRecordId: row.id,
        lifecycleStatus: lifecycle.status,
        originalStatus: lifecycle.originalStatus,
        ...(lifecycle.warning ? { lifecycleWarning: lifecycle.warning } : {}),
        ...(row.validFrom ? { validFrom: row.validFrom } : {}),
        ...(row.validTo ? { validTo: row.validTo } : {}),
        ...(row.metadata ?? {}),
      },
    }
  })
}
