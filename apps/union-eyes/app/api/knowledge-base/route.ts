/**
 * Knowledge Base API Route
 *
 * Returns active knowledge base records for the current user's org.
 * Supports filtering by documentType and sourceType, plus text search.
 * Excludes embedding vectors from the response to keep payloads small.
 */

import { NextResponse } from 'next/server';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withApi } from '@/lib/api/framework';
import { knowledgeBaseSourceCondition, resolveInterviewReader } from '@/lib/knowledge-transfer/governance/interview-access';
import { knowledgeBaseReadScope, readerHasKnowledgeSuite } from '@/lib/knowledge-transfer/governance/kb-entitlement';
import { knowledgeBaseParentSharedCondition } from '@/lib/knowledge-transfer/governance/kb-visibility';
import { verifiedParentOf } from '@/lib/organizations/read-authority';
import { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and, ilike, or, sql, type SQL } from 'drizzle-orm';
import { withSystemContext } from '@/lib/db/with-rls-context';

// Any signed-in member of an organization may read its knowledge base: the read of the organization's own records runs in its tenant transaction
// (`rlsOrgContext`), where row-level security shows exactly those. What a PARENT organization shared with it is another organization's row, which a
// tenant transaction cannot see: it is read as the system role, only when the hierarchy's own record names the parent (never a caller's claim) and
// the reader holds the knowledge suite entitlement, and only the rows the parent shared (public, or naming this organization).
export const GET = withApi(
  {
    auth: { required: true },
    rlsOrgContext: true,
    openapi: { tags: ['Knowledge base'], summary: 'List the active knowledge base records visible to the organization' },
  },
  async ({ request, user, organizationId }) => {
  const orgId = organizationId!;

  // Resolve the parent org so locals see national-level documents from their parent federation.
  const parentId = await verifiedParentOf(orgId);
  // A parent's shared rows reach a child only with the knowledge suite entitlement; without it they are withheld, and the answer says so.
  const hasSuite = parentId ? await readerHasKnowledgeSuite(orgId) : true;
  const scope = knowledgeBaseReadScope(orgId, parentId, hasSuite);
  const readParentShared = parentId !== undefined && !scope.parentSharedWithheld;

  const url = new URL(request.url);
  const documentType = url.searchParams.get('documentType');
  const sourceType = url.searchParams.get('sourceType');
  const q = url.searchParams.get('q')?.trim();

  // The filter must name a real document type: the database refuses anything else, and that must not come back as a server fault
  if (documentType && !(knowledgeBase.documentType.enumValues as readonly string[]).includes(documentType)) {
    return NextResponse.json({ error: 'Invalid documentType' }, { status: 400 });
  }

  // A copy of an exit interview carries the interview's sensitivity and consent, and does not cross to child organizations.
  const reader = await resolveInterviewReader(user?.id ?? null, false, hasMinRole);
  const sourceCondition = knowledgeBaseSourceCondition(reader, orgId);

  // What the caller filtered by, applied to the organization's own rows and to the parent's shared rows alike.
  const filters: SQL[] = [eq(knowledgeBase.isActive, true)];
  if (documentType) {
    filters.push(eq(knowledgeBase.documentType, documentType as never));
  }
  if (sourceType) {
    filters.push(eq(knowledgeBase.sourceType, sourceType));
  }
  if (q) {
    const pattern = `%${q}%`;
    // The search matches what the list returns (title and summary), not the full content of rows whose content it does not show.
    filters.push(
      or(
        ilike(knowledgeBase.title, pattern),
        ilike(knowledgeBase.summary, pattern),
      )!,
    );
  }

  const columns = {
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
  };

  // The organization's own rows, in its tenant transaction.
  const ownRows = await db
    .select(columns)
    .from(knowledgeBase)
    .where(and(eq(knowledgeBase.organizationId, orgId), sourceCondition, ...filters))
    .orderBy(knowledgeBase.title)
    .limit(200);

  // Also return aggregate counts per source_type
  const ownCounts = await db
    .select({
      sourceType: knowledgeBase.sourceType,
      count: sql<number>`count(*)::int`,
    })
    .from(knowledgeBase)
    .where(and(eq(knowledgeBase.organizationId, orgId), eq(knowledgeBase.isActive, true), sourceCondition))
    .groupBy(knowledgeBase.sourceType);

  // The parent's shared rows: another organization's rows, read as the system role. The condition names the parent, the shared rows and nothing else.
  const parentShared = readParentShared
    ? await withSystemContext(async (tx) => {
        const shared = knowledgeBaseParentSharedCondition(orgId, parentId!);
        const parentRows = await tx
          .select(columns)
          .from(knowledgeBase)
          .where(and(shared, ...filters))
          .orderBy(knowledgeBase.title)
          .limit(200);
        const parentCounts = await tx
          .select({ sourceType: knowledgeBase.sourceType, count: sql<number>`count(*)::int` })
          .from(knowledgeBase)
          .where(and(shared, eq(knowledgeBase.isActive, true)))
          .groupBy(knowledgeBase.sourceType);
        return { parentRows, parentCounts };
      })
    : { parentRows: [], parentCounts: [] };

  const rows = [...ownRows, ...parentShared.parentRows]
    .sort((a, b) => (a.title ?? '').localeCompare(b.title ?? ''))
    .slice(0, 200);
  const countsBySource = new Map<string | null, number>();
  for (const entry of [...ownCounts, ...parentShared.parentCounts]) {
    countsBySource.set(entry.sourceType, (countsBySource.get(entry.sourceType) ?? 0) + Number(entry.count));
  }
  const counts = [...countsBySource.entries()].map(([source, count]) => ({ sourceType: source, count }));

  return NextResponse.json({
    data: rows,
    total: rows.length,
    counts,
    ...(scope.parentSharedWithheld
      ? { withheld: { parentShared: true, reason: 'union_knowledge_suite_required' } }
      : {}),
  });
  },
);
