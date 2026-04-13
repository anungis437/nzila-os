import { z } from 'zod'

/**
 * Actor / User schemas — canonical identity types for Nzila OS.
 */

export const userIdentitySchema = z.object({
  userId: z.string().min(1),
  email: z.string().email(),
  displayName: z.string().min(1),
  avatarUrl: z.string().url().optional(),
  onboarded: z.boolean(),
})
export type UserIdentity = z.infer<typeof userIdentitySchema>

export const userDisplayProfileSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  email: z.string().email(),
  avatarUrl: z.string().url().optional(),
  initials: z.string().max(3),
})
export type UserDisplayProfile = z.infer<typeof userDisplayProfileSchema>

export const actorContextSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().optional(),
  email: z.string().email().optional(),
  orgId: z.string().min(1),
  orgRole: z.string().min(1),
  sessionId: z.string().optional(),
  platformRoles: z.array(z.string()).default([]),
  activeFlags: z.array(z.string()).default([]),
  entitlements: z.array(z.string()).default([]),
  schemaVersion: z.string().default('1.0.0'),
})
export type ActorContext = z.infer<typeof actorContextSchema>

export const sessionContextSchema = z.object({
  sessionId: z.string().min(1),
  user: userIdentitySchema,
  activeOrgId: z.string().optional(),
  issuedAt: z.string().datetime(),
  expiresAt: z.string().datetime(),
})
export type SessionContext = z.infer<typeof sessionContextSchema>
