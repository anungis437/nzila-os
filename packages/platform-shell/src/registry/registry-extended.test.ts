/**
 * @nzila/platform-shell — Extended registry tests
 *
 * Covers edge cases not in the existing registry.test.ts:
 * - registerAll, duplicate prevention
 * - custom checkAccess, custom checkEntitlement
 * - enabledModuleIds filtering
 * - resolvedUrl for http basePaths
 * - listNavModules sorting + DEPRECATED filtering
 */
import { describe, it, expect, vi } from 'vitest'
import { ModuleRegistry, type ModuleResolveContext } from './registry'
import type { ModuleRegistration } from '@nzila/platform-contracts/module-registry'

function makeModule(overrides: Partial<ModuleRegistration> = {}): ModuleRegistration {
  return {
    id: 'test-mod',
    name: 'Test',
    description: 'A test module',
    basePath: '/test',
    iconToken: 'icon',
    tier: 'PRODUCTION',
    enabledByDefault: true,
    requiredRoles: [],
    requiredEntitlements: [],
    showInNav: true,
    navOrder: 10,
    requiresOrgScope: false,
    packageName: '@test/mod',
    devPort: 9999,
    owner: 'test-team',
    ...overrides,
  }
}

const baseCtx: ModuleResolveContext = {
  userId: 'u1',
  orgId: 'org1',
  roles: [],
  entitlements: [],
}

describe('ModuleRegistry — registerAll', () => {
  it('registers multiple modules', () => {
    const reg = new ModuleRegistry()
    reg.registerAll([
      makeModule({ id: 'a' }),
      makeModule({ id: 'b' }),
    ])
    expect(reg.list()).toHaveLength(2)
    expect(reg.get('a')).toBeDefined()
    expect(reg.get('b')).toBeDefined()
  })

  it('throws on duplicate within batch', () => {
    const reg = new ModuleRegistry()
    expect(() =>
      reg.registerAll([
        makeModule({ id: 'dup' }),
        makeModule({ id: 'dup' }),
      ]),
    ).toThrow('already registered')
  })
})

describe('ModuleRegistry — enabledModuleIds filtering', () => {
  it('hides non-default modules not in enabledModuleIds', () => {
    const reg = new ModuleRegistry()
    reg.register(makeModule({ id: 'optional', enabledByDefault: false }))

    const [manifest] = reg.resolve({
      ...baseCtx,
      enabledModuleIds: [], // nothing explicitly enabled
    })

    expect(manifest!.enabledForOrg).toBe(false)
    expect(manifest!.accessible).toBe(false)
  })

  it('shows enabledByDefault modules even with empty enabledModuleIds', () => {
    const reg = new ModuleRegistry()
    reg.register(makeModule({ id: 'default-on', enabledByDefault: true }))

    const [manifest] = reg.resolve({
      ...baseCtx,
      enabledModuleIds: [],
    })

    expect(manifest!.enabledForOrg).toBe(true)
  })

  it('shows non-default module when explicitly in enabledModuleIds', () => {
    const reg = new ModuleRegistry()
    reg.register(makeModule({ id: 'opt', enabledByDefault: false }))

    const [manifest] = reg.resolve({
      ...baseCtx,
      enabledModuleIds: ['opt'],
    })

    expect(manifest!.enabledForOrg).toBe(true)
  })
})

describe('ModuleRegistry — custom checkAccess', () => {
  it('uses custom checkAccess to determine accessibility', () => {
    const checkAccess = vi.fn().mockReturnValue(false)
    const reg = new ModuleRegistry({ checkAccess })
    reg.register(makeModule({ id: 'guarded' }))

    const [manifest] = reg.resolve(baseCtx)
    expect(manifest!.accessible).toBe(false)
    expect(checkAccess).toHaveBeenCalledWith(
      expect.objectContaining({ id: 'guarded' }),
      baseCtx,
    )
  })
})

