/**
 * GET POST /api/v2/governance/signatories
 * Organization signatories backed by PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { signatories } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createSignatorySchema = z.object({
  name: z.string().min(1).max(255),
  role: z.string().min(1).max(100),
  title: z.string().min(1).max(255),
  authority: z.enum(['full', 'limited', 'signatory', 'witness']).default('limited'),
  activeFrom: z.coerce.date(),
  activeTo: z.coerce.date().optional(),
  status: z.enum(['active', 'inactive', 'suspended']).default('active'),
  documents: z.array(z.record(z.unknown())).default([]),
  metadata: z.record(z.unknown()).optional(),
});

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
    return rows;
  },
);

export const POST = withApi(
  { auth: { required: true, minRole: 'admin' } },
  async ({ body, organizationId }) => {
    const parsed = createSignatorySchema.parse(body);
    const [row] = await db.insert(signatories).values({ ...parsed, organizationId: organizationId! }).returning();
    return row;
  },
);
