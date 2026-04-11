/**
 * Auth Service — core authentication business logic
 *
 * Handles: signup, login, logout, forgot-password, reset-password.
 * Delegates password hashing to password.ts and session management to session.ts.
 *
 * Shared across all Nzila apps via @nzila/platform-auth/password.
 */
import { randomBytes, createHash } from 'crypto'
import { db } from '@nzila/db/client'
import {
  authUsers,
  authPasswordResetTokens,
  authAuditLog,
  authOrganizationUsers,
} from '@nzila/db/schema'
import { eq, and, sql, gt } from 'drizzle-orm'
import {
  hashPassword,
  verifyPassword,
  validatePassword,
  needsRehash,
} from './password'
import {
  createSession,
  revokeSession,
  revokeAllUserSessions,
  setSessionCookie,
  clearSessionCookie,
  getSessionFromCookie,
} from './session'
import type { CreateSessionOptions, SessionData } from './session'

// ─── Types ──────────────────────────────────────────────────────────────────

export interface AuthResult {
  success: boolean
  error?: string
  user?: {
    id: string
    email: string
    firstName: string | null
    lastName: string | null
  }
}

export interface SignupInput {
  email: string
  password: string
  firstName?: string
  lastName?: string
  ipAddress?: string
  userAgent?: string
}

export interface LoginInput {
  email: string
  password: string
  ipAddress?: string
  userAgent?: string
}

export interface ForgotPasswordInput {
  email: string
  ipAddress?: string
  userAgent?: string
}

export interface ResetPasswordInput {
  token: string
  newPassword: string
  ipAddress?: string
  userAgent?: string
}

export interface AuthUser {
  id: string
  email: string
  firstName: string | null
  lastName: string | null
  organizationId: string | null
  sessionId: string
}

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_FAILED_ATTEMPTS = 5
const LOCKOUT_DURATION_MS = 15 * 60 * 1000 // 15 minutes
const RESET_TOKEN_EXPIRY_MS = 60 * 60 * 1000 // 1 hour
const RATE_LIMIT_WINDOW_MS = 15 * 60 * 1000 // 15-minute window
const MAX_RESET_REQUESTS = 3 // Max resets per window per IP

// ─── Audit Logging ──────────────────────────────────────────────────────────

type AuditEvent =
  | 'signup'
  | 'login_success'
  | 'login_failed'
  | 'logout'
  | 'password_reset_request'
  | 'password_reset_complete'
  | 'account_locked'
  | 'session_revoked'

async function logAuditEvent(
  event: AuditEvent,
  opts: {
    userId?: string | null
    ipAddress?: string | null
    userAgent?: string | null
    metadata?: Record<string, unknown>
  } = {},
): Promise<void> {
  try {
    await db.insert(authAuditLog).values({
      userId: opts.userId ?? null,
      eventType: event,
      ipAddress: opts.ipAddress ?? null,
      userAgent: opts.userAgent ?? null,
      metadata: opts.metadata ?? {},
    })
  } catch {
    // Audit logging is best-effort — never block auth flows
  }
}

// ─── Rate Limiting (DB-backed) ──────────────────────────────────────────────

async function checkResetRateLimit(ipAddress: string): Promise<boolean> {
  const windowStart = new Date(Date.now() - RATE_LIMIT_WINDOW_MS)
  const result = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(authAuditLog)
    .where(
      and(
        eq(authAuditLog.eventType, 'password_reset_request'),
        eq(authAuditLog.ipAddress, ipAddress),
        gt(authAuditLog.createdAt, windowStart),
      ),
    )
  return (result[0]?.count ?? 0) < MAX_RESET_REQUESTS
}

// ─── Signup ─────────────────────────────────────────────────────────────────

