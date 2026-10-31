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
      set: vi.fn(() => ({
        where: vi.fn(() => ({
          returning: vi.fn(async () => db._updateRows.shift() ?? [{ id: 'conn-1' }]),
        })),
      })),
    })),
    _selectQueue: selectQueue,
    _updateRows: [] as Array<Array<{ id: string }>>,
  }

  return {
    db,
    importGoogleEvents: vi.fn(),
    exportEventToGoogle: vi.fn(),
    importMicrosoftEvents: vi.fn(),
    exportEventToMicrosoft: vi.fn(),
    performAuditedOperation: vi.fn(),
    operationAuditResponse: vi.fn(),
    persistAtomicAudit: vi.fn(),
    withRLSContext: vi.fn(),
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
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: mocks.persistAtomicAudit }))
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: mocks.withRLSContext }))

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
    mocks.db._updateRows.length = 0
    mocks.performAuditedOperation.mockImplementation(async (_op: unknown, fn: () => Promise<unknown>) => fn())
    mocks.operationAuditResponse.mockReturnValue(null)
    mocks.persistAtomicAudit.mockResolvedValue(undefined)
    mocks.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (tx: unknown) => Promise<unknown>) => fn(mocks.db))
  })

  const conn = { id: 'conn-1', provider: 'google', syncDirection: 'import', isActive: true, syncEnabled: true, organizationId: 'org-1' }
  const ids = { localCalendarId: '11111111-1111-1111-1111-111111111111', externalCalendarId: 'google-cal-1' }
  const actor = { organizationId: 'org-1', userId: 'user-1', memberId: 'member-1' }

  it('refuses sync without an authenticated actor before any database or provider operation', async () => {
    const res = await POST(makePostRequest(ids), { organizationId: 'org-1', userId: '' }, { id: 'conn-1' });
    expect(res.status).toBe(403);
    expect(mocks.db.select).not.toHaveBeenCalled();
    expect(mocks.importGoogleEvents).not.toHaveBeenCalled();
  });


  it('refuses a disabled connection without invoking any provider or audit', async () => {
    mocks.db._selectQueue.push([{ ...conn, syncEnabled: false }])
    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })
    expect(res.status).toBe(403)
    expect(mocks.performAuditedOperation).not.toHaveBeenCalled()
    expect(mocks.importGoogleEvents).not.toHaveBeenCalled()
  })

  it('refuses a missing sync-enabled grant rather than treating it as consent', async () => {
    mocks.db._selectQueue.push([{ ...conn, syncEnabled: null }])
    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })
    expect(res.status).toBe(403)
    expect(mocks.performAuditedOperation).not.toHaveBeenCalled()
  })

  it.each([
    ['import', 'export'],
    ['import', 'both'],
    ['export', 'import'],
    ['export', 'both'],
  ] as const)('refuses %s-only connection override to %s before provider access', async (configured, requested) => {
    mocks.db._selectQueue.push([{ ...conn, syncDirection: configured }])
    const res = await POST(makePostRequest({ ...ids, mode: requested }), actor, { id: 'conn-1' })
    expect(res.status).toBe(403)
    expect(mocks.performAuditedOperation).not.toHaveBeenCalled()
    expect(mocks.importGoogleEvents).not.toHaveBeenCalled()
    expect(mocks.exportEventToGoogle).not.toHaveBeenCalled()
  })

  it('fails closed on missing or unknown connection sync direction', async () => {
    mocks.db._selectQueue.push([{ ...conn, syncDirection: 'unknown' }])
    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })
    expect(res.status).toBe(409)
    expect(mocks.performAuditedOperation).not.toHaveBeenCalled()
  })

  it('rejects oversized external calendar identifiers and unexpected fields before any DB read', async () => {
    const res = await POST(makePostRequest({ ...ids, externalCalendarId: 'x'.repeat(256), accessToken: 'forged' }), actor, { id: 'conn-1' })
    expect(res.status).toBe(400)
    expect(mocks.db.select).not.toHaveBeenCalled()
  })

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
          syncEnabled: true,
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
          syncEnabled: true,
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
          syncEnabled: true,
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

  it('F06 A3: the connection state change and its audit record commit in one tenant transaction', async () => {
    mocks.importGoogleEvents.mockResolvedValue({ imported: 1 })
    mocks.db._selectQueue.push([conn], [{ id: 'cal-1' }])

    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })

    expect(res.status).toBe(200)
    expect(mocks.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function))
    expect(mocks.persistAtomicAudit).toHaveBeenCalledWith(
      mocks.db,
      expect.objectContaining({
        organizationId: 'org-1',
        userId: 'user-1',
        action: 'calendar_sync.connection.state_synced',
        resourceType: 'external_calendar_connections',
        resourceId: 'conn-1',
        details: expect.objectContaining({ provider: 'google', mode: 'import', imported: true, exported: false }),
      }),
    )
  })

  it('F06 A3: a provider failure is recorded on the connection with its own audit record and the failure still surfaces', async () => {
    mocks.importGoogleEvents.mockRejectedValue(new Error('provider down'))
    mocks.db._selectQueue.push([conn], [{ id: 'cal-1' }])

    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })

    expect(res.status).toBe(500)
    expect(mocks.persistAtomicAudit).toHaveBeenCalledWith(mocks.db, expect.objectContaining({ action: 'calendar_sync.connection.sync_failed' }))
    expect(mocks.persistAtomicAudit).not.toHaveBeenCalledWith(mocks.db, expect.objectContaining({ action: 'calendar_sync.connection.state_synced' }))
    const set = mocks.db.update.mock.results[0]!.value.set
    expect(set).toHaveBeenCalledWith(expect.objectContaining({ syncStatus: 'failed', syncError: 'Provider sync failed' }))
  })


  it('never reports success or writes a success audit when the connection disappears before state persistence', async () => {
    mocks.importGoogleEvents.mockResolvedValue({ imported: 1 })
    mocks.db._selectQueue.push([conn], [{ id: 'cal-1' }])
    mocks.db._updateRows.push([])

    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })
    expect(res.status).toBe(500)
    expect(mocks.persistAtomicAudit).not.toHaveBeenCalledWith(
      mocks.db,
      expect.objectContaining({ action: 'calendar_sync.connection.state_synced' }),
    )
  })

  it('does not expose provider credentials or diagnostic bodies in HTTP errors or connection state', async () => {
    mocks.importGoogleEvents.mockRejectedValue(new Error('provider rejected access_token=secret-123'))
    mocks.db._selectQueue.push([conn], [{ id: 'cal-1' }])
    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })
    expect(res.status).toBe(500)
    expect(JSON.stringify(await res.json())).not.toContain('secret-123')
    expect(mocks.db.update.mock.results[0]!.value.set).toHaveBeenCalledWith(
      expect.objectContaining({ syncStatus: 'failed', syncError: 'Provider sync failed' }),
    )
  })

  it('F06 A3: a state change whose audit record cannot be written fails the sync instead of reporting it synced', async () => {
    mocks.importGoogleEvents.mockResolvedValue({ imported: 1 })
    mocks.db._selectQueue.push([conn], [{ id: 'cal-1' }])
    mocks.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'))

    const res = await POST(makePostRequest(ids), actor, { id: 'conn-1' })

    expect(res.status).toBe(500)
  })
})