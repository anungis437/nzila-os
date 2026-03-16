/**
 * Cross-org analytics — aggregates metrics across all organisations.
 * Requires platform-level auth (platform_lead or higher).
 */
import { withApi } from '@/lib/api/with-api';
import { db } from '@/db/db';
import { analyticsMetrics } from '@/db/schema';
import { desc, count } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'platform_lead' },
    openapi: { tags: ['Analytics'], summary: 'Cross-org analytics metrics' },
  },
  async () => {
    const rows = await db.select().from(analyticsMetrics).orderBy(desc(analyticsMetrics.createdAt)).limit(200);
    const [{ value: total }] = await db.select({ value: count() }).from(analyticsMetrics);
    return { items: rows, total };
  },
);
