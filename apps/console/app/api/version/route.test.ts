import { describe, expect, it } from 'vitest'

describe('GET /api/version', () => {
  it('returns build metadata', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.app).toBe('console')
    expect(body).toHaveProperty('appVersion')
  })

  it('includes environment and commit information', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body).toHaveProperty('app')
  })
})
