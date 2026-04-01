import { describe, it, expect, beforeEach } from 'vitest'
import { ModuleRegistry, type ModuleResolveContext } from './registry.js'
import type { ModuleRegistration } from '@nzila/platform-contracts/module-registry'

function makeModule(overrides?: Partial<ModuleRegistration>): ModuleRegistration {
  return {
    id: 'test-mod',
    name: 'Test Module',
    basePath: '/test',
    iconToken: 'box',
    tier: 'PRODUCTION',
    enabledByDefault: true,
    requiredRoles: [],
    requiredEntitlements: [],
    showInNav: true,
    navOrder: 50,
    requiresOrgScope: true,
    ...overrides,
  }
}

function makeContext(overrides?: Partial<ModuleResolveContext>): ModuleResolveContext {
  return {
    userId: 'user-1',
    orgId: 'org-1',
    roles: ['org_member'],
    entitlements: [],
    ...overrides,
  }
}

describe('ModuleRegistry', () => {
  let registry: ModuleRegistry

  beforeEach(() => {
    registry = new ModuleRegistry()
  })

  it('registers and retrieves a module', () => {
    const mod = makeModule()
    registry.register(mod)
    expect(registry.get('test-mod')).toEqual(mod)
  })

  it('throws on duplicate registration', () => {
    registry.register(makeModule())
    expect(() => registry.register(makeModule())).toThrow('already registered')
  })

  it('lists all registered modules', () => {
    registry.register(makeModule({ id: 'a' }))
    registry.register(makeModule({ id: 'b' }))
    expect(registry.list()).toHaveLength(2)
  })

  it('lists nav modules sorted by navOrder', () => {
    registry.register(makeModule({ id: 'z', navOrder: 200 }))
    registry.register(makeModule({ id: 'a', navOrder: 10 }))
    registry.register(makeModule({ id: 'hidden', showInNav: false, navOrder: 5 }))
    registry.register(makeModule({ id: 'dep', tier: 'DEPRECATED', navOrder: 1 }))

    const nav = registry.listNavModules()
    expect(nav).toHaveLength(2)
    expect(nav[0].id).toBe('a')
    expect(nav[1].id).toBe('z')
  })

  it('resolves module accessibility for user context', () => {
    registry.register(makeModule({ id: 'open' }))
    registry.register(makeModule({ id: 'admin-only', requiredRoles: ['platform_admin'] }))

    const manifests = registry.resolve(makeContext({ roles: ['org_member'] }))
    const open = manifests.find(m => m.id === 'open')
    const admin = manifests.find(m => m.id === 'admin-only')

    expect(open?.accessible).toBe(true)
    expect(admin?.accessible).toBe(false)
  })

  it('denies access when required entitlement is missing', () => {
    registry.register(makeModule({ id: 'premium', requiredEntitlements: ['sso'] }))

    const [manifest] = registry.resolve(makeContext({ entitlements: [] }))
    expect(manifest.accessible).toBe(false)
  })

  it('grants access when entitlement is present', () => {
    registry.register(makeModule({ id: 'premium', requiredEntitlements: ['sso'] }))

    const [manifest] = registry.resolve(makeContext({ entitlements: ['sso'] }))
    expect(manifest.accessible).toBe(true)
  })

  it('respects feature flag config', () => {
    const flaggedRegistry = new ModuleRegistry({
      isFeatureEnabled: (flag) => flag === 'enabled-flag',
    })
    flaggedRegistry.register(makeModule({ id: 'flagged-on', featureFlag: 'enabled-flag' }))
    flaggedRegistry.register(makeModule({ id: 'flagged-off', featureFlag: 'disabled-flag' }))

    const manifests = flaggedRegistry.resolve(makeContext())
    expect(manifests.find(m => m.id === 'flagged-on')?.enabledForOrg).toBe(true)
    expect(manifests.find(m => m.id === 'flagged-off')?.enabledForOrg).toBe(false)
  })

  it('resolves nav modules for a context', () => {
    registry.register(makeModule({ id: 'visible', showInNav: true }))
    registry.register(makeModule({ id: 'hidden', showInNav: false }))

    const nav = registry.resolveNav(makeContext())
    expect(nav).toHaveLength(1)
    expect(nav[0].id).toBe('visible')
  })
})
