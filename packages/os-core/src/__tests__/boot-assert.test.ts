/**
 * Tests for boot-assert.ts — Runtime boot assertions
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

describe('boot-assert', () => {
  const originalEnv = { ...process.env }
  let consoleSpy: { log: ReturnType<typeof vi.spyOn>; error: ReturnType<typeof vi.spyOn>; warn: ReturnType<typeof vi.spyOn> }
  let exitSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    vi.resetModules()
    consoleSpy = {
      log: vi.spyOn(console, 'log').mockImplementation(() => {}),
      error: vi.spyOn(console, 'error').mockImplementation(() => {}),
      warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
    }
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as never)
  })

  afterEach(() => {
    vi.restoreAllMocks()
    process.env = { ...originalEnv }
  })

  async function loadModule() {
    return import('../boot-assert') as Promise<typeof import('../boot-assert')>
  }

  it('skips assertions when NEXT_PHASE is set', async () => {
    process.env.NEXT_PHASE = 'build'
    process.env.DATABASE_URL = '' // would normally warn

    const mod = await loadModule()
    // Should have called assertBootInvariants but it returns early
    // No errors should be logged
    expect(consoleSpy.error).not.toHaveBeenCalled()
  })

  it('logs success when DATABASE_URL is set and dynamic imports succeed', async () => {
    delete process.env.NEXT_PHASE
    process.env.DATABASE_URL = 'postgresql://localhost/test'
    process.env.NODE_ENV = 'development'

    // Mock the dynamic imports
    vi.doMock('@nzila/db/scoped', () => ({}))
    vi.doMock('@nzila/db/audit', () => ({}))
    vi.doMock('../crypto/fips', () => ({
      assertFipsMode: () => ({ fipsRequired: false, fipsEnabled: false, opensslVersion: '3.x', nodeVersion: '22' }),
    }))

    const { assertBootInvariants } = await loadModule()
    // The module runs assertBootInvariants on import, but let's also call it explicitly
    await assertBootInvariants()

    expect(consoleSpy.log).toHaveBeenCalledWith(
      expect.stringContaining('structural assertions passed'),
    )
  })

  it('reports DATABASE_URL missing as a boot failure (server context)', async () => {
    delete process.env.NEXT_PHASE
    delete process.env.DATABASE_URL
    process.env.NODE_ENV = 'development'

    vi.doMock('@nzila/db/scoped', () => ({}))
    vi.doMock('@nzila/db/audit', () => ({}))
    vi.doMock('../crypto/fips', () => ({
      assertFipsMode: () => ({ fipsRequired: false, fipsEnabled: false, opensslVersion: '3.x', nodeVersion: '22' }),
    }))

    const { assertBootInvariants } = await loadModule()
    await assertBootInvariants()

    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('DATABASE_URL'),
    )
  })

  it('reports unresolvable @nzila/db/scoped', async () => {
    delete process.env.NEXT_PHASE
    process.env.DATABASE_URL = 'postgresql://localhost/test'
    process.env.NODE_ENV = 'development'

    vi.doMock('@nzila/db/scoped', () => { throw new Error('Cannot find module') })
    vi.doMock('@nzila/db/audit', () => ({}))
    vi.doMock('../crypto/fips', () => ({
      assertFipsMode: () => ({ fipsRequired: false, fipsEnabled: false, opensslVersion: '3.x', nodeVersion: '22' }),
    }))

    const { assertBootInvariants } = await loadModule()
    await assertBootInvariants()

    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('@nzila/db/scoped'),
    )
  })

  it('reports unresolvable @nzila/db/audit', async () => {
    delete process.env.NEXT_PHASE
    process.env.DATABASE_URL = 'postgresql://localhost/test'
    process.env.NODE_ENV = 'development'

    vi.doMock('@nzila/db/scoped', () => ({}))
    vi.doMock('@nzila/db/audit', () => { throw new Error('Cannot find module') })
    vi.doMock('../crypto/fips', () => ({
      assertFipsMode: () => ({ fipsRequired: false, fipsEnabled: false, opensslVersion: '3.x', nodeVersion: '22' }),
    }))

    const { assertBootInvariants } = await loadModule()
    await assertBootInvariants()

    expect(consoleSpy.error).toHaveBeenCalledWith(
      expect.stringContaining('@nzila/db/audit'),
    )
  })

  it('warns when FIPS is required but not enabled', async () => {
    delete process.env.NEXT_PHASE
    process.env.DATABASE_URL = 'postgresql://localhost/test'
    process.env.NODE_ENV = 'development'

    vi.doMock('@nzila/db/scoped', () => ({}))
    vi.doMock('@nzila/db/audit', () => ({}))
    vi.doMock('../crypto/fips', () => ({
      assertFipsMode: () => ({
        fipsRequired: true,
        fipsEnabled: false,
        opensslVersion: '3.0.0',
        nodeVersion: '22.0.0',
      }),
    }))

    const { assertBootInvariants } = await loadModule()
    await assertBootInvariants()

    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining('FIPS 140-3 mode is required but not enabled'),
    )
  })

  it('warns when FIPS crypto module is not loadable', async () => {
    delete process.env.NEXT_PHASE
    process.env.DATABASE_URL = 'postgresql://localhost/test'
    process.env.NODE_ENV = 'development'

    vi.doMock('@nzila/db/scoped', () => ({}))
    vi.doMock('@nzila/db/audit', () => ({}))
    vi.doMock('../crypto/fips', () => { throw new Error('Module not found') })

    const { assertBootInvariants } = await loadModule()
    await assertBootInvariants()

    expect(consoleSpy.warn).toHaveBeenCalledWith(
      expect.stringContaining('FIPS crypto module not loadable'),
    )
  })

  it('calls process.exit(1) in production when assertions fail', async () => {
    delete process.env.NEXT_PHASE
    delete process.env.DATABASE_URL
    process.env.NODE_ENV = 'production'

    vi.doMock('@nzila/db/scoped', () => ({}))
    vi.doMock('@nzila/db/audit', () => ({}))
    vi.doMock('../crypto/fips', () => ({
      assertFipsMode: () => ({ fipsRequired: false, fipsEnabled: false, opensslVersion: '3.x', nodeVersion: '22' }),
    }))

    const { assertBootInvariants } = await loadModule()
    await assertBootInvariants()

    expect(exitSpy).toHaveBeenCalledWith(1)
  })
})
