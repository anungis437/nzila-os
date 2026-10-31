import { and, eq } from 'drizzle-orm';
import { NextResponse } from 'next/server';
import { db } from '@/db/db';
import { grievances } from '@/db/schema/domains/claims/grievances';
import { withExternalMatterResourceAuth } from '@/lib/external-resource-middleware';
import { resolveExternalGrievanceResource } from '@/lib/external-resource-route-utils';
import { toExternalMatterProjection } from '@/lib/services/external-matter-projection-service';

export const GET = withExternalMatterResourceAuth(
  {
    requiredPermission: 'view',
    resolve: resolveExternalGrievanceResource,
  },
  async (_request, context) => {
    // Only the columns the projection exposes are read, under the names the grievance table really has: the table has no case
    // number or summary column, so the earlier whole-row read left both empty.
    const [row] = await db
      .select({
        id: grievances.id,
        caseNumber: grievances.grievanceNumber,
        title: grievances.title,
        status: grievances.status,
        step: grievances.step,
        filedDate: grievances.filedDate,
        responseDeadline: grievances.responseDeadline,
        summary: grievances.description,
      })
      .from(grievances)
      .where(
        and(
          eq(grievances.id, context.matterId),
          eq(grievances.organizationId, context.organizationId),
        ),
      )
      .limit(1);

    if (!row) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    return NextResponse.json({ data: toExternalMatterProjection(row) });
  },
);

