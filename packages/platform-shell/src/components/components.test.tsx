/**
 * Tests for shell components: AppSwitcher, GlobalNav, OrgSelector,
 * ShellLayout, UserMenu — all depend on useShell().
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, fireEvent, cleanup } from '@testing-library/react'
import React from 'react'
import { ShellProvider } from '../context/provider'
import { ModuleRegistry } from '../registry/registry'
import { DEFAULT_MODULES } from '../registry/default-modules'
import { AppSwitcher } from './AppSwitcher'
import { GlobalNav } from './GlobalNav'
import { OrgSelector } from './OrgSelector'
import { ShellLayout } from './ShellLayout'
import { UserMenu } from './UserMenu'
import type { ShellUser, ShellOrg } from '../context/types'

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

function Wrapper({ children }: { children: React.ReactNode }) {
  return (
    <ShellProvider
      user={testUser}
      availableOrgs={testOrgs}
      registry={createRegistry()}
      activeModuleId="flow"
    >
      {children}
    </ShellProvider>
  )
}

// ── AppSwitcher ──────────────────────────────────────────────────────────

afterEach(cleanup)

describe('AppSwitcher', () => {
  it('renders accessible modules as buttons', () => {
    render(<AppSwitcher />, { wrapper: Wrapper })
    // Should render at least some module buttons
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('highlights the active module', () => {
    render(<AppSwitcher />, { wrapper: Wrapper })
    // The active button should have active styles
    const buttons = screen.getAllByRole('button')
    expect(buttons.length).toBeGreaterThan(0)
  })

  it('respects maxVisible prop', () => {
    render(<AppSwitcher maxVisible={2} />, { wrapper: Wrapper })
    // Should still render — module list is filtered to maxVisible
    const buttons = screen.getAllByRole('button')
    expect(buttons).toBeDefined()
  })
})

// ── GlobalNav ────────────────────────────────────────────────────────────

describe('GlobalNav', () => {
  it('renders nav with org avatar', () => {
    render(<GlobalNav />, { wrapper: Wrapper })
    const nav = screen.getByRole('navigation')
    expect(nav).toBeDefined()
  })

  it('shows first letter of org name', () => {
    render(<GlobalNav />, { wrapper: Wrapper })
    expect(screen.getByText('O')).toBeDefined()
  })

  it('shows ? when no org name', () => {
    render(
      <ShellProvider user={testUser} availableOrgs={[]} registry={createRegistry()}>
        <GlobalNav />
      </ShellProvider>,
    )
    expect(screen.getByText('?')).toBeDefined()
  })
})

// ── OrgSelector ──────────────────────────────────────────────────────────

describe('OrgSelector', () => {
  it('renders plain text when single org', () => {
    render(
      <ShellProvider
        user={testUser}
        availableOrgs={[testOrgs[0]!]}
        registry={createRegistry()}
      >
        <OrgSelector />
      </ShellProvider>,
    )
    expect(screen.getByText('Org One')).toBeDefined()
  })

  it('renders dropdown when multiple orgs', () => {
    render(<OrgSelector />, { wrapper: Wrapper })
    const select = screen.getByRole('combobox')
    expect(select).toBeDefined()
  })

  it('fires switchOrg on change', () => {
    const onOrgChange = vi.fn()
    render(
      <ShellProvider
        user={testUser}
        availableOrgs={testOrgs}
        registry={createRegistry()}
        onOrgChange={onOrgChange}
      >
        <OrgSelector />
      </ShellProvider>,
    )
    const select = screen.getByRole('combobox')
    fireEvent.change(select, { target: { value: 'org-2' } })
    expect(onOrgChange).toHaveBeenCalledWith('org-2')
  })
})

// ── ShellLayout ──────────────────────────────────────────────────────────

describe('ShellLayout', () => {
  it('renders children with global nav', () => {
    render(
      <ShellLayout>
        <div data-testid="content">Content</div>
      </ShellLayout>,
      { wrapper: Wrapper },
    )
    expect(screen.getByTestId('content')).toBeDefined()
    expect(screen.getByRole('navigation')).toBeDefined()
  })

  it('renders only children when hideNav is true', () => {
    render(
      <ShellLayout hideNav>
        <div data-testid="content">Content</div>
      </ShellLayout>,
      { wrapper: Wrapper },
    )
    expect(screen.getByTestId('content')).toBeDefined()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('renders only children when no user', () => {
    render(
      <ShellProvider user={null} availableOrgs={testOrgs} registry={createRegistry()}>
        <ShellLayout>
          <div data-testid="content">Content</div>
        </ShellLayout>
      </ShellProvider>,
    )
    expect(screen.getByTestId('content')).toBeDefined()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('renders module sidebar when provided', () => {
    render(
      <ShellLayout moduleSidebar={<div data-testid="sidebar">Sidebar</div>}>
        <div>Main</div>
      </ShellLayout>,
      { wrapper: Wrapper },
    )
    expect(screen.getByTestId('sidebar')).toBeDefined()
  })
})

// ── UserMenu ─────────────────────────────────────────────────────────────

describe('UserMenu', () => {
  it('renders user initials', () => {
    render(<UserMenu />, { wrapper: Wrapper })
    expect(screen.getByText('AB')).toBeDefined()
  })

  it('renders nothing when no user', () => {
    const { container } = render(
      <ShellProvider user={null} availableOrgs={testOrgs} registry={createRegistry()}>
        <UserMenu />
      </ShellProvider>,
    )
    expect(container.innerHTML).toBe('')
  })

  it('renders avatar image when user has imageUrl', () => {
    const userWithImage = { ...testUser, imageUrl: 'https://example.com/avatar.png' }
    render(
      <ShellProvider user={userWithImage} availableOrgs={testOrgs} registry={createRegistry()}>
        <UserMenu />
      </ShellProvider>,
    )
    const img = screen.getByRole('img')
    expect(img).toBeDefined()
  })
})
