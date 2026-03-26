/**
 * Case evidence route — returns attachments from claim JSONB field.
 */
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Cases'],
      summary: 'List case evidence',
      description: 'Returns the attachments array from the claim.',
    },
  },
  async ({ params, organizationId, userId }) => {
    const id = params.caseId;

    // Resolve organizationId fallback
    let orgId = organizationId;
    if (!orgId && userId) {
      const memberRows = await withRLSContext(async () => db.execute(
        sql`SELECT organization_id FROM organization_members WHERE user_id = ${userId} LIMIT 1`,
      ));
      orgId = (memberRows[0] as { organization_id?: string } | undefined)?.organization_id ?? null;
    }

    const orgFilter = orgId
      ? sql`AND c.organization_id = ${orgId}::uuid`
      : userId
        ? sql`AND c.member_id = ${userId}`
        : sql`AND FALSE`;

    const rows = await withRLSContext(async () => db.execute(sql`
      SELECT c.attachments
      FROM claims c
      WHERE (c.claim_number = ${id} OR c.claim_id::text = ${id})
        ${orgFilter}
      LIMIT 1
    `));

    const row = rows[0] as { attachments?: unknown } | undefined;
    if (!row) throw ApiError.notFound('Case not found');

    // attachments is a JSONB array — normalize to always return an array
    const attachments = Array.isArray(row.attachments) ? row.attachments : [];
    return attachments;
  },
);
