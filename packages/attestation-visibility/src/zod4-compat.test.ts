import { describe, expect, it } from 'vitest'
import { attestationEnvelopeProjectionSchema } from './index'

const valid = {contentHash:'sha256:abc',class:'release',verdict:'unknown',issuedAt:'2026-11-02T10:00:00.000Z',issuer:'witness',interpretation:'Not certified',accessClass:'governance-forum'}

describe('Zod 4 attestation-visibility schema compatibility', () => {
  it('accepts the canonical shape and rejects a malformed or unsafe input', () => {
    expect(attestationEnvelopeProjectionSchema.safeParse(valid).success).toBe(true)
    expect(attestationEnvelopeProjectionSchema.safeParse({...valid,verdict:'verified-by-default'}).success).toBe(false)
  })
})
