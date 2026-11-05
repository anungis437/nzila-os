// @vitest-environment jsdom
/**
 * The three ingestion consoles (duplicate review, migration dashboard, batch detail) read what their routes answer with. The routes return their own object and the framework wraps it as
 * { success, data, timestamp }, so the object is under `data`; a console that reads the answer itself finds no groups, no batches and no records. A request that fails is said to have
 * failed, never shown as an empty list.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import '@testing-library/jest-dom/vitest'

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: vi.fn() }) }))

import DuplicateReviewConsole from '../duplicate-review-console'
import MigrationsConsole from '../migrations-console'
import MigrationDetailConsole from '../migration-detail-console'

const fetchMock = vi.fn()

const wrapped = (data: unknown) => ({ ok: true, status: 200, json: async () => ({ success: true, data, timestamp: 'now' }) })
const failed = (status: number, message: string) => ({ ok: false, status, json: async () => ({ code: 'FAILED', message, timestamp: 'now', traceId: 't' }) })

beforeEach(() => {
  fetchMock.mockReset()
  vi.stubGlobal('fetch', fetchMock)
})

afterEach(() => {
  cleanup()
  vi.unstubAllGlobals()
})

describe('DuplicateReviewConsole', () => {
  const group = {
    id: 'g1',
    groupType: 'email',
    status: 'pending',
    autoScore: 0.92,
    matchReasons: [{ reason: 'same address', score: 0.9 }],
    reviewedBy: null,
    reviewedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    members: [{ id: 'm1', recordType: 'member', recordId: 'record-1', similarityScore: 0.9, isAnchor: true }],
  }

  it('lists the groups the route answers under data', async () => {
    fetchMock.mockResolvedValueOnce(wrapped({ groups: [group], total: 1 }))
    render(<DuplicateReviewConsole />)
    expect(await screen.findByText(/Email Duplicate/)).toBeInTheDocument()
    expect(screen.getByText('record-1')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/duplicates?status=pending')
  })

  it('says why the groups could not be loaded, and does not claim there are none', async () => {
    fetchMock.mockResolvedValueOnce(failed(500, 'The duplicate index is unavailable'))
    render(<DuplicateReviewConsole />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The duplicate index is unavailable')
    expect(screen.queryByText('No duplicate groups found')).toBeNull()
  })

  it('says an answer that is not the route\'s object has failed, rather than rendering it', async () => {
    fetchMock.mockResolvedValueOnce({ ok: true, status: 200, json: async () => ({ groups: [group], total: 1 }) })
    render(<DuplicateReviewConsole />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Unexpected API response')
  })
})

describe('MigrationsConsole', () => {
  const batch = { id: 'b1', sourceSystem: 'legacy-crm', status: 'completed', totalRecords: 10, succeeded: 9, failed: 1, skipped: 0, createdBy: null, startedAt: null, completedAt: null, createdAt: '2026-01-01T00:00:00.000Z', durationMs: 1500 }
  const metrics = { totalBatches: 1, totalRecords: 10, totalSucceeded: 9, totalFailed: 1, totalSkipped: 0, successRate: 90, failureRate: 10, duplicateGroupsTotal: 2, duplicateGroupsPending: 1, qualityWarningsTotal: 3, qualityWarningsUnresolved: 2 }

  it('shows the batches and the metrics the route answers under data', async () => {
    fetchMock.mockResolvedValueOnce(wrapped({ batches: [batch], total: 1, metrics }))
    render(<MigrationsConsole />)
    expect(await screen.findByText('legacy-crm')).toBeInTheDocument()
    expect(screen.getByText('90%')).toBeInTheDocument()
    expect(screen.getByText('Total Batches')).toBeInTheDocument()
  })

  it('says why the batches could not be loaded, and does not claim there are none', async () => {
    fetchMock.mockResolvedValueOnce(failed(403, 'Administrator access is required'))
    render(<MigrationsConsole />)
    expect(await screen.findByRole('alert')).toHaveTextContent('Administrator access is required')
    expect(screen.queryByText('No migration batches found')).toBeNull()
  })
})

describe('MigrationDetailConsole', () => {
  const detail = {
    id: 'b1',
    sourceSystem: 'legacy-crm',
    status: 'partial',
    totalRecords: 2,
    succeeded: 1,
    failed: 1,
    skipped: 0,
    createdBy: null,
    startedAt: null,
    completedAt: null,
    createdAt: '2026-01-01T00:00:00.000Z',
    durationMs: 1000,
    errorSummary: null,
    metadata: null,
    records: [{ id: 'r1', recordIndex: 1, recordType: 'member', externalId: 'x1', status: 'failed', resolvedId: null, errorMessage: 'bad row', fingerprint: 'abc', processedAt: null }],
    warnings: [],
  }

  it('shows the batch and its records, and offers to retry the failed one', async () => {
    fetchMock.mockResolvedValueOnce(wrapped(detail))
    render(<MigrationDetailConsole batchId="b1" />)
    expect(await screen.findByText('Batch: legacy-crm')).toBeInTheDocument()
    expect(screen.getByText('Retry 1 Failed')).toBeInTheDocument()
    expect(fetchMock.mock.calls[0][0]).toBe('/api/admin/ingest/batches/b1')
  })

  it('says a batch that does not exist is not found, and any other failure in the server\'s words', async () => {
    fetchMock.mockResolvedValueOnce(failed(404, 'Batch not found'))
    render(<MigrationDetailConsole batchId="b1" />)
    expect(await screen.findByText('Batch not found')).toBeInTheDocument()
    cleanup()
    fetchMock.mockResolvedValueOnce(failed(500, 'The ledger could not be read'))
    render(<MigrationDetailConsole batchId="b2" />)
    expect(await screen.findByRole('alert')).toHaveTextContent('The ledger could not be read')
  })
})
