import { describe, expect, it } from 'vitest'
import { GET } from './route'

describe('GET /api/ready', () => {
  it('returns readiness payload with expected checks', async () => {
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.ready).toBe(true)
    expect(body.status).toBe('ready')
    expect(body.app).toBe('mobility')
    expect(body.checks).toEqual({
      process: { status: 'ok' },
      database: { status: 'unknown' },
      queue: { status: 'unknown' },
      storage: { status: 'unknown' },
      thirdParty: { status: 'unknown' },
    })
    expect(Number.isNaN(new Date(body.timestamp).getTime())).toBe(false)
  })
})
