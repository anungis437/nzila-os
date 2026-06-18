import React from 'react'
import { describe, expect, it, vi } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'

const { mockUseOrganization } = vi.hoisted(() => ({
  mockUseOrganization: vi.fn<() => { isLoaded: boolean; organization: { id: string } | null }>(() => ({
    isLoaded: true,
    organization: { id: 'org-1' },
  })),
}))

vi.mock('@nzila/platform-auth/entra/client', () => ({
  OrganizationSwitcher: () => React.createElement('div', { 'data-testid': 'org-switcher' }, 'OrganizationSwitcher'),
  useOrganization: () => mockUseOrganization(),
}))

type GuidanceProps = {
  severity?: 'info' | 'error' | 'warning' | 'success'
  title?: string
  children?: React.ReactNode
}

describe('dashboard shared components slices', () => {
  it('exports shared dashboard components from barrel', async () => {
    const barrel = await import('@/app/(dashboard)/components')
    expect(typeof barrel.StatusBadge).toBe('function')
    expect(typeof barrel.LifecycleTimeline).toBe('function')
    expect(typeof barrel.SystemGuidance).toBe('function')
    expect(typeof barrel.ProgressStepper).toBe('function')
  })

  it('renders status badge, progress stepper, timeline, and guidance variants', async () => {
    const { StatusBadge } = await import('@/app/(dashboard)/components/status-badge')
    const { ProgressStepper } = await import('@/app/(dashboard)/components/progress-stepper')
    const { LifecycleTimeline } = await import('@/app/(dashboard)/components/lifecycle-timeline')
    const { SystemGuidance } = await import('@/app/(dashboard)/components/system-guidance')
    const Guidance = SystemGuidance as React.ComponentType<GuidanceProps>

    const statusKnown = renderToStaticMarkup(React.createElement(StatusBadge, { status: 'READY_FOR_PO' }))
    expect(statusKnown).toContain('Ready For Po')

    const statusFallback = renderToStaticMarkup(React.createElement(StatusBadge, { status: 'UNKNOWN_STATE' }))
    expect(statusFallback).toContain('Unknown State')

    const stepper = renderToStaticMarkup(
      React.createElement(ProgressStepper, {
        steps: [
          { key: 'draft', label: 'Draft' },
          { key: 'review', label: 'Review' },
          { key: 'sent', label: 'Sent' },
        ],
        currentIndex: 1,
      }),
    )
    expect(stepper).toContain('Draft')
    expect(stepper).toContain('Review')
    expect(stepper).toContain('Sent')

    const timeline = renderToStaticMarkup(
      React.createElement(LifecycleTimeline, {
        events: [
          { label: 'Created quote', timestamp: new Date('2024-01-01T00:00:00.000Z') },
          { label: 'Payment received', timestamp: '2024-01-02T00:00:00.000Z', actor: 'Alex' },
        ],
      }),
    )
    expect(timeline).toContain('Created quote')
    expect(timeline).toContain('Payment received')
    expect(timeline).toContain('Alex')

    const timelineEmpty = renderToStaticMarkup(React.createElement(LifecycleTimeline, { events: [] }))
    expect(timelineEmpty).toBe('')

    const guidanceInfo = renderToStaticMarkup(
      React.createElement(Guidance, { severity: 'info', title: 'Info' }, 'Proceed to next step'),
    )
    expect(guidanceInfo).toContain('Info')
    expect(guidanceInfo).toContain('Proceed to next step')

    const guidanceError = renderToStaticMarkup(
      React.createElement(Guidance, { severity: 'error' }, 'Blocking issue detected'),
    )
    expect(guidanceError).toContain('Blocking issue detected')
  })

  it('renders org picker and require-org states', async () => {
    const { OrgPicker, RequireOrg } = await import('@/app/(dashboard)/components/org-picker')

    const picker = renderToStaticMarkup(React.createElement(OrgPicker))
    expect(picker).toContain('Organization')
    expect(picker).toContain('OrganizationSwitcher')

    mockUseOrganization.mockReturnValueOnce({ isLoaded: false, organization: null })
    const loading = renderToStaticMarkup(
      React.createElement(RequireOrg, null, React.createElement('div', null, 'Protected')),
    )
    expect(loading).toContain('Loading')

    mockUseOrganization.mockReturnValueOnce({ isLoaded: true, organization: null })
    const noOrg = renderToStaticMarkup(
      React.createElement(RequireOrg, null, React.createElement('div', null, 'Protected')),
    )
    expect(noOrg).toContain('Select an Organization')

    mockUseOrganization.mockReturnValueOnce({ isLoaded: true, organization: { id: 'org-1' } })
    const withOrg = renderToStaticMarkup(
      React.createElement(RequireOrg, null, React.createElement('div', null, 'Protected Area')),
    )
    expect(withOrg).toContain('Protected Area')
  })
})
