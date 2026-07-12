/**
 * Platform Admin — SAGE evidence view mappers (pure, server or client safe)
 *
 * Pure functions that project SAGE evidence domain objects onto browser-safe
 * response shapes. No I/O, no audit internals, no raw SQL rows. Emit only
 * factual attributes and the lifecycle *state* — never a score, rank, grade,
 * certification, or any conclusion derived from the evidence.
 */
import type { SageEvidenceItem, SageEvidenceSource } from '@nzila/sage-core'
import type {
  SageEvidenceItemListResponse,
  SageEvidenceItemResponse,
  SageEvidenceSourceListResponse,
  SageEvidenceSourceResponse,
} from './evidence-schemas'

export function toEvidenceSourceResponse(
  source: SageEvidenceSource,
): SageEvidenceSourceResponse {
  return {
    id: source.id,
    sourceType: source.sourceType,
    sourceQuality: source.sourceQuality ?? null,
    authorizationLevel: source.authorizationLevel,
    containsPersonalInformation: source.containsPersonalInformation,
    containsSensitiveInformation: source.containsSensitiveInformation,
    classified: source.classified,
    createdAt: source.createdAt,
  }
}

export function toEvidenceSourceListResponse(
  sources: SageEvidenceSource[],
): SageEvidenceSourceListResponse {
  return { sources: sources.map(toEvidenceSourceResponse) }
}

export function toEvidenceItemResponse(item: SageEvidenceItem): SageEvidenceItemResponse {
  return {
    id: item.id,
    sourceId: item.sourceId,
    lifecycleState: item.lifecycleState,
    confidenceLevel: item.confidenceLevel ?? null,
    excludedFromExternalReview: item.excludedFromExternalReview,
    humanReviewRequired: item.humanReviewRequired,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

export function toEvidenceItemListResponse(
  items: SageEvidenceItem[],
): SageEvidenceItemListResponse {
  return { items: items.map(toEvidenceItemResponse) }
}
