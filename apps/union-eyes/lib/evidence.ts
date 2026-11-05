/**
 * Evidence pipeline — Union-Eyes app.
 *
 * Bridges union/labor governance actions to the NzilaOS evidence pipeline for
 * tamper-proof audit trails on grievances, elections, dues, and compliance.
 */
import { randomUUID } from 'node:crypto'
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
  artifacts: Array<{ type: string; data: unknown }>
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
  // A caller-supplied artifact must actually reach the durable evidence processor.
  // Never let the os-core metadata fallback seal an apparently complete pack when
  // Union Eyes supplied no evidence. Validate before any upload or DB side effect.
  if (!Array.isArray(action.artifacts) || action.artifacts.length < 1 || action.artifacts.length > 20) {
    throw new Error('Union evidence requires between 1 and 20 actual artifacts')
  }
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(action.orgId)) {
    throw new Error('Union evidence requires an explicit organization UUID')
  }
  if (!action.actorId || action.actorId === 'unknown') {
    throw new Error('Union evidence requires an identified actor')
  }
  const actionId = randomUUID()
  const additionalArtifacts = action.artifacts.map((artifact, index) => {
    if (!artifact || !/^[a-z][a-z0-9_-]{0,63}$/i.test(artifact.type)) {
      throw new Error('Union evidence artifact type is invalid')
    }
    const json = JSON.stringify(artifact.data)
    if (typeof json !== 'string') throw new Error('Union evidence artifact data must be JSON-serializable')
    const buffer = Buffer.from(json, 'utf8')
    if (buffer.length === 0 || buffer.length > 1_048_576) {
      throw new Error('Union evidence artifact exceeds the 1 MiB limit')
    }
    return {
      artifactId: `ue-${actionId}-${index + 1}`,
      artifactType: artifact.type,
      filename: `ue-${index + 1}-${artifact.type}.json`,
      buffer,
      contentType: 'application/json',
      retentionClass: '7_YEARS' as const,
      classification: 'CONFIDENTIAL' as const,
    }
  })
  const ctx: GovernanceActionContext = {
    actionId,
    actionType: action.actionType,
    orgId: action.orgId,
    executedBy: action.actorId,
    additionalArtifacts,
  }
  const pack = buildEvidencePackFromAction(ctx)
  if (pack.artifacts.length !== action.artifacts.length) {
    throw new Error('Union evidence artifact count mismatch before persistence')
  }
  return processEvidencePack(pack)
}
