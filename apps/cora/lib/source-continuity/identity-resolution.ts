import { identityResolutionSchema, type IdentityResolution, type RightsSnapshot } from './contracts'
import { evaluateRights } from './rights'

export function validateIdentityResolution(
  input: IdentityResolution,
  rights: RightsSnapshot,
  trustedOrgId: string,
  purpose: string,
  recipientId: string,
  evaluatedAt: string,
): IdentityResolution {
  const resolution = identityResolutionSchema.parse(input)
  if (resolution.orgId !== trustedOrgId) {
    throw new Error('Identity resolution organization does not match trusted Cora organization')
  }
  const decision = evaluateRights(rights, 'IDENTITY_RESOLUTION', {
    purpose,
    recipientId,
    at: evaluatedAt,
  })
  if (!decision.allowed) {
    throw new Error(`Identity resolution is not authorized: ${decision.reasons.join(', ')}`)
  }
  return resolution
}
