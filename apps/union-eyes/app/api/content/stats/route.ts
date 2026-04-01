/**
 * GET /api/content/stats
 * Returns aggregated content metrics from PostgreSQL.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'member' } },
  async (ctx) => {
    const orgId = ctx.organizationId;

    // Templates stats
    const templateResult = await db.execute(sql`
      SELECT
        count(*) FILTER (WHERE content_type = 'template') AS total_templates,
        count(*) FILTER (WHERE content_type = 'template' AND status = 'published') AS published_templates,
        count(*) FILTER (WHERE content_type = 'template' AND status = 'draft') AS draft_templates,
        count(*) FILTER (WHERE content_type = 'template' AND status = 'review') AS review_templates,
        count(*) FILTER (WHERE content_type = 'template' AND status = 'archived') AS archived_templates,
        count(*) FILTER (WHERE content_type = 'resource') AS total_resources,
        count(*) FILTER (WHERE content_type = 'resource' AND status = 'published') AS published_resources,
        COALESCE(sum(view_count), 0) AS total_views,
        COALESCE(sum(download_count), 0) AS total_downloads
      FROM cms_pages
      WHERE organization_id = ${orgId}::uuid
    `);
    const tRows = Array.from(templateResult);
    const stats = tRows[0] as Record<string, unknown>;

    // Most viewed content
    const topResult = await db.execute(sql`
      SELECT title, category, view_count
      FROM cms_pages
      WHERE organization_id = ${orgId}::uuid AND view_count > 0
      ORDER BY view_count DESC
      LIMIT 1
    `);
    const topRows = Array.from(topResult);
    const topContent = topRows[0] as Record<string, unknown> | undefined;

    // Training stats
    const trainingResult = await db.execute(sql`
      SELECT
        count(*) AS total_courses,
        count(*) FILTER (WHERE is_active = true) AS active_courses,
        COALESCE(sum(completion_count), 0) AS total_completions
      FROM training_courses
      WHERE organization_id = ${orgId}::uuid
    `);
    const trRows = Array.from(trainingResult);
    const trStats = trRows[0] as Record<string, unknown>;

    return {
      templates: {
        total: Number(stats.total_templates ?? 0),
        published: Number(stats.published_templates ?? 0),
        draft: Number(stats.draft_templates ?? 0),
        review: Number(stats.review_templates ?? 0),
        archived: Number(stats.archived_templates ?? 0),
      },
      resources: {
        total: Number(stats.total_resources ?? 0),
        published: Number(stats.published_resources ?? 0),
      },
      views: Number(stats.total_views ?? 0),
      downloads: Number(stats.total_downloads ?? 0),
      mostViewed: topContent ? {
        title: topContent.title as string,
        category: topContent.category as string,
        views: Number(topContent.view_count ?? 0),
      } : null,
      training: {
        total: Number(trStats.total_courses ?? 0),
        active: Number(trStats.active_courses ?? 0),
        totalCompletions: Number(trStats.total_completions ?? 0),
      },
    };
  },
);
