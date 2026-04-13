import { describe, it, expect } from 'vitest'
import { redactText } from './redact'
import type { RedactionMode } from './types'

describe('redactText', () => {
  describe('mode: off', () => {
    it('returns text unchanged with off mode', () => {
      const text = 'Contact me at john@example.com'
      const result = redactText(text, 'off')
      expect(result.text).toBe(text)
      expect(result.redacted).toBe(false)
      expect(result.redactions).toHaveLength(0)
    })
  })

  describe('mode: balanced', () => {
    it('redacts email addresses', () => {
      const result = redactText('Email me at user@example.com for info.', 'balanced')
      expect(result.text).not.toContain('user@example.com')
      expect(result.text).toContain('[REDACTED:EMAIL]')
      expect(result.redacted).toBe(true)
      expect(result.redactions).toContain('EMAIL')
    })

    it('redacts SSN patterns', () => {
      const result = redactText('My SSN is 123-45-6789.', 'balanced')
      expect(result.text).toContain('[REDACTED:SSN]')
      expect(result.redactions).toContain('SSN')
    })

    it('redacts credit card numbers', () => {
      const result = redactText('My card: 4111 1111 1111 1111', 'balanced')
      expect(result.text).toContain('[REDACTED:CREDIT_CARD]')
      expect(result.redactions).toContain('CREDIT_CARD')
    })

    it('returns text unchanged when no PII detected', () => {
      const text = 'The meeting is on Monday at 3pm.'
      const result = redactText(text, 'balanced')
      expect(result.redacted).toBe(false)
      expect(result.text).toBe(text)
    })
  })

  describe('mode: strict', () => {
    it('also redacts email addresses in strict mode', () => {
      const result = redactText('Reach me at admin@company.org', 'strict')
      expect(result.text).toContain('[REDACTED:EMAIL]')
      expect(result.redacted).toBe(true)
    })

    it('redacts IP addresses (strict-only pattern)', () => {
      const result = redactText('Server at 192.168.1.100 failed.', 'strict')
      expect(result.text).toContain('[REDACTED:IP_ADDRESS]')
      expect(result.redactions).toContain('IP_ADDRESS')
    })

    it('includes multiple redactions in result', () => {
      const result = redactText(
        'Email: test@test.com, card: 1234-5678-9012-3456',
        'strict',
      )
      expect(result.redactions.length).toBeGreaterThan(1)
      expect(result.redacted).toBe(true)
    })
  })

  it('returns all three fields regardless of mode', () => {
    for (const mode of ['off', 'balanced', 'strict'] as RedactionMode[]) {
      const result = redactText('Hello world', mode)
      expect(result).toHaveProperty('text')
      expect(result).toHaveProperty('redacted')
      expect(result).toHaveProperty('redactions')
    }
  })
})
