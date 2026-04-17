/**
 * Governance Consistency Test
 *
 * Verifies that all Next.js apps in the monorepo meet the minimum platform
 * contract: edge guard (proxy/middleware), os-core dependency, env schema coverage.
 *
 * This test is the programmatic enforcement of the platform golden path.
 */
import { describe, it, expect } from 'vitest'
import { existsSync, readFileSync } from 'node:fs'
import { resolve, join } from 'node:path'

const ROOT = resolve(__dirname, '../../../..')
const APPS_DIR = join(ROOT, 'apps')

const NEXTJS_APPS = [
  'abr', 'cfo', 'console', 'cora', 'mobility', 'mobility-client-portal',
  'nacp-exams', 'partners', 'platform-admin', 'agrimo',
  'trade', 'union-eyes', 'web', 'zonga',
]

function getEdgeGuardPath(app: string): string | null {
  const proxyPath = join(APPS_DIR, app, 'proxy.ts')
  if (existsSync(proxyPath)) return proxyPath

  const middlewarePath = join(APPS_DIR, app, 'middleware.ts')
  if (existsSync(middlewarePath)) return middlewarePath

  return null
}

describe('Platform governance contract', () => {
  const envFile = readFileSync(
    join(ROOT, 'packages', 'os-core', 'src', 'config', 'env.ts'), 'utf-8',
  )

  it.each(NEXTJS_APPS)('%s has proxy.ts or middleware.ts', (app) => {
    expect(getEdgeGuardPath(app)).not.toBeNull()
  })

  it.each(NEXTJS_APPS)('%s edge guard includes x-request-id', (app) => {
    const edgeGuardPath = getEdgeGuardPath(app)
    expect(edgeGuardPath).not.toBeNull()
    const edgeGuard = readFileSync(edgeGuardPath!, 'utf-8')
    expect(edgeGuard).toContain('x-request-id')
  })

  it.each(NEXTJS_APPS)('%s has @nzila/os-core dependency', (app) => {
    const pkg = JSON.parse(readFileSync(join(APPS_DIR, app, 'package.json'), 'utf-8'))
    const deps = { ...pkg.dependencies, ...pkg.devDependencies }
    expect(deps['@nzila/os-core']).toBeDefined()
  })

  it.each(NEXTJS_APPS)('%s has env schema in os-core', (app) => {
    expect(envFile).toContain(`'${app}'`)
  })

  it.each(NEXTJS_APPS)('%s has /api/health route', (app) => {
    const healthPath = join(APPS_DIR, app, 'app', 'api', 'health', 'route.ts')
    expect(existsSync(healthPath)).toBe(true)
  })
})
