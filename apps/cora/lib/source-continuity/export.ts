import { continuityCapsuleSchema, verifyCapsuleIntegrity, type ContinuityCapsule } from './capsule'
import { canonicalizeJson } from './integrity'
import { evaluateRights } from './rights'

export function exportContinuityCapsule(
  input: ContinuityCapsule,
  recipientId: string,
  purpose: string,
  exportedAt: string,
): string {
  const capsule = continuityCapsuleSchema.parse(input)
  if (!verifyCapsuleIntegrity(capsule)) {
    throw new Error('Capsule integrity verification failed before export')
  }
  if (purpose !== capsule.purpose) {
    throw new Error('Export purpose does not match capsule purpose')
  }

  for (const capture of capsule.captures) {
    const decision = evaluateRights(capture.rights, 'EXPORT', {
      purpose,
      recipientId,
      at: exportedAt,
    })
    if (!decision.allowed) {
      throw new Error(`Capsule export is not authorized: ${decision.reasons.join(', ')}`)
    }
  }

  return canonicalizeJson(capsule)
}
