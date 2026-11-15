import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import {
  getDashboardExperience, getRoleLandingPath, getNavigationForExperience,
  getVisibleNavigationForExperience,
} from '../../apps/union-eyes/lib/dashboard/role-experience';
import { canManageOrganizationSettings } from '../../apps/union-eyes/lib/auth/org-settings-access';

const target = 'tooling/scripts/lib/ue-v2-navigation-inventory.json';
const old = JSON.parse(fs.readFileSync(target, 'utf8'));
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
  applicationSourceSha: old.applicationSourceSha,
  sourceDigests: Object.fromEntries([...new Set([
    ...Object.keys(old.sourceDigests),
    'apps/union-eyes/lib/auth/org-settings-access.ts',
    'apps/union-eyes/app/[locale]/dashboard/settings/page.tsx',
  ])].map(path => [path,
    crypto.createHash('sha256').update(fs.readFileSync(path)).digest('hex')])),
  canonicalEntryCount: canonical.length,
  uniquePaths: [...new Set(canonical.map(entry => entry.href))],
  canonical,
  profiles,
};
if (process.argv.includes('--check')) assert.deepEqual(old, next, 'Regenerate the source-derived navigation inventory');
else fs.writeFileSync(target, JSON.stringify(next, null, 2) + '\n');
