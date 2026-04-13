import React from 'react'
import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { Sidebar, SidebarItem, SidebarSection } from '../components/Sidebar'
import * as ui from '../index'

describe('Sidebar', () => {
  it('renders expanded by default and toggles collapsed state', () => {
    render(
      <Sidebar>
        <div>Navigation</div>
      </Sidebar>,
    )

    expect(screen.getByText('Navigation')).toBeInTheDocument()
    const collapseButton = screen.getByRole('button', { name: 'Collapse sidebar' })
    const aside = collapseButton.closest('aside')

    expect(aside?.className).toContain('w-64')

    fireEvent.click(collapseButton)

    expect(screen.getByRole('button', { name: 'Expand sidebar' })).toBeInTheDocument()
    expect(aside?.className).toContain('w-16')
  })

  it('honors defaultCollapsed and merges custom className', () => {
    render(
      <Sidebar defaultCollapsed className="custom-sidebar">
        <div>Collapsed</div>
      </Sidebar>,
    )

    const expandButton = screen.getByRole('button', { name: 'Expand sidebar' })
    const aside = expandButton.closest('aside')

    expect(aside?.className).toContain('w-16')
    expect(aside?.className).toContain('custom-sidebar')
  })
})

describe('SidebarSection', () => {
  it('renders an optional title', () => {
    render(
      <SidebarSection title="Reports">
        <li>Monthly</li>
      </SidebarSection>,
    )

    expect(screen.getByRole('heading', { name: 'Reports' })).toBeInTheDocument()
    expect(screen.getByText('Monthly')).toBeInTheDocument()
  })

  it('omits the heading when title is not provided', () => {
    render(
      <SidebarSection>
        <li>Inbox</li>
      </SidebarSection>,
    )

    expect(screen.queryByRole('heading')).not.toBeInTheDocument()
    expect(screen.getByText('Inbox')).toBeInTheDocument()
  })
})

describe('SidebarItem', () => {
  it('renders an active link item with icon', () => {
    render(
      <ul>
        <SidebarItem href="/dashboard" active icon={<svg data-testid="icon" />}>
          Dashboard
        </SidebarItem>
      </ul>,
    )

    const link = screen.getByRole('link', { name: 'Dashboard' })
    expect(link).toHaveAttribute('href', '/dashboard')
    expect(link.className).toContain('bg-blue-50')
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })

  it('renders a button item and invokes onClick', () => {
    const onClick = vi.fn()

    render(
      <ul>
        <SidebarItem onClick={onClick}>Run action</SidebarItem>
      </ul>,
    )

    const button = screen.getByRole('button', { name: 'Run action' })
    expect(button.className).toContain('w-full')
    expect(button.className).toContain('text-gray-700')

    fireEvent.click(button)
    expect(onClick).toHaveBeenCalledTimes(1)
  })
})

describe('ui barrel exports', () => {
  it('exports sidebar components from the package entrypoint', () => {
    expect(ui.Sidebar).toBe(Sidebar)
    expect(ui.SidebarItem).toBe(SidebarItem)
    expect(ui.SidebarSection).toBe(SidebarSection)
  })
})