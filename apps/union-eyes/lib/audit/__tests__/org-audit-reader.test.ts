import { beforeEach, describe, expect, it, vi } from 'vitest';

const m = vi.hoisted(() => ({ resolveAccess: vi.fn() }));
vi.mock('@/lib/organizations/read-authority', () => ({
  resolveOrganizationAccess: m.resolveAccess,
  isAdministrativeRole: (role: string | undefined) => role === 'admin',
}));
vi.mock('@/lib/api/errors', () => ({
  ApiError: { forbidden: (reason: string) => Object.assign(new Error(reason), { status: 403 }) },
}));
vi.mock('@/db/schema/audit-security-schema', () => ({
  auditLogs: {
    auditId: 'auditId', organizationId: 'org', userId: 'user', action: 'action',
    resourceType: 'resourceType', resourceId: 'resourceId', severity: 'severity',
    outcome: 'outcome', createdAt: 'createdAt',
    ipAddress: 'ipAddress', userAgent: 'userAgent', sessionId: 'sessionId',
    oldValues: 'oldValues', newValues: 'newValues', metadata: 'metadata',
    errorMessage: 'errorMessage', archivedPath: 'archivedPath',
  },
}));

import { ORGANIZATION_AUDIT_PROJECTION, requireOrganizationAuditReader } from '../org-audit-reader';

const own = '11111111-1111-4111-8111-111111111111';
const foreign = '22222222-2222-4222-8222-222222222222';

beforeEach(() => vi.clearAllMocks());

describe('UE-INST-AUDIT-HISTORY-READERS — full audit exposure floor', () => {
  it('rejects missing identity and organization without querying any access resolver', async () => {
    await expect(requireOrganizationAuditReader(null, own)).rejects.toMatchObject({ status: 403 });
    await expect(requireOrganizationAuditReader('u', null)).rejects.toMatchObject({ status: 403 });
    expect(m.resolveAccess).not.toHaveBeenCalled();
  });
  it.each([
    { title: 'platform title only', platform: true, direct: new Map() },
    { title: 'federation parent administrator', platform: false, direct: new Map([[foreign, 'admin']]) },
    { title: 'local officer without privacy designation', platform: false, direct: new Map([[own, 'officer']]) },
    { title: 'steward', platform: false, direct: new Map([[own, 'steward']]) },
    { title: 'member', platform: false, direct: new Map([[own, 'member']]) },
  ])('denies full tenant audit history to $title', async ({ platform, direct }) => {
    m.resolveAccess.mockResolvedValue({ platform, direct, descendants: new Set([own]) });
    await expect(requireOrganizationAuditReader('u', own)).rejects.toMatchObject({ status: 403 });
  });
  it('allows a directly assigned active organization administrator', async () => {
    m.resolveAccess.mockResolvedValue({ platform: false, direct: new Map([[own, 'admin']]), descendants: new Set() });
    await expect(requireOrganizationAuditReader('u', own)).resolves.toBe(own);
  });
  it('all three full-history endpoints require direct-tenant mandate before a projected SELECT', async () => {
    const { readFileSync } = await import('node:fs');
    const { resolve } = await import('node:path');
    const appRoot = resolve(__dirname, '../../../');
    for (const relativePath of [
      'app/api/audits/route.ts',
      'app/api/audits/[id]/route.ts',
      'app/api/compliance/audit-logs/route.ts',
    ]) {
      const src = readFileSync(resolve(appRoot, relativePath), 'utf8');
      expect(src).toContain('requireOrganizationAuditReader(userId, organizationId)');
      expect(src).toContain('.select(ORGANIZATION_AUDIT_PROJECTION)');
      expect(src).not.toMatch(/\.select\(\)/);
      expect(src).toMatch(/rlsOrgContext:\s*true/);
    }
  });

  it('never selects request-network identifiers, full payloads, or arbitrary metadata', () => {
    expect(Object.keys(ORGANIZATION_AUDIT_PROJECTION)).toEqual([
      'auditId', 'organizationId', 'userId', 'action', 'resourceType',
      'resourceId', 'severity', 'outcome', 'createdAt',
    ]);
    const serialized = JSON.stringify(ORGANIZATION_AUDIT_PROJECTION);
    for (const secret of ['ipAddress', 'userAgent', 'sessionId', 'oldValues', 'newValues', 'metadata', 'errorMessage', 'archivedPath'])
      expect(serialized).not.toContain(secret);
  });
});
