import { withApi } from '@/lib/api/framework';
import { listPage } from '@/lib/api/list-page';
import { db } from '@/db/db';
import { pensionTrustees } from '@/db/schema';
import { eq, and, desc } from 'drizzle-orm';
import { capabilityNotImplementedResponse } from '@/lib/finance/financial-authority';

export const dynamic = 'force-dynamic';

// A list answers at most this many rows per page; offset pages through the rest.
const LIST_LIMIT = 200;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'List trustees', description: 'List all pension trustees for the organization' },
  },
  async ({ request, organizationId }) => {
    const page = listPage(request, LIST_LIMIT);
    const url = new URL(request.url);
    const activeOnly = url.searchParams.get('activeOnly') === 'true';

    const conditions = [eq(pensionTrustees.organizationId, organizationId!)];
    if (activeOnly) {
      conditions.push(eq(pensionTrustees.status, 'active'));
    }

    const trustees = await db
      .select()
      .from(pensionTrustees)
      .where(and(...conditions))
      .orderBy(desc(pensionTrustees.createdAt)).limit(page.limit).offset(page.offset);
    return trustees;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Add trustee', description: 'Not implemented: trustee appointment requires an independently verified trustee-administration authority' },
  },
  async () =>
    capabilityNotImplementedResponse(
      'pension-trustee-appointment',
      'Trustee appointment requires an independently verified trustee-administration authority, which is not implemented. Steward and Secretary-Treasurer roles do not confer it.',
    ),
);

