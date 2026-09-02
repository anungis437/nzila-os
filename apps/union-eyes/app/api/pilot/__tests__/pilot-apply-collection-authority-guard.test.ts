import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const APP_ROOT = resolve(__dirname, '..', '..', '..', '..');

// PR #752 round 17: pilot_applications has no organizationId column (orgScoped
// can never filter it) and its rows are sensitive prospective-customer intake
// data (contact info, member counts, internal challenges/goals) spanning every
// organization on the platform, not the caller's own org. The collection GET
// (crudRoutes) previously used readRole: 'steward' — an ordinary per-org role
// tier — letting any steward at any org enumerate every other org's pilot
// applications. It must require the same system_admin-or-higher tier that
// lib/pilot/pilot-ownership.ts already established for the per-item routes.
describe('pilot/apply collection route requires platform-tier read authority', () => {
  it('never uses an ordinary org-scoped readRole for the pilot_applications list', () => {
    const src = readFileSync(resolve(APP_ROOT, 'app/api/pilot/apply/route.ts'), 'utf8');
    expect(src).not.toMatch(/readRole:\s*['"](member|steward|officer|chief_steward|admin|president)['"]/);
    expect(src).toMatch(/readRole:\s*['"]system_admin['"]/);
  });
});
