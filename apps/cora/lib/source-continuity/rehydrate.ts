import { continuityCapsuleSchema, verifyCapsuleIntegrity, type ContinuityCapsule } from './capsule'
import { evaluateRights } from './rights'
import { verifySourceCaptureIntegrity } from './capture'
import { verifySemanticMapping } from './semantic-mapping'

export interface RehydrationResult {
  state: 'REHYDRATED_VERIFIED'
  capsule: ContinuityCapsule
  sourceCurrentness: 'NOT_VERIFIED'
  sourceProviderAvailable: false
}

export function rehydrateContinuityCapsule(
  serializedCapsule: string,
  trustedOrgId: string,
  recipientId: string,
  rehydratedAt: string,
): RehydrationResult {
  let decoded: unknown
  try {
    decoded = JSON.parse(serializedCapsule)
  } catch {
    throw new Error('Capsule export is not valid JSON')
  }

  const capsule = continuityCapsuleSchema.parse(decoded)
  if (!verifyCapsuleIntegrity(capsule)) {
    throw new Error('Capsule integrity verification failed during rehydration')
  }
  if (capsule.orgId !== trustedOrgId) {
    throw new Error('Capsule organization does not match trusted Cora organization')
  }
  if (capsule.captures.some((capture) => !verifySourceCaptureIntegrity(capture))) {
    throw new Error('Capsule contains a capture with invalid integrity')
  }
  if (capsule.mappings.some((mapping) => !verifySemanticMapping(mapping))) {
    throw new Error('Capsule contains a mapping with invalid definition integrity')
  }

  for (const capture of capsule.captures) {
    const decision = evaluateRights(capture.rights, 'REHYDRATE', {
      purpose: capsule.purpose,
      recipientId,
      at: rehydratedAt,
    })
    if (!decision.allowed) {
      throw new Error(`Capsule rehydration is not authorized: ${decision.reasons.join(', ')}`)
    }
  }

  return {
    state: 'REHYDRATED_VERIFIED',
    capsule,
    sourceCurrentness: 'NOT_VERIFIED',
    sourceProviderAvailable: false,
  }
}
