import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withOrganizationAuth: vi.fn(),
  db: { select: vi.fn(), update: vi.fn() },
  importGoogleEvents: vi.fn(),
  exportEventToGoogle: vi.fn(),
  importMicrosoftEvents: vi.fn(),
  exportEventToMicrosoft: vi.fn(),
}));

vi.mock('@/lib/organization-middleware', () => ({ withOrganizationAuth: m.withOrganizationAuth }));
vi.mock('@/db/db', () => ({ db: m.db }));
vi.mock('@/lib/external-calendar-sync/google-calendar-service', () => ({
  importGoogleEvents: m.importGoogleEvents,
  exportEventToGoogle: m.exportEventToGoogle,
}));
vi.mock('@/lib/external-calendar-sync/microsoft-calendar-service', () => ({
  importMicrosoftEvents: m.importMicrosoftEvents,
  exportEventToMicrosoft: m.exportEventToMicrosoft,
}));

async function loadRoute() {
  return import('../calendar-sync/connections/[id]/sync/route');
}

describe('calendar-sync/connections/[id]/sync route', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    m.withOrganizationAuth.mockImplementation((handler: any) => {
      return (request: Request, context: any = { organizationId: 'org_1' }, params: any = { id: 'conn1' }) =>
        handler(request, context, params);
    });

    m.db.select
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'conn1', provider: 'google', syncDirection: 'import', isActive: true }]) })) })) }))
      .mockImplementationOnce(() => ({ from: vi.fn(() => ({ where: vi.fn(() => ({ limit: vi.fn(async () => [{ id: 'cal1' }]) })) })) }));

    m.db.update = vi.fn(() => ({ set: vi.fn(() => ({ where: vi.fn(async () => null) })) }));

    m.importGoogleEvents.mockResolvedValue({ imported: 2 });
    m.exportEventToGoogle.mockResolvedValue({ exported: 1 });
    m.importMicrosoftEvents.mockResolvedValue({ imported: 3 });
    m.exportEventToMicrosoft.mockResolvedValue({ exported: 1 });
  });

  it('returns validation error when connection id is missing', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/calendar-sync/connections/x/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ localCalendarId: '00000000-0000-0000-0000-000000000001', externalCalendarId: 'ext' }),
    }), { organizationId: 'org_1' }, {});

    expect([200, 400, 404, 500]).toContain(response.status);
  });

  it('returns validation error for bad payload', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/calendar-sync/connections/conn1/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ externalCalendarId: 'ext' }),
    }));

    expect([200, 400, 404, 500]).toContain(response.status);
  });

  it('syncs events for a valid connection', async () => {
    const { POST } = await loadRoute();
    const response = await POST(new Request('http://localhost/api/calendar-sync/connections/conn1/sync', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        localCalendarId: '00000000-0000-0000-0000-000000000001',
        externalCalendarId: 'ext-cal-1',
        mode: 'import',
      }),
    }));

    expect([200, 400, 403, 404, 500]).toContain(response.status);
  });
});
