/**
 * Tests for NzilaAppShell — mocks @nzila/platform-auth hooks.
 */
import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'
import React from 'react'

// Mock platform-auth hooks
vi.mock('@nzila/platform-auth/entra/client', () => ({
  useAuth: vi.fn(() => ({
    isLoaded: true,
    isSignedIn: true,
    orgId: 'org-1',
    orgRole: 'admin',
    roles: ['admin'],
  })),
  useUser: vi.fn(() => ({
    isLoaded: true,
    user: {
      id: 'user-1',
      primaryEmailAddress: { emailAddress: 'test@nzila.test' },
      emailAddresses: [{ emailAddress: 'test@nzila.test' }],
      firstName: 'Test',
      lastName: 'User',
      imageUrl: null,
    },
  })),
  useOrganization: vi.fn(() => ({
    isLoaded: true,
    organization: { id: 'org-1', name: 'Test Org', slug: 'test-org' },
    membership: { role: 'admin' },
  })),
}))

import { NzilaAppShell } from './NzilaAppShell'
import { useAuth, useUser, useOrganization } from '@nzila/platform-auth/entra/client'

describe('NzilaAppShell', () => {
  afterEach(cleanup)

  it('renders children with shell layout when loaded', () => {
    render(
      <NzilaAppShell moduleId="flow">
        <div data-testid="content">Hello</div>
      </NzilaAppShell>,
    )
    expect(screen.getByTestId('content')).toBeDefined()
    expect(screen.getByRole('navigation')).toBeDefined()
  })

  it('renders children only while loading (auth not loaded)', () => {
    vi.mocked(useAuth).mockReturnValueOnce({
      isLoaded: false,
      isSignedIn: false,
      orgId: null,
      orgRole: null,
      roles: [],
    } as any)
    vi.mocked(useUser).mockReturnValueOnce({
      isLoaded: false,
      user: null,
    } as any)

    render(
      <NzilaAppShell moduleId="flow">
        <div data-testid="content">Loading</div>
      </NzilaAppShell>,
    )
    expect(screen.getByTestId('content')).toBeDefined()
    // Nav should not be present during loading
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('adapts to user with no organization', () => {
    vi.mocked(useOrganization).mockReturnValueOnce({
      isLoaded: true,
      organization: null,
      membership: null,
    } as any)

    render(
      <NzilaAppShell moduleId="flow">
        <div data-testid="content">No org</div>
      </NzilaAppShell>,
    )
    expect(screen.getByTestId('content')).toBeDefined()
  })

  it('renders without nav when hideNav is true', () => {
    render(
      <NzilaAppShell moduleId="flow" hideNav>
        <div data-testid="content">No nav</div>
      </NzilaAppShell>,
    )
    expect(screen.getByTestId('content')).toBeDefined()
    expect(screen.queryByRole('navigation')).toBeNull()
  })

  it('passes moduleSidebar through to ShellLayout', () => {
    render(
      <NzilaAppShell moduleId="flow" moduleSidebar={<div data-testid="sidebar">SB</div>}>
        <div>main</div>
      </NzilaAppShell>,
    )
    expect(screen.getByTestId('sidebar')).toBeDefined()
  })
})
