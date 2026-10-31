import { describe, expect, it, vi } from 'vitest'

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: vi.fn() }))

import { addressSha256, extractAddress, normalizeAddress } from '../address-suppression'

describe('address suppression helpers', () => {
  it('hashes the lower-cased, trimmed address, so case and spacing do not escape a suppression', () => {
    expect(addressSha256('  Person@Example.COM ')).toBe(addressSha256('person@example.com'))
    expect(addressSha256('a@example.com')).toMatch(/^[0-9a-f]{64}$/)
    expect(addressSha256('a@example.com')).not.toBe(addressSha256('b@example.com'))
    expect(normalizeAddress(' X@Y.Z ')).toBe('x@y.z')
  })

  it('reads the address out of a display-name form and refuses text that is not an address', () => {
    expect(extractAddress('Jane Doe <jane@example.com>')).toBe('jane@example.com')
    expect(extractAddress('jane@example.com')).toBe('jane@example.com')
    expect(extractAddress('not an address')).toBeNull()
    expect(extractAddress('<>')).toBeNull()
  })
})