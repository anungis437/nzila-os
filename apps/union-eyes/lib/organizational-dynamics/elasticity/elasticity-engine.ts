/**
 * Response elasticity requires observed stressors, intervention timestamps and recovery outcomes.
 * Counts of cognition-memory entries are not measurements of those quantities.
 * Preserve this callable interface, but refuse invented scores until a governed model exists.
 */
import { ApiError } from '@/lib/api/errors';
import type { OrganizationalResponseElasticityProfile } from './elasticity-models';

export async function measureOrganizationalElasticity(
  _organizationId: string,
): Promise<OrganizationalResponseElasticityProfile> {
  throw ApiError.notImplemented('Organizational response elasticity is not implemented: measured response and recovery evidence is required.');
}
