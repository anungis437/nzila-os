/**
 * PATCH /api/content/templates/[id]/status
 * Transition a content item's status through the editorial workflow.
 *
 * Allowed transitions:
 *   draft    → review     (content_manager+)
 *   review   → published  (admin+)
 *   review   → draft      (admin+ — reject back to draft)
 *   published → archived  (admin+)
 *   archived  → draft     (admin+)
 */
import { withApi, z, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { sql } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const TRANSITIONS: Record<string, { targets: string[]; minRole: string }> = {
  draft:     { targets: ['review'],             minRole: 'content_manager' },
  review:    { targets: ['published', 'draft'], minRole: 'admin' },
  published: { targets: ['archived'],           minRole: 'admin' },
  archived:  { targets: ['draft'],              minRole: 'admin' },
};

export const PATCH = withApi(
  {
    auth: { required: true, minRole: 'content_manager' },
    body: z.object({
      status: z.enum(['draft', 'review', 'published', 'archived']),
    }),
  },
  async (ctx) => {
    const orgId = ctx.organizationId;
    const itemId = ctx.params.id;
    const newStatus = ctx.body.status;

    // Fetch current status
    const result = await db.execute(sql`
      SELECT id, status, title FROM cms_pages
      WHERE id = ${itemId}::uuid AND organization_id = ${orgId}::uuid
      LIMIT 1
    `);

    const rows = Array.from(result);
    if (rows.length === 0) {
      throw ApiError.notFound('Content item');
    }

    const current = rows[0] as Record<string, unknown>;
    const currentStatus = current.status as string;

    if (currentStatus === newStatus) {
      return { id: itemId, status: newStatus, message: 'No change needed' };
    }

    // Validate transition
    const rule = TRANSITIONS[currentStatus];
    if (!rule || !rule.targets.includes(newStatus)) {
      throw ApiError.badRequest(
        `Cannot transition from "${currentStatus}" to "${newStatus}". ` +
        `Allowed targets: ${rule?.targets.join(', ') ?? 'none'}.`
      );
    }

    // Update status
    const publishedClause = newStatus === 'published'
      ? sql`, published_at = now()`
      : sql``;

    await db.execute(sql`
      UPDATE cms_pages
      SET status = ${newStatus},
          updated_by = ${ctx.userId},
          updated_at = now()
          ${publishedClause}
      WHERE id = ${itemId}::uuid AND organization_id = ${orgId}::uuid
    `);

    return {
      id: itemId,
      title: current.title,
      previousStatus: currentStatus,
      status: newStatus,
      message: `Status changed from "${currentStatus}" to "${newStatus}"`,
    };
  },
);
