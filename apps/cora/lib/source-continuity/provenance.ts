import type { ProvenanceEdge, SourceCapture } from './contracts'

export function createCaptureProvenance(capture: SourceCapture): ProvenanceEdge[] {
  const { sourceRef, sourceAuthority, acquisitionRoute } = capture
  const shared = {
    sourceProviderId: sourceRef.providerId,
    acquisitionChannel: acquisitionRoute.channel,
    occurredAt: capture.capturedAt,
  }

  return [
    {
      edgeId: `${capture.captureId}:authority`,
      fromRef: sourceAuthority.authorityId,
      toRef: `${sourceRef.providerId}:${sourceRef.objectType}:${sourceRef.objectId}`,
      relation: 'ASSERTED_BY',
      sourceAuthorityId: sourceAuthority.authorityId,
      ...shared,
    },
    {
      edgeId: `${capture.captureId}:observation`,
      fromRef: capture.captureId,
      toRef: `${sourceRef.providerId}:${sourceRef.objectType}:${sourceRef.objectId}`,
      relation: 'OBSERVED_FROM',
      sourceAuthorityId: sourceAuthority.authorityId,
      ...shared,
    },
    {
      edgeId: `${capture.captureId}:route`,
      fromRef: capture.captureId,
      toRef: acquisitionRoute.acquisitionProviderId ?? acquisitionRoute.channel,
      relation: 'ACQUIRED_VIA',
      ...shared,
    },
  ]
}
