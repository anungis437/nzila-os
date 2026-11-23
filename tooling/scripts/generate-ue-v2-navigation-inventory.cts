import assert from 'node:assert/strict';
import fs from 'node:fs';
import type * as Navigation from '../../apps/union-eyes/lib/dashboard/role-experience';
import type * as Settings from '../../apps/union-eyes/lib/auth/org-settings-access';
import { navigationSource } from './lib/ue-v2-navigation-source';

const target = 'tooling/scripts/lib/ue-v2-navigation-inventory.json';
const old = JSON.parse(fs.readFileSync(target, 'utf8'));
const binding = JSON.parse(fs.readFileSync('tooling/scripts/lib/ue-v2-staging-candidate.json', 'utf8'));
const source = navigationSource(process.cwd(), binding.applicationSourceSha);
const { getDashboardExperience, getRoleLandingPath, getNavigationForExperience, getVisibleNavigationForExperience } =
  source.load('apps/union-eyes/lib/dashboard/role-experience.ts') as unknown as typeof Navigation;
const { canManageOrganizationSettings } =
  source.load('apps/union-eyes/lib/auth/org-settings-access.ts') as unknown as typeof Settings;
const profiles = Object.fromEntries([
  'member', 'steward', 'chief_steward', 'officer', 'secretary_treasurer', 'admin', 'app_owner',
].map(role => {
  const experience = getDashboardExperience(role);
  return [role, {
    experience,
    landing: getRoleLandingPath(role),
    visible: getVisibleNavigationForExperience(experience, false, role),
    deepGovernance: experience === 'executive' ? ['/dashboard/trust', '/dashboard/intelligence'] : [],
    // The settings route explicitly redirects non-administrators to their own
    // profile. Record the real destination without changing the visible menu.
    accountSettings: {
      path: '/dashboard/settings',
      destination: canManageOrganizationSettings(role) ? '/dashboard/settings' : '/dashboard/profile',
    },
  }];
}));
const canonical = ['member', 'staff', 'executive', 'governance', 'admin'].flatMap(experience =>
  getNavigationForExperience(experience as ReturnType<typeof getDashboardExperience>).map(entry => ({experience, ...entry})));
const next = {
  applicationSourceSha: binding.applicationSourceSha,
  sourceDigests: source.digests([
    ...Object.keys(old.sourceDigests),
    'apps/union-eyes/lib/auth/org-settings-access.ts',
    'apps/union-eyes/app/[locale]/dashboard/settings/page.tsx',
  ]),
  canonicalEntryCount: canonical.length,
  uniquePaths: [...new Set(canonical.map(entry => entry.href))],
  canonical,
  profiles,
};
// Snapshot modules execute in isolated contexts; compare serialized data, not
// cross-context object prototypes. The recorded source is the admitted Git tree.
const snapshot = JSON.parse(JSON.stringify(next));
if (process.argv.includes('--check')) assert.deepEqual(old, snapshot, 'Regenerate the source-derived navigation inventory');
else fs.writeFileSync(target, JSON.stringify(snapshot, null, 2) + '\n');
