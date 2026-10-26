/**
 * Invite service — admin-issued, hashed-at-rest, single-use org membership tokens.
 *
 * Flow:
 *   1. An authenticated admin calls createInvite(orgId, email, role).
 *      We generate a 32-byte token, store its SHA-256 hash, and return the
 *      raw token (route handler emails it; dev mode echoes it back).
 *   2. Recipient clicks /invite/accept?token=… which calls acceptInvite().
 *   3. acceptInvite() verifies the hash + expiry + non-revoked + non-accepted,
 *      ensures an authUsers row exists for the email (creating one if needed,
 *      passwordless), and inserts/updates the authOrganizationUsers row with
 *      the role specified by the inviter. Establishes a normal PG session.
 *
 * Security:
 *   • Token never stored plaintext. Replay impossible after acceptedAt is set.
 *   • The invite carries the org+role assignment, so the user cannot escalate
 *     by tampering with form data — the role comes from the row, not the body.
 *   • Acceptance locks the inviter and re-reads the invite before any
 *     membership or session write. A denial that commits first confers nothing.
 */
import { randomBytes, createHash } from 'crypto'
import { authDb as db, withAuthContext, withAuthSavepoint, withTenantAuthContext, insertAuthRow } from '../auth-db'
import { lockInviterAuthority } from '@nzila/db/auth-client'
import { AUTH_TENANT_ASSIGNABLE_ROLES } from '@nzila/db/auth-storage-authority'
import {
  authInvites,
  authUsers,
  authOrganizationUsers,
  authAuditLog,
} from '@nzila/db/schema'
import { eq, and, sql, gt, isNull } from 'drizzle-orm'
import { completeAuthFirstFactor } from '../complete-auth'

const INVITE_TOKEN_BYTES = 32
const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000 // 7 days
/**
 * PR #752 round 12: the ONLY roles an ordinary tenant admin's self-service
 * invite may assign. This is the canonical source of truth — do not
 * duplicate this list elsewhere; import it.
 *
 * 'coo' was REMOVED here — it is a Nzila platform-operations role (level
 * 295 in apps/union-eyes/lib/api-auth-guard.ts's ROLE_HIERARCHY, above
 * platform_lead/system_admin/CLC roles), not a tenant-local role. An
 * ordinary tenant admin (hasMinRole('admin'), level 140) could otherwise
 * invite a member with role:'coo' into their OWN organization and, since
 * role-level checks compare hierarchy levels rather than assignability,
 * that member would then satisfy any `minRole`/hierarchy-level check
 * requiring platform-operations authority — a real privilege escalation.
 * If a tenant-scoped "chief operating officer" concept is ever needed,
 * create a distinct tenant-scoped role; never reuse the platform 'coo'.
 */
export const TENANT_SELF_SERVICE_ASSIGNABLE_ROLES: ReadonlySet<string> = new Set(AUTH_TENANT_ASSIGNABLE_ROLES)
const ALLOWED_ROLES = TENANT_SELF_SERVICE_ASSIGNABLE_ROLES

export interface CreateInviteInput {
  email: string
  organizationId: string
  role?: string
  invitedBy: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface CreateInviteResult {
  success: boolean
  inviteId?: string
  token?: string
  expiresAt?: Date
  error?: string
}

export interface AcceptInviteInput {
  token: string
  firstName?: string
  lastName?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface AcceptInviteResult {
  success: boolean
  requiresMfa?: true
  challengeToken?: string
  user?: {
    id: string
    email: string
    organizationId: string
    role: string
  }
  error?: string
}

function generateToken(): string {
  return randomBytes(INVITE_TOKEN_BYTES).toString('base64url')
}

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

async function logEvent(
  eventType: string,
  opts: {
    userId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
    metadata?: Record<string, unknown>
  },
  /** A required record is part of the operation: if it cannot be written the operation fails and rolls back. */
  required = false,
): Promise<void> {
  const write = () => withAuthSavepoint(async () => db.insert(authAuditLog).values({
    userId: opts.userId ?? null,
    eventType,
    ipAddress: opts.ipAddress ?? null,
    userAgent: opts.userAgent ?? null,
    metadata: opts.metadata ?? {},
  }))
  if (required) {
    await write()
    return
  }
  try {
    await write()
  } catch {
    // best-effort
  }
}

export async function createInvite(
  input: CreateInviteInput,
): Promise<CreateInviteResult> {
  const email = input.email.toLowerCase().trim()
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Invalid email address' }
  }
  const role = input.role ?? 'member'
  if (!ALLOWED_ROLES.has(role)) {
    return { success: false, error: `Invalid role: ${role}` }
  }
  return withTenantAuthContext(input.invitedBy, input.organizationId, () => createInviteWithContext(input, email, role))
}

async function createInviteWithContext(input: CreateInviteInput, email: string, role: string): Promise<CreateInviteResult> {
  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const [row] = await insertAuthRow(authInvites, {
      email,
      organizationId: input.organizationId,
      role,
      tokenHash,
      invitedBy: input.invitedBy,
      expiresAt,
    })

  await logEvent('invite_created', {
    userId: input.invitedBy,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      inviteId: row.id,
      email,
      organizationId: input.organizationId,
      role,
    },
  }, true)

