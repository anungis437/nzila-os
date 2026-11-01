/**
 * POST /api/social-media/posts/review — a second officer approves or rejects a drafted social post.
 *
 * Speaking in the organization's name takes two officers: the author drafts (POST /api/social-media/posts), and a different
 * officer decides here. Approval is claimed atomically (so two approvers cannot both publish the same draft), the external publish
 * is audited before and after, and the decision, the decider and the time are kept on the post and in the audit trail.
 */
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { and, eq, sql } from 'drizzle-orm';
import { db } from '@/db';
import { socialPosts, socialAccounts } from '@/db/schema/social-media-schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';
import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard';
import { ErrorCode, standardErrorResponse } from '@/lib/api/standardized-responses';
import { AllPlatformsFailedError, createSocialMediaService } from '@/lib/social-media/social-media-service';

export const dynamic = 'force-dynamic';

const reviewSchema = z.discriminatedUnion('decision', [
  z.object({ post_id: z.guid(), decision: z.literal('approve') }),
  z.object({ post_id: z.guid(), decision: z.literal('reject'), reason: z.string().trim().min(5).max(500) }),
]);

const approvalPatch = (patch: Record<string, unknown>) =>
  sql`coalesce(${socialPosts.postMetadata}, '{}'::jsonb) || ${JSON.stringify({ approval: patch })}::jsonb`;

const stillPending = (postId: string, organizationId: string) =>
  and(
    eq(socialPosts.id, postId),
    eq(socialPosts.organizationId, organizationId),
    eq(socialPosts.status, 'draft'),
    sql`${socialPosts.postMetadata}->'approval'->>'state' = 'pending'`,
  );

