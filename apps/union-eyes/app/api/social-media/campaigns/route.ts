import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
/**
 * Social Media Campaigns API Routes - Phase 10
 * 
 * Endpoints for managing social media campaigns.
 * Supports campaign CRUD, goal tracking, and performance analytics.
 *
 * None of these handlers calls out of the database, so each runs in the caller organization's tenant transaction (`rlsOrgContext`): the
 * ambient `db` is that transaction, row-level security shows the organization's own campaigns, and a write commits together with its audit
 * record.
 */

import { NextResponse } from 'next/server';
import { db } from '@/db';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { socialCampaigns, socialPosts } from '@/db/schema/social-media-schema';
import { eq, and, ilike, or, gte, lte, desc, count, inArray, SQL } from 'drizzle-orm';
import { z } from "zod";
import { summarizePosts, averageEngagementRate, figuresRecorded, goalProgress } from '@/lib/social-media/campaign-figures';
import { parseSocialPostPagination } from '@/lib/social-media/social-post-pagination';
import { withApi } from '@/lib/api/framework';
import { logger } from '@/lib/logger';

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';

const campaignPlatforms = z.enum(['facebook', 'twitter', 'instagram', 'linkedin', 'youtube', 'tiktok']);
const campaignStatuses = z.enum(['planning', 'active', 'paused', 'completed', 'cancelled']);
const campaignGoalSchema = z.object({
  metric: z.enum(['impressions', 'engagement_rate', 'conversions']),
  target_value: z.number().finite().positive(),
}).strict().refine(
  goal => goal.metric === 'engagement_rate'
    ? goal.target_value <= 100
    : Number.isSafeInteger(goal.target_value),
  { message: 'Count goals must be integers and engagement rate must not exceed 100' },
);
const socialMediaCampaignsSchema = z.object({
  name: z.string().trim().min(1, 'name is required').max(200),
  description: z.string().max(5000).optional(),
  platforms: z.array(campaignPlatforms).min(1).max(6).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  goals: z.array(campaignGoalSchema).max(3).refine(
    goals => new Set(goals.map(goal => goal.metric)).size === goals.length,
    'Duplicate campaign goal metrics are not allowed',
  ).optional(),
  hashtags: z.array(z.string().regex(/^[A-Za-z0-9_]{1,80}$/)).max(30).optional(),
  target_audience: z.string().max(2000).optional(),
  status: campaignStatuses.optional(),
}).strict();
const socialMediaCampaignUpdateSchema = socialMediaCampaignsSchema.partial().refine(
  body => Object.keys(body).length > 0,
  'At least one campaign field is required',
);

// A calendar day written YYYY-MM-DD that exists (2026-02-30 does not).
const isDay = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value) && new Date(`${value}T00:00:00.000Z`).toISOString().slice(0, 10) === value;

// A malformed body is a client error, never a server fault.
async function readJson(request: Request): Promise<{ ok: true; body: unknown } | { ok: false }> {
  try {
    return { ok: true, body: await request.json() };
  } catch {
    return { ok: false };
  }
}

