import { and, eq, isNull, sql } from 'drizzle-orm';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { ROLE_HIERARCHY } from '@/lib/api-auth-guard';
import { currentStateContextEnabled } from '@/lib/auth/canonical-bootstrap';

/**
 * Which organizations a signed-in caller may read, and how much of each.
 *
 * Authority over an organization's content is direct and specific: it comes from the caller's own live membership there (issue #1116).
 * The organization hierarchy is an affiliation graph, not an access-control list: administering an organization above another one does not
 * confer the other organization's roster, contacts, member counts, grievance figures, analytics, settings, billing, legal or financial data.
 * A platform title confers nothing here either; platform operations need their own separately authorized capabilities. Cross-organization
 * grants and break-glass access are not built, so they stay denied.
 *
 * What an administrator above an organization may see is that it is affiliated: its directory entry (see {@link directoryProjection}) and no
 * more. Anything else reads as not found.
 */
export interface OrganizationAccess {
  /** organizationId -> the caller's role there. Active, non-removed memberships only. */
  direct: ReadonlyMap<string, string>;
  /**
   * Organizations strictly below one where the caller is a direct administrator, excluding those where the caller is a direct member.
   * Visible as a directory entry only.
   */
  affiliated: ReadonlySet<string>;
}

const ADMIN_RANK = ROLE_HIERARCHY.admin;
const roleRank = (role: string) => ROLE_HIERARCHY[role as keyof typeof ROLE_HIERARCHY] ?? 0;
export const isAdministrativeRole = (role: string | undefined) => roleRank(role ?? '') >= ADMIN_RANK;

const MAX_AFFILIATED = 5000;

async function directMemberships(userId: string): Promise<Array<{ organizationId: string; role: string }>> {
  if (currentStateContextEnabled()) {
    // Canonical authority: memberships come from the identity scope, not the compatibility projection.
    const { getCanonicalOrganizationChoices } = await import('@/lib/auth/canonical-organization-selection');
    const choices = await getCanonicalOrganizationChoices();
    return choices.memberships.map((m: { organizationId: string; role: string }) => ({ organizationId: m.organizationId, role: m.role }));
  }
  return withSystemContext((tx) =>
    tx
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
  const memberships = await directMemberships(userId);
  const direct = new Map(memberships.map((m) => [m.organizationId, m.role] as const));
  const administered = memberships.filter((m) => isAdministrativeRole(m.role)).map((m) => m.organizationId);

  const affiliated = new Set<string>();
  if (administered.length > 0) {
    const rows = await withSystemContext((tx) =>
      tx
        .select({ id: organizations.id })
        .from(organizations)
        .where(sql`${organizations.hierarchyPath}::text[] && ARRAY[${sql.join(administered.map((id) => sql`${id}::text`), sql`, `)}]::text[]`)
        .limit(MAX_AFFILIATED),
    );
    for (const row of rows) if (!direct.has(row.id)) affiliated.add(row.id);
  }
  return { direct, affiliated };
}

/** The organization's private profile and content: the caller holds a live membership there. */
export function canReadOrganization(access: OrganizationAccess, organizationId: string): boolean {
  return access.direct.has(organizationId);
}

/** Administrative authority over an organization: the caller's own live membership there carries an administrative role. */
export function canAdministerOrganization(access: OrganizationAccess, organizationId: string): boolean {
  return isAdministrativeRole(access.direct.get(organizationId));
}

/** The caller may know the organization exists and see its directory entry (and nothing more unless {@link canReadOrganization}). */
export function canSeeAffiliation(access: OrganizationAccess, organizationId: string): boolean {
  return access.direct.has(organizationId) || access.affiliated.has(organizationId);
}

/** The caller's role in the organization (undefined when they are not a direct member). */
export const directRoleIn = (access: OrganizationAccess, organizationId: string) => access.direct.get(organizationId);

/** Every organization whose private profile the caller may read: their direct memberships. */
export function readableOrganizationIds(access: OrganizationAccess): string[] {
  return [...access.direct.keys()];
}

/** Every organization the caller may see a directory entry for: direct memberships and the organizations affiliated below one they administer. */
export function affiliationOrganizationIds(access: OrganizationAccess): string[] {
  return [...new Set([...access.direct.keys(), ...access.affiliated])];
}

type DirectoryRow = Pick<
  typeof organizations.$inferSelect,
  'id' | 'name' | 'slug' | 'organizationType' | 'parentId' | 'hierarchyLevel' | 'hierarchyPath' | 'status'
>;

/**
 * The directory entry of an organization: what an affiliated (not directly authorized) caller may see. Identity and placement in the
 * hierarchy only: no contacts, counts, settings, billing, provenance or activity.
 */
export function directoryProjection(row: DirectoryRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    organization_type: row.organizationType,
    parent_id: row.parentId ?? null,
    hierarchy_level: row.hierarchyLevel,
    hierarchy_path: row.hierarchyPath,
    status: row.status,
  };
}

export const UUID_PATTERN = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;

/**
 * The organization this one sits directly below, read as the system role from the organization's own row. The hierarchy is the platform's record, not a
 * caller's claim: it is what lets a child receive what its parent shares with it (the parent's shared knowledge-base rows), and a caller cannot name
 * another parent. A top-level organization has none.
 */
export async function verifiedParentOf(organizationId: string): Promise<string | undefined> {
  const [row] = await withSystemContext((tx) =>
    tx.select({ parentId: organizations.parentId }).from(organizations).where(eq(organizations.id, organizationId)).limit(1),
  );
  return row?.parentId ?? undefined;
}
