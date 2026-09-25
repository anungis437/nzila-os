/**
 * Request-scoped identity already established by an authenticated API
 * boundary (withApi → getCurrentUser).
 *
 * withRLSContext's primary source is platform auth(). That call returns no
 * user for a PG-session login, and the unit-test platform-auth stub does the
 * same, even when getCurrentUser() has already authenticated the request.
 * The boundary publishes that identity here so withRLSContext can apply
 * app.current_user_id without a second, divergent login check.
 *
 * This is not an impersonation channel:
 * - only the user id getCurrentUser() already returned is stored
 * - a platform session that names a different user fails closed
 * - org scoping is unchanged (explicit organizationId or auth org, fail closed)
 */
import { AsyncLocalStorage } from 'node:async_hooks';

export interface EstablishedRequestAuth {
  userId: string;
}

export const establishedRequestAuth = new AsyncLocalStorage<EstablishedRequestAuth>();

export function runWithEstablishedRequestAuth<T>(
  userId: string | null | undefined,
  operation: () => Promise<T>,
): Promise<T> {
  if (!userId) return operation();
  return establishedRequestAuth.run({ userId }, operation);
}
