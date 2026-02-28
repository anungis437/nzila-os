import { LotStatus, ShipmentStatus } from '../enums'

// ─── Lot Quality FSM ───
// pending → inspected → graded → certified | rejected

export interface LotTransition {
  readonly from: LotStatus
  readonly to: LotStatus
  readonly evidenceRequired: boolean
}

const LOT_TRANSITIONS: readonly LotTransition[] = [
  { from: LotStatus.PENDING, to: LotStatus.INSPECTED, evidenceRequired: false },
  { from: LotStatus.INSPECTED, to: LotStatus.GRADED, evidenceRequired: false },
  { from: LotStatus.GRADED, to: LotStatus.CERTIFIED, evidenceRequired: true },
  { from: LotStatus.GRADED, to: LotStatus.REJECTED, evidenceRequired: true },
  // Allow re-inspection
  { from: LotStatus.INSPECTED, to: LotStatus.REJECTED, evidenceRequired: true },
]

export function attemptLotTransition(
  current: LotStatus,
  target: LotStatus,
): { ok: true; transition: LotTransition } | { ok: false; error: string } {
  const transition = LOT_TRANSITIONS.find((t) => t.from === current && t.to === target)
  if (!transition) {
    return { ok: false, error: `Invalid lot transition: ${current} → ${target}` }
  }
  return { ok: true, transition }
}

export function getLotTransitions(current: LotStatus): readonly LotTransition[] {
  return LOT_TRANSITIONS.filter((t) => t.from === current)
}

export function isTerminalLotStatus(status: LotStatus): boolean {
  return status === LotStatus.CERTIFIED || status === LotStatus.REJECTED
}

// ─── Shipment FSM ───
// planned → packed → dispatched → arrived → closed

export interface ShipmentTransition {
  readonly from: ShipmentStatus
  readonly to: ShipmentStatus
  readonly evidenceRequired: boolean
}

const SHIPMENT_TRANSITIONS: readonly ShipmentTransition[] = [
  { from: ShipmentStatus.PLANNED, to: ShipmentStatus.PACKED, evidenceRequired: false },
  { from: ShipmentStatus.PACKED, to: ShipmentStatus.DISPATCHED, evidenceRequired: false },
  { from: ShipmentStatus.DISPATCHED, to: ShipmentStatus.ARRIVED, evidenceRequired: false },
  { from: ShipmentStatus.ARRIVED, to: ShipmentStatus.CLOSED, evidenceRequired: true },
]

export function attemptShipmentTransition(
  current: ShipmentStatus,
  target: ShipmentStatus,
): { ok: true; transition: ShipmentTransition } | { ok: false; error: string } {
  const transition = SHIPMENT_TRANSITIONS.find((t) => t.from === current && t.to === target)
  if (!transition) {
    return { ok: false, error: `Invalid shipment transition: ${current} → ${target}` }
  }
  return { ok: true, transition }
}

export function getShipmentTransitions(current: ShipmentStatus): readonly ShipmentTransition[] {
  return SHIPMENT_TRANSITIONS.filter((t) => t.from === current)
}

export function isTerminalShipmentStatus(status: ShipmentStatus): boolean {
  return status === ShipmentStatus.CLOSED
}

// ─── Named FSM aggregates (for external reference) ───

export const LotQualityFSM = {
  transitions: LOT_TRANSITIONS,
  attempt: attemptLotTransition,
  available: getLotTransitions,
  isTerminal: isTerminalLotStatus,
} as const

export const ShipmentFSM = {
  transitions: SHIPMENT_TRANSITIONS,
  attempt: attemptShipmentTransition,
  available: getShipmentTransitions,
  isTerminal: isTerminalShipmentStatus,
} as const
