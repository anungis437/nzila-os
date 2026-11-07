/**
 * Operating rhythm requires scheduled and held governance cycles. Gaps between cognition-memory entries are not an institutional rhythm.
 * The engine previously derived scores and labels from those counts with arbitrary scaling
 * (DEF-0B7-COGB-ENTRY-COUNT-PROXIES-LABELLED-AS-COORDINATION-RHYTHM-ELASTICITY-AND-TRUST, DEF-0B7-COGA-COHERENCE-AND-MOMENTUM-ARE-LITERALS-AND-ENTRY-COUNT-RATIOS).
 * Preserve this callable interface, but refuse invented scores until a governed model exists.
 */
import { ApiError } from '@/lib/api/errors';
import type { OperatingRhythmProfile } from './rhythms-models';

export async function analyzeInstitutionalRhythms(
  _organizationId: string,
): Promise<OperatingRhythmProfile> {
  throw ApiError.notImplemented('Operating rhythm analysis is not implemented: recorded governance cycles are required, not the spacing of cognition-memory entries.');
}
