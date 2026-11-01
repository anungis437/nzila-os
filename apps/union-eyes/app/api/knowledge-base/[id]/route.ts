/**
 * Knowledge Base Detail Route — returns a single KB record with full content.
 * Validates the requesting user's org (or parent org) owns the record.
 */

import { NextRequest, NextResponse } from 'next/server';
import { withApiAuth, BaseAuthContext, getCurrentUser, hasMinRole } from '@/lib/api-auth-guard';
import { knowledgeBaseSourceCondition, resolveInterviewReader } from '@/lib/knowledge-transfer/governance/interview-access';
import { knowledgeBaseOrganizationCondition } from '@/lib/knowledge-transfer/governance/kb-visibility';
import { readerHasKnowledgeSuite, KNOWLEDGE_READ_POLICY } from '@/lib/knowledge-transfer/governance/kb-entitlement';
import { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { withRLSContext } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withSystemContext } from '@/lib/db/with-rls-context';
import { logger } from '@/lib/logger';

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
  const visibleOrgs = knowledgeBaseOrganizationCondition(orgId, parentId);

  const reader = await resolveInterviewReader(user?.id ?? null, false, hasMinRole);
  const [row] = await db
    .select({
      id: knowledgeBase.id,
      organizationId: knowledgeBase.organizationId,
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
        visibleOrgs,
        eq(knowledgeBase.isActive, true),
        knowledgeBaseSourceCondition(reader, orgId),
      ),
    );

  if (!row) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // A parent's shared row reaches this organization only with the knowledge suite entitlement. The attempt is a specific blocked
  // operation and is recorded as one, before anything is returned.
  if (row.organizationId !== orgId && KNOWLEDGE_READ_POLICY.parentSharedRowsRequireSuite && !(await readerHasKnowledgeSuite(orgId))) {
    await withRLSContext({ organizationId: orgId, userId: user?.id }, (tx) =>
      persistAtomicAudit(tx, {
        organizationId: orgId,
        userId: user?.id ?? null,
        action: 'knowledge_base.read_denied',
        resourceType: 'knowledge_base',
        resourceId: id,
        details: { reason: 'union_knowledge_suite_required', policyVersion: KNOWLEDGE_READ_POLICY.version, policyApprovedBy: KNOWLEDGE_READ_POLICY.approvedBy },
      }, 'failure'),
    );
    return NextResponse.json(
      { error: { code: 'ENTITLEMENT_REQUIRED', message: 'This document is shared by a parent organization and needs the union knowledge suite' } },
      { status: 403 },
    );
  }

  // Who opened which document is recorded before the content is returned.
  await withRLSContext({ organizationId: orgId, userId: user?.id }, (tx) =>
    persistAtomicAudit(tx, {
      organizationId: orgId,
      userId: user?.id ?? null,
      action: 'knowledge_base.read',
      resourceType: 'knowledge_base',
      resourceId: id,
      details: { ownedByReader: row.organizationId === orgId },
    }),
  );

  // Bump view count (fire-and-forget). Log failures so a broken index or
  // permissions issue is visible instead of silently never recording views.
  withSystemContext(() => db.execute(
    // The counter is bumped on the exact row that was read, with its organization in the predicate: the system context is not tenant-scoped.
    sql`UPDATE knowledge_base SET view_count = view_count + 1 WHERE id = ${id}::uuid AND organization_id = ${row.organizationId}::uuid`,
  )).catch((error) => {
    logger.warn('knowledge-base: failed to increment view_count', { id, error: error instanceof Error ? error.message : String(error) });
  });

  const { organizationId: _owner, ...visible } = row;
  return NextResponse.json({ data: visible });
});
