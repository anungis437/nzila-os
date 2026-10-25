/**
 * Semantic Knowledge Indexer
 *
 * Generates vector embeddings for published exit interview content and upserts
 * them into the knowledge_base table for RAG retrieval.
 *
 * Privacy contract:
 * - Org-scoped: embeddings are never shared cross-org
 * - Sensitivity gate: legal_sensitive + executive_confidential are SKIPPED
 * - Consent gate: interviews without consent_granted are SKIPPED
 * - Lineage: every kb record has sourceType='exit_interview' + sourceId=interview.id
 *
 * INV-01: All AI calls routed through @nzila/ai-sdk via getAiClient()
 */

import { and, eq } from 'drizzle-orm';
import { exitInterviews, exitInterviewEvents, knowledgeBase } from '@/db/schema';
import { withRLSContext, type RLSTx } from '@/lib/db/with-rls-context';
import { persistAtomicAudit } from '@/lib/audit/atomic-audit';
import { performAuditedOperation } from '@/lib/audit/operation-audit';
import {
  getAiClient,
  UE_APP_KEY,
  UE_PROFILES,
  UE_SYSTEM_ORG_ID,
} from '@/lib/ai/ai-client';
import { embeddingCache } from '@/lib/services/ai/embedding-cache';
import { logger } from '@/lib/logger';
import type { ExitInterview } from '@/db/schema';

// Sensitivity levels that bypass RAG indexing regardless of consent
const INDEXING_BLOCKED_SENSITIVITY = new Set(['legal_sensitive', 'executive_confidential'] as const);

async function generateEmbedding(text: string, _orgId?: string): Promise<number[]> {
  const cached = await embeddingCache.getCachedEmbedding(text, 'ai-sdk');
  if (cached) return cached;

  const ai = getAiClient();
  const result = await ai.embed({
    orgId: UE_SYSTEM_ORG_ID,
    appKey: UE_APP_KEY,
    profileKey: UE_PROFILES.EMBEDDINGS,
    input: text,
    dataClass: 'internal',
  });
  const embedding = result.embeddings[0];
  embeddingCache.setCachedEmbedding(text, 'ai-sdk', embedding).catch(() => {});
  return embedding;
}

/**
 * Build a single indexable text block from an interview.
 * Sections are labelled so chunk retrieval can reconstruct provenance.
 */
export function buildIndexableContent(interview: ExitInterview): string {
  const sections: string[] = [
    `# ${interview.title}`,
    `Role: ${interview.roleInUnion} | Years of service: ${interview.yearsOfService}`,
  ];

  if (interview.summary) sections.push(`## Summary\n${interview.summary}`);
  if (interview.keyLessons) sections.push(`## Key lessons\n${interview.keyLessons}`);
  if (interview.bestPractices) sections.push(`## Best practices\n${interview.bestPractices}`);
  if (interview.bargainingAdvice) sections.push(`## Bargaining advice\n${interview.bargainingAdvice}`);
  if (interview.mediationAdvice) sections.push(`## Mediation advice\n${interview.mediationAdvice}`);
  if (interview.incomingOfficerAdvice) sections.push(`## Incoming officer advice\n${interview.incomingOfficerAdvice}`);
  if (interview.expertiseTags?.length) sections.push(`## Expertise areas\n${interview.expertiseTags.join(', ')}`);
  if (interview.topics?.length) sections.push(`## Topics\n${interview.topics.join(', ')}`);

  return sections.join('\n\n');
}

export type IndexResult =
  | { indexed: true; knowledgeBaseId: string }
  | { indexed: false; reason: string };

/**
 * Index a single exit interview into the vector knowledge base.
 * Idempotent — will upsert if knowledgeBaseId already set.
 *
 * The embedding call sends interview content to the AI provider, which cannot share a database transaction, so its
 * intent is recorded first and the call is skipped if that record cannot be written. Every state change (skipped,
 * indexed, failed) commits with its audit record in the same transaction.
 */
