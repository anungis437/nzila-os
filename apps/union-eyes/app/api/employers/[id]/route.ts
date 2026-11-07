/**
 * CRUD item route for employers
 *
 * DELETE is the governed archive (lib/union-structure/employer-archive.ts): it refuses while timesheet batches, contacts, draft
 * communications, bargaining units or worksites still depend on the employer, stamps archivedAt, and is audited in the same transaction.
 */
import { crudRoutes } from '@/lib/api/crud-factory';
import { withApi } from '@/lib/api/with-api';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { archiveEmployerGoverned } from '@/lib/union-structure/employer-archive';
import { EMPLOYER_WRITABLE_FIELDS, assertEmployerStatusWritable } from '@/lib/union-structure/employer-writable-fields';
import { assertOrganizationOwns } from '@/lib/api/org-references';
import { ApiError } from '@/lib/api/errors';
import { isCheckViolation } from '@/lib/db/unique-violation';
import { employers } from '@/db/schema';

export const dynamic = 'force-dynamic';

// A parent company is a row of the caller's own organization (the database trigger in migration 0046 settles the race).
const checkParent = async (values: Record<string, unknown>, organizationId: string | null | undefined, ownId?: string) => {
  if (ownId && values.parentCompanyId === ownId) throw ApiError.badRequest('An employer cannot be its own parent');
  await assertOrganizationOwns([{ field: 'parentCompanyId', value: values.parentCompanyId, table: employers }], organizationId);
};
const mapParentError = (error: unknown) => (isCheckViolation(error) ? ApiError.badRequest('parentCompanyId must be an employer of this organization') : null);

const { GET, PATCH } = crudRoutes({
  table: employers,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  // What the employer form sends (toEmployerPayload), plus the parent company checked below.
  writableFields: EMPLOYER_WRITABLE_FIELDS,
  beforeUpdate: async (updates, ctx) => {
    assertEmployerStatusWritable(updates, ctx.existing.status);
    if ('parentCompanyId' in updates) await checkParent(updates, ctx.organizationId, ctx.id);
    return updates;
  },
});

// Archiving needs an administrator, as the generic delete did, and goes through the governed archive rather than a bare status write.
const DELETE = withApi(
  {
    auth: { required: true, minRole: 'admin' },
    rlsOrgContext: true,
    openapi: {
      tags: ['Organization'],
      summary: 'Archive employer',
      description: 'Archives an employer when nothing open depends on it (409 otherwise). The record is kept; status becomes archived and archivedAt is stamped.',
    },
  },
  async ({ params, organizationId, userId }) => {
    if (!organizationId || !userId) throw ApiError.forbidden();
    const employerId = params.id;
    if (typeof employerId !== 'string' || !employerId) throw ApiError.badRequest('Missing employer id');
    const data = await withRLSContext({ organizationId, userId }, (tx) => archiveEmployerGoverned(tx, { organizationId, userId, employerId }));
    return { data };
  },
);
export { GET, PATCH, DELETE };
