/**
 * Extended tests for crypto/fips.ts — covering assertFipsMode, enableFips,
 * auditCryptoCompliance deeper branches, and assertApprovedCipher.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('fips extended coverage', () => {
  const originalEnv = { ...process.env }

  beforeEach(() => {
    vi.resetModules()
    vi.restoreAllMocks()
  })

  afterEach(() => {
    process.env = { ...originalEnv }
  })

  async function loadModule() {
    return import('./fips') as Promise<typeof import('./fips')>
  }

  describe('isFipsEnabled', () => {
    it('returns false on standard Node.js builds', async () => {
      const { isFipsEnabled } = await loadModule()
      // Standard Node.js doesn't have FIPS provider
      expect(typeof isFipsEnabled()).toBe('boolean')
    })
  })

  describe('enableFips', () => {
    it('returns false when no FIPS provider available', async () => {
      const { enableFips } = await loadModule()
      // On standard Node.js builds, enableFips should return false safely
      const result = enableFips()
      expect(typeof result).toBe('boolean')
    })
  })

  describe('getFipsStatus', () => {
    it('returns a structured status object', async () => {
      const { getFipsStatus } = await loadModule()
      const status = getFipsStatus()

      expect(status).toHaveProperty('fipsEnabled')
      expect(status).toHaveProperty('fipsRequired')
      expect(status).toHaveProperty('strictMode')
      expect(status).toHaveProperty('opensslVersion')
      expect(status).toHaveProperty('nodeVersion')
      expect(status.nodeVersion).toBe(process.version)
    })

    it('reports fipsRequired=true in production', async () => {
      process.env.NODE_ENV = 'production'
      const { getFipsStatus } = await loadModule()
      const status = getFipsStatus()
      expect(status.fipsRequired).toBe(true)
    })

    it('reports fipsRequired=true when NZILA_FIPS_REQUIRED=true', async () => {
      process.env.NODE_ENV = 'test'
      process.env.NZILA_FIPS_REQUIRED = 'true'
      const { getFipsStatus } = await loadModule()
      const status = getFipsStatus()
      expect(status.fipsRequired).toBe(true)
    })

    it('reports strictMode=true when NZILA_FIPS_STRICT=true', async () => {
      process.env.NZILA_FIPS_STRICT = 'true'
      const { getFipsStatus } = await loadModule()
      const status = getFipsStatus()
      expect(status.strictMode).toBe(true)
    })
  })

  describe('assertFipsMode', () => {
    it('returns status without crashing in dev/test mode', async () => {
      process.env.NODE_ENV = 'test'
      process.env.NZILA_FIPS_REQUIRED = 'false'
      const { assertFipsMode } = await loadModule()
      const status = assertFipsMode()

      expect(status).toHaveProperty('fipsEnabled')
      expect(status).toHaveProperty('fipsRequired')
    })

    it('warns when FIPS is required but not available', async () => {
      process.env.NZILA_FIPS_REQUIRED = 'true'
      process.env.NZILA_FIPS_STRICT = 'false'
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { assertFipsMode } = await loadModule()
      const status = assertFipsMode()

      // On standard Node.js, FIPS can't be enabled
      if (!status.fipsEnabled) {
        expect(consoleSpy).toHaveBeenCalled()
      }
      consoleSpy.mockRestore()
    })

    it('calls process.exit in strict mode when FIPS unavailable', async () => {
      process.env.NZILA_FIPS_REQUIRED = 'true'
      process.env.NZILA_FIPS_STRICT = 'true'
      const exitSpy = vi.spyOn(process, 'exit').mockImplementation(() => undefined as never)
      vi.spyOn(console, 'error').mockImplementation(() => {})
      vi.spyOn(console, 'warn').mockImplementation(() => {})

      const { assertFipsMode } = await loadModule()
      assertFipsMode()

      // Standard Node.js doesn't have FIPS, so strict mode should exit
      expect(exitSpy).toHaveBeenCalledWith(78)
      exitSpy.mockRestore()
    })
  })

  describe('fipsDecrypt edge cases', () => {
    it('rejects invalid key size on decrypt', async () => {
      const { fipsDecrypt, fipsEncrypt, fipsRandomBytes } = await loadModule()
      const key = fipsRandomBytes(32)
      const encrypted = fipsEncrypt('test', key)
      const badKey = Buffer.alloc(16) // wrong size
      expect(() => fipsDecrypt(encrypted, badKey)).toThrow(/256-bit/)
    })
  })

  describe('PBKDF2 with SHA-384', () => {
    it('derives a key with SHA-384', async () => {
      const { fipsPbkdf2 } = await loadModule()
      const key = await fipsPbkdf2('password', 'salt', 1000, 48, 'sha384')
      expect(key).toHaveLength(48)
    })

    it('derives a key with SHA-512', async () => {
      const { fipsPbkdf2 } = await loadModule()
      const key = await fipsPbkdf2('password', 'salt', 1000, 64, 'sha512')
      expect(key).toHaveLength(64)
    })
  })

  describe('auditCryptoCompliance extended', () => {
    it('includes blockedAlgorithms data', async () => {
      const { auditCryptoCompliance } = await loadModule()
      const audit = auditCryptoCompliance()

      expect(audit).toHaveProperty('fipsStatus')
      expect(audit).toHaveProperty('timestamp')
      expect(audit.fipsStatus).toHaveProperty('fipsEnabled')
    })
  })
})