describe('ModuleRegistry — custom checkEntitlement', () => {
  it('uses custom checkEntitlement when module has required entitlements', () => {
    const checkEntitlement = vi.fn().mockReturnValue(true)
    const reg = new ModuleRegistry({ checkEntitlement })
    reg.register(
      makeModule({ id: 'entitled', requiredEntitlements: ['premium'] }),
    )

    const [manifest] = reg.resolve(baseCtx)
    expect(manifest!.accessible).toBe(true)
    expect(checkEntitlement).toHaveBeenCalled()
  })

  it('custom checkEntitlement takes precedence over default', () => {
    // Default would fail (user has no entitlements), but custom says YES
    const checkEntitlement = vi.fn().mockReturnValue(true)
    const reg = new ModuleRegistry({ checkEntitlement })
    reg.register(
      makeModule({ id: 'x', requiredEntitlements: ['rare'] }),
    )

    const [manifest] = reg.resolve({ ...baseCtx, entitlements: [] })
    expect(manifest!.accessible).toBe(true)
  })
})

describe('ModuleRegistry — resolvedUrl', () => {
  it('sets resolvedUrl for http basePaths', () => {
    const reg = new ModuleRegistry()
    reg.register(
      makeModule({ id: 'external', basePath: 'https://external.app.com' }),
    )

    const [manifest] = reg.resolve(baseCtx)
    expect(manifest!.resolvedUrl).toBe('https://external.app.com')
  })

  it('resolvedUrl is undefined for relative basePaths', () => {
    const reg = new ModuleRegistry()
    reg.register(makeModule({ id: 'local', basePath: '/local' }))

    const [manifest] = reg.resolve(baseCtx)
    expect(manifest!.resolvedUrl).toBeUndefined()
  })
})

describe('ModuleRegistry — listNavModules', () => {
  it('excludes modules with showInNav=false', () => {
    const reg = new ModuleRegistry()
    reg.register(makeModule({ id: 'visible', showInNav: true, navOrder: 1 }))
    reg.register(makeModule({ id: 'hidden', showInNav: false, navOrder: 2 }))

    const navModules = reg.listNavModules()
    expect(navModules).toHaveLength(1)
    expect(navModules[0]!.id).toBe('visible')
  })

  it('excludes DEPRECATED modules', () => {
    const reg = new ModuleRegistry()
    reg.register(makeModule({ id: 'active', tier: 'PRODUCTION', navOrder: 1 }))
    reg.register(
      makeModule({ id: 'old', tier: 'DEPRECATED' as never, navOrder: 2 }),
    )

    const navModules = reg.listNavModules()
    expect(navModules).toHaveLength(1)
    expect(navModules[0]!.id).toBe('active')
  })

  it('sorts by navOrder ascending', () => {
    const reg = new ModuleRegistry()
    reg.register(makeModule({ id: 'z', navOrder: 100 }))
    reg.register(makeModule({ id: 'a', navOrder: 10 }))
    reg.register(makeModule({ id: 'm', navOrder: 50 }))

    const navModules = reg.listNavModules()
    expect(navModules.map((m) => m.id)).toEqual(['a', 'm', 'z'])
  })
})

describe('ModuleRegistry — feature flags', () => {
  it('disables module when feature flag is off', () => {
    const reg = new ModuleRegistry({
      isFeatureEnabled: (flag) => flag !== 'beta-feature',
    })
    reg.register(
      makeModule({ id: 'beta', featureFlag: 'beta-feature' } as ModuleRegistration),
    )

    const [manifest] = reg.resolve(baseCtx)
    expect(manifest!.enabledForOrg).toBe(false)
    expect(manifest!.accessible).toBe(false)
  })
})

describe('ModuleRegistry — role-based access', () => {
  it('denies access when user lacks required role', () => {
    const reg = new ModuleRegistry()
    reg.register(makeModule({ id: 'admin-only', requiredRoles: ['org_admin'] }))

    const [manifest] = reg.resolve({ ...baseCtx, roles: [] })
    expect(manifest!.accessible).toBe(false)
  })

  it('grants access when user has required role', () => {
    const reg = new ModuleRegistry()
    reg.register(makeModule({ id: 'admin-only', requiredRoles: ['org_admin'] }))

    const [manifest] = reg.resolve({
      ...baseCtx,
      roles: ['org_admin' as never],
    })
    expect(manifest!.accessible).toBe(true)
  })
})
