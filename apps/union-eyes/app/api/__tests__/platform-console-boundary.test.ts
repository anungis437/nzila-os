import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (route: string) => readFileSync(join(process.cwd(), 'app/api', route, 'route.ts'), 'utf8');

/**
 * The operator console (`/dashboard/admin`) is reachable by organization admins through the
 * admin layout, so the boundary that matters is the one every request it makes crosses.
 */
describe('operator console access boundary', () => {
  const platformReads: Array<[string, string]> = [
    ['admin/stats/overview', 'platform.stats.read'],
    ['admin/users', 'platform.user_directory.read'],
    ['admin/organizations', 'platform.organization_directory.read'],
    ['admin/database/health', 'platform.database_health.read'],
  ];

  it.each(platformReads)('%s needs platform rank and staff authority', (route, capability) => {
    const source = read(route);
    expect(source).toMatch(/minRole:\s*'platform_lead'/);
    expect(source).toContain(`requirePlatformStaffAuthority(`);
    expect(source).toContain(`'${capability}'`);
  });

  it('activity needs platform rank', () => {
    expect(read('admin/stats/activity')).toMatch(/minRole:\s*'platform_lead'/);
  });

  it('database maintenance needs a platform administrator and staff authority', () => {
    const source = read('admin/database/optimize');
    expect(source).toContain('isPlatformAdminUser(userId)');
    expect(source).toContain(`'platform.database.maintain'`);
    expect(source).toMatch(/status:\s*403/);
  });

  it('platform member statistics need platform rank and refuse an unscoped read', () => {
    const source = read('admin/members/stats');
    expect(source).toContain(`hasMinRole('platform_lead')`);
    expect(source).toMatch(/status:\s*403/);
    expect(source).toContain('organizationId must be an organization id');
  });

  it('the member roster resolves access to the named organization before reading', () => {
    const source = read('organizations/[id]/members');
    const start = source.indexOf('export async function GET');
    const guard = source.indexOf('canAdministerOrganization(access, id)', start);
    expect(guard).toBeGreaterThan(start);
    expect(guard).toBeLessThan(source.indexOf('withRLSContext({ organizationId: id }', start));
  });

  it('creating an organization needs platform staff authority', () => {
    expect(read('organizations')).toContain(`'platform.organization.manage'`);
  });

  it('the AI endpoint tester only reaches member-rank routes, so the tester grants nothing the routes do not', () => {
    for (const route of ['ai/feedback', 'ai/search']) {
      expect(read(route)).toMatch(/minRole:\s*'member'/);
    }
  });
});
