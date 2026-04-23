/**
 * Per-org auth policy — single source of truth for which sign-in methods
 * an organization permits. Defaults are permissive (all methods on, none
 * required) so existing orgs without a row continue to work unchanged.
 *
 * Used by:
 *   - magic-link service (blocks request when allowMagicLink=false)
 *   - login form / discovery endpoint (decides which buttons to show)
 *   - invite service (when requireInvite=true, signup is disabled)
 */
import { db } from '@nzila/db/client'
import { authOrgPolicies, authUsers } from '@nzila/db/schema'
import { eq, sql } from 'drizzle-orm'

export interface OrgAuthPolicy {
  organizationId: string | null
  allowLocalAuth: boolean
  allowMagicLink: boolean
  allowSso: boolean
  requireSso: boolean
  requireInvite: boolean
  passwordResetAllowed: boolean
  allowedEmailDomains: string[]
  mfaRequiredForRoles: string[]
}

const DEFAULT_POLICY: OrgAuthPolicy = {
  organizationId: null,
  allowLocalAuth: true,
  allowMagicLink: true,
  allowSso: true,
  requireSso: false,
  requireInvite: false,
  passwordResetAllowed: true,
  allowedEmailDomains: [],
  mfaRequiredForRoles: [],
}

export async function getOrgAuthPolicy(
  organizationId: string | null | undefined,
): Promise<OrgAuthPolicy> {
  if (!organizationId) return DEFAULT_POLICY
  const [row] = await db
    .select()
    .from(authOrgPolicies)
    .where(eq(authOrgPolicies.organizationId, organizationId))
    .limit(1)
  if (!row) return { ...DEFAULT_POLICY, organizationId }
  return {
    organizationId,
    allowLocalAuth: row.allowLocalAuth,
    allowMagicLink: row.allowMagicLink,
    allowSso: row.allowSso,
    requireSso: row.requireSso,
    requireInvite: row.requireInvite,
    passwordResetAllowed: row.passwordResetAllowed,
    allowedEmailDomains: Array.isArray(row.allowedEmailDomains)
      ? (row.allowedEmailDomains as unknown as string[])
      : [],
    mfaRequiredForRoles: Array.isArray(row.mfaRequiredForRoles)
      ? (row.mfaRequiredForRoles as unknown as string[])
      : [],
  }
}

export interface MethodAvailability {
  password: boolean
  magicLink: boolean
  sso: boolean
  passwordReset: boolean
  /** True when the chosen org demands SSO and other modes are hidden. */
  ssoRequired: boolean
  /** True when the org disallows self-service signup (invite-only). */
  inviteRequired: boolean
}

/**
 * Return which sign-in methods the UI should render.
 *
 * - Without `email` and without `organizationId` we return platform defaults.
 * - With `email`, we look up whether the user already exists (so the UI can
 *   suppress "Create account" hints if they do — purely a UX nicety, never a
 *   security boundary).
 * - With `organizationId`, the org policy is applied.
 */
export async function getAuthMethodAvailability(
  email?: string | null,
  organizationId?: string | null,
): Promise<MethodAvailability & { userExists: boolean | null }> {
  const policy = await getOrgAuthPolicy(organizationId)

  let userExists: boolean | null = null
  if (email && email.includes('@')) {
    const normalised = email.toLowerCase().trim()
    const [row] = await db
      .select({ id: authUsers.userId })
      .from(authUsers)
      .where(sql`lower(${authUsers.email}) = ${normalised}`)
      .limit(1)
    userExists = Boolean(row)
  }

  if (policy.requireSso) {
    return {
      password: false,
      magicLink: false,
      sso: true,
      passwordReset: false,
      ssoRequired: true,
      inviteRequired: policy.requireInvite,
      userExists,
    }
  }

  return {
    password: policy.allowLocalAuth,
    magicLink: policy.allowMagicLink,
    sso: policy.allowSso,
    passwordReset: policy.allowLocalAuth && policy.passwordResetAllowed,
    ssoRequired: false,
    inviteRequired: policy.requireInvite,
    userExists,
  }
}
