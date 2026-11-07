/**
 * Operational coordination requires observed hand-offs and cross-team response records. Counts of cognition-memory entries are not a coordination measurement.
 * The engine previously derived scores and labels from those counts with arbitrary scaling
 * (DEF-0B7-COGB-ENTRY-COUNT-PROXIES-LABELLED-AS-COORDINATION-RHYTHM-ELASTICITY-AND-TRUST, DEF-0B7-COGA-COHERENCE-AND-MOMENTUM-ARE-LITERALS-AND-ENTRY-COUNT-RATIOS).
 * Preserve this callable interface, but refuse invented scores until a governed model exists.
 */
import { ApiError } from '@/lib/api/errors';
import type { OperationalCoordinationProfile } from './coordination-models';

export async function modelCoordinationBehavior(
  _organizationId: string,
): Promise<OperationalCoordinationProfile> {
  throw ApiError.notImplemented('Operational coordination analysis is not implemented: observed coordination records are required, not cognition-memory entry counts.');
}
