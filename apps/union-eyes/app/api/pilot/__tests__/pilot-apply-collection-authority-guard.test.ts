import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { NextRequest, NextResponse } from 'next/server';

const APP_ROOT = resolve(__dirname, '..', '..', '..', '..');

// PR #752 round 17: pilot_applications has no organizationId column (orgScoped
// can never filter it) and its rows are sensitive prospective-customer intake
// data (contact info, member counts, internal challenges/goals) spanning every
// organization on the platform, not the caller's own org. The collection GET
// (crudRoutes) previously used readRole: 'steward' — an ordinary per-org role
// tier — letting any steward at any org enumerate every other org's pilot
// applications. It must require the same system_admin-or-higher tier that
// lib/pilot/pilot-ownership.ts already established for the per-item routes.
describe('pilot/apply collection route requires platform-tier read authority', () => {
  it('never uses an ordinary org-scoped readRole for the pilot_applications list', () => {
    const src = readFileSync(resolve(APP_ROOT, 'app/api/pilot/apply/route.ts'), 'utf8');
    expect(src).not.toMatch(/readRole:\s*['"](member|steward|officer|chief_steward|admin|president)['"]/);
    expect(src).toMatch(/readRole:\s*['"]system_admin['"]/);
  });
});

/* ── round 19: runtime proof of authorize-before-elevate + public POST governance ── */

const m = vi.hoisted(() => ({
  hasMinRole: vi.fn(),
  withSystemContext: vi.fn(),
  listHandler: vi.fn(),
  rateLimit: vi.fn(),
  dbInsert: vi.fn(),
}));

vi.mock('@/lib/api-auth-guard', () => ({ hasMinRole: m.hasMinRole }));
vi.mock('@/lib/db/with-rls-context', () => ({ withSystemContext: m.withSystemContext }));
vi.mock('@/lib/api/crud-factory', () => ({ crudRoutes: () => ({ GET: m.listHandler }) }));
vi.mock('@/lib/rate-limit', () => ({ rateLimit: m.rateLimit }));
vi.mock('@/lib/logger', () => ({ logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() } }));
vi.mock('@/lib/services/crm-service', () => ({ upsertContact: vi.fn(async () => null), createDeal: vi.fn(async () => undefined) }));
vi.mock('@/db', () => ({
  db: { insert: m.dbInsert },
}));

async function loadRoute() {
  return import('../apply/route');
}

describe('pilot/apply collection route — runtime authorize-before-elevate (PR #752 round 19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.listHandler.mockResolvedValue(NextResponse.json({ items: [] }));
    m.withSystemContext.mockImplementation(async (fn: (tx?: unknown) => Promise<unknown>) => fn());
    m.rateLimit.mockReturnValue({ success: true, remaining: 4, resetAt: Date.now() + 1000 });
  });

  it('GET rejects an under-authorized caller WITHOUT ever elevating to the system connection', async () => {
    m.hasMinRole.mockResolvedValue(false);
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply'));

    expect(response.status).toBe(403);
    expect(m.withSystemContext).not.toHaveBeenCalled();
    expect(m.listHandler).not.toHaveBeenCalled();
  });

  it('GET elevates to the system connection only after authorization succeeds', async () => {
    m.hasMinRole.mockResolvedValue(true);
    const { GET } = await loadRoute();

    const response = await GET(new NextRequest('http://localhost/api/pilot/apply'));

    expect(response.status).toBe(200);
    expect(m.withSystemContext).toHaveBeenCalledTimes(1);
    expect(m.listHandler).toHaveBeenCalledTimes(1);
  });
});

describe('pilot/apply collection route POST — public intake governance (PR #752 round 19)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    m.rateLimit.mockReturnValue({ success: true, remaining: 4, resetAt: Date.now() + 1000 });
    m.dbInsert.mockReturnValue({
      values: vi.fn(() => ({
        returning: vi.fn(async () => [{ id: 'pilot-1' }]),
      })),
    });
  });

  it('returns 429 when the per-IP rate limit is exceeded, without touching the database', async () => {
    m.rateLimit.mockReturnValue({ success: false, remaining: 0, resetAt: Date.now() + 1000 });
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply', {
      method: 'POST',
      body: JSON.stringify({ organizationName: 'Local 1', contactName: 'A B', contactEmail: 'a@b.com' }),
    }));

    expect(response.status).toBe(429);
    expect(m.dbInsert).not.toHaveBeenCalled();
  });

  it('returns 400 with validation details for a malformed body', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply', {
      method: 'POST',
      body: JSON.stringify({ contactEmail: 'not-an-email' }),
    }));

    expect(response.status).toBe(400);
    expect(m.dbInsert).not.toHaveBeenCalled();
  });

  it('accepts a well-formed body and creates the pilot application', async () => {
    const { POST } = await loadRoute();

    const response = await POST(new NextRequest('http://localhost/api/pilot/apply', {
      method: 'POST',
      body: JSON.stringify({
        organizationName: 'Local 1',
        contactName: 'Ash Bee',
        contactEmail: 'ash@example.com',
        memberCount: 100,
      }),
    }));

    expect(response.status).toBe(201);
    expect(m.dbInsert).toHaveBeenCalled();
  });

  it('never trusts a client-supplied responses.organizationId as anything other than passthrough intake data', async () => {
    const { POST } = await loadRoute();
    const valuesSpy = vi.fn(() => ({ returning: vi.fn(async () => [{ id: 'pilot-2' }]) }));
    m.dbInsert.mockReturnValue({ values: valuesSpy });

    await POST(new NextRequest('http://localhost/api/pilot/apply', {
      method: 'POST',
      body: JSON.stringify({
        organizationName: 'Local 1',
        contactName: 'Ash Bee',
        contactEmail: 'ash@example.com',
        responses: { organizationId: 'attacker-claimed-org' },
      }),
    }));

    // The claimed org id is stored verbatim in the free-form `responses`
    // JSONB blob — this test documents (not merely asserts) that it is
    // ordinary passthrough data at insert time; lib/pilot/pilot-ownership.ts
    // and app/api/pilot/apply/[id]/commercial-transition/route.ts are what
    // treat it as an unverified claim, never as trusted identity.
    expect(valuesSpy).toHaveBeenCalledWith(
      expect.objectContaining({ responses: { organizationId: 'attacker-claimed-org' } }),
    );
  });
});
