import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getCorrespondenceWithDetails: vi.fn(),
  updateCorrespondence: vi.fn(),
}));

vi.mock('@/lib/api/with-api', () => ({ withApi: m.withApi }));
vi.mock('@/lib/api/errors', () => ({
  ApiError: {
    badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }),
    notFound: (msg: string) => Object.assign(new Error(msg), { status: 404 }),
  },
}));
vi.mock('@/lib/services/correspondence-service', () => ({
  getCorrespondenceWithDetails: m.getCorrespondenceWithDetails,
  updateCorrespondence: m.updateCorrespondence,
}));

async function loadRoute() {
  return import('../correspondence/[id]/route');
}

// The route refuses an id that is not a GUID before reading anything
const CORRESPONDENCE_ID = '11111111-1111-4111-8111-111111111111';

const patchCtx = (overrides: Record<string, unknown> = {}) => ({
  params: { id: CORRESPONDENCE_ID },
  organizationId: 'org_1',
  userId: 'u1',
  user: { name: 'Ada', role: 'steward' },
  body: { subject: 'A new subject' },
  request: new Request(`http://localhost/api/correspondence/${CORRESPONDENCE_ID}`, { method: 'PATCH', headers: { 'x-forwarded-for': '1.2.3.4', 'user-agent': 'vitest' } }),
  ...overrides,
});

describe('correspondence/[id] route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.getCorrespondenceWithDetails.mockResolvedValue({ id: CORRESPONDENCE_ID, organizationId: 'org_1', recipients: [], auditTrail: [] });
    m.updateCorrespondence.mockResolvedValue({ id: CORRESPONDENCE_ID, subject: 'A new subject' });
  });

  it('declares the caller tenant transaction for GET and for PATCH: the reads and the edit are tenant work', async () => {
    vi.resetModules();
    await loadRoute();
    const configs = m.withApi.mock.calls.map((call) => call[0]);
    expect(configs).toHaveLength(2);
    for (const config of configs) {
      expect(config).toMatchObject({ rlsOrgContext: true, auth: { required: true, minRole: 'steward' } });
    }
  });

  it('GET returns the details of a correspondence of the caller organization', async () => {
    const { GET } = await loadRoute();
    const result = await (GET as any)({ params: { id: CORRESPONDENCE_ID }, organizationId: 'org_1' });
    expect(result).toMatchObject({ data: { id: CORRESPONDENCE_ID } });
    expect(m.getCorrespondenceWithDetails).toHaveBeenCalledWith(CORRESPONDENCE_ID);
  });

  it('GET and PATCH answer 404 for a correspondence of another organization, and edit nothing', async () => {
    const { GET, PATCH } = await loadRoute();
    m.getCorrespondenceWithDetails.mockResolvedValue({ id: CORRESPONDENCE_ID, organizationId: 'org_2' });
    await expect((GET as any)({ params: { id: CORRESPONDENCE_ID }, organizationId: 'org_1' })).rejects.toMatchObject({ status: 404 });
    await expect((PATCH as any)(patchCtx())).rejects.toMatchObject({ status: 404 });
    expect(m.updateCorrespondence).not.toHaveBeenCalled();
  });

  it('PATCH answers 404 when the correspondence does not exist', async () => {
    const { PATCH } = await loadRoute();
    m.getCorrespondenceWithDetails.mockResolvedValue(null);
    await expect((PATCH as any)(patchCtx())).rejects.toMatchObject({ status: 404 });
    expect(m.updateCorrespondence).not.toHaveBeenCalled();
  });

  it('PATCH edits a draft of the caller organization, attributing the edit to the caller and the request', async () => {
    const { PATCH } = await loadRoute();
    const result = await (PATCH as any)(patchCtx());
    expect(result).toEqual({ data: { id: CORRESPONDENCE_ID, subject: 'A new subject' } });
    expect(m.updateCorrespondence).toHaveBeenCalledWith(expect.objectContaining({
      id: CORRESPONDENCE_ID,
      subject: 'A new subject',
      actorUserId: 'u1',
      actorName: 'Ada',
      actorRole: 'steward',
      ipAddress: '1.2.3.4',
      userAgent: 'vitest',
    }));
  });

  it('answers 400 when the id is missing', async () => {
    const { PATCH } = await loadRoute();
    await expect((PATCH as any)(patchCtx({ params: {} }))).rejects.toMatchObject({ status: 400 });
    expect(m.getCorrespondenceWithDetails).not.toHaveBeenCalled();
  });

  it('answers 400 for an id that is not a GUID, before reading or editing anything', async () => {
    const { GET, PATCH } = await loadRoute();
    for (const id of ['c_1', '123', 'not-a-uuid', `${CORRESPONDENCE_ID}-extra`]) {
      await expect((GET as any)({ params: { id }, organizationId: 'org_1' })).rejects.toMatchObject({ status: 400 });
      await expect((PATCH as any)(patchCtx({ params: { id } }))).rejects.toMatchObject({ status: 400 });
    }
    expect(m.getCorrespondenceWithDetails).not.toHaveBeenCalled();
    expect(m.updateCorrespondence).not.toHaveBeenCalled();
  });
});
