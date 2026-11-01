/**
 * Knowledge Base API Route
 *
 * Returns active knowledge base records for the current user's org.
 * Supports filtering by documentType and sourceType, plus text search.
 * Excludes embedding vectors from the response to keep payloads small.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, BaseAuthContext, getCurrentUser, hasMinRole } from '@/lib/api-auth-guard';
import { knowledgeBaseSourceCondition, resolveInterviewReader } from '@/lib/knowledge-transfer/governance/interview-access';
import { knowledgeBaseOrganizationCondition } from '@/lib/knowledge-transfer/governance/kb-visibility';
import { knowledgeBaseReadScope, readerHasKnowledgeSuite } from '@/lib/knowledge-transfer/governance/kb-entitlement';
import { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and, ilike, or, sql } from 'drizzle-orm';
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
  // A parent's shared rows reach a child only with the knowledge suite entitlement; without it they are withheld, and the answer says so.
  const hasSuite = parentId ? await readerHasKnowledgeSuite(orgId) : true;
  const scope = knowledgeBaseReadScope(orgId, parentId, hasSuite);
  const visibleOrgs = scope.condition;

  const url = new URL(request.url);
  const documentType = url.searchParams.get('documentType');
  const sourceType = url.searchParams.get('sourceType');
  const q = url.searchParams.get('q')?.trim();

  // A copy of an exit interview carries the interview's sensitivity and consent, and does not cross to child organizations.
  const reader = await resolveInterviewReader(user?.id ?? null, false, hasMinRole);
  const sourceCondition = knowledgeBaseSourceCondition(reader, orgId);
  const conditions = [
    visibleOrgs,
    eq(knowledgeBase.isActive, true),
    sourceCondition,
  ];

  if (documentType) {
    conditions.push(eq(knowledgeBase.documentType, documentType as never));
  }
  if (sourceType) {
    conditions.push(eq(knowledgeBase.sourceType, sourceType));
  }
  if (q) {
    const pattern = `%${q}%`;
    // The search matches what the list returns (title and summary), not the full content of rows whose content it does not show.
    conditions.push(
      or(
        ilike(knowledgeBase.title, pattern),
        ilike(knowledgeBase.summary, pattern),
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
    .where(and(visibleOrgs, eq(knowledgeBase.isActive, true), sourceCondition))
    .groupBy(knowledgeBase.sourceType);

  return NextResponse.json({
    data: rows,
    total: rows.length,
    counts,
    ...(scope.parentSharedWithheld
      ? { withheld: { parentShared: true, reason: 'union_knowledge_suite_required' } }
      : {}),
  });
});
