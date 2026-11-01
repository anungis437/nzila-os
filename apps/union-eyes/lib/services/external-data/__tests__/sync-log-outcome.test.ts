import { describe, expect, it, vi } from 'vitest'

vi.mock('@/db/db', () => ({ db: {} }))
vi.mock('@/db', () => ({ db: {} }))
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: vi.fn(), withRLSContext: vi.fn() }))
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }))

import { syncLogOutcome } from '../wage-enrichment-service'

// Gate 0 F01 (DEF-0B6-SYS-EXTERNAL-DATA-SYNC-FAILURES-ANSWER-HTTP-200-AND-LOG-COMPLETED, second half): the log row of a run
// with failed records used to read "completed" and never carried the collected errors.
describe('syncLogOutcome', () => {
  it('records a clean run as completed, with no error text', () => {
    expect(syncLogOutcome(0, [])).toEqual({ status: 'completed' })
  })

  it('records a run with failed records as partial and keeps the errors it collected', () => {
    const outcome = syncLogOutcome(2, ['Failed to process record A', 'Failed to process record B'])
    expect(outcome.status).toBe('partial')
    expect(outcome.errorMessage).toContain('2 record(s) failed')
    expect(outcome.errorDetails).toContain('Failed to process record A')
    expect(outcome.errorDetails).toContain('Failed to process record B')
  })

  it('treats collected errors as a partial run even when the failed-record count is zero', () => {
    expect(syncLogOutcome(0, ['Failed to fetch data for NOC 6513']).status).toBe('partial')
  })

  it('bounds what it stores: at most 50 errors and 8000 characters', () => {
    const errors = Array.from({ length: 500 }, (_, i) => `error ${i} ${'x'.repeat(400)}`)
    const outcome = syncLogOutcome(500, errors)
    expect(outcome.errorDetails!.split('\n').length).toBeLessThanOrEqual(50)
    expect(outcome.errorDetails!.length).toBeLessThanOrEqual(8000)
  })
})