export const GET = withApi(
  {
    auth: { minRole: 'member' },
    rlsOrgContext: true,
    openapi: { tags: ['Social media'], summary: 'List the social media campaigns of the organization with their figures' },
  },
  async ({ request, userId, organizationId: organization }) => {
  const organizationId = organization!;
  try {
      // Rate limit check
      const rateLimitResult = await checkRateLimit(
        `social-campaigns-read:${userId}`,
        RATE_LIMITS.CAMPAIGN_OPERATIONS
      );
      if (!rateLimitResult.allowed) {
        return standardErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { resetIn: rateLimitResult.resetIn }
    );
      }

      // Parse query parameters: every one is checked before it reaches a query
      const searchParams = request.nextUrl.searchParams;
      const pagination = parseSocialPostPagination(searchParams, { limit: 50 });
      if (!pagination) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'limit must be 1-100 and offset must be 0-10000');
      }
      const { limit, offset } = pagination;

      const rawStatus = searchParams.get('status');
      const status = rawStatus ? campaignStatuses.safeParse(rawStatus) : null;
      if (status && !status.success) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid campaign status');
      }

      const search = searchParams.get('search');
      if (search !== null && search.length > 200) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Search is too long');
      }

      const startDate = searchParams.get('start_date');
      const endDate = searchParams.get('end_date');
      if ((startDate && !isDay(startDate)) || (endDate && !isDay(endDate))) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'start_date and end_date must be valid YYYY-MM-DD dates');
      }

      // Build query with Drizzle
      const campaignConditions: SQL[] = [eq(socialCampaigns.organizationId, organizationId)];

      if (status?.success) {
        campaignConditions.push(eq(socialCampaigns.status, status.data));
      }

      if (search) {
        campaignConditions.push(or(
          ilike(socialCampaigns.name, `%${search}%`),
          ilike(socialCampaigns.description!, `%${search}%`),
        )!);
      }

      if (startDate) {
        campaignConditions.push(gte(socialCampaigns.startDate, startDate));
      }

      if (endDate) {
        campaignConditions.push(lte(socialCampaigns.endDate!, endDate));
      }

      const [{ total: campaignTotal }] = await db
        .select({ total: count() })
        .from(socialCampaigns)
        .where(and(...campaignConditions));

      const campaigns = await db
        .select()
        .from(socialCampaigns)
        .where(and(...campaignConditions))
        .orderBy(desc(socialCampaigns.createdAt))
        .limit(limit)
        .offset(offset);

      // The post performance of every campaign of the page, in one statement
      const postRows = campaigns.length === 0
        ? []
        : await db
          .select({
            campaignId: socialPosts.campaignId,
            impressionsCount: socialPosts.impressionsCount,
            reachCount: socialPosts.reachCount,
            engagementRate: socialPosts.engagementRate,
            likesCount: socialPosts.likesCount,
            commentsCount: socialPosts.commentsCount,
            sharesCount: socialPosts.sharesCount,
          })
          .from(socialPosts)
          .where(and(inArray(socialPosts.campaignId, campaigns.map((campaign) => campaign.id)), eq(socialPosts.organizationId, organizationId)));
      const postsByCampaign = new Map<string, typeof postRows>();
      for (const post of postRows) {
        if (!post.campaignId) continue;
        postsByCampaign.set(post.campaignId, [...(postsByCampaign.get(post.campaignId) ?? []), post]);
      }

      // Calculate campaign metrics
      const campaignsWithMetrics = campaigns.map((campaign) => {
        const posts = postsByCampaign.get(campaign.id) ?? [];
        const metrics = summarizePosts(posts);

        return {
          ...campaign,
          metrics,
          figures_recorded: figuresRecorded(posts),
          goal_progress: goalProgress(campaign, metrics, averageEngagementRate(posts)),
        };
      });

      return NextResponse.json({
        campaigns: campaignsWithMetrics,
        total: campaignTotal,
        limit,
        offset,
      });
    } catch (error) {
      logger.error('Failed to list the social media campaigns', { error });
      return NextResponse.json(
        {
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
  },
);

export const POST = withApi(
  {
    auth: { minRole: 'steward' },
    rlsOrgContext: true,
    openapi: { tags: ['Social media'], summary: 'Create a social media campaign' },
  },
  async ({ request, userId: actor, organizationId: organization }) => {
  const userId = actor!;
  const organizationId = organization!;
  try {
      // Rate limit check
      const rateLimitResult = await checkRateLimit(
        `social-campaigns-create:${userId}`,
        RATE_LIMITS.CAMPAIGN_OPERATIONS
      );
      if (!rateLimitResult.allowed) {
        return standardErrorResponse(
      ErrorCode.RATE_LIMIT_EXCEEDED,
      'Rate limit exceeded',
      { resetIn: rateLimitResult.resetIn }
    );
      }

      const read = await readJson(request);
      if (!read.ok) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
      }
    // Validate request body
    const validation = socialMediaCampaignsSchema.safeParse(read.body);
    if (!validation.success) {
      return standardErrorResponse(
        ErrorCode.VALIDATION_ERROR,
        'Invalid request data',
        validation.error.issues
      );
    }
    
    const { name, description, platforms, start_date, end_date, goals, hashtags, target_audience, status } = validation.data;

      // Validate required fields
      if (!name) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Campaign name is required'
    );
      }

      if (!platforms || platforms.length === 0) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'At least one platform is required'
    );
      }

      // Validate dates
      if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (start > end) {
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Start date must be before end date'
          );
        }
      }

      // Goals are mapped to real persisted columns; unsupported metrics are rejected by the schema.
      const goalByMetric = new Map((goals ?? []).map(goal => [goal.metric, goal.target_value]));

      // Create campaign and record the audit together: both statements are in the tenant transaction of the request
      const [campaign] = await db
        .insert(socialCampaigns)
        .values({
          organizationId,
          name,
          description,
          platforms: platforms || [],
          startDate: start_date ? start_date.split('T')[0] : new Date().toISOString().split('T')[0],
          endDate: end_date ? end_date.split('T')[0] : null,
          campaignHashtags: hashtags ?? [],
          targetAudience: target_audience,
          status: status ?? 'planning',
          goalImpressions: goalByMetric.get('impressions') ?? null,
          goalEngagementRate: goalByMetric.has('engagement_rate')
            ? goalByMetric.get('engagement_rate')!.toFixed(2) : null,
          goalConversions: goalByMetric.get('conversions') ?? null,
          createdBy: userId,
        })
        .returning();
      await persistAtomicAudit(db, {
        organizationId,
        userId,
        action: 'social.campaign.create',
        resourceType: 'social_campaigns',
        resourceId: campaign.id,
        details: { name, platforms },
      });

      return standardSuccessResponse(
      {  campaign  }
    );
    } catch (error) {
      logger.error('Failed to create the social media campaign', { error });
      return NextResponse.json(
        {
          error: 'Failed to create campaign',
        },
        { status: 500 }
      );
    }
  },
);

