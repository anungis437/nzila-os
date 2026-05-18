/**
 * GET /api/members — Cross-org access control tests
 *
 * Verifies that a caller cannot enumerate members of an organisation
 * they do not belong to by supplying a foreign `organizationId` query param.
 *
 * Tier 2 — Core Business Logic / Security
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Hoisted mocks ─────────────────────────────────────────────────────────────

const { mockGetCurrentUser, mockDbSelect, mockAuditDataAccess } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
  mockDbSelect: vi.fn(),
  mockAuditDataAccess: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/api-auth-guard', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/api-auth-guard')>();
  return { ...actual, getCurrentUser: mockGetCurrentUser };
});

vi.mock('@/lib/rate-limiter', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ allowed: true }),
  createRateLimitHeaders: vi.fn(() => ({})),
}));

vi.mock('@/services/platform-economics/entitlement-guard', () => ({
  requireEntitlement: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

vi.mock('@/lib/audit-logger', () => ({ auditDataAccess: mockAuditDataAccess }));

// Mock the DB — each test configures select() return values as needed.
vi.mock('@/db/db', () => ({
  db: {
    select: mockDbSelect,
  },
}));

// ── Import the route under test ───────────────────────────────────────────────

import { GET } from '../route';

// ── Test fixtures ─────────────────────────────────────────────────────────────

const CALLER_ORG = 'org-abc-123';
const FOREIGN_ORG = 'org-xyz-999';
const CALLER_USER_ID = 'user-caller-001';

/** Minimal AuthUser for a regular member caller */
const regularMember = {
  id: CALLER_USER_ID,
  organizationId: CALLER_ORG,
  role: 'member',
  roles: ['member'],
};

/** Minimal AuthUser for a system admin */
const systemAdmin = {
  id: 'user-admin-999',
  organizationId: CALLER_ORG,
  role: 'system_admin',
  roles: ['system_admin'],
};

function makeRequest(params: Record<string, string>) {
  const url = new URL('http://localhost:3000/api/members');
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  return new NextRequest(url);
}

/**
 * Build a chainable drizzle-style mock:
 * db.select().from().where().limit() → resolves to `rows`
 */
function buildSelectChain(rows: unknown[]) {
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    offset: vi.fn().mockResolvedValue(rows),
  };
  chain.limit.mockResolvedValue(rows);
  mockDbSelect.mockReturnValue(chain);
  return chain;
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('GET /api/members — cross-org access control', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when a regular member requests a foreign org they do not belong to', async () => {
    mockGetCurrentUser.mockResolvedValue(regularMember);

    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      // Membership check for foreign org returns empty → no access
      limit: vi.fn().mockResolvedValue([]),
      offset: vi.fn().mockResolvedValue([]),
    }));

    const req = makeRequest({ organizationId: FOREIGN_ORG });
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error).toBe('Forbidden');
  });

  it('allows access when a regular member requests their own org', async () => {
    mockGetCurrentUser.mockResolvedValue(regularMember);

    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([{ id: 'm1' }]),
      offset: vi.fn().mockResolvedValue([{
        id: 'm1', name: 'Alice', email: 'a@test.com',
        role: 'member', status: 'active', metadata: null,
        phone: null, department: null, position: null,
        hireDate: null, seniority: 0, membershipNumber: null,
        unionJoinDate: null, createdAt: null, deletedAt: null,
        organizationId: CALLER_ORG, userId: CALLER_USER_ID,
      }]),
    }));

    const req = makeRequest({ organizationId: CALLER_ORG });
    const res = await GET(req, { params: {} });

    expect(res.status).not.toBe(403);
  });

  it('allows a system admin to access a foreign org without a membership check', async () => {
    mockGetCurrentUser.mockResolvedValue(systemAdmin);

    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
      offset: vi.fn().mockResolvedValue([]),
    }));

    const req = makeRequest({ organizationId: FOREIGN_ORG });
    const res = await GET(req, { params: {} });

    expect(res.status).not.toBe(403);
  });

  it('returns 403 when a steward in org-a requests org-b', async () => {
    const memberOfOrgA = { ...regularMember, organizationId: 'org-a', role: 'steward' };
    mockGetCurrentUser.mockResolvedValue(memberOfOrgA);

    mockDbSelect.mockImplementation(() => ({
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      // Membership check for org-b returns empty
      limit: vi.fn().mockResolvedValue([]),
      offset: vi.fn().mockResolvedValue([]),
    }));

    const req = makeRequest({ organizationId: 'org-b' });
    const res = await GET(req, { params: {} });

    expect(res.status).toBe(403);
  });
});
