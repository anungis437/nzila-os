import { describe, expect, it } from 'vitest'

describe('GET /api/ready', () => {
  it('returns static ready status', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ready).toBe(true)
    expect(body.status).toBe('ready')
    expect(body.app).toBe('web')
  })

  it('includes check statuses', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.checks).toEqual({
      process: { status: 'ok' },
      database: { status: 'not-applicable' },
      queue: { status: 'not-applicable' },
      storage: { status: 'not-applicable' },
      thirdParty: { status: 'unknown' },
    })
  })

  it('includes timestamp', async () => {
    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(body.timestamp).toBeDefined()
    expect(typeof body.timestamp).toBe('string')
    expect(body.timestamp).toMatch(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
  })
})
