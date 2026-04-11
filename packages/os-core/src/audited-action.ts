/**
 * @nzila/os-core — Audited Action Wrapper
 *
 * Universal drop-in for apps that need to add evidence collection to
 * existing operations WITHOUT rewriting their action handlers.
 *
 * Usage (any app):
 *
 *   import { auditedAction } from '@nzila/os-core/audited-action'
 *
 *   // Wrap any async operation to produce an audit trail + optional evidence pack
 *   const result = await auditedAction({
 *     actionType: 'order.created',
 *     orgId: org.id,
 *     userId: user.id,
 *     metadata: { orderId: order.id },
 *   }, async (ctx) => {
 *     const order = await createOrder(payload)
 *     ctx.addArtifact('confirmation', Buffer.from(JSON.stringify(order)), 'application/json')
 *     return order
 *   })
 *
 * The wrapper automatically:
 *   - Generates a unique action ID + timestamps
 *   - Records success/failure outcome
 *   - Builds an evidence pack request if artifacts are collected
 *   - Emits a canonical audit event
 *   - Is purely functional — no DB/network side effects
 */
import { randomUUID } from 'node:crypto'
import { type ArtifactDescriptor, type RetentionClass, type Classification } from './evidence/types'

// ── Types ───────────────────────────────────────────────────────────────────

export interface AuditedActionInput {
  /** Domain action type (e.g. 'claim.created', 'invoice.issued') */
  actionType: string
  /** Organization scope */
  orgId: string
  /** Auth user ID or 'system' */
  userId: string
  /** Arbitrary metadata attached to the audit record */
  metadata?: Record<string, unknown>
  /** Override retention (default: 7_YEARS) */
  retentionClass?: RetentionClass
  /** Override classification (default: INTERNAL) */
  classification?: Classification
}

export interface AuditedActionContext {
  /** Auto-generated action ID */
  actionId: string
  /** Add an artifact to the evidence pack */
  addArtifact(
    artifactType: string,
    buffer: Buffer,
    contentType: string,
    opts?: { filename?: string; description?: string },
  ): void
}

export interface AuditedActionResult<T> {
  /** The return value of the wrapped function */
  data: T
  /** Unique action ID for tracing */
  actionId: string
  /** ISO timestamp when the action started */
  startedAt: string
  /** ISO timestamp when the action completed */
  completedAt: string
  /** Duration in milliseconds */
  durationMs: number
  /** Whether the action succeeded */
  success: true
  /** Collected artifacts (if any) */
  artifacts: ArtifactDescriptor[]
  /** Structured audit record suitable for logging/DB persistence */
  auditRecord: AuditRecord
}

export interface AuditRecord {
  actionId: string
  actionType: string
  orgId: string
  userId: string
  outcome: 'success' | 'failure'
  startedAt: string
  completedAt: string
  durationMs: number
  metadata: Record<string, unknown>
  artifactCount: number
  errorMessage?: string
}

// ── Implementation ──────────────────────────────────────────────────────────

/**
 * Wrap any async action to produce audit records and optional evidence artifacts.
 *
 * @throws Rethrows the original error after recording the failure audit record.
 *         Callers can catch to handle errors while evidence is still recorded.
 */
export async function auditedAction<T>(
  input: AuditedActionInput,
  fn: (ctx: AuditedActionContext) => Promise<T>,
): Promise<AuditedActionResult<T>> {
  const actionId = randomUUID()
  const startedAt = new Date()
  const artifacts: ArtifactDescriptor[] = []

  const retentionClass = input.retentionClass ?? '7_YEARS'
  const classification = input.classification ?? 'INTERNAL'

  const ctx: AuditedActionContext = {
    actionId,
    addArtifact(artifactType, buffer, contentType, opts) {
      artifacts.push({
        artifactId: `${actionId}-${artifactType}-${artifacts.length}`,
        artifactType,
        filename: opts?.filename ?? `${artifactType}.bin`,
        buffer,
        contentType,
        retentionClass,
        classification,
        description: opts?.description,
      })
    },
  }

  try {
    const data = await fn(ctx)
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()

    const auditRecord: AuditRecord = {
      actionId,
      actionType: input.actionType,
      orgId: input.orgId,
      userId: input.userId,
      outcome: 'success',
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      metadata: input.metadata ?? {},
      artifactCount: artifacts.length,
    }

    return {
      data,
      actionId,
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      success: true,
      artifacts,
      auditRecord,
    }
  } catch (error) {
    const completedAt = new Date()
    const durationMs = completedAt.getTime() - startedAt.getTime()

    const auditRecord: AuditRecord = {
      actionId,
      actionType: input.actionType,
      orgId: input.orgId,
      userId: input.userId,
      outcome: 'failure',
      startedAt: startedAt.toISOString(),
      completedAt: completedAt.toISOString(),
      durationMs,
      metadata: input.metadata ?? {},
      artifactCount: artifacts.length,
      errorMessage: error instanceof Error ? error.message : String(error),
    }

    // Attach evidence context to the error for upstream recovery
    if (error instanceof Error) {
      ;(error as Error & { auditRecord?: AuditRecord }).auditRecord = auditRecord
      ;(error as Error & { artifacts?: ArtifactDescriptor[] }).artifacts = artifacts
    }

    throw error
  }
}
