/**
 * GET POST /api/v2/governance/signatories
 * Organization signatories backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { signatories } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ organizationId }) => {
    const rows = await db
      .select()
      .from(signatories)
      .where(eq(signatories.organizationId, organizationId!))
      .orderBy(desc(signatories.createdAt))
      .limit(50);
    return { data: rows, total: rows.length };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body, organizationId }) => {
    const [row] = await db.insert(signatories).values({ ...body, organizationId: organizationId! }).returning();
    return { data: row };
  },
);
