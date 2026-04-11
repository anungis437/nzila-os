/**
 * @nzila/platform-contracts — Identity Contracts
 *
 * Canonical identity types for cross-app user representation.
 * These are the platform-level shapes — domain verticals may
 * extend with domain-specific profile fields.
 */
import { z } from 'zod'

// ── User Identity ───────────────────────────────────────────────────────────

export const userIdentitySchema = z.object({
  /** Auth user ID (e.g. "user_xxx"). */
  userId: z.string().min(1),
  /** Primary email address. */
  email: z.string().email(),
  /** Display name. */
  displayName: z.string().min(1),
  /** Avatar URL (optional). */
  avatarUrl: z.string().url().optional(),
  /** Whether the user has completed onboarding. */
  onboarded: z.boolean(),
})

export type UserIdentity = z.infer<typeof userIdentitySchema>

// ── Session Identity ────────────────────────────────────────────────────────

export const sessionIdentitySchema = z.object({
  /** Auth session ID. */
  sessionId: z.string().min(1),
  /** User identity. */
  user: userIdentitySchema,
  /** Active org scope ID (if selected). */
  activeOrgId: z.string().optional(),
  /** Timestamp when session was created. */
  issuedAt: z.string().datetime(),
  /** Timestamp when session expires. */
  expiresAt: z.string().datetime(),
})

export type SessionIdentity = z.infer<typeof sessionIdentitySchema>

// ── User Display Profile (minimal cross-app shape) ──────────────────────────

export const userDisplayProfileSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  avatarUrl: z.string().url().optional(),
  initials: z.string().max(3),
})

export type UserDisplayProfile = z.infer<typeof userDisplayProfileSchema>
