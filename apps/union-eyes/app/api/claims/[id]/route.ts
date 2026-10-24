/**
 * CRUD item route for claims
 * Custom GET to include member contact info via JOIN.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { claims } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor } from '@/lib/cases/case-authorization';
import { claimDetailQuery } from '@/lib/cases/claim-detail-query';

export const dynamic = 'force-dynamic';

// Custom GET with member JOIN. Read authority is the canonical case contract
// (lib/cases/case-authorization): members read their own cases, staff their own or
// assigned cases, and only the claims-module tenant-wide role tier reads tenant-wide
// (a known role-matrix gap, UE-CONV-E-001). Unreadable and
// nonexistent cases are indistinguishable (404), and an unresolved role or
// organization fails closed before any query runs.
const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Claims'],
      summary: 'Get claim by ID',
      description: 'Returns a single claim with member contact info.',
    },
  },
  async ({ params }) => {
    const id = params.id;

    const actor = await getCaseActor();

    const rows = await withRLSContext(async (tx) => tx.execute(claimDetailQuery(actor, id)));
    const row = rows[0];
    if (!row) throw ApiError.notFound('Claim not found');
    return { data: row };
  },
);

// PATCH and DELETE from CRUD factory — status is FSM-governed, block direct mutation
const { PATCH, DELETE } = crudRoutes({
  table: claims,
  pk: 'claimNumber',
  tags: ["Claims"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  blockedPatchFields: ['status'],
}) as any as { PATCH: typeof GET; DELETE: typeof GET };

export { GET, PATCH, DELETE };
