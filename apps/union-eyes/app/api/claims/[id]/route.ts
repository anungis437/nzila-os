/**
 * CRUD item route for claims
 * Custom GET to include member contact info via JOIN.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';
import { claims } from '@/db/schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { getCaseActor, findReadableCase, redactCaseRow } from '@/lib/cases/case-authorization';
import { claimDetailQuery } from '@/lib/cases/claim-detail-query';

export const dynamic = 'force-dynamic';

// Custom GET with member JOIN. Read authority is a kernel decision (lib/cases/case-authorization): the member who
// filed the case, and those holding a live governed relationship to it. Unreadable and nonexistent cases are
// indistinguishable (404), and an unresolved role or organization fails closed before any query runs.
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

    const found = await withRLSContext(async (tx) => {
      const readable = await findReadableCase(tx, actor, id, false, 'case:read');
      if (!readable) return null;
      const rows = await tx.execute(claimDetailQuery(actor, readable.claimId));
      return rows[0] ? { row: rows[0], visibility: readable.visibility } : null;
    });
    if (!found) throw ApiError.notFound('Claim not found');
    return { data: redactCaseRow(found.row, found.visibility) };
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
