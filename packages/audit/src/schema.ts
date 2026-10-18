import { z } from 'zod'

// ─── Audit Entry Schema ─────────────────────────────────────────────────────

export const auditEntrySchema = z.object({
  id: z.string().uuid(),
  timestamp: z.string().datetime(),
  actorId: z.string().min(1),
  orgId: z.string().min(1),
  action: z.string().min(1),
  resource: z.string().min(1),
  resourceId: z.string().optional(),
  payload: z.record(z.unknown()),
  prevHash: z.string(),
  hash: z.string(),
  // Absent means the historical, top-level-only v1 hash contract.
  hashVersion: z.union([z.literal(1), z.literal(2)]).optional(),
  traceId: z.string().optional(),
  spanId: z.string().optional(),
})

export type AuditEntry = z.infer<typeof auditEntrySchema>
export type AuditHashVersion = 1 | 2

// ─── Audit Input (before hashing) ───────────────────────────────────────────

export const auditInputSchema = z.object({
  actorId: z.string().min(1),
  orgId: z.string().min(1),
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
  orgId: z.string().min(1),
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
  // Optional on historical serialized verification reports; current verifiers always emit both.
  hashCoverage: z.enum(['FULL', 'LEGACY_PARTIAL']).optional(),
  legacyEntriesChecked: z.number().int().nonnegative().optional(),
  firstEntry: z.string().uuid().optional(),
  lastEntry: z.string().uuid().optional(),
  brokenAt: z.string().uuid().optional(),
  error: z.string().optional(),
})

export type VerificationResult = z.infer<typeof verificationResultSchema>

// ─── Genesis Hash (first entry has no predecessor) ──────────────────────────

export const GENESIS_HASH = '0'.repeat(64)
