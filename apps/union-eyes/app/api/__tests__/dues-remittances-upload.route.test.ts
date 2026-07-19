import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  db: { insert: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  buildUnionEvidencePack: vi.fn(() => Promise.resolve()),
}));

vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: { badRequest: (msg: string) => Object.assign(new Error(msg), { status: 400 }) } }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('@/db/schema/dues-finance-schema', () => ({ employerRemittances: {} }));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));

async function loadRoute() {
  return import('../dues/remittances/upload/route');
}

describe('dues/remittances/upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.withApi.mockImplementation((_cfg: unknown, handler: (ctx: any) => Promise<unknown>) => (ctx: any) => handler(ctx));
    m.db.insert.mockReturnValue({ values: vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'rem_1', fileName: 'upload.csv' }]) })) });
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
  });

  it('creates a pending remittance record from an uploaded file', async () => {
    const formData = new FormData();
    formData.set('file', new File(['a,b\n1,2'], 'upload.csv', { type: 'text/csv' }));
    formData.set('metadata', JSON.stringify({ employerId: 'emp_1', periodStart: '2026-01-01', periodEnd: '2026-01-31' }));

    const { POST } = await loadRoute();
    const result = await POST({ request: new Request('http://localhost/api/dues/remittances/upload', { method: 'POST', body: formData }), organizationId: 'org_1', userId: 'u1' });

    expect(result).toEqual({ remittance: { id: 'rem_1', fileName: 'upload.csv' } });
    expect(m.logger.info).toHaveBeenCalled();
  });

  it('throws when organization context is missing', async () => {
    const formData = new FormData();
    formData.set('file', new File(['a,b\n1,2'], 'upload.csv', { type: 'text/csv' }));
    formData.set('metadata', JSON.stringify({ employerId: 'emp_1', periodStart: '2026-01-01', periodEnd: '2026-01-31' }));

    const { POST } = await loadRoute();

    await expect(POST({ request: new Request('http://localhost/api/dues/remittances/upload', { method: 'POST', body: formData }), organizationId: '', userId: 'u1' }))
      .rejects.toThrow('Organization context required');
  });

  it('throws when file is missing', async () => {
    const formData = new FormData();
    formData.set('metadata', JSON.stringify({ employerId: 'emp_1', periodStart: '2026-01-01', periodEnd: '2026-01-31' }));

    const { POST } = await loadRoute();

    await expect(POST({ request: new Request('http://localhost/api/dues/remittances/upload', { method: 'POST', body: formData }), organizationId: 'org_1', userId: 'u1' }))
      .rejects.toThrow('No file provided');
  });

  it('throws when metadata JSON is invalid', async () => {
    const formData = new FormData();
    formData.set('file', new File(['a,b\n1,2'], 'upload.csv', { type: 'text/csv' }));
    formData.set('metadata', '{broken json');

    const { POST } = await loadRoute();

    await expect(POST({ request: new Request('http://localhost/api/dues/remittances/upload', { method: 'POST', body: formData }), organizationId: 'org_1', userId: 'u1' }))
      .rejects.toThrow('Invalid metadata JSON');
  });

  it('throws when employerId is missing from metadata', async () => {
    const formData = new FormData();
    formData.set('file', new File(['a,b\n1,2'], 'upload.csv', { type: 'text/csv' }));
    formData.set('metadata', JSON.stringify({ periodStart: '2026-01-01', periodEnd: '2026-01-31' }));

    const { POST } = await loadRoute();

    await expect(POST({ request: new Request('http://localhost/api/dues/remittances/upload', { method: 'POST', body: formData }), organizationId: 'org_1', userId: 'u1' }))
      .rejects.toThrow('employerId is required in metadata');
  });

  it('throws when period range fields are missing', async () => {
    const formData = new FormData();
    formData.set('file', new File(['a,b\n1,2'], 'upload.csv', { type: 'text/csv' }));
    formData.set('metadata', JSON.stringify({ employerId: 'emp_1' }));

    const { POST } = await loadRoute();

    await expect(POST({ request: new Request('http://localhost/api/dues/remittances/upload', { method: 'POST', body: formData }), organizationId: 'org_1', userId: 'u1' }))
      .rejects.toThrow('periodStart and periodEnd are required in metadata');
  });

  it('logs warning if evidence pack creation fails', async () => {
    const formData = new FormData();
    formData.set('file', new File(['a,b\n1,2'], 'upload.csv', { type: 'text/csv' }));
    formData.set('metadata', JSON.stringify({ employerId: 'emp_1', periodStart: '2026-01-01', periodEnd: '2026-01-31' }));
    m.buildUnionEvidencePack.mockRejectedValueOnce(new Error('evidence failure'));

    const { POST } = await loadRoute();
    const result = await POST({ request: new Request('http://localhost/api/dues/remittances/upload', { method: 'POST', body: formData }), organizationId: 'org_1', userId: 'u1' });
    await Promise.resolve();

    expect(result).toEqual({ remittance: { id: 'rem_1', fileName: 'upload.csv' } });
    expect(m.logger.warn).toHaveBeenCalled();
  });
});