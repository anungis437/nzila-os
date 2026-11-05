/**
 * Knowledge Base Detail Route — returns a single KB record with full content.
 * Validates the requesting user's org (or parent org) owns the record.
 */

import { NextResponse } from 'next/server';
import { hasMinRole } from '@/lib/api-auth-guard';
import { withApi } from '@/lib/api/framework';
import { knowledgeBaseSourceCondition, resolveInterviewReader } from '@/lib/knowledge-transfer/governance/interview-access';
import { knowledgeBaseParentSharedCondition } from '@/lib/knowledge-transfer/governance/kb-visibility';
import { readerHasKnowledgeSuite, KNOWLEDGE_READ_POLICY } from '@/lib/knowledge-transfer/governance/kb-entitlement';
import { verifiedParentOf } from '@/lib/organizations/read-authority';
import { db } from '@/db/db';
import { knowledgeBase } from '@/db/schema';
import { eq, and, sql } from 'drizzle-orm';
import { z } from 'zod';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { withSystemContext } from '@/lib/db/with-rls-context';

// The organization's own record, its audit record and the view counter run in the caller organization's tenant transaction (`rlsOrgContext`): the
// audit commits with the read, and the counter is bumped as the runtime role, which holds the grant (the system role has none on this table). A row
// the PARENT shared is another organization's row, which a tenant transaction cannot see: it is read as the system role, by id, only when the
// hierarchy's own record names the parent and the row is one the parent shared with this organization. Its view is audited here; it is not counted
// on the parent's row, which the caller's role cannot update.
export const GET = withApi(
  {
    auth: { required: true },
    rlsOrgContext: true,
    openapi: { tags: ['Knowledge base'], summary: 'Read one knowledge base record with its full content' },
  },
  async ({ user, organizationId, params }) => {
  const orgId = organizationId!;
  const { id } = params;
  // A malformed id is a client error here, never a database fault handed back as a 500.
  if (!z.guid().safeParse(id).success) {
    return NextResponse.json({ error: 'Invalid document id' }, { status: 400 });
  }

  // Resolve parent org so locals can view national docs
  const parentId = await verifiedParentOf(orgId);

  const reader = await resolveInterviewReader(user?.id ?? null, false, hasMinRole);
  const columns = {
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
  };
  let [row] = await db
    .select(columns)
    .from(knowledgeBase)
    .where(
      and(
        eq(knowledgeBase.id, id),
        eq(knowledgeBase.organizationId, orgId),
        eq(knowledgeBase.isActive, true),
        knowledgeBaseSourceCondition(reader, orgId),
      ),
    );

  if (!row && parentId) {
    [row] = await withSystemContext((tx) =>
      tx
        .select(columns)
        .from(knowledgeBase)
        .where(and(eq(knowledgeBase.id, id), knowledgeBaseParentSharedCondition(orgId, parentId), eq(knowledgeBase.isActive, true))),
    );
  }

  if (!row) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 });
  }

  // A parent's shared row reaches this organization only with the knowledge suite entitlement. The attempt is a specific blocked
  // operation and is recorded as one, before anything is returned.
  if (row.organizationId !== orgId && KNOWLEDGE_READ_POLICY.parentSharedRowsRequireSuite && !(await readerHasKnowledgeSuite(orgId))) {
    await persistAtomicAudit(db, {
      organizationId: orgId,
      userId: user?.id ?? null,
      action: 'knowledge_base.read_denied',
      resourceType: 'knowledge_base',
      resourceId: id,
      details: { reason: 'union_knowledge_suite_required', policyVersion: KNOWLEDGE_READ_POLICY.version, policyApprovedBy: KNOWLEDGE_READ_POLICY.approvedBy },
    }, 'failure');
    return NextResponse.json(
      { error: { code: 'ENTITLEMENT_REQUIRED', message: 'This document is shared by a parent organization and needs the union knowledge suite' } },
      { status: 403 },
    );
  }

  // Who opened which document is recorded before the content is returned.
  await persistAtomicAudit(db, {
    organizationId: orgId,
    userId: user?.id ?? null,
    action: 'knowledge_base.read',
    resourceType: 'knowledge_base',
    resourceId: id,
    details: { ownedByReader: row.organizationId === orgId },
  });

  // Bump the view count on the exact row that was read, with its organization in the predicate. It is a statement of the request's own
  // transaction: a failure of it is not swallowed. Only the caller's own row is counted: a parent's row is not the runtime role's to update.
  if (row.organizationId === orgId) {
    await db
      .update(knowledgeBase)
      .set({ viewCount: sql`${knowledgeBase.viewCount} + 1` })
      .where(and(eq(knowledgeBase.id, id), eq(knowledgeBase.organizationId, row.organizationId)));
  }

  const { organizationId: _owner, ...visible } = row;
  return NextResponse.json({ data: visible });
  },
);
