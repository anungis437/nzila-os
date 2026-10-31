import { beforeEach, describe, expect, it, vi } from 'vitest';

// The producer of the location the attach route accepts (DEF-0B7-EXC-DOCUMENT-ATTACH-ACCEPTS-ANY-URL-ON-SHARED-HOST-OR-LOCALHOST).
const m = vi.hoisted(() => ({
  interview: [] as Array<Record<string, unknown>>,
  uploadBuffer: vi.fn(),
  deleteBlob: vi.fn(),
  scan: vi.fn(),
  audit: vi.fn(),
  insertFails: false,
  inserted: [] as Array<Record<string, unknown>>,
}));

vi.mock('@/lib/api/framework', () => ({
  withApi: (_cfg: unknown, handler: (ctx: unknown) => Promise<unknown>) => (ctx: unknown) => handler(ctx),
  ApiError: {
    forbidden: (message: string) => Object.assign(new Error(message), { status: 403 }),
    badRequest: (message: string) => Object.assign(new Error(message), { status: 400 }),
    notFound: (message: string) => Object.assign(new Error(message), { status: 404 }),
    conflict: (message: string) => Object.assign(new Error(message), { status: 409 }),
    externalService: (_s: string, message: string) => Object.assign(new Error(message), { status: 502 }),
  },
}));
vi.mock('@/db/db', () => ({ db: { select: () => ({ from: () => ({ where: () => ({ limit: async () => m.interview }) }) }) } }));
vi.mock('drizzle-orm', () => ({ and: vi.fn(), eq: vi.fn() }));
vi.mock('@/db/schema', () => ({ exitInterviews: { id: 'id', createdBy: 'createdBy', status: 'status', organizationId: 'organizationId' }, exitInterviewDocuments: {} }));
vi.mock('@/lib/db/with-rls-context', () => ({
  withRLSContext: async (_c: unknown, fn: (tx: unknown) => Promise<unknown>) =>
    fn({ insert: () => ({ values: (row: Record<string, unknown>) => ({ returning: async () => { if (m.insertFails) throw new Error('db down'); m.inserted.push(row); return [{ id: 'doc-1', ...row }]; } }) }) }),
}));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.audit }));
vi.mock('@/lib/api-auth-guard', () => ({ ROLE_HIERARCHY: { member: 1, steward: 2 }, normalizeRole: (r: string) => r }));
vi.mock('@/lib/blob-client', () => ({
  uploadBuffer: m.uploadBuffer,
  deleteBlob: m.deleteBlob,
  container: () => ({ getBlockBlobClient: (path: string) => ({ url: `https://nzilacanadastore.blob.core.windows.net/union-eyes/${path}?sig=should-be-dropped` }) }),
}));
vi.mock('@/lib/security/clamav', () => ({ assertBufferSafeForUpload: m.scan }));

const ORG = '11111111-1111-4111-8111-111111111111';
const INTERVIEW = '33333333-3333-4333-8333-333333333333';
const ctx = (over: Record<string, unknown> = {}, file: File | null = new File(['hello'], 'Notes 1.pdf', { type: 'application/pdf' })) => {
  const form = new FormData();
  if (file) form.append('file', file);
  form.append('title', 'Interview notes');
  return { organizationId: ORG, userId: 'steward-1', user: { role: 'steward' }, params: { id: INTERVIEW }, request: { formData: async () => form }, ...over };
};
const run = async (c: unknown) => (await import('../exit-interviews/[id]/documents/upload/route')).POST(c as never) as Promise<{ data: Record<string, unknown> }>;

describe('exit-interviews/[id]/documents/upload', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.interview = [{ id: INTERVIEW, createdBy: 'someone', status: 'draft' }];
    m.insertFails = false;
    m.inserted.length = 0;
    m.scan.mockResolvedValue({ clean: true });
    m.uploadBuffer.mockImplementation(async (o: { blobPath: string; buffer: Buffer }) => ({ blobPath: o.blobPath, sha256: 'abc', sizeBytes: o.buffer.length }));
    m.audit.mockResolvedValue(undefined);
    m.deleteBlob.mockResolvedValue(undefined);
  });

  it('stores the file in the organization area, registers the unsigned location and audits it', async () => {
    const result = await run(ctx());
    const stored = m.uploadBuffer.mock.calls[0][0] as { blobPath: string };
    expect(stored.blobPath).toMatch(new RegExp(`^interviews/${ORG}/${INTERVIEW}/[0-9a-f]{16}-Notes_1.pdf$`));
    expect(m.inserted[0].fileUrl).toBe(`https://nzilacanadastore.blob.core.windows.net/union-eyes/${stored.blobPath}`);
    expect(String(m.inserted[0].fileUrl)).not.toContain('sig=');
    expect(result.data.id).toBe('doc-1');
    expect(m.audit).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({ action: 'exit_interview.document_upload' }));
  });

  it('stores nothing when the malware scan refuses the file', async () => {
    m.scan.mockRejectedValue(new Error('infected'));
    await expect(run(ctx())).rejects.toThrow('infected');
    expect(m.uploadBuffer).not.toHaveBeenCalled();
  });

  it('refuses an unsupported type, a missing file and a published interview, storing nothing', async () => {
    await expect(run(ctx({}, new File(['x'], 'a.exe', { type: 'application/x-msdownload' })))).rejects.toMatchObject({ status: 400 });
    await expect(run(ctx({}, null))).rejects.toMatchObject({ status: 400 });
    m.interview = [{ id: INTERVIEW, createdBy: 'someone', status: 'published' }];
    await expect(run(ctx())).rejects.toMatchObject({ status: 409 });
    expect(m.uploadBuffer).not.toHaveBeenCalled();
  });

  it('refuses a caller below steward who does not own the interview, and an interview of another organization', async () => {
    await expect(run(ctx({ user: { role: 'member' } }))).rejects.toMatchObject({ status: 403 });
    m.interview = [];
    await expect(run(ctx())).rejects.toMatchObject({ status: 404 });
    expect(m.uploadBuffer).not.toHaveBeenCalled();
  });

  it('removes the stored object when its record cannot be written', async () => {
    m.insertFails = true;
    await expect(run(ctx())).rejects.toThrow('db down');
    expect(m.deleteBlob).toHaveBeenCalledWith((m.uploadBuffer.mock.calls[0][0] as { blobPath: string }).blobPath);
  });
});
