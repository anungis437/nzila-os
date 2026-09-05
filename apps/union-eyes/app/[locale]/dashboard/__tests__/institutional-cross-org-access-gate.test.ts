import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_ROOT = resolve(__dirname, '..', '..', '..', '..');

// PR #752 round 8: getInstitutionalGraph() (organizational-topology/source.ts)
// deliberately reads organizations + organizationRelationships with NO
// per-org filter (a Model A national/cross-affiliate surface). These 3
// dashboard pages consume it and were previously gated by bare
// requireUser() (any authenticated user, any role) — a real cross-org
// data exposure. This is a permanent regression guard: it fails the
// moment any of these pages stops calling hasInstitutionalTopologyAccess
// before rendering the cross-org view.
const GATED_PAGES = [
  'app/[locale]/dashboard/organizational-topology/page.tsx',
  'app/[locale]/dashboard/organizational-chronology/page.tsx',
  'app/[locale]/dashboard/organizational-observability/page.tsx',
];

describe('institutional topology/chronology/observability cross-org access gate', () => {
  it.each(GATED_PAGES)('%s imports and calls hasInstitutionalTopologyAccess before rendering', (relPath) => {
    const src = readFileSync(resolve(APP_ROOT, relPath), 'utf8');
    expect(src).toMatch(/import\s*\{[^}]*hasInstitutionalTopologyAccess[^}]*\}\s*from\s*['"]@\/lib\/organizational-topology\/access['"]/);
    expect(src).toMatch(/hasInstitutionalTopologyAccess\(/);
    expect(src).toMatch(/redirect\(['"]\/dashboard['"]\)/);
  });
});
