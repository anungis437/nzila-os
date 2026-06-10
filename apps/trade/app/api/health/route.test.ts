import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({
  dbExecute: vi.fn(),
}))

const original = {
  vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  githubSha: process.env.GITHUB_SHA,
  npmPackageVersion: process.env.npm_package_version,
}

vi.mock('@nzila/db', () => ({
  db: { execute: mocks.dbExecute },
}))

vi.mock('drizzle-orm', () => ({
  sql: (_parts: TemplateStringsArray) => ({ text: 'sql' }),
}))

async function loadRoute() {
  const routeModule = await import('./route')
  return routeModule.GET
}

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.dbExecute.mockResolvedValue({ rows: [{ ok: 1 }] })
  })

  afterEach(() => {
    process.env.VERCEL_GIT_COMMIT_SHA = original.vercelGitCommitSha
    process.env.GITHUB_SHA = original.githubSha
    process.env.npm_package_version = original.npmPackageVersion
    vi.restoreAllMocks()
  })

  it('returns ok when database probe succeeds', async () => {
    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.status).toBe('ok')
    expect(body.app).toBe('@nzila/trade')
    expect(body.checks).toEqual({ db: true })
  })

  it('returns degraded when database probe fails', async () => {
    mocks.dbExecute.mockRejectedValue(new Error('db down'))

    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(503)
    expect(body.status).toBe('degraded')
    expect(body.checks).toEqual({ db: false })
  })

  it('uses Vercel commit and package version when present', async () => {
    vi.resetModules()
    process.env.VERCEL_GIT_COMMIT_SHA = 'vercel-sha'
    process.env.npm_package_version = '3.3.3'

    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.buildInfo).toEqual({ version: '3.3.3', commit: 'vercel-sha' })
  })

  it('falls back to github sha and default version when needed', async () => {
    vi.resetModules()
    delete process.env.VERCEL_GIT_COMMIT_SHA
    process.env.GITHUB_SHA = 'github-sha'
    delete process.env.npm_package_version

    const GET = await loadRoute()
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.buildInfo).toEqual({ version: '0.0.0', commit: 'github-sha' })
  })
})
