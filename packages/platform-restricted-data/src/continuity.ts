import { randomUUID } from 'node:crypto'
import { getState } from './state'
import { PlaneError, type DelegationRecord } from './types'

/**
 * Continuity delegation is a design record only.
 * The plane does not decide incapacity and does not grant delegate access.
 */
export function proposeDelegation(input: {
  orgId: string
  principalId: string
  delegateId: string
  scope: string
  activationCondition: string
  durationMinutes: number
}): DelegationRecord {
  if (input.activationCondition === 'system_incapacity_determination') {
    throw new PlaneError(
      'INCAPACITY_NOT_DETERMINED_HERE',
      'The platform does not determine incapacity. A delegation cannot use a system incapacity condition.',
    )
  }
  if (!input.scope.trim() || input.durationMinutes <= 0) {
    throw new PlaneError('DELEGATION_SCOPE_REQUIRED', 'A delegation needs a scope and a finite duration.')
  }
  const record: DelegationRecord = {
    id: randomUUID(),
    principalId: input.principalId,
    delegateId: input.delegateId,
    orgId: input.orgId,
    scope: input.scope,
    activationCondition: input.activationCondition,
    status: 'DRAFT',
    durationMinutes: input.durationMinutes,
    requestedAt: new Date().toISOString(),
    accessGranted: false,
  }
  getState().delegations.push(record)
  return record
}

export function reviewDelegation(input: {
  delegationId: string
  reviewer: string
  decision: 'APPROVED' | 'REJECTED'
}): DelegationRecord {
  const record = getState().delegations.find((item) => item.id === input.delegationId)
  if (!record) throw new PlaneError('DELEGATION_NOT_FOUND', 'Delegation was not found.')
  if (input.reviewer === 'system' || input.reviewer === record.delegateId) {
    throw new PlaneError('DELEGATION_REVIEWER_REQUIRED', 'Review requires a person who is not the delegate and not the system.')
  }
  record.status = input.decision === 'APPROVED' ? 'APPROVED' : 'REJECTED'
  record.reviewer = input.reviewer
  record.reviewedAt = new Date().toISOString()
  record.accessGranted = false
  return record
}

export function activateDelegation(input: {
  delegationId: string
  attestationSource: string
}): { accessGranted: false; code: 'DELEGATE_ACCESS_NOT_ENABLED'; delegation: DelegationRecord } {
  const record = getState().delegations.find((item) => item.id === input.delegationId)
  if (!record) throw new PlaneError('DELEGATION_NOT_FOUND', 'Delegation was not found.')
  if (record.status !== 'APPROVED') {
    throw new PlaneError('DELEGATION_NOT_APPROVED', 'Only an approved delegation can be presented for activation.')
  }
  if (input.attestationSource !== 'external_authority') {
    throw new PlaneError(
      'INCAPACITY_NOT_DETERMINED_HERE',
      'Activation requires an external authority attestation. The platform will not decide it.',
    )
  }
  return {
    accessGranted: false,
    code: 'DELEGATE_ACCESS_NOT_ENABLED',
    delegation: record,
  }
}

export function revokeDelegation(delegationId: string): DelegationRecord {
  const record = getState().delegations.find((item) => item.id === delegationId)
  if (!record) throw new PlaneError('DELEGATION_NOT_FOUND', 'Delegation was not found.')
  record.status = 'REVOKED'
  record.revokedAt = new Date().toISOString()
  record.accessGranted = false
  return record
}
