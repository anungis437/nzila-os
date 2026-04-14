/**
 * Tests for ShellProvider and useShell hook.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, act, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { ShellProvider, useShell } from './provider'
import { ModuleRegistry } from '../registry/registry'
import { DEFAULT_MODULES } from '../registry/default-modules'
import type { ShellUser, ShellOrg } from './types'

function createRegistry() {
  const reg = new ModuleRegistry()
  reg.registerAll(DEFAULT_MODULES)
  return reg
}

const testUser: ShellUser = {
  id: 'user-1',
  email: 'alice@nzila.test',
  firstName: 'Alice',
  lastName: 'Bob',
  imageUrl: null,
  roles: ['org_admin'],
}

const testOrgs: ShellOrg[] = [
  { id: 'org-1', name: 'Org One', slug: 'org-one', imageUrl: null, role: 'org_admin' },
  { id: 'org-2', name: 'Org Two', slug: 'org-two', imageUrl: null, role: 'org_member' },
]

/** Consumer that exposes context for assertions. */
function Consumer() {
  const ctx = useShell()
  return (
    <div>
      <span data-testid="user">{ctx.user?.email ?? 'none'}</span>
      <span data-testid="org">{ctx.org?.name ?? 'none'}</span>
      <span data-testid="module">{ctx.activeModuleId ?? 'none'}</span>
      <span data-testid="module-count">{ctx.modules.length}</span>
      <span data-testid="loading">{String(ctx.loading)}</span>
      <button data-testid="switch-org" onClick={() => ctx.switchOrg('org-2')}>
        Switch
      </button>
      <button data-testid="navigate" onClick={() => ctx.navigateToModule('flow')}>
        Navigate
      </button>
    </div>
  )
}

describe('ShellProvider', () => {
  afterEach(cleanup)

  it('provides user and org to consumers', () => {
    render(
      <ShellProvider user={testUser} availableOrgs={testOrgs} registry={createRegistry()}>
        <Consumer />
      </ShellProvider>,
    )
    expect(screen.getByTestId('user').textContent).toBe('alice@nzila.test')
    expect(screen.getByTestId('org').textContent).toBe('Org One')
    expect(screen.getByTestId('loading').textContent).toBe('false')
  })

  it('selects initialOrgId when provided', () => {
    render(
      <ShellProvider
        user={testUser}
        availableOrgs={testOrgs}
        registry={createRegistry()}
        initialOrgId="org-2"
      >
        <Consumer />
      </ShellProvider>,
    )
    expect(screen.getByTestId('org').textContent).toBe('Org Two')
  })

  it('resolves modules for the current user/org', () => {
    render(
      <ShellProvider user={testUser} availableOrgs={testOrgs} registry={createRegistry()}>
        <Consumer />
      </ShellProvider>,
    )
    expect(Number(screen.getByTestId('module-count').textContent)).toBeGreaterThan(0)
  })

  it('returns empty modules when user is null', () => {
    render(
      <ShellProvider user={null} availableOrgs={testOrgs} registry={createRegistry()}>
        <Consumer />
      </ShellProvider>,
    )
    expect(screen.getByTestId('module-count').textContent).toBe('0')
  })

  it('returns empty modules when no orgs', () => {
    render(
      <ShellProvider user={testUser} availableOrgs={[]} registry={createRegistry()}>
        <Consumer />
      </ShellProvider>,
    )
    expect(screen.getByTestId('module-count').textContent).toBe('0')
  })

  it('switchOrg updates the active org and calls onOrgChange', () => {
    const onOrgChange = vi.fn()
    render(
      <ShellProvider
        user={testUser}
        availableOrgs={testOrgs}
        registry={createRegistry()}
        onOrgChange={onOrgChange}
      >
        <Consumer />
      </ShellProvider>,
    )
    fireEvent.click(screen.getByTestId('switch-org'))
    expect(screen.getByTestId('org').textContent).toBe('Org Two')
    expect(onOrgChange).toHaveBeenCalledWith('org-2')
  })

  it('navigateToModule updates active module and calls onModuleNavigate', () => {
    const onModuleNavigate = vi.fn()
    render(
      <ShellProvider
        user={testUser}
        availableOrgs={testOrgs}
        registry={createRegistry()}
        onModuleNavigate={onModuleNavigate}
      >
        <Consumer />
      </ShellProvider>,
    )
    fireEvent.click(screen.getByTestId('navigate'))
    expect(screen.getByTestId('module').textContent).toBe('flow')
    expect(onModuleNavigate).toHaveBeenCalledWith('flow')
  })

  it('uses controlledActiveModuleId when provided', () => {
    render(
      <ShellProvider
        user={testUser}
        availableOrgs={testOrgs}
        registry={createRegistry()}
        activeModuleId="trade"
      >
        <Consumer />
      </ShellProvider>,
    )
    expect(screen.getByTestId('module').textContent).toBe('trade')
  })
})

describe('useShell', () => {
  it('throws when used outside ShellProvider', () => {
    // Suppress React error boundary console output
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {})
    expect(() => render(<Consumer />)).toThrow('useShell must be used within a <ShellProvider>.')
    spy.mockRestore()
  })
})
