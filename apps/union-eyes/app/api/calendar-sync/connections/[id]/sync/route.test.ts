import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'

const mocks = vi.hoisted(() => {
  const selectQueue: any[][] = []

  const db = {
    select: vi.fn(() => ({
      from: vi.fn(() => ({
        where: vi.fn(() => ({
          limit: vi.fn(async () => selectQueue.shift() ?? []),
        })),
      })),
    })),
    update: vi.fn(() => ({
      set: vi.fn(() => ({ where: vi.fn(async () => undefined) })),
    })),
    _selectQueue: selectQueue,
  }

  return {
    db,
    importGoogleEvents: vi.fn(),
    exportEventToGoogle: vi.fn(),
    importMicrosoftEvents: vi.fn(),
    exportEventToMicrosoft: vi.fn(),
  }
})

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn((handler: (...args: any[]) => unknown) => handler),
}))

vi.mock('@/db/db', () => ({ db: mocks.db }))

vi.mock('@/lib/external-calendar-sync/google-calendar-service', () => ({
  importGoogleEvents: mocks.importGoogleEvents,
  exportEventToGoogle: mocks.exportEventToGoogle,
}))

vi.mock('@/lib/external-calendar-sync/microsoft-calendar-service', () => ({
  importMicrosoftEvents: mocks.importMicrosoftEvents,
  exportEventToMicrosoft: mocks.exportEventToMicrosoft,
}))

const { POST } = await import('@/app/api/calendar-sync/connections/[id]/sync/route')

function makePostRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('https://example.com/api/calendar-sync/connections/conn-1/sync', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
}

describe('POST /api/calendar-sync/connections/[id]/sync', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mocks.db._selectQueue.length = 0
  })

  it('runs provider import when connection and calendar are org-scoped', async () => {
    mocks.importGoogleEvents.mockResolvedValue({ imported: 3, updated: 1, deleted: 0 })
    mocks.db._selectQueue.push(
      [
        {
          id: 'conn-1',
          provider: 'google',
          syncDirection: 'import',
          isActive: true,
          organizationId: 'org-1',
        },
      ],
      [{ id: 'cal-1' }],
    )

    const req = makePostRequest({
      localCalendarId: '11111111-1111-1111-1111-111111111111',
      externalCalendarId: 'google-cal-1',
    })

    const res = await POST(req, { organizationId: 'org-1', userId: 'user-1', memberId: 'member-1' }, { id: 'conn-1' })
    const body = await res.json()

    expect(res.status).toBe(200)
    expect(body.success).toBe(true)
    expect(mocks.importGoogleEvents).toHaveBeenCalledTimes(1)
  })

  it('rejects when connection does not belong to requester org', async () => {
    mocks.db._selectQueue.push([])

    const req = makePostRequest({
      localCalendarId: '11111111-1111-1111-1111-111111111111',
      externalCalendarId: 'google-cal-1',
    })

    const res = await POST(req, { organizationId: 'org-1', userId: 'user-1', memberId: 'member-1' }, { id: 'conn-1' })
    const body = await res.json()

    expect(res.status).toBe(404)
    expect(body.code).toBe('NOT_FOUND')
  })

  it('rejects when local calendar is outside requester org scope', async () => {
    mocks.db._selectQueue.push(
      [
        {
          id: 'conn-1',
          provider: 'google',
          syncDirection: 'import',
          isActive: true,
          organizationId: 'org-1',
        },
      ],
      [],
    )

    const req = makePostRequest({
      localCalendarId: '11111111-1111-1111-1111-111111111111',
      externalCalendarId: 'google-cal-1',
    })

    const res = await POST(req, { organizationId: 'org-1', userId: 'user-1', memberId: 'member-1' }, { id: 'conn-1' })
    const body = await res.json()

    expect(res.status).toBe(403)
    expect(body.code).toBe('FORBIDDEN')
  })

  it('returns validation error for export mode without localEventId', async () => {
    mocks.db._selectQueue.push(
      [
        {
          id: 'conn-1',
          provider: 'google',
          syncDirection: 'export',
          isActive: true,
          organizationId: 'org-1',
        },
      ],
      [{ id: 'cal-1' }],
    )

    const req = makePostRequest({
      localCalendarId: '11111111-1111-1111-1111-111111111111',
      externalCalendarId: 'google-cal-1',
      mode: 'export',
    })

    const res = await POST(req, { organizationId: 'org-1', userId: 'user-1', memberId: 'member-1' }, { id: 'conn-1' })
    const body = await res.json()

    expect(res.status).toBe(400)
    expect(body.code).toBe('VALIDATION_ERROR')
  })
})
