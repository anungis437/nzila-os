import { resolveActiveOrgId } from '@/lib/org-context'

/**
 * Resolve the console entity UUID for the current user.
 * Prefers active org membership and falls back to NZILA_DEFAULT_ENTITY_ID.
 */
export async function resolveConsoleEntityId(userId: string): Promise<string | null> {
  const activeOrgId = await resolveActiveOrgId(userId)
  if (activeOrgId) return activeOrgId

  const fallback = process.env.NZILA_DEFAULT_ENTITY_ID ?? ''
  return fallback || null
}
