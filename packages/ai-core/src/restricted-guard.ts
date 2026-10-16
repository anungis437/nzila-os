import { evaluateRestrictedModelPath, type PlatformTier } from '@nzila/platform-restricted-data'
import { AiControlPlaneError } from './types'
import type { DataClass, RedactionMode } from './types'

/**
 * Restricted model traffic is denied before a provider call.
 * Requests that are not classified Restricted are unchanged.
 */
export function guardRestrictedGatewayRequest(input: {
  classification?: PlatformTier
  dataClass: DataClass
  redactionMode?: RedactionMode
  modelPathId?: string
  text?: string
}): void {
  const decision = evaluateRestrictedModelPath({
    classification: input.classification,
    redactionMode: input.redactionMode,
    modelPathId: input.modelPathId,
    text: input.text,
  })
  if (!decision.allowed) {
    throw new AiControlPlaneError('policy_denied', decision.reason, 403)
  }
}
