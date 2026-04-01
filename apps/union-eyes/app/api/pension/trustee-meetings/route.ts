import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionTrusteeMeetings } from '@/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const createMeetingSchema = z.object({
  title: z.string().max(255),
  scheduledDate: z.coerce.date(),
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
    openapi: { tags: ['Pension'], summary: 'List trustee meetings', description: 'List all trustee meetings for the organization' },
  },
  async ({ _request, organizationId }) => {
    const meetings = await db
      .select()
      .from(pensionTrusteeMeetings)
      .where(eq(pensionTrusteeMeetings.organizationId, organizationId!))
      .orderBy(desc(pensionTrusteeMeetings.createdAt));
    return meetings;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Pension'], summary: 'Create trustee meeting', description: 'Schedule a new trustee meeting' },
  },
  async ({ body, organizationId }) => {
    const parsed = createMeetingSchema.parse(body);
    const [meeting] = await db
      .insert(pensionTrusteeMeetings)
      .values({ ...parsed, organizationId: organizationId! })
      .returning();
    return meeting;
  },
);

