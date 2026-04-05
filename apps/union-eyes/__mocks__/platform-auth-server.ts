/**
 * Vitest mock for @nzila/platform-auth/entra/server
 *
 * Prevents next-auth → next/server import chain from crashing in unit tests.
 * Tests that need auth behaviour should vi.mock() this module with specific implementations.
 */

export async function auth() {
  return { userId: null, orgId: null, sessionClaims: null, has: () => false }
}

export async function currentUser() {
  return null
}

export const getAuth = auth

export function clerkMiddleware() {
  return async () => {}
}

export function createRouteMatcher() {
  return () => false
}
