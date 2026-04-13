import { describe, it, expect } from 'vitest'
import { validatePassword } from './password'

describe('validatePassword', () => {
  it('accepts a valid password', () => {
    const result = validatePassword('SecurePass1!')
    expect(result.valid).toBe(true)
    expect(result.errors).toHaveLength(0)
  })

  it('rejects a password that is too short', () => {
    const result = validatePassword('Ab1!')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at least 8'))).toBe(true)
  })

  it('rejects a password that is too long', () => {
    const longPass = 'A'.repeat(100) + 'b1!' + 'x'.repeat(30)
    const result = validatePassword(longPass)
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('at most 128'))).toBe(true)
  })

  it('rejects password without uppercase letter', () => {
    const result = validatePassword('lowercase1!')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('uppercase'))).toBe(true)
  })

  it('rejects password without lowercase letter', () => {
    const result = validatePassword('UPPERCASE1!')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('lowercase'))).toBe(true)
  })

  it('rejects password without digit', () => {
    const result = validatePassword('NoDigitHere!')
    expect(result.valid).toBe(false)
    expect(result.errors.some(e => e.includes('digit'))).toBe(true)
  })

  it('accumulates multiple errors', () => {
    const result = validatePassword('abc')
    expect(result.valid).toBe(false)
    expect(result.errors.length).toBeGreaterThan(1)
  })
})
