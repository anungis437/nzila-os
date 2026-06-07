import { auth } from '@nzila/platform-auth/entra/server'

/**
 * Resolve the current user id with a development-only preview fallback.
 *
 * Production behaviour is unchanged: returns the real `userId`, or `null` when
 * unauthenticated (callers redirect to `/sign-in`). In development ONLY — when
 * there is no auth session and no local Postgres configured — this returns a
 * synthetic `'dev-preview'` id so the read-only Console surface can be validated
 * locally without standing up auth + DB.
 *
 * Centralised so the dev escape hatch is auditable in one place and can never
 * activate in a production build (`NODE_ENV === 'production'`).
 */
export async function resolveUserIdWithDevPreview(): Promise<string | null> {
  const { userId } = await auth()
  if (userId) return userId
  if (process.env.NODE_ENV !== 'production') return 'dev-preview'
  return null
}
