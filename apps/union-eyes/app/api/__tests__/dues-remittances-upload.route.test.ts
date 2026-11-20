import { beforeEach, describe, expect, it, vi } from 'vitest';
import { ErrorCode } from '@/lib/api/errors';

const REFUSAL = {
  status: 501,
  code: ErrorCode.NOT_IMPLEMENTED,
  message: 'Finance and dues persistence are not available in this release.',
};

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
  requireLiveFinancialMandate: vi.fn(),
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
const audit = vi.hoisted(() => ({ tx: vi.fn() }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (...args: unknown[]) => (args[args.length - 1] as (tx: unknown) => Promise<unknown>)(m.db),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: audit.tx }));
vi.mock('@/db', () => ({ db: m.db }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn() }));
vi.mock('@/db/schema/dues-finance-schema', () => ({
  employerRemittances: { id: 'id', organizationId: 'organizationId', fileHash: 'fileHash' },
}));
vi.mock('@/lib/logger', () => ({ logger: m.logger }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: m.buildUnionEvidencePack }));
vi.mock('@/lib/blob-client', () => ({ putBlob: m.putBlob, deleteBlob: m.deleteBlob }));
vi.mock('@/lib/finance/require-live-financial-mandate', () => ({
  requireLiveFinancialMandate: m.requireLiveFinancialMandate,
}));

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
    audit.tx.mockResolvedValue(undefined);
    m.requireLiveFinancialMandate.mockResolvedValue(undefined);
  });

  it('is restricted to the financial allow-list, not a minimum role level', async () => {
    vi.resetModules();
    await loadRoute();
    const config = m.withApi.mock.calls[0][0] as { auth: { roles?: string[]; minRole?: string } };
    expect(config.auth.roles).toEqual(['secretary_treasurer']);
    expect(config.auth.minRole).toBeUndefined();
  });

  const expectNothingDone = () => {
    expect(m.requireLiveFinancialMandate).not.toHaveBeenCalled();
    expect(m.db.select).not.toHaveBeenCalled();
    expect(m.putBlob).not.toHaveBeenCalled();
    expect(m.deleteBlob).not.toHaveBeenCalled();
    expect(m.db.insert).not.toHaveBeenCalled();
    expect(m.insertValues).not.toHaveBeenCalled();
    expect(audit.tx).not.toHaveBeenCalled();
    expect(m.buildUnionEvidencePack).not.toHaveBeenCalled();
  };

  it('refuses a valid upload with 501 before preserving bytes, checking a mandate, or recording anything', async () => {
    const { POST } = await loadRoute();
    await expect(POST(ctx(request(csv(), validMeta)))).rejects.toMatchObject(REFUSAL);
    expectNothingDone();
  });

  it.each([
    ['a file that is a duplicate of one already recorded', () => { m.existing = [{ id: 'rem_existing' }]; }],
    ['storage that would fail', () => m.putBlob.mockRejectedValue(new Error('storage down'))],
    ['a record insert that would fail', () => m.insertValues.mockReturnValue({ returning: async () => { throw new Error('db down'); } })],
    ['an audit that would fail', () => audit.tx.mockRejectedValue(new Error('audit down'))],
    ['an evidence pack that would fail', () => m.buildUnionEvidencePack.mockRejectedValue(new Error('evidence failure'))],
    ['no financial mandate issued', () => m.requireLiveFinancialMandate.mockRejectedValue(Object.assign(new Error('No financial mandate has been issued in this organization.'), { status: 403 }))],
  ])('answers 501 for %s, because none of that work is reached', async (_label, arrange) => {
    arrange();
    const { POST } = await loadRoute();
    await expect(POST(ctx(request(csv(), validMeta)))).rejects.toMatchObject(REFUSAL);
    expectNothingDone();
    expect(m.logger.warn).not.toHaveBeenCalled();
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
});
