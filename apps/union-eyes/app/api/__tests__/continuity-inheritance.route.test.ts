import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { describe, expect, it } from 'vitest';

// The continuity/inheritance route mirrors the onboarding route's crudRoutes()
// config inline so Next.js Turbopack (which rejects re-exporting `dynamic`) and
// the textual contract scanners (which require an auth-pattern match in the
// file itself) are both satisfied. This test enforces the mirrored contract.
describe('continuity inheritance route', () => {
  it('mirrors the governed onboarding crudRoutes auth+org-scope contract', () => {
    const source = readFileSync(
      resolve(__dirname, '../continuity/inheritance/route.ts'),
      'utf8',
    );

    expect(source).toContain("import { crudRoutes } from '@/lib/api/crud-factory'");
    expect(source).toContain("import { pendingProfilesTable } from '@/db/schema'");
    expect(source).toContain('crudRoutes({');
    expect(source).toContain('table: pendingProfilesTable');
    expect(source).toContain('orgScoped: true');
    expect(source).toContain("readRole: 'member'");
    expect(source).toContain("writeRole: 'steward'");
    expect(source).toContain("export const dynamic = 'force-dynamic'");
    expect(source).toContain('export { GET, POST }');
  });

  it('does not keep a local placeholder organization guard', () => {
    const source = readFileSync(
      resolve(__dirname, '../continuity/inheritance/route.ts'),
      'utf8',
    );

    expect(source).not.toMatch(/function\s+requireOrgAccess/);
    expect(source).not.toMatch(/return\s+true\s*;/);
  });
});
