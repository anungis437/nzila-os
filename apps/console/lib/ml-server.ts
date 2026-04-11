/**
 * Server-side ML client for Console pages (RSC).
 *
 * Dogfoods @nzila/ml-sdk by calling the Console's own /api/ml/* routes.
 * Auth is forwarded via getToken() so RBAC is enforced
 * identically to external callers.
 *
 * Usage in any RSC page:
 *   import { mlClient, getEntityId } from '@/lib/ml-server'
 *   const models = await mlClient().getActiveModels(getEntityId())
 */
import { auth } from '@nzila/platform-auth/entra/server'
import { createMlClient, type MlClient } from '@nzila/ml-sdk'

const BASE_URL =
  process.env.NEXT_PUBLIC_CONSOLE_URL ??
  process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` :
  'http://localhost:3001'

/**
 * Create an MlClient backed by this Console's own API routes.
 * Inherits the current user's auth session.
 */
export function mlClient(): MlClient {
  return createMlClient({
    baseUrl: BASE_URL,
    getToken: async () => {
      const session = await auth()
      const token = await session.getToken()
      return token ?? ''
    },
  })
}

/**
 * Default entity resolution — same as pages used to do with
 * DEFAULT_ENTITY_ID. Centralised here so it can be evolved
 * (e.g., read from user's active org in auth metadata).
 */
export function getEntityId(): string {
  return process.env.NZILA_DEFAULT_ENTITY_ID ?? ''
}
