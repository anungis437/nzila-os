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
  authMfaTotp,
  authOrgPolicies,
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
import { issueMfaChallenge } from '../mfa/service'
import { assessRisk } from '../risk/assess'

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
  /** Set when the user must complete MFA before a session is issued. */
  requiresMfa?: boolean
  /** Present iff requiresMfa — opaque token to redeem at /api/auth/mfa/challenge. */
  mfaChallengeToken?: string
  mfaChallengeExpiresAt?: Date
  /** Risk tier if assessed (logged-for-debugging only; not exposed over the wire in most cases). */
  riskTier?: 'low' | 'medium' | 'high'
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

// ─── Playwright E2E auth bypass (Phase 0C.2 §4 hardened) ──────────────────
//
// The bypass short-circuits the MFA gate and risk-assessment path so that
// governed E2E lifecycle tests can deterministically log fixture users in.
// It does NOT weaken password verification, session issuance, or any of the
// account-lifecycle / account-lockout / audit-logging code paths.
//
// The bypass is DEFENSE-IN-DEPTH GATED. Six independent conditions must all
// evaluate true for the bypass to fire; the moment any one is missing the
// request is treated as a normal production request. This is intentionally
// belt-and-braces so that if a single flag leaks into a real environment
// (e.g. someone copies test env vars into production by mistake) the bypass
// still refuses to activate:
//
//   Gate 1  PLAYWRIGHT_TEST_AUTH === 'true'
//   Gate 2  QA_TEST_ENV          === 'true'
//   Gate 3  NODE_ENV             ∈ { 'test', 'development' }  (never 'production')
//   Gate 4  DATABASE_URL         resolves to a loopback host  (localhost / 127.0.0.1 / ::1 / 0.0.0.0)
//   Gate 5  NEXT_PUBLIC_APP_URL  resolves to a loopback host
//   Gate 6  request User-Agent   contains substring 'playwright-e2e-auth'
//
// When any of Gates 1–5 fails but the caller nonetheless presents the magic
// UA, we emit a one-time console.warn so CI logs make the misconfiguration
// visible instead of silently falling through.

const LOOPBACK_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]', '0.0.0.0'])

/** Extract hostname from a URL string; returns null if the URL is malformed or empty. */
function tryHostname(url: string | undefined | null): string | null {
  const trimmed = url?.trim()
  if (!trimmed) return null
  try {
    return new URL(trimmed).hostname.toLowerCase()
  } catch {
    return null
  }
}

/**
 * Determine whether a DATABASE_URL string points at a loopback host.
 * Non-loopback (e.g. Azure Flexible Server, RDS, Supabase) or unparseable
 * URLs always return false so the bypass fails closed.
 */
function isLoopbackDbUrl(url: string | undefined | null): boolean {
  const host = tryHostname(url)
  return host !== null && LOOPBACK_HOSTS.has(host)
}

/**
 * Determine whether an application base URL string points at a loopback host.
 * Non-loopback URLs (unioneyes.app, *.azurecontainerapps.io, etc.) or
 * unparseable URLs always return false so the bypass fails closed.
 */
function isLoopbackAppUrl(url: string | undefined | null): boolean {
  const host = tryHostname(url)
  return host !== null && LOOPBACK_HOSTS.has(host)
}

/** Environment snapshot used by the gate. Kept explicit so it is testable
 *  without mutating process.env. */
export interface PlaywrightBypassEnv {
  PLAYWRIGHT_TEST_AUTH?: string | undefined
  QA_TEST_ENV?: string | undefined
  NODE_ENV?: string | undefined
  DATABASE_URL?: string | undefined
  NEXT_PUBLIC_APP_URL?: string | undefined
}

const warnedGates = new Set<string>()

