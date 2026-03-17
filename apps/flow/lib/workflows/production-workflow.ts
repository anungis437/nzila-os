/**
 * Flow — Production Workflow State Machine
 *
 * Governs the production lifecycle from proof to ship-ready.
 */
import type { ProductionJobStatus } from '@/domain/entities'
import type { Transition, TransitionResult } from './types'
import { InvalidTransitionError } from './types'
import { logger } from '@/lib/logger'

const TRANSITIONS: readonly Transition<ProductionJobStatus>[] = [
  { from: 'PENDING_PROOF', to: 'PROOF_SENT', label: 'Proof sent to client', auditEvent: 'proof_sent' },
  { from: 'PROOF_SENT', to: 'PROOF_APPROVED', label: 'Proof approved', auditEvent: 'proof_approved' },
  { from: 'PROOF_SENT', to: 'PENDING_PROOF', label: 'Proof rejected — redo', auditEvent: 'proof_rejected' },
  { from: 'PROOF_APPROVED', to: 'IN_PRODUCTION', label: 'Production started', auditEvent: 'production_started' },
  { from: 'IN_PRODUCTION', to: 'QUALITY_CHECK', label: 'Quality check', auditEvent: 'quality_check_started' },
  { from: 'QUALITY_CHECK', to: 'READY_TO_SHIP', label: 'Passed QC — ready to ship', auditEvent: 'production_completed' },
  { from: 'QUALITY_CHECK', to: 'IN_PRODUCTION', label: 'QC failed — redo', auditEvent: 'quality_check_failed' },
] as const

export function validateProductionTransition(
  from: ProductionJobStatus,
  to: ProductionJobStatus,
): boolean {
  return TRANSITIONS.some((t) => t.from === from && t.to === to)
}

export function attemptProductionTransition(
  current: ProductionJobStatus,
  target: ProductionJobStatus,
): TransitionResult<ProductionJobStatus> {
  const transition = TRANSITIONS.find(
    (t) => t.from === current && t.to === target,
  )

  if (!transition) {
    logger.warn('Invalid production transition attempted', { from: current, to: target })
    return {
      ok: false,
      from: current,
      to: target,
      label: '',
      auditEvent: null,
      reason: `Production transition from ${current} to ${target} is not allowed`,
    }
  }

  logger.info('Production transition executed', {
    from: current,
    to: target,
    label: transition.label,
  })

  return {
    ok: true,
    from: current,
    to: target,
    label: transition.label,
    auditEvent: transition.auditEvent,
  }
}

export function applyProductionTransition(
  current: ProductionJobStatus,
  target: ProductionJobStatus,
): ProductionJobStatus {
  if (!validateProductionTransition(current, target)) {
    throw new InvalidTransitionError('production', current, target)
  }
  return target
}

export function getAvailableProductionTransitions(
  current: ProductionJobStatus,
): readonly Transition<ProductionJobStatus>[] {
  return TRANSITIONS.filter((t) => t.from === current)
}
