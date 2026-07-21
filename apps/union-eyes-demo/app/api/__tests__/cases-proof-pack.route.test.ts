import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getDemoCaseFromDb: vi.fn(),
  listDecisionsForCase: vi.fn(),
  readdir: vi.fn(),
  stat: vi.fn(),
  readFile: vi.fn(),
}));

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/demo/server/cupe4373-cases-repo', () => ({ getDemoCaseFromDb: m.getDemoCaseFromDb }));
vi.mock('@/lib/demo/server/cupe4373-governance', () => ({ listDecisionsForCase: m.listDecisionsForCase }));
vi.mock('@/lib/dashboard/role-experience', () => ({ isCupe4373DemoRuntime: () => true }));
vi.mock('node:fs/promises', () => ({
  readdir: m.readdir,
  stat: m.stat,
  readFile: m.readFile,
}));

async function loadRoute() {
  return import('../cases/[caseId]/(demo)/proof-pack/route');
}

describe('cases/[caseId]/proof-pack route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.auth.mockResolvedValue({ userId: 'user_1' });
    m.getDemoCaseFromDb.mockResolvedValue({ id: 'case_1', title: 'Demo case' });
    m.listDecisionsForCase.mockResolvedValue([{ id: 'dec_1' }]);
    m.readdir.mockRejectedValue(new Error('no dir'));
  });

  it('returns 401 for unauthenticated requests', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null });

    const response = await GET(new Request('http://localhost/api/cases/case_1/proof-pack'), {
      params: Promise.resolve({ caseId: 'case_1' }),
    });

    expect(response.status).toBe(401);
    await expect(response.json()).resolves.toMatchObject({ error: 'UNAUTHENTICATED' });
  });

  it('returns 404 when case is not found', async () => {
    const { GET } = await loadRoute();
    m.getDemoCaseFromDb.mockResolvedValueOnce(null);

    const response = await GET(new Request('http://localhost/api/cases/missing/proof-pack'), {
      params: Promise.resolve({ caseId: 'missing' }),
    });

    expect(response.status).toBe(404);
    await expect(response.json()).resolves.toMatchObject({ error: 'CASE_NOT_FOUND' });
  });

  it('returns zipped proof pack with expected headers on success', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new Request('http://localhost/api/cases/case_1/proof-pack'), {
      params: Promise.resolve({ caseId: 'case_1' }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toBe('application/zip');
    expect(response.headers.get('content-disposition')).toContain('case_1-proof-pack.zip');
    expect(response.headers.get('x-proof-pack-manifest-sha256')).toBeTruthy();
    const bytes = await response.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(0);
  });

  it('includes artifact files linked to the case and skips malformed ones', async () => {
    const { GET } = await loadRoute();
    m.readdir.mockResolvedValueOnce(['good.json', 'bad.json', 'other.txt']);
    m.stat.mockResolvedValue({ isFile: () => true });
    m.readFile
      .mockResolvedValueOnce(Buffer.from(JSON.stringify({ linkedCase: { id: 'case_1' }, hello: 'world' })))
      .mockResolvedValueOnce(Buffer.from('{ malformed json'));

    const response = await GET(new Request('http://localhost/api/cases/case_1/proof-pack'), {
      params: Promise.resolve({ caseId: 'case_1' }),
    });

    expect(response.status).toBe(200);
    const bytes = await response.arrayBuffer();
    expect(bytes.byteLength).toBeGreaterThan(0);
  });
});
