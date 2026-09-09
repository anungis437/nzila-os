/**
 * DELETE /api/communications/distribution-lists/[id]/subscribers/[subscriberId]
 * — Unsubscribe a single member from a distribution list.
 *
 * Soft-delete (status='unsubscribed', unsubscribedAt=now()) rather than a
 * hard row delete: the schema's dedicated status + unsubscribedAt columns
 * exist to preserve a suppression/consent audit trail, matching the
 * distinction between "list membership" and "delivery eligibility" (round
 * 55 doctrine). `[id]` is the distribution list id (verified against the
 * caller's organization); `[subscriberId]` is the subscriber row id, and
 * must belong to that same list — round 54/55 route-shape fix.
 */
import { and, eq, ne } from 'drizzle-orm';
import { db } from '@/db/db';
import { newsletterDistributionLists, newsletterListSubscribers } from '@/db/schema';
import { withApi } from '@/lib/api/with-api';
import { ApiError } from '@/lib/api/errors';

export const dynamic = 'force-dynamic';

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: {
      tags: ['Communications'],
      summary: 'Remove a distribution list subscriber',
      description: 'Unsubscribes a member from a distribution list owned by the caller\u2019s organization.',
    },
  },
  async ({ params, organizationId }) => {
    const { id: listId, subscriberId } = params as { id: string; subscriberId: string };

    const [list] = await db
      .select({ id: newsletterDistributionLists.id })
      .from(newsletterDistributionLists)
      .where(and(eq(newsletterDistributionLists.id, listId), eq(newsletterDistributionLists.organizationId, organizationId!)));
    if (!list) throw ApiError.notFound('Distribution list not found');

    const [updated] = await db
      .update(newsletterListSubscribers)
      .set({ status: 'unsubscribed', unsubscribedAt: new Date() })
      .where(and(
        eq(newsletterListSubscribers.id, subscriberId),
        eq(newsletterListSubscribers.listId, listId),
        ne(newsletterListSubscribers.status, 'unsubscribed'),
      ))
      .returning();
    if (!updated) throw ApiError.notFound('Subscriber not found');

    return { data: updated };
  },
);
