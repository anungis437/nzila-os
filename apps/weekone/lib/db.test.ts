import { beforeEach, describe, expect, it, vi } from 'vitest'

describe('getDb', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
  })

  it('returns db client when @nzila/db import succeeds', async () => {
    vi.doMock('@nzila/db', () => ({
      db: { execute: vi.fn() },
    }))

    const { getDb } = await import('./db')
    const result = await getDb()

    expect(result).toEqual({ execute: expect.any(Function) })
  })

  it('returns null when @nzila/db import fails', async () => {
    vi.doMock('@nzila/db', () => {
      throw new Error('missing db module')
    })

    const { getDb } = await import('./db')
    const result = await getDb()

    expect(result).toBeNull()
  })
})
