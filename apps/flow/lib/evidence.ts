/**
 * Evidence pipeline — Flow app.
 *
 * Uses @nzila/commerce-audit to build tamper-proof evidence packs
 * for quote lifecycle transitions (create → price → send → accept).
 */
import {
  buildCommerceEvidencePack,
  buildTransitionAuditEntry,
  CommerceEntityType,
  AuditAction,
  type CommerceEvidenceRequest,
  type CommerceEvidencePackResult,
  type TransitionAuditContext,
} from '@nzila/commerce-audit'
import { OrgRole } from '@nzila/commerce-core/enums'

export {
  buildCommerceEvidencePack,
  buildTransitionAuditEntry,
  CommerceEntityType,
  AuditAction,
}
export type { CommerceEvidencePackResult, TransitionAuditContext }

/**
 * Build an audit entry for a quote status transition.
 * Requires a successful TransitionResult to create the audit entry.
 */
export function auditQuoteTransition(ctx: {
  quoteId: string
  fromStatus: string
  toStatus: string
  userId: string
  orgId: string
}) {
  const auditCtx: TransitionAuditContext = {
    id: crypto.randomUUID(),
    orgId: ctx.orgId,
    actorId: ctx.userId,
    role: OrgRole.ADMIN,
    entityType: CommerceEntityType.QUOTE,
    targetEntityId: ctx.quoteId,
    timestamp: new Date().toISOString(),
  }
  // Build a synthetic transition result for the audit trail
  const transition = {
    ok: true as const,
    from: ctx.fromStatus,
    to: ctx.toStatus,
    label: `${ctx.fromStatus} → ${ctx.toStatus}`,
    eventsToEmit: [] as { type: string; payload: Readonly<Record<string, unknown>> }[],
    actionsToSchedule: [] as { type: string; payload: Readonly<Record<string, unknown>> }[],
    timeout: undefined,
  }
  return buildTransitionAuditEntry(transition, auditCtx)
}

/**
 * Build a sealed evidence pack for a quote lifecycle event.
 */
export async function buildQuoteEvidencePack(
  request: CommerceEvidenceRequest,
): Promise<CommerceEvidencePackResult> {
  return buildCommerceEvidencePack(request)
}

/**
 * Build an evidence pack from an action context (used by AI actions).
 */
export function buildEvidencePackFromAction(ctx: {
  actionType: string
  orgId: string
  actorId: string
  metadata?: Record<string, unknown>
}): CommerceEvidenceRequest {
  return {
    orgId: ctx.orgId,
    entityType: CommerceEntityType.QUOTE,
    targetEntityId: ctx.orgId,
    triggerEvent: ctx.actionType.toLowerCase(),
    actorId: ctx.actorId,
    auditTrail: [],
  }
}

/**
 * Process (seal) an evidence pack.
 */
export async function processEvidencePack(
  request: CommerceEvidenceRequest,
): Promise<CommerceEvidencePackResult> {
  return buildCommerceEvidencePack(request)
}
