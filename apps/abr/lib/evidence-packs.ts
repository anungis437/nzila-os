/**
 * ABR Evidence Packs — Terminal/Irreversible Events
 *
 * Defines which ABR events are terminal (cannot be undone) and requires
 * evidence packs with signed hashes for regulatory compliance.
 *
 * Terminal events:
 * - Decision issued (and finalized — cannot be retroactively changed)
 * - Export generated (data left the system boundary)
 * - Case closed (no further mutations permitted)
 */
import {
  buildEvidencePackFromAction,
  processEvidencePack,
  type GovernanceActionContext,
  type EvidencePackResult,
} from '@nzila/os-core/evidence'
import { generateSeal, type SealEnvelope } from '@nzila/os-core/evidence/seal'
import { buildAbrAuditEvent, AbrAuditAction, AbrEntityType, type AbrAuditEvent } from '@nzila/os-core/audit/abr'

// ── Terminal Event Definitions ─────────────────────────────────────────────

export const ABR_TERMINAL_EVENTS = [
  AbrAuditAction.DECISION_ISSUED,
  AbrAuditAction.EXPORT_GENERATED,
  AbrAuditAction.CASE_CLOSED,
] as const

export type AbrTerminalEvent = (typeof ABR_TERMINAL_EVENTS)[number]

export function isTerminalEvent(action: string): action is AbrTerminalEvent {
  return (ABR_TERMINAL_EVENTS as readonly string[]).includes(action)
}

// ── Evidence Pack Context ──────────────────────────────────────────────────

export interface AbrEvidenceContext {
  /** The terminal action triggering evidence creation */
  action: AbrTerminalEvent

  /** Org that owns this case */
  orgId: string

  /** Actor executing the terminal action */
  actorId: string

  /** Correlation ID for distributed tracing */
  correlationId: string

  /** The entity type (usually 'abr_case' or 'abr_decision') */
  entityType: AbrEntityType

  /** The specific entity ID */
  entityId: string

  /** State transition details */
  fromState?: string
  toState?: string

  /** Additional evidence artifacts (document refs, etc.) */
  artifacts?: Record<string, unknown>

  /** Case summary / decision text for the evidence record */
  summary?: string
}

// ── Evidence Pack Result ───────────────────────────────────────────────────

export interface AbrEvidencePackResult {
  /** The platform evidence pack result */
  evidencePack: EvidencePackResult

  /** The sealed envelope for tamper detection */
  seal: SealEnvelope

  /** The audit event emitted alongside the evidence */
  auditEvent: AbrAuditEvent

  /** Timestamp of evidence creation */
  createdAt: string
}

// ── Evidence Pack Builder ──────────────────────────────────────────────────

/**
 * Build and seal an evidence pack for an ABR terminal event.
 *
 * This function:
 * 1. Validates the event is terminal (throws if not)
 * 2. Builds a GovernanceActionContext for the evidence pipeline
 * 3. Creates the sealed evidence pack with Merkle root + HMAC
 * 4. Builds the corresponding audit event
 *
 * The caller MUST persist both the evidence pack reference and the
 * audit event via the platform audit emitter.
 */
export async function buildAbrEvidencePack(
  ctx: AbrEvidenceContext,
): Promise<AbrEvidencePackResult> {
  if (!isTerminalEvent(ctx.action)) {
    throw new Error(
      `ABR evidence packs are only created for terminal events. ` +
        `Got: ${ctx.action}. Terminal events: ${ABR_TERMINAL_EVENTS.join(', ')}`,
    )
  }

  // Map to platform evidence action context
  const govAction: GovernanceActionContext = {
    actionId: `abr-${ctx.action}-${ctx.entityId}`,
    actionType: ctx.action,
    orgId: ctx.orgId,
    executedBy: ctx.actorId,
  }

  // Build and process the evidence pack
  const pack = await buildEvidencePackFromAction(govAction)
  const evidencePack = await processEvidencePack(pack)

  // Seal with cryptographic envelope
  const { createHash } = require('node:crypto') as typeof import('node:crypto')
  const sealInput = {
    packDigest: evidencePack.packId ?? ctx.entityId,
    artifacts: Object.keys(ctx.artifacts ?? {}).map((key) => ({
      sha256: createHash('sha256').update(String(ctx.artifacts?.[key] ?? key)).digest('hex'),
      name: key,
    })),
  }
  const seal = generateSeal(sealInput)

  // Build audit event for the evidence creation itself
  const auditEvent = buildAbrAuditEvent({
    action: AbrAuditAction.EVIDENCE_SEALED,
    orgId: ctx.orgId,
    actorId: ctx.actorId,
    correlationId: ctx.correlationId,
    entityType: ctx.entityType,
    entityId: ctx.entityId,
    fromState: ctx.fromState,
    toState: ctx.toState,
    metadata: {
      terminalAction: ctx.action,
      evidencePackId: evidencePack.packId,
      sealDigest: seal.packDigest,
    },
  })

  return {
    evidencePack,
    seal,
    auditEvent,
    createdAt: new Date().toISOString(),
  }
}
