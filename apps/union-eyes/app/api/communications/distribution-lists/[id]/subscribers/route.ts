/**
 * GET /api/communications/distribution-lists/[id]/subscribers — List a
 * distribution list's active subscribers.
 *
 * Bespoke (not crud-factory itemRoute) because this URL's [id] segment is
 * the DISTRIBUTION LIST id, not a subscriber id — crud-factory's itemRoute
 * mode has no notion of "collection scoped by a parent id", so reusing it
 * here previously conflated the two identifiers (round 54/55 fix). Per-item
 * subscriber mutation lives at ./[subscriberId]/route.ts.
 */
import { and, desc, eq } from 'drizzle-orm';
import { db } from '@/db/db';
import { newsletterDistributionLists, newsletterListSubscribers } from '@/db/schema';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' },
    openapi: {
      tags: ['Communications'],
      summary: 'List distribution list subscribers',
      description: 'Returns the active (subscribed) members of a distribution list owned by the caller\u2019s organization.',
    },
  },
  async ({ params, organizationId }) => {
    const { id: listId } = params as { id: string };

    const [list] = await db
      .select({ id: newsletterDistributionLists.id })
      .from(newsletterDistributionLists)
      .where(and(eq(newsletterDistributionLists.id, listId), eq(newsletterDistributionLists.organizationId, organizationId!)));
    if (!list) throw ApiError.notFound('Distribution list not found');

    const subscribers = await db
      .select()
      .from(newsletterListSubscribers)
      .where(and(eq(newsletterListSubscribers.listId, listId), eq(newsletterListSubscribers.status, 'subscribed')))
      .orderBy(desc(newsletterListSubscribers.subscribedAt));

    return { subscribers };
  },
);
