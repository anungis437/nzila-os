/**
 * ABR Governance Bridge — Single Entrypoint
 *
 * All ABR backend events (TypeScript side) MUST pass through this module.
 * This bridge enforces:
 *   1. Org context validation (UUID, non-nil)
 *   2. Audit taxonomy mapping (only ABR-defined actions)
 *   3. Evidence trigger (terminal events generate sealed evidence packs)
 *   4. Dispatcher-only integration (no direct SDK calls)
 *
 * Direct imports of @nzila/os-core/audit, @nzila/os-core/evidence,
 * @nzila/integrations-core, or @nzila/integrations-runtime from ABR
 * application code (pages, actions, API routes) are FORBIDDEN.
 * All platform interactions go through this bridge.
 *
 * Python-side counterpart: apps/abr/backend/compliance/governance_bridge.py
 *
 * @module apps/abr/lib/governance-bridge
 */

import {
  buildAbrAuditEvent,
  validateAbrAuditEvent,
  AbrAuditAction,
  AbrEntityType,
  type AbrAuditEvent,
  type BuildAbrAuditOpts,
} from '@nzila/os-core/audit/abr'

import {
  generateSeal,
  verifySeal,
  type SealEnvelope,
} from '@nzila/os-core/evidence/seal'

import {
  buildEvidencePackFromAction,
  processEvidencePack,
  type GovernanceActionContext,
  type EvidencePackResult,
} from '@nzila/os-core/evidence'

import {
  buildAbrSendRequest,
  dispatchAbrNotification,
  type AbrNotificationRequest,
} from './integration-events'

import {
  buildAbrEvidencePack,
  isTerminalEvent,
  ABR_TERMINAL_EVENTS,
  type AbrEvidenceContext,
  type AbrEvidencePackResult,
} from './evidence-packs'

// ── Org Validation ──────────────────────────────────────────────────────────

const NIL_UUID = '00000000-0000-0000-0000-000000000000'
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export class OrgContextError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'OrgContextError'
  }
}

export class AuditTaxonomyError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'AuditTaxonomyError'
  }
}

/**
 * Validate that an org ID is a valid, non-nil UUID.
 * Throws OrgContextError on failure.
 */
export function validateOrgContext(orgId: string): void {
  if (!orgId || typeof orgId !== 'string') {
    throw new OrgContextError('orgId is required and must be a non-empty string')
  }
  if (!UUID_RE.test(orgId)) {
    throw new OrgContextError(`orgId must be a valid UUID, got: ${orgId}`)
  }
  if (orgId === NIL_UUID) {
    throw new OrgContextError('orgId must not be the nil UUID (00000000-0000-0000-0000-000000000000)')
  }
}

/**
 * Validate that an audit action belongs to the ABR taxonomy.
 */
export function validateAuditAction(action: string): asserts action is AbrAuditAction {
  const validActions = Object.values(AbrAuditAction) as string[]
  if (!validActions.includes(action)) {
    throw new AuditTaxonomyError(
      `Unknown ABR audit action: ${action}. Valid actions: ${validActions.join(', ')}`,
    )
  }
}

/**
 * Validate that an entity type belongs to the ABR taxonomy.
 */
export function validateEntityType(entityType: string): asserts entityType is AbrEntityType {
  const validTypes = Object.values(AbrEntityType) as string[]
  if (!validTypes.includes(entityType)) {
    throw new AuditTaxonomyError(
      `Unknown ABR entity type: ${entityType}. Valid types: ${validTypes.join(', ')}`,
    )
  }
}

// ── Bridge Interface ────────────────────────────────────────────────────────

/**
 * Emit a validated audit event through the platform audit pipeline.
 *
 * Enforces:
 * - org context validation
 * - audit taxonomy mapping
 * - event structure validation
 */
export function emitAudit(opts: BuildAbrAuditOpts): AbrAuditEvent {
  // 1. Validate org context
  validateOrgContext(opts.orgId)

  // 2. Validate taxonomy
  validateAuditAction(opts.action)
  validateEntityType(opts.entityType)

  // 3. Build the validated event
  const event = buildAbrAuditEvent(opts)

  // 4. Validate the built event
  const errors = validateAbrAuditEvent(event)
  if (errors.length > 0) {
    throw new AuditTaxonomyError(
      `Audit event validation failed: ${errors.join('; ')}`,
    )
  }

  return event
}

/**
 * Trigger evidence pack creation for a terminal event.
 *
 * Only ABR terminal events (DECISION_ISSUED, EXPORT_GENERATED, CASE_CLOSED)
 * trigger evidence packs. All other events are rejected.
 *
 * Enforces:
 * - org context validation
 * - terminal event check
 * - seal generation with Merkle root and HMAC
 */
export async function triggerEvidence(ctx: AbrEvidenceContext): Promise<AbrEvidencePackResult> {
  // 1. Validate org context
  validateOrgContext(ctx.orgId)

  // 2. Terminal event check is handled by buildAbrEvidencePack

  // 3. Delegate to the evidence pack builder
  return buildAbrEvidencePack(ctx)
}

/**
 * Verify seal integrity for an evidence pack (re-verification).
 */
export { verifySeal, generateSeal }

/**
 * Dispatch a notification through the integrations-runtime dispatcher.
 *
 * ABR MUST NOT call integration SDKs directly.
 *
 * Enforces:
 * - org context validation
 * - dispatcher-only routing
 */
export { dispatchAbrNotification, buildAbrSendRequest }

// ── Re-exports for consuming code ───────────────────────────────────────────

export {
  AbrAuditAction,
  AbrEntityType,
  ABR_TERMINAL_EVENTS,
  isTerminalEvent,
}

export type {
  AbrAuditEvent,
  BuildAbrAuditOpts,
  AbrNotificationRequest,
  AbrEvidenceContext,
  AbrEvidencePackResult,
  SealEnvelope,
  GovernanceActionContext,
  EvidencePackResult,
}
