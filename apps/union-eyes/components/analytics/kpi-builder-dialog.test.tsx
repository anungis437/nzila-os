// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const toasts = vi.hoisted(() => ({ toast: vi.fn() }))
vi.mock('@/components/ui/use-toast', () => ({ useToast: () => ({ toast: toasts.toast }) }))
// Radix Select needs pointer events jsdom does not have; the form's own submit path is what is under test.
vi.mock('@/components/ui/select', () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}))

import { KPIBuilderDialog } from './kpi-builder-dialog'

const stamp = '2026-05-31T12:00:00.000Z'
const reply = (body: unknown, status = 200) => ({ ok: status >= 200 && status < 300, status, json: async () => body })

beforeEach(() => {
  toasts.toast.mockReset()
})
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('KPI builder', () => {
  it('offers no alert it cannot deliver', async () => {
    const user = userEvent.setup()
    render(<KPIBuilderDialog />)
    await user.click(screen.getByRole('button', { name: /Create KPI/ }))
    await screen.findByPlaceholderText('e.g., Monthly Claims Volume')
    expect(screen.queryByText('Enable Alerts')).not.toBeInTheDocument()
    expect(screen.queryByText('Alert Recipients')).not.toBeInTheDocument()
  })

  it('creates the KPI with numeric thresholds and no alert, then tells the caller instead of reloading the page', async () => {
    const fetchMock = vi.fn(async () =>
      reply({ success: true, data: { data: { id: 'k-1', name: 'Monthly claims' } }, timestamp: stamp }),
    )
    vi.stubGlobal('fetch', fetchMock)
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<KPIBuilderDialog onCreated={onCreated} />)
    await user.click(screen.getByRole('button', { name: /Create KPI/ }))
    await user.type(await screen.findByPlaceholderText('e.g., Monthly Claims Volume'), 'Monthly claims')
    await user.type(screen.getByPlaceholderText('100'), '50')
    await user.type(screen.getByPlaceholderText('80'), '60')
    await user.type(screen.getByPlaceholderText('120'), '80')
    const submit = screen.getAllByRole('button', { name: 'Create KPI' }).at(-1)!
    await user.click(submit)

    await waitFor(() => expect(onCreated).toHaveBeenCalledTimes(1))
    expect(fetchMock).toHaveBeenCalledTimes(1)
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, { method: string; body: string }]
    expect(url).toBe('/api/analytics/kpis')
    expect(init.method).toBe('POST')
    expect(JSON.parse(init.body)).toMatchObject({
      name: 'Monthly claims',
      metricType: 'claims_volume',
      dataSource: 'claims',
      visualizationType: 'number',
      targetValue: 50,
      warningThreshold: 60,
      criticalThreshold: 80,
      alertEnabled: false,
    })
    expect(JSON.parse(init.body)).not.toHaveProperty('alertRecipients')
    expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'KPI Created' }))
  })

  it("shows the route's refusal and keeps the dialog open", async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => reply({ code: 'FORBIDDEN', message: 'Insufficient permissions', timestamp: stamp, traceId: 't-1' }, 403)),
    )
    const onCreated = vi.fn()
    const user = userEvent.setup()
    render(<KPIBuilderDialog onCreated={onCreated} />)
    await user.click(screen.getByRole('button', { name: /Create KPI/ }))
    await user.type(await screen.findByPlaceholderText('e.g., Monthly Claims Volume'), 'Monthly claims')
    await user.click(screen.getAllByRole('button', { name: 'Create KPI' }).at(-1)!)

    await waitFor(() =>
      expect(toasts.toast).toHaveBeenCalledWith(expect.objectContaining({ title: 'Error', description: 'Insufficient permissions', variant: 'destructive' })),
    )
    expect(onCreated).not.toHaveBeenCalled()
    expect(screen.getByPlaceholderText('e.g., Monthly Claims Volume')).toBeInTheDocument()
  })
})
