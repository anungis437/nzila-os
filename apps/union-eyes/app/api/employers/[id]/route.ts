/**
 * CRUD item route for employers
 */
import { crudRoutes } from '@/lib/api/crud-factory';
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

const { GET, PATCH, DELETE } = crudRoutes({
  table: employers,
  pk: 'id',
  tags: ["Organization"],
  orgScoped: true,
  itemRoute: true,
  readRole: 'member',
  writeRole: 'steward',
  beforeUpdate: async (updates, ctx) => {
    if ('parentCompanyId' in updates) await checkParent(updates, ctx.organizationId, ctx.id);
    return updates;
  },
});
export { GET, PATCH, DELETE };
