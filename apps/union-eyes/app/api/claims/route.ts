/**
 * CRUD collection route for claims
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { claims } from '@/db/schema';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const handlers = crudRoutes({
  table: claims,
  pk: 'claimId',
  tags: ["Claims"],
  orgScoped: true,
  ownerColumn: 'memberId',
  readRole: 'member',
  writeRole: 'member',
});

export const GET = handlers.GET;

/**
 * Custom POST: auto-generates claimNumber (CLM-YYYYMMDD-XXXX)
 * and auto-sets memberId from the authenticated user.
 */
export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Claims'],
      summary: 'Create claim',
      description: 'Creates a new claim with auto-generated claim number.',
    },
  },
  async ({ request, organizationId, userId }) => {
    const body = await request.json();

    // Generate claim number: CLM-YYYYMMDD-XXXX
    const today = new Date();
    const datePart = today.toISOString().slice(0, 10).replace(/-/g, '');
    const prefix = `CLM-${datePart}-`;

    const result = await db.execute<{ max_num: string | null }>(
      sql`SELECT MAX(claim_number) AS max_num FROM claims WHERE claim_number LIKE ${prefix + '%'}`
    );
    const maxNum = result.rows?.[0]?.max_num;
    let seq = 1;
    if (maxNum) {
      const lastSeq = parseInt(maxNum.slice(prefix.length), 10);
      if (!isNaN(lastSeq)) seq = lastSeq + 1;
    }
    const claimNumber = `${prefix}${String(seq).padStart(4, '0')}`;

    const values = {
      ...body,
      claimNumber,
      organizationId,
      memberId: userId,
    };

    const [row] = await db.insert(claims).values(values).returning();
    return { data: row };
  },
);
