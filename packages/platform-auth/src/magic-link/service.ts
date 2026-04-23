/**
 * Magic-link service — passwordless sign-in via single-use, hashed-at-rest tokens.
 *
 * Flow:
 *   1. Caller posts an email to requestMagicLink(). We generate a 32-byte
 *      base64url token, SHA-256 hash it, persist the hash with a 15-minute
 *      expiry, and return the *raw* token to the caller (which is responsible
 *      for delivering it via email — the platform email service when one is
 *      wired, otherwise the route handler exposes the token in dev mode only).
 *   2. User clicks the link → /api/auth/magic-link/verify?token=…
 *   3. verifyMagicLink() hashes the supplied token, looks up the row, checks
 *      expiry / used_at / attempts, marks it consumed, ensures an authUsers
 *      row exists (create-on-first-login), then mints a normal PG session
 *      (same cookie + same `nzila_session` mechanism as password login).
 *
 * Security properties:
 *   • Tokens are 256-bit random; only SHA-256 hash is stored at rest
 *   • Single-use (used_at sentinel) + 15-min expiry
 *   • Per-email rate-limited (3 requests / 15 min) via auth_audit_log scan
 *   • IP + UA recorded both at request and consumption
 *   • Verify is constant-time enough — failure path always does a hash lookup
 *   • Uniform "we sent it if the email exists" response shape — no enumeration
 */
import { randomBytes, createHash } from 'crypto'
import { db } from '@nzila/db/client'
import {
  authMagicLinks,
  authUsers,
  authAuditLog,
  authOrgPolicies,
} from '@nzila/db/schema'
import { eq, and, sql, gt, isNull } from 'drizzle-orm'
import { createSession, setSessionCookie } from '../password/session'

// ─── Constants ──────────────────────────────────────────────────────────────

const MAGIC_LINK_TOKEN_BYTES = 32
const MAGIC_LINK_TTL_MS = 15 * 60 * 1000 // 15 minutes
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000
const MAX_REQUESTS_PER_EMAIL = 3
const MAX_VERIFY_ATTEMPTS = 5

// ─── Types ──────────────────────────────────────────────────────────────────

