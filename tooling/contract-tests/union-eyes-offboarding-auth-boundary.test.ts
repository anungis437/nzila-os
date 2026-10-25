import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const AUTH_GUARD_PATH = resolve(process.cwd(), 'apps/union-eyes/lib/api-auth-guard.ts');
const ORG_UTILS_PATH = resolve(process.cwd(), 'apps/union-eyes/lib/organization-utils.ts');
const DOWNLOAD_ROUTE_PATH = resolve(process.cwd(), 'apps/union-eyes/app/api/documents/[id]/download/route.ts');
const DOWNLOAD_CORE_PATH = resolve(process.cwd(), 'apps/union-eyes/lib/documents/download-issuance.ts');

function read(path: string): string {
  return readFileSync(path, 'utf8');
}

describe('UnionEyes offboarding auth boundary contract', () => {
  it('revalidates PG-session and selected-org membership as active and not deleted', () => {
    const source = read(AUTH_GUARD_PATH);

    expect(source).toContain("eq(organizationMembers.status, 'active')");
    expect(source).toContain('isNull(organizationMembers.deletedAt)');
    expect(source).toContain('const { getAuthUser } = await import');
    expect(source).toContain("cookieStore.get('selected_organization_id')");
  });

  it('resolves organizations only through active non-deleted local memberships or active platform auth memberships', () => {
    const source = read(ORG_UTILS_PATH);

    expect(source).toContain("eq(organizationMembers.status, 'active')");
    expect(source).toContain('isNull(organizationMembers.deletedAt)');
    expect(source).toContain('eq(authOrganizationUsers.isActive, true)');
    expect(source).toContain('OrgContextRequiredError');
  });

  it('keeps direct document download behind organization auth and fresh document authorization', () => {
    // The route authenticates and delegates; every download path (single and bulk) shares one authorization core.
    const route = read(DOWNLOAD_ROUTE_PATH);
    expect(route).toContain('withOrganizationAuth');
    expect(route).toContain("await requireEntitlement(organizationId, 'grievance_case_suite')");
    expect(route).toContain("await hasMinRole('member')");
    expect(route).toContain('issueDocumentDownload(');
    expect(route).not.toMatch(/generateSasUrl|fileUrl/);

    const source = read(DOWNLOAD_CORE_PATH);
    expect(source).toContain('getEffectiveCaseAccess');
    expect(source).toContain('isDocumentVisibleByPolicy');
    expect(source).toContain("eq(documentAccessGrants.status, 'active')");
    expect(source).toContain('revokedAt} IS NULL');
    expect(source).toContain('expiresAt} IS NULL OR');
  });
});
