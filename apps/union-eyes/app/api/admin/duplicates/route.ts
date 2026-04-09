/**
 * API Route: Duplicate Group Management
 * GET  /api/admin/duplicates — list duplicate groups
 * POST /api/admin/duplicates — update group status (confirm/dismiss/merge)
 *
 * Powers the Duplicate Review Panel (§8).
 */

import { withApi, z, ApiError } from '@/lib/api/framework';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { db } from '@/db/db';
import { eq, and, desc, count } from 'drizzle-orm';
import {
  duplicateGroups,
  duplicateGroupMembers,
} from '@/db/schema/ingestion-schema';
import { auditLog, AuditEventType, AuditSeverity } from '@/lib/audit-logger';

// ─── GET: List duplicate groups ─────────────────────────────────────────────

const listQuerySchema = z.object({
  status: z.string().optional(),
  group_type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const GET = withApi(
  {
    auth: { minRole: 'admin' },
    query: listQuerySchema,
    openapi: {
      tags: ['Admin', 'Dedup'],
      summary: 'List duplicate groups',
      description: 'Returns paginated list of detected duplicate record groups.',
    },
  },
  async ({ query, organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('Organization context required');
    }

    const conditions = [eq(duplicateGroups.organizationId, organizationId)];
    if (query.status) {
      conditions.push(eq(duplicateGroups.status, query.status));
    }
    if (query.group_type) {
      conditions.push(eq(duplicateGroups.groupType, query.group_type));
    }

    const whereClause = and(...conditions);

    const [totalResult] = await withSystemContext(async () =>
      db.select({ count: count() }).from(duplicateGroups).where(whereClause),
    );

    const groups = await withSystemContext(async () =>
      db
        .select()
        .from(duplicateGroups)
        .where(whereClause)
        .orderBy(desc(duplicateGroups.createdAt))
        .limit(query.limit)
        .offset(query.offset),
    );

    // Fetch members for each group
    const groupsWithMembers = await Promise.all(
      groups.map(async (group) => {
        const members = await withSystemContext(async () =>
          db
            .select()
            .from(duplicateGroupMembers)
            .where(eq(duplicateGroupMembers.groupId, group.id)),
        );
        return {
          ...group,
          autoScore: group.autoScore,
          createdAt: group.createdAt.toISOString(),
          reviewedAt: group.reviewedAt?.toISOString() ?? null,
          members: members.map((m) => ({
            ...m,
            similarityScore: m.similarityScore,
            createdAt: m.createdAt.toISOString(),
          })),
        };
      }),
    );

    return {
      groups: groupsWithMembers,
      total: totalResult?.count ?? 0,
    };
  },
);

// ─── POST: Update group status ──────────────────────────────────────────────

const updateBodySchema = z.object({
  group_id: z.string().uuid(),
  action: z.enum(['confirm', 'dismiss', 'merge']),
});

export const POST = withApi(
  {
    auth: { minRole: 'admin' },
    body: updateBodySchema,
    openapi: {
      tags: ['Admin', 'Dedup'],
      summary: 'Resolve duplicate group',
      description: 'Confirm, dismiss, or merge a duplicate group.',
    },
  },
  async ({ body, userId, organizationId }) => {
    if (!organizationId) {
      throw ApiError.badRequest('Organization context required');
    }

    const [group] = await withSystemContext(async () =>
      db
        .select()
        .from(duplicateGroups)
        .where(
          and(
            eq(duplicateGroups.id, body.group_id),
            eq(duplicateGroups.organizationId, organizationId),
          ),
        ),
    );

    if (!group) {
      throw ApiError.notFound('Duplicate group not found');
    }

    const statusMap = {
      confirm: 'confirmed',
      dismiss: 'dismissed',
      merge: 'merged',
    } as const;

    const newStatus = statusMap[body.action];

    await withSystemContext(async () =>
      db
        .update(duplicateGroups)
        .set({
          status: newStatus,
          reviewedBy: userId,
          reviewedAt: new Date(),
        })
        .where(eq(duplicateGroups.id, body.group_id)),
    );

    // Audit the resolution
    await auditLog({
      eventType: AuditEventType.DATA_UPDATE,
      severity: AuditSeverity.MEDIUM,
      userId: userId ?? undefined,
      organizationId,
      resource: 'duplicate_group',
      resourceId: body.group_id,
      action: `duplicate.${body.action}`,
      details: {
        groupType: group.groupType,
        previousStatus: group.status,
        newStatus,
      },
      outcome: 'success',
    });

    return {
      id: body.group_id,
      status: newStatus,
      message: `Duplicate group ${body.action}ed`,
    };
  },
);
