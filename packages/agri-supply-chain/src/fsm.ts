// ---------------------------------------------------------------------------
// @nzila/agri-supply-chain — Step order FSM
// ---------------------------------------------------------------------------
// Validates supply chain step ordering:
// harvest → collection → storage → processing → transport → delivery
// ---------------------------------------------------------------------------

import { SupplyChainStepType } from '@nzila/agri-core'
import type { SupplyChainStepType as StepType } from '@nzila/agri-core'

const STEP_ORDER: readonly StepType[] = [
  SupplyChainStepType.HARVEST,
  SupplyChainStepType.COLLECTION,
  SupplyChainStepType.STORAGE,
  SupplyChainStepType.PROCESSING,
  SupplyChainStepType.TRANSPORT,
  SupplyChainStepType.DELIVERY,
]

/**
 * Get the ordinal position of a step type.
 * Returns -1 if the step type is unknown.
 */
export function getStepOrdinal(stepType: StepType): number {
  return STEP_ORDER.indexOf(stepType)
}

/**
 * Validate that a new step type can follow a previous step.
 * Processing is optional (can be skipped).
 * Steps cannot go backwards.
 */
export function canFollowStep(
  previousType: StepType | null,
  nextType: StepType,
): { ok: true } | { ok: false; error: string } {
  if (previousType === null) {
    if (nextType !== SupplyChainStepType.HARVEST) {
      return { ok: false, error: `First step must be harvest, got: ${nextType}` }
    }
    return { ok: true }
  }

  const prevIdx = getStepOrdinal(previousType)
  const nextIdx = getStepOrdinal(nextType)

  if (nextIdx < 0) {
    return { ok: false, error: `Unknown step type: ${nextType}` }
  }

  if (nextIdx <= prevIdx) {
    return { ok: false, error: `Step ${nextType} cannot follow ${previousType} (must advance)` }
  }

  // Allow skipping processing (index 3) but not other steps
  if (nextIdx - prevIdx > 1) {
    const skipped = STEP_ORDER.slice(prevIdx + 1, nextIdx)
    const nonOptional = skipped.filter((s) => s !== SupplyChainStepType.PROCESSING)
    if (nonOptional.length > 0) {
      return { ok: false, error: `Cannot skip non-optional steps: ${nonOptional.join(', ')}` }
    }
  }

  return { ok: true }
}

/**
 * Get the next expected step types (including optional processing skip).
 */
export function getNextStepTypes(currentType: StepType | null): readonly StepType[] {
  if (currentType === null) return [SupplyChainStepType.HARVEST]

  const idx = getStepOrdinal(currentType)
  if (idx < 0 || idx >= STEP_ORDER.length - 1) return []

  const next = STEP_ORDER[idx + 1]!
  // If next is processing (optional), also allow the step after that
  if (next === SupplyChainStepType.PROCESSING && idx + 2 < STEP_ORDER.length) {
    return [next, STEP_ORDER[idx + 2]!]
  }
  return [next]
}

/**
 * Check if a step type is the terminal step (delivery).
 */
export function isTerminalStep(stepType: StepType): boolean {
  return stepType === SupplyChainStepType.DELIVERY
}

export const SupplyChainFSM = {
  stepOrder: STEP_ORDER,
  getStepOrdinal,
  canFollowStep,
  getNextStepTypes,
  isTerminalStep,
} as const
