/**
 * One organization as the organization routes send it to the browser (the organizations a person belongs to, the hierarchy path, the organization just switched to) and as the
 * organization context reads it. A column the row does not carry is null, never a stand-in type or the time of the request: a screen shows "not recorded" for a date the
 * database does not have, and the organization type is the row's own.
 */
import type { InferSelectModel } from 'drizzle-orm';
import type { organizations } from '@/db/schema-organizations';

export type OrganizationWireRow = Pick<
  InferSelectModel<typeof organizations>,
  'id' | 'name' | 'slug' | 'organizationType' | 'parentId' | 'sectors' | 'provinceTerritory' | 'description' | 'createdAt' | 'updatedAt'
>;

export function organizationWire(row: OrganizationWireRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.organizationType,
    parentId: row.parentId ?? null,
    sector: row.sectors?.[0] ?? null,
    jurisdiction: row.provinceTerritory ?? null,
    description: row.description ?? null,
    createdAt: row.createdAt?.toISOString() ?? null,
    updatedAt: row.updatedAt?.toISOString() ?? null,
  };
}

export type OrganizationWire = ReturnType<typeof organizationWire>;

export type OrganizationDirectoryWireRow = Pick<
  InferSelectModel<typeof organizations>,
  'id' | 'name' | 'slug' | 'organizationType' | 'parentId' | 'hierarchyLevel' | 'hierarchyPath' | 'status'
>;

/**
 * The directory entry of an organization in the same key style as {@link organizationWire}: what a caller who is only affiliated with it (an
 * administrator above it, not a member of it) receives. Identity and placement only; the snake_case form is read-authority's directoryProjection.
 */
export function organizationDirectoryWire(row: OrganizationDirectoryWireRow) {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    type: row.organizationType,
    parentId: row.parentId ?? null,
    hierarchyLevel: row.hierarchyLevel ?? 0,
    hierarchyPath: row.hierarchyPath,
    status: row.status ?? 'active',
  };
}
