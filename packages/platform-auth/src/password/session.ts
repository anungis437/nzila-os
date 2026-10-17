/**
 * Session Service — Opaque session tokens with hashed DB storage
 *
 * Flow:
 *   1. Generate a cryptographically random opaque token
 *   2. SHA-256 hash it before storing in `user_sessions.session_token_hash`
 *   3. Set the unhashed token in an HTTP-only, Secure, SameSite=Lax cookie
 *   4. On each request, hash the cookie value and look up the session
 *
 * Shared across all Nzila apps via @nzila/platform-auth/password.
 */
import { randomBytes, createHash } from 'crypto'
import type { db } from '@nzila/db/client'
import { authUserSessions } from '@nzila/db/schema'
import { eq, and, gt, sql } from 'drizzle-orm'
import { cookies } from 'next/headers'
import { authDb, getAuthContext, withAuthContext } from '../auth-db'

// ─── Constants ──────────────────────────────────────────────────────────────

/** Cookie name for PG-backed sessions. Shared across all Nzila apps. */
export const SESSION_COOKIE_NAME = 'nzila_session'
const SESSION_TOKEN_BYTES = 32 // 256-bit token
const SESSION_DURATION_MS = 24 * 60 * 60 * 1000 // 24 hours

// ─── Token Utilities ────────────────────────────────────────────────────────

/** Generate a cryptographically random opaque session token. */
function generateSessionToken(): string {
  return randomBytes(SESSION_TOKEN_BYTES).toString('base64url')
}

/** SHA-256 hash a token for secure DB storage. */
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

// ─── Session CRUD ───────────────────────────────────────────────────────────

export interface CreateSessionOptions {
  userId: string
  organizationId?: string | null
  ipAddress?: string | null
  userAgent?: string | null
}

export interface SessionData {
  sessionId: string
  userId: string
  organizationId: string | null
  expiresAt: Date
}

/**
 * Create a new session and return the raw token (to be set as cookie).
 */
export async function createSession(
  options: CreateSessionOptions,
  dbExecutor: typeof db = authDb,
): Promise<{ token: string; session: SessionData }> {
  const token = generateSessionToken()
  const tokenHash = hashToken(token)
  const expiresAt = new Date(Date.now() + SESSION_DURATION_MS)

  const [session] = (await dbExecutor
    .insert(authUserSessions)
    .values({
      userId: options.userId,
      organizationId: options.organizationId ?? null,
      sessionToken: tokenHash, // legacy column, also stores hash for new sessions
      sessionTokenHash: tokenHash,
      ipAddress: options.ipAddress ?? null,
      userAgent: options.userAgent ?? null,
      expiresAt,
      isActive: true,
    })
    .returning({
      sessionId: authUserSessions.sessionId,
      userId: authUserSessions.userId,
      organizationId: authUserSessions.organizationId,
      expiresAt: authUserSessions.expiresAt,
    })) as [{ sessionId: string; userId: string; organizationId: string | null; expiresAt: Date }]

  return {
    token,
    session: {
      sessionId: session.sessionId,
      userId: session.userId,
      organizationId: session.organizationId,
      expiresAt: session.expiresAt,
    },
  }
}

/**
 * Validate a session token. Returns the session if valid, null otherwise.
 * Also updates `last_used_at`.
 */
export async function validateSession(
  token: string,
  dbExecutor: typeof db = authDb,
): Promise<SessionData | null> {
  const tokenHash = hashToken(token)
  if (dbExecutor === authDb) {
    return withAuthContext({ phase: 'lookup', selector: { kind: 'session', tokenHash } }, () =>
      validateSessionWithExecutor(tokenHash, authDb),
    )
  }
  return validateSessionWithExecutor(tokenHash, dbExecutor)
}