function warnRefusedGate(gate: string, ctx: { userAgent?: string | null }): void {
  const key = `${gate}:${(ctx.userAgent ?? '').slice(0, 32)}`
  if (warnedGates.has(key)) return
  warnedGates.add(key)
  console.warn(
    `[platform-auth] Playwright E2E auth bypass refused (gate=${gate}). ` +
      `Request presented the playwright UA marker but the environment is not a governed test environment. ` +
      `This is expected in production/staging — the bypass fails closed. ` +
      `If you intended to run governed E2E tests, ensure PLAYWRIGHT_TEST_AUTH=true, QA_TEST_ENV=true, ` +
      `NODE_ENV=test|development, and DATABASE_URL + NEXT_PUBLIC_APP_URL are both loopback.`,
  )
}

/**
 * Pure function form for direct testing. Given an input request and an
 * environment snapshot, returns true iff every hardening gate is satisfied.
 *
 * Exported so that §4 hardening tests can exercise every combination
 * without mutating process.env.
 */
export function isPlaywrightE2EAuthAllowed(
  input: { userAgent?: string | null },
  env: PlaywrightBypassEnv,
): boolean {
  const ua = (input.userAgent ?? '').toLowerCase()
  const uaPresent = ua.includes('playwright-e2e-auth')

  // If the UA marker is absent the caller is not asking for the bypass at
  // all — silently return false without logging (no misconfiguration to
  // warn about).
  if (!uaPresent) return false

  // Gate 1: explicit opt-in flag.
  if ((env.PLAYWRIGHT_TEST_AUTH ?? '').toLowerCase() !== 'true') {
    warnRefusedGate('PLAYWRIGHT_TEST_AUTH', input)
    return false
  }

  // Gate 2: governed-test-env marker (independent flag — either can be
  // missing on its own).
  if ((env.QA_TEST_ENV ?? '').toLowerCase() !== 'true') {
    warnRefusedGate('QA_TEST_ENV', input)
    return false
  }

  // Gate 3: never in production. Empty NODE_ENV is treated as production for
  // the purposes of this gate (fail closed).
  const nodeEnv = (env.NODE_ENV ?? '').toLowerCase()
  if (nodeEnv !== 'test' && nodeEnv !== 'development') {
    warnRefusedGate('NODE_ENV', input)
    return false
  }

  // Gate 4: DATABASE_URL must be a loopback host. Refuses Azure Flexible
  // Server, RDS, Supabase, any non-parseable URL, and any missing value.
  if (!isLoopbackDbUrl(env.DATABASE_URL)) {
    warnRefusedGate('DATABASE_URL', input)
    return false
  }

  // Gate 5: NEXT_PUBLIC_APP_URL must be a loopback host. Refuses
  // unioneyes.app, *.azurecontainerapps.io, and any non-parseable URL.
  if (!isLoopbackAppUrl(env.NEXT_PUBLIC_APP_URL)) {
    warnRefusedGate('NEXT_PUBLIC_APP_URL', input)
    return false
  }

  return true
}

function isPlaywrightE2EAuthRequest(input: { userAgent?: string | null }): boolean {
  return isPlaywrightE2EAuthAllowed(input, {
    PLAYWRIGHT_TEST_AUTH: process.env.PLAYWRIGHT_TEST_AUTH,
    QA_TEST_ENV: process.env.QA_TEST_ENV,
    NODE_ENV: process.env.NODE_ENV,
    DATABASE_URL: process.env.DATABASE_URL,
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
  })
}

/** @internal Test-only: reset the per-process warn-once cache so hardening
 *  tests can observe each independent warning path. Not part of the public
 *  API — do not import from application code. */
