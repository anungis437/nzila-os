import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('getQboEnv / validateQboEnv', () => {
  const validEnv = {
    INTUIT_APP_ID: '550e8400-e29b-41d4-a716-446655440000',
    INTUIT_CLIENT_ID: 'client-123',
    INTUIT_CLIENT_SECRET: 'secret-456',
    INTUIT_REDIRECT_URI: 'https://example.com/callback',
    INTUIT_ENVIRONMENT: 'sandbox',
  }

  beforeEach(() => {
    vi.resetModules()
    vi.unstubAllEnvs()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('validates correct env vars', async () => {
    for (const [k, v] of Object.entries(validEnv)) {
      vi.stubEnv(k, v)
    }
    const { validateQboEnv } = await import('./env')
    expect(() => validateQboEnv()).not.toThrow()
  })

  it('throws for missing INTUIT_CLIENT_ID', async () => {
    vi.stubEnv('INTUIT_APP_ID', '550e8400-e29b-41d4-a716-446655440000')
    vi.stubEnv('INTUIT_CLIENT_SECRET', 'secret')
    vi.stubEnv('INTUIT_REDIRECT_URI', 'https://example.com')
    vi.stubEnv('INTUIT_ENVIRONMENT', 'sandbox')
    const { validateQboEnv } = await import('./env')
    expect(() => validateQboEnv()).toThrow()
  })
})
