/**
 * Evidence pipeline — test-scaffold-gp app.
 *
 * Bridges governance actions to the NzilaOS evidence pipeline for
 * tamper-proof audit trails on high-risk scaffold operations.
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
 * Build and seal an evidence pack for a scaffold governance action.
 */
export async function buildScaffoldEvidencePack(
  action: GovernanceActionContext,
): Promise<EvidencePackResult> {
  const pack = await buildEvidencePackFromAction(action)
  return processEvidencePack(pack)
}
