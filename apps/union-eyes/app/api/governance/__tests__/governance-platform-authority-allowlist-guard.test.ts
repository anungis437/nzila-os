import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { GOVERNANCE_SYSTEM_ROLES, PLATFORM_ELEVATED_ROLES } from '@/lib/api-auth-guard';

const APP_ROOT = resolve(__dirname, '..', '..', '..', '..');

// PR #752 round 11/12: all 6 route handlers touching golden_shares/
// mission_audits/reserved_matter_votes (platform-wide, non-tenant-shaped
// Class-B governance tables, executed under withSystemContext with no
// organization_id filter) must require the same national/platform
// allow-list — never fall back to an ordinary per-org role tier like
// 'admin'. Round 12: the allow-list is now the single canonical
// GOVERNANCE_SYSTEM_ROLES constant (lib/api-auth-guard.ts), not six
// copied array literals — this guard checks the routes import and spread
// that constant, not a hardcoded string pattern, so it can't silently
// drift from the real allow-list.
const GOVERNED_FILES = [
  'app/api/governance/dashboard/route.ts',
  'app/api/governance/golden-share/route.ts',
  'app/api/governance/mission-audits/route.ts',
  'app/api/governance/reserved-matters/route.ts',
  'app/api/governance/reserved-matters/[id]/route.ts',
  'app/api/governance/reserved-matters/[id]/class-b-vote/route.ts',
];

describe('golden_shares/mission_audits/reserved_matter_votes require platform-tier authority', () => {
  it.each(GOVERNED_FILES)('%s never uses an ordinary org-scoped minRole for these routes', (relPath) => {
    const src = readFileSync(resolve(APP_ROOT, relPath), 'utf8');
    expect(src).not.toMatch(/minRole:\s*['"]admin['"]/);
  });

  it.each(GOVERNED_FILES)('%s imports GOVERNANCE_SYSTEM_ROLES and spreads it into every auth.roles block', (relPath) => {
    const src = readFileSync(resolve(APP_ROOT, relPath), 'utf8');
    expect(src).toMatch(/import\s*\{[^}]*GOVERNANCE_SYSTEM_ROLES[^}]*\}\s*from\s*['"]@\/lib\/api-auth-guard['"]/);
    const authBlocks = src.match(/auth:\s*\{[^}]*\}/g) ?? [];
    expect(authBlocks.length).toBeGreaterThan(0);
    for (const block of authBlocks) {
      expect(block).toMatch(/roles:\s*\[\s*\.\.\.GOVERNANCE_SYSTEM_ROLES\s*\]/);
    }
  });

  it('GOVERNANCE_SYSTEM_ROLES itself has zero overlap with the Nzila-platform-ownership tier (app_owner/coo/cto/platform_lead/system-staff roles) — only clc_staff/clc_executive/system_admin are authorized', () => {
    const nonSystemAdminPlatformOps = PLATFORM_ELEVATED_ROLES.filter(
      (role) => role !== 'system_admin' && role !== 'clc_staff' && role !== 'clc_executive',
    );
    for (const role of nonSystemAdminPlatformOps) {
      expect(GOVERNANCE_SYSTEM_ROLES.includes(role), `${role} is not authorized to operate governance Class-B capability`).toBe(false);
    }
  });
});