export const PUT = withApi(
  {
    auth: { minRole: 'steward' },
    rlsOrgContext: true,
    openapi: { tags: ['Social media'], summary: 'Update a social media campaign' },
  },
  async ({ request, userId: actor, organizationId: organization }) => {
  const userId = actor!;
  const organizationId = organization!;
  try {
      // Get campaign ID from query params
      const searchParams = request.nextUrl.searchParams;
      const campaignId = searchParams.get('id');

      if (!campaignId) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Campaign ID required'
    );
      }
      if (!z.guid().safeParse(campaignId).success) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Campaign ID must be a valid id');
      }

      // Verify user has access to this campaign
      const [campaign] = await db
        .select()
        .from(socialCampaigns)
        .where(and(eq(socialCampaigns.id, campaignId), eq(socialCampaigns.organizationId, organizationId)))
        .limit(1);

      if (!campaign) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Campaign not found'
    );
      }

      const read = await readJson(request);
      if (!read.ok) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'A JSON body is required');
      }
      const parsed = socialMediaCampaignUpdateSchema.safeParse(read.body);
      if (!parsed.success) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Invalid campaign update', parsed.error.flatten());
      }
      const { name, description, platforms, start_date, end_date, hashtags, target_audience, status, goals } = parsed.data;

      // Validate dates if provided
      if (start_date && end_date) {
        const start = new Date(start_date);
        const end = new Date(end_date);
        if (start > end) {
          return standardErrorResponse(
            ErrorCode.VALIDATION_ERROR,
            'Start date must be before end date'
          );
        }
      } else if (start_date !== undefined || end_date !== undefined) {
        // One date changes while the other stays as stored: the campaign must still start before it ends
        const nextStart = start_date !== undefined ? start_date.split('T')[0] : campaign.startDate;
        const nextEnd = end_date !== undefined ? end_date.split('T')[0] : campaign.endDate;
        if (nextEnd && nextStart > nextEnd) {
          return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Start date must be before end date');
        }
      }

      // Update campaign
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = { updatedAt: new Date() };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (platforms !== undefined) updateData.platforms = platforms;
      if (start_date !== undefined) updateData.startDate = start_date.split('T')[0];
      if (end_date !== undefined) updateData.endDate = end_date.split('T')[0];
      if (hashtags !== undefined) updateData.campaignHashtags = hashtags;
      if (target_audience !== undefined) updateData.targetAudience = target_audience;
      if (status !== undefined) updateData.status = status;
      if (goals !== undefined) {
        const goalByMetric = new Map(goals.map(goal => [goal.metric, goal.target_value]));
        updateData.goalImpressions = goalByMetric.get('impressions') ?? null;
        updateData.goalEngagementRate = goalByMetric.has('engagement_rate')
          ? goalByMetric.get('engagement_rate')!.toFixed(2) : null;
        updateData.goalConversions = goalByMetric.get('conversions') ?? null;
      }

      const [updatedCampaign] = await db
        .update(socialCampaigns)
        .set(updateData)
        .where(and(eq(socialCampaigns.id, campaignId), eq(socialCampaigns.organizationId, organizationId)))
        .returning();
      if (!updatedCampaign) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Campaign not found');
      }
      await persistAtomicAudit(db, {
        organizationId,
        userId,
        action: 'social.campaign.update',
        resourceType: 'social_campaigns',
        resourceId: campaignId,
        details: { fields: Object.keys(updateData).filter((key) => key !== 'updatedAt') },
      });

      return NextResponse.json({ campaign: updatedCampaign });
    } catch (error) {
      logger.error('Failed to update the social media campaign', { error });
      return NextResponse.json(
        {
          error: 'Failed to update campaign',
        },
        { status: 500 }
      );
    }
  },
);

