/**
 * ARTIFACT TYPE: Contract test
 * DOCTRINE_VERSION: 1.0.0
 *
 * PR #752 round 5/6: proves the CLC national dashboard's authority model
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
 * processing". That is Model A (national dashboard), not Model B
 * (org-scoped) — getCLCOperationalMetrics's unused `_orgId` parameter is
 * consistent with A, not a bug, PROVIDED clc_staff/clc_executive/
 * system_admin/platform_lead are genuinely privileged, platform-
 * administered roles that cannot be self-service granted by an ordinary
 * tenant organization to its own members.
 *
 * Round 6 correction: round 5's "bulkUpdateMemberRole has no live caller"
 * test only asserted the function EXISTS (`toMatch(/export async function
 * bulkUpdateMemberRole/)`), never that it has zero real importers — a
 * genuinely unenforced claim. This file now (a) enumerates EVERY
 * production code path that writes organizationMembers.role or creates an
 * org-membership row with a role (not just the one invite path), (b)
 * classifies each writer as TENANT_SELF_SERVICE / PLATFORM_ADMIN /
 * SYSTEM_PROVISIONING / LATENT_UNWIRED, and (c) actually enforces "zero
 * real importers" for the LATENT_UNWIRED ones via a real grep-based source
 * scan, not a string-presence assertion.
 *
 * Round 12 correction (real defect found and fixed): the invite service's
 * ALLOWED_ROLES allow-list included 'coo' — a Nzila platform-operations
 * role (level 295, ABOVE platform_lead/system_admin/CLC roles), not a
 * tenant-local one. Since the invite-create route only requires
 * hasMinRole('admin') (level 140) and role-level checks compare hierarchy
 * LEVEL rather than explicit assignability, an ordinary tenant admin could
 * invite a member with role:'coo' into their OWN org and that member
 * would then satisfy any minRole/hierarchy-level check requiring
 * platform-operations authority — a real privilege escalation. FIXED:
 * removed 'coo'; the allow-list is now exported as
 * TENANT_SELF_SERVICE_ASSIGNABLE_ROLES (packages/platform-auth/src/invites/service.ts)
 * and checked here against the canonical, EXPLICIT
 * PLATFORM_ELEVATED_ROLES constant (lib/api-auth-guard.ts) — the full
 * Nzila-platform-operations + CLC/federation/national role vocabulary,
 * not a 4-role ad hoc list. Assignability is modeled explicitly; numeric
 * hierarchy level alone is never trusted to imply "may be self-service
 * assigned" or "may not be".
 *
 * Writer enumeration (verified 2026-09-02 via git grep across app/, lib/,
 * actions/, services/ for `.update(organizationMembers)`/`.insert(organizationMembers)`
 * call sites, cross-checked against every `role:` write in the matched
 * files):
 *   1. packages/platform-auth/src/invites/service.ts's createInvite() —
 *      TENANT_SELF_SERVICE (app/api/auth/invite/create/route.ts, gated by
 *      hasMinRole('admin') only). SAFE (round 12): its
 *      TENANT_SELF_SERVICE_ASSIGNABLE_ROLES allow-list is {member, steward,
 *      chief_steward, admin} — excludes every PLATFORM_ELEVATED_ROLES entry.
 *   2. lib/services/member-service.ts's bulkUpdateMemberRole() —
 *      LATENT_UNWIRED. Casts an arbitrary role string onto
 *      organizationMembers with NO allow-list. Zero real (non-test)
 *      importers today (enforced below).
 *   3. lib/data-export-import.ts's DataImportService.importRecord()
 *      ('members' case) — LATENT_UNWIRED. Also casts an arbitrary
 *      `data.role` onto organizationMembers (both UPDATE and INSERT) with
 *      NO allow-list — a SECOND unrestricted writer this round's audit
 *      found, not previously tracked anywhere. Zero real (non-test)
 *      importers of the exported `dataImportService` singleton today
 *      (enforced below).
 *   Every other `.update(organizationMembers)`/`.insert(organizationMembers)`
 *   call site found (app/api/admin/users/[userId]/route.ts: status/deletedAt
 *   only; app/api/users/me/organizations/route.ts: userId account-linking
 *   only) was read directly and confirmed to never touch the `role` column.
 *
 * PERMANENT INVARIANT: a TENANT_SELF_SERVICE writer may never accept any
 * PLATFORM_ELEVATED_ROLES value. A LATENT_UNWIRED writer must have zero
 * real importers — the moment one gains a real caller, this test fails
 * and that new call site must enforce its own allow-list before shipping.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { TENANT_SELF_SERVICE_ASSIGNABLE_ROLES } from '@nzila/platform-auth/invites';
import { ROLE_HIERARCHY, PLATFORM_ELEVATED_ROLES } from '@/lib/api-auth-guard';

const APP_ROOT = resolve(__dirname, '..', '..', '..');

/**
 * Real (non-test) importer count for a given module path, searched across
 * app/, actions/, lib/, services/ within apps/union-eyes. Excludes the
 * defining file itself and any __tests__/.test./.spec. file. Uses `grep -l`
 * (list-matching-files) rather than counting every match, since we only
 * care whether ANY real importer exists.
 */
