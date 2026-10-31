import { beforeEach, describe, expect, it, vi } from 'vitest'
import { NextRequest } from 'next/server'
import { readFileSync } from 'node:fs'

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
    performAuditedOperation: vi.fn(),
    operationAuditResponse: vi.fn(),
  }
})

vi.mock('@/lib/organization-middleware', () => ({
  withOrganizationAuth: vi.fn((handler: (...args: any[]) => unknown) => handler),
}))

vi.mock('@/lib/audit/operation-audit', () => ({
  performAuditedOperation: mocks.performAuditedOperation,
  operationAuditResponse: mocks.operationAuditResponse,
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
    mocks.performAuditedOperation.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn())
    mocks.operationAuditResponse.mockReturnValue(null)
  })

  const conn = { id: 'conn-1', provider: 'google', syncDirection: 'import', isActive: true, organizationId: 'org-1' }
  const ids = { localCalendarId: '11111111-1111-1111-1111-111111111111', externalCalendarId: 'google-cal-1' }
  const actor = { organizationId: 'org-1', userId: 'user-1', memberId: 'member-1' }

  it('refuses sync without an authenticated actor before any database or provider operation', async () => {
    const res = await POST(makePostRequest(ids), { organizationId: 'org-1', userId: '' }, { id: 'conn-1' });
    expect(res.status).toBe(403);
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(mocks.importGoogleEvents).not.toHaveBeenCalled();
  });

  it('enforces connection ownership, local calendar ownership, and event ownership in the query predicates', () => {
    const src = readFileSync(new URL('./route.ts', import.meta.url), 'utf8');
    expect(src).toContain('eq(externalCalendarConnections.userId, userId)');
    expect(src).toContain('eq(calendars.ownerId, userId)');
    expect(src).toContain('eq(calendarEvents.calendarId, localCalendarId)');
    expect(src).toContain('eq(calendarEvents.organizerId, userId)');
  });

  it('records the intent first under the caller organization and actor, then runs the provider sync', async () => {
    mocks.importGoogleEvents.mockResolvedValue({ imported: 1 })
    mocks.db._selectQueue.push([conn], [{ id: 'cal-1' }])

    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })

    expect(res.status).toBe(200)
    expect(mocks.performAuditedOperation).toHaveBeenCalledWith(
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'calendar_sync.connection.sync',
        resourceType: 'external_calendar_connections',
        resourceId: 'conn-1',
      }),
      expect.any(Function),
    )
    expect(mocks.importGoogleEvents).toHaveBeenCalledTimes(1)
  })

  it('does not call the provider when the audit boundary refuses the operation', async () => {
    mocks.db._selectQueue.push([conn], [{ id: 'cal-1' }])
    const refusal = new Error('audit unavailable')
    mocks.performAuditedOperation.mockRejectedValueOnce(refusal)
    mocks.operationAuditResponse.mockReturnValueOnce({ status: 409, body: { error: { code: 'OPERATION_AUDIT_UNAVAILABLE', message: 'not performed' } } })

    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })

    expect(res.status).toBe(409)
    expect(mocks.importGoogleEvents).not.toHaveBeenCalled()
  })

  it('refuses to export an event that is not in the caller organization, before any audit or provider call', async () => {
    mocks.db._selectQueue.push([{ ...conn, syncDirection: 'export' }], [{ id: 'cal-1' }], [])

    const res = await POST(
      makePostRequest({ ...ids, mode: 'export', localEventId: '22222222-2222-2222-2222-222222222222' }),
      actor,
      { id: 'conn-1' },
    )

    expect(res.status).toBe(404)
    expect(mocks.performAuditedOperation).not.toHaveBeenCalled()
    expect(mocks.exportEventToGoogle).not.toHaveBeenCalled()
  })

  it('exports an event that belongs to the caller organization', async () => {
    mocks.exportEventToGoogle.mockResolvedValue({ id: 'g1' })
    mocks.db._selectQueue.push([{ ...conn, syncDirection: 'export' }], [{ id: 'cal-1' }], [{ id: 'evt-1' }])

    const res = await POST(
      makePostRequest({ ...ids, mode: 'export', localEventId: '22222222-2222-2222-2222-222222222222' }),
      actor,
      { id: 'conn-1' },
    )

    expect(res.status).toBe(200)
    expect(mocks.exportEventToGoogle).toHaveBeenCalledWith('conn-1', '22222222-2222-2222-2222-222222222222', 'google-cal-1')
  })

  it('answers 501 for an unsupported provider with no audit and no sync', async () => {
    mocks.db._selectQueue.push([{ ...conn, provider: 'caldav' }], [{ id: 'cal-1' }])

    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })

    expect(res.status).toBe(501)
    expect(mocks.performAuditedOperation).not.toHaveBeenCalled()
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
