/**
 * GET POST DELETE /api/social-media/posts
 * Migrated to withApi() framework
 */
import { withApi, z, RATE_LIMITS } from '@/lib/api/framework';

const _socialMediaPostsSchema = z.object({
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

import { GET as v1GET, POST as v1POST, DELETE as v1DELETE } from '@/app/api/social-media/posts/route';

export const GET = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    openapi: {
      tags: ['Social-media'],
      summary: 'GET posts',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1GET(request, { params: params as Record<string, unknown> });
    return response;
  },
);

export const POST = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    rateLimit: RATE_LIMITS.SOCIAL_MEDIA_API,
    openapi: {
      tags: ['Social-media'],
      summary: 'POST posts',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1POST(request, { params: params as Record<string, unknown> });
    return response;
  },
);

export const DELETE = withApi(
  {
    auth: { required: true, minRole: 'member' as const },
    rateLimit: RATE_LIMITS.SOCIAL_MEDIA_API,
    openapi: {
      tags: ['Social-media'],
      summary: 'DELETE posts',
    },
  },
  async ({ request, params }) => {
    // Delegate to v1 handler while framework migration is in progress
    const response = await v1DELETE(request, { params: params as Record<string, unknown> });
    return response;
  },
);
