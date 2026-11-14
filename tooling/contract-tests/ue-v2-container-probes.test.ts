import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it, vi } from 'vitest'

/**
 * The Container Apps liveness probe must not restart healthy processes during a
 * dependency outage; readiness must withdraw traffic until dependencies recover.
 * This source contract does not substitute for deployed HTTP readiness evidence.
 */
describe('Union Eyes V2 Container Apps health probes', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'infrastructure', 'bicep', 'ue-v2', 'modules', 'apps.bicep'), 'utf8')
  const main = readFileSync(join(__dirname, '..', '..', 'infrastructure', 'bicep', 'ue-v2', 'main.bicep'), 'utf8')
  // Scoped to the `app` resource specifically: apps.bicep also declares a `clamav` resource with its
  // own Readiness probe (a different container, a different port), which a whole-file regex would
  // otherwise match first.
  const appBlock = source.slice(
    source.indexOf("resource app 'Microsoft.App/containerApps@2024-03-01' = {"),
    source.indexOf('dependsOn: [clamav]'),
  )
  const probe = (kind: string, environment: 'staging' | 'prod' = 'staging') => {
    const start = appBlock.indexOf("type: '" + kind + "'")
    expect(start).toBeGreaterThanOrEqual(0)
    // Bound parsing to this probe. A conditional path must never make the parser
    // silently consume the next probe's path (the previous regex did that).
    const end = appBlock.indexOf("\n            }", start)
    const block = appBlock.slice(start, end)
    const expression = block.match(/httpGet: \{ path: (.*), port: 3000 \}/)?.[1]
    const literal = expression?.match(/^'([^']+)'$/)
    if (literal) return literal[1]
    const conditional = expression?.match(/^deploymentEnvironment == 'staging' \? '([^']+)' : '([^']+)'$/)
    expect(conditional, 'Known, explicitly evaluated probe path required').toBeTruthy()
    return conditional?.[environment === 'staging' ? 1 : 2]
  }

  it('uses process-only staging liveness and retains the existing production selection', () => {
    expect(probe('Liveness', 'staging')).toBe('/api/health/liveness')
    expect(probe('Liveness', 'prod')).toBe('/api/health')
  })

  it('the selected staging liveness endpoint stays alive without database connectivity', async () => {
    vi.stubEnv('DATABASE_URL', 'postgres://unavailable:unavailable@database.invalid/unavailable')
    try {
      const { GET } = await import('../../apps/union-eyes/app/api/health/liveness/route')
      const response = await GET()
      expect(response.status).toBe(200)
      expect(await response.json()).toMatchObject({ status: 'ok', uptime: expect.any(Number) })
      expect(response.headers.get('cache-control')).toContain('no-store')
    } finally { vi.unstubAllEnvs() }
  })

  it('uses dependency-aware readiness to fail closed when the app cannot serve traffic', () => {
    expect(probe('Readiness')).toBe('/api/ready')
  })

  it('never embeds acceptance-auth or risk-bypass environment settings in the deployment template', () => {
    for (const forbidden of ['PLAYWRIGHT_TEST_AUTH', 'UE_E2E_RISK_BYPASS', 'UNION_EYES_ACCEPTANCE_AUTH_ENABLED']) {
      expect(source).not.toContain(forbidden)
    }
  })
  it('passes the selected environment into the application module', () => {
    expect(main).toContain("@allowed(['staging', 'prod'])")
    expect(main).toContain('param env string')
    expect(main).toMatch(/module apps 'modules\/apps\.bicep'[\s\S]*?deploymentEnvironment: env/)
    expect(main).not.toContain("deploymentEnvironment: 'prod'")
  })

  it('requires explicit staging or production selection with isolated defaults', () => {
    expect(main).toContain("@allowed(['staging', 'prod'])\nparam env string")
    expect(main).not.toMatch(/param env string\s*=/)
    expect(main).toContain("param appDatabaseName string = env == 'prod' ? 'ue_v2_prod' : 'ue_v2_staging'")
    expect(main).toContain("param publicHostName string = env == 'prod' ? 'app.unioneyes.app' : ''")
    expect(main).toContain("param siteUrl string = env == 'prod' ? 'https://unioneyes.app' : ''")
    expect(main).toContain("param appMinReplicas int = env == 'prod' ? 2 : 0")
  })

  it('does not label staging as production', () => {
    expect(source).toContain("@allowed(['staging', 'prod'])\nparam deploymentEnvironment string")
    expect(source).toContain("name: 'UE_ENVIRONMENT', value: deploymentEnvironment == 'prod' ? 'production' : 'staging'")
    expect(source).toContain("name: 'UE_DEPLOYMENT_TYPE', value: deploymentEnvironment")
    expect(source).toContain("name: 'NEXT_PUBLIC_APP_ENV', value: deploymentEnvironment == 'prod' ? 'production' : 'staging'")
  })

})
