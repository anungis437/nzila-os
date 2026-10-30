import { and, eq, isNull, sql } from 'drizzle-orm';
import { db } from '@/db/db';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { isPlatformAdminUser, ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';

/**
 * Which organizations a signed-in caller may read.
 *
 * Organization routes read the `organizations` table as the system role, which is not tenant-scoped, so the route has to
 * decide. Being signed in is not enough: a caller may read an organization they hold an ACTIVE membership in, the
 * descendants of an organization where they are an administrator, and (for a platform administrator) every organization.
 * Anything else reads as not found.
 */
export interface OrganizationAccess {
  platform: boolean;
  /** organizationId -> the caller's role there. Active memberships only. */
  direct: ReadonlyMap<string, string>;
  /** Organizations below one where the caller is an administrator. */
  descendants: ReadonlySet<string>;
}

const ADMIN_RANK = ROLE_HIERARCHY.admin;
const roleRank = (role: string) => ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] ?? 0;
export const isAdministrativeRole = (role: string | undefined) => roleRank(role ?? '') >= ADMIN_RANK;

const MAX_DESCENDANTS = 5000;

async function directMemberships(userId: string): Promise<Array<{ organizationId: string; role: string }>> {
  if (currentStateContextEnabled()) {
    // Canonical authority: memberships come from the identity scope, not the compatibility projection.
    const { getCanonicalOrganizationChoices } = await import('@/lib/auth/canonical-organization-selection');
    const choices = await getCanonicalOrganizationChoices();
    return choices.memberships.map((m: { organizationId: string; role: string }) => ({ organizationId: m.organizationId, role: m.role }));
  }
  return withSystemContext(() =>
    db
      .select({ organizationId: organizationMembers.organizationId, role: organizationMembers.role })
      .from(organizationMembers)
      .where(and(
        eq(organizationMembers.userId, userId),
        eq(organizationMembers.status, 'active'),
        isNull(organizationMembers.deletedAt),
      )),
  );
}

export async function resolveOrganizationAccess(userId: string): Promise<OrganizationAccess> {
  if (await isPlatformAdminUser(userId)) return { platform: true, direct: new Map(), descendants: new Set() };

  const memberships = await directMemberships(userId);
  const direct = new Map(memberships.map((m) => [m.organizationId, m.role] as const));
  const administered = memberships.filter((m) => isAdministrativeRole(m.role)).map((m) => m.organizationId);

  let descendants = new Set<string>();
  if (administered.length > 0) {
    const rows = await withSystemContext(() =>
      db
        .select({ id: organizations.id })
        .from(organizations)
        .where(sql`${organizations.hierarchyPath}::text[] && ARRAY[${sql.join(administered.map((id) => sql`${id}::text`), sql`, `)}]::text[]`)
        .limit(MAX_DESCENDANTS),
    );
    descendants = new Set(rows.map((row) => row.id));
  }
  return { platform: false, direct, descendants };
}

export function canReadOrganization(access: OrganizationAccess, organizationId: string): boolean {
  return access.platform || access.direct.has(organizationId) || access.descendants.has(organizationId);
}

/** Administrative authority over an organization: its own administrator, an administrator above it, or the platform. */
export function canAdministerOrganization(access: OrganizationAccess, organizationId: string): boolean {
  return access.platform || access.descendants.has(organizationId) || isAdministrativeRole(access.direct.get(organizationId));
}

/** The caller's role in the organization (undefined when they are not a direct member). */
export const directRoleIn = (access: OrganizationAccess, organizationId: string) => access.direct.get(organizationId);

/** Every organization id the caller may read, or null for a platform administrator (no restriction). */
export function readableOrganizationIds(access: OrganizationAccess): string[] | null {
  if (access.platform) return null;
  return [...new Set([...access.direct.keys(), ...access.descendants])];
}

export const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
