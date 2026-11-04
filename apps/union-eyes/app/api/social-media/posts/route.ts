import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
/**
 * Social Media Posts API Routes - Phase 10
 * 
 * CRUD endpoints for managing social media posts across platforms.
 * Supports create, read, update, delete, and publish operations.
 */

import { NextResponse } from 'next/server';
import { createSocialMediaService, postTypeFor } from '@/lib/social-media/social-media-service';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { parseSocialPostPagination } from '@/lib/social-media/social-post-pagination';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';
import { db } from '@/db';
import { socialPosts, socialAccounts, socialCampaigns } from '@/db/schema/social-media-schema';
import { eq, and, ilike, desc, count, inArray, SQL } from 'drizzle-orm';
import { z } from "zod";
import { withApi } from '@/lib/api/framework';
import { logger } from '@/lib/logger';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

// This is the organization's publishing workbench, not its public social feed.
// Members must not see unapproved copy, officer identities, rejection reasons, provider errors or approval metadata.
const postReadStatuses = z.enum(['draft', 'scheduled', 'published', 'failed', 'deleted']);

// A malformed body is a client error, never a server fault.
async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

// Both reads run in the caller organization's tenant transaction (`rlsOrgContext`): the ambient `db` is that transaction.
export const GET = withApi(
  {
    auth: { minRole: 'officer' },
    rlsOrgContext: true,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Social media'], summary: 'List the social media posts of the organization' },
  },
  async ({ request, userId, organizationId: organization }) => {
  const organizationId = organization!;
  try {
    const rateLimitResult = await checkRateLimit(
      `social-posts-read:${userId}`,
      RATE_LIMITS.SOCIAL_MEDIA_API,
    );
    if (!rateLimitResult.allowed) {
      return standardErrorResponse(ErrorCode.RATE_LIMIT_EXCEEDED, 'Rate limit exceeded', { resetIn: rateLimitResult.resetIn });
    }

    const params = request.nextUrl.searchParams;
    const pagination = parseSocialPostPagination(params);
    if (!pagination) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'limit must be 1-100 and offset must be 0-10000');

    const rawStatus = params.get('status');
    const status = rawStatus === null ? null : postReadStatuses.safeParse(rawStatus);
    if (status && !status.success) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid post status');

    const rawCampaignId = params.get('campaign_id');
    const campaignId = rawCampaignId === null ? null : z.guid().safeParse(rawCampaignId);
    if (campaignId && !campaignId.success) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid campaign id');

    const search = params.get('search');
    if (search !== null && search.length > 200) return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Search is too long');

    const conditions: SQL[] = [eq(socialPosts.organizationId, organizationId)];
    if (status?.success) conditions.push(eq(socialPosts.status, status.data));
    if (campaignId?.success) conditions.push(eq(socialPosts.campaignId, campaignId.data));
    if (search) conditions.push(ilike(socialPosts.content, `%${search}%`));

    // An explicit field projection prevents JSON approval records, actor identifiers and provider diagnostics from leaking.
    const [{ total }] = await db.select({ total: count() }).from(socialPosts).where(and(...conditions));
    const posts = await db.select({
      id: socialPosts.id,
      accountId: socialPosts.accountId,
      campaignId: socialPosts.campaignId,
      postType: socialPosts.postType,
      content: socialPosts.content,
      mediaUrls: socialPosts.mediaUrls,
      linkUrl: socialPosts.linkUrl,
      hashtags: socialPosts.hashtags,
      mentions: socialPosts.mentions,
      status: socialPosts.status,
      scheduledFor: socialPosts.scheduledFor,
      publishedAt: socialPosts.publishedAt,
      platformUrl: socialPosts.platformUrl,
      likesCount: socialPosts.likesCount,
      commentsCount: socialPosts.commentsCount,
      sharesCount: socialPosts.sharesCount,
      impressionsCount: socialPosts.impressionsCount,
      reachCount: socialPosts.reachCount,
      engagementRate: socialPosts.engagementRate,
      createdAt: socialPosts.createdAt,
      updatedAt: socialPosts.updatedAt,
    }).from(socialPosts)
      .where(and(...conditions))
      .orderBy(desc(socialPosts.createdAt))
      .limit(pagination.limit)
      .offset(pagination.offset);

    return NextResponse.json({ posts, total, limit: pagination.limit, offset: pagination.offset }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    logger.error('Failed to list the social media posts', { error });
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', error);
  }
  },
);

