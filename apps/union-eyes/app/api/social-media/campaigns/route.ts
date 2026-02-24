import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
/**
 * Social Media Campaigns API Routes - Phase 10
 * 
 * Endpoints for managing social media campaigns.
 * Supports campaign CRUD, goal tracking, and performance analytics.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { z } from "zod";
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard';

 
import {
  ErrorCode,
  standardErrorResponse,
  standardSuccessResponse,
} from '@/lib/api/standardized-responses';
// Lazy initialization - env vars not available during build
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let supabaseClient: any = null;
function getSupabaseClient() {
  if (!supabaseClient) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
    supabaseClient = createClient(supabaseUrl, supabaseServiceKey);
  }
  return supabaseClient;
}

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

      // Build query
      let query = getSupabaseClient()
        .from('social_campaigns')
        .select(
          `
        *,
        created_by_profile:profiles!social_campaigns_created_by_fkey(
          id,
          first_name,
          last_name,
          email
        ),
        posts:social_posts(count)
      `,
          { count: 'exact' }
        )
        .eq('organization_id', organizationId);

      // Apply filters
      if (status) {
        query = query.eq('status', status);
      }

      if (search) {
        query = query.or(`name.ilike.%${search}%,description.ilike.%${search}%`);
      }

      if (startDate) {
        query = query.gte('start_date', startDate);
      }

      if (endDate) {
        query = query.lte('end_date', endDate);
      }

      // Apply pagination
      query = query.order('created_at', { ascending: false }).range(offset, offset + limit - 1);

      const { data: campaigns, error, count } = await query;

      if (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch campaigns'
    );
      }

      // Calculate campaign metrics
      const campaignsWithMetrics = await Promise.all(
        (campaigns || []).map(async (campaign) => {
          // Get post performance
          const { data: posts } = await getSupabaseClient()
            .from('social_posts')
            .select('impressions, engagement, likes, comments, shares, clicks')
            .eq('campaign_id', campaign.id);

          const metrics = {
            total_posts: posts?.length || 0,
            total_impressions: posts?.reduce((sum, p) => sum + (p.impressions || 0), 0) || 0,
            total_engagement: posts?.reduce((sum, p) => sum + (p.engagement || 0), 0) || 0,
            total_likes: posts?.reduce((sum, p) => sum + (p.likes || 0), 0) || 0,
            total_comments: posts?.reduce((sum, p) => sum + (p.comments || 0), 0) || 0,
            total_shares: posts?.reduce((sum, p) => sum + (p.shares || 0), 0) || 0,
            total_clicks: posts?.reduce((sum, p) => sum + (p.clicks || 0), 0) || 0,
          };

          // Calculate goal progress
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const goalProgress = campaign.goals?.map((goal: any) => {
            const currentValue = metrics[`total_${goal.metric}` as keyof typeof metrics] || 0;
            const progress = goal.target_value > 0 ? (currentValue / goal.target_value) * 100 : 0;
            return {
              ...goal,
              current_value: currentValue,
              progress: Math.min(progress, 100),
              achieved: currentValue >= goal.target_value,
            };
          });

          return {
            ...campaign,
            metrics,
            goal_progress: goalProgress,
          };
        })
      );

      return NextResponse.json({
        campaigns: campaignsWithMetrics,
        total: count || 0,
        limit,
        offset,
      });
    } catch (error) {
return NextResponse.json(
        {
          error: 'Internal server error',
          details: error instanceof Error ? error.message : 'Unknown error',
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
      const { data: campaign, error } = await getSupabaseClient()
        .from('social_campaigns')
        .insert({
          organization_id: organizationId,
          name,
          description,
          platforms,
          start_date,
          end_date,
          goals,
          hashtags: hashtags || [],
          target_audience,
          status: 'active',
          created_by: userId,
        })
        .select()
        .single();

      if (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to create campaign'
    );
      }

      return standardSuccessResponse(
      {  campaign  }
    );
    } catch (error) {
return NextResponse.json(
        {
          error: 'Failed to create campaign',
          details: error instanceof Error ? error.message : 'Unknown error',
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
      const { data: campaign, error: fetchError } = await getSupabaseClient()
        .from('social_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (fetchError || !campaign) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Campaign not found'
    );
      }

      if (organizationId !== campaign.organization_id) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'Unauthorized'
        );
      }

      const body = await request.json();
      const { name, description, platforms, start_date, end_date, goals, hashtags, target_audience, status } = body;

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

      // Validate goals if provided
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

      // Update campaign
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const updateData: Record<string, any> = {
        updated_at: new Date().toISOString(),
      };

      if (name !== undefined) updateData.name = name;
      if (description !== undefined) updateData.description = description;
      if (platforms !== undefined) updateData.platforms = platforms;
      if (start_date !== undefined) updateData.start_date = start_date;
      if (end_date !== undefined) updateData.end_date = end_date;
      if (goals !== undefined) updateData.goals = goals;
      if (hashtags !== undefined) updateData.hashtags = hashtags;
      if (target_audience !== undefined) updateData.target_audience = target_audience;
      if (status !== undefined) updateData.status = status;

      const { data: updatedCampaign, error: updateError } = await getSupabaseClient()
        .from('social_campaigns')
        .update(updateData)
        .eq('id', campaignId)
        .select()
        .single();

      if (updateError) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to update campaign'
    );
      }

      return NextResponse.json({ campaign: updatedCampaign });
    } catch (error) {
return NextResponse.json(
        {
          error: 'Failed to update campaign',
          details: error instanceof Error ? error.message : 'Unknown error',
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
      const { data: campaign, error: fetchError } = await getSupabaseClient()
        .from('social_campaigns')
        .select('*')
        .eq('id', campaignId)
        .single();

      if (fetchError || !campaign) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Campaign not found'
    );
      }

      if (organizationId !== campaign.organization_id) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'Unauthorized'
        );
      }

      // Check if campaign has posts
      const { data: posts } = await getSupabaseClient()
        .from('social_posts')
        .select('id')
        .eq('campaign_id', campaignId)
        .limit(1);

      if (posts && posts.length > 0) {
        return NextResponse.json(
          {
            error: 'Cannot delete campaign with associated posts',
            details: 'Please delete or reassign posts first',
          },
          { status: 400 }
        );
      }

      // Delete campaign
      const { error: deleteError } = await getSupabaseClient()
        .from('social_campaigns')
        .delete()
        .eq('id', campaignId);

      if (deleteError) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to delete campaign'
    );
      }

      return NextResponse.json({
        message: 'Campaign deleted successfully',
        campaign_id: campaignId,
      });
    } catch (error) {
return NextResponse.json(
        {
          error: 'Failed to delete campaign',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
});
