/**
 * GET /api/governance/bylaws
 * Canonical bylaws feed for the governance dashboard.
 *
 * Sourced from the knowledge base using governance/bylaws document types.
 */
import { withApi } from '@/lib/api/framework';
import { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { and, desc, eq, inArray } from 'drizzle-orm';

export const dynamic = 'force-dynamic';

const BYLAW_TYPES = ['union_policy', 'guide'] as const;

export const GET = withApi(
  {
    auth: { required: true, minRole: 'steward' },
    openapi: { tags: ['Governance'], summary: 'List governance bylaws' },
  },
  async ({ organizationId }) => {
    const rows = await db
      .select({
        id: knowledgeBase.id,
        title: knowledgeBase.title,
        content: knowledgeBase.content,
        summary: knowledgeBase.summary,
        version: knowledgeBase.version,
        effectiveDate: knowledgeBase.effectiveDate,
        createdAt: knowledgeBase.createdAt,
      })
      .from(knowledgeBase)
      .where(
        and(
          eq(knowledgeBase.organizationId, organizationId!),
          eq(knowledgeBase.isActive, true),
          inArray(knowledgeBase.documentType, BYLAW_TYPES),
        ),
      )
      .orderBy(desc(knowledgeBase.effectiveDate), desc(knowledgeBase.createdAt))
      .limit(200);

    return rows.map((row, index) => ({
      id: row.id,
      article: `Article ${index + 1}`,
      title: row.title,
      content: row.content ?? row.summary ?? '',
      lastUpdated: (row.effectiveDate ?? row.createdAt)?.toISOString?.() ?? '',
      version: row.version ?? 1,
      status: 'active' as const,
    }));
  },
);
