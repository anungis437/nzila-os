/**
 * GET /api/content/templates
 * Returns CMS pages (templates, resources) from PostgreSQL.
 * Replaces the old Django proxy to /api/content/cms-pages/.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';

export const dynamic = 'force-dynamic';

export const GET = withApi(
  { auth: { required: true, minRole: 'member' } },
  async (ctx) => {
    const orgId = ctx.organizationId;
    const url = new URL(ctx.request.url);
    const limit = Number(url.searchParams.get('limit')) || 50;
    const contentType = url.searchParams.get('type') || null; // 'template', 'resource', or null for all

    let query = sql`
      SELECT id, title, slug, meta_description, status, category,
             content_type, file_url, file_size_mb, download_count,
             view_count, published_at, created_by, updated_at
      FROM cms_pages
      WHERE organization_id = ${orgId}::uuid
    `;

    if (contentType) {
      query = sql`${query} AND content_type = ${contentType}`;
    }

    query = sql`${query} ORDER BY updated_at DESC LIMIT ${limit}`;

    const result = await withRLSContext(async () => db.execute(query));
    const rows = Array.from(result);

    const templates = rows.map((r: Record<string, unknown>) => ({
      id: r.id,
      title: r.title,
      name: r.title,
      slug: r.slug,
      description: r.meta_description,
      status: r.status,
      category: r.category,
      type: r.content_type,
      fileUrl: r.file_url,
      fileSizeMb: r.file_size_mb ? Number(r.file_size_mb) : null,
      downloads: Number(r.download_count ?? 0),
      views: Number(r.view_count ?? 0),
      published_at: r.published_at,
      updated_at: r.updated_at,
      created_by: r.created_by,
    }));

    return { templates };
  },
);

