/**
 * Browser-safe SAGE export evidence option projection.
 *
 * SageEvidenceItemResponse intentionally contains lifecycleState but NOT the
 * authoritative source authorizationLevel. Conflating a lifecycle value such
 * as 'linked' with authorization ('sensitive', 'internal', etc.) misrepresents
 * the protection applied to the evidence in export review.
 *
 * These labels describe lifecycle only. The SAGE service independently
 * re-checks authorization against the stored source on every export action.
 * Never populate authorizationLevel from lifecycleState.
 */
import type { SageEvidenceItemResponse } from './evidence-schemas'

export interface SageEvidenceExportOption {
  id: string
  label: string
}

/** Shows only items already authorized by the service and not excluded. */
export function buildSageEvidenceExportOptions(
  items: readonly SageEvidenceItemResponse[],
): SageEvidenceExportOption[] {
  return items
    .filter((item) => !item.excludedFromExternalReview)
    .map((item) => ({
      id: item.id,
      label: `Evidence ${item.id.slice(0, 8)} (${item.lifecycleState})`,
    }))
}
