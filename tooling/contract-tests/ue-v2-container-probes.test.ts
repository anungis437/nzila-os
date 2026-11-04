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
})
