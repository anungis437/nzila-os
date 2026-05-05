import { describe, it, expect } from 'vitest'
import { GET } from '../../../../apps/union-eyes/app/api/health/route'

describe('Health contract (HTTP-level)', () => {
  it('returns 503 when a critical dependency fails via forceFail hook', async () => {
    process.env.NODE_ENV = 'test'

    const request = new Request('http://localhost/api/health?forceFail=1')
    const response = await GET(request)
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.ok).toBe(false)
    expect(Array.isArray(body.checks)).toBe(true)
    expect(body.checks.some((check: { name: string }) => check.name === 'forced-degradation')).toBe(true)
  })
})