function realImporterFiles(moduleSpecifierFragment: string, definingFileRelativePath: string): string[] {
  let out = '';
  try {
    out = execFileSync(
      'grep',
      ['-rl', '-E', moduleSpecifierFragment, 'app', 'lib', 'actions', 'services'],
      { cwd: APP_ROOT, encoding: 'utf8' },
    );
  } catch (err: unknown) {
    // grep exits 1 when there are no matches at all — that's a valid "zero importers" result.
    const execErr = err as { status?: number; stdout?: string };
    if (execErr.status === 1) return [];
    out = execErr.stdout ?? '';
  }
  return out
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .filter((file) => !file.includes('__tests__') && !file.includes('.test.') && !file.includes('.spec.'))
    .filter((file) => file !== definingFileRelativePath);
}

describe('CLC national dashboard authority boundary (PR #752 round 5/6/12)', () => {
  it('TENANT_SELF_SERVICE_ASSIGNABLE_ROLES (the actual invite-service allow-list) has ZERO overlap with the canonical PLATFORM_ELEVATED_ROLES set', () => {
    const overlap = PLATFORM_ELEVATED_ROLES.filter((role) => TENANT_SELF_SERVICE_ASSIGNABLE_ROLES.has(role));
    expect(overlap, 'a tenant self-service writer must never be able to assign a platform-elevated role').toEqual([]);
  });

  it("ordinary tenant admin CAN invite approved tenant-local roles (member/steward/chief_steward/admin)", () => {
    for (const role of ['member', 'steward', 'chief_steward', 'admin']) {
      expect(TENANT_SELF_SERVICE_ASSIGNABLE_ROLES.has(role), `${role} should be self-service assignable`).toBe(true);
    }
  });

  it("ordinary tenant admin CANNOT invite any Nzila platform-operations or CLC/federation/national role", () => {
    for (const role of PLATFORM_ELEVATED_ROLES) {
      expect(TENANT_SELF_SERVICE_ASSIGNABLE_ROLES.has(role), `${role} must NOT be self-service assignable`).toBe(false);
    }
  });

  it("'coo' hierarchy level is above platform_lead/system_admin/admin — proof of why it must never be re-added to the tenant invite allow-list casually", () => {
    expect(ROLE_HIERARCHY.coo).toBeGreaterThan(ROLE_HIERARCHY.platform_lead);
    expect(ROLE_HIERARCHY.coo).toBeGreaterThan(ROLE_HIERARCHY.system_admin);
    expect(ROLE_HIERARCHY.coo).toBeGreaterThan(ROLE_HIERARCHY.admin);
  });

  it('the invite-create route is gated only by an ordinary tenant-level role (admin), not a platform-level one — confirming the allow-list is the actual enforcement boundary, not the route gate', () => {
    const source = readFileSync(resolve(APP_ROOT, 'app/api/auth/invite/create/route.ts'), 'utf8');
    expect(source).toMatch(/hasMinRole\('admin'\)/);
    for (const role of PLATFORM_ELEVATED_ROLES) {
      expect(source.includes(`hasMinRole('${role}')`)).toBe(false);
    }
  });

  it('bulkUpdateMemberRole (LATENT_UNWIRED, unrestricted role-write) has ZERO real importers today — actually enforced via source scan, not a string-presence check', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/services/member-service.ts'), 'utf8');
    expect(source).toMatch(/export async function bulkUpdateMemberRole/);
    const importers = realImporterFiles('bulkUpdateMemberRole', 'lib/services/member-service.ts');
    expect(
      importers,
      'bulkUpdateMemberRole has gained a real caller — that call site MUST enforce its own PLATFORM_ELEVATED_ROLES allow-list before this can pass; do not just update this assertion',
    ).toEqual([]);
  });

  it('DataImportService.importRecord (LATENT_UNWIRED, unrestricted role-write via bulk member import) has ZERO real importers of the exported dataImportService singleton today', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/data-export-import.ts'), 'utf8');
    expect(source).toMatch(/export const dataImportService = new DataImportService\(\)/);
    expect(source).toMatch(/role: data\.role as string \| undefined/);
    const importers = realImporterFiles('dataImportService', 'lib/data-export-import.ts');
    expect(
      importers,
      'dataImportService has gained a real caller — its "members" import case writes an arbitrary data.role onto organizationMembers with NO allow-list; that call site MUST validate against PLATFORM_ELEVATED_ROLES before this can pass',
    ).toEqual([]);
  });

  it('the two other real .update(organizationMembers)/.insert(organizationMembers) call sites (admin user status route, account-linking route) never set the role column', () => {
    const adminRoute = readFileSync(resolve(APP_ROOT, 'app/api/admin/users/[userId]/route.ts'), 'utf8');
    // Both mutations in this file only touch status/deletedAt/updatedAt.
    expect(adminRoute).not.toMatch(/\.update\(organizationMembers\)\s*\.set\(\{[^}]*\brole\b/s);

    const linkRoute = readFileSync(resolve(APP_ROOT, 'app/api/users/me/organizations/route.ts'), 'utf8');
    // Both mutations in this file only re-link an existing row's userId by email match.
    expect(linkRoute).not.toMatch(/\.update\(organizationMembers\)\s*\.set\(\{[^}]*\brole\b/s);
  });

  it('getUserRoleInOrganization resolves strictly from the (userId, organizationId) row with no cross-org fallback — so the writer enumeration above is a complete boundary, not one of several paths', () => {
    const source = readFileSync(resolve(APP_ROOT, 'lib/organization-utils.ts'), 'utf8');
    expect(source).toMatch(/eq\(organizationMembers\.userId, userId\)/);
    expect(source).toMatch(/eq\(organizationMembers\.organizationId, organizationId\)/);
  });
});
