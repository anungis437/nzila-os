/**
 * Bargaining proposal item routes. A proposal has no organization_id of its own:
 * authorization is inherited from its parent negotiation.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { db } from '@/db/db';
import { bargainingProposals, negotiations } from '@/db/schema';
import { and, eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const { GET, PATCH, DELETE: rawDELETE } = crudRoutes({
  table: bargainingProposals,
  pk: 'id',
  tags: ['Bargaining'],
  orgScoped: true,
  parentScope: { column: 'negotiationId', parent: negotiations },
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
});

/**
 * Keep the factory's audited delete and its parent predicate, but return a
 * controlled not-found for a foreign proposal BEFORE attempting a DELETE.
 * Some legacy PG15/16 grants reply with a database error on DELETE even when
 * the RLS-scoped mutation would change zero rows. This preflight also makes
 * the parent authorization explicit at the route's method boundary.
 *
 * This is NOT a substitute for fixing native DELETE grants and policies:
 * the original factory performs the write with the same parent predicate.
 */
const DELETE = withApi({
  auth: { required: true, minRole: 'admin' },
  rlsOrgContext: true,
  openapi: { tags: ['Bargaining'], summary: 'Remove a proposal owned by this organization' },
}, async ({ request, params, organizationId, userId }) => {
  if (!organizationId || !userId) throw ApiError.forbidden();
  const id = params.id;
  const [visible] = await db.select({ id: bargainingProposals.id })
    .from(bargainingProposals)
    .where(and(
      eq(bargainingProposals.id, id),
      inArray(
        bargainingProposals.negotiationId,
        db.select({ id: negotiations.id })
          .from(negotiations)
          .where(eq(negotiations.organizationId, organizationId)),
      ),
    )).limit(1);
  if (!visible) throw ApiError.notFound('Proposal not found');
  // The audited CRUD implementation rechecks parent ownership at write time.
  return rawDELETE(request, { params: Promise.resolve(params) });
});

export { GET, PATCH, DELETE };
