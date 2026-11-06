/**
 * Systems dynamics requires measured coupling between subsystems. Weighted sums of cognition-memory entry counts are not a systems measurement.
 * The engine previously derived scores and labels from those counts with arbitrary scaling
 * (DEF-0B7-COGB-ENTRY-COUNT-PROXIES-LABELLED-AS-COORDINATION-RHYTHM-ELASTICITY-AND-TRUST, DEF-0B7-COGA-COHERENCE-AND-MOMENTUM-ARE-LITERALS-AND-ENTRY-COUNT-RATIOS).
 * Preserve this callable interface, but refuse invented scores until a governed model exists.
 */
import { ApiError } from '@/lib/api/errors';
import type { SystemsDynamicsProfile } from './systems-models';

export async function analyzeSystemsDynamics(
  _organizationId: string,
): Promise<SystemsDynamicsProfile> {
  throw ApiError.notImplemented('Systems dynamics analysis is not implemented: measured subsystem coupling is required, not weighted cognition-memory entry counts.');
}
