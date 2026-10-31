/**
 * Governance momentum requires time-series governance outcomes and validated baselines.
 * Cognition-memory entry counts cannot substantiate institutional acceleration or sustainability.
 * Preserve this callable interface, but refuse invented scores until a governed model exists.
 */
import { ApiError } from '@/lib/api/errors';
import type { GovernanceMomentumProfile } from './momentum-models';

export async function modelGovernanceMomentum(
  _organizationId: string,
): Promise<GovernanceMomentumProfile> {
  throw ApiError.notImplemented('Governance momentum is not implemented: measured governance outcomes and a validated baseline are required.');
}
