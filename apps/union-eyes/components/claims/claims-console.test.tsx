// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'
import { NextIntlClientProvider } from 'next-intl'
import enCA from '../../messages/en-CA.json'
import { ClaimsConsole } from './claims-console'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))
vi.stubGlobal('ResizeObserver', class { observe() {} unobserve() {} disconnect() {} })

const fetchMock = vi.fn()
beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})
afterEach(cleanup)

const answer = (rows: unknown[]) => ({ ok: true, status: 200, json: async () => ({ success: true, data: { data: rows }, timestamp: '2026-01-04T00:00:00.000Z' }) })
const refusal = (status: number, body: unknown) => ({ ok: false, status, json: async () => body })

// What GET /api/cases lists: a case the caller holds, and a row of the triage queue.
const held = {
  claimId: 'c1', claimNumber: 'CLM-20260101-0001', organizationId: 'o1', memberId: 'u1', isAnonymous: true, claimType: 'grievance_pay', status: 'under_review', priority: 'critical',
  incidentDate: '2026-01-02T14:00:00.000Z', createdAt: '2026-01-03T15:00:00.000Z', assignedTo: 'u2', memberName: 'Ana Roy', assignedToName: 'Sam Lee',
}
const unassigned = { ...held, claimId: 'c2', claimNumber: 'CLM-20260101-0002', memberName: 'Bo Kim', assignedTo: null, assignedToName: null, incidentDate: null, priority: 'low', status: 'submitted' }
const queued = { claimId: 'c3', claimNumber: 'CLM-20260101-0003', claimType: 'other', status: 'submitted', priority: 'medium', createdAt: '2026-01-03T15:00:00.000Z', filedDate: null, triageOnly: true }

const renderConsole = (view: 'member' | 'staff') =>
  render(
    <NextIntlClientProvider locale="en-CA" messages={enCA}>
      <ClaimsConsole view={view} />
    </NextIntlClientProvider>,
  )

describe('ClaimsConsole', () => {
  it('asks the case route, which names the member and the assignee, and not the claims route, which names neither', async () => {
    fetchMock.mockResolvedValue(answer([held]))
    renderConsole('staff')
    await screen.findByText('Ana Roy')
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(fetchMock.mock.calls[0][0]).toBe('/api/cases')
  })

  it('shows the member, the assignee and the real labels of the status, type and priority of each case', async () => {
    fetchMock.mockResolvedValue(answer([held, unassigned, queued]))
    renderConsole('staff')
    await screen.findByText('Ana Roy')
    expect(screen.getByText('Sam Lee')).toBeInTheDocument()
    expect(screen.getByText('Under Review')).toBeInTheDocument()
    expect(screen.getByText('Urgent')).toBeInTheDocument()
    expect(screen.getAllByText('Grievance – Pay')).toHaveLength(2)
    expect(screen.queryByText('under_review')).not.toBeInTheDocument()
  })

  it('does not call an assigned case unassigned, nor show an incident date nobody recorded', async () => {
    fetchMock.mockResolvedValue(answer([held, unassigned]))
    renderConsole('staff')
    await screen.findByText('Ana Roy')
    expect(screen.getAllByText('Unassigned')).toHaveLength(1)
    expect(screen.getAllByText('—').length).toBeGreaterThan(0)
  })

  it('says the triage queue shows no member, as a design, instead of an empty name', async () => {
    fetchMock.mockResolvedValue(answer([queued]))
    renderConsole('staff')
    await screen.findByText('Triage queue')
    expect(screen.getByText('Unassigned')).toBeInTheDocument()
  })

  it('shows a member their own cases without the staff columns', async () => {
    fetchMock.mockResolvedValue(answer([held]))
    renderConsole('member')
    await screen.findByTestId('member-case-list')
    expect(screen.queryByText('Ana Roy')).not.toBeInTheDocument()
    expect(screen.queryByText('Assigned To')).not.toBeInTheDocument()
  })

  it('states the route\'s own message when it refuses, with a retry, and not an empty list', async () => {
    fetchMock.mockResolvedValue(refusal(403, { code: 'FORBIDDEN', message: 'Case access is limited to its parties' }))
    renderConsole('staff')
    await screen.findByText('Case access is limited to its parties')
    expect(screen.getByRole('button', { name: /retry/i })).toBeInTheDocument()
    expect(screen.queryByText(enCA.claimsPage.staffEmptyTitle)).not.toBeInTheDocument()
  })

  it('reports an answer that is not the case list rather than showing a table of blanks', async () => {
    fetchMock.mockResolvedValue(answer([{ claimNumber: 'CLM-1', status: 'submitted' }]))
    renderConsole('staff')
    await waitFor(() => expect(screen.getByText(/claimId is missing/)).toBeInTheDocument())
  })

  it('shows the empty state when the route lists no case', async () => {
    fetchMock.mockResolvedValue(answer([]))
    renderConsole('staff')
    await screen.findByText(enCA.claimsPage.staffEmptyTitle)
  })
})
