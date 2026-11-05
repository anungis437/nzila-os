/**
 * The organizations directly below an organization, for the CLC and federation affiliate pages.
 *
 * Under row-level security a tenant session reads only its own row of `organizations`, so a parent can never list its affiliates in its own
 * context: the read is a system read. That is only sound with a decision made before it, and the decision is the one the organization routes
 * already use (lib/organizations/read-authority.ts): the caller must be a platform administrator or an administrator of the organization
 * (a CLC, federation, national or organization administrator holds the administrative rank), and each affiliate returned must be one
 * the caller may read. The page's own role check is not what authorizes the system read.
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
  provinceTerritory: string | null;
  clcAffiliateCode: string | null;
  email: string | null;
  phone: string | null;
  /** The postal address as one line; the column holds a JSON object. */
  address: string | null;
  description: string | null;
  status: string | null;
  /** Active members on file for the affiliate. */
  memberCount: number;
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
    return { children: readable, counts };
  });

  const memberCounts = new Map(counts.map((row) => [row.organizationId, row.memberCount]));
  return children.map((child) => ({
    ...child,
    address: addressLine(child.address),
    memberCount: memberCounts.get(child.id) ?? 0,
  }));
}
