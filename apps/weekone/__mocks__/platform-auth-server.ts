/**
 * Vitest mock for @nzila/platform-auth/entra/server
 *
 * Prevents next-auth → next/server import chain from crashing in unit tests.
 */

export async function auth() {
  return { userId: "test-user", user: { id: "test-user", email: "test@example.com" } };
}

export const getAuth = auth;

export function authMiddleware() {
  return async () => {};
}

export function createRouteMatcher() {
  return () => false;
}
