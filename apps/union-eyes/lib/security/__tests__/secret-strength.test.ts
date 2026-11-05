/**
 * Secret strength (UE-CONV-H-024): a secret that is missing, a placeholder, repeated characters or too short is not a secret.
 */
import { describe, expect, it } from 'vitest'
import { secretProblem, usableSecret } from '../secret-strength'

const STRONG = '4f9c1a7be03d58a62c91f07e3b8d4a56c0e19f73ab25d684'

describe('secretProblem', () => {
  it('accepts a long random secret', () => {
    expect(secretProblem(STRONG)).toBeNull()
    expect(secretProblem(`  ${STRONG}  `)).toBeNull()
  })

  it('says why a value is not a secret', () => {
    expect(secretProblem(undefined)).toBe('missing')
    expect(secretProblem('')).toBe('missing')
    expect(secretProblem('   ')).toBe('missing')
    for (const value of ['change-me', 'CHANGEME', 'replace_me', 'placeholder', 'your-secret-here', '<secret>', 'xxxxxxxx', 'django-insecure-CHANGE-ME-IN-PRODUCTION', 'ci_build_placeholder_secret_32_chars_x', 'build_placeholder_secret_min_32_chars_xxxxxxxx']) {
      expect(secretProblem(value), value).toBe('placeholder')
    }
    expect(secretProblem('a'.repeat(40))).toBe('repetitive')
    expect(secretProblem('ab'.repeat(20))).toBe('repetitive')
    expect(secretProblem('abc123'.repeat(8))).toBe('repetitive')
    expect(secretProblem('0f3a9c')).toBe('too_short')
    expect(secretProblem('0f3a9c1b72e48d', 16)).toBe('too_short')
    expect(secretProblem('0f3a9c1b72e48d5a', 16)).toBeNull()
  })

  it('lets a test secret through outside a deployment, but never a template placeholder', () => {
    expect(secretProblem('secret', 32, false)).toBeNull()
    expect(secretProblem('secret_1', 32, false)).toBeNull()
    expect(secretProblem('secret', 32, true)).toBe('placeholder')
    expect(secretProblem('change-me', 32, false)).toBe('placeholder')
    expect(secretProblem('', 32, false)).toBe('missing')
  })
})

describe('usableSecret', () => {
  it('applies the full rules in a deployment', () => {
    for (const env of [{ NODE_ENV: 'production' }, { UE_ENVIRONMENT: 'staging' }]) {
      expect(usableSecret(STRONG, { env })).toBe(STRONG)
      expect(usableSecret('short-but-random-1', { env })).toBeNull()
      expect(usableSecret('secret', { env })).toBeNull()
      expect(usableSecret('change-me', { env })).toBeNull()
      expect(usableSecret(undefined, { env })).toBeNull()
    }
  })

  it('accepts a short secret in development and test, and still refuses an empty one or a placeholder', () => {
    const env = { NODE_ENV: 'test' }
    expect(usableSecret('secret_1', { env })).toBe('secret_1')
    expect(usableSecret(' k ', { env })).toBe('k')
    expect(usableSecret('', { env })).toBeNull()
    expect(usableSecret('changeme', { env })).toBeNull()
  })

  it('honours a minimum length a key needs', () => {
    expect(usableSecret('0123456789abcdef0123456789abcdef', { env: { NODE_ENV: 'production' }, minLength: 64 })).toBeNull()
  })
})
