/**
 * GET POST /api/v2/governance/bylaws
 * Organization bylaws backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { bylaws } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'officer' } },
  async ({ organizationId }) => {
    const rows = await db
      .select()
      .from(bylaws)
      .where(eq(bylaws.organizationId, organizationId!))
      .orderBy(desc(bylaws.createdAt))
      .limit(50);
    return { data: rows, total: rows.length };
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body, organizationId }) => {
    const [row] = await db.insert(bylaws).values({ ...(body as Record<string, unknown>), organizationId: organizationId! } as typeof bylaws.$inferInsert).returning();
    return { data: row };
  },
);
