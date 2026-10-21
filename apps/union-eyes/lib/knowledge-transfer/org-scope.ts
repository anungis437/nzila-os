/**
 * Tenant scope for the knowledge-transfer stores.
 *
 * ue_cognition_memory and ue_reasoning_sessions are created by platform
 * migration 0012 and protected by FORCE RLS (scoped 0018). Every statement
 * runs inside withRLSContext so it executes on the tenant runtime identity
 * with app.current_org_id bound to the organization. Application code never
 * creates or alters these relations.
 */

import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: unknown): value is string {
  return typeof value === 'string' && UUID_PATTERN.test(value);
}

export async function inOrganization<T>(
  organizationId: string,
  operation: (tx: RLSTx) => Promise<T>,
): Promise<T> {
  if (!isUuid(organizationId)) {
    throw new Error('organizationId must be a UUID');
  }
  return withRLSContext({ organizationId }, operation);
}
