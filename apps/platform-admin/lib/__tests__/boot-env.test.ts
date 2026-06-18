import { describe, expect, it, afterEach, vi } from 'vitest'
import { assertPlatformAdminBootEnv } from '../boot-env'

describe('boot-env — platform-admin environment validation', () => {
  afterEach(() => {
    vi.unstubAllEnvs()
  })

  describe('assertPlatformAdminBootEnv', () => {
    it('skips validation when NODE_ENV is not production', () => {
      vi.stubEnv('NODE_ENV', 'development')
      // Should not throw even though required vars are missing
      expect(() => assertPlatformAdminBootEnv()).not.toThrow()
    })

    it('throws when NODE_ENV is production and CONTROL_PLANE_URL missing', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('CONTROL_PLANE_API_KEY', 'key')
      vi.stubEnv('ORCHESTRATOR_API_URL', 'http://orch')
      // CONTROL_PLANE_URL not stubbed (simulates missing env var)

      expect(() => assertPlatformAdminBootEnv()).toThrow(
        'Missing required environment variable: CONTROL_PLANE_URL',
      )
    })

    it('throws when NODE_ENV is production and CONTROL_PLANE_API_KEY missing', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('CONTROL_PLANE_URL', 'http://cp')
      vi.stubEnv('ORCHESTRATOR_API_URL', 'http://orch')
      // CONTROL_PLANE_API_KEY not stubbed

      expect(() => assertPlatformAdminBootEnv()).toThrow(
        'Missing required environment variable: CONTROL_PLANE_API_KEY',
      )
    })

    it('throws when NODE_ENV is production and ORCHESTRATOR_API_URL missing', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('CONTROL_PLANE_URL', 'http://cp')
      vi.stubEnv('CONTROL_PLANE_API_KEY', 'key')
      // ORCHESTRATOR_API_URL not stubbed

      expect(() => assertPlatformAdminBootEnv()).toThrow(
        'Missing required environment variable: ORCHESTRATOR_API_URL',
      )
    })

    it('throws when env var is empty string', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('CONTROL_PLANE_URL', '')
      vi.stubEnv('CONTROL_PLANE_API_KEY', 'key')
      vi.stubEnv('ORCHESTRATOR_API_URL', 'http://orch')

      expect(() => assertPlatformAdminBootEnv()).toThrow(
        'Missing required environment variable: CONTROL_PLANE_URL',
      )
    })

    it('succeeds when NODE_ENV is production and all required vars present', () => {
      vi.stubEnv('NODE_ENV', 'production')
      vi.stubEnv('CONTROL_PLANE_URL', 'http://cp')
      vi.stubEnv('CONTROL_PLANE_API_KEY', 'key')
      vi.stubEnv('ORCHESTRATOR_API_URL', 'http://orch')

      expect(() => assertPlatformAdminBootEnv()).not.toThrow()
    })

    it('skips validation for test NODE_ENV', () => {
      vi.stubEnv('NODE_ENV', 'test')
      // Simulate missing env vars without stubbing them

      expect(() => assertPlatformAdminBootEnv()).not.toThrow()
    })
  })
})
