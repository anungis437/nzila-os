import {
  continuityCapsuleSchema,
  computeCapsuleIntegrity,
  type ContinuityCapsule,
  verifyCapsuleIntegrity,
} from './capsule'
import { sha256Canonical } from './integrity'
import { evaluateRights } from './rights'

export function revokeCapsuleRights(
  input: ContinuityCapsule,
  trustedOrgId: string,
  trustedActorId: string,
  revokedAt: string,
): ContinuityCapsule {
  const capsule = continuityCapsuleSchema.parse(input)
  if (capsule.orgId !== trustedOrgId) {
    throw new Error('Capsule organization does not match trusted Cora organization')
  }
  if (!verifyCapsuleIntegrity(capsule)) {
    throw new Error('Capsule integrity verification failed before rights revocation')
  }
  if (!Number.isFinite(Date.parse(revokedAt))) {
    throw new Error('Revocation time must be a valid timestamp')
  }
  for (const capture of capsule.captures) {
    const decision = evaluateRights(capture.rights, 'REVOKE', {
      purpose: capture.purpose,
      recipientId: capture.recipientId,
      at: revokedAt,
      actorId: trustedActorId,
    })
    if (!decision.allowed) {
      throw new Error(`Rights revocation is not authorized: ${decision.reasons.join(', ')}`)
    }
  }

  const captures = capsule.captures.map((capture) => {
    const previous = capture.rights.revokedAt
    const effectiveRevocation =
      previous && Date.parse(previous) <= Date.parse(revokedAt) ? previous : revokedAt
    const { integritySha256: _previousDigest, ...draft } = capture
    const updated = {
      ...draft,
      rights: { ...draft.rights, revokedAt: effectiveRevocation },
    }
    return {
      ...updated,
      integritySha256: sha256Canonical(updated),
    }
  })
  const { integrity: _previousIntegrity, ...draft } = capsule
  const revokedDraft = { ...draft, captures }

  return continuityCapsuleSchema.parse({
    ...revokedDraft,
    integrity: computeCapsuleIntegrity(revokedDraft),
  })
}
