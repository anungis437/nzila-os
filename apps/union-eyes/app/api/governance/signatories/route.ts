/**
 * GET /api/governance/signatories
 * Canonical signatories feed for the governance dashboard.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationMembers } from '@/db/schema-organizations';
import { and, desc, eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const SIGNATORY_ROLES = [
  'president',
  'vice_president',
  'secretary_treasurer',
  'officer',
  'chief_steward',
] as const;

function authorityForRole(role: string): 'full' | 'limited' | 'financial-only' {
  if (role === 'president') return 'full';
  if (role === 'secretary_treasurer') return 'financial-only';
  return 'limited';
}

function titleForRole(role: string): string {
  return role
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Governance'], summary: 'List authorized signatories' },
  },
  async ({ organizationId }) => {
    const rows = await db
      .select({
        id: organizationMembers.id,
        name: organizationMembers.name,
        role: organizationMembers.role,
        createdAt: organizationMembers.createdAt,
        updatedAt: organizationMembers.updatedAt,
      })
      .from(organizationMembers)
      .where(
        and(
          eq(organizationMembers.organizationId, organizationId!),
          eq(organizationMembers.status, 'active'),
          inArray(organizationMembers.role, SIGNATORY_ROLES as unknown as string[]),
        ),
      )
      .orderBy(desc(organizationMembers.updatedAt));

    return rows.map((row) => ({
      id: row.id,
      name: row.name,
      role: row.role,
      title: titleForRole(row.role),
      authority: authorityForRole(row.role),
      activeFrom: (row.updatedAt ?? row.createdAt)?.toISOString?.() ?? '',
      status: 'active' as const,
      documents: ['bylaw_amendment', 'policy', 'resolution'],
    }));
  },
);
