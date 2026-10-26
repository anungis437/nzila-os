/**
 * POST /api/elections/[id]/succession
 *
 * A certified council election is superseded only by an authority-kernel grant.
 * This route does not read a grant, a mandate id, or a successor body from the
 * request. It asks the succession service with no grant, which writes nothing.
 * The council vote route stays 501 until a qualified electorate exists.
 */
import { withApi, ApiError, ErrorCode } from '@/lib/api/framework';
import { GOVERNANCE_SYSTEM_ROLES } from '@/lib/api-auth-guard';
import { db } from '@/db';
import { councilElections } from '@/db/schema/governance-schema';
import { eq } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { drizzleExecutor } from '@/lib/authority/store/route-adapter';
import { recordCertifiedSupersession } from '@/lib/voting/election-succession';

export const dynamic = 'force-dynamic';

export const POST = withApi(
  {
    auth: { required: true, roles: [...GOVERNANCE_SYSTEM_ROLES] },
    openapi: {
      tags: ['Governance'],
      summary: 'Supersede a certified council election',
      description: 'Fails closed. A request body is not an authority-kernel grant, so no successor is written.',
    },
  },
  async ({ params, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const [existing] = await db.select({ id: councilElections.id }).from(councilElections).where(eq(councilElections.id, params.id)).limit(1);
    if (!existing) throw ApiError.notFound('Election not found');

    const result = await withSystemContext(async (tx) => recordCertifiedSupersession(drizzleExecutor(tx), params.id, null, organizationId));
    if (!result.ok && result.code === 'STORE_UNAPPLIED') throw new ApiError(ErrorCode.NOT_IMPLEMENTED, result.message);
    if (!result.ok) throw ApiError.conflict(result.message);
    throw ApiError.conflict('A certified successor was not written. The route has no authority-kernel grant.');
  },
);
