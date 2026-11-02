import { describe, expect, it } from 'vitest'
import { AttestationContractSchema } from './attestations/index'
import { ProofOfClaimInputSchema } from './claims/index'

const uuid = '11111111-1111-4111-8111-111111111111'

describe('Zod 4 TrustCore contracts regression', () => {
  it('preserves attestation defaults and a valid payload hash', () => {
    const input = { contractId: 'trustops.claim.v1', version: '1', subject: { kind: 'proof_of_claim', id: uuid }, attesterUserId: 'trustee-1', orgId: uuid, payloadHash: 'a'.repeat(64), signedAt: '2026-11-02T00:00:00Z', signature: 'signed' }
    expect(AttestationContractSchema.parse(input).severity).toBe('medium')
    expect(AttestationContractSchema.safeParse({ ...input, payloadHash: 'invalid' }).success).toBe(false)
    expect(AttestationContractSchema.safeParse({ ...input, subject: { kind: 'untrusted', id: uuid } }).success).toBe(false)
  })
  it('preserves claim defaults and rejects negative or malformed inputs', () => {
    const input = { orgId: uuid, mandateId: uuid, creditorId: uuid, amountClaimed: 50 }
    const parsed = ProofOfClaimInputSchema.parse(input)
    expect(parsed.currency).toBe('CAD')
    expect(parsed.status).toBe('submitted')
    expect(ProofOfClaimInputSchema.safeParse({ ...input, amountClaimed: -1 }).success).toBe(false)
    expect(ProofOfClaimInputSchema.safeParse({ ...input, orgId: 'other-org' }).success).toBe(false)
  })
})
