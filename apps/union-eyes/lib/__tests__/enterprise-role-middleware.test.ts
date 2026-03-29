/**
 * Tests for enterprise-role-middleware.ts
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest, NextResponse } from 'next/server';

const mocks = vi.hoisted(() => ({
  mockGetMemberRoles: vi.fn(),
  mockGetMemberHighestRoleLevel: vi.fn(),
  mockGetMemberEffectivePermissions: vi.fn(),
  mockLogPermissionCheck: vi.fn(),
  mockIncrementExceptionUsage: vi.fn(),
  mockWithOrgAuth: vi.fn(),
}));

vi.mock('../organization-middleware', () => ({
  withOrganizationAuth: vi.fn((handler: Function) => {
    // Return a function that when called, calls handler with mock context
    return async (req: NextRequest) => {
      const ctx = mocks.mockWithOrgAuth();
      return handler(req, ctx);
    };
  }),
}));

vi.mock('@/db/queries/enhanced-rbac-queries', () => ({
  getMemberRoles: mocks.mockGetMemberRoles,
  getMemberHighestRoleLevel: mocks.mockGetMemberHighestRoleLevel,
  getMemberEffectivePermissions: mocks.mockGetMemberEffectivePermissions,
  logPermissionCheck: mocks.mockLogPermissionCheck,
  incrementExceptionUsage: mocks.mockIncrementExceptionUsage,
}));

vi.mock('../logger', () => ({
  logger: { info: vi.fn(), error: vi.fn(), warn: vi.fn(), debug: vi.fn() },
}));

import { withEnhancedRoleAuth } from '../enterprise-role-middleware';

describe('enterprise-role-middleware', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns 403 when no memberId in context', async () => {
    mocks.mockWithOrgAuth.mockReturnValue({
      organizationId: 'org-1',
      userId: 'user-1',
      memberId: null,
    });

    const handler = vi.fn();
    const wrapped = withEnhancedRoleAuth(50, handler);
    const req = new NextRequest('http://localhost/api/test');
    const response = await wrapped(req);

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('returns 403 when role level is insufficient', async () => {
    mocks.mockWithOrgAuth.mockReturnValue({
      organizationId: 'org-1',
      userId: 'user-1',
      memberId: 'mem-1',
    });
    mocks.mockGetMemberRoles.mockResolvedValue([]);
    mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(10);
    mocks.mockGetMemberEffectivePermissions.mockResolvedValue([]);

    const handler = vi.fn();
    const wrapped = withEnhancedRoleAuth(50, handler);
    const req = new NextRequest('http://localhost/api/test');
    const response = await wrapped(req);

    expect(response.status).toBe(403);
    expect(handler).not.toHaveBeenCalled();
  });

  it('calls handler when role level is sufficient', async () => {
    mocks.mockWithOrgAuth.mockReturnValue({
      organizationId: 'org-1',
      userId: 'user-1',
      memberId: 'mem-1',
    });
    mocks.mockGetMemberRoles.mockResolvedValue([{ roleLevel: 80 }]);
    mocks.mockGetMemberHighestRoleLevel.mockResolvedValue(80);
    mocks.mockGetMemberEffectivePermissions.mockResolvedValue(['read', 'write']);

    const handler = vi.fn().mockResolvedValue(NextResponse.json({ ok: true }));
    const wrapped = withEnhancedRoleAuth(50, handler);
    const req = new NextRequest('http://localhost/api/test');
    const response = await wrapped(req);

    expect(handler).toHaveBeenCalled();
    expect(response.status).toBe(200);
  });
});
