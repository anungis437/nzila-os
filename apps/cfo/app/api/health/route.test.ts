import { beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
  blobGetProperties: vi.fn(),
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
    mocks.blobGetProperties.mockResolvedValue({})
    mocks.container.mockReturnValue({ getProperties: mocks.blobGetProperties })
  })

  it('reports blob ok only after accessing cfo-documents', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.checks.blob).toBe('ok')
    expect(mocks.container).toHaveBeenCalledWith('cfo-documents')
    expect(mocks.blobGetProperties).toHaveBeenCalledOnce()
  })

  it('reports blob failure when cfo-documents is inaccessible', async () => {
    mocks.blobGetProperties.mockRejectedValue(new Error('authorization failed'))

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('degraded')
    expect(body.checks).toMatchObject({ db: 'ok', blob: 'fail' })
  })
})
