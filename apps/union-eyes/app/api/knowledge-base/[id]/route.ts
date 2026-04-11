/**
 * Knowledge Base Detail Route — returns a single KB record with full content.
 * Validates the requesting user's org (or parent org) owns the record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, BaseAuthContext, getCurrentUser } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and, sql, inArray } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const GET = withApiAuth(async (
  _request: NextRequest,
  context: BaseAuthContext & { params: Promise<{ id: string }> },
) => {
  const { id } = await context.params;
  const user = await getCurrentUser();
  const orgId = user?.organizationId;
  if (!orgId) {
    return NextResponse.json({ error: 'Organization required' }, { status: 403 });
  }

  // Resolve parent org so locals can view national docs
  const parentRow = await withSystemContext(() => db.execute(
    sql`SELECT parent_id::text FROM organizations WHERE id = ${orgId}::uuid`,
  ));
  const parentId = parentRow[0]?.parent_id as string | undefined;
  const orgIds = parentId ? [orgId, parentId] : [orgId];

  const [row] = await db
    .select({
      id: knowledgeBase.id,
      title: knowledgeBase.title,
      content: knowledgeBase.content,
      documentType: knowledgeBase.documentType,
      sourceType: knowledgeBase.sourceType,
      sourceUrl: knowledgeBase.sourceUrl,
      summary: knowledgeBase.summary,
      tags: knowledgeBase.tags,
      language: knowledgeBase.language,
      effectiveDate: knowledgeBase.effectiveDate,
      version: knowledgeBase.version,
      viewCount: knowledgeBase.viewCount,
    })
    .from(knowledgeBase)
    .where(
      and(
        eq(knowledgeBase.id, id),
        inArray(knowledgeBase.organizationId, orgIds),
        eq(knowledgeBase.isActive, true),
      ),
    );

  if (!row) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // Bump view count (fire-and-forget)
  withSystemContext(() => db.execute(
    sql`UPDATE knowledge_base SET view_count = view_count + 1 WHERE id = ${id}::uuid`,
  )).catch(() => {});

  return NextResponse.json({ data: row });
});
