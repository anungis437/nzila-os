/**
 * Knowledge Base API Route
 *
 * Returns active knowledge base records for the current user's org.
 * Supports filtering by documentType and sourceType, plus text search.
 * Excludes embedding vectors from the response to keep payloads small.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, BaseAuthContext, getCurrentUser } from '@/lib/api-auth-guard';
import { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and, ilike, or, sql, inArray } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

export const GET = withApiAuth(async (request: NextRequest, _context: BaseAuthContext) => {
  const user = await getCurrentUser();
  const orgId = user?.organizationId;
  if (!orgId) {
    return NextResponse.json({ data: [], total: 0 });
  }

  // Resolve org IDs to query — include the user's org AND its parent org
  // so locals see national-level documents from their parent federation.
  const parentRow = await withSystemContext(() => db.execute(
    sql`SELECT parent_id::text FROM organizations WHERE id = ${orgId}::uuid`,
  ));
  const parentId = parentRow[0]?.parent_id as string | undefined;
  const orgIds = parentId ? [orgId, parentId] : [orgId];

  const url = new URL(request.url);
  const documentType = url.searchParams.get('documentType');
  const sourceType = url.searchParams.get('sourceType');
  const q = url.searchParams.get('q')?.trim();

  const conditions = [
    inArray(knowledgeBase.organizationId, orgIds),
    eq(knowledgeBase.isActive, true),
  ];

  if (documentType) {
    conditions.push(eq(knowledgeBase.documentType, documentType as never));
  }
  if (sourceType) {
    conditions.push(eq(knowledgeBase.sourceType, sourceType));
  }
  if (q) {
    const pattern = `%${q}%`;
    conditions.push(
      or(
        ilike(knowledgeBase.title, pattern),
        ilike(knowledgeBase.content, pattern),
      )!,
    );
  }

  const rows = await db
    .select({
      id: knowledgeBase.id,
      title: knowledgeBase.title,
      documentType: knowledgeBase.documentType,
      sourceType: knowledgeBase.sourceType,
      sourceUrl: knowledgeBase.sourceUrl,
      summary: knowledgeBase.summary,
      tags: knowledgeBase.tags,
      language: knowledgeBase.language,
      effectiveDate: knowledgeBase.effectiveDate,
      version: knowledgeBase.version,
      viewCount: knowledgeBase.viewCount,
      createdAt: knowledgeBase.createdAt,
    })
    .from(knowledgeBase)
    .where(and(...conditions))
    .orderBy(knowledgeBase.title)
    .limit(200);

  // Also return aggregate counts per source_type
  const counts = await db
    .select({
      sourceType: knowledgeBase.sourceType,
      count: sql<number>`count(*)::int`,
    })
    .from(knowledgeBase)
    .where(and(inArray(knowledgeBase.organizationId, orgIds), eq(knowledgeBase.isActive, true)))
    .groupBy(knowledgeBase.sourceType);

  return NextResponse.json({ data: rows, total: rows.length, counts });
});
