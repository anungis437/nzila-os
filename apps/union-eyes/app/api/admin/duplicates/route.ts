/**
 * API Route: Duplicate Group Management
 * GET  /api/admin/duplicates — list duplicate groups
 * POST /api/admin/duplicates — update group status (confirm/dismiss/merge)
 *
 * Powers the Duplicate Review Panel (§8).
 */

import { withApi, z, ApiError } from '@/lib/api/framework';
import { db } from '@/db/db';
import { eq, and, desc, count, inArray } from 'drizzle-orm';
import {
  duplicateGroups,
  duplicateGroupMembers,
} from '@/db/schema/ingestion-schema';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';

// ─── GET: List duplicate groups ─────────────────────────────────────────────

const listQuerySchema = z.object({
  status: z.string().optional(),
  group_type: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export const GET = withApi(
  {
    // duplicate_groups and its members are tenant tables: the read runs in the caller's own tenant transaction, as the runtime role.
    rlsOrgContext: true,
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

    const [totalResult] = await db.select({ count: count() }).from(duplicateGroups).where(whereClause);

    const groups = await db
      .select()
      .from(duplicateGroups)
      .where(whereClause)
      .orderBy(desc(duplicateGroups.createdAt))
      .limit(query.limit)
      .offset(query.offset);

    // The members of every listed group, in one query.
    const members = groups.length === 0
      ? []
      : await db
          .select()
          .from(duplicateGroupMembers)
          .where(inArray(duplicateGroupMembers.groupId, groups.map((group) => group.id)));
    const membersByGroup = new Map<string, typeof members>();
    for (const member of members) {
      const list = membersByGroup.get(member.groupId) ?? [];
      list.push(member);
      membersByGroup.set(member.groupId, list);
    }

    const groupsWithMembers = groups.map((group) => ({
      ...group,
      autoScore: group.autoScore,
      createdAt: group.createdAt.toISOString(),
      reviewedAt: group.reviewedAt?.toISOString() ?? null,
      members: (membersByGroup.get(group.id) ?? []).map((m) => ({
        ...m,
        similarityScore: m.similarityScore,
        createdAt: m.createdAt.toISOString(),
      })),
    }));

    return {
      groups: groupsWithMembers,
      total: totalResult?.count ?? 0,
    };
  },
);

// ─── POST: Update group status ──────────────────────────────────────────────

const updateBodySchema = z.object({
  group_id: z.guid(),
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

    const statusMap = {
      confirm: 'confirmed',
      dismiss: 'dismissed',
      merge: 'merged',
    } as const;

    const newStatus = statusMap[body.action];

    // The lookup, the resolution and its audit record are one tenant transaction: they commit together, and the group is read under the
    // caller's organization's row-level security as well as by the explicit predicate.
    await withRLSContext({ organizationId }, async (tx) => {
      const [group] = await tx
        .select()
        .from(duplicateGroups)
        .where(
          and(
            eq(duplicateGroups.id, body.group_id),
            eq(duplicateGroups.organizationId, organizationId),
          ),
        );

      if (!group) {
        throw ApiError.notFound('Duplicate group not found');
      }

      await tx
        .update(duplicateGroups)
        .set({
          status: newStatus,
          reviewedBy: userId,
          reviewedAt: new Date(),
        })
        .where(and(eq(duplicateGroups.id, body.group_id), eq(duplicateGroups.organizationId, organizationId)));
      await persistAtomicAudit(tx, {
        userId: userId ?? 'system:duplicate-review',
        organizationId,
        resourceType: 'duplicate_group',
        resourceId: body.group_id,
        action: `duplicate.${body.action}`,
        details: { groupType: group.groupType, previousStatus: group.status, newStatus },
      });
    });

    return {
      id: body.group_id,
      status: newStatus,
      message: `Duplicate group ${body.action}ed`,
    };
  },
);
