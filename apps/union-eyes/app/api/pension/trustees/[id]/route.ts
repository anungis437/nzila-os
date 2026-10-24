import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { pensionTrustees } from '@/db/schema';
import { eq, and } from 'drizzle-orm';
import { capabilityNotImplementedResponse } from '@/lib/finance/financial-authority';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Get trustee', description: 'Get a single trustee by ID' },
  },
  async ({ params, organizationId }) => {
    const id = params.id;
    const [trustee] = await db
      .select()
      .from(pensionTrustees)
      .where(and(eq(pensionTrustees.id, id), eq(pensionTrustees.organizationId, organizationId!)));
    return trustee ?? null;
  },
);

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Update trustee', description: 'Not implemented: trustee administration requires an independently verified authority' },
  },
  async () =>
    capabilityNotImplementedResponse(
      'pension-trustee-administration',
      'Trustee administration requires an independently verified trustee-administration authority, which is not implemented.',
    ),
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: { tags: ['Pension'], summary: 'Delete trustee', description: 'Not implemented: trustee administration requires an independently verified authority' },
  },
  async () =>
    capabilityNotImplementedResponse(
      'pension-trustee-administration',
      'Trustee administration requires an independently verified trustee-administration authority, which is not implemented.',
    ),
);

