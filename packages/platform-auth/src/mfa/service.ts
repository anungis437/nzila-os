/**
 * MFA service — TOTP enrollment, step-up challenge, verification, disable.
 *
 * Enrollment flow (user-initiated, admin-gatable):
 *   1. POST /api/auth/mfa/enroll           → returns {otpAuthUri, secret, recoveryCodes}
 *      A row is inserted with enabled_at=null and the encrypted secret.
 *   2. POST /api/auth/mfa/verify-enroll    → body { code } — flips enabled_at.
 *
 * Step-up flow (post-password login when user has MFA enrolled OR when org
 * policy mandates MFA for the user's role):
 *   1. `login()` in auth-service returns { requiresMfa, challengeToken } and
 *      does NOT set the session cookie.
 *   2. Client POSTs to /api/auth/mfa/challenge with { challengeToken, code }.
 *   3. Challenge row is looked up by token hash, code is verified, session
 *      is minted, cookie is set. Challenge consumed.
 *
 * Recovery:
 *   /api/auth/mfa/challenge also accepts { challengeToken, recoveryCode }.
 *   Recovery codes are SHA-256-hashed at rest. On successful use, the code's
 *   hash is removed from the array (single-use, never reused).
 *
 * Disable: admin (for other users) or self — erases the row and marks the
 * `two_factor_enabled` flag on authUsers.
 */
import { randomBytes, createHash } from 'crypto'
import { db } from '@nzila/db/client'
import {
  authMfaTotp,
  authMfaChallenges,
  authUsers,
  authAuditLog,
} from '@nzila/db/schema'
import { eq, and, gt, isNull, sql } from 'drizzle-orm'
import {
  generateTotpSecret,
  verifyTotp,
  buildOtpAuthUri,
  generateRecoveryCodes,
} from './totp'
import { encryptSecret, decryptSecret } from './encryption'
import { createSession, setSessionCookie } from '../password/session'

const CHALLENGE_TOKEN_BYTES = 32
const CHALLENGE_TTL_MS = 5 * 60 * 1000 // 5 minutes
const MAX_CHALLENGE_ATTEMPTS = 5

// ─── Types ──────────────────────────────────────────────────────────────────

export interface EnrollInput {
  userId: string
  userEmail: string
  issuer?: string
}

export interface EnrollResult {
  success: boolean
  secret?: string
  otpAuthUri?: string
  recoveryCodes?: string[]
  error?: string
}

export interface VerifyEnrollInput {
  userId: string
  code: string
}

