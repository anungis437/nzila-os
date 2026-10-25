import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';
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
  async ({ request: _request, organizationId }) => {
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
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: { tags: ['Pension'], summary: 'Create trustee meeting', description: 'Schedule a new trustee meeting' },
  },
  async ({ body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const parsed = createMeetingSchema.parse(body);
    return withRLSContext({ organizationId }, async (tx) => {
      const [meeting] = await tx
        .insert(pensionTrusteeMeetings)
        .values({ ...parsed, organizationId })
        .returning();
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.trustee_meeting.schedule',
        resourceType: 'pension_trustee_meetings',
        resourceId: meeting.id,
        details: { title: parsed.title },
      });
      return meeting;
    });
  },
);

