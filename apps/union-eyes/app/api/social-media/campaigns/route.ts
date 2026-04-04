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


const socialMediaCampaignsSchema = z.object({
  name: z.string().min(1, 'name is required'),
  description: z.string().optional(),
  platforms: z.array(z.string()).optional(),
  start_date: z.string().datetime().optional(),
  end_date: z.string().datetime().optional(),
  goals: z.array(z.any()).optional(),
  hashtags: z.unknown().optional(),
  target_audience: z.unknown().optional(),
  status: z.unknown().optional(),
});

export const POST = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
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
        validation.error.errors
      );
    }
    
    const { name, description, platforms, start_date, end_date, goals, hashtags, target_audience, status: _status } = validation.data;

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

      // Validate goals
      if (goals) {
        for (const goal of goals) {
          if (!goal.metric || !goal.target_value) {
            return NextResponse.json(
              { error: 'Each goal must have a metric and target value' },
              { status: 400 }
            );
          }
          if (goal.target_value <= 0) {
            return standardErrorResponse(
              ErrorCode.VALIDATION_ERROR,
              'Target value must be positive'
            );
          }
        }
      }

      // Create campaign
      const [campaign] = await withRLSContext(async () =>
        db
          .insert(socialCampaigns)
          .values({
            organizationId,
            name,
            description,
            platforms: platforms || [],
            startDate: start_date ? start_date.split('T')[0] : new Date().toISOString().split('T')[0],
            endDate: end_date ? end_date.split('T')[0] : null,
            campaignHashtags: Array.isArray(hashtags) ? hashtags as string[] : [],
            targetAudience: target_audience as string | undefined,
            status: 'active',
            createdBy: userId,
          })
          .returning()
      );

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

export const PUT = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { _userId, organizationId } = context;

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
        .where(eq(socialCampaigns.id, campaignId))
        .limit(1);

      if (!campaign) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Campaign not found'
    );
      }

      if (organizationId !== campaign.organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'Unauthorized'
        );
      }

      const body = await request.json();
      const { name, description, platforms, start_date, end_date, hashtags, target_audience, status } = body;

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

      const [updatedCampaign] = await withRLSContext(async () =>
        db
          .update(socialCampaigns)
          .set(updateData)
          .where(eq(socialCampaigns.id, campaignId))
          .returning()
      );

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

export const DELETE = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { _userId, organizationId } = context;

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
        .where(eq(socialCampaigns.id, campaignId))
        .limit(1);

      if (!campaign) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Campaign not found'
    );
      }

      if (organizationId !== campaign.organizationId) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'Unauthorized'
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

      // Delete campaign
      await withRLSContext(async () =>
        db.delete(socialCampaigns).where(eq(socialCampaigns.id, campaignId))
      );

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
