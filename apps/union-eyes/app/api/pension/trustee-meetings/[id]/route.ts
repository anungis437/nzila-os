import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';
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
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: { tags: ['Pension'], summary: 'Update trustee meeting', description: 'Update an existing trustee meeting' },
  },
  async ({ params, body, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const id = params.id;
    const changes = updateMeetingSchema.parse(body);
    return withRLSContext({ organizationId }, async (tx) => {
      const [meeting] = await tx
        .update(pensionTrusteeMeetings)
        .set({ ...changes, updatedAt: new Date() })
        .where(and(eq(pensionTrusteeMeetings.id, id), eq(pensionTrusteeMeetings.organizationId, organizationId)))
        .returning();
      if (!meeting) throw ApiError.notFound('Trustee meeting');
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.trustee_meeting.update',
        resourceType: 'pension_trustee_meetings',
        resourceId: id,
        details: { fields: Object.keys(changes), status: changes.status },
      });
      return meeting;
    });
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: { tags: ['Pension'], summary: 'Delete trustee meeting', description: 'Delete a trustee meeting' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.badRequest('Organization context required');
    const id = params.id;
    return withRLSContext({ organizationId }, async (tx) => {
      const [meeting] = await tx
        .delete(pensionTrusteeMeetings)
        .where(and(eq(pensionTrusteeMeetings.id, id), eq(pensionTrusteeMeetings.organizationId, organizationId)))
        .returning();
      if (!meeting) throw ApiError.notFound('Trustee meeting');
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'pension.trustee_meeting.delete',
        resourceType: 'pension_trustee_meetings',
        resourceId: id,
        details: { title: meeting.title },
      });
      return meeting;
    });
  },
);

