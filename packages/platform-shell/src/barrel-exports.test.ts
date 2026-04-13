/**
 * Barrel export coverage — ensure all index.ts barrels are imported.
 */
import { describe, it, expect, vi } from 'vitest'

// Mock platform-auth so NzilaAppShell barrel import works
vi.mock('@nzila/platform-auth/entra/client', () => ({
  useAuth: vi.fn(() => ({ isLoaded: false, isSignedIn: false, orgId: null, orgRole: null, roles: [] })),
  useUser: vi.fn(() => ({ isLoaded: false, user: null })),
  useOrganization: vi.fn(() => ({ isLoaded: false, organization: null, membership: null })),
}))

describe('barrel exports', () => {
  it('src/index.ts exports all public API', async () => {
    const mod = await import('./index')
    expect(mod.ModuleRegistry).toBeDefined()
    expect(mod.DEFAULT_MODULES).toBeDefined()
    expect(mod.ShellProvider).toBeDefined()
    expect(mod.useShell).toBeDefined()
    expect(mod.NzilaAppShell).toBeDefined()
    expect(mod.ShellLayout).toBeDefined()
    expect(mod.GlobalNav).toBeDefined()
    expect(mod.OrgSelector).toBeDefined()
    expect(mod.AppSwitcher).toBeDefined()
    expect(mod.UserMenu).toBeDefined()
    expect(mod.NotificationBell).toBeDefined()
  })

  it('context/index.ts re-exports context', async () => {
    const mod = await import('./context/index')
    expect(mod.ShellProvider).toBeDefined()
    expect(mod.useShell).toBeDefined()
  })

  it('components/index.ts re-exports components', async () => {
    const mod = await import('./components/index')
    expect(mod.NzilaAppShell).toBeDefined()
    expect(mod.ShellLayout).toBeDefined()
    expect(mod.GlobalNav).toBeDefined()
    expect(mod.OrgSelector).toBeDefined()
    expect(mod.AppSwitcher).toBeDefined()
    expect(mod.UserMenu).toBeDefined()
    expect(mod.NotificationBell).toBeDefined()
  })
})
