/**
 * GET /api/clause-library/[id]/versions — the owner's version history of a shared clause.
 *
 * The history holds the text the clause had before each change and its final text if it was deleted (platform 0052). Only the owning
 * organization reads it: the table's row security scopes every row to the organization that supplied the clause, and the clause id is
 * not required to still exist, so the history of a deleted clause can still be shown.
 */
import { withApi, ApiError } from '@/lib/api/framework';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { sharedClauseVersions } from '@/db/schema/domains/agreements/shared-library';
import { and, desc, eq } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const PAGE = 100;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Clause-library'], summary: 'Version history of a shared clause (owner only)' },
  },
  async ({ params, organizationId }) => {
    if (!organizationId) throw ApiError.badRequest('Organization context required');
    const { id } = params as { id: string };
    if (!UUID.test(id)) throw ApiError.badRequest('Invalid clause identifier');

    const versions = await withRLSContext({ organizationId }, (tx) =>
      tx
        .select()
        .from(sharedClauseVersions)
        .where(and(eq(sharedClauseVersions.clauseId, id), eq(sharedClauseVersions.organizationId, organizationId)))
        .orderBy(desc(sharedClauseVersions.version), desc(sharedClauseVersions.recordedAt))
        .limit(PAGE),
    );
    // No version at all reads as not found: a clause with no history, a clause of another organization and a clause that never existed
    // are indistinguishable.
    if (versions.length === 0) throw ApiError.notFound('clause versions', id);
    return { clauseId: id, versions };
  },
);