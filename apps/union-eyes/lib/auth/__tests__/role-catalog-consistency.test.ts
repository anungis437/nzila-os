/**
 * The role catalog in code, and its copy in the database (UE-CONV-H-010).
 *
 * lib/auth/roles.ts is the catalog (UserRole, getRoleLevel, ROLE_PERMISSIONS); platform 0076 seeds role_definitions from it, and the enhanced RBAC reads the seed. This holds
 *   - every UserRole classified exactly once: an organization role (TENANT_LOCAL_ROLES), a platform-elevated role (PLATFORM_ELEVATED_ROLES) or a legacy alias, so a role
 *     added later cannot reach the database or an organization's data by being forgotten;
 *   - no platform-elevated role seeded: a role row in tenant data must not be able to carry a level that opens another organization or the platform;
 *   - each seeded role's level and permissions equal what the code says, and equal the guard's hierarchy wherever the guard has the role;
 *   - the committed migration 0076 and its rollback equal what the generator renders from the catalog today.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { getRoleLevel, ROLE_PERMISSIONS, TENANT_LOCAL_ROLES, UserRole } from '@/lib/auth/roles';
import { PLATFORM_ELEVATED_ROLES, ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { renderCatalogMigration, renderCatalogRollback, systemRoles } from '../../../scripts/lib/rbac-catalog-migration';

const MIGRATIONS = join(__dirname, '..', '..', '..', 'db', 'migrations-platform');
const committed = (file: string) => readFileSync(join(MIGRATIONS, file), 'utf8').replace(/\r\n/g, '\n');

/** Roles kept only so old data keeps working: they map to another role and are not assigned any more. */
const LEGACY_ALIASES: readonly string[] = [UserRole.GUEST, UserRole.CONGRESS_STAFF, UserRole.FEDERATION_STAFF, UserRole.UNION_REP, UserRole.STAFF_REP];

/** Roles the guard's ROLE_HIERARCHY does not list, so its min-role checks read them as level 0. Pinned: listing one there widens access on every min-role check. */
const ABSENT_FROM_GUARD_HIERARCHY: readonly string[] = [UserRole.CLERK];

describe('the role catalog', () => {
  it('classifies every UserRole exactly once', () => {
    const organization = new Set<string>(TENANT_LOCAL_ROLES);
    const platform = new Set<string>(PLATFORM_ELEVATED_ROLES);
    const legacy = new Set<string>(LEGACY_ALIASES);
    const unclassified: string[] = [];
    const doubled: string[] = [];
    for (const role of Object.values(UserRole)) {
      const homes = [organization.has(role), platform.has(role), legacy.has(role)].filter(Boolean).length;
      if (homes === 0) unclassified.push(role);
      if (homes > 1) doubled.push(role);
    }
    expect(unclassified, 'a new role must be classified in TENANT_LOCAL_ROLES, PLATFORM_ELEVATED_ROLES or the legacy aliases').toEqual([]);
    expect(doubled).toEqual([]);
    expect(organization.size).toBe(TENANT_LOCAL_ROLES.length);
  });

  it('lists in TENANT_LOCAL_ROLES only roles the code catalog defines, highest level first', () => {
    const levels = TENANT_LOCAL_ROLES.map((role) => getRoleLevel(role));
    expect(levels).toEqual([...levels].sort((a, b) => b - a));
    for (const role of TENANT_LOCAL_ROLES) expect(ROLE_PERMISSIONS[role], role).toBeDefined();
  });

  it('seeds no platform-elevated role', () => {
    const seeded = new Set(systemRoles().map((role) => role.code));
    expect(PLATFORM_ELEVATED_ROLES.filter((role) => seeded.has(role))).toEqual([]);
    expect(Math.max(...systemRoles().map((role) => role.level))).toBeLessThan(Math.min(...PLATFORM_ELEVATED_ROLES.map((role) => getRoleLevel(role as UserRole))));
  });

  it('seeds each role at the level and with the permissions the code gives it', () => {
    const roles = systemRoles();
    expect(roles.map((role) => role.code).sort()).toEqual([...TENANT_LOCAL_ROLES].sort());
    for (const role of roles) {
      expect(role.level, `${role.code} level`).toBe(getRoleLevel(role.code as UserRole));
      expect(role.permissions, `${role.code} permissions`).toEqual([...new Set<string>(ROLE_PERMISSIONS[role.code as UserRole])].sort());
      expect(role.permissions.length, `${role.code} has permissions`).toBeGreaterThan(0);
    }
  });

  it("agrees with the guard's hierarchy wherever the guard lists the role, and the unlisted ones are the pinned few", () => {
    const hierarchy = ROLE_HIERARCHY as Record<string, number>;
    const unlisted: string[] = [];
    for (const role of systemRoles()) {
      if (role.code in hierarchy) expect(hierarchy[role.code], `${role.code} level in ROLE_HIERARCHY`).toBe(role.level);
      else unlisted.push(role.code);
    }
    expect(unlisted).toEqual([...ABSENT_FROM_GUARD_HIERARCHY]);
  });

  it('matches the committed platform migration 0076 and its rollback', () => {
    expect(committed('0076_enhanced_rbac_catalog.sql'), 'run `npx tsx scripts/generate-rbac-catalog-migration.ts` and re-register the migration').toBe(renderCatalogMigration());
    expect(committed('0076_enhanced_rbac_catalog.rollback.sql')).toBe(renderCatalogRollback());
  });
});
