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
 */
import { randomBytes, createHash } from 'crypto'
import { db } from '@nzila/db/client'
import {
  authInvites,
  authUsers,
  authOrganizationUsers,
  authAuditLog,
} from '@nzila/db/schema'
import { eq, and, sql, gt, isNull } from 'drizzle-orm'
import { createSession, setSessionCookie } from '../password/session'

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
export const TENANT_SELF_SERVICE_ASSIGNABLE_ROLES = new Set([
  'member',
  'steward',
  'chief_steward',
  'admin',
])
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
): Promise<void> {
  try {
    await db.insert(authAuditLog).values({
      userId: opts.userId ?? null,
      eventType,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
      metadata: opts.metadata ?? {},
    })
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

  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS)

  const [row] = await db
    .insert(authInvites)
    .values({
      email,
      organizationId: input.organizationId,
      role,
      tokenHash,
      invitedBy: input.invitedBy,
      expiresAt,
    })
    .returning({ id: authInvites.id })

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
  })

  return { success: true, inviteId: row.id, token, expiresAt }
}

export async function acceptInvite(
  input: AcceptInviteInput,
): Promise<AcceptInviteResult> {
  if (!input.token || typeof input.token !== 'string') {
    return { success: false, error: 'Invalid or expired invite' }
  }
  const tokenHash = hashToken(input.token)

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

  if (!invite) {
    await logEvent('invite_accept_failed', {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { reason: 'not_found_or_expired_or_used' },
    })
    return { success: false, error: 'Invalid or expired invite' }
  }

  // Find or create the underlying user.
  const [existing] = await db
    .select({ userId: authUsers.userId })
    .from(authUsers)
    .where(sql`lower(${authUsers.email}) = ${invite.email}`)
    .limit(1)

  let userId: string
  if (existing) {
    userId = existing.userId
  } else {
    userId = crypto.randomUUID()
    await db.insert(authUsers).values({
      userId,
      email: invite.email,
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
        eq(authOrganizationUsers.organizationId, invite.organizationId),
        eq(authOrganizationUsers.userId, userId),
      ),
    )
    .limit(1)

  if (existingMembership) {
    await db
      .update(authOrganizationUsers)
      .set({
        role: invite.role,
        invitedBy: invite.invitedBy,
        invitedAt: invite.createdAt ?? new Date(),
        joinedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(authOrganizationUsers.organizationUserId, existingMembership.id))
  } else {
    await db.insert(authOrganizationUsers).values({
      organizationId: invite.organizationId,
      userId,
      role: invite.role,
      invitedBy: invite.invitedBy,
      invitedAt: invite.createdAt ?? new Date(),
      joinedAt: new Date(),
    })
  }

  // Mark invite consumed
  await db
    .update(authInvites)
    .set({ acceptedAt: new Date(), acceptedUserId: userId })
    .where(eq(authInvites.id, invite.id))

  // Mint session
  const { token: sessionToken, session } = await createSession({
    userId,
    organizationId: invite.organizationId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })
  await setSessionCookie(sessionToken, session.expiresAt)

  await logEvent('invite_accepted', {
    userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: {
      inviteId: invite.id,
      organizationId: invite.organizationId,
      role: invite.role,
    },
  })

  return {
    success: true,
    user: {
      id: userId,
      email: invite.email,
      organizationId: invite.organizationId,
      role: invite.role,
    },
  }
}
