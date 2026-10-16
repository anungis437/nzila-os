import { ProvisioningError } from './governed-provisioning'
import { replayDigest, type ReplayInspectionState } from './post-w4p-replay'

export interface BoundaryReceipt {
  BOUNDARY_ID: string
  SOURCE_SHA256: string
  GRAPH_DIGEST: string
  PLAN_DIGEST: string
  DATABASE_SCOPE: string
  W4P_VERIFICATION_DIGEST: string
  PREDECESSOR_STATE_DIGEST: string
  EXECUTION_RESULT_DIGEST: string
  POSTCONDITION_VERIFICATION_DIGEST: string
  RECEIPT_DIGEST: string
}
export type ReceiptBinding = Omit<BoundaryReceipt, 'RECEIPT_DIGEST'>
export interface BoundaryReceiptStore {
  read(boundaryId: string): Promise<BoundaryReceipt | null>
  writeVerified(receipt: BoundaryReceipt): Promise<void>
}
export function verifyBoundaryReceipt(receipt: BoundaryReceipt, expected: ReceiptBinding): boolean {
  const { RECEIPT_DIGEST, ...body } = receipt
  return (
    Object.values(expected).every((value) => typeof value === 'string' && value.length > 0) &&
    Object.entries(expected).every(([key, value]) =>
      key.endsWith('DIGEST') || key.endsWith('SHA256') ? /^[a-f0-9]{64}$/.test(value) : true,
    ) &&
    Object.keys(body).length === Object.keys(expected).length &&
    Object.entries(expected).every(([key, value]) => body[key as keyof ReceiptBinding] === value) &&
    replayDigest(body) === RECEIPT_DIGEST
  )
}
export interface OwnedEffectObservation {
  effectId: string
  definition: 'ABSENT' | 'EXACT' | 'DRIFTED' | 'PARTIAL'
  receiptRequired: boolean
}
export function inspectBoundaryEvidence(input: {
  expectedEffectIds: string[]
  observations: OwnedEffectObservation[]
  prerequisitesVerified: boolean
  receiptVerified: boolean
  replayAbsenceProven: boolean
}): ReplayInspectionState {
  if (!input.prerequisitesVerified) return 'PRECONDITION_MISSING'
  if (
    new Set(input.expectedEffectIds).size !== input.expectedEffectIds.length ||
    new Set(input.observations.map((entry) => entry.effectId)).size !== input.observations.length ||
    input.observations.length !== input.expectedEffectIds.length ||
    input.expectedEffectIds.some((id) => !input.observations.some((entry) => entry.effectId === id))
  )
    throw new ProvisioningError('BOUNDARY_EVIDENCE_COVERAGE_INVALID')
  if (input.observations.some((entry) => entry.definition === 'DRIFTED')) return 'DRIFTED'
  if (
    input.observations.some(
      (entry) =>
        entry.definition === 'PARTIAL' || (entry.receiptRequired && !input.receiptVerified),
    )
  )
    return 'PARTIAL_OR_AMBIGUOUS'
  if (input.observations.every((entry) => entry.definition === 'EXACT')) return 'ALREADY_COMPLETE'
  if (
    input.observations.every((entry) => entry.definition === 'ABSENT') &&
    input.replayAbsenceProven
  )
    return 'REPLAY_REQUIRED'
  return 'PARTIAL_OR_AMBIGUOUS'
}

export function proveMissingPolicyParent(input: {
  requiredColumns: string[]
  baselineColumns: string[]
}) {
  const missingColumns = input.requiredColumns.filter(
    (column) => !input.baselineColumns.includes(column),
  )
  if (!missingColumns.length)
    throw new ProvisioningError('POLICY_PARENT_COUNTEREXAMPLE_REQUIRES_MISSING_COLUMNS')
  return {
    BEFORE: {
      RELATION_EXISTS: true,
      COLUMNS: [...input.baselineColumns],
      STATE: 'PRECONDITION_MISSING',
    },
    UNCHANGED_SOURCE_BEHAVIOR:
      'CREATE_POLICY_PARENT_COLUMN_REFERENCE_CANNOT_RESOLVE;no parent-column producer in this call',
    AFTER_COLUMNS: [...input.baselineColumns],
    MISSING_COLUMNS: missingColumns,
    COMPLETION_CAN_BE_OBSERVED: 'YES_MISSING_PARENT_KEY',
    SAFE_REPLAY_REQUIRED_ELIGIBILITY: 'NO',
    RECEIPT_CAN_REPAIR_MISSING_DEFINITION: 'NO',
    SEND_ATTEMPTS: 0,
    SQL_EXECUTED: 0,
    DATABASE_CONNECTIONS: 0,
  }
}
