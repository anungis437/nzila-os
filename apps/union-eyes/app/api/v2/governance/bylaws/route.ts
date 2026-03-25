/**
 * GET POST /api/v2/governance/bylaws
 * Organization bylaws backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { bylaws } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createBylawSchema = z.object({
  article: z.string().min(1).max(100),
  title: z.string().min(1).max(1000),
  content: z.string().min(1).max(50000),
  version: z.number().int().min(1).default(1),
  status: z.enum(['active', 'proposed', 'archived']).default('active'),
  metadata: z.record(z.unknown()).optional(),
});

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
    return rows;
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body, organizationId }) => {
    const parsed = createBylawSchema.parse(body);
    const [row] = await db.insert(bylaws).values({ ...parsed, organizationId: organizationId! }).returning();
    return row;
  },
);
