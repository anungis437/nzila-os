// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import '@testing-library/jest-dom/vitest'

const nav = vi.hoisted(() => ({ refresh: vi.fn() }))
vi.mock('next/navigation', () => ({ useRouter: () => ({ refresh: nav.refresh }) }))

import { PayrollRunWizard } from './PayrollRunWizard'
import { TimesheetBatchUploader } from './TimesheetBatchUploader'

const stamp = '2026-05-31T12:00:00.000Z'
const success = (data: unknown) => ({ success: true, data, timestamp: stamp })
const failure = (code: string, message: string) => ({ code, message, timestamp: stamp, traceId: 't-1' })

type Reply = { status?: number; body: unknown }
type Init = { method?: string; body?: string }
function stubFetch(router: (url: URL, init?: Init) => Reply | undefined) {
  const fetchMock = vi.fn(async (input: string, init?: Init) => {
    const reply = router(new URL(input, 'http://localhost'), init)
    if (!reply) throw new Error(`unexpected request ${input}`)
    const status = reply.status ?? 200
    return { ok: status >= 200 && status < 300, status, json: async () => reply.body }
  })
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

beforeEach(() => nav.refresh.mockReset())
afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

// The crud factory's list: { data: rows, pagination } inside the withApi body.
const crudList = (rows: unknown[]) => success({ data: rows, pagination: { page: 1, limit: 100, total: rows.length, totalPages: 1 } })
const employer = (overrides: Record<string, unknown> = {}) => ({
  id: '5b0a8f0e-1c44-4a0e-8a53-2f6a8e2d1c11',
  organizationId: 'org-1',
  name: 'Northern Foods Ltd.',
  employerType: 'private',
  status: 'active',
  ...overrides,
})

describe('timesheet batch uploader', () => {
  const employersReply: Reply = { body: crudList([employer(), employer({ id: '9d3e7a1b-2a5c-4b5d-9d0a-3c4e5f6a7b8c', name: 'Closed Mill', status: 'archived' })]) }
  const csv = 'employee_external_id,shift_date,regular_hours\nE-1,2026-04-02,8'

  async function fill(user: ReturnType<typeof userEvent.setup>) {
    await user.selectOptions(await screen.findByLabelText('Employer'), 'Northern Foods Ltd.')
    await user.type(screen.getByLabelText('Period start'), '2026-04-01')
    await user.type(screen.getByLabelText('Period end'), '2026-04-15')
    await user.type(screen.getByLabelText('Source file name'), 'april-week-1.csv')
    await user.click(screen.getByLabelText('CSV content'))
    await user.paste(csv)
  }

  it('uploads for the employer, period and file the person chose, not for fixture identifiers', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.pathname === '/api/employers') return employersReply
      if (url.pathname === '/api/employer-execution/timesheets' && init?.method === 'POST') {
        return {
          status: 201,
          body: success({ data: { batch: { id: 'b-1', batchCode: 'ts-1', status: 'validated' }, summary: { rows: 1, valid: 1, invalid: 0, duplicates: 0 } } }),
        }
      }
    })
    const user = userEvent.setup()
    render(<TimesheetBatchUploader />)
    expect(screen.getByRole('button', { name: 'Upload Batch' })).toBeDisabled()
    await fill(user)
    // The archived employer takes no input: it is not offered.
    expect(screen.queryByRole('option', { name: 'Closed Mill' })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Upload Batch' }))

    expect(await screen.findByText('Batch ts-1 validated: 1 valid and 0 invalid of 1 rows')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body!)).toEqual({
      employerId: '5b0a8f0e-1c44-4a0e-8a53-2f6a8e2d1c11',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-15',
      sourceFileName: 'april-week-1.csv',
      csvContent: csv,
    })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })

  it('says a batch with invalid rows was rejected, instead of "Upload completed"', async () => {
    stubFetch((url, init) => {
      if (url.pathname === '/api/employers') return employersReply
      if (init?.method === 'POST') {
        return {
          status: 201,
          body: success({ data: { batch: { id: 'b-2', batchCode: 'ts-2', status: 'rejected' }, summary: { rows: 3, valid: 1, invalid: 2, duplicates: 0 } } }),
        }
      }
    })
    const user = userEvent.setup()
    render(<TimesheetBatchUploader />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Upload Batch' }))
    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('Batch ts-2 was recorded as rejected: 1 valid and 2 invalid of 3 rows')
    expect(alert).toHaveTextContent('cannot prepare a payroll run')
    expect(screen.queryByText('Upload completed')).not.toBeInTheDocument()
  })

  it("shows the route's refusal", async () => {
    stubFetch((url, init) => {
      if (url.pathname === '/api/employers') return employersReply
      if (init?.method === 'POST') return { status: 409, body: failure('CONFLICT', 'This timesheet file was already ingested for the employer and period') }
    })
    const user = userEvent.setup()
    render(<TimesheetBatchUploader />)
    await fill(user)
    await user.click(screen.getByRole('button', { name: 'Upload Batch' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('This timesheet file was already ingested for the employer and period')
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('says the employers could not be loaded, offers a retry, and cannot upload without one', async () => {
    let reads = 0
    stubFetch((url) => {
      if (url.pathname === '/api/employers') {
        reads += 1
        return reads === 1 ? { status: 500, body: failure('INTERNAL_ERROR', 'The employer registry is down') } : employersReply
      }
    })
    const user = userEvent.setup()
    render(<TimesheetBatchUploader />)
    expect(await screen.findByText('The employer registry is down')).toBeInTheDocument()
    expect(screen.getByLabelText('Employer')).toBeDisabled()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByLabelText('Employer')).toBeEnabled())
  })

  it('refuses a period that ends before it starts', async () => {
    stubFetch((url) => (url.pathname === '/api/employers' ? employersReply : undefined))
    const user = userEvent.setup()
    render(<TimesheetBatchUploader />)
    await fill(user)
    await user.clear(screen.getByLabelText('Period end'))
    await user.type(screen.getByLabelText('Period end'), '2026-03-31')
    expect(screen.getByText('The period start must not be after the period end.')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Upload Batch' })).toBeDisabled()
  })
})

describe('payroll run wizard', () => {
  const batch = (overrides: Record<string, unknown> = {}) => ({
    id: '7c1f2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
    organizationId: 'org-1',
    employerId: 'emp-1',
    batchCode: 'ts-1717',
    sourceFileName: 'april.csv',
    periodStart: '2026-04-01',
    periodEnd: '2026-04-15',
    status: 'validated',
    ...overrides,
  })
  // GET /api/employer-execution/timesheets answers { data: rows }, so the rows arrive at data.data.
  const batchesReply = (rows: unknown[]): Reply => ({ body: success({ data: rows }) })

  it('prepares the run from the validated batch the person chose, over that batch\'s own period', async () => {
    const fetchMock = stubFetch((url, init) => {
      if (url.pathname === '/api/employer-execution/timesheets') return batchesReply([batch(), batch({ id: 'rejected-1', batchCode: 'ts-bad', status: 'rejected' })])
      if (url.pathname === '/api/employer-execution/payroll-runs' && init?.method === 'POST') {
        return { status: 201, body: success({ data: { run: { id: 'run-1', runCode: 'PR-0001', status: 'draft' }, totals: { gross: '1200.00' } } }) }
      }
    })
    const user = userEvent.setup()
    render(<PayrollRunWizard />)
    const select = await screen.findByLabelText('Timesheet batch')
    await waitFor(() => expect(select).toBeEnabled())
    expect(screen.queryByRole('option', { name: /ts-bad/ })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Run' })).toBeDisabled()

    await user.selectOptions(select, 'ts-1717 (2026-04-01 to 2026-04-15)')
    await user.click(screen.getByRole('button', { name: 'Official Run' }))
    await user.click(screen.getByRole('button', { name: 'Create Run' }))

    expect(await screen.findByText('Payroll run PR-0001 created (official, draft)')).toBeInTheDocument()
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === 'POST')!
    expect(JSON.parse(post[1]!.body!)).toEqual({
      timesheetBatchId: '7c1f2d3e-4b5a-4c6d-8e7f-9a0b1c2d3e4f',
      periodStart: '2026-04-01',
      periodEnd: '2026-04-15',
      runType: 'official',
    })
    expect(nav.refresh).toHaveBeenCalledTimes(1)
  })

  it('says no run can be prepared when no batch is validated', async () => {
    stubFetch((url) => (url.pathname === '/api/employer-execution/timesheets' ? batchesReply([batch({ status: 'rejected' })]) : undefined))
    render(<PayrollRunWizard />)
    expect(await screen.findByText(/upload one first/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Create Run' })).toBeDisabled()
  })

  it("shows the route's refusal and does not refresh the list", async () => {
    stubFetch((url, init) => {
      if (url.pathname === '/api/employer-execution/timesheets') return batchesReply([batch()])
      if (init?.method === 'POST') return { status: 400, body: failure('VALIDATION_ERROR', 'Official run already approved for this batch; create an adjustment run instead') }
    })
    const user = userEvent.setup()
    render(<PayrollRunWizard />)
    const select = await screen.findByLabelText('Timesheet batch')
    await waitFor(() => expect(select).toBeEnabled())
    await user.selectOptions(select, 'ts-1717 (2026-04-01 to 2026-04-15)')
    await user.click(screen.getByRole('button', { name: 'Create Run' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Official run already approved for this batch; create an adjustment run instead')
    expect(nav.refresh).not.toHaveBeenCalled()
  })

  it('reports batches that could not be loaded, with a retry', async () => {
    let reads = 0
    stubFetch((url) => {
      if (url.pathname === '/api/employer-execution/timesheets') {
        reads += 1
        return reads === 1 ? { status: 403, body: failure('FORBIDDEN', 'Financial authority is required') } : batchesReply([batch()])
      }
    })
    const user = userEvent.setup()
    render(<PayrollRunWizard />)
    expect(await screen.findByText('Financial authority is required')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Retry' }))
    await waitFor(() => expect(screen.getByLabelText('Timesheet batch')).toBeEnabled())
  })
})
