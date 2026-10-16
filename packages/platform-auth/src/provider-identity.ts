import { sql } from 'drizzle-orm'
import { authDb, withAuthContext } from './auth-db'
import type { ExternalIdentityBinding } from './authorization-context'

/**
 * Server-internal resolver, called only after provider credential verification.
 * The provider namespace and immutable tenant:object subject are never an email.
 */
export async function resolveExternalAuthIdentity(
  provider: string, providerSubject: string,
): Promise<ExternalIdentityBinding | null> {
  return withAuthContext({ phase: 'provider', provider, providerSubject }, async () => {
    const [resolved] = await authDb.execute(sql`SELECT user_management.auth_provider_binding() AS binding`)
    const binding = resolved?.binding as {
      id: string; provider: string; providerSubject: string; platformUserId: string; state: 'active'; verifiedAt: string
    } | null
    if (!binding) return null
    const [principal] = await authDb.execute(sql`SELECT user_id FROM user_management.users
      WHERE user_id=${binding.platformUserId} AND is_active AND lifecycle_state='active'`)
    if (!principal) return null
    return { ...binding, verifiedAt: new Date(binding.verifiedAt),
      principal: { id: binding.platformUserId, state: 'active' } }
  })
}