export function __resetPlaywrightBypassWarnCacheForTests(): void {
  warnedGates.clear()
}

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
  | 'login_blocked_lifecycle'
  | 'login_risk_assessed'
  | 'login_soft_lockout'

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
  const isPlaywrightE2E = isPlaywrightE2EAuthRequest(input)

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
      lifecycleState: authUsers.lifecycleState,
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

  // 2b. Lifecycle state gate (independent of isActive — newer mechanism)
  if (user.lifecycleState && user.lifecycleState !== 'active') {
    await logAuditEvent('login_blocked_lifecycle', {
      userId: user.userId,
      ipAddress: input.ipAddress,
      metadata: { lifecycleState: user.lifecycleState },
    })
    return {
      success: false,
      error:
        user.lifecycleState === 'deprovisioned'
          ? 'This account has been removed. Contact your administrator.'
          : 'Account is temporarily disabled. Contact your administrator.',
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
  let userRole: string | null = null
  const [membership] = await db
    .select({
      organizationId: authOrganizationUsers.organizationId,
      role: authOrganizationUsers.role,
    })
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
    userRole = membership.role
  }

  // 7b. Risk assessment
  const risk = isPlaywrightE2E
    ? {
        score: 0,
        tier: 'low' as const,
        reasons: ['playwright_e2e_auth_bypass'],
        recommendedAction: 'allow' as const,
      }
    : await assessRisk({
        userId: user.userId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        userRoles: userRole ? [userRole] : [],
      })
  if (risk.tier !== 'low') {
    await logAuditEvent('login_risk_assessed', {
      userId: user.userId,
      ipAddress: input.ipAddress,
      metadata: { score: risk.score, tier: risk.tier, reasons: risk.reasons },
    })
  }
  if (risk.recommendedAction === 'soft_lockout') {
    await logAuditEvent('login_soft_lockout', {
      userId: user.userId,
      ipAddress: input.ipAddress,
      metadata: { score: risk.score, reasons: risk.reasons },
    })
    return {
      success: false,
      error:
        'For your security, please try again in a few minutes or contact support.',
      riskTier: risk.tier,
    }
  }

  // 7c. MFA gate — either the user has enrolled, or org policy mandates it for their role.
  const [mfaRow] = await db
    .select({
      enabledAt: authMfaTotp.enabledAt,
      disabledAt: authMfaTotp.disabledAt,
    })
    .from(authMfaTotp)
    .where(eq(authMfaTotp.userId, user.userId))
    .limit(1)
  const mfaEnabled = Boolean(mfaRow?.enabledAt && !mfaRow?.disabledAt)

  let mfaMandatedByPolicy = false
  if (organizationId && userRole) {
    const [policy] = await db
      .select({ mfaRequiredForRoles: authOrgPolicies.mfaRequiredForRoles })
      .from(authOrgPolicies)
      .where(eq(authOrgPolicies.organizationId, organizationId))
      .limit(1)
    const roles = (policy?.mfaRequiredForRoles ?? []) as unknown as string[]
    if (Array.isArray(roles) && roles.includes(userRole)) {
      mfaMandatedByPolicy = true
    }
  }

  const mustCompleteMfa =
    !isPlaywrightE2E && (mfaEnabled || mfaMandatedByPolicy || risk.recommendedAction === 'require_mfa')

  if (mustCompleteMfa) {
    if (!mfaEnabled) {
      // Policy / risk demands MFA but user hasn't enrolled — fail closed with
      // an actionable message; admin must enroll them or relax the policy.
      await logAuditEvent('login_failed', {
        userId: user.userId,
        ipAddress: input.ipAddress,
        metadata: { reason: 'mfa_required_but_not_enrolled' },
      })
      return {
        success: false,
        error:
          'Two-factor authentication is required for this account. Please contact your administrator to enroll.',
      }
    }
    const challenge = await issueMfaChallenge({
      userId: user.userId,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    })
    // Do NOT set a session cookie yet — client must complete MFA challenge.
    return {
      success: true,
      requiresMfa: true,
      mfaChallengeToken: challenge.challengeToken,
      mfaChallengeExpiresAt: challenge.expiresAt,
      user: {
        id: user.userId,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      riskTier: risk.tier,
    }
  }

  // 8. Create session (no MFA required path)
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
    metadata: { riskTier: risk.tier },
  })

  return {
    success: true,
    user: {
      id: user.userId,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
    },
    riskTier: risk.tier,
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
