import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { PENSION_ADMIN_ROLES } from '@/lib/pension/pension-authority';
import { pensionTrusteeMeetings } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: { tags: ['Pension'], summary: 'Get trustee meeting (pension financial administrator only)', description: 'Tenant-scoped, audited confidential trustee meeting' },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden('Pension organization context required');
    const id = params.id;
    return withRLSContext({ organizationId, userId }, async (tx) => {
      const [meeting] = await tx
        .select()
        .from(pensionTrusteeMeetings)
        .where(and(eq(pensionTrusteeMeetings.id, id), eq(pensionTrusteeMeetings.organizationId, organizationId)));
      if (!meeting) throw ApiError.notFound('Trustee meeting');
      await persistAtomicAudit(tx, {
        organizationId, userId,
        action: 'pension.trustee_meeting.read',
        resourceType: 'pension_trustee_meetings',
        resourceId: id,
        details: { meetingId: id },
      });
      return meeting;
    });
  },
);

/**
 * DEF-0B10-PEN-TRUSTEE-MEETING-MINUTES-CAN-BE-REWRITTEN-OR-DELETED-WITHOUT-HISTORY
 * An ordinary audit entry recording field names does not preserve the original
 * minutes, agenda or attendees, and hard deletion destroys the primary record.
 * No governed immutable revision or retention model has been accepted yet.
 * Keep reads available to authorized pension administrators, but fail closed
 * on edits and deletions rather than silently destroy meeting evidence.
 */
const unavailableMutation = () => NextResponse.json(
  {
    error: 'TRUSTEE_MEETING_REVISION_NOT_IMPLEMENTED',
    message: 'Trustee meeting amendments and deletion require governed version history, retention and institutional approval.',
  },
  { status: 501, headers: { 'Cache-Control': 'private, no-store' } },
);

export const PATCH = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: {
      tags: ['Pension'],
      summary: 'Amend trustee meeting (not implemented)',
      description: 'Refused until immutable minutes revisions and an approved amendment mandate exist.',
    },
  },
  unavailableMutation,
);

export const DELETE = withApi(
  {
    auth: { required: true, roles: PENSION_ADMIN_ROLES },
    openapi: {
      tags: ['Pension'],
      summary: 'Delete trustee meeting (not implemented)',
      description: 'Refused until retention, legal holds and governed disposal authorization exist.',
    },
  },
  unavailableMutation,
);
