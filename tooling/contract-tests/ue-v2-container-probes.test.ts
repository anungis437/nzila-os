import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

/**
 * The Container Apps liveness probe must not restart healthy processes during a
 * dependency outage; readiness must withdraw traffic until dependencies recover.
 * This source contract does not substitute for deployed HTTP readiness evidence.
 */
describe('Union Eyes V2 Container Apps health probes', () => {
  const source = readFileSync(join(__dirname, '..', '..', 'infrastructure', 'bicep', 'ue-v2', 'modules', 'apps.bicep'), 'utf8')
  const main = readFileSync(join(__dirname, '..', '..', 'infrastructure', 'bicep', 'ue-v2', 'main.bicep'), 'utf8')
  const probe = (kind: string) => {
    const match = source.match(new RegExp("type: '"+kind+"'[\\s\\S]*?httpGet: \\{ path: '([^']+)', port: 3000 \\}"))
    return match?.[1]
  }

  it('uses shallow health for liveness, not dependency readiness', () => {
    expect(probe('Liveness')).toBe('/api/health')
  })

  it('uses dependency-aware readiness to fail closed when the app cannot serve traffic', () => {
    expect(probe('Readiness')).toBe('/api/ready')
  })

  it('never embeds acceptance-auth or risk-bypass environment settings in the deployment template', () => {
    for (const forbidden of ['PLAYWRIGHT_TEST_AUTH', 'UE_E2E_RISK_BYPASS', 'UNION_EYES_ACCEPTANCE_AUTH_ENABLED']) {
      expect(source).not.toContain(forbidden)
    }
  })
  it('passes the selected staging or production environment from the root deployment into the app module', () => {
    expect(main).toMatch(/@allowed\(\['staging', 'prod'\]\)\s*param env string/)
    expect(main).toMatch(/module apps 'modules\/apps\.bicep'[\s\S]*?deploymentEnvironment: env/)
    expect(main).not.toMatch(/deploymentEnvironment:\s*'prod'/)
  })

  it('requires an explicit deployment target and keeps staging identity and data separate by default', () => {
    expect(main).toMatch(/@allowed\(\['staging', 'prod'\]\)\s*param env string(?:\s|$)/m)
    expect(main).not.toMatch(/param env string\s*=/)
    expect(main).toMatch(/param appDatabaseName string = env == 'prod' \? 'ue_v2_prod' : 'ue_v2_staging'/)
    expect(main).toMatch(/param publicHostName string = env == 'prod' \? 'app\.unioneyes\.app' : 'staging\.unioneyes\.app'/)
    expect(main).toMatch(/param siteUrl string = env == 'prod' \? 'https:\/\/unioneyes\.app' : 'https:\/\/staging\.unioneyes\.app'/)
    expect(main).toMatch(/param appMinReplicas int = env == 'prod' \? 2 : 1/)
  })

  it('does not label staging as production in the application revision', () => {
    expect(source).toMatch(/@allowed\(\['staging', 'prod'\]\)\s*param deploymentEnvironment string/)
    expect(source).toMatch(/name: 'UE_ENVIRONMENT', value: deploymentEnvironment == 'prod' \? 'production' : 'staging'/)
    expect(source).toMatch(/name: 'UE_DEPLOYMENT_TYPE', value: deploymentEnvironment/)
    expect(source).toMatch(/name: 'NEXT_PUBLIC_APP_ENV', value: deploymentEnvironment == 'prod' \? 'production' : 'staging'/)
  })

})
