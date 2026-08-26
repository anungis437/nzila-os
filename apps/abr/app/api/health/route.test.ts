import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  container: vi.fn(),
}))

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.dbExecute },
}))

vi.mock('drizzle-orm', () => ({
  sql: (_parts: TemplateStringsArray) => ({ text: 'SELECT 1' }),
}))

vi.mock('@nzila/blob', () => ({
  container: mocks.container,
}))

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.clearAllMocks()
    mocks.dbExecute.mockResolvedValue({})
  })

  it('reports db health without probing blob', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.checks).toEqual({ process: 'ok', db: 'ok' })
    expect(mocks.container).not.toHaveBeenCalled()
  })

  it('preserves db failure semantics without requiring blob credentials', async () => {
    mocks.dbExecute.mockRejectedValue(new Error('db unavailable'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ process: 'ok', db: 'fail' })
    expect(mocks.container).not.toHaveBeenCalled()
  })
})
