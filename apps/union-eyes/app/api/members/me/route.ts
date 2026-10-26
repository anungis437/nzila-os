/**
 * The caller's own membership in their active organization. Read-only; sourced from
 * organization_members for the authenticated user only. Replaces a generic CRUD handler over the
 * billing `profiles` table, which exposed billing identifiers and was not membership data.
 */
import { sql } from 'drizzle-orm';
import { withApi } from '@/lib/api/with-api';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';

export const dynamic = 'force-dynamic';

interface MembershipRow extends Record<string, unknown> {
  status: string | null;
  membership_number: string | null;
  member_category: string | null;
  joined_at: Date | string | null;
  union_join_date: Date | string | null;
  department: string | null;
  position: string | null;
  organization_name: string | null;
}

const iso = (d: Date | string | null) => (d ? new Date(d).toISOString() : null);

export const GET = withApi(
  { auth: { required: true, minRole: 'member' }, openapi: { tags: ['Members'], summary: 'My membership' } },
  async () => {
    const actor = await getCaseActor();
    const rows = await withRLSContext(async (tx) =>
      tx.execute<MembershipRow>(sql`
        SELECT m.status, m.membership_number, m.member_category, m.joined_at, m.union_join_date,
               m.department, m.position, COALESCE(o.display_name, o.name) AS organization_name
        FROM organization_members m
        JOIN organizations o ON o.id = m.organization_id
        WHERE m.user_id = ${actor.userId} AND m.organization_id = ${actor.organizationId} AND m.deleted_at IS NULL
        LIMIT 1`),
    );
    const row = rows[0];
    // An absent record is reported as absent, never defaulted to an active membership.
    if (!row) return { membership: null };
    return {
      membership: {
        organizationName: row.organization_name,
        status: row.status,
        membershipNumber: row.membership_number,
        category: row.member_category,
        joinedAt: iso(row.union_join_date ?? row.joined_at),
        department: row.department,
        position: row.position,
      },
    };
  },
);
