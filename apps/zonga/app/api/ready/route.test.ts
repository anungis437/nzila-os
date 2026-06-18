import { describe, expect, it } from 'vitest'

describe('GET /api/ready', () => {
  it('returns ready status', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ready).toBe(true)
    expect(body.status).toBe('ready')
    expect(body.app).toBe('zonga')
  })

  it('includes checks structure', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.checks).toHaveProperty('process')
    expect(body.checks).toHaveProperty('database')
    expect(body.checks).toHaveProperty('queue')
  })

  it('includes timestamp', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body).toHaveProperty('timestamp')
    expect(typeof body.timestamp).toBe('string')
  })
})
