import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRoute = (relative: string) => readFileSync(join(__dirname, '..', relative, 'route.ts'), 'utf8');

describe('Gate 0 organization directory privacy and isolation', () => {
  it('does not expose membership totals or contact details to non-admin organization readers', () => {
    const src = readRoute('organizations');
    const start = src.indexOf('const mapped = rows.map(row =>');
    const adminProjection = src.indexOf('...(administrative ? {', start);
    expect(start).toBeGreaterThan(0);
    expect(adminProjection).toBeGreaterThan(start);
    const publicProjection = src.slice(start, adminProjection);
    expect(publicProjection).not.toContain('member_count: row.memberCount');
    expect(publicProjection).not.toContain('memberCount: row.memberCount');
    expect(publicProjection).not.toContain('active_member_count: row.activeMemberCount');
    expect(publicProjection).not.toContain('email: row.email');
    expect(publicProjection).not.toContain('phone: row.phone');
    expect(src.slice(adminProjection)).toContain('member_count: row.memberCount');
    // Issue #1116: an organization the caller is not a direct member of is its directory entry only, and a platform title adds none.
    expect(publicProjection).toContain('if (!canReadOrganization(access, row.id)) return { ...directoryProjection(row), parentName, ...stats };');
    expect(src).toContain('affiliationOrganizationIds(access)');
    expect(src).toContain('inArray(organizations.id, visible)');
    expect(src).not.toContain('access.platform');
    expect(src).toContain('withSystemContext(async (tx) =>');
    // Grievance counts are read under the caller's own membership, never as the system role.
    expect(src).toContain('withRLSContext({ organizationId }');
  });

  it('search limits tenant visibility and only exposes member counts to administrative readers', () => {
    const src = readRoute('organizations/search');
    expect(src).toContain('affiliationOrganizationIds(access)');
    expect(src).toContain('inArray(organizations.id, visible)');
    expect(src).toContain('...directoryProjection(row),');
    expect(src).toContain('canReadOrganization(access, row.id) ? { sectors: row.sectors } : {}');
    expect(src).toContain('canAdministerOrganization(access, row.id) ? { member_count: row.memberCount } : {}');
    expect(src).toContain('withSystemContext((tx) =>');
  });
});
