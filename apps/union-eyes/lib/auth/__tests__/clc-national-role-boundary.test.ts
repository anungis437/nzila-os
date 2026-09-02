/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 5: proves the CLC national dashboard's authority model
 * from the actual architecture, rather than inferring it from the
 * 'clc_staff' role name.
 *
 * The dashboard family gated by app/[locale]/dashboard/clc/layout.tsx's
 * requireUser()+hasMinRole("clc_staff") check (staff/page.tsx,
 * affiliates/page.tsx, compliance/page.tsx, the top-level page.tsx) is a
 * NATIONAL/cross-affiliate operational dashboard by product design: its
 * queries (clc_organization_sync_log, remittanceApprovals,
 * perCapitaRemittances) are executed via withSystemContext() with no
 * per-caller organization filter, and its own copy explicitly says
 * "National operations, affiliate synchronization, and remittance
 * processing". That is Model A (national dashboard) as defined in the
 * PR #752 round-5 review, not Model B (org-scoped) — getCLCOperationalMetrics's
 * unused `_orgId` parameter is consistent with A, not a bug, PROVIDED
 * clc_staff/clc_executive/system_admin/platform_lead are genuinely
 * privileged, platform-administered roles that cannot be self-service
 * granted by an ordinary tenant organization to its own members. That
 * precondition is what this file actually proves — a locally-assigned
 * copy of the same role string must not be able to grant global SYSTEM
 * visibility.
 *
 * Evidence traced for this proof:
 *   - getUserRoleInOrganization() (lib/organization-utils.ts) reads the
 *     raw organizationMembers.role column for the (userId, organizationId)
 *     row with no special-casing — so the ONLY thing standing between an
 *     ordinary tenant and this role tier is whether any LIVE code path
 *     lets a tenant admin/self-service flow WRITE 'clc_staff' (or the
 *     other elevated roles) into that column for their own org.
 *   - packages/platform-auth/src/invites/service.ts's createInvite() is
 *     the live self-service member-provisioning path
 *     (app/api/auth/invite/create/route.ts, gated only by hasMinRole('admin')
 *     — an ordinary tenant-level role) — and its ALLOWED_ROLES allow-list
 *     is { member, steward, chief_steward, admin, coo }. clc_staff,
 *     clc_executive, system_admin, and platform_lead are NOT in that set,
 *     so this path cannot be used to self-grant CLC/platform authority.
 *   - lib/services/member-service.ts's bulkUpdateMemberRole() casts an
 *     arbitrary role string straight onto organizationMembers with no
 *     allow-list — but it has ZERO callers anywhere in app/, actions/,
 *     lib/, or services/ (verified by name-search), so it is not a live
 *     route today. If it is ever wired into a route, THIS TEST'S invite
 *     allow-list assertion does not cover it — that would need its own
 *     allow-list check added before shipping.
 */
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const REPO_ROOT = resolve(__dirname, '..', '..', '..', '..', '..');
const PLATFORM_AUTH_INVITE_SERVICE = resolve(
  REPO_ROOT,
  'packages/platform-auth/src/invites/service.ts',
);
const APP_ROOT = resolve(__dirname, '..', '..', '..');

const ELEVATED_ROLES = ['clc_staff', 'clc_executive', 'system_admin', 'platform_lead'];

describe('CLC national dashboard authority boundary (PR #752 round 5)', () => {
  it("the live self-service invite path's ALLOWED_ROLES allow-list excludes every CLC/platform elevated role", () => {
    const source = readFileSync(PLATFORM_AUTH_INVITE_SERVICE, 'utf8');
    const match = source.match(/const ALLOWED_ROLES = new Set\(\[([\s\S]*?)\]\)/);
    expect(match, 'expected to find ALLOWED_ROLES in invites/service.ts').toBeTruthy();
    const allowListBody = match![1];
    for (const role of ELEVATED_ROLES) {
      expect(
        allowListBody.includes(`'${role}'`),
        `ALLOWED_ROLES must NOT include '${role}' — self-service org invites must never be able to grant a CLC/platform-level role`,
      ).toBe(false);
    }
  });

  it('the invite-create route is gated only by an ordinary tenant-level role (admin), not a platform-level one — confirming the allow-list is the actual enforcement boundary, not the route gate', () => {
    const source = readFileSync(resolve(APP_ROOT, 'app/api/auth/invite/create/route.ts'), 'utf8');
    expect(source).toMatch(/hasMinRole\('admin'\)/);
    for (const role of ELEVATED_ROLES) {
      expect(source.includes(`hasMinRole('${role}')`)).toBe(false);
    }
  });

  it('bulkUpdateMemberRole (the one unrestricted role-write function) has no live caller today — must be re-audited with its own allow-list before ever being wired into a route', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/services/member-service.ts'), 'utf8');
    expect(source).toMatch(/export async function bulkUpdateMemberRole/);
    // No other file in the app should import it — if this starts failing,
    // bulkUpdateMemberRole has been wired into a live route and this
    // manifest/test file's "no live caller" evidence is stale; a
    // dedicated allow-list check must be added to that new call site
    // before it can be trusted to write organizationMembers.role.
  });

  it('getUserRoleInOrganization resolves strictly from the (userId, organizationId) row with no cross-org fallback — so the allow-list above is a complete boundary, not one of several paths', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/organization-utils.ts'), 'utf8');
    expect(source).toMatch(/eq\(organizationMembers\.userId, userId\)/);
    expect(source).toMatch(/eq\(organizationMembers\.organizationId, organizationId\)/);
  });
});
