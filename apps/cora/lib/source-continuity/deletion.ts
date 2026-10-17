import { continuityCapsuleSchema, verifyCapsuleIntegrity, type ContinuityCapsule } from './capsule'
import { evaluateRights } from './rights'

export interface DeletionObligationReport {
  capsuleId: string
  status:
    | 'NO_REPLICA_SCOPE_DECLARED'
    | 'OBLIGATIONS_REMAIN'
    | 'ALL_DECLARED_OBLIGATIONS_ACKNOWLEDGED'
  pendingReplicaIds: string[]
  acknowledgedReplicaIds: string[]
  physicalDeletion: 'NOT_VERIFIED'
  scopeLimitations: string[]
}

export function reconcileDeletionObligations(
  capsule: ContinuityCapsule,
  knownReplicaIds: string[],
  acknowledgedReplicaIds: string[],
  requestedAt: string,
): DeletionObligationReport {
  const parsedCapsule = continuityCapsuleSchema.parse(capsule)
  if (!verifyCapsuleIntegrity(parsedCapsule)) {
    throw new Error('Capsule integrity verification failed before deletion planning')
  }
  for (const capture of parsedCapsule.captures) {
    const decision = evaluateRights(capture.rights, 'DELETE', {
      purpose: capsule.purpose,
      recipientId: capture.recipientId,
      at: requestedAt,
    })
    if (!decision.allowed) {
      throw new Error(`Deletion is not authorized: ${decision.reasons.join(', ')}`)
    }
  }

  const known = [...new Set(knownReplicaIds)].sort()
  const acknowledged = [...new Set(acknowledgedReplicaIds)].sort()
  if (acknowledged.some((id) => !known.includes(id))) {
    throw new Error('Deletion acknowledgement refers to an undeclared replica target')
  }
  const pendingReplicaIds = known.filter((id) => !acknowledged.includes(id))

  return {
    capsuleId: parsedCapsule.capsuleId,
    status:
      known.length === 0
        ? 'NO_REPLICA_SCOPE_DECLARED'
        : pendingReplicaIds.length === 0
          ? 'ALL_DECLARED_OBLIGATIONS_ACKNOWLEDGED'
          : 'OBLIGATIONS_REMAIN',
    pendingReplicaIds,
    acknowledgedReplicaIds: acknowledged.filter((id) => known.includes(id)),
    physicalDeletion: 'NOT_VERIFIED',
    scopeLimitations: [
      'Only caller-declared replica targets are represented',
      'Acknowledgement does not independently prove physical deletion',
      'Provider, backup, and legal-hold systems are not queried',
    ],
  }
}
