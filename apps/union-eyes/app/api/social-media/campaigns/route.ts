import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
/**
 * Social Media Campaigns API Routes - Phase 10
 * 
 * Endpoints for managing social media campaigns.
 * Supports campaign CRUD, goal tracking, and performance analytics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/db';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { socialCampaigns, socialPosts } from '@/db/schema/social-media-schema';
import { eq, and, ilike, or, gte, lte, desc, count, SQL } from 'drizzle-orm';
import { z } from "zod";
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard';

import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';

export const GET = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { userId, organizationId } = context;

      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

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

      // Parse query parameters
      const searchParams = request.nextUrl.searchParams;
      const status = searchParams.get('status');
      const search = searchParams.get('search');
      const startDate = searchParams.get('start_date');
      const endDate = searchParams.get('end_date');
      const limit = parseInt(searchParams.get('limit') || '50');
      const offset = parseInt(searchParams.get('offset') || '0');

      // Build query with Drizzle
      const campaignConditions: SQL[] = [eq(socialCampaigns.organizationId, organizationId)];

      if (status) {
        campaignConditions.push(eq(socialCampaigns.status, status as typeof socialCampaigns.status._.data));
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

      // Calculate campaign metrics
      const campaignsWithMetrics = await Promise.all(
        campaigns.map(async (campaign) => {
          // Get post performance
          const posts = await db
            .select({
              impressionsCount: socialPosts.impressionsCount,
              likesCount: socialPosts.likesCount,
              commentsCount: socialPosts.commentsCount,
              sharesCount: socialPosts.sharesCount,
            })
            .from(socialPosts)
            .where(eq(socialPosts.campaignId, campaign.id));

          const metrics = {
            total_posts: posts.length,
            total_impressions: posts.reduce((sum, p) => sum + (p.impressionsCount || 0), 0),
            total_engagement: posts.reduce((sum, p) => sum + (p.likesCount || 0) + (p.commentsCount || 0) + (p.sharesCount || 0), 0),
            total_likes: posts.reduce((sum, p) => sum + (p.likesCount || 0), 0),
            total_comments: posts.reduce((sum, p) => sum + (p.commentsCount || 0), 0),
            total_shares: posts.reduce((sum, p) => sum + (p.sharesCount || 0), 0),
            total_clicks: 0,
          };

          return {
            ...campaign,
            metrics,
            goal_progress: undefined,
          };
        })
      );

      return NextResponse.json({
        campaigns: campaignsWithMetrics,
        total: campaignTotal,
        limit,
        offset,
      });
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Internal server error',
        },
        { status: 500 }
      );
    }
});


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

export const POST = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { userId, organizationId } = context;

      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

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

      if (!organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

      const body = await request.json();
    // Validate request body
    const validation = socialMediaCampaignsSchema.safeParse(body);
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

      // Create campaign and record the audit together
      const campaign = await withRLSContext({ organizationId }, async (tx) => {
        const [row] = await tx
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
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'social.campaign.create',
          resourceType: 'social_campaigns',
          resourceId: row.id,
          details: { name, platforms },
        });
        return row;
      });

      return standardSuccessResponse(
      {  campaign  }
    );
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Failed to create campaign',
        },
        { status: 500 }
      );
    }
});

export const PUT = withRoleAuth('steward', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { userId, organizationId } = context;

      if (!organizationId || !userId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'No organization found'
        );
      }

      // Get campaign ID from query params
      const searchParams = request.nextUrl.searchParams;
      const campaignId = searchParams.get('id');

      if (!campaignId) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Campaign ID required'
    );
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

      const parsed = socialMediaCampaignUpdateSchema.safeParse(await request.json());
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

      const updatedCampaign = await withRLSContext({ organizationId }, async (tx) => {
        const [row] = await tx
          .update(socialCampaigns)
          .set(updateData)
          .where(and(eq(socialCampaigns.id, campaignId), eq(socialCampaigns.organizationId, organizationId)))
          .returning();
        if (!row) return null;
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'social.campaign.update',
          resourceType: 'social_campaigns',
          resourceId: campaignId,
          details: { fields: Object.keys(updateData).filter((key) => key !== 'updatedAt') },
        });
        return row;
      });
      if (!updatedCampaign) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Campaign not found');
      }

      return NextResponse.json({ campaign: updatedCampaign });
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Failed to update campaign',
        },
        { status: 500 }
      );
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

      // Get campaign ID from query params
      const searchParams = request.nextUrl.searchParams;
      const campaignId = searchParams.get('id');

      if (!campaignId) {
        return standardErrorResponse(
      ErrorCode.MISSING_REQUIRED_FIELD,
      'Campaign ID required'
    );
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

      // Check if campaign has posts
      const postsCheck = await db
        .select({ id: socialPosts.id })
        .from(socialPosts)
        .where(eq(socialPosts.campaignId, campaignId))
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
      const removed = await withRLSContext({ organizationId }, async (tx) => {
        const rows = await tx
          .delete(socialCampaigns)
          .where(and(eq(socialCampaigns.id, campaignId), eq(socialCampaigns.organizationId, organizationId)))
          .returning({ id: socialCampaigns.id });
        if (rows.length === 0) return false;
        await persistAtomicAudit(tx, {
          organizationId,
          userId,
          action: 'social.campaign.delete',
          resourceType: 'social_campaigns',
          resourceId: campaignId,
          details: { name: campaign.name },
        });
        return true;
      });
      if (!removed) {
        return standardErrorResponse(ErrorCode.RESOURCE_NOT_FOUND, 'Campaign not found');
      }

      return NextResponse.json({
        message: 'Campaign deleted successfully',
        campaign_id: campaignId,
      });
    } catch (_error) {
return NextResponse.json(
        {
          error: 'Failed to delete campaign',
        },
        { status: 500 }
      );
    }
});
