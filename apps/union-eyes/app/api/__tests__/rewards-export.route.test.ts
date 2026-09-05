import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

const m = vi.hoisted(() => ({
  auth: vi.fn(),
  getOrganizationIdForUser: vi.fn(),
  withRLSContext: vi.fn(),
  executeQueue: [] as unknown[][],
}));

const mockTx = {
  execute: vi.fn(async () => (m.executeQueue.shift() ?? []) as unknown[]),
};

vi.mock('@nzila/platform-auth/entra/server', () => ({ auth: m.auth }));
vi.mock('@/lib/organization-utils', () => ({ getOrganizationIdForUser: m.getOrganizationIdForUser }));
vi.mock('@/lib/db/with-rls-context', () => ({ withRLSContext: m.withRLSContext }));

async function loadRoute() {
  return import('../rewards/export/route');
}

describe('rewards/export route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.executeQueue = [];
    m.auth.mockResolvedValue({ userId: 'u1', orgId: 'org_1' });
    m.getOrganizationIdForUser.mockResolvedValue('org_1');
    m.withRLSContext.mockImplementation(
      async (_ctx: unknown, fn: (tx: typeof mockTx) => Promise<unknown>) => fn(mockTx),
    );
  });

  it('GET returns 401 when unauthenticated', async () => {
    const { GET } = await loadRoute();
    m.auth.mockResolvedValueOnce({ userId: null, orgId: null });

    const response = await GET(new NextRequest('http://localhost/api/rewards/export'));
    expect(response.status).toBe(401);
  });

  it('GET returns 400 for invalid export type', async () => {
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/rewards/export?type=unknown'));
    expect(response.status).toBe(400);
  });

  it('GET exports awards CSV', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([
      {
        id: 'a1', created_at: '2026-01-01', status: 'issued', reason: 'great work',
        recipient_user_id: 'u2', issuer_user_id: 'u1', award_type: 'Spot',
        default_credit_amount: 10, program_name: 'Core',
      },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/rewards/export?type=awards'));
    expect(response.status).toBe(200);
    expect(response.headers.get('content-type')).toContain('text/csv');
    const csv = await response.text();
    expect(csv).toContain('award_type');
    expect(csv).toContain('Spot');
  });

  it('GET exports ledger CSV', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([
      { id: 'l1', created_at: '2026-01-01', user_id: 'u2', event_type: 'credit', amount_credits: 5, balance_after: 20, source_type: 'award', memo: 'test' },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/rewards/export?type=ledger'));
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain('event_type');
    expect(csv).toContain('credit');
  });

  it('GET exports budgets CSV', async () => {
    const { GET } = await loadRoute();
    m.executeQueue.push([
      { id: 'b1', name: 'Q1', scope_type: 'org', period: 'quarter', amount_limit: 100, amount_used: 40, starts_at: '2026-01-01', ends_at: '2026-03-31', program_name: 'Core' },
    ]);

    const response = await GET(new NextRequest('http://localhost/api/rewards/export?type=budgets'));
    expect(response.status).toBe(200);
    const csv = await response.text();
    expect(csv).toContain('amount_limit');
    expect(csv).toContain('Q1');
  });
});
