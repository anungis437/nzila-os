/**
 * @nzila/org — Org Scope Zod Schemas
 *
 * Runtime validation schemas for org_scope context shapes.
 * Used at system boundaries (API inputs, middleware, event payloads).
 */
import { z } from 'zod'

// ── Org Context Schema ──────────────────────────────────────────────────────

export const orgContextSchema = z.object({
  orgId: z.string().min(1, 'orgId is required'),
  actorId: z.string().min(1, 'actorId is required'),
  appId: z.string().optional(),
  role: z.string().min(1, 'role is required'),
  permissions: z.array(z.string()),
  requestId: z.string().min(1, 'requestId is required'),
  correlationId: z.string().optional(),
})

// ── Db Context Schema ───────────────────────────────────────────────────────

export const dbContextSchema = z.object({
  orgId: z.string().min(1, 'orgId is required'),
  actorId: z.string().min(1, 'actorId is required'),
  correlationId: z.string().optional(),
  actorRole: z.string().optional(),
})

// ── Parse Helpers ───────────────────────────────────────────────────────────

/** Parse and validate an OrgContext at runtime. Throws on invalid input. */
export function parseOrgContext(value: unknown) {
  return orgContextSchema.parse(value)
}

/** Safe-parse an OrgContext (returns { success, data, error }). */
export function safeParseOrgContext(value: unknown) {
  return orgContextSchema.safeParse(value)
}

/** Parse and validate a DbContext at runtime. */
export function parseDbContext(value: unknown) {
  return dbContextSchema.parse(value)
}
