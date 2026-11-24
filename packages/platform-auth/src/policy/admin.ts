/**
 * Admin mutations for org auth policy.
 *
 * Read happens via `getOrgAuthPolicy` in ./service. Writes here are gated
 * both at the HTTP route layer and by a validated tenant-admin execution
 * context. Every change produces an audit entry with before/after diff.
 */
import { authDb as db, withTenantAuthContext, withAuthSavepoint, insertAuthRow } from '../auth-db'
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

/** The policy a caller last read. When given, the update applies only if the stored policy is still exactly this one. */
export type ExpectedPolicy = Omit<OrgAuthPolicy, 'organizationId'>

export interface UpdatePolicyInput {
  organizationId: string
  actorUserId: string
  patch: PolicyPatch
  expected?: ExpectedPolicy
}

export interface UpdatePolicyResult {
  success: boolean
  policy?: OrgAuthPolicy
  error?: string
  /** True when `expected` no longer matches the stored policy: nothing was written. */
  conflict?: boolean
}

const BOOLEAN_FIELDS = [
  'allowLocalAuth',
  'allowMagicLink',
  'allowSso',
  'requireSso',
  'requireInvite',
  'passwordResetAllowed',
] as const

const sameSet = (a: readonly string[], b: readonly string[]) => {
  const left = new Set(a.map((value) => value.toLowerCase()))
  const right = new Set(b.map((value) => value.toLowerCase()))
  return left.size === right.size && [...left].every((value) => right.has(value))
}

function matchesExpected(current: OrgAuthPolicy, expected: ExpectedPolicy): boolean {
  return (
    BOOLEAN_FIELDS.every((key) => current[key] === expected[key]) &&
    sameSet(current.allowedEmailDomains, expected.allowedEmailDomains) &&
    sameSet(current.mfaRequiredForRoles, expected.mfaRequiredForRoles)
  )
}

/** Domains are stored lower-case, trimmed and without duplicates; roles without duplicates. What is stored is what the caller reads back. */
function normalizePatch(patch: PolicyPatch): PolicyPatch {
  const unique = (values: string[]) => [...new Set(values)]
  return {
    ...patch,
    ...(patch.allowedEmailDomains && {
      allowedEmailDomains: unique(patch.allowedEmailDomains.map((domain) => domain.trim().toLowerCase())),
    }),
    ...(patch.mfaRequiredForRoles && { mfaRequiredForRoles: unique(patch.mfaRequiredForRoles) }),
  }
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

function isUniqueViolation(error: unknown): boolean {
  const code = (error as { code?: unknown; cause?: { code?: unknown } } | null)
  return code?.code === '23505' || code?.cause?.code === '23505'
}

export async function updateOrgAuthPolicy(
  input: UpdatePolicyInput,
): Promise<UpdatePolicyResult> {
  const patch = normalizePatch(input.patch)
  const err = validatePatch(patch)
  if (err) return { success: false, error: err }
  return withTenantAuthContext(input.actorUserId, input.organizationId, () => updateWithContext({ ...input, patch }))
}

async function updateWithContext(input: UpdatePolicyInput): Promise<UpdatePolicyResult> {
  // The row is locked before it is read, so the policy compared, the diff audited and the policy written are one serialized state.
  const [existing] = await db
    .select({ organizationId: authOrgPolicies.organizationId })
    .from(authOrgPolicies)
    .where(eq(authOrgPolicies.organizationId, input.organizationId))
    .limit(1)
    .for('update')

  const before = await getOrgAuthPolicy(input.organizationId)
  if (input.expected && !matchesExpected(before, input.expected)) {
    return { success: false, conflict: true, error: 'The sign-in policy changed after it was loaded' }
  }
  const merged = { ...before, ...input.patch }
  if (merged.requireSso && !merged.allowSso) {
    return { success: false, error: 'Cannot require SSO while disabling it' }
  }

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
    // Two first saves can both find no row to lock; the loser of the key race reports a conflict instead of overwriting.
    try {
      await withAuthSavepoint(() => insertAuthRow(authOrgPolicies, {
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
      }))
    } catch (error) {
      if (isUniqueViolation(error)) {
        return { success: false, conflict: true, error: 'The sign-in policy changed after it was loaded' }
      }
      throw error
    }
  }

  const after = await getOrgAuthPolicy(input.organizationId)

  // The diff record is part of the change: if it cannot be written the policy update rolls back.
  await withAuthSavepoint(async () => db.insert(authAuditLog).values({
    userId: input.actorUserId,
    eventType: 'org_policy_updated',
    metadata: {
      organizationId: input.organizationId,
      before,
      after,
    },
  }))

  return { success: true, policy: after }
}
