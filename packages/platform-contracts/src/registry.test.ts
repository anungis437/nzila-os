import { describe, it, expect } from 'vitest'
import {
  APP_REGISTRY,
  getAppManifest,
  getAppsByTier,
  getAppsByDomain,
  getAppsWithCapability,
  getProductionApps,
  validateBuiltInRegistry,
} from './registry.js'

describe('APP_REGISTRY', () => {
  it('contains all 17 apps', () => {
    expect(APP_REGISTRY.length).toBe(17)
  })

  it('has unique ids', () => {
    const ids = APP_REGISTRY.map(a => a.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has unique basePaths', () => {
    const paths = APP_REGISTRY.map(a => a.basePath)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('has unique devPorts where defined', () => {
    const ports = APP_REGISTRY.map(a => a.devPort).filter(Boolean) as number[]
    expect(new Set(ports).size).toBe(ports.length)
  })

  it('passes self-validation', () => {
    const result = validateBuiltInRegistry()
    expect(result.errors).toEqual([])
    expect(result.valid).toBe(true)
  })

  it('requires Clerk auth for all apps', () => {
    const appsWithoutClerk = APP_REGISTRY.filter(
      a =>
        !a.integrationDependencies?.some(
          d => d.provider === 'clerk' && d.required,
        ),
    )
    // orchestrator-api is a pure API service — no Clerk dependency expected
    const nonApiApps = appsWithoutClerk.filter(a => a.appType !== 'api-service')
    expect(nonApiApps).toEqual([])
  })
})

describe('getAppManifest', () => {
  it('finds an app by id', () => {
    const ue = getAppManifest('union-eyes')
    expect(ue).toBeDefined()
    expect(ue!.name).toBe('Union Eyes')
    expect(ue!.tier).toBe('PRODUCTION')
  })

  it('returns undefined for unknown id', () => {
    expect(getAppManifest('does-not-exist')).toBeUndefined()
  })
})

describe('getAppsByTier', () => {
  it('returns all production apps', () => {
    const prod = getAppsByTier('PRODUCTION')
    expect(prod.length).toBe(4)
    const ids = prod.map(a => a.id).sort()
    expect(ids).toEqual(['console', 'flow', 'union-eyes', 'web'])
  })

  it('returns pilot apps', () => {
    const pilots = getAppsByTier('PILOT')
    expect(pilots.length).toBeGreaterThanOrEqual(3)
  })
})

describe('getAppsByDomain', () => {
  it('returns commerce apps', () => {
    const commerce = getAppsByDomain('commerce')
    expect(commerce.map(a => a.id)).toContain('flow')
  })

  it('returns finance apps', () => {
    const finance = getAppsByDomain('finance')
    const ids = finance.map(a => a.id)
    expect(ids).toContain('cfo')
    expect(ids).toContain('flow')
  })
})

describe('getAppsWithCapability', () => {
  it('finds all apps with evidence capability', () => {
    const apps = getAppsWithCapability('evidence')
    const ids = apps.map(a => a.id)
    expect(ids).toContain('union-eyes')
    expect(ids).toContain('abr')
  })

  it('finds apps with org-scope', () => {
    const apps = getAppsWithCapability('org-scope')
    expect(apps.length).toBeGreaterThanOrEqual(10)
  })
})

describe('getProductionApps', () => {
  it('is a convenience wrapper for getAppsByTier', () => {
    expect(getProductionApps()).toEqual(getAppsByTier('PRODUCTION'))
  })
})

describe('governance requirements', () => {
  it('production apps with financial records must have hash-chain evidence', () => {
    const prod = getProductionApps()
    const financial = prod.filter(a => a.reportingBindings?.emitsFinancialRecords)
    for (const app of financial) {
      const hasHashChain = app.governanceRequirements.some(
        g => g.evidenceClass === 'hash-chain',
      )
      expect(hasHashChain, `${app.id} emits financial records but has no hash-chain governance control`).toBe(true)
    }
  })

  it('every governance requirement has a control ID', () => {
    for (const app of APP_REGISTRY) {
      for (const req of app.governanceRequirements) {
        expect(req.controlId).toBeTruthy()
      }
    }
  })
})

describe('deployment metadata', () => {
  it('staging apps must have containerImage', () => {
    const staging = APP_REGISTRY.filter(a =>
      a.deployment?.environments?.includes('staging'),
    )
    for (const app of staging) {
      expect(
        app.deployment?.containerImage,
        `${app.id} deploys to staging but has no containerImage`,
      ).toBeTruthy()
    }
  })
})
