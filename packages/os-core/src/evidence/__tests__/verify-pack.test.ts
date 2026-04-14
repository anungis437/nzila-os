import { describe, it, expect, vi, beforeEach } from 'vitest'

const mockExistsSync = vi.fn()
const mockReadFileSync = vi.fn()

vi.mock('node:fs', () => ({
  existsSync: (...args: any[]) => mockExistsSync(...args),
  readFileSync: (...args: any[]) => mockReadFileSync(...args),
}))

import { verifyPackIndex } from '../verify-pack'
import { generateSeal, type SealablePackIndex } from '../seal'

describe('verify-pack', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when file does not exist', () => {
    mockExistsSync.mockReturnValue(false)
    const result = verifyPackIndex('/tmp/missing.json')
    expect(result.overallValid).toBe(false)
    expect(result.errors).toContain('File not found: /tmp/missing.json')
  })

  it('returns error for invalid JSON', () => {
    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockReturnValue('not json {{{')
    const result = verifyPackIndex('/tmp/bad.json')
    expect(result.overallValid).toBe(false)
    expect(result.errors[0]).toContain('Invalid JSON')
  })

  it('verifies a validly sealed pack', () => {
    const packIndex: SealablePackIndex = {
      packId: 'IR-2026-001',
      orgId: 'org-1',
      artifacts: [{ sha256: 'abc123', type: 'resolution' }],
    }
    const sealed = { ...packIndex, seal: generateSeal(packIndex) }

    mockExistsSync.mockImplementation((p: string) => p === '/tmp/pack.json')
    mockReadFileSync.mockReturnValue(JSON.stringify(sealed))

    const result = verifyPackIndex('/tmp/pack.json')
    expect(result.packId).toBe('IR-2026-001')
    expect(result.sealValid).toBe(true)
    expect(result.overallValid).toBe(true)
  })

  it('returns invalid for tampered content', () => {
    const packIndex: SealablePackIndex = {
      packId: 'IR-001',
      orgId: 'org-1',
      artifacts: [{ sha256: 'abc', type: 'audit' }],
    }
    const sealed = { ...packIndex, seal: generateSeal(packIndex) }
    ;(sealed as any).orgId = 'tampered-org'

    mockExistsSync.mockImplementation((p: string) => p === '/tmp/pack.json')
    mockReadFileSync.mockReturnValue(JSON.stringify(sealed))

    const result = verifyPackIndex('/tmp/pack.json')
    expect(result.sealValid).toBe(false)
    expect(result.overallValid).toBe(false)
  })

  it('verifies artifact file hashes when artifactsDir provided', () => {
    const packIndex: SealablePackIndex = {
      packId: 'IR-001',
      orgId: 'org-1',
      artifacts: [
        {
          sha256: '2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824',
          type: 'doc',
          filename: 'doc.txt',
        },
      ],
    }
    const sealed = { ...packIndex, seal: generateSeal(packIndex) }

    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/pack.json') return JSON.stringify(sealed)
      // Return 'hello' which has sha256 = 2cf24dba5fb0a30e26e83b2ac5b9e29e1b161e5c1fa7425e73043362938b9824
      return Buffer.from('hello')
    })

    const result = verifyPackIndex('/tmp/pack.json', { artifactsDir: '/tmp/artifacts' })
    expect(result.artifactsChecked).toBe(1)
    expect(result.artifactHashErrors).toHaveLength(0)
    expect(result.overallValid).toBe(true)
  })

  it('reports hash mismatch for corrupted artifact files', () => {
    const packIndex: SealablePackIndex = {
      packId: 'IR-001',
      orgId: 'org-1',
      artifacts: [
        { sha256: 'expected-hash', type: 'doc', filename: 'doc.txt' },
      ],
    }
    const sealed = { ...packIndex, seal: generateSeal(packIndex) }

    mockExistsSync.mockReturnValue(true)
    mockReadFileSync.mockImplementation((p: string) => {
      if (p === '/tmp/pack.json') return JSON.stringify(sealed)
      return Buffer.from('corrupted content')
    })

    const result = verifyPackIndex('/tmp/pack.json', { artifactsDir: '/tmp/artifacts' })
    expect(result.artifactHashErrors.length).toBeGreaterThan(0)
    expect(result.overallValid).toBe(false)
  })

  it('sanitizes filenames to prevent path traversal', () => {
    const packIndex: SealablePackIndex = {
      packId: 'IR-001',
      orgId: 'org-1',
      artifacts: [
        { sha256: 'abc', type: 'doc', filename: '../../../etc/passwd' },
      ],
    }
    const sealed = { ...packIndex, seal: generateSeal(packIndex) }

    // existsSync returns true for pack, true for dir, but NOT for sanitized file
    mockExistsSync.mockImplementation((p: string) => {
      if (p.includes('etc')) return false
      return true
    })
    mockReadFileSync.mockReturnValue(JSON.stringify(sealed))

    const result = verifyPackIndex('/tmp/pack.json', { artifactsDir: '/tmp/artifacts' })
    // The traversal filename gets sanitized → file won't be found → not checked
    expect(result.artifactsChecked).toBe(0)
  })

  it('verifies with HMAC key', () => {
    const packIndex: SealablePackIndex = {
      packId: 'IR-001',
      orgId: 'org-1',
      artifacts: [{ sha256: 'abc', type: 'audit' }],
    }
    const sealed = { ...packIndex, seal: generateSeal(packIndex, { hmacKey: 'secret' }) }

    mockExistsSync.mockImplementation((p: string) => p === '/tmp/pack.json')
    mockReadFileSync.mockReturnValue(JSON.stringify(sealed))

    const result = verifyPackIndex('/tmp/pack.json', { hmacKey: 'secret' })
    expect(result.signatureVerified).toBe(true)
    expect(result.overallValid).toBe(true)
  })
})
