import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  const selectQueue: any[][] = []
  const updatePayloads: any[] = []

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectQueue.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn((payload: any) => {
        updatePayloads.push(payload)
        return { where: vi.fn(async () => undefined) }
      }),
    })),
    _selectQueue: selectQueue,
    _updatePayloads: updatePayloads,
  }

  return {
    db,
    importGoogleEvents: vi.fn(),
    importMicrosoftEvents: vi.fn(),
    persistAtomicAudit: vi.fn(),
  }
})

vi.mock('@/lib/api-auth-guard', () => ({
  withApiAuth: vi.fn((handler: (...args: any[]) => unknown) => handler),
}))

vi.mock('@/db/db', () => ({ db: mocks.db }))

vi.mock('@/lib/db/with-rls-context', () => ({
  withSystemContext: vi.fn(async (fn: (tx: unknown) => Promise<unknown>) => fn(mocks.db)),
}))

vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.persistAtomicAudit }))

vi.mock('@/lib/external-calendar-sync/google-calendar-service', () => ({
  importGoogleEvents: mocks.importGoogleEvents,
}))

vi.mock('@/lib/external-calendar-sync/microsoft-calendar-service', () => ({
  importMicrosoftEvents: mocks.importMicrosoftEvents,
}))

const { POST } = await import('@/app/api/cron/calendar-sync/route')

describe('POST /api/cron/calendar-sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.db._selectQueue.length = 0
    mocks.db._updatePayloads.length = 0
    mocks.persistAtomicAudit.mockResolvedValue(undefined)
  })

  it('audits a successful sync under the connection organization on the same transaction, as the cron system actor', async () => {
    mocks.importGoogleEvents.mockResolvedValue({ imported: 2, updated: 1, deleted: 0 })
    mocks.db._selectQueue.push(
      [{ id: 'conn-1', provider: 'google', organizationId: 'org-1', syncPastDays: 14, syncFutureDays: 90, calendarMappings: [{ externalId: 'g1', localCalendarId: 'cal-1' }] }],
      [{ id: 'cal-1' }],
    )

    await POST(new NextRequest('https://example.com/api/cron/calendar-sync', { method: 'POST' }), {} as Record<string, unknown>)

    expect(mocks.persistAtomicAudit).toHaveBeenCalledTimes(1)
    expect(mocks.persistAtomicAudit).toHaveBeenCalledWith(
      mocks.db,
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'system:cron:calendar-sync',
        action: 'calendar_sync.connection.sync',
        resourceType: 'external_calendar_connections',
        resourceId: 'conn-1',
        details: expect.objectContaining({ imported: 2, updated: 1 }),
      }),
    )
  })

  it('records a failed sync as a failure audit under the same organization, and a failed success-audit fails the sync', async () => {
    mocks.importGoogleEvents.mockResolvedValue({ imported: 1 })
    mocks.db._selectQueue.push(
      [{ id: 'conn-1', provider: 'google', organizationId: 'org-1', syncPastDays: 14, syncFutureDays: 90, calendarMappings: [{ externalId: 'g1', localCalendarId: 'cal-1' }] }],
      [{ id: 'cal-1' }],
    )
    mocks.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'))

    const res = await POST(new NextRequest('https://example.com/api/cron/calendar-sync', { method: 'POST' }), {} as Record<string, unknown>)
    const body = await res.json()

    expect(body.data.syncedCount).toBe(0)
    expect(body.data.failedCount).toBe(1)
    expect(mocks.persistAtomicAudit).toHaveBeenLastCalledWith(
      mocks.db,
      expect.objectContaining({ organizationId: 'org-1', action: 'calendar_sync.connection.sync_failed' }),
      'failure',
    )
  })

  it('syncs due google connections and updates next sync metadata', async () => {
    mocks.importGoogleEvents.mockResolvedValue({ imported: 2, updated: 1, deleted: 0 })

    mocks.db._selectQueue.push(
      [
        {
          id: 'conn-1',
          provider: 'google',
          organizationId: 'org-1',
          syncPastDays: 14,
          syncFutureDays: 90,
          calendarMappings: [{ externalId: 'google-cal-1', localCalendarId: 'cal-1' }],
        },
      ],
      [{ id: 'cal-1' }],
    )

    const req = new NextRequest('https://example.com/api/cron/calendar-sync?limit=10', {
      method: 'POST',
      headers: { 'x-cron-secret': 'secret' },
    })

    const res = await POST(req, {} as Record<string, unknown>)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.syncedCount).toBe(1)
    expect(body.data.failedCount).toBe(0)
    expect(mocks.importGoogleEvents).toHaveBeenCalledTimes(1)
    expect(mocks.db._updatePayloads.some((p) => (p as { syncStatus?: string }).syncStatus === 'synced')).toBe(true)
  })

  it('marks connections failed when mappings are missing', async () => {
    mocks.db._selectQueue.push([
      {
        id: 'conn-2',
        provider: 'microsoft',
        organizationId: 'org-1',
        syncPastDays: 30,
        syncFutureDays: 365,
        calendarMappings: [],
      },
    ])

    const req = new NextRequest('https://example.com/api/cron/calendar-sync', {
      method: 'POST',
      headers: { 'x-cron-secret': 'secret' },
    })

    const res = await POST(req, {} as Record<string, unknown>)
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(body.data.syncedCount).toBe(0)
    expect(body.data.failedCount).toBe(1)
    expect(mocks.db._updatePayloads.some((p) => (p as { syncStatus?: string }).syncStatus === 'failed')).toBe(true)
  })
})
