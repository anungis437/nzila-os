import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';

/**
 * The Elections screens read /api/elections through lib/api/index.ts. This runs the real routes inside the real withApi
 * wrapper and feeds what they send to that client, so the envelope the client unwraps is the one the routes produce.
 */
const m = vi.hoisted(() => ({
  user: { current: null as null | { id: string; email: string; role: string; organizationId: string } },
  rows: { current: [] as Record<string, unknown>[] },
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: async () => m.user.current };
});
vi.mock('@/lib/rate-limiter', () => ({ checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }), createRateLimitHeaders: vi.fn(() => ({})) }));
vi.mock('@/services/platform-economics/entitlement-guard', () => ({ requireEntitlement: vi.fn().mockResolvedValue(undefined) }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/client-logger', () => ({ createClientLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() }) }));
vi.mock('@/lib/evidence', () => ({ buildUnionEvidencePack: vi.fn(async () => undefined) }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: async (fn: () => Promise<unknown>) => fn() }));
vi.mock('@/lib/audit/atomic-audit', () => ({ persistAtomicAudit: vi.fn(async () => undefined) }));
vi.mock('@/db/schema/governance-schema', () => ({ councilElections: { id: 'id', electionYear: 'electionYear', electionDate: 'electionDate' } }));
vi.mock('drizzle-orm', async (importOriginal) => ({
  ...(await importOriginal<typeof import('drizzle-orm')>()),
  eq: vi.fn(),
  desc: vi.fn(),
}));
vi.mock('@/db', () => ({
  db: {
    select: () => ({
      from: () => {
        const result = Promise.resolve(m.rows.current);
        return Object.assign(result, { orderBy: async () => m.rows.current, where: async () => m.rows.current });
      },
    }),
    insert: () => ({ values: (values: Record<string, unknown>) => ({ returning: async () => [{ id: 'e-new', ...values }] }) }),
  },
}));

import { electionsAPI } from '@/lib/api/index';

const STORED = {
  id: 'c3333333-3333-4333-8333-333333333333',
  electionYear: 2026,
  electionDate: '2026-10-01',
  positionsAvailable: 2,
  candidates: [{ name: 'Ada', union: 'Local 1', platform: 'Fair pay' }],
  winners: [],
  totalVotes: 0,
  participationRate: null,
  verifiedBy: null,
  verificationDate: null,
  contestedResults: false,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
};

/** Serves the client's fetch calls from the real route handlers. */
async function serve(url: string, init?: RequestInit): Promise<Response> {
  const method = (init?.method ?? 'GET').toUpperCase();
  const request = new NextRequest(new URL(url, 'http://localhost'), { method, body: init?.body, headers: init?.headers });
  const path = new URL(request.url).pathname;
  if (path === '/api/elections') {
    const route = await import('../elections/route');
    return (method === 'POST' ? route.POST : route.GET)(request, { params: Promise.resolve({}) });
  }
  const id = path.split('/').pop() as string;
  const route = await import('../elections/[id]/route');
  return route.GET(request, { params: Promise.resolve({ id }) });
}

describe('the elections client against the real /api/elections routes', () => {
  beforeEach(() => {
    m.user.current = { id: 'staff-1', email: 'staff@example.com', role: 'clc_staff', organizationId: 'org-1' };
    m.rows.current = [STORED];
    vi.stubGlobal('fetch', vi.fn(serve));
  });

  it('lists the stored records: the route wraps its own { data } inside the framework envelope', async () => {
    const response = await serve('/api/elections');
    const body = await response.json();
    expect(body).toMatchObject({ success: true, data: { data: [{ id: STORED.id }] } });
    await expect(electionsAPI.list()).resolves.toEqual([expect.objectContaining({ id: STORED.id, electionYear: 2026 })]);
  });

  it('reads one record by id', async () => {
    await expect(electionsAPI.get(STORED.id)).resolves.toMatchObject({ id: STORED.id, positionsAvailable: 2 });
  });

  it('creates a record: the route answers 201 with a bare { data } and fills the defaults itself', async () => {
    const created = await electionsAPI.create({
      electionYear: 2027,
      electionDate: '2027-03-15',
      positionsAvailable: 3,
      candidates: [{ name: 'Rowan', union: 'Local 9', platform: 'Safer worksites' }],
    });
    expect(created).toMatchObject({ id: 'e-new', electionYear: 2027, totalVotes: 0, winners: [] });
  });

  it('is refused for an account that is not platform staff, and the client reports it as a 403', async () => {
    m.user.current = { id: 'member-1', email: 'member@example.com', role: 'member', organizationId: 'org-1' };
    await expect(electionsAPI.list()).rejects.toMatchObject({ status: 403 });
  });
});
