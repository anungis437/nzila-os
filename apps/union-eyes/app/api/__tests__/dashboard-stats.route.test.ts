import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({
  withApi: vi.fn(),
  getCaseActor: vi.fn(),
  caseReadScope: vi.fn(() => 'READ_SCOPE'),
  withRLSContext: vi.fn(),
  execute: vi.fn(),
  queries: [] as unknown[],
  batch:vi.fn(),
}));

class FakeApiError extends Error {
  constructor(public readonly kind: string) { super(kind); }
  static internal(message?: string) { return new FakeApiError(`internal:${message}`); }
}

vi.mock('@/lib/authority/store/route-adapter',()=>({decideCaseCapabilitiesBatch:m.batch}));
vi.mock('@/lib/api/framework', () => ({ withApi: m.withApi, ApiError: FakeApiError }));
vi.mock('@/lib/cases/case-authorization', () => ({ getCaseActor: m.getCaseActor, caseReadScope: m.caseReadScope }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('drizzle-orm', async (importOriginal) => {
  const actual = await importOriginal<typeof import('drizzle-orm')>();
  return { ...actual, sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ text: strings.join('?'), values }) };
});

const load = () => import('../dashboard/stats/route');

describe('GET /api/dashboard/stats (R-24)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.queries.length = 0;
    m.batch.mockImplementation(async(_tx,input)=>new Map(input.caseIds.map((id:string)=>[id,{'case:read':{effect:id==='denied'?'deny':'allow'}}])));
    m.withApi.mockImplementation((_cfg: unknown, handler: () => Promise<unknown>) => () => handler());
    m.execute.mockImplementation(async (query: { text: string }) => {
      m.queries.push(query);
      return query.text.includes('organization_members') ? [{ activeMembers: 9 }] : [{claimId:'a',status:'submitted',priority:'high'},{claimId:'b',status:'investigation',priority:'medium'},{claimId:'c',status:'resolved',priority:'medium'},{claimId:'d',status:'closed',priority:'medium'},{claimId:'e',status:'resolved',priority:'medium'},{claimId:'denied',status:'submitted',priority:'high'}];
    });
    m.withRLSContext.mockImplementation(async (_ctx: unknown, fn: (db: { execute: typeof m.execute }) => Promise<unknown>) => fn({ execute: m.execute }));
  });

  it('counts only cases inside the caller’s kernel read scope', async () => {
    m.getCaseActor.mockResolvedValue({ userId: 'u1', organizationId: 'org-1', role: 'steward' });
    const { GET } = await load();
    const response = (await GET()) as Response;
    expect(m.caseReadScope).toHaveBeenCalledWith(expect.objectContaining({ userId: 'u1' }), 'c');
    const claimsQuery = m.queries.find((q) => (q as { text: string }).text.includes('FROM claims')) as { values: unknown[] };
    expect(claimsQuery.values).toContain('READ_SCOPE');
    expect(await response.json()).toEqual({ activeClaims: 2, pendingReviews: 1, resolvedCases: 3, highPriorityClaims: 1, activeMembers: 9 });
  });

  it('withholds the organization member count from an ordinary member, as null and not as zero', async () => {
    m.getCaseActor.mockResolvedValue({ userId: 'u1', organizationId: 'org-1', role: 'member' });
    const { GET } = await load();
    const body = await ((await GET()) as Response).json();
    expect(body.activeMembers).toBeNull();
    expect(m.queries.some((q) => (q as { text: string }).text.includes('organization_members'))).toBe(false);
  });

  it('does not accept a client organization: the scope comes from the resolved actor', async () => {
    m.getCaseActor.mockResolvedValue({ userId: 'u1', organizationId: 'org-1', role: 'steward' });
    const { GET } = await load();
    await GET();
    expect(m.withRLSContext).toHaveBeenCalledWith({ organizationId: 'org-1' }, expect.any(Function));
  });

  it('a failed query is an error, never zeros', async () => {
    m.getCaseActor.mockResolvedValue({ userId: 'u1', organizationId: 'org-1', role: 'steward' });
    m.withRLSContext.mockRejectedValue(new Error('connection lost'));
    const { GET } = await load();
    await expect(GET()).rejects.toMatchObject({ kind: expect.stringContaining('internal') });
  });

  it('does not report zero counts when canonical fact loading is unavailable',async()=>{
    m.getCaseActor.mockResolvedValue({userId:'u1',organizationId:'org-1',role:'member'});
    m.batch.mockRejectedValue(new Error('authority unavailable'));
    const {GET}=await load();await expect(GET()).rejects.toMatchObject({kind:expect.stringContaining('internal')});
  });

  it('propagates a refusal for an identity with no case authority (platform roles)', async () => {
    m.getCaseActor.mockRejectedValue(new FakeApiError('forbidden'));
    const { GET } = await load();
    await expect(GET()).rejects.toMatchObject({ kind: 'forbidden' });
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });
});
