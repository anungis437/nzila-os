/**
 * Organization hierarchy endpoint
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { organizationRelationships, organizations } from '@/db/schema';
import { eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ["Organization"],
      summary: 'Get organization hierarchy',
      description: 'Returns the organization hierarchy tree.',
    },
  },
  async ({ organizationId }) => {
    const relationships = await db.select().from(organizationRelationships).limit(1000);
    const orgs = await db.select().from(organizations).limit(500);
    return { relationships, organizations: orgs };
  },
);
