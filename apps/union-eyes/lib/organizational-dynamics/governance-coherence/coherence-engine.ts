/**
 * Governance coherence requires measured decision outcomes and policy alignment evidence. Ratios of cognition-memory entry types (e.g. governance entries over all entries, scaled by 200) are not a coherence measurement.
 * The engine previously derived scores and labels from those counts with arbitrary scaling
 * (DEF-0B7-COGB-ENTRY-COUNT-PROXIES-LABELLED-AS-COORDINATION-RHYTHM-ELASTICITY-AND-TRUST, DEF-0B7-COGA-COHERENCE-AND-MOMENTUM-ARE-LITERALS-AND-ENTRY-COUNT-RATIOS).
 * Preserve this callable interface, but refuse invented scores until a governed model exists.
 */
import { ApiError } from '@/lib/api/errors';
import type { GovernanceCoherenceProfile } from './coherence-models';

export async function evaluateGovernanceCoherence(
  _organizationId: string,
): Promise<GovernanceCoherenceProfile> {
  throw ApiError.notImplemented('Governance coherence analysis is not implemented: measured governance outcomes are required, not ratios of cognition-memory entry counts.');
}