  return { success: true, inviteId: row.id, token, expiresAt }
}

export async function acceptInvite(
  input: AcceptInviteInput,
): Promise<AcceptInviteResult> {
  if (!input.token || typeof input.token !== 'string') {
    return { success: false, error: 'Invalid or expired invite' }
  }
  const tokenHash = hashToken(input.token)
  return withAuthContext({ phase: 'redemption', selector: { kind: 'invite', tokenHash } },
    () => acceptInviteWithContext(input, tokenHash))
}

async function acceptInviteWithContext(input: AcceptInviteInput, tokenHash: string): Promise<AcceptInviteResult> {
  const [invite] = await db
    .select()
    .from(authInvites)
    .where(
      and(
        eq(authInvites.tokenHash, tokenHash),
        isNull(authInvites.acceptedAt),
        isNull(authInvites.revokedAt),
        gt(authInvites.expiresAt, new Date()),
      ),
    )
    .limit(1)
    .for('update')

  if (!invite) {
    await logEvent('invite_accept_failed', {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { reason: 'not_found_or_expired_or_used' },
    })
    return { success: false, error: 'Invalid or expired invite' }
  }
  if (!ALLOWED_ROLES.has(invite.role)) return { success: false, error: 'Invalid invite role' }

  // Hold the inviter's lifecycle and membership writers until this transaction
  // commits, then re-read. A denial that committed while this transaction
  // waited is visible here, before any membership or session write.
  await lockInviterAuthority(db, invite.invitedBy)
  const [confirmed] = await db
    .select()
    .from(authInvites)
    .where(
      and(
        eq(authInvites.tokenHash, tokenHash),
        isNull(authInvites.acceptedAt),
        isNull(authInvites.revokedAt),
        gt(authInvites.expiresAt, new Date()),
      ),
    )
    .limit(1)
    .for('update')
  if (!confirmed) {
    await logEvent('invite_accept_failed', {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { reason: 'inviter_authority_lost' },
    })
    return { success: false, error: 'Invalid or expired invite' }
  }

  // Find or create the underlying user.
  const [existing] = await db
    .select({ userId: authUsers.userId })
    .from(authUsers)
    .where(sql`lower(${authUsers.email}) = ${confirmed.email}`)
    .limit(1)

  let userId: string
  if (existing) {
    userId = existing.userId
  } else {
    userId = crypto.randomUUID()
    await insertAuthRow(authUsers, {
      userId,
      email: confirmed.email,
      passwordHash: null,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      displayName:
        [input.firstName, input.lastName].filter(Boolean).join(' ') || null,
      emailVerified: true,
      isActive: true,
    })
  }

  // Upsert org membership with the role from the invite (NOT from user input).
  const [existingMembership] = await db
    .select({ id: authOrganizationUsers.organizationUserId })
    .from(authOrganizationUsers)
    .where(
      and(
        eq(authOrganizationUsers.organizationId, confirmed.organizationId),
        eq(authOrganizationUsers.userId, userId),
      ),
    )
    .limit(1)

  if (existingMembership) {
    await db
      .update(authOrganizationUsers)
      .set({
        role: confirmed.role,
        invitedBy: confirmed.invitedBy,
        invitedAt: confirmed.createdAt ?? new Date(),
        joinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(authOrganizationUsers.organizationUserId, existingMembership.id))
  } else {
    await insertAuthRow(authOrganizationUsers, {
      organizationId: confirmed.organizationId,
      userId,
      role: confirmed.role,
      invitedBy: confirmed.invitedBy,
      invitedAt: confirmed.createdAt ?? new Date(),
      joinedAt: new Date(),
    })
  }

  // Mint session
  const completion = await completeAuthFirstFactor({
    userId,
    organizationId: confirmed.organizationId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  await logEvent('invite_accepted', {
    userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      inviteId: confirmed.id,
      organizationId: confirmed.organizationId,
      role: confirmed.role,
    },
  })
  await db.update(authInvites).set({ acceptedAt: new Date(), acceptedUserId: userId })
    .where(eq(authInvites.id, confirmed.id))

  return {
    success: true,
    ...completion,
    user: {
      id: userId,
      email: confirmed.email,
      organizationId: confirmed.organizationId,
      role: confirmed.role,
    },
  }
}
