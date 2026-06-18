import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

vi.mock('@nzila/platform-auth/entra/client', () => ({
  UserButton: () => React.createElement('div', { 'data-testid': 'user-button' }, 'UserButton'),
}))

vi.mock('@/app/(dashboard)/components/org-picker', () => ({
  OrgPicker: () => React.createElement('div', { 'data-testid': 'org-picker' }, 'OrgPicker'),
}))

describe('dashboard layout UE slice', () => {
  it('renders the sidebar shell, org picker, nav groups, and account area', async () => {
    const { default: DashboardLayout } = await import('@/app/(dashboard)/layout')

    const markup = renderToStaticMarkup(
      React.createElement(
        DashboardLayout,
        null,
        React.createElement('div', { 'data-testid': 'content' }, 'content'),
      ),
    )

    expect(markup).toContain('Flow')
    expect(markup).toContain('NzilaOS Commerce')
    expect(markup).toContain('data-testid="org-picker"')
    expect(markup).toContain('Dashboard')
    expect(markup).toContain('Quotes')
    expect(markup).toContain('Clients')
    expect(markup).toContain('Orders')
    expect(markup).toContain('Invoices')
    expect(markup).toContain('Payments')
    expect(markup).toContain('Products')
    expect(markup).toContain('Inventory')
    expect(markup).toContain('Suppliers')
    expect(markup).toContain('Purchase Orders')
    expect(markup).toContain('Production')
    expect(markup).toContain('Analytics')
    expect(markup).toContain('Integrations')
    expect(markup).toContain('Legacy Import')
    expect(markup).toContain('System Status')
    expect(markup).toContain('Settings')
    expect(markup).toContain('Console')
    expect(markup).toContain('Public Web')
    expect(markup).toContain('data-testid="user-button"')
    expect(markup).toContain('Account')
    expect(markup).toContain('data-testid="content"')
  })
})
