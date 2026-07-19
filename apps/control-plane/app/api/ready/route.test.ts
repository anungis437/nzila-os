import { describe, expect, it } from 'vitest'

describe('GET /api/ready', () => {
  it('returns ready status', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ready).toBe(true)
    expect(body.status).toBe('ready')
    expect(body.app).toBe('control-plane')
  })

  it('includes checks structure', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.checks).toHaveProperty('process')
    expect(body.checks).toHaveProperty('database')
    expect(body.checks).toHaveProperty('queue')
    expect(body.checks).toHaveProperty('storage')
    expect(body.checks).toHaveProperty('thirdParty')
  })

  it('includes timestamp', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.timestamp).toBeDefined()
    expect(() => new Date(body.timestamp)).not.toThrow()
  })
})
