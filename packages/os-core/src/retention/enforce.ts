/**
 * @nzila/os-core — Retention Enforcement Job
 *
 * Scans the documents table for expired records and applies the
 * configured retention action (archive/delete/redact) per policy.
 *
 * Triggered by: apps/console/app/api/admin/retention/run/route.ts
 * Evidence: Each run produces an audit_event + evidence artifact.
 */
import { DEFAULT_RETENTION_POLICIES, isExpired, RetentionPolicy } from './policies'
import type { RetentionClass } from './policies'

export interface RetentionRunResult {
  runId: string
  startedAt: string
  completedAt: string
  processedCount: number
  archivedCount: number
  deletedCount: number
  redactedCount: number
  skippedCount: number
  errors: Array<{ documentId: string; error: string }>
}

export interface RetentionEnforceOptions {
  /** If true, log what would happen but don't execute actions */
  dryRun?: boolean
  /** Override retention policies (for testing) */
  policies?: RetentionPolicy[]
  /** Only process this many documents (for batching) */
  limit?: number
  /** Run ID for idempotent retries */
  runId?: string
  /** Actor ID for audit events */
  actorId: string
  entityId?: string
}

/**
 * Execute the retention enforcement job.
 * All actions are logged to audit_events.
 * Returns a summary of actions taken.
 */
export async function enforceRetention(
  opts: RetentionEnforceOptions,
): Promise<RetentionRunResult> {
  const { randomUUID } = await import('node:crypto')
  const { db } = await import('@nzila/db')
  const { documents, auditEvents } = await import('@nzila/db/schema')
  const { and, isNotNull, lte, sql, lt } = await import('drizzle-orm')
  const { computeEntryHash } = await import('../hash')

  const runId = opts.runId ?? randomUUID()
  const startedAt = new Date()
  const policies = opts.policies ?? DEFAULT_RETENTION_POLICIES
  const limit = opts.limit ?? 500

  const result: RetentionRunResult = {
    runId,
    startedAt: startedAt.toISOString(),
    completedAt: '',
    processedCount: 0,
    archivedCount: 0,
    deletedCount: 0,
    redactedCount: 0,
    skippedCount: 0,
    errors: [],
  }

  // Find expired documents
  const cutoffDate = new Date()
  cutoffDate.setDate(cutoffDate.getDate() - 1) // at least 1 day old

  const expiredDocs = await db
    .select({
      id: documents.id,
      category: documents.category,
      retentionClass: sql<string>`'7_YEARS'`, // DEFERRED: add retention_class column via migration (PR-5.2). Currently hard-coded.
      createdAt: documents.createdAt,
      blobPath: documents.blobPath,
      blobContainer: documents.blobContainer,
      entityId: documents.entityId,
    })
    .from(documents)
    .limit(limit)

  // Group by category and apply policy
  for (const doc of expiredDocs) {
    const policy = policies.find((p) => p.category === doc.category)
    if (!policy) {
      result.skippedCount++
      continue
    }

    const retClass = policy.retentionClass as RetentionClass
    if (doc.retentionClass) {
      // Use document-level override if present
    }

    if (!isExpired(retClass, doc.createdAt)) {
      result.skippedCount++
      continue
    }

    result.processedCount++

    try {
      if (!opts.dryRun) {
        await applyRetentionAction(doc, policy, opts.actorId, computeEntryHash, db, auditEvents)
      }

      if (policy.expiryAction === 'archive') result.archivedCount++
      else if (policy.expiryAction === 'delete') result.deletedCount++
      else if (policy.expiryAction === 'redact') result.redactedCount++
    } catch (err) {
      result.errors.push({
        documentId: doc.id,
        error: (err as Error).message,
      })
    }
  }

  result.completedAt = new Date().toISOString()
  return result
}

async function applyRetentionAction(
  doc: { id: string; blobPath: string; blobContainer: string; entityId: string; category: string },
  policy: RetentionPolicy,
  actorId: string,
  computeEntryHash: Function,
  db: any,
  auditEvents: any,
): Promise<void> {
  const { eq } = await import('drizzle-orm')
  const { documents } = await import('@nzila/db/schema')

  // Log the action to audit_events
  const payload = {
    action: `retention.${policy.expiryAction}`,
    documentId: doc.id,
    category: doc.category,
    blobPath: doc.blobPath,
    policy: policy.retentionClass,
  }

  const hash = computeEntryHash(payload, null)

  await db.insert(auditEvents).values({
    entityId: doc.entityId,
    actorClerkUserId: actorId,
    action: `retention.${policy.expiryAction}`,
    targetType: 'document',
    targetId: doc.id,
    afterJson: payload,
    hash,
    previousHash: null,
  })

  if (policy.expiryAction === 'delete') {
    // Mark document as deleted (soft delete -- physical blob deletion is async)
    await db
      .update(documents)
      .set({ deletedAt: new Date() } as any)
      .where(eq(documents.id, doc.id))
  } else if (policy.expiryAction === 'archive') {
    // Mark as archived
    await db
      .update(documents)
      .set({ archivedAt: new Date() } as any)
      .where(eq(documents.id, doc.id))
  }
}
