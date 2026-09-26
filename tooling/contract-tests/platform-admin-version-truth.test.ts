/**
 * B-005 regression: platform-admin must retain exact image identity at runtime.
 */
import { describe, expect, it } from 'vitest'
import { readContent, ROOT } from './governance-helpers'

const dockerfile = readContent(`${ROOT}/Dockerfile`)
const healthRoute = readContent(`${ROOT}/apps/platform-admin/app/api/health/route.ts`)
const versionRoute = readContent(`${ROOT}/apps/platform-admin/app/api/version/route.ts`)

function dockerStage(content: string, name: string): string {
  const marker = `FROM base AS ${name}`
  const start = content.indexOf(marker)
  expect(start, `root Dockerfile must define ${name} target`).toBeGreaterThanOrEqual(0)

  const rest = content.slice(start)
  const nextStage = rest.indexOf('\n# ============================================', 1)
  return nextStage === -1 ? rest : rest.slice(0, nextStage)
}

describe('B-005 platform-admin version truth', () => {
  it('makes build identity available to every final stage through base', () => {
    const builderStart = dockerfile.indexOf('FROM base AS builder')
    expect(builderStart).toBeGreaterThanOrEqual(0)

    const baseStage = dockerfile.slice(0, builderStart)
    for (const key of ['GITHUB_SHA', 'BUILD_TIME', 'ARTIFACT_ID', 'RELEASE_ID']) {
      expect(baseStage).toContain(`ARG ${key}=unknown`)
      expect(baseStage).toContain(`ENV ${key}=$${key}`)
    }
  })

  it('runs platform-admin from the metadata-bearing base stage', () => {
    const target = dockerStage(dockerfile, 'platform-admin')
    expect(target).toContain('FROM base AS platform-admin')
    expect(target).toContain('CMD ["node", "apps/platform-admin/server.js"]')
  })

  it('reports the injected GitHub SHA from both B-005 evidence probes', () => {
    expect(healthRoute).toContain('process.env.GITHUB_SHA')
    expect(healthRoute).toMatch(/process\.env\.GITHUB_SHA[\s\S]*?['"]local['"]/)
    expect(versionRoute).toContain('process.env.GITHUB_SHA')
    expect(versionRoute).toMatch(/process\.env\.GITHUB_SHA[\s\S]*?['"]local['"]/)
  })
})