export async function signup(input: SignupInput): Promise<AuthResult> {
  // 1. Validate password policy
  const validation = validatePassword(input.password)
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] }
  }

  // 2. Check for existing user (case-insensitive email)
  const email = input.email.toLowerCase().trim()
  const existing = await db
    .select({ userId: authUsers.userId })
    .from(authUsers)
    .where(sql`lower(${authUsers.email}) = ${email}`)
    .limit(1)

  if (existing.length > 0) {
    return {
      success: false,
      error: 'Unable to create account. Please try a different email.',
    }
  }

  // 3. Hash password
  const passwordHashValue = await hashPassword(input.password)

  // 4. Create user
  const userId = crypto.randomUUID()
  const [newUser] = await db
    .insert(authUsers)
    .values({
      userId,
      email,
      passwordHash: passwordHashValue,
      firstName: input.firstName ?? null,
      lastName: input.lastName ?? null,
      displayName:
        [input.firstName, input.lastName].filter(Boolean).join(' ') || null,
      emailVerified: false,
      isActive: true,
    })
    .returning({
      id: authUsers.userId,
      email: authUsers.email,
      firstName: authUsers.firstName,
      lastName: authUsers.lastName,
    }) as [{ id: string; email: string; firstName: string | null; lastName: string | null }]

  // 5. Create session
  const { token, session } = await createSession({
    userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  // 6. Set cookie
  await setSessionCookie(token, session.expiresAt)

  // 7. Audit
  await logAuditEvent('signup', {
    userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  return {
    success: true,
    user: {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
    },
  }
}

// ─── Login ──────────────────────────────────────────────────────────────────

export async function login(input: LoginInput): Promise<AuthResult> {
  const email = input.email.toLowerCase().trim()

  // 1. Find user
  const [user] = await db
    .select({
      userId: authUsers.userId,
      email: authUsers.email,
      firstName: authUsers.firstName,
      lastName: authUsers.lastName,
      passwordHash: authUsers.passwordHash,
      isActive: authUsers.isActive,
      failedLoginAttempts: authUsers.failedLoginAttempts,
      accountLockedUntil: authUsers.accountLockedUntil,
    })
    .from(authUsers)
    .where(sql`lower(${authUsers.email}) = ${email}`)
    .limit(1)

  if (!user) {
    // Constant-time: still hash to prevent timing oracle
    await hashPassword(input.password)
    await logAuditEvent('login_failed', {
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
      metadata: { reason: 'user_not_found', email },
    })
    return { success: false, error: 'Invalid email or password' }
  }

  // 2. Check account status
  if (!user.isActive) {
    await logAuditEvent('login_failed', {
      userId: user.userId,
      ipAddress: input.ipAddress,
      metadata: { reason: 'account_inactive' },
    })
    return {
      success: false,
      error: 'Account is deactivated. Contact support.',
    }
  }

  // 3. Check lockout
  if (user.accountLockedUntil && user.accountLockedUntil > new Date()) {
    await logAuditEvent('login_failed', {
      userId: user.userId,
      ipAddress: input.ipAddress,
      metadata: { reason: 'account_locked' },
    })
    return {
      success: false,
      error: 'Account is temporarily locked. Try again later.',
    }
  }

  // 4. Verify password
  if (!user.passwordHash) {
    return {
      success: false,
      error: 'This account uses social login. Please sign in with your provider.',
    }
  }

  const passwordValid = await verifyPassword(user.passwordHash, input.password)
  if (!passwordValid) {
    const attempts = (user.failedLoginAttempts ?? 0) + 1
    const lockUntil =
      attempts >= MAX_FAILED_ATTEMPTS
        ? new Date(Date.now() + LOCKOUT_DURATION_MS)
        : null

    await db
      .update(authUsers)
      .set({
        failedLoginAttempts: attempts,
        accountLockedUntil: lockUntil,
      })
      .where(eq(authUsers.userId, user.userId))

    if (lockUntil) {
      await logAuditEvent('account_locked', {
        userId: user.userId,
        ipAddress: input.ipAddress,
        metadata: { attempts },
      })
    }

    await logAuditEvent('login_failed', {
      userId: user.userId,
      ipAddress: input.ipAddress,
      metadata: { reason: 'invalid_password', attempts },
    })
    return { success: false, error: 'Invalid email or password' }
  }

  // 5. Reset failed attempts on success
  await db
    .update(authUsers)
    .set({
      failedLoginAttempts: 0,
      accountLockedUntil: null,
      lastLoginAt: new Date(),
      lastLoginIp: input.ipAddress ?? null,
    })
    .where(eq(authUsers.userId, user.userId))

  // 6. Rehash if needed (parameter upgrade)
  if (needsRehash(user.passwordHash)) {
    const newHash = await hashPassword(input.password)
    await db
      .update(authUsers)
      .set({ passwordHash: newHash, passwordChangedAt: new Date() })
      .where(eq(authUsers.userId, user.userId))
  }

  // 7. Resolve organization membership (pick primary or first)
  let organizationId: string | null = null
  const [membership] = await db
    .select({ organizationId: authOrganizationUsers.organizationId })
    .from(authOrganizationUsers)
    .where(
      and(
        eq(authOrganizationUsers.userId, user.userId),
        eq(authOrganizationUsers.isActive, true),
      ),
    )
    .orderBy(sql`${authOrganizationUsers.isPrimary} DESC NULLS LAST`)
    .limit(1)
  if (membership) {
    organizationId = membership.organizationId
  }

  // 8. Create session
  const { token, session } = await createSession({
    userId: user.userId,
    organizationId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  await setSessionCookie(token, session.expiresAt)

  // 9. Audit
  await logAuditEvent('login_success', {
    userId: user.userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  return {
    success: true,
    user: {
      id: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
  }
}

// ─── Logout ─────────────────────────────────────────────────────────────────

export async function logout(): Promise<void> {
  const session = await getSessionFromCookie()
  if (session) {
    await revokeSession(session.sessionId)
    await logAuditEvent('logout', { userId: session.userId })
  }
  await clearSessionCookie()
}

// ─── Forgot Password ───────────────────────────────────────────────────────

/**
 * Request a password reset. Returns a token (in production, send via email).
 * Always returns success to prevent email enumeration.
 */
export async function forgotPassword(
  input: ForgotPasswordInput,
): Promise<{ success: true; token?: string }> {
  const email = input.email.toLowerCase().trim()

  // Rate limit by IP
  if (input.ipAddress) {
    const allowed = await checkResetRateLimit(input.ipAddress)
    if (!allowed) {
      return { success: true }
    }
  }

  // Find user
  const [user] = await db
    .select({ userId: authUsers.userId })
    .from(authUsers)
    .where(sql`lower(${authUsers.email}) = ${email}`)
    .limit(1)

  await logAuditEvent('password_reset_request', {
    userId: user?.userId ?? null,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { email },
  })

  if (!user) {
    return { success: true }
  }

  // Invalidate any existing unused tokens for this user
  await db
    .update(authPasswordResetTokens)
    .set({ usedAt: new Date() })
    .where(
      and(
        eq(authPasswordResetTokens.userId, user.userId),
        sql`${authPasswordResetTokens.usedAt} IS NULL`,
      ),
    )

  // Generate token
  const rawToken = randomBytes(32).toString('base64url')
  const tokenHash = createHash('sha256').update(rawToken).digest('hex')
  const expiresAt = new Date(Date.now() + RESET_TOKEN_EXPIRY_MS)

  await db.insert(authPasswordResetTokens).values({
    userId: user.userId,
    tokenHash,
    expiresAt,
  })

  // In production, send rawToken via email.
  // For dev, return it directly.
  if (process.env.NODE_ENV === 'development') {
    return { success: true, token: rawToken }
  }
  return { success: true }
}

// ─── Reset Password ─────────────────────────────────────────────────────────

export async function resetPassword(
  input: ResetPasswordInput,
): Promise<AuthResult> {
  // 1. Validate new password
  const validation = validatePassword(input.newPassword)
  if (!validation.valid) {
    return { success: false, error: validation.errors[0] }
  }

  // 2. Hash token and look up
  const tokenHash = createHash('sha256').update(input.token).digest('hex')
  const [resetToken] = await db
    .select({
      id: authPasswordResetTokens.id,
      userId: authPasswordResetTokens.userId,
      expiresAt: authPasswordResetTokens.expiresAt,
      usedAt: authPasswordResetTokens.usedAt,
    })
    .from(authPasswordResetTokens)
    .where(eq(authPasswordResetTokens.tokenHash, tokenHash))
    .limit(1)

  if (!resetToken) {
    return { success: false, error: 'Invalid or expired reset link' }
  }

  if (resetToken.usedAt) {
    return { success: false, error: 'This reset link has already been used' }
  }

  if (resetToken.expiresAt < new Date()) {
    return {
      success: false,
      error: 'This reset link has expired. Please request a new one.',
    }
  }

  // 3. Hash new password
  const passwordHashValue = await hashPassword(input.newPassword)

  // 4. Update user password
  await db
    .update(authUsers)
    .set({
      passwordHash: passwordHashValue,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      accountLockedUntil: null,
    })
    .where(eq(authUsers.userId, resetToken.userId))

  // 5. Mark token as used
  await db
    .update(authPasswordResetTokens)
    .set({ usedAt: new Date() })
    .where(eq(authPasswordResetTokens.id, resetToken.id))

  // 6. Revoke all existing sessions (force re-login)
  await revokeAllUserSessions(resetToken.userId)

  // 7. Audit
  await logAuditEvent('password_reset_complete', {
    userId: resetToken.userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })

  return { success: true }
}

// ─── Get Current Auth User (from session cookie) ────────────────────────────

/**
 * Get the currently authenticated user from the PG session cookie.
 * Returns null if no valid session.
 */
export async function getAuthUser(): Promise<AuthUser | null> {
  const session = await getSessionFromCookie()
  if (!session) return null

  const [user] = await db
    .select({
      id: authUsers.userId,
      email: authUsers.email,
      firstName: authUsers.firstName,
      lastName: authUsers.lastName,
    })
    .from(authUsers)
    .where(
      and(eq(authUsers.userId, session.userId), eq(authUsers.isActive, true)),
    )
    .limit(1)

  if (!user) return null

  return {
    ...user,
    organizationId: session.organizationId,
    sessionId: session.sessionId,
  }
}
