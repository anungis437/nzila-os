import { z } from 'zod'

// ─── Audit Entry Schema ─────────────────────────────────────────────────────

export const auditEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  actorId: z.string().min(1),
  tenantId: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  payload: z.record(z.unknown()),
  prevHash: z.string(),
  hash: z.string(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
})

export type AuditEntry = z.infer<typeof auditEntrySchema>

// ─── Audit Input (before hashing) ───────────────────────────────────────────

export const auditInputSchema = z.object({
  actorId: z.string().min(1),
  tenantId: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  payload: z.record(z.unknown()),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
})

export type AuditInput = z.infer<typeof auditInputSchema>

// ─── Root Hash Snapshot ─────────────────────────────────────────────────────

export const rootHashSnapshotSchema = z.object({
  id: z.string().uuid(),
  tenantId: z.string().min(1),
  timestamp: z.string().datetime(),
  entryCount: z.number().int().nonnegative(),
  rootHash: z.string(),
  firstEntryId: z.string().uuid(),
  lastEntryId: z.string().uuid(),
})

export type RootHashSnapshot = z.infer<typeof rootHashSnapshotSchema>

// ─── Verification Result ────────────────────────────────────────────────────

export const verificationResultSchema = z.object({
  valid: z.boolean(),
  entriesChecked: z.number().int().nonnegative(),
  firstEntry: z.string().uuid().optional(),
  lastEntry: z.string().uuid().optional(),
  brokenAt: z.string().uuid().optional(),
  error: z.string().optional(),
})

export type VerificationResult = z.infer<typeof verificationResultSchema>

// ─── Genesis Hash (first entry has no predecessor) ──────────────────────────

export const GENESIS_HASH = '0'.repeat(64)
