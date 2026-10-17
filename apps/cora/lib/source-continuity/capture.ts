import {
  sourceCaptureDraftSchema,
  sourceCaptureSchema,
  type SourceCapture,
  type SourceCaptureDraft,
} from './contracts'
import { sha256Canonical } from './integrity'
import { evaluateRights } from './rights'

export function createSourceCapture(
  input: SourceCaptureDraft,
  trustedOrgId: string,
  evaluatedAt: string,
): SourceCapture {
  const draft = sourceCaptureDraftSchema.parse(input)

  if (draft.orgId !== trustedOrgId) {
    throw new Error('Capture organization does not match trusted Cora organization')
  }

  const decision = evaluateRights(draft.rights, 'CAPTURE', {
    purpose: draft.purpose,
    recipientId: draft.recipientId,
    at: evaluatedAt,
  })
  if (!decision.allowed) {
    throw new Error(`Capture is not authorized: ${decision.reasons.join(', ')}`)
  }

  return sourceCaptureSchema.parse({
    ...draft,
    integritySha256: sha256Canonical(draft),
  })
}

export function verifySourceCaptureIntegrity(capture: SourceCapture): boolean {
  const parsed = sourceCaptureSchema.parse(capture)
  const { integritySha256, ...draft } = parsed
  return sha256Canonical(draft) === integritySha256
}