export interface RequestMagicLinkInput {
  email: string
  organizationId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface RequestMagicLinkResult {
  success: boolean
  /** Raw token — return ONLY in dev / when sending via trusted email service. */
  token?: string
  expiresAt?: Date
  error?: string
}

export interface VerifyMagicLinkInput {
  token: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface VerifyMagicLinkResult {
  success: boolean
  user?: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
  error?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function generateToken(): string {
  return randomBytes(MAGIC_LINK_TOKEN_BYTES).toString('base64url')
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

async function checkRequestRateLimit(email: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authMagicLinks)
    .where(
      and(
        eq(authMagicLinks.email, email),
        gt(authMagicLinks.createdAt, windowStart),
      ),
    )
  return (result[0]?.count ?? 0) < MAX_REQUESTS_PER_EMAIL
}

async function ensurePolicyAllows(
  email: string,
  organizationId?: string | null,
): Promise<{ ok: boolean; reason?: string }> {
  if (!organizationId) return { ok: true }
  const [policy] = await db
    .select()
    .from(authOrgPolicies)
    .where(eq(authOrgPolicies.organizationId, organizationId))
    .limit(1)
  if (!policy) return { ok: true }
  if (!policy.allowMagicLink) {
    return { ok: false, reason: 'Magic-link sign-in disabled for this organization' }
  }
  if (policy.requireSso) {
    return { ok: false, reason: 'This organization requires SSO sign-in' }
  }
  const domains = (policy.allowedEmailDomains ?? []) as unknown as string[]
  if (Array.isArray(domains) && domains.length > 0) {
    const domain = email.split('@')[1]?.toLowerCase()
    if (!domain || !domains.includes(domain)) {
      return { ok: false, reason: 'Email domain not permitted for this organization' }
    }
  }
  return { ok: true }
}

// ─── Request ────────────────────────────────────────────────────────────────

export async function requestMagicLink(
  input: RequestMagicLinkInput,
): Promise<RequestMagicLinkResult> {
  const email = input.email.toLowerCase().trim()
  if (!email || !email.includes('@')) {
    return { success: false, error: 'Invalid email address' }
  }

  // Policy check (org-scoped)
  const policyCheck = await ensurePolicyAllows(email, input.organizationId ?? null)
  if (!policyCheck.ok) {
    await logEvent('magic_link_blocked_by_policy', {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { email, reason: policyCheck.reason },
    })
    // Return a neutral success to avoid org-membership enumeration; the user
    // sees the same "check your email" copy.
    return { success: true }
  }

  // Rate limit
  const allowed = await checkRequestRateLimit(email)
  if (!allowed) {
    await logEvent('magic_link_rate_limited', {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { email },
    })
    return { success: true } // neutral
  }

  // Look up an existing user (optional — magic links work for new emails too,
  // but recording user_id when known lets us correlate audit logs).
  const [existingUser] = await db
    .select({ userId: authUsers.userId })
    .from(authUsers)
    .where(sql`lower(${authUsers.email}) = ${email}`)
    .limit(1)

  const token = generateToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + MAGIC_LINK_TTL_MS)

  await db.insert(authMagicLinks).values({
    email,
    userId: existingUser?.userId ?? null,
    organizationId: input.organizationId ?? null,
    purpose: 'login',
    tokenHash,
    expiresAt,
    requestedIp: input.ipAddress ?? null,
    requestedUserAgent: input.userAgent ?? null,
  })

  await logEvent('magic_link_requested', {
    userId: existingUser?.userId ?? null,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { email },
  })

  return { success: true, token, expiresAt }
}

// ─── Verify ─────────────────────────────────────────────────────────────────

export async function verifyMagicLink(
  input: VerifyMagicLinkInput,
): Promise<VerifyMagicLinkResult> {
  if (!input.token || typeof input.token !== 'string') {
    return { success: false, error: 'Invalid or expired link' }
  }
  const tokenHash = hashToken(input.token)

  const [row] = await db
    .select()
    .from(authMagicLinks)
    .where(
      and(
        eq(authMagicLinks.tokenHash, tokenHash),
        isNull(authMagicLinks.usedAt),
        gt(authMagicLinks.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!row) {
    await logEvent('magic_link_verify_failed', {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { reason: 'not_found_or_expired' },
    })
    return { success: false, error: 'Invalid or expired link' }
  }

  if ((row.attempts ?? 0) >= MAX_VERIFY_ATTEMPTS) {
    return { success: false, error: 'Too many attempts — request a new link' }
  }

  // Find or create the underlying user. Magic-link auth establishes identity
  // by control of the email inbox; creating the user row is safe.
  let userId = row.userId
  let user: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }

  if (userId) {
    const [u] = await db
      .select({
        id: authUsers.userId,
        email: authUsers.email,
        firstName: authUsers.firstName,
        lastName: authUsers.lastName,
      })
      .from(authUsers)
      .where(eq(authUsers.userId, userId))
      .limit(1)
    if (!u) {
      return { success: false, error: 'User account no longer exists' }
    }
    user = u
  } else {
    // Create on first sign-in. emailVerified=true because they proved control.
    userId = crypto.randomUUID()
    const [created] = (await db
      .insert(authUsers)
      .values({
        userId,
        email: row.email,
        passwordHash: null, // passwordless account
        firstName: null,
        lastName: null,
        displayName: null,
        emailVerified: true,
        isActive: true,
      })
      .returning({
        id: authUsers.userId,
        email: authUsers.email,
        firstName: authUsers.firstName,
        lastName: authUsers.lastName,
      })) as [
      {
        id: string
        email: string
        firstName: string | null
        lastName: string | null
      },
    ]
    user = created
  }

  // Mark token consumed (single-use)
  await db
    .update(authMagicLinks)
    .set({
      usedAt: new Date(),
      consumedIp: input.ipAddress ?? null,
    })
    .where(eq(authMagicLinks.id, row.id))

  // Mint a normal session — same cookie/contract as password login
  const { token: sessionToken, session } = await createSession({
    userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })
  await setSessionCookie(sessionToken, session.expiresAt)

  await logEvent('magic_link_consumed', {
    userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { magicLinkId: row.id },
  })

  return { success: true, user }
}
