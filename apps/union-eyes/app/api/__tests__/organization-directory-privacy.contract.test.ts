import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const readRoute = (relative: string) => readFileSync(join(__dirname, '..', relative, 'route.ts'), 'utf8');

describe('Gate 0 organization directory privacy and isolation', () => {
  it('does not expose membership totals or contact details to non-admin organization readers', () => {
    const src = readRoute('organizations');
    const start = src.indexOf('return rows.map(row =>');
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
    expect(src).toContain('readableOrganizationIds(access)');
    expect(src).toContain('inArray(organizations.id, readable)');
    expect(src).toContain('withSystemContext(async (tx) =>');
  });

  it('search limits tenant visibility and only exposes member counts to administrative readers', () => {
    const src = readRoute('organizations/search');
    expect(src).toContain('readableOrganizationIds(access)');
    expect(src).toContain('inArray(organizations.id, readable)');
    expect(src).toContain('canAdministerOrganization(access, row.id) ? { member_count: row.memberCount } : {}');
    expect(src).toContain('withSystemContext((tx) =>');
  });
});
