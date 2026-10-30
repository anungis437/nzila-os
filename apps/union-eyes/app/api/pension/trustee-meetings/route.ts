/**
 * Pension trustee meeting records contain confidential agendas, minutes and attendees.
 * DEF-0B10-PEN-TRUSTEE-MEETING-READS-RETURN-AGENDA-MINUTES-AND-ATTENDEES-TO-ANY-MEMBER
 * Until trustee mandates are issued, only the existing pension financial administrator
 * role may read them. This engineering restriction is not an institutional mandate.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';
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

const pageSchema = z.object({
  page: z.coerce.number().int().min(1).max(10000),
  pageSize: z.coerce.number().int().min(1).max(100),
});

export const GET = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: { tags: ['Pension'], summary: 'List trustee meetings (pension financial administrator only)', description: 'Tenant-scoped, audited, paginated trustee meeting list' },
  },
  async ({ request, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Pension organization context required');
    const url = new URL(request.url);
    const rawPage = url.searchParams.get('page') ?? '1';
    const rawPageSize = url.searchParams.get('pageSize') ?? '50';
    if (!/^[1-9]\\d*$/.test(rawPage) || !/^[1-9]\\d*$/.test(rawPageSize)) {
      throw ApiError.badRequest('Invalid trustee meeting pagination');
    }
    const parsed = pageSchema.safeParse({ page: rawPage, pageSize: rawPageSize });
    if (!parsed.success) throw ApiError.badRequest('Invalid trustee meeting pagination');
    const { page, pageSize } = parsed.data;
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const meetings = await tx
        .select()
        .from(pensionTrusteeMeetings)
        .where(eq(pensionTrusteeMeetings.organizationId, organizationId))
        .orderBy(desc(pensionTrusteeMeetings.createdAt), desc(pensionTrusteeMeetings.id))
        .limit(pageSize)
        .offset((page - 1) * pageSize);
      await persistAtomicAudit(tx, {
        organizationId, userId,
        action: 'pension.trustee_meeting.list_read',
        resourceType: 'pension_trustee_meetings',
        resourceId: organizationId,
        details: { page, pageSize, rows: meetings.length },
      });
      return meetings;
    });
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
