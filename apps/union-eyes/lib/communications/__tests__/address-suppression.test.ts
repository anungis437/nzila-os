import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHash } from 'node:crypto'

vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: vi.fn() }))

import { addressDigests, addressSha256, extractAddress, isAddressSuppressed, normalizeAddress } from '../address-suppression'

const KEY = 'k'.repeat(40)
const plain = (address: string) => createHash('sha256').update(address, 'utf8').digest('hex')

afterEach(() => { delete process.env.EMAIL_SUPPRESSION_HASH_KEY })

describe('address suppression helpers', () => {
  it('hashes the lower-cased, trimmed address, so case and spacing do not escape a suppression', () => {
    expect(addressSha256('  Person@Example.COM ')).toBe(addressSha256('person@example.com'))
    expect(addressSha256('a@example.com')).toMatch(/^[0-9a-f]{64}$/)
    expect(addressSha256('a@example.com')).not.toBe(addressSha256('b@example.com'))
    expect(normalizeAddress(' X@Y.Z ')).toBe('x@y.z')
  })

  it('treats an internationalized domain, its punycode form and a trailing dot as the same mailbox', () => {
    expect(normalizeAddress('Jo@Bücher.DE')).toBe('jo@xn--bcher-kva.de')
    expect(addressSha256('jo@bücher.de')).toBe(addressSha256('jo@xn--bcher-kva.de'))
    expect(addressSha256('jo@example.com.')).toBe(addressSha256('jo@example.com'))
    // A precomposed and a decomposed accent are one local part.
    expect(addressSha256('zoe\u0301@example.com')).toBe(addressSha256('zo\u00e9@example.com'))
  })

  it('does not fold plus-addressing or dots, which would suppress a different mailbox', () => {
    expect(addressSha256('a+news@example.com')).not.toBe(addressSha256('a@example.com'))
    expect(addressSha256('a.b@example.com')).not.toBe(addressSha256('ab@example.com'))
  })

  it('stores a keyed digest when a key is configured, which an unkeyed guess cannot reproduce', () => {
    process.env.EMAIL_SUPPRESSION_HASH_KEY = KEY
    const keyed = addressSha256('person@example.com')

    expect(keyed).toMatch(/^[0-9a-f]{64}$/)
    expect(keyed).not.toBe(plain('person@example.com'))
    process.env.EMAIL_SUPPRESSION_HASH_KEY = 'z'.repeat(40)
    expect(addressSha256('person@example.com')).not.toBe(keyed)
  })

  it('ignores a short or placeholder key rather than keying with something guessable', () => {
    for (const key of ['short', 'changeme', '   ']) {
      process.env.EMAIL_SUPPRESSION_HASH_KEY = key
      expect(addressSha256('person@example.com')).toBe(plain('person@example.com'))
    }
  })

  it('looks an address up under the keyed and the plain digest, so a suppression recorded either way is still honoured', () => {
    process.env.EMAIL_SUPPRESSION_HASH_KEY = KEY
    const digests = addressDigests('person@example.com')
    expect(digests).toHaveLength(2)
    expect(digests).toContain(plain('person@example.com'))

    // recorded before the key existed
    expect(isAddressSuppressed(new Set([plain('person@example.com')]), 'Person@Example.com')).toBe(true)
    // recorded under the key
    expect(isAddressSuppressed(new Set([addressSha256('person@example.com')]), 'person@example.com')).toBe(true)
    expect(isAddressSuppressed(new Set([plain('other@example.com')]), 'person@example.com')).toBe(false)
  })

  it('with no key, finds a suppression that was recorded under a key earlier only if the same key is set (documented limit)', () => {
    process.env.EMAIL_SUPPRESSION_HASH_KEY = KEY
    const recordedKeyed = addressSha256('person@example.com')
    delete process.env.EMAIL_SUPPRESSION_HASH_KEY

    expect(isAddressSuppressed(new Set([recordedKeyed]), 'person@example.com')).toBe(false)
  })

  it('reads the address out of a display-name form and refuses text that is not an address', () => {
    expect(extractAddress('Jane Doe <jane@example.com>')).toBe('jane@example.com')
    expect(extractAddress('jane@example.com')).toBe('jane@example.com')
    expect(extractAddress('not an address')).toBeNull()
    expect(extractAddress('<>')).toBeNull()
  })
})