const socialMediaPostsSchema = z.object({
  platforms: z.array(z.enum(["facebook", "twitter", "linkedin", "instagram"])).min(1, "At least one platform required"),
  content: z.string().min(1, "Content is required").max(5000, "Content too long"),
  media_urls: z.array(z.string().url("Invalid media URL")).max(10, "Maximum 10 media files").optional(),
  link_url: z.string().url("Invalid URL").optional(),
  link_title: z.string().max(200).optional(),
  link_description: z.string().max(500).optional(),
  hashtags: z.array(z.string().regex(/^[a-zA-Z0-9_]+$/, "Invalid hashtag format")).max(30, "Maximum 30 hashtags").optional(),
  mentions: z.array(z.string().max(100)).max(20, "Maximum 20 mentions").optional(),
  scheduled_for: z.string().datetime().optional(),
  campaign_id: z.guid("Invalid campaign_id").optional(),
  // The post goes to the accounts it names, never to every connected page of a platform.
  account_ids: z.array(z.guid("Invalid account id")).min(1, "Name at least one account").max(10, "Maximum 10 accounts"),
});

// Speaking in the organization's name takes two officers: this route records a draft for the accounts the author names, and a different
// officer approves it (POST /api/social-media/posts/review) before anything reaches a platform. Nothing leaves the database here, so the
// campaign and account checks, the drafts and their audit records share the tenant transaction of the request (`rlsOrgContext`).
export const POST = withApi(
  {
    auth: { minRole: 'officer' },
    rlsOrgContext: true,
    registry: { audience: 'officer', productionStatus: 'active', evidenceRequired: true, orgScoping: 'caller-org' },
    openapi: { tags: ['Social media'], summary: 'Save a social media post as a draft awaiting approval' },
  },
  async ({ request, userId: actor, organizationId: organization }) => {
  const userId = actor!;
  const organizationId = organization!;
  try {
      // Rate limit check
      const rateLimitResult = await checkRateLimit(
        `social-posts-create:${userId}`,
        RATE_LIMITS.SOCIAL_MEDIA_POST
      );
      if (!rateLimitResult.allowed) {
        return standardErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { resetIn: rateLimitResult.resetIn }
    );
      }

      // Parse and validate request body
      const read = await readJson(request);
      if (!read.ok) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
      }
      
      const validation = socialMediaPostsSchema.safeParse(read.body);
      if (!validation.success) {
        return standardErrorResponse(
          ErrorCode.VALIDATION_ERROR,
          validation.error.issues[0]?.message || "Invalid request data"
        );
      }
      
      const {
        platforms,
        content,
        media_urls,
        link_url,
        link_title,
        link_description,
        hashtags,
        mentions,
        scheduled_for,
        campaign_id,
        account_ids,
      } = validation.data;

      // The platform APIs here take no mention markup, so a mention would be stored as sent while nothing sends it.
      if ((mentions ?? []).length > 0) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Mentions are not supported: no platform integration sends them');
      }

      // A post can be linked only to a campaign of this organization.
      if (campaign_id) {
        const [campaign] = await db
          .select({ id: socialCampaigns.id })
          .from(socialCampaigns)
          .where(and(eq(socialCampaigns.id, campaign_id), eq(socialCampaigns.organizationId, organizationId)))
          .limit(1);
        if (!campaign) return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Campaign not found');
      }

      // Check character limits per platform
      const characterLimits: Record<string, number> = {
        twitter: 280,
        facebook: 63206,
        instagram: 2200,
        linkedin: 3000,
      };

      for (const platform of platforms) {
        const limit = characterLimits[platform];
        if (limit && content.length > limit) {
          return NextResponse.json(
            { error: `Content exceeds ${platform} character limit of ${limit}` },
            { status: 400 }
          );
        }
      }

      // The accounts named must be this organization's own, active, and on a selected platform.
      const accounts = await db
        .select({ id: socialAccounts.id, platform: socialAccounts.platform })
        .from(socialAccounts)
        .where(and(
          eq(socialAccounts.organizationId, organizationId),
          inArray(socialAccounts.id, account_ids),
          eq(socialAccounts.status, 'active'),
        ));
      if (accounts.length !== new Set(account_ids).size || accounts.some((a) => !platforms.includes(a.platform))) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Every account must be an active account of this organization on a selected platform');
      }

      // One draft per account, written with its audit record; nothing is sent.
      const drafts = [];
      for (const account of accounts) {
        const [row] = await db
          .insert(socialPosts)
          .values({
            organizationId,
            accountId: account.id,
            campaignId: campaign_id ?? null,
            postType: postTypeFor({ media_urls, link_url }),
            content,
            mediaUrls: media_urls || [],
            linkUrl: link_url ?? null,
            hashtags: hashtags || [],
            mentions: [],
            status: 'draft',
            scheduledFor: scheduled_for ? new Date(scheduled_for) : null,
            postMetadata: { approval: { state: 'pending', requestedBy: userId, requestedAt: new Date().toISOString() }, linkTitle: link_title, linkDescription: link_description },
            createdBy: userId,
          })
          .returning({ id: socialPosts.id, accountId: socialPosts.accountId });
        await persistAtomicAudit(db, {
          organizationId,
          userId,
          action: 'social.post.draft',
          resourceType: 'social_posts',
          resourceId: row.id,
          details: { platform: account.platform, scheduled: !!scheduled_for, mediaCount: (media_urls || []).length },
        });
        drafts.push(row);
      }

      return NextResponse.json(
        {
          message: 'Saved as a draft for approval. Nothing was published; a different officer must approve it.',
          status: 'pending_approval',
          drafts: drafts.map((d) => ({ id: d.id, account_id: d.accountId })),
        },
        { status: 202 },
      );
    } catch (error) {
      logger.error('Failed to save the social media post draft', { error });
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', error);
    }
  },
);

