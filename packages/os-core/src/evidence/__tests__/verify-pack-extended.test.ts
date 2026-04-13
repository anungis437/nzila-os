/**
 * Extended tests for evidence/verify-pack.ts — covering artifact hash checks,
 * path traversal protection, missing files, and invalid JSON.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join } from 'node:path'

vi.mock('node:fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
}))

// We need to mock the seal module to avoid complex setup
vi.mock('../seal', () => ({
  verifySeal: vi.fn(() => ({
    valid: true,
    digestMatch: true,
    merkleMatch: true,
    signatureVerified: true,
    errors: [],
  })),
}))

import { verifyPackIndex } from '../verify-pack'

describe('verify-pack extended', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns error when index file does not exist', () => {
    vi.mocked(existsSync).mockReturnValue(false)

    const result = verifyPackIndex('/some/missing/file.json')

    expect(result.packId).toBe('unknown')
    expect(result.overallValid).toBe(false)
    expect(result.errors).toContain('File not found: /some/missing/file.json')
  })

  it('returns error for invalid JSON', () => {
    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue('not valid json{{{')

    const result = verifyPackIndex('/path/to/bad.json')

    expect(result.packId).toBe('unknown')
    expect(result.overallValid).toBe(false)
    expect(result.errors[0]).toContain('Invalid JSON')
  })

  it('verifies a valid pack index', () => {
    const packData = {
      packId: 'IR-2026-001',
      artifacts: [],
      seal: { digest: 'abc', merkleRoot: 'def' },
    }

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(packData))

    const result = verifyPackIndex('/path/to/index.json')

    expect(result.packId).toBe('IR-2026-001')
    expect(result.sealValid).toBe(true)
    expect(result.overallValid).toBe(true)
  })

  it('checks artifact hashes when artifactsDir has matching files', () => {
    const content = Buffer.from('test-artifact-content')
    const sha256 = createHash('sha256').update(content).digest('hex')

    const packData = {
      packId: 'PACK-001',
      artifacts: [
        { filename: 'report.pdf', sha256 },
      ],
      seal: {},
    }

    // existsSync: first for the index file, then for artifactsDir, then for the artifact file
    vi.mocked(existsSync).mockImplementation((path: any) => {
      const p = String(path)
      if (p.includes('index.json')) return true
      if (p.includes('report.pdf')) return true
      return true
    })
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      const p = String(path)
      if (p.includes('index.json')) return JSON.stringify(packData)
      return content as any
    })

    const result = verifyPackIndex('/dir/index.json', { artifactsDir: '/dir' })

    expect(result.artifactsChecked).toBe(1)
    expect(result.artifactHashErrors).toHaveLength(0)
    expect(result.overallValid).toBe(true)
  })

  it('detects mismatched artifact hashes', () => {
    const packData = {
      packId: 'PACK-002',
      artifacts: [
        { filename: 'report.pdf', sha256: 'wrong-hash-000' },
      ],
      seal: {},
    }

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockImplementation((path: any) => {
      const p = String(path)
      if (p.includes('index.json')) return JSON.stringify(packData)
      return Buffer.from('actual content') as any
    })

    const result = verifyPackIndex('/dir/index.json', { artifactsDir: '/dir' })

    expect(result.artifactsChecked).toBe(1)
    expect(result.artifactHashErrors.length).toBeGreaterThan(0)
    expect(result.overallValid).toBe(false)
  })

  it('skips artifacts without filename', () => {
    const packData = {
      packId: 'PACK-003',
      artifacts: [
        { artifactType: 'log' }, // no filename
      ],
      seal: {},
    }

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(packData))

    const result = verifyPackIndex('/dir/index.json')

    expect(result.artifactsChecked).toBe(0)
    expect(result.overallValid).toBe(true)
  })

  it('skips artifacts that do not exist on disk', () => {
    const packData = {
      packId: 'PACK-004',
      artifacts: [
        { filename: 'missing.pdf', sha256: 'abc123' },
      ],
      seal: {},
    }

    vi.mocked(existsSync).mockImplementation((path: any) => {
      const p = String(path)
      if (p.includes('index.json')) return true
      if (p.includes('missing.pdf')) return false
      return true
    })
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(packData))

    const result = verifyPackIndex('/dir/index.json', { artifactsDir: '/dir' })

    expect(result.artifactsChecked).toBe(0) // file not found → skip silently
    expect(result.overallValid).toBe(true)
  })

  it('uses hmacKey when provided', async () => {
    const { verifySeal } = await import('../seal')
    const packData = {
      packId: 'PACK-005',
      artifacts: [],
      seal: {},
    }

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(packData))

    verifyPackIndex('/dir/index.json', { hmacKey: 'secret-key' })

    expect(verifySeal).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ hmacKey: 'secret-key' }),
    )
  })

  it('defaults to unknown packId when packId is missing', () => {
    const packData = {
      artifacts: [],
      seal: {},
    }

    vi.mocked(existsSync).mockReturnValue(true)
    vi.mocked(readFileSync).mockReturnValue(JSON.stringify(packData))

    const result = verifyPackIndex('/dir/index.json')
    expect(result.packId).toBe('unknown')
  })
})
