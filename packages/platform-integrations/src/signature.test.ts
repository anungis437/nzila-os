import { describe, it, expect } from 'vitest'
import { computeHmacSignature, verifyHmacSignature } from './signature'

describe('Signature', () => {
  const secret = 'test-secret-key-12345'
  const payload = JSON.stringify({ event: 'case.created', id: 'abc-123' })

  describe('computeHmacSignature', () => {
    it('produces consistent sha256 signatures', () => {
      const sig1 = computeHmacSignature(payload, secret, 'hmac-sha256')
      const sig2 = computeHmacSignature(payload, secret, 'hmac-sha256')
      expect(sig1).toBe(sig2)
      // Format: sha256=<64 hex chars>
      expect(sig1).toMatch(/^sha256=[a-f0-9]{64}$/)
    })

    it('produces different signatures for different payloads', () => {
      const sig1 = computeHmacSignature('payload-a', secret, 'hmac-sha256')
      const sig2 = computeHmacSignature('payload-b', secret, 'hmac-sha256')
      expect(sig1).not.toBe(sig2)
    })

    it('produces different signatures for different secrets', () => {
      const sig1 = computeHmacSignature(payload, 'secret-1', 'hmac-sha256')
      const sig2 = computeHmacSignature(payload, 'secret-2', 'hmac-sha256')
      expect(sig1).not.toBe(sig2)
    })

    it('supports sha512', () => {
      const sig = computeHmacSignature(payload, secret, 'hmac-sha512')
      // Format: sha512=<128 hex chars>
      expect(sig).toMatch(/^sha512=[a-f0-9]{128}$/)
    })
  })

  describe('verifyHmacSignature', () => {
    it('returns true for valid signature', () => {
      const sig = computeHmacSignature(payload, secret, 'hmac-sha256')
      expect(verifyHmacSignature(payload, secret, sig, 'hmac-sha256')).toBe(true)
    })

    it('returns false for tampered payload', () => {
      const sig = computeHmacSignature(payload, secret, 'hmac-sha256')
      expect(verifyHmacSignature(payload + 'x', secret, sig, 'hmac-sha256')).toBe(false)
    })

    it('returns false for wrong secret', () => {
      const sig = computeHmacSignature(payload, secret, 'hmac-sha256')
      expect(verifyHmacSignature(payload, 'wrong-secret', sig, 'hmac-sha256')).toBe(false)
    })

    it('returns false for invalid signature format', () => {
      expect(verifyHmacSignature(payload, secret, 'not-a-valid-hex', 'hmac-sha256')).toBe(false)
    })
  })
})
