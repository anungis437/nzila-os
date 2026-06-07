/**
 * Evidence pipeline — Union-Eyes app.
 *
 * Bridges union/labor governance actions to the NzilaOS evidence pipeline for
 * tamper-proof audit trails on grievances, elections, dues, and compliance.
 */
import {
  buildEvidencePackFromAction,
  processEvidencePack,
  generateSeal,
  verifySeal,
  type GovernanceActionContext,
  type EvidencePackResult,
} from '@nzila/os-core/evidence'

export { generateSeal, verifySeal }
export type { EvidencePackResult }

/** Simplified evidence action used by union-eyes route handlers. */
interface UnionEvidenceAction {
  actionType: string
  orgId: string
  actorId: string
  artifacts: Array<{ type: string; data: any }>
}

/**
 * Build and seal an evidence pack for a union governance action.
 *
 * @example
 * ```ts
 * const result = await buildUnionEvidencePack({
 *   actionType: 'GRIEVANCE_RESOLVED',
 *   orgId: grievanceId,
 *   actorId: userId,
 *   artifacts: [{ type: 'resolution', data: resolution }],
 * })
 * ```
 */
export async function buildUnionEvidencePack(
  action: UnionEvidenceAction,
): Promise<EvidencePackResult> {
  const ctx: GovernanceActionContext = {
    actionId: `ue-${action.actionType}-${Date.now()}`,
    actionType: action.actionType,
    orgId: action.orgId,
    executedBy: action.actorId,
  }
  const pack = await buildEvidencePackFromAction(ctx)
  return processEvidencePack(pack)
}
