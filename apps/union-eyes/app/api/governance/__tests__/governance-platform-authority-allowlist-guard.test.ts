import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_ROOT = resolve(__dirname, '..', '..', '..', '..');

// PR #752 round 11: all 6 route handlers touching golden_shares/
// mission_audits/reserved_matter_votes (platform-wide, non-tenant-shaped
// Class-B governance tables, executed under withSystemContext with no
// organization_id filter) must require the same national/platform
// allow-list — never fall back to an ordinary per-org role tier like
// 'admin'. Permanent regression guard: fails if any of these files stops
// declaring the exact allow-list, or reintroduces `minRole: 'admin'`.
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

  it.each(GOVERNED_FILES)('%s restricts every auth block to the clc_staff/clc_executive/system_admin allow-list', (relPath) => {
    const src = readFileSync(resolve(APP_ROOT, relPath), 'utf8');
    const authBlocks = src.match(/auth:\s*\{[^}]*\}/g) ?? [];
    expect(authBlocks.length).toBeGreaterThan(0);
    for (const block of authBlocks) {
      expect(block).toMatch(/roles:\s*\[\s*['"]clc_staff['"]\s*,\s*['"]clc_executive['"]\s*,\s*['"]system_admin['"]\s*\]/);
    }
  });
});