export const DELETE = withApi(
  {
    auth: { minRole: 'steward' },
    rlsOrgContext: true,
    openapi: { tags: ['Social media'], summary: 'Delete a social media campaign that has no posts' },
  },
  async ({ request, userId: actor, organizationId: organization }) => {
  const userId = actor!;
  const organizationId = organization!;
  try {
      // Get campaign ID from query params
      const searchParams = request.nextUrl.searchParams;
      const campaignId = searchParams.get('id');

      if (!campaignId) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Campaign ID required'
    );
      }
      if (!z.guid().safeParse(campaignId).success) {
        return standardErrorResponse(ErrorCode.VALIDATION_ERROR, 'Campaign ID must be a valid id');
      }

      // Verify user has access to this campaign
      const [campaign] = await db
        .select()
        .from(socialCampaigns)
        .where(and(eq(socialCampaigns.id, campaignId), eq(socialCampaigns.organizationId, organizationId)))
        .limit(1);

      if (!campaign) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Campaign not found'
    );
      }

      // Check if campaign has posts (of this organization)
      const postsCheck = await db
        .select({ id: socialPosts.id })
        .from(socialPosts)
        .where(and(eq(socialPosts.campaignId, campaignId), eq(socialPosts.organizationId, organizationId)))
        .limit(1);

      if (postsCheck.length > 0) {
        return NextResponse.json(
          {
            error: 'Cannot delete campaign with associated posts',
            details: 'Please delete or reassign posts first',
          },
          { status: 400 }
        );
      }

      // Delete campaign and record the audit together
      const removedRows = await db
        .delete(socialCampaigns)
        .where(and(eq(socialCampaigns.id, campaignId), eq(socialCampaigns.organizationId, organizationId)))
        .returning({ id: socialCampaigns.id });
      if (removedRows.length === 0) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Campaign not found');
      }
      await persistAtomicAudit(db, {
        organizationId,
        userId,
        action: 'social.campaign.delete',
        resourceType: 'social_campaigns',
        resourceId: campaignId,
        details: { name: campaign.name },
      });

      return NextResponse.json({
        message: 'Campaign deleted successfully',
        campaign_id: campaignId,
      });
    } catch (error) {
      logger.error('Failed to delete the social media campaign', { error });
      return NextResponse.json(
        {
          error: 'Failed to delete campaign',
        },
        { status: 500 }
      );
    }
  },
);
