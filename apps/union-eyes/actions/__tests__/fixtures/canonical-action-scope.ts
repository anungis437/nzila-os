import type { AuthenticatedOrgBinding } from '@nzila/platform-auth/org-binding'
import { withCanonicalRequestScope } from '@/lib/auth/canonical-request-scope'
import { UserRole } from '@/lib/auth/roles'

export const ACTION_ORG = '11111111-1111-4111-8111-111111111111'
export const ACTION_ACTOR = 'canonical-action-actor'

/** Trusted component setup after a synthetic canonical binder. Production
 * gateway/session proof is separate; no authentication verdict is mocked. */
export function canonicalActionScope<T>(
  operation: () => Promise<T>,
  options: {
    userId?: string
    organizationId?: string
    role?: UserRole
    expiresAt?: Date
  } = {},
) {
  const binding: AuthenticatedOrgBinding = {
    userId: options.userId ?? ACTION_ACTOR,
    organizationId: options.organizationId ?? ACTION_ORG,
    role: options.role ?? UserRole.MEMBER,
    expiresAt: options.expiresAt ?? new Date(Date.now() + 60_000),
    authority: 'pg-session',
    sessionToken: 'synthetic-component-only-never-a-live-bearer',
  }
  return withCanonicalRequestScope(
    binding,
    {
      userId: binding.userId,
      organizationId: binding.organizationId,
      role: options.role ?? UserRole.MEMBER,
      email: 'component@example.invalid',
      firstName: 'Synthetic',
      lastName: 'Actor',
      isSystemAdmin: false,
    },
    operation,
  )
}
