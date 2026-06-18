import { afterEach, describe, expect, it } from 'vitest'

const original = {
  vercelGitCommitSha: process.env.VERCEL_GIT_COMMIT_SHA,
  githubSha: process.env.GITHUB_SHA,
  buildTime: process.env.BUILD_TIME,
  artifactId: process.env.ARTIFACT_ID,
  npmPackageVersion: process.env.npm_package_version,
}

afterEach(() => {
  process.env.VERCEL_GIT_COMMIT_SHA = original.vercelGitCommitSha
  process.env.GITHUB_SHA = original.githubSha
  process.env.BUILD_TIME = original.buildTime
  process.env.ARTIFACT_ID = original.artifactId
  process.env.npm_package_version = original.npmPackageVersion
})

describe('GET /api/version', () => {
  it('returns environment-driven metadata', async () => {
    process.env.VERCEL_GIT_COMMIT_SHA = 'vercel-sha'
    process.env.BUILD_TIME = '2026-06-10T00:00:00.000Z'
    process.env.ARTIFACT_ID = 'artifact-x'
    process.env.npm_package_version = '7.7.7'

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.app).toBe('trade')
    expect(body.gitSha).toBe('vercel-sha')
    expect(body.buildTime).toBe('2026-06-10T00:00:00.000Z')
    expect(body.artifactId).toBe('artifact-x')
    expect(body.appVersion).toBe('7.7.7')
  })

  it('falls back when metadata env vars are missing', async () => {
    delete process.env.VERCEL_GIT_COMMIT_SHA
    delete process.env.GITHUB_SHA
    delete process.env.BUILD_TIME
    delete process.env.ARTIFACT_ID
    delete process.env.npm_package_version

    const { GET } = await import('./route')
    const response = await GET()
    const body = await response.json()

    expect(response.status).toBe(200)
    expect(body.gitSha).toBe('local')
    expect(body.buildTime).toBe('unknown')
    expect(body.artifactId).toBe('unknown')
    expect(body.appVersion).toBe('0.0.0')
  })
})