export interface ChallengeInput {
  userId: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ChallengeResult {
  challengeToken: string
  expiresAt: Date
}

export interface ConsumeChallengeInput {
  challengeToken: string
  code?: string
  recoveryCode?: string
  ipAddress?: string | null
  userAgent?: string | null
}

export interface ConsumeChallengeResult {
  success: boolean
  userId?: string
  error?: string
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

function hashRecoveryCode(code: string): string {
  return createHash('sha256').update(code.toUpperCase().trim()).digest('hex')
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

// ─── Status ─────────────────────────────────────────────────────────────────

export async function getMfaStatus(userId: string): Promise<{
  enrolled: boolean
  enabled: boolean
  enabledAt: Date | null
  recoveryCodeCount: number
}> {
  const [row] = await db
    .select()
    .from(authMfaTotp)
    .where(eq(authMfaTotp.userId, userId))
    .limit(1)
  if (!row) {
    return { enrolled: false, enabled: false, enabledAt: null, recoveryCodeCount: 0 }
  }
  const codes = (row.recoveryCodesHashed ?? []) as unknown as string[]
  return {
    enrolled: true,
    enabled: Boolean(row.enabledAt && !row.disabledAt),
    enabledAt: row.enabledAt ?? null,
    recoveryCodeCount: Array.isArray(codes) ? codes.length : 0,
  }
}

// ─── Enroll ─────────────────────────────────────────────────────────────────

export async function enrollMfa(input: EnrollInput): Promise<EnrollResult> {
  // If already fully enabled, refuse re-enroll without explicit disable first.
  const existing = await getMfaStatus(input.userId)
  if (existing.enabled) {
    return { success: false, error: 'MFA already enabled. Disable it before re-enrolling.' }
  }

  const secret = generateTotpSecret()
  const encrypted = encryptSecret(secret)
  const recoveryCodes = generateRecoveryCodes(10)
  const recoveryHashes = recoveryCodes.map(hashRecoveryCode)
  const otpAuthUri = buildOtpAuthUri(
    secret,
    input.userEmail,
    input.issuer ?? 'Nzila OS',
  )

  // Upsert — if a prior pending enrollment exists, we replace it.
  if (existing.enrolled) {
    await db
      .update(authMfaTotp)
      .set({
        secretEncrypted: encrypted,
        recoveryCodesHashed: recoveryHashes as unknown as object,
        enabledAt: null,
        disabledAt: null,
        updatedAt: new Date(),
      })
      .where(eq(authMfaTotp.userId, input.userId))
  } else {
    await db.insert(authMfaTotp).values({
      userId: input.userId,
      secretEncrypted: encrypted,
      recoveryCodesHashed: recoveryHashes as unknown as object,
    })
  }

  await logEvent('mfa_enroll_started', { userId: input.userId })
  return { success: true, secret, otpAuthUri, recoveryCodes }
}

// ─── Verify enrollment (flip enabledAt) ─────────────────────────────────────

export async function verifyEnrollment(
  input: VerifyEnrollInput,
): Promise<{ success: boolean; error?: string }> {
  const [row] = await db
    .select()
    .from(authMfaTotp)
    .where(eq(authMfaTotp.userId, input.userId))
    .limit(1)
  if (!row) {
    return { success: false, error: 'No MFA enrollment in progress' }
  }
  if (row.enabledAt && !row.disabledAt) {
    return { success: false, error: 'MFA already enabled' }
  }

  const secret = decryptSecret(row.secretEncrypted)
  if (!verifyTotp(secret, input.code)) {
    await logEvent('mfa_enroll_failed', {
      userId: input.userId,
      metadata: { reason: 'invalid_code' },
    })
    return { success: false, error: 'Invalid code — check your authenticator app and try again' }
  }

  await db
    .update(authMfaTotp)
    .set({ enabledAt: new Date(), disabledAt: null, updatedAt: new Date() })
    .where(eq(authMfaTotp.userId, input.userId))
  await db
    .update(authUsers)
    .set({ twoFactorEnabled: true })
    .where(eq(authUsers.userId, input.userId))
  await logEvent('mfa_enrolled', { userId: input.userId })
  return { success: true }
}

// ─── Disable ────────────────────────────────────────────────────────────────

export async function disableMfa(
  userId: string,
  actorUserId: string,
  reason?: string,
): Promise<{ success: boolean }> {
  await db
    .update(authMfaTotp)
    .set({ disabledAt: new Date(), updatedAt: new Date() })
    .where(eq(authMfaTotp.userId, userId))
  await db
    .update(authUsers)
    .set({ twoFactorEnabled: false })
    .where(eq(authUsers.userId, userId))
  await logEvent('mfa_disabled', {
    userId,
    metadata: { actorUserId, reason: reason ?? null },
  })
  return { success: true }
}

// ─── Issue a challenge (called by login-service after password verified) ───

export async function issueMfaChallenge(
  input: ChallengeInput,
): Promise<ChallengeResult> {
  const raw = randomBytes(CHALLENGE_TOKEN_BYTES).toString('base64url')
  const tokenHash = hashToken(raw)
  const expiresAt = new Date(Date.now() + CHALLENGE_TTL_MS)
  await db.insert(authMfaChallenges).values({
    userId: input.userId,
    tokenHash,
    method: 'totp',
    expiresAt,
    pendingIp: input.ipAddress ?? null,
    pendingUserAgent: input.userAgent ?? null,
  })
  await logEvent('mfa_challenge_issued', {
    userId: input.userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
  })
  return { challengeToken: raw, expiresAt }
}

// ─── Consume a challenge (verify TOTP or recovery code, mint session) ──────

export async function consumeMfaChallenge(
  input: ConsumeChallengeInput,
): Promise<ConsumeChallengeResult> {
  if (!input.challengeToken) {
    return { success: false, error: 'Challenge token missing' }
  }
  if (!input.code && !input.recoveryCode) {
    return { success: false, error: 'Code or recovery code required' }
  }

  const tokenHash = hashToken(input.challengeToken)
  const [challenge] = await db
    .select()
    .from(authMfaChallenges)
    .where(
      and(
        eq(authMfaChallenges.tokenHash, tokenHash),
        isNull(authMfaChallenges.consumedAt),
        gt(authMfaChallenges.expiresAt, new Date()),
      ),
    )
    .limit(1)

  if (!challenge) {
    await logEvent('mfa_challenge_failed', {
      ipAddress: input.ipAddress,
      metadata: { reason: 'not_found_or_expired' },
    })
    return { success: false, error: 'Invalid or expired challenge' }
  }

  if ((challenge.attempts ?? 0) >= MAX_CHALLENGE_ATTEMPTS) {
    return { success: false, error: 'Too many attempts — request a new sign-in' }
  }

  const [totpRow] = await db
    .select()
    .from(authMfaTotp)
    .where(eq(authMfaTotp.userId, challenge.userId))
    .limit(1)

  if (!totpRow || !totpRow.enabledAt || totpRow.disabledAt) {
    return { success: false, error: 'MFA not enabled for this account' }
  }

  let ok = false
  let usedRecoveryCode = false
  if (input.code) {
    const secret = decryptSecret(totpRow.secretEncrypted)
    ok = verifyTotp(secret, input.code)
  } else if (input.recoveryCode) {
    const codes = (totpRow.recoveryCodesHashed ?? []) as unknown as string[]
    const supplied = hashRecoveryCode(input.recoveryCode)
    const idx = codes.indexOf(supplied)
    if (idx >= 0) {
      ok = true
      usedRecoveryCode = true
      const remaining = codes.filter((_, i) => i !== idx)
      await db
        .update(authMfaTotp)
        .set({ recoveryCodesHashed: remaining as unknown as object, updatedAt: new Date() })
        .where(eq(authMfaTotp.userId, challenge.userId))
    }
  }

  if (!ok) {
    await db
      .update(authMfaChallenges)
      .set({ attempts: (challenge.attempts ?? 0) + 1 })
      .where(eq(authMfaChallenges.id, challenge.id))
    await logEvent('mfa_challenge_failed', {
      userId: challenge.userId,
      ipAddress: input.ipAddress,
      metadata: { reason: 'invalid_code' },
    })
    return { success: false, error: 'Invalid code' }
  }

  // Mark challenge consumed
  await db
    .update(authMfaChallenges)
    .set({ consumedAt: new Date(), ipAddress: input.ipAddress ?? null, userAgent: input.userAgent ?? null })
    .where(eq(authMfaChallenges.id, challenge.id))

  await db
    .update(authMfaTotp)
    .set({ lastUsedAt: new Date(), updatedAt: new Date() })
    .where(eq(authMfaTotp.userId, challenge.userId))

  // Mint the actual session
  const { token: sessionToken, session } = await createSession({
    userId: challenge.userId,
    ipAddress: input.ipAddress ?? challenge.pendingIp,
    userAgent: input.userAgent ?? challenge.pendingUserAgent,
  })
  await setSessionCookie(sessionToken, session.expiresAt)

  await logEvent('mfa_challenge_succeeded', {
    userId: challenge.userId,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    metadata: { usedRecoveryCode },
  })

  return { success: true, userId: challenge.userId }
}

// ─── Policy check: does this user need MFA right now? ──────────────────────

export async function userRequiresMfa(
  userId: string,
  userRoles: string[],
  mfaRequiredForRoles: string[],
): Promise<boolean> {
  // Rule: user must complete MFA if either
  //   (a) they have enrolled and enabled it themselves, OR
  //   (b) their org policy mandates MFA for any of their roles
  const status = await getMfaStatus(userId)
  if (status.enabled) return true
  const roleSet = new Set(userRoles)
  for (const r of mfaRequiredForRoles) {
    if (roleSet.has(r)) return true
  }
  return false
}
