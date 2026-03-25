import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionTrusteeMeetings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { z } from 'zod';

const updateMeetingSchema = z.object({
  title: z.string().max(255).optional(),
  scheduledDate: z.coerce.date().optional(),
  location: z.string().max(255).optional(),
  agenda: z.string().optional(),
  minutes: z.string().optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  attendees: z.array(z.unknown()).optional(),
});

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Get trustee meeting', description: 'Get a single trustee meeting by ID' },
  },
  async ({ params, organizationId }) => {
    const id = params.id;
    const [meeting] = await db
      .select()
      .from(pensionTrusteeMeetings)
      .where(and(eq(pensionTrusteeMeetings.id, id), eq(pensionTrusteeMeetings.organizationId, organizationId!)));
    return meeting ?? null;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Update trustee meeting', description: 'Update an existing trustee meeting' },
  },
  async ({ params, body, organizationId }) => {
    const id = params.id;
    const [meeting] = await db
      .update(pensionTrusteeMeetings)
      .set({ ...updateMeetingSchema.parse(body), updatedAt: new Date() })
      .where(and(eq(pensionTrusteeMeetings.id, id), eq(pensionTrusteeMeetings.organizationId, organizationId!)))
      .returning();
    return meeting ?? null;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Delete trustee meeting', description: 'Delete a trustee meeting' },
  },
  async ({ params, organizationId }) => {
    const id = params.id;
    const [meeting] = await db
      .delete(pensionTrusteeMeetings)
      .where(and(eq(pensionTrusteeMeetings.id, id), eq(pensionTrusteeMeetings.organizationId, organizationId!)))
      .returning();
    return meeting ?? null;
  },
);

