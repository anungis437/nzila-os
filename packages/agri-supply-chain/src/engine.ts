// ---------------------------------------------------------------------------
// @nzila/agri-supply-chain — Chain engine
// ---------------------------------------------------------------------------
// Create, advance, and query supply chain records.
// Uses canonical types from @nzila/agri-core.
// ---------------------------------------------------------------------------

import type {
  SupplyChainRecord,
  SupplyChainEvent,
  SupplyChainStepType,
  SupplyChainStepStatus,
} from '@nzila/agri-core'
import { SupplyChainStatus, SupplyChainStepStatus as StepStatus } from '@nzila/agri-core'
import { canFollowStep, isTerminalStep } from './fsm'

let idCounter = 0

function makeId(prefix: string): string {
  idCounter++
  return `${prefix}_${Date.now().toString(36)}_${idCounter.toString(36)}`
}

/**
 * Create a new supply chain record.
 */
export function createSupplyChain(params: {
  orgId: string
  batchId: string
  cropType: string
  originCooperativeId: string
  originProducerId: string
  destination?: string
}): SupplyChainRecord {
  const now = new Date().toISOString()
  return {
    id: makeId('sc'),
    orgId: params.orgId,
    batchId: params.batchId,
    cropType: params.cropType,
    originCooperativeId: params.originCooperativeId,
    originProducerId: params.originProducerId,
    destination: params.destination ?? null,
    events: [],
    status: SupplyChainStatus.ACTIVE,
    createdAt: now,
    updatedAt: now,
  }
}

/**
 * Record a supply chain event. Validates step ordering via FSM.
 * Returns updated chain (immutable — creates new object).
 */
export function recordEvent(
  chain: SupplyChainRecord,
  event: {
    stepType: SupplyChainStepType
    status: SupplyChainStepStatus
    location?: { lat: number; lng: number } | null
    responsibleParty: { id: string; name: string; role: string }
    quantityKg?: number | null
    qualityGrade?: string | null
    notes?: string | null
    deviceId?: string | null
    provenanceRef?: string | null
  },
): { ok: true; chain: SupplyChainRecord } | { ok: false; error: string } {
  if (chain.status !== SupplyChainStatus.ACTIVE) {
    return { ok: false, error: `Chain is ${chain.status}, cannot record new events` }
  }

  // Find the last completed step type for FSM validation
  const completedEvents = chain.events.filter((e) => e.status === StepStatus.COMPLETED)
  const lastCompleted = completedEvents.length > 0
    ? completedEvents[completedEvents.length - 1]!.stepType
    : null

  // Only validate ordering for new step types (allow status updates for same step)
  const existingStep = chain.events.find((e) => e.stepType === event.stepType)
  if (!existingStep) {
    const validation = canFollowStep(lastCompleted, event.stepType)
    if (!validation.ok) {
      return validation
    }
  }

  const newEvent: SupplyChainEvent = {
    id: makeId('sce'),
    orgId: chain.orgId,
    chainId: chain.id,
    stepType: event.stepType,
    status: event.status,
    timestamp: new Date().toISOString(),
    completedAt: event.status === StepStatus.COMPLETED ? new Date().toISOString() : null,
    location: event.location ?? null,
    responsibleParty: event.responsibleParty,
    quantityKg: event.quantityKg ?? null,
    qualityGrade: event.qualityGrade ?? null,
    notes: event.notes ?? null,
    deviceId: event.deviceId ?? null,
    provenanceRef: event.provenanceRef ?? null,
  }

  // Check if chain should be completed (delivery step completed)
  const isComplete =
    event.status === StepStatus.COMPLETED && isTerminalStep(event.stepType)

  return {
    ok: true,
    chain: {
      ...chain,
      events: [...chain.events, newEvent],
      status: isComplete ? SupplyChainStatus.COMPLETED : chain.status,
      updatedAt: new Date().toISOString(),
    },
  }
}

/**
 * Cancel a supply chain.
 */
export function cancelSupplyChain(
  chain: SupplyChainRecord,
): SupplyChainRecord {
  return {
    ...chain,
    status: SupplyChainStatus.CANCELLED,
    updatedAt: new Date().toISOString(),
  }
}

/**
 * Get the current step type in a chain (last event's step type).
 */
export function getCurrentStep(chain: SupplyChainRecord): SupplyChainStepType | null {
  if (chain.events.length === 0) return null
  return chain.events[chain.events.length - 1]!.stepType
}

/**
 * Get all events for a specific step type.
 */
export function getEventsForStep(
  chain: SupplyChainRecord,
  stepType: SupplyChainStepType,
): readonly SupplyChainEvent[] {
  return chain.events.filter((e) => e.stepType === stepType)
}