export async function indexExitInterview(
  interviewId: string,
  orgId: string,
  userId: string,
  options: { eventNotes?: string } = {},
): Promise<IndexResult> {
  const audit = (
    tx: RLSTx,
    action: string,
    details: Record<string, unknown>,
    outcome: 'success' | 'failure' = 'success',
  ) =>
    persistAtomicAudit(
      tx,
      { organizationId: orgId, userId, action, resourceType: 'exit_interviews', resourceId: interviewId, details },
      outcome,
    );
  const ownInterview = and(eq(exitInterviews.id, interviewId), eq(exitInterviews.organizationId, orgId));

  const markSkipped = (reason: string): Promise<IndexResult> =>
    withRLSContext({ organizationId: orgId }, async (tx) => {
      await tx.update(exitInterviews).set({ indexingStatus: 'skipped', updatedAt: new Date() }).where(ownInterview);
      await audit(tx, 'exit_interview.index.skipped', { reason });
      return { indexed: false, reason };
    });

  try {
    const interview = await withRLSContext({ organizationId: orgId }, async (tx) => {
      const [row] = await tx.select().from(exitInterviews).where(ownInterview).limit(1);
      return row ?? null;
    });

    if (!interview) {
      return { indexed: false, reason: 'Interview not found' };
    }

    // Governance gate
    if (INDEXING_BLOCKED_SENSITIVITY.has(interview.sensitivityLevel as never)) {
      return markSkipped(`Sensitivity level '${interview.sensitivityLevel}' blocks indexing`);
    }

    // Consent gate
    if (!interview.consentGranted) {
      return markSkipped('Retiree consent not granted');
    }

    const content = buildIndexableContent(interview);
    const embedding = await performAuditedOperation(
      {
        organizationId: orgId,
        userId,
        action: 'exit_interview.index.embed',
        resourceType: 'exit_interviews',
        resourceId: interviewId,
        details: { sensitivityLevel: interview.sensitivityLevel },
      },
      () => generateEmbedding(content, orgId),
    );
    const now = new Date();

    return await withRLSContext({ organizationId: orgId }, async (tx): Promise<IndexResult> => {
      let knowledgeBaseId: string;

      if (interview.knowledgeBaseId) {
        // Upsert
        const [kb] = await tx
          .update(knowledgeBase)
          .set({
            content,
            embedding: embedding as never,
            embeddingModel: 'text-embedding-3-small',
            embeddingModelVersion: 'text-embedding-3-small@v1',
            tags: interview.topics ?? [],
            keywords: interview.expertiseTags ?? [],
            updatedAt: now,
          })
          .where(and(eq(knowledgeBase.id, interview.knowledgeBaseId), eq(knowledgeBase.organizationId, orgId)))
          .returning({ id: knowledgeBase.id });
        if (!kb) throw new Error('Knowledge base record not found');
        knowledgeBaseId = kb.id;
      } else {
        // First index — create kb record
        const [kbRecord] = await tx
          .insert(knowledgeBase)
          .values({
            organizationId: orgId,
            title: interview.title,
            documentType: 'guide',
            content,
            summary: interview.summary ?? undefined,
            sourceType: 'exit_interview',
            sourceId: interview.id,
            embedding: embedding as never,
            embeddingModel: 'text-embedding-3-small',
            embeddingModelVersion: 'text-embedding-3-small@v1',
            tags: interview.topics ?? [],
            keywords: interview.expertiseTags ?? [],
            isPublic: false,
            isActive: true,
            createdBy: userId,
            createdAt: now,
            updatedAt: now,
          })
          .returning();
        knowledgeBaseId = kbRecord.id;
      }

      const [marked] = await tx
        .update(exitInterviews)
        .set({ knowledgeBaseId, indexingStatus: 'indexed', indexedAt: now, updatedAt: now })
        .where(and(ownInterview, eq(exitInterviews.status, 'published')))
        .returning({ id: exitInterviews.id });
      if (!marked) throw new Error('Interview is no longer published');

      if (options.eventNotes) {
        await tx.insert(exitInterviewEvents).values({
          interviewId,
          organizationId: orgId,
          eventType: 'indexed',
          actorUserId: userId,
          notes: options.eventNotes,
          payload: { knowledgeBaseId },
        });
      }

      await audit(tx, 'exit_interview.index', { knowledgeBaseId, reindexed: Boolean(interview.knowledgeBaseId) });
      return { indexed: true, knowledgeBaseId };
    });
  } catch (err) {
    logger?.error('Semantic indexing failed', { interviewId, error: String(err) });
    await withRLSContext({ organizationId: orgId }, async (tx) => {
      await tx.update(exitInterviews).set({ indexingStatus: 'failed', updatedAt: new Date() }).where(ownInterview);
      await audit(tx, 'exit_interview.index.failed', { error: err instanceof Error ? err.message : String(err) }, 'failure');
    }).catch(() => {});
    return { indexed: false, reason: String(err) };
  }
}
