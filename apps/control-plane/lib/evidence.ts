/**
 * Evidence pipeline — Control-Plane app.
 *
 * Bridges governance/enforcement actions to the NzilaOS evidence pipeline
 * for tamper-proof audit trails on platform changes and deployments.
 */
import {
  buildEvidencePackFromAction,
  processEvidencePack,
  generateSeal,
  verifySeal,
  type GovernanceActionContext,
  type EvidencePackResult,
} from '@nzila/os-core/evidence'

export { generateSeal, verifySeal, buildEvidencePackFromAction, processEvidencePack }
export type { EvidencePackResult }

/**
 * Build and seal an evidence pack for a platform governance action.
 */
export async function buildGovernanceEvidencePack(
  action: GovernanceActionContext,
): Promise<EvidencePackResult> {
  const pack = await buildEvidencePackFromAction(action)
  return processEvidencePack(pack)
}
