/**
 * The organizations directly below an organization, for the CLC and federation affiliate pages.
 *
 * Under row-level security a tenant session reads only its own row of `organizations`, so a parent can never list its affiliates in its own
 * context: the read is a system read. That is only sound with a decision made before it, and the decision is the one the organization routes
 * already use (lib/organizations/read-authority.ts): the caller must be an administrator of the organization through their own live
 * membership there (a CLC, federation, national or organization administrator holds the administrative rank; a platform title confers
 * nothing). The page's own role check is not what authorizes the system read.
 *
 * The hierarchy is an affiliation graph, not an access grant: administering the parent shows that an affiliate exists and its directory
 * entry (name, type, status). Its province, affiliate code, contact details, description and member count are given only for an
 * affiliate the caller is a direct member of; elsewhere they are null, which the pages show as not available.
 */
import { and, asc, count, eq, inArray, isNull } from 'drizzle-orm';
import { organizationMembers, organizations } from '@/db/schema-organizations';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { canAdministerOrganization, canReadOrganization, resolveOrganizationAccess } from '@/lib/organizations/read-authority';

export class AffiliateAccessError extends Error {
  constructor() {
    super('Not an administrator of this organization');
    this.name = 'AffiliateAccessError';
  }
}

export interface AffiliateRow {
  id: string;
  name: string;
  organizationType: string;
  /** Null unless the caller is a direct member of the affiliate. */
  provinceTerritory: string | null;
  /** Null unless the caller is a direct member of the affiliate. */
  clcAffiliateCode: string | null;
  /** Null unless the caller is a direct member of the affiliate. */
  email: string | null;
  /** Null unless the caller is a direct member of the affiliate. */
  phone: string | null;
  /** The postal address as one line; the column holds a JSON object. Null unless the caller is a direct member of the affiliate. */
  address: string | null;
  /** Null unless the caller is a direct member of the affiliate. */
  description: string | null;
  status: string | null;
  /** Active members on file for the affiliate; null unless the caller is a direct member of it. */
  memberCount: number | null;
}

/** The keys the address column is declared with, in the order a postal address is written. */
const ADDRESS_ORDER = ['street', 'unit', 'city', 'province', 'postal_code', 'country'];

/** A one-line address from the JSON the column holds: a string as it is, an object as its text and number values in postal order (jsonb does not keep key order). */
export function addressLine(address: unknown): string | null {
  if (typeof address === 'string') return address.trim() || null;
  if (address && typeof address === 'object' && !Array.isArray(address)) {
    const record = address as Record<string, unknown>;
    const keys = [...ADDRESS_ORDER.filter((key) => key in record), ...Object.keys(record).filter((key) => !ADDRESS_ORDER.includes(key)).sort()];
    const parts = keys
      .map((key) => record[key])
      .filter((value): value is string | number => (typeof value === 'string' && value.trim() !== '') || typeof value === 'number')
      .map((value) => String(value).trim());
    return parts.length > 0 ? parts.join(', ') : null;
  }
  return null;
}

export async function listAffiliates(input: { userId: string; organizationId: string }): Promise<AffiliateRow[]> {
  const { userId, organizationId } = input;
  const access = await resolveOrganizationAccess(userId);
  if (!canAdministerOrganization(access, organizationId)) throw new AffiliateAccessError();

  const { children, counts } = await withSystemContext(async (tx) => {
    const children = await tx
      .select({
        id: organizations.id,
        name: organizations.name,
        organizationType: organizations.organizationType,
        provinceTerritory: organizations.provinceTerritory,
        clcAffiliateCode: organizations.clcAffiliateCode,
        email: organizations.email,
        phone: organizations.phone,
        address: organizations.address,
        description: organizations.description,
        status: organizations.status,
      })
      .from(organizations)
      .where(eq(organizations.parentId, organizationId))
      .orderBy(asc(organizations.name));
    const readable = children.filter((child) => canReadOrganization(access, child.id));
    const counts =
      // Counted as the system role over the affiliates the caller is a direct member of only.
      readable.length === 0
        ? []
        : await tx
            .select({ organizationId: organizationMembers.organizationId, memberCount: count() })
            .from(organizationMembers)
            .where(
              and(
                inArray(organizationMembers.organizationId, readable.map((child) => child.id)),
                eq(organizationMembers.status, 'active'),
                isNull(organizationMembers.deletedAt),
              ),
            )
            .groupBy(organizationMembers.organizationId);
    return { children, counts };
  });

  const memberCounts = new Map(counts.map((row) => [row.organizationId, row.memberCount]));
  return children.map((child) => {
    if (!canReadOrganization(access, child.id)) {
      // Affiliation metadata (where the affiliate sits and its affiliate code) stays visible; contacts, address, description and membership
      // figures are the affiliate's own and need a direct membership (#1116).
      return { ...child, email: null, phone: null, address: null, description: null, memberCount: null };
    }
    return { ...child, address: addressLine(child.address), memberCount: memberCounts.get(child.id) ?? 0 };
  });
}