// Deleting a post removes it from the platform first (a network call), so no transaction spans the handler: the lookup and the local
// update each run in the organization's own tenant transaction, and the service scopes its own statements the same way.
export const DELETE = withApi(
  {
    auth: { minRole: 'steward' },
    openapi: { tags: ['Social media'], summary: 'Delete a social media post from its platform and mark it deleted' },
  },
  async ({ request, userId: actor, organizationId: organization }) => {
  const userId = actor!;
  const organizationId = organization!;
  try {
      // Get post ID from query params
      const searchParams = request.nextUrl.searchParams;
      const postId = searchParams.get('id');

      if (!postId) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Post ID required'
    );
      }
      if (!z.guid().safeParse(postId).success) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Post ID must be a valid id');
      }

      // Verify user has access to this post (belongs to their organization)
      const [post] = await withRLSContext({ organizationId }, (tx) =>
        tx
          .select({
            id: socialPosts.id,
            orgId: socialAccounts.organizationId,
          })
          .from(socialPosts)
          .innerJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))
          .where(and(eq(socialPosts.id, postId), eq(socialAccounts.organizationId, organizationId), eq(socialPosts.organizationId, organizationId)))
          .limit(1),
      );

      if (!post?.id) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Post not found'
    );
      }

      // Two effects in two places, each recorded for what it is. Removing the post from the platform is external, so it is a durable
      // intent and outcome. The row then reads deleted in one transaction with its own audit record. A platform failure leaves the row
      // published (true: the post is still live); a failure of the local step leaves the row published for a post that is gone, which
      // the response says, and repeating the deletion completes it (a platform answer that the post is already gone counts as removed).
      const socialMediaService = createSocialMediaService();
      let alreadyRemoved = false;
      try {
        const removal = await performAuditedOperation(
          {
            organizationId,
            userId,
            action: 'social.post.delete',
            resourceType: 'social_posts',
            resourceId: postId,
            resultDetails: (result) => ({ alreadyRemoved: result.alreadyRemoved }),
          },
          () => socialMediaService.removeFromPlatform(postId, organizationId),
        );
        alreadyRemoved = removal.alreadyRemoved;
      } catch (error) {
        const refused = operationAuditResponse(error);
        if (refused) return NextResponse.json(refused.body, { status: refused.status });
        return NextResponse.json(
          { error: 'The platform did not remove the post, so it is still published. Try again.', code: 'PLATFORM_REMOVAL_FAILED', retryable: true },
          { status: 502 },
        );
      }

      try {
        await withRLSContext({ organizationId }, async (tx) => {
          await tx
            .update(socialPosts)
            .set({ status: 'deleted', deletedAt: new Date(), updatedAt: new Date() })
            .where(and(eq(socialPosts.id, postId), eq(socialPosts.organizationId, organizationId)));
          await persistAtomicAudit(tx, {
            organizationId,
            userId,
            action: 'social.post.deleted',
            resourceType: 'social_posts',
            resourceId: postId,
            details: { alreadyRemovedOnPlatform: alreadyRemoved },
          });
        });
      } catch (localError) {
        logger.error('The social media post was removed from the platform but its record could not be updated', { error: localError, postId });
        return NextResponse.json(
          {
            error: 'The post was removed from the platform, but its record could not be updated and still reads published. Repeat the deletion to complete it.',
            code: 'LOCAL_STATE_PENDING',
            retryable: true,
          },
          { status: 502 },
        );
      }

      return NextResponse.json({
        message: 'Post deleted successfully',
        post_id: postId,
      });
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return NextResponse.json(refused.body, { status: refused.status });
      logger.error('Failed to delete the social media post', { error });
      return NextResponse.json(
        {
          error: 'Failed to delete post',
        },
        { status: 500 }
      );
    }
  },
);

