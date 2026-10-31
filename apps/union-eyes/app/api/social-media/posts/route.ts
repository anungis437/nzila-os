import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
/**
 * Social Media Posts API Routes - Phase 10
 * 
 * CRUD endpoints for managing social media posts across platforms.
 * Supports create, read, update, delete, and publish operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSocialMediaService, postTypeFor } from '@/lib/social-media/social-media-service';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { parseSocialPostPagination } from '@/lib/social-media/social-post-pagination';
import { performAuditedOperation, operationAuditResponse } from '@/lib/audit/operation-audit';
import { db } from '@/db';
import { socialPosts, socialAccounts, socialCampaigns } from '@/db/schema/social-media-schema';
import { eq, and, ilike, desc, count, inArray, SQL } from 'drizzle-orm';
import { z } from "zod";
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
} from '@/lib/api/standardized-responses';

// This is the organization's publishing workbench, not its public social feed.
// Members must not see unapproved copy, officer identities, rejection reasons, provider errors or approval metadata.
const postReadStatuses = z.enum(['draft', 'scheduled', 'published', 'failed', 'deleted']);

export const GET = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {
  try {
    const { userId, organizationId } = context;
    if (!userId || !organizationId) {
      return standardErrorResponse(ErrorCode.FORBIDDEN, 'Organization context required');
    }

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

    // Both reads must use the caller's tenant-bound transaction. An explicit field projection
    // prevents JSON approval records, actor identifiers and provider diagnostics from leaking.
    const { total, posts } = await withRLSContext({ organizationId, userId }, async (tx) => {
      const [{ total }] = await tx.select({ total: count() }).from(socialPosts).where(and(...conditions));
      const posts = await tx.select({
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
      return { total, posts };
    });

    return NextResponse.json({ posts, total, limit: pagination.limit, offset: pagination.offset }, {
      headers: { 'Cache-Control': 'private, no-store' },
    });
  } catch (error) {
    return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', error);
  }
});

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
// officer approves it (POST /api/social-media/posts/review) before anything reaches a platform.
export const POST = withRoleAuth('officer', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { userId, organizationId } = context;

      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

      if (!userId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No user found'
        );
      }

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
      const body = await request.json();
      
      const validation = socialMediaPostsSchema.safeParse(body);
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
      const drafts = await withRLSContext({ organizationId }, async (tx) => {
        const rows = [];
        for (const account of accounts) {
          const [row] = await tx
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
          await persistAtomicAudit(tx, {
            organizationId,
            userId,
            action: 'social.post.draft',
            resourceType: 'social_posts',
            resourceId: row.id,
            details: { platform: account.platform, scheduled: !!scheduled_for, mediaCount: (media_urls || []).length },
          });
          rows.push(row);
        }
        return rows;
      });

      return NextResponse.json(
        {
          message: 'Saved as a draft for approval. Nothing was published; a different officer must approve it.',
          status: 'pending_approval',
          drafts: drafts.map((d) => ({ id: d.id, account_id: d.accountId })),
        },
        { status: 202 },
      );
    } catch (error) {
      return standardErrorResponse(ErrorCode.INTERNAL_ERROR, 'Internal server error', error);
    }
});

export const DELETE = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { userId, organizationId } = context;
      
      if (!organizationId || !userId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

      // Get post ID from query params
      const searchParams = request.nextUrl.searchParams;
      const postId = searchParams.get('id');

      if (!postId) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Post ID required'
    );
      }

      // Verify user has access to this post (belongs to their organization)
      const [post] = await db
        .select({
          id: socialPosts.id,
          orgId: socialAccounts.organizationId,
        })
        .from(socialPosts)
        .innerJoin(socialAccounts, eq(socialPosts.accountId, socialAccounts.id))
        .where(and(eq(socialPosts.id, postId), eq(socialAccounts.organizationId, organizationId)))
        .limit(1);

      if (!post?.id) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Post not found'
    );
      }

      // Delete post using social media service; it removes the post from the external platform, so it is audited
      const socialMediaService = createSocialMediaService();
      await performAuditedOperation(
        {
          organizationId,
          userId,
          action: 'social.post.delete',
          resourceType: 'social_posts',
          resourceId: postId,
        },
        () => socialMediaService.deletePost(postId, organizationId),
      );

      return NextResponse.json({
        message: 'Post deleted successfully',
        post_id: postId,
      });
    } catch (error) {
      const refused = operationAuditResponse(error);
      if (refused) return NextResponse.json(refused.body, { status: refused.status });
      return NextResponse.json(
        {
          error: 'Failed to delete post',
        },
        { status: 500 }
      );
    }
});

