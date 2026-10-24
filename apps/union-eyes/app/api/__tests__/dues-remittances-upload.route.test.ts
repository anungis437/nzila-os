import { createHash } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const EMPLOYER_ID = '11111111-1111-4111-8111-111111111111';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  insertValues: vi.fn(),
  existing: [] as Array<{ id: string }>,
  db: { insert: vi.fn(), select: vi.fn() },
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  buildUnionEvidencePack: vi.fn(() => Promise.resolve()),
  putBlob: vi.fn(),
  deleteBlob: vi.fn(),
}));

class TestApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

vi.mock('@/lib/api/framework', () => ({
  withApi: m.withApi,
  ApiError: {
    badRequest: (msg: string) => new TestApiError(msg, 400),
    conflict: (msg: string) => new TestApiError(msg, 409),
    externalService: (_svc: string, msg: string) => new TestApiError(msg, 502),
  },
}));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn() }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  employerRemittances: { id: 'id', organizationId: 'organizationId', fileHash: 'fileHash' },
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/blob-client', () => ({ putBlob: m.putBlob, deleteBlob: m.deleteBlob }));

async function loadRoute() {
  return import('../dues/remittances/upload/route');
}

function request(file: File | null, metadata: unknown) {
  const formData = new FormData();
  if (file) formData.set('file', file);
  if (typeof metadata === 'string') formData.set('metadata', metadata);
  else if (metadata) formData.set('metadata', JSON.stringify(metadata));
  return new Request('http://localhost/api/dues/remittances/upload', { method: 'POST', body: formData });
}

const validMeta = { employerId: EMPLOYER_ID, periodStart: '2026-01-01', periodEnd: '2026-01-31' };
const csv = () => new File(['a,b\n1,2'], 'upload.csv', { type: 'text/csv' });
const ctx = (req: Request, organizationId = 'org_1') => ({ request: req, organizationId, userId: 'u1' });

describe('dues/remittances/upload route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.existing = [];
    m.withApi.mockImplementation((_cfg: unknown, handler: (c: any) => Promise<unknown>) => (c: any) => handler(c));
    m.db.select.mockReturnValue({
      from: () => ({ where: () => ({ limit: async () => m.existing }) }),
    });
    m.insertValues.mockImplementation((values: Record<string, unknown>) => ({
      returning: async () => [{ id: 'rem_1', ...values }],
    }));
    m.db.insert.mockReturnValue({ values: m.insertValues });
    m.putBlob.mockResolvedValue({ pathname: 'remittances/org_1/stored.csv' });
    m.deleteBlob.mockResolvedValue(undefined);
    m.buildUnionEvidencePack.mockResolvedValue(undefined);
  });

  it('is restricted to the financial allow-list, not a minimum role level', async () => {
    vi.resetModules();
    await loadRoute();
    const config = m.withApi.mock.calls[0][0] as { auth: { roles?: string[]; minRole?: string } };
    expect(config.auth.roles).toEqual(['secretary_treasurer']);
    expect(config.auth.minRole).toBeUndefined();
  });

  it('preserves the original bytes and records hash, stored path and an unparsed state', async () => {
    const file = csv();
    const expectedHash = createHash('sha256').update(Buffer.from('a,b\n1,2')).digest('hex');

    const { POST } = await loadRoute();
    const result: any = await POST(ctx(request(file, validMeta)));

    expect(m.putBlob).toHaveBeenCalledTimes(1);
    const [path, bytes] = m.putBlob.mock.calls[0];
    expect(path).toContain(`remittances/org_1/${expectedHash}`);
    expect((bytes as Buffer).toString()).toBe('a,b\n1,2');

    expect(m.insertValues).toHaveBeenCalledWith(
      expect.objectContaining({
        fileHash: expectedHash,
        fileUrl: 'remittances/org_1/stored.csv',
        processingStatus: 'pending',
        organizationId: 'org_1',
      }),
    );
    expect(result.ingestion).toEqual({
      state: 'SOURCE_PRESERVED_UNPARSED',
      parsed: false,
      matched: false,
      reconciled: false,
      totalsArePlaceholders: true,
    });
    expect(result.remittance.processingStatus).toBe('pending');
  });

  it('creates no record and reports failure when source preservation fails', async () => {
    m.putBlob.mockRejectedValueOnce(new Error('storage down'));
    const { POST } = await loadRoute();

    await expect(POST(ctx(request(csv(), validMeta)))).rejects.toThrow('nothing was recorded');
    expect(m.db.insert).not.toHaveBeenCalled();
  });

  it('removes the preserved bytes if the record insert fails', async () => {
    m.insertValues.mockReturnValueOnce({ returning: async () => { throw new Error('db down'); } });
    const { POST } = await loadRoute();

    await expect(POST(ctx(request(csv(), validMeta)))).rejects.toThrow('db down');
    expect(m.deleteBlob).toHaveBeenCalledWith('remittances/org_1/stored.csv');
  });

  it('rejects a duplicate file for the same organization without storing it again', async () => {
    m.existing = [{ id: 'rem_existing' }];
    const { POST } = await loadRoute();

    await expect(POST(ctx(request(csv(), validMeta)))).rejects.toThrow('already been uploaded');
    expect(m.putBlob).not.toHaveBeenCalled();
    expect(m.db.insert).not.toHaveBeenCalled();
  });

  it('rejects empty, unsupported-type and invalid-period uploads', async () => {
    const { POST } = await loadRoute();
    await expect(POST(ctx(request(new File([], 'empty.csv'), validMeta)))).rejects.toThrow('empty');
    await expect(POST(ctx(request(new File(['x'], 'run.exe'), validMeta)))).rejects.toThrow('CSV, XLSX or PDF');
    await expect(
      POST(ctx(request(csv(), { ...validMeta, periodStart: '2026-02-01', periodEnd: '2026-01-01' }))),
    ).rejects.toThrow('periodEnd on or after periodStart');
    await expect(POST(ctx(request(csv(), { ...validMeta, employerId: 'emp_1' })))).rejects.toThrow('valid UUID');
    expect(m.putBlob).not.toHaveBeenCalled();
  });

  it('throws when organization context is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST(ctx(request(csv(), validMeta), ''))).rejects.toThrow('Organization context required');
  });

  it('throws when file is missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST(ctx(request(null, validMeta)))).rejects.toThrow('No file provided');
  });

  it('throws when metadata JSON is invalid', async () => {
    const { POST } = await loadRoute();
    await expect(POST(ctx(request(csv(), '{broken json')))).rejects.toThrow('Invalid metadata JSON');
  });

  it('throws when employerId is missing from metadata', async () => {
    const { POST } = await loadRoute();
    await expect(
      POST(ctx(request(csv(), { periodStart: '2026-01-01', periodEnd: '2026-01-31' }))),
    ).rejects.toThrow('employerId is required in metadata');
  });

  it('throws when period range fields are missing', async () => {
    const { POST } = await loadRoute();
    await expect(POST(ctx(request(csv(), { employerId: EMPLOYER_ID })))).rejects.toThrow(
      'periodStart and periodEnd are required in metadata',
    );
  });

  it('logs warning if evidence pack creation fails', async () => {
    m.buildUnionEvidencePack.mockRejectedValueOnce(new Error('evidence failure'));
    const { POST } = await loadRoute();
    const result: any = await POST(ctx(request(csv(), validMeta)));
    await Promise.resolve();

    expect(result.remittance.id).toBe('rem_1');
    expect(m.logger.warn).toHaveBeenCalled();
  });
});