export const POST = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {
  const { userId, organizationId } = context;
  if (!userId || !organizationId) return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');

  const limit = await checkRateLimit(`social-posts-review:${userId}`, RATE_LIMITS.SOCIAL_MEDIA_POST);
  if (!limit.allowed) return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', { resetIn: limit.resetIn });

  let parsed;
  try {
    parsed = reviewSchema.safeParse(await request.json());
  } catch {
    return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
  }
  if (!parsed.success) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, parsed.error.issues[0]?.message || 'Invalid request data');
  const review = parsed.data;

  try {
    const [draft] = await db
      .select({
        id: socialPosts.id,
        accountId: socialPosts.accountId,
        campaignId: socialPosts.campaignId,
        content: socialPosts.content,
        mediaUrls: socialPosts.mediaUrls,
        linkUrl: socialPosts.linkUrl,
        hashtags: socialPosts.hashtags,
        scheduledFor: socialPosts.scheduledFor,
        status: socialPosts.status,
        createdBy: socialPosts.createdBy,
        postMetadata: socialPosts.postMetadata,
        platform: socialAccounts.platform,
      })
      .from(socialPosts)
      .innerJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))
      .where(and(eq(socialPosts.id, review.post_id), eq(socialPosts.organizationId, organizationId)))
      .limit(1);
    if (!draft) return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Post not found');

    const approval = (draft.postMetadata as { approval?: { state?: string } } | null)?.approval;
    if (draft.status !== 'draft' || approval?.state !== 'pending') {
      return standardErrorResponse(ErrorCode.CONFLICT, 'Only a draft awaiting approval can be reviewed');
    }
    // The author does not approve their own post.
    if (draft.createdBy === userId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'A post must be reviewed by a different officer than its author');
    }

    if (review.decision === 'reject') {
      const rejected = await withRLSContext({ organizationId }, async (tx) => {
        const rows = await tx
          .update(socialPosts)
          .set({
            status: 'deleted',
            deletedAt: new Date(),
            updatedAt: new Date(),
            postMetadata: approvalPatch({ state: 'rejected', decidedBy: userId, decidedAt: new Date().toISOString(), reason: review.reason }),
          })
          .where(stillPending(draft.id, organizationId))
          .returning({ id: socialPosts.id });
        if (rows.length === 0) return false;
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'social.post.reject',
          resourceType: 'social_posts',
          resourceId: draft.id,
          details: { platform: draft.platform, authorId: draft.createdBy },
        });
        return true;
      });
      if (!rejected) return standardErrorResponse(ErrorCode.CONFLICT, 'The draft was already reviewed');
      return NextResponse.json({ status: 'rejected', post_id: draft.id });
    }

    // Claim the draft before anything is sent, so a second approver cannot publish it again.
    const claimed = await withRLSContext({ organizationId }, async (tx) => {
      const rows = await tx
        .update(socialPosts)
        .set({ updatedAt: new Date(), postMetadata: approvalPatch({ state: 'approving', decidedBy: userId, decidedAt: new Date().toISOString() }) })
        .where(stillPending(draft.id, organizationId))
        .returning({ id: socialPosts.id });
      if (rows.length === 0) return false;
      await persistAtomicAudit(tx, {
        organizationId,
        userId,
        action: 'social.post.approve',
        resourceType: 'social_posts',
        resourceId: draft.id,
        details: { platform: draft.platform, authorId: draft.createdBy },
      });
      return true;
    });
    if (!claimed) return standardErrorResponse(ErrorCode.CONFLICT, 'The draft was already reviewed');

    const meta = (draft.postMetadata ?? {}) as { linkTitle?: string; linkDescription?: string };
    let results;
    try {
      results = await performAuditedOperation(
        {
          organizationId,
          userId,
          action: 'social.post.publish',
          resourceType: 'social_posts',
          resourceId: draft.id,
          details: { platform: draft.platform, scheduled: !!draft.scheduledFor, approvedAuthor: draft.createdBy },
        },
        async () => {
          const published = await createSocialMediaService().publishPost(
            organizationId,
            {
              text: draft.content,
              media_urls: draft.mediaUrls ?? [],
              link_url: draft.linkUrl ?? undefined,
              link_title: meta.linkTitle,
              link_description: meta.linkDescription,
              hashtags: draft.hashtags ?? [],
              scheduled_for: draft.scheduledFor ?? undefined,
              campaign_id: draft.campaignId ?? undefined,
              platforms: [draft.platform],
            },
            userId,
            { accountIds: [draft.accountId], existingPostId: draft.id },
          );
          if (published.every((r) => !r.success)) throw new AllPlatformsFailedError(published);
          return published;
        },
      );
    } catch (error) {
      if (error instanceof AllPlatformsFailedError) {
        await db
          .update(socialPosts)
          .set({
            status: 'failed',
            errorMessage: error.results[0]?.error ?? 'The platform did not accept the post.',
            updatedAt: new Date(),
            postMetadata: approvalPatch({ state: 'approved_publish_failed' }),
          })
          .where(and(eq(socialPosts.id, draft.id), eq(socialPosts.organizationId, organizationId)));
        return NextResponse.json({ error: 'The platform did not accept the post', results: error.results }, { status: 502 });
      }
      const refused = operationAuditResponse(error);
      if (refused) return NextResponse.json(refused.body, { status: refused.status });
      throw error;
    }

    // An external platform can accept the post while our database write fails.
    // Do not claim successful approval or allow an automatic replay: the post may
    // already be live. Keep the durable 'approving' claim for manual reconciliation.
    if (results.some((result) => result.success && result.recorded === false)) {
      return NextResponse.json({
        error: 'The platform accepted the post, but the local record was not confirmed. Reconciliation is required.',
        state: 'external_accepted_local_unconfirmed',
        post_id: draft.id,
      }, { status: 502, headers: { 'Cache-Control': 'no-store' } });
    }

    await db
      .update(socialPosts)
      .set({ postMetadata: approvalPatch({ state: 'approved' }) })
      .where(and(eq(socialPosts.id, draft.id), eq(socialPosts.organizationId, organizationId)));

    return NextResponse.json({ status: draft.scheduledFor ? 'scheduled' : 'published', post_id: draft.id, result: results[0] });
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', error);
  }
});
