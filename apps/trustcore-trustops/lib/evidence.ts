/**
 * Evidence pipeline — TrustCore TrustOps app.
 *
 * Wires @nzila/os-core/evidence for tamper-proof governance audit trails.
 * Every mandate lifecycle action in TrustOps produces an evidence pack
 * that is stored in blob storage and sealed with a Merkle root.
 */
import {
  buildEvidencePackFromAction,
  processEvidencePack,
  generateSeal,
  verifySeal,
  type GovernanceActionContext,
  type EvidencePackResult,
} from '@nzila/os-core/evidence'

export {
  buildEvidencePackFromAction,
  processEvidencePack,
  generateSeal,
  verifySeal,
}
export type { GovernanceActionContext, EvidencePackResult }

/**
 * Convenience: build + process an evidence pack in one call.
 */
export async function recordGovernanceAction(
  action: GovernanceActionContext,
): Promise<EvidencePackResult> {
  const pack = buildEvidencePackFromAction(action)
  return processEvidencePack(pack)
}
