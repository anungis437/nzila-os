import { checkRateLimit, RATE_LIMITS } from '@/lib/rate-limiter';
/**
 * Social Media Posts API Routes - Phase 10
 * 
 * CRUD endpoints for managing social media posts across platforms.
 * Supports create, read, update, delete, and publish operations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSocialMediaService } from '@/lib/social-media/social-media-service';
import { createClient } from '@supabase/supabase-js';
import { z } from "zod";
import { BaseAuthContext, withRoleAuth } from '@/lib/api-auth-guard';

 
import {
  ErrorCode,
  standardErrorResponse,
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
        `social-posts-read:${userId}`,
        RATE_LIMITS.SOCIAL_MEDIA_API
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
      const platform = searchParams.get('platform');
      const status = searchParams.get('status');
      const campaignId = searchParams.get('campaign_id');
      const search = searchParams.get('search');
      const limit = parseInt(searchParams.get('limit') || '20');
      const offset = parseInt(searchParams.get('offset') || '0');

      // Build query
      let query = getSupabaseClient()
        .from('social_posts')
        .select(`
        *,
        account:social_accounts(id, platform, platform_username, platform_account_name),
        campaign:social_campaigns(id, name),
        created_by_profile:profiles!created_by(id, first_name, last_name)
      `, { count: 'exact' })
        .eq('organization_id', organizationId)
        .order('created_at', { ascending: false });

      // Apply filters
      if (platform) {
        query = query.eq('platform', platform);
      }

      if (status) {
        query = query.eq('status', status);
      }

      if (campaignId) {
        query = query.eq('campaign_id', campaignId);
      }

      if (search) {
        query = query.ilike('content', `%${search}%`);
      }

      // Apply pagination
      query = query.range(offset, offset + limit - 1);

      const { data: posts, error, count } = await query;

      if (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Failed to fetch posts'
    );
      }

      return NextResponse.json({
        posts: posts || [],
        total: count || 0,
        limit,
        offset,
      });
    } catch (error) {
return standardErrorResponse(
      ErrorCode.INTERNAL_ERROR,
      'Internal server error',
      error
    );
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
  campaign_id: z.string().uuid("Invalid campaign_id").optional(),
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
          validation.error.errors[0]?.message || "Invalid request data"
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
        campaign_id: _campaign_id,
      } = validation.data;

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

      // Create social media service
      const socialMediaService = createSocialMediaService();

      // Publish post
      const results = await socialMediaService.publishPost(
        organizationId,
        {
          text: content,
          media_urls: media_urls || [],
          link_url,
          link_title,
          link_description,
          hashtags: hashtags || [],
          mentions: mentions || [],
          scheduled_for: scheduled_for ? new Date(scheduled_for) : undefined,
          platforms,
        },
        userId
      );

      // Check if any posts succeeded
      const successCount = results.filter(r => r.success).length;
      const failureCount = results.filter(r => !r.success).length;

      if (successCount === 0) {
        return NextResponse.json(
          {
            error: 'Failed to publish to any platform',
            results,
          },
          { status: 500 }
        );
      }

      return NextResponse.json({
        message: `Published to ${successCount} platform(s)${failureCount > 0 ? `, failed on ${failureCount}` : ''}`,
        results,
        success: successCount,
        failed: failureCount,
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

export const DELETE = withRoleAuth('member', async (request: NextRequest, context: BaseAuthContext) => {
  try {
      const { _userId, organizationId } = context;
      
      if (!organizationId) {
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
      const { data: post, error: fetchError } = await getSupabaseClient()
        .from('social_posts')
        .select('*, account:social_accounts(organization_id)')
        .eq('id', postId)
        .single();

      if (fetchError || !post) {
        return standardErrorResponse(
      ErrorCode.RESOURCE_NOT_FOUND,
      'Post not found'
    );
      }

      if (organizationId !== (post.account as Record<string, unknown> | undefined)?.organization_id) {
        return standardErrorResponse(
          ErrorCode.FORBIDDEN,
          'Unauthorized'
        );
      }

      // Delete post using social media service
      const socialMediaService = createSocialMediaService();
      await socialMediaService.deletePost(postId);

      return NextResponse.json({
        message: 'Post deleted successfully',
        post_id: postId,
      });
    } catch (error) {
return NextResponse.json(
        {
          error: 'Failed to delete post',
          details: error instanceof Error ? error.message : 'Unknown error',
        },
        { status: 500 }
      );
    }
});

