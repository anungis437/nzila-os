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
import { sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { hasMinRole } from '@/lib/api-auth-guard';

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
    const userId = ctx.userId;
    const itemId = ctx.params.id;
    const newStatus = ctx.body.status;
    if (!orgId || !userId) throw ApiError.badRequest('Organization context required');

    return withRLSContext({ organizationId: orgId }, async (tx) => {
      // Lock the row so the transition is validated against the state it will be applied to
      const result = await tx.execute(sql`
        SELECT id, status, title FROM cms_pages
        WHERE id = ${itemId}::uuid AND organization_id = ${orgId}::uuid
        LIMIT 1
        FOR UPDATE
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

      // The role each transition requires is enforced here, not only documented
      if (!(await hasMinRole(rule.minRole))) {
        throw ApiError.forbidden(`Moving content from "${currentStatus}" requires the ${rule.minRole} role`);
      }

      // Update status
      const publishedClause = newStatus === 'published'
        ? sql`, published_at = now()`
        : sql``;

      const updated = await tx.execute(sql`
        UPDATE cms_pages
        SET status = ${newStatus},
            updated_by = ${userId},
            updated_at = now()
            ${publishedClause}
        WHERE id = ${itemId}::uuid AND organization_id = ${orgId}::uuid AND status = ${currentStatus}
        RETURNING id
      `);
      if (Array.from(updated).length === 0) {
        throw ApiError.conflict('Content status changed concurrently; reload and retry');
      }

      await persistAtomicAudit(tx, {
        organizationId: orgId,
        userId,
        action: 'content.status.transition',
        resourceType: 'cms_pages',
        resourceId: itemId,
        details: { fromStatus: currentStatus, toStatus: newStatus },
      });

      return {
        id: itemId,
        title: current.title,
        previousStatus: currentStatus,
        status: newStatus,
        message: `Status changed from "${currentStatus}" to "${newStatus}"`,
      };
    });
  },
);
