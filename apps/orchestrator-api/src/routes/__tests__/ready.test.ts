/**
 * Orchestrator API — `/ready` Critical-Aware Readiness Tests (Delta-7)
 *
 * Verifies the hard rule: missing `GITHUB_TOKEN` MUST NOT cause `not_ready`.
 * Only critical-dependency failures (database) flip readiness to `not_ready`.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import Fastify from 'fastify'

const { dbExecuteMock } = vi.hoisted(() => ({
  dbExecuteMock: vi.fn(),
}))

vi.mock('../../db.js', () => ({
  getDb: () => ({ db: { execute: dbExecuteMock } }),
}))

async function buildApp() {
  const { readyRoutes } = await import('../ready.js')
  const app = Fastify()
  await app.register(readyRoutes)
  return app
}

describe('GET /ready — critical-aware readiness', () => {
  const originalToken = process.env.GITHUB_TOKEN

  beforeEach(() => {
    dbExecuteMock.mockReset()
  })

  afterEach(() => {
    if (originalToken === undefined) {
      delete process.env.GITHUB_TOKEN
    } else {
      process.env.GITHUB_TOKEN = originalToken
    }
  })

  it('returns 200/ready when DB ok and GITHUB_TOKEN is set', async () => {
    process.env.GITHUB_TOKEN = 'fake-token'
    dbExecuteMock.mockResolvedValueOnce([])
    const app = await buildApp()

    const res = await app.inject({ method: 'GET', url: '/ready' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ready).toBe(true)
    expect(body.readiness).toBe('ready')
    expect(body.criticalFailures).toEqual([])
    expect(body.degradedDependencies).toEqual([])
    expect(body.checks.database.status).toBe('ok')
    expect(body.checks.github.status).toBe('ok')
    expect(body.dependencyCatalog).toEqual(
      expect.arrayContaining([
        { id: 'database', criticality: 'critical' },
        { id: 'github', criticality: 'optional' },
      ]),
    )
    await app.close()
  }, 15000)

  it('returns 200/degraded_ready when DB ok but GITHUB_TOKEN missing (hard rule)', async () => {
    delete process.env.GITHUB_TOKEN
    dbExecuteMock.mockResolvedValueOnce([])
    const app = await buildApp()

    const res = await app.inject({ method: 'GET', url: '/ready' })

    expect(res.statusCode).toBe(200)
    const body = res.json()
    expect(body.ready).toBe(true)
    expect(body.readiness).toBe('degraded_ready')
    expect(body.criticalFailures).toEqual([])
    expect(body.degradedDependencies).toEqual(['github'])
    expect(body.checks.github.status).toBe('degraded')
    expect(body.checks.github.note).toMatch(/GITHUB_TOKEN/)
    await app.close()
  })

  it('returns 503/not_ready when critical DB dependency fails', async () => {
    process.env.GITHUB_TOKEN = 'fake-token'
    dbExecuteMock.mockRejectedValueOnce(new Error('connection refused'))
    const app = await buildApp()

    const res = await app.inject({ method: 'GET', url: '/ready' })

    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.ready).toBe(false)
    expect(body.readiness).toBe('not_ready')
    expect(body.criticalFailures).toEqual(['database'])
    expect(body.checks.database.status).toBe('fail')
    expect(body.checks.database.error).toMatch(/connection refused/)
    await app.close()
  })

  it('uses generic DB failure text when thrown value is not an Error', async () => {
    process.env.GITHUB_TOKEN = 'fake-token'
    dbExecuteMock.mockRejectedValueOnce('boom')
    const app = await buildApp()

    const res = await app.inject({ method: 'GET', url: '/ready' })

    expect(res.statusCode).toBe(503)
    const body = res.json()
    expect(body.ready).toBe(false)
    expect(body.readiness).toBe('not_ready')
    expect(body.checks.database.error).toBe('database check failed')
    await app.close()
  })
})
