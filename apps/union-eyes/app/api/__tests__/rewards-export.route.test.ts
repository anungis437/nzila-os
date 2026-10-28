import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  hasMinRole: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  withRLSContext: vi.fn(),
  persistAtomicAudit: vi.fn(),
  executeQueue: [] as unknown[][],
}));

const mockTx = {
  execute: vi.fn(async () => (m.executeQueue.shift() ?? []) as unknown[]),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: m.persistAtomicAudit }));

async function loadRoute() {
  return import('../rewards/export/route');
}

const request = (type?: string) =>
  new NextRequest(`http://localhost/api/rewards/export${type ? `?type=${type}` : ''}`);

describe('rewards/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.executeQueue = [];
    m.auth.mockResolvedValue({ userId: 'admin-1', orgId: 'org_1' });
    m.hasMinRole.mockResolvedValue(true);
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.persistAtomicAudit.mockResolvedValue(undefined);
    m.withRLSContext.mockImplementation(
      async (_ctx: unknown, fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
  });

  it('returns 401 when unauthenticated and reads nothing', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null, orgId: null });

    const response = await GET(request());
    expect(response.status).toBe(401);
    expect(m.withRLSContext).not.toHaveBeenCalled();
  });

  it('refuses a member: 403, no organization lookup, no query, no audit, no file', async () => {
    const { GET } = await loadRoute();
    m.hasMinRole.mockResolvedValue(false);

    for (const type of ['awards', 'ledger', 'budgets']) {
      const response = await GET(request(type));
      expect(response.status, type).toBe(403);
      expect(response.headers.get('content-type') ?? '').not.toContain('text/csv');
    }
    expect(m.hasMinRole).toHaveBeenCalledWith('admin');
    expect(m.getOrganizationIdForUser).not.toHaveBeenCalled();
    expect(m.withRLSContext).not.toHaveBeenCalled();
    expect(mockTx.execute).not.toHaveBeenCalled();
    expect(m.persistAtomicAudit).not.toHaveBeenCalled();
  });

  it('returns 400 for an invalid export type', async () => {
    const { GET } = await loadRoute();
    const response = await GET(request('unknown'));
    expect(response.status).toBe(400);
    expect(mockTx.execute).not.toHaveBeenCalled();
  });

  it('exports awards CSV for an administrator and audits the export in the same transaction', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([
      {
        id: 'a1', created_at: '2026-01-01', status: 'issued', reason: 'great work',
        recipient_user_id: 'u2', issuer_user_id: 'u1', award_type: 'Spot',
        default_credit_amount: 10, program_name: 'Core',
      },
    ]);

    const response = await GET(request('awards'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    expect(response.headers.get('cache-control')).toBe('no-store');
    const csv = await response.text();
    expect(csv).toContain('award_type');
    expect(csv).toContain('Spot');
    expect(m.persistAtomicAudit).toHaveBeenCalledTimes(1);
    expect(m.persistAtomicAudit).toHaveBeenCalledWith(
      mockTx,
      expect.objectContaining({
        organizationId: 'org_1',
        userId: 'admin-1',
        action: 'rewards.export',
        details: expect.objectContaining({ type: 'awards', rowCount: 1 }),
      }),
    );
  });

  it('withholds the file when the mandatory audit cannot be written', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([{ id: 'l1', created_at: '2026-01-01', user_id: 'u2', event_type: 'credit', amount_credits: 5, balance_after: 20, source_type: 'award', memo: 'x' }]);
    m.persistAtomicAudit.mockRejectedValueOnce(new Error('audit down'));

    await expect(GET(request('ledger'))).rejects.toThrow('audit down');
  });

  it('exports ledger and budget CSV', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([
      { id: 'l1', created_at: '2026-01-01', user_id: 'u2', event_type: 'credit', amount_credits: 5, balance_after: 20, source_type: 'award', memo: 'test' },
    ]);
    expect(await (await GET(request('ledger'))).text()).toContain('event_type');

    m.executeQueue.push([
      { id: 'b1', name: 'Q1', scope_type: 'org', period: 'quarter', amount_limit: 100, amount_used: 40, starts_at: '2026-01-01', ends_at: '2026-03-31', program_name: 'Core' },
    ]);
    const budgets = await (await GET(request('budgets'))).text();
    expect(budgets).toContain('amount_limit');
    expect(budgets).toContain('Q1');
  });

  it('neutralises spreadsheet formulas in exported text but leaves real numbers alone', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([
      { id: 'a1', created_at: '2026-01-01', status: 'issued', reason: '=HYPERLINK("http://evil.example","x")', recipient_user_id: '+1555', issuer_user_id: '@cmd', award_type: '-2+3', default_credit_amount: -5, program_name: 'Core' },
    ]);

    const csv = await (await GET(request('awards'))).text();
    const body = csv.split('\n')[1];
    expect(body).toContain(`"'=HYPERLINK(""http://evil.example"",""x"")"`);
    expect(body).toContain("'+1555");
    expect(body).toContain("'@cmd");
    expect(body).toContain("'-2+3");
    expect(body).toContain(',-5,');
  });

  it('bounds every query', async () => {
    const { GET } = await loadRoute();
    const seen: string[] = [];
    mockTx.execute.mockImplementation(async (query: unknown) => {
      seen.push(JSON.stringify(query));
      return [];
    });
    for (const type of ['awards', 'ledger', 'budgets']) await GET(request(type));
    expect(seen).toHaveLength(3);
    for (const q of seen) expect(q).toContain('LIMIT');
    mockTx.execute.mockImplementation(async () => (m.executeQueue.shift() ?? []) as unknown[]);
  });
});