async function validateSessionWithExecutor(
  tokenHash: string,
  dbExecutor: typeof db,
): Promise<SessionData | null> {
  const [session] = await dbExecutor
    .select({
      sessionId: authUserSessions.sessionId,
      userId: authUserSessions.userId,
      organizationId: authUserSessions.organizationId,
      expiresAt: authUserSessions.expiresAt,
      isActive: authUserSessions.isActive,
    })
    .from(authUserSessions)
    .where(
      and(
        eq(authUserSessions.sessionTokenHash, tokenHash),
        eq(authUserSessions.isActive, true),
        gt(authUserSessions.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!session) return null

  // Update last_used_at
  await dbExecutor
    .update(authUserSessions)
    .set({ lastUsedAt: new Date() })
    .where(eq(authUserSessions.sessionId, session.sessionId))

  return {
    sessionId: session.sessionId,
    userId: session.userId,
    organizationId: session.organizationId,
    expiresAt: session.expiresAt,
  }
}

/**
 * Invalidate (revoke) a specific session.
 */
export async function revokeSession(
  sessionId: string,
  dbExecutor: typeof db = authDb,
): Promise<void> {
  await dbExecutor
    .update(authUserSessions)
    .set({ isActive: false })
    .where(eq(authUserSessions.sessionId, sessionId))
}

/**
 * Revoke all sessions for a user (e.g. on password change).
 *
 * Accepts an optional db executor override. The default auth-bootstrap
 * executor is used because session revocation can run before a normal
 * tenant/RLS user context exists. Callers that already hold a narrower
 * transaction-scoped executor may pass it explicitly.
 */
export async function revokeAllUserSessions(
  userId: string,
  dbExecutor: typeof db = authDb,
): Promise<void> {
  await dbExecutor
    .update(authUserSessions)
    .set({ isActive: false })
    .where(and(eq(authUserSessions.userId, userId), eq(authUserSessions.isActive, true)))
}

/**
 * Rotate session: invalidate old, create new.
 * Use after sensitive actions (password change, privilege escalation).
 */
export async function rotateSession(
  oldSessionId: string,
  options: CreateSessionOptions,
  dbExecutor: typeof db = authDb,
): Promise<{ token: string; session: SessionData }> {
  await revokeSession(oldSessionId, dbExecutor)
  return createSession(options, dbExecutor)
}

export class SessionRebindDenied extends Error {
  constructor() {
    super('Live session authority is required to change organization')
    this.name = 'SessionRebindDenied'
  }
}

/** Caller must hold the validated actor's identity transaction until response preparation completes. */
export async function rebindSessionOrganization(options: {
  userId: string
  organizationId: string
  token: string
}): Promise<{ token: string; session: SessionData }> {
  const context = getAuthContext()
  if (context?.phase !== 'identity' || context.userId !== options.userId)
    throw new Error(
      'Session organization rebinding requires the authenticated identity transaction',
    )
  const [previous] = await authDb
    .select({
      sessionId: authUserSessions.sessionId,
      ipAddress: authUserSessions.ipAddress,
      userAgent: authUserSessions.userAgent,
      deviceInfo: authUserSessions.deviceInfo,
    })
    .from(authUserSessions)
    .where(
      and(
        eq(authUserSessions.userId, options.userId),
        eq(authUserSessions.sessionTokenHash, hashToken(options.token)),
        eq(authUserSessions.isActive, true),
        gt(authUserSessions.expiresAt, sql`statement_timestamp()`),
      ),
    )
    .limit(1)
    .for('update')
  if (!previous) throw new SessionRebindDenied()
  const token = generateSessionToken()
  const tokenHash = hashToken(token)
  const [session] = await authDb
    .insert(authUserSessions)
    .values({
      userId: options.userId,
      organizationId: options.organizationId,
      sessionToken: tokenHash,
      sessionTokenHash: tokenHash,
      ipAddress: previous.ipAddress,
      userAgent: previous.userAgent,
      deviceInfo: previous.deviceInfo,
      createdAt: sql`statement_timestamp()`,
      expiresAt: sql`(SELECT expires_at FROM user_management.user_sessions
      WHERE session_id=${previous.sessionId})`,
      isActive: true,
    })
    .returning({
      sessionId: authUserSessions.sessionId,
      userId: authUserSessions.userId,
      organizationId: authUserSessions.organizationId,
      expiresAt: authUserSessions.expiresAt,
    })
  if (!session) throw new Error('Organization-bound session was not created')
  const [revoked] = await authDb
    .update(authUserSessions)
    .set({ isActive: false })
    .where(
      and(
        eq(authUserSessions.sessionId, previous.sessionId),
        eq(authUserSessions.userId, options.userId),
        eq(authUserSessions.isActive, true),
      ),
    )
    .returning({ sessionId: authUserSessions.sessionId })
  if (!revoked) throw new SessionRebindDenied()
  return { token, session }
}

// ─── Cookie Management ──────────────────────────────────────────────────────

export function sessionCookieAttributes(expiresAt: Date) {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    expires: expiresAt,
    path: '/',
  }
}

/**
 * Set the session cookie on the response.
 */
export async function setSessionCookie(token: string, expiresAt: Date): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, token, sessionCookieAttributes(expiresAt))
}

/**
 * Clear the session cookie.
 */
export async function clearSessionCookie(): Promise<void> {
  const cookieStore = await cookies()
  cookieStore.set(SESSION_COOKIE_NAME, '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    expires: new Date(0),
    path: '/',
  })
}

/**
 * Read the session token from cookies and validate it.
 * Returns the session data if valid, null otherwise.
 */
export async function getSessionFromCookie(
  dbExecutor: typeof db = authDb,
): Promise<SessionData | null> {
  const cookieStore = await cookies()
  const token = cookieStore.get(SESSION_COOKIE_NAME)?.value
  if (!token) return null
  return validateSession(token, dbExecutor)
}

// ─── Cleanup ────────────────────────────────────────────────────────────────

/**
 * Purge expired/inactive sessions older than 7 days.
 * Call from a cron job.
 */
export async function purgeExpiredSessions(): Promise<number> {
  return withAuthContext(
    {
      phase: 'cleanup',
      actorUserId: 'auth-session-retention',
      reason: 'Inactive sessions expired more than seven days',
    },
    purgeExpiredSessionsWithContext,
  )
}

async function purgeExpiredSessionsWithContext(): Promise<number> {
  const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
  const result = await authDb
    .delete(authUserSessions)
    .where(
      and(
        eq(authUserSessions.isActive, false),
        sql`${authUserSessions.expiresAt} < ${cutoff.toISOString()}::timestamptz`,
      ),
    )
    .returning({ sessionId: authUserSessions.sessionId })
  return result.length
}
