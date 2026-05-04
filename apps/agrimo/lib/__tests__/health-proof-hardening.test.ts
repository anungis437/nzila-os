import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { buildInventoryEndpointsForApproved } from '../../../../scripts/proof/check-health'

describe('Agrimo health proof endpoint generation', () => {
  it('prioritizes canonical staging endpoints and keeps fallback as advisory secondary', () => {
    const inventory = {
      apps: {
        agrimo: {
          stagingDnsStatus: 'resolved',
          routing: {
            staging: 'https://staging-agrimo.nzilaventures.com',
            stagingFallback:
              'https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io',
            production: 'blocked',
            healthPath: '/api/health',
            readyPath: '/api/ready',
          },
        },
      },
    }

    const endpoints = buildInventoryEndpointsForApproved(inventory, {
      staging: ['agrimo'],
      production: ['agrimo'],
    })

    const names = endpoints.map((ep) => ep.name)

    expect(names).toContain('staging:agrimo:root')
    expect(names).toContain('staging:agrimo:health')
    expect(names).toContain('staging:agrimo:ready')

    expect(names).toContain('staging:agrimo:fallback:root')
    expect(names).toContain('staging:agrimo:fallback:health')
    expect(names).toContain('staging:agrimo:fallback:ready')

    const canonicalRoot = endpoints.find((ep) => ep.name === 'staging:agrimo:root')
    const fallbackRoot = endpoints.find((ep) => ep.name === 'staging:agrimo:fallback:root')

    expect(canonicalRoot?.policyCritical).toBe(true)
    expect(fallbackRoot?.policyCritical).toBe(false)

    const canonicalIndex = names.indexOf('staging:agrimo:root')
    const fallbackIndex = names.indexOf('staging:agrimo:fallback:root')
    expect(canonicalIndex).toBeGreaterThanOrEqual(0)
    expect(fallbackIndex).toBeGreaterThan(canonicalIndex)
  })

  it('uses fallback-only advisory checks when canonical staging route is blocked', () => {
    const inventory = {
      apps: {
        agrimo: {
          stagingDnsStatus: 'pending-manual-cloudflare',
          routing: {
            staging: 'blocked',
            stagingFallback:
              'https://nzila-os-agrimo.jollydune-88c1e97f.canadacentral.azurecontainerapps.io',
            production: 'blocked',
            healthPath: '/api/health',
          },
        },
      },
    }

    const endpoints = buildInventoryEndpointsForApproved(inventory, {
      staging: ['agrimo'],
      production: [],
    })

    expect(endpoints.map((ep) => ep.name)).toEqual(['staging:agrimo:fallback:health'])
    expect(endpoints.every((ep) => ep.policyCritical === false)).toBe(true)
  })
})

describe('Agrimo jurisdiction authority fail-loud contract', () => {
  it('keeps production/staging fail-loud behavior when policy source is unavailable', () => {
    const loaderPath = resolve(
      __dirname,
      '../../backend/compliance/jurisdiction_loader.py',
    )
    const src = readFileSync(loaderPath, 'utf8')

    expect(src).toContain('if env in ("production", "staging")')
    expect(src).toContain('raise RuntimeError(')
    expect(src).toContain('Refusing to fall back to embedded')
    expect(src).toContain('hardcoded policies')
  })
})
