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
import { headers } from 'next/headers'

function resolveBaseUrl(): string {
  const configured = process.env.NEXT_PUBLIC_CONSOLE_URL
  if (configured) return configured

  if (process.env.VERCEL_URL) {
    return `https://${process.env.VERCEL_URL}`
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('NEXT_PUBLIC_CONSOLE_URL is required in production for ML server routes')
  }

  // Local dogfooding default for Console dev server.
  return 'http://localhost:3001'
}

/**
 * Create an MlClient backed by this Console's own API routes.
 * Inherits the current user's auth session.
 */
export function mlClient(): MlClient {
  return createMlClient({
    baseUrl: resolveBaseUrl(),
    getToken: async () => {
      const session = await auth()
      const token = await session.getToken()
      return token ?? ''
    },
    getRequestHeaders: async () => {
      const requestHeaders = await headers()
      const cookie = requestHeaders.get('cookie')
      const forwardedHeaders: Record<string, string> = {}
      if (cookie) {
        forwardedHeaders.cookie = cookie
      }
      return forwardedHeaders
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
