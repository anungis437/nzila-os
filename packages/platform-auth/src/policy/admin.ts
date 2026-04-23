/**
 * Admin mutations for org auth policy.
 *
 * Read happens via `getOrgAuthPolicy` in ./service. Writes here are gated
 * at the HTTP route layer — service functions assume the caller is already
 * authorised. Every change produces an audit entry with before/after diff.
 */
import { db } from '@nzila/db/client'
import { authOrgPolicies, authAuditLog } from '@nzila/db/schema'
import { eq } from 'drizzle-orm'
import { getOrgAuthPolicy, type OrgAuthPolicy } from './service'

export interface PolicyPatch {
  allowLocalAuth?: boolean
  allowMagicLink?: boolean
  allowSso?: boolean
  requireSso?: boolean
  requireInvite?: boolean
  passwordResetAllowed?: boolean
  allowedEmailDomains?: string[]
  mfaRequiredForRoles?: string[]
}

export interface UpdatePolicyInput {
  organizationId: string
  actorUserId: string
  patch: PolicyPatch
}

export interface UpdatePolicyResult {
  success: boolean
  policy?: OrgAuthPolicy
  error?: string
}

function validatePatch(patch: PolicyPatch): string | null {
  if (patch.requireSso === true && patch.allowSso === false) {
    return 'Cannot require SSO while disabling it'
  }
  if (patch.allowedEmailDomains) {
    for (const d of patch.allowedEmailDomains) {
      if (typeof d !== 'string' || !d.match(/^[a-z0-9.-]+$/i)) {
        return `Invalid email domain: ${d}`
      }
    }
  }
  if (patch.mfaRequiredForRoles) {
    const validRoles = new Set([
      'member',
      'steward',
      'chief_steward',
      'admin',
      'coo',
      'app_owner',
      'platform_admin',
    ])
    for (const r of patch.mfaRequiredForRoles) {
      if (!validRoles.has(r)) return `Invalid role: ${r}`
    }
  }
  return null
}

export async function updateOrgAuthPolicy(
  input: UpdatePolicyInput,
): Promise<UpdatePolicyResult> {
  const err = validatePatch(input.patch)
  if (err) return { success: false, error: err }

  const before = await getOrgAuthPolicy(input.organizationId)

  // Upsert. If no row existed, insert with defaults + patch.
  const [existing] = await db
    .select({ organizationId: authOrgPolicies.organizationId })
    .from(authOrgPolicies)
    .where(eq(authOrgPolicies.organizationId, input.organizationId))
    .limit(1)

  if (existing) {
    await db
      .update(authOrgPolicies)
      .set({
        ...(input.patch.allowLocalAuth !== undefined && {
          allowLocalAuth: input.patch.allowLocalAuth,
        }),
        ...(input.patch.allowMagicLink !== undefined && {
          allowMagicLink: input.patch.allowMagicLink,
        }),
        ...(input.patch.allowSso !== undefined && {
          allowSso: input.patch.allowSso,
        }),
        ...(input.patch.requireSso !== undefined && {
          requireSso: input.patch.requireSso,
        }),
        ...(input.patch.requireInvite !== undefined && {
          requireInvite: input.patch.requireInvite,
        }),
        ...(input.patch.passwordResetAllowed !== undefined && {
          passwordResetAllowed: input.patch.passwordResetAllowed,
        }),
        ...(input.patch.allowedEmailDomains !== undefined && {
          allowedEmailDomains: input.patch.allowedEmailDomains as unknown as object,
        }),
        ...(input.patch.mfaRequiredForRoles !== undefined && {
          mfaRequiredForRoles: input.patch.mfaRequiredForRoles as unknown as object,
        }),
        updatedBy: input.actorUserId,
        updatedAt: new Date(),
      })
      .where(eq(authOrgPolicies.organizationId, input.organizationId))
  } else {
    await db.insert(authOrgPolicies).values({
      organizationId: input.organizationId,
      allowLocalAuth: input.patch.allowLocalAuth ?? true,
      allowMagicLink: input.patch.allowMagicLink ?? true,
      allowSso: input.patch.allowSso ?? true,
      requireSso: input.patch.requireSso ?? false,
      requireInvite: input.patch.requireInvite ?? false,
      passwordResetAllowed: input.patch.passwordResetAllowed ?? true,
      allowedEmailDomains: (input.patch.allowedEmailDomains ?? []) as unknown as object,
      mfaRequiredForRoles: (input.patch.mfaRequiredForRoles ?? []) as unknown as object,
      updatedBy: input.actorUserId,
    })
  }

  const after = await getOrgAuthPolicy(input.organizationId)

  // Audit with diff
  try {
    await db.insert(authAuditLog).values({
      userId: input.actorUserId,
      eventType: 'org_policy_updated',
      metadata: {
        organizationId: input.organizationId,
        before,
        after,
      },
    })
  } catch {
    // best-effort
  }

  return { success: true, policy: after }
}
